import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Shield, CreditCard, Users, AlertTriangle, Edit, Mail } from "@/lib/icons";

export default function Terms() {
  const { t } = useTranslation();
  
  // O ScrollRestoration component cuida do scroll para o topo
  
  const sections = [
    {
      icon: FileText,
      title: t('terms.sections.acceptance.title'),
      content: t('terms.sections.acceptance.content')
    },
    {
      icon: Users,
      title: t('terms.sections.services.title'),
      content: t('terms.sections.services.content')
    },
    {
      icon: Shield,
      title: t('terms.sections.copyright.title'),
      content: t('terms.sections.copyright.content')
    },
    {
      icon: CreditCard,
      title: t('terms.sections.payments.title'),
      content: t('terms.sections.payments.content')
    },
    {
      icon: AlertTriangle,
      title: t('terms.sections.acceptableUse.title'),
      content: t('terms.sections.acceptableUse.content')
    },
    {
      icon: Shield,
      title: t('terms.sections.liability.title'),
      content: t('terms.sections.liability.content')
    },
    {
      icon: Edit,
      title: t('terms.sections.modifications.title'),
      content: t('terms.sections.modifications.content')
    },
    {
      icon: Mail,
      title: t('terms.sections.contact.title'),
      content: t('terms.sections.contact.content')
    }
  ];
  
  return (
    <div className="min-h-[100dvh]">
      <Header />
      
      <main className="container mx-auto px-4 pt-16 md:pt-20 pb-16 max-w-5xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('terms.title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('terms.lastUpdated')}: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Terms Content */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <Card key={index} className="shadow-soft hover:shadow-medium transition-all">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <section.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-3 text-foreground">
                      {section.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      </main>

      <Footer />
    </div>
  );
}
