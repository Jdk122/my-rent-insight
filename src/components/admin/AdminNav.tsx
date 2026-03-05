import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Data Quality', path: '/admin/data-quality' },
  { label: 'Lead Dashboard', path: '/admin/leads' },
  { label: 'Market Intelligence', path: '/admin/markets' },
];

export default function AdminNav() {
  const { pathname } = useLocation();

  return (
    <nav className="border-b border-border bg-card sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 flex gap-0 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.path}
            to={t.path}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              pathname === t.path
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
