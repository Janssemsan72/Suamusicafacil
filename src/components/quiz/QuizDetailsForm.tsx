/**
 * Formulario de detalhes (Step 1) do fluxo Quiz -> Checkout.
 */
import { useCallback, useRef } from "react";
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

  const formRef = useRef<HTMLDivElement>(null);
  const textareaWrapperRef = useRef<HTMLDivElement>(null);

  const handleTextareaFocus = useCallback(() => {
    setTimeout(() => {
      textareaWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
  }, []);

  const syncAutofillAndSubmit = useCallback(() => {
    if (!formRef.current) { onNext(); return; }
    const inputs = formRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
    const patch: Partial<QuizFormState> = {};
    inputs.forEach((el) => {
      const name = el.getAttribute("name") as keyof QuizFormState | null;
      if (!name || !(name in formState)) return;
      const domVal = el.value;
      if (domVal && domVal !== formState[name]) {
        patch[name] = name === "whatsapp" ? formatPhoneInput(domVal) : domVal;
      }
    });
    if (Object.keys(patch).length > 0) {
      onFormChange(patch);
      setTimeout(onNext, 50);
    } else {
      onNext();
    }
  }, [formState, onFormChange, onNext]);

  return (
    <div ref={formRef} className="space-y-4 text-lg font-sans text-black">
      <div className="space-y-1">
        <label className={QUIZ_LABEL_CLASS}>
          Your Email <span className="text-red-500">*</span>
        </label>
        <Input
          name="email"
          value={formState.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="youremail@email.com"
          className={QUIZ_FIELD_CLASS}
          autoComplete="email"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={QUIZ_LABEL_CLASS}>
            Your Name <span className="text-red-500">*</span>
          </label>
          <Input
            name="customerName"
            value={formState.customerName}
            onChange={(e) => update("customerName", e.target.value)}
            placeholder="Your name"
            className={QUIZ_FIELD_CLASS}
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-1">
          <label className={QUIZ_LABEL_CLASS}>
            Your Phone <span className="text-red-500">*</span>
          </label>
          <Input
            name="whatsapp"
            value={formState.whatsapp}
            onChange={(e) => update("whatsapp", formatPhoneInput(e.target.value))}
            placeholder="+1 (555) 000-0000"
            className={QUIZ_FIELD_CLASS}
            required
            inputMode="numeric"
            autoComplete="tel"
            maxLength={15}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className={QUIZ_LABEL_CLASS}>
          Name of the person receiving the song <span className="text-red-500">*</span>
        </label>
        <Input
          name="aboutWho"
          value={formState.aboutWho}
          onChange={(e) => update("aboutWho", e.target.value)}
          className={QUIZ_FIELD_CLASS}
          autoComplete="off"
          required
        />
      </div>

      <div className="space-y-1">
        <label className={QUIZ_LABEL_CLASS}>
          Your Relationship <span className="text-red-500">*</span>
        </label>
        <select
          name="relationship"
          value={formState.relationship}
          onChange={(e) => update("relationship", e.target.value)}
          className={QUIZ_FIELD_CLASS}
          required
        >
          <option value="">Select</option>
          {RELATIONSHIP_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className={QUIZ_LABEL_CLASS}>
          Occasion <span className="text-red-500">*</span>
        </label>
        <select
          name="occasion"
          value={formState.occasion}
          onChange={(e) => update("occasion", e.target.value)}
          className={QUIZ_FIELD_CLASS}
          required
        >
          <option value="">Select</option>
          {OCCASION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className={QUIZ_LABEL_CLASS}>
          Musical Style <span className="text-red-500">*</span>
        </label>
        <select
          name="style"
          value={formState.style}
          onChange={(e) => update("style", e.target.value)}
          className={QUIZ_FIELD_CLASS}
          required
        >
          <option value="">Select</option>
          {STYLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className={QUIZ_LABEL_CLASS}>Voice that will sing</label>
        <div className="flex gap-6 text-lg text-gray-700">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="vocalGender"
              checked={formState.vocalGender === "m"}
              onChange={() => update("vocalGender", "m")}
              className="w-5 h-5 accent-purple-600"
            />
            Male
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="vocalGender"
              checked={formState.vocalGender === "f"}
              onChange={() => update("vocalGender", "f")}
              className="w-5 h-5 accent-purple-600"
            />
            Female
          </label>
        </div>
      </div>

      <div className="space-y-1" ref={textareaWrapperRef}>
        <label className={QUIZ_LABEL_CLASS}>
          Your Story/Message or Lyrics <span className="text-red-500">*</span>
        </label>
        <Textarea
          name="message"
          value={formState.message}
          onChange={(e) => update("message", e.target.value)}
          onFocus={handleTextareaFocus}
          placeholder="Tell us about your relationship, special memories, or what you'd like the song to convey..."
          className={`min-h-[140px] ${QUIZ_FIELD_CLASS}`}
          required
          maxLength={MESSAGE_MAX_LENGTH}
        />
        <p className="text-sm text-muted-foreground text-right">
          {formState.message.length}/{MESSAGE_MAX_LENGTH} characters
        </p>
      </div>

      <Button
        id="gtm-quiz-continue"
        onClick={syncAutofillAndSubmit}
        disabled={isSaving}
        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full py-3.5 text-lg font-semibold"
      >
        {isSaving ? "Continuing..." : "Continue"}
      </Button>
    </div>
  );
}
