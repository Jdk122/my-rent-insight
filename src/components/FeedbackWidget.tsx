import { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';

interface FeedbackWidgetProps {
  analysisId: string;
  page: 'renewal_results' | 'wsip_results';
  verdictSnapshot?: string | null;
  scoreSnapshot?: number | null;
  confidenceSnapshot?: string | null;
}

const REASONS = [
  'Comps seem off',
  'Market estimate seems wrong',
  'Too vague',
  'I disagree with the verdict',
  'Something else',
];

type Phase = 'idle' | 'submitting' | 'reasons' | 'comment' | 'done' | 'hidden';

const FeedbackWidget = ({
  analysisId,
  page,
  verdictSnapshot,
  scoreSnapshot,
  confidenceSnapshot,
}: FeedbackWidgetProps) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Check if feedback already exists
  useEffect(() => {
    if (!analysisId) return;
    supabase
      .from('user_feedback' as any)
      .select('id')
      .eq('analysis_id', analysisId)
      .eq('page', page)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPhase('hidden');
      });
  }, [analysisId, page]);

  const submitRating = useCallback(async (rating: 'positive' | 'negative') => {
    setPhase('submitting');
    try {
      const { data, error } = await supabase
        .from('user_feedback' as any)
        .insert({
          analysis_id: analysisId,
          rating,
          page,
          verdict_snapshot: verdictSnapshot ?? null,
          score_snapshot: scoreSnapshot ?? null,
          confidence_snapshot: confidenceSnapshot ?? null,
        } as any)
        .select('id')
        .single();

      if (error) throw error;
      setFeedbackId((data as any)?.id ?? null);
      trackEvent('lease_info_saved', { action: 'feedback', page, rating });

      if (rating === 'positive') {
        setPhase('done');
      } else {
        setPhase('reasons');
      }
    } catch (err) {
      console.error('[FeedbackWidget] insert failed:', err);
      setPhase('idle');
    }
  }, [analysisId, page, verdictSnapshot, scoreSnapshot, confidenceSnapshot]);

  const submitReason = useCallback(async (reason: string) => {
    setSelectedReason(reason);
    if (!feedbackId) return;
    await supabase
      .from('user_feedback' as any)
      .update({ reason } as any)
      .eq('id', feedbackId);
    
    setPhase('comment');
  }, [feedbackId, page]);

  const submitComment = useCallback(async () => {
    if (!feedbackId) { setPhase('done'); return; }
    setSubmittingUpdate(true);
    await supabase
      .from('user_feedback' as any)
      .update({ comment } as any)
      .eq('id', feedbackId);
    trackEvent('feedback_comment', { page });
    setSubmittingUpdate(false);
    setPhase('done');
  }, [feedbackId, comment, page]);

  if (phase === 'hidden') return null;

  return (
    <div className="py-4">
      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div
            key="ask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-3"
          >
            <span className="text-sm text-muted-foreground">Was this analysis helpful?</span>
            <button
              onClick={() => submitRating('positive')}
              className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Yes, helpful"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => submitRating('negative')}
              className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Not helpful"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {phase === 'submitting' && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center"
          >
            <span className="text-sm text-muted-foreground">Saving…</span>
          </motion.div>
        )}

        {phase === 'reasons' && (
          <motion.div
            key="reasons"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <span className="text-sm text-muted-foreground">What felt off?</span>
            <div className="flex flex-wrap justify-center gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => submitReason(r)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'comment' && (
          <motion.div
            key="comment"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 max-w-md mx-auto"
          >
            <span className="text-sm text-muted-foreground">
              Tell us more <span className="text-muted-foreground/60">(optional)</span>
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What could we improve?"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={submitComment}
                disabled={submittingUpdate}
                className="text-xs px-4 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Submit
              </button>
              <button
                onClick={() => setPhase('done')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center"
          >
            <span className="text-sm text-muted-foreground">Thanks for your feedback!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FeedbackWidget;
