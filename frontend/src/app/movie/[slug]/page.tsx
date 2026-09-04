import type { Metadata } from "next";
import MovieDetailClient from "./MovieDetailClient";
import {
  getMovieMetadata,
  buildMovieMetadata,
} from "@/utils/movieMetadata";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const movie = await getMovieMetadata(params.slug);
  return buildMovieMetadata(movie, params.slug);
}

export default function MoviePage({ params }: { params: { slug: string } }) {
  return <MovieDetailClient slug={params.slug} />;
}
