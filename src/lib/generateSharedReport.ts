import { supabase } from '@/integrations/supabase/client';
import { generateShortId } from '@/lib/shortId';

export interface SharedReportPayload {
  zip: string;
  address: string | null;
  bedrooms: number;
  currentRent: number;
  proposedIncrease: number;
  increaseType: 'dollar' | 'percent';
  reportData: Record<string, any>;
}

/**
 * Creates a shared report row and returns the persistent URL.
 * Fire-and-forget safe — returns null on failure.
 */
export async function generateSharedReport(
  payload: SharedReportPayload,
  analysisId?: string | null,
  leadEmail?: string | null,
): Promise<string | null> {
  try {
    const shortId = generateShortId();
    const { error } = await supabase.from('shared_reports' as any).insert({
      short_id: shortId,
      zip_code: payload.zip,
      address: payload.address,
      bedrooms: payload.bedrooms,
      current_rent: payload.currentRent,
      proposed_increase: payload.proposedIncrease,
      increase_type: payload.increaseType,
      report_data: payload.reportData,
      analysis_id: analysisId || null,
      lead_email: leadEmail || null,
    } as any);
    if (error) {
      console.error('[shared-report] insert failed:', error.message);
      return null;
    }
    return `https://www.renewalreply.com/report/${shortId}`;
  } catch (err) {
    console.error('[shared-report] unexpected error:', err);
    return null;
  }
}
