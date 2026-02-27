import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Mail, MessageCircle } from '@/lib/icons';
import { clearQuizSessionId, clearQuizStepState } from '@/utils/quizSync';
import { scheduleNonCriticalRender } from '@/utils/scheduleNonCriticalRender';
import Logo from '@/components/Logo';

function getWhatsAppUrl() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id');
  const text = orderId
    ? `Olá, quero acompanhar meu pedido ${orderId}!`
    : 'Olá, quero acompanhar meu pedido!';
  return `https://wa.me/558592005977?text=${encodeURIComponent(text)}`;
}

const BRAND = {
  purple: '#8b5cf6',
  purpleDark: '#7c3aed',
  pink: '#ec4899',
  indigo: '#6366f1',
  bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #fdf2f8 100%)',
  confetti: ['#8b5cf6', '#ec4899', '#6366f1', '#a855f7', '#f43f5e'],
} as const;

const COUNTDOWN_SECONDS = 20;

export default function PaymentSuccess() {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const hasRedirected = useRef(false);
  const whatsappUrl = getWhatsAppUrl();

  useEffect(() => {
    clearQuizSessionId();
    clearQuizStepState();
  }, []);

  useEffect(() => {
    document.title = 'Pagamento Confirmado | Sua Música Fácil';
    return () => {
      document.title = 'Sua Música Fácil — Músicas Personalizadas Profissionais';
    };
  }, []);

  // Contagem regressiva + redirect automático
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            window.location.href = whatsappUrl;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Confetes
  const confettiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const run = async () => {
      try {
        const { default: confetti } = await import('canvas-confetti');
        const end = Date.now() + 3000;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
        const rand = (a: number, b: number) => Math.random() * (b - a) + a;

        confettiIntervalRef.current = setInterval(() => {
          const left = end - Date.now();
          if (left <= 0) {
            clearInterval(confettiIntervalRef.current!);
            confettiIntervalRef.current = null;
            return;
          }
          const n = 50 * (left / 3000);
          confetti({ ...defaults, particleCount: n, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount: n, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        confetti({ ...defaults, particleCount: 100, origin: { x: 0.5, y: 0.5 }, colors: [...BRAND.confetti] });
      } catch { /* silently fail */ }
    };

    const cancel = scheduleNonCriticalRender(run, { timeoutMs: 1000, delayMs: 100 });
    return () => {
      cancel?.();
      if (confettiIntervalRef.current) clearInterval(confettiIntervalRef.current);
    };
  }, []);

  const progress = ((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-3 sm:p-4" style={{ background: BRAND.bg }}>
      <style>{`
        @keyframes successPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(34,197,94,0); }
        }
        @keyframes shine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .success-circle {
          animation: successPulse 2s ease-in-out infinite;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          position: relative; overflow: hidden;
        }
        .success-circle::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          background-size: 200% 100%; animation: shine 3s ease-in-out infinite;
        }
      `}</style>

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-xl border-0">
        <CardContent className="p-5 sm:p-8 space-y-4">
          {/* Logo */}
          <div className="flex justify-center">
            <Logo width={220} className="w-[200px] sm:w-[280px]" />
          </div>

          {/* Check verde */}
          <div className="flex justify-center">
            <div className="success-circle w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 sm:w-12 sm:h-12 text-white relative z-10" strokeWidth={2.5} />
            </div>
          </div>

          {/* Título */}
          <h1 className="text-xl sm:text-2xl font-bold text-center" style={{ color: BRAND.purple }}>
            Pagamento Confirmado!
          </h1>

          <p className="text-sm text-center text-gray-600">
            Sua música personalizada está sendo preparada com carinho.
          </p>

          {/* E-mail */}
          <div
            className="p-3 sm:p-4 rounded-xl border-2"
            style={{ borderColor: '#c4b5fd', backgroundColor: '#f5f3ff' }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(139,92,246,0.1)' }}>
                <Mail className="w-5 h-5" style={{ color: BRAND.purple }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#5b21b6' }}>
                  Você receberá tudo por e-mail
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  suport@suamusicafacil.com.br
                </p>
              </div>
            </div>
          </div>

          {/* WhatsApp — destaque */}
          <div
            className="p-3 sm:p-4 rounded-xl border-2"
            style={{ borderColor: '#86efac', backgroundColor: '#f0fdf4' }}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
                <MessageCircle className="w-5 h-5" style={{ color: '#22c55e' }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: '#166534' }}>
                  Pelo WhatsApp você recebe sua música mais rápido!
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Acompanhe seu pedido e tire dúvidas em tempo real.
                </p>
              </div>
            </div>
          </div>

          {/* Botão WhatsApp */}
          <Button
            asChild
            className="w-full text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all rounded-xl py-3 text-sm sm:text-base"
            style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', border: 'none' }}
          >
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { hasRedirected.current = true; }}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Ir para o WhatsApp agora
            </a>
          </Button>

          {/* Barra de progresso + contagem */}
          <div className="space-y-1.5">
            <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, #25D366, #128C7E)`,
                }}
              />
            </div>
            <p className="text-xs text-center text-gray-400">
              {countdown > 0
                ? `Redirecionando para o WhatsApp em ${countdown}s...`
                : 'Redirecionando...'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
