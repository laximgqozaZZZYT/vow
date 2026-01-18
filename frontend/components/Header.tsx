"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Header() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    // simple click outside to close
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current || !btnRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      if (btnRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // ダッシュボードページではヘッダーを非表示
  if (pathname?.startsWith('/dashboard')) {
    return null;
  }

  return (
    <header className="w-full border-b bg-transparent py-3 px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-semibold">
          VOW
        </Link>
      </div>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-4">
        <Link href="/dashboard" className="text-sm">Dashboard</Link>
        <Link href="/login" className="text-sm">Login</Link>
      </nav>

      {/* Mobile hamburger */}
      <div className="md:hidden">
        <button
          ref={btnRef}
          aria-expanded={open}
          aria-controls="site-nav"
          className="p-2 rounded touch-target"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Toggle menu</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div
            ref={menuRef}
            id="site-nav"
            role="menu"
            className="absolute right-4 top-14 w-48 rounded bg-white shadow-md p-3 z-50"
          >
            <Link role="menuitem" href="/dashboard" className="block py-2 px-2">Dashboard</Link>
            <Link role="menuitem" href="/login" className="block py-2 px-2">Login</Link>
          </div>
        )}
      </div>
    </header>
  );
}
