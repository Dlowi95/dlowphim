import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PlaybackHealthEvent } from './playback-health.service';

export interface SharedOriginHealth {
  origin: string;
  starts: number;
  successes: number;
  failures: number;
  buffers: number;
  totalStartupMs: number;
  totalBufferMs: number;
  uniqueFailureReporters: number;
  lastSeenAt: number;
  blockedUntil: number;
  lastFailureType: string;
}

const ORIGIN_TTL_SECONDS = 30 * 60;
const REPORTER_TTL_MS = 2 * 60 * 1000;
const GLOBAL_BLOCK_MS = 5 * 60 * 1000;
const MAX_ORIGINS = 150;

const UPDATE_ORIGIN_SCRIPT = `
local healthKey = KEYS[1]
local reportersKey = KEYS[2]
local indexKey = KEYS[3]
local now = tonumber(ARGV[1])
local origin = ARGV[2]
local member = ARGV[3]
redis.call('HSET', healthKey, 'origin', origin, 'lastSeenAt', now)
redis.call('HINCRBY', healthKey, 'starts', tonumber(ARGV[4]))
redis.call('HINCRBY', healthKey, 'successes', tonumber(ARGV[5]))
redis.call('HINCRBY', healthKey, 'failures', tonumber(ARGV[6]))
redis.call('HINCRBY', healthKey, 'buffers', tonumber(ARGV[7]))
redis.call('HINCRBY', healthKey, 'totalStartupMs', tonumber(ARGV[8]))
redis.call('HINCRBY', healthKey, 'totalBufferMs', tonumber(ARGV[9]))
if ARGV[12] ~= '' then
  redis.call('HSET', healthKey, 'lastFailureType', ARGV[12])
end
redis.call('EXPIRE', healthKey, ${ORIGIN_TTL_SECONDS})
redis.call('ZADD', indexKey, now, member)
redis.call('ZREMRANGEBYSCORE', indexKey, 0, now - ${ORIGIN_TTL_SECONDS * 1000})
redis.call('EXPIRE', indexKey, ${ORIGIN_TTL_SECONDS * 2})
if tonumber(ARGV[10]) > 0 then
  redis.call('ZADD', reportersKey, now, ARGV[11])
end
redis.call('ZREMRANGEBYSCORE', reportersKey, 0, now - ${REPORTER_TTL_MS})
redis.call('EXPIRE', reportersKey, ${ORIGIN_TTL_SECONDS})
local reporters = redis.call('ZCARD', reportersKey)
local starts = tonumber(redis.call('HGET', healthKey, 'starts') or '0')
local successes = tonumber(redis.call('HGET', healthKey, 'successes') or '0')
local failures = tonumber(redis.call('HGET', healthKey, 'failures') or '0')
local attempts = math.max(1, starts, successes + failures)
if reporters >= 3 and failures >= 3 and failures / attempts >= 0.6 then
  redis.call('HSET', healthKey, 'blockedUntil', now + ${GLOBAL_BLOCK_MS})
end
return 1
`;

@Injectable()
export class PlaybackHealthRedisStore {
  private readonly logger = new Logger(PlaybackHealthRedisStore.name);
  private readonly baseUrl = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  private readonly token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  private readonly namespace = process.env.PLAYBACK_HEALTH_REDIS_PREFIX || 'dlowphim:playback';
  private warned = false;

  isEnabled() {
    return Boolean(this.baseUrl && this.token);
  }

  async recordBatch(events: PlaybackHealthEvent[], reporterId: string) {
    if (!this.isEnabled() || events.length === 0) return;
    const now = Date.now();
    const grouped = new Map<string, PlaybackHealthEvent[]>();
    for (const event of events) {
      const list = grouped.get(event.origin) || [];
      list.push(event);
      grouped.set(event.origin, list);
    }

    const reporterHash = createHash('sha256').update(reporterId).digest('hex').slice(0, 24);
    const commands = [...grouped.entries()].map(([origin, originEvents]) => {
      const member = Buffer.from(origin).toString('base64url');
      const count = (kind: string) => originEvents.filter((event) => event.kind === kind).length;
      const sumDuration = (kind: string) => originEvents
        .filter((event) => event.kind === kind)
        .reduce((sum, event) => sum + Math.max(0, Math.min(120_000, Number(event.durationMs) || 0)), 0);
      const networkFailure = originEvents.some(
        (event) => event.kind === 'failure' && /network|cors|manifest|level|fragment/i.test(event.failureType || ''),
      );
      const lastFailureType = [...originEvents]
        .reverse()
        .find((event) => event.kind === 'failure')?.failureType || '';
      return [
        'EVAL', UPDATE_ORIGIN_SCRIPT, '3',
        `${this.namespace}:origin:${member}`,
        `${this.namespace}:reporters:${member}`,
        `${this.namespace}:origins`,
        String(now), origin, member,
        String(count('start')), String(count('success')), String(count('failure')), String(count('buffer')),
        String(sumDuration('start')), String(sumDuration('buffer')),
        networkFailure ? '1' : '0', reporterHash, lastFailureType,
      ];
    });

    await this.request('/pipeline', commands);
  }

  async readOrigins(): Promise<SharedOriginHealth[] | null> {
    if (!this.isEnabled()) return null;
    const now = Date.now();
    const indexResult = await this.request('', [
      'ZRANGEBYSCORE', `${this.namespace}:origins`, String(now - ORIGIN_TTL_SECONDS * 1000), '+inf',
      'LIMIT', '0', String(MAX_ORIGINS),
    ]);
    const members = this.unwrap(indexResult);
    if (!Array.isArray(members) || members.length === 0) return [];

    const commands = members.flatMap((member) => [
      ['HGETALL', `${this.namespace}:origin:${member}`],
      ['ZCARD', `${this.namespace}:reporters:${member}`],
    ]);
    const pipeline = await this.request('/pipeline', commands);
    if (!Array.isArray(pipeline)) return null;

    const origins: SharedOriginHealth[] = [];
    for (let index = 0; index < members.length; index += 1) {
      const hash = this.unwrap(pipeline[index * 2]);
      const reporters = Number(this.unwrap(pipeline[index * 2 + 1])) || 0;
      if (!Array.isArray(hash) || hash.length === 0) continue;
      const fields: Record<string, string> = {};
      for (let fieldIndex = 0; fieldIndex < hash.length; fieldIndex += 2) {
        fields[String(hash[fieldIndex])] = String(hash[fieldIndex + 1] ?? '');
      }
      if (!fields.origin) continue;
      origins.push({
        origin: fields.origin,
        starts: Number(fields.starts) || 0,
        successes: Number(fields.successes) || 0,
        failures: Number(fields.failures) || 0,
        buffers: Number(fields.buffers) || 0,
        totalStartupMs: Number(fields.totalStartupMs) || 0,
        totalBufferMs: Number(fields.totalBufferMs) || 0,
        uniqueFailureReporters: reporters,
        lastSeenAt: Number(fields.lastSeenAt) || 0,
        blockedUntil: Number(fields.blockedUntil) || 0,
        lastFailureType: fields.lastFailureType || '',
      });
    }
    return origins;
  }

  private unwrap(value: any) {
    return value && typeof value === 'object' && 'result' in value ? value.result : value;
  }

  private async request(path: string, body: unknown): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 900);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Redis REST ${response.status}`);
      this.warned = false;
      return response.json();
    } catch (error) {
      if (!this.warned) {
        this.warned = true;
        this.logger.warn(`Redis playback health unavailable; using local memory fallback: ${String(error)}`);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
