import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { MovieReportsService } from './movie-reports.service';

describe('MovieReportsService', () => {
  const baseDto = {
    movieSlug: 'phim-thu-nghiem',
    movieName: 'Phim thử nghiệm',
    episodeName: 'Tập 1',
    errorType: 'video_broken',
  };

  const createMocks = () => {
    const notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
      createUserNotification: jest.fn().mockResolvedValue(undefined),
      deleteByTargetId: jest.fn().mockResolvedValue(undefined),
    };
    const reportModel: any = jest.fn().mockImplementation((payload: any) => {
      const saved = {
        ...payload,
        _id: { toString: () => 'report-new' },
      };
      return { ...saved, save: jest.fn().mockResolvedValue(saved) };
    });
    reportModel.countDocuments = jest.fn().mockResolvedValue(0);
    reportModel.findOne = jest.fn().mockResolvedValue(null);
    return {
      notifications,
      reportModel,
      service: new MovieReportsService(reportModel, notifications as any),
    };
  };

  it('rejects malformed movie and error data before touching the database', async () => {
    const { service, reportModel } = createMocks();

    await expect(
      service.createReport(null, 'guest-key', {
        ...baseDto,
        movieSlug: '../unsafe',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(reportModel.countDocuments).not.toHaveBeenCalled();
  });

  it('rate limits a reporter after six new reports in one hour', async () => {
    const { service, reportModel } = createMocks();
    reportModel.countDocuments.mockResolvedValue(6);

    try {
      await service.createReport(null, 'guest-key', baseDto);
      throw new Error('Expected createReport to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('does not write repeatedly when the same issue is resent within 30 seconds', async () => {
    const { service, reportModel, notifications } = createMocks();
    const duplicate = {
      _id: { toString: () => 'report-existing' },
      lastReportedAt: new Date(),
      occurrenceCount: 2,
      save: jest.fn(),
    };
    reportModel.findOne.mockResolvedValue(duplicate);

    const result = await service.createReport(null, 'guest-key', baseDto);

    expect(result.deduplicated).toBe(true);
    expect(duplicate.save).not.toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('stores normalized diagnostics without persisting the full stream URL', async () => {
    const { service, reportModel, notifications } = createMocks();

    const result = await service.createReport(null, 'guest-key', {
      ...baseDto,
      description: '  <b>Màn hình đen</b>   khi phát  ',
      playbackType: 'hls',
      serverName: '  Máy chủ chính  ',
      streamOrigin: 'https://cdn.example.com/private/path/index.m3u8?token=secret',
      currentTime: 999999,
    });

    expect(result.deduplicated).toBe(false);
    expect(reportModel).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Màn hình đen khi phát',
        playbackType: 'hls',
        serverName: 'Máy chủ chính',
        streamOrigin: 'https://cdn.example.com',
        currentTime: 86400,
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
  });
});
