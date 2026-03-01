import { useState, useEffect } from 'react';

interface Section {
  id: string;
  label: string;
}

interface SectionNavProps {
  sections: Section[];
}

const SectionNav = ({ sections }: SectionNavProps) => {
  const [activeId, setActiveId] = useState(sections[0]?.id || '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the one closest to top
          const top = visible.reduce((a, b) =>
            Math.abs(a.boundingClientRect.top) < Math.abs(b.boundingClientRect.top) ? a : b
          );
          setActiveId(top.target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 }
    );

    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="fixed right-4 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-end gap-3">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => handleClick(s.id)}
          className="group flex items-center gap-2"
          aria-label={`Jump to ${s.label}`}
        >
          <span
            className={`text-[11px] font-medium transition-all duration-200 ${
              activeId === s.id
                ? 'text-foreground opacity-100 translate-x-0'
                : 'text-muted-foreground opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'
            }`}
          >
            {s.label}
          </span>
          <span
            className={`rounded-full transition-all duration-200 ${
              activeId === s.id
                ? 'w-2.5 h-2.5 bg-primary'
                : 'w-1.5 h-1.5 bg-muted-foreground/40 group-hover:bg-muted-foreground'
            }`}
          />
        </button>
      ))}
    </nav>
  );
};

export default SectionNav;
