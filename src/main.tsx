import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppErrorBoundary from './components/system/AppErrorBoundary.tsx'
import { RootProvider } from './store/RootProvider.tsx'
import { registerServiceWorker } from './utils/studyReminder.ts'

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <RootProvider>
      <App />
    </RootProvider>
  </AppErrorBoundary>,
)

if (import.meta.env.PROD) {
  registerServiceWorker().catch(error => {
    console.warn('[PWA] service worker registration failed:', error);
  });
}
