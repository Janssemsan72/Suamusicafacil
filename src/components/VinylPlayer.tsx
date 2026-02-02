import React, { useRef, useState, useEffect, useCallback } from "react";
import { safeReload } from '@/utils/reload';
import { Play, Pause } from "@/lib/icons";
import AudioProgressBar from "./AudioProgressBar";
import { audioLog, devLog } from "@/utils/devLogger";

export default function VinylPlayer() {
  // Site é 100% espanhol - sem dependências de locale/translations
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const localFallbackAudioUrlRef = useRef('/audio/pop_feliz.mp3');
  const hasTriedLocalFallbackRef = useRef(false);
  const [track, setTrack] = useState<{
    title: string;
    artist: string;
    audioUrl: string;
    coverUrl: string | null;
  }>({
    title: 'CrieSuaMusica',
    artist: 'Carregando...',
    audioUrl: '',
    coverUrl: null
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isLoadingTrackData, setIsLoadingTrackData] = useState(true);

  // Función para buscar música de la base de datos
  const fetchTrack = useCallback(async () => {
    try {
      // ✅ Evitar ruído no console do devtools em ambiente local:
      // não buscar track no banco em dev; usar fallback direto.
      if (import.meta.env.DEV) {
        return {
          title: 'Minha Vida',
          artist: 'CrieSuaMusica',
          audioUrl: localFallbackAudioUrlRef.current,
          coverUrl: null
        };
      }

      const { supabase } = await import("@/integrations/supabase/client");

      // Forçar espanhol sempre
      const currentLanguage = 'pt';
      audioLog(`🎵 [VinylPlayer] Buscando música para idioma: ${currentLanguage}`);
      const storageBucket = 'vinyl-tracks';
      type ExampleTrackRow = {
        title?: string | null;
        artist?: string | null;
        audio_path?: string | null;
        cover_path?: string | null;
      };
      const isValidPath = (p: unknown): p is string => {
        if (typeof p !== 'string') return false;
        const trimmed = p.trim();
        if (!trimmed) return false;
        if (trimmed === 'undefined' || trimmed === 'null') return false;
        return true;
      };
      const getPublicUrl = (path: string) =>
        supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
      
      // Buscar música para el idioma actual
      const { data, error } = await supabase
        .from('example_tracks')
        .select('*')
        .eq('language', currentLanguage)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const row = data as unknown as ExampleTrackRow | null;

      if (row && !error && isValidPath(row.audio_path)) {
        audioLog(`🎵 [VinylPlayer] Música encontrada no banco: ${row.title}`);
        return {
          title: row.title ?? 'CrieSuaMusica',
          artist: row.artist ?? 'CrieSuaMusica',
          audioUrl: getPublicUrl(row.audio_path),
          coverUrl: isValidPath(row.cover_path) ? getPublicUrl(row.cover_path) : null,
        };
      } else {
        audioLog(`🎵 [VinylPlayer] Nenhuma música encontrada no banco, usando fallback`);
        
        return {
          title: 'Minha Vida',
          artist: 'CrieSuaMusica',
          audioUrl: localFallbackAudioUrlRef.current,
          coverUrl: null
        };
      }
    } catch (error: unknown) {
      return {
        title: 'Minha Vida',
        artist: 'CrieSuaMusica',
        audioUrl: localFallbackAudioUrlRef.current,
        coverUrl: null
      };
    }
  }, []);

  // Cargar música inicial
  useEffect(() => {
    const loadInitialTrack = async () => {
      setIsLoadingTrackData(true);
      const initialTrack = await fetchTrack();
      if (initialTrack) {
        audioLog(`🎵 [VinylPlayer] Música carregada: ${initialTrack.title} - ${initialTrack.audioUrl}`);
        setTrack(initialTrack);
      } else {
        // Se não encontrou, usar fallback direto
        audioLog(`🎵 [VinylPlayer] Nenhuma música retornada, usando fallback direto`);
        setTrack({
          title: 'Minha Vida',
          artist: 'CrieSuaMusica',
          audioUrl: localFallbackAudioUrlRef.current,
          coverUrl: null
        });
      }
      setIsLoadingTrackData(false);
    };

    loadInitialTrack();
  }, [fetchTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track.audioUrl || track.audioUrl === '') return;

    audioLog('Configurando audio para: ' + track.audioUrl);

    audio.preload = 'none';
    audio.setAttribute('preload', 'none');

    const onTimeUpdate = () => {
      setTime(prev => ({ 
        current: audio.currentTime, 
        duration: prev.duration || audio.duration || 0 
      }));
    };

    const onLoadedMetadata = () => {
      audioLog('Metadatos cargados, duración: ' + audio.duration);
      setTime({ current: 0, duration: audio.duration || 0 });
      setIsLoading(false);
    };

    const onCanPlay = () => {
      audioLog('Audio listo para reproducir');
      setIsBuffering(false);
      setAudioError(null);
      
      if (playing && audio.paused) {
        audio.play().catch(err => {
          devLog.error('Error al iniciar después de canplay', err);
        });
      }
    };

    const onCanPlayThrough = () => {
      audioLog('Audio completamente cargado');
      setIsBuffering(false);
    };

    const onLoadStart = () => {
      audioLog('Iniciando carga del audio');
      setIsBuffering(true);
      setAudioError(null);
    };

    const onProgress = () => {
      if (audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        const duration = audio.duration || 0;
        if (duration > 0) {
          const bufferedPercent = (bufferedEnd / duration) * 100;
          audioLog('Buffered: ' + bufferedPercent.toFixed(1) + '%');
          
          if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && !playing) {
            setIsBuffering(false);
          }
        }
      }
    };

    const onWaiting = () => {
      audioLog('Audio esperando datos (buffering)');
      setIsBuffering(true);
    };

    const onPlaying = () => {
      audioLog('Audio reproduciéndose');
      setIsBuffering(false);
      setIsLoading(false);
    };

    const onError = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      const error = audio.error;
      let errorMessage = 'Error al cargar audio';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Reproducción cancelada';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Error de red - verifica tu conexión';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Formato de audio no soportado';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Formato de audio no soportado';
            break;
          default:
            errorMessage = `Error de audio (${error.code})`;
        }
      }
      
      if (!hasTriedLocalFallbackRef.current && audio.src && !audio.src.includes(localFallbackAudioUrlRef.current)) {
        hasTriedLocalFallbackRef.current = true;
        setPlaying(false);
        setIsLoading(false);
        setIsBuffering(false);
        setTrack((prev) => ({
          ...prev,
          title: prev.title || 'Minha Vida',
          artist: prev.artist || 'CrieSuaMusica',
          audioUrl: localFallbackAudioUrlRef.current,
          coverUrl: prev.coverUrl ?? null,
        }));
        return;
      }

      devLog.warn('Error en audio', { error, errorMessage, audioSrc: audio.src });
      setPlaying(false);
      setIsLoading(false);
      setIsBuffering(false);
      setAudioError(errorMessage);
    };

    const onEnded = () => {
      audioLog('Audio finalizado');
      setPlaying(false);
      setTime(prev => ({ current: 0, duration: prev.duration }));
    };

    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("canplaythrough", onCanPlayThrough);
    audio.addEventListener("progress", onProgress);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);

    audioLog('Audio configurado - esperando play del usuario');

    return () => {
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("canplaythrough", onCanPlayThrough);
      audio.removeEventListener("progress", onProgress);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
    };
  }, [track?.audioUrl, playing]);


  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !track.audioUrl || track.audioUrl === '') {
      devLog.warn('Audio aún no cargado - espera');
      return;
    }

    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
        audioLog('Audio pausado');
      } else {
        audioLog('Iniciando reproducción');
        
        try {
          if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
            audioLog('Forzando carga antes de reproducir');
            audio.load();
          }
          
          await audio.play();
          setPlaying(true);
          audioLog('Reproducción iniciada');
          
        } catch (playError: unknown) {
          const err = playError as { name?: string };
          if (err?.name === 'NotAllowedError') {
            devLog.warn('Reproducción bloqueada por el navegador');
            throw playError;
          } else if (err?.name === 'NotSupportedError') {
            setAudioError('Formato de audio no soportado');
            throw playError;
          } else if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
            audioLog('Esperando buffering inicial...');
            setIsBuffering(true);
            
            setTimeout(async () => {
              try {
                await audio.play();
                setPlaying(true);
                setIsBuffering(false);
                audioLog('Reproducción iniciada después de buffering');
              } catch (retryError) {
                devLog.error('Error al reproducir después de buffering', retryError);
                setIsBuffering(false);
                setPlaying(false);
              }
            }, 800);
          } else {
            throw playError;
          }
        }
      }
    } catch (error) {
      devLog.error('Error al controlar reproducción', error);
      setIsLoading(false);
      setIsBuffering(false);
      setPlaying(false);
    }
  };

  const handleSeek = (newTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (!isNaN(newTime) && newTime >= 0 && newTime <= time.duration) {
      audio.currentTime = newTime;
      setTime(prev => ({ ...prev, current: newTime }));
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('vinyl-playing-changed', { detail: { playing } })
    );
  }, [playing]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onTogglePlay = () => {
      togglePlay();
    };

    window.addEventListener('vinyl-toggle-play', onTogglePlay);
    return () => {
      window.removeEventListener('vinyl-toggle-play', onTogglePlay);
    };
  }, [togglePlay]);

  if (audioError) {
    return (
      <section
        id="radiola"
        className="bg-card rounded-3xl p-4 md:p-6 shadow-md border border-border/50 h-full min-h-[400px] flex items-center justify-center"
      >
        <div className="text-center">
          <p className="text-red-500 mb-2">❌ Erro no áudio</p>
          <p className="text-xs text-muted-foreground mb-3">{audioError}</p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => {
                setAudioError(null);
                setIsLoading(true);
                if (track) {
                  const audio = audioRef.current;
                  if (audio) {
                    audio.load();
                  }
                }
              }} 
              className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-primary/80"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={() => safeReload({ reason: 'VinylPlayer' })} 
              className="px-3 py-1 bg-muted text-foreground rounded text-xs hover:bg-muted/80"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      </section>
    );
  }


  return (
    <section
      id="radiola"
      className="bg-card rounded-2xl sm:rounded-3xl p-2 sm:p-4 md:p-6 shadow-md border border-border/50 w-full h-full min-h-[400px] flex flex-col justify-center overflow-hidden"
    >
      <div className="w-full mx-auto">
        <h2 id="radiola-title" tabIndex={-1} className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-foreground text-center mb-1 outline-none">
          Ouça nossas músicas
        </h2>
        <p className="text-muted-foreground mb-2 sm:mb-4 text-center text-xs px-2">
          Clique em play para ouvir uma amostra
        </p>

        {/* Vinyl Record */}
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-52 lg:h-52 mx-auto mb-2 sm:mb-4">
        <div
          className={`relative w-full h-full rounded-full shadow-md transition-all duration-300 vinyl-spin-realistic ${
            playing ? "vinyl-playing" : "vinyl-paused"
          } ${isTransitioning ? "opacity-50 scale-95" : "opacity-100 scale-100"}`}
        >
          {/* Vinyl disc */}
          <div className="absolute inset-0 rounded-full bg-neutral-900" />
          
          {/* Grooves effect */}
          <div className="absolute inset-4 rounded-full border-[20px] border-neutral-700/30" />
          <div className="absolute inset-8 rounded-full border-[15px] border-neutral-700/20" />
          <div className="absolute inset-12 rounded-full border-[10px] border-neutral-700/10" />

          {/* Center label with cover */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full bg-card border-4 border-card shadow-md overflow-hidden">
            {track.coverUrl ? (
              <img 
                src={track.coverUrl} 
                alt={track.title}
                className={`w-full h-full object-cover vinyl-spin-slow ${
                  playing ? "vinyl-playing" : "vinyl-paused"
                }`}
              />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <span className={`text-2xl vinyl-spin-slow ${
                  playing ? "vinyl-playing" : "vinyl-paused"
                }`}>🎵</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Track Info */}
      <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
        <h3 className="text-sm sm:text-base md:text-lg font-sans font-semibold text-foreground mb-0.5 text-center px-2" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 600 }}>
          {track.title}
        </h3>
        {track.artist && (
          <p className={`text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 text-center px-2 ${isLoadingTrackData ? 'animate-pulse' : ''}`}>
            {track.artist}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full mb-2 sm:mb-3">
        <AudioProgressBar
          current={time.current}
          duration={time.duration}
          isLoaded={time.duration > 0}
          onSeek={handleSeek}
          showTimeLabels={true}
        />
      </div>

      {/* Play/Pause Button */}
      <div className="flex justify-center">
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full text-white grid place-items-center shadow-md transition-all hover:scale-105 ${
            isLoading
              ? 'bg-muted cursor-not-allowed' 
              : 'bg-primary hover:bg-primary-600'
          }`}
        >
          {isLoading ? (
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : playing ? (
            <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
          )}
        </button>
      </div>
      </div>

      <audio 
        ref={audioRef} 
        src={track.audioUrl || ''} 
        preload="none"
        crossOrigin="anonymous"
      />
    </section>
  );
}
