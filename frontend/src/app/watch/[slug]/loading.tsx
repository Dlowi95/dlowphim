export default function WatchLoading() {
  return (
    <main className="min-h-screen bg-black px-4 pb-16 pt-28 text-white md:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="h-8 w-72 animate-pulse rounded-lg bg-zinc-800" />
        <div className="aspect-video w-full animate-pulse rounded-2xl border border-zinc-900 bg-zinc-950" />
        <div className="flex gap-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-11 w-32 animate-pulse rounded-xl bg-zinc-900" />)}
        </div>
      </div>
    </main>
  );
}
