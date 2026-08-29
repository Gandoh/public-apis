import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class Boundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 40, fontFamily: 'system-ui' }}>
          <h2>Something broke.</h2>
          <pre style={{ color: '#ff7286', whiteSpace: 'pre-wrap' }}>{String(this.state.err)}</pre>
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>
);

// Register the service worker (required for an installable PWA / Play Store TWA).
// Only in production builds — it would fight Vite's dev HMR otherwise.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* non-fatal: the app works fine without offline support */
    });
  });
}
