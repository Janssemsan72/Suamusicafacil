import { useState, useEffect, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, XCircle, RefreshCw, Clock, FileText, Music, Eye, User, AlarmClock, Trash2, Pencil, Save, Mic, X, ExternalLink, Copy, Check } from "@/lib/icons";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LyricsApproval } from "@/types/admin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/utils/logger";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { sanitizeLyricsText } from "@/utils/sanitize";

/**
 * Mapeia o vocal_gender do quiz para o formato do campo de voz
 * @param vocalGender - Valor do quiz: 'm', 'f', '', null ou undefined
 * @returns Valor para o campo: 'M' (Masculino), 'F' (Feminino) ou 'S' (Sem preferência)
 */
const mapVocalGenderToVoice = (vocalGender: string | null | undefined): string => {
  if (!vocalGender || vocalGender.trim() === '') {
    return 'S'; // Sem preferência
  }
  const normalized = vocalGender.trim().toLowerCase();
  if (normalized === 'm') {
    return 'M'; // Masculino
  }
  if (normalized === 'f') {
    return 'F'; // Feminino
  }
  return 'S'; // Default: Sem preferência
};

interface LyricsCardProps {
  approval: LyricsApproval;
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
  onUnapprove?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, lyrics: any) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isUnapproving?: boolean;
  isRegenerating?: boolean;
  isDeleting?: boolean;
  isEditing?: boolean;
  compact?: boolean;
  className?: string;
}

// ✅ OTIMIZAÇÃO: Memoizar componente para evitar re-renders desnecessários
export const LyricsCard = memo(function LyricsCard({
  approval,
  onApprove,
  onReject,
  onUnapprove,
  onRegenerate,
  onDelete,
  onEdit,
  isApproving = false,
  isRejecting = false,
  isUnapproving = false,
  isRegenerating = false,
  isDeleting = false,
  isEditing = false,
  compact = false,
  className = ""
}: LyricsCardProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showLyricsDialog, setShowLyricsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [editedLyrics, setEditedLyrics] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(approval.is_highlighted || false);
  const [isUpdatingHighlight, setIsUpdatingHighlight] = useState(false);
  // Inicializar voz: usar approval.voice se existir, senão mapear do quiz, senão 'S' (Sem preferência)
  const getInitialVoice = () => {
    if (approval.voice) return approval.voice;
    if (approval.quizzes?.vocal_gender) {
      return mapVocalGenderToVoice(approval.quizzes.vocal_gender);
    }
    return 'S';
  };
  
  const [selectedVoice, setSelectedVoice] = useState<string>(getInitialVoice());
  const [isUpdatingVoice, setIsUpdatingVoice] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [loadedLyrics, setLoadedLyrics] = useState<any>(approval.lyrics || null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const queryClient = useQueryClient();

  // ✅ OTIMIZAÇÃO: Carregar lyrics apenas quando o modal for aberto (lazy loading)
  useEffect(() => {
    if (showLyricsDialog && !loadedLyrics && !isLoadingLyrics) {
      setIsLoadingLyrics(true);
      // Carregar lyrics apenas quando necessário
      supabase
        .from('lyrics_approvals')
        .select('lyrics')
        .eq('id', approval.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data?.lyrics) {
            setLoadedLyrics(data.lyrics);
          }
          setIsLoadingLyrics(false);
        })
        .catch((err) => {
          logger.warn('Erro ao carregar lyrics', err);
          setIsLoadingLyrics(false);
        });
    }
  }, [showLyricsDialog, approval.id, loadedLyrics, isLoadingLyrics]);

  useEffect(() => {
    logger.debug('LyricsCard showLyricsDialog', { open: showLyricsDialog, approvalId: approval.id });
  }, [showLyricsDialog, approval.id]);

  useEffect(() => {
    logger.debug('LyricsCard showEditDialog', { open: showEditDialog, approvalId: approval.id });
  }, [showEditDialog, approval.id]);

  // Sincronizar voz quando approval mudar
  useEffect(() => {
    const voiceFromQuiz = mapVocalGenderToVoice(approval.quizzes?.vocal_gender);
    const finalVoice = approval.voice || voiceFromQuiz || 'S';
    
    // Garantir que o valor seja sempre válido (M, F ou S)
    if (finalVoice && ['M', 'F', 'S'].includes(finalVoice)) {
    setSelectedVoice(finalVoice);
    } else {
      setSelectedVoice('S');
    }
  }, [approval.voice, approval.quizzes?.vocal_gender, approval.id]);

  // Sincronizar is_highlighted quando approval mudar
  useEffect(() => {
    setIsHighlighted(approval.is_highlighted || false);
  }, [approval.is_highlighted]);


  // ✅ CORREÇÃO: Detectar quando a letra foi gerada e forçar atualização
  useEffect(() => {
    const lyricsData = getLyricsData();
    const wasPlaceholder = approval.lyrics_preview === 'Gerando letra...' || 
                          (lyricsData?.title === 'Gerando letra...');
    const nowHasLyrics = lyricsData && 
                        lyricsData.title !== 'Gerando letra...' && 
                        lyricsData.lyrics && 
                        lyricsData.lyrics !== 'A letra está sendo gerada. Aguarde alguns instantes e atualize a página.';
    
    // Se tinha placeholder e agora tem letra real, invalidar cache para forçar atualização
    if (wasPlaceholder && nowHasLyrics) {
      queryClient.invalidateQueries({ 
        queryKey: ["lyrics-approvals"],
        refetchType: 'active'
      });
    }
  }, [loadedLyrics, approval.lyrics, approval.lyrics_preview, approval.id, queryClient]);

  // Função para atualizar o estado de destaque no banco
  const handleHighlightChange = async (checked: boolean) => {
    setIsHighlighted(checked);
    setIsUpdatingHighlight(true);
    
    try {
      const { error } = await supabase
        .from('lyrics_approvals')
        .update({ 
          is_highlighted: checked,
          updated_at: new Date().toISOString()
        })
        .eq('id', approval.id);
      
      if (error) {
        throw error;
      }
      
      // Invalidar cache para atualizar em todos os lugares
      queryClient.invalidateQueries({ 
        queryKey: ["lyrics-approvals"],
        refetchType: 'none'
      });
      
      logger.event('lyrics_highlight_updated', { approvalId: approval.id, highlighted: checked });
    } catch (error: any) {
      logger.error('Erro ao atualizar destaque', error, { approvalId: approval.id });
      toast.error(`Erro ao atualizar destaque: ${error.message || 'Erro desconhecido'}`);
      // Reverter estado em caso de erro
      setIsHighlighted(!checked);
    } finally {
      setIsUpdatingHighlight(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Por favor, forneça um motivo para a rejeição');
      return;
    }
    if (!onReject) {
      logger.warn('onReject não está definido', { approvalId: approval.id });
      return;
    }
    try {
      // ✅ CORREÇÃO: Aguardar a conclusão da rejeição antes de fechar o dialog
      await onReject(approval.id, rejectionReason.trim());
      setRejectionReason("");
      setShowRejectDialog(false);
    } catch (error) {
      // ✅ CORREÇÃO: Não fechar dialog em caso de erro - o erro já foi tratado no handleReject do AdminLyrics
      logger.error('Erro ao rejeitar letras', error, { approvalId: approval.id });
      // O toast de erro já foi mostrado no handleReject do AdminLyrics
    }
  };

  const handleDelete = async () => {
    if (!onDelete) {
      logger.warn('onDelete não está definido', { approvalId: approval.id });
      return;
    }
    try {
      // ✅ CORREÇÃO: Aguardar a conclusão da deleção antes de fechar o dialog
      await onDelete(approval.id);
      setShowDeleteDialog(false);
    } catch (error) {
      // ✅ CORREÇÃO: Não fechar dialog em caso de erro - o erro já foi tratado no handleDelete do AdminLyrics
      logger.error('Erro ao deletar letras', error, { approvalId: approval.id });
      // O toast de erro já foi mostrado no handleDelete do AdminLyrics
    }
  };

  const handleVoiceChange = async (newVoice: string) => {
    setSelectedVoice(newVoice);
    setIsUpdatingVoice(true);
    
    try {
      // ✅ CORREÇÃO: Atualizar voice E updated_at explicitamente para garantir que a query pegue a approval correta
      const { error } = await supabase
        .from('lyrics_approvals')
        .update({ 
          voice: newVoice,
          updated_at: new Date().toISOString() // ✅ Forçar atualização do updated_at
        })
        .eq('id', approval.id);
      
      if (error) {
        throw error;
      }
      
      // ✅ CORREÇÃO: Invalidar cache sem refetch automático (realtime vai atualizar)
      // Não usar debounce aqui pois é uma ação do usuário, mas evitar refetch automático
      queryClient.invalidateQueries({ 
        queryKey: ["lyrics-approvals"],
        refetchType: 'none' // ✅ CORREÇÃO CRÍTICA: Não refetchar automaticamente, apenas invalidar cache
      });
      
      toast.success(`Voz atualizada para ${newVoice === 'M' ? 'Masculino' : newVoice === 'F' ? 'Feminino' : 'Sem preferência'}`);
      logger.event('lyrics_voice_updated', { approvalId: approval.id, voice: newVoice });
    } catch (error: any) {
      logger.error('Erro ao atualizar voz', error, { approvalId: approval.id, voice: newVoice });
      toast.error(`Erro ao atualizar voz: ${error.message || 'Erro desconhecido'}`);
      // Reverter para valor anterior em caso de erro
      const voiceFromQuiz = mapVocalGenderToVoice(approval.quizzes?.vocal_gender);
      setSelectedVoice(approval.voice || voiceFromQuiz || 'S');
    } finally {
      setIsUpdatingVoice(false);
    }
  };

  const handleEdit = () => {
    if (!onEdit) {
      logger.warn('onEdit não está definido', { approvalId: approval.id });
      return;
    }
    // Inicializar com a letra atual
    const currentLyrics = formatFullLyrics();
    setEditedLyrics(currentLyrics);
    // ✅ CORREÇÃO: Usar função de callback para garantir atualização do estado
    setShowEditDialog((prev) => {
      return true;
    });
  };

  const handleSaveEdit = async () => {
    if (!onEdit) {
      logger.warn('onEdit não está definido ao salvar edição', { approvalId: approval.id });
      toast.error('Função de edição não disponível');
      return;
    }
    
    if (!editedLyrics.trim()) {
      toast.error('Por favor, insira uma letra válida');
      return;
    }
    
    // Validar tamanho máximo
    if (editedLyrics.length > 5000) {
      toast.error('A letra excede o limite de 5000 caracteres');
      return;
    }
    
    setIsSavingEdit(true);
    
    try {
      const lyricsData = getLyricsData();
      
      // ✅ CORREÇÃO: Sanitizar texto da letra para remover sequências de escape Unicode inválidas
      const sanitizedLyrics = sanitizeLyricsText(editedLyrics);
      
      // Criar estrutura de lyrics atualizada
      let updatedLyrics: any;
      
      // Se for formato novo (string com [Verse]/[Chorus])
      if (typeof lyricsData?.lyrics === 'string' || !lyricsData?.verses) {
        updatedLyrics = {
          title: lyricsData?.title || 'Música Personalizada',
          lyrics: sanitizedLyrics,
          style: lyricsData?.style || 'pop',
          language: lyricsData?.language || 'pt',
          tone: lyricsData?.tone || 'emotional'
        };
      } else {
        // Formato antigo com verses[] - converter string editada para verses
        const lines = sanitizedLyrics.split('\n');
        const verses: any[] = [];
        let currentVerse: any = null;
        
        for (const line of lines) {
          if (line.match(/^\[(Verse|Chorus|Bridge|Refrão|Verso|Ponte)\]/i)) {
            if (currentVerse) {
              verses.push(currentVerse);
            }
            const type = line.toLowerCase().includes('chorus') || line.toLowerCase().includes('refrão') 
              ? 'chorus' 
              : line.toLowerCase().includes('bridge') || line.toLowerCase().includes('ponte')
              ? 'bridge'
              : 'verse';
            currentVerse = { type, text: '' };
          } else if (currentVerse && line.trim()) {
            currentVerse.text += (currentVerse.text ? '\n' : '') + line;
          }
        }
        
        if (currentVerse) {
          verses.push(currentVerse);
        }
        
        updatedLyrics = {
          title: lyricsData?.title || 'Música Personalizada',
          verses: verses.length > 0 ? verses : lyricsData.verses,
          style: lyricsData?.style || 'pop',
          language: lyricsData?.language || 'pt',
          tone: lyricsData?.tone || 'emotional'
        };
      }
      
      // ✅ CORREÇÃO: Aguardar a conclusão da edição antes de fechar o dialog
      await onEdit(approval.id, updatedLyrics);
      
      // ✅ CORREÇÃO: Fechar dialog apenas após sucesso
      setShowEditDialog(false);
      setEditedLyrics("");
      // Log de sucesso
      logger.debug('Edição salva com sucesso', { approvalId: approval.id });
    } catch (error) {
      // ✅ CORREÇÃO: Não fechar dialog em caso de erro - o erro já foi tratado no handleEdit
      logger.error('Erro ao salvar edição', error, { approvalId: approval.id });
      // O toast de erro já foi mostrado no handleEdit do AdminLyrics
      // Não fechar o dialog para que o usuário possa tentar novamente ou cancelar
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Função para acessar dados de lyrics de forma robusta
  // ✅ OTIMIZAÇÃO: Usar loadedLyrics (carregado sob demanda) ou approval.lyrics (se já estiver disponível)
  const getLyricsData = () => {
    const lyrics = loadedLyrics || approval.lyrics;
    if (!lyrics) {
      return null;
    }

    // Se for string, tentar parsear JSON
    if (typeof lyrics === 'string') {
      try {
        return JSON.parse(lyrics);
      } catch (e) {
        logger.warn('Erro ao parsear lyrics JSON', { error: e, approvalId: approval.id });
        return null;
      }
    }

    // Se já for objeto, retornar diretamente
    if (typeof lyrics === 'object') {
      return lyrics;
    }

    return null;
  };

  // Extrair título da música
  const getMusicTitle = () => {
    const lyricsData = getLyricsData();
    
    if (lyricsData?.title) {
      return lyricsData.title;
    }
    
    if (approval.lyrics_preview) {
      const parts = approval.lyrics_preview.split(' - ');
      return parts[0] || 'Música sem título';
    }
    
    return 'Música sem título';
  };

  // Gerar preview da música (primeira linha útil)
  const getMusicPreview = () => {
    const lyricsData = getLyricsData();
    // Caso 1: estrutura antiga com verses[]
    if (lyricsData?.verses && Array.isArray(lyricsData.verses) && lyricsData.verses.length > 0) {
      const firstVerse = lyricsData.verses[0];
      const text = firstVerse?.text || '';
      const firstSentence = text.split(/\n|[.!?]/).map(s => s.trim()).find(Boolean) || '';
      if (firstSentence) return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;
    }
    // Caso 2: JSON atual { title, lyrics } com string
    if (typeof lyricsData?.lyrics === 'string' && lyricsData.lyrics) {
      const firstLine = lyricsData.lyrics
        .split('\n')
        .map(s => s.trim())
        .filter(l => l && !l.startsWith('['))[0];
      if (firstLine) return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
      }
    return approval.lyrics_preview || 'Nenhuma preview disponível';
  };

  // Formatar letra completa para exibição (aceita novo formato string ou antigo verses[])
  const formatFullLyrics = () => {
    const lyricsData = getLyricsData();
    // Novo formato: string única com blocos [Verse]/[Chorus]
    if (typeof lyricsData?.lyrics === 'string' && lyricsData.lyrics) {
      return lyricsData.lyrics;
    }
    // Antigo formato: verses[]
    if (lyricsData?.verses && Array.isArray(lyricsData.verses) && lyricsData.verses.length > 0) {
    return lyricsData.verses.map((verse, index) => {
      if (!verse?.text) {
        return `[Parte ${index + 1}]\n(Texto não disponível)`;
      }
      const verseType = verse.type === 'chorus' ? 'Refrão' : 
                       verse.type === 'verse' ? 'Verso' : 
                       verse.type === 'bridge' ? 'Ponte' : 'Parte';
      return `[${verseType}]\n${verse.text}`;
    }).join('\n\n');
    }
    return 'Letra não disponível';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, text: "Pendente", icon: "⏳" },
      approved: { variant: "default" as const, text: "Aprovado", icon: "✅" },
      rejected: { variant: "destructive" as const, text: "Rejeitado", icon: "❌" },
      expired: { variant: "outline" as const, text: "Expirado", icon: "⏰" }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.icon} {config.text}
      </Badge>
    );
  };

  // Verificar se a letra ainda não foi gerada (apenas placeholder)
  const isPlaceholderLyrics = () => {
    const lyricsData = getLyricsData();
    if (!lyricsData) return true;
    
    // Verificar se é o placeholder "Gerando letra..."
    if (lyricsData.title === 'Gerando letra...') {
      return true;
    }
    
    // Verificar se o texto da letra é o placeholder
    const lyricsText = typeof lyricsData.lyrics === 'string' 
      ? lyricsData.lyrics.trim() 
      : '';
    
    if (lyricsText === 'A letra está sendo gerada. Aguarde alguns instantes e atualize a página.' ||
        lyricsText === 'A letra está sendo gerada. Aguarde alguns instantes.') {
      return true;
    }
    
    // Verificar se não tem conteúdo real (apenas placeholder)
    if (lyricsText && lyricsText.length < 50 && lyricsText.includes('sendo gerada')) {
      return true;
    }
    
    return false;
  };

  // Verificar se a letra usa estrutura antiga (não segue o padrão válido)

  // Função para forçar geração da letra
  const handleForceGenerate = async () => {
    if (!approval.job_id) {
      toast.error('Job ID não encontrado');
      return;
    }

    try {
      toast.info('Forçando geração da letra...');
      
      // Primeiro, resetar o job para pending se estiver travado em processing
      const { error: resetError } = await supabase
        .from('jobs')
        .update({ 
          status: 'pending',
          error: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', approval.job_id);
      
      if (resetError) {
        const isTableNotFound = resetError.code === 'PGRST116' || 
                               resetError.code === '42P01' || 
                               resetError.code === '404' ||
                               resetError.message?.includes('does not exist') ||
                               resetError.message?.includes('relation') ||
                               resetError.message?.includes('not found');
        
        if (isTableNotFound) {
          // Tabela não existe, continuar sem resetar (não é crítico)
          if (process.env.NODE_ENV === 'development') {
            console.warn('Tabela jobs não encontrada, pulando reset do job');
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.error('Erro ao resetar job:', resetError);
          }
        }
      }
      
      // Aguardar um pouco antes de chamar a função
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data, error } = await supabase.functions.invoke('generate-lyrics-internal', {
        body: { job_id: approval.job_id }
      });

      if (error) {
        console.error('Erro na Edge Function:', error);
        // Tentar obter mais detalhes do erro
        const errorMessage = error.message || JSON.stringify(error) || 'Erro desconhecido';
        throw new Error(`Erro ao chamar função: ${errorMessage}`);
      }

      // Verificar se a resposta tem erro
      if (data && data.error) {
        throw new Error(data.error);
      }

      toast.success('Geração de letra iniciada! Aguarde alguns instantes.');
      
      // Invalidar cache para forçar refetch
      queryClient.invalidateQueries({ 
        queryKey: ["lyrics-approvals"],
      });
      
      // Aguardar 3 segundos e refetch
      setTimeout(() => {
        queryClient.refetchQueries({ 
          queryKey: ["lyrics-approvals"],
        });
      }, 3000);
      
    } catch (error: any) {
      logger.error('Erro ao forçar geração de letra', error, { jobId: approval.job_id });
      const errorMessage = error?.message || error?.error?.message || JSON.stringify(error) || 'Erro desconhecido';
      toast.error(`Erro ao gerar letra: ${errorMessage}`);
      console.error('Detalhes completos do erro:', error);
    }
  };

  const isExpired = new Date(approval.expires_at) < new Date();
  const timeLeft = formatDistanceToNow(new Date(approval.expires_at), { 
    addSuffix: true, 
    locale: ptBR 
  });

  // Obter horas do plano
  const getPlanHours = () => {
    const plan = approval.orders?.plan;
    if (!plan) return 48; // Default: 48h
    
    // ✅ CORREÇÃO: TODOS os planos são de 48 horas
    const planMap: { [key: string]: number } = {
      'pt': 48,
      'super_express': 48,
      'express': 48,
      'standard': 48,
      'relaxado': 48
    };
    
    return planMap[plan] || 48; // Default: 48h
  };

  // Calcular tempo restante em horas baseado no plano (48h)
  const getTimeRemaining = () => {
    const planHours = 48; // ✅ CORREÇÃO: Todos os planos são 48h
    const now = new Date();
    const created = new Date(approval.created_at);
    const diffMs = now.getTime() - created.getTime();
    const hoursElapsed = Math.floor(diffMs / (1000 * 60 * 60));
    const remaining = planHours - hoursElapsed;
    
    // ✅ CORREÇÃO: Garantir que nunca mostre mais de 48h
    const finalRemaining = Math.min(remaining, 48);
    
    // Log para diagnóstico quando houver valores inesperados
    if (remaining > 48 || remaining < 0) {
    }
    
    return finalRemaining > 0 ? finalRemaining : 0;
  };

  // Obter informações de estilo e tom
  const getStyleInfo = () => {
    const lyricsData = getLyricsData();
    return {
      style: lyricsData?.style || approval.quizzes?.style || 'Não especificado',
      tone: lyricsData?.tone || approval.quizzes?.desired_tone || 'Não especificado'
    };
  };

  // Função para copiar email
  const handleCopyEmail = async () => {
    const email = approval.orders?.customer_email;
    if (!email) {
      toast.error('Email não disponível');
      return;
    }

    try {
      await navigator.clipboard.writeText(email);
      setEmailCopied(true);
      toast.success('Email copiado!');
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (error) {
      // Fallback para navegadores que não suportam clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = email;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setEmailCopied(true);
        toast.success('Email copiado!');
        setTimeout(() => setEmailCopied(false), 2000);
      } catch (err) {
        toast.error('Erro ao copiar email');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const cardSize = compact ? "max-w-sm" : "w-full";
  const textSize = compact ? "text-[10px]" : "text-xs";
  const titleSize = compact ? "text-base" : "text-lg";

  const styleInfo = getStyleInfo();
  const timeRemaining = getTimeRemaining();
  const planHours = getPlanHours();

  return (
    <>
      <Card className={`${cardSize} ${className} apple-card group admin-hover-lift h-full flex flex-col min-h-[600px] select-text`}>
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className={`${titleSize} font-bold truncate flex items-center gap-2`}>
                <Music className="h-5 w-5 text-amber-600" />
                Para: {approval.quizzes?.about_who || 'N/A'}
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 group">
                <User className="h-3 w-3 flex-shrink-0" />
                <span 
                  className="select-text cursor-text hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {approval.orders?.customer_email || 'N/A'}
                </span>
                {approval.orders?.customer_email && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyEmail();
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                    title="Copiar email"
                  >
                    {emailCopied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
              <Link 
                to={`/admin/orders/${approval.order_id}`}
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <FileText className="h-3 w-3" />
                Ver Pedido
              </Link>
              {/* ✅ NOVO: Badge indicando se já tem música criada */}
              {approval.has_songs && approval.songs_count && approval.songs_count > 0 && (
                <Link
                  to="/admin/releases"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1"
                >
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 w-fit hover:bg-green-500/20 transition-colors cursor-pointer"
                    title={`Este pedido já tem ${approval.songs_count} música(s) criada(s). Clique para ver em Releases.`}
                  >
                    <Music className="h-3 w-3 mr-1" />
                    {approval.songs_count} música{approval.songs_count > 1 ? 's' : ''} criada{approval.songs_count > 1 ? 's' : ''}
                  </Badge>
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-2 ml-4">
              {getStatusBadge(approval.status)}
              {approval.regeneration_count > 0 && (
                <Badge variant="outline" className="text-xs">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  V{approval.regeneration_count + 1}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Style and Tone Info */}
          <div className="flex justify-between text-xs select-text flex-shrink-0">
            <span className="text-muted-foreground">
              <strong>Estilo:</strong> {styleInfo.style}
            </span>
            <span className="text-muted-foreground">
              <strong>Tom:</strong> {styleInfo.tone}
            </span>
          </div>

          {/* Voice Selection */}
          <div className="space-y-1 flex-shrink-0">
          <div className="flex items-center gap-2 select-text">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium">Voz:</span>
            <Select
              value={selectedVoice}
              onValueChange={handleVoiceChange}
              disabled={isUpdatingVoice}
            >
              <SelectTrigger className="w-[170px] h-8 text-sm rounded-full px-4">
                  <SelectValue placeholder="Selecione a voz">
                    {selectedVoice === 'M' ? 'M - Masculino' : 
                     selectedVoice === 'F' ? 'F - Feminino' : 
                     'S - Sem preferência'}
                  </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="M" className="rounded-lg">M - Masculino</SelectItem>
                <SelectItem value="F" className="rounded-lg">F - Feminino</SelectItem>
                <SelectItem value="S" className="rounded-lg">S - Sem preferência</SelectItem>
              </SelectContent>
            </Select>
            {isUpdatingVoice && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            {/* Mostrar vocal_gender original do quiz (o que o cliente escolheu) */}
            {approval.quizzes?.vocal_gender !== undefined && approval.quizzes?.vocal_gender !== null && (
              <div className="text-xs text-muted-foreground ml-6">
                <span className="font-medium">Preferência do cliente:</span>{' '}
                {approval.quizzes.vocal_gender === 'm' || approval.quizzes.vocal_gender === 'M' ? 'Masculino' : 
                 approval.quizzes.vocal_gender === 'f' || approval.quizzes.vocal_gender === 'F' ? 'Feminino' : 
                 approval.quizzes.vocal_gender === '' || !approval.quizzes.vocal_gender ? 'Sem preferência' :
                 approval.quizzes.vocal_gender}
              </div>
            )}
          </div>

          {/* Lyrics Preview - Altura fixa */}
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Preview da letra</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 h-32 overflow-y-auto card-scrollbar flex-shrink-0">
              <pre className={`${textSize} text-muted-foreground leading-relaxed whitespace-pre-wrap select-text`}>
                {formatFullLyrics()}
              </pre>
            </div>
            {/* ✅ CORREÇÃO: Botão para forçar geração quando letra ainda não foi gerada */}
            {isPlaceholderLyrics() && approval.status === 'pending' && (
              <div className="flex justify-center flex-shrink-0">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleForceGenerate();
                  }}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Forçar Geração da Letra
                </Button>
              </div>
            )}
          </div>

          {/* Time Info */}
          <div className="flex items-center gap-3 text-xs select-text flex-shrink-0" style={{ overflow: 'visible' }}>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[10px]">{format(new Date(approval.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
            <div className={`flex items-center gap-1.5 ${timeRemaining > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              <AlarmClock className="h-3.5 w-3.5" />
              <span className="text-[10px] font-semibold">
                {timeRemaining > 0 ? `${timeRemaining}h restantes` : '0h'}
              </span>
            </div>
            <div 
              className="ml-auto flex items-center" 
              style={{ 
                fontSize: '0', 
                lineHeight: '0', 
                minWidth: '44px', 
                overflow: 'visible', 
                position: 'relative', 
                zIndex: 100,
                pointerEvents: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Switch 
                checked={isHighlighted} 
                onCheckedChange={handleHighlightChange}
                disabled={isUpdatingHighlight}
                aria-label="Destacar letra"
              />
            </div>
          </div>

          {/* Action Buttons - Estilo Apple iOS minimalista - Altura fixa */}
          <div className="flex flex-col gap-2 flex-shrink-0 min-h-[120px]">
            {approval.status === 'approved' ? (
              /* Botões para letras APROVADAS: Editar Letra e Desaprovar */
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEdit();
                  }}
                  disabled={isEditing || !onEdit}
                  className="h-7 px-2.5 text-[11px] font-medium flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg disabled:opacity-50"
                >
                  {isEditing ? (
                    <>
                      <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] leading-none">Editando...</span>
                    </>
                  ) : (
                    <>
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="leading-none">Editar Letra</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onUnapprove) {
                      onUnapprove(approval.id);
                    }
                  }}
                  disabled={isUnapproving || !onUnapprove}
                  className="h-7 px-2.5 text-[11px] font-medium bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center gap-1 transition-colors rounded-lg disabled:opacity-50"
                >
                  {isUnapproving ? (
                    <>
                      <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] leading-none">Desaprovando...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5" />
                      <span className="leading-none">Desaprovar e Mover para Pendentes</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              /* Botões para letras PENDENTES/REJEITADAS: layout original */
              <>
                {/* Linha 1: Ver Completa, Editar */}
                <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowLyricsDialog(true);
                }}
                className="h-7 px-2.5 text-[11px] font-medium flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="leading-none">Ver Completa</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEdit();
                }}
                disabled={isEditing}
                className="h-7 px-2.5 text-[11px] font-medium flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg disabled:opacity-50"
              >
                {isEditing ? (
                  <>
                    <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] leading-none">Editando...</span>
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="leading-none">Editar</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Linha 2: Aprovar, Reprovar */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onApprove?.(approval.id)}
                disabled={isApproving || !onApprove || approval.status !== 'pending'}
                className="h-7 px-2.5 text-[11px] font-medium bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center gap-1 transition-colors rounded-lg disabled:opacity-50"
              >
                {isApproving ? (
                  <>
                    <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] leading-none">Aprovando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="leading-none">Aprovar</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowRejectDialog(true)}
                disabled={isRejecting || !onReject || approval.status === 'rejected'}
                className="h-7 px-2.5 text-[11px] font-medium bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-1 transition-colors rounded-lg disabled:opacity-50"
              >
                {isRejecting ? (
                  <>
                    <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] leading-none">Rejeitando...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    <span className="leading-none">Reprovar</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Linha 3: Regenerar, Deletar */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  if (!onRegenerate) return;
                  try {
                    await onRegenerate(approval.id);
                  } catch (error) {
                    logger.error('Erro ao regenerar letras', error, { approvalId: approval.id });
                  }
                }}
                disabled={isRegenerating || !onRegenerate}
                className="h-7 px-2.5 text-[11px] font-medium flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg disabled:opacity-50"
              >
                {isRegenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] leading-none">Regenerando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="leading-none">Regenerar</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting || !onDelete}
                className="h-7 px-2.5 text-[11px] font-medium bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-1 transition-colors rounded-lg disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] leading-none">Deletando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="leading-none">Deletar</span>
                  </>
                )}
              </button>
            </div>
              </>
            )}
          </div>

          {/* Rejection Reason Display */}
          {approval.status === 'rejected' && approval.rejection_reason && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 select-text flex-shrink-0">
              <p className="text-xs text-destructive">
                <strong>Motivo da rejeição:</strong> {approval.rejection_reason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lyrics Dialog - Fallback simples que sempre funciona */}
      {showLyricsDialog && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
        >
          <div className="relative w-full max-w-2xl h-[80vh] bg-background border rounded-lg shadow-lg flex flex-col">
            <div className="flex-shrink-0 p-6 pb-4 border-b">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" />
                    {getMusicTitle()}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Letra completa da música
                  </p>
                </div>
                <button 
                  onClick={() => setShowLyricsDialog(false)}
                  className="ml-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring p-1"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden p-6 pt-4 min-h-0 flex flex-col">
              <div className="bg-muted/30 rounded-lg p-4 flex-1 overflow-y-auto card-scrollbar min-h-0">
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed font-mono select-text">
                  {formatFullLyrics()}
                </pre>
              </div>
            </div>
            
            <div className="flex-shrink-0 p-6 pt-4 border-t flex gap-2 justify-end">
              {onEdit && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLyricsDialog(false);
                    handleEdit();
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowLyricsDialog(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lyrics Dialog - Fallback simples que sempre funciona */}
      {showEditDialog && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
        >
          <div className="relative w-full max-w-4xl h-[90vh] bg-background border rounded-lg shadow-lg flex flex-col">
            {/* Header fixo */}
            <div className="flex-shrink-0 p-6 pb-4 border-b">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-primary" />
                    Editar Letra: {getMusicTitle()}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Edite a letra da música. Mantenha a estrutura com [Verse], [Chorus], [Bridge], etc.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    if (!isSavingEdit && !isEditing) {
                      setShowEditDialog(false);
                    }
                  }}
                  disabled={isSavingEdit || isEditing}
                  className="ml-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Conteúdo com scroll apenas no textarea */}
            <div className="flex-1 overflow-hidden p-6 pt-4 min-h-0 flex flex-col">
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <label className="text-sm font-medium flex-shrink-0">Letra da Música</label>
                <Textarea
                  value={editedLyrics}
                  onChange={(e) => setEditedLyrics(e.target.value)}
                  className="flex-1 min-h-0 font-mono text-xs resize-none overflow-y-auto"
                  placeholder="[Verse 1]&#10;Primeira estrofe...&#10;&#10;[Chorus]&#10;Refrão...&#10;&#10;[Verse 2]&#10;Segunda estrofe...&#10;&#10;[Bridge]&#10;Ponte..."
                  disabled={isSavingEdit || isEditing}
                />
                <p className="text-xs text-muted-foreground flex-shrink-0">
                  Use [Verse], [Chorus], [Bridge] para estruturar a música. Máximo 5000 caracteres.
                </p>
              </div>
            </div>
            
            {/* Footer fixo */}
            <div className="flex-shrink-0 p-6 pt-4 border-t flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setEditedLyrics("");
                }}
                disabled={isSavingEdit || isEditing}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editedLyrics.trim() || isSavingEdit || isEditing}
              >
                {isSavingEdit || isEditing ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog 
        open={showRejectDialog} 
        onOpenChange={setShowRejectDialog}
      >
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Rejeitar Letras</DialogTitle>
            <DialogDescription>
              Por favor, forneça um motivo para a rejeição das letras.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Textarea
              placeholder="Digite o motivo da rejeição..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
            />
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                variant="destructive"
              >
                Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={showDeleteDialog} 
        onOpenChange={setShowDeleteDialog}
      >
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Deletar Letras
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar estas letras? Esta ação não pode ser desfeita e removerá permanentemente a aprovação de letras.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Esta ação é irreversível e removerá:
              </p>
              <ul className="text-sm text-destructive/80 mt-2 ml-4 list-disc">
                <li>A aprovação de letras</li>
                <li>Todos os dados relacionados</li>
                <li>O histórico de regenerações</li>
              </ul>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deletando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Deletar Definitivamente
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
