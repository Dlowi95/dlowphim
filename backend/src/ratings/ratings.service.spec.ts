import { BadRequestException } from '@nestjs/common';
import { RatingsService } from './ratings.service';

describe('RatingsService optimized queries', () => {
  it('returns server-side paginated rating summaries', async () => {
    const aggregate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([{
        items: [{ movieSlug: 'phim-a', averageScore: 8.5, totalRatings: 10 }],
        metadata: [{ totalItems: 7 }],
      }]),
    });
    const service = new RatingsService({ aggregate } as any);

    const result = await service.getAdminRatingsStats('', 2, 3);

    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({ page: 2, limit: 3, totalItems: 7, totalPages: 3 });
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline.at(-1)).toEqual(expect.objectContaining({ $facet: expect.any(Object) }));
  });

  it('validates rating scores and slugs before writing', async () => {
    const service = new RatingsService({} as any);
    await expect(service.rateMovie('phim-hop-le', '507f1f77bcf86cd799439011', 10.5)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.rateMovie('../phim', '507f1f77bcf86cd799439011', 10)).rejects.toBeInstanceOf(BadRequestException);
  });
});
