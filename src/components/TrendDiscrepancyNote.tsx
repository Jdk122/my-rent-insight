interface TrendDiscrepancyNoteProps {
  alYoY: number | null;
  zoriYoY: number | null;
}

/**
 * Shows a contextual note when Apartment List and Zillow ZORI
 * diverge by more than 3 percentage points.
 */
const TrendDiscrepancyNote = ({ alYoY, zoriYoY }: TrendDiscrepancyNoteProps) => {
  if (alYoY === null || zoriYoY === null) return null;
  const diff = Math.abs(alYoY - zoriYoY);
  if (diff <= 3) return null;

  return (
    <div className="mt-4 rounded-lg bg-muted/50 border border-border px-5 py-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground">Why the difference?</span>{' '}
        Apartment List tracks actual signed leases, which tend to reflect what renters really pay.
        Zillow ZORI tracks listing prices, which can run higher. When the two diverge, the actual
        lease data (Apartment List) is generally the more conservative and reliable indicator of
        market movement.
      </p>
    </div>
  );
};

export default TrendDiscrepancyNote;
