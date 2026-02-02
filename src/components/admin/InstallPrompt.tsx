import { useEffect, useState } from "react";
import { Download, X, Smartphone, Monitor, Zap, Shield, Clock, Sparkles } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Verificar se já está instalado
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // Detectar se é mobile
    const mobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent
    );
    setIsMobile(mobile);

    // Escutar evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Escutar evento appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShow(false);
      setDeferred(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;

    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;

      if (outcome === "accepted") {
        console.log("[PWA] Usuário aceitou a instalação");
        // Opcional: enviar métrica de instalação
        setShow(false);
        setDeferred(null);
      } else {
        console.log("[PWA] Usuário rejeitou a instalação");
      }
    } catch (error) {
      console.error("[PWA] Erro ao instalar:", error);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    // Salvar preferência para não mostrar novamente por um tempo
    try {
      localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
    } catch (e) {
      // Ignorar erro de localStorage
    }
  };

  // Não mostrar se já está instalado ou se foi descartado recentemente
  if (isInstalled || !show || !deferred) return null;

  // Verificar se foi descartado recentemente (últimas 7 dias)
  try {
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed =
        (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return null;
      }
    }
  } catch {
    // Ignorar erro de localStorage
  }

  const benefits = [
    { icon: Zap, text: "Acesso mais rápido" },
    { icon: Shield, text: "Funciona offline" },
    { icon: Clock, text: "Notificações em tempo real" },
  ];

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-[420px] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <Card className="shadow-2xl border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                {isMobile ? (
                  <Smartphone className="h-6 w-6 text-primary" />
                ) : (
                  <Monitor className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-semibold">
                    Instalar MusicLovely Admin
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    PWA
                  </Badge>
                </div>
                <CardDescription className="text-sm">
                  {isMobile
                    ? "Adicione à tela inicial para acesso rápido e notificações"
                    : "Instale como app para melhor experiência e funcionalidades offline"}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Benefícios */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-1 text-center"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <benefit.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">
                  {benefit.text}
                </span>
              </div>
            ))}
          </div>

          {/* Botões */}
          <div className="flex gap-2">
            <Button
              onClick={handleInstall}
              className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg"
              size="sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Instalar Agora
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              size="sm"
              className="shrink-0"
            >
              Depois
            </Button>
          </div>

          {/* Instruções para iOS (se mobile) */}
          {isMobile && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md border border-dashed">
              <strong>iOS:</strong> Toque em{" "}
              <span className="font-mono bg-background px-1 rounded">Compartilhar</span>{" "}
              →{" "}
              <span className="font-mono bg-background px-1 rounded">
                Adicionar à Tela de Início
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

