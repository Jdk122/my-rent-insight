import { useState, useEffect, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SocialProofCounter = forwardRef<HTMLDivElement>((_, ref) => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc('get_analyses_count').then(({ data }) => {
      if (typeof data === 'number' && data >= 1000) setCount(data);
    });
  }, []);

  if (count === null) return null;

  return (
    <div ref={ref} className="flex items-center gap-2 py-2 w-fit">
      <span className="text-primary text-sm">🔍</span>
      <p className="text-[13px] md:text-[14px] text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{count.toLocaleString()}</span> renewals analyzed
      </p>
    </div>
  );
});

SocialProofCounter.displayName = 'SocialProofCounter';

export default SocialProofCounter;
