/**
 * Step 2 do fluxo Quiz → Checkout: visualização e aprovação da letra gerada.
 */
import { useState, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Star, CheckCircle } from "@/lib/icons";
import { Image } from "@/components/ui/Image";
import { useTestimonials } from "@/hooks/use-testimonials";
import { LYRICS_MAX_LENGTH, LYRICS_TITLE_MAX_LENGTH } from "@/utils/quizValidation";

type QuizLyricsStepProps = {
  lyricsTitle: string;
  lyricsText: string;
  isGeneratingLyrics: boolean;
  hasRejectedOnce: boolean;
  paymentUrl?: string;
  onTitleChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onReject: () => void;
  onBack: () => void;
  onNext: () => void;
};

export function QuizLyricsStep({
  lyricsTitle,
  lyricsText,
  isGeneratingLyrics,
  hasRejectedOnce,
  paymentUrl,
  onTitleChange,
  onTextChange,
  onReject,
  onBack,
  onNext,
}: QuizLyricsStepProps) {
  const { data: testimonialsData } = useTestimonials();
  const textTestimonials = testimonialsData?.text || [];
  
  // Mostrar loading com testemunhos quando estiver gerando e não tiver letra ainda
  const showLoadingState = isGeneratingLyrics && !lyricsText;
  
  // Estado para controlar a lista de depoimentos exibidos (rolagem vertical)
  const [displayedTestimonials, setDisplayedTestimonials] = useState<Array<typeof textTestimonials[0] & { uniqueKey: string }>>([]);
  
  // Usar todos os depoimentos disponíveis (mínimo 20 esperado)
  const availableTestimonials = textTestimonials.length > 0 ? textTestimonials : [];
  
  // Efeito para adicionar novos depoimentos que sobem (scroll up)
  useEffect(() => {
    if (!showLoadingState || availableTestimonials.length === 0) {
      setDisplayedTestimonials([]);
      return;
    }
    
    // No mobile mostramos 2 por vez; inicializar com os primeiros 2
    const count = 2;
    const initial = availableTestimonials.slice(0, Math.min(count, availableTestimonials.length)).map((t, idx) => ({
      ...t,
      uniqueKey: `${t.id}-${idx}-initial`
    }));
    setDisplayedTestimonials(initial);
    
    let currentIndex = count;
    
    const interval = setInterval(() => {
      if (currentIndex >= availableTestimonials.length) {
        // Se chegou ao fim, reiniciar do início
        currentIndex = 0;
      }
      
      // Pegar o próximo depoimento único
      const nextTestimonial = availableTestimonials[currentIndex];
      
      if (nextTestimonial) {
        setDisplayedTestimonials((prev) => {
          // Adicionar novo no final e remover o primeiro (efeito de scroll up)
          const newList = [...prev.slice(1), {
            ...nextTestimonial,
            uniqueKey: `${nextTestimonial.id}-${currentIndex}-${Date.now()}`
          }];
          return newList;
        });
        
        currentIndex++;
      }
    }, 2500); // Adiciona novo depoimento a cada 2.5 segundos
    
    return () => clearInterval(interval);
  }, [showLoadingState, availableTestimonials.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {showLoadingState ? "Gerando sua letra..." : "Sua letra ficou pronta. Ajuste se quiser."}
          </p>
          {hasRejectedOnce && (
            <p className="text-xs text-amber-600 mt-1">Você já solicitou uma nova letra.</p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={onReject}
          disabled={isGeneratingLyrics || hasRejectedOnce}
        >
          {isGeneratingLyrics ? "Gerando..." : "Reprovar"}
        </Button>
      </div>

      {showLoadingState ? (
        <>
          {/* Mobile: loading com provas sociais (2 depoimentos por vez) */}
          <div className="md:hidden flex flex-col items-center py-4">
            <div className="flex flex-col items-center space-y-2 flex-shrink-0">
              <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
              <p className="text-sm font-medium text-gray-700">Criando sua letra personalizada...</p>
            </div>
            {displayedTestimonials.length > 0 && (
              <div className="w-full max-w-2xl flex flex-col mt-3">
                <p className="text-sm text-gray-500 text-center mb-2 flex-shrink-0">
                  Veja o que nossos clientes estão dizendo:
                </p>
                <div className="space-y-3">
                  {displayedTestimonials.slice(0, 2).map((testimonial) => (
                    <div
                      key={testimonial.uniqueKey}
                      className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 animate-slide-in-up"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                          <Image
                            src={testimonial.avatar_url || `https://i.pravatar.cc/48?u=${testimonial.id}`}
                            alt=""
                            className="w-full h-full object-cover"
                            width={48}
                            height={48}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-2">
                            {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" aria-hidden="true" />
                            ))}
                          </div>
                          <p className="text-sm text-gray-700 italic mb-2" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {testimonial.content}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" aria-hidden="true" />
                            <span className="text-xs text-gray-500">Verificado</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Desktop: apenas spinner, sem provas sociais */}
          <div className="hidden md:flex h-[280px] flex-col items-center justify-center py-4">
            <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
            <p className="text-sm font-medium text-gray-700 mt-2">Criando sua letra personalizada...</p>
          </div>
        </>
      ) : (
        /* Formulário Normal */
        <>
          <Input
            value={lyricsTitle}
            onChange={(e) => onTitleChange(e.target.value.slice(0, LYRICS_TITLE_MAX_LENGTH))}
            placeholder="Título da música"
            disabled={isGeneratingLyrics && !lyricsText}
            maxLength={LYRICS_TITLE_MAX_LENGTH}
          />
          <p className="text-xs text-muted-foreground text-right">
            {lyricsTitle.length}/{LYRICS_TITLE_MAX_LENGTH} caracteres
          </p>
          <Textarea
            value={lyricsText}
            onChange={(e) => onTextChange(e.target.value.slice(0, LYRICS_MAX_LENGTH))}
            placeholder="Letra gerada"
            className="min-h-[360px]"
            disabled={isGeneratingLyrics && !lyricsText}
            maxLength={LYRICS_MAX_LENGTH}
          />
          <p className="text-xs text-muted-foreground text-right">
            {lyricsText.length}/{LYRICS_MAX_LENGTH} caracteres
          </p>
        </>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        {paymentUrl && lyricsText.trim() ? (
          <a
            href={paymentUrl}
            id="gtm-go-to-payment"
            data-cta="checkout"
            data-cta-id="cta-quiz-payment"
            className={`gtm-link ${buttonVariants({ variant: "default", size: "default" })} rounded-full px-6`}
            onClick={(e) => {
              e.preventDefault();
              onNext();
              setTimeout(() => { window.location.href = paymentUrl; }, 200);
            }}
          >
            Ir para pagamento
          </a>
        ) : (
          <Button
            disabled
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-6 opacity-50"
          >
            Ir para pagamento
          </Button>
        )}
      </div>
    </div>
  );
}
