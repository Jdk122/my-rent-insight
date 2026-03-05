import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';

interface AgentLeadModalProps {
  open: boolean;
  onClose: () => void;
  prefillBedrooms?: number;
  zip?: string;
  currentRent?: number;
  proposedRent?: number;
  propertyType?: string;
  verdictLabel?: string;
  fairnessScore?: number | null;
}

const bedroomOptions = ['Studio', '1 BR', '2 BR', '3 BR', '4+ BR'];
const bathroomOptions = ['1', '1.5', '2', '2.5', '3+'];
const moveDateOptions = ['ASAP', '1–2 months', '3–4 months', '5–6 months', 'Not sure yet'];

const AgentLeadModal = ({
  open, onClose, prefillBedrooms = 1, zip, currentRent, proposedRent,
  propertyType, verdictLabel, fairnessScore,
}: AgentLeadModalProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bedrooms, setBedrooms] = useState(bedroomOptions[prefillBedrooms] || '1 BR');
  const [bathrooms, setBathrooms] = useState('1');
  const [moveDate, setMoveDate] = useState('');
  const [neighborhoods, setNeighborhoods] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from('agent_leads' as any).insert({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        bedrooms,
        bathrooms,
        move_date: moveDate || null,
        neighborhoods: neighborhoods.trim() || null,
        zip: zip || null,
        current_rent: currentRent || null,
        proposed_rent: proposedRent || null,
        property_type: propertyType || null,
        verdict_label: verdictLabel || null,
        fairness_score: fairnessScore ?? null,
      } as any);
      trackEvent('agent_lead_captured', { zip: zip || '', bedrooms, verdict_label: verdictLabel || '' });
      setSubmitted(true);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(() => { setSubmitted(false); setName(''); setEmail(''); setPhone(''); setNeighborhoods(''); setMoveDate(''); }, 300);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-[480px] bg-card rounded-xl shadow-xl border border-border/40 overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              onClick={handleClose}
              className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="p-6 sm:p-8">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">You're all set!</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We'll connect you with a vetted local specialist within 24 hours.
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-6 text-sm font-medium text-primary hover:underline"
                  >
                    Back to results
                  </button>
                </motion.div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Find Apartments in Your Budget</h3>
                  <p className="text-sm text-muted-foreground mb-6">A local rental specialist will reach out with options near you — completely free.</p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-foreground/80 mb-1 block">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                        placeholder="Jane Smith"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-foreground/80 mb-1 block">Email *</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                          placeholder="you@email.com"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground/80 mb-1 block">Phone</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-foreground/80 mb-1 block">Bedrooms</label>
                        <select
                          value={bedrooms}
                          onChange={e => setBedrooms(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow appearance-none"
                        >
                          {bedroomOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground/80 mb-1 block">Bathrooms</label>
                        <select
                          value={bathrooms}
                          onChange={e => setBathrooms(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow appearance-none"
                        >
                          {bathroomOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground/80 mb-1 block">Preferred Move Date</label>
                      <select
                        value={moveDate}
                        onChange={e => setMoveDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow appearance-none"
                      >
                        <option value="">Select timing</option>
                        {moveDateOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground/80 mb-1 block">Preferred Neighborhoods <span className="text-muted-foreground font-normal">(optional)</span></label>
                      <input
                        type="text"
                        value={neighborhoods}
                        onChange={e => setNeighborhoods(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                        placeholder="e.g. Hoboken, Downtown JC"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-105 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                      ) : (
                        'Find My Match'
                      )}
                    </button>

                    <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
                      100% free. No spam. We connect you with one vetted local specialist.
                    </p>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AgentLeadModal;
