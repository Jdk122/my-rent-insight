import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SocialProofCounter = () => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc('get_analyses_count').then(({ data }) => {
      if (typeof data === 'number' && data >= 1000) setCount(data);
    });
  }, []);

  if (count === null) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-5 py-2.5 px-4 rounded-full bg-primary/[0.06] border border-primary/10 w-fit mx-auto">
      <span className="text-primary text-sm">🔍</span>
      <p className="text-sm text-muted-foreground font-medium">
        <span className="font-bold text-foreground tabular-nums">{count.toLocaleString()}</span> renewals analyzed so far
      </p>
    </div>
  );
};

export default SocialProofCounter;
