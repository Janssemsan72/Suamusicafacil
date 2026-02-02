import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useUtmParams } from "@/hooks/useUtmParams";
import { HeroVideoControls } from "./HeroVideoControls";

type HeroSectionProps = {
  onOpenQuiz?: () => void;
};

const HeroSection = React.memo(function HeroSection({ onOpenQuiz }: HeroSectionProps) {
  const { navigateWithUtms } = useUtmParams();

  const handleQuizClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenQuiz) {
      onOpenQuiz();
      return;
    }
    navigateWithUtms('/quiz');
  }, [navigateWithUtms, onOpenQuiz]);

  return (
    <section id="heroSection" className="wave-bg pt-8 md:pt-12 pb-4 md:pb-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-0">
        <div className="flex flex-col md:flex-row items-center md:items-start">
          {/* Conteúdo Esquerdo */}
          <div className="md:w-1/2 mb-12 md:mb-0 relative z-10 px-6 sm:pl-12 sm:pr-0 w-full flex flex-col items-start">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight text-left">
              Transforme Seus <span className="handwritten">Sentimentos</span> em Música
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-10 text-left">
              Conte-nos sua história — nós criamos uma música que a captura perfeitamente.
            </p>
            <div className="flex justify-center md:justify-start w-full md:w-auto">
              <Button
                onClick={handleQuizClick}
                className="bg-purple-600 hover:bg-purple-700 text-white py-4 px-10 rounded-full font-semibold text-base sm:text-lg transition duration-300 shadow-md animate-pulse-scale"
              >
                Crie minha música personalizada agora
              </Button>
            </div>
          </div>

          {/* Conteúdo Direito */}
          <div className="w-full md:w-1/2 flex justify-center md:justify-end">
            <div className="max-w-md w-full">
              {/* Vídeo */}
              <div className="relative w-full overflow-hidden bg-black aspect-video rounded-lg shadow-xl">
                <video
                  className="w-full h-full object-cover"
                  playsInline
                  loop
                  muted
                  autoPlay
                  preload="metadata"
                  poster="/images/videoframe_636.webp"
                  src="/video/video-frente-hero.mp4"
                >
                  Seu navegador não suporta o elemento de vídeo.
                </video>
                
                {/* Botão de play/pause isolado em componente separado */}
                <HeroVideoControls />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

export default HeroSection;
