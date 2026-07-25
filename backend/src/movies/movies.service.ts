import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
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

  // ─── MOVIE LOGO PROXY CACHE ───
  async getMovieLogo(slug: string, title?: string, tmdbId?: string, tmdbType?: string): Promise<any> {
    const trimmedSlug = slug.trim().toLowerCase();
    
    // 1. Kiểm tra trong DB
    const existing = await this.movieLogoModel.findOne({ slug: trimmedSlug }).exec();
    if (existing) {
      return {
        logoUrl: existing.logoUrl || '',
        backdropUrl: (existing as any).backdropUrl || '',
        posterUrl: (existing as any).posterUrl || '',
      };
    }

    // 2. Nếu chưa có, cào từ TMDB
    let logoUrl = '';
    let backdropUrl = '';
    let posterUrl = '';
    try {
      const settings = await this.settingsService.getSettings();
      const apiKey = settings.tmdbApiKey || '591c025bb1641315ae087330271132bc';
      
      let targetId = tmdbId;
      let targetType = tmdbType === 'tv' ? 'tv' : 'movie';

      // 2a. Nếu không có tmdbId, search TMDB theo tên
      if (!targetId && title) {
        const searchRes = await fetch(
          `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=vi`
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const firstResult = searchData.results?.[0];
          if (firstResult) {
            targetId = firstResult.id;
            targetType = firstResult.media_type === 'tv' ? 'tv' : 'movie';
          }
        }
      }

      if (targetId) {
        // 2b. Lấy danh sách logos
        const logosRes = await fetch(`https://api.themoviedb.org/3/${targetType}/${targetId}/images?api_key=${apiKey}`);
        if (logosRes.ok) {
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
        const infoRes = await fetch(`https://api.themoviedb.org/3/${targetType}/${targetId}?api_key=${apiKey}&language=vi`);
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          if (infoData.backdrop_path) {
            backdropUrl = `https://image.tmdb.org/t/p/w1280${infoData.backdrop_path}`;
          } else if (infoData.poster_path) {
            backdropUrl = `https://image.tmdb.org/t/p/w1280${infoData.poster_path}`;
          }
          if (infoData.poster_path) {
            posterUrl = `https://image.tmdb.org/t/p/w500${infoData.poster_path}`;
          }
        }
      }
    } catch (err) {
      console.error('Lỗi lấy thông tin từ TMDB trong MoviesService:', err);
    }

    // 3. Lưu vào DB để cache
    try {
      await this.movieLogoModel.findOneAndUpdate(
        { slug: trimmedSlug },
        { logoUrl, backdropUrl, posterUrl },
        { upsert: true, new: true }
      ).exec();
    } catch (saveErr) {
      console.error('Lỗi lưu cache logo vào DB:', saveErr.message);
    }

    return { logoUrl, backdropUrl, posterUrl };
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

  // ─── OPHIM API PROXY CACHE ───
  private ophimCache = new Map<string, { data: any; expiry: number }>();

  async fetchOphimProxy(path: string): Promise<any> {
    const now = Date.now();
    let data: any = null;
    const cached = this.ophimCache.get(path);

    if (cached && cached.expiry > now) {
      data = JSON.parse(JSON.stringify(cached.data));
    } else {
      // Lấy nguồn phim đang active từ Settings
      let baseDomain = 'https://phimapi.com'; // Default to phimapi
      let activeSourceId = 'phimapi';

      try {
        const settings = await this.settingsService.getSettings();
        if (settings.activeMovieSourceId) {
          activeSourceId = settings.activeMovieSourceId;
        }

        if (settings.movieSources && settings.movieSources.length > 0) {
          const activeSrc = settings.movieSources.find(s => s.id === activeSourceId);
          if (activeSrc) {
            baseDomain = activeSrc.domain;
          }
        } else if (settings.movieCrawlSource) {
          const url = new URL(settings.movieCrawlSource);
          baseDomain = url.origin;
        }
      } catch (e) {
        // url không hợp lệ hoặc lỗi settings
      }

      // Smart Proxy Path Rewriter
      let finalPath = path;
      if (activeSourceId === 'phimapi') {
        if (finalPath.startsWith('/v1/api/phim/')) {
          finalPath = finalPath.replace('/v1/api/phim/', '/phim/');
        }
      } else if (activeSourceId === 'ophim') {
        if (finalPath.startsWith('/phim/') && !finalPath.startsWith('/phim-')) {
          finalPath = finalPath.replace('/phim/', '/v1/api/phim/');
        }
      }

      const targetUrl = `${baseDomain}${finalPath}`;
      try {
        const res = await fetch(targetUrl);
        if (!res.ok) {
          if (cached) {
            data = JSON.parse(JSON.stringify(cached.data));
          } else {
            data = { status: false, message: `Phim không tồn tại trên nguồn cào: ${res.statusText}` };
          }
        } else {
          data = await res.json();
          this.ophimCache.set(path, {
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
