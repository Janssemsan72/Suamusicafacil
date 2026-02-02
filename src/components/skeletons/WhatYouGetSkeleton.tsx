export function WhatYouGetSkeleton() {
  return (
    <section className="pt-16 sm:pt-20 md:pt-24 pb-4 bg-purple-50" aria-hidden="true">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-10 w-1/2 max-w-sm mx-auto mb-4 rounded bg-purple-100 animate-pulse" />
        <div className="h-5 w-3/4 max-w-xl mx-auto mb-8 sm:mb-12 rounded bg-purple-50 animate-pulse" />
        <div className="flex justify-center mb-10 sm:mb-14">
          <div className="w-full max-w-md aspect-video rounded-lg bg-purple-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mb-10 sm:mb-14">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-white border border-purple-100 animate-pulse" />
          ))}
        </div>
        <div className="flex justify-center">
          <div className="h-14 w-64 rounded-full bg-purple-200 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
