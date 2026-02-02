import { Badge } from "@/components/ui/badge";

interface JobStatusBadgeProps {
  status: string;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const variants: Record<string, { variant: any; label: string }> = {
    pending: { variant: "secondary", label: "Pendente" },
    processing: { variant: "default", label: "Processando" },
    completed: { variant: "outline", label: "Concluído" },
    failed: { variant: "destructive", label: "Falhou" },
  };

  const config = variants[status] || { variant: "secondary", label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
