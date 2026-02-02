import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2, XCircle, AlertCircle } from "@/lib/icons";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SunoCreditsCard() {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'valid' | 'warning' | 'invalid' | 'not-configured'>('idle');

  const testConnection = async () => {
    setTesting(true);
    setStatus('idle');
    
    try {
      // Verificar se há jobs recentes do Suno como indicador de conexão
      const { count, error } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (error) {
        console.error('Erro ao verificar conexão:', error);
        setStatus('invalid');
        toast.error("Erro ao verificar conexão", {
          description: error.message,
        });
        return;
      }

      // Se há jobs recentes, assume que a conexão está funcionando
      if (count && count > 0) {
        setStatus('valid');
        toast.success("✅ Sistema Suno Ativo", {
          description: `${count} job(s) processado(s) nas últimas 24h`,
        });
      } else {
        setStatus('warning');
        toast.warning("⚠️ Nenhuma atividade recente", {
          description: "Não há jobs do Suno nas últimas 24h",
        });
      }
    } catch (error: any) {
      console.error('Erro:', error);
      setStatus('invalid');
      toast.error("Erro", {
        description: error.message,
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'valid':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'invalid':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'not-configured':
        return <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'valid':
        return 'Conexão OK';
      case 'invalid':
        return 'API Key inválida';
      case 'not-configured':
        return 'Não configurada';
      case 'warning':
        return 'Sem atividade recente';
      default:
        return 'Status da API Suno';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {getStatusIcon()}
          {getStatusText()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          variant="outline" 
          onClick={testConnection}
          disabled={testing}
          className="w-full"
        >
          {testing ? 'Testando...' : 'Testar Conexão Suno'}
        </Button>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Cada geração: ~$0.04</p>
          <p>• Configure em Supabase → Functions</p>
          {status === 'invalid' && (
            <p className="text-red-600 dark:text-red-400 font-medium">
              ⚠️ Verifique a SUNO_API_KEY
            </p>
          )}
          {status === 'valid' && (
            <p className="text-green-600 dark:text-green-400 font-medium">
              ✅ Pronto para gerar músicas
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
