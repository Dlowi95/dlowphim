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
}

const MAX_ORIGINS = 150;
const ORIGIN_TTL_MS = 30 * 60 * 1000;
const REPORTER_TTL_MS = 2 * 60 * 1000;
const GLOBAL_BLOCK_MS = 5 * 60 * 1000;
const MAX_REPORTERS_PER_ORIGIN = 50;

@Injectable()
export class PlaybackHealthService {
  private readonly origins = new Map<string, OriginHealth>();

  constructor(
    @Optional() private readonly redisStore?: PlaybackHealthRedisStore,
  ) {}

  recordBatch(events: PlaybackHealthEvent[], reporterId: string) {
    const now = Date.now();
    this.cleanup(now);
    const sharedEvents: PlaybackHealthEvent[] = [];

    for (const event of events.slice(0, 20)) {
      const origin = this.sanitizeOrigin(event.origin);
      if (!origin || !this.isValidKind(event.kind)) continue;
      sharedEvents.push({ ...event, origin });

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
        if (this.isNetworkFailure(event.failureType)) {
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
    return { accepted: Math.min(events.length, 20) };
  }

  async getReputation() {
    const now = Date.now();
    this.cleanup(now);
    const entries = await this.getHealthEntries(now);
    return entries.map(([origin, health]) => {
      const attempts = Math.max(1, health.successes + health.failures);
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
        const attempts = Math.max(1, health.successes + health.failures);
        const failureRate = health.failures / attempts;
        const averageStartupMs = health.starts
          ? Math.round(health.totalStartupMs / health.starts)
          : 0;
        const averageBufferMs = health.buffers
          ? Math.round(health.totalBufferMs / health.buffers)
          : 0;
        const blocked = health.blockedUntil > now;
        const degraded = !blocked && (failureRate >= 0.25 || averageBufferMs >= 2500);
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
          uniqueFailureReporters: health.uniqueFailureReporters,
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
    const attempts = health.successes + health.failures;
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
    };
  }
}
