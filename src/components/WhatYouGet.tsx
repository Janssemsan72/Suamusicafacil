import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Music, FileText, Clock } from "@/lib/icons";
import VinylPlayer from "./VinylPlayer";
import { useUtmParams } from "@/hooks/useUtmParams";

const FEATURES = [
  {
    icon: Music,
    title: "Studio-quality music",
    description: "Personalized songs with studio quality, perfect for sharing"
  },
  {
    icon: FileText,
    title: "Personalized lyrics",
    description: "Custom lyrics inspired by your story"
  },
  {
    icon: Clock,
    title: "Delivered in 48 hours",
    description: "Receive your finished song in just 48 hours"
  }
];

/** Componente puro - sem hooks, apenas renderiza os features */
function WhatYouGetFeatures() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mb-10 sm:mb-14">
      {FEATURES.map((feature, index) => {
        const IconComponent = feature.icon;
        return (
          <article key={index} className="text-center bg-white rounded-2xl p-6 shadow-sm border border-purple-100 flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-500 flex items-center justify-center mb-4 shadow-sm" aria-hidden="true">
              <IconComponent className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl font-sans font-bold text-gray-800 mb-2" style={{ fontWeight: 700, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              {feature.title}
            </h3>
            <p className="text-gray-600 text-sm sm:text-base font-medium">
              {feature.description}
            </p>
          </article>
        );
      })}
    </div>
  );
}

type WhatYouGetProps = {
  onOpenQuiz?: () => void;
};

const WhatYouGet = React.memo(function WhatYouGet({ onOpenQuiz }: WhatYouGetProps) {
  const { navigateWithUtms } = useUtmParams();

  const handleQuizClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenQuiz) {
      onOpenQuiz();
      return;
    }
    navigateWithUtms('/quiz');
  }, [onOpenQuiz, navigateWithUtms]);

  return (
    <section className="pt-16 sm:pt-20 md:pt-24 pb-4 bg-purple-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-gray-800 text-center mb-4 tracking-tight">
          What you <span className="text-purple-600">receive</span>
        </h2>
        <p className="text-gray-700 text-center text-base sm:text-lg mb-8 sm:mb-12 max-w-2xl mx-auto font-medium">
          As soon as we finish your song, you'll receive an email with a link to play your personalized song, just like the one below!
        </p>

        {/* Vinyl Player */}
        <div className="flex justify-center mb-10 sm:mb-14">
          <div className="w-full max-w-md">
            <VinylPlayer />
          </div>
        </div>

        {/* Features Grid - componente puro sem hooks */}
        <WhatYouGetFeatures />

        {/* CTA Button */}
        <div className="text-center">
          <Button
            size="lg"
            onClick={handleQuizClick}
            className="bg-purple-600 hover:bg-purple-700 text-white text-lg sm:text-xl px-8 sm:px-12 py-5 sm:py-6 rounded-full shadow-md transition-all hover:scale-105 font-semibold"
          >
            Create my personalized song now
          </Button>
          <p className="text-gray-600 text-sm mt-4 font-medium">
            Risk-free purchase — 30-day money-back guarantee.
          </p>
        </div>
      </div>
    </section>
  );
});

export default WhatYouGet;
