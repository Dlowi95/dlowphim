export default function UserAreaLoading() {
  return (
    <div className="min-h-[60vh] animate-pulse space-y-5 md:space-y-6">
      <div className="h-8 w-44 rounded-xl bg-zinc-900 md:h-9 md:w-56" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="aspect-[2/3] rounded-xl border border-zinc-900 bg-[#12131b] md:rounded-2xl" />
            <div className="h-4 w-4/5 rounded bg-zinc-900" />
            <div className="h-3 w-2/5 rounded bg-zinc-900" />
          </div>
        ))}
      </div>
    </div>
  );
}
