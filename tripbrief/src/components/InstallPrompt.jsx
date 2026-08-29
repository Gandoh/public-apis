import { useEffect, useState } from 'react';

/**
 * Shows an "Install app" button when Chrome fires beforeinstallprompt.
 * Hidden automatically when already running as an installed PWA / inside the
 * Play Store TWA shell (display-mode: standalone).
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('tb:noinstall') === '1');

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) return;

    function onPrompt(e) {
      e.preventDefault();
      setDeferred(e);
    }
    function onInstalled() {
      setDeferred(null);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred || hidden) return null;

  return (
    <div className="install-bar">
      <span className="ib-icon">✈</span>
      <div className="ib-text">
        <b>Install Trip Brief</b>
        <span>Add it to your home screen — works offline for places you've viewed.</span>
      </div>
      <button
        className="btn primary sm"
        onClick={async () => {
          deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
      >
        Install
      </button>
      <button
        className="btn ghost sm"
        onClick={() => {
          sessionStorage.setItem('tb:noinstall', '1');
          setHidden(true);
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
