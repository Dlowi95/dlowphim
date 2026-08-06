export default function MovieLoading() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="relative h-[440px] overflow-hidden bg-zinc-950 sm:h-[500px] lg:h-[65vh] lg:max-h-[700px]">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-7xl items-end gap-8 px-6 pb-5">
          <div className="hidden w-[320px] shrink-0 lg:block" />
          <div className="w-full max-w-2xl space-y-4">
            <div className="h-10 w-3/4 animate-pulse rounded-lg bg-zinc-800" />
            <div className="h-5 w-2/5 animate-pulse rounded bg-zinc-800/80" />
            <div className="flex gap-2">
              {[1, 2, 3].map((item) => <div key={item} className="h-7 w-20 animate-pulse rounded-full bg-zinc-800" />)}
            </div>
            <div className="h-16 w-full animate-pulse rounded-xl bg-zinc-900" />
          </div>
        </div>
      </div>
    </main>
  );
}
