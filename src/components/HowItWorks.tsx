import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Gift } from "@/lib/icons";
import { useUtmParams } from "@/hooks/useUtmParams";

const STEPS = [
    { 
      number: "1", 
      title: "Tell us about the person and the occasion",
      description: "Share details about who the song is for and what makes your relationship special."
    },
    { 
      number: "2", 
      title: "Choose a musical style and mood",
      description: "We create in over 30 musical genres — choose the one you want in the form."
    },
    { 
      number: "3", 
      title: "We write personalized lyrics and melody",
      description: "We craft lyrics that tell your unique story."
    },
    { 
      number: "4", 
      title: "We record professionally",
      description: "After you approve the lyrics, talented musicians and vocalists bring your song to life in our studio."
    },
    { 
      number: "5", 
      title: "You receive your unique song",
      description: "Receive your high-quality recording by email and WhatsApp, ready to surprise someone special."
    },
];

/** Componente puro - sem hooks, apenas renderiza os passos */
function HowItWorksSteps() {
  return (
    <ol className="max-w-3xl mx-auto mb-16 space-y-8">
      {STEPS.map((step) => (
        <li key={step.number} className="flex items-start">
          <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mr-4 flex-shrink-0 self-start shadow-sm" aria-hidden="true">
            <span className="text-purple-600 font-bold text-xl leading-none">{step.number}</span>
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className="text-xl font-bold mb-2 text-gray-800 leading-tight">{step.title}</h3>
            <p className="text-gray-600 leading-relaxed">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

type HowItWorksProps = {
  onOpenQuiz?: () => void;
};

const HowItWorks = React.memo(function HowItWorks({ onOpenQuiz }: HowItWorksProps) {
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
    <section 
      id="como-funciona" 
      className="relative pt-8 pb-20 bg-white overflow-hidden scroll-mt-24"
    >
      <div className="container mx-auto px-4">
        {/* Title - Centered */}
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          How Your <span className="text-purple-500">Personalized Song</span> Is Created
        </h2>

        {/* Steps Container - componente puro sem hooks */}
        <HowItWorksSteps />

        {/* CTA Button - Centered */}
        <div className="text-center">
          <Button
            size="lg"
            onClick={handleQuizClick}
            className="bg-purple-600 hover:bg-purple-700 text-white text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 rounded-full shadow-md transition-all hover:scale-105 font-semibold"
          >
            <Gift className="w-5 h-5 mr-2" />
            Create my personalized song now
          </Button>
        </div>
      </div>
    </section>
  );
});

export default HowItWorks;
