import type { ReactElement } from 'react';

export default function AdminLoading(): ReactElement {
  return (
    <div className="bg-background min-h-dvh">
      <div className="flex h-16 items-center border-b px-6">
        <div className="bg-muted h-5 w-32 animate-pulse rounded" />
      </div>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-6 py-6">
        <div className="space-y-2">
          <div className="bg-muted h-7 w-48 animate-pulse rounded" />
          <div className="bg-muted/60 h-4 w-72 animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card rounded-lg border p-5 shadow-sm">
              <div className="bg-muted mb-2 h-3 w-16 animate-pulse rounded" />
              <div className="bg-muted h-9 w-20 animate-pulse rounded" />
            </div>
          ))}
        </div>
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="bg-muted h-8 w-24 animate-pulse rounded" />
                <div className="bg-muted/60 h-8 flex-1 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
