import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MoviesService } from '../movies/movies.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { AdminJob, AdminJobDocument } from './schemas/admin-job.schema';

const JOB_TYPES = ['movie_metadata_sync', 'movie_availability_scan', 'upcoming_reminder_scan', 'source_health_check'] as const;
type JobType = (typeof JOB_TYPES)[number];

@Injectable()
export class AdminJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminJobsService.name);
  private workerTimer?: NodeJS.Timeout;
  private scheduleTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectModel(AdminJob.name) private readonly jobModel: Model<AdminJobDocument>,
    private readonly moviesService: MoviesService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  async onModuleInit() {
    await this.jobModel.updateMany(
      { status: 'processing', startedAt: { $lt: new Date(Date.now() - 10 * 60_000) } },
      { $set: { status: 'pending', runAt: new Date() }, $unset: { startedAt: 1 } },
    );
    this.workerTimer = setInterval(() => void this.processNext(), 2_000);
    this.scheduleTimer = setInterval(() => void this.enqueueScheduledJobs(), 60_000);
    await this.enqueueScheduledJobs();
  }

  onModuleDestroy() {
    if (this.workerTimer) clearInterval(this.workerTimer);
    if (this.scheduleTimer) clearInterval(this.scheduleTimer);
  }

  async enqueue(type: string, payload: Record<string, unknown> = {}, createdBy?: string, dedupeKey?: string) {
    if (!JOB_TYPES.includes(type as JobType)) throw new BadRequestException('Loại tác vụ nền không hợp lệ');
    if (dedupeKey) {
      // dedupeKey đã chứa cửa sổ thời gian; giữ cả job hoàn tất để lịch chạy
      // mỗi phút không nhân bản cùng một tác vụ trong cửa sổ 30 phút/6 giờ.
      const existing = await this.jobModel.findOne({ dedupeKey }).lean();
      if (existing) return existing;
    }
    return this.jobModel.create({
      type,
      payload,
      createdBy: createdBy && Types.ObjectId.isValid(createdBy) ? new Types.ObjectId(createdBy) : undefined,
      dedupeKey,
      runAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  async list(pageInput = '1', limitInput = '20', status?: string) {
    const page = Math.max(1, Number.parseInt(pageInput, 10) || 1);
    const limit = Math.min(50, Math.max(10, Number.parseInt(limitInput, 10) || 20));
    const query = ['pending', 'processing', 'completed', 'failed'].includes(String(status)) ? { status } : {};
    const [items, totalItems] = await Promise.all([
      this.jobModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.jobModel.countDocuments(query),
    ]);
    return { items, pagination: { page, limit, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / limit)) } };
  }

  async retry(id: string, adminId: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID tác vụ không hợp lệ');
    const job = await this.jobModel.findOneAndUpdate(
      { _id: id, status: 'failed' },
      { $set: { status: 'pending', runAt: new Date(), createdBy: new Types.ObjectId(adminId) }, $unset: { errorMessage: 1, finishedAt: 1 } },
      { returnDocument: 'after' },
    );
    if (!job) throw new BadRequestException('Chỉ có thể thử lại tác vụ đã thất bại');
    return job;
  }

  private async enqueueScheduledJobs() {
    const availabilityWindow = Math.floor(Date.now() / (30 * 60_000));
    const metadataWindow = Math.floor(Date.now() / (6 * 60 * 60_000));
    // Tạo theo đúng thứ tự pipeline để lần chạy đầu không dò trên collection rỗng.
    await this.enqueue('movie_metadata_sync', {}, undefined, `movie-metadata:${metadataWindow}`);
    await this.enqueue('movie_availability_scan', {}, undefined, `movie-availability:${availabilityWindow}`);
    await this.enqueue('upcoming_reminder_scan', {}, undefined, `upcoming:${availabilityWindow}`);
  }

  private async processNext() {
    if (this.running) return;
    this.running = true;
    try {
      const job = await this.jobModel.findOneAndUpdate(
        { status: 'pending', runAt: { $lte: new Date() } },
        { $set: { status: 'processing', startedAt: new Date() }, $inc: { attempts: 1 } },
        { sort: { runAt: 1, createdAt: 1 }, returnDocument: 'after' },
      );
      if (!job) return;
      try {
        const result = await this.execute(job.type as JobType);
        await this.jobModel.updateOne({ _id: job._id }, {
          $set: { status: 'completed', result, finishedAt: new Date() },
          $unset: { errorMessage: 1 },
        });
      } catch (error) {
        const attempts = Number(job.attempts || 1);
        const failed = attempts >= Number(job.maxAttempts || 3);
        await this.jobModel.updateOne({ _id: job._id }, {
          $set: {
            status: failed ? 'failed' : 'pending',
            runAt: failed ? new Date() : new Date(Date.now() + Math.min(60_000, 5_000 * 2 ** (attempts - 1))),
            finishedAt: failed ? new Date() : undefined,
            errorMessage: String(error instanceof Error ? error.message : error).slice(0, 1000),
          },
        });
      }
    } catch (error) {
      this.logger.error('Background worker iteration failed', error);
    } finally {
      this.running = false;
    }
  }

  private async execute(type: JobType): Promise<Record<string, unknown>> {
    if (type === 'movie_metadata_sync') return this.moviesService.syncMovieReleaseMetadata();
    if (type === 'movie_availability_scan') return this.moviesService.scanMovieReleaseAvailability();
    if (type === 'upcoming_reminder_scan') return this.moviesService.scanUpcomingReminders();
    const [phimapi, ophim] = await Promise.all([
      this.settingsService.testMovieSource('phimapi'),
      this.settingsService.testMovieSource('ophim'),
    ]);
    return { phimapi, ophim };
  }
}
