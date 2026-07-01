import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlockedMovie, BlockedMovieDocument } from './schemas/blocked-movie.schema';
import { CustomMovie, CustomMovieDocument } from './schemas/custom-movie.schema';
import { MovieLogo, MovieLogoDocument } from './schemas/movie-logo.schema';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class MoviesService {
  constructor(
    @InjectModel(BlockedMovie.name) private blockedModel: Model<BlockedMovieDocument>,
    @InjectModel(CustomMovie.name) private customModel: Model<CustomMovieDocument>,
    @InjectModel(MovieLogo.name) private movieLogoModel: Model<MovieLogoDocument>,
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
      const cached = new this.movieLogoModel({
        slug: trimmedSlug,
        logoUrl,
        backdropUrl,
        posterUrl,
      });
      await cached.save();
    } catch (saveErr) {
      console.error('Lỗi lưu cache logo vào DB:', saveErr);
    }

    return { logoUrl, backdropUrl, posterUrl };
  }

  // ─── OPHIM API PROXY CACHE ───
  private ophimCache = new Map<string, { data: any; expiry: number }>();

  async fetchOphimProxy(path: string): Promise<any> {
    const now = Date.now();
    const cached = this.ophimCache.get(path);
    if (cached && cached.expiry > now) {
      return cached.data;
    }

    // Lấy domain nguồn cào từ Settings
    let baseDomain = 'https://ophim1.com';
    try {
      const settings = await this.settingsService.getSettings();
      if (settings.movieCrawlSource) {
        const url = new URL(settings.movieCrawlSource);
        baseDomain = url.origin;
      }
    } catch (e) {
      // url không hợp lệ hoặc lỗi settings
    }

    const targetUrl = `${baseDomain}${path}`;
    try {
      const res = await fetch(targetUrl);
      if (!res.ok) {
        // Fallback về cache cũ đã hết hạn nếu có
        if (cached) return cached.data;
        throw new Error(`Failed to fetch from source: ${res.statusText}`);
      }

      const data = await res.json();
      // Cache trong 10 phút (600,000 ms)
      this.ophimCache.set(path, {
        data,
        expiry: now + 10 * 60 * 1000,
      });

      return data;
    } catch (error) {
      if (cached) return cached.data;
      throw error;
    }
  }
}
