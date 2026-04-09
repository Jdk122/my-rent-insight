import { useRef, useEffect, useCallback } from 'react';
import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/integrations/supabase/client';
import { AFFILIATE_LINKS } from '@/lib/affiliateConfig';

interface PartnerCTAProps {
  variant: 'rent_reporting' | 'moving_help' | 'renters_insurance';
  analysisId: string | null;
  verdict: string;
  toolUsed: string;
  city: string;
  zip: string;
  placement: string;
  email?: string | null;
  currentRent?: number | null;
  proposedRent?: number | null;
}

function getRentReportingCopy(verdict: string, currentRent?: number | null, proposedRent?: number | null) {
  const v = verdict.toLowerCase();
  const rentStr = proposedRent ? `$${proposedRent.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo` : (currentRent ? `$${currentRent.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo` : null);

  if (v.includes('overpaying') || v.includes('above market')) {
    return {
      headline: "You're overpaying. At least make it count.",
      subtext: rentStr
        ? `Your ${rentStr} in rent could be building your credit score. Report payments to all 3 bureaus. Those are the same ones your next landlord checks.`
        : 'Your rent could be building your credit score. Report payments to all 3 bureaus. Those are the same ones your next landlord checks.',
      buttonLabel: 'Start reporting rent →',
    };
  }
  if (v.includes('at market') || v.includes('moderate')) {
    return {
      headline: 'Your rent is fair. Now make it work harder.',
      subtext: rentStr
        ? `Every month you pay ${rentStr} in rent, it could be reported to the credit bureaus. Start building credit from the rent you already pay.`
        : 'Every month you pay rent, it could be reported to the credit bureaus. Start building credit from the rent you already pay.',
      buttonLabel: 'Start reporting rent →',
    };
  }
  if (v.includes('good deal') || v.includes('below')) {
    return {
      headline: 'Great deal. Lock in even more value.',
      subtext: "You're already saving on rent. Report your payments to all 3 credit bureaus and build your score while you're at it.",
      buttonLabel: 'Start reporting rent →',
    };
  }
  return {
    headline: 'Your rent could be building your credit.',
    subtext: 'Every month you pay rent, it could be building your credit. Landlords check the same bureaus. Start building credit from rent you already pay.',
    buttonLabel: 'Start reporting rent →',
  };
}

function getRentersInsuranceCopy(verdict: string) {
  const v = verdict.toLowerCase();

  if (v.includes('overpaying') || v.includes('above market') || v.includes('above')) {
    return {
      headline: 'Negotiating? Make sure you\'re covered first.',
      subtext: 'If your landlord doesn\'t budge, you may end up moving. Lock in renters insurance now — it takes 2 minutes and starts at $5/mo.',
      buttonLabel: 'Get a free quote →',
    };
  }
  if (v.includes('at market') || v.includes('moderate')) {
    return {
      headline: 'Your rent is fair. Your stuff should be covered too.',
      subtext: 'Renters insurance protects your belongings for as little as $5/mo. Most landlords require it anyway.',
      buttonLabel: 'Get a free quote →',
    };
  }
  if (v.includes('good deal') || v.includes('below')) {
    return {
      headline: 'Great deal on rent. Now protect what\'s inside.',
      subtext: 'You\'re saving on rent. Renters insurance covers your belongings from theft, fire, and water damage starting at $5/mo.',
      buttonLabel: 'Get a free quote →',
    };
  }
  return {
    headline: 'Renters insurance from $5/mo.',
    subtext: 'Protect your belongings from theft, fire, and water damage. Takes 2 minutes. Most landlords require it.',
    buttonLabel: 'Get a free quote →',
  };
}

const MOVING_HELP_COPY = {
  headline: 'Moving? Save on your move.',
  subtext: 'Compare local movers and get instant quotes. Real reviews, transparent pricing, and help when you need it.',
  buttonLabel: 'Compare movers →',
};

const PartnerCTA = ({
  variant,
  analysisId,
  verdict,
  toolUsed,
  city,
  zip,
  placement,
  email,
  currentRent,
  proposedRent,
}: PartnerCTAProps) => {
  const impressionFired = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const linkType = variant === 'renters_insurance'
    ? 'partner_renters_insurance' as const
    : variant === 'moving_help'
      ? 'partner_moving_help' as const
      : 'partner_rent_reporting' as const;

  const copy = variant === 'moving_help'
    ? MOVING_HELP_COPY
    : variant === 'renters_insurance'
      ? getRentersInsuranceCopy(verdict)
      : getRentReportingCopy(verdict, currentRent, proposedRent);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionFired.current) {
          impressionFired.current = true;

          trackEvent('affiliate_impression', {
            link_type: linkType,
            verdict,
            tool_used: toolUsed,
            city,
            zip,
            placement,
          });

          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [analysisId, verdict, toolUsed, city, zip, placement, linkType]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    trackEvent('affiliate_click', {
      link_type: linkType,
      verdict,
      tool_used: toolUsed,
      city,
      zip,
      placement,
    });

    const row: Record<string, string | null> = {
      event_type: 'affiliate_click',
      link_type: linkType,
      zip,
      placement,
    };
    if (analysisId) row.analysis_id = analysisId;
    if (email) row.email = email;

    supabase
      .from('referral_clicks')
      .insert(row as any)
      .then(() => {});

    window.open(AFFILIATE_LINKS[variant], '_blank', 'noopener,noreferrer');
  }, [analysisId, verdict, toolUsed, city, zip, placement, linkType, variant, email]);

  const href = AFFILIATE_LINKS[variant];

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-border border-l-[3px] border-l-primary bg-secondary/50 px-4 py-4"
    >
      <p className="text-[14px] font-medium text-foreground">{copy.headline}</p>
      <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{copy.subtext}</p>
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={handleClick}
        className="mt-2 inline-block rounded-md bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
      >
        {copy.buttonLabel}
      </a>
      <p className="text-[10px] text-muted-foreground/40 mt-2">
        RenewalReply may earn a commission at no cost to you.{' '}
        <a href="/privacy" className="underline hover:text-muted-foreground">Learn more</a>
      </p>
    </div>
  );
};

export default PartnerCTA;
