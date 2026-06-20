"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/review", label: "Review", icon: "🎴" },
  { href: "/reader", label: "Read", icon: "📖" },
  { href: "/dashboard", label: "Progress", icon: "📊" },
];

export default function BottomNav() {
  const pathname = usePathname();
  // Hide on the login screen.
  if (pathname === "/login") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                  active ? "text-orange-700" : "text-stone-500 hover:text-stone-700"
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
