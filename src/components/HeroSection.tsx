import React, { useCallback, useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUtmParams } from "@/hooks/useUtmParams";
import { HeroVideoControls } from "./HeroVideoControls";
import { Play } from "@/lib/icons";

type HeroSectionProps = {
  onOpenQuiz?: () => void;
};

const HeroSection = React.memo(function HeroSection({ onOpenQuiz }: HeroSectionProps) {
  const { navigateWithUtms } = useUtmParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideoPlayOverlay, setShowVideoPlayOverlay] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playVideo = async () => {
      try {
        await video.play();
        setShowVideoPlayOverlay(false);
      } catch {
        setShowVideoPlayOverlay(true);
      }
    };

    if (video.readyState >= 2) {
      playVideo();
    } else {
      video.addEventListener("loadeddata", playVideo, { once: true });
    }

    return () => {
      video.removeEventListener("loadeddata", playVideo);
    };
  }, []);

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
      {/* Decorative floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 left-10 w-32 h-32 bg-pink-200/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute top-40 right-20 w-40 h-40 bg-purple-200/15 rounded-full blur-3xl animate-pulse-scale"></div>
        <div className="absolute bottom-32 left-1/4 w-36 h-36 bg-pink-200/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-purple-200/15 rounded-full blur-3xl animate-pulse-scale" style={{ animationDelay: '0.5s' }}></div>
      </div>
      <div className="max-w-7xl mx-auto px-0 relative z-10">
        <div className="flex flex-col md:flex-row items-center md:items-start">
          {/* Conteúdo Esquerdo */}
          <div className="md:w-1/2 mb-12 md:mb-0 relative z-20 px-6 sm:pl-12 sm:pr-0 w-full flex flex-col items-start">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight text-left text-gray-900 drop-shadow-sm">
              Transforme Seus <span className="handwritten text-purple-700">Sentimentos</span> em Música
            </h1>
            <p className="text-xl md:text-2xl text-gray-800 font-medium mb-10 text-left max-w-lg">
              Conte-nos sua história — nós criamos uma música que a captura perfeitamente.
            </p>
            <div className="flex justify-center md:justify-start w-full md:w-auto">
              <Button
                onClick={handleQuizClick}
                className="bg-purple-700 hover:bg-purple-800 text-white py-4 px-10 rounded-full font-bold text-base sm:text-lg transition duration-300 shadow-lg hover:shadow-xl hover:scale-105 animate-pulse-scale"
              >
                Crie minha música personalizada agora
              </Button>
            </div>
          </div>

          {/* Conteúdo Direito */}
          <div className="w-full md:w-1/2 flex justify-center md:justify-end relative z-20">
            <div className="max-w-md w-full">
              {/* Vídeo */}
              <div className="relative w-full overflow-hidden bg-black aspect-video rounded-lg shadow-2xl ring-1 ring-black/10">
                <div className="absolute inset-0 bg-black/20 pointer-events-none z-[2]"></div>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover brightness-[0.9]"
                  playsInline
                  loop
                  muted
                  autoPlay
                  preload="auto"
                  poster="/images/videoframe_636.webp"
                  src="/video/video-frente-hero.mp4"
                  onPlaying={() => setShowVideoPlayOverlay(false)}
                  onClick={() => videoRef.current?.play().then(() => setShowVideoPlayOverlay(false)).catch(() => {})}
                  onError={(e) => {
                    console.error("Video Error:", e.currentTarget.error);
                    console.log("Network State:", e.currentTarget.networkState);
                    console.log("Ready State:", e.currentTarget.readyState);
                    setShowVideoPlayOverlay(true);
                  }}
                >
                  Seu navegador não suporta o elemento de vídeo.
                </video>
                {showVideoPlayOverlay && (
                  <button
                    type="button"
                    onClick={() => videoRef.current?.play().then(() => setShowVideoPlayOverlay(false)).catch(() => {})}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 z-[5]"
                    aria-label="Reproduzir vídeo"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
                      <Play className="w-8 h-8 text-purple-600 fill-current ml-1" />
                    </div>
                  </button>
                )}
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
