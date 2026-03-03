import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, XCircle, Loader2 } from "@/lib/icons";
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useUtmParams } from '@/hooks/useUtmParams';
import { supabase } from '@/integrations/supabase/client';

export default function HotmartReturn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  // Preservar e mostrar UTMs
  const { utms, hasUtms, navigateWithUtms } = useUtmParams();
  
  const [status, setStatus] = useState<'checking' | 'approved' | 'pending' | 'failed'>('checking');
  const [countdown, setCountdown] = useState(5);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderIdParam = params.get('order_id');
    const statusParam = params.get('status');
    
    console.log('🇧🇷 [HotmartReturn] Parâmetros recebidos:', {
      orderId: orderIdParam,
      status: statusParam,
      fullUrl: window.location.href
    });

    if (!orderIdParam) {
      console.error('❌ [HotmartReturn] Order ID não encontrado');
      toast.error('Order ID not found');
      
      // Detectar idioma atual da URL e redirecionar para checkout no idioma correto
      const currentPath = window.location.pathname;
      let checkoutPath = '/pt/checkout?error=missing_order_id'; // fallback para português
      
      if (currentPath.startsWith('/en')) {
        checkoutPath = '/en/checkout?error=missing_order_id';
      } else if (currentPath.startsWith('/es')) {
        checkoutPath = '/es/checkout?error=missing_order_id';
      } else if (currentPath.startsWith('/pt')) {
        checkoutPath = '/pt/checkout?error=missing_order_id';
      }
      
      console.log('🔄 [HotmartReturn] Redirecionando para checkout no idioma:', checkoutPath);
      navigateWithUtms(checkoutPath);
      return;
    }

    setOrderId(orderIdParam);

    if (statusParam === 'approved') {
      setStatus('approved');
      // Aguardar webhook processar usando requestAnimationFrame
      const processApproval = () => {
        // Hotmart é internacional, mas vamos manter PT por enquanto se não tiver outro
        const language = 'pt';
        
        console.log('🇧🇷 [HotmartReturn] Processando aprovação Hotmart');
        console.log('🌍 [HotmartReturn] Idioma fixo para Hotmart: pt');
        
        // Persistir idioma
        localStorage.setItem('suamusicafacil_language', language);
        document.cookie = `lang=${language};path=/;max-age=${60*60*24*365};samesite=lax`;
        document.documentElement.lang = language;
        
        // Preservar UTMs na navegação
        const utmQuery = Object.keys(utms).length > 0 
          ? '&' + Object.entries(utms).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&')
          : '';
        const successPath = `/pt/payment/success?order_id=${orderIdParam}${utmQuery}`;
        
        console.log('🔄 [HotmartReturn] Redirecionando para:', successPath);
        console.log('📊 [HotmartReturn] UTMs preservados:', utms);
        navigateWithUtms(successPath);
      };
      setTimeout(() => processApproval(), 500);
    } else if (statusParam === 'pending') {
      setStatus('pending');
      // Verificar status do pedido periodicamente
      checkOrderStatus(orderIdParam);
    } else if (statusParam === 'cancelled' || statusParam === 'failed') {
      setStatus('failed');
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            navigateWithUtms('/pt/checkout?error=payment_failed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      console.warn('⚠️ [HotmartReturn] Status desconhecido:', statusParam);
      setStatus('failed');
    }
  }, [location.search, navigate]);

  const checkOrderStatus = async (orderId: string, attempt: number = 0, maxAttempts: number = 10) => {
    try {
      console.log(`🔍 [HotmartReturn] Verificando status do pedido (tentativa ${attempt + 1}/${maxAttempts}):`, orderId);
      
      const { data: order, error } = await supabase
        .from('orders')
        .select('status, provider, payment_provider, hotmart_payment_status')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('❌ [HotmartReturn] Erro ao buscar pedido:', error);
        // Se ainda temos tentativas, tentar novamente
        if (attempt < maxAttempts - 1) {
          setTimeout(() => checkOrderStatus(orderId, attempt + 1, maxAttempts), 2000);
        }
        return;
      }

      console.log('📋 [HotmartReturn] Status do pedido:', {
        orderId,
        status: order.status,
        provider: order.provider,
        paymentProvider: order.payment_provider,
        hotmartStatus: order.hotmart_payment_status,
        attempt: attempt + 1
      });

      // ✅ CORREÇÃO: Considerar pedido como pago se:
      // - order.status === 'paid', OU
      // - order.hotmart_payment_status === 'approved' e provider === 'hotmart'
      const isPaid = order.status === 'paid' || 
                     (order.hotmart_payment_status === 'approved' && 
                      (order.provider === 'hotmart' || order.payment_provider === 'hotmart'));

      if (isPaid) {
        setStatus('approved');
        console.log('✅ [HotmartReturn] Pedido está pago (status ou hotmart_payment_status), redirecionando...');
        navigateWithUtms('/payment-success');
        return;
      } else if (order.status === 'cancelled' || order.status === 'failed') {
        setStatus('failed');
        return;
      }

      // Se ainda está 'pending' e não atingimos o máximo de tentativas
      if (attempt < maxAttempts - 1) {
        // A cada 3 tentativas, chamar função de verificação
        if (attempt > 0 && attempt % 3 === 0) {
          console.log('🔄 [HotmartReturn] Chamando função de verificação de status...');
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-hotmart-payment-status', {
              body: { order_id: orderId }
            });
            
            if (verifyError) {
              console.warn('⚠️ [HotmartReturn] Erro ao verificar status via função:', verifyError);
            } else {
              console.log('📋 [HotmartReturn] Resultado da verificação:', verifyData);
              if (verifyData?.order_status === 'paid') {
                setStatus('approved');
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    navigateWithUtms('/payment-success');
                  });
                });
                return;
              }
            }
          } catch (verifyErr) {
            console.warn('⚠️ [HotmartReturn] Erro ao chamar função de verificação:', verifyErr);
          }
        }
        
        // Continuar verificando após 2 segundos
        setTimeout(() => checkOrderStatus(orderId, attempt + 1, maxAttempts), 2000);
      } else {
        // Última tentativa: chamar função de verificação uma última vez
        console.log('🔄 [HotmartReturn] Última tentativa - chamando função de verificação...');
        try {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-hotmart-payment-status', {
            body: { order_id: orderId }
          });
          
          if (verifyError) {
            console.error('❌ [HotmartReturn] Erro na verificação final:', verifyError);
            setStatus('failed');
          } else {
            console.log('📋 [HotmartReturn] Resultado da verificação final:', verifyData);
            if (verifyData?.order_status === 'paid') {
              setStatus('approved');
              navigateWithUtms('/payment-success');
            } else {
              // Mesmo após verificação, ainda está pending
              console.warn('⚠️ [HotmartReturn] Pedido ainda está pendente após todas as tentativas');
              setStatus('pending');
            }
          }
        } catch (verifyErr) {
          console.error('❌ [HotmartReturn] Erro na verificação final:', verifyErr);
          setStatus('failed');
        }
      }
    } catch (error) {
      console.error('❌ [HotmartReturn] Erro na verificação:', error);
      if (attempt < maxAttempts - 1) {
        setTimeout(() => checkOrderStatus(orderId, attempt + 1, maxAttempts), 2000);
      } else {
        setStatus('failed');
      }
    }
  };

  const handleRetry = () => {
    navigateWithUtms('/pt/checkout');
  };

  const handleGoHome = () => {
    navigateWithUtms('/');
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-8 h-8 text-primary animate-spin" />;
      case 'approved':
        return <CheckCircle2 className="w-8 h-8 text-green-500" />;
      case 'pending':
        return <Clock className="w-8 h-8 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Loader2 className="w-8 h-8 text-primary animate-spin" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'checking':
        return t('hotmartReturn.checking.title');
      case 'approved':
        return t('hotmartReturn.approved.title');
      case 'pending':
        return t('hotmartReturn.pending.title');
      case 'failed':
        return t('hotmartReturn.failed.title');
      default:
        return t('hotmartReturn.checking.title');
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'checking':
        return t('hotmartReturn.checking.description');
      case 'approved':
        return t('hotmartReturn.approved.description');
      case 'pending':
        return t('hotmartReturn.pending.description');
      case 'failed':
        return t('hotmartReturn.failed.description');
      default:
        return t('hotmartReturn.checking.description');
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-secondary/5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-center">{getStatusTitle()}</CardTitle>
          <CardDescription className="text-center">
            {getStatusDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'pending' && (
            <div className="space-y-2">
              <Progress value={66} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                {t('hotmartReturn.pending.progress')}
              </p>
            </div>
          )}

          {status === 'approved' && (
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300 text-center">
                {t('hotmartReturn.approved.successMessage')}
              </p>
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300 text-center">
                {t('hotmartReturn.failed.errorMessage')}
              </p>
              {countdown > 0 && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  {t('hotmartReturn.failed.redirecting', { countdown })}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {status === 'failed' && (
              <Button onClick={handleRetry} className="w-full">
                {t('hotmartReturn.failed.tryAgain')}
              </Button>
            )}
            <Button onClick={handleGoHome} variant="outline" className="w-full">
              {t('hotmartReturn.goHome')}
            </Button>
          </div>

          {orderId && (
            <p className="text-xs text-center text-muted-foreground">
              {t('hotmartReturn.orderId', { orderId })}
            </p>
          )}

          {/* Exibir parâmetros UTM */}
          {hasUtms && (
            <div className="mt-4 p-3 bg-muted rounded-lg border">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                📊 UTM Parameters Detected:
              </p>
              <div className="space-y-1">
                {Object.entries(utms).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">{key}:</span>
                    <span className="text-foreground">{value as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
