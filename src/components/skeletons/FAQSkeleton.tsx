export function FAQSkeleton() {
  return (
    <section className="py-12 sm:py-16 md:py-20 bg-cream-100" aria-hidden="true">
      <div className="max-w-3xl mx-auto px-4">
        <div className="h-10 w-1/3 max-w-xs mx-auto mb-8 sm:mb-12 rounded bg-purple-100 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-purple-50 animate-pulse" />
          ))}
        </div>
      </div>
    </section>
  );
}
