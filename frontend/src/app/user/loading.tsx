export default function UserAreaLoading() {
  return (
    <div className="min-h-[60vh] animate-pulse space-y-6">
      <div className="h-9 w-56 rounded-xl bg-zinc-900" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="aspect-[2/3] rounded-2xl border border-zinc-900 bg-[#12131b]" />
            <div className="h-4 w-4/5 rounded bg-zinc-900" />
            <div className="h-3 w-2/5 rounded bg-zinc-900" />
          </div>
        ))}
      </div>
    </div>
  );
}
