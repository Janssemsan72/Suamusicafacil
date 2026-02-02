import * as React from "react";
import { cn } from "@/lib/utils";

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Prioridade alta para LCP - usa fetchpriority="high" e loading="eager" */
  priority?: boolean;
  /** Tamanhos responsivos para otimizar carregamento */
  sizes?: string;
}

const Image = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ className, loading, decoding, priority, sizes, ...props }, ref) => {
    return (
      <img
        ref={ref}
        loading={priority ? "eager" : loading ?? "lazy"}
        decoding={decoding ?? "async"}
        fetchpriority={priority ? "high" : undefined}
        sizes={sizes}
        className={cn(className)}
        {...props}
      />
    );
  }
);

Image.displayName = "Image";

export { Image };
