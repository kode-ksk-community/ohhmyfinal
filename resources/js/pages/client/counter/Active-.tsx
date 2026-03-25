/**
 * Active.tsx — Counter Active Screen
 *
 * Combined idle + feedback screen shown on counter display.
 * - When idle: Shows QR code for servicers to scan
 * - When servicer logged in: Shows feedback form for customers
 *
 * Feedback layout (single page, no step transitions):
 *   ┌────────────────────────────────────┐
 *   │  Header: servicer info             │
 *   ├────────────────────────────────────┤
 *   │  Question (Khmer / EN / ZH)        │
 *   │  ★ Rating smileys (pinned)         │
 *   ├────────────────────────────────────┤
 *   │  Tags panel (optional, scrollable) │
 *   │  Comment box (optional)            │
 *   │  Submit button                     │
 *   └────────────────────────────────────┘
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { router, Head } from "@inertiajs/react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import QRCode from "qrcode";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveSession {
    id: number;
    servicer_name: string;
    started_at: string;
}

interface Tag {
    id: number;
    name: string;
    color: string;
    sentiment: "positive" | "negative" | "neutral";
}

interface RatingLevel {
    value: number;
    label: string;
    labelKh: string;
    labelZh: string;
    color: string;
    bg: string;
    glow: string;
    text: string;
}

interface ApiError {
    message: string;
    code?: string;
    details?: unknown;
}

interface ServicerInfo {
    id: number;
    name: string;
    avatar_url?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 4_000;
const THANK_YOU_DURATION = 4;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

const RATINGS: RatingLevel[] = [
    { value: 5, label: "Excellent", labelKh: "ល្អណាស់",  labelZh: "非常好", color: "#10b981", bg: "#ecfdf5", glow: "rgba(16,185,129,0.35)",  text: "#065f46" },
    { value: 4, label: "Good",      labelKh: "ល្អ",       labelZh: "好",    color: "#84cc16", bg: "#f7fee7", glow: "rgba(132,204,22,0.35)",  text: "#365314" },
    { value: 3, label: "Okay",      labelKh: "មធ្យម",    labelZh: "一般",   color: "#f59e0b", bg: "#fffbeb", glow: "rgba(245,158,11,0.35)",  text: "#78350f" },
    { value: 2, label: "Poor",      labelKh: "អន់",       labelZh: "差",    color: "#f97316", bg: "#fff7ed", glow: "rgba(249,115,22,0.35)",  text: "#7c2d12" },
    { value: 1, label: "Bad",       labelKh: "អន់ខ្លាំង", labelZh: "非常差", color: "#ef4444", bg: "#fef2f2", glow: "rgba(239,68,68,0.35)",   text: "#7f1d1d" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readDeviceInfo() {
    const deviceToken = localStorage.getItem("counter_device_token");
    const counterName = localStorage.getItem("counter_name");
    const branchName  = localStorage.getItem("branch_name");
    if (!deviceToken || !counterName || !branchName) return null;
    return { deviceToken, counterName, branchName };
}

function clearDeviceState() {
    ["counter_device_token", "counter_id", "counter_name", "branch_name"].forEach((k) =>
        localStorage.removeItem(k)
    );
}

function buildActivationUrl(deviceToken: string) {
    return `${window.location.origin}/counter/activate?counter_token=${deviceToken}`;
}

function useClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return now;
}

function useApiWithRetry() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline  = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online",  handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online",  handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const apiCall = useCallback(
        async <T,>(
            fn: () => Promise<T>,
            opts: { maxRetries?: number; retryDelay?: number; onRetry?: (a: number, e: unknown) => void } = {}
        ): Promise<T> => {
            const { maxRetries = MAX_RETRY_ATTEMPTS, retryDelay = RETRY_DELAY_MS, onRetry } = opts;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    if (!isOnline && attempt === 1) throw new Error("No internet connection");
                    return await fn();
                } catch (error: unknown) {
                    const isLast = attempt === maxRetries;
                    const isNet  = (() => {
                        if (!error || typeof error !== "object") return true;
                        const e = error as { response?: unknown; code?: string };
                        if (!e.response || typeof e.response !== "object") return true;
                        return e.code === "NETWORK_ERROR";
                    })();
                    const status = (() => {
                        if (!error || typeof error !== "object") return null;
                        return (error as { response?: { status?: number } }).response?.status ?? null;
                    })();
                    if (!isLast && (isNet || (status ?? 0) >= 500)) {
                        onRetry?.(attempt, error);
                        await new Promise((r) => setTimeout(r, retryDelay * attempt));
                        continue;
                    }
                    const e = error as { response?: { data?: unknown; status?: number }; message?: string };
                    const msg =
                        e.response?.data && typeof e.response.data === "object" && "message" in e.response.data
                            ? (e.response.data as { message?: string }).message
                            : e.message;
                    throw { message: msg ?? "Unexpected error", code: e.response?.status?.toString() ?? "UNKNOWN", details: e.response?.data } as ApiError;
                }
            }
            throw new Error("Max retries exceeded");
        },
        [isOnline]
    );

    return { apiCall, isOnline };
}

// ─── SVG Smiley ──────────────────────────────────────────────────────────────

type SmileyType = "excellent" | "good" | "okay" | "poor" | "bad";
const SMILEY_MAP: SmileyType[] = ["bad", "poor", "okay", "good", "excellent"];

function SmileyFace({ type, color, size = 64 }: { type: SmileyType; color: string; size?: number }) {
    const s  = size;
    const sw = s * 0.055;
    const cx = s / 2, cy = s / 2;
    const r  = s / 2 - sw / 2;
    const ey = cy - s * 0.08;
    const er = s * 0.052;
    const ex = s * 0.145;

    const mouths: Record<SmileyType, React.ReactElement> = {
        excellent: <path d={`M${cx-s*.20} ${cy+s*.06} Q${cx} ${cy+s*.26} ${cx+s*.20} ${cy+s*.06}`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />,
        good:      <path d={`M${cx-s*.17} ${cy+s*.08} Q${cx} ${cy+s*.20} ${cx+s*.17} ${cy+s*.08}`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />,
        okay:      <line  x1={cx-s*.16} y1={cy+s*.14} x2={cx+s*.16} y2={cy+s*.14} stroke={color} strokeWidth={sw} strokeLinecap="round" />,
        poor:      <path d={`M${cx-s*.17} ${cy+s*.20} Q${cx} ${cy+s*.10} ${cx+s*.17} ${cy+s*.20}`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />,
        bad:       <path d={`M${cx-s*.20} ${cy+s*.24} Q${cx} ${cy+s*.08} ${cx+s*.20} ${cy+s*.24}`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />,
    };

    return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
            <circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={sw} fill="white" />
            <circle cx={cx - ex} cy={ey} r={er} fill={color} />
            <circle cx={cx + ex} cy={ey} r={er} fill={color} />
            {mouths[type]}
        </svg>
    );
}

// ─── QR Code ─────────────────────────────────────────────────────────────────

function CounterQrCode({ deviceToken }: { deviceToken: string }) {
    const ref   = useRef<HTMLCanvasElement>(null);
    const [err, setErr] = useState(false);

    useEffect(() => {
        if (!ref.current || !deviceToken) return;
        QRCode.toCanvas(ref.current, buildActivationUrl(deviceToken), {
            width: 200, margin: 2,
            color: { dark: "#0f172a", light: "#f8fafc" },
            errorCorrectionLevel: "M",
        }, (e) => { if (e) setErr(true); });
    }, [deviceToken]);

    if (err) return (
        <div style={{ width: 200, height: 200, borderRadius: 16, background: "#f1f5f9", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 28 }}>⚠️</span>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", color: "#64748b", textAlign: "center" }}>QR generation failed.<br />Refresh the page.</p>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)" }}
        >
            <canvas ref={ref} style={{ display: "block" }} />
        </motion.div>
    );
}

// ─── Idle Screen ──────────────────────────────────────────────────────────────

interface IdleScreenProps {
    deviceInfo: { deviceToken: string; counterName: string; branchName: string } | null;
    now: Date; lastChecked: Date; connectionError: boolean;
    onReset: () => void; showResetConfirm: boolean; onResetConfirmChange: (v: boolean) => void;
    isOnline: boolean; retryCount: number; isInitialLoad: boolean;
}

function IdleScreen({ deviceInfo, now, lastChecked, connectionError, onReset, showResetConfirm, onResetConfirmChange, isOnline, retryCount, isInitialLoad }: IdleScreenProps) {
    const timeStr        = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    const dateStr        = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const lastCheckedStr = lastChecked.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,600&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
            <div className="min-h-screen w-full relative overflow-hidden flex flex-col" style={{ background: "#faf5ee" }}>
                <div className="absolute inset-0 pointer-events-none" aria-hidden>
                    <div className="absolute top-0 left-0 w-[600px] h-[600px] opacity-40" style={{ background: "radial-gradient(circle at 0% 0%, #f5dfc0, transparent 65%)" }} />
                    <div className="absolute bottom-0 right-0 w-[500px] h-[500px] opacity-30" style={{ background: "radial-gradient(circle at 100% 100%, #ead5b5, transparent 65%)" }} />
                    <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, #b48c64 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
                </div>

                <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 flex items-center justify-between px-10 pt-8">
                    <div className="flex items-center gap-3">
                        <motion.div animate={{ opacity: connectionError ? [1, 0.2, 1] : 1 }} transition={{ duration: 1.5, repeat: connectionError ? Infinity : 0 }} className="w-2 h-2 rounded-full" style={{ background: connectionError ? "#ef4444" : "#fbbf24" }} />
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "#b48c64" }}>{deviceInfo?.branchName ?? "—"}</span>
                        <span style={{ color: "#d4b896" }}>·</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "#b48c64" }}>{deviceInfo?.counterName ?? "—"}</span>
                        <AnimatePresence>
                            {connectionError && (
                                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ background: "#fff1f0", color: "#ef4444", border: "1px solid #fecaca", fontFamily: "'DM Mono',monospace", fontSize: "10px", padding: "2px 8px", borderRadius: 100 }}>
                                    reconnecting...
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="text-right">
                        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "26px", fontWeight: 600, color: "#3d2c1e" }}>{timeStr}</p>
                        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", color: "#b48c64", marginTop: "2px" }}>{dateStr}</p>
                    </div>
                </motion.div>

                <div className="relative z-10 flex-1 flex items-center justify-center px-8">
                    <div className="flex flex-col lg:flex-row items-center justify-center gap-16 w-full max-w-3xl">
                        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="flex flex-col items-center gap-4">
                            {deviceInfo ? <CounterQrCode deviceToken={deviceInfo.deviceToken} /> : <div style={{ width: 200, height: 200, borderRadius: 16, background: "rgba(180,140,100,0.08)", border: "1px solid rgba(180,140,100,0.2)" }} />}
                            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#b48c64" }}>Scan to activate</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="hidden lg:flex flex-col items-center gap-3">
                            <div style={{ width: 1, height: 60, background: "rgba(180,140,100,0.2)" }} />
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#d4b896" }}>OR</span>
                            <div style={{ width: 1, height: 60, background: "rgba(180,140,100,0.2)" }} />
                        </motion.div>
                        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.3 }} className="flex flex-col items-center lg:items-start gap-6 text-center lg:text-left max-w-xs">
                            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "38px", fontWeight: 600, color: "#3d2c1e", marginBottom: "12px" }}>
                                Waiting for<br /><span style={{ fontStyle: "italic", color: "#b48c64" }}>Servicer</span>
                            </h1>
                            <div className="flex flex-col gap-2.5">
                                {[{ step: "1", text: "Open your phone camera" }, { step: "2", text: "Scan the QR code" }, { step: "3", text: "Enter your credentials" }].map(({ step, text }) => (
                                    <div key={step} className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(180,140,100,0.15)", border: "1px solid rgba(180,140,100,0.3)" }}>
                                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#b48c64", fontWeight: 700 }}>{step}</span>
                                        </div>
                                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "13px", color: "#a07850" }}>{text}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full" style={{ background: "rgba(180,140,100,0.08)", border: "1px solid rgba(180,140,100,0.18)" }}>
                                <motion.div
                                    animate={{ opacity: connectionError ? [1, 0.3, 1] : 1, scale: retryCount > 0 ? [1, 1.2, 1] : 1 }}
                                    transition={{ duration: connectionError ? 1.5 : 0.3, repeat: connectionError ? Infinity : 0 }}
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: !isOnline ? "#ef4444" : connectionError ? "#f97316" : retryCount > 0 ? "#eab308" : "#b48c64" }}
                                />
                                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#b48c64" }}>
                                    {!isOnline ? "Offline" : isInitialLoad ? "Connecting..." : connectionError ? `Retrying... (${retryCount})` : retryCount > 0 ? "Reconnected" : `Last checked: ${lastCheckedStr}`}
                                </span>
                            </div>
                        </motion.div>
                    </div>
                </div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }} className="relative z-10 flex items-center justify-between px-10 pb-8">
                    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "16px", color: "#c4a882", fontStyle: "italic" }}>FeedbackPro</span>
                    <AnimatePresence mode="wait">
                        {!showResetConfirm ? (
                            <motion.button key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => onResetConfirmChange(true)} style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#d4b896", background: "none", border: "none", cursor: "pointer" }}>
                                Reset device
                            </motion.button>
                        ) : (
                            <motion.div key="confirm" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "#a07850" }}>Sure?</span>
                                <button onClick={onReset} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Yes</button>
                                <button onClick={() => onResetConfirmChange(false)} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "#a07850", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </>
    );
}

// ─── Feedback Screen ──────────────────────────────────────────────────────────

interface FeedbackScreenProps {
    session: ActiveSession;
    onComplete: () => void;
}

function FeedbackScreen({ session, onComplete }: FeedbackScreenProps) {
    const [selectedTagIds,  setSelectedTagIds]  = useState<number[]>([]);
    const [comment,         setComment]         = useState("");
    const [hoveredRating,   setHoveredRating]   = useState<number | null>(null);
    const [selectedRating,  setSelectedRating]  = useState<RatingLevel | null>(null);
    const [submitting,      setSubmitting]      = useState(false);
    const [submitError,     setSubmitError]     = useState<string | null>(null);
    const [done,            setDone]            = useState(false);
    const [submittedRating, setSubmittedRating] = useState<RatingLevel | null>(null);

    const [tags,       setTags]       = useState<Tag[]>([]);
    const [servicer,   setServicer]   = useState<ServicerInfo | null>(null);
    const [loadingTags, setLoadingTags] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const token = localStorage.getItem("counter_device_token");
                const res   = await axios.get<{ servicer: ServicerInfo; tags: Tag[] }>(
                    "/api/counter/feedback-data",
                    { headers: { "X-Counter-Token": token } }
                );
                if (res.data.servicer) setServicer(res.data.servicer);
                setTags(res.data.tags?.length ? res.data.tags : []);
            } catch { setTags([]); }
            finally  { setLoadingTags(false); }
        })();
    }, []);

    const toggleTag = (id: number) =>
        setSelectedTagIds((p) => p.includes(id) ? p.filter((t) => t !== id) : [...p, id]);

    const handleRatingClick = async (rating: RatingLevel) => {
        if (submitting) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const token = localStorage.getItem("counter_device_token");
            const res   = await axios.post(
                "/api/counter/feedback",
                { rating: rating.value, tag_ids: selectedTagIds, comment: comment.trim() || null },
                { headers: { "X-Counter-Token": token } }
            );
            if (res.status === 201 && res.data.success) {
                setSubmittedRating(rating);
                setDone(true);
                setTimeout(() => {
                    setSelectedTagIds([]); setComment(""); setHoveredRating(null); setSelectedRating(null);
                    setDone(false); setSubmittedRating(null);
                    onComplete();
                }, THANK_YOU_DURATION * 1000);
            } else {
                setSubmitError(res.data.message || "Unable to submit. Please try again.");
                setSubmitting(false);
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } }; message?: string };
            setSubmitError(e.response?.data?.error || e.message || "Failed to submit feedback.");
            setSubmitting(false);
        }
    };

    const displayName   = servicer?.name ?? session.servicer_name;

    // ── Thank-you screen ──────────────────────────────────────────────────────
    if (done && submittedRating) {
        const sr = submittedRating;
        return (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="min-h-screen flex flex-col items-center justify-center gap-8 text-center px-8"
                style={{ background: `linear-gradient(155deg, ${sr.bg} 0%, #ffffff 55%, ${sr.bg} 100%)` }}
            >
                <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400&display=swap" rel="stylesheet" />

                {/* Big smiley burst */}
                <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 16 }}
                    style={{
                        width: 130, height: 130, borderRadius: "50%",
                        background: `radial-gradient(circle at 35% 35%, white, ${sr.bg})`,
                        border: `4px solid ${sr.color}`,
                        boxShadow: `0 0 0 16px ${sr.color}18, 0 0 48px ${sr.glow}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                >
                    <SmileyFace type={SMILEY_MAP[sr.value - 1]} color={sr.color} size={80} />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "38px", fontWeight: 800, color: sr.text, letterSpacing: "-0.02em", marginBottom: 6 }}>
                        Thank You!
                    </p>
                    <p style={{ fontFamily: "'Noto Sans Khmer',sans-serif", fontSize: "20px", fontWeight: 600, color: sr.color, marginBottom: 6 }}>
                        អរគុណចំពោះមតិយោបល់របស់អ្នក
                    </p>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "15px", color: "#6b7280" }}>
                        Your feedback helps us serve you better.
                    </p>
                </motion.div>

                {/* Progress bar */}
                <div style={{ width: 220, height: 5, borderRadius: 99, background: "#e5e7eb", overflow: "hidden" }}>
                    <motion.div
                        initial={{ width: "100%" }} animate={{ width: "0%" }}
                        transition={{ duration: THANK_YOU_DURATION, ease: "linear" }}
                        style={{ height: "100%", borderRadius: 99, background: sr.color }}
                    />
                </div>
            </motion.div>
        );
    }

    // ── Main feedback layout ──────────────────────────────────────────────────
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col" style={{ background: "#f8fafc" }}
        >
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;600;700&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

            {/* Dynamic top accent */}
            <motion.div className="h-1.5 w-full flex-shrink-0"
                animate={{ background: selectedRating ? `linear-gradient(90deg,${selectedRating.color},${selectedRating.color}66)` : "linear-gradient(90deg,#6366f1,#8b5cf6)" }}
                transition={{ duration: 0.3 }}
            />

            {/* ── Header ── */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
                className="flex items-center gap-4 px-8 py-5 flex-shrink-0"
                style={{ background: "#ffffff", borderBottom: "1px solid #f1f5f9", boxShadow: "0 1px 0 #f1f5f9" }}
            >
                {servicer?.avatar_url ? (
                    <img src={servicer.avatar_url} alt={displayName}
                        style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", border: "3px solid #e2e8f0", flexShrink: 0 }} />
                ) : (
                    <div style={{ width: 50, height: 50, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "22px", fontWeight: 700, color: "white" }}>
                            {displayName.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>Served by</p>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "21px", fontWeight: 700, color: "#0f172a", lineHeight: 1.15 }}>{displayName}</p>
                </div>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#cbd5e1", letterSpacing: "0.06em" }}>FeedbackPro</span>
            </motion.div>

            {/* ── Pinned top section: question + smileys ── */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="flex-shrink-0"
                style={{ background: "#ffffff", borderBottom: "1px solid #f1f5f9", padding: "20px 24px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            >
                {/* Question — multilingual */}
                <div className="text-center mb-5 max-w-2xl mx-auto">
                    <p style={{ fontFamily: "'Noto Sans Khmer',sans-serif", fontSize: "clamp(17px,2.6vw,24px)", fontWeight: 700, color: "#dc2626", lineHeight: 1.65, marginBottom: 2 }}>
                        តើការបំរើសេវាកម្មរបស់ខ្ញុំយ៉ាងដូចម្តេច?
                    </p>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "clamp(12px,1.4vw,15px)", color: "#64748b", marginBottom: 1 }}>
                        How was your experience today?
                    </p>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "clamp(12px,1.4vw,15px)", fontWeight: 600, color: "#dc2626" }}>
                        您今天的體驗如何？
                    </p>
                </div>

                {/* Smiley rating row */}
                <div className="flex items-center justify-center gap-1 md:gap-3 max-w-2xl mx-auto">
                    {RATINGS.map((rating, idx) => {
                        const isHov = hoveredRating === rating.value;
                        const isSel = selectedRating?.value === rating.value;
                        return (
                            <motion.button key={rating.value}
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.14 + idx * 0.055, type: "spring", stiffness: 260, damping: 18 }}
                                onHoverStart={() => setHoveredRating(rating.value)}
                                onHoverEnd={() => setHoveredRating(null)}
                                onClick={() => setSelectedRating(isSel ? null : rating)}
                                whileTap={{ scale: 0.88 }}
                                style={{
                                    background: isSel ? rating.bg : isHov ? rating.bg + "aa" : "transparent",
                                    border: `2px solid ${isSel ? rating.color : isHov ? rating.color + "55" : "transparent"}`,
                                    cursor: "pointer",
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                                    padding: "10px 6px", borderRadius: 14,
                                    flex: 1, maxWidth: 100,
                                    transition: "background 0.18s, border-color 0.18s",
                                } as React.CSSProperties}
                            >
                                <motion.div
                                    animate={isSel ? { y: -6, scale: 1.25 } : isHov ? { y: -4, scale: 1.15 } : { y: 0, scale: 1 }}
                                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                                    style={{ filter: isSel ? `drop-shadow(0 6px 16px ${rating.glow})` : isHov ? `drop-shadow(0 4px 10px ${rating.glow})` : "none", transition: "filter 0.18s" }}
                                >
                                    <SmileyFace type={SMILEY_MAP[rating.value - 1]} color={rating.color} size={62} />
                                </motion.div>
                                <motion.span
                                    animate={{ color: isSel || isHov ? rating.color : "#94a3b8", fontWeight: isSel ? 700 : isHov ? 600 : 400 }}
                                    style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", transition: "color 0.18s" }}
                                >
                                    {rating.label}
                                </motion.span>
                            </motion.button>
                        );
                    })}
                </div>

                {/* Appreciation tagline */}
                <p className="text-center mt-3"
                    style={{ fontFamily: "'Noto Sans Khmer',sans-serif", fontSize: "11px", color: "#cbd5e1", lineHeight: 1.6 }}
                >
                    យើងខ្ញុំវាយតម្លៃមតិយោបល់របស់អ្នក ·{" "}
                    <span style={{ fontFamily: "'DM Sans',sans-serif" }}>We appreciate your feedback</span>{" "}
                    · 感謝您的回饋
                </p>
            </motion.div>

            {/* ── Scrollable body: tags + comment + submit ── */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-5 flex flex-col gap-5">

                    {/* Tags card */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
                        style={{ background: "#ffffff", borderRadius: 16, padding: "18px 20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>Quick Tags</p>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#cbd5e1" }}>optional</span>
                        </div>
                        {loadingTags ? (
                            <div className="flex gap-2 flex-wrap">
                                {[90, 70, 110, 80].map((w, i) => (
                                    <div key={i} style={{ height: 34, width: w, borderRadius: 99, background: "#f1f5f9", animation: "shimmer 1.4s ease-in-out infinite", animationDelay: `${i * 0.12}s` }} />
                                ))}
                            </div>
                        ) : tags.length === 0 ? (
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "13px", color: "#cbd5e1" }}>No tags available.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag, i) => {
                                    const sel = selectedTagIds.includes(tag.id);
                                    return (
                                        <motion.button key={tag.id}
                                            onClick={() => toggleTag(tag.id)}
                                            initial={{ opacity: 0, scale: 0.85 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.02 * i, type: "spring", stiffness: 300, damping: 20 }}
                                            whileTap={{ scale: 0.93 }}
                                            style={{
                                                fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
                                                fontWeight: sel ? 600 : 400,
                                                color:      sel ? "white" : "#475569",
                                                background: sel ? tag.color : "#f8fafc",
                                                border:     `1.5px solid ${sel ? tag.color : "#e2e8f0"}`,
                                                borderRadius: 99, padding: "7px 16px", cursor: "pointer",
                                                boxShadow: sel ? `0 2px 10px ${tag.color}44` : "none",
                                                transition: "all 0.16s",
                                            }}
                                        >
                                            {sel && <span style={{ marginRight: 4 }}>✓</span>}
                                            {tag.name}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>

                    {/* Comment card */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}
                        style={{ background: "#ffffff", borderRadius: 16, padding: "18px 20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>Comments</p>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#cbd5e1" }}>optional</span>
                        </div>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Tell us more about your experience…"
                            style={{
                                width: "100%", height: 88,
                                fontFamily: "'DM Sans',sans-serif", fontSize: "14px", color: "#0f172a",
                                padding: "12px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10,
                                resize: "none", outline: "none", background: "#f8fafc", lineHeight: 1.55,
                                transition: "border-color 0.2s, box-shadow 0.2s",
                            }}
                            onFocus={(e) => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                            onBlur={(e)  => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                        />
                    </motion.div>

                    {/* Error */}
                    <AnimatePresence>
                        {submitError && (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "10px 16px" }}>
                                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "13px", color: "#e11d48" }}>⚠ {submitError}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Submit button */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                        <motion.button
                            onClick={() => selectedRating && handleRatingClick(selectedRating)}
                            disabled={!selectedRating || submitting}
                            whileTap={{ scale: 0.97 }}
                            animate={{
                                background: selectedRating ? selectedRating.color : "#e2e8f0",
                                boxShadow: selectedRating ? `0 4px 20px ${selectedRating.glow}` : "none",
                            }}
                            transition={{ duration: 0.25 }}
                            style={{
                                width: "100%", padding: "15px 32px",
                                fontFamily: "'DM Sans',sans-serif", fontSize: "16px", fontWeight: 700,
                                color: selectedRating ? "white" : "#94a3b8",
                                border: "none", borderRadius: 12, cursor: selectedRating && !submitting ? "pointer" : "not-allowed",
                                opacity: submitting ? 0.65 : 1,
                                letterSpacing: "0.01em",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                            } as React.CSSProperties}
                        >
                            {submitting ? (
                                "Submitting…"
                            ) : selectedRating ? (
                                <>
                                    <SmileyFace type={SMILEY_MAP[selectedRating.value - 1]} color="white" size={22} />
                                    Submit — {selectedRating.label}
                                </>
                            ) : (
                                "Select a rating above to submit"
                            )}
                        </motion.button>
                    </motion.div>

                    {/* Bottom padding */}
                    <div style={{ height: 8 }} />
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0%,100% { opacity: 1; }
                    50%      { opacity: 0.45; }
                }
            `}</style>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CounterActive() {
    const now = useClock();
    const { apiCall, isOnline } = useApiWithRetry();

    const [deviceInfo,      setDeviceInfo]      = useState<ReturnType<typeof readDeviceInfo>>(null);
    const [activeSession,   setActiveSession]   = useState<ActiveSession | null>(null);
    const [lastChecked,     setLastChecked]     = useState(new Date());
    const [pollingPaused,   setPollingPaused]   = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [retryCount,      setRetryCount]      = useState(0);
    const [isInitialLoad,   setIsInitialLoad]   = useState(true);

    const deviceTokenRef = useRef<string | null>(null);

    useEffect(() => {
        const info = readDeviceInfo();
        if (!info) { router.visit(route("counter.setup")); return; }
        setDeviceInfo(info);
        deviceTokenRef.current = info.deviceToken;
    }, []);

    const pollSession = useCallback(async () => {
        const token = deviceTokenRef.current;
        if (!token || pollingPaused) return;
        try {
            const res = await apiCall(
                () => axios.get<{ active: boolean; session?: ActiveSession }>(
                    "/api/counter/session/status",
                    { headers: { "X-Counter-Token": token }, timeout: 8_000 }
                ),
                { onRetry: (attempt, error) => { const e = error as { message?: string }; console.warn(`Poll retry ${attempt}:`, e.message ?? error); setRetryCount(attempt); } }
            );
            setLastChecked(new Date()); setConnectionError(false); setRetryCount(0); setIsInitialLoad(false);
            if (res.data.active && res.data.session) { setPollingPaused(true); setActiveSession(res.data.session); }
            else if (activeSession)                  { setActiveSession(null); setPollingPaused(false); }
        } catch (error: unknown) {
            console.error("Session polling failed:", error);
            const e = error as { code?: string };
            if (e.code === "401") { clearDeviceState(); router.visit(route("counter.setup")); return; }
            setConnectionError(true); setIsInitialLoad(false);
            if (!isOnline) setConnectionError(true);
        }
    }, [pollingPaused, apiCall, activeSession, isOnline]);

    useEffect(() => {
        if (!deviceInfo) return;
        pollSession();
        const interval = setInterval(pollSession, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [deviceInfo, pollSession]);

    const handleReset            = () => { setPollingPaused(true); clearDeviceState(); router.visit(route("counter.setup")); };
    const handleFeedbackComplete = () => { setActiveSession(null); setPollingPaused(false); };

    if (!deviceInfo) return null;

    return (
        <>
            <Head title="Counter Active" />
            <AnimatePresence mode="wait">
            {activeSession ? (
                <FeedbackScreen key="feedback" session={activeSession} onComplete={handleFeedbackComplete} />
            ) : (
                <IdleScreen key="idle" deviceInfo={deviceInfo} now={now} lastChecked={lastChecked}
                    connectionError={connectionError} onReset={handleReset}
                    showResetConfirm={showResetConfirm} onResetConfirmChange={setShowResetConfirm}
                    isOnline={isOnline} retryCount={retryCount} isInitialLoad={isInitialLoad}
                />
            )}
        </AnimatePresence>
        </>
    );
}