/**
 * AdminLayout.tsx
 *
 * Shared layout component for all Admin pages.
 *
 * Merges:
 *   - Custom collapsible sidebar (motion/framer-motion, dark theme, Syne/DM Sans fonts)
 *   - Laravel 12 starter kit auth pattern: real user via usePage() shared props
 *   - Inertia <Link> for all navigation (prefetch enabled)
 *   - NavUser replaced inline — no shadcn Sidebar primitives needed
 *   - AppLogo used in the sidebar brand slot
 *   - Permission-aware nav: items can declare a required `permission` key
 *     and will be hidden if the shared `auth.permissions` array doesn't include it.
 *
 * Usage:
 *   <AdminLayout title="Branches" active="branches">
 *     <YourPageContent />
 *   </AdminLayout>
 *
 * Required shared props (HandleInertiaRequests.php):
 *   auth.user  → { id, name, email, avatar? }
 *   auth.permissions → string[]   (e.g. ['admin', 'manage_users'])
 *
 * File: resources/js/Layouts/AdminLayout.tsx
 */

import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, usePage, router } from "@inertiajs/react";
import AppLogo from "@/components/app-logo";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveKey =
  | "dashboard"
  | "branches"
  | "counters"
  | "users"
  | "tags"
  | "settings"
  | "feedback";

interface Props {
  children: ReactNode;
  title: string;
  active: ActiveKey;
  actions?: ReactNode;
}

interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
}

interface SharedProps {
  auth: {
    user: AuthUser;
    permissions: string[];
  };
  [key: string]: unknown;
}

interface NavItem {
  key: ActiveKey;
  icon: string;
  label: string;
  href: string;
  /** If set, the item is hidden unless auth.permissions includes this string */
  permission?: string;
}

// ─── Navigation definition ────────────────────────────────────────────────────

const NAV: NavItem[] = [
  { key: "dashboard", icon: "📊", label: "Dashboard", href: "/admin/dashboard" },
  { key: "branches",  icon: "🏢", label: "Branches",  href: "/admin/branches"  },
  { key: "counters",  icon: "🖥️", label: "Counters",  href: "/admin/counters"  },
  { key: "users",     icon: "👥", label: "Users",     href: "/admin/users",     permission: "manage_users" },
  { key: "tags",      icon: "🏷️", label: "Tags",      href: "/admin/tags"      },
  { key: "feedback",  icon: "💬", label: "Feedback",  href: "/admin/feedback"  },
  // { key: "settings", icon: "⚙️", label: "Settings", href: "/admin/settings", permission: "manage_settings" },
];

// ─── Small helpers ─────────────────────────────────────────────────────────────

/** Returns initials from a full name, up to 2 chars */
function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminLayout({ children, title, active, actions }: Props) {
  const { auth } = usePage<SharedProps>().props;
  const user = auth.user;
  const permissions: string[] = auth.permissions ?? [];

  const [collapsed, setCollapsed] = useState(false);

  const visibleNav = NAV.filter(
    (item) => !item.permission || permissions.includes(item.permission)
  );

  const handleLogout = () => {
    router.post(route("logout"));
  };

  return (
    <>
      {/* Google Fonts — same family stack as original AdminLayout */}
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <div className="flex min-h-screen" style={{ background: "#dbdbdb" }}>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <motion.aside
          animate={{ width: collapsed ? 64 : 220 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col relative z-20"
          style={{ background: "#0f172a", flexShrink: 0, overflow: "hidden" }}
        >
          {/* Brand / Logo row */}
          <div
            className="flex items-center justify-between px-4 py-5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  {/* AppLogo from Laravel starter kit */}
                  <div className="w-6 h-6 flex-shrink-0 brightness-0 invert opacity-90">
                    <AppLogo />
                  </div>
                  <span
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "#ffffff",
                      letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    FEEDBACKPRO
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.5)",
                width: 30,
                height: 30,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.12)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.06)")
              }
            >
              {collapsed ? "→" : "←"}
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex flex-col gap-0.5 p-3 flex-1">
            {visibleNav.map((item) => {
              const isActive = item.key === active;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  prefetch
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all no-underline group"
                  style={{
                    background: isActive
                      ? "rgba(255,255,255,0.10)"
                      : "transparent",
                    color: isActive
                      ? "#ffffff"
                      : "rgba(255,255,255,0.45)",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        "transparent";
                  }}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0, lineHeight: 1 }}>
                    {item.icon}
                  </span>

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "13px",
                          fontWeight: isActive ? 600 : 400,
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Active indicator dot — shared layoutId animates between items */}
                  {isActive && (
                    <motion.div
                      layoutId="active-dot"
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "#38bdf8" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── User footer ─────────────────────────────────────────────── */}
          <div
            className="p-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            {/* User identity row */}
            <div className="flex items-center gap-3 px-3 py-2">
              {/* Avatar: use photo if available, otherwise initials */}
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
                    fontSize: "10px",
                    fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {initials(user.name)}
                </div>
              )}

              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 min-w-0"
                  >
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#ffffff",
                        lineHeight: 1.3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user.name}
                    </p>
                    <p
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: "9px",
                        color: "rgba(255,255,255,0.38)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user.email}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Logout button */}
            <AnimatePresence>
              {!collapsed && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleLogout}
                  className="w-full mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-all"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "12px",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "rgba(255,255,255,0.7)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "rgba(255,255,255,0.35)";
                  }}
                >
                  <span style={{ fontSize: "13px" }}>↩</span>
                  <span>Log out</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Collapsed-state: icon-only logout */}
            {collapsed && (
              <button
                onClick={handleLogout}
                aria-label="Log out"
                className="w-full mt-1 flex items-center justify-center rounded-xl py-2 transition-all"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.35)",
                  fontSize: "14px",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(255,255,255,0.06)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background =
                    "transparent")
                }
              >
                ↩
              </button>
            )}
          </div>
        </motion.aside>

        {/* ── Main content area ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Sticky top header */}
          <header
            className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
            style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {title}
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Admin control panel
              </p>
            </div>

            <div className="flex items-center gap-3">
              {actions}
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "11px",
                  color: "#94a3b8",
                  letterSpacing: "0.04em",
                }}
              >
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </header>

          {/* Page content slot */}
          <main className="flex-1 p-8 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </>
  );
}