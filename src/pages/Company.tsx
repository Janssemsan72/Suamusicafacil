import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Music, 
  Mail, 
  Phone, 
  MapPin, 
  CheckCircle, 
  Sparkles, 
  FileText, 
  Image as ImageIcon,
  Gift,
  Heart,
  Clock,
  Users,
  MessageCircle,
  Star,
  Quote } from "@/lib/icons";
import { useScrollAnimations } from '@/hooks/use-scroll-animations';

// NOTA: Esta página NÃO renderiza Header ou Footer - página standalone
export default function Company() {
  useScrollAnimations();

  // Adicionar meta tag de verificação do Facebook
  useEffect(() => {
    // Verificar se a meta tag já existe
    let metaTag = document.querySelector('meta[name="facebook-domain-verification"]');
    
    if (!metaTag) {
      // Criar e adicionar a meta tag
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'facebook-domain-verification');
      metaTag.setAttribute('content', 'ietm0enn4ii3n3ird379eh0gzlia9x');
      document.head.appendChild(metaTag);
    } else {
      // Atualizar o content se já existir
      metaTag.setAttribute('content', 'ietm0enn4ii3n3ird379eh0gzlia9x');
    }

    // Cleanup: remover a meta tag quando o componente desmontar (opcional)
    // Não vamos remover para manter a tag disponível mesmo após navegação
  }, []);

  const services = [
    {
      icon: Music,
      title: 'Creation of personalized songs',
      description: 'Unique songs created especially for you'
    },
    {
      icon: Sparkles,
      title: 'Full music production',
      description: 'Professional high-quality production'
    },
    {
      icon: FileText,
      title: 'Composition based on real stories',
      description: 'We transform your memories into lyrics and melodies'
    },
    {
      icon: ImageIcon,
      title: 'Digital cover art',
      description: 'Custom design for your song'
    },
    {
      icon: Gift,
      title: 'Extra versions at no additional cost',
      description: 'When included in the chosen plan'
    }
  ];

  const steps = [
    {
      number: '1',
      title: 'You tell your story',
      description: 'Submit the information through the creation form on the site.'
    },
    {
      number: '2',
      title: 'Our team creates your song',
      description: 'Composition + lyrics + melody + production.'
    },
    {
      number: '3',
      title: 'Delivery within 48 hours',
      description: 'You receive the final song at your registered email.'
    }
  ];

  const testimonials = [
    {
      name: 'Maria Silva',
      role: 'Customer',
      content: 'I was moved when I heard the song created for my father\'s birthday. The team perfectly captured our memories in the form of a melody. I wholeheartedly recommend it!',
      rating: 5,
      avatar: 'https://i.pravatar.cc/150?img=47'
    },
    {
      name: 'João Santos',
      role: 'Customer',
      content: 'Incredible! The wedding song was perfect. All the guests were enchanted. Exceptional professionalism and quality.',
      rating: 5,
      avatar: 'https://i.pravatar.cc/150?img=33'
    },
    {
      name: 'Ana Costa',
      role: 'Customer',
      content: 'I created a tribute for my grandmother and it was the best surprise I\'ve ever given. The lyrics touched the heart of the whole family. Thank you The Song Surprise!',
      rating: 5,
      avatar: 'https://i.pravatar.cc/150?img=45'
    }
  ];

  const stats = [
    { number: '20000+', label: 'Songs Created' },
    { number: '98%', label: 'Satisfaction' },
    { number: '48h', label: 'Fast Delivery' },
    { number: '5.0', label: 'Average Rating' }
  ];

  const whatsappNumber = '8591516996';
  const whatsappMessage = encodeURIComponent('Hello! I\'d like to know more about The Song Surprise.');
  const whatsappUrl = `https://wa.me/55${whatsappNumber}?text=${whatsappMessage}`;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in-up');
            entry.target.classList.remove('opacity-0');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const elements = document.querySelectorAll('.scroll-animate');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Garantir que nenhum Header seja exibido nesta página
  useEffect(() => {
    // Ocultar qualquer header que possa estar sendo renderizado globalmente
    const headers = document.querySelectorAll('header');
    headers.forEach(header => {
      (header as HTMLElement).style.display = 'none';
    });
    
    return () => {
      // Restaurar headers ao sair da página (caso necessário)
      headers.forEach(header => {
        (header as HTMLElement).style.display = '';
      });
    };
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-primary/5 py-8 md:py-12 relative overflow-hidden">
          <div className="container mx-auto px-4 max-w-6xl relative z-10">
            <div className="text-center mb-6">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                The Song Surprise – <span className="text-primary">Tributes That Become Songs</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-4">
                The platform that transforms real stories into personalized songs, created with emotion, care, and professional production.
              </p>
              <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                With The Song Surprise, you create unforgettable tributes for birthdays, weddings, memorials, family celebrations, reconciliations, and special moments. Our team transforms your memories into melody, lyrics, and emotion — all in a simple, fast, and accessible way.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index}>
                  <Card className="border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stat.number}</div>
                      <div className="text-xs md:text-sm text-muted-foreground">{stat.label}</div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* O Que Fazemos Section */}
        <section className="py-8 md:py-12 bg-background">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-8 scroll-animate">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Music className="h-8 w-8 text-primary animate-pulse" />
                <h2 className="text-3xl md:text-4xl font-bold">What We Do</h2>
              </div>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                We create personalized songs, produced with professional quality, based on the stories submitted by customers. Each song is unique and tailor-made, following the chosen musical style.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service, index) => (
                <Card 
                  key={index} 
                  className={`scroll-animate scroll-animate-delay-${index + 1} group border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-2 bg-gradient-to-br from-background to-primary/5`}
                  style={{ transitionDelay: `${(index + 1) * 0.1}s` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                          <service.icon className="h-6 w-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                          {service.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Como Funciona Section */}
        <section className="py-8 md:py-12 bg-muted/30">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-8 scroll-animate">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Heart className="h-8 w-8 text-primary animate-pulse" />
                <h2 className="text-3xl md:text-4xl font-bold">How It Works</h2>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {steps.map((step, index) => (
                <Card 
                  key={index} 
                  className={`scroll-animate scroll-animate-delay-${index + 1} group border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-2 relative overflow-hidden`}
                  style={{ transitionDelay: `${(index + 1) * 0.15}s` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardContent className="p-6 text-center relative z-10">
                    <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                      {step.number}
                    </div>
                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Provas Sociais Section */}
        <section className="py-8 md:py-12 bg-background">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-8 scroll-animate">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Star className="h-8 w-8 text-primary fill-primary animate-pulse" />
                <h2 className="text-3xl md:text-4xl font-bold">What Our Customers Say</h2>
              </div>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Real stories from people who transformed special moments into music
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <Card 
                  key={index} 
                  className={`scroll-animate scroll-animate-delay-${index + 1} group border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-2`}
                  style={{ transitionDelay: `${(index + 1) * 0.1}s` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-primary fill-primary" />
                      ))}
                    </div>
                    <Quote className="h-8 w-8 text-primary/20 mb-3" />
                    <p className="text-sm text-muted-foreground mb-4 italic leading-relaxed">
                      "{testimonial.content}"
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                      <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary/20 flex-shrink-0">
                        <img 
                          src={testimonial.avatar} 
                          alt={testimonial.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{testimonial.name}</div>
                        <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Canais de Atendimento Section */}
        <section className="py-8 md:py-12 bg-muted/30">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-8 scroll-animate">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Mail className="h-8 w-8 text-primary animate-pulse" />
                <h2 className="text-3xl md:text-4xl font-bold">Official Support Channels</h2>
              </div>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                For information, questions, or support, use exclusively the channels below:
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <Card className="scroll-animate scroll-animate-delay-1 border-primary/20 hover:border-primary/40 bg-gradient-to-br from-primary/5 to-transparent transition-all duration-300 hover:shadow-xl hover:-translate-y-2 group">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mx-auto mb-3 transition-all duration-300 group-hover:scale-110">
                    <Mail className="h-7 w-7 text-primary group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Official Email</h3>
                  <a 
                    href="mailto:contact@thesongsurprise.com" 
                    id="gtm-email-contato"
                    className="text-primary hover:underline text-lg font-semibold transition-colors gtm-link"
                  >
                    contact@thesongsurprise.com
                  </a>
                </CardContent>
              </Card>

              <Card className="scroll-animate scroll-animate-delay-2 border-primary/20 hover:border-primary/40 bg-gradient-to-br from-primary/5 to-transparent transition-all duration-300 hover:shadow-xl hover:-translate-y-2 group">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mx-auto mb-3 transition-all duration-300 group-hover:scale-110">
                    <MessageCircle className="h-7 w-7 text-primary group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Support WhatsApp</h3>
                  <a 
                    href={whatsappUrl}
                    id="gtm-whatsapp-contato"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-lg font-semibold flex items-center justify-center gap-2 transition-colors gtm-link"
                  >
                    <Phone className="h-5 w-5" />
                    85 9151-6996
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Localização Section */}
        <section className="py-8 md:py-12 bg-background">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-8 scroll-animate">
              <div className="flex items-center justify-center gap-3 mb-4">
                <MapPin className="h-8 w-8 text-primary animate-pulse" />
                <h2 className="text-3xl md:text-4xl font-bold">Location</h2>
              </div>
            </div>

            <Card className="scroll-animate scroll-animate-delay-1 shadow-soft max-w-3xl mx-auto border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4 group">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                        <MapPin className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Address</h3>
                      <p className="text-muted-foreground">
                        R DOUTOR RUI MAIA, Nº 479, SALA 06<br />
                        CENTRO – QUIXADÁ – CE<br />
                        CEP: 63.900-195
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 group">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                        <Phone className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Phone</h3>
                      <a 
                        href="tel:+558588209823" 
                        id="gtm-telefone-contato"
                        className="text-primary hover:underline transition-colors gtm-link"
                      >
                        (85) 8820-9823
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 group">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                        <Mail className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Email</h3>
                      <a 
                        href="mailto:contact@thesongsurprise.com" 
                        id="gtm-email-localizacao"
                        className="text-primary hover:underline transition-colors gtm-link"
                      >
                        contact@thesongsurprise.com
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Compromisso Section */}
        <section className="py-8 md:py-12 bg-muted/30">
          <div className="container mx-auto px-4 max-w-6xl">
            <Card className="scroll-animate bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 shadow-soft hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">
                  Commitment to Security and Transparency
                </h2>
                <div className="text-center space-y-4 text-muted-foreground">
                  <p>
                    <strong className="text-foreground">R DOUTOR RUI MAIA, 479 – ROOM 06, CENTRO – QUIXADÁ – CE, 63.900-195, Brazil</strong>
                  </p>
                  <p>
                    <strong className="text-foreground">Phone:</strong> (85) 8820-9823
                  </p>
                  <p>
                    <strong className="text-foreground">Email:</strong> contact@thesongsurprise.com
                  </p>
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-sm">
                      <strong className="text-foreground">Company Name:</strong> JULIANA MARANHAO PAIVA DE SOUSA ME
                    </p>
                    <p className="text-sm">
                      © 2025 MARANHÃO DIGITAL | All rights reserved.
                    </p>
                    <p className="text-sm">
                      CNPJ: 62.917.751/0001-24
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
