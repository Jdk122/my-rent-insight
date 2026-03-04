interface RentTrendSummaryProps {
  location: string;
  trendYoY: number | null;
}

const RentTrendSummary = ({ location, trendYoY }: RentTrendSummaryProps) => {
  if (trendYoY === null) return null;

  const label = trendYoY > 3 ? 'rising' : trendYoY < -1 ? 'cooling' : 'stable';
  const colorClass = label === 'rising' ? 'text-destructive' : 'text-accent';

  return (
    <p className={`mt-3 text-sm font-medium ${colorClass}`}>
      Rents in {location} are{' '}
      <span className="font-bold">{label}</span>{' '}
      based on the most recent monthly data.
    </p>
  );
};

export default RentTrendSummary;
