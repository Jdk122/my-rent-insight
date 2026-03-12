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

const GAUGE_WIDTH = 160;
const GAUGE_HEIGHT = 96;
const STROKE_WIDTH = 12;
const CENTER_X = GAUGE_WIDTH / 2;
const CENTER_Y = GAUGE_HEIGHT - 4;
const RADIUS = 68;

// Build a half-circle arc path (left to right, 180°)
function describeArc(cx: number, cy: number, r: number): string {
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;
  return `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
}

const ARC_PATH = describeArc(CENTER_X, CENTER_Y, RADIUS);
const ARC_LENGTH = Math.PI * RADIUS; // half-circle

const FairnessScoreGauge = ({ score, dynamicMessage, componentSources, contextNotes }: FairnessScoreGaugeProps) => {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  // Animated needle
  const needleAngle = useMotionValue(-90); // start at left (0 score)
  const targetAngle = (score.total / 100) * 180 - 90; // map 0-100 → -90° to +90°

  const needleRef = useRef(false);
  useEffect(() => {
    if (needleRef.current) return;
    needleRef.current = true;
    animate(needleAngle, targetAngle, {
      duration: 1.4,
      delay: 0.4,
      ease: [0.16, 1, 0.3, 1],
    });
  }, [targetAngle, needleAngle]);

  const needleRotate = useTransform(needleAngle, (v) => `rotate(${v}deg)`);

  const NEEDLE_LENGTH = RADIUS - STROKE_WIDTH - 6;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Half-circle gauge */}
      <div className="relative" style={{ width: GAUGE_WIDTH, height: GAUGE_HEIGHT + 36 }}>
        <svg
          width={GAUGE_WIDTH}
          height={GAUGE_HEIGHT}
          viewBox={`0 0 ${GAUGE_WIDTH} ${GAUGE_HEIGHT}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(0, 72%, 51%)" />
              <stop offset="35%" stopColor="hsl(38, 92%, 50%)" />
              <stop offset="60%" stopColor="hsl(48, 96%, 53%)" />
              <stop offset="100%" stopColor="hsl(142, 71%, 45%)" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d={ARC_PATH}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />

          {/* Gradient arc (progress) */}
          <motion.path
            d={ARC_PATH}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={ARC_LENGTH}
            initial={{ strokeDashoffset: ARC_LENGTH }}
            animate={{ strokeDashoffset: ARC_LENGTH * (1 - score.total / 100) }}
            transition={{ duration: 1.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        {/* Needle */}
        <motion.div
          className="absolute"
          style={{
            left: CENTER_X,
            top: CENTER_Y,
            width: 0,
            height: 0,
            rotate: needleRotate,
            transformOrigin: '0 0',
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 2.5,
              height: NEEDLE_LENGTH,
              bottom: 0,
              left: -1.25,
              top: -NEEDLE_LENGTH,
              backgroundColor: `hsl(${score.tierColorHsl})`,
            }}
          />
        </motion.div>

        {/* Pivot dot */}
        <div
          className="absolute rounded-full border-2 border-card"
          style={{
            width: 10,
            height: 10,
            left: CENTER_X - 5,
            top: CENTER_Y - 5,
            backgroundColor: `hsl(${score.tierColorHsl})`,
          }}
        />

        {/* Arc labels */}
        <span
          className="absolute text-[9px] font-medium text-muted-foreground"
          style={{ left: CENTER_X - RADIUS - 2, top: CENTER_Y + 4, transform: 'translateX(-50%)' }}
        >
          Unfair
        </span>
        <span
          className="absolute text-[9px] font-medium text-muted-foreground"
          style={{ left: CENTER_X + RADIUS + 2, top: CENTER_Y + 4, transform: 'translateX(-50%)' }}
        >
          Fair
        </span>

        {/* Score number below pivot */}
        <div className="absolute flex flex-col items-center" style={{ left: 0, right: 0, top: CENTER_Y + 6 }}>
          <motion.span
            className={`font-display text-[32px] tracking-tight leading-none ${score.tierColor}`}
            style={{ letterSpacing: '-0.03em' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            {score.total}
          </motion.span>
          <span className="text-[10px] text-muted-foreground font-medium -mt-0.5">/ 100</span>
        </div>
      </div>

      {/* Tier label */}
      <motion.div
        className="mt-1 text-center"
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
