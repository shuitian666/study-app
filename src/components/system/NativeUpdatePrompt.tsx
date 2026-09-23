import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { fetchAndroidAppVersion, type AppVersionResponse } from '@/services/appVersionService';

const DISMISSED_UPDATE_KEY = 'study-app:dismissed-update-code:v1';

export default function NativeUpdatePrompt() {
  const [version, setVersion] = useState<AppVersionResponse | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAndroidAppVersion()
      .then(data => {
        if (cancelled || !data?.updateAvailable || !data.apkUrl) return;
        const dismissedCode = localStorage.getItem(DISMISSED_UPDATE_KEY);
        if (!data.mandatory && dismissedCode === String(data.latestVersionCode)) return;
        setVersion(data);
      })
      .catch(error => {
        console.warn('[AppVersion] update check failed:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!version || hidden) return null;

  const openDownload = () => {
    window.open(version.apkUrl, '_blank', 'noopener,noreferrer');
  };

  const dismiss = () => {
    if (!version.mandatory) {
      localStorage.setItem(DISMISSED_UPDATE_KEY, String(version.latestVersionCode));
      setHidden(true);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/20">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <Download size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                发现新版本 {version.latestVersionName}
              </h2>
              {!version.mandatory && (
                <button type="button" onClick={dismiss} className="rounded-full p-1 text-slate-400 active:bg-slate-100" aria-label="关闭更新提示">
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {version.releaseNotes || '建议更新到最新版本，获得修复和体验改进。'}
            </p>
            {version.mandatory && (
              <p className="mt-1 text-xs font-medium text-red-600">当前版本需要更新后继续使用。</p>
            )}
            <button
              type="button"
              onClick={openDownload}
              className="mt-3 w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white active:bg-cyan-700"
            >
              下载更新
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
