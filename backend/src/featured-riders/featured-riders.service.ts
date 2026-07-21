import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeaturedRider, FeaturedRiderDocument } from './schemas/featured-rider.schema';

const DEFAULT_RIDERS = [
  {
    name: "Kamen Rider Zi-O",
    originName: "Kamen Rider Zi-O",
    slug: "hiep-si-mat-na-zi-o",
    themeColor: "#FFD700",
    description: "Chiến đấu để cứu lấy quá khứ, hiện tại và tương lai, băng qua Thời-Không gặp gỡ các Kamen Rider huyền thoại.",
    year: "2018",
    quality: "HD",
    order: 0,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/mfxCaDok0RsdjRaJ9R9lfCgLdGa.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/eZehJ9NuqALor1mkNgIUABsUxWk.jpg"
  },
  {
    name: "Kamen Rider Decade",
    originName: "Kamen Rider Decade",
    slug: "kamen-rider-decade-all-riders-super-spin-off",
    themeColor: "#FF007F",
    description: "Hành trình xuyên qua 9 thế giới Rider để ngăn chặn sự hủy diệt của đa vũ trụ.",
    year: "2009",
    quality: "HD",
    order: 1,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/sw9GXc15N85FZXAKbYkb2MeijG7.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/bwVeleD8VEhIBVEmSgBi1TZt02m.jpg"
  },
  {
    name: "Kamen Rider Build",
    originName: "Kamen Rider Build",
    slug: "hiep-si-mat-na-build",
    themeColor: "#E60012",
    description: "Nhà khoa học thiên tài Kiryu Sento cùng những phát minh độc đáo chiến đấu bảo vệ hòa bình.",
    year: "2017",
    quality: "HD",
    order: 2,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/ingl1iXZTZaKBeVJh6yYnroAvCp.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/fq7KRio375bJznT2R0YNsE3gKu0.jpg"
  },
  {
    name: "Kamen Rider Zero-One",
    originName: "Kamen Rider Zero-One",
    slug: "hiep-sy-mat-na-hiem-hoa-tri-tue-nhan-tao",
    themeColor: "#CCFF00",
    description: "Hiden Aruto - Tổng giám đốc tập đoàn AI Hiden chiến đấu vì ước mơ con người và Humagear.",
    year: "2019",
    quality: "HD",
    order: 3,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/jx3p0jcUMb4jrxQ8MbUffQ2XHpG.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/gWb3SdAoaEng1s3akEfzU81K4qY.jpg"
  },
  {
    name: "Kamen Rider Blade",
    originName: "Kamen Rider Blade",
    slug: "sieu-nhan-the-bai",
    themeColor: "#0072CE",
    description: "Cuộc chiến bài Joker đầy kịch tính của các Kamen Rider BOARD bảo vệ loài người.",
    year: "2004",
    quality: "HD",
    order: 4,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/ch3Lyr9i4V1XcZa9DjCKdUdsl5k.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/oHBfLn40NGaqJVZfJCn5sHXGox7.jpg"
  },
  {
    name: "Kamen Rider Ex-Aid",
    originName: "Kamen Rider Ex-Aid",
    slug: "sieu-nhan-ex-aid",
    themeColor: "#8A2BE2",
    description: "Bác sĩ thiên tài Emu Hojo biến hình cùng sức mạnh game cứu chữa căn bệnh virus Bugster.",
    year: "2016",
    quality: "HD",
    order: 5,
    isActive: true,
    posterUrl: "https://image.tmdb.org/t/p/w500/s7jsmtcs4VD9u7rxAuumpUBoDeO.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/w1280/rZmePFnfsVDw2qq8CaLLq9iHyEq.jpg"
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
      const count = await this.riderModel.countDocuments();
      if (count === 0) {
        console.log('[FeaturedRidersService] Seeding default HD Kamen Riders...');
        await this.riderModel.insertMany(DEFAULT_RIDERS);
      }
    } catch (err) {
      console.error('[FeaturedRidersService] Failed to seed default riders:', err);
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
