export function FooterSkeleton() {
  return (
    <footer className="bg-cream-200 pt-4 sm:pt-6 pb-12 sm:pb-16" aria-hidden="true">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-24 w-48 mx-auto mb-8 rounded bg-purple-100 animate-pulse" />
        <div className="h-4 w-3/4 max-w-xl mx-auto mb-10 rounded bg-purple-50 animate-pulse" />
        <div className="flex flex-wrap justify-center gap-8 sm:gap-12 mb-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-16 rounded bg-purple-100 animate-pulse" />
              <div className="h-3 w-24 rounded bg-purple-50 animate-pulse" />
              <div className="h-3 w-32 rounded bg-purple-50 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-px bg-cream-300 mb-6" />
        <div className="h-4 w-48 mx-auto rounded bg-purple-50 animate-pulse" />
      </div>
    </footer>
  );
}
