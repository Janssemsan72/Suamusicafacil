export function OccasionsGridSkeleton() {
  return (
    <section className="bg-purple-50 pt-8 sm:pt-10 md:pt-12 pb-16 sm:pb-20 md:pb-24" aria-hidden="true">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-10 w-4/5 max-w-2xl mx-auto mb-8 sm:mb-12 rounded bg-purple-100 animate-pulse" />
        <div className="grid grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-10 sm:mb-14">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-xl bg-purple-100 animate-pulse"
            />
          ))}
        </div>
        <div className="flex justify-center">
          <div className="h-14 w-56 rounded-full bg-purple-200 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
