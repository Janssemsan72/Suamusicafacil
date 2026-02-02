import { Badge } from "@/components/ui/badge";

interface SongStatusBadgeProps {
  status: string;
}

export function SongStatusBadge({ status }: SongStatusBadgeProps) {
  const variants: Record<string, { variant: any; label: string }> = {
    pending: { variant: "secondary", label: "Pendente" },
    generating: { variant: "default", label: "Gerando" },
    processing: { variant: "default", label: "Processando" },
    ready: { variant: "outline", label: "Pronta" },
    released: { variant: "default", label: "Liberada" },
    failed: { variant: "destructive", label: "Falhou" },
  };

  const config = variants[status] || { variant: "secondary", label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
