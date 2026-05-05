import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  const raw = localStorage.getItem('echo.settings.prefs');
  const theme = raw ? JSON.parse(raw)?.theme : null;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = 'dark';
  } else {
    document.documentElement.dataset.theme = 'light';
  }
} catch {
  // ignore — fall back to default light theme
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
