/**
 * Step 2 do fluxo Quiz → Checkout: visualização e aprovação da letra gerada.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LYRICS_MAX_LENGTH, LYRICS_TITLE_MAX_LENGTH } from "@/utils/quizValidation";

type QuizLyricsStepProps = {
  lyricsTitle: string;
  lyricsText: string;
  isGeneratingLyrics: boolean;
  hasRejectedOnce: boolean;
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
  onTitleChange,
  onTextChange,
  onReject,
  onBack,
  onNext,
}: QuizLyricsStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {isGeneratingLyrics && !lyricsText ? "Gerando sua letra..." : "Sua letra ficou pronta. Ajuste se quiser."}
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
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!lyricsText.trim()}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-6"
        >
          Ir para pagamento
        </Button>
      </div>
    </div>
  );
}
