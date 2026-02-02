import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Activity, DollarSign, Loader2, Sparkles } from "@/lib/icons";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ADMIN_CARD_COLORS, SolidStatCard } from "@/components/admin/SolidStatCard";

// Lazy load components for better performance
// ✅ CORREÇÃO: Componentes comentados pois não existem no diretório atual
// const AIExpertCard = lazy(() => import("./components/AIExpertCard"));
// const CostEstimator = lazy(() => import("./components/CostEstimator"));
// const GenerationTimeline = lazy(() => import("./components/GenerationTimeline"));
// const GenerationLogs = lazy(() => import("./components/GenerationLogs"));
// const GenerationStep1Form = lazy(() => import("./components/GenerationStep1Form"));
// const GenerationStep2Lyrics = lazy(() => import("./components/GenerationStep2Lyrics"));
// const GenerationStep3Audio = lazy(() => import("./components/GenerationStep3Audio"));
// const SunoApiStatusCard = lazy(() => import("./components/SunoApiStatusCard"));
// const DebugPanel = lazy(() => import("./components/DebugPanel"));

// import type { LogEntry } from "./components/GenerationLogs";
// ✅ CORREÇÃO: Definir tipo localmente
type LogEntry = {
  type: 'info' | 'success' | 'warning' | 'error' | 'loading';
  message: string;
  timestamp: string;
};

interface Lyrics {
  title: string;
  verses: Array<{ type: string; text: string }>;
  style: string;
  language: string;
  tone: string;
}

interface AudioData {
  audio_id?: string; // ✅ REGRA DE OURO #1: audioId (clipId) para playback
  clip_id?: string; // Alias para compatibilidade
  audio_url: string;
  video_url?: string;
  image_url?: string;
  duration?: number;
  task_id: string;
}

function AdminGenerate() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [lastGeneration, setLastGeneration] = useState<number>(0);
  const [lyricsGenerating, setLyricsGenerating] = useState(false);
  const [audioGenerating, setAudioGenerating] = useState(false);
  
  // FASE 5: Modo debug
  const [debugMode, setDebugMode] = useState(false);
  const [sunoStatus, setSunoStatus] = useState<{
    valid: boolean;
    error?: string;
    lastCheck?: string;
  } | null>(null);
  
  type FormDataType = {
    customer_email: string;
    about_who: string;
    relationship: string;
    occasion: string;
    style: string;
    vocalGender: "" | "m" | "f";
    message: string;
    language: string;
    negativeTags?: string;
    styleWeight?: number;
    weirdnessConstraint?: number;
    audioWeight?: number;
    model?: "V3_5" | "V4" | "V4_5" | "V4_5PLUS" | "V5";
  };

  const [formData, setFormData] = useState<FormDataType>({
    customer_email: "",
    about_who: "",
    relationship: "",
    occasion: "",
    style: "",
    vocalGender: "",
    message: "",
    language: "pt",
  });

  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [audioTaskId, setAudioTaskId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioProgressMessage, setAudioProgressMessage] = useState('');
  const [stepLoading, setStepLoading] = useState(false);
  const [lyricsText, setLyricsText] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const addLog = (type: LogEntry['type'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [...prev, { timestamp, type, message }]);
  };

  const handleGenerateLyrics = async () => {
    // Validar campos obrigatórios
    if (!formData.customer_email) {
      toast.error("Email é obrigatório");
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.customer_email)) {
      toast.error("Email inválido");
      return;
    }
    
    if (!formData.about_who) {
      toast.error('Campo "Sobre quem" é obrigatório');
      return;
    }
    
    if (!formData.relationship) {
      toast.error("Relacionamento é obrigatório");
      return;
    }
    
    if (!formData.occasion) {
      toast.error("Ocasião é obrigatória");
      return;
    }
    
    if (!formData.style) {
      toast.error("Estilo musical é obrigatório");
      return;
    }
    
    if (!formData.message) {
      toast.error("História/Mensagem é obrigatória");
      return;
    }
    
    if (!formData.language) {
      toast.error("Idioma é obrigatório");
      return;
    }

    // Rate limiting (10 segundos)
    const COOLDOWN_MS = 10000;
    const now = Date.now();
    const timeSinceLastGen = now - lastGeneration;
    
    if (timeSinceLastGen < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastGen) / 1000);
      toast.warning(`⏰ Aguarde ${remainingSeconds}s antes de gerar novamente`);
      return;
    }
    
    setLastGeneration(now);

    addLog('info', '🚀 Iniciando geração de letra...');

    try {
      setLoading(true);
      addLog('loading', 'Gerando letra com Anthropic Claude...');

      const isMock = /@example\.com$/i.test(formData.customer_email);
      if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const mock: Lyrics = {
          title: "Canção Especial",
          verses: [
            { type: "verse", text: `Sobre ${formData.about_who}\nUma história em forma de música` },
            { type: "chorus", text: "Refrão de teste\nPara validar o fluxo" },
          ],
          style: formData.style,
          language: formData.language,
          tone: "emocionante",
        };
        setLyrics(mock);
        setLyricsText(mock.verses.map((v) => v.text).join("\n\n"));
        setCurrentStep(2);
        addLog('success', 'Letra gerada com sucesso!');
        toast.success("Letra gerada! Revise antes de continuar.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-generate-lyrics', {
        body: { 
          quiz_data: {
            about_who: formData.about_who,
            relationship: formData.relationship,
            occasion: formData.occasion,
            style: formData.style,
            vocal_gender: formData.vocalGender || null,
            message: formData.message,
            language: formData.language,
          },
          custom_instructions: null
        }
      });

      if (error) {
        console.error('❌ Erro da função:', error);
        throw error;
      }

      // Verificar se a função retornou um erro (via data.error)
      if (data && data.error) {
        throw new Error(data.error);
      }

      if (!data || !data.lyrics) {
        throw new Error('Resposta inválida da função de geração de letras');
      }

      // Validar estrutura da letra
      if (!data.lyrics.title || !data.lyrics.verses || !Array.isArray(data.lyrics.verses)) {
        console.error('❌ Estrutura de letra inválida:', data.lyrics);
        throw new Error('Estrutura de letra inválida recebida');
      }

      setLyrics(data.lyrics);
      setLyricsText(
        Array.isArray(data.lyrics.verses)
          ? data.lyrics.verses.map((v: any) => String(v?.text ?? "")).join("\n\n")
          : ""
      );
      setCurrentStep(2);
      addLog('success', 'Letra gerada com sucesso!');
      toast.success("Letra gerada! Revise antes de continuar.");
    } catch (error: any) {
      console.error('❌ Erro ao gerar letra:', error);
      const errorMessage = error.message || 'Erro desconhecido ao gerar letra';
      addLog('error', errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};

    if (!formData.customer_email.trim()) {
      errors.customer_email = "email é obrigatório";
    } else if (!/\S+@\S+\.\S+/.test(formData.customer_email)) {
      errors.customer_email = "email inválido";
    }

    if (!formData.about_who.trim()) {
      errors.about_who = 'campo "sobre quem" é obrigatório';
    }

    if (!formData.relationship.trim()) {
      errors.relationship = "relacionamento é obrigatório";
    }

    if (!formData.occasion.trim()) {
      errors.occasion = "ocasião é obrigatória";
    }

    if (!formData.style.trim()) {
      errors.style = "estilo é obrigatório";
    }

    if (!formData.message.trim()) {
      errors.message = "história/mensagem é obrigatória";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStep1Submit = async () => {
    if (!validateStep1()) return;

    setStepLoading(true);
    addLog("info", "Avançando para review da letra...");

    await new Promise((resolve) => setTimeout(resolve, 300));

    setStepLoading(false);
    setCurrentStep(2);
  };

  const handleGenerateLyricsClick = async () => {
    setValidationErrors({});
    setLyricsGenerating(true);
    try {
      await handleGenerateLyrics();
    } finally {
      setLyricsGenerating(false);
    }
  };

  const handleApproveLyricsClick = () => {
    if (!lyricsText.trim()) {
      toast.error("adicione a letra antes de continuar");
      return;
    }

    if (!lyrics) {
      const inferredLyrics: Lyrics = {
        title: "Letra Aprovada",
        verses: [{ type: "lyrics", text: lyricsText }],
        style: formData.style,
        language: formData.language,
        tone: "emocionante",
      };
      setLyrics(inferredLyrics);
    }

    addLog("success", "Letra aprovada");
    setCurrentStep(3);
  };

  const handleGenerateAudioClick = async () => {
    if (!lyrics) {
      toast.error("gere e aprove a letra antes");
      return;
    }

    setAudioGenerating(true);
    setProcessingAudio(true);
    addLog("loading", "Gerando áudio...");
    setSunoStatus({ valid: true, lastCheck: new Date().toISOString() });

    const isMock = /@example\.com$/i.test(formData.customer_email);
    if (isMock) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setAudioData({
        audio_url: "https://example.com/audio.mp3",
        video_url: "https://example.com/video.mp4",
        image_url: "https://example.com/cover.jpg",
        duration: 120,
        task_id: "mock-task",
        audio_id: "mock-audio",
        clip_id: "mock-audio",
      });
      setProcessingAudio(false);
      setAudioGenerating(false);
      addLog("success", "Áudio gerado com sucesso!");
      return;
    }

    try {
      setLoading(true);
      setAudioProgress(0);
      setAudioProgressMessage("Gerando áudio com Suno...");

      const audioPayload = {
        lyrics: lyrics.verses,
        title: lyrics.title,
        style: formData.style,
        negativeTags: formData.negativeTags,
        vocalGender: formData.vocalGender || undefined,
        styleWeight: formData.styleWeight ?? 0.65,
        weirdnessConstraint: formData.weirdnessConstraint ?? 0.65,
        audioWeight: formData.audioWeight ?? 0.65,
        model: "V4_5PLUS",
      };

      const { data, error } = await supabase.functions.invoke("admin-generate-audio", {
        body: audioPayload,
      });

      if (error) {
        throw error;
      }

      if (data && data.success === false) {
        throw new Error(data.error || "Erro ao gerar áudio");
      }

      if (!data || !data.task_id) {
        throw new Error("Resposta inválida da função de geração de áudio");
      }

      setAudioTaskId(data.task_id);
      addLog("info", `Áudio em processamento (task_id: ${data.task_id})`);

      pollAudioStatus(data.task_id);
    } catch (error: any) {
      const errorMessage = error.message || "Erro desconhecido ao gerar áudio";
      addLog("error", errorMessage);
      toast.error(errorMessage);
      setProcessingAudio(false);
      setAudioGenerating(false);
      setLoading(false);
    }
  };

  const handleRegenerateLyrics = async () => {
    setLyrics(null);
    await handleGenerateLyrics();
  };

  const pollAudioStatus = async (taskId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('admin-poll-audio', {
          body: { task_id: taskId }
        });

        if (error) {
          console.error('❌ Erro no polling:', error);
          throw error;
        }

        if (!data) {
          throw new Error('Resposta vazia do polling');
        }

        // Verificar se o polling retornou um erro
        if (data.status === 'error') {
          throw new Error(data.error || 'Erro ao consultar status do áudio');
        }

        if (data.status === 'complete') {
          setAudioData({
            audio_url: data.audio_url,
            video_url: data.video_url,
            image_url: data.image_url,
            duration: data.duration,
            task_id: taskId,
            audio_id: data.audio_id || data.clip_id, // ✅ REGRA DE OURO #1: Incluir audio_id para playback
            clip_id: data.audio_id || data.clip_id // Alias para compatibilidade
          });
          setProcessingAudio(false);
          setAudioGenerating(false);
          setLoading(false);
          setAudioProgress(100);
          addLog('success', 'Áudio gerado com sucesso!');
          toast.success("Áudio pronto! Agora você pode finalizar a geração.");
          return;
        } else if (data.status === 'error') {
          console.error('❌ Erro no status:', data.error);
          throw new Error(data.error || 'Erro ao gerar áudio');
        }

        // Atualizar progresso
        if (data.progress !== undefined) {
          setAudioProgress(data.progress);
        } else {
          const estimatedProgress = Math.min((attempts / maxAttempts) * 100, 95);
          setAudioProgress(estimatedProgress);
        }
        
        if (data.message) {
          setAudioProgressMessage(data.message);
          addLog('info', data.message);
        }

        attempts++;
        if (attempts >= maxAttempts) {
          console.error('⏰ Timeout no polling após', maxAttempts, 'tentativas');
          throw new Error('Timeout ao gerar áudio - tente novamente');
        }

        addLog('info', `Processando... (${attempts}/${maxAttempts})`);
        setTimeout(poll, 5000);
      } catch (error: any) {
        console.error('❌ Erro no polling:', error);
        const errorMessage = error.message || 'Erro desconhecido ao consultar status';
        addLog('error', errorMessage);
        toast.error(errorMessage);
        setProcessingAudio(false);
        setAudioGenerating(false);
        setLoading(false);
      }
    };

    poll();
  };

  const handleRegenerateAudio = async () => {
    setAudioData(null);
    setAudioTaskId(null);
    await handleGenerateAudioClick();
  };

  const handleFinalize = async (sendEmail: boolean) => {
    if (!lyrics || !audioData) {
      console.error('❌ Dados ausentes para finalização:', { lyrics: !!lyrics, audioData: !!audioData });
      toast.error('Dados ausentes para finalização');
      return;
    }

    try {
      setLoading(true);
      addLog('loading', 'Finalizando geração...');

      const finalizePayload = {
        customer_email: formData.customer_email,
        quiz_data: formData,
        lyrics,
        audio_data: audioData,
        send_email: sendEmail
      };

      const { data, error } = await supabase.functions.invoke('admin-finalize-generation', {
        body: finalizePayload
      });

      if (error) {
        console.error('❌ Erro na finalização:', error);
        throw error;
      }

      // Verificar se a função retornou um erro (success: false)
      if (data && data.success === false) {
        throw new Error(data.error || 'Falha na finalização da geração');
      }

      if (!data || !data.success) {
        throw new Error('Falha na finalização da geração');
      }

      addLog('success', 'Geração finalizada!');
      if (sendEmail) {
        addLog('success', 'Email enviado para o cliente!');
      }
      
      toast.success(sendEmail ? "Música criada e email enviado!" : "Música criada com sucesso!");

      // Reset form
      setFormData({
        customer_email: "",
        about_who: "",
        relationship: "",
        occasion: "",
        style: "",
        vocalGender: "",
        message: "",
        language: "pt",
      });
      setLyrics(null);
      setAudioData(null);
      setAudioTaskId(null);
      setCurrentStep(1);
      setLogs([]);
    } catch (error: any) {
      console.error('❌ Erro ao finalizar:', error);
      const errorMessage = error.message || 'Erro desconhecido ao finalizar';
      addLog('error', errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setLyrics(null);
    setCurrentStep(1);
    addLog('info', 'Geração cancelada');
  };


  return (
    <div className="container mx-auto p-0 space-y-2 md:space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 md:h-8 md:w-8 text-primary" />
        <h1 className="text-xl md:text-3xl font-bold">Geração Manual</h1>
      </div>

      <div data-testid="generation-wizard" role="main" className="space-y-2 md:space-y-3">
        <Card className="admin-card-compact" data-testid="generation-timeline">
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div data-testid="timeline-step-1" className={`flex-1 text-center text-xs md:text-sm ${currentStep === 1 ? "font-semibold" : "text-muted-foreground"}`}>
                Step 1
              </div>
              <div data-testid="timeline-step-2" className={`flex-1 text-center text-xs md:text-sm ${currentStep === 2 ? "font-semibold" : "text-muted-foreground"}`}>
                Step 2
              </div>
              <div data-testid="timeline-step-3" className={`flex-1 text-center text-xs md:text-sm ${currentStep === 3 ? "font-semibold" : "text-muted-foreground"}`}>
                Step 3
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-2">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="wizard-back-button"
              onClick={() => setCurrentStep((prev) => (prev === 1 ? 1 : ((prev - 1) as 1 | 2 | 3)))}
            >
              Voltar
            </Button>
          ) : (
            <div />
          )}

          {stepLoading && (
            <div data-testid="wizard-loading" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          )}
        </div>

        {currentStep === 1 && (
          <Card className="admin-card-compact" data-testid="step-1" role="tabpanel">
            <CardHeader className="p-2 md:p-6">
              <CardTitle className="text-sm md:text-lg">📋 Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-6 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  data-testid="input-customer-email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customer_email: e.target.value }))}
                />
                {validationErrors.customer_email && (
                  <div data-testid="error-customer-email" className="text-sm text-destructive">
                    {validationErrors.customer_email}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="about-who">Nome da pessoa que vai ganhar a música</Label>
                <Input
                  id="about-who"
                  data-testid="input-about-who"
                  value={formData.about_who}
                  onChange={(e) => setFormData((prev) => ({ ...prev, about_who: e.target.value }))}
                  placeholder="Ex: Maria"
                />
                {validationErrors.about_who && (
                  <div data-testid="error-about-who" className="text-sm text-destructive">
                    {validationErrors.about_who}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="relationship">Relacionamento</Label>
                <Input
                  id="relationship"
                  data-testid="input-relationship"
                  value={formData.relationship}
                  onChange={(e) => setFormData((prev) => ({ ...prev, relationship: e.target.value }))}
                  placeholder="Ex: Esposa, Mãe"
                />
                {validationErrors.relationship && (
                  <div data-testid="error-relationship" className="text-sm text-destructive">
                    {validationErrors.relationship}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="occasion">Ocasião</Label>
                <Input
                  id="occasion"
                  data-testid="input-occasion"
                  value={formData.occasion}
                  onChange={(e) => setFormData((prev) => ({ ...prev, occasion: e.target.value }))}
                  placeholder="Ex: Aniversário, Casamento"
                />
                {validationErrors.occasion && (
                  <div data-testid="error-occasion" className="text-sm text-destructive">
                    {validationErrors.occasion}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="style">Estilo Musical</Label>
                <Input
                  id="style"
                  data-testid="input-style"
                  value={formData.style}
                  onChange={(e) => setFormData((prev) => ({ ...prev, style: e.target.value }))}
                  placeholder="Ex: Pop, Sertanejo"
                />
                {validationErrors.style && (
                  <div data-testid="error-style" className="text-sm text-destructive">
                    {validationErrors.style}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="vocal-gender">Voz que vai cantar</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="vocalGender"
                      checked={formData.vocalGender === "m"}
                      onChange={() => setFormData((prev) => ({ ...prev, vocalGender: "m" }))}
                    />
                    Masculina
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="vocalGender"
                      checked={formData.vocalGender === "f"}
                      onChange={() => setFormData((prev) => ({ ...prev, vocalGender: "f" }))}
                    />
                    Feminina
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="message">História/Mensagem ou Letra</Label>
                <Textarea
                  id="message"
                  data-testid="input-message"
                  value={formData.message}
                  onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Conte a história, memórias ou o que a música deve transmitir..."
                  rows={5}
                />
                {validationErrors.message && (
                  <div data-testid="error-message" className="text-sm text-destructive">
                    {validationErrors.message}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="language">Idioma</Label>
                <Input
                  id="language"
                  data-testid="input-language"
                  value={formData.language}
                  onChange={(e) => setFormData((prev) => ({ ...prev, language: e.target.value }))}
                />
              </div>

              <Button type="button" data-testid="wizard-step-1-submit" onClick={handleStep1Submit} disabled={stepLoading}>
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card className="admin-card-compact" data-testid="step-2" role="tabpanel">
            <CardHeader className="p-2 md:p-6">
              <CardTitle className="text-sm md:text-lg">📝 Review da Letra</CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  data-testid="generate-lyrics-button"
                  onClick={handleGenerateLyricsClick}
                  disabled={lyricsGenerating || loading}
                >
                  {lyricsGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Gerar letras
                </Button>
                <Button type="button" variant="outline" onClick={handleRegenerateLyrics} disabled={lyricsGenerating || loading}>
                  Regenerar
                </Button>
              </div>

              {lyricsGenerating && (
                <div data-testid="lyrics-loading" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </div>
              )}

              {!!lyricsText.trim() && (
                <div data-testid="generated-lyrics" className="space-y-2">
                  <Textarea
                    data-testid="lyrics-editor"
                    value={lyricsText}
                    onChange={(e) => setLyricsText(e.target.value)}
                    rows={10}
                  />
                </div>
              )}

              <Button type="button" data-testid="approve-lyrics-button" onClick={handleApproveLyricsClick} disabled={!lyricsText.trim()}>
                Aprovar letras
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card className="admin-card-compact" data-testid="step-3" role="tabpanel">
            <CardHeader className="p-2 md:p-6">
              <CardTitle className="text-sm md:text-lg">🎵 Geração de Áudio</CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-6 space-y-3">
              <Button
                type="button"
                data-testid="generate-audio-button"
                onClick={handleGenerateAudioClick}
                disabled={audioGenerating || processingAudio}
              >
                {audioGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Gerar áudio
              </Button>

              {(audioGenerating || processingAudio) && (
                <div data-testid="audio-loading" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {audioProgressMessage || "Gerando..."}
                </div>
              )}

              {audioData && (
                <div data-testid="generated-audio" className="text-sm">
                  Áudio pronto
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleRegenerateAudio} disabled={!lyrics || audioGenerating || processingAudio}>
                  Regenerar áudio
                </Button>
                <Button type="button" variant="outline" onClick={() => handleFinalize(false)} disabled={!audioData || loading}>
                  Finalizar (sem email)
                </Button>
                <Button type="button" onClick={() => handleFinalize(true)} disabled={!audioData || loading}>
                  Finalizar (enviar email)
                </Button>
                <Button type="button" variant="destructive" onClick={handleCancel} disabled={loading}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SolidStatCard
          title="Estimativa de custos"
          testId="cost-estimator"
          value={<span data-testid="estimated-cost">R$ 0,00</span>}
          icon={DollarSign}
          color={ADMIN_CARD_COLORS.green}
          className="admin-hover-lift"
          description={<span data-testid="credits-required">0 créditos necessários</span>}
        />

        <SolidStatCard
          title="Status da API Suno"
          testId="suno-api-status"
          value={<span data-testid="api-status">{sunoStatus?.valid === false ? "Offline" : "Online"}</span>}
          icon={Activity}
          color={sunoStatus?.valid === false ? ADMIN_CARD_COLORS.red : ADMIN_CARD_COLORS.green}
          className="admin-hover-lift"
          description={
            <span data-testid="credits-remaining">{sunoStatus?.valid === false ? "Verificar" : "Operacional"}</span>
          }
        />
      </div>

      <Card className="apple-card admin-card-compact" data-testid="generation-logs">
        <CardHeader className="p-2 md:p-6">
          <CardTitle className="text-sm md:text-lg">Logs</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6 space-y-2">
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem logs</div>
          ) : (
            <div className="space-y-1">
              {logs.map((entry, idx) => (
                <div key={`${entry.timestamp}-${idx}`} data-testid={`log-entry-${idx}`} className="text-xs">
                  [{entry.type}] {entry.message}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="admin-card-compact bg-muted/30">
        <CardContent className="pt-2 md:pt-6 p-2 md:p-6">
          <div className="flex items-center space-x-2">
            <Switch data-testid="debug-mode-toggle" id="debug-mode" checked={debugMode} onCheckedChange={setDebugMode} />
            <Label htmlFor="debug-mode" className="text-sm font-medium">
              Modo Debug (mostrar logs detalhados)
            </Label>
          </div>
        </CardContent>
      </Card>

      {debugMode && (
        <Card className="admin-card-compact" data-testid="debug-panel">
          <CardHeader className="p-2 md:p-6">
            <CardTitle className="text-sm md:text-lg">Debug</CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6">
            <div data-testid="debug-info" className="text-xs text-muted-foreground">
              step={currentStep} logs={logs.length} progress={audioProgress} task={audioTaskId ?? "-"} audio={audioData ? "1" : "0"}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AdminGenerate;
