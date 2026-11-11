import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/sora/600.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import './styles.css';
import { App } from './App.jsx';

// The owner's pages are a separate file that loads only when someone opens /owner, so visitors to
// the clinic page never download the dashboard.
const Owner = lazy(() => import('./Owner.jsx'));
const isOwnerPage = /^\/owner(\/|$)/.test(window.location.pathname);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isOwnerPage ? (
      <Suspense fallback={null}>
        <Owner />
      </Suspense>
    ) : <App />}
  </StrictMode>,
);
