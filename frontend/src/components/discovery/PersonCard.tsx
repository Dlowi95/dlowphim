"use client";

import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PersonResult } from "@/utils/people";

export default function PersonCard({ person }: { person: PersonResult }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/dien-vien/${person.id}`)}
      className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-950 p-3 text-left transition hover:border-pink-500/50 hover:bg-zinc-900"
    >
      <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
        {person.profileUrl ? (
          <img src={person.profileUrl} alt={person.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600"><UserRound size={26} /></div>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-bold text-white transition group-hover:text-pink-400">{person.name}</h3>
        {person.originalName && person.originalName !== person.name && (
          <p className="truncate text-xs text-zinc-500">{person.originalName}</p>
        )}
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">
          {person.knownFor.length ? person.knownFor.join(" • ") : "Xem danh sách phim đã tham gia"}
        </p>
      </div>
    </button>
  );
}

