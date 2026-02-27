/**
 * Constantes do QuizCheckoutFlow - extraídas para reutilização e manutenção.
 */
export const STEP_LABELS = ["Detalhes", "Letra da Música", "Pagamento"] as const;

export const RELATIONSHIP_OPTIONS = [
  "Esposo",
  "Esposa",
  "Filho",
  "Filha",
  "Pai",
  "Mãe",
  "Irmão",
  "Amigo",
  "Eu mesmo",
  "Outro (Descreva na sua historia)",
];

export const OCCASION_OPTIONS = [
  "Aniversário",
  "Casamento",
  "Pedido de casamento",
  "Noivado",
  "Agradecimento",
  "Outro (Descreva na sua historia)",
];

/** Classes CSS reutilizáveis para campos do formulário do quiz */
export const QUIZ_LABEL_CLASS = "block text-lg font-medium font-sans text-black mb-1";
export const QUIZ_FIELD_CLASS =
  "w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-normal font-sans text-black placeholder:text-black/40 focus:ring-2 focus:ring-purple-500 focus:border-purple-500";
