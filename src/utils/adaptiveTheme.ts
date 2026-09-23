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

function colorWithAlpha(color: string | undefined, opacity: number, fallback: string) {
  if (!color) return fallback;

  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const normalized = hex.length === 3
      ? hex.split('').map(char => char + char).join('')
      : hex;
    const value = Number.parseInt(normalized, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const rgba = color.trim().match(/^rgba\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(',').map(part => part.trim());
    if (parts.length >= 3) return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`;
  }

  const rgb = color.trim().match(/^rgb\(([^)]+)\)$/i);
  if (rgb) return `rgba(${rgb[1]}, ${opacity})`;

  return fallback;
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

export function adaptiveAlpha(color: string | undefined, opacity: number, fallback: string) {
  return colorWithAlpha(color, opacity, fallback);
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
    backgroundColor: colorWithAlpha(backgroundColor, dark ? 0.84 : 0.86, backgroundColor),
    borderColor: colorWithAlpha(theme.border, dark ? 0.42 : 0.52, theme.border),
    color: dark ? theme.textPrimary : theme.textPrimary,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  };
}

export function getAdaptiveInput(theme: ThemeConfig): CSSProperties {
  const dark = isDarkTheme(theme);
  return {
    backgroundColor: colorWithAlpha(
      dark ? theme.surfaceContainerLow || theme.bgCard : theme.surfaceContainerLowest || theme.bgCard,
      dark ? 0.68 : 0.82,
      dark ? 'rgba(15,23,42,0.56)' : 'rgba(255,255,255,0.82)',
    ),
    borderColor: colorWithAlpha(theme.border, dark ? 0.46 : 0.58, theme.border),
    color: theme.textPrimary,
  };
}

export function getAdaptiveSoftSurface(theme: ThemeConfig, tint?: string): CSSProperties {
  const dark = isDarkTheme(theme);
  const base = tint || (dark ? theme.surfaceContainerHigh : theme.surfaceContainerLow);
  return {
    backgroundColor: colorWithAlpha(base, dark ? 0.24 : 0.42, dark ? 'rgba(148,163,184,0.12)' : 'rgba(248,250,252,0.76)'),
    borderColor: colorWithAlpha(tint || theme.border, dark ? 0.32 : 0.34, theme.border),
    color: theme.textPrimary,
  };
}

export function getAdaptiveBadge(theme: ThemeConfig, tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' = 'neutral'): CSSProperties {
  const dark = isDarkTheme(theme);
  const toneColor = tone === 'primary'
    ? theme.primary
    : tone === 'success'
      ? theme.success
      : tone === 'warning'
        ? theme.warning
        : tone === 'danger'
          ? theme.danger
          : theme.textMuted;

  return {
    backgroundColor: colorWithAlpha(toneColor, dark ? 0.18 : 0.12, dark ? 'rgba(148,163,184,0.14)' : 'rgba(148,163,184,0.12)'),
    borderColor: colorWithAlpha(toneColor, dark ? 0.26 : 0.20, dark ? 'rgba(148,163,184,0.24)' : 'rgba(148,163,184,0.18)'),
    color: tone === 'neutral' ? theme.textSecondary : toneColor,
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
