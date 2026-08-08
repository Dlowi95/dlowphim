import MovieDiscoveryPage from "@/components/discovery/MovieDiscoveryPage";
import { getDiscoveryName } from "@/constants/discovery";
import type { Metadata } from "next";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const name = getDiscoveryName("country", params.slug);
  return {
    title: `Phim ${name} mới nhất | DlowPhim`,
    description: `Tuyển tập phim ${name} mới cập nhật, chất lượng cao trên DlowPhim.`,
  };
}

export default function CountryPage({ params }: { params: { slug: string } }) {
  return <MovieDiscoveryPage kind="country" slug={params.slug} label={getDiscoveryName("country", params.slug)} />;
}
