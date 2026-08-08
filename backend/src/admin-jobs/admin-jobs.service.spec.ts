import { BadRequestException } from '@nestjs/common';
import { AdminJobsService } from './admin-jobs.service';

function createService(overrides: Record<string, any> = {}) {
  const jobModel = {
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    create: jest.fn().mockImplementation(async (value) => ({ _id: 'job-id', ...value })),
    ...overrides,
  };
  const service = new AdminJobsService(jobModel as any, {} as any, {} as any);
  return { service, jobModel };
}

describe('AdminJobsService', () => {
  it('rejects unknown job types', async () => {
    const { service } = createService();
    await expect(service.enqueue('delete_everything')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deduplicates pending scheduled jobs', async () => {
    const existing = { _id: 'existing', type: 'upcoming_reminder_scan', status: 'pending' };
    const lean = jest.fn().mockResolvedValue(existing);
    const { service, jobModel } = createService({ findOne: jest.fn().mockReturnValue({ lean }) });

    const result = await service.enqueue('upcoming_reminder_scan', {}, undefined, 'upcoming:123');

    expect(result).toBe(existing);
    expect(jobModel.create).not.toHaveBeenCalled();
  });

  it('creates a persistent job with retention metadata', async () => {
    const { service, jobModel } = createService();
    const result = await service.enqueue('source_health_check');

    expect(jobModel.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'source_health_check',
      runAt: expect.any(Date),
      expiresAt: expect.any(Date),
    }));
    expect(result.type).toBe('source_health_check');
  });
});
