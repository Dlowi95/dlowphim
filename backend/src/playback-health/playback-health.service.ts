import { Injectable, Optional } from '@nestjs/common';
import { PlaybackHealthRedisStore } from './playback-health-redis.store';

export type PlaybackEventKind = 'start' | 'success' | 'buffer' | 'failure';

export interface PlaybackHealthEvent {
  origin: string;
  kind: PlaybackEventKind;
  durationMs?: number;
  failureType?: string;
}

interface OriginHealth {
  starts: number;
  successes: number;
  failures: number;
  buffers: number;
  totalStartupMs: number;
  totalBufferMs: number;
  reporters: Map<string, number>;
  lastSeenAt: number;
  blockedUntil: number;
  lastFailureType: string;
}

const MAX_ORIGINS = 150;
const ORIGIN_TTL_MS = 30 * 60 * 1000;
const REPORTER_TTL_MS = 2 * 60 * 1000;
const GLOBAL_BLOCK_MS = 5 * 60 * 1000;
const MAX_REPORTERS_PER_ORIGIN = 50;
const MAX_EVENTS_PER_REPORTER_MINUTE = 60;
const MAX_RATE_LIMIT_REPORTERS = 5000;

interface ReporterRate {
  startedAt: number;
  count: number;
  lastSeenAt: number;
}

@Injectable()
export class PlaybackHealthService {
  private readonly origins = new Map<string, OriginHealth>();
  private readonly reporterRates = new Map<string, ReporterRate>();

  constructor(
    @Optional() private readonly redisStore?: PlaybackHealthRedisStore,
  ) {}

  recordBatch(events: PlaybackHealthEvent[], reporterId: string) {
    const now = Date.now();
    this.cleanup(now);
    const sharedEvents: PlaybackHealthEvent[] = [];
    const allowed = this.consumeReporterQuota(reporterId, Math.min(events.length, 20), now);
    let accepted = 0;

    for (const event of events.slice(0, allowed)) {
      const origin = this.sanitizeOrigin(event.origin);
      if (!origin || !this.isValidKind(event.kind)) continue;
      const failureType = this.cleanFailureType(event.failureType);
      sharedEvents.push({ ...event, origin, failureType });
      accepted += 1;

      const health = this.origins.get(origin) || this.createHealth(now);
      health.lastSeenAt = now;
      const duration = Math.max(0, Math.min(120_000, Number(event.durationMs) || 0));

      if (event.kind === 'start') {
        health.starts += 1;
        health.totalStartupMs += duration;
      } else if (event.kind === 'success') {
        health.successes += 1;
      } else if (event.kind === 'buffer') {
        health.buffers += 1;
        health.totalBufferMs += duration;
      } else {
        health.failures += 1;
        health.lastFailureType = failureType;
        if (this.isNetworkFailure(failureType)) {
          health.reporters.set(reporterId, now);
          if (health.reporters.size > MAX_REPORTERS_PER_ORIGIN) {
            const oldestReporter = [...health.reporters.entries()]
              .sort((left, right) => left[1] - right[1])[0]?.[0];
            if (oldestReporter) health.reporters.delete(oldestReporter);
          }
        }
      }

      this.refreshBlock(health, now);
      this.origins.set(origin, health);
    }

    this.trimToLimit();
    if (this.redisStore?.isEnabled() && sharedEvents.length > 0) {
      void this.redisStore.recordBatch(sharedEvents, reporterId);
    }
    return { accepted, rejected: Math.max(0, events.length - accepted) };
  }

  async getReputation() {
    const now = Date.now();
    this.cleanup(now);
    const entries = await this.getHealthEntries(now);
    return entries.map(([origin, health]) => {
      const attempts = this.getAttempts(health);
      const failureRate = health.failures / attempts;
      const averageStartupMs = health.starts
        ? Math.round(health.totalStartupMs / health.starts)
        : 0;
      const averageBufferMs = health.buffers
        ? Math.round(health.totalBufferMs / health.buffers)
        : 0;
      return {
        origin,
        penaltyMs: Math.min(
          10_000,
          Math.round(failureRate * 6000 + averageStartupMs * 0.2 + averageBufferMs * 0.15),
        ),
        blockedUntil: health.blockedUntil > now ? health.blockedUntil : 0,
        samples: attempts,
      };
    });
  }

  async getAdminDashboard() {
    const now = Date.now();
    this.cleanup(now);
    const entries = await this.getHealthEntries(now);
    const origins = entries
      .map(([origin, health]) => {
        const attempts = this.getAttempts(health);
        const failureRate = health.failures / attempts;
        const averageStartupMs = health.starts
          ? Math.round(health.totalStartupMs / health.starts)
          : 0;
        const averageBufferMs = health.buffers
          ? Math.round(health.totalBufferMs / health.buffers)
          : 0;
        const blocked = health.blockedUntil > now;
        const bufferRate = health.buffers / Math.max(1, health.starts);
        const degraded = !blocked && (
          failureRate >= 0.25 ||
          averageStartupMs >= 4000 ||
          averageBufferMs >= 2500 ||
          (health.starts >= 3 && bufferRate >= 0.5)
        );
        return {
          origin,
          status: blocked ? 'blocked' : degraded ? 'degraded' : 'healthy',
          starts: health.starts,
          successes: health.successes,
          failures: health.failures,
          buffers: health.buffers,
          failureRate: Math.round(failureRate * 1000) / 10,
          averageStartupMs,
          averageBufferMs,
          bufferRate: Math.round(bufferRate * 1000) / 10,
          uniqueFailureReporters: health.uniqueFailureReporters,
          lastFailureType: health.lastFailureType || '',
          blockedUntil: blocked ? health.blockedUntil : 0,
          lastSeenAt: health.lastSeenAt,
        };
      })
      .sort((left, right) => {
        const priority = { blocked: 0, degraded: 1, healthy: 2 };
        return priority[left.status] - priority[right.status] || right.lastSeenAt - left.lastSeenAt;
      });

    return {
      generatedAt: now,
      storageScope: this.redisStore?.isEnabled() ? 'shared' : 'instance',
      windowMinutes: ORIGIN_TTL_MS / 60_000,
      summary: {
        activeOrigins: origins.length,
        healthyOrigins: origins.filter((item) => item.status === 'healthy').length,
        degradedOrigins: origins.filter((item) => item.status === 'degraded').length,
        blockedOrigins: origins.filter((item) => item.status === 'blocked').length,
        totalStarts: origins.reduce((sum, item) => sum + item.starts, 0),
        totalFailures: origins.reduce((sum, item) => sum + item.failures, 0),
        totalBuffers: origins.reduce((sum, item) => sum + item.buffers, 0),
      },
      origins,
    };
  }

  private async getHealthEntries(now: number) {
    const shared = await this.redisStore?.readOrigins();
    if (shared && shared.length > 0) {
      return shared.map((health) => [health.origin, health] as const);
    }
    return Array.from(this.origins.entries()).map(([origin, health]) => [
      origin,
      {
        ...health,
        uniqueFailureReporters: this.countActiveReporters(health, now),
      },
    ] as const);
  }

  private countActiveReporters(health: OriginHealth, now: number) {
    for (const [reporter, reportedAt] of health.reporters) {
      if (now - reportedAt > REPORTER_TTL_MS) health.reporters.delete(reporter);
    }
    return health.reporters.size;
  }

  private refreshBlock(health: OriginHealth, now: number) {
    for (const [reporter, reportedAt] of health.reporters) {
      if (now - reportedAt > REPORTER_TTL_MS) health.reporters.delete(reporter);
    }
    const attempts = this.getAttempts(health);
    const failureRate = health.failures / Math.max(1, attempts);
    if (health.reporters.size >= 3 && health.failures >= 3 && failureRate >= 0.6) {
      health.blockedUntil = Math.max(health.blockedUntil, now + GLOBAL_BLOCK_MS);
    }
  }

  private cleanup(now: number) {
    for (const [origin, health] of this.origins) {
      if (now - health.lastSeenAt > ORIGIN_TTL_MS) this.origins.delete(origin);
    }
  }

  private trimToLimit() {
    if (this.origins.size <= MAX_ORIGINS) return;
    const oldest = [...this.origins.entries()]
      .sort((left, right) => left[1].lastSeenAt - right[1].lastSeenAt)
      .slice(0, this.origins.size - MAX_ORIGINS);
    oldest.forEach(([origin]) => this.origins.delete(origin));
  }

  private sanitizeOrigin(value: string) {
    try {
      const url = new URL(String(value));
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : '';
    } catch {
      return '';
    }
  }

  private isValidKind(kind: string): kind is PlaybackEventKind {
    return ['start', 'success', 'buffer', 'failure'].includes(kind);
  }

  private isNetworkFailure(failureType = '') {
    return /network|cors|manifest|level|fragment/i.test(failureType);
  }

  private createHealth(now: number): OriginHealth {
    return {
      starts: 0,
      successes: 0,
      failures: 0,
      buffers: 0,
      totalStartupMs: 0,
      totalBufferMs: 0,
      reporters: new Map(),
      lastSeenAt: now,
      blockedUntil: 0,
      lastFailureType: '',
    };
  }

  private getAttempts(health: Pick<OriginHealth, 'starts' | 'successes' | 'failures'>) {
    // Start is sent for every attempt while success may be sampled by older clients.
    return Math.max(1, health.starts, health.successes + health.failures);
  }

  private cleanFailureType(value = '') {
    return String(value)
      .replace(/[^a-zA-Z0-9:_. -]/g, '')
      .trim()
      .slice(0, 100);
  }

  private consumeReporterQuota(reporterId: string, requested: number, now: number) {
    const current = this.reporterRates.get(reporterId);
    const rate = !current || now - current.startedAt >= 60_000
      ? { startedAt: now, count: 0, lastSeenAt: now }
      : current;
    const allowed = Math.max(0, Math.min(requested, MAX_EVENTS_PER_REPORTER_MINUTE - rate.count));
    rate.count += allowed;
    rate.lastSeenAt = now;
    this.reporterRates.set(reporterId, rate);

    if (this.reporterRates.size > MAX_RATE_LIMIT_REPORTERS) {
      const oldest = [...this.reporterRates.entries()]
        .sort((left, right) => left[1].lastSeenAt - right[1].lastSeenAt)
        .slice(0, this.reporterRates.size - MAX_RATE_LIMIT_REPORTERS);
      oldest.forEach(([id]) => this.reporterRates.delete(id));
    }
    return allowed;
  }
}
