/**
 * AdminEmailMetrics - Dashboard de Métricas de Email
 * 
 * Exibe métricas de deliverability:
 * - Taxa de entrega
 * - Taxa de bounces
 * - Taxa de complaints
 * - Taxa de abertura (se disponível)
 * - Taxa de cliques (se disponível)
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";

interface EmailMetrics {
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
  openRate: number;
  clickRate: number;
}

interface MetricsByTemplate {
  template_type: string;
  total: number;
  delivered: number;
  bounced: number;
  complained: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
}

export default function AdminEmailMetrics() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Calcular data inicial baseado no range
  const getStartDate = () => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        now.setDate(now.getDate() - 7);
        break;
      case '30d':
        now.setDate(now.getDate() - 30);
        break;
      case '90d':
        now.setDate(now.getDate() - 90);
        break;
      case 'all':
        return null;
    }
    return now.toISOString();
  };

  // Buscar métricas gerais
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['email-metrics', dateRange],
    queryFn: async () => {
      const startDate = getStartDate();
      
      let query = supabase
        .from('email_logs')
        .select('status', { count: 'exact' });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      const { data, error, count } = await query;

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
            console.warn('Tabela email_logs não encontrada, retornando métricas zeradas:', error);
          }
          // Retornar métricas zeradas se a tabela não existir
          return {
            total: 0,
            sent: 0,
            delivered: 0,
            bounced: 0,
            complained: 0,
            opened: 0,
            clicked: 0,
            deliveryRate: 0,
            bounceRate: 0,
            complaintRate: 0,
            openRate: 0,
            clickRate: 0,
          };
        }
        
        throw error;
      }

      // Contar por status
      const statusCounts = (data || []).reduce((acc: Record<string, number>, item: any) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});

      const total = count || 0;
      const sent = total;
      const delivered = statusCounts['delivered'] || 0;
      const bounced = statusCounts['bounced'] || 0;
      const complained = statusCounts['complained'] || 0;
      const opened = statusCounts['opened'] || 0;
      const clicked = statusCounts['clicked'] || 0;

      const metrics: EmailMetrics = {
        total,
        sent,
        delivered,
        bounced,
        complained,
        opened,
        clicked,
        deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
        bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
        complaintRate: sent > 0 ? (complained / sent) * 100 : 0,
        openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
        clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
      };

      return metrics;
    },
  });

  // Buscar métricas por template
  const { data: metricsByTemplate, isLoading: loadingByTemplate } = useQuery({
    queryKey: ['email-metrics-by-template', dateRange],
    queryFn: async () => {
      const startDate = getStartDate();
      
      let query = supabase
        .from('email_logs')
        .select('email_type, status');

      if (startDate) {
        query = query.gte('created_at', startDate);
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
            console.warn('Tabela email_logs não encontrada, retornando métricas por template vazias:', error);
          }
          return [];
        }
        
        throw error;
      }

      // Agrupar por template_type
      const byTemplate: Record<string, { total: number; delivered: number; bounced: number; complained: number }> = {};

      (data || []).forEach((item: any) => {
        const template = item.email_type || 'unknown';
        if (!byTemplate[template]) {
          byTemplate[template] = { total: 0, delivered: 0, bounced: 0, complained: 0 };
        }
        byTemplate[template].total++;
        if (item.status === 'delivered') byTemplate[template].delivered++;
        if (item.status === 'bounced') byTemplate[template].bounced++;
        if (item.status === 'complained') byTemplate[template].complained++;
      });

      const result: MetricsByTemplate[] = Object.entries(byTemplate).map(([template_type, counts]) => ({
        template_type,
        ...counts,
        deliveryRate: counts.total > 0 ? (counts.delivered / counts.total) * 100 : 0,
        bounceRate: counts.total > 0 ? (counts.bounced / counts.total) * 100 : 0,
        complaintRate: counts.total > 0 ? (counts.complained / counts.total) * 100 : 0,
      }));

      return result.sort((a, b) => b.total - a.total);
    },
  });

  // Buscar unsubscribes
  const { data: unsubscribes } = useQuery({
    queryKey: ['email-unsubscribes', dateRange],
    queryFn: async () => {
      const startDate = getStartDate();
      
      let query = supabase
        .from('email_unsubscribes')
        .select('*', { count: 'exact' });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      const { count, error } = await query;

      if (error) throw error;

      return count || 0;
    },
  });

  if (loadingMetrics || loadingByTemplate) {
    return <AdminPageLoading />;
  }

  const getStatusColor = (rate: number, type: 'delivery' | 'bounce' | 'complaint') => {
    if (type === 'delivery') {
      if (rate >= 95) return 'text-green-600';
      if (rate >= 90) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (type === 'bounce') {
      if (rate <= 2) return 'text-green-600';
      if (rate <= 5) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (type === 'complaint') {
      if (rate <= 0.1) return 'text-green-600';
      if (rate <= 0.5) return 'text-yellow-600';
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const getStatusBadge = (rate: number, type: 'delivery' | 'bounce' | 'complaint') => {
    if (type === 'delivery') {
      if (rate >= 95) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
      if (rate >= 90) return <Badge className="bg-yellow-100 text-yellow-800">Bom</Badge>;
      return <Badge className="bg-red-100 text-red-800">Precisa Melhorar</Badge>;
    }
    if (type === 'bounce') {
      if (rate <= 2) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
      if (rate <= 5) return <Badge className="bg-yellow-100 text-yellow-800">Aceitável</Badge>;
      return <Badge className="bg-red-100 text-red-800">Alto</Badge>;
    }
    if (type === 'complaint') {
      if (rate <= 0.1) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
      if (rate <= 0.5) return <Badge className="bg-yellow-100 text-yellow-800">Aceitável</Badge>;
      return <Badge className="bg-red-100 text-red-800">Alto</Badge>;
    }
    return null;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Métricas de Email</h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe a deliverability e performance dos seus emails
          </p>
        </div>
        <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
              <CardDescription>Emails entregues com sucesso</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: getStatusColor(metrics.deliveryRate, 'delivery') }}>
                {metrics.deliveryRate.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {metrics.delivered.toLocaleString()} de {metrics.sent.toLocaleString()} emails
              </div>
              {getStatusBadge(metrics.deliveryRate, 'delivery')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Taxa de Bounces</CardTitle>
              <CardDescription>Emails que falharam ao entregar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: getStatusColor(metrics.bounceRate, 'bounce') }}>
                {metrics.bounceRate.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {metrics.bounced.toLocaleString()} bounces
              </div>
              {getStatusBadge(metrics.bounceRate, 'bounce')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Taxa de Complaints</CardTitle>
              <CardDescription>Emails reportados como spam</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: getStatusColor(metrics.complaintRate, 'complaint') }}>
                {metrics.complaintRate.toFixed(3)}%
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {metrics.complained.toLocaleString()} complaints
              </div>
              {getStatusBadge(metrics.complaintRate, 'complaint')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Unsubscribes</CardTitle>
              <CardDescription>Emails que optaram por sair</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-600">
                {unsubscribes?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Total de unsubscribes
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {metrics && (metrics.opened > 0 || metrics.clicked > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Taxa de Abertura</CardTitle>
              <CardDescription>Emails abertos pelos destinatários</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {metrics.openRate.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {metrics.opened.toLocaleString()} aberturas
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Taxa de Cliques</CardTitle>
              <CardDescription>Links clicados nos emails</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {metrics.clickRate.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {metrics.clicked.toLocaleString()} cliques
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {metricsByTemplate && metricsByTemplate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Métricas por Template</CardTitle>
            <CardDescription>Performance detalhada por tipo de email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Template</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Entregues</th>
                    <th className="text-right p-2">Taxa Entrega</th>
                    <th className="text-right p-2">Bounces</th>
                    <th className="text-right p-2">Taxa Bounce</th>
                    <th className="text-right p-2">Complaints</th>
                    <th className="text-right p-2">Taxa Complaint</th>
                  </tr>
                </thead>
                <tbody>
                  {metricsByTemplate.map((template) => (
                    <tr key={template.template_type} className="border-b">
                      <td className="p-2 font-medium">{template.template_type}</td>
                      <td className="p-2 text-right">{template.total.toLocaleString()}</td>
                      <td className="p-2 text-right">{template.delivered.toLocaleString()}</td>
                      <td className={`p-2 text-right font-medium ${getStatusColor(template.deliveryRate, 'delivery')}`}>
                        {template.deliveryRate.toFixed(1)}%
                      </td>
                      <td className="p-2 text-right">{template.bounced.toLocaleString()}</td>
                      <td className={`p-2 text-right font-medium ${getStatusColor(template.bounceRate, 'bounce')}`}>
                        {template.bounceRate.toFixed(2)}%
                      </td>
                      <td className="p-2 text-right">{template.complained.toLocaleString()}</td>
                      <td className={`p-2 text-right font-medium ${getStatusColor(template.complaintRate, 'complaint')}`}>
                        {template.complaintRate.toFixed(3)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Metas de Deliverability</CardTitle>
          <CardDescription>Padrões recomendados pela indústria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Taxa de Entrega:</span>
              <span className="font-medium">≥ 95% (Excelente)</span>
            </div>
            <div className="flex justify-between">
              <span>Taxa de Bounces:</span>
              <span className="font-medium">≤ 2% (Excelente)</span>
            </div>
            <div className="flex justify-between">
              <span>Taxa de Complaints:</span>
              <span className="font-medium">≤ 0.1% (Excelente)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

