import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, Check } from '@/lib/icons';
import { X } from '@/lib/icons';
import { useTranslation } from '@/hooks/useTranslation';

interface CheckoutPaymentSectionProps {
  processing: boolean;
  retryCount: number;
  buttonError: boolean;
  cameFromRestore: boolean;
  email: string;
  whatsapp: string;
  whatsappError: string;
  onCheckout: () => void;
  isMobile?: boolean;
}

export const CheckoutPaymentSection = React.memo(({
  processing,
  retryCount,
  buttonError,
  cameFromRestore,
  email,
  whatsapp,
  whatsappError,
  onCheckout,
  isMobile = false,
}: CheckoutPaymentSectionProps) => {
  const { t } = useTranslation();

  const buttonContent = () => {
    if (processing) {
      return (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {retryCount > 0 ? `${t('checkout.trying')} (${retryCount}/2)` : t('checkout.processing')}
        </>
      );
    }
    if (buttonError) {
      return (
        <>
          <X className="mr-2 h-5 w-5" />
          {!email && !whatsapp ? t('checkout.fillFieldsAbove') : !email ? t('checkout.fillEmail') : t('checkout.fillWhatsApp')}
        </>
      );
    }
    return (
      <>
        <Gift className="mr-2 h-5 w-5" />
        {cameFromRestore && email && whatsapp ? t('checkout.payNow') : t('checkout.createMyMusic')}
      </>
    );
  };

  const buttonClassName = `w-full btn-pulse ${
    isMobile ? 'h-16 md:h-12' : 'h-12'
  } font-bold text-lg md:text-lg lg:text-xl ${
    buttonError
      ? 'bg-red-600 hover:bg-red-700 animate-pulse'
      : cameFromRestore && email && whatsapp && !whatsappError
      ? isMobile
        ? 'bg-green-600 hover:bg-green-700 animate-pulse'
        : 'bg-green-500 hover:bg-green-600 animate-pulse'
      : 'bg-emerald-500 hover:bg-emerald-600'
  } text-white shadow-md ${buttonError ? 'shadow-red-800/20' : 'shadow-emerald-500/20'} hover:scale-105 transition-transform disabled:opacity-100 disabled:cursor-not-allowed`;

  if (isMobile) {
    return (
      <>
        <Button
          onClick={onCheckout}
          disabled={processing}
          className={buttonClassName}
          size="lg"
        >
          {buttonContent()}
        </Button>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-sm md:text-sm">
            <Check className="mr-1 h-4 w-4" />
            {t('checkout.guarantee30Days')}
          </Badge>
        </div>
        <p className="text-sm md:text-sm text-center text-muted-foreground">
          {t('checkout.securePayment')}
        </p>
      </>
    );
  }

  return (
    <div className="hidden md:block mt-4">
      <Button
        onClick={onCheckout}
        disabled={processing}
        className={buttonClassName}
        size="lg"
      >
        {buttonContent()}
      </Button>
    </div>
  );
});

CheckoutPaymentSection.displayName = 'CheckoutPaymentSection';

