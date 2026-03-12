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

const SIZE = 200;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

// Arc from 180° to 0° (left to right, top half)
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

const ARC_START = polarToCartesian(CENTER, CENTER, RADIUS, 180);
const ARC_END = polarToCartesian(CENTER, CENTER, RADIUS, 0);
const ARC_PATH = `M ${ARC_START.x} ${ARC_START.y} A ${RADIUS} ${RADIUS} 0 0 1 ${ARC_END.x} ${ARC_END.y}`;

// Tick marks at specific positions
const TICKS = [0, 20, 40, 60, 80, 100];

function tickPosition(value: number) {
  const angle = 180 - (value / 100) * 180; // 180° (left) to 0° (right)
  return polarToCartesian(CENTER, CENTER, RADIUS, angle);
}

function tickOuter(value: number) {
  const angle = 180 - (value / 100) * 180;
  return polarToCartesian(CENTER, CENTER, RADIUS + STROKE / 2 + 3, angle);
}

function tickLabelPos(value: number) {
  const angle = 180 - (value / 100) * 180;
  return polarToCartesian(CENTER, CENTER, RADIUS + STROKE / 2 + 14, angle);
}

const NEEDLE_LENGTH = RADIUS - STROKE / 2 - 8;

const FairnessScoreGauge = ({ score, dynamicMessage, componentSources, contextNotes }: FairnessScoreGaugeProps) => {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  const needleAngle = useMotionValue(180); // start at left (score 0)
  const targetAngle = 180 - (score.total / 100) * 180;

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    animate(needleAngle, targetAngle, {
      duration: 1.4,
      delay: 0.5,
      ease: [0.16, 1, 0.3, 1],
    });
  }, [targetAngle, needleAngle]);

  // Needle tip position
  const needleX = useTransform(needleAngle, (a) => {
    const rad = (a * Math.PI) / 180;
    return CENTER + NEEDLE_LENGTH * Math.cos(rad);
  });
  const needleY = useTransform(needleAngle, (a) => {
    const rad = (a * Math.PI) / 180;
    return CENTER - NEEDLE_LENGTH * Math.sin(rad);
  });

  return (
    <div className="flex flex-col items-center w-full">
      {/* Gauge */}
      <div className="relative" style={{ width: SIZE, height: CENTER + 20 }}>
        <svg
          width={SIZE}
          height={CENTER + 20}
          viewBox={`0 0 ${SIZE} ${CENTER + 20}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="fsg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(0, 72%, 50%)" />
              <stop offset="20%" stopColor="hsl(15, 85%, 50%)" />
              <stop offset="40%" stopColor="hsl(35, 92%, 50%)" />
              <stop offset="55%" stopColor="hsl(48, 96%, 50%)" />
              <stop offset="75%" stopColor="hsl(80, 60%, 48%)" />
              <stop offset="100%" stopColor="hsl(142, 71%, 42%)" />
            </linearGradient>
          </defs>

          {/* Full gradient arc */}
          <path
            d={ARC_PATH}
            fill="none"
            stroke="url(#fsg-grad)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />

          {/* Tick marks */}
          {TICKS.map((v) => {
            const inner = tickPosition(v);
            const outer = tickOuter(v);
            return (
              <line
                key={v}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="hsl(var(--foreground) / 0.25)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}

          {/* Tick labels */}
          {TICKS.map((v) => {
            const pos = tickLabelPos(v);
            return (
              <text
                key={`label-${v}`}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 9, fontWeight: 500 }}
              >
                {v}
              </text>
            );
          })}

          {/* Animated needle */}
          <motion.line
            x1={CENTER}
            y1={CENTER}
            x2={needleX}
            y2={needleY}
            stroke="hsl(var(--foreground) / 0.75)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Pivot circle */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={5}
            fill="hsl(var(--foreground) / 0.7)"
            stroke="hsl(var(--card))"
            strokeWidth={2}
          />
        </svg>

        {/* Scale endpoint labels */}
        <span
          className="absolute text-[9px] font-semibold text-muted-foreground"
          style={{ left: ARC_START.x - STROKE / 2, top: CENTER + 6, transform: 'translateX(-50%)' }}
        >
          Unfair
        </span>
        <span
          className="absolute text-[9px] font-semibold text-muted-foreground"
          style={{ left: ARC_END.x + STROKE / 2, top: CENTER + 6, transform: 'translateX(-50%)' }}
        >
          Fair
        </span>

        {/* Score number — centered inside arc */}
        <div
          className="absolute inset-x-0 flex flex-col items-center"
          style={{ top: CENTER - 38 }}
        >
          <motion.span
            className={`font-display text-[42px] tracking-tight leading-none ${score.tierColor}`}
            style={{ letterSpacing: '-0.03em' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            {score.total}
          </motion.span>
          <motion.span
            className={`font-display text-[15px] tracking-tight ${score.tierColor} mt-0.5`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            {score.tierLabel}
          </motion.span>
        </div>
      </div>

      {/* Branded label */}
      <motion.div
        className="text-center -mt-2"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          RenewalReply Fairness Score™
        </p>
      </motion.div>

      {/* Dynamic verdict message */}
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
