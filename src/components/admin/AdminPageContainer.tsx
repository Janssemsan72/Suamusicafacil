import { ReactNode } from "react";

interface AdminPageContainerProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actionButton?: ReactNode;
  className?: string;
}

/**
 * Container padrão para páginas admin com layout responsivo
 * Usa o mesmo padrão do AdminDashboard como referência
 */
export function AdminPageContainer({
  children,
  title,
  subtitle,
  actionButton,
  className = "",
}: AdminPageContainerProps) {
  return (
    <div className={`container mx-auto p-2 md:p-6 space-y-2 md:space-y-6 ${className}`}>
      {(title || actionButton) && (
        <div className="flex items-center justify-between mb-2 md:mb-4">
          {title && (
            <div>
              <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {actionButton && <div className="shrink-0">{actionButton}</div>}
        </div>
      )}
      {children}
    </div>
  );
}



