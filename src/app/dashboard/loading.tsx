export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-56 rounded-lg bg-surface-200 animate-pulse" />
      <div className="h-4 w-72 max-w-full rounded bg-surface-100 animate-pulse" />
      <div className="space-y-3 pt-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card p-5 animate-pulse space-y-2">
            <div className="h-4 bg-surface-200 rounded w-2/3" />
            <div className="h-3 bg-surface-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
