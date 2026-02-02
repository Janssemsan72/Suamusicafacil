/**
 * Utilitários do QuizCheckoutFlow - extraídos para reutilização e manutenção.
 */
import { STYLE_OPTIONS } from "@/constants/musicStyles";

export function normalizeStyle(value?: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  const match = STYLE_OPTIONS.find((option) => option.value === trimmed || option.label === trimmed);
  return match ? match.value : trimmed;
}

export function parseAnswers(answers: unknown): Record<string, unknown> | null {
  if (!answers) return null;
  if (typeof answers === "string") {
    try {
      return JSON.parse(answers) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return answers as Record<string, unknown>;
}

export function formatPhoneInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 11);
  if (digitsOnly.length <= 2) return digitsOnly;
  if (digitsOnly.length <= 6) {
    return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2)}`;
  }
  if (digitsOnly.length <= 10) {
    return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
  }
  return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7)}`;
}

export function formatLyricsFromVerses(
  title: string,
  verses: Array<{ type: string; text: string }>
): { title: string; text: string } {
  const safeTitle = title?.trim() || "Sua música personalizada";
  const body = verses
    .filter((verse) => verse?.type && verse?.text)
    .map((verse) => `[${verse.type}]\n${verse.text}`)
    .join("\n\n");
  return { title: safeTitle, text: body };
}
