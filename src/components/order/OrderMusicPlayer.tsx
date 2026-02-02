import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Song {
  id: string;
  title: string;
  audio_url: string | null;
  cover_url: string | null;
}

interface OrderMusicPlayerProps {
  song: Song;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function OrderMusicPlayer({
  song,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}: OrderMusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [song]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error('Erro ao reproduzir:', err);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!song.audio_url) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Áudio não disponível para esta música</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow-lg">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-6">
          {/* Album Art / Cover */}
          <div className="relative w-64 h-64 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-2xl flex items-center justify-center overflow-hidden">
            {song.cover_url ? (
              <img
                src={song.cover_url}
                alt={`Capa da música ${song.title}`}
                width="256"
                height="256"
                className="w-full h-full object-cover rounded-full"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="h-32 w-32 text-white opacity-80" />
              </div>
            )}
            {/* Efeito de vinil */}
            <div className="absolute inset-0 rounded-full border-8 border-orange-900/20" />
            <div className="absolute inset-8 rounded-full border-4 border-orange-900/10" />
            <div className="absolute inset-16 rounded-full bg-orange-900/5" />
          </div>

          {/* Título da Música */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-orange-900 mb-2">{song.title}</h2>
          </div>

          {/* Controles */}
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="icon"
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="h-12 w-12 rounded-full min-h-[48px] min-w-[48px]"
              aria-label="Música anterior"
            >
              <SkipBack className="h-6 w-6" aria-hidden="true" />
            </Button>

            <Button
              onClick={togglePlay}
              disabled={isLoading}
              className="h-16 w-16 rounded-full bg-orange-500 hover:bg-orange-600 text-white min-h-[48px] min-w-[48px]"
              aria-label={isPlaying ? "Pausar música" : "Reproduzir música"}
            >
              {isLoading ? (
                <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              ) : isPlaying ? (
                <Pause className="h-8 w-8" aria-hidden="true" />
              ) : (
                <Play className="h-8 w-8 ml-1" aria-hidden="true" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={onNext}
              disabled={!hasNext}
              className="h-12 w-12 rounded-full min-h-[48px] min-w-[48px]"
              aria-label="Próxima música"
            >
              <SkipForward className="h-6 w-6" aria-hidden="true" />
            </Button>
          </div>

          {/* Barra de Progresso */}
          <div className="w-full max-w-md space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Audio Element (hidden) */}
          <audio ref={audioRef} src={song.audio_url} preload="metadata" />
        </div>
      </CardContent>
    </Card>
  );
}

