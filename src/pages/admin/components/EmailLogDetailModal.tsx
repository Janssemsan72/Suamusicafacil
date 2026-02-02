import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Mail, Clock, CheckCircle, Eye, MousePointerClick, XCircle } from "@/lib/icons";

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  status: string;
  sent_at: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  bounce_reason?: string;
  resend_email_id?: string;
  metadata?: any;
}

interface EmailLogDetailModalProps {
  log: EmailLog;
  onClose: () => void;
}

export function EmailLogDetailModal({ log, onClose }: EmailLogDetailModalProps) {
  const events = [
    { icon: Mail, label: "Enviado", timestamp: log.sent_at, variant: "default" },
    log.delivered_at && { icon: CheckCircle, label: "Entregue", timestamp: log.delivered_at, variant: "success" },
    log.opened_at && { icon: Eye, label: "Aberto", timestamp: log.opened_at, variant: "success" },
    log.clicked_at && { icon: MousePointerClick, label: "Clicado", timestamp: log.clicked_at, variant: "success" },
    log.bounced_at && { icon: XCircle, label: "Bounced", timestamp: log.bounced_at, variant: "destructive" },
  ].filter(Boolean);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Detalhes do Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info básica */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Destinatário</p>
              <p className="font-mono">{log.recipient_email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <Badge variant="outline">{log.email_type}</Badge>
            </div>
            {log.resend_email_id && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Resend Email ID</p>
                <p className="font-mono text-sm">{log.resend_email_id}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Timeline de eventos */}
          <div>
            <h3 className="font-semibold mb-4">Timeline de Eventos</h3>
            <div className="space-y-4">
              {events.map((event: any, index) => {
                const Icon = event.icon;
                return (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      event.variant === 'success' ? 'bg-green-100 text-green-600' :
                      event.variant === 'destructive' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{event.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(event.timestamp), "dd/MM/yyyy 'às' HH:mm:ss")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {log.bounce_reason && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2 text-destructive">Motivo do Bounce</h3>
                <p className="text-sm bg-destructive/10 p-3 rounded-md">{log.bounce_reason}</p>
              </div>
            </>
          )}

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Metadados</h3>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}