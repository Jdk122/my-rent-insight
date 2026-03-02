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
    <p className="text-sm text-muted-foreground text-center mt-4">
      🔍 {count.toLocaleString()} renewals analyzed
    </p>
  );
};

export default SocialProofCounter;
