import React from "react";
import { LucideIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export const ADMIN_CARD_COLORS = {
  primary: '#a78bfa',    // Receita style - roxo
  secondary: '#8b5cf6',  // Secundário - roxo escuro
  tertiary: '#c084fc',   // Hotmart style - roxo claro
  quaternary: '#7c3aed', // Pedidos style - roxo médio
  quinary: '#ec4899',    // Conversao style - rosa
  senary: '#db2777',     // Creditos style - rosa escuro
  // Additional colors to support legacy usages or specific UI needs
  blue: '#3b82f6',
  teal: '#14b8a6',
  indigo: '#6366f1',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  purple: '#a78bfa',
  gray: '#6b7280'
} as const;

interface SolidStatCardProps {
  title: string;
  value: string | number | React.ReactNode;
  icon: LucideIcon;
  color: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  testId?: string;
  loading?: boolean;
}

export function SolidStatCard({
  title,
  value,
  icon: Icon,
  color,
  description,
  action,
  className,
  testId,
  loading = false
}: SolidStatCardProps) {
  const cardStyle: React.CSSProperties = {
    backgroundColor: color,
    border: 'none',
    borderRadius: '20px',
    padding: '1.5rem 1.75rem',
    boxShadow: `0 1px 3px ${color}30, 0 4px 12px ${color}25, 0 8px 24px ${color}15`,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'default', // Changed from pointer since not all are clickable
    color: '#ffffff',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.boxShadow = `0 1px 3px ${color}40, 0 8px 16px ${color}35, 0 16px 32px ${color}20`;
    e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.boxShadow = `0 1px 3px ${color}30, 0 4px 12px ${color}25, 0 8px 24px ${color}15`;
    e.currentTarget.style.transform = 'translateY(0) scale(1)';
  };

  if (loading) {
    return (
      <div 
        data-testid={testId}
        style={{ 
          backgroundColor: color,
          borderRadius: '20px',
          padding: '1.5rem',
          minHeight: '180px',
          height: '100%'
        }}
        className={cn("animate-pulse", className)}
      >
        <div className="h-4 bg-white/20 rounded w-1/2 mb-4" />
        <div className="h-12 bg-white/20 rounded w-3/4 mb-6" />
        <div className="h-4 bg-white/20 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      style={cardStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn("admin-hover-lift", className)}
    >
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-[0.8125rem] font-semibold uppercase tracking-wider text-white/95">
          {title}
        </h3>
        {action}
      </div>
      
      <div className="mb-6">
        <div className="text-[2.5rem] font-bold text-white leading-tight tracking-tight">
          {value}
        </div>
      </div>
      
      <div className="flex items-center gap-3 text-white/95">
        <Icon className="w-[1.125rem] h-[1.125rem] opacity-90" />
        <span className="text-sm font-medium">{description}</span>
      </div>
    </div>
  );
}
