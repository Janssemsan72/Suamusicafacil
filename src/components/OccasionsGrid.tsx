import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useUtmParams } from "@/hooks/useUtmParams";
import { Gift } from "@/lib/icons";
import { ASPECT_4_3 } from "@/styles/aspectRatios";
import { Image } from "@/components/ui/Image";

interface OccasionCard {
  id: string;
  label: string;
  image?: string;
  imagePosition?: string;
}

const occasions: OccasionCard[] = [
  { id: "partner", label: "Para sua Namorada(o)", image: "/images/occasions/partner.webp", imagePosition: "object-[50%_0%]" },
  { id: "children", label: "Para as Crianças", image: "/images/occasions/children.webp", imagePosition: "object-[10%_30%]" },
  { id: "loss", label: "Para a Perda", image: "/images/occasions/loss.webp", imagePosition: "object-center" },
  { id: "parents", label: "Para os Pais", image: "/images/occasions/parents.webp", imagePosition: "object-[10%_30%]" },
  { id: "yourself", label: "Para Você Mesmo", image: "/images/occasions/yourself.webp", imagePosition: "object-[10%_30%]" },
  { id: "strength", label: "Para a Força", image: "/images/occasions/strength.webp", imagePosition: "object-center" },
  { id: "healing", label: "Para a Cura", image: "/images/occasions/healing.webp", imagePosition: "object-center" },
  { id: "prayers", label: "Para as Orações", image: "/images/occasions/prayers.webp", imagePosition: "object-[10%_30%]" },
  { id: "breakthroughs", label: "Para os Avanços", image: "/images/occasions/breakthroughs.webp", imagePosition: "object-center" },
];

type OccasionsGridProps = {
  onOpenQuiz?: () => void;
};

const OccasionsGrid = React.memo(function OccasionsGrid({ onOpenQuiz }: OccasionsGridProps) {
  const { navigateWithUtms } = useUtmParams();

  const handleQuizClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenQuiz) {
      onOpenQuiz();
      return;
    }
    navigateWithUtms('/quiz');
  }, [onOpenQuiz, navigateWithUtms]);

  const handleOccasionClick = (occasionId: string) => {
    if (onOpenQuiz) {
      onOpenQuiz();
      return;
    }
    navigateWithUtms(`/quiz?occasion=${occasionId}`);
  };

  return (
    <section className="bg-purple-50 pt-8 sm:pt-10 md:pt-12 pb-16 sm:pb-20 md:pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif italic font-black text-gray-800 text-center mb-8 sm:mb-12 leading-tight tracking-tight">
          Presenteie alguém especial com uma música personalizada, ou a você mesmo!
        </h2>

        <div className="grid grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-10 sm:mb-14" role="list">
          {occasions.map((occasion) => {
            const image400 = occasion.image?.replace(/\.webp$/i, "-400w.webp");
            const image800 = occasion.image?.replace(/\.webp$/i, "-800w.webp");

            return (
              <button
                key={occasion.id}
                onClick={() => handleOccasionClick(occasion.id)}
                className={`group relative ${ASPECT_4_3} rounded-xl overflow-hidden bg-neutral-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500`}
                aria-label={`Presente para: ${occasion.label}`}
                role="listitem"
              >
                {occasion.image && image400 && image800 && (
                  <Image
                    src={image400}
                    srcSet={`${image400} 400w, ${image800} 800w`}
                    sizes="(max-width: 640px) 120px, (max-width: 1024px) 160px, 180px"
                    alt=""
                    aria-hidden="true"
                    width={400}
                    height={300}
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${occasion.imagePosition || "object-center"}`}
                  />
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                  <span className="text-white text-xs sm:text-sm md:text-base font-semibold text-center block">
                    {occasion.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <Button
            onClick={handleQuizClick}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 rounded-full shadow-md transition-all font-semibold inline-flex items-center gap-2"
          >
            <Gift className="w-5 h-5" />
            Crie minha música personalizada agora
          </Button>
        </div>
      </div>
    </section>
  );
});

export default OccasionsGrid;
