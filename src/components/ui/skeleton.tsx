import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/5", className)}
      {...props}
    />
  )
}

// Pre-built skeleton patterns
function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-3/4", className)} />
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-3", className)}>
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  )
}

function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-white/5 bg-white/[0.02]", className)}>
      {/* Header */}
      <div className="border-b border-white/5 px-4 py-3 flex gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "px-4 py-3 flex gap-4",
            i !== rows - 1 && "border-b border-white/5"
          )}
        >
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12 ml-auto" />
        </div>
      ))}
    </div>
  )
}

function SkeletonGraph({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-white/5 bg-[#0a0a0b] p-6", className)}>
      <div className="flex items-center justify-center h-[400px]">
        <div className="space-y-4 w-full max-w-md">
          {/* Nodes */}
          <div className="flex justify-center">
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="flex justify-center gap-8">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
          <div className="flex justify-center gap-6">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="flex justify-center gap-10">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

function SkeletonStats({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-8" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-6" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

function SkeletonTimeline({ events = 5, className }: { events?: number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-white/5 bg-white/[0.02]", className)}>
      {Array.from({ length: events }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-4 px-4 py-3",
            i !== events - 1 && "border-b border-white/5"
          )}
        >
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SkeletonDashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <SkeletonStats />

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonCard className="h-[200px]" />
        <SkeletonCard className="h-[200px]" />
      </div>

      {/* Table */}
      <SkeletonTable rows={5} />
    </div>
  )
}

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonGraph,
  SkeletonStats,
  SkeletonTimeline,
  SkeletonDashboard,
}
