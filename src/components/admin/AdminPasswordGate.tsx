import { useState } from 'react';
import { Lock } from 'lucide-react';

const ADMIN_PASSWORD = 'renewalreply2026';
const SESSION_KEY = 'rr_admin_authed';

interface Props {
  children: React.ReactNode;
}

export default function AdminPasswordGate({ children }: Props) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 justify-center text-muted-foreground">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-medium">Admin Access</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pw === ADMIN_PASSWORD) {
                sessionStorage.setItem(SESSION_KEY, 'true');
                setAuthed(true);
              } else {
                setError(true);
              }
            }}
            className="space-y-3"
          >
            <input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(false); }}
              placeholder="Password"
              className="w-full px-4 py-3 border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors"
            />
            {error && <p className="text-sm text-destructive">Incorrect password</p>}
            <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity">
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
