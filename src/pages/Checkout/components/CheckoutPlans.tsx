import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from '@/lib/icons';
import { useTranslation } from '@/hooks/useTranslation';

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  delivery: string;
  featured: boolean;
  badge?: string;
  features: string[];
}

interface CheckoutPlansProps {
  plans: Plan[];
  selectedPlan: string;
  onPlanSelect: (planId: string) => void;
  isMobile?: boolean;
}

export const CheckoutPlans = React.memo(({
  plans,
  selectedPlan,
  onPlanSelect,
  isMobile = false,
}: CheckoutPlansProps) => {
  const { t } = useTranslation();

  if (isMobile) {
    return (
      <div className="md:hidden mt-3 space-y-1.5">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
              selectedPlan === plan.id 
                ? 'border-primary bg-primary/5' 
                : 'border-muted hover:border-primary/50'
            }`}
            onClick={() => onPlanSelect(plan.id)}
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <h3 className="font-semibold text-xs">{plan.name}</h3>
                  {plan.featured && (
                    <Badge variant="default" className="text-[10px] badge-pulse font-bold">
                      {t('checkout.mostPopular')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('checkout.deliveryIn')} {plan.delivery}
                </p>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-primary">
                  {plan.currency === 'BRL' ? 'R$' : '$'} {(plan.price / 100).toFixed(2)}
                </div>
              </div>
            </div>
            <ul className="space-y-0.5 mt-1">
              {plan.features.slice(0, 3).map((feature, idx) => (
                <li key={idx} className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Check className="h-2.5 w-2.5 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            {selectedPlan === plan.id && (
              <div className="mt-1 flex items-center gap-0.5 text-[10px] text-primary">
                <Check className="h-2.5 w-2.5" />
                {t('checkout.selected')}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="compact-card hidden md:block">
      <CardHeader className="pb-3 md:pb-3">
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-xl font-bold">
          {t('checkout.choosePlan')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-3 p-4 md:p-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`p-4 md:p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedPlan === plan.id 
                ? 'border-primary bg-primary/5' 
                : 'border-muted hover:border-primary/50'
            }`}
            onClick={() => onPlanSelect(plan.id)}
          >
            <div className="flex items-start justify-between mb-2 md:mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 md:gap-2 mb-1 md:mb-1">
                  <h3 className="font-semibold text-base md:text-base lg:text-lg">{plan.name}</h3>
                  {plan.featured && (
                    <Badge variant="default" className="text-xs md:text-xs badge-pulse font-bold">
                      {t('checkout.mostPopular')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm md:text-sm text-muted-foreground">
                  {t('checkout.deliveryIn')} {plan.delivery}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl md:text-xl lg:text-2xl font-bold text-primary">
                  {plan.currency === 'BRL' ? 'R$' : '$'} {(plan.price / 100).toFixed(2)}
                </div>
              </div>
            </div>
            <ul className="space-y-1 md:space-y-1 mt-2 md:mt-3">
              {plan.features.slice(0, 3).map((feature, idx) => (
                <li key={idx} className="text-sm md:text-sm text-muted-foreground flex items-center gap-1 md:gap-1.5">
                  <Check className="h-4 w-4 md:h-4 md:w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            {selectedPlan === plan.id && (
              <div className="mt-2 md:mt-3 flex items-center gap-1 md:gap-1.5 text-sm md:text-sm text-primary font-semibold">
                <Check className="h-4 w-4 md:h-4 md:w-4" />
                {t('checkout.selected')}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
});

CheckoutPlans.displayName = 'CheckoutPlans';

