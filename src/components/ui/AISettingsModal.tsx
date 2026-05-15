import { X, ShieldCheck } from 'lucide-react';

interface AISettingsModalProps {
  show: boolean;
  onClose: () => void;
}

export default function AISettingsModal({ show, onClose }: AISettingsModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold">AI 设置</h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
            <ShieldCheck size={24} />
          </div>
          <div className="text-sm font-semibold text-text-primary">AI 密钥由服务器保管</div>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            平台 DeepSeek Key 和用户自定义 API Key 都不会写入浏览器。请在设置页切换平台 AI 或自定义 OpenAI 兼容接口。
          </p>
        </div>

        <div className="p-4 border-t border-border">
          <button onClick={onClose} className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium">
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
