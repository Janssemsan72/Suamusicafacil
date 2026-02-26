import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "@/lib/icons";

export default function ApproveLyrics() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const token = searchParams.get('token');
  const action = searchParams.get('action');
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [approval, setApproval] = useState<any>(null);
  const [lyrics, setLyrics] = useState<any>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadApproval = useCallback(async () => {
    try {
      setLoading(true);
      
      // ✅ CORREÇÃO MOBILE: Adicionar timeout para evitar loading infinito
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Tempo limite excedido. Verifique sua conexão e tente novamente.')), 30000); // 30 segundos
      });

      // Usar edge function para buscar e validar aprovação
      const invokePromise = supabase.functions.invoke('get-lyrics-approval', {
        body: { approval_token: token }
      });

      const { data: result, error } = await Promise.race([invokePromise, timeoutPromise]);

      if (error) {
        console.error('Error from edge function:', error);
        throw new Error(error.message || 'Erro ao carregar letra. Tente novamente.');
      }

      if (!result) {
        throw new Error('Resposta vazia do servidor. Tente novamente.');
      }

      if (result.error) {
        throw new Error(result.error || 'Aprovação não encontrada');
      }

      if (!result.approval) {
        throw new Error('Dados da aprovação não encontrados');
      }

      // ✅ CORREÇÃO: Verificar se lyrics existe e tem estrutura correta
      const approvalData = result.approval;
      let lyricsData = null;

      // Lyrics pode estar em diferentes formatos
      if (typeof approvalData.lyrics === 'string') {
        // Se for string, tentar fazer parse
        try {
          lyricsData = JSON.parse(approvalData.lyrics);
        } catch {
          // Se não for JSON válido, usar como texto simples
          lyricsData = {
            title: 'Música Personalizada',
            lyrics: approvalData.lyrics
          };
        }
      } else if (typeof approvalData.lyrics === 'object' && approvalData.lyrics !== null) {
        // Se já for objeto, usar diretamente
        lyricsData = approvalData.lyrics;
      } else {
        // Se não tiver lyrics, usar preview como fallback
        lyricsData = {
          title: approvalData.lyrics_preview?.split(' - ')[0] || 'Música Personalizada',
          lyrics: approvalData.lyrics_preview || 'Letra não disponível'
        };
      }

      setApproval(approvalData);
      setLyrics(lyricsData);

      // Se action=reject na URL, mostrar form de rejeição
      if (action === 'reject') {
        setShowRejectForm(true);
      }

    } catch (error: any) {
      console.error('Error loading approval:', error);
      
      // ✅ CORREÇÃO MOBILE: Mensagem de erro mais clara
      const errorMessage = error.message || 'Erro desconhecido ao carregar letra';
      
      toast.error("Erro ao carregar letra", {
        description: errorMessage,
        duration: 5000,
      });
      
      // Não redirecionar imediatamente no mobile - dar tempo para o usuário ver o erro
      setTimeout(() => navigate('/'), 5000);
    } finally {
      setLoading(false);
    }
  }, [action, navigate, token]);

  useEffect(() => {
    if (!token) {
      toast.error("Token inválido", {
        description: "Link de aprovação inválido ou expirado.",
      });
      navigate('/');
      return;
    }

    loadApproval();
  }, [loadApproval, navigate, token]);

  const handleApprove = async () => {
    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('approve-lyrics', {
        body: { approval_token: token }
      });

      if (error) throw error;

      toast.success("✅ Letra aprovada!", {
        description: "Sua música está sendo produzida. Você receberá um email quando estiver pronta.",
      });

      setTimeout(() => navigate('/'), 2000);

    } catch (error: any) {
      console.error('Error approving:', error);
      toast.error("Erro ao aprovar", {
        description: error.message,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Motivo necessário", {
        description: "Por favor, explique o que gostaria de ajustar na letra.",
      });
      return;
    }

    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('reject-lyrics', {
        body: { 
          approval_token: token,
          rejection_reason: rejectionReason 
        }
      });

      if (error) throw error;

      toast.success("📝 Feedback enviado!", {
        description: "Nossa equipe vai ajustar a letra conforme seu pedido. Você receberá uma nova versão em breve.",
      });

      setTimeout(() => navigate('/'), 2000);

    } catch (error: any) {
      console.error('Error rejecting:', error);
      toast.error("Erro ao enviar feedback", {
        description: error.message,
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!approval || !lyrics) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Não foi possível carregar a letra.</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Aprove sua Letra</CardTitle>
            <CardDescription>
              Revise a letra criada especialmente para você e decida se deseja aprovar ou solicitar ajustes.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Título da música */}
            <div>
              <h2 className="text-2xl font-bold text-primary mb-4">{lyrics.title}</h2>
            </div>

            {/* Letra */}
            <div className="bg-muted/50 p-4 sm:p-6 rounded-lg border-l-4 border-primary">
              <pre className="whitespace-pre-wrap font-serif text-sm sm:text-base leading-relaxed break-words overflow-x-auto">
                {typeof lyrics.lyrics === 'string' ? lyrics.lyrics : JSON.stringify(lyrics.lyrics, null, 2)}
              </pre>
            </div>

            {/* Informações */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-l-4 border-yellow-500">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⏰ <strong>Você tem até {new Date(approval.expires_at).toLocaleString('pt-BR')} para decidir.</strong>
                <br />
                Se não responder, continuaremos automaticamente com esta versão.
              </p>
            </div>

            {/* Formulário de rejeição (se ativo) */}
            {showRejectForm ? (
              <div className="space-y-4 border-t pt-6">
                <div>
                  <Label htmlFor="rejection">O que você gostaria de ajustar?</Label>
                  <Textarea
                    id="rejection"
                    placeholder="Descreva as mudanças que gostaria de ver na letra..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={5}
                    className="mt-2"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleReject}
                    disabled={processing}
                    variant="destructive"
                    className="flex-1"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-2" />
                        Enviar Feedback
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => setShowRejectForm(false)}
                    disabled={processing}
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              /* Botões de ação */
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-6 border-t">
                <Button
                  onClick={handleApprove}
                  disabled={processing}
                  className="flex-1 w-full sm:w-auto"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      ✅ Aprovar e Continuar
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => setShowRejectForm(true)}
                  disabled={processing}
                  variant="outline"
                  className="flex-1 w-full sm:w-auto"
                  size="lg"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  ❌ Solicitar Ajustes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
