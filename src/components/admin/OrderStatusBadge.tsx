import { Badge } from "@/components/ui/badge";

interface OrderStatusBadgeProps {
  status: string;
  dataTestId?: string;
}

export function OrderStatusBadge({ status, dataTestId }: OrderStatusBadgeProps) {
  const variants: Record<string, { variant: any; label: string; className: string }> = {
    pending: { variant: "outline", label: "Pendente", className: "bg-yellow-500 text-white border-yellow-600" },
    paid: { variant: "outline", label: "Pago", className: "bg-green-600 text-white border-green-700" },
    cancelled: { variant: "outline", label: "Cancelado", className: "bg-gray-500 text-white border-gray-600" },
    refunded: { variant: "outline", label: "Reembolsado", className: "bg-blue-600 text-white border-blue-700" },
    failed: { variant: "outline", label: "Falhou", className: "bg-red-600 text-white border-red-700" },
  };

  const config = variants[status] || { variant: "outline", label: status, className: "bg-gray-500 text-white border-gray-600" };

  return (
    <Badge data-testid={dataTestId} variant={config.variant} className={`text-[10px] px-1.5 py-0 h-5 ${config.className}`}>
      {config.label}
    </Badge>
  );
}
