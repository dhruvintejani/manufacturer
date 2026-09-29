import { Toaster } from 'react-hot-toast';

export const ToastProvider = () => (
  <Toaster
    position="top-right"
    toastOptions={{
      duration: 3500,
      style: {
        background: '#fff',
        color: '#0F172A',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        maxWidth: '380px',
      },
      success: {
        iconTheme: { primary: '#10B981', secondary: '#fff' },
      },
      error: {
        iconTheme: { primary: '#EF4444', secondary: '#fff' },
      },
    }}
  />
);
