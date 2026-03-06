import { useState } from 'react';
import { Lock } from 'lucide-react';

const SESSION_KEY = 'rr_admin_authed';
const PW_KEY = 'rr_admin_pw';

export function getAdminPassword(): string | null {
  return sessionStorage.getItem(PW_KEY);
}

export function clearAdminSession() {
  sessionStorage.removeItem(PW_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

interface Props {
  children: React.ReactNode;
}

export default function AdminPasswordGate({ children }: Props) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [pw, setPw] = useState('');

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
              // Store password for server-side validation on API calls
              sessionStorage.setItem(PW_KEY, pw);
              sessionStorage.setItem(SESSION_KEY, 'true');
              setAuthed(true);
            }}
            className="space-y-3"
          >
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 border border-border rounded-lg bg-card text-foreground outline-none focus:border-foreground transition-colors"
            />
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
