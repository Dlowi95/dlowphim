import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BlockedMovie, BlockedMovieDocument } from './schemas/blocked-movie.schema';
import { CustomMovie, CustomMovieDocument } from './schemas/custom-movie.schema';
import { MovieLogo, MovieLogoDocument } from './schemas/movie-logo.schema';
import { MovieOverride, MovieOverrideDocument } from './schemas/movie-override.schema';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { MovieRelease, MovieReleaseDocument } from './schemas/movie-release.schema';

@Injectable()
export class MoviesService {
  private readonly upcomingCache = new Map<string, { data: any; expiry: number }>();
  private readonly peopleCache = new Map<string, { data: any; expiry: number }>();
  private readonly catalogCache = new Map<string, { data: any; expiry: number }>();
  private readonly discoveryLastKnownGood = new Map<string, { data: any; savedAt: number; expiry: number }>();
  private readonly sourceCircuits = new Map<string, { failures: number; openUntil: number }>();
  private readonly sourceFailureTotals = new Map<string, number>();
  private readonly discoveryMetrics = {
    startedAt: Date.now(),
    resolutions: 0,
    fallbackResponses: 0,
    staleResponses: 0,
    circuitTrips: 0,
    circuitSkips: 0,
  };
  private readonly upcomingCacheTtlMs = 6 * 60 * 60 * 1000;
  private readonly upcomingCacheMaxEntries = 200;
  private readonly peopleCacheTtlMs = 60 * 60 * 1000;
  private readonly peopleCacheMaxEntries = 200;
  private readonly catalogCacheTtlMs = 10 * 60 * 1000;
  private readonly catalogCacheMaxEntries = 300;
  private readonly discoveryStaleTtlMs = 24 * 60 * 60 * 1000;
  private readonly sourceCircuitFailureThreshold = 2;
  private readonly sourceCircuitCooldownMs = 45 * 1000;

  constructor(
    @InjectModel(BlockedMovie.name) private blockedModel: Model<BlockedMovieDocument>,
    @InjectModel(CustomMovie.name) private customModel: Model<CustomMovieDocument>,
    @InjectModel(MovieLogo.name) private movieLogoModel: Model<MovieLogoDocument>,
    @InjectModel(MovieOverride.name) private overrideModel: Model<MovieOverrideDocument>,
    private readonly settingsService: SystemSettingsService,
    @Optional() @InjectModel(User.name) private readonly userModel?: Model<UserDocument>,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() @InjectModel(MovieRelease.name) private readonly movieReleaseModel?: Model<MovieReleaseDocument>,
  ) {}

  // ─── BLOCKED MOVIES ───
  async getBlockedMovies(): Promise<any[]> {
    return this.blockedModel.find().sort({ createdAt: -1 }).limit(200).lean().exec();
  }

  async getAdminBlockedMovies(search = '', page = 1, limit = 6) {
    const pagination = this.normalizePagination(page, limit);
    const query = this.buildSearchQuery(search, ['slug', 'title', 'reason']);
    const [items, totalItems] = await Promise.all([
      this.blockedModel.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean().exec(),
      this.blockedModel.countDocuments(query).exec(),
    ]);
    return this.toPaginatedResult(items, totalItems, pagination.page, pagination.limit);
  }

  async isMovieBlocked(slug: string): Promise<boolean> {
    const found = await this.blockedModel.findOne({ slug: this.normalizeSlug(slug) }).lean().exec();
    return !!found;
  }

  async blockMovie(slug: string, title?: string, reason?: string): Promise<any> {
    const trimmedSlug = this.normalizeSlug(slug);
    const existing = await this.blockedModel.findOne({ slug: trimmedSlug }).exec();
    if (existing) {
      throw new ConflictException('Phim này đã bị chặn từ trước');
    }
    title = this.cleanText(title || slug, 200);
    reason = this.cleanText(reason, 500) || undefined;
    const created = new this.blockedModel({
      slug: trimmedSlug,
      title: title || slug,
      reason: reason || 'Vi phạm bản quyền hoặc yêu cầu gỡ bỏ',
    });
    return created.save();
  }

  async unblockMovie(slug: string): Promise<{ success: boolean }> {
    const trimmedSlug = this.normalizeSlug(slug);
    const result = await this.blockedModel.deleteOne({ slug: trimmedSlug }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy phim này trong danh sách chặn');
    }
    return { success: true };
  }

  // ─── CUSTOM MOVIES ───
  async getCustomMovies(search?: string): Promise<any[]> {
    const filter = this.buildSearchQuery(search || '', ['name', 'origin_name', 'slug']);
    return this.customModel.find(filter).sort({ createdAt: -1 }).limit(100).lean().exec();
  }

  async getAdminCustomMovies(search = '', page = 1, limit = 6) {
    const pagination = this.normalizePagination(page, limit);
    const query = this.buildSearchQuery(search, ['name', 'origin_name', 'slug']);
    const [items, totalItems] = await Promise.all([
      this.customModel.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean().exec(),
      this.customModel.countDocuments(query).exec(),
    ]);
    return this.toPaginatedResult(items, totalItems, pagination.page, pagination.limit);
  }

  async getCustomMovieBySlug(slug: string): Promise<any> {
    const trimmedSlug = this.normalizeSlug(slug);
    const found = await this.customModel.findOne({ slug: trimmedSlug }).exec();
    if (!found) {
      throw new NotFoundException('Không tìm thấy phim tự đăng này');
    }
    return found;
  }

  async createCustomMovie(dto: any): Promise<any> {
    const payload = this.sanitizeCustomMovieDto(dto, false);
    const slug = payload.slug || this.generateSlug(payload.name);
    if (!slug) throw new BadRequestException('Không thể tạo slug hợp lệ cho phim');
    const existing = await this.customModel.findOne({ slug }).exec();
    if (existing) {
      throw new ConflictException('Slug phim này đã tồn tại');
    }
    
    // check if it's currently blocked
    const isBlocked = await this.isMovieBlocked(slug);
    if (isBlocked) {
      throw new ConflictException('Slug phim này đang nằm trong danh sách chặn');
    }

    try {
      const created = new this.customModel({ ...payload, slug });
      return await created.save();
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictException('Slug phim này đã tồn tại');
      throw error;
    }
  }

  async updateCustomMovie(id: string, dto: any): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID phim không hợp lệ');
    const existing = await this.customModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Không tìm thấy phim cần cập nhật');
    }

    const payload = this.sanitizeCustomMovieDto(dto, true);
    if (payload.slug) {
      const slug = payload.slug;
      if (slug !== existing.slug) {
        const [duplicate, blocked] = await Promise.all([
          this.customModel.findOne({ slug, _id: { $ne: id } }).lean().exec(),
          this.blockedModel.exists({ slug }),
        ]);
        if (duplicate) {
          throw new ConflictException('Slug phim này đã tồn tại ở phim khác');
        }
        if (blocked) throw new ConflictException('Slug phim này đang nằm trong danh sách chặn');
      }
    }

    try {
      return await this.customModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).exec();
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictException('Slug phim này đã tồn tại');
      throw error;
    }
  }

  async deleteCustomMovie(id: string): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID phim không hợp lệ');
    const result = await this.customModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy phim cần xóa');
    }
    return { success: true };
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/([^0-9a-z-\s])/g, '')
      .replace(/(\s+)/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeSlug(value: unknown): string {
    const slug = String(value || '').trim().toLowerCase();
    if (!slug || slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException('Slug phim không hợp lệ');
    }
    return slug;
  }

  private cleanText(value: unknown, maxLength: number): string {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  private cleanMultilineText(value: unknown, maxLength: number): string {
    return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, maxLength);
  }

  private validateMediaUrl(value: unknown, field: string): string {
    const url = String(value || '').trim();
    if (!url) throw new BadRequestException(`${field} là bắt buộc`);
    if (url.length > 2048) throw new BadRequestException(`${field} quá dài`);
    if (url.startsWith('/')) return url;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      return url;
    } catch {
      throw new BadRequestException(`${field} không phải URL hợp lệ`);
    }
  }

  private sanitizeNamedItems(value: unknown): Array<{ name: string; slug: string }> {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 20).map((item) => {
      const name = this.cleanText(item?.name, 100);
      const slug = item?.slug ? this.normalizeSlug(item.slug) : this.generateSlug(name);
      if (!name || !slug) throw new BadRequestException('Thể loại hoặc quốc gia không hợp lệ');
      return { name, slug };
    });
  }

  private sanitizeCustomMovieDto(dto: any, partial: boolean): any {
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) {
      throw new BadRequestException('Dữ liệu phim không hợp lệ');
    }
    const payload: any = {};
    for (const field of ['name', 'origin_name'] as const) {
      if (!partial || dto[field] !== undefined) {
        const value = this.cleanText(dto[field], 250);
        if (!value) throw new BadRequestException(`${field} là bắt buộc`);
        payload[field] = value;
      }
    }
    if (dto.slug !== undefined && String(dto.slug).trim()) payload.slug = this.normalizeSlug(dto.slug);
    if (!partial || dto.thumb_url !== undefined) payload.thumb_url = this.validateMediaUrl(dto.thumb_url, 'Ảnh thumbnail');
    if (!partial || dto.poster_url !== undefined) payload.poster_url = this.validateMediaUrl(dto.poster_url, 'Ảnh poster');
    if (!partial || dto.link_m3u8 !== undefined) payload.link_m3u8 = this.validateMediaUrl(dto.link_m3u8, 'Link HLS');
    if (dto.year !== undefined || !partial) {
      const year = Number(dto.year);
      const maxYear = new Date().getFullYear() + 5;
      if (!Number.isInteger(year) || year < 1888 || year > maxYear) {
        throw new BadRequestException('Năm phát hành không hợp lệ');
      }
      payload.year = year;
    }
    for (const [field, max] of [['time', 100], ['quality', 50], ['lang', 100]] as const) {
      if (dto[field] !== undefined) payload[field] = this.cleanText(dto[field], max);
    }
    if (dto.content !== undefined) payload.content = this.cleanMultilineText(dto.content, 20_000);
    if (dto.category !== undefined) payload.category = this.sanitizeNamedItems(dto.category);
    if (dto.country !== undefined) payload.country = this.sanitizeNamedItems(dto.country);
    return payload;
  }

  private buildSearchQuery(search: string, fields: string[]): Record<string, any> {
    const term = String(search || '').trim().slice(0, 100);
    if (!term) return {};
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { $or: fields.map((field) => ({ [field]: { $regex: escaped, $options: 'i' } })) };
  }

  private normalizePagination(page: number, limit: number) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 6)));
    return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
  }

  private toPaginatedResult(items: any[], totalItems: number, page: number, limit: number) {
    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  // Helper fetch an toàn có timeout 3 giây tránh bị nghẽn mạng TMDB
  private async safeFetchTmdb(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      return res;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private setUpcomingCache(key: string, data: any): void {
    const now = Date.now();
    for (const [cacheKey, entry] of this.upcomingCache) {
      if (entry.expiry <= now) this.upcomingCache.delete(cacheKey);
    }
    while (this.upcomingCache.size >= this.upcomingCacheMaxEntries) {
      const oldestKey = this.upcomingCache.keys().next().value;
      if (!oldestKey) break;
      this.upcomingCache.delete(oldestKey);
    }
    this.upcomingCache.set(key, { data, expiry: now + this.upcomingCacheTtlMs });
  }

  private setPeopleCache(key: string, data: any): void {
    const now = Date.now();
    for (const [cacheKey, entry] of this.peopleCache) {
      if (entry.expiry <= now) this.peopleCache.delete(cacheKey);
    }
    while (this.peopleCache.size >= this.peopleCacheMaxEntries) {
      const oldestKey = this.peopleCache.keys().next().value;
      if (!oldestKey) break;
      this.peopleCache.delete(oldestKey);
    }
    this.peopleCache.set(key, { data, expiry: now + this.peopleCacheTtlMs });
  }

  private setCatalogCache(key: string, data: any, ttlMs = this.catalogCacheTtlMs): void {
    const now = Date.now();
    for (const [cacheKey, entry] of this.catalogCache) {
      if (entry.expiry <= now) this.catalogCache.delete(cacheKey);
    }
    while (this.catalogCache.size >= this.catalogCacheMaxEntries) {
      const oldestKey = this.catalogCache.keys().next().value;
      if (!oldestKey) break;
      this.catalogCache.delete(oldestKey);
    }
    this.catalogCache.set(key, { data, expiry: now + ttlMs });
  }

  private getCatalogItems(payload: any): any[] {
    const items = payload?.data?.items || payload?.items;
    return Array.isArray(items) ? items : [];
  }

  private isCatalogPayloadSuccessful(payload: any): boolean {
    if (!payload || payload.status === false) return false;
    return payload.status === true || payload.status === 'success' || Array.isArray(payload?.data?.items) || Array.isArray(payload?.items);
  }

  private normalizeCatalogImage(value: unknown, imageBase: string, sourceId: string): string {
    const image = String(value || '').trim();
    if (!image) return '';
    if (/^https?:\/\//i.test(image)) {
      if (
        (image.includes('img.ophimimg.com') || image.includes('img.ophim.live') || image.includes('ophim.cc') || image.includes('ophim1.com')) &&
        !image.includes('/uploads/movies/')
      ) {
        const filename = image.split('/').pop() || '';
        return `https://img.ophim.live/uploads/movies/${filename}`;
      }
      return image;
    }
    const path = image.replace(/^\/+/, '');
    if (sourceId === 'ophim' || imageBase.includes('ophim')) {
      const cleanSubPath = path.startsWith('uploads/movies/') ? path : `uploads/movies/${path}`;
      return `https://img.ophim.live/${cleanSubPath}`;
    }
    if (imageBase) return `${imageBase.replace(/\/+$/, '')}/${path}`;
    return `https://phimimg.com/${path}`;
  }

  private normalizeCatalogNamedItems(value: unknown): Array<{ name: string; slug: string }> {
    if (!Array.isArray(value)) return [];
    return value
      .map((item: any) => {
        const name = this.cleanText(typeof item === 'string' ? item : item?.name, 100);
        const slug = this.cleanText(
          typeof item === 'string' ? this.generateSlug(item) : (item?.slug || this.generateSlug(name)),
          100,
        );
        return { name, slug };
      })
      .filter((item) => item.name);
  }

  private normalizeCatalogMovie(movie: any, payload: any, sourceId: string): any | null {
    const slug = this.cleanText(movie?.slug, 180).toLowerCase();
    const name = this.cleanText(movie?.name || movie?.title, 250);
    if (!slug || !name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
    const imageBase = this.cleanText(
      payload?.data?.APP_DOMAIN_CDN_IMAGE || payload?.APP_DOMAIN_CDN_IMAGE || payload?.data?.appDomainCdnImage,
      500,
    );
    const year = Number(movie?.year);
    return {
      ...movie,
      _id: String(movie?._id || movie?.id || `${sourceId}-${slug}`),
      slug,
      name,
      origin_name: this.cleanText(movie?.origin_name || movie?.original_name || movie?.originName || name, 250),
      thumb_url: this.normalizeCatalogImage(movie?.thumb_url || movie?.thumbnail, imageBase, sourceId),
      poster_url: this.normalizeCatalogImage(movie?.poster_url || movie?.poster, imageBase, sourceId),
      year: Number.isInteger(year) && year > 1800 ? year : undefined,
      quality: this.cleanText(movie?.quality, 50) || 'HD',
      lang: this.cleanText(movie?.lang || movie?.language, 100) || 'Vietsub',
      status: this.cleanText(movie?.status, 50),
      episode_current: this.cleanText(movie?.episode_current || movie?.episodeCurrent, 100),
      episode_total: this.cleanText(movie?.episode_total || movie?.episodeTotal, 100),
      category: this.normalizeCatalogNamedItems(movie?.category || movie?.categories),
      country: this.normalizeCatalogNamedItems(movie?.country || movie?.countries),
    };
  }

  private normalizeCatalogPagination(payload: any, page: number, limit: number, itemCount: number) {
    const pagination = payload?.data?.params?.pagination || payload?.pagination || payload?.data?.pagination || {};
    const currentPage = Math.max(1, Number(pagination.currentPage || pagination.current_page || page) || page);
    const totalItemsPerPage = Math.max(1, Number(pagination.totalItemsPerPage || pagination.itemsPerPage || pagination.limit || limit) || limit);
    const totalItems = Math.max(0, Number(pagination.totalItems || pagination.total_items || pagination.total || itemCount) || itemCount);
    const totalPages = Math.max(1, Number(pagination.totalPages || pagination.total_pages) || Math.ceil(totalItems / totalItemsPerPage));
    return { currentPage, totalItems, totalItemsPerPage, totalPages };
  }

  private getMovieSourceIds(settings: any): { activeId: string; fallbackId: string } {
    const sources = Array.isArray(settings?.movieSources) && settings.movieSources.length > 0
      ? settings.movieSources
      : [{ id: 'phimapi' }, { id: 'ophim' }];
    const activeId = sources.some((source: any) => source.id === settings?.activeMovieSourceId)
      ? settings.activeMovieSourceId
      : (sources.find((source: any) => source.id === 'phimapi')?.id || sources[0]?.id || 'phimapi');
    const fallbackId = sources.find((source: any) => source.id !== activeId)?.id || activeId;
    return { activeId, fallbackId };
  }

  private isSourceCircuitOpen(sourceId: string): boolean {
    const circuit = this.sourceCircuits.get(sourceId);
    if (!circuit) return false;
    if (circuit.openUntil > Date.now()) return true;
    if (circuit.openUntil > 0) this.sourceCircuits.delete(sourceId);
    return false;
  }

  private recordSourceSuccess(sourceId: string): void {
    this.sourceCircuits.delete(sourceId);
  }

  private recordSourceFailure(sourceId: string): void {
    const previous = this.sourceCircuits.get(sourceId);
    const failures = (previous?.failures || 0) + 1;
    const circuitJustOpened = failures >= this.sourceCircuitFailureThreshold
      && (previous?.failures || 0) < this.sourceCircuitFailureThreshold;
    this.sourceCircuits.set(sourceId, {
      failures,
      openUntil: failures >= this.sourceCircuitFailureThreshold
        ? Date.now() + this.sourceCircuitCooldownMs
        : 0,
    });
    this.sourceFailureTotals.set(sourceId, (this.sourceFailureTotals.get(sourceId) || 0) + 1);
    if (circuitJustOpened) this.discoveryMetrics.circuitTrips += 1;
  }

  private shouldTripSourceCircuit(payload: any): boolean {
    const message = String(payload?.message || '');
    const httpStatus = Number((message.match(/(?:lỗi|error)\s+(\d{3})/i) || [])[1]);
    // 4xx thường là đường dẫn không được nguồn đó hỗ trợ, không phải cả máy chủ bị hỏng.
    return !httpStatus || httpStatus >= 500;
  }

  private setDiscoveryLastKnownGood(key: string, data: any): void {
    const now = Date.now();
    for (const [cacheKey, entry] of this.discoveryLastKnownGood) {
      if (entry.expiry <= now) this.discoveryLastKnownGood.delete(cacheKey);
    }
    while (this.discoveryLastKnownGood.size >= this.catalogCacheMaxEntries) {
      const oldestKey = this.discoveryLastKnownGood.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.discoveryLastKnownGood.delete(oldestKey);
    }
    this.discoveryLastKnownGood.set(key, {
      data: JSON.parse(JSON.stringify(data)),
      savedAt: now,
      expiry: now + this.discoveryStaleTtlMs,
    });
  }

  private getDiscoveryLastKnownGood(key: string): { data: any; savedAt: number } | null {
    const entry = this.discoveryLastKnownGood.get(key);
    if (!entry) return null;
    if (entry.expiry <= Date.now()) {
      this.discoveryLastKnownGood.delete(key);
      return null;
    }
    return { data: JSON.parse(JSON.stringify(entry.data)), savedAt: entry.savedAt };
  }

  private async fetchMovieListWithFallback(path: string, settings: any): Promise<{
    payload: any;
    fallbackUsed: boolean;
    fallbackReason: 'source-error' | 'empty-result' | null;
  }> {
    this.discoveryMetrics.resolutions += 1;
    const { activeId, fallbackId } = this.getMovieSourceIds(settings);
    const attempts = [
      { preference: 'active', sourceId: activeId },
      { preference: 'fallback', sourceId: fallbackId },
    ].filter((attempt, index, values) => values.findIndex((value) => value.sourceId === attempt.sourceId) === index);
    let firstEmptyPayload: any = null;
    let firstEmptyWasFallback = false;
    let activeFailure = false;

    for (const attempt of attempts) {
      if (this.isSourceCircuitOpen(attempt.sourceId)) {
        this.discoveryMetrics.circuitSkips += 1;
        if (attempt.preference === 'active') activeFailure = true;
        continue;
      }
      try {
        const candidate = await this.fetchOphimProxy(path, attempt.preference);
        if (!this.isCatalogPayloadSuccessful(candidate)) {
          if (this.shouldTripSourceCircuit(candidate)) this.recordSourceFailure(attempt.sourceId);
          if (attempt.preference === 'active') activeFailure = true;
          continue;
        }
        this.recordSourceSuccess(attempt.sourceId);
        if (this.getCatalogItems(candidate).length > 0) {
          const fallbackUsed = attempt.preference === 'fallback';
          if (fallbackUsed) this.discoveryMetrics.fallbackResponses += 1;
          return {
            payload: candidate,
            fallbackUsed,
            fallbackReason: fallbackUsed ? (activeFailure ? 'source-error' : 'empty-result') : null,
          };
        }
        if (!firstEmptyPayload) {
          firstEmptyPayload = candidate;
          firstEmptyWasFallback = attempt.preference === 'fallback';
        }
      } catch {
        this.recordSourceFailure(attempt.sourceId);
        if (attempt.preference === 'active') activeFailure = true;
      }
    }

    if (firstEmptyPayload) {
      if (firstEmptyWasFallback) this.discoveryMetrics.fallbackResponses += 1;
      return {
        payload: firstEmptyPayload,
        fallbackUsed: firstEmptyWasFallback,
        fallbackReason: firstEmptyWasFallback ? (activeFailure ? 'source-error' : 'empty-result') : null,
      };
    }
    throw new ServiceUnavailableException('Cả hai máy chủ phim đang tạm gián đoạn. Vui lòng thử lại sau ít phút.');
  }

  async getMovieCatalog(input: {
    type?: string;
    page?: number;
    limit?: number;
    year?: string;
    genre?: string;
    status?: string;
    sort?: string;
  }): Promise<any> {
    const type = input.type === 'phim-bo' ? 'phim-bo' : 'phim-le';
    const page = Math.min(500, Math.max(1, Math.floor(Number(input.page) || 1)));
    const limit = Math.min(48, Math.max(12, Math.floor(Number(input.limit) || 24)));
    const currentYear = new Date().getFullYear() + 1;
    const numericYear = Number(input.year);
    const year = Number.isInteger(numericYear) && numericYear >= 1900 && numericYear <= currentYear
      ? String(numericYear)
      : '';
    const genre = /^[a-z0-9-]{1,60}$/.test(String(input.genre || '')) ? String(input.genre) : '';
    const status = ['completed', 'ongoing'].includes(String(input.status)) ? String(input.status) : '';
    const sort = ['updated', 'year-desc', 'year-asc'].includes(String(input.sort))
      ? String(input.sort)
      : 'updated';
    const sortField = sort === 'updated' ? 'modified.time' : 'year';
    const sortType = sort === 'year-asc' ? 'asc' : 'desc';
    const settings = await this.settingsService.getSettings();
    const activeSourceId = settings?.activeMovieSourceId || 'phimapi';
    const cacheKey = [activeSourceId, type, page, limit, year, genre, status, sort].join(':');
    const cached = this.catalogCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { ...cached.data, cache: { hit: true, ttlSeconds: cached.data?.cache?.ttlSeconds || 600 } };
    }

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort_field: sortField,
      sort_type: sortType,
    });
    if (year) params.set('year', year);
    if (genre) params.set('category', genre);
    if (status) params.set('status', status);

    const path = `/v1/api/danh-sach/${type}?${params.toString()}`;
    const staleKey = ['catalog', type, page, limit, year, genre, status, sort].join(':');
    let resolved: Awaited<ReturnType<MoviesService['fetchMovieListWithFallback']>>;
    try {
      resolved = await this.fetchMovieListWithFallback(path, settings);
    } catch (error) {
      const stale = this.getDiscoveryLastKnownGood(staleKey);
      if (stale) {
        this.discoveryMetrics.staleResponses += 1;
        return {
          ...stale.data,
          stale: { used: true, savedAt: new Date(stale.savedAt).toISOString() },
          cache: { hit: false, ttlSeconds: 0 },
        };
      }
      throw error;
    }

    const { payload, fallbackUsed, fallbackReason } = resolved;
    const sourceId = payload?._sourceId || activeSourceId;
    const rawItems = this.getCatalogItems(payload);
    const statusMatches = (movie: any) => {
      if (!status) return true;
      const value = `${movie?.status || ''} ${movie?.episode_current || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const completed = /completed|complete|hoan tat|full/.test(value);
      return status === 'completed' ? completed : !completed;
    };
    const seen = new Set<string>();
    const items = rawItems
      .filter(statusMatches)
      .map((movie: any) => this.normalizeCatalogMovie(movie, payload, sourceId))
      .filter((movie: any) => {
        if (!movie?.slug || seen.has(movie.slug)) return false;
        seen.add(movie.slug);
        return true;
      });
    const pagination = this.normalizeCatalogPagination(payload, page, limit, items.length);
    const availability = items.length > 0 ? 'ready' : 'empty';
    const ttlSeconds = availability === 'empty' ? 60 : 600;
    const data = {
      status: true,
      availability,
      source: sourceId,
      items,
      titlePage: payload?.data?.titlePage || payload?.titlePage || '',
      pagination,
      filters: { type, year, genre, status, sort },
      fallback: {
        used: fallbackUsed,
        reason: fallbackReason,
      },
      stale: { used: false, savedAt: null },
      cache: { hit: false, ttlSeconds },
    };
    this.setCatalogCache(cacheKey, data, ttlSeconds * 1000);
    if (availability === 'ready') this.setDiscoveryLastKnownGood(staleKey, data);
    return data;
  }

  async getMovieDiscovery(input: {
    kind?: string;
    slug?: string;
    keyword?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const allowedKinds = ['search', 'genre', 'country', 'list'];
    const kind = allowedKinds.includes(String(input.kind)) ? String(input.kind) : 'list';
    const page = Math.min(500, Math.max(1, Math.floor(Number(input.page) || 1)));
    const limit = Math.min(48, Math.max(10, Math.floor(Number(input.limit) || 24)));
    const keyword = this.cleanText(input.keyword, 100);
    const requestedSlug = String(input.slug || '').trim().toLowerCase();
    const listSlugs = ['phim-moi-cap-nhat', 'phim-le', 'phim-bo', 'hoat-hinh', 'phim-chieu-rap'];
    const slug = kind === 'list'
      ? (listSlugs.includes(requestedSlug) ? requestedSlug : 'phim-moi-cap-nhat')
      : (/^[a-z0-9-]{1,80}$/.test(requestedSlug) ? requestedSlug : '');

    if (kind === 'search' && keyword.length < 2) {
      return {
        status: true,
        availability: 'empty',
        items: [],
        pagination: { currentPage: 1, totalItems: 0, totalItemsPerPage: limit, totalPages: 1 },
        fallback: { used: false, reason: null },
        stale: { used: false, savedAt: null },
      };
    }
    if (kind !== 'search' && !slug) throw new BadRequestException('Danh mục phim không hợp lệ');

    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    let path = '';
    if (kind === 'search') {
      params.set('keyword', keyword);
      path = `/v1/api/tim-kiem?${params.toString()}`;
    } else if (kind === 'genre') {
      path = slug === 'hoat-hinh' || slug === 'phim-chieu-rap'
        ? `/v1/api/danh-sach/${slug}?${params.toString()}`
        : `/v1/api/the-loai/${slug}?${params.toString()}`;
    } else if (kind === 'country') {
      path = `/v1/api/quoc-gia/${slug}?${params.toString()}`;
    } else {
      path = `/v1/api/danh-sach/${slug}?${params.toString()}`;
    }

    const settings = await this.settingsService.getSettings();
    const { activeId } = this.getMovieSourceIds(settings);
    const logicalKey = ['discovery', kind, slug, keyword.toLowerCase(), page, limit].join(':');
    const cacheKey = [activeId, logicalKey].join(':');
    const cached = this.catalogCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { ...cached.data, cache: { hit: true, ttlSeconds: cached.data?.cache?.ttlSeconds || 600 } };
    }

    let resolved: Awaited<ReturnType<MoviesService['fetchMovieListWithFallback']>>;
    try {
      resolved = await this.fetchMovieListWithFallback(path, settings);
    } catch (error) {
      const stale = this.getDiscoveryLastKnownGood(logicalKey);
      if (stale) {
        this.discoveryMetrics.staleResponses += 1;
        return {
          ...stale.data,
          stale: { used: true, savedAt: new Date(stale.savedAt).toISOString() },
          cache: { hit: false, ttlSeconds: 0 },
        };
      }
      throw error;
    }

    const sourceId = resolved.payload?._sourceId || activeId;
    const seen = new Set<string>();
    const items = this.getCatalogItems(resolved.payload)
      .map((movie: any) => this.normalizeCatalogMovie(movie, resolved.payload, sourceId))
      .filter((movie: any) => {
        if (!movie?.slug || seen.has(movie.slug)) return false;
        seen.add(movie.slug);
        return true;
      });
    const pagination = this.normalizeCatalogPagination(resolved.payload, page, limit, items.length);
    const availability = items.length > 0 ? 'ready' : 'empty';
    const ttlSeconds = availability === 'empty' ? 60 : 600;
    const data = {
      status: true,
      availability,
      source: sourceId,
      items,
      titlePage: resolved.payload?.data?.titlePage || resolved.payload?.titlePage || '',
      pagination,
      query: { kind, slug, keyword, page, limit },
      fallback: { used: resolved.fallbackUsed, reason: resolved.fallbackReason },
      stale: { used: false, savedAt: null },
      cache: { hit: false, ttlSeconds },
    };
    this.setCatalogCache(cacheKey, data, ttlSeconds * 1000);
    if (availability === 'ready') this.setDiscoveryLastKnownGood(logicalKey, data);
    return data;
  }

  async getDailyShowtimes(requestedDate = '', requestedLimit = 60): Promise<any> {
    const timeZone = 'Asia/Ho_Chi_Minh';
    const today = this.formatDateInTimeZone(new Date(), timeZone);
    const date = requestedDate || today;
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00.000Z`)
      : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('Ngày lịch chiếu phải có định dạng YYYY-MM-DD');
    }

    const limit = Math.min(100, Math.max(1, Math.floor(Number(requestedLimit) || 60)));
    const settings = await this.settingsService.getSettings();
    const { activeId } = this.getMovieSourceIds(settings);
    const cacheKey = `${activeId}:showtimes:${date}:${limit}`;
    const cached = this.catalogCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { ...cached.data, cache: { hit: true, ttlSeconds: 600 } };
    }

    if (date > today) {
      const items = await this.getTmdbDailyAirings(date, settings, limit);
      const data = {
        status: true,
        availability: items.length > 0 ? 'ready' : 'empty',
        date,
        timeZone,
        source: 'tmdb',
        scheduleType: 'scheduled',
        items,
        totalItems: items.length,
        fallback: { used: false, reason: null },
        cache: { hit: false, ttlSeconds: 600 },
      };
      this.setCatalogCache(cacheKey, data, 10 * 60 * 1000);
      return data;
    }

    // Nguồn phim không có API lịch phát sóng riêng. Sáu trang mới nhất đủ bao phủ
    // khoảng một tuần cập nhật gần đây, rồi được nhóm theo giờ Việt Nam.
    const pageResults = await Promise.all(
      Array.from({ length: 6 }, (_, index) => index + 1).map((page) =>
        this.fetchMovieListWithFallback(
          `/v1/api/danh-sach/phim-moi-cap-nhat?page=${page}&limit=64`,
          settings,
        ),
      ),
    );

    const seen = new Set<string>();
    const items = pageResults
      .flatMap((result) => {
        const payload = result.payload;
        const sourceId = payload?._sourceId || activeId;
        return this.getCatalogItems(payload).map((movie: any) =>
          this.normalizeCatalogMovie(movie, payload, sourceId),
        );
      })
      .filter((movie: any) => {
        if (!movie?.slug || seen.has(movie.slug)) return false;
        const modifiedAt = movie?.modified?.time || movie?.modifiedAt;
        const modifiedDate = this.formatDateInTimeZone(new Date(modifiedAt), timeZone);
        if (!modifiedAt || modifiedDate !== date) return false;
        seen.add(movie.slug);
        return true;
      })
      .sort((left: any, right: any) => {
        const leftTime = Date.parse(left?.modified?.time || left?.modifiedAt || '') || 0;
        const rightTime = Date.parse(right?.modified?.time || right?.modifiedAt || '') || 0;
        return rightTime - leftTime;
      })
      .slice(0, limit);

    const data = {
      status: true,
      availability: items.length > 0 ? 'ready' : 'empty',
      date,
      timeZone,
      source: pageResults[0]?.payload?._sourceId || activeId,
      scheduleType: 'updated',
      items,
      totalItems: items.length,
      fallback: {
        used: pageResults.some((result) => result.fallbackUsed),
        reason: pageResults.find((result) => result.fallbackReason)?.fallbackReason || null,
      },
      cache: { hit: false, ttlSeconds: 600 },
    };
    this.setCatalogCache(cacheKey, data, 10 * 60 * 1000);
    return data;
  }

  private async getTmdbDailyAirings(date: string, settings: any, limit: number): Promise<any[]> {
    const apiKey = settings?.tmdbApiKey || '591c025bb1641315ae087330271132bc';
    const params = new URLSearchParams({
      api_key: apiKey,
      language: 'vi-VN',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'air_date.gte': date,
      'air_date.lte': date,
      page: '1',
    });
    const response = await this.safeFetchTmdb(`https://api.themoviedb.org/3/discover/tv?${params.toString()}`);
    if (!response?.ok) return [];
    const payload = await response.json();
    const candidates = (Array.isArray(payload?.results) ? payload.results : [])
      .filter((item: any) => item?.id && (item?.poster_path || item?.backdrop_path))
      .slice(0, Math.min(20, limit));
    const details = await Promise.all(
      candidates.map(async (item: any) => {
        const detailResponse = await this.safeFetchTmdb(
          `https://api.themoviedb.org/3/tv/${item.id}?api_key=${apiKey}&language=vi-VN`,
        );
        if (!detailResponse?.ok) return null;
        const detail = await detailResponse.json();
        const nextEpisode = detail?.next_episode_to_air;
        if (!nextEpisode || String(nextEpisode.air_date || '').slice(0, 10) !== date) return null;
        const name = detail.name || item.name || detail.original_name || item.original_name;
        const originName = detail.original_name || item.original_name || name;
        return {
          _id: `tmdb-tv-${item.id}`,
          slug: `tmdb-tv-${item.id}-${this.generateSlug(originName || name || 'series')}`,
          name,
          origin_name: originName,
          poster_url: detail.poster_path || item.poster_path
            ? `https://image.tmdb.org/t/p/w500${detail.poster_path || item.poster_path}`
            : '',
          thumb_url: detail.backdrop_path || item.backdrop_path
            ? `https://image.tmdb.org/t/p/w780${detail.backdrop_path || item.backdrop_path}`
            : '',
          episode_current: `Tập ${nextEpisode.episode_number}`,
          episode_name: nextEpisode.name || '',
          season_number: Number(nextEpisode.season_number) || undefined,
          air_date: date,
          scheduled: true,
          quality: 'TMDB',
          lang: 'Sắp phát sóng',
          tmdb: { id: String(item.id), type: 'tv', vote_average: Number(item.vote_average) || 0 },
        };
      }),
    );
    const seen = new Set<string>();
    return details
      .filter((item: any) => {
        if (!item?.slug || seen.has(item.slug)) return false;
        seen.add(item.slug);
        return true;
      })
      .slice(0, limit);
  }

  private formatDateInTimeZone(value: Date, timeZone: string): string {
    if (Number.isNaN(value.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  async getDiscoveryHealth(): Promise<any> {
    const settings = await this.settingsService.getSettings();
    const configuredSources = Array.isArray(settings?.movieSources) ? settings.movieSources : [];
    const sourceIds = new Set<string>([
      ...configuredSources.map((source: any) => String(source?.id || '')).filter(Boolean),
      ...this.sourceCircuits.keys(),
      ...this.sourceFailureTotals.keys(),
    ]);
    const now = Date.now();
    const sources = [...sourceIds].map((sourceId) => {
      const circuit = this.sourceCircuits.get(sourceId);
      const openUntil = circuit?.openUntil || 0;
      return {
        id: sourceId,
        name: configuredSources.find((source: any) => source?.id === sourceId)?.name || sourceId,
        active: settings?.activeMovieSourceId === sourceId,
        failures: this.sourceFailureTotals.get(sourceId) || 0,
        consecutiveFailures: circuit?.failures || 0,
        circuitOpen: openUntil > now,
        openUntil: openUntil > now ? new Date(openUntil).toISOString() : null,
      };
    });
    const resolutions = this.discoveryMetrics.resolutions;
    return {
      generatedAt: new Date(now).toISOString(),
      storageScope: 'instance',
      startedAt: new Date(this.discoveryMetrics.startedAt).toISOString(),
      summary: {
        resolutions,
        fallbackResponses: this.discoveryMetrics.fallbackResponses,
        fallbackRate: resolutions > 0
          ? Number(((this.discoveryMetrics.fallbackResponses / resolutions) * 100).toFixed(1))
          : 0,
        staleResponses: this.discoveryMetrics.staleResponses,
        circuitTrips: this.discoveryMetrics.circuitTrips,
        circuitSkips: this.discoveryMetrics.circuitSkips,
        openCircuits: sources.filter((source) => source.circuitOpen).length,
        lastKnownGoodEntries: this.discoveryLastKnownGood.size,
      },
      sources,
    };
  }

  async searchPeople(query: string, page = 1): Promise<any> {
    const normalizedQuery = this.cleanText(query, 100);
    if (normalizedQuery.length < 2) {
      return { items: [], page: 1, totalPages: 1, totalItems: 0 };
    }
    const safePage = Math.min(20, Math.max(1, Math.floor(Number(page) || 1)));
    const cacheKey = `search:${normalizedQuery.toLowerCase()}:${safePage}`;
    const cached = this.peopleCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const settings = await this.settingsService.getSettings();
    const apiKey = settings.tmdbApiKey || '591c025bb1641315ae087330271132bc';
    const response = await this.safeFetchTmdb(
      `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(normalizedQuery)}&language=vi-VN&page=${safePage}&include_adult=false`,
    );
    if (!response?.ok) {
      return { items: [], page: safePage, totalPages: 1, totalItems: 0 };
    }

    const payload = await response.json();
    const items = (payload.results || []).slice(0, 20).map((person: any) => ({
      id: String(person.id),
      name: person.name,
      originalName: person.original_name || person.name,
      profileUrl: person.profile_path
        ? `https://image.tmdb.org/t/p/w342${person.profile_path}`
        : null,
      department: person.known_for_department || 'Acting',
      knownFor: (person.known_for || []).slice(0, 3).map((movie: any) =>
        movie.title || movie.name || movie.original_title || movie.original_name,
      ).filter(Boolean),
    }));
    const data = {
      items,
      page: Number(payload.page) || safePage,
      totalPages: Math.min(20, Number(payload.total_pages) || 1),
      totalItems: Number(payload.total_results) || items.length,
    };
    this.setPeopleCache(cacheKey, data);
    return data;
  }

  async getPersonMovies(personId: string, page = 1): Promise<any> {
    if (!/^\d+$/.test(personId)) throw new BadRequestException('ID diễn viên không hợp lệ');
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const cacheKey = `credits:${personId}:${safePage}`;
    const cached = this.peopleCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const settings = await this.settingsService.getSettings();
    const apiKey = settings.tmdbApiKey || '591c025bb1641315ae087330271132bc';
    const [personResponse, creditsResponse] = await Promise.all([
      this.safeFetchTmdb(`https://api.themoviedb.org/3/person/${personId}?api_key=${apiKey}&language=vi-VN`),
      this.safeFetchTmdb(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${apiKey}&language=vi-VN`),
    ]);
    if (!personResponse?.ok) throw new NotFoundException('Không tìm thấy diễn viên');
    const person = await personResponse.json();
    const creditsPayload = creditsResponse?.ok ? await creditsResponse.json() : { cast: [] };

    const uniqueCredits = Array.from(
      new Map(
        (creditsPayload.cast || [])
          .filter((credit: any) => credit.media_type === 'movie' || credit.media_type === 'tv')
          .map((credit: any) => [`${credit.media_type}:${credit.id}`, credit]),
      ).values(),
    ).sort((left: any, right: any) => {
      const leftDate = left.release_date || left.first_air_date || '';
      const rightDate = right.release_date || right.first_air_date || '';
      return (Number(right.popularity) - Number(left.popularity)) || rightDate.localeCompare(leftDate);
    });

    const perPage = 16;
    const pageCredits = uniqueCredits.slice((safePage - 1) * perPage, safePage * perPage);
    const items = pageCredits.map((credit: any) => {
      const name = credit.title || credit.name || credit.original_title || credit.original_name || 'Chưa rõ tên';
      const originName = credit.original_title || credit.original_name || name;
      const releaseDate = credit.release_date || credit.first_air_date || '';
      return {
        _id: `tmdb-${credit.media_type}-${credit.id}`,
        slug: `tmdb-${credit.id}-${this.generateSlug(originName || name)}`,
        name,
        origin_name: originName,
        poster_url: credit.poster_path ? `https://image.tmdb.org/t/p/w500${credit.poster_path}` : '',
        thumb_url: credit.backdrop_path
          ? `https://image.tmdb.org/t/p/w780${credit.backdrop_path}`
          : (credit.poster_path ? `https://image.tmdb.org/t/p/w500${credit.poster_path}` : ''),
        year: Number(String(releaseDate).slice(0, 4)) || undefined,
        release_date: releaseDate,
        character: credit.character || '',
        quality: 'TMDB',
        lang: credit.media_type === 'tv' ? 'Phim bộ' : 'Phim lẻ',
        tmdb: { id: String(credit.id), type: credit.media_type },
      };
    });

    const data = {
      person: {
        id: String(person.id),
        name: person.name,
        biography: person.biography || '',
        birthday: person.birthday || '',
        placeOfBirth: person.place_of_birth || '',
        profileUrl: person.profile_path ? `https://image.tmdb.org/t/p/h632${person.profile_path}` : null,
      },
      items,
      page: safePage,
      totalPages: Math.max(1, Math.ceil(uniqueCredits.length / perPage)),
      totalItems: uniqueCredits.length,
      itemsPerPage: perPage,
    };
    this.setPeopleCache(cacheKey, data);
    return data;
  }

  private mapTmdbReleaseItem(item: any) {
    const releaseDate = String(item?.release_date || '').slice(0, 10);
    const name = item?.title || item?.original_title || 'Phim chưa đặt tên';
    const originName = item?.original_title || item?.title || name;
    return {
      tmdbId: String(item.id),
      tmdbType: 'movie',
      slug: `tmdb-${item.id}-${this.generateSlug(originName || name || 'movie')}`,
      name,
      originName,
      overview: item?.overview || '',
      posterUrl: item?.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : '',
      backdropUrl: item?.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
        : (item?.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : ''),
      releaseDate,
      year: Number(releaseDate.slice(0, 4)) || undefined,
      genres: (item?.genres || []).map((genre: any) => ({
        id: Number(genre?.id) || undefined,
        name: String(genre?.name || ''),
        slug: this.generateSlug(genre?.name || ''),
      })).filter((genre: any) => genre.name),
      voteAverage: Number(item?.vote_average) || 0,
      releaseStatus: releaseDate && releaseDate <= new Date().toISOString().slice(0, 10) ? 'released' : 'scheduled',
      metadataUpdatedAt: new Date(),
    };
  }

  private toReleaseAvailability(record?: any) {
    const available = record?.playbackStatus === 'available' && Boolean(record?.providerSlug);
    return {
      status: available ? 'available' : 'unavailable',
      label: available ? 'Đã có bản phát' : 'Chưa có bản xem',
      source: available ? record.providerSource : undefined,
      resolvedSlug: available ? record.providerSlug : undefined,
      matchedAt: available ? record.matchedAt : undefined,
    };
  }

  /** Đồng bộ hồ sơ phát hành từ TMDB. TMDB chỉ cấp metadata, không được coi là nguồn phát. */
  async syncMovieReleaseMetadata(pageLimit = 2): Promise<{ fetched: number; stored: number }> {
    if (!this.movieReleaseModel) return { fetched: 0, stored: 0 };
    const settings = await this.settingsService.getSettings();
    const apiKey = settings.tmdbApiKey || '591c025bb1641315ae087330271132bc';
    const safePageLimit = Math.min(5, Math.max(1, Math.floor(Number(pageLimit) || 2)));
    const feeds = ['upcoming', 'now_playing'];
    const payloads = await Promise.all(
      feeds.flatMap((feed) => Array.from({ length: safePageLimit }, (_, index) =>
        this.safeFetchTmdb(
          `https://api.themoviedb.org/3/movie/${feed}?api_key=${apiKey}&language=vi-VN&region=VN&page=${index + 1}`,
        ).then(async (response) => response?.ok ? response.json() : ({ results: [] })),
      )),
    );
    const unique = new Map<string, any>();
    for (const payload of payloads) {
      for (const item of payload?.results || []) {
        if (item?.id && (item.poster_path || item.backdrop_path)) unique.set(String(item.id), item);
      }
    }
    if (unique.size === 0) return { fetched: 0, stored: 0 };
    const operations = Array.from(unique.values()).map((item) => {
      const metadata = this.mapTmdbReleaseItem(item);
      return {
        updateOne: {
          filter: { tmdbId: metadata.tmdbId },
          update: {
            $set: metadata,
            $setOnInsert: {
              playbackStatus: 'unavailable',
              providerSource: '',
              providerSlug: '',
              matchMethod: '',
              nextCheckAt: new Date(),
              checkAttempts: 0,
            },
          },
          upsert: true,
        },
      };
    });
    const result = await this.movieReleaseModel.bulkWrite(operations, { ordered: false });
    this.upcomingCache.clear();
    return { fetched: unique.size, stored: result.upsertedCount + result.modifiedCount };
  }

  /** Tự dò bản phát thật trên cả PhimAPI và OPhim, ưu tiên TMDB ID rồi mới title + year. */
  async scanMovieReleaseAvailability(limit = 30): Promise<{ checked: number; matched: number; pending: number }> {
    if (!this.movieReleaseModel) return { checked: 0, matched: 0, pending: 0 };
    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 30)));
    const now = new Date();
    const records = await this.movieReleaseModel.find({
      playbackStatus: { $ne: 'available' },
      nextCheckAt: { $lte: now },
    }).sort({ releaseDate: 1, lastCheckedAt: 1 }).limit(safeLimit).lean().exec();
    let matched = 0;
    let cursor = 0;
    const processRecord = async (record: any) => {
      let detail: any = null;
      let providerSource = '';
      for (const source of ['phimapi', 'ophim']) {
        try {
          const candidate = await this.resolveMovieDetailAcrossSources(
            record.slug,
            source,
            record.name,
            record.originName,
            record.year,
            record.tmdbId,
          );
          const playable = (candidate?.episodes || []).some((server: any) =>
            (server?.server_data || []).some((episode: any) => episode?.link_m3u8 || episode?.link_embed),
          );
          if (playable && candidate?._resolvedSlug) {
            detail = candidate;
            providerSource = source;
            break;
          }
        } catch {
          // Nguồn lỗi hoặc chưa có phim: nguồn còn lại và vòng quét sau vẫn tiếp tục.
        }
      }
      if (detail?._resolvedSlug) {
        const item = detail?.movie || detail?.data?.item || {};
        const matchedByTmdbId = String(item?.tmdb?.id || item?.tmdb || '') === String(record.tmdbId);
        await this.movieReleaseModel!.updateOne({ _id: record._id }, {
          $set: {
            playbackStatus: 'available',
            providerSource,
            providerSlug: detail._resolvedSlug,
            matchMethod: matchedByTmdbId ? 'tmdb_id' : 'title_year',
            matchedAt: now,
            lastCheckedAt: now,
            nextCheckAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000),
          },
          $inc: { checkAttempts: 1 },
        }).exec();
        matched += 1;
        return;
      }
      const releaseTime = record.releaseDate ? new Date(`${record.releaseDate}T00:00:00+07:00`).getTime() : now.getTime();
      const nearRelease = releaseTime <= now.getTime() + 30 * 24 * 60 * 60_000;
      await this.movieReleaseModel!.updateOne({ _id: record._id }, {
        $set: {
          lastCheckedAt: now,
          nextCheckAt: new Date(now.getTime() + (nearRelease ? 30 * 60_000 : 6 * 60 * 60_000)),
        },
        $inc: { checkAttempts: 1 },
      }).exec();
    };
    const workers = Array.from({ length: Math.min(3, records.length) }, async () => {
      while (cursor < records.length) await processRecord(records[cursor++]);
    });
    await Promise.all(workers);
    this.upcomingCache.clear();
    return { checked: records.length, matched, pending: records.length - matched };
  }

  async getUpcomingMovies(page = 1): Promise<any> {
    const safePage = Math.min(20, Math.max(1, Math.floor(Number(page) || 1)));
    const cacheKey = `list:${safePage}`;
    const cached = this.upcomingCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const settings = await this.settingsService.getSettings();
    const apiKey = settings.tmdbApiKey || '591c025bb1641315ae087330271132bc';
    const response = await this.safeFetchTmdb(
      `https://api.themoviedb.org/3/movie/upcoming?api_key=${apiKey}&language=vi-VN&region=VN&page=${safePage}`,
    );
    if (!response?.ok) {
      if (cached) return cached.data;
      return { status: false, source: 'tmdb', items: [], page: safePage, totalPages: 1 };
    }

    const payload = await response.json();
    const rawItems = (payload.results || [])
      .filter((item: any) => item?.id && (item.poster_path || item.backdrop_path))
    const releaseRecords = this.movieReleaseModel && rawItems.length > 0
      ? await this.movieReleaseModel.find({ tmdbId: { $in: rawItems.map((item: any) => String(item.id)) } }).lean().exec()
      : [];
    const releaseMap = new Map(releaseRecords.map((record: any) => [String(record.tmdbId), record]));
    const items = rawItems.map((item: any) => ({
        _id: `tmdb-${item.id}`,
        name: item.title || item.original_title,
        origin_name: item.original_title || item.title,
        slug: `tmdb-${item.id}-${this.generateSlug(item.original_title || item.title || 'movie')}`,
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : '',
        thumb_url: item.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
          : `https://image.tmdb.org/t/p/w780${item.poster_path}`,
        year: Number(String(item.release_date || '').slice(0, 4)) || undefined,
        release_date: item.release_date || '',
        episode_current: 'Trailer',
        status: 'trailer',
        quality: 'HD',
        lang: 'Trailer',
        tmdb: { id: String(item.id), type: 'movie', vote_average: item.vote_average || 0 },
        availability: this.toReleaseAvailability(releaseMap.get(String(item.id))),
      }));
    if (this.movieReleaseModel && rawItems.length > 0) {
      const operations = rawItems.map((item: any) => {
        const metadata = this.mapTmdbReleaseItem(item);
        return { updateOne: { filter: { tmdbId: metadata.tmdbId }, update: { $set: metadata, $setOnInsert: { playbackStatus: 'unavailable', nextCheckAt: new Date() } }, upsert: true } };
      });
      void this.movieReleaseModel.bulkWrite(operations, { ordered: false }).catch(() => undefined);
    }
    const data = {
      status: true,
      source: 'tmdb',
      titlePage: 'Phim sắp chiếu',
      items,
      page: Number(payload.page) || safePage,
      totalPages: Math.min(20, Number(payload.total_pages) || 1),
      totalItems: Number(payload.total_results) || items.length,
    };
    this.setUpcomingCache(cacheKey, data);
    return data;
  }

  async getUpcomingMovieDetail(tmdbId: string): Promise<any> {
    if (!/^\d+$/.test(tmdbId)) throw new BadRequestException('TMDB ID không hợp lệ');
    const cacheKey = `detail:${tmdbId}`;
    const cached = this.upcomingCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const releaseRecord = this.movieReleaseModel
      ? await this.movieReleaseModel.findOne({ tmdbId }).lean().exec()
      : null;
    if (releaseRecord?.playbackStatus === 'available' && releaseRecord.providerSlug) {
      try {
        const providerDetail = await this.fetchOphimProxy(
          `/phim/${releaseRecord.providerSlug}`,
          releaseRecord.providerSource || 'phimapi',
        );
        const movie = providerDetail?.movie || providerDetail?.data?.item;
        const episodes = providerDetail?.episodes || movie?.episodes || [];
        const playable = episodes.some((server: any) =>
          (server?.server_data || []).some((episode: any) => episode?.link_m3u8 || episode?.link_embed),
        );
        if (playable) {
          const data = {
            ...providerDetail,
            movie,
            episodes,
            source: releaseRecord.providerSource,
            redirectSlug: releaseRecord.providerSlug,
            availability: this.toReleaseAvailability(releaseRecord),
          };
          this.setUpcomingCache(cacheKey, data);
          return data;
        }
      } catch {
        // Bản đã ghép tạm lỗi: dò lại cả hai nguồn ở nhánh dưới.
      }
    }

    const settings = await this.settingsService.getSettings();
    const apiKey = settings.tmdbApiKey || '591c025bb1641315ae087330271132bc';
    const [response, englishVideosResponse] = await Promise.all([
      this.safeFetchTmdb(
        `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=vi-VN&append_to_response=videos,release_dates`,
      ),
      this.safeFetchTmdb(
        `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${apiKey}&language=en-US`,
      ),
    ]);
    if (!response?.ok) throw new NotFoundException('Không tìm thấy phim sắp chiếu trên TMDB');
    const item = await response.json();
    const releaseDate = this.resolveTmdbReleaseDate(item);

    // Khi PhimAPI/OPhim đã có bản phát thật, đổi từ trang lịch chiếu sang slug có tập xem.
    for (const source of ['phimapi', 'ophim']) {
      try {
        const providerDetail = await this.resolveMovieDetailAcrossSources(
          `tmdb-${tmdbId}`,
          source,
          item.title,
          item.original_title,
          Number(String(releaseDate || '').slice(0, 4)) || undefined,
          tmdbId,
        );
        const hasPlayableEpisode = (providerDetail?.episodes || []).some((server: any) =>
          (server?.server_data || []).some((episode: any) => episode?.link_m3u8 || episode?.link_embed),
        );
        if (hasPlayableEpisode && providerDetail?._resolvedSlug) {
          if (this.movieReleaseModel) {
            const providerMovie = providerDetail?.movie || providerDetail?.data?.item || {};
            const matchMethod = String(providerMovie?.tmdb?.id || providerMovie?.tmdb || '') === tmdbId
              ? 'tmdb_id'
              : 'title_year';
            await this.movieReleaseModel.updateOne({ tmdbId }, {
              $set: {
                playbackStatus: 'available', providerSource: source,
                providerSlug: providerDetail._resolvedSlug, matchMethod,
                matchedAt: new Date(), lastCheckedAt: new Date(),
                nextCheckAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
              },
            }).exec();
          }
          const providerResult = {
            ...providerDetail,
            source,
            redirectSlug: providerDetail._resolvedSlug,
            availability: {
              status: 'available', label: 'Đã có bản phát', source,
              resolvedSlug: providerDetail._resolvedSlug,
            },
          };
          this.setUpcomingCache(cacheKey, providerResult);
          return providerResult;
        }
      } catch {
        // Chưa có trên nguồn này là trạng thái bình thường đối với phim chưa công chiếu.
      }
    }

    const englishVideos = englishVideosResponse?.ok ? await englishVideosResponse.json() : { results: [] };
    const availableVideos = [
      ...(item.videos?.results || []),
      ...(englishVideos.results || englishVideos.videos?.results || []),
    ];
    const trailer = availableVideos.find(
      (video: any) => video.site === 'YouTube' && video.type === 'Trailer',
    ) || availableVideos.find((video: any) => video.site === 'YouTube');
    const slug = `tmdb-${item.id}-${this.generateSlug(item.original_title || item.title || 'movie')}`;
    const movie = {
      _id: `tmdb-${item.id}`,
      name: item.title || item.original_title,
      origin_name: item.original_title || item.title,
      slug,
      content: item.overview || 'Nội dung phim đang được cập nhật.',
      type: 'single',
      status: 'trailer',
      thumb_url: item.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
        : `https://image.tmdb.org/t/p/w780${item.poster_path}`,
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : '',
      time: item.runtime ? `${item.runtime} phút` : 'Chưa công bố',
      episode_current: 'Trailer',
      episode_total: '0',
      year: Number(String(releaseDate || '').slice(0, 4)) || new Date().getFullYear(),
      release_date: releaseDate,
      trailer_url: trailer ? `https://www.youtube.com/embed/${trailer.key}` : '',
      actor: [],
      director: [],
      category: (item.genres || []).map((genre: any) => ({ name: genre.name, slug: this.generateSlug(genre.name) })),
      country: (item.production_countries || []).map((country: any) => ({ name: country.name, slug: country.iso_3166_1?.toLowerCase() })),
      episodes: [],
      tmdb: { id: String(item.id), type: 'movie', vote_average: item.vote_average || 0 },
    };
    if (this.movieReleaseModel) {
      const metadata = this.mapTmdbReleaseItem(item);
      await this.movieReleaseModel.updateOne(
        { tmdbId },
        { $set: metadata, $setOnInsert: { playbackStatus: 'unavailable', nextCheckAt: new Date() } },
        { upsert: true },
      ).exec();
    }
    const data = {
      status: true,
      source: 'tmdb',
      movie: { ...movie, availability: this.toReleaseAvailability(releaseRecord) },
      episodes: [],
      availability: this.toReleaseAvailability(releaseRecord),
    };
    this.setUpcomingCache(cacheKey, data);
    return data;
  }

  async getUpcomingReminderStatus(userId: string, tmdbId: string) {
    if (!/^\d+$/.test(tmdbId)) throw new BadRequestException('TMDB ID không hợp lệ');
    if (!this.userModel) return { active: false };
    const user = await this.userModel.findById(userId).select('upcomingReminders').lean().exec();
    const reminder = (user?.upcomingReminders || []).find((item: any) => String(item.tmdbId) === tmdbId);
    return { active: Boolean(reminder), reminder: reminder || null };
  }

  async toggleUpcomingReminder(
    userId: string,
    tmdbId: string,
    input: { slug?: string; movieName?: string; originName?: string; releaseDate?: string; year?: number },
  ) {
    if (!/^\d+$/.test(tmdbId)) throw new BadRequestException('TMDB ID không hợp lệ');
    if (!this.userModel) throw new BadRequestException('Tính năng nhắc phim chưa sẵn sàng');
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    user.upcomingReminders ||= [];
    const index = user.upcomingReminders.findIndex((item: any) => String(item.tmdbId) === tmdbId);
    if (index >= 0) {
      user.upcomingReminders.splice(index, 1);
      await user.save();
      return { active: false };
    }
    if (user.upcomingReminders.length >= 50) {
      throw new BadRequestException('Bạn chỉ có thể đặt tối đa 50 lời nhắc phim');
    }

    const movieName = String(input.movieName || '').trim();
    if (!movieName) throw new BadRequestException('Tên phim không hợp lệ');
    user.upcomingReminders.push({
      tmdbId,
      slug: String(input.slug || `tmdb-${tmdbId}`).trim(),
      movieName,
      originName: String(input.originName || '').trim(),
      releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(String(input.releaseDate || '')) ? input.releaseDate : '',
      year: Number(input.year) || undefined,
      createdAt: new Date(),
    });
    await user.save();
    return { active: true };
  }

  async scanUpcomingReminders(): Promise<{ checked: number; available: number }> {
    if (!this.userModel || !this.notificationsService) return { checked: 0, available: 0 };
    const userModel = this.userModel;
    const notificationsService = this.notificationsService;
    const users = await userModel
      .find({ 'upcomingReminders.0': { $exists: true } })
      .select('_id upcomingReminders')
      .limit(100)
      .lean()
      .exec();
    const uniqueReminders = new Map<string, any>();
    for (const user of users) {
      for (const reminder of user.upcomingReminders || []) {
        const key = String(reminder.tmdbId || '');
        if (key && !reminder.availableNotifiedAt && !uniqueReminders.has(key)) uniqueReminders.set(key, reminder);
      }
    }

    const now = new Date();
    for (const user of users) {
      for (const reminder of user.upcomingReminders || []) {
        if (!reminder.releaseNotifiedAt && reminder.releaseDate) {
          const releaseTime = new Date(`${reminder.releaseDate}T00:00:00+07:00`).getTime();
          if (Number.isFinite(releaseTime) && releaseTime <= now.getTime()) {
            const result = await userModel.updateOne(
              { _id: user._id, upcomingReminders: { $elemMatch: { tmdbId: reminder.tmdbId, releaseNotifiedAt: { $exists: false } } } },
              { $set: { 'upcomingReminders.$.releaseNotifiedAt': now } },
            ).exec();
            if (result.modifiedCount > 0) {
              await notificationsService.createUserNotification({
                userId: String(user._id),
                type: 'upcoming_release',
                title: `${reminder.movieName} đến ngày công chiếu`,
                content: 'Phim bạn đặt nhắc đã đến lịch phát hành. DlowPhim đang kiểm tra nguồn xem.',
                link: `/movie/${reminder.slug}`,
                dedupKey: `upcoming-release:${reminder.tmdbId}`,
              });
            }
          }
        }
      }
    }

    let available = 0;
    const remindersToCheck = Array.from(uniqueReminders.values()).slice(0, 30);
    const processReminder = async (reminder: any) => {
      try {
        let detail: any = null;
        for (const source of ['active', 'ophim']) {
          const candidate = await this.resolveMovieDetailAcrossSources(
            reminder.slug,
            source,
            reminder.movieName,
            reminder.originName,
            reminder.year,
            reminder.tmdbId,
          );
          const candidatePlayable = (candidate?.episodes || []).some((server: any) =>
            (server?.server_data || []).some((episode: any) => episode?.link_m3u8 || episode?.link_embed),
          );
          if (candidatePlayable) {
            detail = candidate;
            break;
          }
        }
        const playable = (detail?.episodes || []).some((server: any) =>
          (server?.server_data || []).some((episode: any) => episode?.link_m3u8 || episode?.link_embed),
        );
        if (!playable || !detail?._resolvedSlug) return;
        available += 1;
        for (const user of users) {
          const userReminder = (user.upcomingReminders || []).find(
            (item: any) => String(item.tmdbId) === String(reminder.tmdbId) && !item.availableNotifiedAt,
          );
          if (!userReminder) continue;
          const result = await userModel.updateOne(
            { _id: user._id, upcomingReminders: { $elemMatch: { tmdbId: reminder.tmdbId, availableNotifiedAt: { $exists: false } } } },
            { $set: { 'upcomingReminders.$.availableNotifiedAt': now, 'upcomingReminders.$.resolvedSlug': detail._resolvedSlug } },
          ).exec();
          if (result.modifiedCount > 0) {
            await notificationsService.createUserNotification({
              userId: String(user._id),
              type: 'movie_available',
              title: `${reminder.movieName} đã có bản xem`,
              content: 'Phim bạn đặt nhắc hiện đã có nguồn phát trên DlowPhim.',
              link: `/movie/${detail._resolvedSlug}`,
              dedupKey: `movie-available:${reminder.tmdbId}`,
            });
          }
        }
      } catch {
        // Nguồn chưa có phim hoặc tạm gián đoạn; vòng quét sau sẽ thử lại.
      }
    };
    let reminderCursor = 0;
    const workers = Array.from({ length: Math.min(3, remindersToCheck.length) }, async () => {
      while (reminderCursor < remindersToCheck.length) {
        const reminder = remindersToCheck[reminderCursor++];
        await processReminder(reminder);
      }
    });
    await Promise.all(workers);
    return { checked: remindersToCheck.length, available };
  }

  // ─── MOVIE LOGO PROXY CACHE ───
  async getMovieLogo(slug: string, title?: string, tmdbId?: string, tmdbType?: string, originTitle?: string): Promise<any> {
    const trimmedSlug = slug.trim().toLowerCase();
    
    // 1. Dùng lại cache khi đã có metadata và backdrop ngang chuẩn từ TMDB.
    const existing = await this.movieLogoModel.findOne({ slug: trimmedSlug }).exec();
    if (
      existing &&
      existing.backdropUrl &&
      (existing as any).tmdbTitle
    ) {
      return {
        logoUrl: existing.logoUrl,
        backdropUrl: (existing as any).backdropUrl || '',
        posterUrl: (existing as any).posterUrl || '',
        tmdbTitle: (existing as any).tmdbTitle || '',
        tmdbOriginalTitle: (existing as any).tmdbOriginalTitle || '',
        tmdbId: (existing as any).tmdbId || '',
        tmdbType: (existing as any).tmdbType || 'movie',
      };
    }

    // 2. Nếu metadata/backdrop chưa đủ thì lấy lại từ TMDB.
    const hasCurrentTmdbMetadata = Boolean((existing as any)?.tmdbTitle);
    let logoUrl = '';
    // Cache cũ từng ghi poster dọc vào backdropUrl. Chỉ tái sử dụng backdrop
    // sau khi record đã được chuẩn hóa bằng metadata TMDB mới.
    let backdropUrl = hasCurrentTmdbMetadata ? (existing as any)?.backdropUrl || '' : '';
    let posterUrl = (existing as any)?.posterUrl || '';
    let tmdbTitle = (existing as any)?.tmdbTitle || '';
    let tmdbOriginalTitle = (existing as any)?.tmdbOriginalTitle || '';
    let resolvedTmdbId = (existing as any)?.tmdbId || '';
    let resolvedTmdbType = (existing as any)?.tmdbType || 'movie';
    try {
      const settings = await this.settingsService.getSettings();
      const apiKey = settings.tmdbApiKey || '591c025bb1641315ae087330271132bc';
      
      let targetId = tmdbId;
      let targetType = tmdbType === 'tv' ? 'tv' : 'movie';

      // 2a. Nếu không có tmdbId, search TMDB theo tên (Thử danh sách từ khóa tìm kiếm thông minh)
      if (!targetId) {
        const cleanSlugQuery = slug.split('-phat-hang')[0]?.split('-phan-')[0]?.split('-season-')[0]?.replace(/-/g, ' ');
        const cleanTitleQuery = title ? title.split('(')[0]?.split('-')[0]?.trim() : '';

        const queryCandidates = Array.from(new Set([
          originTitle,
          title,
          cleanTitleQuery,
          cleanSlugQuery,
          slug.replace(/-/g, ' ')
        ])).filter((q): q is string => !!q && q.trim().length > 1);

        for (const query of queryCandidates) {
          if (targetId) break;
          try {
            const searchRes = await this.safeFetchTmdb(
              `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}`
            );
            if (searchRes && searchRes.ok) {
              const searchData = await searchRes.json();
              const firstResult = searchData.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv') || searchData.results?.[0];
              if (firstResult) {
                targetId = firstResult.id;
                targetType = firstResult.media_type === 'tv' ? 'tv' : 'movie';
                tmdbTitle = firstResult.title || firstResult.name || '';
                tmdbOriginalTitle =
                  firstResult.original_title || firstResult.original_name || '';
              }
            }
          } catch (e) {
            // thử từ khóa tiếp theo
          }
        }
      }

      if (targetId) {
        // Logo và metadata độc lập nên lấy song song để giảm thời gian cold start.
        const [logosRes, infoRes] = await Promise.all([
          this.safeFetchTmdb(
            `https://api.themoviedb.org/3/${targetType}/${targetId}/images?api_key=${apiKey}`,
          ),
          this.safeFetchTmdb(
            `https://api.themoviedb.org/3/${targetType}/${targetId}?api_key=${apiKey}&language=vi`,
          ),
        ]);
        if (logosRes && logosRes.ok) {
          const data = await logosRes.json();
          const logos = data.logos || [];
          if (logos.length > 0) {
            // Lấy tiếng Việt
            const viLogo = logos.find((l: any) => l.iso_639_1 === 'vi');
            if (viLogo) {
              logoUrl = `https://image.tmdb.org/t/p/w500${viLogo.file_path}`;
            } else {
              // Lấy tiếng Anh
              const enLogo = logos.find((l: any) => l.iso_639_1 === 'en');
              if (enLogo) {
                logoUrl = `https://image.tmdb.org/t/p/w500${enLogo.file_path}`;
              } else {
                // Lấy đầu tiên
                logoUrl = `https://image.tmdb.org/t/p/w500${logos[0].file_path}`;
              }
            }
          }
        }
        if (infoRes && infoRes.ok) {
          const infoData = await infoRes.json();
          tmdbTitle = infoData.title || infoData.name || tmdbTitle;
          tmdbOriginalTitle =
            infoData.original_title || infoData.original_name || tmdbOriginalTitle;
          resolvedTmdbId = String(infoData.id || targetId || '');
          resolvedTmdbType = targetType;
          if (infoData.backdrop_path) {
            backdropUrl = `https://image.tmdb.org/t/p/w1280${infoData.backdrop_path}`;
          }
          if (infoData.poster_path) {
            posterUrl = `https://image.tmdb.org/t/p/w500${infoData.poster_path}`;
          }
        }
      }
    } catch (err) {
      // im lặng nếu không kết nối được TMDB
    }

    // 3. Lưu vào DB để cache
    try {
      await this.movieLogoModel.findOneAndUpdate(
        { slug: trimmedSlug },
        {
          logoUrl,
          backdropUrl,
          posterUrl,
          tmdbTitle,
          tmdbOriginalTitle,
          tmdbId: resolvedTmdbId,
          tmdbType: resolvedTmdbType,
        },
        { upsert: true, returnDocument: 'after' }
      ).exec();
    } catch (saveErr) {
      // im lặng khi lưu cache lỗi
    }

    return {
      logoUrl,
      backdropUrl,
      posterUrl,
      tmdbTitle,
      tmdbOriginalTitle,
      tmdbId: resolvedTmdbId,
      tmdbType: resolvedTmdbType,
    };
  }

  // ─── GET MOVIE ACTORS & CREDITS FROM TMDB ───
  async getMovieCredits(slug: string, title?: string, tmdbId?: string, tmdbType?: string): Promise<any[]> {
    const trimmedSlug = slug.trim().toLowerCase();

    // 1. Kiểm tra cache trong DB
    try {
      const cached = await this.movieLogoModel.findOne({ slug: trimmedSlug }).exec();
      if (cached && cached.credits && cached.credits.length > 0) {
        return cached.credits;
      }
    } catch (e) {}

    let credits: any[] = [];
    try {
      const settings = await this.settingsService.getSettings();
      let apiKey = settings.tmdbApiKey && settings.tmdbApiKey.trim() ? settings.tmdbApiKey.trim() : '591c025bb1641315ae087330271132bc';

      let targetId = tmdbId ? tmdbId.trim() : '';
      let targetType = tmdbType ? tmdbType.trim() : 'movie';

      // Nếu chưa có TMDB ID, tìm kiếm qua title
      if (!targetId && title) {
        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=vi-VN`;
        const sRes = await fetch(searchUrl);
        if (sRes.ok) {
          const sData = await sRes.json();
          const match = sData.results?.[0];
          if (match) {
            targetId = match.id;
            targetType = match.media_type || 'movie';
          }
        }
      }

      if (targetId) {
        const creditsUrl = `https://api.themoviedb.org/3/${targetType}/${targetId}/credits?api_key=${apiKey}&language=vi-VN`;
        const cRes = await fetch(creditsUrl);
        if (cRes.ok) {
          const cData = await cRes.json();
          credits = (cData.cast || []).slice(0, 18).map((c: any) => ({
            id: c.id,
            name: c.name,
            character: c.character || 'Diễn viên',
            profileUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
          }));
        }
      }

      if (credits.length > 0) {
        await this.movieLogoModel.findOneAndUpdate(
          { slug: trimmedSlug },
          { credits },
          { upsert: true, returnDocument: 'after' }
        ).exec();
      }
    } catch (err: any) {
      console.warn(`[TMDB] Không thể kết nối lấy diễn viên cho "${trimmedSlug}" (Có thể bị nhà mạng chặn):`, err.message || err);
    }

    return credits;
  }

  async getMovieSchedule(input: {
    slug: string;
    title?: string;
    originTitle?: string;
    tmdbId?: string;
    tmdbType?: string;
    movieType?: string;
    movieStatus?: string;
    episodeCurrent?: string;
    episodeTotal?: string;
    releaseDate?: string;
  }): Promise<any> {
    const fallbackState = this.deriveMovieReleaseState(
      input.movieStatus,
      input.movieType,
      input.episodeCurrent,
      input.episodeTotal,
    );
    const trimmedSlug = input.slug.trim().toLowerCase();
    const cacheTtlMs = 6 * 60 * 60 * 1000;
    let cached = await this.movieLogoModel.findOne({ slug: trimmedSlug }).exec();

    if (
      cached?.scheduleUpdatedAt &&
      Date.now() - new Date(cached.scheduleUpdatedAt).getTime() < cacheTtlMs
    ) {
      return this.buildScheduleResponse(cached, fallbackState, input.releaseDate);
    }

    let targetId = input.tmdbId || (cached as any)?.tmdbId || '';
    let targetType = input.tmdbType === 'tv' || input.movieType === 'series'
      ? 'tv'
      : (cached as any)?.tmdbType || 'movie';

    if (!targetId) {
      const metadata = await this.getMovieLogo(
        input.slug,
        input.title,
        undefined,
        targetType,
        input.originTitle,
      );
      targetId = metadata.tmdbId || '';
      targetType = metadata.tmdbType || targetType;
      cached = await this.movieLogoModel.findOne({ slug: trimmedSlug }).exec();
    }

    if (!targetId) {
      return { state: fallbackState, source: 'provider', nextEpisode: null, releaseDate: input.releaseDate || '', tmdbStatus: '', updatedAt: null };
    }

    try {
      const settings = await this.settingsService.getSettings();
      const apiKey = settings.tmdbApiKey || '591c025bb1641315ae087330271132bc';
      const response = await this.safeFetchTmdb(
        `https://api.themoviedb.org/3/${targetType}/${targetId}?api_key=${apiKey}&language=vi-VN${targetType === 'movie' ? '&append_to_response=release_dates' : ''}`,
      );
      if (response?.ok) {
        const details = await response.json();
        const releaseDate = input.releaseDate || this.resolveTmdbReleaseDate(details);
        const scheduleUpdatedAt = new Date();
        const nextEpisode = details.next_episode_to_air
          ? {
              episodeNumber: details.next_episode_to_air.episode_number,
              seasonNumber: details.next_episode_to_air.season_number,
              name: details.next_episode_to_air.name || '',
              airDate: details.next_episode_to_air.air_date || '',
            }
          : null;
        await this.movieLogoModel.findOneAndUpdate(
          { slug: trimmedSlug },
          {
            tmdbId: String(details.id || targetId),
            tmdbType: targetType,
            tmdbStatus: details.status || '',
            nextEpisodeToAir: nextEpisode,
            lastAirDate: details.last_air_date || releaseDate,
            releaseDate,
            scheduleUpdatedAt,
          },
          { upsert: true, returnDocument: 'after' },
        ).exec();
        return {
          state: this.deriveTmdbReleaseState(
            details.status,
            targetType,
            fallbackState,
            releaseDate,
          ),
          source: 'tmdb',
          nextEpisode,
          releaseDate,
          tmdbStatus: details.status || '',
          updatedAt: scheduleUpdatedAt,
        };
      }
    } catch {
      // Dữ liệu nguồn phim vẫn đủ để hiển thị trạng thái khi TMDB gián đoạn.
    }

    return { state: fallbackState, source: 'provider', nextEpisode: null, releaseDate: input.releaseDate || '', tmdbStatus: '', updatedAt: null };
  }

  private buildScheduleResponse(cached: any, fallbackState: string, preferredReleaseDate = '') {
    const releaseDate = preferredReleaseDate || cached.releaseDate || '';
    return {
      state: this.deriveTmdbReleaseState(
        cached.tmdbStatus,
        cached.tmdbType,
        fallbackState,
        releaseDate,
      ),
      source: 'tmdb-cache',
      nextEpisode: cached.nextEpisodeToAir || null,
      releaseDate,
      tmdbStatus: cached.tmdbStatus || '',
      updatedAt: cached.scheduleUpdatedAt || null,
    };
  }

  private resolveTmdbReleaseDate(details: any): string {
    const regionalEntries = (details?.release_dates?.results || [])
      .find((entry: any) => entry?.iso_3166_1 === 'VN')
      ?.release_dates || [];
    const preferredType = [3, 4, 2, 1, 5, 6]
      .map((type) => regionalEntries.find((entry: any) => entry?.type === type && entry?.release_date))
      .find(Boolean);
    const regional = String(preferredType?.release_date || '').slice(0, 10);
    return regional || details?.release_date || details?.first_air_date || '';
  }

  private deriveTmdbReleaseState(
    status = '',
    type = 'movie',
    fallback = 'unknown',
    releaseDate = '',
  ) {
    if (releaseDate) {
      const releaseTime = new Date(`${releaseDate}T23:59:59Z`).getTime();
      if (Number.isFinite(releaseTime) && releaseTime > Date.now()) return 'upcoming';
    }
    const value = status.toLowerCase();
    if (/ended|canceled|released/.test(value)) return 'completed';
    if (/planned|pilot|post production/.test(value)) return 'upcoming';
    if (type === 'tv' && /returning series|in production/.test(value)) return 'airing';
    return fallback;
  }

  private deriveMovieReleaseState(
    status = '',
    type = '',
    episodeCurrent = '',
    episodeTotal = '',
  ) {
    const combined = `${status} ${episodeCurrent}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (/trailer|sap chieu|upcoming/.test(combined)) return 'upcoming';
    if (/completed|complete|hoan tat|full/.test(combined)) return 'completed';

    const current = Number((episodeCurrent.match(/\d+/) || [])[0]);
    const total = Number((episodeTotal.match(/\d+/) || [])[0]);
    if (current > 0 && total > 0 && current >= total) return 'completed';
    if (type === 'series' || /ongoing/.test(combined)) return 'airing';
    return 'unknown';
  }

  // ─── DYNAMIC MOVIE API PROXY CACHE ───
  private movieApiCache = new Map<string, { data: any; expiry: number }>();
  private readonly movieApiCacheMaxEntries = 500;

  async fetchOphimProxy(path: string, sourcePreference = 'active'): Promise<any> {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
      throw new BadRequestException('Đường dẫn API phim không hợp lệ');
    }

    const settings = await this.settingsService.getSettings();
    const configuredSources =
      settings.movieSources && settings.movieSources.length > 0
        ? settings.movieSources
        : [
            {
              id: 'phimapi',
              name: 'PhimAPI / KKPhim',
              domain: 'https://phimapi.com',
              crawlUrl: 'https://phimapi.com/danh-sach/phim-moi-cap-nhat',
            },
            {
              id: 'ophim',
              name: 'OPhim',
              domain: 'https://ophim1.com',
              crawlUrl: 'https://ophim1.com/danh-sach/phim-moi-cap-nhat',
            },
          ];

    const activeSource =
      configuredSources.find((source) => source.id === settings.activeMovieSourceId) ||
      configuredSources.find((source) => source.id === 'phimapi') ||
      configuredSources[0];

    let selectedSource = activeSource;
    if (sourcePreference === 'fallback') {
      selectedSource =
        configuredSources.find((source) => source.id !== activeSource.id) || activeSource;
    } else if (sourcePreference !== 'active') {
      selectedSource =
        configuredSources.find((source) => source.id === sourcePreference) || activeSource;
    }

    const baseDomain = new URL(selectedSource.domain).origin;
    let finalPath = path;
    if (selectedSource.id === 'phimapi' && finalPath.startsWith('/v1/api/phim/')) {
      finalPath = finalPath.replace('/v1/api/phim/', '/phim/');
    } else if (
      selectedSource.id === 'ophim' &&
      finalPath.startsWith('/phim/') &&
      !finalPath.startsWith('/phim-')
    ) {
      finalPath = finalPath.replace('/phim/', '/v1/api/phim/');
    }

    const now = Date.now();
    const cacheKey = `${selectedSource.id}:${finalPath}`;
    const cached = this.movieApiCache.get(cacheKey);
    let data: any = null;

    if (cached && cached.expiry > now) {
      data = JSON.parse(JSON.stringify(cached.data));
    } else {
      if (cached) this.movieApiCache.delete(cacheKey);
      for (const [key, entry] of this.movieApiCache) {
        if (entry.expiry <= now) this.movieApiCache.delete(key);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(`${baseDomain}${finalPath}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          data = {
            status: false,
            message: `Nguồn ${selectedSource.name} phản hồi lỗi ${res.status}`,
            _sourceId: selectedSource.id,
          };
        } else {
          data = await res.json();
          if (data && typeof data === 'object') data._sourceId = selectedSource.id;

          if (this.movieApiCache.size >= this.movieApiCacheMaxEntries) {
            const oldestKey = this.movieApiCache.keys().next().value as string | undefined;
            if (oldestKey) this.movieApiCache.delete(oldestKey);
          }
          this.movieApiCache.set(cacheKey, {
            data: JSON.parse(JSON.stringify(data)),
            expiry: now + 10 * 60 * 1000,
          });
        }
      } catch (error) {
        if (cached) {
          data = JSON.parse(JSON.stringify(cached.data));
        } else {
          throw error;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // ─── TRANSLATION & OVERRIDE INTERCEPTOR ───
    if (data) {
      const isDetailMatch = path.match(/^\/(?:v1\/api\/)?phim\/([^/?#]+)/);
      if (isDetailMatch) {
        const slug = isDetailMatch[1].trim().toLowerCase();
        const movie = data.data?.item || data.movie;
        if (movie) {
          // 1. Kiểm tra bản dịch/chỉnh sửa trong DB
          const override = await this.overrideModel.findOne({ slug }).exec();
          if (override) {
            if (override.customContent) movie.content = override.customContent;
            if (override.customName) movie.name = override.customName;
          } else {
            // 2. Nếu chưa có override trong DB, tự động dịch nếu là Tiếng Anh
            const content = movie.content || '';
            const hasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(content);
            if (!hasVietnamese && content.trim().length > 10) {
              const translated = await this.translateText(content);
              if (translated && translated !== content) {
                try {
                  const newOverride = new this.overrideModel({
                    slug,
                    customContent: translated,
                  });
                  await newOverride.save();
                } catch (saveErr) {
                  // Bỏ qua lỗi duplicate key nếu trùng tiến trình chạy song song
                }
                movie.content = translated;
              }
            }
          }
        }
      }
    }

    return data;
  }

  async resolveMovieDetailAcrossSources(
    slug: string,
    sourcePreference = 'fallback',
    title?: string,
    originTitle?: string,
    year?: number,
    tmdbId?: string,
  ): Promise<any> {
    const normalizeDetail = (detail: any, resolvedSlug: string) => {
      const item = detail?.data?.item || detail?.movie;
      const episodes = detail?.episodes || item?.episodes || [];
      return {
        ...detail,
        movie: detail?.movie || item,
        episodes,
        _resolvedSlug: resolvedSlug,
      };
    };
    const isPlayable = (detail: any) => {
      const normalized = normalizeDetail(detail, slug);
      return (
        (detail?.status === true || detail?.status === 'success') &&
        normalized.episodes.some((server: any) =>
          (server?.server_data || []).some(
            (episode: any) => episode?.link_m3u8 || episode?.link_embed,
          ),
        )
      );
    };

    const direct = await this.fetchOphimProxy(
      `/phim/${slug}`,
      sourcePreference,
    );
    if (isPlayable(direct)) return normalizeDetail(direct, slug);

    const keyword = String(originTitle || title || '')
      .replace(/<[^>]*>/g, '')
      .trim();
    if (!keyword) return normalizeDetail(direct, slug);

    const search = await this.fetchOphimProxy(
      `/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=12`,
      sourcePreference,
    );
    const items = search?.data?.items || search?.items || [];
    const normalizeText = (value = '') =>
      String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '');
    const normalizedTitle = normalizeText(title);
    const normalizedOriginTitle = normalizeText(originTitle);
    const expectedTmdbId = String(tmdbId || '');

    const ranked = items
      .map((item: any) => {
        let score = 0;
        const itemTmdbId = String(item?.tmdb?.id || item?.tmdb || '');
        const itemTitle = normalizeText(item?.name);
        const itemOriginTitle = normalizeText(item?.origin_name);
        const tmdbMatch = Boolean(expectedTmdbId && itemTmdbId === expectedTmdbId);
        const titleMatch = Boolean(
          (normalizedOriginTitle && (itemOriginTitle === normalizedOriginTitle || itemTitle === normalizedOriginTitle)) ||
          (normalizedTitle && (itemTitle === normalizedTitle || itemOriginTitle === normalizedTitle)),
        );
        const yearMatch = Boolean(year && Number(item?.year) === Number(year));
        if (tmdbMatch) score += 100;
        if (titleMatch) score += 70;
        if (yearMatch) score += 20;
        return { item, score, safeMatch: tmdbMatch || (titleMatch && yearMatch) };
      })
      .filter(({ item, safeMatch }: any) => item?.slug && safeMatch)
      .sort((left: any, right: any) => right.score - left.score);

    const matchedSlug = ranked[0]?.item?.slug;
    if (!matchedSlug) return normalizeDetail(direct, slug);
    const matched = await this.fetchOphimProxy(
      `/phim/${matchedSlug}`,
      sourcePreference,
    );
    return normalizeDetail(matched, matchedSlug);
  }

  async getResolvedMovieSummaries(slugs: string[]): Promise<any[]> {
    const uniqueSlugs = Array.from(
      new Set(
        (Array.isArray(slugs) ? slugs : [])
          .map((slug) => String(slug || '').trim().toLowerCase())
          .filter((slug) => /^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)),
      ),
    ).slice(0, 50);

    if (uniqueSlugs.length === 0) return [];

    const resolveOne = async (slug: string) => {
      const attempts = [
        { path: `/phim/${slug}`, source: 'active' },
        { path: `/v1/api/phim/${slug}`, source: 'active' },
        { path: `/phim/${slug}`, source: 'fallback' },
        { path: `/v1/api/phim/${slug}`, source: 'fallback' },
      ];

      for (const attempt of attempts) {
        try {
          const data = await this.fetchOphimProxy(attempt.path, attempt.source);
          const movie = data?.movie || data?.data?.item;
          if (movie?.name) {
            return {
              slug,
              resolvedSlug: movie.slug || slug,
              name: movie.name,
              origin_name: movie.origin_name || '',
              thumb_url: movie.thumb_url || movie.poster_url || '',
              poster_url: movie.poster_url || movie.thumb_url || '',
              quality: movie.quality || 'HD',
              lang: movie.lang || 'Vietsub',
              year: movie.year,
            };
          }
        } catch {
          // Continue with the other configured provider.
        }
      }

      const custom = await this.customModel.findOne({ slug }).lean().exec();
      if (!custom) return null;
      return {
        slug,
        resolvedSlug: custom.slug,
        name: custom.name,
        origin_name: custom.origin_name || '',
        thumb_url: custom.thumb_url || custom.poster_url || '',
        poster_url: custom.poster_url || custom.thumb_url || '',
        quality: custom.quality || 'HD',
        lang: custom.lang || 'Vietsub',
        year: custom.year,
      };
    };

    const results: any[] = [];
    const concurrency = Math.min(5, uniqueSlugs.length);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (cursor < uniqueSlugs.length) {
          const index = cursor++;
          const summary = await resolveOne(uniqueSlugs[index]);
          if (summary) results[index] = summary;
        }
      }),
    );

    const summaries = results.filter(Boolean);
    const artworkSlugs = Array.from(
      new Set(
        summaries.flatMap((summary) => [summary.slug, summary.resolvedSlug].filter(Boolean)),
      ),
    );
    const cachedArtwork = await this.movieLogoModel
      .find({ slug: { $in: artworkSlugs } })
      .select('slug posterUrl backdropUrl')
      .lean()
      .exec();
    const artworkBySlug = new Map(cachedArtwork.map((item) => [item.slug, item]));

    return summaries.map((summary) => {
      const artwork =
        artworkBySlug.get(summary.resolvedSlug) || artworkBySlug.get(summary.slug);
      return {
        ...summary,
        poster_url: artwork?.posterUrl || summary.poster_url,
        backdrop_url: artwork?.backdropUrl || '',
        artwork_source: artwork?.posterUrl ? 'tmdb-cache' : 'movie-api',
      };
    });
  }

  // Helper dịch tự động bằng Google Translate API miễn phí
  async translateText(text: string, to = 'vi'): Promise<string> {
    if (!text || text.trim().length === 0) return '';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) return text;
      const data = await res.json();
      if (data && data[0]) {
        return data[0].map((item: any) => item[0]).join('');
      }
    } catch (err) {
      console.error('Lỗi dịch thuật mô tả phim:', err);
    }
    return text;
  }

  // ─── MOVIE OVERRIDES (ADMIN CONTROLS) ───
  async getOverrideBySlug(slug: string): Promise<any> {
    const trimmedSlug = this.normalizeSlug(slug);
    return this.overrideModel.findOne({ slug: trimmedSlug }).lean().exec();
  }

  async createOrUpdateOverride(slug: string, data: { customContent?: string; customName?: string }): Promise<any> {
    const trimmedSlug = this.normalizeSlug(slug);
    const update: Record<string, string> = {};
    if (data.customContent !== undefined) update.customContent = this.cleanMultilineText(data.customContent, 20_000);
    if (data.customName !== undefined) update.customName = this.cleanText(data.customName, 250);
    if (!Object.keys(update).length) throw new BadRequestException('Không có nội dung chỉnh sửa');
    try {
      return await this.overrideModel.findOneAndUpdate(
        { slug: trimmedSlug },
        { $set: update, $setOnInsert: { slug: trimmedSlug } },
        { upsert: true, returnDocument: 'after', runValidators: true },
      ).exec();
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictException('Dữ liệu chỉnh sửa vừa được cập nhật, vui lòng thử lại');
      throw error;
    }
  }
}
