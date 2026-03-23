interface DealScoreRingProps {
  score: number;
  size?: number;
}

const DealScoreRing = ({ score, size = 40 }: DealScoreRingProps) => {
  const r = size * 0.4;
  const ci = 2 * Math.PI * r;
  const isGreat = score >= 80;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={isGreat ? 'hsl(var(--accent-green))' : 'hsl(var(--primary))'}
          strokeWidth="3"
          strokeDasharray={ci}
          strokeDashoffset={ci - (score / 100) * ci}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-bold"
        style={{ color: isGreat ? 'hsl(var(--accent-green))' : 'hsl(var(--primary))' }}
      >
        {score}
      </span>
    </div>
  );
};

export default DealScoreRing;
