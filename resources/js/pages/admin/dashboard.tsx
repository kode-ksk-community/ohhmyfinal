/**
 * ManagerDashboard.tsx
 *
 * Branch Manager dashboard — primary daily-use view.
 * Shows branch-level metrics, servicer performance, rating charts,
 * tag breakdown, and a live recent feedback feed.
 *
 * Route:    GET /manager/dashboard
 * File:     resources/js/Pages/Manager/Dashboard.tsx
 *
 * Features:
 *   - Summary metric cards (total feedback, avg rating, top servicer)
 *   - Time range filter (Today / Week / Month / Year / Custom)
 *   - Rating distribution bar chart
 *   - Servicer performance cards with sparkline trend bars
 *   - Top tags frequency list
 *   - Recent feedback feed with emoji + servicer + tags
 *   - Export button (PDF / Excel / CSV)
 *
 * 🔧 STATIC MODE:
 *   All data is hardcoded in MOCK_DATA below.
 *   Search "TODO: REPLACE" for every backend swap point.
 */

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Head } from "@inertiajs/react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import AdminLayout from "../Layouts/Adminlayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Servicer {
    id: number;
    name: string;
    total: number;
    avg: number;
    trend: number[]; // last 7 days avg ratings
}

interface FeedbackItem {
    id: number;
    rating: number;
    servicer: string;
    comment: string | null;
    tags: string[];
    time: string;
}

interface TagStat {
    name: string;
    count: number;
    sentiment: "positive" | "negative" | "neutral";
}

type TimeRange = "today" | "week" | "month" | "year";

interface AdminStats {
    range: TimeRange;
    total: number;
    avg: number;
    growth: number | null;
    ratingDist: number[];
    servicers: Servicer[];
    tags: TagStat[];
    feed: FeedbackItem[];
}

interface Props {
    stats: AdminStats;
    initialRange: TimeRange;
}

// ─── Rating config ────────────────────────────────────────────────────────────

const RATINGS = [
    { value: 5, emoji: "😍", label: "Excellent", color: "#3b82f6" },
    { value: 4, emoji: "😊", label: "Good", color: "#22c55e" },
    { value: 3, emoji: "😐", label: "Neutral", color: "#eab308" },
    { value: 2, emoji: "😞", label: "Bad", color: "#f97316" },
    { value: 1, emoji: "😡", label: "Very Bad", color: "#ef4444" },
];

// ─── 🔧 Static Mock Data ──────────────────────────────────────────────────────

const MOCK: Record<TimeRange, {
    total: number; avg: number; growth: number;
    ratingDist: number[];   // counts for [1,2,3,4,5]
    servicers: Servicer[];
    tags: TagStat[];
    feed: FeedbackItem[];
}> = {
    today: {
        total: 84, avg: 4.2, growth: 12,
        ratingDist: [3, 5, 8, 28, 40],
        servicers: [
            { id: 1, name: "Sophea Chan", total: 32, avg: 4.6, trend: [4.2, 4.4, 4.3, 4.5, 4.6, 4.7, 4.6] },
            { id: 2, name: "Dara Lim", total: 28, avg: 4.1, trend: [3.9, 4.0, 4.2, 4.1, 4.0, 4.2, 4.1] },
            { id: 3, name: "Maly Sok", total: 24, avg: 3.8, trend: [4.1, 3.9, 3.7, 3.8, 3.6, 3.9, 3.8] },
        ],
        tags: [
            { name: "Friendly Staff", count: 38, sentiment: "positive" },
            { name: "Fast Service", count: 29, sentiment: "positive" },
            { name: "Helpful", count: 22, sentiment: "positive" },
            { name: "Long Wait", count: 11, sentiment: "negative" },
            { name: "Professional", count: 9, sentiment: "positive" },
            { name: "Slow Service", count: 6, sentiment: "negative" },
        ],
        feed: [
            { id: 1, rating: 5, servicer: "Sophea Chan", comment: "Very helpful and friendly!", tags: ["Friendly Staff", "Fast Service"], time: "2m ago" },
            { id: 2, rating: 4, servicer: "Dara Lim", comment: null, tags: ["Helpful"], time: "8m ago" },
            { id: 3, rating: 2, servicer: "Maly Sok", comment: "Had to wait too long.", tags: ["Long Wait", "Slow Service"], time: "15m ago" },
            { id: 4, rating: 5, servicer: "Sophea Chan", comment: null, tags: ["Professional"], time: "22m ago" },
            { id: 5, rating: 3, servicer: "Dara Lim", comment: "It was okay.", tags: [], time: "31m ago" },
            { id: 6, rating: 5, servicer: "Maly Sok", comment: "Great service today!", tags: ["Friendly Staff", "Helpful"], time: "45m ago" },
        ],
    },
    week: {
        total: 521, avg: 4.1, growth: 8,
        ratingDist: [18, 32, 61, 198, 212],
        servicers: [
            { id: 1, name: "Sophea Chan", total: 198, avg: 4.5, trend: [4.3, 4.4, 4.5, 4.4, 4.6, 4.5, 4.5] },
            { id: 2, name: "Dara Lim", total: 176, avg: 4.0, trend: [3.8, 4.0, 4.1, 3.9, 4.2, 4.0, 4.0] },
            { id: 3, name: "Maly Sok", total: 147, avg: 3.7, trend: [3.9, 3.6, 3.8, 3.7, 3.5, 3.8, 3.7] },
        ],
        tags: [
            { name: "Friendly Staff", count: 210, sentiment: "positive" },
            { name: "Fast Service", count: 178, sentiment: "positive" },
            { name: "Helpful", count: 142, sentiment: "positive" },
            { name: "Long Wait", count: 67, sentiment: "negative" },
            { name: "Professional", count: 54, sentiment: "positive" },
            { name: "Slow Service", count: 39, sentiment: "negative" },
        ],
        feed: [
            { id: 1, rating: 5, servicer: "Sophea Chan", comment: "Best service this week!", tags: ["Friendly Staff"], time: "2h ago" },
            { id: 2, rating: 1, servicer: "Maly Sok", comment: "Very rude.", tags: ["Rude Staff"], time: "4h ago" },
            { id: 3, rating: 4, servicer: "Dara Lim", comment: null, tags: ["Helpful"], time: "6h ago" },
        ],
    },
    month: {
        total: 2108, avg: 4.0, growth: 5,
        ratingDist: [72, 140, 310, 820, 766],
        servicers: [
            { id: 1, name: "Sophea Chan", total: 802, avg: 4.4, trend: [4.2, 4.3, 4.4, 4.4, 4.5, 4.3, 4.4] },
            { id: 2, name: "Dara Lim", total: 711, avg: 3.9, trend: [3.7, 3.9, 4.0, 3.8, 4.0, 3.9, 3.9] },
            { id: 3, name: "Maly Sok", total: 595, avg: 3.6, trend: [3.8, 3.5, 3.7, 3.6, 3.4, 3.7, 3.6] },
        ],
        tags: [
            { name: "Friendly Staff", count: 890, sentiment: "positive" },
            { name: "Fast Service", count: 720, sentiment: "positive" },
            { name: "Helpful", count: 580, sentiment: "positive" },
            { name: "Long Wait", count: 310, sentiment: "negative" },
            { name: "Professional", count: 260, sentiment: "positive" },
        ],
        feed: [
            { id: 1, rating: 5, servicer: "Sophea Chan", comment: "Always great!", tags: ["Friendly Staff"], time: "1d ago" },
            { id: 2, rating: 3, servicer: "Dara Lim", comment: "Average service.", tags: [], time: "1d ago" },
        ],
    },
    year: {
        total: 24820, avg: 3.9, growth: 18,
        ratingDist: [980, 1820, 4200, 9600, 8220],
        servicers: [
            { id: 1, name: "Sophea Chan", total: 9400, avg: 4.3, trend: [4.1, 4.2, 4.3, 4.2, 4.4, 4.3, 4.3] },
            { id: 2, name: "Dara Lim", total: 8100, avg: 3.8, trend: [3.6, 3.8, 3.9, 3.7, 3.9, 3.8, 3.8] },
            { id: 3, name: "Maly Sok", total: 7320, avg: 3.6, trend: [3.8, 3.5, 3.7, 3.6, 3.4, 3.7, 3.6] },
        ],
        tags: [
            { name: "Friendly Staff", count: 10200, sentiment: "positive" },
            { name: "Fast Service", count: 8800, sentiment: "positive" },
            { name: "Helpful", count: 6900, sentiment: "positive" },
            { name: "Long Wait", count: 3400, sentiment: "negative" },
            { name: "Professional", count: 2800, sentiment: "positive" },
        ],
        feed: [
            { id: 1, rating: 5, servicer: "Sophea Chan", comment: "Consistent excellence.", tags: ["Professional"], time: "3d ago" },
        ],
    },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Top summary metric card */
function MetricCard({ label, value, sub, accent, icon, index }: {
    label: string; value: string; sub: string;
    accent: string; icon: string; index: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <Card className="shadow-sm border">
                <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <CardTitle className="text-base font-semibold text-muted-foreground">{label}</CardTitle>
                        </div>
                        <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                            style={{ background: `${accent}15` }}>
                            {icon}
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                    <p className="text-2xl font-extrabold text-foreground">{value}</p>
                    <CardDescription>{sub}</CardDescription>
                </CardContent>
            </Card>
        </motion.div>
    );
}

/** Mini sparkline bars for servicer trend */
function Sparkline({ data, color }: { data: number[]; color: string }) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return (
        <div className="flex items-end gap-0.5" style={{ height: 28 }}>
            {data.map((v, i) => (
                <div key={i}
                    style={{
                        width: 6, borderRadius: "2px",
                        height: `${((v - min) / range) * 100}%`,
                        minHeight: 4,
                        background: i === data.length - 1 ? color : `${color}55`,
                        transition: "height 0.3s ease",
                    }}
                />
            ))}
        </div>
    );
}

/** Servicer performance card */
function ServicerCard({ servicer, rank, index }: {
    servicer: Servicer; rank: number; index: number;
}) {
    const ratingColor = servicer.avg >= 4.5 ? "#22c55e"
        : servicer.avg >= 4.0 ? "#3b82f6"
            : servicer.avg >= 3.5 ? "#eab308" : "#ef4444";

    const medals = ["🥇", "🥈", "🥉"];

    return (
        <motion.div
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-4 p-4 rounded-2xl"
            style={{
                background: "#ffffff", border: "1px solid #f1f5f9",
                boxShadow: "0 1px 6px rgba(0,0,0,0.04)"
            }}
        >
            {/* Rank */}
            <span style={{ fontSize: "18px", width: 24, textAlign: "center", flexShrink: 0 }}>
                {medals[rank] ?? `#${rank + 1}`}
            </span>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${ratingColor}cc, ${ratingColor})` }}>
                {servicer.name.charAt(0)}
            </div>

            {/* Name + count */}
            <div className="flex-1 min-w-0">
                <p style={{
                    fontFamily: "'Syne', sans-serif", fontSize: "14px",
                    fontWeight: 700, color: "#0f172a", marginBottom: "2px",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                    {servicer.name}
                </p>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "#94a3b8" }}>
                    {servicer.total.toLocaleString()} feedback
                </p>
            </div>

            {/* Sparkline */}
            <Sparkline data={servicer.trend} color={ratingColor} />

            {/* Avg rating badge */}
            <div className="px-2.5 py-1 rounded-xl flex-shrink-0"
                style={{ background: `${ratingColor}15` }}>
                <span style={{
                    fontFamily: "'Syne', sans-serif", fontSize: "14px",
                    fontWeight: 800, color: ratingColor
                }}>
                    {servicer.avg.toFixed(1)}
                </span>
            </div>
        </motion.div>
    );
}

/** Recent feedback feed item */
function FeedItem({ item, index }: { item: FeedbackItem; index: number }) {
    const r = RATINGS.find(r => r.value === item.rating)!;
    return (
        <motion.div
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
            className="flex gap-3 p-3.5 rounded-xl"
            style={{ background: "#fafbfc", border: "1px solid #f1f5f9" }}
        >
            <span style={{ fontSize: "22px", lineHeight: 1, marginTop: "2px", flexShrink: 0 }}>
                {r.emoji}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <span style={{
                        fontFamily: "'Syne', sans-serif", fontSize: "13px",
                        fontWeight: 700, color: "#0f172a"
                    }}>
                        {item.servicer}
                    </span>
                    <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: "10px",
                        color: "#cbd5e1", flexShrink: 0
                    }}>
                        {item.time}
                    </span>
                </div>
                {item.comment && (
                    <p style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                        color: "#64748b", marginBottom: "6px", lineHeight: 1.5
                    }}>
                        "{item.comment}"
                    </p>
                )}
                {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {item.tags.map(t => (
                            <Badge key={t} variant={r.value >= 4 ? "secondary" : "outline"} className="px-2 py-0.5 text-xs">
                                {t}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManagerDashboard({ stats, initialRange }: Props) {
    const [range, setRange] = useState<TimeRange>(initialRange || "today");
    const [activeTab, setActiveTab] = useState<"overview" | "servicers" | "feedback">("overview");
    const [currentStats, setCurrentStats] = useState<AdminStats>(stats);

    // TODO: REPLACE — from Inertia props: { manager, branch }
    const managerName = "Main Branch Manager";
    const branchName = "Main Branch";

    const data = currentStats;

    // Rating distribution — max for bar scaling
    const maxDist = useMemo(() => Math.max(...data.ratingDist), [data.ratingDist]);

    const rangeLabels: Record<TimeRange, string> = {
        today: "Today", week: "This Week", month: "This Month", year: "This Year",
    };

    const [isLoading, setIsLoading] = useState(false);

    const fetchStats = async (targetRange: TimeRange) => {
        try {
            setIsLoading(true);
            const response = await axios.get(`/api/admin/stats`, { params: { range: targetRange } });
            if (response.data) {
                setCurrentStats(response.data);
            }
        } catch (error) {
            console.error("Failed to load dashboard stats:", error);
            toast.error("Could not update dashboard data. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (range !== initialRange) {
            fetchStats(range);
        }
    }, [range]);

    const handleExport = (fmt: string) => {
        // TODO: REPLACE with: window.location.href = route('manager.export', { format: fmt, range })
        toast.success(`Exporting ${fmt.toUpperCase()} for ${rangeLabels[range]}...`);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <AdminLayout title="Admin Dashboard" active="dashboard">
            <Head title="Admin Dashboard" />
            <Toaster position="top-right" toastOptions={{
                style: { fontFamily: "'DM Sans', sans-serif", borderRadius: "12px", fontSize: "13px" },
            }} />

            <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 style={{
                            fontFamily: "'Syne', sans-serif", fontSize: "24px",
                            fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em",
                            marginBottom: "4px"
                        }}>
                            {branchName}
                        </h1>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "#94a3b8" }}>
                            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                        </p>
                    </div>

                    {/* Export */}
                    <div className="flex items-center gap-2">
                        {["PDF", "Excel", "CSV"].map(fmt => (
                            <Button key={fmt} variant="outline" size="sm" onClick={() => handleExport(fmt)}>
                                ↓ {fmt}
                            </Button>
                        ))}
                    </div>
                </motion.div>

                {/* Time range + search */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-wrap items-center gap-4 mb-8">

                    <div className="flex items-center gap-2">
                        <Label htmlFor="dashboard-range" className="text-sm">Time range</Label>
                        <Select value={range} onValueChange={(value: string) => setRange(value as TimeRange)}>
                            <SelectTrigger id="dashboard-range" className="w-40">
                                <SelectValue placeholder="Select range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="week">This Week</SelectItem>
                                <SelectItem value="month">This Month</SelectItem>
                                <SelectItem value="year">This Year</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Label htmlFor="dashboard-search" className="text-sm">Search</Label>
                        <Input id="dashboard-search" placeholder="Search feedback" className="w-64" />
                    </div>

                </motion.div>

                {/* ── Metric cards ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <MetricCard index={0} icon="💬" accent="#3b82f6" label="Total Feedback"
                        value={data.total.toLocaleString()}
                        sub={data.growth !== null ? `+${data.growth}% vs last period` : "No previous period"} />
                    <MetricCard index={1} icon="⭐" accent="#f59e0b" label="Average Rating"
                        value={data.avg.toFixed(1)}
                        sub="Out of 5.0" />
                    <MetricCard index={2} icon="🏆" accent="#22c55e" label="Top Servicer"
                        value={data.servicers[0]?.name?.split(" ")[0] ?? "-"}
                        sub={data.servicers[0] ? `${data.servicers[0].avg.toFixed(1)} avg · ${data.servicers[0].total} feedback` : "No data"} />
                    <MetricCard index={3} icon="📉" accent="#ef4444" label="Needs Attention"
                        value={data.servicers[data.servicers.length - 1]?.name?.split(" ")[0] ?? "-"}
                        sub={data.servicers.length > 0 ? `${data.servicers[data.servicers.length - 1].avg.toFixed(1)} avg rating` : "No data"} />
                </div>

                {/* ── Main grid ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── Left col (2/3): Rating chart + Servicers ── */}
                    <div className="lg:col-span-2 flex flex-col gap-6">

                        {/* Rating distribution */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="rounded-2xl p-6"
                            style={{
                                background: "#ffffff", border: "1px solid #f1f5f9",
                                boxShadow: "0 1px 8px rgba(0,0,0,0.04)"
                            }}>
                            <div className="flex items-center justify-between mb-6">
                                <h3 style={{
                                    fontFamily: "'Syne', sans-serif", fontSize: "15px",
                                    fontWeight: 700, color: "#0f172a"
                                }}>
                                    Rating Distribution
                                </h3>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "#94a3b8" }}>
                                    {data.total.toLocaleString()} total
                                </span>
                            </div>

                            <div className="flex flex-col gap-3">
                                {RATINGS.map((r, i) => {
                                    const count = data.ratingDist[r.value - 1];
                                    const pct = maxDist ? (count / maxDist) * 100 : 0;
                                    const share = data.total ? Math.round((count / data.total) * 100) : 0;
                                    return (
                                        <div key={r.value} className="flex items-center gap-3">
                                            <span style={{ fontSize: "18px", width: 24, textAlign: "center", flexShrink: 0 }}>
                                                {r.emoji}
                                            </span>
                                            <span style={{
                                                fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                                                color: "#64748b", width: 60, flexShrink: 0
                                            }}>
                                                {r.label}
                                            </span>
                                            <div className="flex-1 h-6 rounded-full overflow-hidden"
                                                style={{ background: "#f8fafc" }}>
                                                <motion.div
                                                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.6, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                                                    className="h-full rounded-full flex items-center justify-end pr-2"
                                                    style={{
                                                        background: `linear-gradient(90deg, ${r.color}99, ${r.color})`,
                                                        minWidth: count > 0 ? "24px" : 0
                                                    }}>
                                                    {pct > 15 && (
                                                        <span style={{
                                                            fontFamily: "'DM Mono', monospace",
                                                            fontSize: "10px", color: "#fff", fontWeight: 700
                                                        }}>
                                                            {count}
                                                        </span>
                                                    )}
                                                </motion.div>
                                            </div>
                                            <span style={{
                                                fontFamily: "'DM Mono', monospace", fontSize: "11px",
                                                color: "#94a3b8", width: 36, textAlign: "right", flexShrink: 0
                                            }}>
                                                {share}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* Servicer performance */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="rounded-2xl p-6"
                            style={{
                                background: "#ffffff", border: "1px solid #f1f5f9",
                                boxShadow: "0 1px 8px rgba(0,0,0,0.04)"
                            }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 style={{
                                    fontFamily: "'Syne', sans-serif", fontSize: "15px",
                                    fontWeight: 700, color: "#0f172a"
                                }}>
                                    Servicer Performance
                                </h3>
                                <span style={{
                                    fontFamily: "'DM Mono', monospace", fontSize: "10px",
                                    color: "#94a3b8", letterSpacing: "0.04em"
                                }}>
                                    SPARKLINE = 7-DAY TREND
                                </span>
                            </div>
                            <div className="flex flex-col gap-3">
                                {data.servicers.map((s, i) => (
                                    <ServicerCard key={s.id} servicer={s} rank={i} index={i} />
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* ── Right col (1/3): Tags + Feed ── */}
                    <div className="flex flex-col gap-6">

                        {/* Top tags */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="rounded-2xl p-6"
                            style={{
                                background: "#ffffff", border: "1px solid #f1f5f9",
                                boxShadow: "0 1px 8px rgba(0,0,0,0.04)"
                            }}>
                            <h3 style={{
                                fontFamily: "'Syne', sans-serif", fontSize: "15px",
                                fontWeight: 700, color: "#0f172a", marginBottom: "16px"
                            }}>
                                Top Tags
                            </h3>
                            <div className="flex flex-col gap-2.5">
                                {data.tags.map((tag, i) => {
                                    const maxCount = data.tags[0].count;
                                    const pct = (tag.count / maxCount) * 100;
                                    const color = tag.sentiment === "positive" ? "#22c55e"
                                        : tag.sentiment === "negative" ? "#ef4444" : "#94a3b8";
                                    return (
                                        <div key={tag.name}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span style={{
                                                    fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                                                    color: "#0f172a", fontWeight: 500
                                                }}>
                                                    {tag.name}
                                                </span>
                                                <span style={{
                                                    fontFamily: "'DM Mono', monospace", fontSize: "11px",
                                                    color: "#94a3b8"
                                                }}>
                                                    {tag.count.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="h-1.5 rounded-full" style={{ background: "#f1f5f9" }}>
                                                <motion.div
                                                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.5, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                                                    className="h-full rounded-full"
                                                    style={{ background: color }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* Recent feedback feed */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="rounded-2xl p-6"
                            style={{
                                background: "#ffffff", border: "1px solid #f1f5f9",
                                boxShadow: "0 1px 8px rgba(0,0,0,0.04)"
                            }}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 style={{
                                    fontFamily: "'Syne', sans-serif", fontSize: "15px",
                                    fontWeight: 700, color: "#0f172a"
                                }}>
                                    Recent Feedback
                                </h3>
                                {/* Live indicator */}
                                <div className="flex items-center gap-1.5">
                                    <motion.div
                                        animate={{ opacity: [1, 0.3, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ background: "#22c55e" }} />
                                    <span style={{
                                        fontFamily: "'DM Mono', monospace", fontSize: "10px",
                                        color: "#22c55e", letterSpacing: "0.04em"
                                    }}>
                                        LIVE
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <AnimatePresence mode="popLayout">
                                    {data.feed.map((item, i) => (
                                        <FeedItem key={item.id} item={item} index={i} />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </motion.div>

                    </div>
                </div>
            </main>
        </AdminLayout>
    );
}