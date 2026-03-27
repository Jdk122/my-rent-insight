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
    headline: 'Staying? Make your rent work for you.',
    subtext:
      'Every month you pay rent, it could be building your credit. Rent reporting sends your payment history to the credit bureaus — the same ones landlords check on you.',
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
  if (!config) return null;
  const linkType = config.linkType;

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

          if (analysisId) {
            supabase
              .from('referral_clicks')
              .insert({
              event_type: 'affiliate_impression',
              link_type: linkType,
              analysis_id: analysisId,
              zip,
              placement,
            } as any)
              .then(() => {});
          }

          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [analysisId, verdict, toolUsed, city, zip, placement, linkType, isRentReporting]);

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

  // moving_help is not rendered onsite in v1
  if (!isRentReporting) return null;

  const config = VARIANTS.rent_reporting;
  const href = AFFILIATE_LINKS[variant];

  return (
    <div
      ref={containerRef}
      className="border-l-[3px] rounded-r-lg bg-secondary pl-4 pr-4 py-4"
      style={{ borderLeftColor: 'hsl(var(--accent-green, 151 50% 38%))' }}
    >
      <p className="text-[11px] text-muted-foreground/60 mb-3 leading-relaxed">
        Disclosure: Some services and listings below include affiliate or referral links. If you use them, RenewalReply may receive compensation at no additional cost to you. Affiliate relationships never influence our rent analysis, fairness scores, or advice.
      </p>
      <p className="text-[13px] font-semibold text-foreground">{config.headline}</p>
      <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{config.subtext}</p>
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={handleClick}
        className="mt-3 inline-block rounded-md px-3.5 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'hsl(var(--accent-green, 151 50% 38%))' }}
      >
        {config.buttonLabel}
      </a>
      <p className="text-[10px] text-muted-foreground/60 mt-2">
        RenewalReply may earn a commission from this partner.
      </p>
    </div>
  );
};

export default PartnerCTA;
