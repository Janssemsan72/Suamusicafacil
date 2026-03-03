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
      role: "Lead Composer",
      specialty: "Pop & MPB",
      experience: "8 years",
      description: "Specialist in creating moving melodies that touch the heart."
    },
    {
      name: "Carlos Mendes",
      role: "Music Producer",
      specialty: "Rock & Sertanejo",
      experience: "12 years",
      description: "Responsible for the high-quality production of every song."
    },
    {
      name: "Marina Costa",
      role: "Lyricist",
      specialty: "Romantic & Gospel",
      experience: "6 years",
      description: "Creates personalized lyrics that tell unique stories."
    }
  ];

  const values = [
    {
      icon: Heart,
      title: "Passion for Music",
      description: "Every composition is created with love and dedication, thinking about the special moment you want to celebrate."
    },
    {
      icon: Users,
      title: "Professional Team",
      description: "Our musicians and composers have years of experience and specialize in various musical styles."
    },
    {
      icon: Award,
      title: "Quality Guaranteed",
      description: "We are committed to delivering professional-quality music, ready to share with the world."
    },
    {
      icon: Clock,
      title: "Fast Delivery",
      description: "We deliver your personalized song within 48 hours, without compromising quality."
    }
  ];

  const stats = [
    { number: "500+", label: "Songs Created" },
    { number: "98%", label: "Customer Satisfaction" },
    { number: "48h", label: "Delivery Time" },
    { number: "5.0", label: "Average Rating" }
  ];

  return (
    <div className="min-h-[100dvh]">
      <Header />
      
      <main className="container mx-auto px-4 pt-16 md:pt-20 pb-16 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            About <span className="text-primary">The Song Surprise</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            We are a team passionate about music, dedicated to creating unforgettable moments 
            through personalized compositions that touch the heart.
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
              <h2 className="text-3xl font-bold mb-6 text-center">Our Story</h2>
              <div className="prose prose-lg max-w-none text-muted-foreground">
                <p className="mb-4">
                  The Song Surprise was born from a passion for connecting people through music. 
                  We believe every special moment deserves a unique soundtrack, 
                  created especially to celebrate love, friendship, and the most precious memories.
                </p>
                <p className="mb-4">
                  Our team of professional musicians and composers works with dedication 
                  to transform your stories into melodies that move hearts and remain forever 
                  in the memory of those you love.
                </p>
                <p>
                  Each song is a unique masterpiece, produced with real instruments and professional vocals, 
                  ensuring studio quality for your most special moments.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Our Values */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
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
          <h2 className="text-3xl font-bold text-center mb-12">Our Team</h2>
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
                    {member.specialty} • {member.experience} of experience
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
              <h2 className="text-3xl font-bold text-center mb-8">Why Choose The Song Surprise?</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Professional Musicians</h3>
                      <p className="text-sm text-muted-foreground">
                        Our team is made up of musicians and composers with years of experience.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Quality Guaranteed</h3>
                      <p className="text-sm text-muted-foreground">
                        Each song is produced with real instruments and professional vocals.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Fast Delivery</h3>
                      <p className="text-sm text-muted-foreground">
                        Receive your personalized song in up to 48 hours.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">100% Personalized</h3>
                      <p className="text-sm text-muted-foreground">
                        Each song is created especially for your unique moment.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Full Support</h3>
                      <p className="text-sm text-muted-foreground">
                        Our team is always available to help.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Satisfaction Guarantee</h3>
                      <p className="text-sm text-muted-foreground">
                        If you're not satisfied, we'll make adjustments at no additional cost.
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
              <h2 className="text-2xl font-bold mb-4">Ready to Create Your Song?</h2>
              <p className="text-muted-foreground mb-6">
                Join over 1,000 people who have already created unforgettable moments with The Song Surprise.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  to={getLocalizedLink('/quiz')} 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-2xl transition-colors"
                >
                  <Music className="h-4 w-4" />
                  Create My Song
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
