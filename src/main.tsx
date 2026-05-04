import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppErrorBoundary from './components/system/AppErrorBoundary.tsx'
import { RootProvider } from './store/RootProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <RootProvider>
      <App />
    </RootProvider>
  </AppErrorBoundary>,
)
