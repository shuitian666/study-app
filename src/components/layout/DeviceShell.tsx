import type { ReactNode } from 'react';

interface DeviceShellProps {
  children: ReactNode;
  screenClassName?: string;
}

export default function DeviceShell({ children, screenClassName = '' }: DeviceShellProps) {
  return (
    <div className="min-h-dvh w-full overflow-hidden bg-white lg:flex lg:items-center lg:justify-center lg:bg-slate-100/80 lg:p-4">
      <div className={`relative h-dvh w-full max-w-none overflow-hidden bg-[#f8f9fa] lg:aspect-[430/820] lg:h-[calc(100dvh-32px)] lg:max-h-[820px] lg:w-auto lg:max-w-none lg:rounded-[38px] lg:border-[6px] lg:border-slate-900/70 lg:shadow-[0_30px_90px_rgba(15,23,42,0.18)] ${screenClassName}`}>
        {children}
      </div>
    </div>
  );
}
