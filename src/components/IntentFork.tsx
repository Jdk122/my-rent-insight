import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/integrations/supabase/client';

interface IntentForkProps {
  analysisId: string | null;
  verdict: string;
  toolUsed: string;
  city: string;
  zip: string;
  placement: string;
  selectedIntent: 'stay' | 'move' | null;
  onIntentSelected: (intent: 'stay' | 'move') => void;
}

const IntentFork = ({
  analysisId,
  verdict,
  toolUsed,
  city,
  zip,
  placement,
  selectedIntent,
  onIntentSelected,
}: IntentForkProps) => {
  const handleSelect = (intent: 'stay' | 'move') => {
    onIntentSelected(intent);

    trackEvent('intent_selected', {
      intent,
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
          event_type: 'intent_selected',
          link_type: intent === 'stay' ? 'intent_stay' : 'intent_move',
          analysis_id: analysisId,
          zip,
          placement,
        } as any)
        .then(() => {});

      supabase
        .from('analyses')
        .update({ user_intent: intent } as any)
        .eq('id', analysisId)
        .then(() => {});
    }
  };

  return (
    <div className="border-t border-border pt-6 text-center">
      <p className="text-[15px] font-semibold text-foreground">What's your next step?</p>
      <p className="text-[13px] text-muted-foreground mt-1 mb-4">We'll show you what to do next.</p>
      <div className="flex gap-3">
        <button
          onClick={() => handleSelect('stay')}
          className={`flex-1 rounded-lg border px-5 py-4 text-left transition-all ${
            selectedIntent === 'stay'
              ? 'border-l-[3px] bg-accent/60 shadow-sm'
              : selectedIntent === 'move'
              ? 'border-border opacity-40'
              : 'border-border hover:bg-muted/50'
          }`}
          style={selectedIntent === 'stay' ? { borderLeftColor: 'hsl(var(--accent-green, 151 50% 38%))' } : { borderLeftColor: 'hsl(var(--accent-green, 151 50% 38%))', borderLeftWidth: '2px' }}
        >
          <p className="text-[13px] font-semibold text-foreground">I want to stay</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Negotiate your renewal</p>
        </button>
        <button
          onClick={() => handleSelect('move')}
          className={`flex-1 rounded-lg border px-5 py-4 text-left transition-all ${
            selectedIntent === 'move'
              ? 'border-l-[3px] bg-primary/10 shadow-sm'
              : selectedIntent === 'stay'
              ? 'border-border opacity-40'
              : 'border-border hover:bg-muted/50'
          }`}
          style={selectedIntent === 'move' ? { borderLeftColor: 'hsl(var(--primary))' } : { borderLeftColor: 'hsl(var(--primary))', borderLeftWidth: '2px' }}
        >
          <p className="text-[13px] font-semibold text-foreground">I want to move</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">See what else is out there</p>
        </button>
      </div>
    </div>
  );
};

export default IntentFork;
