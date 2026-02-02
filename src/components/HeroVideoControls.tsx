import React, { useState, useEffect, useCallback } from "react";
import { Play, Pause } from "@/lib/icons";

export function HeroVideoControls() {
  const [isVinylPlaying, setIsVinylPlaying] = useState(false);

  const togglePlay = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('vinyl-toggle-play'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPlayingChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ playing?: boolean }>;
      setIsVinylPlaying(Boolean(customEvent.detail?.playing));
    };

    window.addEventListener('vinyl-playing-changed', onPlayingChanged);
    return () => {
      window.removeEventListener('vinyl-playing-changed', onPlayingChanged);
    };
  }, []);

  return (
    <button
      onClick={togglePlay}
      className="absolute bottom-4 right-4 bg-white/70 backdrop-blur-lg border border-white/30 rounded-full px-3 py-2 flex items-center gap-2 hover:bg-white/80 hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm z-10 group"
      aria-label={isVinylPlaying ? 'Pausar' : 'Reproduzir'}
    >
      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-purple-700 transition-colors">
        {isVinylPlaying ? (
          <Pause className="w-3 h-3 text-white fill-current" />
        ) : (
          <Play className="w-3 h-3 text-white fill-current ml-0.5" />
        )}
      </div>
      <span className="text-xs font-medium text-gray-900 font-dm-sans">
        {isVinylPlaying ? 'Tocando' : 'Ouça este Exemplo'}
      </span>
    </button>
  );
}
