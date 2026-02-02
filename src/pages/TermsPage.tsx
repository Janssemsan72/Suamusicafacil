import React, { useEffect, useLayoutEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Shield, CreditCard, Users, AlertTriangle, Edit, Mail } from "@/lib/icons";
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TermsPage() {
  const { t } = useTranslation();

  // useLayoutEffect executa antes da renderização - mais eficaz
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // useEffect como backup - FORÇA scroll para o topo e MANTÉM lá
  useEffect(() => {
    const forceScrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    
    // Scroll imediato
    forceScrollToTop();
    
    // Múltiplas tentativas para garantir que fica no topo
    setTimeout(forceScrollToTop, 0);
    setTimeout(forceScrollToTop, 10);
    setTimeout(forceScrollToTop, 50);
    setTimeout(forceScrollToTop, 100);
    setTimeout(forceScrollToTop, 200);
    setTimeout(forceScrollToTop, 500);
    
    // Interceptar qualquer tentativa de scroll e forçar para o topo
    const handleScroll = () => {
      if (window.pageYOffset > 0) {
        forceScrollToTop();
      }
    };
    
    // Adicionar listener para interceptar scrolls
    window.addEventListener('scroll', handleScroll, { passive: false });
    
    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
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
    <div className="min-h-[100dvh] bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl pt-24">
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
