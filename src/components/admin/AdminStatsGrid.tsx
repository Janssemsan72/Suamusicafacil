import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminStatsGridProps {
  children: ReactNode;
  cols?: {
    mobile?: 1 | 2;
    tablet?: 2 | 3 | 4;
    desktop?: 3 | 4 | 5 | 6;
  };
  gap?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Grid responsivo para cards de estatísticas
 * Usa o mesmo padrão do AdminDashboard como referência
 * 
 * @example
 * <AdminStatsGrid cols={{ mobile: 2, desktop: 4 }}>
 *   <Card>...</Card>
 *   <Card>...</Card>
 * </AdminStatsGrid>
 */
export function AdminStatsGrid({
  children,
  cols = { mobile: 2, desktop: 4 },
  gap = "md",
  className = "",
}: AdminStatsGridProps) {
  const gapClasses = {
    sm: "gap-1 md:gap-2",
    md: "gap-2 md:gap-4",
    lg: "gap-4 md:gap-6",
  };

  // Mapear valores para classes Tailwind completas
  const gridColsMap = {
    mobile: {
      1: "grid-cols-1",
      2: "grid-cols-2",
    },
    tablet: {
      2: "md:grid-cols-2",
      3: "md:grid-cols-3",
      4: "md:grid-cols-4",
    },
    desktop: {
      3: "lg:grid-cols-3",
      4: "lg:grid-cols-4",
      5: "lg:grid-cols-5",
      6: "lg:grid-cols-6",
    },
  };

  const mobileCol = gridColsMap.mobile[cols.mobile || 2];
  const tabletCol = cols.tablet ? gridColsMap.tablet[cols.tablet] : "";
  const desktopCol = cols.desktop ? gridColsMap.desktop[cols.desktop] : "";

  return (
    <div
      className={cn(
        "grid",
        mobileCol,
        tabletCol,
        desktopCol,
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}

