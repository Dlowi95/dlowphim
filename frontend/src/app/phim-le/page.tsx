import type { Metadata } from "next";
import MovieCatalogPage from "@/components/discovery/MovieCatalogPage";

export const metadata: Metadata = {
  title: "Phim lẻ mới nhất | DlowPhim",
  description: "Kho phim lẻ Vietsub, thuyết minh và lồng tiếng mới cập nhật trên DlowPhim.",
};

export default function FeatureMoviesPage() {
  return <MovieCatalogPage type="phim-le" />;
}

