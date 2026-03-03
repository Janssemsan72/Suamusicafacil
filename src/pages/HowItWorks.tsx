import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { MessageCircle, Users, Music, Clock, CheckCircle, ArrowRight, Star, Shield, Download } from "@/lib/icons";
import { Link } from 'react-router-dom';
import { getLocalizedPath } from '@/lib/i18nRoutes';

export default function HowItWorks() {
  const { t, currentLanguage } = useTranslation();
  
  const getLocalizedLink = (path: string) => {
    // Detectar locale atual da URL
    const currentPath = window.location.pathname;
    const currentLocale = currentPath.split('/')[1];
    
    // Se estamos em uma rota localizada, usar o locale da URL
    const activeLocale = currentLocale === 'pt' ? currentLocale : 'pt';
    
    return getLocalizedPath(path, activeLocale);
  };
  
  const steps = [
    {
      icon: MessageCircle,
      title: "1. Tell Your Story",
      description: "Answer a few questions about your special moment, the person, and the emotions you want to convey.",
      time: "2 minutes",
      highlight: "Easy and quick",
      details: [
        "Questions about the special occasion",
        "Information about the person being honored",
        "Preferred musical style",
        "Message you want to convey"
      ]
    },
    {
      icon: Users,
      title: "2. Our Team Creates Your Song",
      description: "We deliver a unique song, created with dedication to transform your story into melody and words.",
      time: "48 hours",
      highlight: "Professional musicians",
      details: [
        "Personalized melody composition",
        "Creation of unique lyrics",
        "Production with real instruments",
        "Recording with professional vocals"
      ]
    },
    {
      icon: Music,
      title: "3. Receive Your Masterpiece",
      description: "Receive your personalized song in high quality, ready to share with the world.",
      time: "Instant download",
      highlight: "Professional quality",
      details: [
        "High-quality MP3 file",
        "Personalized cover in high resolution",
        "Complete song lyrics"
      ]
    }
  ];

  const features = [
    {
      icon: Clock,
      title: "Fast Delivery",
      description: "Your song is ready in up to 48 hours, without compromising quality."
    },
    {
      icon: Star,
      title: "Quality Guaranteed",
      description: "Each song is produced with real instruments and professional vocals."
    },
    {
      icon: Shield,
      title: "Revisions Included",
      description: "If you're not satisfied, we'll make adjustments at no additional cost."
    }
  ];

  const faq = [
    {
      question: "How long does it take to create my song?",
      answer: "With the Express plan, your song is ready in up to 48 hours. With the Standard plan, we deliver in up to 7 days."
    },
    {
      question: "Who are the musicians who create the songs?",
      answer: "Our team is made up of professional musicians and composers with years of experience in various musical styles."
    },
    {
      question: "What do I receive at the end?",
      answer: "You receive a high-quality MP3 file, a personalized cover in high resolution, and the complete song lyrics."
    }
  ];

  return (
    <div className="min-h-[100dvh]">
      <Header />
      
      <main className="container mx-auto px-4 pt-16 md:pt-20 pb-8 sm:pb-16 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
            How It <span className="text-primary">Works</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl sm:max-w-3xl mx-auto leading-relaxed">
            Creating your personalized song is simple and magical. In just 3 steps, 
            you'll have a unique masterpiece created by our team of professional musicians.
          </p>
        </div>

        {/* Steps Section */}
        <section className="mb-8 sm:mb-12">
          <div className="space-y-6 sm:space-y-8">
            {steps.map((step, index) => (
              <Card key={index} className="shadow-soft hover:shadow-medium transition-all">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-soft">
                        <step.icon className="h-6 w-6 sm:h-8 sm:w-8" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
                        <h2 className="text-lg sm:text-xl font-bold">{step.title}</h2>
                        <div className="flex items-center gap-2 bg-accent/20 text-accent px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
                          <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>{step.time}</span>
                        </div>
                      </div>
                      <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">{step.description}</p>
                      
                      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                        {step.details.map((detail, detailIndex) => (
                          <div key={detailIndex} className="flex items-start gap-2 sm:gap-3">
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 sm:mt-1 flex-shrink-0" />
                            <span className="text-xs sm:text-sm">{detail}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-2 text-primary font-semibold text-sm sm:text-base">
                        <CheckCircle className="h-4 w-4" />
                        <span>{step.highlight}</span>
                      </div>
                    </div>
                  </div>
                  
                  {index < steps.length - 1 && (
                    <div className="flex justify-center mt-4 sm:mt-6">
                      <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-primary/50" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-6 sm:mb-8">Why Choose The Song Surprise?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="text-center shadow-soft hover:shadow-medium transition-all">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <feature.icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-6 sm:mb-8">Frequently Asked Questions</h2>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            {faq.map((item, index) => (
              <Card key={index} className="shadow-soft">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3">{item.question}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">{item.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <Card className="max-w-2xl sm:max-w-3xl mx-auto bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-4 sm:p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">Ready to Create Your Song?</h2>
              <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base md:text-lg">
                Join over 1,000 people who have already created unforgettable moments with our team of professional musicians.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Link 
                  to={getLocalizedLink('/quiz')} 
                  className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl sm:rounded-2xl transition-colors text-base sm:text-lg font-semibold"
                >
                  <Music className="h-4 w-4 sm:h-5 sm:w-5" />
                  Create My Song Now
                </Link>
                <a 
                  href="/#pricing" 
                  id="gtm-ver-precos"
                  className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 border border-primary text-primary rounded-xl sm:rounded-2xl hover:bg-primary/10 transition-colors text-base sm:text-lg font-semibold gtm-link"
                >
                  View Pricing
                </a>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
