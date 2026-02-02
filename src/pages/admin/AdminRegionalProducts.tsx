import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, DollarSign, Settings, Plus, Edit, Trash2, Save } from "@/lib/icons";
import { useTranslation } from '@/hooks/useTranslation';

interface RegionalProduct {
  id: string;
  region: string;
  plan_name: string;
  price_cents: number;
  currency: string;
  provider_price_id: string;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminRegionalProducts() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<RegionalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<RegionalProduct | null>(null);
  const [showForm, setShowForm] = useState(false);

  const regions = [
    { key: 'brasil', name: 'Brasil', flag: '🇧🇷', currency: 'BRL' },
    { key: 'usa', name: 'Estados Unidos', flag: '🇺🇸', currency: 'USD' },
    { key: 'internacional', name: 'Internacional', flag: '🌍', currency: 'USD' }
  ];

  const currencies = ['BRL', 'USD', 'EUR'];

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // Simular carregamento de produtos
      const mockProducts: RegionalProduct[] = [
        {
          id: '1',
          region: 'brasil',
          plan_name: 'Expresso',
          price_cents: 4790,
          currency: 'BRL',
          provider_price_id: 'price_BR_EXPRESS',
          features: ['MP3 alta qualidade', 'Capa personalizada', 'Letra completa', 'Download ilimitado', 'Entrega em 48h'],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          region: 'usa',
          plan_name: 'Express',
          price_cents: 3900,
          currency: 'USD',
          provider_price_id: 'price_1SKUOFCkSeRm9TUrSTOgC0b3',
          features: ['High quality MP3', 'Custom cover', 'Full lyrics', 'Unlimited download', '48h delivery'],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '3',
          region: 'internacional',
          plan_name: 'Expreso',
          price_cents: 4900,
          currency: 'USD',
          provider_price_id: 'price_1SKUOFCkSeRm9TUrSTOgC0b3',
          features: ['MP3 de alta calidad', 'Portada personalizada', 'Letra completa', 'Descarga ilimitada', 'Entrega en 48h'],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      setProducts(mockProducts);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const getRegionInfo = (region: string) => {
    return regions.find(r => r.key === region) || { name: region, flag: '🌍', currency: 'USD' };
  };

  const handleEdit = (product: RegionalProduct) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleSave = async (product: RegionalProduct) => {
    try {
      // Aqui você faria a chamada para a API para salvar
      setShowForm(false);
      setEditingProduct(null);
      await loadProducts();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
    }
  };

  const handleToggleActive = async (product: RegionalProduct) => {
    try {
      const updatedProduct = { ...product, is_active: !product.is_active };
      await handleSave(updatedProduct);
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-0">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Carregando produtos regionais...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Produtos Regionais</h1>
          <p className="text-muted-foreground">Gerencie preços e produtos por região</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="brasil">🇧🇷 Brasil</TabsTrigger>
          <TabsTrigger value="usa">🇺🇸 USA</TabsTrigger>
          <TabsTrigger value="internacional">🌍 Internacional</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {regions.map(region => {
              const regionProducts = products.filter(p => p.region === region.key);
              const activeProducts = regionProducts.filter(p => p.is_active);
              
              return (
                <Card key={region.key}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {region.flag} {region.name}
                    </CardTitle>
                    <Badge variant={activeProducts.length > 0 ? "default" : "secondary"}>
                      {activeProducts.length} ativo(s)
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {regionProducts.length} produto(s)
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Moeda: {region.currency}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {regions.map(region => (
          <TabsContent key={region.key} value={region.key} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{region.flag} {region.name}</h2>
                <p className="text-muted-foreground">Produtos para {region.name}</p>
              </div>
            </div>

            <div className="grid gap-4">
              {products
                .filter(p => p.region === region.key)
                .map(product => (
                  <Card key={product.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{product.plan_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {product.provider_price_id}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={product.is_active}
                            onCheckedChange={() => handleToggleActive(product)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label className="text-sm font-medium">Preço</Label>
                          <p className="text-2xl font-bold">
                            {formatPrice(product.price_cents, product.currency)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Status</Label>
                          <div className="flex items-center space-x-2">
                            <Badge variant={product.is_active ? "default" : "secondary"}>
                              {product.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <Label className="text-sm font-medium">Features</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {product.features.map((feature, index) => (
                            <Badge key={index} variant="outline">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Modal de Edição */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="region">Região</Label>
                  <select
                    id="region"
                    className="w-full p-2 border rounded"
                    value={editingProduct?.region || ''}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct!,
                      region: e.target.value
                    })}
                  >
                    <option value="">Selecione uma região</option>
                    {regions.map(region => (
                      <option key={region.key} value={region.key}>
                        {region.flag} {region.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="plan_name">Nome do Plano</Label>
                  <Input
                    id="plan_name"
                    value={editingProduct?.plan_name || ''}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct!,
                      plan_name: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="price_cents">Preço (centavos)</Label>
                  <Input
                    id="price_cents"
                    type="number"
                    value={editingProduct?.price_cents || ''}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct!,
                      price_cents: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="currency">Moeda</Label>
                  <select
                    id="currency"
                    className="w-full p-2 border rounded"
                    value={editingProduct?.currency || ''}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct!,
                      currency: e.target.value
                    })}
                  >
                    {currencies.map(currency => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="provider_price_id">ID do preço no provedor</Label>
                <Input
                  id="provider_price_id"
                  value={editingProduct?.provider_price_id || ''}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct!,
                    provider_price_id: e.target.value
                  })}
                />
              </div>

              <div>
                <Label htmlFor="features">Features (uma por linha)</Label>
                <Textarea
                  id="features"
                  rows={4}
                  value={editingProduct?.features?.join('\n') || ''}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct!,
                    features: e.target.value.split('\n').filter(f => f.trim())
                  })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingProduct?.is_active || false}
                  onCheckedChange={(checked) => setEditingProduct({
                    ...editingProduct!,
                    is_active: checked
                  })}
                />
                <Label>Produto Ativo</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => handleSave(editingProduct!)}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
