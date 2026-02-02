import React, { useEffect, useLayoutEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Eye, Lock, Database, Cookie, UserCheck, Clock, Edit, Mail, AlertTriangle } from "@/lib/icons";
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
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
      icon: Database,
      title: t('privacy.sections.information.title'),
      content: t('privacy.sections.information.content')
    },
    {
      icon: Eye,
      title: t('privacy.sections.usage.title'),
      content: t('privacy.sections.usage.content')
    },
    {
      icon: Shield,
      title: t('privacy.sections.sharing.title'),
      content: t('privacy.sections.sharing.content')
    },
    {
      icon: Lock,
      title: t('privacy.sections.security.title'),
      content: t('privacy.sections.security.content')
    },
    {
      icon: Cookie,
      title: t('privacy.sections.cookies.title'),
      content: t('privacy.sections.cookies.content')
    },
    {
      icon: UserCheck,
      title: t('privacy.sections.rights.title'),
      content: t('privacy.sections.rights.content')
    },
    {
      icon: Clock,
      title: t('privacy.sections.retention.title'),
      content: t('privacy.sections.retention.content')
    },
    {
      icon: Edit,
      title: t('privacy.sections.changes.title'),
      content: t('privacy.sections.changes.content')
    },
    {
      icon: Mail,
      title: t('privacy.sections.contact.title'),
      content: t('privacy.sections.contact.content')
    }
  ];
  
  return (
    <div className="min-h-[100dvh] bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl pt-24">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('privacy.title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('privacy.lastUpdated')}: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Privacy Notice */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                {t('privacy.notice.title')}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t('privacy.notice.content')}
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Content */}
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
