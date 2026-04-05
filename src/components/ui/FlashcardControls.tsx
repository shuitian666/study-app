import { useTheme } from '@/store/ThemeContext';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface FlashcardControlsProps {
  hasDecided: boolean;  // true if user has selected 不会/有点印象/会
  onSelect: (level: 'none' | 'rusty' | 'normal') => void;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export default function FlashcardControls({
  hasDecided,
  onSelect,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
}: FlashcardControlsProps) {
  const { theme } = useTheme();

  const buttonBaseClasses = "flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed";

  if (!hasDecided) {
    // Show decision buttons: 不会 / 有点印象 / 会
    return (
      <div className="flex gap-3 px-4 pb-6">
        <button
          onClick={() => onSelect('none')}
          className={buttonBaseClasses}
          style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
        >
          不会
        </button>
        <button
          onClick={() => onSelect('rusty')}
          className={buttonBaseClasses}
          style={{ backgroundColor: '#fffbeb', color: '#f59e0b' }}
        >
          有点印象
        </button>
        <button
          onClick={() => onSelect('normal')}
          className={buttonBaseClasses}
          style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}
        >
          会
        </button>
      </div>
    );
  }

  // Show navigation buttons after decision
  return (
    <div className="flex gap-3 px-4 pb-6">
      <button
        onClick={onPrev}
        disabled={!canGoPrev}
        className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1 ${buttonBaseClasses}`}
        style={{
          backgroundColor: canGoPrev ? `${theme.primary}15` : theme.border,
          color: canGoPrev ? theme.primary : theme.textMuted,
        }}
      >
        <ChevronUp size={16} />
        上一题
      </button>
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1 ${buttonBaseClasses}`}
        style={{
          backgroundColor: canGoNext ? theme.primary : theme.border,
          color: canGoNext ? '#ffffff' : theme.textMuted,
        }}
      >
        下一题
        <ChevronDown size={16} />
      </button>
    </div>
  );
}
