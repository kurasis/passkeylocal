/** Actual app shell with synthetic service doubles; never a product entrypoint. */
import { createRoot } from 'react-dom/client';
import { App } from '../../../pwa/src/ui/App.tsx';
import '../../../pwa/src/styles.css';
createRoot(document.getElementById('root')!).render(<App />);
