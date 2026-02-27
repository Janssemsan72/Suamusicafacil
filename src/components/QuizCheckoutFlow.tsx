import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LYRICS_MAX_LENGTH,
  LYRICS_TITLE_MAX_LENGTH,
  validateQuiz,
  sanitizeQuiz,
  type QuizData as ValidationQuizData,
} from "@/utils/quizValidation";
import type { QuizPayload } from "@/utils/quizInsert";
import { formatValidationErrors } from "@/utils/quizValidation";
import {
  getOrCreateQuizSessionId,
  loadQuizFromStorage,
  saveQuizToStorage,
  loadQuizStepState,
  saveQuizStepState,
  clearQuizStepState,
} from "@/utils/quizSync";
import { generateCaktoUrl } from "@/utils/checkoutLinks";
import {
  normalizeStyle,
  parseAnswers,
  formatLyricsFromVerses,
} from "@/utils/quizCheckoutFlow";
import {
  QuizStepIndicator,
  QuizDetailsForm,
  QuizLyricsStep,
  type QuizFormState,
} from "@/components/quiz";
import { Loader2 } from "@/lib/icons";

type QuizCheckoutFlowProps = {
  mode?: "modal" | "page";
  onClose?: () => void;
};

const QuizCheckoutFlow = ({ mode = "modal", onClose }: QuizCheckoutFlowProps) => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [lyricsApproved, setLyricsApproved] = useState(false);
  const [lyricsTitle, setLyricsTitle] = useState("");
  const [lyricsText, setLyricsText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentProgress, setPaymentProgress] = useState(0);
  const [hasRejectedOnce, setHasRejectedOnce] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const redirectStartedRef = useRef(false);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const lastAutosaveRef = useRef<{ title: string; text: string } | null>(null);
  /** Guarda o quiz_id retornado pelo create-checkout para conferência no log de handleGoToPayment (quizId === response_quiz_id). */
  const lastResponseQuizIdFromCheckoutRef = useRef<string | null>(null);

  const sessionId = useMemo(() => getOrCreateQuizSessionId(), []);

  const [formState, setFormState] = useState<QuizFormState>({
    email: "",
    whatsapp: "",
    customerName: "",
    aboutWho: "",
    relationship: "",
    customRelationship: "",
    occasion: "",
    style: "",
    vocalGender: "",
    message: "",
  });

  const persistCheckoutDraft = useCallback((quizData: ValidationQuizData) => {
    try {
      const draft = {
        email: formState.email,
        whatsapp: formState.whatsapp,
        quizData,
        timestamp: Date.now(),
      };
      localStorage.setItem("checkout_draft", JSON.stringify(draft));
    } catch (error) {
      console.warn("⚠️ [QuizCheckoutFlow] Falha ao salvar draft:", error);
    }
  }, [formState.email, formState.whatsapp]);

  const buildQuizData = useCallback((): ValidationQuizData => {
    return {
      about_who: formState.aboutWho,
      relationship: formState.relationship,
      occasion: formState.occasion,
      style: formState.style,
      language: "pt",
      vocal_gender: formState.vocalGender || null,
      qualities: null,
      memories: null,
      key_moments: null,
      desired_tone: null,
      message: formState.message,
      answers: {
        approved_lyrics: lyricsApproved ? lyricsText : null,
        approved_lyrics_title: lyricsApproved ? lyricsTitle : null,
        customer_name: formState.customerName || null,
      },
      session_id: sessionId,
      customer_email: formState.email || null,
      customer_whatsapp: formState.whatsapp || null,
    };
  }, [formState, lyricsApproved, lyricsText, lyricsTitle, sessionId]);

  const persistQuiz = useCallback(async () => {
    setErrorMessage(null);
    if (!formState.email.trim()) {
      setErrorMessage("Informe seu e-mail.");
      return { success: false, quizId: null };
    }
    if (!formState.customerName.trim()) {
      setErrorMessage("Informe seu nome.");
      return { success: false, quizId: null };
    }
    if (!formState.whatsapp.trim()) {
      setErrorMessage("Informe seu WhatsApp.");
      return { success: false, quizId: null };
    }
    if (!formState.aboutWho.trim() || !formState.style.trim()) {
      setErrorMessage("Preencha para quem é a música e o estilo musical.");
      return { success: false, quizId: null };
    }
    if (!formState.relationship.trim()) {
      setErrorMessage("Informe a relação.");
      return { success: false, quizId: null };
    }
    if (!formState.occasion.trim()) {
      setErrorMessage("Informe a ocasião.");
      return { success: false, quizId: null };
    }
    if (!formState.message.trim()) {
      setErrorMessage("Conte a sua história ou mensagem.");
      return { success: false, quizId: null };
    }
    const quizData = buildQuizData();
    const validation = validateQuiz(quizData, { strict: false });

    if (!validation.valid) {
      setErrorMessage(formatValidationErrors(validation.errors));
      return { success: false, quizId: null };
    }

    const sanitized = sanitizeQuiz(quizData);
    const payload: QuizPayload = {
      customer_email: sanitized.customer_email || null,
      customer_whatsapp: sanitized.customer_whatsapp || null,
      about_who: sanitized.about_who,
      relationship: sanitized.relationship,
      occasion: sanitized.occasion || null,
      style: sanitized.style,
      language: sanitized.language || "pt",
      vocal_gender: sanitized.vocal_gender || null,
      desired_tone: sanitized.desired_tone || null,
      qualities: sanitized.qualities || null,
      memories: sanitized.memories || null,
      key_moments: sanitized.key_moments || null,
      message: sanitized.message || null,
      answers: sanitized.answers || null,
      session_id: sessionId,
    };

    setIsSaving(true);
    const { insertQuizWithRetry } = await import("@/utils/quizInsert");
    const result = await insertQuizWithRetry(payload);
    setIsSaving(false);

    if (!result.success) {
      const err = result.error as { code?: string; message?: string } | undefined;
      const errMsg = err?.message?.toLowerCase() || "";
      if (err?.code === "PGRST301" || errMsg.includes("401")) {
        setErrorMessage("Erro de permissão no banco. Verifique as configurações do Supabase.");
      } else if (errMsg.includes("session_id") || errMsg.includes("column")) {
        setErrorMessage("Schema do banco desatualizado. Execute as migrações no Supabase.");
      } else {
        setErrorMessage("Não foi possível salvar seus dados. Tente novamente.");
      }
      if (import.meta.env.DEV && err) {
        console.error("[QuizCheckoutFlow] Erro ao salvar quiz:", err);
      }
      return { success: false, quizId: null };
    }

    const savedQuizId = result.data?.id || null;
    setQuizId(savedQuizId);

    await saveQuizToStorage({
      ...sanitized,
      timestamp: new Date().toISOString(),
      id: savedQuizId || undefined,
      session_id: sessionId,
    } as ValidationQuizData & { id?: string; session_id?: string });

    persistCheckoutDraft(sanitized);

    return { success: true, quizId: savedQuizId };
  }, [buildQuizData, persistCheckoutDraft, sessionId, formState]);

  const handleNextFromDetails = useCallback(async () => {
    const result = await persistQuiz();
    if (!result.success) return;

    setErrorMessage(null);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const email = formState.email?.trim();
      const whatsapp = formState.whatsapp?.trim();
      if (!email || !whatsapp) {
        setErrorMessage("E-mail e WhatsApp são obrigatórios.");
        return;
      }
      const messageText = (formState.message && formState.message.trim()) || "Música personalizada";
      const aboutWho = (formState.aboutWho && formState.aboutWho.trim()) || "Cliente";
      const style = (formState.style && formState.style.trim()) || "pop";
      const quizPayload = {
        about_who: aboutWho,
        relationship: formState.relationship || formState.customRelationship || "",
        occasion: formState.occasion || "",
        style,
        language: "pt",
        vocal_gender: formState.vocalGender || null,
        message: messageText,
        qualities: null,
        memories: null,
        key_moments: null,
        desired_tone: null,
        answers: {
          approved_lyrics: null,
          approved_lyrics_title: null,
          customer_name: formState.customerName || null,
        },
      };
      const { data: checkoutResult, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: {
          session_id: sessionId,
          quiz: quizPayload,
          customer_email: email,
          customer_whatsapp: whatsapp,
          customer_name: formState.customerName?.trim() || null,
          plan: "express",
          amount_cents: 3700,
          transaction_id: crypto.randomUUID(),
          provider: "cakto",
        },
      });
      if (checkoutError || !checkoutResult?.success) {
        const msg = checkoutResult?.error || checkoutError?.message || "Não foi possível criar o pedido. Tente novamente.";
        setErrorMessage(msg);
        return;
      }
      const orderId = checkoutResult.order_id;
      const responseQuizId = checkoutResult.quiz_id ?? null;
      if (!orderId) {
        setErrorMessage("Pedido não foi criado. Tente novamente.");
        return;
      }
      if (responseQuizId) {
        lastResponseQuizIdFromCheckoutRef.current = responseQuizId;
        setQuizId(responseQuizId);
      }
      setPendingOrderId(orderId);
      setLyricsTitle("");
      setLyricsText("");
      setLyricsApproved(false);
      setHasRejectedOnce(false);
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar pedido. Tente novamente.";
      setErrorMessage(msg);
    }
  }, [persistQuiz, formState, sessionId]);

  const handleGenerateLyrics = useCallback(async () => {
    if (isGeneratingLyrics) return;
    setErrorMessage(null);
    setIsGeneratingLyrics(true);

    try {
      // Garantir que o quiz exista antes de gerar (persistQuiz se ainda não houver quizId)
      let currentQuizId = quizId;
      if (!currentQuizId) {
        const result = await persistQuiz();
        if (!result.success || !result.quizId) {
          setIsGeneratingLyrics(false);
          return;
        }
        currentQuizId = result.quizId;
        setQuizId(currentQuizId);
      }

      const { supabase } = await import("@/integrations/supabase/client");
      const quizData = buildQuizData();
      const { data, error } = await supabase.functions.invoke("generate-lyrics-internal", {
        body: {
          preview: true,
          quiz: {
            about_who: quizData.about_who,
            relationship: quizData.relationship,
            occasion: quizData.occasion,
            style: quizData.style,
            language: quizData.language,
            vocal_gender: quizData.vocal_gender,
            message: quizData.message,
          },
        },
      });

      if (error || !data?.lyrics) {
        // Edge function 500 retorna { error: "mensagem" } no body
        const msg = data?.error || error?.message || "Falha ao gerar letra";
        throw new Error(msg);
      }

      const formatted = formatLyricsFromVerses(data.lyrics.title, data.lyrics.verses || []);
      const limitedTitle = formatted.title.slice(0, LYRICS_TITLE_MAX_LENGTH);
      const limitedText = formatted.text.slice(0, LYRICS_MAX_LENGTH);
      setLyricsTitle(limitedTitle);
      setLyricsText(limitedText);
      setLyricsApproved(false);

      // Salvar letra gerada no quiz imediatamente (rascunho antes da aprovação)
      if (currentQuizId) {
        const { supabase: sb } = await import("@/integrations/supabase/client");
        // ✅ FIX: Buscar answers atuais do banco em vez de localStorage
        let existingAnswers: Record<string, any> = {};
        try {
          const { data: dbQuiz } = await sb
            .from("quizzes")
            .select("answers")
            .eq("id", currentQuizId)
            .maybeSingle();
          existingAnswers = (dbQuiz?.answers && typeof dbQuiz.answers === "object") ? dbQuiz.answers : {};
        } catch { /* fallback to empty */ }
        const updatedAnswers = {
          ...existingAnswers,
          generated_lyrics: limitedText,
          generated_lyrics_title: limitedTitle,
          generated_lyrics_at: new Date().toISOString(),
        };
        await sb
          .from("quizzes")
          .update({ answers: updatedAnswers })
          .eq("id", currentQuizId);
        const currentQuiz = loadQuizFromStorage();
        await saveQuizToStorage({
          ...(currentQuiz || {}),
          answers: updatedAnswers,
        } as ValidationQuizData & { id?: string; session_id?: string });
      }
    } catch (error: any) {
      setErrorMessage(error?.message || "Não foi possível gerar a letra agora.");
    } finally {
      setIsGeneratingLyrics(false);
    }
  }, [buildQuizData, isGeneratingLyrics, persistQuiz, quizId]);

  const saveLyricsDraft = useCallback(
    async (title: string, text: string) => {
      const trimmedTitle = title.trim();
      const trimmedText = text.trim();
      if (!trimmedTitle && !trimmedText) return;

      let currentQuizId = quizId;
      if (!currentQuizId) {
        const result = await persistQuiz();
        if (!result.success || !result.quizId) {
          return;
        }
        currentQuizId = result.quizId;
        setQuizId(currentQuizId);
      }

      const { supabase } = await import("@/integrations/supabase/client");
      // ✅ FIX: Buscar answers atuais do banco em vez de localStorage
      let existingAnswers: Record<string, any> = {};
      try {
        const { data: dbQuiz } = await supabase
          .from("quizzes")
          .select("answers")
          .eq("id", currentQuizId)
          .maybeSingle();
        existingAnswers = (dbQuiz?.answers && typeof dbQuiz.answers === "object") ? dbQuiz.answers : {};
      } catch { /* fallback to empty */ }
      const updatedAnswers = {
        ...existingAnswers,
        approved_lyrics: trimmedText || null,
        approved_lyrics_title: trimmedTitle || null,
        approved_lyrics_at: new Date().toISOString(),
      };

      await supabase
        .from("quizzes")
        .update({ answers: updatedAnswers })
        .eq("id", currentQuizId);

      const currentQuiz = loadQuizFromStorage();
      await saveQuizToStorage({
        ...(currentQuiz || {}),
        answers: updatedAnswers,
      } as ValidationQuizData & { id?: string; session_id?: string });
    },
    [persistQuiz, quizId]
  );

  const handleRejectLyrics = useCallback(async () => {
    if (hasRejectedOnce) return;
    setHasRejectedOnce(true);
    setLyricsTitle("");
    setLyricsText("");
    setLyricsApproved(false);
    await handleGenerateLyrics();
  }, [hasRejectedOnce, handleGenerateLyrics]);

  const handleGoToPayment = useCallback(async () => {
    if (!lyricsText.trim()) {
      setErrorMessage("Revise sua letra antes de ir para o pagamento.");
      return;
    }
    setErrorMessage(null);

    try {
      if (quizId) {
        const { supabase } = await import("@/integrations/supabase/client");
        // ✅ FIX: Buscar answers atuais do banco em vez de localStorage
        let existingAnswers: Record<string, any> = {};
        try {
          const { data: dbQuiz } = await supabase
            .from("quizzes")
            .select("answers")
            .eq("id", quizId)
            .maybeSingle();
          existingAnswers = (dbQuiz?.answers && typeof dbQuiz.answers === "object") ? dbQuiz.answers : {};
        } catch { /* fallback to empty */ }
        const updatedAnswers = {
          ...existingAnswers,
          approved_lyrics: lyricsText.trim(),
          approved_lyrics_title: lyricsTitle.trim() || "Sua música personalizada",
          approved_lyrics_at: new Date().toISOString(),
        };
        await supabase
          .from("quizzes")
          .update({ answers: updatedAnswers })
          .eq("id", quizId);

        const currentQuiz = loadQuizFromStorage();
        if (currentQuiz) {
          await saveQuizToStorage({
            ...currentQuiz,
            answers: updatedAnswers,
          });
        }
      }

      setLyricsApproved(true);
      setStep(3);
    } catch (error) {
      console.warn("⚠️ [QuizCheckoutFlow] Falha ao salvar letra:", error);
      setErrorMessage("Não foi possível salvar a letra. Tente novamente.");
    }
  }, [lyricsText, lyricsTitle, quizId]);

  useEffect(() => {
    if (step !== 2) return;
    if (lyricsText || isGeneratingLyrics) return;
    handleGenerateLyrics();
  }, [handleGenerateLyrics, isGeneratingLyrics, lyricsText, step]);

  useEffect(() => {
    if (step !== 2) return;
    if (isGeneratingLyrics) return;
    if (!lyricsText && !lyricsTitle) return;

    const currentTitle = lyricsTitle.slice(0, LYRICS_TITLE_MAX_LENGTH);
    const currentText = lyricsText.slice(0, LYRICS_MAX_LENGTH);
    if (
      lastAutosaveRef.current?.title === currentTitle &&
      lastAutosaveRef.current?.text === currentText
    ) {
      return;
    }

    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      saveLyricsDraft(currentTitle, currentText);
      lastAutosaveRef.current = { title: currentTitle, text: currentText };
    }, 800);

    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [isGeneratingLyrics, lyricsText, lyricsTitle, saveLyricsDraft, step]);

  // Passo 3: redirecionar para a Cakto (usa pedido já criado no passo 1 ou cria agora como fallback)
  useEffect(() => {
    if (step !== 3 || redirectStartedRef.current) return;
    redirectStartedRef.current = true;
    setRedirectError(null);

    const runRedirect = async () => {
      const email = formState.email?.trim();
      const whatsapp = formState.whatsapp?.trim();
      if (!email || !whatsapp) {
        setRedirectError("E-mail e WhatsApp são obrigatórios.");
        redirectStartedRef.current = false;
        return;
      }

      try {
        let orderId = pendingOrderId;
        if (!orderId) {
          console.warn('[QuizCheckoutFlow] pendingOrderId ausente no step 3 - criando fallback');
          const { supabase } = await import("@/integrations/supabase/client");
          const messageText = (formState.message && formState.message.trim()) || (lyricsText.trim().split("\n")[0] || "Música personalizada");
          const aboutWho = (formState.aboutWho && formState.aboutWho.trim()) || "Cliente";
          const style = (formState.style && formState.style.trim()) || "pop";
          const quizPayload = {
            about_who: aboutWho,
            relationship: formState.relationship || formState.customRelationship || "",
            occasion: formState.occasion || "",
            style,
            language: "pt",
            vocal_gender: formState.vocalGender || null,
            message: messageText,
            qualities: null,
            memories: null,
            key_moments: null,
            desired_tone: null,
            answers: {
              approved_lyrics: lyricsText.trim(),
              approved_lyrics_title: lyricsTitle.trim() || "Sua música personalizada",
              customer_name: formState.customerName || null,
            },
          };
          const { data: checkoutResult, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
            body: {
              session_id: sessionId,
              quiz: quizPayload,
              customer_email: email,
              customer_whatsapp: whatsapp,
              customer_name: formState.customerName?.trim() || null,
              plan: "express",
              amount_cents: 3700,
              transaction_id: crypto.randomUUID(),
              provider: "cakto",
            },
          });
          if (checkoutError || !checkoutResult?.success) {
            const serverMsg = checkoutResult?.error;
            const sdkMsg = checkoutError?.message;
            const isGenericSdk = sdkMsg?.includes('non-2xx') || sdkMsg?.includes('status code');
            const msg = serverMsg || (isGenericSdk ? 'Não foi possível criar o pedido. Verifique os dados e tente novamente.' : sdkMsg) || 'Erro ao preparar pagamento.';
            setRedirectError(msg);
            redirectStartedRef.current = false;
            return;
          }
          orderId = checkoutResult.order_id;
        }
        if (!orderId) {
          setRedirectError("Pedido não foi criado. Tente novamente.");
          redirectStartedRef.current = false;
          return;
        }
        const caktoUrl = generateCaktoUrl(orderId, email, whatsapp, "pt");
        window.location.replace(caktoUrl);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Erro ao redirecionar. Tente novamente.";
        const isGenericSdk = raw?.includes('non-2xx') || raw?.includes('status code');
        const msg = isGenericSdk ? 'Não foi possível criar o pedido. Verifique os dados e tente novamente.' : raw;
        setRedirectError(msg);
        redirectStartedRef.current = false;
      }
    };

    runRedirect();
  }, [step, pendingOrderId, formState.email, formState.whatsapp, formState.aboutWho, formState.relationship, formState.customRelationship, formState.occasion, formState.style, formState.vocalGender, formState.message, formState.customerName, lyricsText, lyricsTitle, sessionId]);

  // Persistir step + letra + orderId para restaurar ao retornar à página
  useEffect(() => {
    if (step >= 2) {
      saveQuizStepState({
        step,
        lyricsTitle,
        lyricsText,
        lyricsApproved,
        quizId,
        orderId: pendingOrderId ?? undefined,
      });
    }
  }, [step, lyricsTitle, lyricsText, lyricsApproved, quizId, pendingOrderId]);

  useEffect(() => {
    if (mode !== "page") return;

    const localQuiz = loadQuizFromStorage();
    if (localQuiz?.about_who && localQuiz?.style) {
      const localAnswers = parseAnswers(localQuiz.answers);
      const customerName =
        typeof localAnswers?.customer_name === "string" ? localAnswers.customer_name : "";
      setFormState((prev) => ({
        ...prev,
        customerName,
        aboutWho: localQuiz.about_who || "",
        relationship: localQuiz.relationship || "",
        occasion: localQuiz.occasion || "",
        style: normalizeStyle(localQuiz.style) || "",
        vocalGender: localQuiz.vocal_gender || "",
        message: localQuiz.message || "",
      }));
    }

    // Restaurar passo da letra se o usuário saiu e voltou
    const stepState = loadQuizStepState();
    if (
      stepState &&
      stepState.step >= 2 &&
      localQuiz?.about_who &&
      localQuiz?.style &&
      (!stepState.quizId || !localQuiz.id || stepState.quizId === localQuiz.id)
    ) {
      const answers = parseAnswers(localQuiz.answers);
      const storedLyrics =
        (stepState.lyricsText && stepState.lyricsText.trim()) ||
        (typeof answers?.approved_lyrics === "string" ? answers.approved_lyrics : "");
      const storedTitle =
        (stepState.lyricsTitle && stepState.lyricsTitle.trim()) ||
        (typeof answers?.approved_lyrics_title === "string" ? answers.approved_lyrics_title : "");

      if (storedLyrics || stepState.step === 3) {
        setStep(stepState.step);
        setQuizId(stepState.quizId ?? localQuiz.id ?? null);
        setLyricsTitle(storedTitle || stepState.lyricsTitle);
        setLyricsText(storedLyrics || stepState.lyricsText);
        setLyricsApproved(!!stepState.lyricsApproved);
        if (stepState.orderId) setPendingOrderId(stepState.orderId);
      }
    }

    const isEdit = searchParams.get("edit") === "true";
    const quizIdParam = searchParams.get("quiz_id");
    if (!isEdit || !quizIdParam) return;

    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizIdParam)
        .maybeSingle();

      if (data) {
        const storedAnswers = parseAnswers(data.answers);
        const customerName =
          typeof storedAnswers?.customer_name === "string" ? storedAnswers.customer_name : "";
        setQuizId(data.id);
        setFormState((prev) => ({
          ...prev,
          customerName,
          aboutWho: data.about_who || "",
          relationship: data.relationship || "",
          occasion: data.occasion || "",
          style: normalizeStyle(data.style) || "",
          vocalGender: data.vocal_gender || "",
          message: data.message || "",
        }));
        // Se editando quiz existente, restaurar letra do banco
        const approvedLyrics = typeof storedAnswers?.approved_lyrics === "string" ? storedAnswers.approved_lyrics : "";
        const approvedTitle = typeof storedAnswers?.approved_lyrics_title === "string" ? storedAnswers.approved_lyrics_title : "";
        if (approvedLyrics) {
          setStep(2);
          setLyricsTitle(approvedTitle);
          setLyricsText(approvedLyrics);
          setLyricsApproved(true);
        }
      }
    })();
  }, [mode, searchParams]);

  const handleFormChange = useCallback((updates: Partial<QuizFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100">
      <div className="px-4 sm:px-6 py-2 sm:py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900">Crie Sua Música Personalizada</h2>
        {mode === "modal" && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        )}
      </div>

      <div className="px-4 sm:px-6 pt-3 sm:pt-6">
        <QuizStepIndicator step={step} />
      </div>

      <div className="px-4 sm:px-6 py-4 sm:py-6">
        {errorMessage && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {step === 1 && (
          <QuizDetailsForm
            formState={formState}
            onFormChange={handleFormChange}
            onNext={handleNextFromDetails}
            isSaving={isSaving}
          />
        )}

        {step === 2 && (
          <QuizLyricsStep
            lyricsTitle={lyricsTitle}
            lyricsText={lyricsText}
            isGeneratingLyrics={isGeneratingLyrics}
            hasRejectedOnce={hasRejectedOnce}
            onTitleChange={setLyricsTitle}
            onTextChange={setLyricsText}
            onReject={handleRejectLyrics}
            onBack={() => {
              setHasRejectedOnce(false);
              setStep(1);
            }}
            onNext={handleGoToPayment}
          />
        )}

        {step === 3 && (
          <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-8 flex flex-col items-center justify-center gap-4 min-h-[200px]">
            {redirectError ? (
              <>
                <p className="text-sm text-red-600 text-center">{redirectError}</p>
                <button
                  type="button"
                  onClick={() => { setRedirectError(null); redirectStartedRef.current = false; setStep(2); }}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700"
                >
                  Voltar e tentar novamente
                </button>
              </>
            ) : (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-purple-600" aria-hidden />
                <p className="text-sm font-medium text-purple-700">Redirecionando para o pagamento...</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizCheckoutFlow;
