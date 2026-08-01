import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlockedMovie, BlockedMovieDocument } from './schemas/blocked-movie.schema';
import { CustomMovie, CustomMovieDocument } from './schemas/custom-movie.schema';
import { MovieLogo, MovieLogoDocument } from './schemas/movie-logo.schema';
import { MovieOverride, MovieOverrideDocument } from './schemas/movie-override.schema';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class MoviesService {
  constructor(
    @InjectModel(BlockedMovie.name) private blockedModel: Model<BlockedMovieDocument>,
    @InjectModel(CustomMovie.name) private customModel: Model<CustomMovieDocument>,
    @InjectModel(MovieLogo.name) private movieLogoModel: Model<MovieLogoDocument>,
    @InjectModel(MovieOverride.name) private overrideModel: Model<MovieOverrideDocument>,
    private readonly settingsService: SystemSettingsService,
  ) {}

  // ─── BLOCKED MOVIES ───
  async getBlockedMovies(): Promise<any[]> {
    return this.blockedModel.find().sort({ createdAt: -1 }).exec();
  }

  async isMovieBlocked(slug: string): Promise<boolean> {
    const found = await this.blockedModel.findOne({ slug }).exec();
    return !!found;
  }

  async blockMovie(slug: string, title?: string, reason?: string): Promise<any> {
    const trimmedSlug = slug.trim().toLowerCase();
    const existing = await this.blockedModel.findOne({ slug: trimmedSlug }).exec();
    if (existing) {
      throw new ConflictException('Phim này đã bị chặn từ trước');
    }
    const created = new this.blockedModel({
      slug: trimmedSlug,
      title: title || slug,
      reason: reason || 'Vi phạm bản quyền hoặc yêu cầu gỡ bỏ',
    });
    return created.save();
  }

  async unblockMovie(slug: string): Promise<{ success: boolean }> {
    const trimmedSlug = slug.trim().toLowerCase();
    const result = await this.blockedModel.deleteOne({ slug: trimmedSlug }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy phim này trong danh sách chặn');
    }
    return { success: true };
  }

  // ─── CUSTOM MOVIES ───
  async getCustomMovies(search?: string): Promise<any[]> {
    const filter: any = {};
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { origin_name: new RegExp(search, 'i') },
        { slug: new RegExp(search, 'i') },
      ];
    }
    return this.customModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async getCustomMovieBySlug(slug: string): Promise<any> {
    const trimmedSlug = slug.trim().toLowerCase();
    const found = await this.customModel.findOne({ slug: trimmedSlug }).exec();
    if (!found) {
      throw new NotFoundException('Không tìm thấy phim tự đăng này');
    }
    return found;
  }

  async createCustomMovie(dto: any): Promise<any> {
    const slug = dto.slug ? dto.slug.trim().toLowerCase() : this.generateSlug(dto.name);
    const existing = await this.customModel.findOne({ slug }).exec();
    if (existing) {
      throw new ConflictException('Slug phim này đã tồn tại');
    }
    
    // check if it's currently blocked
    const isBlocked = await this.isMovieBlocked(slug);
    if (isBlocked) {
      throw new ConflictException('Slug phim này đang nằm trong danh sách chặn');
    }

    const created = new this.customModel({
      ...dto,
      slug,
    });
    return created.save();
  }

  async updateCustomMovie(id: string, dto: any): Promise<any> {
    const existing = await this.customModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Không tìm thấy phim cần cập nhật');
    }

    if (dto.slug) {
      const slug = dto.slug.trim().toLowerCase();
      if (slug !== existing.slug) {
        const duplicate = await this.customModel.findOne({ slug }).exec();
        if (duplicate) {
          throw new ConflictException('Slug phim này đã tồn tại ở phim khác');
        }
      }
    }

    return this.customModel.findByIdAndUpdate(id, dto, { new: true }).exec();
  }

  async deleteCustomMovie(id: string): Promise<{ success: boolean }> {
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
        // 2b. Lấy danh sách logos
        const logosRes = await this.safeFetchTmdb(`https://api.themoviedb.org/3/${targetType}/${targetId}/images?api_key=${apiKey}`);
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

        // 2c. Lấy chi tiết phim từ TMDB để lấy backdrop & poster
        const infoRes = await this.safeFetchTmdb(`https://api.themoviedb.org/3/${targetType}/${targetId}?api_key=${apiKey}&language=vi`);
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
    const trimmedSlug = slug.trim().toLowerCase();
    return this.overrideModel.findOne({ slug: trimmedSlug }).exec();
  }

  async createOrUpdateOverride(slug: string, data: { customContent?: string; customName?: string }): Promise<any> {
    const trimmedSlug = slug.trim().toLowerCase();
    let found = await this.overrideModel.findOne({ slug: trimmedSlug }).exec();
    if (found) {
      if (data.customContent !== undefined) found.customContent = data.customContent;
      if (data.customName !== undefined) found.customName = data.customName;
      return found.save();
    } else {
      const created = new this.overrideModel({
        slug: trimmedSlug,
        customContent: data.customContent || '',
        customName: data.customName || '',
      });
      return created.save();
    }
  }
}
