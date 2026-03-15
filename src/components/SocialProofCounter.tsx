import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SocialProofCounter = () => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc('get_analyses_count').then(({ data }) => {
      if (typeof data === 'number' && data >= 500) setCount(data);
    });
  }, []);

  if (count === null) return null;

  return (
    <div className="flex items-center gap-2 py-2 w-fit">
      <span className="text-primary text-sm">🔍</span>
      <p className="text-[13px] md:text-[14px] text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{count.toLocaleString()}</span> renewals analyzed so far
      </p>
    </div>
  );
};

export default SocialProofCounter;
