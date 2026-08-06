import { BadRequestException } from '@nestjs/common';
import { MoviesService } from './movies.service';

describe('MoviesService admin management', () => {
  const createService = (overrides: Record<string, any> = {}) => {
    const blockedModel = overrides.blockedModel || {};
    const customModel = overrides.customModel || {};
    return new MoviesService(
      blockedModel as any,
      customModel as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      undefined,
    );
  };

  it('paginates in MongoDB and escapes special search characters', async () => {
    const exec = jest.fn().mockResolvedValue([{ slug: 'a-star' }]);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const find = jest.fn().mockReturnValue({ sort });
    const countExec = jest.fn().mockResolvedValue(13);
    const countDocuments = jest.fn().mockReturnValue({ exec: countExec });
    const service = createService({ customModel: { find, countDocuments } });

    const result = await service.getAdminCustomMovies('a.*', 2, 6);

    expect(find).toHaveBeenCalledWith({
      $or: [
        { name: { $regex: 'a\\.\\*', $options: 'i' } },
        { origin_name: { $regex: 'a\\.\\*', $options: 'i' } },
        { slug: { $regex: 'a\\.\\*', $options: 'i' } },
      ],
    });
    expect(skip).toHaveBeenCalledWith(6);
    expect(limit).toHaveBeenCalledWith(6);
    expect(result.pagination).toEqual({ page: 2, limit: 6, totalItems: 13, totalPages: 3 });
  });

  it('whitelists editable fields and rejects unsafe media URLs', () => {
    const service = createService();
    const payload = (service as any).sanitizeCustomMovieDto({
      name: '  Phim thử  ',
      origin_name: 'Test movie',
      slug: 'phim-thu',
      thumb_url: 'https://images.example.com/thumb.jpg',
      poster_url: '/uploads/poster.jpg',
      link_m3u8: 'https://cdn.example.com/index.m3u8',
      year: 2026,
      isCustom: false,
      role: 'admin',
    }, false);

    expect(payload).toEqual(expect.objectContaining({ name: 'Phim thử', slug: 'phim-thu' }));
    expect(payload).not.toHaveProperty('isCustom');
    expect(payload).not.toHaveProperty('role');
    expect(() => (service as any).sanitizeCustomMovieDto({
      name: 'Phim',
      origin_name: 'Movie',
      thumb_url: 'javascript:alert(1)',
      poster_url: '/poster.jpg',
      link_m3u8: 'https://cdn.example.com/index.m3u8',
      year: 2026,
    }, false)).toThrow(BadRequestException);
  });

  it('rejects malformed MongoDB ids before update and delete', async () => {
    const service = createService();
    await expect(service.updateCustomMovie('not-an-id', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.deleteCustomMovie('not-an-id')).rejects.toBeInstanceOf(BadRequestException);
  });
});
