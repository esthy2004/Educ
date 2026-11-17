import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { AuthProvider } from '@/hooks/useAuth';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { ServerStatusProvider } from '@/hooks/useServerStatus';
import { ToastProvider } from '@/hooks/useToast';
import '@/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Élément racine #root introuvable dans index.html.');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <ServerStatusProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ServerStatusProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
