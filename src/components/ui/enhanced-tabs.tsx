import React from "react";
import { cn } from "@/lib/utils";

interface EnhancedTabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "pills" | "underline" | "modern";
  size?: "sm" | "md" | "lg";
}

interface EnhancedTabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface EnhancedTabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

interface EnhancedTabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const EnhancedTabsContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  variant?: "default" | "pills" | "underline" | "modern";
  size?: "sm" | "md" | "lg";
}>({});

export function EnhancedTabs({ 
  defaultValue, 
  value, 
  onValueChange, 
  children, 
  className,
  variant = "modern",
  size = "md"
}: EnhancedTabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "");
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const currentValue = value !== undefined ? value : internalValue;
  
  // ✅ AUDITORIA: Log removido em produção (mantido apenas para debug se necessário)
  // React.useEffect(() => {
  //   if (defaultValue === 'pending' || currentValue === 'pending') {
  //     console.log('🎯 [EnhancedTabs] Estado das abas:', {
  //       defaultValue,
  //       value,
  //       internalValue,
  //       currentValue
  //     });
  //   }
  // }, [defaultValue, value, internalValue, currentValue]);
  
  const handleValueChange = React.useCallback((newValue: string) => {
    // Verificar se o container ainda existe antes de atualizar
    if (containerRef.current && containerRef.current.isConnected) {
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    }
  }, [value, onValueChange]);

  return (
    <EnhancedTabsContext.Provider value={{ 
      value: currentValue, 
      onValueChange: handleValueChange,
      variant,
      size
    }}>
      <div ref={containerRef} className={cn("w-full", className)}>
        {children}
      </div>
    </EnhancedTabsContext.Provider>
  );
}

export function EnhancedTabsList({ children, className }: EnhancedTabsListProps) {
  const { variant = "modern", size = "md" } = React.useContext(EnhancedTabsContext);
  
  const baseClasses = "inline-flex items-center justify-center";
  
  const variantClasses = {
    default: "h-10 rounded-md bg-muted p-1 text-muted-foreground",
    pills: "h-10 rounded-full bg-muted p-1 text-muted-foreground",
    underline: "h-10 border-b border-border bg-transparent p-0 text-muted-foreground",
    modern: "h-14 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 p-1.5 text-amber-800 border border-amber-200 shadow-sm"
  };
  
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm", 
    lg: "text-base"
  };
  
  return (
    <div className={cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  );
}

export function EnhancedTabsTrigger({ 
  value, 
  children, 
  className, 
  disabled = false,
  icon,
  badge
}: EnhancedTabsTriggerProps) {
  const { value: currentValue, onValueChange, variant = "modern", size = "md" } = React.useContext(EnhancedTabsContext);
  
  const isActive = currentValue === value;
  
  const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variantClasses = {
    default: cn(
      "px-3 py-1.5",
      isActive && "bg-background text-foreground shadow-sm"
    ),
    pills: cn(
      "px-4 py-2 rounded-full",
      isActive && "bg-background text-foreground shadow-sm"
    ),
    underline: cn(
      "px-4 py-2 border-b-2 border-transparent",
      isActive && "border-primary text-primary"
    ),
    modern: cn(
      "px-8 py-3 rounded-md transition-all duration-200 flex items-center gap-2 font-semibold text-base",
      isActive 
        ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg transform scale-105" 
        : "hover:bg-amber-100 hover:text-amber-900 hover:shadow-md"
    )
  };
  
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-2",
    lg: "text-base px-8 py-3"
  };
  
  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      onClick={() => !disabled && onValueChange?.(value)}
      disabled={disabled}
      role="tab"
      aria-selected={isActive}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
      {badge && <span className="ml-1 flex-shrink-0">{badge}</span>}
    </button>
  );
}

export function EnhancedTabsContent({ 
  value, 
  children, 
  className 
}: EnhancedTabsContentProps) {
  const { value: currentValue } = React.useContext(EnhancedTabsContext);
  const [isMounted, setIsMounted] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  
  // ✅ AUDITORIA: Log removido em produção
  const isActive = currentValue === value;
  // if (value === 'pending') {
  //   console.log('🎯 [EnhancedTabsContent] Aba "pending":', {
  //     currentValue,
  //     value,
  //     isActive,
  //     isMounted
  //   });
  // }
  
  // Usar useEffect para garantir que o DOM está pronto antes de renderizar
  React.useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);
  
  // Se não está montado ou não é a aba ativa, retornar div vazio ao invés de null
  // Isso evita problemas de removeChild quando o React tenta limpar o DOM
  if (!isMounted || !isActive) {
    // ✅ AUDITORIA: Log removido em produção
    // if (value === 'pending' && !isActive) {
    //   console.warn('⚠️ [EnhancedTabsContent] Aba "pending" NÃO está ativa!', {
    //     currentValue,
    //     value,
    //     isMounted
    //   });
    // }
    return (
      <div 
        ref={contentRef}
        className="hidden"
        role="tabpanel"
        aria-hidden="true"
        style={{ display: 'none' }}
      />
    );
  }
  
  return (
    <div 
      ref={contentRef}
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      role="tabpanel"
      aria-hidden="false"
    >
      {children}
    </div>
  );
}
