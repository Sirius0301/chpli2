import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';
import '@chpli2/ui/tokens.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

createRoot(container).render(<App />);
