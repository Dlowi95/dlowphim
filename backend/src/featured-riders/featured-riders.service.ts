import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeaturedRider, FeaturedRiderDocument } from './schemas/featured-rider.schema';

const DEFAULT_SENTAI = [
  {
    name: "Siêu Nhân Gao",
    originName: "Hyakujuu Sentai Gaoranger",
    slug: "sieu-nhan-gao-2011",
    themeColor: "#EF4444",
    description: "Chiến đội Bách Thú Siêu Nhân Gao chiến đấu cùng các Quỷ Tà Ma gao bảo vệ Trái Đất.",
    year: "2001",
    quality: "HD",
    order: 0,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/yrErA1GiQcZikGG3c0bITFlCO6f.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/hmhSP3LnFkuhfMmXTLzo5kV23Oz.jpg",
    gallery: [
      { name: "Gao Đỏ", color: "#EF4444", imageUrl: "" },
      { name: "Gao Vàng", color: "#EAB308", imageUrl: "" },
      { name: "Gao Xanh", color: "#3B82F6", imageUrl: "" },
      { name: "Gao Đen", color: "#374151", imageUrl: "" },
      { name: "Gao Trắng", color: "#E5E7EB", imageUrl: "" },
      { name: "Gao Bạc", color: "#9CA3AF", imageUrl: "" }
    ]
  },
  {
    name: "Siêu Nhân Cuồng Phong",
    originName: "Power Rangers Ninja Storm",
    slug: "sieu-nhan-cuong-phong",
    themeColor: "#3B82F6",
    description: "Các học viên Phong Nhẫn Tỉnh học biến hình thành Siêu Nhân Cuồng Phong chống lại Tà Ác Thang.",
    year: "2003",
    quality: "HD",
    order: 1,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/qx3SJlAp2RK656TusqKx1qEqVMW.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/i01wnWz0Z3rMATqbkAVLHEaGbNP.jpg",
    gallery: [
      { name: "Cuồng Phong Đỏ", color: "#EF4444", imageUrl: "" },
      { name: "Cuồng Phong Vàng", color: "#EAB308", imageUrl: "" },
      { name: "Cuồng Phong Xanh", color: "#3B82F6", imageUrl: "" },
      { name: "Hung Thần Đỏ", color: "#991B1B", imageUrl: "" },
      { name: "Hung Thần Xanh", color: "#1E3A8A", imageUrl: "" }
    ]
  },
  {
    name: "Chiến Đội Thần Kiếm Shinkenger",
    originName: "Samurai Sentai Shinkenger",
    slug: "chien-doi-than-kiem-shinkenger",
    themeColor: "#EAB308",
    description: "Chúa công Shiba Takeru cùng 5 trang sĩ Samurai chiến đấu với Gedoushu bảo vệ nhân gian.",
    year: "2009",
    quality: "HD",
    order: 2,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/tMAqqOU2Tz5F6uDpJuqAlRhyvhP.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/2PE9z3QAmjoMUvsKcJ0lzEwLFOc.jpg",
    gallery: [
      { name: "Shinken Đỏ", color: "#EF4444", imageUrl: "" },
      { name: "Shinken Xanh Dương", color: "#3B82F6", imageUrl: "" },
      { name: "Shinken Hồng", color: "#EC4899", imageUrl: "" },
      { name: "Shinken Lục", color: "#10B981", imageUrl: "" },
      { name: "Shinken Vàng", color: "#EAB308", imageUrl: "" },
      { name: "Shinken Kim", color: "#F59E0B", imageUrl: "" }
    ]
  },
  {
    name: "Chiến Đội Đặc Nhiệm Dekaranger",
    originName: "Tokusou Sentai Dekaranger",
    slug: "chien-doi-dac-nhiem-dekaranger",
    themeColor: "#10B981",
    description: "Biệt đội cảnh sát vũ trụ S.P.D Dekaranger truy bắt tội phạm ngoài hành tinh Alienizer.",
    year: "2004",
    quality: "HD",
    order: 3,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/vupRI1U1wFMF6hDBXRkx93A6xGE.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/hM4CnVs5wW9SI1TQkMTljsHhUE5.jpg",
    gallery: [
      { name: "Deka Đỏ", color: "#EF4444", imageUrl: "" },
      { name: "Deka Xanh", color: "#3B82F6", imageUrl: "" },
      { name: "Deka Lục", color: "#10B981", imageUrl: "" },
      { name: "Deka Vàng", color: "#EAB308", imageUrl: "" },
      { name: "Deka Hồng", color: "#EC4899", imageUrl: "" },
      { name: "Deka Trắng", color: "#F3F4F6", imageUrl: "" }
    ]
  },
  {
    name: "Chiến Đội Phiêu Lưu Boukenger",
    originName: "GoGo Sentai Boukenger",
    slug: "chien-doi-phieu-luu-boukenger",
    themeColor: "#F97316",
    description: "Chiến đội Boukenger lên đường tìm kiếm và thu hồi các cổ vật Precious đầy sức mạnh bí ẩn.",
    year: "2006",
    quality: "HD",
    order: 4,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/eUUZcEvQS03DZHaOw9vBusemlBN.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/v2wiAoSf3b0t0UmonVSYJI3yWXH.jpg",
    gallery: [
      { name: "Bouken Đỏ", color: "#EF4444", imageUrl: "" },
      { name: "Bouken Đen", color: "#374151", imageUrl: "" },
      { name: "Bouken Xanh", color: "#3B82F6", imageUrl: "" },
      { name: "Bouken Vàng", color: "#EAB308", imageUrl: "" },
      { name: "Bouken Hồng", color: "#EC4899", imageUrl: "" },
      { name: "Bouken Bạc", color: "#9CA3AF", imageUrl: "" }
    ]
  },
  {
    name: "Chiến Đội Bộc Long Abaranger",
    originName: "Bakuryu Sentai Abaranger",
    slug: "chien-doi-boc-long-abaranger",
    themeColor: "#8B5CF6",
    description: "Sức mạnh Bộc Long gầm vang cùng các chiến sĩ Abaranger ngăn chặn bộ tộc Eviloid.",
    year: "2003",
    quality: "HD",
    order: 5,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/bDoHBImQZI7ruSkxWtnkxDLra58.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/gbY5crvWFNCRgME9fu05kddHhXH.jpg",
    gallery: [
      { name: "Aba Đỏ", color: "#EF4444", imageUrl: "" },
      { name: "Aba Xanh", color: "#3B82F6", imageUrl: "" },
      { name: "Aba Vàng", color: "#EAB308", imageUrl: "" },
      { name: "Aba Đen", color: "#374151", imageUrl: "" },
      { name: "Aba Trắng", color: "#E5E7EB", imageUrl: "" }
    ]
  }
];

@Injectable()
export class FeaturedRidersService implements OnModuleInit {
  constructor(
    @InjectModel(FeaturedRider.name)
    private riderModel: Model<FeaturedRiderDocument>,
  ) {}

  async onModuleInit() {
    try {
      // Xóa các Kamen Rider cũ nếu có để chuyển sang Super Sentai
      const oldSlugs = ["hiep-si-mat-na-zi-o", "kamen-rider-decade-all-riders-super-spin-off", "hiep-si-mat-na-build", "hiep-sy-mat-na-hiem-hoa-tri-tue-nhan-tao", "sieu-nhan-the-bai", "sieu-nhan-ex-aid"];
      await this.riderModel.deleteMany({ slug: { $in: oldSlugs } }).exec();

      for (const sentai of DEFAULT_SENTAI) {
        await this.riderModel.findOneAndUpdate(
          { slug: sentai.slug },
          { $set: sentai },
          { upsert: true, new: true }
        ).exec();
      }
      console.log('[FeaturedRidersService] Super Sentai / Siêu Nhân series initialized!');
    } catch (err) {
      console.error('[FeaturedRidersService] Failed to seed Super Sentai:', err);
    }
  }

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
