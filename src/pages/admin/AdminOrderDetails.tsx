import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, DollarSign, Music, Trash2, Edit, Save, Copy, Check, Phone, Sparkles, Mail } from "@/lib/icons";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { JobStatusBadge } from "@/components/admin/JobStatusBadge";
import { SongStatusBadge } from "@/components/admin/SongStatusBadge";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";
import { sendReleaseWebhook } from "@/utils/webhook";

interface OrderDetails {
  id: string;
  customer_email: string;
  status: string;
  plan: string;
  amount_cents: number;
  created_at: string;
  paid_at?: string;
  provider: string;
  provider_ref?: string;
  quiz_id?: string;
  customer_whatsapp?: string;
  is_test_order?: boolean;
  updated_at?: string;
  magic_token?: string;
  quizzes?: any;
  jobs?: any[];
  songs?: any[];
}

export default function AdminOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [markingAsRefunded, setMarkingAsRefunded] = useState(false);
  const [isEditingQuiz, setIsEditingQuiz] = useState(false);
  const [editedQuiz, setEditedQuiz] = useState<any>(null);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [hasPendingLyrics, setHasPendingLyrics] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Função para copiar texto
  const handleCopy = async (text: string, fieldName: string) => {
    const fieldLabels: Record<string, string> = {
      'order_id': 'ID do pedido',
      'email': 'Email',
      'phone': 'Telefone',
      'provider': 'Provedor',
      'provider_ref': 'Referência do provedor',
      'quiz_id': 'Quiz ID',
      'amount': 'Valor',
      'created_at': 'Data de criação',
      'paid_at': 'Data de pagamento',
      'quiz_about_who': 'Sobre quem',
      'quiz_relationship': 'Relacionamento',
      'quiz_style': 'Estilo musical',
      'quiz_desired_tone': 'Tom desejado',
      'quiz_occasion': 'Ocasião',
      'quiz_language': 'Idioma',
      'quiz_qualities': 'Qualidades',
      'quiz_memories': 'Memórias',
      'quiz_key_moments': 'Momentos-chave',
      'quiz_message': 'Mensagem especial',
      'quiz_music_prompt': 'Prompt de música',
      'quiz_vocal_gender': 'Gênero vocal',
    };
    
    const label = fieldLabels[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      // Fallback para navegadores que não suportam clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedField(fieldName);
        toast.success(`${label} copiado!`);
        setTimeout(() => setCopiedField(null), 2000);
      } catch (err) {
        toast.error('Erro ao copiar');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  // Função helper para traduzir valores de quiz
  const translateQuizValue = (value: string | null | undefined): string => {
    if (!value) return "Não informado";
    
    // Se já é um valor traduzido (não começa com "quiz."), retornar como está
    if (!value.startsWith("quiz.")) {
      // Verificar se contém ":" (caso de relationship com custom value)
      if (value.includes(":")) {
        const parts = value.split(":");
        const key = parts[0].trim();
        const customValue = parts.slice(1).join(":").trim();
        
        // Se a primeira parte é uma chave de tradução, traduzir
        if (key.startsWith("quiz.")) {
          try {
            const translated = t(key);
            return `${translated}: ${customValue}`;
          } catch {
            return value;
          }
        }
        return value;
      }
      return value;
    }
    
    // Tentar traduzir a chave
    try {
      return t(value);
    } catch {
      // Se não encontrar tradução, retornar o valor original
      return value;
    }
  };

  // Componente helper para campo com botão de copiar
  const CopyableField = ({ label, value, fieldName, className = "" }: { label: string; value: string | null | undefined; fieldName: string; className?: string }) => {
    if (!value) return null;
    const isCopied = copiedField === fieldName;
    const isMono = className.includes('font-mono');
    const textSize = className.includes('text-xs') ? 'text-xs' : className.includes('text-sm') ? 'text-sm' : className.includes('text-lg') ? 'text-lg' : '';
    const fontWeight = className.includes('font-bold') ? 'font-bold' : '';
    return (
      <div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className={`select-text ${isMono ? 'font-mono' : ''} ${textSize} ${fontWeight}`.trim()}>{value}</p>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopy(value, fieldName);
            }}
            className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
            title={`Copiar ${label.toLowerCase()}`}
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    loadOrderDetails();
  }, [id]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      
      if (!id) {
        toast.error("ID do pedido não fornecido");
        return;
      }

      const enableE2ESeedOrders =
        typeof window !== "undefined" &&
        navigator.webdriver &&
        localStorage.getItem("admin_e2e_seed_orders") === "true";

      if (enableE2ESeedOrders && id.startsWith("e2e-order-")) {
        const seedMap: Record<string, Pick<OrderDetails, "id" | "customer_email" | "status" | "plan" | "amount_cents" | "created_at" | "provider" | "paid_at" | "is_test_order">> = {
          "e2e-order-1": {
            id: "e2e-order-1",
            customer_email: "test@example.com",
            status: "paid",
            plan: "premium",
            amount_cents: 12900,
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            paid_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
            provider: "hotmart",
            is_test_order: true,
          },
          "e2e-order-2": {
            id: "e2e-order-2",
            customer_email: "customer2@test.com",
            status: "pending",
            plan: "standard",
            amount_cents: 9900,
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            paid_at: undefined,
            provider: "hotmart",
            is_test_order: true,
          },
          "e2e-order-3": {
            id: "e2e-order-3",
            customer_email: "customer3@test.com",
            status: "failed",
            plan: "premium",
            amount_cents: 14900,
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            paid_at: undefined,
            provider: "mercadopago",
            is_test_order: true,
          },
        };

        const base = seedMap[id];
        if (base) {
          const seededSongs = [
            {
              id: `${id}-song-1`,
              order_id: id,
              title: "Música de Teste (V1)",
              variant_number: 1,
              status: base.status === "paid" ? "released" : "approved",
              audio_url: "https://example.com/audio_1.mp3",
              cover_url: "https://example.com/cover_1.jpg",
              lyrics: "Letra de teste\n\nVerso 1:\nLinha 1\nLinha 2\n\nRefrão:\nRefrão de teste",
              release_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              released_at: base.status === "paid" ? new Date().toISOString() : null,
              created_at: base.created_at,
              style: "pop",
              emotion: "Neutro",
            },
            {
              id: `${id}-song-2`,
              order_id: id,
              title: "Música de Teste (V2)",
              variant_number: 2,
              status: base.status === "paid" ? "released" : "approved",
              audio_url: "https://example.com/audio_2.mp3",
              cover_url: "https://example.com/cover_2.jpg",
              lyrics: "Letra de teste (variação)\n\nVerso 1:\nLinha A\nLinha B\n\nRefrão:\nRefrão de teste",
              release_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              released_at: base.status === "paid" ? new Date().toISOString() : null,
              created_at: base.created_at,
              style: "pop",
              emotion: "Neutro",
            },
          ];

          setOrder({
            ...base,
            provider_ref: undefined,
            quiz_id: `${id}-quiz`,
            updated_at: new Date().toISOString(),
            customer_whatsapp: "+55 41 99999-9999",
            magic_token: "e2e-magic-token",
            quizzes: {
              id: `${id}-quiz`,
              about_who: "Pessoa de Teste",
              style: "pop",
              language: "pt",
              relationship: "quiz.relationship.friend",
              desired_tone: "quiz.desired_tone.happy",
              occasion: "quiz.occasion.birthday",
              qualities: "Engraçada, carinhosa",
              memories: "Momentos especiais",
              key_moments: "Um dia inesquecível",
              message: "Mensagem de teste",
              music_prompt: "Prompt de teste",
              vocal_gender: "quiz.vocal_gender.female",
              created_at: base.created_at,
              updated_at: new Date().toISOString(),
            },
            jobs: [
              {
                id: `${id}-job-1`,
                order_id: id,
                status: base.status === "failed" ? "failed" : "completed",
                created_at: base.created_at,
                updated_at: new Date().toISOString(),
                error: base.status === "failed" ? "Erro de teste" : null,
                gpt_lyrics: "Letra gerada (teste)",
                suno_task_id: `${id}-suno-task`,
              },
            ],
            songs: seededSongs,
          } as any);
          setHasPendingLyrics(false);
          return;
        }
      }

      // Buscar dados do pedido primeiro (selecionar campos específicos para evitar ambiguidade de relações)
      // Usar maybeSingle() em vez de single() para evitar problemas com relacionamentos automáticos
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("id, customer_email, status, plan, amount_cents, created_at, paid_at, provider, provider_ref, quiz_id, updated_at, customer_whatsapp, is_test_order, magic_token")
        .eq("id", id)
        .maybeSingle();

      if (orderError) {
        console.error("Erro ao buscar pedido:", orderError);
        // Verificar se é erro de relacionamento ambíguo
        if (orderError.message?.includes('more than one relationship') || 
            orderError.message?.includes('Could not embed')) {
          // Tentar primeiro com query mínima apenas para status
          let orderDataRetry: any = null;
          let orderErrorRetry: any = null;
          
          try {
            // Query mínima apenas com campos essenciais
            const statusResult = await supabase
              .from("orders")
              .select("id, status, paid_at, updated_at")
              .eq("id", id)
              .maybeSingle();
            
            if (!statusResult.error && statusResult.data) {
              // Se conseguimos pelo menos o status, tentar buscar o resto
              const fullResult = await supabase
                .from("orders")
                .select("id, customer_email, status, plan, amount_cents, created_at, paid_at, provider, provider_ref, quiz_id, updated_at, customer_whatsapp, is_test_order, magic_token")
                .eq("id", id)
                .maybeSingle();
              
              orderDataRetry = fullResult.data;
              orderErrorRetry = fullResult.error;
              
              // Se ainda falhar, usar pelo menos os dados do status
              if (orderErrorRetry && !orderDataRetry) {
                orderDataRetry = statusResult.data;
                orderErrorRetry = null;
              }
            } else {
              orderErrorRetry = statusResult.error;
            }
          } catch (retryErr: any) {
            console.error("Erro no retry:", retryErr);
            orderErrorRetry = retryErr;
          }
          
          if (orderErrorRetry || !orderDataRetry) {
            // Se ainda falhou, tentar uma última vez com query ainda mais simples
            const lastTry = await supabase
              .from("orders")
              .select("id, status")
              .eq("id", id)
              .maybeSingle();
            
            if (!lastTry.error && lastTry.data) {
              orderDataRetry = lastTry.data;
              orderErrorRetry = null;
            } else {
              throw orderError; // Usar erro original
            }
          }
          
          // Usar dados do retry
          const orderData = orderDataRetry;
          
          // Continuar com busca separada de relacionamentos
          let quizResult: any = { data: null, error: null };
          let jobsResult: any = { data: [], error: null };
          let songsResult: any = { data: [], error: null };

          // Buscar quiz
          if (orderData.quiz_id) {
            try {
              const result = await supabase
                .from("quizzes")
                .select("id, about_who, style, language, relationship, desired_tone, occasion, qualities, memories, key_moments, message, music_prompt, vocal_gender, created_at, updated_at")
                .eq("id", orderData.quiz_id)
                .maybeSingle();
              quizResult = result;
            } catch (err: any) {
              console.error("Erro ao buscar quiz:", err);
              quizResult = { data: null, error: err };
            }
          }

          // Buscar jobs
          try {
            const result = await supabase
              .from("jobs")
              .select("id, order_id, status, created_at, updated_at, error, gpt_lyrics, suno_task_id")
              .eq("order_id", id);
            
            if (result.error) {
              const isTableNotFound = result.error.code === 'PGRST116' || 
                                     result.error.code === '42P01' || 
                                     result.error.code === '404' ||
                                     result.error.message?.includes('does not exist') ||
                                     result.error.message?.includes('relation') ||
                                     result.error.message?.includes('not found');
              
              if (isTableNotFound) {
                // Tabela não existe, usar array vazio silenciosamente
                jobsResult = { data: [], error: null };
              } else {
                if (process.env.NODE_ENV === 'development') {
                  console.error("Erro ao buscar jobs:", result.error);
                }
                jobsResult = { data: [], error: result.error };
              }
            } else {
              jobsResult = result;
            }
          } catch (err: any) {
            const isTableNotFound = err?.code === 'PGRST116' || 
                                   err?.code === '42P01' || 
                                   err?.code === '404' ||
                                   err?.message?.includes('does not exist') ||
                                   err?.message?.includes('relation');
            
            if (isTableNotFound) {
              jobsResult = { data: [], error: null };
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.error("Erro ao buscar jobs:", err);
              }
              jobsResult = { data: [], error: err };
            }
          }

          // Buscar songs
          try {
            const result = await supabase
              .from("songs")
              .select("id, order_id, quiz_id, title, variant_number, status, audio_url, cover_url, lyrics, release_at, released_at, created_at, updated_at, vocals_url, instrumental_url")
              .eq("order_id", id);
            songsResult = result;
          } catch (err: any) {
            console.error("Erro ao buscar songs:", err);
            songsResult = { data: [], error: err };
          }

          const orderWithRelations = {
            ...orderData,
            quizzes: quizResult.data,
            jobs: jobsResult.data || [],
            songs: songsResult.data || []
          };

          setOrder(orderWithRelations as any);

          // Verificar se já existe aprovação pendente
          if (orderData.quiz_id) {
            const { data: pendingApproval } = await supabase
              .from('lyrics_approvals')
              .select('id, status')
              .eq('order_id', id)
              .eq('status', 'pending')
              .maybeSingle();
            
            setHasPendingLyrics(!!pendingApproval);
          } else {
            setHasPendingLyrics(false);
          }
          return;
        }
        throw orderError;
      }

      if (!orderData) {
        toast.error("Pedido não encontrado");
        setOrder(null);
        return;
      }

      // Buscar dados relacionados separadamente (evitar ambiguidade de relações)
      let quizResult: any = { data: null, error: null };
      let jobsResult: any = { data: [], error: null };
      let songsResult: any = { data: [], error: null };

      // Buscar quiz
      if (orderData.quiz_id) {
        try {
          const result = await supabase
            .from("quizzes")
            .select("id, about_who, style, language, relationship, desired_tone, occasion, qualities, memories, key_moments, message, music_prompt, vocal_gender, created_at, updated_at")
            .eq("id", orderData.quiz_id)
            .maybeSingle();
          quizResult = result;
        } catch (err: any) {
          console.error("Erro ao buscar quiz:", err);
          quizResult = { data: null, error: err };
        }
      }

      // Buscar jobs
      try {
        const result = await supabase
          .from("jobs")
          .select("id, order_id, status, created_at, updated_at, error, gpt_lyrics, suno_task_id")
          .eq("order_id", id);
        
        if (result.error) {
          const isTableNotFound = result.error.code === 'PGRST116' || 
                                 result.error.code === '42P01' || 
                                 result.error.code === '404' ||
                                 result.error.message?.includes('does not exist') ||
                                 result.error.message?.includes('relation') ||
                                 result.error.message?.includes('not found');
          
          if (isTableNotFound) {
            // Tabela não existe, usar array vazio silenciosamente
            jobsResult = { data: [], error: null };
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.error("Erro ao buscar jobs:", result.error);
            }
            jobsResult = { data: [], error: result.error };
          }
        } else {
          jobsResult = result;
        }
      } catch (err: any) {
        const isTableNotFound = err?.code === 'PGRST116' || 
                               err?.code === '42P01' || 
                               err?.code === '404' ||
                               err?.message?.includes('does not exist') ||
                               err?.message?.includes('relation');
        
        if (isTableNotFound) {
          jobsResult = { data: [], error: null };
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.error("Erro ao buscar jobs:", err);
          }
          jobsResult = { data: [], error: err };
        }
      }

      // Buscar songs
      try {
        const result = await supabase
          .from("songs")
          .select("id, order_id, quiz_id, title, variant_number, status, audio_url, cover_url, lyrics, release_at, released_at, created_at, updated_at, vocals_url, instrumental_url")
          .eq("order_id", id);
        songsResult = result;
      } catch (err: any) {
        console.error("Erro ao buscar songs:", err);
        songsResult = { data: [], error: err };
      }

      const orderWithRelations = {
        ...orderData,
        quizzes: quizResult.data,
        jobs: jobsResult.data || [],
        songs: songsResult.data || []
      };

      setOrder(orderWithRelations as any);

      // Verificar se já existe aprovação pendente
      if (orderData.quiz_id) {
        const { data: pendingApproval } = await supabase
          .from('lyrics_approvals')
          .select('id, status')
          .eq('order_id', id)
          .eq('status', 'pending')
          .maybeSingle();
        
        setHasPendingLyrics(!!pendingApproval);
      }
    } catch (error: any) {
      console.error("Erro ao carregar detalhes:", error);
      toast.error(`Erro ao carregar detalhes do pedido: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAction = async (action: string, data?: any) => {
    if (!order) return;

    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const { error } = await supabase.functions.invoke('admin-order-actions', {
        body: { action, order_id: order.id, data },
        headers: authToken ? {
          Authorization: `Bearer ${authToken}`
        } : undefined
      });

      if (error) throw error;

      toast.success("Ação executada com sucesso");
      loadOrderDetails();
    } catch (error: any) {
      console.error("Erro ao executar ação:", error);
      toast.error(error.message || "Erro ao executar ação");
    }
  };

  const handleStartEditQuiz = () => {
    if (!order) return;
    const currentQuiz = order.quizzes 
      ? (Array.isArray(order.quizzes) ? order.quizzes[0] : order.quizzes)
      : null;
    if (!currentQuiz) return;
    setEditedQuiz({ ...currentQuiz });
    setIsEditingQuiz(true);
  };

  const handleCancelEditQuiz = () => {
    setIsEditingQuiz(false);
    setEditedQuiz(null);
  };

  const handleSaveQuiz = async () => {
    if (!order || !editedQuiz) return;
    const currentQuiz = order.quizzes 
      ? (Array.isArray(order.quizzes) ? order.quizzes[0] : order.quizzes)
      : null;
    if (!currentQuiz) return;

    // Validações
    if (!editedQuiz.about_who || editedQuiz.about_who.trim() === '') {
      toast.error("O campo 'Sobre quem' é obrigatório");
      return;
    }

    if (!editedQuiz.style || editedQuiz.style.trim() === '') {
      toast.error("O campo 'Estilo Musical' é obrigatório");
      return;
    }

    if (!editedQuiz.language || editedQuiz.language !== 'pt') {
      toast.error("O campo 'Idioma' é obrigatório e deve ser 'pt'");
      return;
    }

    try {
      setSavingQuiz(true);
      
      const updateData: any = {
        about_who: editedQuiz.about_who.trim(),
        style: editedQuiz.style.trim(),
        language: editedQuiz.language,
        relationship: editedQuiz.relationship?.trim() || null,
        desired_tone: null,
        occasion: editedQuiz.occasion?.trim() || null,
        qualities: null,
        memories: null,
        key_moments: null,
        message: editedQuiz.message?.trim() || null,
        music_prompt: editedQuiz.music_prompt?.trim() || null,
        vocal_gender: editedQuiz.vocal_gender?.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('quizzes')
        .update(updateData)
        .eq('id', currentQuiz.id);

      if (error) {
        console.error("Erro ao salvar quiz:", error);
        throw error;
      }

      toast.success("Quiz atualizado com sucesso!");
      setIsEditingQuiz(false);
      setEditedQuiz(null);
      
      // Recarregar dados do pedido
      await loadOrderDetails();
    } catch (error: any) {
      console.error("Erro ao salvar quiz:", error);
      toast.error(`Erro ao salvar quiz: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;

    const confirmMessage = `⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nTem certeza que deseja EXCLUIR PERMANENTEMENTE este pedido?\n\nIsso irá:\n1. Excluir o pedido do banco de dados\n2. Excluir todos os dados relacionados (jobs, songs, etc.)\n3. Excluir o quiz se não estiver em uso por outros pedidos\n\nEsta ação NÃO pode ser desfeita!`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    // Confirmação dupla
    if (!confirm("Última confirmação: Você realmente deseja EXCLUIR PERMANENTEMENTE este pedido?")) {
      return;
    }

    try {
      setDeletingOrder(true);
      toast.info("Excluindo pedido permanentemente...");

      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const { data, error } = await supabase.functions.invoke('admin-order-actions', {
        body: { action: 'delete_order', order_id: order.id },
        headers: authToken ? {
          Authorization: `Bearer ${authToken}`
        } : undefined
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast.success("Pedido excluído permanentemente!");
        // Redirecionar para a lista de pedidos após exclusão
        setTimeout(() => {
          navigate('/admin/orders');
        }, 1000);
      } else {
        throw new Error(data?.error || 'Erro ao excluir pedido');
      }
    } catch (error: any) {
      console.error("❌ [AdminOrderDetails] Erro ao excluir pedido:", error);
      toast.error(`Erro ao excluir pedido: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setDeletingOrder(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!order) {
      toast.error("Pedido não encontrado");
      return;
    }

    if (!confirm("Tem certeza que deseja marcar este pedido como pago? Isso irá:\n\n1. Marcar o pedido como pago\n2. Enviar email de confirmação\n3. Notificar via WhatsApp\n4. Gerar letra automaticamente")) {
      return;
    }

    try {
      setMarkingAsPaid(true);
      toast.info("Marcando pedido como pago e executando fluxo completo...");

      // Obter token de autenticação
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error("❌ [AdminOrderDetails] Erro de autenticação:", sessionError);
        toast.error("Erro de autenticação. Por favor, faça login novamente.");
        return;
      }

      const authToken = session.access_token;

      if (!authToken) {
        console.error("❌ [AdminOrderDetails] Token de autenticação não encontrado");
        toast.error("Token de autenticação não encontrado. Por favor, faça login novamente.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-order-actions', {
        body: { action: 'mark_as_paid', order_id: order.id },
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      if (error) {
        // Extrair mensagem de erro detalhada
        let errorMessage = 'Erro ao marcar pedido como pago';
        if (error.message) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.status) {
          errorMessage = `Edge Function retornou status ${error.status}`;
        }
        
        console.error("❌ [AdminOrderDetails] Erro ao marcar como pago:", {
          error,
          message: errorMessage,
          status: error.status,
          order_id: order.id
        });
        
        throw new Error(errorMessage);
      }

      // ✅ CORREÇÃO: Verificar se a resposta indica sucesso ou falha
      if (data?.success === false) {
        // Resposta com success: false mas status 200 (erro tratado)
        let errorMessage = data?.error || 'Erro ao marcar pedido como pago';
        if (data?.details) {
          errorMessage += `: ${data.details}`;
        }
        
        console.error("❌ [AdminOrderDetails] Operação falhou:", {
          error: data?.error,
          details: data?.details,
          warnings: data?.warnings,
          order_id: order.id,
          fullResponse: data
        });
        
        // Verificar se o erro é de relacionamento ambíguo mas o status pode ter sido atualizado
        const isRelationshipError = errorMessage.includes('more than one relationship') || 
                                    errorMessage.includes('Could not embed');
        
        if (isRelationshipError) {
          toast.warning("Aviso: Erro ao verificar relacionamento, mas o status pode ter sido atualizado. Verificando...", { duration: 5000 });
        } else {
          toast.error(errorMessage, { duration: 6000 });
        }
        
        // Mostrar warnings se houver
        if (data?.warnings && Array.isArray(data.warnings)) {
          data.warnings.forEach((warning: string) => {
            toast.warning(warning, { duration: 5000 });
          });
        }
        
        // ✅ CORREÇÃO: Recarregar dados mesmo em caso de erro para verificar estado atual
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadOrderDetails();
        
        // Se o erro foi de relacionamento ambíguo, verificar se o status foi atualizado
        if (isRelationshipError) {
          // Aguardar mais um pouco e verificar novamente
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Tentar buscar apenas o status para verificar se foi atualizado
          try {
            const { data: statusCheck, error: statusError } = await supabase
              .from("orders")
              .select("id, status, paid_at")
              .eq("id", order.id)
              .maybeSingle();
            
            if (!statusError && statusCheck) {
              // Se o status foi atualizado, atualizar o estado local
              if (statusCheck.status === 'paid' && order.status !== 'paid') {
                setOrder((prevOrder) => {
                  if (!prevOrder) return prevOrder;
                  return {
                    ...prevOrder,
                    status: 'paid',
                    paid_at: statusCheck.paid_at || new Date().toISOString()
                  };
                });
                toast.success("Status atualizado para 'pago'!");
              }
            }
          } catch (statusCheckErr: any) {
            // Ignorar erros de verificação de status
          }
          
          // Recarregar dados completos
          await loadOrderDetails();
        }
      } else {
        // Sucesso (success: true ou não especificado)
        // Verificar se há warnings na resposta
        if (data?.warnings && Array.isArray(data.warnings) && data.warnings.length > 0) {
          // Mostrar sucesso principal
          toast.success(data?.message || "Pedido marcado como pago!");
          
          // Mostrar warnings separadamente
          data.warnings.forEach((warning: string) => {
            toast.warning(warning, { duration: 5000 });
          });
        } else {
          // Sucesso completo sem warnings
          toast.success(data?.message || "Pedido marcado como pago! Fluxo completo executado.");
        }

        // ✅ CORREÇÃO: Recarregar dados após sucesso com delay para garantir persistência
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar se há aviso de relacionamento ambíguo na resposta
        const hasRelationshipWarning = data?.warnings && 
          Array.isArray(data.warnings) && 
          data.warnings.some((w: string) => 
            w.includes('relacionamento') || 
            w.includes('more than one relationship') || 
            w.includes('Could not embed')
          );
        
        // Se houver aviso de relacionamento, verificar status diretamente primeiro
        if (hasRelationshipWarning && order) {
          try {
            const { data: statusCheck, error: statusError } = await supabase
              .from("orders")
              .select("id, status, paid_at")
              .eq("id", order.id)
              .maybeSingle();
            
            if (!statusError && statusCheck && statusCheck.status === 'paid') {
              // Atualizar estado local imediatamente
              setOrder((prevOrder) => {
                if (!prevOrder) return prevOrder;
                return {
                  ...prevOrder,
                  status: 'paid',
                  paid_at: statusCheck.paid_at || new Date().toISOString()
                };
              });
            }
          } catch (statusCheckErr: any) {
            // Ignorar erros de verificação de status
          }
        }
        
        await loadOrderDetails();
      }
    } catch (error: any) {
      console.error("❌ [AdminOrderDetails] Erro ao marcar como pago:", error);
      
      // Mensagem de erro mais detalhada
      let errorMessage = error.message || "Erro ao marcar pedido como pago";
      
      // Verificar se é erro de Edge Function não-2xx
      if (error.status && error.status >= 400) {
        errorMessage = `Erro do servidor (${error.status}): ${errorMessage}`;
      }
      
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setMarkingAsPaid(false);
    }
  };

  const handleMarkAsRefunded = async () => {
    if (!order) return;

    if (!confirm("Tem certeza que deseja marcar este pedido como reembolsado? Isso irá:\n\n1. Marcar o pedido como 'refunded'\n2. Remover paid_at (não será mais contado como pago)\n3. O pedido não aparecerá mais nas estatísticas de vendas")) {
      return;
    }

    try {
      setMarkingAsRefunded(true);
      toast.info("Marcando pedido como reembolsado...");

      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const { data, error } = await supabase.functions.invoke('admin-order-actions', {
        body: { action: 'mark_as_refunded', order_id: order.id },
        headers: authToken ? {
          Authorization: `Bearer ${authToken}`
        } : undefined
      });

      if (error) {
        let errorMessage = 'Erro ao marcar pedido como reembolsado';
        if (error.message) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        
        console.error("❌ [AdminOrderDetails] Erro ao marcar como reembolsado:", error);
        toast.error(errorMessage);
        return;
      }

      if (data?.success === false) {
        const errorMessage = data?.error || 'Erro ao marcar pedido como reembolsado';
        toast.error(errorMessage);
        return;
      }

      toast.success(data?.message || "Pedido marcado como reembolsado com sucesso!");
      
      // Recarregar dados do pedido
      await loadOrderDetails();
      
    } catch (error: any) {
      console.error("❌ [AdminOrderDetails] Erro ao marcar como reembolsado:", error);
      toast.error(error.message || "Erro ao marcar pedido como reembolsado");
    } finally {
      setMarkingAsRefunded(false);
    }
  };

  const handleGenerateLyrics = async () => {
    if (!order) return;

    if (!order.quiz_id) {
      toast.error("Este pedido não possui um quiz associado. Não é possível gerar letra sem quiz.");
      return;
    }

    if (!confirm("Deseja gerar a letra para este pedido?\n\nSe o quiz tiver letra aprovada na página, a música será gerada e enviada automaticamente. Caso contrário, a letra será gerada para revisão.")) {
      return;
    }

    try {
      setGeneratingLyrics(true);
      toast.info("Gerando letra...");

      const { data, error } = await supabase.functions.invoke('generate-lyrics-for-approval', {
        body: { order_id: order.id }
      });

      if (error) {
        console.error("❌ [AdminOrderDetails] Erro ao gerar letra:", error);
        toast.error(`Erro ao gerar letra: ${error.message || 'Erro desconhecido'}`);
        return;
      }

      if (data?.success === false || data?.error) {
        const errorMessage = data?.error || data?.message || 'Erro ao gerar letra';
        console.error("❌ [AdminOrderDetails] Erro na função:", errorMessage);
        toast.error(`Erro ao gerar letra: ${errorMessage}`);
        return;
      }

      toast.success(
        <div>
          <p className="font-semibold">✅ Letra sendo gerada!</p>
          <p className="text-sm mt-1">
            {data?.used_approved_lyrics_from_quiz
              ? "Música será enviada automaticamente para a Suno."
              : "Letra gerada. Recarregue a página para ver o status."}
          </p>
          {data?.job_id && (
            <p className="text-xs mt-1 text-muted-foreground">Job ID: {data.job_id}</p>
          )}
        </div>,
        { duration: 5000 }
      );

      // Aguardar um pouco e recarregar dados
      setTimeout(async () => {
        await loadOrderDetails();
      }, 2000);
      
    } catch (error: any) {
      console.error("❌ [AdminOrderDetails] Erro ao gerar letra:", error);
      toast.error(`Erro ao gerar letra: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setGeneratingLyrics(false);
    }
  };

  const handleResendMusicReadyEmail = async () => {
    if (!order) {
      toast.error("Pedido não encontrado");
      return;
    }

    try {
      setResendingEmail(true);
      toast.info("Verificando músicas e reenviando email...");

      // ✅ CORREÇÃO: Buscar músicas com status 'ready' OU 'released' que tenham áudio
      // Permite reenviar email mesmo para músicas já liberadas
      const { data: songs, error: fetchError } = await supabase
        .from('songs')
        .select('id, variant_number, title, audio_url, status, order_id, released_at')
        .eq('order_id', order.id)
        .in('status', ['ready', 'released']) // ✅ Aceitar ambos os status
        .order('variant_number', { ascending: true });

      if (fetchError) {
        console.error("❌ [AdminOrderDetails] Erro ao buscar músicas:", fetchError);
        throw new Error(`Erro ao buscar músicas: ${fetchError.message || 'Erro desconhecido'}`);
      }

      // Filtrar músicas com audio_url
      const songsWithAudio = songs?.filter(s => s.audio_url && s.audio_url.trim() !== '') || [];

      if (!songs || songs.length === 0) {
        throw new Error('Nenhuma música encontrada para este pedido. Verifique se há músicas com status "ready" ou "released".');
      }

      if (songsWithAudio.length === 0) {
        throw new Error('Nenhuma música com áudio encontrada. As músicas precisam ter audio_url para enviar o email.');
      }

      // Chamar a edge function send-music-ready-email
      // ✅ CORREÇÃO: Usar send-music-released-email para músicas já liberadas, ou send-music-ready-email para músicas prontas
      const songsReady = songsWithAudio.filter(s => s.status === 'ready' && !s.released_at);
      const songsReleased = songsWithAudio.filter(s => s.status === 'released');
      
      // Se houver músicas já liberadas, usar a função de música liberada
      // Caso contrário, usar a função de música pronta
      const edgeFunction = songsReleased.length > 0 ? 'send-music-released-email' : 'send-music-ready-email';
      const songId = songsWithAudio[0].id; // Usar primeira música para o email
      
      // Obter dados do quiz para o webhook
      const about = (order.quizzes as any)?.about_who || 'N/A';
      
      // ✅ NOVO: Enviar email e webhook em paralelo (igual ao botão "enviar de release")
      const [emailResult, webhookResult] = await Promise.allSettled([
        // Enviar email
        supabase.functions.invoke(edgeFunction, {
          body: songsReleased.length > 0 
            ? { songId, orderId: order.id, force: true } // Para released, precisa de songId e force
            : { order_id: order.id } // Para ready, precisa de order_id
        }),
        // Enviar webhook (apenas se tiver dados do pedido)
        sendReleaseWebhook(
          {
            id: order.id,
            customer_email: order.customer_email || '',
            customer_whatsapp: order.customer_whatsapp || null,
            plan: order.plan || 'unknown',
            magic_token: order.magic_token || ''
          },
          songsWithAudio.map(s => ({
            id: s.id,
            title: s.title || 'Música sem título',
            variant_number: s.variant_number || 1,
            audio_url: s.audio_url || undefined
          })),
          about
        )
      ]);
      
      // Processar resultado do email
      if (emailResult.status === 'fulfilled') {
        const { data, error } = emailResult.value;
        
        if (error) {
          console.error("❌ [AdminOrderDetails] Erro ao reenviar email:", error);
          throw new Error(`Erro ao reenviar email: ${error.message || 'Erro desconhecido'}`);
        }

        if (data?.error) {
          throw new Error(data.error);
        }
      } else {
        console.error("❌ [AdminOrderDetails] Exceção ao reenviar email:", emailResult.reason);
        throw new Error(`Erro ao reenviar email: ${emailResult.reason?.message || 'Erro desconhecido'}`);
      }

      // Processar resultado do webhook (não bloqueante)
      if (webhookResult.status === 'rejected') {
        console.error("Erro ao enviar webhook (não bloqueante):", webhookResult.reason);
      }

      toast.success(
        <div>
          <p className="font-semibold">✅ Email e webhook reenviados com sucesso!</p>
          <p className="text-sm mt-1">O email foi enviado para {order.customer_email}</p>
        </div>,
        { duration: 5000 }
      );

    } catch (error: any) {
      console.error("❌ [AdminOrderDetails] Erro ao reenviar email:", error);
      toast.error(`Erro ao reenviar email: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setResendingEmail(false);
    }
  };

  // ✅ OTIMIZAÇÃO: Usar componente de loading unificado
  if (loading) {
    return <AdminPageLoading text="Carregando detalhes do pedido..." />;
  }

  if (!order) {
    return (
      <div className="container mx-auto p-0" data-testid="order-details">
        <div className="flex items-center justify-center gap-2 py-6">
          <p className="text-center text-muted-foreground">Pedido não encontrado</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/orders")}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // Normalizar quizzes para um objeto único (pode vir como array ou objeto)
  const quiz = order.quizzes 
    ? (Array.isArray(order.quizzes) ? order.quizzes[0] : order.quizzes)
    : null;

  return (
    <div className="container mx-auto p-0 space-y-2 md:space-y-3" data-testid="order-details">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/orders")} className="h-8 md:h-10">
          <ArrowLeft className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
          <span className="hidden md:inline">Voltar</span>
        </Button>
        <h1 className="text-xl md:text-3xl font-bold">Detalhes do Pedido</h1>
        <Button onClick={loadOrderDetails} variant="outline" size="sm" className="h-8 md:h-10">
          <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
        </Button>
      </div>

      <div className="grid gap-2 md:gap-6 md:grid-cols-2">
        <Card className="admin-card-compact">
          <CardHeader className="p-2 md:p-6">
            <CardTitle className="text-sm md:text-lg">Informações do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-4 p-2 md:p-6 select-text">
            <CopyableField 
              label="ID" 
              value={order.id} 
              fieldName="order_id"
              className="font-mono text-sm"
            />
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2 flex-wrap" data-testid="order-status">
                <OrderStatusBadge status={order.status} />
                {order.status !== 'paid' && order.status !== 'refunded' && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleMarkAsPaid}
                    disabled={markingAsPaid}
                    className="ml-2"
                  >
                    {markingAsPaid ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Pago
                      </>
                    )}
                  </Button>
                )}
                {order.status === 'paid' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMarkAsRefunded}
                    disabled={markingAsRefunded}
                    className="ml-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                  >
                    {markingAsRefunded ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-2" />
                        Marcar como Reembolsado
                      </>
                    )}
                  </Button>
                )}
                {order.quiz_id && !hasPendingLyrics && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateLyrics}
                    disabled={generatingLyrics}
                    className="ml-2 border-[#C7916B] text-[#C7916B] hover:bg-[#C7916B] hover:text-white"
                  >
                    {generatingLyrics ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Gerar Letra
                      </>
                    )}
                  </Button>
                )}
                {order.songs && order.songs.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResendMusicReadyEmail}
                    disabled={resendingEmail}
                    className="ml-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                  >
                    {resendingEmail ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Reenviar Email
                      </>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteOrder}
                  disabled={deletingOrder}
                  className="ml-2"
                >
                  {deletingOrder ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Pedido
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plano</p>
              <div data-testid="order-plan">
                <Badge className="select-text">{order.plan === "express" ? "Express (48h)" : "Standard (7 dias)"}</Badge>
              </div>
            </div>
            <div data-testid="order-amount">
              <CopyableField 
                label="Valor" 
                value={`R$ ${(order.amount_cents / 100).toFixed(2)}`} 
                fieldName="amount"
                className="text-lg font-bold"
              />
            </div>
            <CopyableField 
              label="Criado em" 
              value={new Date(order.created_at).toLocaleString("pt-BR")} 
              fieldName="created_at"
            />
            {order.paid_at && (
              <CopyableField 
                label="Pago em" 
                value={new Date(order.paid_at).toLocaleString("pt-BR")} 
                fieldName="paid_at"
              />
            )}
          </CardContent>
        </Card>

        <Card className="admin-card-compact">
          <CardHeader className="p-2 md:p-6">
            <CardTitle className="text-sm md:text-lg">Informações do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-4 p-2 md:p-6 select-text">
            {/* Campo de Email Editável */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-muted-foreground">Email</p>
                {!isEditingEmail && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditedEmail(order.customer_email || "");
                      setIsEditingEmail(true);
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                )}
              </div>
              {isEditingEmail ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="flex-1"
                    placeholder="email@exemplo.com"
                    disabled={savingEmail}
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!editedEmail.trim()) {
                        toast.error("Email não pode estar vazio");
                        return;
                      }
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editedEmail.trim())) {
                        toast.error("Email inválido");
                        return;
                      }
                      setSavingEmail(true);
                      try {
                        const { error } = await supabase
                          .from("orders")
                          .update({ customer_email: editedEmail.trim() })
                          .eq("id", id);
                        
                        if (error) throw error;
                        
                        setOrder({ ...order, customer_email: editedEmail.trim() });
                        setIsEditingEmail(false);
                        toast.success("Email atualizado com sucesso!");
                      } catch (error: any) {
                        console.error("Erro ao atualizar email:", error);
                        toast.error(`Erro ao atualizar email: ${error.message || "Erro desconhecido"}`);
                      } finally {
                        setSavingEmail(false);
                      }
                    }}
                    disabled={savingEmail || editedEmail.trim() === order.customer_email}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {savingEmail ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditingEmail(false);
                      setEditedEmail("");
                    }}
                    disabled={savingEmail}
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <p className="select-text" data-testid="order-email">{order.customer_email}</p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopy(order.customer_email || "", "email");
                    }}
                    className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                    title="Copiar email"
                  >
                    {copiedField === "email" ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
            {order.customer_whatsapp && (
              <CopyableField 
                label="Telefone" 
                value={order.customer_whatsapp} 
                fieldName="phone"
              />
            )}
            <CopyableField 
              label="Provedor de Pagamento" 
              value={order.provider} 
              fieldName="provider"
            />
            {order.provider_ref && (
              <CopyableField 
                label="Referência do Provedor" 
                value={order.provider_ref} 
                fieldName="provider_ref"
                className="font-mono text-xs"
              />
            )}
            {order.quiz_id && (
              <CopyableField 
                label="Quiz ID" 
                value={order.quiz_id} 
                fieldName="quiz_id"
                className="font-mono text-xs"
              />
            )}
          </CardContent>
        </Card>

        {quiz && (
          <Card className="admin-card-compact md:col-span-2">
            <CardHeader className="p-2 md:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm md:text-lg">Quiz Respondido</CardTitle>
                {!isEditingQuiz && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStartEditQuiz}
                    className="h-8"
                  >
                    <Edit className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                    Editar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 p-2 md:p-6 select-text">
              {isEditingQuiz && editedQuiz ? (
                <>
                  <div>
                    <Label htmlFor="about_who" className="text-sm font-medium text-muted-foreground">
                      Sobre quem <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="about_who"
                      value={editedQuiz.about_who || ''}
                      onChange={(e) => setEditedQuiz({ ...editedQuiz, about_who: e.target.value })}
                      className="mt-1"
                      disabled={savingQuiz}
                    />
                  </div>
                  <div>
                    <Label htmlFor="relationship" className="text-sm font-medium text-muted-foreground">
                      Relacionamento
                    </Label>
                    <Input
                      id="relationship"
                      value={editedQuiz.relationship || ''}
                      onChange={(e) => setEditedQuiz({ ...editedQuiz, relationship: e.target.value })}
                      className="mt-1"
                      placeholder="Não informado"
                      disabled={savingQuiz}
                    />
                  </div>
                  <div>
                    <Label htmlFor="style" className="text-sm font-medium text-muted-foreground">
                      Estilo Musical <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="style"
                      value={editedQuiz.style || ''}
                      onChange={(e) => setEditedQuiz({ ...editedQuiz, style: e.target.value })}
                      className="mt-1"
                      disabled={savingQuiz}
                    />
                  </div>
                  <div>
                    <Label htmlFor="occasion" className="text-sm font-medium text-muted-foreground">
                      Ocasião
                    </Label>
                    <Input
                      id="occasion"
                      value={editedQuiz.occasion || ''}
                      onChange={(e) => setEditedQuiz({ ...editedQuiz, occasion: e.target.value })}
                      className="mt-1"
                      placeholder="Não informado"
                      disabled={savingQuiz}
                    />
                  </div>
                  <div>
                    <Label htmlFor="language" className="text-sm font-medium text-muted-foreground">
                      Idioma <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={editedQuiz.language || 'pt'}
                      onValueChange={(value) => setEditedQuiz({ ...editedQuiz, language: value })}
                      disabled={savingQuiz}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="message" className="text-sm font-medium text-muted-foreground">
                      História/Mensagem ou Letra
                    </Label>
                    <Textarea
                      id="message"
                      value={editedQuiz.message || ''}
                      onChange={(e) => setEditedQuiz({ ...editedQuiz, message: e.target.value })}
                      className="mt-1 min-h-[80px]"
                      placeholder="Não informado"
                      disabled={savingQuiz}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="music_prompt" className="text-sm font-medium text-muted-foreground">
                      Prompt de Música
                    </Label>
                    <Textarea
                      id="music_prompt"
                      value={editedQuiz.music_prompt || ''}
                      onChange={(e) => setEditedQuiz({ ...editedQuiz, music_prompt: e.target.value })}
                      className="mt-1 min-h-[80px]"
                      placeholder="Não informado"
                      disabled={savingQuiz}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vocal_gender" className="text-sm font-medium text-muted-foreground">
                      Gênero Vocal
                    </Label>
                    <Input
                      id="vocal_gender"
                      value={editedQuiz.vocal_gender || ''}
                      onChange={(e) => setEditedQuiz({ ...editedQuiz, vocal_gender: e.target.value })}
                      className="mt-1"
                      placeholder="Não informado"
                      disabled={savingQuiz}
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2 justify-end pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={handleCancelEditQuiz}
                      disabled={savingQuiz}
                      size="sm"
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleSaveQuiz}
                      disabled={savingQuiz}
                      size="sm"
                    >
                      {savingQuiz ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Salvar
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <CopyableField 
                    label="Sobre quem" 
                    value={quiz.about_who} 
                    fieldName="quiz_about_who"
                  />
                  <CopyableField 
                    label="Relacionamento" 
                    value={translateQuizValue(quiz.relationship)} 
                    fieldName="quiz_relationship"
                  />
                  <CopyableField 
                    label="Estilo Musical" 
                    value={translateQuizValue(quiz.style)} 
                    fieldName="quiz_style"
                  />
                  <CopyableField 
                    label="Ocasião" 
                    value={quiz.occasion || "Não informado"} 
                    fieldName="quiz_occasion"
                  />
                  <CopyableField 
                    label="Idioma" 
                    value={quiz.language} 
                    fieldName="quiz_language"
                  />
                  {(quiz.message || quiz.qualities || quiz.memories || quiz.key_moments) && (
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-sm font-medium text-muted-foreground">História/Mensagem ou Letra</p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const content = quiz.message || [quiz.qualities, quiz.memories, quiz.key_moments].filter(Boolean).join('\n\n');
                            handleCopy(content, "quiz_message");
                          }}
                          className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                          title="Copiar história/mensagem"
                        >
                          {copiedField === "quiz_message" ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap select-text">
                        {quiz.message || [quiz.qualities, quiz.memories, quiz.key_moments].filter(Boolean).join('\n\n')}
                      </p>
                    </div>
                  )}
                  {quiz.music_prompt && (
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-sm font-medium text-muted-foreground">Prompt de Música</p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(quiz.music_prompt, "quiz_music_prompt");
                          }}
                          className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                          title="Copiar prompt de música"
                        >
                          {copiedField === "quiz_music_prompt" ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap select-text">{quiz.music_prompt}</p>
                    </div>
                  )}
                  {quiz.vocal_gender && (
                    <CopyableField 
                      label="Gênero Vocal" 
                      value={quiz.vocal_gender} 
                      fieldName="quiz_vocal_gender"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {order.jobs && order.jobs.length > 0 && (
          <Card className="admin-card-compact md:col-span-2">
            <CardHeader className="p-2 md:p-6">
              <CardTitle className="text-sm md:text-lg">Jobs Relacionados</CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-6 select-text">
              <div className="space-y-2 md:space-y-4">
                {order.jobs.map((job: any) => (
                  <div key={job.id} className="p-2 md:p-4 border rounded-lg space-y-2 md:space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium font-mono select-text">Job #{job.id.slice(0, 8)}</p>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCopy(job.id, `job_id_${job.id}`);
                            }}
                            className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                            title="Copiar Job ID completo"
                          >
                            {copiedField === `job_id_${job.id}` ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground select-text">
                          Criado: {new Date(job.created_at).toLocaleString("pt-BR")}
                        </p>
                        {job.completed_at && (
                          <p className="text-xs text-muted-foreground select-text">
                            Concluído: {new Date(job.completed_at).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>
                    
                    {job.error && (
                      <div className="p-2 bg-destructive/10 border border-destructive/20 rounded">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="text-xs font-medium text-destructive">Erro:</p>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCopy(job.error, `job_error_${job.id}`);
                            }}
                            className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                            title="Copiar erro"
                          >
                            {copiedField === `job_error_${job.id}` ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-destructive/80 mb-2 select-text">{job.error}</p>
                        {(job.error.includes('LOVABLE_API_KEY') || job.error.includes('OPENAI_API_KEY') || job.error.includes('ANTHROPIC_API_KEY')) && (
                          <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
                            <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-1 text-xs">
                              ⚠️ Como resolver:
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-yellow-700 dark:text-yellow-300 text-[11px]">
                              <li>Acesse o Supabase Dashboard</li>
                              <li>Vá em Settings → Edge Functions → Environment Variables</li>
                              <li>Adicione a variável <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">ANTHROPIC_API_KEY</code></li>
                              <li>Faça o deploy novamente das funções <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">generate-lyrics-internal</code> e <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">generate-lyrics-for-approval</code></li>
                            </ol>
                            <a 
                              href="https://supabase.com/dashboard/project/pszyhjshppvrzhkrgmrz/settings/functions" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-yellow-800 dark:text-yellow-200 underline text-[11px] hover:text-yellow-900 dark:hover:text-yellow-100"
                            >
                              Abrir Supabase Dashboard →
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {job.suno_task_id && (
                      <CopyableField 
                        label="Suno Task ID" 
                        value={job.suno_task_id} 
                        fieldName={`suno_task_id_${job.id}`}
                        className="font-mono text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {order.songs && order.songs.length > 0 && (
          <Card className="admin-card-compact md:col-span-2" data-testid="order-songs">
            <CardHeader className="p-2 md:p-6">
              <CardTitle className="text-sm md:text-lg">Música Gerada</CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-6 select-text">
              {order.songs.map((song: any) => (
                <div key={song.id} data-testid={`related-song-${song.id}`} className="p-2 md:p-4 border rounded-lg space-y-2 md:space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm md:text-lg select-text">{song.title}</p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(song.id, `song_id_${song.id}`);
                          }}
                          className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                          title="Copiar Song ID"
                        >
                          {copiedField === `song_id_${song.id}` ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground select-text">
                        {song.style} • {song.emotion || "Neutro"}
                      </p>
                    </div>
                    <SongStatusBadge status={song.status} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                    <CopyableField 
                      label="Data de Liberação" 
                      value={new Date(song.release_at).toLocaleString("pt-BR")} 
                      fieldName={`song_release_at_${song.id}`}
                    />
                    {song.released_at && (
                      <CopyableField 
                        label="Liberado em" 
                        value={new Date(song.released_at).toLocaleString("pt-BR")} 
                        fieldName={`song_released_at_${song.id}`}
                      />
                    )}
                    {song.duration_sec && (
                      <CopyableField 
                        label="Duração" 
                        value={`${Math.floor(song.duration_sec / 60)}:${(song.duration_sec % 60).toString().padStart(2, '0')}`} 
                        fieldName={`song_duration_${song.id}`}
                      />
                    )}
                  </div>

                  {song.lyrics && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Letra</p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(song.lyrics, `song_lyrics_${song.id}`);
                          }}
                          className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                          title="Copiar letra"
                        >
                          {copiedField === `song_lyrics_${song.id}` ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="p-3 bg-muted/30 rounded border text-sm whitespace-pre-wrap max-h-48 overflow-y-auto select-text">
                        {song.lyrics}
                      </div>
                    </div>
                  )}

                  {song.audio_url && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Player</p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(song.audio_url, `song_audio_url_${song.id}`);
                          }}
                          className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                          title="Copiar URL do áudio"
                        >
                          {copiedField === `song_audio_url_${song.id}` ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <audio controls className="w-full">
                        <source src={song.audio_url} type="audio/mpeg" />
                        Seu navegador não suporta o elemento de áudio.
                      </audio>
                      <div className="flex items-center gap-1.5 mt-1">
                        <p className="text-xs text-muted-foreground font-mono break-all select-text">{song.audio_url}</p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(song.audio_url, `song_audio_url_text_${song.id}`);
                          }}
                          className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded flex-shrink-0"
                          title="Copiar URL do áudio"
                        >
                          {copiedField === `song_audio_url_text_${song.id}` ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    {song.status !== 'released' && song.status !== 'ready' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleAdminAction('release_song_now', { song_id: song.id })}
                      >
                        <Music className="h-4 w-4 mr-2" />
                        Liberar Agora
                      </Button>
                    )}
                    {song.audio_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(song.audio_url, '_blank')}
                      >
                        Baixar MP3
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
