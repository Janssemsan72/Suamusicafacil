import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { Users, Heart, Music, Award, Clock, Star, CheckCircle, Mail, Phone, MapPin } from "@/lib/icons";
import { Link } from 'react-router-dom';
import { getLocalizedPath } from '@/lib/i18nRoutes';

export default function About() {
  const { t } = useTranslation();
  
  const getLocalizedLink = (path: string) => {
    // Detectar locale atual da URL
    const currentPath = window.location.pathname;
    const currentLocale = currentPath.split('/')[1];
    
    // Se estamos em uma rota localizada, usar o locale da URL
    const activeLocale = currentLocale === 'pt' ? currentLocale : 'pt';
    
    return getLocalizedPath(path, activeLocale);
  };
  
  const teamMembers = [
    {
      name: "Ana Silva",
      role: "Compositora Principal",
      specialty: "Pop e MPB",
      experience: "8 anos",
      description: "Especialista em criar melodias emocionantes que tocam o coração."
    },
    {
      name: "Carlos Mendes",
      role: "Produtor Musical",
      specialty: "Rock e Sertanejo",
      experience: "12 anos",
      description: "Responsável pela produção de alta qualidade de cada música."
    },
    {
      name: "Marina Costa",
      role: "Letrista",
      specialty: "Romântico e Gospel",
      experience: "6 anos",
      description: "Cria letras personalizadas que contam histórias únicas."
    }
  ];

  const values = [
    {
      icon: Heart,
      title: "Paixão pela Música",
      description: "Cada composição é criada com amor e dedicação, pensando no momento especial que você quer celebrar."
    },
    {
      icon: Users,
      title: "Equipe Profissional",
      description: "Nossos músicos e compositores têm anos de experiência e são especialistas em diversos estilos musicais."
    },
    {
      icon: Award,
      title: "Qualidade Garantida",
      description: "Comprometemo-nos a entregar música de qualidade profissional, pronta para compartilhar com o mundo."
    },
    {
      icon: Clock,
      title: "Entrega Rápida",
      description: "Entregamos sua música personalizada em até 24 horas, sem comprometer a qualidade."
    }
  ];

  const stats = [
    { number: "500+", label: "Músicas Criadas" },
    { number: "98%", label: "Satisfação dos Clientes" },
    { number: "24h", label: "Tempo de Entrega" },
    { number: "5.0", label: "Avaliação Média" }
  ];

  return (
    <div className="min-h-[100dvh]">
      <Header />
      
      <main className="container mx-auto px-4 pt-16 md:pt-20 pb-16 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Sobre o <span className="text-primary">MusicLovely</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Somos uma equipe apaixonada por música, dedicada a criar momentos inesquecíveis 
            através de composições personalizadas que tocam o coração.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center shadow-soft hover:shadow-medium transition-all">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-primary mb-2">{stat.number}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Our Story */}
        <section className="mb-16">
          <Card className="shadow-soft">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold mb-6 text-center">Nossa História</h2>
              <div className="prose prose-lg max-w-none text-muted-foreground">
                <p className="mb-4">
                  O MusicLovely nasceu da paixão por conectar pessoas através da música. 
                  Acreditamos que cada momento especial merece uma trilha sonora única, 
                  criada especialmente para celebrar o amor, a amizade e as memórias mais preciosas.
                </p>
                <p className="mb-4">
                  Nossa equipe de músicos e compositores profissionais trabalha com dedicação 
                  para transformar suas histórias em melodias que emocionam e permanecem para sempre 
                  na memória de quem você ama.
                </p>
                <p>
                  Cada música é uma obra-prima única, produzida com instrumentos reais e vocais 
                  profissionais, garantindo qualidade de estúdio para seus momentos mais especiais.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Our Values */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Nossos Valores</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <Card key={index} className="shadow-soft hover:shadow-medium transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <value.icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                      <p className="text-muted-foreground">{value.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Our Team */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Nossa Equipe</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <Card key={index} className="shadow-soft hover:shadow-medium transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{member.name}</h3>
                  <p className="text-primary font-semibold mb-1">{member.role}</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    {member.specialty} • {member.experience} de experiência
                  </p>
                  <p className="text-sm text-muted-foreground">{member.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="mb-16">
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold text-center mb-8">Por que Escolher o MusicLovely?</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Músicos Profissionais</h3>
                      <p className="text-sm text-muted-foreground">
                        Nossa equipe é formada por músicos e compositores com anos de experiência.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Qualidade Garantida</h3>
                      <p className="text-sm text-muted-foreground">
                        Cada música é produzida com instrumentos reais e vocais profissionais.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Entrega Rápida</h3>
                      <p className="text-sm text-muted-foreground">
                        Receba sua música personalizada em até 24 horas.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">100% Personalizada</h3>
                      <p className="text-sm text-muted-foreground">
                        Cada música é criada especialmente para seu momento único.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Suporte Completo</h3>
                      <p className="text-sm text-muted-foreground">
                        Nossa equipe está sempre disponível para ajudar.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Garantia de Satisfação</h3>
                      <p className="text-sm text-muted-foreground">
                        Se não ficar satisfeito, faremos ajustes sem custo adicional.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Contact CTA */}
        <section className="text-center">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Pronto para Criar Sua Música?</h2>
              <p className="text-muted-foreground mb-6">
                Junte-se a mais de 1000 pessoas que já criaram momentos inesquecíveis com o MusicLovely.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  to={getLocalizedLink('/quiz')} 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-2xl transition-colors"
                >
                  <Music className="h-4 w-4" />
                  Criar Minha Música
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
