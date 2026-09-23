import { useState, type CSSProperties } from 'react';
import { ImageOff, RefreshCw } from 'lucide-react';
import { useUser } from '@/store/UserContext';
import { useTruthMedia } from './useTruthMedia';

interface Props { src: string; alt: string; className?: string; style?: CSSProperties; onLoad?: () => void }

export default function AuthImage({ src, alt, className, style, onLoad }: Props) {
  const { url, error, expired, retry } = useTruthMedia(src);
  const { navigate } = useUser();
  const [failedUrl, setFailedUrl] = useState('');
  if (error || (url && failedUrl === url)) return <div className={`truth-media-state ${className || ''}`} style={style}>
    <ImageOff size={24} /><span role="alert">{error?.message || '图片无法解码，请重试。'}</span>
    {expired ? <button className="truth-button" onClick={() => navigate('login')}>重新登录</button> : <button className="truth-button" onClick={retry}><RefreshCw size={15} />重试图片</button>}
  </div>;
  if (!url) return <div className={`truth-media-state ${className || ''}`} style={style} role="status" aria-label={`正在加载${alt}`}>正在加载图片…</div>;
  return <img src={url} alt={alt} className={className} style={style} onLoad={onLoad} onError={() => { console.warn('求真图片解码失败'); setFailedUrl(url); }} />;
}
