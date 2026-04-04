import type { ProficiencyLevel } from '@/types';
import { PROFICIENCY_MAP } from '@/types';
import { useTheme } from '@/store/ThemeContext';

export function ProficiencyBadge({ level }: { level: ProficiencyLevel }) {
  const config = PROFICIENCY_MAP[level];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105"
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      {config.label}
    </span>
  );
}

export function PageHeader({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}) {
  const { theme, isDark } = useTheme();
  
  return (
    <div className="sticky top-0 z-40 backdrop-blur-sm border-b transition-all duration-300" style={{ 
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: theme.border
    }}>
      <div className="flex items-center justify-between h-12 px-4">
        <div className="w-16">
          {onBack && (
            <button 
              onClick={onBack} 
              className="text-text-secondary text-sm flex items-center gap-1 transition-all duration-200 hover:text-primary active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              返回
            </button>
          )}
        </div>

        <h1 className="text-base font-semibold text-text-primary">{title}</h1>

        <div className="w-16 flex justify-end">{rightAction}</div>

      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 animate-fade-in">
      <div className="text-5xl mb-4 animate-scale-in">{icon}</div>
      <p className="text-text-secondary font-medium animate-slide-out">{title}</p>
      {description && <p className="text-text-muted text-sm mt-1 animate-slide-out" style={{ animationDelay: '0.2s' }}>{description}</p>}
    </div>
  );
}

export function ProgressBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}>
      <div 
        className={`h-full rounded-full transition-all duration-800 ease-out ${color}`} 
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const { theme, isDark } = useTheme();
  
  return (
    <div 
      className="rounded-xl p-3 text-center border transition-all duration-300 hover:shadow-md active:scale-98"
      style={{ 
        backgroundColor: theme.bgCard,
        borderColor: theme.border,
        boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div className={`text-xl font-bold ${color ?? 'text-primary'}`}>{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

// 按钮组件
export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  
  const sizeClasses = {
    small: 'py-1.5 px-3 text-sm',
    medium: 'py-2.5 px-4 text-base',
    large: 'py-3 px-6 text-lg'
  };
  
  const variantStyles = {
    primary: {
      backgroundColor: theme.primary,
      color: 'white',
      border: 'none',
      hoverBg: theme.primaryLight
    },
    secondary: {
      backgroundColor: theme.secondary,
      color: 'white',
      border: 'none',
      hoverBg: theme.secondaryLight
    },
    outline: {
      backgroundColor: 'transparent',
      color: theme.primary,
      border: `1px solid ${theme.primary}`,
      hoverBg: `${theme.primary}15`
    },
    ghost: {
      backgroundColor: 'transparent',
      color: theme.textPrimary,
      border: 'none',
      hoverBg: `${theme.textPrimary}10`
    }
  };
  
  const style = variantStyles[variant];
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${sizeClasses[size]}`}
      style={{
        backgroundColor: disabled ? 'rgba(0, 0, 0, 0.1)' : style.backgroundColor,
        color: disabled ? 'rgba(0, 0, 0, 0.4)' : style.color,
        border: style.border,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = style.hoverBg;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = style.backgroundColor;
        }
      }}
    >
      {children}
    </button>
  );
}

// 输入框组件
export function Input({
  placeholder,
  value,
  onChange,
  type = 'text',
  size = 'medium',
  disabled = false,
}: {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  
  const sizeClasses = {
    small: 'py-1.5 px-3 text-sm',
    medium: 'py-2.5 px-4 text-base',
    large: 'py-3 px-6 text-lg'
  };
  
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`w-full rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${sizeClasses[size]}`}
      style={{
        backgroundColor: theme.bgCard,
        borderColor: theme.border,
        color: theme.textPrimary,
        cursor: disabled ? 'not-allowed' : 'text'
      }}
    />
  );
}

// 卡片组件
export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { theme, isDark } = useTheme();
  
  return (
    <div 
      className={`rounded-2xl border p-4 transition-all duration-300 hover:shadow-md ${className}`}
      style={{
        backgroundColor: theme.bgCard,
        borderColor: theme.border,
        boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
    >
      {children}
    </div>
  );
}

