"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getRole } from "@/lib/client";
import type { Role } from "@/lib/types";

interface Tab {
  href: string;
  label: string;
  icon: ReactNode;
}

const ICON_STOCK = (
  <path d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4" />
);
const ICON_TODO = (
  <>
    <rect x="4" y="4" width="16" height="17" rx="2" />
    <path d="M8 4V3h8v1M8 11l2 2 4-4M8 16h5" />
  </>
);
const ICON_SEARCH = (
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </>
);
const ICON_CALC = (
  <>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 7h6M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h3.5" />
  </>
);
const ICON_AI = (
  <path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.6.6-1 1.4-1 2.2V16H9v-.3c0-.8-.4-1.6-1-2.2A6 6 0 0 1 12 3z" />
);

const SEARCH_TAB: Tab = { href: "/owner/search", label: "商品検索", icon: ICON_SEARCH };
const CALC_TAB: Tab = { href: "/owner/calc", label: "利益計算", icon: ICON_CALC };
const AI_TAB: Tab = { href: "/owner/suggestions", label: "AI提案", icon: ICON_AI };

function tabsForRole(role: Role | null): Tab[] {
  const isParent = role === "father" || role === "mother";
  // ホームタブは役割で切り替え(父母=やること、オーナー/妻=在庫)
  const home: Tab = isParent
    ? { href: "/family", label: "やること", icon: ICON_TODO }
    : { href: "/owner", label: "在庫", icon: ICON_STOCK };
  // 市場調査(商品検索・利益計算)は全員が使える
  const tabs = [home, SEARCH_TAB, CALC_TAB];
  // AI提案は費用が発生するためオーナーのみ
  if (role === "owner") tabs.push(AI_TAB);
  return tabs;
}

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);

  // localStorageはクライアントでのみ読めるためマウント後に判定
  useEffect(() => {
    setRole(getRole());
  }, []);

  const tabs = tabsForRole(role);

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {tabs.map((t) => {
          const active =
            t.href === "/owner" || t.href === "/family"
              ? pathname === t.href
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
