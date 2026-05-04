/**
 * ============================================================================
 * 悬浮 AI 助手按钮 (Floating AI Panel)
 * ============================================================================
 *
 * 【功能】Fluid Scholar 风格的悬浮 AI 助手入口
 *
 * 【位置】固定在屏幕右下角，距底部 TabBar 约 100px
 *
 * 【Fluid Scholar 风格特点】
 * - 圆形按钮，使用 tertiary-fixed 背景色
 * - 带有 pulse 动画表示"活动状态"
 * - 点击展开 AI 面板或跳转 AI 聊天页面
 *
 * 【元气风格】
 * - 不显示此按钮，或以其他形式集成
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';

interface FloatingMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  accentColor?: string;
  backgroundColor?: string;
}

interface FloatingAIPanelProps {
  onPrimaryAction?: () => void;
  menuItems?: FloatingMenuItem[];
  primaryIcon?: LucideIcon;
  primaryTitle?: string;
  ownerPage?: string;
  hidden?: boolean;
  placement?: 'viewport' | 'contained';
}

const MENU_SIZE = 232;
const CENTER = 184;
const OUTER_RADIUS = 102;
const INNER_RADIUS = 54;
const ICON_RADIUS = 78;
const START_ANGLE = 148;
const END_ANGLE = 332;
const MAGNET_DISTANCE = 34;
const FAB_BOTTOM_OFFSET = 86;
const APP_SHELL_MAX_WIDTH = 430;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function polarPoint(radius: number, angle: number) {
  const rad = toRadians(angle);
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

function describeSector(startAngle: number, endAngle: number) {
  const outerStart = polarPoint(OUTER_RADIUS, startAngle);
  const outerEnd = polarPoint(OUTER_RADIUS, endAngle);
  const innerEnd = polarPoint(INNER_RADIUS, endAngle);
  const innerStart = polarPoint(INNER_RADIUS, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export default function FloatingAIPanel({
  onPrimaryAction,
  menuItems = [],
  primaryIcon: PrimaryIcon,
  primaryTitle,
  ownerPage,
  hidden = false,
  placement = 'viewport',
}: FloatingAIPanelProps) {
  const { navigate, userState } = useUser();
  const { theme } = useTheme();
  const [isPressed, setIsPressed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [pulseSuspended, setPulseSuspended] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const pulseResumeTimer = useRef<number | null>(null);

  const resolvedItems = useMemo(() => menuItems.slice(0, 5), [menuItems]);
  const hasMenuItems = resolvedItems.length > 0;
  const shouldHide = hidden || (ownerPage ? userState.currentPage !== ownerPage : false);
  const sectorAngles = useMemo(() => {
    if (resolvedItems.length === 0) return [] as Array<{ start: number; end: number; mid: number }>;

    const span = END_ANGLE - START_ANGLE;
    const sectorSize = span / resolvedItems.length;

    return resolvedItems.map((_, index) => {
      const start = START_ANGLE + sectorSize * index;
      const end = start + sectorSize;
      return { start, end, mid: start + sectorSize / 2 };
    });
  }, [resolvedItems]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
      }
      if (pulseResumeTimer.current) {
        window.clearTimeout(pulseResumeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (shouldHide) {
      setMenuOpen(false);
      setActiveItemId(null);
      setIsPressed(false);
      longPressTriggered.current = false;
      clearLongPress();
    }
  }, [shouldHide]);

  const getMenuCenter = () => {
    const buttonRect = buttonRef.current?.getBoundingClientRect();
    if (buttonRect) {
      return {
        x: buttonRect.left + buttonRect.width / 2,
        y: buttonRect.top + buttonRect.height / 2,
      };
    }

    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    return {
      x: rect.left + CENTER,
      y: rect.top + CENTER,
    };
  };

  const getActiveItemIdFromPoint = (clientX: number, clientY: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const menuCenter = getMenuCenter();
    if (!rect || !menuCenter || resolvedItems.length === 0) return null;

    const centerX = menuCenter.x;
    const centerY = menuCenter.y;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10 || distance > OUTER_RADIUS + 64) {
      return null;
    }

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    const sector = sectorAngles.find((item, index) => {
      const next = sectorAngles[index + 1];
      if (!next) {
        return angle >= item.start && angle <= item.end;
      }
      return angle >= item.start && angle < item.end;
    });

    if (!sector) {
      // 近场吸附：靠近图标中心时直接吸附到最近扇区
      let nearestId: string | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      resolvedItems.forEach((item, index) => {
        const sectorAngle = sectorAngles[index];
        if (!sectorAngle) return;
        const p = polarPoint(ICON_RADIUS, sectorAngle.mid);
        const dd = Math.sqrt((clientX - (rect.left + p.x)) ** 2 + (clientY - (rect.top + p.y)) ** 2);
        if (dd < nearestDistance) {
          nearestDistance = dd;
          nearestId = item.id;
        }
      });
      if (nearestId && nearestDistance <= MAGNET_DISTANCE) {
        return nearestId;
      }
      return null;
    }
    const sectorIndex = sectorAngles.indexOf(sector);
    return resolvedItems[sectorIndex]?.id ?? null;
  };

  const updateHoveredItem = (clientX: number, clientY: number) => {
    const nextActiveId = getActiveItemIdFromPoint(clientX, clientY);
    setActiveItemId(nextActiveId);
    return nextActiveId;
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setActiveItemId(null);
    longPressTriggered.current = false;
    pointerStart.current = null;
    setPulseSuspended(true);
    if (pulseResumeTimer.current) {
      window.clearTimeout(pulseResumeTimer.current);
    }
    pulseResumeTimer.current = window.setTimeout(() => {
      setPulseSuspended(false);
      pulseResumeTimer.current = null;
    }, 180);
  };

  const handlePrimaryAction = () => {
    if (onPrimaryAction) {
      onPrimaryAction();
    } else {
      navigate('review-session', { type: 'review' });
    }
  };

  const startPress = (clientX: number, clientY: number) => {
    setPulseSuspended(true);
    if (pulseResumeTimer.current) {
      window.clearTimeout(pulseResumeTimer.current);
      pulseResumeTimer.current = null;
    }
    setIsPressed(true);
    longPressTriggered.current = false;
    pointerStart.current = { x: clientX, y: clientY };

    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }

    if (!hasMenuItems) {
      return;
    }

    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setMenuOpen(true);
      updateHoveredItem(clientX, clientY);
    }, 280);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const endPress = (clientX: number, clientY: number) => {
    clearLongPress();
    setIsPressed(false);
    pointerStart.current = null;

    if (!longPressTriggered.current) {
      handlePrimaryAction();
      if (pulseResumeTimer.current) {
        window.clearTimeout(pulseResumeTimer.current);
      }
      pulseResumeTimer.current = window.setTimeout(() => {
        setPulseSuspended(false);
        pulseResumeTimer.current = null;
      }, 160);
      return;
    }

    const hoveredId = updateHoveredItem(clientX, clientY);
    const targetItem = resolvedItems.find(item => item.id === hoveredId);
    closeMenu();
    if (targetItem) {
      window.requestAnimationFrame(() => {
        targetItem.onSelect();
      });
    }
  };

  const cancelPress = () => {
    clearLongPress();
    setIsPressed(false);
    pointerStart.current = null;
    if (menuOpen || longPressTriggered.current) {
      closeMenu();
      return;
    }
    if (pulseResumeTimer.current) {
      window.clearTimeout(pulseResumeTimer.current);
    }
    pulseResumeTimer.current = window.setTimeout(() => {
      setPulseSuspended(false);
      pulseResumeTimer.current = null;
    }, 160);
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!menuOpen) return;
      updateHoveredItem(event.clientX, event.clientY);
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!isPressed) return;
      endPress(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      if (!longPressTriggered.current && pointerStart.current) {
        const deltaX = touch.clientX - pointerStart.current.x;
        const deltaY = touch.clientY - pointerStart.current.y;
        if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 12) {
          clearLongPress();
        }
      }

      if (menuOpen) {
        updateHoveredItem(touch.clientX, touch.clientY);
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!isPressed) return;
      const touch = event.changedTouches[0];
      if (touch) {
        endPress(touch.clientX, touch.clientY);
      } else {
        cancelPress();
      }
    };

    const handleTouchCancel = () => {
      if (!isPressed) return;
      cancelPress();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [isPressed, menuOpen, resolvedItems, sectorAngles]);

  if (shouldHide) {
    return null;
  }

  const panel = (
    <div
      className={placement === 'contained'
        ? 'pointer-events-none relative z-40 h-16 w-16 overflow-visible'
        : 'pointer-events-none fixed bottom-0 left-1/2 z-40 h-[320px] w-[min(100vw,430px)] -translate-x-1/2'}
      style={{
        ...(placement === 'contained' ? {} : { width: `min(100vw, ${APP_SHELL_MAX_WIDTH}px)` }),
      }}
    >
      <div
        ref={wrapperRef}
        className="absolute h-[232px] w-[232px] overflow-visible"
        style={{
          bottom: placement === 'contained' ? '0px' : `${FAB_BOTTOM_OFFSET}px`,
          right: '0px',
        }}
      >
      {menuOpen && (
        <div className="pointer-events-auto fixed inset-0 z-0 bg-black/5 backdrop-blur-[1px]" onClick={closeMenu} />
      )}

      {menuOpen && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <svg width={MENU_SIZE} height={MENU_SIZE} viewBox={`0 0 ${MENU_SIZE} ${MENU_SIZE}`} className="overflow-visible">
            <defs>
              <filter id="learn-ring-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="rgba(15,23,42,0.16)" />
              </filter>
            </defs>
            {resolvedItems.map((item, index) => {
              const sector = sectorAngles[index];
              if (!sector) return null;
              const isActive = activeItemId === item.id;

              return (
                <path
                  key={item.id}
                  d={describeSector(sector.start, sector.end)}
                  fill={isActive
                    ? `${item.accentColor || theme.primary || '#24389c'}34`
                    : 'rgba(107,114,128,0.14)'}
                  stroke={isActive
                    ? item.accentColor || theme.primary || '#24389c'
                    : 'rgba(107,114,128,0.32)'}
                  strokeWidth={isActive ? 1.45 : 1.1}
                  filter="url(#learn-ring-shadow)"
                />
              );
            })}
          </svg>

          {resolvedItems.map((item, index) => {
            const Icon = item.icon;
            const sector = sectorAngles[index];
            if (!sector) return null;
            const point = polarPoint(ICON_RADIUS, sector.mid);
            const isActive = activeItemId === item.id;

            return (
              <div
                key={item.id}
                className="absolute flex h-11 w-11 items-center justify-center transition-all duration-150"
                style={{
                  left: `${point.x - 22}px`,
                  top: `${point.y - 22}px`,
                  color: isActive
                    ? item.accentColor || theme.primary || '#24389c'
                    : (theme.onSurfaceVariant || '#4b5563'),
                  filter: isActive ? 'drop-shadow(0 3px 8px rgba(15,23,42,0.22))' : 'none',
                  transform: isActive ? 'scale(1.16)' : 'scale(1)',
                  opacity: isActive ? 1 : 0.9,
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.6 : 2.2} />
              </div>
            );
          })}
        </div>
      )}

      <div className={`absolute z-30 h-16 w-16 ${placement === 'contained' ? 'bottom-0 right-0' : 'bottom-4 right-4'}`}>
        <button
          ref={buttonRef}
          onMouseDown={event => startPress(event.clientX, event.clientY)}
          onTouchStart={event => {
            const touch = event.touches[0];
            if (!touch) return;
            startPress(touch.clientX, touch.clientY);
          }}
          onContextMenu={event => event.preventDefault()}
          className="pointer-events-auto flex h-full w-full select-none items-center justify-center rounded-full transition-transform duration-150"
          title={primaryTitle}
          style={{
            background: '#4f46e5',
            boxShadow: '0 16px 36px rgba(79,70,229,0.35)',
            transform: menuOpen ? 'scale(1)' : isPressed ? 'scale(0.94)' : 'scale(1)',
            transformOrigin: 'center center',
            willChange: 'transform',
            animation: menuOpen || pulseSuspended ? 'none' : 'learn-fab-pulse 2.4s infinite',
            touchAction: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {PrimaryIcon ? (
            <PrimaryIcon size={28} strokeWidth={2.4} color="#ffffff" />
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l7 4-7 4-7-4 7-4z" />
              <path d="M5 11v4.5c0 1.7 3.1 3.5 7 3.5s7-1.8 7-3.5V11" />
              <path d="M12 11v8" />
            </svg>
          )}
        </button>
      </div>

      <style>{`
        @keyframes learn-fab-pulse {
          0% {
            box-shadow: 0 16px 36px rgba(79,70,229,0.35), 0 0 0 0 rgba(79,70,229,0.18);
          }
          70% {
            box-shadow: 0 16px 36px rgba(79,70,229,0.35), 0 0 0 18px rgba(79,70,229,0);
          }
          100% {
            box-shadow: 0 16px 36px rgba(79,70,229,0.35), 0 0 0 0 rgba(79,70,229,0);
          }
        }
      `}</style>
      </div>
    </div>
  );

  if (placement === 'contained' || typeof document === 'undefined') {
    return panel;
  }

  return createPortal(panel, document.body);
}
