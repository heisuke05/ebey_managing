"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/owner",
    label: "在庫",
    icon: (
      <path d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4" />
    ),
  },
  {
    href: "/owner/search",
    label: "商品検索",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </>
    ),
  },
  {
    href: "/owner/suggestions",
    label: "AI提案",
    icon: (
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.6.6-1 1.4-1 2.2V16H9v-.3c0-.8-.4-1.6-1-2.2A6 6 0 0 1 12 3z" />
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const active =
            t.href === "/owner"
              ? pathname === "/owner"
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                active ? "text-zinc-900" : "text-zinc-400"
              }`}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.2 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {t.icon}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </div>
      {/* iPhoneのホームバー分の余白 */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
