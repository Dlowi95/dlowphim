import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Banner, BannerDocument } from './schemas/banner.schema';
import { MoviesService } from '../movies/movies.service';

const HERO_SLOT_COUNT = 5;
const HERO_CANDIDATE_LIMIT = 24;
const HERO_TMDB_INITIAL_CANDIDATE_LIMIT = 12;
const HERO_TMDB_CANDIDATE_LIMIT = 24;
const HERO_TMDB_EXPANSION_BATCH_SIZE = 4;
const HERO_VALID_CANDIDATE_TARGET = 8;
const HERO_DETAIL_CONCURRENCY = 4;

interface ProcessedHeroMovie {
  movie: any;
  detail: any;
  tmdbData: any;
}

interface HeroCandidateCacheEntry {
  expiry: number;
  processedMovies: ProcessedHeroMovie[];
}

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<BannerDocument>,
    private readonly moviesService: MoviesService,
  ) {}

  private readonly heroCandidateCache = new Map<
    string,
    HeroCandidateCacheEntry
  >();
  private readonly heroCandidateInflight = new Map<
    string,
    Promise<ProcessedHeroMovie[]>
  >();
  private readonly heroCandidateCacheMaxEntries = 4;

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= items.length) return;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    };

    const workerCount = Math.min(Math.max(concurrency, 1), items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }

  private async resolveMovies(
    movies: any[],
    heroCandidatesOnly = false,
    allowFallbackSource = false,
  ): Promise<ProcessedHeroMovie[]> {
    const detailedMovies = await this.mapWithConcurrency(
      movies,
      HERO_DETAIL_CONCURRENCY,
      async (movie): Promise<{ movie: any; detail: any }> => {
        const sources = allowFallbackSource ? ['active', 'fallback'] : ['active'];
        for (const source of sources) {
          try {
            const detailData = await this.moviesService.fetchOphimProxy(
              `/v1/api/phim/${movie.slug}`,
              source,
            );
            const detail = detailData?.data?.item || detailData?.movie || null;
            if (detail?.name) return { movie, detail };
          } catch {
            // Banner do admin chọn được phép thử nguồn dự phòng.
          }
        }
        return { movie, detail: null };
      },
    );

    const eligibleMovies = detailedMovies.filter(({ movie, detail }) => {
      if (!detail) return false;
      if (!heroCandidatesOnly) return true;
      const currentEpisode = (detail.episode_current || '').toLowerCase();
      return (
        !currentEpisode.includes('trailer') &&
        !this.isAnimeOrAnimation(movie, detail)
      );
    });
    const resolveTmdbBatch = (items: Array<{ movie: any; detail: any }>) =>
      this.mapWithConcurrency(
        items,
        HERO_DETAIL_CONCURRENCY,
        async ({ movie, detail }): Promise<ProcessedHeroMovie> => {
          try {
            const tmdbData = await this.moviesService.getMovieLogo(
              movie.slug,
              detail.name || movie.name,
              detail.tmdb?.id ? String(detail.tmdb.id) : undefined,
              detail.tmdb?.type || 'movie',
              detail.origin_name || movie.origin_name,
            );
            return { movie, detail, tmdbData };
          } catch {
            return { movie, detail, tmdbData: null };
          }
        },
      );

    if (!heroCandidatesOnly) {
      return resolveTmdbBatch(eligibleMovies);
    }

    const tmdbCandidates = eligibleMovies.slice(
      0,
      HERO_TMDB_CANDIDATE_LIMIT,
    );
    const processed: ProcessedHeroMovie[] = [];

    // Keep cold starts bounded: try the original 12 candidates first and only
    // expand in small batches when TMDB has not produced enough valid heroes.
    let cursor = 0;
    while (cursor < tmdbCandidates.length) {
      const batchSize =
        cursor === 0
          ? HERO_TMDB_INITIAL_CANDIDATE_LIMIT
          : HERO_TMDB_EXPANSION_BATCH_SIZE;
      const batch = tmdbCandidates.slice(cursor, cursor + batchSize);
      if (batch.length === 0) break;
      processed.push(...(await resolveTmdbBatch(batch)));
      cursor += batch.length;

      const validCount = processed.filter(
        ({ tmdbData }) => tmdbData?.backdropUrl && tmdbData?.tmdbTitle,
      ).length;
      if (
        cursor >= HERO_TMDB_INITIAL_CANDIDATE_LIMIT &&
        validCount >= HERO_VALID_CANDIDATE_TARGET
      ) {
        break;
      }
    }

    return processed;
  }

  private cleanMovieName(name = ''): string {
    return name
      .replace(/\s*\(?\s*Phần\s+(?:\d+|[IVXLCDM]+)\s*\)?/gi, '')
      .replace(/\s*\(?\s*Season\s+(?:\d+|[IVXLCDM]+)\s*\)?/gi, '')
      .replace(/\s*\(?\s*SS\s*\d+\s*\)?/gi, '')
      .replace(/[\s\-:/\\]+$/, '')
      .trim()
      .toLowerCase();
  }

  private isAnimeOrAnimation(movie: any, detail: any): boolean {
    const categories = detail?.category || movie?.category || [];
    const categorySlugs = categories.map((category: any) =>
      (category?.slug || category?.name || category || '')
        .toString()
        .toLowerCase(),
    );
    const movieType = (detail?.type || movie?.type || '')
      .toString()
      .toLowerCase();
    return (
      movieType === 'hoathinh' ||
      categorySlugs.some(
        (category: string) =>
          category.includes('hoat-hinh') || category.includes('anime'),
      )
    );
  }

  private buildResolvedSlots(
    activeBanners: any[],
    processedMovies: ProcessedHeroMovie[],
    processedBySlug: Map<string, ProcessedHeroMovie>,
  ): any[] {
    const seenSlugs = new Set<string>();
    const seenNames = new Set<string>();
    const candidates = processedMovies
      .filter(({ movie, detail, tmdbData }) => {
        if (
          !movie?.slug ||
          !detail ||
          !tmdbData?.backdropUrl ||
          !tmdbData?.tmdbTitle
        ) {
          return false;
        }
        const currentEpisode = (detail.episode_current || '').toLowerCase();
        return (
          !currentEpisode.includes('trailer') &&
          !this.isAnimeOrAnimation(movie, detail)
        );
      })
      .sort(
        (left, right) =>
          Number(Boolean(right.tmdbData?.logoUrl)) -
          Number(Boolean(left.tmdbData?.logoUrl)),
      );

    const slots: any[] = [];
    for (let order = 1; order <= HERO_SLOT_COUNT; order++) {
      const custom = activeBanners.find((banner) => banner.order === order);
      if (custom) {
        const customNameKey = this.cleanMovieName(custom.title);
        const customOriginalNameKey = this.cleanMovieName(
          custom.originName || '',
        );
        seenSlugs.add(custom.movieSlug);
        if (customNameKey) seenNames.add(customNameKey);
        if (customOriginalNameKey) seenNames.add(customOriginalNameKey);

        const resolvedCustom = processedBySlug.get(custom.movieSlug);
        const detail = resolvedCustom?.detail || {};
        slots.push({
          order,
          movie: {
            ...detail,
            _id: custom._id,
            name: custom.title,
            origin_name: custom.originName || '',
            slug: custom.movieSlug,
            thumb_url: custom.imageUrl,
            poster_url: custom.imageUrl,
            content: custom.description || detail.content || '',
            isCustomBanner: true,
          },
          detail: {
            ...detail,
            name: custom.title,
            origin_name: custom.originName || '',
            thumb_url: custom.imageUrl,
            poster_url: custom.imageUrl,
            content: custom.description || detail.content || '',
          },
          tmdbData: resolvedCustom?.tmdbData || null,
          isCustomBanner: true,
          bannerRecord: custom,
        });
        continue;
      }

      const candidate = candidates.find(({ movie, tmdbData }) => {
        const titleKey = this.cleanMovieName(tmdbData?.tmdbTitle || '');
        const originalTitleKey = this.cleanMovieName(
          tmdbData?.tmdbOriginalTitle || '',
        );
        return (
          !seenSlugs.has(movie.slug) &&
          Boolean(titleKey) &&
          !seenNames.has(titleKey) &&
          (!originalTitleKey || !seenNames.has(originalTitleKey))
        );
      });
      if (!candidate) continue;

      const { movie, detail, tmdbData } = candidate;
      const resolvedName = tmdbData.tmdbTitle;
      const resolvedOriginalName =
        tmdbData.tmdbOriginalTitle || detail.origin_name || movie.origin_name;
      seenSlugs.add(movie.slug);
      seenNames.add(this.cleanMovieName(resolvedName));
      if (resolvedOriginalName) {
        seenNames.add(this.cleanMovieName(resolvedOriginalName));
      }
      slots.push({
        order,
        movie: {
          ...movie,
          name: resolvedName,
          origin_name: resolvedOriginalName,
          thumb_url: tmdbData.backdropUrl,
          poster_url: tmdbData.backdropUrl,
          isCustomBanner: false,
        },
        detail: {
          ...detail,
          name: resolvedName,
          origin_name: resolvedOriginalName,
          thumb_url: tmdbData.backdropUrl,
          poster_url: tmdbData.backdropUrl,
        },
        tmdbData,
        isCustomBanner: false,
      });
    }
    return slots;
  }

  async getResolvedHero(admin = false): Promise<any> {
    const activeBannersPromise = this.findAllActive();
    const rawBannersPromise = admin
      ? this.findAllForAdmin()
      : activeBannersPromise;
    const latestDataPromise = this.moviesService.fetchOphimProxy(
      '/danh-sach/phim-moi-cap-nhat?page=1',
    );
    const [activeBanners, rawBanners, latestData] = await Promise.all([
      activeBannersPromise,
      rawBannersPromise,
      latestDataPromise,
    ]);

    const latestMovies = (
      latestData?.status && latestData?.items ? latestData.items : []
    ).slice(0, HERO_CANDIDATE_LIMIT);
    const sourceId = latestData?._sourceId || 'active';
    const fingerprint = latestMovies.map((movie: any) => movie.slug).join('|');
    const cacheKey = `${sourceId}:${fingerprint}`;
    const now = Date.now();
    let processedMovies: ProcessedHeroMovie[];
    const cached = this.heroCandidateCache.get(cacheKey);

    if (cached && cached.expiry > now) {
      processedMovies = cached.processedMovies;
    } else {
      for (const [key, entry] of this.heroCandidateCache) {
        if (entry.expiry <= now) this.heroCandidateCache.delete(key);
      }
      let inflight = this.heroCandidateInflight.get(cacheKey);
      if (!inflight) {
        inflight = this.resolveMovies(latestMovies, true);
        this.heroCandidateInflight.set(cacheKey, inflight);
      }
      try {
        processedMovies = await inflight;
      } finally {
        if (this.heroCandidateInflight.get(cacheKey) === inflight) {
          this.heroCandidateInflight.delete(cacheKey);
        }
      }
      if (!this.heroCandidateCache.has(cacheKey)) {
        if (this.heroCandidateCache.size >= this.heroCandidateCacheMaxEntries) {
          const oldestKey = this.heroCandidateCache.keys().next().value as
            | string
            | undefined;
          if (oldestKey) this.heroCandidateCache.delete(oldestKey);
        }
        this.heroCandidateCache.set(cacheKey, {
          processedMovies,
          expiry: Date.now() + 5 * 60 * 1000,
        });
      }
    }

    const processedBySlug = new Map(
      processedMovies.map((processed) => [processed.movie.slug, processed]),
    );
    const missingCustomMovies = activeBanners
      .filter((banner) => !processedBySlug.has(banner.movieSlug))
      .map((banner) => ({
        slug: banner.movieSlug,
        name: banner.title,
        origin_name: banner.originName || '',
      }));
    const resolvedCustomMovies = await this.resolveMovies(
      missingCustomMovies,
      false,
      true,
    );
    for (const processed of resolvedCustomMovies) {
      processedBySlug.set(processed.movie.slug, processed);
    }

    return {
      sourceId,
      generatedAt: new Date().toISOString(),
      slots: this.buildResolvedSlots(
        activeBanners,
        processedMovies,
        processedBySlug,
      ),
      rawBanners,
      latestMovies,
    };
  }

  // Get active banners for public homepage
  async findAllActive(): Promise<Banner[]> {
    return this.bannerModel
      .find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  // Get all banners for admin panel
  async findAllForAdmin(): Promise<Banner[]> {
    return this.bannerModel.find().sort({ order: 1, createdAt: -1 }).exec();
  }

  // Create a new banner
  async create(createBannerDto: any): Promise<Banner> {
    const payload = this.normalizeBannerInput(createBannerDto, false);
    const occupiedSlot = await this.bannerModel.exists({ order: payload.order });
    if (occupiedSlot) {
      throw new ConflictException(
        `Vị trí ${payload.order} đã có banner. Hãy chỉnh sửa banner hiện tại.`,
      );
    }
    const newBanner = new this.bannerModel(payload);
    return newBanner.save();
  }

  // Update a banner
  async update(id: string, updateBannerDto: any): Promise<Banner> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã banner không hợp lệ');
    }
    const payload = this.normalizeBannerInput(updateBannerDto, true);
    if (payload.order !== undefined) {
      const occupiedSlot = await this.bannerModel.exists({
        order: payload.order,
        _id: { $ne: new Types.ObjectId(id) },
      });
      if (occupiedSlot) {
        throw new ConflictException(
          `Vị trí ${payload.order} đã có banner khác.`,
        );
      }
    }
    const updatedBanner = await this.bannerModel
      .findByIdAndUpdate(id, payload, { returnDocument: 'after' })
      .exec();

    if (!updatedBanner) {
      throw new NotFoundException('Không tìm thấy banner này');
    }
    return updatedBanner;
  }

  // Delete a banner
  async delete(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã banner không hợp lệ');
    }
    const result = await this.bannerModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy banner này');
    }
    return { message: 'Xóa banner thành công' };
  }

  private normalizeBannerInput(input: any, partial: boolean): Record<string, any> {
    const payload: Record<string, any> = {};
    const requireField = (key: string) => !partial || input?.[key] !== undefined;

    if (requireField('title')) {
      const title = String(input?.title || '').replace(/\s+/g, ' ').trim();
      if (!title || title.length > 200) {
        throw new BadRequestException('Tên banner cần từ 1 đến 200 ký tự');
      }
      payload.title = title;
    }

    if (input?.originName !== undefined) {
      const originName = String(input.originName || '').replace(/\s+/g, ' ').trim();
      payload.originName = originName ? originName.slice(0, 250) : undefined;
    }

    if (requireField('movieSlug')) {
      const movieSlug = String(input?.movieSlug || '').trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{0,179}$/.test(movieSlug)) {
        throw new BadRequestException('Slug phim không hợp lệ');
      }
      payload.movieSlug = movieSlug;
    }

    if (requireField('imageUrl')) {
      const imageUrl = String(input?.imageUrl || '').trim();
      const isRemoteImage = /^https?:\/\/[^\s]+$/i.test(imageUrl);
      const isLocalImage = /^\/uploads\/[a-z0-9/_\-.]+$/i.test(imageUrl);
      if ((!isRemoteImage && !isLocalImage) || imageUrl.length > 2_000) {
        throw new BadRequestException('Đường dẫn ảnh banner không hợp lệ');
      }
      payload.imageUrl = imageUrl;
    }

    if (input?.description !== undefined) {
      const description = String(input.description || '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      payload.description = description ? description.slice(0, 1_200) : undefined;
    }

    if (requireField('order')) {
      const order = Number(input?.order);
      if (!Number.isInteger(order) || order < 1 || order > HERO_SLOT_COUNT) {
        throw new BadRequestException(
          `Vị trí banner phải nằm trong khoảng 1-${HERO_SLOT_COUNT}`,
        );
      }
      payload.order = order;
    }

    if (input?.isActive !== undefined) {
      if (typeof input.isActive !== 'boolean') {
        throw new BadRequestException('Trạng thái banner không hợp lệ');
      }
      payload.isActive = input.isActive;
    } else if (!partial) {
      payload.isActive = true;
    }

    if (partial && Object.keys(payload).length === 0) {
      throw new BadRequestException('Không có dữ liệu banner cần cập nhật');
    }
    return payload;
  }
}
