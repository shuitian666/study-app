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
 *    - SSR(传说)：动态特效（暂不支持）
 * 3. 背景选择：设置学习背景
 * 4. 预览功能：可预览未获得的头像框
 */

import { useState, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { Sparkles, Upload, X } from 'lucide-react';

type TabType = 'avatar' | 'frame' | 'background';

// 稀有度配置
const rarityConfig = {
  N: { label: '普通', color: '#9ca3af', gradient: 'linear-gradient(135deg, #94a3b8, #64748b)' },
  R: { label: '稀有', color: '#3b82f6', gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)' },
  SR: { label: '史诗', color: '#a855f7', gradient: 'linear-gradient(135deg, #c084fc, #9333ea)' },
  SSR: { label: '传说', color: '#f59e0b', gradient: 'linear-gradient(135deg, #fbbf24, #d97706)' },
};

type RarityType = 'N' | 'R' | 'SR' | 'SSR';

// 头像框配置
interface FrameConfig {
  id: string;
  name: string;
  icon: string;
  rarity: RarityType;
  gradient: string;
  borderStyle?: string; // 边框样式
  decorations?: string[]; // 装饰元素
  shapeTransform?: string; // 形状变换
}

const allFrames: FrameConfig[] = [
  // N 普通 - 纯色/渐变
  { id: 'frame-n-1', name: '简约银框', icon: '⬜', rarity: 'N', gradient: 'linear-gradient(135deg, #e5e7eb, #9ca3af)' },
  { id: 'frame-n-2', name: '冰川蓝框', icon: '🧊', rarity: 'N', gradient: 'linear-gradient(135deg, #93c5fd, #3b82f6)' },
  { id: 'frame-n-3', name: '翡翠绿框', icon: '💚', rarity: 'N', gradient: 'linear-gradient(135deg, #86efac, #22c55e)' },
  { id: 'frame-n-4', name: '珊瑚红框', icon: '❤️', rarity: 'N', gradient: 'linear-gradient(135deg, #fca5a5, #ef4444)' },
  
  // R 稀有 - 边框+花纹
  { id: 'frame-r-1', name: '星空紫框', icon: '🌌', rarity: 'R', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)', borderStyle: 'dashed' },
  { id: 'frame-r-2', name: '极光蓝框', icon: '🌊', rarity: 'R', gradient: 'linear-gradient(135deg, #67e8f9, #0891b2)', borderStyle: 'double' },
  { id: 'frame-r-3', name: '樱花粉框', icon: '🌸', rarity: 'R', gradient: 'linear-gradient(135deg, #fbcfe8, #ec4899)', borderStyle: 'dotted' },
  
  // SR 史诗 - 形状变化+装饰
  { id: 'frame-sr-1', name: '春日花环', icon: '🌸', rarity: 'SR', gradient: 'linear-gradient(135deg, #fce7f3, #db2777)', decorations: ['🌸', '🌺', '🍃'], shapeTransform: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' },
  { id: 'frame-sr-2', name: '金桂飘香', icon: '🌼', rarity: 'SR', gradient: 'linear-gradient(135deg, #fef3c7, #d97706)', decorations: ['🌼', '🍂'], shapeTransform: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' },
  { id: 'frame-sr-3', name: '紫藤花架', icon: '💜', rarity: 'SR', gradient: 'linear-gradient(135deg, #e9d5ff, #9333ea)', decorations: ['💮', '🌿'], shapeTransform: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
  
  // SSR 传说 - 动态特效（暂用静态表示）
  { id: 'frame-ssr-1', name: '星河璀璨', icon: '✨', rarity: 'SSR', gradient: 'linear-gradient(135deg, #fef9c3, #fbbf24, #f59e0b)', decorations: ['⭐', '✨', '🌟'], shapeTransform: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
  { id: 'frame-ssr-2', name: '永恒钻石', icon: '💎', rarity: 'SSR', gradient: 'linear-gradient(135deg, #a5f3fc, #22d3d3, #06b6d4)', decorations: ['💎', '✨'], shapeTransform: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' },
];

// 背景配置
interface BackgroundConfig {
  id: string;
  name: string;
  rarity: RarityType;
  gradient: string;
  pattern?: string;
}

const allBackgrounds: BackgroundConfig[] = [
  // N 普通
  { id: 'bg-n-1', name: '纯净白', rarity: 'N', gradient: 'linear-gradient(180deg, #ffffff, #f9fafb)' },
  { id: 'bg-n-2', name: '静谧蓝', rarity: 'N', gradient: 'linear-gradient(180deg, #dbeafe, #93c5fd)' },
  { id: 'bg-n-3', name: '薄荷绿', rarity: 'N', gradient: 'linear-gradient(180deg, #dcfce7, #86efac)' },
  
  // R 稀有
  { id: 'bg-r-1', name: '星空夜', rarity: 'R', gradient: 'linear-gradient(180deg, #1e1b4b, #312e81)', pattern: 'stars' },
  { id: 'bg-r-2', name: '极光', rarity: 'R', gradient: 'linear-gradient(180deg, #064e3b, #065f46, #047857)' },
  
  // SR 史诗
  { id: 'bg-sr-1', name: '春日樱', rarity: 'SR', gradient: 'linear-gradient(180deg, #fce7f3, #fbcfe8, #f9a8d4)' },
  { id: 'bg-sr-2', name: '竹林风', rarity: 'SR', gradient: 'linear-gradient(180deg, #f0fdf4, #dcfce7, #bbf7d0)' },
  
  // SSR 传说
  { id: 'bg-ssr-1', name: '银河', rarity: 'SSR', gradient: 'linear-gradient(180deg, #0c0a09, #1c1917, #292524)', pattern: 'galaxy' },
  { id: 'bg-ssr-2', name: '极光绚烂', rarity: 'SSR', gradient: 'linear-gradient(135deg, #1e3a5f, #2563eb, #7c3aed, #db2777)' },
];

// 默认头像
const defaultAvatars = ['👤', '🦊', '🐰', '🐼', '🦁', '🐨', '🐯', '🐸', '🦄', '🐲', '🐱', '🐶', '🦋', '🌟', '💎', '🎭'];

export default function AvatarEditPage() {
  const { state, dispatch, navigate } = useApp();
  const user = state.user;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>('avatar');
  const [previewFrame, setPreviewFrame] = useState<FrameConfig | null>(null);
  const [previewBg, setPreviewBg] = useState<BackgroundConfig | null>(null);

  // 获取当前使用的头像框（如果有预览则用预览的）
  const currentFrame = previewFrame || allFrames.find(f => f.icon === user?.avatarFrame);

  // 处理头像选择
  const handleSelectAvatar = (avatar: string) => {
    if (!user) return;
    dispatch({
      type: 'UPDATE_USER',
      payload: { avatar, customAvatarUrl: undefined }
    });
  };

  // 处理自定义头像上传
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

  // 处理头像框选择
  const handleSelectFrame = (frame: FrameConfig | null) => {
    if (!user) return;
    dispatch({
      type: 'UPDATE_USER',
      payload: { avatarFrame: frame?.icon || null }
    });
    setPreviewFrame(null);
  };

  // 处理背景选择
  const handleSelectBackground = (bg: BackgroundConfig | null) => {
    if (!user) return;
    dispatch({
      type: 'UPDATE_USER',
      payload: { background: bg?.id || null }
    });
    setPreviewBg(null);
  };

  // 检查是否已解锁
  const isFrameUnlocked = (frame: FrameConfig) => {
    return user?.unlockedFrames?.includes(frame.icon) || frame.rarity === 'N';
  };

  const isBackgroundUnlocked = (bg: BackgroundConfig) => {
    return user?.unlockedBackgrounds?.includes(bg.id) || bg.rarity === 'N';
  };

  // 判断是否是自定义头像
  const isCustomAvatar = user?.avatar?.startsWith('data:') || user?.avatar?.startsWith('http');

  // 渲染头像框
  const renderFrame = (frame: FrameConfig, size: 'small' | 'large' = 'small') => {
    const sizeClass = size === 'large' ? 'w-24 h-24 text-5xl' : 'w-12 h-12 text-2xl';
    const padding = size === 'large' ? 'p-1' : 'p-0.5';
    
    return (
      <div className="relative">
        <div
          className={`${sizeClass} rounded-full flex items-center justify-center`}
          style={{
            background: frame.gradient,
            clipPath: frame.shapeTransform || 'circle(50%)',
          }}
        >
          <div className={`bg-white rounded-full flex items-center justify-center ${padding} ${size === 'large' ? 'text-4xl' : 'text-xl'}`}>
            {user?.avatar || '👤'}
          </div>
        </div>
        {/* 装饰元素 */}
        {frame.decorations && frame.decorations.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {frame.decorations.map((dec, i) => (
              <span
                key={i}
                className="absolute text-xs"
                style={{
                  top: i === 0 ? '-8px' : i === 1 ? '50%' : 'auto',
                  bottom: i === 2 ? '-8px' : 'auto',
                  right: i === 1 ? '-8px' : i === 2 ? '0' : 'auto',
                  left: i === 0 ? '50%' : i === 1 ? 'auto' : '0',
                  transform: i === 0 ? 'translateX(-50%)' : i === 1 ? 'translateY(-50%)' : 'none',
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

  const tabs = [
    { key: 'avatar' as TabType, label: '头像', icon: '👤' },
    { key: 'frame' as TabType, label: '头像框', icon: '🖼️' },
    { key: 'background' as TabType, label: '背景', icon: '🎨' },
  ];

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="形象编辑" onBack={() => navigate('profile')} />

      {/* 预览区域 */}
      <div 
        className="mx-4 mt-3 rounded-2xl p-6 flex flex-col items-center relative overflow-hidden"
        style={{
          background: previewBg?.gradient || user?.currentBackground || 'linear-gradient(180deg, #ffffff, #f9fafb)',
          minHeight: '200px',
        }}
      >
        {/* 背景装饰 */}
        {previewBg?.pattern === 'stars' && (
          <div className="absolute inset-0 opacity-50">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
        
        {/* 预览标识 */}
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

        {/* 头像框预览 */}
        <div className="mt-4 relative z-10">
          {renderFrame(currentFrame || { 
            id: 'default', 
            name: '无', 
            icon: '', 
            rarity: 'N', 
            gradient: 'transparent' 
          }, 'large')}
        </div>
        
        <p className="mt-3 text-sm font-medium text-gray-700">
          {user?.nickname || '未登录'}
        </p>
        {currentFrame && (
          <span className="text-xs mt-1 px-2 py-0.5 rounded-full" style={{ color: rarityConfig[currentFrame.rarity].color, backgroundColor: 'rgba(255,255,255,0.8)' }}>
            {currentFrame.name}
          </span>
        )}
      </div>

      {/* Tab 切换 */}
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

      {/* 头像选择 */}
      {activeTab === 'avatar' && (
        <div className="mx-4 mt-4">
          <h3 className="text-sm font-medium text-text-muted mb-3">选择头像</h3>
          
          {/* 上传自定义头像 */}
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">上传自定义头像</p>
            <div className="flex items-center gap-3">
              {/* 当前头像预览 */}
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

          {/* Emoji 头像网格 */}
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

      {/* 头像框选择 */}
      {activeTab === 'frame' && (
        <div className="mx-4 mt-4">
          <h3 className="text-sm font-medium text-text-muted mb-3">选择头像框</h3>
          
          {/* 无头像框 */}
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
              {user?.avatar || '👤'}
            </button>
          </div>

          {/* 按稀有度分组 */}
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
                          style={{
                            background: unlocked ? undefined : '#f3f4f6',
                          }}
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

      {/* 背景选择 */}
      {activeTab === 'background' && (
        <div className="mx-4 mt-4">
          <h3 className="text-sm font-medium text-text-muted mb-3">选择背景</h3>
          
          {/* 无背景 */}
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">默认背景</p>
            <button
              onClick={() => handleSelectBackground(null)}
              className={`w-24 h-16 rounded-xl flex items-center justify-center text-xs transition-all ${
                !user?.background && !previewBg
                  ? 'ring-2 ring-primary'
                  : 'bg-white border-2 border-dashed border-gray-300 text-gray-400'
              }`}
            >
              默认
            </button>
          </div>

          {/* 按稀有度分组 */}
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
                          {/* 背景装饰 */}
                          {bg.pattern === 'stars' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-white/30 text-xl">🌌</span>
                            </div>
                          )}
                          {bg.pattern === 'galaxy' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-white/30 text-xl">✨</span>
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

      {/* 稀有度说明 */}
      <div className="mx-4 mt-6">
        <h3 className="text-sm font-medium text-text-muted mb-3">稀有度说明</h3>
        <div className="space-y-2">
          {([
            { rarity: 'N' as RarityType, desc: '纯色或渐变边框' },
            { rarity: 'R' as RarityType, desc: '边框带花纹样式' },
            { rarity: 'SR' as RarityType, desc: '形状变化 + 装饰元素' },
            { rarity: 'SSR' as RarityType, desc: '特殊造型 + 动态特效' },
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

      {/* 来源提示 */}
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
