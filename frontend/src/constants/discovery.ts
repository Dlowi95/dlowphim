export const GENRES = [
  { name: "Chính kịch", slug: "chinh-kich" },
  { name: "Tâm lý", slug: "tam-ly" },
  { name: "Hài hước", slug: "hai-huoc" },
  { name: "Tài liệu", slug: "tai-lieu" },
  { name: "Khoa học", slug: "khoa-hoc" },
  { name: "Bí ẩn", slug: "bi-an" },
  { name: "Phiêu lưu", slug: "phieu-luu" },
  { name: "Gia đình", slug: "gia-dinh" },
  { name: "Tình cảm", slug: "tinh-cam" },
  { name: "Hành động", slug: "hanh-dong" },
  { name: "Võ thuật", slug: "vo-thuat" },
  { name: "Hoạt hình", slug: "hoat-hinh" },
  { name: "Cổ trang", slug: "co-trang" },
  { name: "Hình sự", slug: "hinh-su" },
  { name: "Kinh dị", slug: "kinh-di" },
  { name: "Chiếu rạp", slug: "phim-chieu-rap" },
] as const;

export const COUNTRIES = [
  { name: "Trung Quốc", slug: "trung-quoc" },
  { name: "Hàn Quốc", slug: "han-quoc" },
  { name: "Nhật Bản", slug: "nhat-ban" },
  { name: "Thái Lan", slug: "thai-lan" },
  { name: "Việt Nam", slug: "viet-nam" },
  { name: "Âu Mỹ", slug: "au-my" },
  { name: "Mỹ", slug: "my" },
  { name: "Ấn Độ", slug: "an-do" },
  { name: "Hồng Kông", slug: "hong-kong" },
  { name: "Đài Loan", slug: "tai-wan" },
] as const;

export const getDiscoveryName = (
  type: "genre" | "country",
  slug: string,
) => (type === "genre" ? GENRES : COUNTRIES).find((item) => item.slug === slug)?.name || slug;

