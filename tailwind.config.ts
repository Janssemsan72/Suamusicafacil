import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  // ✅ OTIMIZAÇÃO: Content paths para purge CSS automático (Tailwind v3+ faz purge automático)
  // ✅ VERIFICADO: Configuração otimizada - inclui todos os arquivos relevantes para purge eficiente
  content: [
    "./src/**/*.{ts,tsx}",
    "!./src/__tests__/**",
    "./index.html"
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      padding: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          600: "hsl(var(--primary-600))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // CrieSuaMusica Purple/Pink Theme Colors
        purple: {
          DEFAULT: "#a78bfa",
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a78bfa",
          600: "#8b5cf6",
          700: "#7c3aed",
          800: "#6d28d9",
          900: "#5b21b6",
        },
        pink: {
          DEFAULT: "#ec4899",
          50: "#fdf2f8",
          100: "#fce7f3",
          200: "#fbcfe8",
          300: "#f9a8d4",
          400: "#f472b6",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
          800: "#9f1239",
          900: "#831843",
        },
        // Cream mapeado para roxo claro (para manter compatibilidade com classes existentes)
        cream: {
          DEFAULT: "#faf5ff",
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
        },
        // Terracotta mapeado para roxo/rosa (para manter compatibilidade com classes existentes)
        terracotta: {
          DEFAULT: "#a78bfa",
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a78bfa",
          600: "#8b5cf6",
          700: "#7c3aed",
          800: "#6d28d9",
          900: "#5b21b6",
        },
        // Brown-dark mapeado para roxo escuro (para manter compatibilidade com classes existentes)
        "brown-dark": {
          DEFAULT: "#4c1d95",
          50: "#8b5cf6",
          100: "#7c3aed",
          200: "#6d28d9",
          300: "#5b21b6",
          400: "#4c1d95",
        },
        // Brown-medium mapeado para roxo médio
        "brown-medium": {
          DEFAULT: "#8b5cf6",
          light: "#a78bfa",
        },
        // Admin Theme Colors - Purple/Pink
        "admin-primary": {
          DEFAULT: "#a78bfa",
          dark: "#8b5cf6",
          light: "#c084fc",
        },
        "admin-secondary": {
          DEFAULT: "#8b5cf6",
          dark: "#7c3aed",
          light: "#a78bfa",
        },
        "admin-success": "#10B981",
        "admin-warning": "#F59E0B",
        "admin-error": "#EF4444",
        "admin-bg": "#ffffff",
        "admin-card": "#ffffff",
        "admin-border": "#e9d5ff",
        "admin-text": "#4c1d95",
        "admin-text-muted": "#8b5cf6",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
        'medium': 'var(--shadow-medium)',
      },
      backgroundImage: {
        'gradient-hero': 'var(--gradient-hero)',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "admin-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "admin-slide-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "admin-slide-in-down": {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "admin-slide-in-left": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "admin-slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "admin-scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "admin-ripple": {
          "0%": { transform: "scale(0)", opacity: "1" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
        "admin-shimmer": {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "admin-pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(167, 139, 250, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(167, 139, 250, 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "admin-fade-in": "admin-fade-in 0.3s ease-out",
        "admin-slide-in-up": "admin-slide-in-up 0.3s ease-out",
        "admin-slide-in-down": "admin-slide-in-down 0.3s ease-out",
        "admin-slide-in-left": "admin-slide-in-left 0.3s ease-out",
        "admin-slide-in-right": "admin-slide-in-right 0.3s ease-out",
        "admin-scale-in": "admin-scale-in 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "admin-ripple": "admin-ripple 0.6s ease-out",
        "admin-shimmer": "admin-shimmer 2s infinite",
        "admin-pulse-glow": "admin-pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
