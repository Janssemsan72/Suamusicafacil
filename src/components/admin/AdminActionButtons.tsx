import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminActionButtonsProps {
  children: ReactNode;
  orientation?: "horizontal" | "vertical";
  scrollable?: boolean;
  className?: string;
}

/**
 * Container para grupos de botões de ação
 * Responsivo com scroll horizontal em mobile quando necessário
 * Usa o mesmo padrão do AdminDashboard como referência
 */
export function AdminActionButtons({
  children,
  orientation = "horizontal",
  scrollable = false,
  className = "",
}: AdminActionButtonsProps) {
  return (
    <div
      className={cn(
        "flex",
        orientation === "horizontal" ? "flex-row gap-2" : "flex-col gap-2",
        scrollable && "overflow-x-auto pb-2",
        className
      )}
    >
      {children}
    </div>
  );
}



