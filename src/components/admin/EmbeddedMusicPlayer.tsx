import { useRef, useState, useEffect, useCallback, memo } from "react";
import { Play, Pause, Volume2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";

interface EmbeddedMusicPlayerProps {
  audioUrl: string;
  title?: string;
  variant?: number;
  compact?: boolean;
}

const EmbeddedMusicPlayerComponent = ({ audioUrl, title, variant, compact = false }: EmbeddedMusicPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // ✅ OTIMIZAÇÃO: Carregar áudio apenas quando o usuário clicar em play
      // Isso evita carregar todos os áudios ao mesmo tempo
      if (audio.readyState === HTMLMediaElement.HAVE_NOTHING || audio.readyState === HTMLMediaElement.HAVE_METADATA) {
        audio.load();
      }
      
      // ✅ MOBILE: Garantir que a duração seja carregada antes de tocar
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0 && duration === 0) {
        setDuration(audio.duration);
      }
      
      // ✅ CORREÇÃO: Tentar reproduzir imediatamente (streaming)
      // Se ainda não tem dados suficientes, o navegador vai fazer buffering automaticamente
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            // ✅ MOBILE: Atualizar duração após iniciar reprodução
            if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
              setDuration(audio.duration);
            }
            // ✅ MOBILE: Verificar duração novamente após um pequeno delay
            setTimeout(() => {
              if (audio.duration && !isNaN(audio.duration) && audio.duration > 0 && duration === 0) {
                setDuration(audio.duration);
              }
            }, 1000);
          })
          .catch(err => {
            console.error("❌ EmbeddedMusicPlayer: Erro ao reproduzir:", err);
            // Se falhou, pode ser que ainda não tenha dados suficientes
            // Tentar novamente após um delay curto
            if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
              setTimeout(() => {
                audio.load();
                audio.play()
                  .then(() => {
                    setIsPlaying(true);
                    if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
                      setDuration(audio.duration);
                    }
                  })
                  .catch(e => console.error("Erro ao tentar novamente:", e));
              }, 500);
            }
          });
      }
    }
  }, [isPlaying, duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // ✅ OTIMIZAÇÃO CRÍTICA: Usar preload="none" para evitar carregar todos os áudios ao mesmo tempo
    // Isso previne ERR_INSUFFICIENT_RESOURCES quando há muitos players na página
    audio.preload = 'none';
    audio.setAttribute('preload', 'none');
    // ✅ MOBILE: Garantir que o áudio funcione em dispositivos móveis
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('x5-playsinline', 'true'); // Para navegadores Android

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // ✅ MOBILE: Tentar obter duração durante reprodução (fallback)
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0 && duration === 0) {
        setDuration(audio.duration);
      }
    };
    
    const handleLoadedMetadata = () => {
      // ✅ MOBILE: Garantir que a duração seja carregada
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    
    const handleLoadedData = () => {
      // ✅ MOBILE: Tentar obter duração também no loadeddata
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    
    const handleDurationChange = () => {
      // ✅ MOBILE: Atualizar duração quando mudar
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    
    const handleEnded = () => setIsPlaying(false);
    
    const handleCanPlay = () => {
      // Se estava aguardando para tocar, começar agora
      if (isPlaying && audio.paused) {
        audio.play().catch(err => console.error("Erro ao iniciar após canplay:", err));
      }
      // ✅ MOBILE: Tentar obter duração quando puder tocar
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    
    const handleCanPlayThrough = () => {
      // ✅ MOBILE: Tentar obter duração quando puder tocar completamente
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    
    const handleProgress = () => {
      // ✅ MOBILE: Tentar obter duração durante carregamento
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0 && duration === 0) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("loadeddata", handleLoadedData);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("canplaythrough", handleCanPlayThrough);
    audio.addEventListener("progress", handleProgress);

    // ✅ OTIMIZAÇÃO: NÃO carregar automaticamente - apenas quando o usuário clicar em play
    // Isso evita ERR_INSUFFICIENT_RESOURCES com muitos players na página
    // audio.load(); // REMOVIDO - carregar apenas quando necessário

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("loadeddata", handleLoadedData);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("canplaythrough", handleCanPlayThrough);
      audio.removeEventListener("progress", handleProgress);
    };
  }, [isPlaying, duration]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {/* ✅ OTIMIZAÇÃO: preload="none" para evitar carregar todos os áudios ao mesmo tempo */}
      {/* ✅ MOBILE: playsinline para funcionar em dispositivos móveis */}
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        preload="none" 
        crossOrigin="anonymous"
        playsInline
      />
      
      {/* Título (apenas se não compacto) */}
      {!compact && title && (
        <div className="text-center">
          <h4 className="font-semibold text-xs truncate">{title}</h4>
          <p className="text-xs text-muted-foreground">V{variant}</p>
        </div>
      )}

      {/* Layout ultra compacto para modo compacto */}
      {compact ? (
        <div className="space-y-1">
          {/* Controles e tempo */}
          <div className="flex items-center gap-2">
            {/* Botão de play/pause ultra pequeno */}
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 p-0"
            >
              {isPlaying ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3 ml-0.5" />
              )}
            </Button>
            
            {/* Tempo atual/total ultra compacto - sempre visível */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[80px]">
              <span className="tabular-nums">{formatTime(currentTime)}</span>
              <span>/</span>
              <span className="tabular-nums">{formatTime(duration) || "0:00"}</span>
            </div>
          </div>
          
          {/* Barra de progresso compacta */}
          <div className="relative">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              onTouchStart={(e) => e.stopPropagation()} // ✅ MOBILE: Evitar conflitos de touch
              className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer touch-none"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) ${progressPercentage}%, hsl(var(--muted)) ${progressPercentage}%)`,
                WebkitAppearance: 'none',
                MozAppearance: 'none'
              }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Tempo atual/total */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Barra de progresso */}
          <div className="relative">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              onTouchStart={(e) => e.stopPropagation()} // ✅ MOBILE: Evitar conflitos de touch
              className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer touch-none"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) ${progressPercentage}%, hsl(var(--muted)) ${progressPercentage}%)`,
                WebkitAppearance: 'none',
                MozAppearance: 'none'
              }}
            />
          </div>

          {/* Controles */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </Button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
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
        </>
      )}
    </div>
  );
};

export const EmbeddedMusicPlayer = memo(EmbeddedMusicPlayerComponent);