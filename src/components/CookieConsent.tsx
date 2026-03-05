import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'rr_cookie_consent';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so it doesn't flash on initial paint
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[80] px-4 pb-4 pointer-events-none">
      <div className="max-w-lg mx-auto bg-card border border-border rounded-xl px-5 py-4 shadow-lg pointer-events-auto flex items-center gap-3 sm:gap-4 text-sm">
        <p className="text-muted-foreground text-[13px] leading-snug flex-1">
          We use cookies to improve your experience and analyze site traffic.{' '}
          <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>
        </p>
        <button
          onClick={handleAccept}
          className="shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] font-semibold hover:opacity-90 transition-opacity"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
