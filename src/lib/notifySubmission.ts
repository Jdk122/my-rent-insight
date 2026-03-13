import { supabase } from '@/integrations/supabase/client';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function notifySubmission(
  payload: Record<string, unknown>,
  context: string,
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const { error } = await supabase.functions.invoke('notify-submission', {
        body: payload,
      });

      if (!error) {
        return true;
      }

      console.error(`[notify-submission] ${context} attempt ${attempt} failed:`, error);
    } catch (error) {
      console.error(`[notify-submission] ${context} attempt ${attempt} threw:`, error);
    }

    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  return false;
}
