import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Zap, Check, Truck, Tag, Lock } from '@/lib/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { Checkbox } from '@/components/ui/checkbox';

// Função helper para obter o nome do mês atual em português
function getCurrentMonthName(): string {
  const months = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro'
  ];
  return months[new Date().getMonth()];
}

interface CheckoutPaymentSummaryProps {
  price: number; // em centavos
  currency: string;
  onCheckout: () => void;
  processing?: boolean;
  onPriorityDeliveryChange?: (enabled: boolean) => void;
  priorityDeliveryPrice?: number; // em centavos
}

export const CheckoutPaymentSummary = React.memo(({
  price,
  currency,
  onCheckout,
  processing = false,
  onPriorityDeliveryChange,
  priorityDeliveryPrice = 1990, // R$ 19,90 em centavos
}: CheckoutPaymentSummaryProps) => {
  const { t } = useTranslation();
  const [priorityDelivery, setPriorityDelivery] = useState(true);
  const [pixDiscount] = useState(true); // Assumindo que sempre tem desconto PIX
  
  // Obter o nome do mês atual
  const currentMonth = useMemo(() => getCurrentMonthName(), []);

  // Preço original (3.3x o preço atual para mostrar desconto)
  const originalPrice = price * 3.3;
  const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
  const savings = originalPrice - price;

  // Desconto PIX (5%)
  const pixDiscountAmount = Math.round(price * 0.05);
  
  // Preço com desconto PIX
  const priceWithPixDiscount = price - pixDiscountAmount;
  
  // Total com entrega prioritária (se selecionada)
  const priorityPrice = priorityDelivery ? priorityDeliveryPrice : 0;
  const total = priceWithPixDiscount + priorityPrice;

  const handlePriorityToggle = (checked: boolean) => {
    setPriorityDelivery(checked);
    if (onPriorityDeliveryChange) {
      onPriorityDeliveryChange(checked);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2).replace('.', ',');
  };

  return (
    <div className="space-y-4">
      {/* Banner Promocional */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
        <Gift className="h-5 w-5 text-green-600 flex-shrink-0" />
        <span className="text-sm font-medium text-green-800">
          Só em {currentMonth}: Leve 2 músicas pelo preço de 1
        </span>
      </div>

      {/* Seção de Preço com Desconto */}
      <Card className="bg-purple-50/40 border-purple-100">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Preço original:</span>
            <span className="text-sm text-muted-foreground line-through">
              {currency === 'BRL' ? 'R$' : '$'} {formatPrice(originalPrice)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-purple-700">Preço com desconto:</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-purple-700">
                {currency === 'BRL' ? 'R$' : '$'} {formatPrice(price)}
              </span>
              <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold">
                {discountPercent}%
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 text-green-600">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">
              Você economiza {currency === 'BRL' ? 'R$' : '$'} {formatPrice(savings)}!
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Itens e Serviços */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Música Personalizada</span>
              <span className="text-sm font-medium">
                {currency === 'BRL' ? 'R$' : '$'} {formatPrice(price)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">MP3 de Alta Qualidade</span>
              <span className="text-sm text-green-600 font-medium">Incluído</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Letras Personalizadas</span>
              <span className="text-sm text-green-600 font-medium">Incluído</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Até 2 revisões grátis</span>
              <span className="text-sm text-green-600 font-medium">Incluído</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-green-600" />
                <span className="text-sm">Música extra GRÁTIS</span>
              </div>
              <span className="text-sm font-bold text-green-600">GRÁTIS!</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-green-600" />
                <span className="text-sm">Desconto PIX (5%)</span>
              </div>
              <span className="text-sm font-medium text-green-600">
                - {currency === 'BRL' ? 'R$' : '$'} {formatPrice(pixDiscountAmount)}
              </span>
            </div>
          </div>

          <div className="border-t pt-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold">Total</span>
              <span className="text-xl font-bold text-primary">
                {currency === 'BRL' ? 'R$' : '$'} {formatPrice(total)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-green-600">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Recebe 2 músicas</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opções de Entrega */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium">Entrega: até 2 dias úteis</span>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="priority-delivery"
              checked={priorityDelivery}
              onCheckedChange={(checked) => handlePriorityToggle(checked === true)}
              className="border-purple-500 data-[state=checked]:bg-purple-500"
            />
            <label
              htmlFor="priority-delivery"
              className="text-sm cursor-pointer flex-1"
            >
              Prioritária: em 4h por +{currency === 'BRL' ? 'R$' : '$'} {formatPrice(priorityDeliveryPrice)}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Finalizar Pagamento */}
      <Button
        onClick={onCheckout}
        disabled={processing}
        className="w-full h-14 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all"
        size="lg"
      >
        {processing ? (
          <>
            <Lock className="mr-2 h-5 w-5 animate-pulse" />
            Processando...
          </>
        ) : (
          <>
            <Lock className="mr-2 h-5 w-5" />
            FINALIZAR PAGAMENTO
          </>
        )}
      </Button>
      <div className="flex justify-end">
        <Badge className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-xs font-bold">
          OFERTA
        </Badge>
      </div>
    </div>
  );
});

CheckoutPaymentSummary.displayName = 'CheckoutPaymentSummary';
