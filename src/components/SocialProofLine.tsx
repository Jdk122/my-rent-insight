import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Inline social proof text for use near capture points */
const SocialProofLine = ({ inline }: { inline?: boolean }) => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc('get_analyses_count').then(({ data }) => {
      if (typeof data === 'number') setCount(data);
    });
  }, []);

  if (count === null) return null;

  const text =
    count >= 500
      ? `Join ${count.toLocaleString()} renters who've checked their increase`
      : 'Free. No account required.';

  if (inline) return <>{text}</>;

  return (
    <p className="text-xs text-muted-foreground">
      {text}
    </p>
  );
};

export default SocialProofLine;
