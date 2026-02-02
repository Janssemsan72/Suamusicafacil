// FASE 2: Página de Status Intermediária do Checkout

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from "@/lib/icons";
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { safeReload } from '@/utils/reload';

interface ProcessingStep {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message: string;
}

export default function CheckoutProcessing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { email, planId, quizData, transactionId } = location.state || {};

  const [steps, setSteps] = useState<ProcessingStep[]>([
    { name: 'quiz', status: 'pending', message: t('checkoutProcessing.steps.quiz') },
    { name: 'order', status: 'pending', message: t('checkoutProcessing.steps.order') },
    { name: 'payment', status: 'pending', message: t('checkoutProcessing.steps.payment') },
  ]);

  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    // Se não tem dados, redirecionar
    if (!email || !planId || !quizData || !transactionId) {
      toast.error(t('checkoutProcessing.incompleteData'));
      navigate('/checkout');
      return;
    }

    // Timeout de 30 segundos usando requestAnimationFrame
    const timeout = window.setTimeout(() => {
      setTimeoutReached(true);
      setError(t('checkoutProcessing.error'));
    }, 30000);

    return () => clearTimeout(timeout);
  }, [email, planId, quizData, transactionId, navigate, t]);

  const updateStep = (index: number, status: ProcessingStep['status'], message?: string) => {
    setSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = {
        ...newSteps[index],
        status,
        message: message || newSteps[index].message
      };
      return newSteps;
    });
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleCancel = () => {
    navigate('/checkout');
  };

  const handleRetry = () => {
    safeReload({ reason: 'CheckoutProcessing' });
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-secondary/5">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-center">
            {error ? t('checkoutProcessing.errorTitle') : timeoutReached ? t('checkoutProcessing.timeoutTitle') : t('checkoutProcessing.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!error && !timeoutReached && (
            <>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.name} className="flex items-center gap-3">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : step.status === 'error' ? (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    ) : step.status === 'processing' ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 border-2 border-muted rounded-full flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm ${step.status === 'processing' ? 'font-medium' : ''}`}>
                        {step.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  {Math.round(progress)}% {t('checkoutProcessing.progress')}
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {(error || timeoutReached) && (
            <div className="flex gap-2">
              <Button onClick={handleRetry} className="flex-1">
                {t('checkoutProcessing.tryAgain')}
              </Button>
              <Button onClick={handleCancel} variant="outline" className="flex-1">
                {t('checkoutProcessing.back')}
              </Button>
            </div>
          )}

          {!error && !timeoutReached && (
            <Button onClick={handleCancel} variant="outline" className="w-full">
              {t('checkoutProcessing.cancel')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
