type SectionSkeletonProps = {
  rows?: number;
};

export function SectionSkeleton({ rows = 1 }: SectionSkeletonProps) {
  return (
    <div className="grid gap-6">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-[420px] animate-pulse rounded-[var(--radius-panel)] border border-[var(--border-muted)] bg-[rgba(255,255,255,0.02)]"
        />
      ))}
    </div>
  );
}
