import { useState, useCallback, useRef, useEffect } from 'react';

interface UseProgressBarOptions {
  initialValue?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  disabled?: boolean;
}

export function useProgressBar({
  initialValue = 0,
  max = 100,
  step = 1,
  onValueChange,
  disabled = false
}: UseProgressBarOptions = {}) {
  const [value, setValue] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

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

  // Função para atualizar valor
  const updateValue = useCallback((newValue: number) => {
    const clampedValue = Math.max(0, Math.min(newValue, max));
    setValue(clampedValue);
    onValueChange?.(clampedValue);
  }, [max, onValueChange]);

  // Handler para mouse/touch down
  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const newValue = getValueFromEvent(clientX);
    updateValue(newValue);
  }, [disabled, updateValue, getValueFromEvent]);

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
        updateValue(newValue);
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
  }, [isDragging, updateValue, getValueFromEvent]);

  // Função para formatar valor
  const formatValue = useCallback((val: number) => {
    return Math.round(val).toString();
  }, []);

  // Função para formatar porcentagem
  const formatPercentage = useCallback((val: number) => {
    return `${Math.round((val / max) * 100)}%`;
  }, [max]);

  return {
    value,
    setValue: updateValue,
    isDragging,
    hoverValue,
    isHovering,
    progressBarRef,
    handleStart,
    handleHover,
    handleLeave,
    formatValue,
    formatPercentage,
    percentage: (value / max) * 100,
    displayValue: isDragging ? value : (hoverValue ?? value),
    displayPercentage: isDragging ? (value / max) * 100 : (hoverValue ? (hoverValue / max) * 100 : (value / max) * 100)
  };
}
