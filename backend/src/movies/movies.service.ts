import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlockedMovie, BlockedMovieDocument } from './schemas/blocked-movie.schema';
import { CustomMovie, CustomMovieDocument } from './schemas/custom-movie.schema';

@Injectable()
export class MoviesService {
  constructor(
    @InjectModel(BlockedMovie.name) private blockedModel: Model<BlockedMovieDocument>,
    @InjectModel(CustomMovie.name) private customModel: Model<CustomMovieDocument>,
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
}
