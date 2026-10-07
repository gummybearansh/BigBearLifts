import { Skeleton } from "@/components/ui/skeleton";

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 rounded-none border-b border-border last:border-b-0" />
      ))}
    </div>
  );
}
