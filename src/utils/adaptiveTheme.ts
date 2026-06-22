import type { CSSProperties } from 'react';
import type { ThemeConfig } from '@/types';

function parseHexColor(color?: string) {
  if (!color || !color.startsWith('#')) return null;
  const hex = color.slice(1);
  const normalized = hex.length === 3
    ? hex.split('').map(char => char + char).join('')
    : hex;
  if (normalized.length !== 6) return null;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}
export function isDarkTheme(theme: ThemeConfig) {
  const rgb = parseHexColor(theme.bg);
  if (!rgb) return theme.bgCard.includes('rgba') || theme.textPrimary.toLowerCase() === '#f8fafc';
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance < 0.36;
}

export function alpha(color: string | undefined, fallback: string) {
  if (!color) return fallback;
  return color;
}

export function getAdaptiveSurface(theme: ThemeConfig, level: 'base' | 'raised' | 'strong' = 'base'): CSSProperties {
  const dark = isDarkTheme(theme);
  const backgroundColor = dark
    ? level === 'strong'
      ? theme.surfaceContainerHigh || 'rgba(35,48,74,0.92)'
      : level === 'raised'
        ? theme.bgCard || 'rgba(20,31,51,0.82)'
        : theme.surfaceContainerLow || 'rgba(23,32,51,0.78)'
    : level === 'strong'
      ? theme.surfaceContainerLowest || theme.bgCard || '#ffffff'
      : theme.bgCard || '#ffffff';

  return {
    backgroundColor,
    borderColor: theme.border,
    color: dark ? theme.textPrimary : theme.textPrimary,
  };
}

export function getAdaptiveButton(theme: ThemeConfig, variant: 'primary' | 'secondary' | 'ghost' = 'secondary'): CSSProperties {
  const dark = isDarkTheme(theme);
  if (variant === 'primary') {
    return {
      backgroundColor: theme.primary,
      color: dark ? '#08111f' : '#ffffff',
      borderColor: 'transparent',
      boxShadow: dark ? `0 14px 30px ${theme.primary}24` : `0 12px 24px ${theme.primary}26`,
    };
  }
  if (variant === 'ghost') {
    return {
      backgroundColor: dark ? 'rgba(148,163,184,0.10)' : 'rgba(255,255,255,0.56)',
      color: theme.textSecondary,
      borderColor: dark ? 'rgba(148,163,184,0.18)' : theme.border,
    };
  }
  return {
    backgroundColor: dark ? theme.surfaceContainerHigh || 'rgba(35,48,74,0.88)' : theme.bgCard,
    color: theme.textPrimary,
    borderColor: theme.border,
    boxShadow: dark ? 'none' : '0 10px 24px rgba(15,23,42,0.08)',
  };
}

export function getAdaptiveNav(theme: ThemeConfig): CSSProperties {
  const dark = isDarkTheme(theme);
  return {
    backgroundColor: dark ? 'rgba(11,17,32,0.86)' : 'rgba(255,255,255,0.68)',
    borderColor: dark ? 'rgba(148,163,184,0.18)' : theme.border,
    color: dark ? theme.textPrimary : theme.textPrimary,
    boxShadow: dark ? '0 -12px 32px rgba(0,0,0,0.24)' : '0 -8px 24px -4px rgba(15,23,42,0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  };
}

export function getAdaptivePageBackground(theme: ThemeConfig): CSSProperties {
  const dark = isDarkTheme(theme);
  return {
    background: dark
      ? `radial-gradient(circle at 50% 0%, ${theme.primaryFixed || '#1e3a5f'}66 0%, transparent 34%), ${theme.bg}`
      : theme.bg,
    color: theme.textPrimary,
  };
}
