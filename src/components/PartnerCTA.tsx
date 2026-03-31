import { useRef, useEffect, useCallback } from 'react';
import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/integrations/supabase/client';
import { AFFILIATE_LINKS } from '@/lib/affiliateConfig';

interface PartnerCTAProps {
  variant: 'rent_reporting' | 'moving_help';
  analysisId: string | null;
  verdict: string;
  toolUsed: string;
  city: string;
  zip: string;
  placement: string;
}

const VARIANTS = {
  rent_reporting: {
    headline: 'Your rent could also be building your credit.',
    subtext:
      'Every month you pay rent, it could be reported to the credit bureaus — the same ones landlords check on you. Start building credit from rent you already pay.',
    buttonLabel: 'Start reporting rent →',
    linkType: 'partner_rent_reporting' as const,
  },
  moving_help: {
    headline: 'Moving? Save on your move.',
    subtext:
      'Compare local movers and get instant quotes. Real reviews, transparent pricing, and help when you need it.',
    buttonLabel: 'Compare movers →',
    linkType: 'partner_moving_help' as const,
  },
} as const;

const PartnerCTA = ({
  variant,
  analysisId,
  verdict,
  toolUsed,
  city,
  zip,
  placement,
}: PartnerCTAProps) => {
  const impressionFired = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const config = VARIANTS[variant];
  const linkType = config?.linkType ?? 'partner_rent_reporting';

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

  const handleClick = useCallback(() => {
    trackEvent('affiliate_click', {
      link_type: linkType,
      verdict,
      tool_used: toolUsed,
      city,
      zip,
      placement,
    });

    if (analysisId) {
      supabase
        .from('referral_clicks')
        .insert({
        event_type: 'affiliate_click',
        link_type: linkType,
        analysis_id: analysisId,
        zip,
        placement,
      } as any)
        .then(() => {});
    }
  }, [analysisId, verdict, toolUsed, city, zip, placement, linkType]);

  if (!config) return null;

  const href = AFFILIATE_LINKS[variant];

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-border bg-secondary/50 px-4 py-4"
    >
      <p className="text-[14px] font-medium text-foreground">{config.headline}</p>
      <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{config.subtext}</p>
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={handleClick}
        className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
      >
        {config.buttonLabel}
      </a>
      <p className="text-[10px] text-muted-foreground/40 mt-2">
        RenewalReply may earn a commission.{' '}
        <a href="/privacy" className="underline hover:text-muted-foreground">Learn more</a>
      </p>
    </div>
  );
};

export default PartnerCTA;
