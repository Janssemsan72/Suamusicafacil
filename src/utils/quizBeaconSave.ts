/**
 * Salva quiz pendente via sendBeacon antes do unload.
 * Extraído de main.tsx para manter main.tsx enxuto.
 */
export function setupQuizBeaconSave(): void {
  if (typeof window === "undefined") return;

  window.addEventListener(
    "beforeunload",
    () => {
      try {
        const pendingQuiz = localStorage.getItem("pending_quiz");
        if (!pendingQuiz) return;

        const quiz = JSON.parse(pendingQuiz);
        const sessionId = quiz.session_id || quiz.answers?.session_id;
        if (!sessionId || !navigator.sendBeacon) return;

        const quizData = {
          session_id: sessionId,
          about_who: quiz.about_who,
          relationship: quiz.relationship,
          style: quiz.style,
          language: quiz.language || "pt",
          vocal_gender: quiz.vocal_gender || null,
          qualities: quiz.qualities,
          memories: quiz.memories,
          message: quiz.message || null,
          key_moments: quiz.key_moments,
          occasion: quiz.occasion || null,
          desired_tone: quiz.desired_tone || null,
          answers: quiz.answers || {},
          customer_email: quiz.customer_email || null,
          customer_whatsapp: quiz.customer_whatsapp || null,
        };

        const blob = new Blob([JSON.stringify(quizData)], { type: "application/json" });
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
        navigator.sendBeacon(`${supabaseUrl}/functions/v1/quiz-beacon-save`, blob);
      } catch {
        // Ignorar erros silenciosamente
      }
    },
    { passive: true }
  );
}
