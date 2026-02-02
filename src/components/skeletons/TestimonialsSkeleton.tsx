export function TestimonialsSkeleton() {
  return (
    <section className="py-12 sm:py-16 md:py-20 bg-cream-100 overflow-hidden" aria-hidden="true">
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-10 w-2/3 max-w-md mx-auto mb-12 rounded bg-purple-100 animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-[0_0_280px] h-[340px] rounded-2xl bg-purple-100 animate-pulse"
            />
          ))}
        </div>
        <div className="flex justify-center gap-2 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-purple-200 animate-pulse" />
          ))}
        </div>
      </div>
    </section>
  );
}
