import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "@/lib/icons";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

interface GenerateLyricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void; // Callback para refetch após sucesso
}

export function GenerateLyricsDialog({ open, onOpenChange, onSuccess }: GenerateLyricsDialogProps) {
  const [orderId, setOrderId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!orderId.trim()) {
      toast.error("Por favor, insira o ID do pedido");
      return;
    }

    setIsGenerating(true);
    
    try {
      logger.debug("Gerando letras para pedido", { orderId });

      // Chamar a Edge Function
      const { data, error } = await supabase.functions.invoke('generate-lyrics-for-approval', {
        body: { order_id: orderId.trim() }
      });

      if (error) {
        throw error;
      }

      logger.event('lyrics_generated_from_order', { orderId, jobId: data?.job_id });
      
      toast.success(
        <div>
          <p className="font-semibold">✅ Letra sendo gerada!</p>
          <p className="text-sm mt-1">A letra aparecerá em "Pendentes" em alguns segundos.</p>
          {data?.job_id && (
            <p className="text-xs mt-1 text-muted-foreground">Job ID: {data.job_id}</p>
          )}
        </div>,
        { duration: 5000 }
      );

      // Limpar e fechar
      setOrderId("");
      onOpenChange(false);
      
      // ✅ CORREÇÃO: Aguardar um pouco e chamar callback para refetch
      // Isso garante que a approval apareça imediatamente na lista
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 2000); // Aguardar 2 segundos para garantir que a approval foi criada
      
    } catch (error: any) {
      logger.error("Erro ao gerar letras para pedido", error, { orderId });
      const errorMessage = error.message || 'Erro desconhecido';
      toast.error(`Erro ao gerar letras: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setOrderId("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-600" />
            Gerar Letras para Pedido
          </DialogTitle>
          <DialogDescription>
            Insira o ID do pedido para gerar letras. A função criará um job e uma aprovação pendente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="order-id" className="text-sm font-medium">
              ID do Pedido
            </label>
            <Input
              id="order-id"
              placeholder="Ex: ce1e1186-c976-4ccc-a479-95b38f38fd46"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isGenerating) {
                  handleGenerate();
                }
              }}
              disabled={isGenerating}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              O pedido deve ter um quiz associado para gerar as letras.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isGenerating}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !orderId.trim()}
            className="bg-[#C7916B] hover:bg-[#B8825C] text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Letras
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

