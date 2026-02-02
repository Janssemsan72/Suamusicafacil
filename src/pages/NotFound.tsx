import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Home } from "@/lib/icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useUtmParams } from "@/hooks/useUtmParams";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { navigateWithUtms } = useUtmParams();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Detectar idioma baseado na URL
  const getHomePath = () => {
    const pathname = location.pathname;
    if (pathname.startsWith('/en')) return '/en';
    if (pathname.startsWith('/es')) return '/es';
    if (pathname.startsWith('/pt')) return '/pt';
    return '/pt'; // fallback para português
  };

  const handleGoHome = () => {
    navigateWithUtms(getHomePath());
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
          <CardDescription className="text-lg">
            {t('notFound.title') || 'Página não encontrada'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            {t('notFound.description') || 'A página que você está procurando não existe ou foi movida.'}
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={handleGoHome} className="w-full" size="lg">
              <Home className="mr-2 h-4 w-4" />
              {t('notFound.backHome') || 'Voltar para Home'}
            </Button>
            <Button 
              onClick={() => window.history.back()} 
              variant="outline" 
              className="w-full"
            >
              {t('notFound.goBack') || 'Voltar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
