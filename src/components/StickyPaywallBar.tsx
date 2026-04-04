import { useState, useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

interface StickyPaywallBarProps {
  isAboveMarket: boolean;
  isPaid: boolean;
}

export default function StickyPaywallBar({ isAboveMarket, isPaid }: StickyPaywallBarProps) {
  const [visible, setVisible] = useState(false);
  const impressionTracked = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 768) return;
    if (!isAboveMarket || isPaid) return;

    const handleScroll = () => {
      // Don't show if other modals are active
      if (sessionStorage.getItem('rr_exit_intent_shown') || sessionStorage.getItem('rr_mobile_scroll_prompt')) {
        setVisible(false);
        return;
      }

      const evidence = document.getElementById('section-evidence');
      const letter = document.getElementById('section-letter');

      if (!evidence || !letter) return;

      const evidenceRect = evidence.getBoundingClientRect();
      const letterRect = letter.getBoundingClientRect();

      const pastEvidence = evidenceRect.bottom < 0;
      const letterVisible = letterRect.top < window.innerHeight * 0.85;

      setVisible(pastEvidence && !letterVisible);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAboveMarket, isPaid]);

  if (!visible) return null;

  if (!impressionTracked.current) {
    impressionTracked.current = true;
    trackEvent('sticky_bar_impression', { placement: 'mobile_paywall_bar' });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90] bg-foreground text-background px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.15)] md:hidden"
         style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))` }}>
      <button
        onClick={() => {
          trackEvent('sticky_bar_click', { placement: 'mobile_paywall_bar' });
          document.getElementById('section-letter')?.scrollIntoView({ behavior: 'smooth' });
        }}
        className="w-full flex items-center justify-between"
      >
        <span className="text-[14px] font-semibold">Unlock your counter-offer</span>
        <span className="text-[13px] font-bold bg-background/20 px-3 py-1 rounded-full">$4.99 →</span>
      </button>
    </div>
  );
}
