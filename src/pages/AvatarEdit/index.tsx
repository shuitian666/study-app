/**
 * ============================================================================
 * 头像与形象编辑页面 (Avatar Edit Page)
 * ============================================================================
 * 
 * 功能：
 * 1. 头像选择：支持 emoji 和自定义上传图片
 * 2. 头像框选择：按稀有度显示不同效果
 *    - N(普通)：纯色/渐变
 *    - R(稀有)：边框+花纹
 *    - SR(史诗)：形状变化+装饰
 *    - SSR(传说)：动态特效
 * 3. 背景选择：设置学习背景
 * 4. 预览功能：可预览未获得的头像框
 */

import { useState, useRef, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { Sparkles, Upload, X } from 'lucide-react';

type TabType = 'avatar' | 'frame' | 'background';

export const rarityConfig = {
  N: { label: '普通', color: '#9ca3af', gradient: 'linear-gradient(135deg, #94a3b8, #64748b)' },
  R: { label: '稀有', color: '#3b82f6', gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)' },
  SR: { label: '史诗', color: '#a855f7', gradient: 'linear-gradient(135deg, #c084fc, #9333ea)' },
  SSR: { label: '传说', color: '#f59e0b', gradient: 'linear-gradient(135deg, #fbbf24, #d97706)' },
};

export type RarityType = 'N' | 'R' | 'SR' | 'SSR';

export interface FrameConfig {
  id: string;
  name: string;
  icon: string;
  rarity: RarityType;
  gradient: string;
  borderStyle?: string;
  decorations?: string[];
  shapeTransform?: string;
  animation?: boolean;
}

export const allFrames: FrameConfig[] = [
  { id: 'frame-n-1', name: '简约银框', icon: '⬜', rarity: 'N', gradient: 'linear-gradient(135deg, #e5e7eb, #9ca3af)' },
  { id: 'frame-n-2', name: '冰川蓝框', icon: '🧊', rarity: 'N', gradient: 'linear-gradient(135deg, #93c5fd, #3b82f6)' },
  { id: 'frame-n-3', name: '翡翠绿框', icon: '💚', rarity: 'N', gradient: 'linear-gradient(135deg, #86efac, #22c55e)' },
  { id: 'frame-n-4', name: '珊瑚红框', icon: '❤️', rarity: 'N', gradient: 'linear-gradient(135deg, #fca5a5, #ef4444)' },
  { id: 'frame-n-5', name: '优雅黑金', icon: '🖤', rarity: 'N', gradient: 'linear-gradient(135deg, #fbbf24, #1f2937)' },
  { id: 'frame-r-1', name: '星空紫框', icon: '🌌', rarity: 'R', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)', borderStyle: 'dashed', animation: true },
  { id: 'frame-r-2', name: '极光蓝框', icon: '🌊', rarity: 'R', gradient: 'linear-gradient(135deg, #67e8f9, #0891b2)', borderStyle: 'double', animation: true },
  { id: 'frame-r-3', name: '樱花粉框', icon: '🌸', rarity: 'R', gradient: 'linear-gradient(135deg, #fbcfe8, #ec4899)', borderStyle: 'dotted', animation: true },
  { id: 'frame-r-4', name: '闪电黑框', icon: '⚡', rarity: 'R', gradient: 'linear-gradient(135deg, #1f2937, #000000, #4b5563)', borderStyle: 'double', animation: true },
  { id: 'frame-r-5', name: '彩虹缤纷', icon: '🌈', rarity: 'R', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 33%, #4facfe 66%, #00f2fe 100%)', animation: true },
  { id: 'frame-sr-1', name: '春日花环', icon: '🌸', rarity: 'SR', gradient: 'linear-gradient(135deg, #fce7f3, #db2777)', decorations: ['🌸', '🌺', '🍃'], shapeTransform: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', animation: true },
  { id: 'frame-sr-2', name: '金桂飘香', icon: '🌼', rarity: 'SR', gradient: 'linear-gradient(135deg, #fef3c7, #d97706)', decorations: ['🌼', '🍂'], shapeTransform: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)', animation: true },
  { id: 'frame-sr-3', name: '紫藤花架', icon: '💜', rarity: 'SR', gradient: 'linear-gradient(135deg, #e9d5ff, #9333ea)', decorations: ['💮', '🌿'], shapeTransform: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', animation: true },
  { id: 'frame-sr-4', name: '圣诞花环', icon: '🎄', rarity: 'SR', gradient: 'linear-gradient(135deg, #bbf7d0, #16a34a)', decorations: ['❄️', '🔔', '🎁'], shapeTransform: 'circle(50%)', animation: true },
  { id: 'frame-sr-5', name: '爱心包围', icon: '❤️', rarity: 'SR', gradient: 'linear-gradient(135deg, #fecdd3, #fb7185)', decorations: ['💖', '💕', '💗'], shapeTransform: 'circle(50%)', animation: true },
  { id: 'frame-ssr-1', name: '星河璀璨', icon: '✨', rarity: 'SSR', gradient: 'linear-gradient(135deg, #fef9c3, #fbbf24, #f59e0b)', decorations: ['⭐', '✨', '🌟'], shapeTransform: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', animation: true },
  { id: 'frame-ssr-2', name: '永恒钻石', icon: '💎', rarity: 'SSR', gradient: 'linear-gradient(135deg, #a5f3fc, #22d3d3, #06b6d4)', decorations: ['💎', '✨'], shapeTransform: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)', animation: true },
  { id: 'frame-ssr-3', name: '火焰图腾', icon: '🔥', rarity: 'SSR', gradient: 'linear-gradient(135deg, #fef9c3, #fb923c, #ef4444)', decorations: ['🔥', '💥', '⭐'], shapeTransform: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', animation: true },
  { id: 'frame-ssr-4', name: '双龙戏珠', icon: '🐲', rarity: 'SSR', gradient: 'linear-gradient(135deg, #10b981, #059669, #047857)', decorations: ['🐉', '🔥', '💎'], shapeTransform: 'circle(50%)', animation: true },
];

export interface BackgroundConfig {
  id: string;
  name: string;
  rarity: RarityType;
  gradient: string;
  pattern?: string;
}

export const allBackgrounds: BackgroundConfig[] = [
  { id: 'bg-n-1', name: '纯净白', rarity: 'N', gradient: 'linear-gradient(180deg, #ffffff, #f9fafb)' },
  { id: 'bg-n-2', name: '静谧蓝', rarity: 'N', gradient: 'linear-gradient(180deg, #dbeafe, #93c5fd)' },
  { id: 'bg-n-3', name: '薄荷绿', rarity: 'N', gradient: 'linear-gradient(180deg, #dcfce7, #86efac)' },
  { id: 'bg-n-4', name: '暖米色', rarity: 'N', gradient: 'linear-gradient(180deg, #fffbeb, #fef3c7)' },
  { id: 'bg-n-5', name: '浅烟灰', rarity: 'N', gradient: 'linear-gradient(180deg, #f3f4f6, #e5e7eb)' },
  { id: 'bg-r-1', name: '星空夜', rarity: 'R', gradient: 'linear-gradient(180deg, #1e1b4b, #312e81)', pattern: 'stars' },
  { id: 'bg-r-2', name: '森林极光', rarity: 'R', gradient: 'linear-gradient(180deg, #064e3b, #065f46, #047857)', pattern: 'aurora' },
  { id: 'bg-r-3', name: '橘光晚霞', rarity: 'R', gradient: 'linear-gradient(180deg, #fef2f2, #fecaca, #fca5a5)', pattern: 'clouds' },
  { id: 'bg-r-4', name: '黄昏落日', rarity: 'R', gradient: 'linear-gradient(180deg, #fbbf24, #f97316, #ea580c)', pattern: 'sunset' },
  { id: 'bg-sr-1', name: '春日樱', rarity: 'SR', gradient: 'linear-gradient(180deg, #fce7f3, #fbcfe8, #f9a8d4)', pattern: 'cherry' },
  { id: 'bg-sr-2', name: '竹林风', rarity: 'SR', gradient: 'linear-gradient(180deg, #f0fdf4, #dcfce7, #bbf7d0)', pattern: 'bamboo' },
  { id: 'bg-sr-3', name: '深海蓝', rarity: 'SR', gradient: 'linear-gradient(180deg, #1e3a8a, #1e40af, #3b82f6)', pattern: 'waves' },
  { id: 'bg-sr-4', name: '沙漠日落', rarity: 'SR', gradient: 'linear-gradient(180deg, #facc15, #fb923c, #ef4444)', pattern: 'sand' },
  { id: 'bg-ssr-1', name: '璀璨银河', rarity: 'SSR', gradient: 'linear-gradient(180deg, #0c0a09, #1c1917, #292524)', pattern: 'galaxy' },
  { id: 'bg-ssr-2', name: '极光绚烂', rarity: 'SSR', gradient: 'linear-gradient(135deg, #1e3a5f, #2563eb, #7c3aed, #db2777)', pattern: 'aurora-bright' },
  { id: 'bg-ssr-3', name: '幻彩云境', rarity: 'SSR', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 25%, #4facfe 50%, #00f2fe 75%, #a78bfa 100%)', pattern: 'rainbow' },
];

const defaultAvatars = ['👤', '🦊', '🐰', '🐼', '🦁', '🐨', '🐯', '🐸', '🦄', '🐲', '🐱', '🐶', '🦋', '🌟', '💎', '🎭'];

export default function AvatarEditPage() {
  const { state, dispatch, navigate } = useApp();
  const user = state.user;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>('avatar');
  const [previewFrame, setPreviewFrame] = useState<FrameConfig | null>(null);
  const [previewBg, setPreviewBg] = useState<BackgroundConfig | null>(null);

  const currentFrame = useMemo(() => 
    previewFrame || allFrames.find(f => f.icon === user?.avatarFrame)
  , [previewFrame, user?.avatarFrame]);

  const currentBackground = useMemo(() => 
    previewBg?.gradient || (user?.background ? allBackgrounds.find(bg => bg.id === user.background)?.gradient : null) || 'linear-gradient(180deg, #ffffff, #f9fafb)'
  , [previewBg, user?.background]);

  const handleSelectAvatar = (avatar: string) => {
    if (!user) return;
    dispatch({
      type: 'UPDATE_USER',
      payload: { avatar, customAvatarUrl: undefined }
    });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const customUrl = event.target?.result as string;
      dispatch({
        type: 'UPDATE_USER',
        payload: { avatar: customUrl, customAvatarUrl: customUrl }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectFrame = (frame: FrameConfig | null) => {
    if (!user) return;
    dispatch({
      type: 'UPDATE_USER',
      payload: { avatarFrame: frame?.icon || null }
    });
    setPreviewFrame(null);
  };

  const handleSelectBackground = (bg: BackgroundConfig | null) => {
    if (!user) return;
    dispatch({
      type: 'UPDATE_USER',
      payload: { 
        background: bg?.id || null,
        currentBackground: bg?.gradient || undefined
      }
    });
    setPreviewBg(null);
  };

  const isFrameUnlocked = (frame: FrameConfig) => {
    return user?.unlockedFrames?.includes(frame.icon) || frame.rarity === 'N';
  };

  const isBackgroundUnlocked = (bg: BackgroundConfig) => {
    return user?.unlockedBackgrounds?.includes(bg.id) || bg.rarity === 'N';
  };

  const isCustomAvatar = (user?.avatar?.startsWith('data:') || user?.avatar?.startsWith('http')) ?? false;

  const renderFrame = (frame: FrameConfig, size: 'small' | 'large' = 'small') => {
    const sizeClass = size === 'large' ? 'w-24 h-24 text-5xl' : 'w-12 h-12 text-2xl';
    const padding = size === 'large' ? 'p-1' : 'p-0.5';
    const hasAnimation = frame.animation;
    
    return (
      <div className={`relative ${hasAnimation ? 'animate-pulse' : ''}`} style={hasAnimation ? { animationDuration: '3s' } : {}}>
        <div
          className={`${sizeClass} rounded-full flex items-center justify-center ${hasAnimation ? 'animate-gradient-shift' : ''}`}
          style={{
            background: frame.gradient,
            clipPath: frame.shapeTransform || 'circle(50%)',
            backgroundSize: hasAnimation ? '200% 200%' : '100% 100%',
          }}
        >
          <div className={`bg-white rounded-full flex items-center justify-center ${padding} ${size === 'large' ? 'text-4xl' : 'text-xl'}`}>
            {isCustomAvatar && user?.avatar ? (
              <img src={user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
            ) : (
              user?.avatar || '👤'
            )}
          </div>
        </div>
        {frame.decorations && frame.decorations.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {frame.decorations.map((dec, i) => (
              <span
                key={i}
                className={`absolute text-xs ${frame.animation ? 'animate-bounce' : ''}`}
                style={{
                  top: i === 0 ? '-8px' : i === 1 ? '50%' : 'auto',
                  bottom: i === 2 ? '-8px' : 'auto',
                  right: i === 1 ? '-8px' : i === 2 ? '0' : 'auto',
                  left: i === 0 ? '50%' : i === 1 ? 'auto' : '0',
                  transform: i === 0 ? 'translateX(-50%)' : i === 1 ? 'translateY(-50%)' : 'none',
                  animationDelay: `${i * 0.5}s`,
                }}
              >
                {dec}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBackgroundPattern = (pattern?: string) => {
    if (!pattern) return null;

    if (pattern === 'stars' || pattern === 'galaxy') {
      return (
        <div className="absolute inset-0 opacity-50">
          {[...Array(pattern === 'galaxy' ? 40 : 20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                opacity: Math.random() * 0.8 + 0.2,
              }}
            />
          ))}
        </div>
      );
    }

    if (pattern === 'cherry') {
      return (
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute text-4xl animate-float"
              style={{
                left: `${(i % 4) * 25 + Math.random() * 15}%`,
                top: `${Math.floor(i / 4) * 40 + Math.random() * 20}%`,
                animationDelay: `${i * 0.8}s`,
              }}
            >
              🌸
            </div>
          ))}
        </div>
      );
    }

    if (pattern === 'bamboo') {
      return (
        <div className="absolute inset-0 opacity-15 pointer-events-none flex justify-end">
          <div className="w-1/3 h-full flex flex-col justify-around">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="text-5xl transform -rotate-12">🎋</div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const tabs = [
    { key: 'avatar' as TabType, label: '头像', icon: '👤' },
    { key: 'frame' as TabType, label: '头像框', icon: '🖼️' },
    { key: 'background' as TabType, label: '背景', icon: '🎨' },
  ];

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="形象编辑" onBack={() => navigate('profile')} />

      <div 
        className="mx-4 mt-3 rounded-2xl p-6 flex flex-col items-center relative overflow-hidden"
        style={{ background: currentBackground, minHeight: '220px' }}
      >
        {renderBackgroundPattern(previewBg?.pattern || (user?.background ? allBackgrounds.find(bg => bg.id === user.background)?.pattern : undefined))}
        
        {(previewFrame || previewBg) && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <Sparkles size={12} />
            预览模式
            <button
              onClick={() => { setPreviewFrame(null); setPreviewBg(null); }}
              className="ml-1 hover:bg-white/20 rounded-full p-0.5"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="mt-4 relative z-10">
          {currentFrame ? renderFrame(currentFrame, 'large') : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl bg-white">
              {isCustomAvatar && user?.avatar ? (
                <img src={user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
              ) : (
                user?.avatar || '👤'
              )}
            </div>
          )}
        </div>
        
        <p className="mt-3 text-sm font-medium text-gray-700 bg-white/80 px-3 py-1 rounded-full">
          {user?.nickname || '未登录'}
        </p>
        {currentFrame && (
          <span className="text-xs mt-1 px-2 py-0.5 rounded-full" style={{ color: rarityConfig[currentFrame.rarity].color, backgroundColor: 'rgba(255,255,255,0.8)' }}>
            {currentFrame.name}
          </span>
        )}
      </div>

      <div className="mx-4 mt-4 bg-gray-100 rounded-xl p-1 flex">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === tab.key
                ? 'bg-white text-primary shadow-sm'
                : 'text-text-muted'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'avatar' && (
        <div className="mx-4 mt-4">
          <h3 className="text-sm font-medium text-text-muted mb-3">选择头像</h3>
          
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">上传自定义头像</p>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl overflow-hidden border-2 border-dashed border-gray-300">
                {isCustomAvatar ? (
                  <img src={user?.avatar} alt="自定义头像" className="w-full h-full object-cover" />
                ) : (
                  user?.avatar || '👤'
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 px-4 bg-primary text-white rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Upload size={18} />
                <span>{isCustomAvatar ? '更换头像' : '上传图片'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          </div>

          <p className="text-xs text-text-muted mb-2">选择 Emoji 头像</p>
          <div className="grid grid-cols-8 gap-2">
            {defaultAvatars.map((avatar, i) => (
              <button
                key={`${avatar}-${i}`}
                onClick={() => handleSelectAvatar(avatar)}
                className={`aspect-square rounded-xl flex items-center justify-center text-2xl transition-all ${
                  user?.avatar === avatar && !isCustomAvatar
                    ? 'bg-primary text-white shadow-md ring-2 ring-primary'
                    : 'bg-white border border-gray-200 hover:border-primary hover:scale-105'
                }`}
              >
                {avatar}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'frame' && (
        <div className="mx-4 mt-4">
          <h3 className="text-sm font-medium text-text-muted mb-3">选择头像框</h3>
          
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">无边框</p>
            <button
              onClick={() => handleSelectFrame(null)}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all ${
                !user?.avatarFrame
                  ? 'ring-2 ring-primary ring-offset-2'
                  : 'bg-white border-2 border-dashed border-gray-300 text-gray-400'
              }`}
            >
              {isCustomAvatar && user?.avatar ? (
                <img src={user.avatar} alt="无头像框" className="w-full h-full object-cover rounded-full" />
              ) : (
                user?.avatar || '👤'
              )}
            </button>
          </div>

          {(['N', 'R', 'SR', 'SSR'] as RarityType[]).map(rarity => {
            const frames = allFrames.filter(f => f.rarity === rarity);
            const config = rarityConfig[rarity];
            
            return (
              <div key={rarity} className="mb-4">
                <p className="text-xs font-medium mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                  {config.label} ({frames.filter(f => isFrameUnlocked(f)).length}/{frames.length})
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {frames.map(frame => {
                    const unlocked = isFrameUnlocked(frame);
                    const selected = user?.avatarFrame === frame.icon && !previewFrame;
                    
                    return (
                      <div key={frame.id} className="flex flex-col items-center">
                        <button
                          onClick={() => unlocked ? handleSelectFrame(frame) : setPreviewFrame(frame)}
                          disabled={!unlocked}
                          className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all ${
                            selected
                              ? 'ring-2 ring-primary ring-offset-2'
                              : unlocked
                              ? 'bg-white border border-gray-200 hover:border-primary hover:scale-105'
                              : 'bg-gray-100 opacity-60'
                          }`}
                        >
                          <div className="transform scale-50 origin-center">
                            {renderFrame(frame)}
                          </div>
                          {!unlocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                              <Sparkles size={16} className="text-white" />
                            </div>
                          )}
                        </button>
                        <span className="text-[10px] text-text-muted mt-1 text-center leading-tight">
                          {frame.name}
                        </span>
                        {selected && (
                          <span className="text-[8px] text-primary font-medium">使用中</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'background' && (
        <div className="mx-4 mt-4">
          <h3 className="text-sm font-medium text-text-muted mb-3">选择背景</h3>
          
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">默认背景</p>
            <button
              onClick={() => handleSelectBackground(null)}
              className={`w-24 h-16 rounded-xl flex items-center justify-center text-xs transition-all ${
                !user?.background && !previewBg
                  ? 'ring-2 ring-primary'
                  : 'bg-white border-2 border-dashed border-gray-300 text-gray-400'
              }`}
              style={{ background: 'linear-gradient(180deg, #ffffff, #f9fafb)' }}
            >
              默认
            </button>
          </div>

          {(['N', 'R', 'SR', 'SSR'] as RarityType[]).map(rarity => {
            const backgrounds = allBackgrounds.filter(bg => bg.rarity === rarity);
            const config = rarityConfig[rarity];
            
            return (
              <div key={rarity} className="mb-4">
                <p className="text-xs font-medium mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                  {config.label} ({backgrounds.filter(bg => isBackgroundUnlocked(bg)).length}/{backgrounds.length})
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {backgrounds.map(bg => {
                    const unlocked = isBackgroundUnlocked(bg);
                    const selected = user?.background === bg.id && !previewBg;
                    
                    return (
                      <div key={bg.id} className="flex flex-col items-center">
                        <button
                          onClick={() => unlocked ? handleSelectBackground(bg) : setPreviewBg(bg)}
                          disabled={!unlocked}
                          className={`w-full h-16 rounded-xl transition-all relative overflow-hidden ${
                            selected
                              ? 'ring-2 ring-primary'
                              : unlocked
                              ? 'hover:scale-105'
                              : 'opacity-60'
                          }`}
                          style={{ background: bg.gradient }}
                        >
                          {bg.pattern && (
                            <div className="absolute inset-0 opacity-30">
                              {bg.pattern === 'stars' && <span className="text-white/30 text-xl">🌌</span>}
                              {bg.pattern === 'cherry' && <span className="text-white/30 text-xl">🌸</span>}
                              {bg.pattern === 'galaxy' && <span className="text-white/30 text-xl">✨</span>}
                            </div>
                          )}
                          {!unlocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Sparkles size={16} className="text-white" />
                            </div>
                          )}
                        </button>
                        <span className="text-[10px] text-text-muted mt-1 text-center">{bg.name}</span>
                        {selected && (
                          <span className="text-[8px] text-primary font-medium">使用中</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mx-4 mt-6">
        <h3 className="text-sm font-medium text-text-muted mb-3">稀有度说明</h3>
        <div className="space-y-2">
          {([
            { rarity: 'N' as RarityType, desc: '纯色或渐变边框' },
            { rarity: 'R' as RarityType, desc: '边框带花纹样式 + 渐变动画' },
            { rarity: 'SR' as RarityType, desc: '形状变化 + 装饰元素 + 动画' },
            { rarity: 'SSR' as RarityType, desc: '特殊造型 + 动态装饰 + 渐变动画' },
          ]).map(item => (
            <div key={item.rarity} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: `${rarityConfig[item.rarity].color}15` }}>
              <span className="w-8 text-center font-bold text-sm" style={{ color: rarityConfig[item.rarity].color }}>
                {rarityConfig[item.rarity].label}
              </span>
              <span className="text-xs text-text-secondary">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-4 mt-6 mb-4">
        <div className="bg-amber-50 rounded-xl p-3">
          <p className="text-xs text-amber-700">
            💡 点击未解锁的头像框可预览效果。通过抽签、商城购买或邮件可解锁更多装饰！
          </p>
        </div>
      </div>
    </div>
  );
}

