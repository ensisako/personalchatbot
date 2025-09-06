'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LoginLink, RegisterLink, LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components';
import { useKindeAuth } from '@kinde-oss/kinde-auth-nextjs';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/chat', label: 'Chat' },
  { href: '/quiz', label: 'Quiz' },
];

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated, isLoading } = useKindeAuth();

  const initials =
    (user?.given_name?.[0] || '') + (user?.family_name?.[0] || user?.email?.[0] || '');
  const name =
    [user?.given_name, user?.family_name].filter(Boolean).join(' ') ||
    user?.email ||
    'Account';

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden rounded p-2 border"
              aria-label="Toggle menu"
              onClick={() => setOpen(o => !o)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>

            <Link href="/dashboard" className="font-semibold">LeedsBot</Link>

            <div className="ml-6 hidden md:flex md:items-center md:gap-1">
              {links.map(l => {
                const active = pathname?.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cx(
                      'rounded px-3 py-2 text-sm',
                      active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Right side: auth area */}
            {isLoading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : isAuthenticated ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                  {user?.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.picture} alt={name} className="h-7 w-7 rounded-full border object-cover" />
                  ) : (
                    <div className="grid h-7 w-7 place-items-center rounded-full border bg-gray-50 text-xs">
                      {initials.toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[14ch] truncate">{name}</span>
                </div>
                <LogoutLink className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Logout
                </LogoutLink>
              </>
            ) : (
              <>
                <LoginLink className="rounded bg-black px-3 py-1.5 text-sm text-white">
                  Sign in
                </LoginLink>
                <RegisterLink className="rounded border px-3 py-1.5 text-sm">
                  Create account
                </RegisterLink>
              </>
            )}
          </div>
        </div>

        {open && (
          <div className="md:hidden pb-3">
            <div className="flex flex-col gap-1">
              {links.map(l => {
                const active = pathname?.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cx(
                      'rounded px-3 py-2 text-sm',
                      active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
