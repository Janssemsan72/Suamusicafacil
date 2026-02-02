import React from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';

interface CheckoutFormProps {
  email: string;
  emailError: string;
  whatsapp: string;
  whatsappError: string;
  processing: boolean;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onWhatsAppChange: (value: string) => void;
  onWhatsAppBlur: () => void;
}

export const CheckoutForm = React.memo(({
  email,
  emailError,
  whatsapp,
  whatsappError,
  processing,
  onEmailChange,
  onEmailBlur,
  onWhatsAppChange,
  onWhatsAppBlur,
}: CheckoutFormProps) => {
  const { t } = useTranslation();

  return (
    <Card className="compact-card">
      <CardHeader className="pb-3 md:pb-3">
        <CardTitle className="text-xl md:text-xl lg:text-2xl font-bold">{t('checkout.completeOrder')}</CardTitle>
        <CardDescription className="text-base md:text-base hidden md:block mt-2">
          {t('checkout.emailDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-4 p-4 md:p-6">
        <div className="space-y-2">
          <Input
            type="email"
            placeholder={t('checkout.emailPlaceholder')}
            value={email}
            onChange={(e) => {
              onEmailChange(e.target.value);
            }}
            onBlur={onEmailBlur}
            className={`text-lg md:text-lg py-4 ${emailError ? 'border-destructive' : ''}`}
            disabled={processing}
          />
          {emailError && (
            <p className="text-sm text-destructive">{emailError}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base md:text-base font-medium pointer-events-none z-10">
              +55
            </span>
            <Input
              type="tel"
              placeholder={t('checkout.whatsappPlaceholder') || '(11) 99999-9999'}
              value={whatsapp}
              onChange={(e) => {
                onWhatsAppChange(e.target.value);
              }}
              onBlur={onWhatsAppBlur}
              className={`pl-14 text-lg md:text-lg py-4 ${whatsappError ? 'border-destructive' : ''}`}
              disabled={processing}
            />
          </div>
          {whatsappError && (
            <p className="text-sm text-destructive">{whatsappError}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

CheckoutForm.displayName = 'CheckoutForm';

