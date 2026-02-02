import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, 
  Globe, 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Shield,
  Eye,
  Download,
  Calendar,
  MapPin,
  Flag } from "@/lib/icons";
import { useTranslation } from '@/hooks/useTranslation';
import { ADMIN_CARD_COLORS, SolidStatCard } from "@/components/admin/SolidStatCard";

interface RegionalAnalytics {
  region: string;
  country: string;
  totalOrders: number;
  totalRevenue: number;
  currency: string;
  avgOrderValue: number;
  conversionRate: number;
  suspiciousActivity: number;
  lastOrder: string;
  topCountries: Array<{
    country: string;
    orders: number;
    revenue: number;
  }>;
}

interface SuspiciousActivity {
  id: string;
  ip_address_hash: string;
  detected_country: string;
  locked_region: string;
  suspicious_activity: boolean;
  activity_type: string;
  created_at: string;
  order_id?: string;
}

export default function AdminRegionalAnalytics() {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState<RegionalAnalytics[]>([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedRegion, setSelectedRegion] = useState('all');

  const periods = [
    { key: '1d', label: 'Último dia' },
    { key: '7d', label: 'Últimos 7 dias' },
    { key: '30d', label: 'Últimos 30 dias' },
    { key: '90d', label: 'Últimos 90 dias' }
  ];

  const regions = [
    { key: 'all', label: 'Todas as regiões', flag: '🌍' },
    { key: 'brasil', label: 'Brasil', flag: '🇧🇷' },
    { key: 'usa', label: 'Estados Unidos', flag: '🇺🇸' },
    { key: 'internacional', label: 'Internacional', flag: '🌍' }
  ];

  useEffect(() => {
    loadAnalytics();
    loadSuspiciousActivities();
  }, [selectedPeriod, selectedRegion]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // Simular dados de analytics
      const mockAnalytics: RegionalAnalytics[] = [
        {
          region: 'brasil',
          country: 'BR',
          totalOrders: 45,
          totalRevenue: 305955, // R$ 3.059,55
          currency: 'BRL',
          avgOrderValue: 4790,
          conversionRate: 12.5,
          suspiciousActivity: 2,
          lastOrder: '2025-01-22T10:30:00Z',
          topCountries: [
            { country: 'BR', orders: 45, revenue: 305955 },
            { country: 'US', orders: 3, revenue: 5997 },
            { country: 'AR', orders: 1, revenue: 1999 }
          ]
        },
        {
          region: 'usa',
          country: 'US',
          totalOrders: 23,
          totalRevenue: 45977, // $459,77
          currency: 'USD',
          avgOrderValue: 1999,
          conversionRate: 8.3,
          suspiciousActivity: 1,
          lastOrder: '2025-01-22T09:15:00Z',
          topCountries: [
            { country: 'US', orders: 20, revenue: 39980 },
            { country: 'CA', orders: 2, revenue: 3998 },
            { country: 'GB', orders: 1, revenue: 1999 }
          ]
        },
        {
          region: 'internacional',
          country: 'ES',
          totalOrders: 18,
          totalRevenue: 35982, // $359,82
          currency: 'USD',
          avgOrderValue: 1999,
          conversionRate: 6.7,
          suspiciousActivity: 3,
          lastOrder: '2025-01-22T08:45:00Z',
          topCountries: [
            { country: 'ES', orders: 8, revenue: 15992 },
            { country: 'MX', orders: 5, revenue: 9995 },
            { country: 'AR', orders: 3, revenue: 5997 },
            { country: 'CO', orders: 2, revenue: 3998 }
          ]
        }
      ];

      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSuspiciousActivities = async () => {
    try {
      // Simular atividades suspeitas
      const mockActivities: SuspiciousActivity[] = [
        {
          id: '1',
          ip_address_hash: 'a1b2c3d4e5f6...',
          detected_country: 'BR',
          locked_region: 'brasil',
          suspicious_activity: true,
          activity_type: 'VPN detected',
          created_at: '2025-01-22T10:30:00Z',
          order_id: 'ORD-12345'
        },
        {
          id: '2',
          ip_address_hash: 'f6e5d4c3b2a1...',
          detected_country: 'US',
          locked_region: 'usa',
          suspicious_activity: true,
          activity_type: 'Multiple region attempts',
          created_at: '2025-01-22T09:15:00Z'
        },
        {
          id: '3',
          ip_address_hash: '9z8y7x6w5v4u...',
          detected_country: 'ES',
          locked_region: 'internacional',
          suspicious_activity: true,
          activity_type: 'Rapid IP changes',
          created_at: '2025-01-22T08:45:00Z',
          order_id: 'ORD-12346'
        }
      ];

      setSuspiciousActivities(mockActivities);
    } catch (error) {
      console.error('Erro ao carregar atividades suspeitas:', error);
    }
  };

  const formatCurrency = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const getRegionFlag = (region: string) => {
    const flags: Record<string, string> = {
      'brasil': '🇧🇷',
      'usa': '🇺🇸',
      'internacional': '🌍'
    };
    return flags[region] || '🌍';
  };

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'BR': '🇧🇷',
      'US': '🇺🇸',
      'ES': '🇪🇸',
      'MX': '🇲🇽',
      'AR': '🇦🇷',
      'CO': '🇨🇴',
      'CA': '🇨🇦',
      'GB': '🇬🇧'
    };
    return flags[country] || '🌍';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-0">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Carregando analytics regionais...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-0 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brown-dark-400 text-serif-primary">
            Analytics Regionais
          </h1>
          <p className="text-muted-foreground">Métricas de vendas e segurança por região</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map(period => (
                <SelectItem key={period.key} value={period.key}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-48 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {regions.map(region => (
                <SelectItem key={region.key} value={region.key}>
                  {region.flag} {region.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/20 p-1">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="revenue">Receita</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
          <TabsTrigger value="countries">Países</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Cards de Resumo */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SolidStatCard
              title="Total de Pedidos"
              value={analytics.reduce((sum, region) => sum + region.totalOrders, 0).toString()}
              icon={BarChart3}
              color={ADMIN_CARD_COLORS.primary}
              className="admin-hover-lift"
            />
            
            <SolidStatCard
              title="Receita Total"
              value={formatCurrency(
                analytics.reduce((sum, region) => sum + region.totalRevenue, 0),
                'BRL'
              )}
              icon={DollarSign}
              color={ADMIN_CARD_COLORS.green}
              className="admin-hover-lift"
            />
            
            <SolidStatCard
              title="Taxa de Conversão"
              value={`${(analytics.reduce((sum, region) => sum + region.conversionRate, 0) / (analytics.length || 1)).toFixed(1)}%`}
              icon={TrendingUp}
              color={ADMIN_CARD_COLORS.blue}
              className="admin-hover-lift"
            />
            
            <SolidStatCard
              title="Atividades Suspeitas"
              value={analytics.reduce((sum, region) => sum + region.suspiciousActivity, 0).toString()}
              icon={AlertTriangle}
              color={ADMIN_CARD_COLORS.red}
              className="admin-hover-lift"
            />
          </div>

          {/* Analytics por Região */}
          <div className="grid gap-6 md:grid-cols-3">
            {analytics.map(region => (
              <Card key={region.region} className="apple-card admin-card-compact admin-hover-lift">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center space-x-2 text-brown-dark-400">
                    <span className="text-2xl">{getRegionFlag(region.region)}</span>
                    <span className="capitalize">{region.region}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Pedidos</p>
                      <p className="text-xl font-bold text-brown-dark-400">{region.totalOrders}</p>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Receita</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(region.totalRevenue, region.currency)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Conversão</p>
                      <p className="text-base font-semibold">{region.conversionRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ticket Médio</p>
                      <p className="text-base font-semibold">
                        {formatCurrency(region.avgOrderValue, region.currency)}
                      </p>
                    </div>
                  </div>

                  {region.suspiciousActivity > 0 && (
                    <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-2 rounded-lg text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="font-medium">
                        {region.suspiciousActivity} atividade(s) suspeita(s)
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <Card className="apple-card admin-card-compact">
            <CardHeader>
              <CardTitle className="text-brown-dark-400">Receita por Região</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.map(region => (
                  <div key={region.region} className="flex items-center justify-between p-4 border border-border/50 rounded-xl hover:bg-muted/10 transition-colors">
                    <div className="flex items-center space-x-4">
                      <span className="text-3xl">{getRegionFlag(region.region)}</span>
                      <div>
                        <p className="font-semibold capitalize text-brown-dark-400">{region.region}</p>
                        <p className="text-sm text-muted-foreground">
                          {region.totalOrders} pedidos
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(region.totalRevenue, region.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase">
                        {region.currency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="apple-card admin-card-compact">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-brown-dark-400">
                <Shield className="h-5 w-5" />
                <span>Atividades Suspeitas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suspiciousActivities.map(activity => (
                  <div key={activity.id} className="flex items-center justify-between p-4 border border-border/50 rounded-xl bg-red-50/50 hover:bg-red-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-red-100 rounded-full">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-red-900">{activity.activity_type}</p>
                        <p className="text-sm text-red-700">
                          {getCountryFlag(activity.detected_country)} {activity.detected_country} → {activity.locked_region}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          IP: {activity.ip_address_hash}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                      {activity.order_id && (
                        <Badge variant="outline" className="mt-1 bg-white border-red-200 text-red-700">{activity.order_id}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="countries" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {analytics.map(region => (
              <Card key={region.region} className="apple-card admin-card-compact">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="flex items-center space-x-2 text-brown-dark-400">
                    <span>{getRegionFlag(region.region)}</span>
                    <span className="capitalize">{region.region}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {region.topCountries.map(country => (
                      <div key={country.country} className="flex items-center justify-between group">
                        <div className="flex items-center space-x-3">
                          <span className="text-xl">{getCountryFlag(country.country)}</span>
                          <span className="font-medium text-sm">{country.country}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{country.orders} pedidos</p>
                          <p className="text-xs text-muted-foreground group-hover:text-green-600 transition-colors">
                            {formatCurrency(country.revenue, region.currency)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
