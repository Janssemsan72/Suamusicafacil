import { useState, useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// ✅ OTIMIZAÇÃO CRÍTICA: Lazy load de next-themes - carregar apenas quando necessário
// Como Sonner já é lazy loaded, next-themes também será carregado apenas quando Sonner for usado
const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<ToasterProps["theme"]>("system");

  // Lazy load next-themes apenas quando componente for montado
  useEffect(() => {
    let mounted = true;
    
    const loadTheme = async () => {
      try {
        // ✅ OTIMIZAÇÃO: Lazy load de next-themes apenas quando necessário
        // Como não há ThemeProvider no App, vamos ler do localStorage diretamente
        if (typeof window !== 'undefined' && window.localStorage) {
          // next-themes armazena o theme em localStorage com a chave 'theme'
          const storedTheme = localStorage.getItem('theme');
          if (storedTheme && mounted) {
            setTheme(storedTheme as ToasterProps["theme"]);
            return;
          }
        }
        
        // Se não há theme armazenado, verificar preferência do sistema
        if (mounted && typeof window !== 'undefined' && window.matchMedia) {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setTheme(prefersDark ? "dark" : "light");
        } else if (mounted) {
          setTheme("system");
        }
      } catch (error) {
        // Fallback: usar theme system se houver erro
        if (mounted) {
          setTheme("system");
        }
      }
    };

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Sonner
      theme={theme}
      position="top-right"
      className="toaster group"
      offset="60px"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg !py-2 !px-3 !text-sm !min-h-[auto] !max-w-[320px]",
          description: "group-[.toast]:text-muted-foreground !text-xs !mt-0.5",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground !h-6 !text-xs !px-2",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground !h-6 !text-xs !px-2",
          title: "!text-sm !font-medium !leading-tight",
        },
        style: {
          padding: "8px 12px",
          fontSize: "14px",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
