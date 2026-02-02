import { useRef, useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, X } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface MusicPlayerProps {
  song: {
    id: string;
    title: string;
    audio_url: string;
    cover_url?: string;
  };
  playlist: any[];
  currentIndex: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export const MusicPlayer = ({
  song,
  playlist,
  currentIndex,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onClose,
}: MusicPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);

  // Formatar tempo para MM:SS
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Controlar play/pause
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.play().catch(err => console.error("Erro ao reproduzir:", err));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Atualizar source quando trocar música
  useEffect(() => {
    if (!audioRef.current) return;
    
    // ✅ CORREÇÃO: Forçar preload e streaming imediato
    const audio = audioRef.current;
    audio.preload = 'auto';
    audio.setAttribute('preload', 'auto');
    
    audio.src = song.audio_url;
    audio.load(); // ✅ CORREÇÃO: Iniciar carregamento/buffering imediatamente
    
    if (isPlaying) {
      // ✅ CORREÇÃO: Tentar reproduzir imediatamente (streaming)
      audio.play().catch(err => {
        console.error("Erro ao reproduzir:", err);
        // Se ainda não tem dados, tentar novamente após buffering inicial
        if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
          setTimeout(() => {
            audio.play().catch(e => console.error("Erro ao tentar novamente:", e));
          }, 500);
        }
      });
    }
  }, [song.id, song.audio_url, isPlaying]);

  // Listeners do audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // ✅ CORREÇÃO: Forçar preload e streaming
    audio.preload = 'auto';
    audio.setAttribute('preload', 'auto');

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleCanPlay = () => {
      // ✅ CORREÇÃO: Se estava aguardando para tocar, começar agora
      if (isPlaying && audio.paused) {
        audio.play().catch(err => console.error("Erro ao iniciar após canplay:", err));
      }
    };

    const handleEnded = () => {
      if (currentIndex < playlist.length - 1) {
        onNext();
      } else {
        onPlayPause(); // Pausar no final
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("ended", handleEnded);

    // ✅ CORREÇÃO: Forçar carregamento imediato para streaming
    audio.load();

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [isSeeking, currentIndex, playlist.length, onNext, onPlayPause, isPlaying]);

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Handle volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* ✅ CORREÇÃO: preload="auto" para streaming imediato */}
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />
      
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Player Modal */}
      <Card className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md p-8 shadow-2xl">
        {/* Botão Fechar */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Capa */}
        <div className="mb-6">
          <div className="aspect-square relative rounded-lg overflow-hidden shadow-lg">
            <img
              src={song.cover_url || "/placeholder.svg"}
              alt={song.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Título */}
        <div className="mb-6 text-center">
          <h3 className="text-xl font-semibold mb-1">{song.title}</h3>
          <p className="text-sm text-muted-foreground">
            Versão {currentIndex + 1} de {playlist.length}
          </p>
        </div>

        {/* Barra de Progresso */}
        <div className="mb-2">
          <div className="relative">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              onMouseDown={() => setIsSeeking(true)}
              onMouseUp={() => setIsSeeking(false)}
              onTouchStart={() => setIsSeeking(true)}
              onTouchEnd={() => setIsSeeking(false)}
              className="music-progress-bar w-full h-1 bg-muted rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) ${progressPercentage}%, hsl(var(--muted)) ${progressPercentage}%)`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            disabled={currentIndex === 0}
            className="h-10 w-10"
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button
            variant="default"
            size="icon"
            onClick={onPlayPause}
            className="h-16 w-16 rounded-full"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={currentIndex >= playlist.length - 1}
            className="h-10 w-10"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 bg-muted rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) ${volume * 100}%, hsl(var(--muted)) ${volume * 100}%)`
            }}
          />
        </div>
      </Card>
    </>
  );
};
