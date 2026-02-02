import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface EnhancedProgressProps {
  value: number;
  max?: number;
  onValueChange?: (value: number) => void;
  className?: string;
  showTooltip?: boolean;
  showLabels?: boolean;
  labelFormatter?: (value: number) => string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  showThumb?: boolean;
  step?: number;
}

const EnhancedProgress = memo<EnhancedProgressProps>(({
  value,
  max = 100,
  onValueChange,
  className,
  showTooltip = true,
  showLabels = false,
  labelFormatter,
  disabled = false,
  size = 'md',
  variant = 'default',
  showThumb = true,
  step = 1
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  
  const percentage = (value / max) * 100;
  const clampedValue = Math.max(0, Math.min(value, max));

  // Função para calcular posição baseada em coordenadas
  const getValueFromEvent = useCallback((clientX: number) => {
    if (!progressBarRef.current) return 0;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newValue = percentage * max;
    
    // Aplicar step se definido
    if (step > 0) {
      return Math.round(newValue / step) * step;
    }
    
    return newValue;
  }, [max, step]);

  // Função para formatar valor
  const formatValue = useCallback((val: number) => {
    if (labelFormatter) {
      return labelFormatter(val);
    }
    return Math.round(val).toString();
  }, [labelFormatter]);

  // Handler para mouse/touch down
  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const newValue = getValueFromEvent(clientX);
    onValueChange?.(Math.max(0, Math.min(newValue, max)));
  }, [disabled, onValueChange, max, getValueFromEvent]);

  // Handler para hover
  const handleHover = useCallback((e: React.MouseEvent) => {
    if (disabled || isDragging) return;
    
    const newValue = getValueFromEvent(e.clientX);
    setHoverValue(newValue);
    setIsHovering(true);
  }, [disabled, isDragging, getValueFromEvent]);

  const handleLeave = useCallback(() => {
    setIsHovering(false);
    setHoverValue(null);
  }, []);

  // Event listeners globais para drag
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const newValue = getValueFromEvent(clientX);
        onValueChange?.(Math.max(0, Math.min(newValue, max)));
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
  }, [isDragging, onValueChange, max, getValueFromEvent]);

  const displayValue = isDragging ? clampedValue : (hoverValue ?? clampedValue);
  const displayPercentage = (displayValue / max) * 100;

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
      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{formatValue(0)}</span>
          <span>{formatValue(max)}</span>
        </div>
      )}
      
      {/* Progress bar container */}
      <div className="relative">
        <div
          ref={progressBarRef}
          className={cn(
            'relative w-full rounded-full cursor-pointer transition-all duration-200',
            sizeClasses[size],
            disabled 
              ? 'opacity-50 cursor-not-allowed bg-muted' 
              : 'bg-border hover:bg-border/80 active:bg-border/90',
            isDragging && 'bg-border/90'
          )}
          onMouseDown={handleStart}
          onTouchStart={handleStart}
          onMouseMove={handleHover}
          onMouseLeave={handleLeave}
        >
          {/* Progress fill */}
          <div
            className={cn(
              'absolute left-0 top-0 h-full rounded-full transition-all duration-100 ease-out',
              variantClasses[variant]
            )}
            style={{ width: `${displayPercentage}%` }}
          />
          
          {/* Progress thumb */}
          {showThumb && (
            <div
              ref={thumbRef}
              className={cn(
                'absolute top-1/2 rounded-full shadow-lg transition-all duration-100 ease-out transform -translate-y-1/2 cursor-grab active:cursor-grabbing',
                thumbSizes[size],
                variantClasses[variant],
                disabled ? 'opacity-0' : 'opacity-100',
                isDragging && 'scale-125 shadow-xl',
                isHovering && !isDragging && 'scale-110'
              )}
              style={{ left: `calc(${displayPercentage}% - ${size === 'sm' ? '6px' : size === 'md' ? '10px' : '12px'})` }}
            />
          )}
        </div>
        
        {/* Tooltip */}
        {showTooltip && isHovering && hoverValue !== null && !isDragging && !disabled && (
          <div
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-10"
            style={{ left: `${displayPercentage}%` }}
          >
            {formatValue(hoverValue)}
          </div>
        )}
      </div>
    </div>
  );
});

EnhancedProgress.displayName = 'EnhancedProgress';

export { EnhancedProgress };
