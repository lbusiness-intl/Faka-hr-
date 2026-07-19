import { useEffect, useState, type ReactNode } from 'react';

// Lightweight hash-based router (no dependency). Routes like:
//   #/  #/onboarding  #/signin  #/signup
//   #/dashboard/admin  #/dashboard/employee  #/super-admin  #/subscription
//   #/dashboard/admin/employees  etc.

function getHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h || '/';
}

export function useRoute() {
  const [route, setRoute] = useState<string>(getHash());
  useEffect(() => {
    const onChange = () => setRoute(getHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string) {
  if (!path.startsWith('/')) path = '/' + path;
  window.location.hash = path;
  window.scrollTo({ top: 0 });
}

export function Link({ to, children, className, onClick }: { to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <a
      href={'#' + to}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
