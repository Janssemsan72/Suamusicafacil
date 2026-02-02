import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AudioProgressBarEnhancedProps {
  current: number;
  duration: number;
  isLoaded: boolean;
  onSeek: (time: number) => void;
  className?: string;
  showTooltip?: boolean;
  showTimeLabels?: boolean;
  showBuffered?: boolean;
  bufferedRanges?: Array<{ start: number; end: number }>;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const AudioProgressBarEnhanced = memo<AudioProgressBarEnhancedProps>(({
  current,
  duration,
  isLoaded,
  onSeek,
  className,
  showTooltip = true,
  showTimeLabels = true,
  showBuffered = false,
  bufferedRanges = [],
  disabled = false,
  size = 'md',
  variant = 'default'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  
  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const isDisabled = disabled || !isLoaded || duration === 0;

  // Função para calcular posição baseada em coordenadas
  const getPositionFromEvent = useCallback((clientX: number) => {
    if (!progressBarRef.current) return 0;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  }, [duration]);

  // Função para formatar tempo
  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Handler para mouse/touch down
  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isDisabled) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const newTime = getPositionFromEvent(clientX);
    onSeek(Math.max(0, Math.min(newTime, duration)));
  }, [isDisabled, onSeek, duration, getPositionFromEvent]);

  // Handler para hover
  const handleHover = useCallback((e: React.MouseEvent) => {
    if (isDisabled || isDragging) return;
    
    const newTime = getPositionFromEvent(e.clientX);
    setHoverTime(newTime);
    setIsHovering(true);
  }, [isDisabled, isDragging, getPositionFromEvent]);

  const handleLeave = useCallback(() => {
    setIsHovering(false);
    setHoverTime(null);
  }, []);

  // Event listeners globais para drag
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const newTime = getPositionFromEvent(clientX);
        onSeek(Math.max(0, Math.min(newTime, duration)));
      };

      const handleGlobalEnd = () => {
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleGlobalMove);
      document.addEventListener('mouseup', handleGlobalEnd);
      document.addEventListener('touchmove', handleGlobalMove, { passive: false });
      document.addEventListener('touchend', handleGlobalEnd);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMove);
        document.removeEventListener('mouseup', handleGlobalEnd);
        document.removeEventListener('touchmove', handleGlobalMove);
        document.removeEventListener('touchend', handleGlobalEnd);
      };
    }
  }, [isDragging, onSeek, duration, getPositionFromEvent]);

  const displayTime = isDragging ? current : (hoverTime ?? current);
  const displayProgress = isDragging ? progress : (hoverTime ? (hoverTime / duration) * 100 : progress);

  // Variantes de cor
  const variantClasses = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    destructive: 'bg-red-500'
  };

  // Tamanhos
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const thumbSizes = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Time labels */}
      {showTimeLabels && (
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}
      
      {/* Progress bar container */}
      <div className="relative">
        <div
          ref={progressBarRef}
          className={cn(
            'relative w-full rounded-full cursor-pointer transition-all duration-200',
            sizeClasses[size],
            isDisabled 
              ? 'opacity-50 cursor-not-allowed bg-muted' 
              : 'bg-border hover:bg-border/80 active:bg-border/90',
            isDragging && 'bg-border/90'
          )}
          onMouseDown={handleStart}
          onTouchStart={handleStart}
          onMouseMove={handleHover}
          onMouseLeave={handleLeave}
        >
          {/* Buffered ranges */}
          {showBuffered && bufferedRanges.length > 0 && (
            <>
              {bufferedRanges.map((range, index) => (
                <div
                  key={index}
                  className="absolute top-0 h-full bg-muted-foreground/30 rounded-full"
                  style={{
                    left: `${(range.start / duration) * 100}%`,
                    width: `${((range.end - range.start) / duration) * 100}%`
                  }}
                />
              ))}
            </>
          )}
          
          {/* Progress fill */}
          <div
            className={cn(
              'absolute left-0 top-0 h-full rounded-full transition-all duration-100 ease-out',
              variantClasses[variant]
            )}
            style={{ width: `${displayProgress}%` }}
          />
          
          {/* Progress thumb */}
          <div
            ref={thumbRef}
            className={cn(
              'absolute top-1/2 rounded-full shadow-lg transition-all duration-100 ease-out transform -translate-y-1/2 cursor-grab active:cursor-grabbing',
              thumbSizes[size],
              variantClasses[variant],
              isDisabled ? 'opacity-0' : 'opacity-100',
              isDragging && 'scale-125 shadow-xl',
              isHovering && !isDragging && 'scale-110'
            )}
            style={{ left: `calc(${displayProgress}% - ${size === 'sm' ? '6px' : size === 'md' ? '10px' : '12px'})` }}
          />
        </div>
        
        {/* Tooltip */}
        {showTooltip && isHovering && hoverTime !== null && !isDragging && !isDisabled && (
          <div
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-10"
            style={{ left: `${displayProgress}%` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>
    </div>
  );
});

AudioProgressBarEnhanced.displayName = 'AudioProgressBarEnhanced';

export default AudioProgressBarEnhanced;
