import MovieDiscoveryPage from "@/components/discovery/MovieDiscoveryPage";
import { getDiscoveryName } from "@/constants/discovery";
import type { Metadata } from "next";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const name = getDiscoveryName("genre", params.slug);
  return {
    title: `Phim ${name} hay nhất | DlowPhim`,
    description: `Khám phá phim ${name} mới cập nhật, Vietsub và lồng tiếng trên DlowPhim.`,
  };
}

export default function GenrePage({ params }: { params: { slug: string } }) {
  return <MovieDiscoveryPage kind="genre" slug={params.slug} label={getDiscoveryName("genre", params.slug)} />;
}
