import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from './schemas/banner.schema';

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<BannerDocument>,
  ) {}

  // Get active banners for public homepage
  async findAllActive(): Promise<Banner[]> {
    return this.bannerModel
      .find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  // Get all banners for admin panel
  async findAllForAdmin(): Promise<Banner[]> {
    return this.bannerModel
      .find()
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  // Create a new banner
  async create(createBannerDto: any): Promise<Banner> {
    const newBanner = new this.bannerModel(createBannerDto);
    return newBanner.save();
  }

  // Update a banner
  async update(id: string, updateBannerDto: any): Promise<Banner> {
    const updatedBanner = await this.bannerModel
      .findByIdAndUpdate(id, updateBannerDto, { new: true })
      .exec();
    
    if (!updatedBanner) {
      throw new NotFoundException('Không tìm thấy banner này');
    }
    return updatedBanner;
  }

  // Delete a banner
  async delete(id: string): Promise<any> {
    const result = await this.bannerModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy banner này');
    }
    return { message: 'Xóa banner thành công' };
  }
}
