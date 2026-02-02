import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PricingSection from '@/components/PricingSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle, CreditCard, Clock, Download } from "@/lib/icons";
import { useTranslation } from '@/hooks/useTranslation';
import { LinkWithUtms } from '@/components/LinkWithUtms';
import { getLocalizedPath } from '@/lib/i18nRoutes';

export default function Pricing() {
  const { t, currentLanguage } = useTranslation();
  
  const getLocalizedLink = (path: string) => {
    return getLocalizedPath(path, currentLanguage);
  };
  
  return (
    <div className="min-h-[100dvh]">
      <Header />
      
      <main className="container mx-auto px-4 pt-16 md:pt-20 pb-16">

        <PricingSection />

        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center mb-12">{t('pricing.paymentQuestions')}</h2>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CreditCard className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{t('pricing.paymentMethods.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('pricing.paymentMethods.description')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Clock className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{t('pricing.deliveryTimeDetails.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('pricing.deliveryTimeDetails.description')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Download className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{t('pricing.whatsIncluded.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('pricing.whatsIncluded.description')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <HelpCircle className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{t('pricing.guarantee.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('pricing.guarantee.description')}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Card className="max-w-2xl mx-auto bg-gradient-hero text-white">
            <CardHeader>
              <CardTitle className="text-white text-2xl">{t('pricing.cta.title')}</CardTitle>
              <CardDescription className="text-white/90 text-base">
                {t('pricing.cta.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" variant="secondary" asChild>
                <LinkWithUtms to={getLocalizedLink('/quiz')}>{t('pricing.createMyMusic')}</LinkWithUtms>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
