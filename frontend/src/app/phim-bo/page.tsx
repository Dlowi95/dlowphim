import type { Metadata } from "next";
import MovieCatalogPage from "@/components/discovery/MovieCatalogPage";

export const metadata: Metadata = {
  title: "Phim bộ mới nhất | DlowPhim",
  description: "Kho phim bộ Vietsub, thuyết minh và lồng tiếng mới cập nhật trên DlowPhim.",
};

export default function SeriesMoviesPage() {
  return <MovieCatalogPage type="phim-bo" />;
}

