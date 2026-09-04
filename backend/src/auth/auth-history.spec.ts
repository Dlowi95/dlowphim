import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

function createService() {
  const select = jest.fn().mockResolvedValue({ watchHistory: [] });
  const userModel = {
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    findById: jest.fn().mockReturnValue({ select }),
  };
  const service = new AuthService(
    userModel as any,
    {} as any,
    {} as any,
    { get: jest.fn().mockReturnValue('test-google-client') } as any,
  );
  return { service, userModel, select };
}

describe('AuthService watch history', () => {
  it('updates one movie atomically and rejects an older concurrent payload', async () => {
    const { service, userModel } = createService();
    const updatedAt = '2026-08-21T08:00:00.000Z';

    await service.updateHistory('user-id', {
      movieSlug: 'demo-movie',
      movieName: 'Demo Movie',
      episodeName: 'Tập 02',
      currentTime: 120,
      duration: 1440,
      progressMode: 'exact',
      updatedAt,
    });

    const [filter, pipeline, options] = userModel.updateOne.mock.calls[0];
    expect(filter).toEqual({
      _id: 'user-id',
      watchHistory: {
        $not: {
          $elemMatch: {
            movieSlug: 'demo-movie',
            updatedAt: { $gt: new Date(updatedAt) },
          },
        },
      },
    });
    expect(pipeline).toHaveLength(1);
    expect(pipeline[0].$set.watchHistory.$slice[0].$concatArrays[0][0]).toEqual(
      expect.objectContaining({
        movieSlug: 'demo-movie',
        episodeName: 'Tập 02',
        episodeKey: '2',
        currentTime: 120,
        duration: 1440,
        updatedAt: new Date(updatedAt),
      }),
    );
    expect(pipeline[0].$set.watchHistory.$slice[1]).toBe(50);
    expect(options).toEqual({ updatePipeline: true });
  });

  it('normalizes invalid progress values without storing negative numbers', async () => {
    const { service, userModel } = createService();

    await service.updateHistory('user-id', {
      movieSlug: 'demo-movie',
      movieName: 'Demo Movie',
      episodeName: 'Full',
      currentTime: -10,
      duration: 'invalid',
      updatedAt: 'invalid-date',
    });

    const [, pipeline] = userModel.updateOne.mock.calls[0];
    const item = pipeline[0].$set.watchHistory.$slice[0].$concatArrays[0][0];
    expect(item.currentTime).toBe(0);
    expect(item.duration).toBe(0);
    expect(item.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects a history update without a movie slug', async () => {
    const { service, userModel } = createService();

    await expect(service.updateHistory('user-id', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });
});
