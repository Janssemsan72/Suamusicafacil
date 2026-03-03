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
  { id: "testimonials", label: "Testimonials", sectionId: "testimonials" },
];

export const MONTH_BANNER_COPY: Record<number, string> = {
  0: "January Special: Start the year by gifting a personalized song.",
  1: "February Special: Surprise someone with a romantic, unforgettable song.",
  2: "March Special: Celebrate every achievement with a special song.",
  3: "April Special: Move the ones you love with a personalized song.",
  4: "May Special: Honor those who cared for you with a unique song.",
  5: "June Special: Romance month deserves a song made just for you.",
  6: "July Special: Transform your vacation memories into music.",
  7: "August Special: Say thank you with a song that touches the heart.",
  8: "September Special: Renew your feelings with a tailor-made song.",
  9: "October Special: Celebrate incredible stories with an exclusive song.",
  10: "November Special: Gift with emotion before the holidays.",
  11: "December Special: Close the year with an unforgettable song.",
};

const DEFAULT_BANNER = "Transform your feelings into music.";

export function getMonthlyBannerCopy(): string {
  return MONTH_BANNER_COPY[new Date().getMonth()] ?? DEFAULT_BANNER;
}
