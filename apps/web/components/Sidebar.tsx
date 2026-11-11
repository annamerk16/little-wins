"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/timeline", label: "Timeline" },
  { href: "/map", label: "Map" },
  { href: "/recap", label: "Recap" },
  { href: "/profile", label: "Profile" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="rounded-[22px] bg-[#fdfdfb] p-2 text-[#1e2b1b] shadow-[0_10px_24px_-10px_rgba(30,43,27,0.25),0_0_0_1px_rgba(30,43,27,0.08)] sm:p-3"
    >
      <p className="hidden px-4 pb-3 pt-2 font-display text-xl font-extrabold tracking-[-0.03em] sm:block">
        Little Wins
      </p>
      <ul className="flex gap-1 overflow-x-auto sm:flex-col">
        {LINKS.map(({ href, label }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-full px-3 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b4a27] sm:px-4 ${
                  current ? "bg-[#2b4a27] text-white" : "text-[#2b4a27] hover:bg-[#e9f0e2]"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
