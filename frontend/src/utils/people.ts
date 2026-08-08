export interface PersonResult {
  id: string;
  name: string;
  originalName: string;
  profileUrl: string | null;
  department: string;
  knownFor: string[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function searchPeople(
  query: string,
  page = 1,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${API_URL}/movies/people/search?query=${encodeURIComponent(query.trim())}&page=${page}`,
    { signal },
  );
  if (!response.ok) throw new Error("Không thể tìm diễn viên lúc này");
  return response.json() as Promise<{
    items: PersonResult[];
    page: number;
    totalPages: number;
    totalItems: number;
  }>;
}

