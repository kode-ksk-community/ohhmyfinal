/**
 * app-layout.tsx
 *
 * Replaces the default Laravel 12 starter kit app-layout.
 * Drops AppSidebarLayout / AppShell / AppContent entirely.
 *
 * Features:
 *  - Custom framer-motion collapsible sidebar (dark, #0f172a)
 *  - Real auth user from usePage<SharedData>() shared props
 *  - Permission-aware nav (auth.permissions string[] — add to HandleInertiaRequests if needed)
 *  - AppLogoIcon used directly in brand slot (sky-blue badge)
 *  - UserMenuContent dropdown reused from starter kit (keeps logout, profile links)
 *  - Syne + DM Sans + DM Mono typography
 *  - BreadcrumbItem support in header (optional)
 *  - `actions` slot for per-page header buttons
 *  - `active` prop highlights the matching nav item
 *
 * Usage:
 *   import AppLayout from '@/layouts/app-layout';
 *
 *   <AppLayout title="Feedback" active="feedback">
 *     <YourPage />
 *   </AppLayout>
 *
 * File: resources/js/layouts/app-layout.tsx
 */

import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, usePage } from '@inertiajs/react';
import { type SharedData, type BreadcrumbItem } from '@/types';
import AppLogoIcon from '@/components/app-logo-icon';
import { UserMenuContent } from '@/components/user-menu-content';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronsUpDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActiveKey =
    | 'dashboard'
    | 'branches'
    | 'counters'
    | 'users'
    | 'tags'
    | 'settings'
    | 'feedback';

interface AppLayoutProps {
    children: ReactNode;
    /** Page title shown in the top header */
    title?: string;
    /** Highlights the matching sidebar nav item */
    active?: ActiveKey;
    /** Optional action buttons rendered in the top-right header slot */
    actions?: ReactNode;
    /** Optional breadcrumb trail shown below the title */
    breadcrumbs?: BreadcrumbItem[];
}

interface NavItemDef {
    key: ActiveKey;
    icon: string;
    label: string;
    href: string;
    /** If set, item is hidden unless auth.permissions includes this string */
    permission?: string;
}

// Extend SharedData locally to include optional permissions array.
// Add `permissions: string[]` to your HandleInertiaRequests.php share() call.
// Falls back to [] safely if not yet added.
interface SharedDataWithPermissions extends SharedData {
    auth: SharedData['auth'] & {
        permissions?: string[];
    };
}

// ─── Navigation definition ────────────────────────────────────────────────────

const NAV: NavItemDef[] = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard', href: '/admin/dashboard' },
    { key: 'branches',  icon: '🏢', label: 'Branches',  href: '/admin/branches'  },
    { key: 'counters',  icon: '🖥️', label: 'Counters',  href: '/admin/counters'  },
    { key: 'users',     icon: '👥', label: 'Users',     href: '/admin/users' },
    // { key: 'users',     icon: '👥', label: 'Users',     href: '/admin/users',     permission: 'manage_users' },
    { key: 'tags',      icon: '🏷️', label: 'Tags',      href: '/admin/tags'      },
    { key: 'feedback',  icon: '💬', label: 'Feedback',  href: '/admin/feedback'  },
    // { key: 'settings', icon: '⚙️', label: 'Settings', href: '/admin/settings', permission: 'manage_settings' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
    return name
        .split(' ')
        .map((w) => w[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppLayout({
    children,
    title,
    active,
    actions,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { auth } = usePage<SharedDataWithPermissions>().props;
    const user = auth.user;
    const permissions: string[] = auth.permissions ?? [];

    const [collapsed, setCollapsed] = useState(false);

    const visibleNav = NAV.filter(
        (item) => !item.permission || permissions.includes(item.permission),
    );

    const pageTitle = title ?? 'Dashboard';

    return (
        <>
            {/* Google Fonts */}
            <link
                href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap"
                rel="stylesheet"
            />

            <div className="flex min-h-screen" style={{ background: '#e2e8f0' }}>

                {/* ── Sidebar ───────────────────────────────────────────── */}
                <motion.aside
                    animate={{ width: collapsed ? 64 : 220 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="relative z-20 flex flex-col"
                    style={{
                        background: '#0f172a',
                        flexShrink: 0,
                        overflow: 'hidden',
                        boxShadow: '4px 0 24px rgba(0,0,0,0.18)',
                    }}
                >
                    {/* Brand row */}
                    <div
                        className="flex items-center justify-between px-4 py-5"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    >
                        <AnimatePresence>
                            {!collapsed && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2.5 overflow-hidden"
                                >
                                    {/* AppLogoIcon in sky-blue badge */}
                                    <div
                                        className="flex aspect-square size-7 flex-shrink-0 items-center justify-center rounded-md"
                                        // style={{ background: '#38bdf8' }}
                                    >
                                        <AppLogoIcon className="size-4 fill-current text-white" />
                                        {/* <img src="{{ asset('assets/img/logo.png') }}" alt="" /> */}
                                    </div>
                                    <span
                                        style={{
                                            fontFamily: "'Syne', sans-serif",
                                            fontSize: '12px',
                                            fontWeight: 800,
                                            color: '#ffffff',
                                            // letterSpacing: '0.06em',
                                            // whiteSpace: 'nowrap',
                                        }}
                                    >
                                        FEEDBACK
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Collapsed: show small logo icon only */}
                        {collapsed && (
                            <div
                                className="mx-auto flex aspect-square size-7 items-center justify-center rounded-md"
                                style={{ background: '#38bdf8' }}
                            >
                                <AppLogoIcon className="size-4 fill-current text-white" />
                            </div>
                        )}

                        {/* Collapse toggle — only visible when expanded */}
                        {!collapsed && (
                            <button
                                onClick={() => setCollapsed(true)}
                                aria-label="Collapse sidebar"
                                className="flex flex-shrink-0 items-center justify-center rounded-lg"
                                style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.5)',
                                    width: 28,
                                    height: 28,
                                    fontSize: '12px',
                                }}
                                onMouseEnter={(e) =>
                                    ((e.currentTarget as HTMLButtonElement).style.background =
                                        'rgba(255,255,255,0.12)')
                                }
                                onMouseLeave={(e) =>
                                    ((e.currentTarget as HTMLButtonElement).style.background =
                                        'rgba(255,255,255,0.06)')
                                }
                            >
                                ←
                            </button>
                        )}
                    </div>

                    {/* Expand button — shown only when collapsed, below brand */}
                    {collapsed && (
                        <div className="flex justify-center px-3 pt-2">
                            <button
                                onClick={() => setCollapsed(false)}
                                aria-label="Expand sidebar"
                                className="flex items-center justify-center rounded-lg"
                                style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.5)',
                                    width: 36,
                                    height: 28,
                                    fontSize: '12px',
                                }}
                                onMouseEnter={(e) =>
                                    ((e.currentTarget as HTMLButtonElement).style.background =
                                        'rgba(255,255,255,0.12)')
                                }
                                onMouseLeave={(e) =>
                                    ((e.currentTarget as HTMLButtonElement).style.background =
                                        'rgba(255,255,255,0.06)')
                                }
                            >
                                →
                            </button>
                        </div>
                    )}

                    {/* Nav links */}
                    <nav className="flex flex-1 flex-col gap-0.5 p-3">
                        {visibleNav.map((item) => {
                            const isActive = item.key === active;
                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    prefetch
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
                                    style={{
                                        background: isActive
                                            ? 'rgba(255,255,255,0.10)'
                                            : 'transparent',
                                        color: isActive
                                            ? '#ffffff'
                                            : 'rgba(255,255,255,0.45)',
                                        textDecoration: 'none',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive)
                                            (e.currentTarget as HTMLAnchorElement).style.background =
                                                'rgba(255,255,255,0.06)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive)
                                            (e.currentTarget as HTMLAnchorElement).style.background =
                                                'transparent';
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: '16px',
                                            flexShrink: 0,
                                            lineHeight: 1,
                                        }}
                                    >
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
                                                    fontSize: '13px',
                                                    fontWeight: isActive ? 600 : 400,
                                                    whiteSpace: 'nowrap',
                                                    flex: 1,
                                                }}
                                            >
                                                {item.label}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>

                                    {/* Active indicator dot */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-nav-dot"
                                            className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                            style={{ background: '#38bdf8' }}
                                        />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* ── User footer ──────────────────────────────────── */}
                    <div
                        className="p-3"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-colors"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) =>
                                        ((e.currentTarget as HTMLButtonElement).style.background =
                                            'rgba(255,255,255,0.06)')
                                    }
                                    onMouseLeave={(e) =>
                                        ((e.currentTarget as HTMLButtonElement).style.background =
                                            'transparent')
                                    }
                                >
                                    {/* Avatar */}
                                    {user.avatar ? (
                                        <img
                                            src={user.avatar}
                                            alt={user.name}
                                            className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div
                                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white"
                                            style={{
                                                background:
                                                    'linear-gradient(135deg,#38bdf8,#6366f1)',
                                                fontSize: '10px',
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
                                                className="flex min-w-0 flex-1 items-center justify-between"
                                            >
                                                <div className="min-w-0">
                                                    <p
                                                        className="truncate"
                                                        style={{
                                                            fontFamily: "'DM Sans', sans-serif",
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            color: '#ffffff',
                                                            lineHeight: 1.3,
                                                        }}
                                                    >
                                                        {user.name}
                                                    </p>
                                                    <p
                                                        className="truncate"
                                                        style={{
                                                            fontFamily: "'DM Mono', monospace",
                                                            fontSize: '9px',
                                                            color: 'rgba(255,255,255,0.38)',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.06em',
                                                        }}
                                                    >
                                                        {user.email}
                                                    </p>
                                                </div>
                                                <ChevronsUpDown
                                                    className="ml-2 flex-shrink-0"
                                                    style={{
                                                        width: 14,
                                                        height: 14,
                                                        color: 'rgba(255,255,255,0.35)',
                                                    }}
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </button>
                            </DropdownMenuTrigger>

                            {/* Reuses starter kit UserMenuContent — Profile + Logout intact */}
                            <DropdownMenuContent
                                className="min-w-56 rounded-lg"
                                align="end"
                                side={collapsed ? 'right' : 'top'}
                                sideOffset={8}
                            >
                                <UserMenuContent user={user} />
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </motion.aside>

                {/* ── Main content ─────────────────────────────────────── */}
                <div className="flex min-w-0 flex-1 flex-col">

                    {/* Sticky top header */}
                    <header
                        className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
                        style={{
                            background: '#ffffff',
                            borderBottom: '1px solid #e2e8f0',
                        }}
                    >
                        <div>
                            {/* Breadcrumbs */}
                            {breadcrumbs.length > 0 && (
                                <nav className="mb-1.5 flex items-center gap-1.5">
                                    {breadcrumbs.map((crumb, i) => (
                                        <span
                                            key={crumb.href}
                                            className="flex items-center gap-1.5"
                                        >
                                            {i > 0 && (
                                                <span
                                                    style={{
                                                        color: '#cbd5e1',
                                                        fontSize: '10px',
                                                    }}
                                                >
                                                    /
                                                </span>
                                            )}
                                            {i < breadcrumbs.length - 1 ? (
                                                <Link
                                                    href={crumb.href}
                                                    style={{
                                                        fontFamily: "'DM Sans', sans-serif",
                                                        fontSize: '11px',
                                                        color: '#94a3b8',
                                                        textDecoration: 'none',
                                                    }}
                                                >
                                                    {crumb.title}
                                                </Link>
                                            ) : (
                                                <span
                                                    style={{
                                                        fontFamily: "'DM Sans', sans-serif",
                                                        fontSize: '11px',
                                                        color: '#64748b',
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {crumb.title}
                                                </span>
                                            )}
                                        </span>
                                    ))}
                                </nav>
                            )}

                            <h1
                                style={{
                                    fontFamily: "'Syne', sans-serif",
                                    fontSize: '18px',
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    letterSpacing: '-0.02em',
                                    lineHeight: 1,
                                }}
                            >
                                {pageTitle}
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
                            {actions}
                            <span
                                style={{
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: '11px',
                                    color: '#94a3b8',
                                    letterSpacing: '0.04em',
                                }}
                            >
                                {new Date().toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </span>
                        </div>
                    </header>

                    {/* Page content slot */}
                    <main className="flex-1 overflow-x-hidden p-8">{children}</main>
                </div>
            </div>
        </>
    );
}