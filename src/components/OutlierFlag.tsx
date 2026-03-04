interface OutlierFlagProps {
  yoy: number | null;
  /** Threshold above which to show warning (default 20) */
  threshold?: number;
}

/**
 * Inline warning when a YoY figure exceeds ±threshold%.
 */
const OutlierFlag = ({ yoy, threshold = 20 }: OutlierFlagProps) => {
  if (yoy === null || Math.abs(yoy) <= threshold) return null;

  return (
    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 italic">
      ⚠ This figure may reflect limited data rather than actual market movement.
    </p>
  );
};

export default OutlierFlag;
