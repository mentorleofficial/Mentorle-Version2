import { Skeleton } from "@/components/ui/skeleton";

const RouteFallback = () => (
  <div className="min-h-screen p-6 space-y-4 bg-background">
    <Skeleton className="h-10 w-48" />
    <Skeleton className="h-4 w-64" />
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-8">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  </div>
);

export default RouteFallback;
