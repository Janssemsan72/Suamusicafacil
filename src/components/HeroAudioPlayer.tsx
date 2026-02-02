import React, { memo } from "react";
import { Play, Pause } from "@/lib/icons";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

interface HeroAudioPlayerProps {
  className?: string;
}

export const HeroAudioPlayer = memo(function HeroAudioPlayer({ className }: HeroAudioPlayerProps) {
  const { audioRef, playing, isLoading, togglePlay } = useAudioPlayer({ autoPlay: false });

  return (
    <>
      <div className={className}>
        <button 
          onClick={togglePlay}
          disabled={isLoading}
          className={`flex items-center gap-1.5 bg-white/70 hover:bg-white/80 backdrop-blur-md text-brown-dark-500 rounded-full px-3 py-1.5 sm:px-3.5 sm:py-2 shadow-sm hover:shadow-md transition-all duration-200 border border-white/40 ${
            isLoading ? 'opacity-60 cursor-not-allowed' : ''
          }`}
          aria-label={playing ? "Pause example music" : "Play example music"}
        >
          {isLoading ? (
            <>
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 border-brown-dark-500/60 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs sm:text-sm font-normal text-brown-dark-500/80">Loading...</span>
            </>
          ) : playing ? (
            <>
              <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brown-dark-500/90" fill="currentColor" aria-hidden="true" />
              <span className="text-xs sm:text-sm font-normal text-brown-dark-500/90">Playing</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 ml-0.5 text-brown-dark-500/90" fill="currentColor" aria-hidden="true" />
              <span className="text-xs sm:text-sm font-normal text-brown-dark-500/90">Listen to Example</span>
            </>
          )}
        </button>
      </div>
      <audio 
        ref={audioRef} 
        preload="none"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />
    </>
  );
});

