/**
 * Constantes do Header - extraídas para reutilização e manutenção.
 */
export type NavItem = {
  id: string;
  label: string;
  sectionId?: string;
  path?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "testimonials", label: "Depoimentos", sectionId: "testimonials" },
];

export const MONTH_BANNER_COPY: Record<number, string> = {
  0: "Promoção de Janeiro: comece o ano presenteando com uma música personalizada.",
  1: "Promoção de Fevereiro: surpreenda com uma música romântica e inesquecível.",
  2: "Promoção de Março: celebre cada conquista com uma canção especial.",
  3: "Promoção de Abril: emocione quem você ama com uma música personalizada.",
  4: "Promoção de Maio: homenageie quem cuidou de você com uma canção única.",
  5: "Promoção de Junho: o mês dos namorados merece uma música feita para vocês.",
  6: "Promoção de Julho: transforme memórias das férias em música.",
  7: "Promoção de Agosto: agradeça com uma canção que toca o coração.",
  8: "Promoção de Setembro: renove os sentimentos com uma música sob medida.",
  9: "Promoção de Outubro: celebre histórias incríveis com uma canção exclusiva.",
  10: "Promoção de Novembro: presenteie com emoção antes das festas.",
  11: "Promoção de Dezembro: feche o ano com uma música inesquecível.",
};

const DEFAULT_BANNER = "Transforme seus sentimentos em música.";

export function getMonthlyBannerCopy(): string {
  return MONTH_BANNER_COPY[new Date().getMonth()] ?? DEFAULT_BANNER;
}
