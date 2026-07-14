import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// --- Cross-origin API routing (Vercel frontend + Render backend) ---
// The whole app calls the API with root-relative paths ("/api/v1/..."). That
// works when the frontend and backend share an origin (local dev, or the
// all-in-one deploy). When the frontend is hosted separately (e.g. Vercel) and
// the backend lives elsewhere (e.g. Render), those relative calls would hit the
// frontend host and fail. Setting VITE_API_BASE_URL to the backend's URL at
// build time makes every "/api/..." request target the backend instead — no
// per-call changes needed, and no CORS errors as long as the backend's
// ALLOWED_ORIGINS includes this frontend's origin.
const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
if (API_BASE) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return originalFetch(`${API_BASE}${input}`, init);
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
