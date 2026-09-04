import { AdminAuditLogSchema } from './admin-audit/schemas/admin-audit-log.schema';
import { AdminJobSchema } from './admin-jobs/schemas/admin-job.schema';

describe('admin retention indexes', () => {
  it.each([
    ['AdminAuditLog', AdminAuditLogSchema],
    ['AdminJob', AdminJobSchema],
  ])('declares exactly one TTL index for %s', (_name, schema) => {
    const expiresAtIndexes = schema.indexes().filter(([fields]) => fields.expiresAt === 1);

    expect(expiresAtIndexes).toHaveLength(1);
    expect(expiresAtIndexes[0][1]).toEqual(expect.objectContaining({ expireAfterSeconds: 0 }));
  });
});
