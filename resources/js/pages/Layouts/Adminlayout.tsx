/**
 * AdminLayout.tsx
 *
 * Shared layout component used by all Admin pages.
 * Includes: collapsible sidebar, top header, page content slot.
 *
 * File: resources/js/Layouts/AdminLayout.tsx
 *
 * Usage:
 *   <AdminLayout title="Branches" active="branches">
 *     <YourPageContent />
 *   </AdminLayout>
 */

import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@inertiajs/react";

interface Props {
  children: ReactNode;
  title: string;
  active: "dashboard" | "branches" | "counters" | "users" | "tags" | "settings" | "feedback";
  actions?: ReactNode;
}

// TODO: REPLACE — from Inertia shared props (HandleInertiaRequests middleware)
const MOCK_ADMIN = { name: "System Admin", role: "admin" };

const NAV = [
  { key: "dashboard", icon: "📊", label: "Dashboard",  href: "/admin/dashboard"  },
  { key: "branches",  icon: "🏢", label: "Branches",   href: "/admin/branches"   },
  { key: "counters",  icon: "🖥️", label: "Counters",   href: "/admin/counters"   },
  { key: "users",     icon: "👥", label: "Users",      href: "/admin/users"      },
  { key: "tags",      icon: "🏷️", label: "Tags",       href: "/admin/tags"       },
  { key: "feedback",  icon: "💬", label: "Feedback",   href: "/admin/feedback"   },
  { key: "settings",  icon: "⚙️", label: "Settings",   href: "/admin/settings"   },
];

export default function AdminLayout({ children, title, active, actions }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

      <div className="flex min-h-screen" style={{ background: "#f1f5f9" }}>

        {/* ── Sidebar ── */}
        <motion.aside
          animate={{ width: collapsed ? 64 : 220 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col relative z-20"
          style={{ background: "#0f172a", flexShrink: 0, overflow: "hidden" }}
        >
          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ fontFamily: "'Syne', sans-serif", fontSize: "14px",
                    fontWeight: 800, color: "#ffffff", letterSpacing: "0.04em",
                    whiteSpace: "nowrap" }}>
                  FEEDBACKPRO
                </motion.span>
              )}
            </AnimatePresence>
            <button onClick={() => setCollapsed(c => !c)}
              style={{ background: "rgba(255,255,255,0.06)", border: "none",
                cursor: "pointer", color: "rgba(255,255,255,0.5)",
                width: 30, height: 30, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", flexShrink: 0 }}>
              {collapsed ? "→" : "←"}
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-1 p-3 flex-1">
            {NAV.map(item => {
              const isActive = item.key === active;
              return (
                // TODO: REPLACE anchor with Inertia <Link href={item.href}>
                <Link key={item.key} href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all no-underline"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                    color: isActive ? "#ffffff" : "rgba(255,255,255,0.45)",
                    textDecoration: "none",
                  }}>
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>{item.icon}</span>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                          fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {/* Active indicator dot */}
                  {isActive && (
                    <motion.div layoutId="active-dot"
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "#38bdf8" }} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#38bdf8,#6366f1)" }}>
                {MOCK_ADMIN.name.charAt(0)}
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                      fontWeight: 600, color: "#ffffff", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                      {MOCK_ADMIN.name}
                    </p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px",
                      color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
                      letterSpacing: "0.06em" }}>
                      {MOCK_ADMIN.role}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header bar */}
          <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
            style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px",
                fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                {title}
              </h1>
              <p className="text-xs text-gray-500 mt-1">Admin control panel with live filtering, actions, and search.</p>
            </div>

            <div className="flex items-center gap-3">
              {actions}
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px",
                color: "#94a3b8", letterSpacing: "0.04em" }}>
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-8 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}