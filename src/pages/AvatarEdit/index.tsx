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
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader } from '@/components/ui/Common';
import { Minus, Pencil, Save, Sparkles, Upload, X } from 'lucide-react';
import { getAdaptiveButton, getAdaptivePageBackground, getAdaptiveSurface } from '@/utils/adaptiveTheme';
import {
  allBackgrounds,
  allFrames,
  allTitles,
  rarityConfig,
  type BackgroundConfig,
  type FrameConfig,
  type RarityType,
  type TitleConfig,
} from '@/data/avatarCatalog';

type TabType = 'avatar' | 'frame' | 'background' | 'title';

const defaultAvatars = ['👤', '🦊', '🐰', '🐼', '🦁', '🐨', '🐯', '🐸', '🦄', '🐲', '🐱', '🐶', '🦋', '🌟', '💎', '🎭'];

export default function AvatarEditPage() {
  const { userState, userDispatch, navigate } = useUser();
  const { theme } = useTheme();
  const user = userState.user;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropStartRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('avatar');
  const [previewFrame, setPreviewFrame] = useState<FrameConfig | null>(null);
  const [previewBg, setPreviewBg] = useState<BackgroundConfig | null>(null);
  const [previewTitle, setPreviewTitle] = useState<TitleConfig | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.nickname ?? '');
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropNaturalSize, setCropNaturalSize] = useState({ width: 1, height: 1 });
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropScale, setCropScale] = useState(1);

  const currentFrame = useMemo(() => 
    previewFrame || allFrames.find(f => f.icon === user?.avatarFrame)
  , [previewFrame, user?.avatarFrame]);

  const userBackgroundId = user?.background;
  const currentBackground = useMemo(() => 
    previewBg?.gradient || (userBackgroundId ? allBackgrounds.find(bg => bg.id === userBackgroundId)?.gradient : null) || 'linear-gradient(180deg, #ffffff, #f9fafb)'
  , [previewBg, userBackgroundId]);

  const currentTitle = useMemo(() => 
    previewTitle || allTitles.find(t => t.id === user?.activeTitle)
  , [previewTitle, user?.activeTitle]);

  const saveNickname = () => {
    const nickname = nameDraft.trim().slice(0, 12);
    if (!user || !nickname) return;
    userDispatch({ type: 'UPDATE_USER', payload: { nickname } });
    setNameDraft(nickname);
    setIsEditingName(false);
  };

  const handleSelectAvatar = (avatar: string) => {
    if (!user) return;
    userDispatch({
      type: 'UPDATE_USER',
      payload: { avatar, customAvatarUrl: undefined }
    });
    setCropImage(null);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCropImage(event.target?.result as string);
      setCropOffset({ x: 0, y: 0 });
      setCropScale(1);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const cancelAvatarCrop = () => {
    setCropImage(null);
    setCropOffset({ x: 0, y: 0 });
    setCropScale(1);
    cropStartRef.current = null;
  };

  const confirmAvatarCrop = () => {
    if (!cropImage || !user) return;

    const image = new Image();
    image.onload = () => {
      const viewport = 224;
      const output = 512;
      const canvas = document.createElement('canvas');
      canvas.width = output;
      canvas.height = output;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = Math.max(viewport / image.naturalWidth, viewport / image.naturalHeight) * cropScale;
      const displayWidth = image.naturalWidth * scale;
      const displayHeight = image.naturalHeight * scale;
      const renderScale = output / viewport;
      const dx = ((viewport - displayWidth) / 2 + cropOffset.x) * renderScale;
      const dy = ((viewport - displayHeight) / 2 + cropOffset.y) * renderScale;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, output, output);
      ctx.drawImage(image, dx, dy, displayWidth * renderScale, displayHeight * renderScale);

      const customUrl = canvas.toDataURL('image/png');
      userDispatch({
        type: 'UPDATE_USER',
        payload: { avatar: customUrl, customAvatarUrl: customUrl }
      });
      cancelAvatarCrop();
    };
    image.src = cropImage;
  };

  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropImage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    cropStartRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      offsetX: cropOffset.x,
      offsetY: cropOffset.y,
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = cropStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    setCropOffset({
      x: start.offsetX + e.clientX - start.x,
      y: start.offsetY + e.clientY - start.y,
    });
  };

  const handleCropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (cropStartRef.current?.pointerId === e.pointerId) {
      cropStartRef.current = null;
    }
  };

  const handleSelectFrame = (frame: FrameConfig | null) => {
    if (!user) return;
    userDispatch({
      type: 'UPDATE_USER',
      payload: { avatarFrame: frame?.icon || null }
    });
    setPreviewFrame(null);
  };

  const handleSelectBackground = (bg: BackgroundConfig | null) => {
    if (!user) return;
    userDispatch({
      type: 'UPDATE_USER',
      payload: { 
        background: bg?.id || null,
        currentBackground: bg?.gradient || undefined
      }
    });
    setPreviewBg(null);
  };

  const handleSelectTitle = (title: TitleConfig | null) => {
    if (!user) return;
    userDispatch({
      type: 'UPDATE_USER',
      payload: { activeTitle: title?.id || undefined }
    });
    setPreviewTitle(null);
  };

  // 从背包中检查是否已拥有该头像框
  const isFrameUnlocked = (frame: FrameConfig) => {
    // 所有稀有度都检查背包，使用名称匹配
    const hasInInventory = userState.inventory.items.some(
      item => item.type === 'avatar_frame' && item.name === frame.name
    );
    // 兼容旧数据：同时检查原来的解锁列表
    const oldUnlocked = user?.unlockedFrames?.includes(frame.icon);
    return hasInInventory || oldUnlocked;
  };

  // 从背包中检查是否已拥有该称号
  const isTitleUnlocked = (title: TitleConfig) => {
    // 检查背包，使用名称匹配
    const hasInInventory = userState.inventory.items.some(
      item => item.type === 'title' && item.name === title.name
    );
    return hasInInventory;
  };

  // 从背包中检查是否已拥有该背景
  const isBackgroundUnlocked = (bg: BackgroundConfig) => {
    // 所有稀有度都检查背包，使用名称匹配
    const hasInInventory = userState.inventory.items.some(
      item => item.type === 'background' && item.name === bg.name
    );
    // 兼容旧数据：同时检查原来的解锁列表
    const oldUnlocked = user?.unlockedBackgrounds?.includes(bg.id);
    return hasInInventory || oldUnlocked;
  };

  const isCustomAvatar = (user?.avatar?.startsWith('data:') || user?.avatar?.startsWith('http')) ?? false;
  const cropPreviewSize = 224;
  const cropPreviewScale = Math.max(cropPreviewSize / cropNaturalSize.width, cropPreviewSize / cropNaturalSize.height) * cropScale;
  const cropDisplayWidth = cropNaturalSize.width * cropPreviewScale;
  const cropDisplayHeight = cropNaturalSize.height * cropPreviewScale;

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

    if (pattern === 'apple-blur') {
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
          {/* 苹果风格磨砂玻璃纹理 - 微妙的噪点效果 */}
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="noiseFilter">
                <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
                <feColorMatrix type="saturate" values="0"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.05"/>
                </feComponentTransfer>
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#noiseFilter)"/>
          </svg>
          {/* 微妙的渐变光晕 */}
          <div className="absolute top-0 left-1/4 w-1/2 h-32 bg-white/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-1/2 h-32 bg-white/20 rounded-full blur-3xl"></div>
        </div>
      );
    }

    if (pattern === 'aurora') {
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35">
          <div className="absolute -left-10 top-4 h-28 w-28 rounded-full bg-cyan-300/35 blur-3xl" />
          <div className="absolute left-1/4 top-12 h-32 w-32 rounded-full bg-indigo-300/30 blur-3xl" />
          <div className="absolute -right-8 bottom-5 h-28 w-28 rounded-full bg-fuchsia-300/25 blur-3xl" />
        </div>
      );
    }

    return null;
  };

  const tabs = [
    { key: 'avatar' as TabType, label: '头像', icon: '👤' },
    { key: 'frame' as TabType, label: '头像框', icon: '🖼️' },
    { key: 'background' as TabType, label: '背景', icon: '🎨' },
    { key: 'title' as TabType, label: '称号', icon: '🏷️' },
  ];

  return (
    <div className="page-scroll pb-4" style={getAdaptivePageBackground(theme)}>
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
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg" style={getAdaptiveSurface(theme, 'raised')}>
              {isCustomAvatar && user?.avatar ? (
                <img src={user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
              ) : (
                user?.avatar || '👤'
              )}
            </div>
          )}
        </div>
        
        <div className="mt-3 relative z-10 w-full max-w-xs">
          {isEditingName ? (
            <div className="flex items-center gap-2 rounded-2xl p-2 shadow-sm" style={getAdaptiveSurface(theme, 'raised')}>
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveNickname();
                  if (e.key === 'Escape') {
                    setNameDraft(user?.nickname ?? '');
                    setIsEditingName(false);
                  }
                }}
                maxLength={12}
                autoFocus
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-primary"
                style={{ ...getAdaptiveSurface(theme, 'base'), borderColor: theme.border, color: theme.textPrimary }}
                placeholder="输入昵称"
              />
              <button
                onClick={saveNickname}
                disabled={!nameDraft.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-40"
                style={getAdaptiveButton(theme, 'primary')}
                title="保存昵称"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => {
                  setNameDraft(user?.nickname ?? '');
                  setIsEditingName(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={getAdaptiveButton(theme, 'ghost')}
                title="取消"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNameDraft(user?.nickname ?? '');
                setIsEditingName(true);
              }}
              className="mx-auto flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium shadow-sm border"
              style={{ ...getAdaptiveButton(theme, 'ghost'), color: theme.textSecondary }}
              title="编辑昵称"
            >
              <span className="truncate">{user?.nickname || '未登录'}</span>
              <Pencil size={12} />
            </button>
          )}
        </div>
        {currentFrame && (
          <span className="text-xs mt-1 px-2 py-0.5 rounded-full" style={{ color: rarityConfig[currentFrame.rarity].color, backgroundColor: 'rgba(255,255,255,0.8)' }}>
            {currentFrame.name}
          </span>
        )}
        {currentTitle && (
          <span className="text-sm mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium shadow-sm" style={{
            background: currentTitle.gradient,
            color: currentTitle.textColor
          }}>
            <span>{currentTitle.icon}</span>
            <span>{currentTitle.name}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)', color: rarityConfig[currentTitle.rarity].color }}
            >
              {currentTitle.rarity}
            </span>
          </span>
        )}
      </div>

      <div className="mx-4 mt-4 rounded-xl p-1 flex border" style={getAdaptiveSurface(theme, 'raised')}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: activeTab === tab.key ? (theme.primaryFixed || `${theme.primary}22`) : 'transparent',
              color: activeTab === tab.key ? (theme.primaryLight || theme.primary) : theme.textMuted,
              boxShadow: activeTab === tab.key ? '0 10px 24px -18px rgba(0,0,0,0.45)' : 'none',
            }}
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
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl overflow-hidden border-2 border-dashed" style={{ ...getAdaptiveSurface(theme, 'base'), borderColor: theme.border }}>
                {isCustomAvatar ? (
                  <img src={user?.avatar} alt="自定义头像" className="w-full h-full object-cover" />
                ) : (
                  user?.avatar || '👤'
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                style={getAdaptiveButton(theme, 'primary')}
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

          {cropImage && (
            <div className="mb-5 rounded-2xl border p-4 shadow-sm" style={{ ...getAdaptiveSurface(theme, 'base'), borderColor: theme.border }}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">裁剪圆形头像</h4>
                  <p className="text-xs text-text-muted">拖动图片选择显示区域，滑动调整缩放</p>
                </div>
                <button
                  onClick={cancelAvatarCrop}
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={getAdaptiveButton(theme, 'ghost')}
                  title="取消裁剪"
                >
                  <X size={16} />
                </button>
              </div>

              <div
                className="relative mx-auto overflow-hidden rounded-full bg-gray-100 touch-none cursor-grab active:cursor-grabbing"
                style={{ width: cropPreviewSize, height: cropPreviewSize }}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
              >
                <img
                  src={cropImage}
                  alt="头像裁剪预览"
                  draggable={false}
                  onLoad={e => setCropNaturalSize({
                    width: e.currentTarget.naturalWidth || 1,
                    height: e.currentTarget.naturalHeight || 1,
                  })}
                  className="pointer-events-none absolute select-none"
                  style={{
                    width: cropNaturalSize.width,
                    height: cropNaturalSize.height,
                    maxWidth: 'none',
                    maxHeight: 'none',
                    left: (cropPreviewSize - cropDisplayWidth) / 2 + cropOffset.x,
                    top: (cropPreviewSize - cropDisplayHeight) / 2 + cropOffset.y,
                    transform: `scale(${cropPreviewScale})`,
                    transformOrigin: 'top left',
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/90 ring-inset" />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Minus size={16} className="text-text-muted" />
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={cropScale}
                  onChange={e => setCropScale(Number(e.target.value))}
                  className="flex-1 accent-primary"
                  aria-label="头像缩放"
                />
                <Sparkles size={16} className="text-text-muted" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={cancelAvatarCrop}
                  className="rounded-xl border py-3 text-sm font-medium"
                  style={{ ...getAdaptiveButton(theme, 'secondary'), borderColor: theme.border }}
                >
                  取消
                </button>
                <button
                  onClick={confirmAvatarCrop}
                  className="rounded-xl py-3 text-sm font-medium"
                  style={getAdaptiveButton(theme, 'primary')}
                >
                  确认使用
                </button>
              </div>
            </div>
          )}

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

      {activeTab === 'title' && (
        <div className="mx-4 mt-4">
          <h3 className="text-sm font-medium text-text-muted mb-3">选择称号</h3>
          
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">无称号</p>
            <button
              onClick={() => handleSelectTitle(null)}
              className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all ${
                !user?.activeTitle && !previewTitle
                  ? 'ring-2 ring-primary bg-white'
                  : 'bg-white border-2 border-dashed border-gray-300 text-gray-400'
              }`}
            >
              <span>不显示称号</span>
            </button>
          </div>

          {(['N', 'R', 'SR', 'SSR'] as RarityType[]).map(rarity => {
            const titles = allTitles.filter(t => t.rarity === rarity);
            if (titles.length === 0) return null;
            const config = rarityConfig[rarity];
            
            return (
              <div key={rarity} className="mb-4">
                <p className="text-xs font-medium mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                  {config.label} ({titles.filter(t => isTitleUnlocked(t)).length}/{titles.length})
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {titles.map(title => {
                    const unlocked = isTitleUnlocked(title);
                    const selected = user?.activeTitle === title.id && !previewTitle;
                    
                    return (
                      <div key={title.id} className="flex flex-col items-center">
                        <button
                          onClick={() => unlocked ? handleSelectTitle(title) : setPreviewTitle(title)}
                          className={`relative w-full min-h-[72px] overflow-hidden rounded-xl px-3 py-3 transition-all ${
                            selected
                              ? 'ring-2 ring-primary'
                              : unlocked
                              ? 'hover:scale-105'
                              : 'opacity-60'
                          }`}
                          style={{ background: title.gradient }}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-lg">{title.icon}</span>
                            <span className="text-sm font-semibold" style={{ color: title.textColor }}>
                              {title.name}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-center gap-1.5">
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                              style={{ backgroundColor: 'rgba(255,255,255,0.55)', color: config.color }}
                            >
                              {title.rarity}
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                              style={{
                                backgroundColor: selected ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.45)',
                                color: title.textColor,
                              }}
                            >
                              {selected ? '已佩戴' : unlocked ? '佩戴' : '未获得'}
                            </span>
                          </div>
                          {!unlocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                              <Sparkles size={16} className="text-white" />
                            </div>
                          )}
                        </button>
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
