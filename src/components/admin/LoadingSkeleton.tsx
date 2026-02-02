import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface LoadingSkeletonProps {
  rows?: number;
  showStats?: boolean;
}

export function LoadingSkeleton({ rows = 5, showStats = true }: LoadingSkeletonProps) {
  return (
    <div className="container mx-auto p-2 md:p-6 space-y-2 md:space-y-6">
      {showStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="admin-card-compact relative overflow-hidden border-2">
              <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-2 md:p-6">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent className="p-2 pt-0 md:p-6 md:pt-0">
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <Card className="admin-card-compact">
        <CardHeader className="p-2 md:p-6 pb-1 md:pb-2">
          <div className="h-6 w-32 bg-muted animate-pulse rounded mb-4" />
          <div className="h-10 w-full bg-muted animate-pulse rounded mb-4" />
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          </div>
        </CardHeader>
        <CardContent className="p-2 pt-0 md:p-6 md:pt-0">
          <div className="space-y-2 md:space-y-4">
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col md:flex-row items-start justify-between p-2 md:p-4 border rounded-lg gap-2 md:gap-3"
              >
                <div className="space-y-2 flex-1 w-full">
                  <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


