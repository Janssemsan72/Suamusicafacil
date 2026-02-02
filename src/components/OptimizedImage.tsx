import { memo, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  width?: number;
  height?: number;
}

const OptimizedImage = memo<OptimizedImageProps>(({
  src,
  alt,
  className,
  loading = 'lazy',
  placeholder,
  onLoad,
  onError,
  width,
  height
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // ✅ FALLBACK: Se a imagem não carregar em 1 segundo, força a exibição
  useEffect(() => {
    if (!isLoaded && !hasError) {
      const timeout = setTimeout(() => {
        console.log('⏱️ Timeout: forçando exibição da imagem');
        setIsLoaded(true);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isLoaded, hasError, src]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center z-0">
          <div className="w-8 h-8 rounded-full bg-muted-foreground/20" />
        </div>
      )}
      
      {hasError ? (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <div className="text-muted-foreground text-sm">Erro ao carregar imagem</div>
        </div>
      ) : (
        <picture className="block w-full h-full">
          {/* ✅ OTIMIZAÇÃO: WebP com srcset para múltiplos tamanhos (responsivo) */}
          {src.match(/\.(jpg|jpeg|png)$/i) && width && height && (
            <>
              <source 
                srcSet={`
                  ${src.replace(/\.(jpg|jpeg|png)$/i, '-400w.webp')} 400w,
                  ${src.replace(/\.(jpg|jpeg|png)$/i, '-800w.webp')} 800w,
                  ${src.replace(/\.(jpg|jpeg|png)$/i, '-1200w.webp')} 1200w
                `}
                sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px"
                type="image/webp"
              />
              <source 
                srcSet={(() => {
                  const ext = src.match(/\.(jpg|jpeg|png)$/i)?.[1]?.toLowerCase() || 'jpg';
                  const normalizedExt = ext === 'jpg' ? 'jpeg' : ext;
                  return `
                    ${src.replace(/\.(jpg|jpeg|png)$/i, `-400w.${normalizedExt}`)} 400w,
                    ${src.replace(/\.(jpg|jpeg|png)$/i, `-800w.${normalizedExt}`)} 800w,
                    ${src.replace(/\.(jpg|jpeg|png)$/i, `-1200w.${normalizedExt}`)} 1200w
                  `;
                })()}
                sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px"
                type={`image/${(() => {
                  const ext = src.match(/\.(jpg|jpeg|png)$/i)?.[1]?.toLowerCase() || 'jpg';
                  return ext === 'jpg' ? 'jpeg' : ext;
                })()}`}
              />
            </>
          )}
          {/* Fallback para imagens sem srcset */}
          {(!width || !height || !src.match(/\.(jpg|jpeg|png)$/i)) && src.match(/\.(jpg|jpeg|png)$/i) && (
            <source 
              srcSet={src.replace(/\.(jpg|jpeg|png)$/i, '.webp')} 
              type="image/webp"
            />
          )}
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading={loading}
            decoding="async"
            onLoad={handleLoad}
            onError={(e) => {
              console.error('❌ Erro ao carregar imagem:', src, e);
              handleError();
            }}
            className={cn(
              'transition-opacity duration-300 w-full h-auto object-contain relative z-10',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
            style={{
              ...(placeholder ? {
              backgroundImage: `url(${placeholder})`,
              backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(20px)',
                transform: 'scale(1.1)'
              } : {}),
              ...(width && height ? {
                aspectRatio: `${width} / ${height}`
              } : { minHeight: '200px' })
            }}
          />
        </picture>
      )}
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
