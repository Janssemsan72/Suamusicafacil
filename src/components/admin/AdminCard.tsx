import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AdminCardProps {
  children: ReactNode;
  title?: string;
  headerAction?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  compact?: boolean;
  overflowHidden?: boolean;
}

/**
 * Card padrão para páginas admin com padding responsivo
 * Usa o mesmo padrão do AdminDashboard como referência
 */
export function AdminCard({
  children,
  title,
  headerAction,
  className = "",
  headerClassName = "",
  contentClassName = "",
  compact = true,
  overflowHidden = true,
}: AdminCardProps) {
  return (
    <Card
      className={cn(
        "apple-card",
        compact && "admin-card-compact",
        overflowHidden && "overflow-hidden",
        "border border-white/30 z-0",
        "rounded-[20px]",
        "bg-white/95 backdrop-blur-[20px]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.04)]",
        "transition-all duration-300 ease-out",
        "hover:shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.12),0_16px_32px_rgba(0,0,0,0.06)]",
        "hover:-translate-y-0.5 hover:scale-[1.01]",
        className
      )}
    >
      {title && (
        <CardHeader
          className={cn(
            "pb-2 md:pb-3 p-4 md:p-6 relative z-10 border-b border-border/50",
            headerClassName
          )}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-base font-semibold text-foreground tracking-tight">
              {title}
            </CardTitle>
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent
        className={cn(
          title ? "p-4 pt-4 md:p-6 md:pt-6" : "p-4 md:p-6",
          "relative z-10",
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}



