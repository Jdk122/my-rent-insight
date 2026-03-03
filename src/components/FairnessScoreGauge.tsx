import { motion } from 'framer-motion';
import { FairnessScoreResult } from '@/lib/fairnessScore';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';

interface FairnessScoreGaugeProps {
  score: FairnessScoreResult;
  dynamicMessage: React.ReactNode;
}

const GAUGE_SIZE = 140;
const STROKE_WIDTH = 10;
const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const FairnessScoreGauge = ({ score, dynamicMessage }: FairnessScoreGaugeProps) => {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const progress = score.total / 100;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Gauge */}
      <div className="relative" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
        <svg width={GAUGE_SIZE} height={GAUGE_SIZE} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={STROKE_WIDTH}
          />
          {/* Progress ring */}
          <motion.circle
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={`hsl(${score.tierColorHsl})`}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`font-display text-[36px] tracking-tight leading-none ${score.tierColor}`}
            style={{ letterSpacing: '-0.03em' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            {score.total}
          </motion.span>
          <span className="text-[10px] text-muted-foreground font-medium mt-0.5">/ 100</span>
        </div>
      </div>

      {/* Tier label */}
      <motion.div
        className="mt-3 text-center"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          RenewalReply Fairness Score™
        </p>
        <p className={`font-display text-[22px] tracking-tight ${score.tierColor}`} style={{ letterSpacing: '-0.02em' }}>
          {score.tierLabel}
        </p>
      </motion.div>

      {/* Dynamic verdict message with user's data */}
      <motion.div
        className="mt-4 max-w-[460px] text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
      >
        {dynamicMessage}
      </motion.div>

      {/* Collapsible score breakdown */}
      <motion.div
        className="mt-6 w-full max-w-[480px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
      >
        <Collapsible open={breakdownOpen} onOpenChange={(open) => {
          setBreakdownOpen(open);
          if (open) trackEvent('score_details_expanded');
        }}>
          <CollapsibleTrigger className="flex items-center justify-center gap-1.5 w-full py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors group">
            See score details
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${breakdownOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-3 px-2">
              {score.components.map((comp) => (
                <div key={comp.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-foreground">
                      {comp.label}
                      {comp.estimated && (
                        <span className="text-[10px] text-muted-foreground ml-1.5">(est.)</span>
                      )}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-foreground">
                      {comp.score}/{comp.max}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: `hsl(${score.tierColorHsl})` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(comp.score / comp.max) * 100}%` }}
                      transition={{ duration: 0.8, delay: 1 + score.components.indexOf(comp) * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground leading-relaxed pt-2">
                The Fairness Score combines five independent data points to measure how your rent increase compares to local market conditions.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>
    </div>
  );
};

export default FairnessScoreGauge;
