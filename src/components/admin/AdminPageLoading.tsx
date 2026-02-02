import { RefreshCw } from "@/lib/icons";

interface AdminPageLoadingProps {
  text?: string;
  className?: string;
}

/**
 * ✅ Componente de loading unificado para todas as páginas admin
 * Garante consistência visual e evita múltiplos loadings
 */
export function AdminPageLoading({ 
  text = "Carregando...", 
  className = "" 
}: AdminPageLoadingProps) {
  return (
    <div className={`flex items-center justify-center min-h-[60vh] ${className}`}>
      <div className="text-center space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

