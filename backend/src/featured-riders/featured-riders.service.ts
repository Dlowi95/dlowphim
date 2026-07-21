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
      { name: "Gao Đỏ (Leo)", color: "#EF4444", symbol: "🦁 Sư Tử Vương (Gao Lion)", weapon: "Sư Tử Kiếm & Nanh Bách Thú", power: 98, actor: "Shishi Kakeru", description: "Bác sĩ thú y trẻ tuổi dũng cảm, mang trái tim nhiệt huyết dẫn dắt Chiến Đội Bách Thú.", imageUrl: "" },
      { name: "Gao Vàng (Eagle)", color: "#EAB308", symbol: "🦅 Đại Bàng Vương (Gao Eagle)", weapon: "Song Đoản Kiếm & Lông Vũ Tiêu", power: 94, actor: "Washio Gaku", description: "Cựu phi công không quân điềm tĩnh, linh hồn tốc độ xé gió bầu trời.", imageUrl: "" },
      { name: "Gao Xanh (Shark)", color: "#3B82F6", symbol: "🦈 Cá Mập Vương (Gao Shark)", weapon: "Song Song Dao Cá Mập", power: 92, actor: "Samezu Kai", description: "Vận động viên lướt sóng vui tính, chiến sĩ đại dương năng động sắc bén.", imageUrl: "" },
      { name: "Gao Đen (Bison)", color: "#374151", symbol: "🐃 Bò Bót Vương (Gao Bison)", weapon: "Rìu Bò Bót & Giáp Thép", power: 96, actor: "Ushigome Sotaro", description: "Vô địch vật Sumo có trái tim ấm áp, là lá chắn kiên cường bảo vệ đồng đội.", imageUrl: "" },
      { name: "Gao Trắng (Tiger)", color: "#E5E7EB", symbol: "🐅 Cọp Trắng Vương (Gao Tiger)", weapon: "Gậy Cọp Trắng & Võ Thuật", power: 90, actor: "Taiga Sae", description: "Nữ võ sĩ trẻ tinh anh, dịu dàng nhưng vô cùng quả cảm trên chiến trường.", imageUrl: "" },
      { name: "Gao Bạc (Wolf)", color: "#9CA3AF", symbol: "🐺 Sói Bạc Vương (Gao Wolf)", weapon: "Gao Hustler Rod (Gậy Bida Thần)", power: 99, actor: "Shirogane", description: "Chiến sĩ huyền thoại 1000 năm trước, mang sức mạnh mặt trăng Bạc quật ngã bóng tối.", imageUrl: "" }
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
      { name: "Cuồng Phong Đỏ", color: "#EF4444", symbol: "🦅 Diều Hâu Không Trung", weapon: "Kiếm Phong Nhẫn & Diều Hâu Nỏ", power: 95, actor: "Shane Clarke", description: "Ninja diều hâu tự do phóng khoáng, làm chủ bầu trời không trung.", imageUrl: "" },
      { name: "Cuồng Phong Vàng", color: "#EAB308", symbol: "🦁 Sư Tử Mặt Đất", weapon: "Búa Sư Tử Dũng Sĩ", power: 93, actor: "Dustin Brooks", description: "Ninja sư tử cừ khôi, đam mê tốc độ và tinh thần thượng võ.", imageUrl: "" },
      { name: "Cuồng Phong Xanh", color: "#3B82F6", symbol: "🐬 Cá Mập Đại Dương", weapon: "Súng Nước Cá Mập", power: 92, actor: "Tori Hanson", description: "Nữ ninja cá mập xinh đẹp, làm chủ dòng nước biển sâu.", imageUrl: "" },
      { name: "Hung Thần Đỏ", color: "#991B1B", symbol: "🐞 Bọ Cánh Cứng Sấm Sét", weapon: "Súng Sấm Sét Song Nòng", power: 97, actor: "Hunter Bradley", description: "Chiến sĩ bọ cánh cứng mang giáp sấm sét uy lực dũng mãnh.", imageUrl: "" },
      { name: "Hung Thần Xanh", color: "#1E3A8A", symbol: "🪲 Bọ Kìm Lôi Điện", weapon: "Búa Lôi Điện Bọ Kìm", power: 96, actor: "Blake Bradley", description: "Chiến sĩ bọ kìm làm chủ tia chớp đen huyền thoại.", imageUrl: "" }
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
      { name: "Shinken Đỏ", color: "#EF4444", symbol: "🔥 Phong Hỏa Thần Kiếm (Hỏa)", weapon: "Shinkenmaru & Sát Ma Đại Đao", power: 99, actor: "Shiba Takeru", description: "Đầu lĩnh dòng họ Shiba, chúa công Samurai mang sức mạnh ngọn lửa rực cháy.", imageUrl: "" },
      { name: "Shinken Xanh", color: "#3B82F6", symbol: "🌊 Bích Thủy Thần Kiếm (Thủy)", weapon: "Thủy Cung Cung & Cự Lưu Trung", power: 94, actor: "Ikedani Ryunosuke", description: "Trang sĩ hệ Thủy trung thành tuyệt đối, diễn viên Kabuki tài năng.", imageUrl: "" },
      { name: "Shinken Hồng", color: "#EC4899", symbol: "💨 Thiên Phong Thần Kiếm (Phong)", weapon: "Quạt Thiên Phong & Phi Đao", power: 91, actor: "Shiraishi Mako", description: "Trang sĩ hệ Phong dũng cảm, có trái tim bao la ấm áp.", imageUrl: "" },
      { name: "Shinken Lục", color: "#10B981", symbol: "🌲 Mộc Linh Thần Kiếm (Mộc)", weapon: "Mộc Linh Thương & Lao Thần", power: 93, actor: "Tani Chiaki", description: "Trang sĩ hệ Mộc trẻ tuổi, quyết tâm vượt qua giới hạn của bản thân.", imageUrl: "" },
      { name: "Shinken Vàng", color: "#EAB308", symbol: "🪨 Thổ Địa Thần Kiếm (Thổ)", weapon: "Thổ Địa Chùy Heavy Hammer", power: 92, actor: "Hanaori Kotoha", description: "Trang sĩ hệ Thổ chân thành ngây thơ, sức mạnh đại địa vững chắc.", imageUrl: "" },
      { name: "Shinken Kim", color: "#F59E0B", symbol: "✨ Quang Minh Thần Kiếm (Quang)", weapon: "Sakana-maru (Đao Cá Bột)", power: 98, actor: "Umesawa Genta", description: "Samurai ánh sáng tài hoa, người sáng tạo ra Origami mực huyền thoại.", imageUrl: "" }
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
      { name: "Deka Đỏ", color: "#EF4444", symbol: "🔴 DekaRed (Ban)", weapon: "Song Súng Magnum S.P.D", power: 97, actor: "Akaza Banban", description: "Cảnh sát tân binh máu lửa cuồng nhiệt, kỹ năng bắn súng đỉnh cao.", imageUrl: "" },
      { name: "Deka Xanh", color: "#3B82F6", symbol: "🔵 DekaBlue (Hoji)", weapon: "Súng Phân Tích Sniper", power: 95, actor: "Tomasu Hoji", description: "Chuyên gia bắn tỉa lạnh lùng, bộ óc chiến thuật xuất sắc nhất S.P.D.", imageUrl: "" },
      { name: "Deka Lục", color: "#10B981", symbol: "🟢 DekaGreen (Sen)", weapon: "Găng Tay Cảnh Sát Deka", power: 93, actor: "Enari Senichi", description: "Thám tử tư duy suy luận ngược đỉnh cao khi dốc ngược người.", imageUrl: "" },
      { name: "Deka Vàng", color: "#EAB308", symbol: "🟡 DekaYellow (Jasmine)", weapon: "Rada Tâm Linh Esper", power: 92, actor: "Maruka Reimon", description: "Cảnh sát ngoại cảm có khả năng đọc ký ức khi chạm vào vật thể.", imageUrl: "" },
      { name: "Deka Hồng", color: "#EC4899", symbol: "🩷 DekaPink (Umeko)", weapon: "Tấm Chắn Cảnh Sát Shield", power: 90, actor: "Kodou Kouume", description: "Cảnh sát ngây thơ yêu đời, chỉ huy đội hình robot chiến đấu.", imageUrl: "" },
      { name: "Deka Trắng", color: "#F3F4F6", symbol: "⚪ DekaBreak (Tetsu)", weapon: "Găng Tay Bạch Kim Vector", power: 98, actor: "Aira Tekkan", description: "Thanh tra đặc biệt từ Trụ sở Vũ trụ Tokkyuu, võ thuật vô song.", imageUrl: "" }
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
      { name: "Bouken Đỏ", color: "#EF4444", symbol: "🧭 Chief BoukenRed", weapon: "Bouken Javelin & Chùy Precious", power: 98, actor: "Akashi Satoru", description: "Đội trưởng 'Chief' huyền thoại, nhà thám hiểm mạo hiểm bất bại.", imageUrl: "" },
      { name: "Bouken Đen", color: "#374151", symbol: "🕵️ BoukenBlack", weapon: "Radial Hammer (Búa Xoay)", power: 94, actor: "Inou Masumi", description: "Thợ săn cổ vật lừng danh, cựu đạo tặc săn tìm báu vật cổ.", imageUrl: "" },
      { name: "Bouken Xanh", color: "#3B82F6", symbol: "🏎️ BoukenBlue", weapon: "Blow Knuckle (Găng Gió)", power: 93, actor: "Mogami Souta", description: "Cựu tình báo gián điệp, bậc thầy về công nghệ và đạn dược.", imageUrl: "" },
      { name: "Bouken Vàng", color: "#EAB308", symbol: "⛏️ BoukenYellow", weapon: "Bucket Scoopers (Xẻng Năng Lượng)", power: 92, actor: "Natsuki Mamiya", description: "Cô gái bí ẩn mang sức mạnh cổ đại, linh hồn yêu đời của Boukenger.", imageUrl: "" },
      { name: "Bouken Hồng", color: "#EC4899", symbol: "📡 BoukenPink", weapon: "Hydro Shooter (Súng Nước Nén)", power: 93, actor: "Nishioka Sakura", description: "Phó chỉ huy quân sự điềm tĩnh, chuyên gia phân tích dữ liệu Precious.", imageUrl: "" },
      { name: "Bouken Bạc", color: "#9CA3AF", symbol: "🛡️ BoukenSilver", weapon: "SagaSniper (Súng Săn Bạc)", power: 97, actor: "Takaoka Eiji", description: "Thợ săn quỷ tộc Ashu huyền thoại mang dòng máu bán quỷ.", imageUrl: "" }
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
      { name: "Aba Đỏ", color: "#EF4444", symbol: "🦖 Tyranno Rồng Bão Tố", weapon: "Tyranno Rod (Kiếm Khủng Long Đỏ)", power: 97, actor: "Hakua Ryoga", description: "Người cha nuôi nhân hậu, mang sức mạnh rồng bão tố Tyrannosaurus.", imageUrl: "" },
      { name: "Aba Xanh", color: "#3B82F6", symbol: "🦕 Tricera Thần Sừng", weapon: "Tricera Bunker (Giáp Song Sừng)", power: 94, actor: "Sanjyo Yukito", description: "Bác sĩ tẩm quất châm cứu tài ba, lá chắn sừng Triceratops kiên cố.", imageUrl: "" },
      { name: "Aba Vàng", color: "#EAB308", symbol: "🦅 Ptera Thần Điểu", weapon: "Ptera Daggers (Song Dao Ptera)", power: 92, actor: "Itsuki Ranru", description: "Thiên tài cơ khí xe cơ giới, nữ chiến sĩ thần điểu Pteranodon.", imageUrl: "" },
      { name: "Aba Đen", color: "#374151", symbol: "🐊 Brachio Khủng Long Cổ Dài", weapon: "Dino Commander (Thánh Kiếm)", power: 96, actor: "Asuka (Anh Hùng Dino)", description: "Chiến sĩ rồng cổ dài Brachiosaurus đến từ Trái Đất Song Sinh.", imageUrl: "" },
      { name: "Aba Trắng", color: "#E5E7EB", symbol: "🕊️ TopGealer Thần Phong", weapon: "Wing Pentact (Bút Thánh Phong)", power: 99, actor: "Nakadai Mikoto", description: "Bác sĩ thiên tài mang sức mạnh Khủng Long Trắng bá đạo gieo sầu Eviloid.", imageUrl: "" }
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
      const validSlugs = DEFAULT_SENTAI.map((s) => s.slug);
      // Xóa tất cả các document cũ hoặc lỡ tạo dư thừa không thuộc 6 slug chuẩn
      await this.riderModel.deleteMany({ slug: { $nin: validSlugs } }).exec();

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
