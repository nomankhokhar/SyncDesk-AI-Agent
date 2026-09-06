import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-32" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}
