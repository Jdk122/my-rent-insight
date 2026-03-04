import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateShortId } from '@/lib/shortId';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';
import { Link2, Check, Copy } from 'lucide-react';

interface ShareReportButtonProps {
  reportPayload: {
    zip: string;
    address: string | null;
    bedrooms: number;
    currentRent: number;
    proposedIncrease: number;
    increaseType: 'dollar' | 'percent';
    reportData: Record<string, any>;
  };
  onLinkGenerated?: (url: string) => void;
  analysisId?: string | null;
  leadEmail?: string;
}

const ShareReportButton = ({ reportPayload, onLinkGenerated, analysisId, leadEmail }: ShareReportButtonProps) => {
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (reportUrl) {
      handleCopy();
      return;
    }

    setGenerating(true);
    try {
      const shortId = generateShortId();
      const { error } = await supabase.from('shared_reports' as any).insert({
        short_id: shortId,
        zip_code: reportPayload.zip,
        address: reportPayload.address,
        bedrooms: reportPayload.bedrooms,
        current_rent: reportPayload.currentRent,
        proposed_increase: reportPayload.proposedIncrease,
        increase_type: reportPayload.increaseType,
        report_data: reportPayload.reportData,
        analysis_id: analysisId || null,
        lead_email: leadEmail || null,
      } as any);

      if (error) throw error;

      const url = `${window.location.origin}/report/${shortId}`;
      setReportUrl(url);
      onLinkGenerated?.(url);
      trackEvent('report_shared', { zip: reportPayload.zip });
      trackEvent('report_link_generated', { zip_code: reportPayload.zip, verdict: 'above' });

      // Auto-copy
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success('Report link copied!');
    } catch (err) {
      console.error('Failed to create shared report:', err);
      toast.error('Failed to generate report link. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!reportUrl) return;
    await navigator.clipboard.writeText(reportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success('Link copied!');
  };

  if (reportUrl) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground/80 max-w-[320px] overflow-hidden">
          <Link2 size={14} className="shrink-0 text-muted-foreground" />
          <span className="truncate">{reportUrl}</span>
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:brightness-90 transition-all shadow-sm shadow-primary/20"
        >
          {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={generating}
      data-share-report-btn
      className="inline-flex items-center gap-2 border border-border px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      <Link2 size={16} />
      {generating ? 'Generating…' : 'Share report with landlord'}
    </button>
  );
};

export default ShareReportButton;
