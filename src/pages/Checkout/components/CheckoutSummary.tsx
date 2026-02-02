import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import type { QuizData } from '../hooks/useCheckoutState';
import type { Plan } from './CheckoutPlans';

interface CheckoutSummaryProps {
  quiz: QuizData | null;
  selectedPlan: Plan;
  isMobile?: boolean;
}

export const CheckoutSummary = React.memo(({
  quiz,
  selectedPlan,
  isMobile = false,
}: CheckoutSummaryProps) => {
  const { t } = useTranslation();

  if (isMobile) {
    return (
      <Card className="compact-card">
        <CardContent className="pt-4 md:pt-5 p-4 md:p-6 space-y-3 md:space-y-3">
          <div className="flex items-center justify-between text-base md:text-base">
            <span className="text-muted-foreground">{t('checkout.musicFor')}</span>
            <strong className="text-base md:text-base">{quiz?.about_who}</strong>
          </div>
          <div className="flex items-center justify-between text-base md:text-base">
            <span className="text-muted-foreground">{t('checkout.style')}</span>
            <strong className="text-base md:text-base">{quiz?.style}</strong>
          </div>
          <div className="flex items-center justify-between text-base md:text-base">
            <span className="text-muted-foreground">{t('checkout.delivery')}</span>
            <strong className="text-base md:text-base text-orange-600">{t('checkout.delivery24h')}</strong>
          </div>
          
          <div className="mt-3 md:mt-3 p-2 md:p-2 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-lg border border-yellow-500/30">
            <div className="flex items-center justify-center gap-2">
              <span className="text-base md:text-base">🎁</span>
              <span className="font-bold text-sm md:text-sm">{t('checkout.twoVersionsBenefit')}</span>
            </div>
          </div>
          
          <div className="border-t pt-3 md:pt-3 mt-3 md:mt-3">
            <div className="flex items-center justify-between">
              <span className="text-base md:text-base font-medium">{t('checkout.total')}</span>
              <div className="flex items-baseline gap-2 md:gap-2">
                <span className="text-base md:text-base text-muted-foreground line-through">
                  {selectedPlan.currency === 'BRL' ? 'R$' : '$'} {(selectedPlan.price / 100 * 3.3).toFixed(2)}
                </span>
                <span className="text-2xl md:text-2xl font-bold text-primary">
                  {selectedPlan.currency === 'BRL' ? 'R$' : '$'} {(selectedPlan.price / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="compact-card hidden md:block">
      <CardContent className="space-y-4 p-4 md:p-6">
        <div className="space-y-3 md:space-y-3">
          <div className="flex items-center justify-between text-base md:text-base">
            <span className="text-muted-foreground">{t('checkout.musicFor')}</span>
            <span className="font-medium">{quiz?.about_who}</span>
          </div>
          <div className="flex items-center justify-between text-base md:text-base">
            <span className="text-muted-foreground">{t('checkout.delivery')}</span>
            <span className="font-medium">
              {selectedPlan.id === 'express' ? t('checkout.deliveryIn48h') : t('checkout.deliveryIn7Days')}
            </span>
          </div>
        </div>

        <div className="border-t pt-4 md:pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base md:text-base font-medium">{t('checkout.personalizedMusic')}</span>
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-sm md:text-sm">
                {t('checkout.discount70')}
              </Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base md:text-base text-muted-foreground line-through">
                {selectedPlan.currency === 'BRL' ? 'R$' : '$'} {(selectedPlan.price / 100 * 3.3).toFixed(2)}
              </span>
              <span className="text-2xl md:text-2xl font-bold text-primary">
                {selectedPlan.currency === 'BRL' ? 'R$' : '$'} {(selectedPlan.price / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CheckoutSummary.displayName = 'CheckoutSummary';

