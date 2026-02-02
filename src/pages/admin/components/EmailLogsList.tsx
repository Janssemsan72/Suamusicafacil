import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmailLogDetailModal } from "./EmailLogDetailModal";
import { Search, Filter, Mail, CheckCircle, Clock, Eye, MousePointerClick, XCircle, AlertTriangle, Send } from "@/lib/icons";
import { format } from "date-fns";
import { SolidStatCard, ADMIN_CARD_COLORS } from "@/components/admin/SolidStatCard";

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

export function EmailLogsList() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    search: ""
  });

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_logs')
        .select('id, order_id, song_id, recipient_email, email_type, status, sent_at, opened_at, clicked_at, bounced_at, created_at')
        .order('sent_at', { ascending: false })
        .limit(100);

      if (filters.type !== "all") {
        query = query.eq('email_type', filters.type);
      }

      if (filters.status !== "all") {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.ilike('recipient_email', `%${filters.search}%`);
      }

      const { data, error } = await query;

      // ✅ CORREÇÃO: Tratar erros 400/404 graciosamente
      if (error) {
        const isTableNotFound = error.code === 'PGRST116' || 
                               error.code === '42P01' || 
                               error.code === '404' ||
                               error.message?.includes('does not exist') ||
                               error.message?.includes('relation') ||
                               error.message?.includes('not found');
        
        if (isTableNotFound || error.code === '400') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Tabela email_logs não encontrada, retornando array vazio:', error);
          }
          setLogs([]);
          return;
        }
        
        throw error;
      }
      
      setLogs(data || []);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Erro ao carregar logs:", error);
      }
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (log: EmailLog) => {
    if (log.bounced_at) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Bounced
        </Badge>
      );
    }
    if (log.clicked_at) {
      return (
        <Badge className="gap-1 bg-blue-500">
          <MousePointerClick className="h-3 w-3" />
          Clicked
        </Badge>
      );
    }
    if (log.opened_at) {
      return (
        <Badge className="gap-1 bg-green-500">
          <Eye className="h-3 w-3" />
          Opened
        </Badge>
      );
    }
    if (log.delivered_at) {
      return (
        <Badge className="gap-1 bg-emerald-500">
          <CheckCircle className="h-3 w-3" />
          Delivered
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Sent
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      order_paid: "Pedido Pago",
      music_released: "Música Liberada",
      failed_notification: "Falha",
      test: "Teste"
    };
    return labels[type] || type;
  };

  const stats = useMemo(() => {
    return {
      total: logs.length,
      delivered: logs.filter(l => l.delivered_at).length,
      opened: logs.filter(l => l.opened_at).length,
      bounced: logs.filter(l => l.bounced_at).length
    };
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-brown-dark-400 mb-1">Logs de Email</h1>
          <p className="text-muted-foreground">Histórico de envios e status de entrega</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SolidStatCard title="Enviados" value={stats.total.toString()} icon={Send} color={ADMIN_CARD_COLORS.blue} description="Total processado" />
        <SolidStatCard title="Entregues" value={stats.delivered.toString()} icon={CheckCircle} color={ADMIN_CARD_COLORS.green} description="Recebidos com sucesso" />
        <SolidStatCard title="Abertos" value={stats.opened.toString()} icon={Eye} color={ADMIN_CARD_COLORS.teal} description="Visualizados pelo usuário" />
        <SolidStatCard title="Falhas" value={stats.bounced.toString()} icon={XCircle} color={ADMIN_CARD_COLORS.red} description="Erros de entrega" />
      </div>

      <Card className="apple-card admin-card-compact">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" />
            Lista de Envios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por email..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-14"
                  style={{ paddingLeft: '3.5rem' }}
                />
              </div>
            </div>
            <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="order_paid">Pedido Pago</SelectItem>
                <SelectItem value="music_released">Música Liberada</SelectItem>
                <SelectItem value="failed_notification">Falha</SelectItem>
                <SelectItem value="test">Teste</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="opened">Aberto</SelectItem>
                <SelectItem value="clicked">Clicado</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum email encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.sent_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(log.email_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.recipient_email}</TableCell>
                      <TableCell>{getStatusBadge(log)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedLog && (
        <EmailLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}