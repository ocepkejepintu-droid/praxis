'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const baseNavItems = [
  ['/', 'Home', 'Home'],
  ['/praxies', 'Praxies', 'Praxis'],
  ['/radar', 'Runs', 'Runs'],
  ['/repos', 'Sources', 'Sources'],
] as const;

export function NavLinks({ showAgentDashboard = false }: { showAgentDashboard?: boolean }) {
  const pathname = usePathname();
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const navItems = showAgentDashboard ? [...baseNavItems.slice(0, 2), ['/dashboard', 'Dashboard', 'Dash'] as const, ...baseNavItems.slice(2)] : baseNavItems;

  useEffect(() => {
    const active = activeLinkRef.current;
    const nav = active?.parentElement;
    if (!active || !nav) return;
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2;
  }, [pathname]);

  return (
    <nav className="dcNav" aria-label="Primary navigation">
      {navItems.map(([href, label, shortLabel]) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link href={href} key={href} ref={active ? activeLinkRef : undefined} aria-current={active ? 'page' : undefined}>
            <span className="navFullLabel">{label}</span>
            <span className="navShortLabel">{shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
