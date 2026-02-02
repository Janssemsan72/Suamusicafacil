import React, { useState, useCallback, useEffect } from 'react';
import { Star, Play, CheckCircle } from "@/lib/icons";
import useEmblaCarousel from 'embla-carousel-react';
import { Image } from "@/components/ui/Image";
import { useTestimonials } from "@/hooks/use-testimonials";

const Testimonials = React.memo(function Testimonials() {
  const { data } = useTestimonials();
  const textTestimonials = data?.text || [];
  const videoTestimonials = data?.video || [];
  
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    slidesToScroll: 1,
    containScroll: 'keepSnaps',
    dragFree: true,
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Combine video and text testimonials alternating
  const combinedItems = [];
  const maxLen = Math.max(videoTestimonials.length, textTestimonials.length);
  for (let i = 0; i < maxLen; i++) {
    if (videoTestimonials[i]) combinedItems.push(videoTestimonials[i]);
    if (textTestimonials[i]) combinedItems.push(textTestimonials[i]);
  }
  // Add remaining items
  if (videoTestimonials.length > textTestimonials.length) {
    for (let i = textTestimonials.length; i < videoTestimonials.length; i++) {
      if (videoTestimonials[i] && !combinedItems.includes(videoTestimonials[i])) {
        combinedItems.push(videoTestimonials[i]);
      }
    }
  } else {
    for (let i = videoTestimonials.length; i < textTestimonials.length; i++) {
      if (textTestimonials[i] && !combinedItems.includes(textTestimonials[i])) {
        combinedItems.push(textTestimonials[i]);
      }
    }
  }

  const scrollTo = useCallback((index: number) => {
    emblaApi?.scrollTo(index);
  }, [emblaApi]);

  return (
    <section id="testimonials" className="py-12 sm:py-16 md:py-20 bg-cream-100 overflow-hidden" aria-labelledby="testimonials-title">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <h2 id="testimonials-title" className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-brown-dark-400 text-center mb-8 sm:mb-12 tracking-tight">
          Por que mais de 3500 clientes amam{" "}
          <span className="italic">Sua Música Fácil</span>
        </h2>

        {/* Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {combinedItems.map((item, index) => (
              <div
                key={item.id}
                className="flex-[0_0_260px] sm:flex-[0_0_280px] md:flex-[0_0_300px] pr-3 sm:pr-4"
              >
                {item.type === 'video' ? (
                  // Video Card
                  <article className="bg-brown-dark-400 rounded-2xl overflow-hidden h-[340px] sm:h-[380px] relative group cursor-pointer" aria-label={`Depoimento em vídeo: ${item.song_title}`}>
                    {/* Placeholder image */}
                    <div className="absolute inset-0">
                      {!!item.thumbnail && (
                        <Image
                          src={item.thumbnail}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover"
                          sizes="(max-width: 640px) 260px, (max-width: 768px) 280px, 300px"
                        />
                      )}
                      <div className="absolute inset-0 bg-brown-dark-400/40" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white/60 text-xs text-center px-4">
                          {item.song_title}
                        </div>
                      </div>
                    </div>
                    
                    {/* Play button and info at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/60">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full bg-terracotta-700 flex items-center justify-center text-white group-hover:bg-terracotta-800 transition-colors"
                          aria-hidden="true"
                        >
                          <Play className="w-5 h-5 ml-0.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{item.song_title}</p>
                          <p className="text-white/70 text-xs">Música Personalizada</p>
                        </div>
                      </div>
                    </div>
                  </article>
                ) : (
                  // Text Card
                  <article className="bg-white rounded-2xl p-5 h-[340px] sm:h-[380px] flex flex-col shadow-sm border border-cream-200" aria-label={`Depoimento de ${item.name}`}>
                    {/* Stars and play button */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex gap-0.5" aria-label={`Avaliação: ${item.rating || 5} de 5 estrelas`}>
                        {Array.from({ length: item.rating || 5 }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-terracotta-700 fill-terracotta-700" aria-hidden="true" />
                        ))}
                      </div>
                      <div
                        className="w-8 h-8 rounded-full bg-terracotta-700 flex items-center justify-center text-white"
                        aria-hidden="true"
                      >
                        <Play className="w-4 h-4 ml-0.5" />
                      </div>
                    </div>
                    
                    {/* Content */}
                    <blockquote className="flex-1 overflow-hidden">
                      <p className="text-brown-dark-400 text-sm leading-relaxed italic">
                        {item.content}
                      </p>
                    </blockquote>
                    
                    {/* Author */}
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-cream-200">
                      <div className="w-10 h-10 rounded-full bg-cream-200 overflow-hidden flex-shrink-0">
                        <Image 
                          src={item.avatar_url || `https://i.pravatar.cc/40?u=${item.id}`}
                          alt=""
                          aria-hidden="true"
                          className="w-full h-full object-cover"
                          width={40}
                          height={40}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-brown-dark-400 text-sm truncate">{item.name}</p>
                        <p className="text-terracotta-700 text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" aria-hidden="true" />
                          <span>Cliente Verificado</span>
                        </p>
                      </div>
                    </div>
                  </article>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dots */}
        <nav className="flex justify-center gap-2 mt-8" aria-label="Navegação dos depoimentos">
          {combinedItems.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              type="button"
              className="group w-10 h-10 flex items-center justify-center rounded-full"
              aria-label={`Ir para o depoimento ${index + 1}`}
              aria-current={index === selectedIndex ? 'true' : 'false'}
            >
              <span
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index === selectedIndex
                    ? 'bg-brown-dark-400'
                    : 'bg-brown-dark-400/30 group-hover:bg-brown-dark-400/50'
                }`}
              />
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
});

export default Testimonials;
