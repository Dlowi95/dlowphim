export default function HistoryLoading() {
  return (
    <main className="min-h-screen bg-black px-6 pb-16 pt-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 h-9 w-64 animate-pulse rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="space-y-3">
              <div className="aspect-[2/3] animate-pulse rounded-2xl bg-zinc-900" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-900" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
