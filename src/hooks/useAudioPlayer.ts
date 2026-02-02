import { useRef, useState, useEffect, useCallback } from "react";
// ✅ OTIMIZAÇÃO CRÍTICA: Lazy load do Supabase - carregar apenas quando necessário
// import { supabase } from "@/integrations/supabase/client";
import { audioLog, devLog } from "@/utils/devLogger";
import { scheduleNonCriticalRender } from "@/utils/scheduleNonCriticalRender";

interface Track {
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string | null;
}

interface UseAudioPlayerOptions {
  autoPlay?: boolean;
  onTrackChange?: (track: Track | null) => void;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const { autoPlay = false, onTrackChange } = options;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [track, setTrack] = useState<Track | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isLoadingTrackData, setIsLoadingTrackData] = useState(false);

  // ✅ OTIMIZAÇÃO CRÍTICA: Lazy load do Supabase apenas quando necessário
  // Função para buscar música do banco de dados (mesma lógica do VinylPlayer)
  const fetchTrack = useCallback(async (): Promise<Track> => {
    try {
      // ✅ OTIMIZAÇÃO: Carregar Supabase apenas quando necessário
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Em dev, usar fallback direto
      if (import.meta.env.DEV) {
        const storageBucket = 'vinyl-tracks';
        const fallbackPath = 'tracks/mi-vida.mp3';
        const fallbackUrl = supabase.storage.from(storageBucket).getPublicUrl(fallbackPath).data.publicUrl;
        return {
          title: 'Mi Vida',
          artist: 'Sua Música Fácil',
          audioUrl: fallbackUrl,
          coverUrl: null
        };
      }

      const currentLanguage = 'pt';
      audioLog(`🎵 [useAudioPlayer] Buscando música para idioma: ${currentLanguage}`);
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
      
      const { data, error } = await supabase
        .from('example_tracks')
        .select('*')
        .eq('language', currentLanguage)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const row = data as unknown as ExampleTrackRow | null;

      if (row && !error && isValidPath(row.audio_path)) {
        audioLog(`🎵 [useAudioPlayer] Música encontrada no banco: ${row.title}`);
        return {
          title: row.title ?? 'Sua Música Fácil',
          artist: row.artist ?? 'Sua Música Fácil',
          audioUrl: getPublicUrl(row.audio_path),
          coverUrl: isValidPath(row.cover_path) ? getPublicUrl(row.cover_path) : null,
        };
      } else {
        audioLog(`🎵 [useAudioPlayer] Nenhuma música encontrada no banco, usando fallback em espanhol`);
        const fallbackPath = 'tracks/mi-vida.mp3';
        const fallbackUrl = supabase.storage.from(storageBucket).getPublicUrl(fallbackPath).data.publicUrl;
        return {
          title: 'Mi Vida',
          artist: 'Sua Música Fácil',
          audioUrl: fallbackUrl,
          coverUrl: null
        };
      }
    } catch (error: unknown) {
      // ✅ OTIMIZAÇÃO: Carregar Supabase apenas quando necessário (no catch também)
      const { supabase } = await import('@/integrations/supabase/client');
      const storageBucket = 'vinyl-tracks';
      const fallbackPath = 'tracks/mi-vida.mp3';
      const fallbackUrl = supabase.storage.from(storageBucket).getPublicUrl(fallbackPath).data.publicUrl;
      audioLog(`🎵 [useAudioPlayer] Erro ao buscar música, usando fallback em espanhol: ${fallbackUrl}`);
      return {
        title: 'Mi Vida',
        artist: 'Sua Música Fácil',
        audioUrl: fallbackUrl,
        coverUrl: null
      };
    }
  }, []);

  useEffect(() => {
    if (!autoPlay) return;

    const loadInitialTrack = async () => {
      setIsLoadingTrackData(true);
      setIsLoading(true);
      try {
        const initialTrack = await fetchTrack();
        setTrack(initialTrack);
        onTrackChange?.(initialTrack);
      } finally {
        setIsLoading(false);
        setIsLoadingTrackData(false);
      }
    };

    return scheduleNonCriticalRender(() => {
      loadInitialTrack();
    }, { timeoutMs: 5000, delayMs: 2000 });
  }, [autoPlay, fetchTrack, onTrackChange]);

  // Atualizar src do áudio quando track mudar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track?.audioUrl || track.audioUrl === '') return;
    
    audio.src = track.audioUrl;
  }, [track?.audioUrl]);

  // Configurar eventos do áudio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track?.audioUrl || track.audioUrl === '') return;

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
      
      devLog.error('Error en audio', { error, errorMessage, audioSrc: audio.src });
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

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
        audioLog('Audio pausado');
      } else {
        audioLog('Iniciando reproducción');
        setIsLoading(true);

        let trackToPlay = track;
        if (!trackToPlay?.audioUrl || trackToPlay.audioUrl === '') {
          setIsLoadingTrackData(true);
          trackToPlay = await fetchTrack();
          setTrack(trackToPlay);
          onTrackChange?.(trackToPlay);
          setIsLoadingTrackData(false);
        }

        if (!trackToPlay?.audioUrl || trackToPlay.audioUrl === '') {
          setIsLoading(false);
          devLog.warn('Audio aún no cargado - espera');
          return;
        }

        if (audio.src !== trackToPlay.audioUrl) {
          audio.src = trackToPlay.audioUrl;
        }
        
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
      setIsLoadingTrackData(false);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTrack, onTrackChange, playing, track]);

  return {
    audioRef,
    playing,
    time,
    track,
    isLoading,
    isBuffering,
    audioError,
    isLoadingTrackData,
    togglePlay,
    setAudioError,
  };
}

