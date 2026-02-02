import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Calendar, DollarSign } from "@/lib/icons";
import { useNavigate } from "react-router-dom";

interface VirtualizedOrdersListProps {
  orders: any[];
  onViewDetails: (orderId: string) => void;
}

export function VirtualizedOrdersList({ orders, onViewDetails }: VirtualizedOrdersListProps) {
  const navigate = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);
  
  // ✅ OTIMIZAÇÃO: Virtualizar lista - renderizar apenas itens visíveis
  const virtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Altura estimada de cada card
    overscan: 5, // Renderizar 5 itens extras acima/abaixo da viewport
  });
  
  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      paid: { label: 'Pago', className: 'bg-green-500 text-white' },
      pending: { label: 'Pendente', className: 'bg-yellow-500 text-white' },
      refunded: { label: 'Reembolsado', className: 'bg-red-500 text-white' },
      cancelled: { label: 'Cancelado', className: 'bg-gray-500 text-white' },
    };
    
    const { label, className } = config[status] || { label: status, className: 'bg-gray-300' };
    return <Badge className={className}>{label}</Badge>;
  };
  
  return (
    <div
      ref={parentRef}
      style={{
        height: '600px',
        overflow: 'auto',
      }}
      className="border rounded-lg"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const order = orders[virtualRow.index];
          
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <Card className="m-2 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-medium truncate">
                          {order.customer_email || 'N/A'}
                        </p>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          R$ {((order.amount_cents || 0) / 100).toFixed(2)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {order.plan}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewDetails(order.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}














