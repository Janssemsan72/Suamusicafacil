import { useLocaleContext } from '@/contexts/LocaleContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useUtmParams } from '@/hooks/useUtmParams';
import RegionalPricingSection from './RegionalPricingSection';

export default function PricingSection() {
  const { locale } = useLocaleContext();
  const { t, currentLanguage } = useTranslation();
  const { navigateWithUtms } = useUtmParams();

  return (
    <RegionalPricingSection 
      key={locale} 
      locale={locale as any} 
      t={t}
      navigateWithUtms={navigateWithUtms}
      currentLanguage={currentLanguage}
    />
  );
}
