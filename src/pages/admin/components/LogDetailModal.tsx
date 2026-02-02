import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, ExternalLink, AlertCircle, CheckCircle, Clock } from "@/lib/icons";
import { toast } from "sonner";
import { format } from "date-fns";

interface CheckoutEvent {
  id: string;
  transaction_id: string;
  order_id: string | null;
  event_type: string;
  payload: any;
  error: string | null;
  created_at: string;
}

interface AdminLog {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  changes: any;
  created_at: string;
}

interface LogDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: CheckoutEvent | AdminLog | null;
  type: 'checkout' | 'admin';
}

export function LogDetailModal({ open, onOpenChange, log, type }: LogDetailModalProps) {
  if (!log) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const copyFullJSON = () => {
    const json = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(json);
    toast.success("JSON completo copiado!");
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), "dd/MM/yyyy 'às' HH:mm:ss");
  };

  const renderCheckoutEvent = (event: CheckoutEvent) => (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ID do Evento</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">{event.id}</code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(event.id, "ID")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Transaction ID</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {event.transaction_id}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(event.transaction_id, "Transaction ID")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {event.order_id && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Order ID</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">{event.order_id}</code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(event.order_id!, "Order ID")}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => window.open(`/admin/orders/${event.order_id}`, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Ver Order
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tipo de Evento</p>
            <Badge variant={event.error ? "destructive" : "default"}>
              {event.error && <AlertCircle className="h-3 w-3 mr-1" />}
              {!event.error && <CheckCircle className="h-3 w-3 mr-1" />}
              {event.event_type}
            </Badge>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Data/Hora</p>
            <div className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {formatTimestamp(event.created_at)}
            </div>
          </div>
        </div>

        {event.error && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Erro</p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-xs text-destructive font-mono">{event.error}</p>
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Payload</p>
            <Button
              variant="outline"
              size="sm"
              onClick={copyFullJSON}
              className="h-7 text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar JSON
            </Button>
          </div>
          <ScrollArea className="h-[300px] w-full rounded-md border">
            <pre className="p-4 text-xs">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </ScrollArea>
        </div>
      </div>
    </>
  );

  const renderAdminLog = (log: AdminLog) => (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ID do Log</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">{log.id}</code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(log.id, "ID")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {log.admin_user_id && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Admin User ID</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {log.admin_user_id}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(log.admin_user_id!, "Admin User ID")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Ação</p>
            <Badge variant="outline">{log.action}</Badge>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tabela</p>
            <code className="text-xs bg-muted px-2 py-1 rounded">{log.target_table}</code>
          </div>
        </div>

        {log.target_id && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Target ID</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">{log.target_id}</code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(log.target_id!, "Target ID")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Data/Hora</p>
          <div className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {formatTimestamp(log.created_at)}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Alterações</p>
            <Button
              variant="outline"
              size="sm"
              onClick={copyFullJSON}
              className="h-7 text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar JSON
            </Button>
          </div>
          <ScrollArea className="h-[300px] w-full rounded-md border">
            <pre className="p-4 text-xs">
              {JSON.stringify(log.changes, null, 2)}
            </pre>
          </ScrollArea>
        </div>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {type === 'checkout' ? 'Detalhes do Evento' : 'Detalhes do Log Admin'}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)]">
          {type === 'checkout' ? renderCheckoutEvent(log as CheckoutEvent) : renderAdminLog(log as AdminLog)}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
