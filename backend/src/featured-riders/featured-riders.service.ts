import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeaturedRider, FeaturedRiderDocument } from './schemas/featured-rider.schema';

@Injectable()
export class FeaturedRidersService {
  constructor(
    @InjectModel(FeaturedRider.name)
    private riderModel: Model<FeaturedRiderDocument>,
  ) {}

  // ─── PUBLIC ───
  async findAllActive(): Promise<FeaturedRider[]> {
    return this.riderModel
      .find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .exec();
  }

  // ─── ADMIN ───
  async findAll(): Promise<FeaturedRider[]> {
    return this.riderModel.find().sort({ order: 1, createdAt: 1 }).exec();
  }

  async findOne(id: string): Promise<FeaturedRider> {
    const rider = await this.riderModel.findById(id).exec();
    if (!rider) throw new NotFoundException('Không tìm thấy Rider này');
    return rider;
  }

  async create(dto: Partial<FeaturedRider>): Promise<FeaturedRider> {
    // Tự động tính order nếu chưa có
    if (dto.order === undefined || dto.order === null) {
      const count = await this.riderModel.countDocuments();
      dto.order = count;
    }
    const created = new this.riderModel(dto);
    return created.save();
  }

  async update(id: string, dto: Partial<FeaturedRider>): Promise<FeaturedRider> {
    const updated = await this.riderModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy Rider này');
    return updated;
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const result = await this.riderModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy Rider này');
    }
    return { success: true };
  }

  // Cập nhật thứ tự hàng loạt (drag & drop reorder)
  async reorder(orders: { id: string; order: number }[]): Promise<{ success: boolean }> {
    await Promise.all(
      orders.map(({ id, order }) =>
        this.riderModel.findByIdAndUpdate(id, { order }).exec(),
      ),
    );
    return { success: true };
  }
}
