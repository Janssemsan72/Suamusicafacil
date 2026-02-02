import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Play, Pause } from '@/lib/icons';
import { useTranslation } from '@/hooks/useTranslation';

interface CheckoutAudioPreviewProps {
  currentlyPlaying: number | null;
  currentTimes: { [key: number]: number };
  durations: { [key: number]: number };
  onTogglePlay: (index: number) => void;
  formatTime: (seconds: number) => string;
}

export const CheckoutAudioPreview = React.memo(({
  currentlyPlaying,
  currentTimes,
  durations,
  onTogglePlay,
  formatTime,
}: CheckoutAudioPreviewProps) => {
  const { t } = useTranslation();

  const songs = [
    { title: 'Lá na Escola', orderedBy: 'Ana Paula M.' },
    { title: 'Pop Feliz', orderedBy: 'Ricardo S.' }
  ];

  return (
    <Card className="compact-card hidden md:block">
      <CardHeader className="pb-2 md:pb-2">
        <CardTitle className="flex items-center gap-2 text-sm md:text-sm">
          <Music className="h-4 w-4 md:h-4 md:w-4 text-primary" />
          {t('checkout.hearOtherSongs')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 md:p-4">
        {songs.map((song, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
            <button 
              onClick={() => onTogglePlay(idx)}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
            >
              {currentlyPlaying === idx ? (
                <Pause className="h-4 w-4 text-primary fill-primary" />
              ) : (
                <Play className="h-4 w-4 text-primary fill-primary ml-0.5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{song.title}</p>
              <p className="text-xs text-muted-foreground">{t('checkout.orderedBy')} {song.orderedBy}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatTime(currentTimes[idx])} / {formatTime(durations[idx])}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
});

CheckoutAudioPreview.displayName = 'CheckoutAudioPreview';

