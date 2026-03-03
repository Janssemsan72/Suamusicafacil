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
        setTimeout(() => reject(new Error('Timeout. Please check your connection and try again.')), 30000); // 30 segundos
      });

      // Usar edge function para buscar e validar aprovação
      const invokePromise = supabase.functions.invoke('get-lyrics-approval', {
        body: { approval_token: token }
      });

      const { data: result, error } = await Promise.race([invokePromise, timeoutPromise]);

      if (error) {
        console.error('Error from edge function:', error);
        throw new Error(error.message || 'Error loading lyrics. Please try again.');
      }

      if (!result) {
        throw new Error('Empty server response. Please try again.');
      }

      if (result.error) {
        throw new Error(result.error || 'Approval not found');
      }

      if (!result.approval) {
        throw new Error('Approval data not found');
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
            title: 'Personalized Song',
            lyrics: approvalData.lyrics
          };
        }
      } else if (typeof approvalData.lyrics === 'object' && approvalData.lyrics !== null) {
        // Se já for objeto, usar diretamente
        lyricsData = approvalData.lyrics;
      } else {
        // Se não tiver lyrics, usar preview como fallback
        lyricsData = {
          title: approvalData.lyrics_preview?.split(' - ')[0] || 'Personalized Song',
          lyrics: approvalData.lyrics_preview || 'Lyrics not available'
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
      const errorMessage = error.message || 'Unknown error loading lyrics';
      
      toast.error("Error loading lyrics", {
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
      toast.error("Invalid token", {
        description: "Approval link is invalid or expired.",
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

      toast.success("✅ Lyrics approved!", {
        description: "Your song is being produced. You'll receive an email when it's ready.",
      });

      setTimeout(() => navigate('/'), 2000);

    } catch (error: any) {
      console.error('Error approving:', error);
      toast.error("Error approving", {
        description: error.message,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Reason required", {
        description: "Please explain what you'd like to adjust in the lyrics.",
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

      toast.success("📝 Feedback submitted!", {
        description: "Our team will adjust the lyrics as requested. You'll receive a new version soon.",
      });

      setTimeout(() => navigate('/'), 2000);

    } catch (error: any) {
      console.error('Error rejecting:', error);
      toast.error("Error submitting feedback", {
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
          <p className="text-muted-foreground">Could not load the lyrics.</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
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
            <CardTitle className="text-3xl">Approve Your Lyrics</CardTitle>
            <CardDescription>
              Review the lyrics created especially for you and decide whether to approve or request adjustments.
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
                ⏰ <strong>You have until {new Date(approval.expires_at).toLocaleString()} to decide.</strong>
                <br />
                If you don't respond, we'll automatically proceed with this version.
              </p>
            </div>

            {/* Formulário de rejeição (se ativo) */}
            {showRejectForm ? (
              <div className="space-y-4 border-t pt-6">
                <div>
                  <Label htmlFor="rejection">What would you like to adjust?</Label>
                  <Textarea
                    id="rejection"
                    placeholder="Describe the changes you'd like to see in the lyrics..."
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
                        Sending...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-2" />
                        Send Feedback
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => setShowRejectForm(false)}
                    disabled={processing}
                    variant="outline"
                  >
                    Cancel
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
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        ✅ Approve and Continue
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
                    ❌ Request Adjustments
                  </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
