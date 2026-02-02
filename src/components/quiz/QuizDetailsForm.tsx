/**
 * Formulario de detalhes (Step 1) do fluxo Quiz -> Checkout.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STYLE_OPTIONS } from "@/constants/musicStyles";
import { RELATIONSHIP_OPTIONS, OCCASION_OPTIONS, QUIZ_LABEL_CLASS, QUIZ_FIELD_CLASS } from "@/constants/quizCheckoutFlow";
import { formatPhoneInput } from "@/utils/quizCheckoutFlow";
import { MESSAGE_MAX_LENGTH } from "@/utils/quizValidation";

export type QuizFormState = {
  email: string;
  whatsapp: string;
  customerName: string;
  aboutWho: string;
  relationship: string;
  customRelationship: string;
  occasion: string;
  style: string;
  vocalGender: string;
  message: string;
};

type QuizDetailsFormProps = {
  formState: QuizFormState;
  onFormChange: (updates: Partial<QuizFormState>) => void;
  onNext: () => void;
  isSaving: boolean;
};

export function QuizDetailsForm({ formState, onFormChange, onNext, isSaving }: QuizDetailsFormProps) {
  const update = (key: keyof QuizFormState, value: string) =>
    onFormChange({ [key]: value });

  return (
    <div className="space-y-5 text-base font-sans text-black">
      <div className="space-y-2">
        <label className={QUIZ_LABEL_CLASS}>
          Seu Email <span className="text-red-500">*</span>
        </label>
        <Input
          value={formState.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="seuemail@email.com"
          className={QUIZ_FIELD_CLASS}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className={QUIZ_LABEL_CLASS}>
            Seu Nome <span className="text-red-500">*</span>
          </label>
          <Input
            value={formState.customerName}
            onChange={(e) => update("customerName", e.target.value)}
            placeholder="Seu nome"
            className={QUIZ_FIELD_CLASS}
            required
          />
        </div>
        <div className="space-y-2">
          <label className={QUIZ_LABEL_CLASS}>
            Seu Telefone <span className="text-red-500">*</span>
          </label>
          <Input
            value={formState.whatsapp}
            onChange={(e) => update("whatsapp", formatPhoneInput(e.target.value))}
            placeholder="(11) 99999-9999"
            className={QUIZ_FIELD_CLASS}
            required
            inputMode="numeric"
            autoComplete="tel"
            maxLength={15}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className={QUIZ_LABEL_CLASS}>
          Nome da pessoa que vai ganhar a musica <span className="text-red-500">*</span>
        </label>
        <Input
          value={formState.aboutWho}
          onChange={(e) => update("aboutWho", e.target.value)}
          className={QUIZ_FIELD_CLASS}
          required
        />
      </div>

      <div className="space-y-2">
        <label className={QUIZ_LABEL_CLASS}>
          Seu Relacionamento <span className="text-red-500">*</span>
        </label>
        <select
          value={formState.relationship}
          onChange={(e) => update("relationship", e.target.value)}
          className={QUIZ_FIELD_CLASS}
          required
        >
          <option value="">Selecione</option>
          {RELATIONSHIP_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className={QUIZ_LABEL_CLASS}>
          Ocasião <span className="text-red-500">*</span>
        </label>
        <select
          value={formState.occasion}
          onChange={(e) => update("occasion", e.target.value)}
          className={QUIZ_FIELD_CLASS}
          required
        >
          <option value="">Selecione</option>
          {OCCASION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className={QUIZ_LABEL_CLASS}>
          Estilo Musical <span className="text-red-500">*</span>
        </label>
        <select
          value={formState.style}
          onChange={(e) => update("style", e.target.value)}
          className={QUIZ_FIELD_CLASS}
          required
        >
          <option value="">Selecione</option>
          {STYLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className={QUIZ_LABEL_CLASS}>Voz que vai cantar</label>
        <div className="flex gap-6 text-gray-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="vocalGender"
              checked={formState.vocalGender === "m"}
              onChange={() => update("vocalGender", "m")}
            />
            Masculina
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="vocalGender"
              checked={formState.vocalGender === "f"}
              onChange={() => update("vocalGender", "f")}
            />
            Feminina
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <label className={QUIZ_LABEL_CLASS}>
          Sua História/Mensagem ou Letra <span className="text-red-500">*</span>
        </label>
        <Textarea
          value={formState.message}
          onChange={(e) => update("message", e.target.value)}
          placeholder="Conte-nos sobre seu relacionamento, memórias especiais ou o que você gostaria que a música transmitisse..."
          className={`min-h-[140px] ${QUIZ_FIELD_CLASS}`}
          required
          maxLength={MESSAGE_MAX_LENGTH}
        />
        <p className="text-xs text-muted-foreground text-right">
          {formState.message.length}/{MESSAGE_MAX_LENGTH} caracteres
        </p>
      </div>

      <Button
        onClick={onNext}
        disabled={isSaving}
        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full py-3 text-base"
      >
        {isSaving ? "Continuando..." : "Continuar"}
      </Button>
    </div>
  );
}
