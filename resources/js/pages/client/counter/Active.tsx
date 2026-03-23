/**
 * Active.tsx — Counter Active Screen
 *
 * Combined idle + feedback screen shown on counter display.
 * - When idle: Shows QR code for servicers to scan
 * - When servicer logged in: Shows feedback form for customers
 *
 * This replaces the need to redirect between pages when sessions change.
 * Seamless transition from idle to active feedback collection.
 *
 * URL: /counter/idle (same endpoint, enhanced functionality)
 *
 * Polling flow:
 *   1. Mounts → checks localStorage for device_token
 *   2. Every 4 seconds: polls /api/counter/session/status
 *   3. No session → show QR code + waiting message
 *   4. Session detected → show feedback form
 *   5. Feedback submitted → brief thanks + auto-reset back to idle
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { router } from "@inertiajs/react";
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
    emoji: string;
    label: string;
    labelKh: string;
    labelZh: string;
    color: string;
    bg: string;
    accent: string;
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
    {
        value: 5,
        emoji: "😄",
        label: "Excellent",
        labelKh: "ល្អណាស់",
        labelZh: "非常好",
        color: "#16a34a",
        bg: "#f0fdf4",
        accent: "#16a34a",
        text: "#14532d",
    },
    {
        value: 4,
        emoji: "🙂",
        label: "Good",
        labelKh: "ល្អ",
        labelZh: "好",
        color: "#65a30d",
        bg: "#f7fee7",
        accent: "#65a30d",
        text: "#365314",
    },
    {
        value: 3,
        emoji: "😐",
        label: "Medium",
        labelKh: "មធ្យម",
        labelZh: "一般",
        color: "#d97706",
        bg: "#fffbeb",
        accent: "#d97706",
        text: "#78350f",
    },
    {
        value: 2,
        emoji: "🙁",
        label: "Poor",
        labelKh: "អន់",
        labelZh: "差",
        color: "#dc2626",
        bg: "#fff1f2",
        accent: "#dc2626",
        text: "#7f1d1d",
    },
    {
        value: 1,
        emoji: "😡",
        label: "Very Bad",
        labelKh: "អន់ខ្លាំង",
        labelZh: "非常差",
        color: "#9f1239",
        bg: "#fff1f2",
        accent: "#9f1239",
        text: "#4c0519",
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readDeviceInfo() {
    const deviceToken = localStorage.getItem("counter_device_token");
    const counterName = localStorage.getItem("counter_name");
    const branchName = localStorage.getItem("branch_name");
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
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const apiCall = useCallback(
        async <T,>(
            apiFunction: () => Promise<T>,
            options: {
                maxRetries?: number;
                retryDelay?: number;
                onRetry?: (attempt: number, error: unknown) => void;
            } = {}
        ): Promise<T> => {
            const {
                maxRetries = MAX_RETRY_ATTEMPTS,
                retryDelay = RETRY_DELAY_MS,
                onRetry,
            } = options;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    if (!isOnline && attempt === 1) throw new Error("No internet connection");
                    return await apiFunction();
                } catch (error: unknown) {
                    const isLastAttempt = attempt === maxRetries;
                    const networkError = (err: unknown): boolean => {
                        if (!err || typeof err !== "object") return true;
                        const e = err as { response?: unknown; code?: string };
                        if (!e.response || typeof e.response !== "object") return true;
                        const response = e.response as { status?: number };
                        return !response || e.code === "NETWORK_ERROR";
                    };
                    const statusCode = (err: unknown): number | null => {
                        if (!err || typeof err !== "object") return null;
                        const e = err as { response?: { status?: number } };
                        return e.response?.status ?? null;
                    };
                    const isNetworkError = networkError(error);
                    const shouldRetry =
                        !isLastAttempt &&
                        (isNetworkError || (statusCode(error) ?? 0) >= 500);
                    if (shouldRetry) {
                        onRetry?.(attempt, error);
                        await new Promise((resolve) =>
                            setTimeout(resolve, retryDelay * attempt)
                        );
                        continue;
                    }
                    const e = error as {
                        response?: { data?: unknown; status?: number };
                        message?: string;
                    };
                    const apiError: ApiError = {
                        message:
                            e.response?.data &&
                                typeof e.response.data === "object" &&
                                "message" in e.response.data
                                ? (e.response.data as { message?: string }).message ??
                                e.message ??
                                "An unexpected error occurred"
                                : e.message ?? "An unexpected error occurred",
                        code: e.response?.status?.toString() ?? "UNKNOWN",
                        details: e.response?.data ?? null,
                    };
                    throw apiError;
                }
            }
            throw new Error("Max retries exceeded");
        },
        [isOnline]
    );

    return { apiCall, isOnline };
}

// ─── QR Code Component ────────────────────────────────────────────────────────

function CounterQrCode({ deviceToken }: { deviceToken: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!canvasRef.current || !deviceToken) return;
        const url = buildActivationUrl(deviceToken);
        QRCode.toCanvas(
            canvasRef.current,
            url,
            {
                width: 200,
                margin: 2,
                color: { dark: "#3d2c1e", light: "#faf5ee" },
                errorCorrectionLevel: "M",
            },
            (err) => {
                if (err) setError(true);
            }
        );
    }, [deviceToken]);

    if (error) {
        return (
            <div
                className="flex flex-col items-center gap-2"
                style={{
                    width: 200,
                    height: 200,
                    background: "#f5e6d0",
                    borderRadius: 16,
                    border: "1px solid rgba(180,140,100,0.3)",
                    justifyContent: "center",
                }}
            >
                <span style={{ fontSize: 32 }}>⚠️</span>
                <p
                    style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "12px",
                        color: "#a07850",
                    }}
                >
                    QR generation failed. Refresh page.
                </p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
                borderRadius: 20,
                overflow: "hidden",
                boxShadow:
                    "0 8px 40px rgba(180,140,100,0.2), 0 0 0 1px rgba(180,140,100,0.2)",
            }}
        >
            <canvas ref={canvasRef} style={{ display: "block" }} />
        </motion.div>
    );
}

// ─── Idle Screen Component ─────────────────────────────────────────────────────

interface IdleScreenProps {
    deviceInfo: {
        deviceToken: string;
        counterName: string;
        branchName: string;
    } | null;
    now: Date;
    lastChecked: Date;
    connectionError: boolean;
    onReset: () => void;
    showResetConfirm: boolean;
    onResetConfirmChange: (show: boolean) => void;
    isOnline: boolean;
    retryCount: number;
    isInitialLoad: boolean;
}

function IdleScreen({
    deviceInfo,
    now,
    lastChecked,
    connectionError,
    onReset,
    showResetConfirm,
    onResetConfirmChange,
    isOnline,
    retryCount,
    isInitialLoad,
}: IdleScreenProps) {
    const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });
    const lastCheckedStr = lastChecked.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,600&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap"
                rel="stylesheet"
            />

            <div
                className="min-h-screen w-full relative overflow-hidden flex flex-col"
                style={{ background: "#faf5ee" }}
            >
                {/* Background effects */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden>
                    <div
                        className="absolute top-0 left-0 w-[600px] h-[600px] opacity-40"
                        style={{
                            background:
                                "radial-gradient(circle at 0% 0%, #f5dfc0, transparent 65%)",
                        }}
                    />
                    <div
                        className="absolute bottom-0 right-0 w-[500px] h-[500px] opacity-30"
                        style={{
                            background:
                                "radial-gradient(circle at 100% 100%, #ead5b5, transparent 65%)",
                        }}
                    />
                    <div
                        className="absolute inset-0 opacity-[0.06]"
                        style={{
                            backgroundImage:
                                "radial-gradient(circle, #b48c64 1px, transparent 1px)",
                            backgroundSize: "32px 32px",
                        }}
                    />
                </div>

                {/* Top bar */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="relative z-10 flex items-center justify-between px-10 pt-8"
                >
                    <div className="flex flex-col gap-1">
                        <p
                            style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: "13px",
                                color: "#a07850",
                                fontWeight: 500,
                                letterSpacing: "0.08em",
                            }}
                        >
                            Ebony Singleton · William Allison
                        </p>
                        <div className="flex items-center gap-3">
                            <motion.div
                                animate={{
                                    opacity: connectionError ? [1, 0.2, 1] : 1,
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: connectionError ? Infinity : 0,
                                }}
                                className="w-2 h-2 rounded-full"
                                style={{
                                    background: connectionError ? "#ef4444" : "#fbbf24",
                                }}
                            />
                            <span
                                style={{
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: "12px",
                                    color: "#b48c64",
                                }}
                            >
                                {deviceInfo?.branchName ?? "—"}
                            </span>
                            <span style={{ color: "#d4b896" }}>·</span>
                            <span
                                style={{
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: "12px",
                                    color: "#b48c64",
                                }}
                            >
                                {deviceInfo?.counterName ?? "—"}
                            </span>
                            <AnimatePresence>
                                {connectionError && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        style={{
                                            background: "#fff1f0",
                                            color: "#ef4444",
                                            border: "1px solid #fecaca",
                                            fontFamily: "'DM Mono', monospace",
                                            fontSize: "10px",
                                            padding: "2px 8px",
                                            borderRadius: 100,
                                        }}
                                    >
                                        reconnecting...
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="text-right">
                            <p
                                style={{
                                    fontFamily: "'Cormorant Garamond', serif",
                                    fontSize: "32px",
                                    fontWeight: 700,
                                    color: "#3d2c1e",
                                    letterSpacing: "0.03em",
                                }}
                            >
                                {timeStr}
                            </p>
                            <p
                                style={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: "12px",
                                    color: "#b48c64",
                                    marginTop: "2px",
                                }}
                            >
                                {dateStr}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Main content */}
                <div className="relative z-10 flex-1 flex items-center justify-center px-8">
                    <div className="flex flex-col lg:flex-row items-center justify-center gap-16 w-full max-w-3xl">
                        {/* Left: QR code */}
                        <motion.div
                            initial={{ opacity: 0, x: -24 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.7, delay: 0.2 }}
                            className="flex flex-col items-center gap-4"
                        >
                            {deviceInfo ? (
                                <CounterQrCode deviceToken={deviceInfo.deviceToken} />
                            ) : (
                                <div
                                    style={{
                                        width: 200,
                                        height: 200,
                                        borderRadius: 20,
                                        background: "rgba(180,140,100,0.08)",
                                        border: "1px solid rgba(180,140,100,0.2)",
                                    }}
                                />
                            )}
                            <div className="text-center">
                                <p
                                    style={{
                                        fontFamily: "'DM Mono', monospace",
                                        fontSize: "11px",
                                        color: "#b48c64",
                                    }}
                                >
                                    Scan to activate
                                </p>
                            </div>
                        </motion.div>

                        {/* Divider */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="hidden lg:flex flex-col items-center gap-3"
                        >
                            <div
                                style={{
                                    width: 1,
                                    height: 60,
                                    background: "rgba(180,140,100,0.2)",
                                }}
                            />
                            <span
                                style={{
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: "10px",
                                    color: "#d4b896",
                                }}
                            >
                                OR
                            </span>
                            <div
                                style={{
                                    width: 1,
                                    height: 60,
                                    background: "rgba(180,140,100,0.2)",
                                }}
                            />
                        </motion.div>

                        {/* Right: text */}
                        <motion.div
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.7, delay: 0.3 }}
                            className="flex flex-col items-center lg:items-start gap-6 text-center lg:text-left max-w-xs"
                        >
                            <div>
                                <h1
                                    style={{
                                        fontFamily: "'Cormorant Garamond', serif",
                                        fontSize: "38px",
                                        fontWeight: 600,
                                        color: "#3d2c1e",
                                        marginBottom: "12px",
                                    }}
                                >
                                    Waiting for
                                    <br />
                                    <span style={{ fontStyle: "italic", color: "#b48c64" }}>
                                        Servicer
                                    </span>
                                </h1>
                            </div>

                            {/* Step hints */}
                            <div className="flex flex-col gap-2.5">
                                {[
                                    { step: "1", text: "Open your phone camera" },
                                    { step: "2", text: "Scan the QR code" },
                                    { step: "3", text: "Enter your credentials" },
                                ].map(({ step, text }) => (
                                    <div key={step} className="flex items-center gap-3">
                                        <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: "rgba(180,140,100,0.15)",
                                                border: "1px solid rgba(180,140,100,0.3)",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontFamily: "'DM Mono', monospace",
                                                    fontSize: "10px",
                                                    color: "#b48c64",
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {step}
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontFamily: "'DM Sans', sans-serif",
                                                fontSize: "13px",
                                                color: "#a07850",
                                            }}
                                        >
                                            {text}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Polling status */}
                            <div
                                className="flex items-center gap-2.5 px-4 py-2 rounded-full"
                                style={{
                                    background: "rgba(180,140,100,0.08)",
                                    border: "1px solid rgba(180,140,100,0.18)",
                                }}
                            >
                                <motion.div
                                    animate={{
                                        opacity: connectionError ? [1, 0.3, 1] : 1,
                                        scale: retryCount > 0 ? [1, 1.2, 1] : 1,
                                    }}
                                    transition={{
                                        duration: connectionError ? 1.5 : 0.3,
                                        repeat: connectionError ? Infinity : 0,
                                    }}
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{
                                        background: !isOnline
                                            ? "#ef4444"
                                            : connectionError
                                                ? "#f97316"
                                                : retryCount > 0
                                                    ? "#eab308"
                                                    : "#b48c64",
                                    }}
                                />
                                <span
                                    style={{
                                        fontFamily: "'DM Mono', monospace",
                                        fontSize: "10px",
                                        color: "#b48c64",
                                    }}
                                >
                                    {!isOnline
                                        ? "Offline"
                                        : isInitialLoad
                                            ? "Connecting..."
                                            : connectionError
                                                ? `Retrying... (${retryCount})`
                                                : retryCount > 0
                                                    ? `Reconnected`
                                                    : `Last checked: ${lastCheckedStr}`}
                                </span>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Bottom bar */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="relative z-10 flex items-center justify-between px-10 pb-8"
                >
                    <span
                        style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: "16px",
                            color: "#c4a882",
                            fontStyle: "italic",
                        }}
                    >
                        FeedbackPro
                    </span>

                    <AnimatePresence mode="wait">
                        {!showResetConfirm ? (
                            <motion.button
                                key="btn"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => onResetConfirmChange(true)}
                                style={{
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: "11px",
                                    color: "#d4b896",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                            >
                                Reset device
                            </motion.button>
                        ) : (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-3"
                            >
                                <span
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "12px",
                                        color: "#a07850",
                                    }}
                                >
                                    Sure?
                                </span>
                                <button
                                    onClick={onReset}
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "12px",
                                        color: "#ef4444",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        fontWeight: 500,
                                    }}
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => onResetConfirmChange(false)}
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "12px",
                                        color: "#a07850",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    Cancel
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </>
    );
}

// ─── Feedback Form Component ───────────────────────────────────────────────────

interface FeedbackState {
    selectedRating: RatingLevel | null;
    selectedTagIds: number[];
    comment: string;
    step: "rate" | "detail" | "done";
    submitting: boolean;
}

interface FeedbackScreenProps {
    session: ActiveSession;
    onComplete: () => void;
}

// ─── Smiley Face SVG ──────────────────────────────────────────────────────────

function SmileyFace({
    type,
    color,
    size = 100,
}: {
    type: "excellent" | "good" | "medium" | "poor" | "veryBad";
    color: string;
    size?: number;
}) {
    const strokeW = size * 0.05;

    const mouth = {
        excellent: <path d={`M${size * 0.32} ${size * 0.62} Q${size * 0.5} ${size * 0.78} ${size * 0.68} ${size * 0.62}`} stroke={color} strokeWidth={strokeW} strokeLinecap="round" fill="none" />,
        good: <path d={`M${size * 0.34} ${size * 0.63} Q${size * 0.5} ${size * 0.74} ${size * 0.66} ${size * 0.63}`} stroke={color} strokeWidth={strokeW} strokeLinecap="round" fill="none" />,
        medium: <line x1={size * 0.34} y1={size * 0.66} x2={size * 0.66} y2={size * 0.66} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />,
        poor: <path d={`M${size * 0.34} ${size * 0.70} Q${size * 0.5} ${size * 0.60} ${size * 0.66} ${size * 0.70}`} stroke={color} strokeWidth={strokeW} strokeLinecap="round" fill="none" />,
        veryBad: <path d={`M${size * 0.32} ${size * 0.72} Q${size * 0.5} ${size * 0.58} ${size * 0.68} ${size * 0.72}`} stroke={color} strokeWidth={strokeW} strokeLinecap="round" fill="none" />,
    }[type];

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Circle */}
            <circle cx={size / 2} cy={size / 2} r={size / 2 - strokeW / 2} stroke={color} strokeWidth={strokeW} fill="white" />
            {/* Left eye */}
            <circle cx={size * 0.36} cy={size * 0.42} r={size * 0.05} fill={color} />
            {/* Right eye */}
            <circle cx={size * 0.64} cy={size * 0.42} r={size * 0.05} fill={color} />
            {/* Mouth */}
            {mouth}
        </svg>
    );
}

const SMILEY_TYPES: Array<"excellent" | "good" | "medium" | "poor" | "veryBad"> = [
    "excellent",
    "good",
    "medium",
    "poor",
    "veryBad",
];

function FeedbackScreen({ session, onComplete }: FeedbackScreenProps) {
    const [state, setState] = useState<FeedbackState>({
        selectedRating: null,
        selectedTagIds: [],
        comment: "",
        step: "rate",
        submitting: false,
    });

    const [tags, setTags] = useState<Tag[]>([]);
    const [servicer, setServicer] = useState<ServicerInfo | null>(null);
    const [loadingTags, setLoadingTags] = useState(true);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const token = localStorage.getItem("counter_device_token");
                const response = await axios.get<{ servicer: ServicerInfo; tags: Tag[] }>(
                    "/api/counter/feedback-data",
                    { headers: { "X-Counter-Token": token } }
                );
                if (response.data.servicer) setServicer(response.data.servicer);
                setTags(response.data.tags?.length ? response.data.tags : []);
            } catch (err: unknown) {
                console.error("Failed to load tags from API:", err);
                setTags([]);
            } finally {
                setLoadingTags(false);
            }
        };
        fetchTags();
    }, []);

    const theme = state.selectedRating ?? RATINGS[0];

    const handleRatingSelect = (rating: RatingLevel) => {
        setState((s) => ({ ...s, selectedRating: rating }));
        setTimeout(() => setState((s) => ({ ...s, step: "detail" })), 420);
    };

    const toggleTag = (id: number) => {
        setState((s) => ({
            ...s,
            selectedTagIds: s.selectedTagIds.includes(id)
                ? s.selectedTagIds.filter((t) => t !== id)
                : [...s.selectedTagIds, id],
        }));
    };

    const handleSubmit = async () => {
        if (!state.selectedRating) return;
        setState((s) => ({ ...s, submitting: true }));
        setSubmitError(null);

        let submissionSuccess = false;
        try {
            const token = localStorage.getItem("counter_device_token");
            const response = await axios.post(
                "/api/counter/feedback",
                {
                    rating: state.selectedRating.value,
                    tag_ids: state.selectedTagIds,
                    comment: state.comment.trim() || null,
                },
                { headers: { "X-Counter-Token": token } }
            );
            if (response.status === 201 && response.data.success) {
                submissionSuccess = true;
            } else {
                setSubmitError(response.data.message || "Unable to submit feedback right now.");
            }
        } catch (err: unknown) {
            console.error("Feedback submission error:", err);
            const e = err as { response?: { data?: { error?: string } }; message?: string };
            setSubmitError(e.response?.data?.error || e.message || "Failed to submit feedback.");
        }

        if (!submissionSuccess) {
            setState((s) => ({ ...s, submitting: false }));
            return;
        }

        setState((s) => ({ ...s, submitting: false, step: "done" }));
        setTimeout(() => {
            setState({
                selectedRating: null,
                selectedTagIds: [],
                comment: "",
                step: "rate",
                submitting: false,
            });
            onComplete();
        }, THANK_YOU_DURATION * 1000);
    };

    const [endingSession, setEndingSession] = useState(false);

    const handleCounterSessionEnd = async () => {
        if (endingSession) return;

        setEndingSession(true);
        try {
            const token = localStorage.getItem("counter_device_token");
            const response = await axios.post(
                "/api/counter/session/end",
                {},
                { headers: { "X-Counter-Token": token } }
            );

            if (response.data.success) {
                onComplete();
                return;
            }

            setSubmitError(response.data.message || "Unable to end session.");
        } catch (err: unknown) {
            console.error("Counter session end error:", err);
            const e = err as { response?: { data?: { error?: string } }; message?: string };
            setSubmitError(e.response?.data?.error || e.message || "Failed to end session.");
        } finally {
            setEndingSession(false);
        }
    };

    const handleBack = () => {
        if (state.step === "detail") {
            setState((s) => ({ ...s, step: "rate", selectedRating: null }));
        }
    };

    const servicerDisplayName = servicer?.name ?? session.servicer_name;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen w-full relative overflow-hidden flex flex-col"
            style={{ backgroundColor: "#ffffff" }}
        >
            <link
                href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Noto+Sans+Khmer:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap"
                rel="stylesheet"
            />

            {/* Subtle top accent line */}
            <motion.div
                className="absolute top-0 left-0 right-0 h-1.5"
                animate={{ backgroundColor: theme.accent }}
                transition={{ duration: 0.5 }}
            />

            {/* ── RATE STEP ── */}
            <AnimatePresence mode="wait">
                {state.step === "rate" && (
                    <motion.div
                        key="rate"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col min-h-screen"
                    >
                        {/* Servicer info — compact top bar */}
                        <div
                            className="flex items-center gap-3 px-8 pt-6 pb-2"
                            style={{ borderBottom: "1px solid #f0f0f0" }}
                        >
                            {servicer?.avatar_url && (
                                <img
                                    src={servicer.avatar_url}
                                    alt={servicerDisplayName}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        border: "2px solid #e5e7eb",
                                    }}
                                />
                            )}
                            <p
                                style={{
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: "11px",
                                    color: "#9ca3af",
                                    letterSpacing: "0.08em",
                                }}
                            >
                                SERVED BY{" "}
                                <span style={{ color: "#374151", fontWeight: 500 }}>
                                    {servicerDisplayName}
                                </span>
                            </p>
                        </div>

                        {/* Main rating area */}
                        <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 gap-8">
                            {/* Question — multilingual */}
                            <motion.div
                                initial={{ opacity: 0, y: -12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-center"
                                style={{ maxWidth: 680 }}
                            >
                                {/* Khmer — primary */}
                                <p
                                    style={{
                                        fontFamily: "'Noto Sans Khmer', sans-serif",
                                        fontSize: "clamp(22px, 3.5vw, 34px)",
                                        fontWeight: 700,
                                        color: "#dc2626",
                                        lineHeight: 1.5,
                                        marginBottom: "4px",
                                    }}
                                >
                                    តើការបំរើសេវាកម្មរបស់ខ្ញុំយ៉ាងដូចម្តេច?
                                </p>
                                {/* English */}
                                <p
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "clamp(13px, 1.8vw, 17px)",
                                        color: "#dc2626",
                                        fontWeight: 400,
                                        marginBottom: "2px",
                                    }}
                                >
                                    How was my service?
                                </p>
                                {/* Chinese */}
                                <p
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "clamp(15px, 2vw, 20px)",
                                        fontWeight: 700,
                                        color: "#dc2626",
                                    }}
                                >
                                    我的服務如何？
                                </p>
                            </motion.div>

                            {/* Divider */}
                            <div
                                style={{
                                    width: "100%",
                                    maxWidth: 560,
                                    height: "1px",
                                    background: "#e5e7eb",
                                }}
                            />

                            {/* Smiley ratings */}
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-end justify-center gap-6 md:gap-10"
                                style={{ flexWrap: "wrap" }}
                            >
                                {RATINGS.map((rating, idx) => {
                                    const isSelected = state.selectedRating?.value === rating.value;
                                    return (
                                        <motion.button
                                            key={rating.value}
                                            onClick={() => handleRatingSelect(rating)}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.25 + idx * 0.07 }}
                                            whileHover={{ y: -6, scale: 1.08 }}
                                            whileTap={{ scale: 0.9 }}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                gap: "10px",
                                                padding: "8px",
                                                borderRadius: "16px",
                                                transition: "background 0.2s",
                                                backgroundColor: isSelected
                                                    ? rating.bg
                                                    : "transparent",
                                            }}
                                        >
                                            <motion.div
                                                animate={
                                                    isSelected
                                                        ? { scale: 1.18, y: -4 }
                                                        : { scale: 1, y: 0 }
                                                }
                                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                style={{
                                                    filter: isSelected
                                                        ? `drop-shadow(0 6px 16px ${rating.color}44)`
                                                        : "none",
                                                }}
                                            >
                                                <SmileyFace
                                                    type={SMILEY_TYPES[5 - rating.value]}
                                                    color={rating.color}
                                                    size={88}
                                                />
                                            </motion.div>
                                            <span
                                                style={{
                                                    fontFamily: "'DM Sans', sans-serif",
                                                    fontSize: "13px",
                                                    fontWeight: isSelected ? 700 : 500,
                                                    color: isSelected ? rating.color : "#6b7280",
                                                    letterSpacing: "0.01em",
                                                }}
                                            >
                                                {rating.label}
                                            </span>
                                        </motion.button>
                                    );
                                })}
                            </motion.div>

                            {/* Divider */}
                            <div
                                style={{
                                    width: "100%",
                                    maxWidth: 560,
                                    height: "1px",
                                    background: "#e5e7eb",
                                }}
                            />

                            {/* Appreciation note — multilingual */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-center"
                                style={{ maxWidth: 560 }}
                            >
                                {/* Khmer */}
                                <p
                                    style={{
                                        fontFamily: "'Noto Sans Khmer', sans-serif",
                                        fontSize: "clamp(14px, 2vw, 20px)",
                                        fontWeight: 600,
                                        color: "#dc2626",
                                        marginBottom: "4px",
                                    }}
                                >
                                    យើងខ្ញុំវាយតម្លៃបំពេញការវាយតំលៃរបស់លោកអ្នក
                                </p>
                                {/* English */}
                                <p
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "clamp(12px, 1.4vw, 15px)",
                                        color: "#4b5563",
                                        marginBottom: "2px",
                                    }}
                                >
                                    We appreciate your feedback.
                                </p>
                                {/* Chinese */}
                                <p
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "clamp(12px, 1.4vw, 15px)",
                                        color: "#dc2626",
                                        fontWeight: 500,
                                        textDecoration: "underline",
                                    }}
                                >
                                    我們感謝您的回饋
                                </p>
                            </motion.div>
                        </div>
                    </motion.div>
                )}

                {/* ── DETAIL STEP ── */}
                {state.step === "detail" && (
                    <motion.div
                        key="detail"
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        className="flex-1 flex flex-col min-h-screen"
                    >
                        {/* Header */}
                        <motion.div
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between px-8 pt-8 pb-4"
                            style={{ borderBottom: "1px solid #f0f0f0" }}
                        >
                            <div className="flex items-center gap-3">
                                {/* Selected rating badge */}
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: theme.bg,
                                        border: `2px solid ${theme.accent}`,
                                    }}
                                >
                                    <SmileyFace
                                        type={SMILEY_TYPES[5 - (state.selectedRating?.value ?? 5)]}
                                        color={theme.accent}
                                        size={30}
                                    />
                                </div>
                                <div>
                                    <p
                                        style={{
                                            fontFamily: "'DM Mono', monospace",
                                            fontSize: "10px",
                                            color: "#9ca3af",
                                            letterSpacing: "0.08em",
                                        }}
                                    >
                                        FEEDBACK FOR
                                    </p>
                                    <p
                                        style={{
                                            fontFamily: "'DM Sans', sans-serif",
                                            fontSize: "18px",
                                            fontWeight: 700,
                                            color: theme.text,
                                        }}
                                    >
                                        {servicerDisplayName}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={handleBack}
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "14px",
                                        color: "#6b7280",
                                        background: "none",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        padding: "6px 14px",
                                        cursor: "pointer",
                                    }}
                                >
                                    ← Back
                                </motion.button>
                                <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={handleCounterSessionEnd}
                                    disabled={endingSession}
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "14px",
                                        color: "#ffffff",
                                        background: "#ef4444",
                                        border: "1px solid #ef4444",
                                        borderRadius: "8px",
                                        padding: "6px 14px",
                                        cursor: endingSession ? "not-allowed" : "pointer",
                                    }}
                                >
                                    {endingSession ? "Ending…" : "End Session"}
                                </motion.button>
                            </div>
                        </motion.div>

                        {/* Form body */}
                        <div className="flex-1 flex flex-col gap-6 px-8 py-8 max-w-2xl w-full mx-auto">
                            {/* Tags */}
                            <div>
                                <p
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "13px",
                                        color: "#6b7280",
                                        marginBottom: "10px",
                                        letterSpacing: "0.04em",
                                        textTransform: "uppercase",
                                        fontWeight: 500,
                                    }}
                                >
                                    Select tags (optional)
                                </p>
                                <div className="flex flex-wrap gap-2.5">
                                    {loadingTags ? (
                                        <p style={{ color: "#9ca3af", fontSize: "12px" }}>
                                            Loading tags...
                                        </p>
                                    ) : tags.length === 0 ? (
                                        <p style={{ color: "#9ca3af", fontSize: "12px" }}>
                                            No tags available.
                                        </p>
                                    ) : (
                                        tags.map((tag) => {
                                            const selected = state.selectedTagIds.includes(tag.id);
                                            return (
                                                <motion.button
                                                    key={tag.id}
                                                    onClick={() => toggleTag(tag.id)}
                                                    whileTap={{ scale: 0.95 }}
                                                    style={{
                                                        fontFamily: "'DM Sans', sans-serif",
                                                        fontSize: "13px",
                                                        color: selected ? tag.color : "#6b7280",
                                                        background: selected ? tag.color + "18" : "#f9fafb",
                                                        border: `2px solid ${selected ? tag.color : "#e5e7eb"}`,
                                                        borderRadius: "8px",
                                                        padding: "7px 14px",
                                                        cursor: "pointer",
                                                        fontWeight: selected ? 600 : 400,
                                                        transition: "all 0.15s",
                                                    }}
                                                >
                                                    {tag.name}
                                                </motion.button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Comment */}
                            <div>
                                <p
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "13px",
                                        color: "#6b7280",
                                        marginBottom: "8px",
                                        letterSpacing: "0.04em",
                                        textTransform: "uppercase",
                                        fontWeight: 500,
                                    }}
                                >
                                    Additional comments (optional)
                                </p>
                                <textarea
                                    value={state.comment}
                                    onChange={(e) =>
                                        setState((s) => ({ ...s, comment: e.target.value }))
                                    }
                                    placeholder="Tell us more..."
                                    style={{
                                        width: "100%",
                                        height: "120px",
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "14px",
                                        padding: "12px 14px",
                                        border: `2px solid ${theme.accent}`,
                                        borderRadius: "10px",
                                        resize: "none",
                                        outline: "none",
                                        color: "#374151",
                                    }}
                                />
                            </div>

                            {submitError && (
                                <p
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: "13px",
                                        color: "#ef4444",
                                    }}
                                >
                                    {submitError}
                                </p>
                            )}

                            <motion.button
                                onClick={handleSubmit}
                                disabled={state.submitting}
                                whileTap={{ scale: 0.97 }}
                                style={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: "16px",
                                    fontWeight: 600,
                                    color: "white",
                                    background: theme.accent,
                                    border: "none",
                                    borderRadius: "10px",
                                    padding: "15px 32px",
                                    cursor: state.submitting ? "not-allowed" : "pointer",
                                    opacity: state.submitting ? 0.65 : 1,
                                    letterSpacing: "0.02em",
                                }}
                            >
                                {state.submitting ? "Submitting…" : "Submit Feedback"}
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* ── DONE STEP ── */}
                {state.step === "done" && (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8"
                        style={{ backgroundColor: theme.bg }}
                    >
                        <motion.div
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            style={{
                                width: 100,
                                height: 100,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: `radial-gradient(circle, white, ${theme.bg})`,
                                border: `3px solid ${theme.accent}`,
                                fontSize: "44px",
                            }}
                        >
                            ✓
                        </motion.div>
                        <div>
                            <p
                                style={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: "32px",
                                    fontWeight: 700,
                                    color: theme.text,
                                }}
                            >
                                Thank You!
                            </p>
                            <p
                                style={{
                                    fontFamily: "'Noto Sans Khmer', sans-serif",
                                    fontSize: "18px",
                                    color: theme.accent,
                                    marginTop: "6px",
                                    fontWeight: 600,
                                }}
                            >
                                អរគុណចំពោះមតិកែលម្អរបស់អ្នក
                            </p>
                            <p
                                style={{
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: "14px",
                                    color: "#6b7280",
                                    marginTop: "8px",
                                }}
                            >
                                Your feedback has been recorded.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CounterActive() {
    const now = useClock();
    const { apiCall, isOnline } = useApiWithRetry();

    const [deviceInfo, setDeviceInfo] = useState<ReturnType<typeof readDeviceInfo>>(null);
    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
    const [lastChecked, setLastChecked] = useState(new Date());
    const [pollingPaused, setPollingPaused] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const deviceTokenRef = useRef<string | null>(null);

    useEffect(() => {
        const info = readDeviceInfo();
        if (!info) {
            router.visit(route("counter.setup"));
            return;
        }
        setDeviceInfo(info);
        deviceTokenRef.current = info.deviceToken;
    }, []);

    const pollSession = useCallback(async () => {
        const token = deviceTokenRef.current;
        if (!token || pollingPaused) return;

        try {
            const res = await apiCall(
                () =>
                    axios.get<{ active: boolean; session?: ActiveSession }>(
                        "/api/counter/session/status",
                        {
                            headers: { "X-Counter-Token": token },
                            timeout: 8_000,
                        }
                    ),
                {
                    onRetry: (attempt, error) => {
                        const e = error as { message?: string };
                        console.warn(`Session poll retry ${attempt}:`, e.message ?? error);
                        setRetryCount(attempt);
                    },
                }
            );

            setLastChecked(new Date());
            setConnectionError(false);
            setRetryCount(0);
            setIsInitialLoad(false);

            if (res.data.active && res.data.session) {
                setActiveSession(res.data.session);
            } else if (activeSession) {
                setActiveSession(null);
                setPollingPaused(false);
            }
        } catch (error: unknown) {
            console.error("Session polling failed:", error);
            const e = error as { code?: string };

            if (e.code === "401") {
                clearDeviceState();
                router.visit(route("counter.setup"));
                return;
            }

            setConnectionError(true);
            setIsInitialLoad(false);

            if (!isOnline) setConnectionError(true);
        }
    }, [pollingPaused, apiCall, activeSession, isOnline]);

    useEffect(() => {
        if (!deviceInfo) return;
        pollSession();
        const interval = setInterval(pollSession, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [deviceInfo, pollSession]);

    const handleReset = () => {
        setPollingPaused(true);
        clearDeviceState();
        router.visit(route("counter.setup"));
    };

    const handleFeedbackComplete = () => {
        setActiveSession(null);
        setPollingPaused(false);
    };

    if (!deviceInfo) return null;

    return (
        <AnimatePresence mode="wait">
            {activeSession ? (
                <FeedbackScreen
                    key="feedback"
                    session={activeSession}
                    onComplete={handleFeedbackComplete}
                />
            ) : (
                <IdleScreen
                    key="idle"
                    deviceInfo={deviceInfo}
                    now={now}
                    lastChecked={lastChecked}
                    connectionError={connectionError}
                    onReset={handleReset}
                    showResetConfirm={showResetConfirm}
                    onResetConfirmChange={setShowResetConfirm}
                    isOnline={isOnline}
                    retryCount={retryCount}
                    isInitialLoad={isInitialLoad}
                />
            )}
        </AnimatePresence>
    );
}