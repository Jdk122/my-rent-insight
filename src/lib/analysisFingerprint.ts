import type { RentFormData } from '@/components/RentForm';

export function getAnalysisFingerprint(formData: RentFormData): string {
  return `${formData.zip}-${formData.currentRent}-${formData.rentIncrease}-${formData.bedrooms}`;
}

interface PaidEntry {
  sessionId: string;
  fingerprint: string;
  timestamp: number;
}

const STORAGE_KEY = 'rr_paid_analyses';
const MAX_ENTRIES = 50;

export function getPaidAnalyses(): PaidEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PaidEntry[];
  } catch {
    return [];
  }
}

export function addPaidAnalysis(entry: PaidEntry): void {
  const entries = getPaidAnalyses();
  entries.push(entry);
  // Keep only the latest MAX_ENTRIES
  const trimmed = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function isAnalysisPaid(fingerprint: string): boolean {
  return getPaidAnalyses().some(e => e.fingerprint === fingerprint);
}
