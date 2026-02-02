import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { Shield, Eye, Lock, Database, Cookie, UserCheck, Clock, Edit, Mail, AlertTriangle } from "@/lib/icons";

export default function Privacy() {
  const { t } = useTranslation();
  
  // O ScrollRestoration component cuida do scroll para o topo
  
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
    <div className="min-h-[100dvh]">
      <Header />
      
      <main className="container mx-auto px-4 pt-16 md:pt-20 pb-16 max-w-5xl">
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
        <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-2">Importante</h3>
                <p className="text-blue-800">
                  Esta Política de Privacidade descreve como coletamos, usamos e protegemos suas informações pessoais. 
                  Ao usar nossos serviços, você concorda com as práticas descritas nesta política.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Data Protection Rights */}
        <section className="mt-12">
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-center mb-6 text-green-900">Seus Direitos de Proteção de Dados</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-green-900">Acesso aos Dados</h3>
                      <p className="text-sm text-green-800">
                        Você pode solicitar uma cópia dos dados pessoais que temos sobre você.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-green-900">Exclusão de Dados</h3>
                      <p className="text-sm text-green-800">
                        Você pode solicitar a exclusão de seus dados pessoais em determinadas circunstâncias.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </section>

      </main>

      <Footer />
    </div>
  );
}
