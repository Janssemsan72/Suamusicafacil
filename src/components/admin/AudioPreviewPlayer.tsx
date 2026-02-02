import { useRef, useState, useEffect } from "react";
import { Play, Pause } from "@/lib/icons";
import { Button } from "@/components/ui/button";

interface AudioPreviewPlayerProps {
  audioUrl: string;
  compact?: boolean;
}

export const AudioPreviewPlayer = ({ audioUrl, compact = false }: AudioPreviewPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Log da URL quando o componente monta ou a URL muda
  useEffect(() => {
    console.log('🎵 [AudioPreviewPlayer] URL do áudio:', audioUrl);
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      console.log('▶️ [AudioPreviewPlayer] Tentando reproduzir com streaming...');
      // ✅ CORREÇÃO: Tentar reproduzir imediatamente (streaming)
      audio.play()
        .then(() => {
          console.log('✅ [AudioPreviewPlayer] Reproduzindo com sucesso - streaming em andamento');
          setIsPlaying(true);
          setError(null);
        })
        .catch(err => {
          console.error('❌ [AudioPreviewPlayer] Erro ao reproduzir:', err);
          // Se ainda não tem dados suficientes, tentar novamente após buffering inicial
          if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
            console.log('📥 [AudioPreviewPlayer] Aguardando dados para streaming...');
            setTimeout(() => {
              audio.play()
                .then(() => {
                  setIsPlaying(true);
                  setError(null);
                  console.log('✅ [AudioPreviewPlayer] Reprodução iniciada após buffering');
                })
                .catch(retryErr => {
                  console.error('❌ [AudioPreviewPlayer] Erro ao tentar novamente:', retryErr);
                  setError(retryErr.message);
                });
            }, 500);
          } else {
            setError(err.message);
          }
        });
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // ✅ CORREÇÃO: Forçar preload e streaming imediato
    audio.preload = 'auto';
    audio.setAttribute('preload', 'auto');

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      console.log('✅ [AudioPreviewPlayer] Metadados carregados, duração:', audio.duration);
      setDuration(audio.duration);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e: Event) => {
      const audioError = (e.target as HTMLAudioElement).error;
      console.error('❌ [AudioPreviewPlayer] Erro ao carregar áudio:', audioError);
      setError(audioError?.message || 'Erro ao carregar áudio');
    };
    const handleCanPlay = () => {
      console.log('✅ [AudioPreviewPlayer] Áudio pronto para reproduzir');
      // ✅ CORREÇÃO: Se estava aguardando para tocar, começar agora
      if (isPlaying && audio.paused) {
        audio.play().catch(err => console.error("Erro ao iniciar após canplay:", err));
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    // ✅ CORREÇÃO: Forçar carregamento imediato para streaming
    audio.load();

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [isPlaying]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-3"}>
      {/* ✅ CORREÇÃO: preload="auto" para streaming imediato */}
      <audio ref={audioRef} src={audioUrl} preload="auto" crossOrigin="anonymous" />
      {error && (
        <div className="text-xs text-red-500 mb-2">
          ⚠️ {error}
        </div>
      )}
      
      {compact ? (
        <>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={togglePlay}
            className="h-8 w-8 shrink-0"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>
          
          <div className="flex-1 min-w-0">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) ${progressPercentage}%, hsl(var(--muted)) ${progressPercentage}%)`
              }}
            />
          </div>
          
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="relative">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) ${progressPercentage}%, hsl(var(--muted)) ${progressPercentage}%)`
              }}
            />
          </div>

          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="h-12 w-12 rounded-full bg-primary/10 hover:bg-primary/20"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
