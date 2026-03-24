import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FairnessScoreResult, FMR_COMPONENT_TOOLTIP, PriceLevelBand } from '@/lib/fairnessScore';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, Info } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';


export interface ComponentSourceInfo {
  [componentId: string]: string;
}

interface FairnessScoreGaugeProps {
  score: FairnessScoreResult;
  dynamicMessage: React.ReactNode;
  componentSources?: ComponentSourceInfo;
  contextNotes?: React.ReactNode;
  /** Rendered at the top of the collapsible, before breakdown bars */
  topNote?: React.ReactNode;
}

const W = 200;
const STROKE = 18;
const R = 78;
const CX = W / 2;
const CY = R + STROKE / 2 + 4;
const SVG_H = CY + 6;

function scoreToPoint(s: number, radius: number) {
  const a = Math.PI * (1 - s / 100);
  return { x: CX + radius * Math.cos(a), y: CY - radius * Math.sin(a) };
}

const arcL = scoreToPoint(0, R);
const arcR = scoreToPoint(100, R);
const ARC_D = `M ${arcL.x} ${arcL.y} A ${R} ${R} 0 0 1 ${arcR.x} ${arcR.y}`;

// Triangle marker pointing inward on the outer edge of the arc
function markerPath(s: number): string {
  const a = Math.PI * (1 - s / 100);
  const outerR = R + STROKE / 2 + 8;
  const tipR = R + STROKE / 2 - 6;
  const spread = 0.09; // radians — wider triangle
  const tip = { x: CX + tipR * Math.cos(a), y: CY - tipR * Math.sin(a) };
  const left = { x: CX + outerR * Math.cos(a + spread), y: CY - outerR * Math.sin(a + spread) };
  const right = { x: CX + outerR * Math.cos(a - spread), y: CY - outerR * Math.sin(a - spread) };
  return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`;
}

const FairnessScoreGauge = ({ score, dynamicMessage, componentSources, contextNotes, topNote }: FairnessScoreGaugeProps) => {
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

  const markerD = useTransform(animScore, (s) => markerPath(s));

  return (
    <div className="flex flex-col items-center w-full">
      {/* Header label */}
      <motion.p
        className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-center mb-2"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        RenewalReply Fairness Score™
      </motion.p>

      {/* Gauge */}
      <div className="relative" style={{ width: W, height: SVG_H + 36 }}>
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

          {/* Animated triangle marker on outer edge */}
          <motion.path
            d={markerD}
            fill="hsl(var(--foreground) / 0.8)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          />
        </svg>

        {/* Unfair / Good deal */}
        <span
          className="absolute text-[11px] font-semibold text-foreground/60 tracking-wide"
          style={{ left: arcL.x, top: CY + 8, transform: 'translateX(-50%)' }}
        >
          Overpaying
        </span>
        <span
          className="absolute text-[10px] font-semibold text-foreground/60 tracking-wide whitespace-nowrap"
          style={{ left: arcR.x, top: CY + 8, transform: 'translateX(-50%)' }}
        >
          Good Deal
        </span>

        {/* Score + /100 + tier — centered inside arc */}
        <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: CY - 58 }}>
          <motion.span
            className={`font-display text-[48px] leading-none font-bold tracking-tight ${score.tierColor}`}
            style={{ letterSpacing: '-0.03em' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            {score.total}
          </motion.span>
          <span className="text-[11px] text-foreground/40 font-semibold mt-1">/ 100</span>
          <motion.span
            className={`font-display text-[17px] font-semibold tracking-tight mt-2.5 ${score.tierColor}`}
            style={{ letterSpacing: '-0.01em' }}
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

      {/* Score basis attribution (v2.3) */}
      {score.scoreBasisMessage && (
        <motion.p
          className="text-[11px] text-muted-foreground/60 text-center mt-1 max-w-[400px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.4 }}
        >
          {score.scoreBasisMessage}
        </motion.p>
      )}

      {/* Collapsible score breakdown */}
      <motion.div
        className="mt-0.5 mb-0.5 w-full max-w-[480px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
      >
        <Collapsible open={breakdownOpen} onOpenChange={(open) => {
          setBreakdownOpen(open);
        }}>
          <CollapsibleTrigger data-score-details className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium text-muted-foreground/60 hover:text-foreground transition-colors group">
            See score details
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${breakdownOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent data-score-details>
            <div className="mt-2 space-y-3 px-2">
              {topNote && (
                <div className="mb-3">
                  {topNote}
                </div>
              )}
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
                The Fairness Score combines four independent data points to measure how your rent increase compares to local market conditions.{' '}
                <Link to="/methodology" className="text-primary hover:underline">See methodology →</Link>
              </p>
              {/* Decoupled market note (v2.3) */}
              {score.decoupledMarketNote && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 p-3 mt-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {score.decoupledMarketNote}
                  </p>
                </div>
              )}
              {/* Building echo chamber note (v2.3) */}
              {score.buildingEchoChamberNote && (
                <p className="text-[11px] text-muted-foreground/70 mt-2 italic">
                  {score.buildingEchoChamberNote}
                </p>
              )}
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
