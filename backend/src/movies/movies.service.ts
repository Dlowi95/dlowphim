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

@Injectable()
export class MoviesService {
  private readonly upcomingCache = new Map<string, { data: any; expiry: number }>();
  private readonly peopleCache = new Map<string, { data: any; expiry: number }>();
  private readonly catalogCache = new Map<string, { data: any; expiry: number }>();
  private readonly upcomingCacheTtlMs = 6 * 60 * 60 * 1000;
  private readonly upcomingCacheMaxEntries = 200;
  private readonly peopleCacheTtlMs = 60 * 60 * 1000;
  private readonly peopleCacheMaxEntries = 200;
  private readonly catalogCacheTtlMs = 10 * 60 * 1000;
  private readonly catalogCacheMaxEntries = 300;

  constructor(
    @InjectModel(BlockedMovie.name) private blockedModel: Model<BlockedMovieDocument>,
    @InjectModel(CustomMovie.name) private customModel: Model<CustomMovieDocument>,
    @InjectModel(MovieLogo.name) private movieLogoModel: Model<MovieLogoDocument>,
    @InjectModel(MovieOverride.name) private overrideModel: Model<MovieOverrideDocument>,
    private readonly settingsService: SystemSettingsService,
    @Optional() @InjectModel(User.name) private readonly userModel?: Model<UserDocument>,
    @Optional() private readonly notificationsService?: NotificationsService,
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
    if (/^https?:\/\//i.test(image)) return image;
    const path = image.replace(/^\/+/, '');
    if (imageBase) return `${imageBase.replace(/\/+$/, '')}/${path}`;
    if (sourceId === 'ophim') return `https://img.ophim.live/uploads/movies/${path}`;
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
    let payload: any = null;
    let firstEmptyPayload: any = null;
    let firstEmptyWasFallback = false;
    let activeFailure = false;
    let fallbackUsed = false;
    let fallbackReason: 'source-error' | 'empty-result' | null = null;

    for (const sourcePreference of ['active', 'fallback']) {
      try {
        const candidate = await this.fetchOphimProxy(path, sourcePreference);
        if (!this.isCatalogPayloadSuccessful(candidate)) {
          if (sourcePreference === 'active') activeFailure = true;
          continue;
        }
        const candidateItems = this.getCatalogItems(candidate);
        if (candidateItems.length > 0) {
          payload = candidate;
          fallbackUsed = sourcePreference === 'fallback';
          fallbackReason = fallbackUsed ? (activeFailure ? 'source-error' : 'empty-result') : null;
          break;
        }
        if (!firstEmptyPayload) {
          firstEmptyPayload = candidate;
          firstEmptyWasFallback = sourcePreference === 'fallback';
        }
      } catch {
        if (sourcePreference === 'active') activeFailure = true;
      }
    }

    payload ??= firstEmptyPayload;
    if (!payload) {
      throw new ServiceUnavailableException('Cả hai máy chủ phim đang tạm gián đoạn. Vui lòng thử lại sau ít phút.');
    }
    if (firstEmptyWasFallback) {
      fallbackUsed = true;
      fallbackReason = activeFailure ? 'source-error' : 'empty-result';
    }

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
      cache: { hit: false, ttlSeconds },
    };
    this.setCatalogCache(cacheKey, data, ttlSeconds * 1000);
    return data;
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
    const items = (payload.results || [])
      .filter((item: any) => item?.id && (item.poster_path || item.backdrop_path))
      .map((item: any) => ({
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
      }));
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
    for (const source of ['active', 'ophim']) {
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
          const providerResult = { ...providerDetail, source, redirectSlug: providerDetail._resolvedSlug };
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
    const data = { status: true, source: 'tmdb', movie, episodes: [] };
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
        if (expectedTmdbId && itemTmdbId === expectedTmdbId) score += 100;
        if (normalizedOriginTitle && itemOriginTitle === normalizedOriginTitle) score += 70;
        if (normalizedTitle && itemTitle === normalizedTitle) score += 60;
        if (year && Number(item?.year) === year) score += 15;
        return { item, score };
      })
      .filter(({ item, score }: any) => item?.slug && score >= 60)
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
