import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FairnessScoreResult, FMR_COMPONENT_TOOLTIP } from '@/lib/fairnessScore';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, Info } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

export interface ComponentSourceInfo {
  [componentId: string]: string;
}

interface FairnessScoreGaugeProps {
  score: FairnessScoreResult;
  dynamicMessage: React.ReactNode;
  componentSources?: ComponentSourceInfo;
  contextNotes?: React.ReactNode;
}

const W = 200;
const STROKE = 16;
const R = 80;
const CX = W / 2;
const CY = R + STROKE / 2 + 4;
const SVG_H = CY + 4;

function scoreToPoint(s: number, radius: number) {
  const a = Math.PI * (1 - s / 100);
  return { x: CX + radius * Math.cos(a), y: CY - radius * Math.sin(a) };
}

const arcL = scoreToPoint(0, R);
const arcR = scoreToPoint(100, R);
const ARC_D = `M ${arcL.x} ${arcL.y} A ${R} ${R} 0 0 1 ${arcR.x} ${arcR.y}`;

// Shorter needle so it doesn't reach the score text area
const NEEDLE_LEN = R - STROKE / 2 - 20;

const FairnessScoreGauge = ({ score, dynamicMessage, componentSources, contextNotes }: FairnessScoreGaugeProps) => {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  const animScore = useMotionValue(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    animate(animScore, score.total, {
      duration: 1.4,
      delay: 0.5,
      ease: [0.16, 1, 0.3, 1],
    });
  }, [score.total, animScore]);

  const nx = useTransform(animScore, (s) => {
    const a = Math.PI * (1 - s / 100);
    return CX + NEEDLE_LEN * Math.cos(a);
  });
  const ny = useTransform(animScore, (s) => {
    const a = Math.PI * (1 - s / 100);
    return CY - NEEDLE_LEN * Math.sin(a);
  });

  return (
    <div className="flex flex-col items-center w-full">
      {/* Header label — above gauge */}
      <motion.p
        className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-center mb-3"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        RenewalReply Fairness Score™
      </motion.p>

      {/* Gauge */}
      <div className="relative" style={{ width: W, height: SVG_H + 44 }}>
        <svg width={W} height={SVG_H} viewBox={`0 0 ${W} ${SVG_H}`} className="overflow-visible">
          <defs>
            <linearGradient id="fsg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(0, 72%, 50%)" />
              <stop offset="18%" stopColor="hsl(15, 85%, 50%)" />
              <stop offset="38%" stopColor="hsl(38, 92%, 50%)" />
              <stop offset="55%" stopColor="hsl(48, 96%, 50%)" />
              <stop offset="78%" stopColor="hsl(80, 60%, 48%)" />
              <stop offset="100%" stopColor="hsl(142, 71%, 42%)" />
            </linearGradient>
          </defs>

          {/* Full gradient arc */}
          <path d={ARC_D} fill="none" stroke="url(#fsg-grad)" strokeWidth={STROKE} strokeLinecap="round" />

          {/* Needle */}
          <motion.line
            x1={CX} y1={CY}
            x2={nx} y2={ny}
            stroke="hsl(var(--foreground) / 0.65)"
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Pivot dot */}
          <circle cx={CX} cy={CY} r={4} fill="hsl(var(--foreground) / 0.6)" stroke="hsl(var(--card))" strokeWidth={2} />
        </svg>

        {/* Unfair / Fair labels */}
        <span
          className="absolute text-[9px] font-semibold text-muted-foreground"
          style={{ left: arcL.x, top: CY + 6, transform: 'translateX(-50%)' }}
        >
          Unfair
        </span>
        <span
          className="absolute text-[9px] font-semibold text-muted-foreground"
          style={{ left: arcR.x, top: CY + 6, transform: 'translateX(-50%)' }}
        >
          Fair
        </span>

        {/* Score + /100 + tier label — stacked inside arc */}
        <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: CY - 52 }}>
          <motion.span
            className={`font-display text-[42px] leading-none tracking-tight ${score.tierColor}`}
            style={{ letterSpacing: '-0.03em' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            {score.total}
          </motion.span>
          <span className="text-[10px] text-muted-foreground font-medium mt-0.5">/ 100</span>
          <motion.span
            className={`font-display text-[15px] tracking-tight mt-1 ${score.tierColor}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            {score.tierLabel}
          </motion.span>
        </div>
      </div>

      {/* Dynamic verdict message */}
      <motion.div
        className="mt-2 max-w-[460px] text-center"
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
              {score.components.map((comp) => {
                const source = componentSources?.[comp.id];
                const isExpanded = expandedComponent === comp.id;
                return (
                  <div
                    key={comp.id}
                    className={source ? 'cursor-pointer' : ''}
                    onClick={() => source && setExpandedComponent(isExpanded ? null : comp.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-foreground flex items-center gap-1">
                        {comp.label}
                        {comp.id === 'fmr' && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help inline-block" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-relaxed">
                                {FMR_COMPONENT_TOOLTIP}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {comp.estimated && (
                          <span className="text-[10px] text-muted-foreground ml-0.5">
                            ({comp.id === 'momentum' ? 'neutral' : 'est.'})
                          </span>
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
                    {isExpanded && source && (
                      <p className="text-[11px] text-muted-foreground/70 mt-1 pl-0.5">{source}</p>
                    )}
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground leading-relaxed pt-2">
                The Fairness Score combines five independent data points to measure how your rent increase compares to local market conditions.{' '}
                <Link to="/methodology" className="text-primary hover:underline">See methodology →</Link>
              </p>
              {contextNotes && (
                <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
                  {contextNotes}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>
    </div>
  );
};

export default FairnessScoreGauge;
