export function HowItWorksSkeleton() {
  return (
    <section className="relative pt-8 pb-20 bg-white overflow-hidden" aria-hidden="true">
      <div className="container mx-auto px-4">
        <div className="h-10 w-3/4 max-w-md mx-auto mb-16 rounded bg-purple-100 animate-pulse" />
        <div className="max-w-3xl mx-auto mb-16 space-y-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-4/5 rounded bg-purple-100 animate-pulse" />
                <div className="h-4 w-full rounded bg-purple-50 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <div className="h-14 w-56 rounded-full bg-purple-200 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
