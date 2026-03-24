/**
 * Active.tsx — Counter Active Screen (FeedbackPro Design System)
 *
 * Combined idle + feedback screen shown on counter display.
 * - When idle: Shows QR code for servicers to scan
 * - When servicer logged in: Shows feedback form for customers
 *
 * URL: /counter/idle
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

interface FeedbackState {
  selectedRating: RatingLevel | null;
  selectedTagIds: number[];
  comment: string;
  step: "rate" | "detail" | "done";
  submitting: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS    = 4_000;
const THANK_YOU_DURATION  = 4;
const MAX_RETRY_ATTEMPTS  = 3;
const RETRY_DELAY_MS      = 1000;

// Design tokens (mirrors app.css CSS variables for use in inline styles)
const T = {
  cream:        "#faf4ec",
  creamCard:    "rgba(255,255,255,0.82)",
  creamOverlay: "#fdf6ec",
  creamIdle:    "#faf5ee",
  brown900:     "#2c1f12",
  brown800:     "#3d2c1e",
  brown700:     "#5a3e28",
  brown600:     "#6b4c2f",
  gold600:      "#b98951",
  gold550:      "#b48c64",
  gold500:      "#c49a60",
  gold400:      "#d4b896",
  gold200:      "rgba(185,137,81,0.18)",
  gold100:      "rgba(185,137,81,0.10)",
  gold50:       "rgba(185,137,81,0.06)",
  border:       "rgba(185,137,81,0.18)",
  borderSoft:   "rgba(185,137,81,0.10)",
  shadowCard:   "0 2px 4px rgba(90,62,37,0.04), 0 8px 24px rgba(90,62,37,0.08), 0 24px 48px rgba(90,62,37,0.05)",
  shadowSm:     "0 2px 8px rgba(90,62,37,0.08)",
  fontDisplay:  "'Cormorant Garamond', serif",
  fontSans:     "'DM Sans', sans-serif",
  fontMono:     "'DM Mono', monospace",
  fontKh:       "'Noto Sans Khmer', sans-serif",
  ease:         [0.22, 1, 0.36, 1] as [number, number, number, number],
};

const RATINGS: RatingLevel[] = [
  { value: 5, label: "Excellent", labelKh: "ល្អណាស់",   labelZh: "非常好", color: "#16a34a", bg: "#f0fdf4", accent: "#16a34a", text: "#14532d" },
  { value: 4, label: "Good",      labelKh: "ល្អ",        labelZh: "好",    color: "#65a30d", bg: "#f7fee7", accent: "#65a30d", text: "#365314" },
  { value: 3, label: "Okay",      labelKh: "មធ្យម",      labelZh: "一般",  color: "#d97706", bg: "#fffbeb", accent: "#d97706", text: "#78350f" },
  { value: 2, label: "Poor",      labelKh: "អន់",        labelZh: "差",    color: "#ea580c", bg: "#fff7ed", accent: "#ea580c", text: "#7c2d12" },
  { value: 1, label: "Very Bad",  labelKh: "អន់ខ្លាំង", labelZh: "非常差", color: "#dc2626", bg: "#fef2f2", accent: "#dc2626", text: "#7f1d1d" },
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
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const apiCall = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      opts: { maxRetries?: number; retryDelay?: number; onRetry?: (attempt: number, error: unknown) => void } = {}
    ): Promise<T> => {
      const { maxRetries = MAX_RETRY_ATTEMPTS, retryDelay = RETRY_DELAY_MS, onRetry } = opts;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (!isOnline && attempt === 1) throw new Error("No internet connection");
          return await fn();
        } catch (error: unknown) {
          const isLast  = attempt === maxRetries;
          const e       = error as { response?: { status?: number; data?: unknown }; code?: string; message?: string };
          const isNetErr = !e.response || e.code === "NETWORK_ERROR";
          const status  = e.response?.status ?? 0;
          if (!isLast && (isNetErr || status >= 500)) {
            onRetry?.(attempt, error);
            await new Promise((r) => setTimeout(r, retryDelay * attempt));
            continue;
          }
          throw {
            message: (e.response?.data as { message?: string })?.message ?? e.message ?? "An unexpected error occurred",
            code:    status?.toString() ?? "UNKNOWN",
            details: e.response?.data ?? null,
          } as ApiError;
        }
      }
      throw new Error("Max retries exceeded");
    },
    [isOnline]
  );

  return { apiCall, isOnline };
}

// ─── Smiley Face ──────────────────────────────────────────────────────────────

type SmileyType = "excellent" | "good" | "okay" | "poor" | "veryBad";

function SmileyFace({ type, color, size = 80 }: { type: SmileyType; color: string; size?: number }) {
  const s  = size;
  const sw = s * 0.048;
  const cx = s / 2;
  const cy = s / 2;
  const r  = s / 2 - sw / 2;

  const mouths: Record<SmileyType, React.ReactNode> = {
    excellent: <path d={`M${s*.30} ${s*.62} Q${cx} ${s*.80} ${s*.70} ${s*.62}`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />,
    good:      <path d={`M${s*.32} ${s*.63} Q${cx} ${s*.75} ${s*.68} ${s*.63}`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />,
    okay:      <path d={`M${s*.33} ${s*.66} Q${cx} ${s*.70} ${s*.67} ${s*.66}`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />,
    poor:      <path d={`M${s*.32} ${s*.72} Q${cx} ${s*.62} ${s*.68} ${s*.72}`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />,
    veryBad:   <path d={`M${s*.30} ${s*.76} Q${cx} ${s*.60} ${s*.70} ${s*.76}`} stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />,
  };

  const brows: Record<SmileyType, React.ReactNode> = {
    excellent: null, good: null, okay: null, poor: null,
    veryBad: <>
      <path d={`M${s*.26} ${s*.34} L${s*.42} ${s*.39}`} stroke={color} strokeWidth={sw*.8} strokeLinecap="round" />
      <path d={`M${s*.58} ${s*.39} L${s*.74} ${s*.34}`} stroke={color} strokeWidth={sw*.8} strokeLinecap="round" />
    </>,
  };

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
      <circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={sw} fill="white" />
      <circle cx={s*.36} cy={s*.43} r={s*.045} fill={color} />
      <circle cx={s*.64} cy={s*.43} r={s*.045} fill={color} />
      {brows[type]}
      {mouths[type]}
    </svg>
  );
}

const RATING_SMILEY: Record<number, SmileyType> = { 5: "excellent", 4: "good", 3: "okay", 2: "poor", 1: "veryBad" };

// ─── QR Code ──────────────────────────────────────────────────────────────────

function CounterQrCode({ deviceToken }: { deviceToken: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError]   = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !deviceToken) return;
    QRCode.toCanvas(canvasRef.current, buildActivationUrl(deviceToken), {
      width: 200,
      margin: 2,
      color: { dark: T.brown900, light: T.creamIdle },
      errorCorrectionLevel: "M",
    }, (err) => { if (err) setError(true); });
  }, [deviceToken]);

  if (error) return (
    <div style={{
      width: 200, height: 200,
      background: T.gold100,
      borderRadius: 20,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
      border: `1.5px solid ${T.border}`,
    }}>
      <span style={{ fontSize: 28 }}>⚠️</span>
      <p style={{ fontFamily: T.fontSans, fontSize: "11px", color: T.gold550, textAlign: "center", padding: "0 12px" }}>
        QR failed. Refresh.
      </p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: T.ease }}
      style={{
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: `0 4px 32px rgba(60,40,20,0.14), 0 0 0 1.5px ${T.border}`,
        background: T.creamIdle,
        padding: 6,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", borderRadius: 14 }} />
    </motion.div>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ isOnline, connectionError, retryCount, isInitialLoad, lastChecked }: {
  isOnline: boolean;
  connectionError: boolean;
  retryCount: number;
  isInitialLoad: boolean;
  lastChecked: Date;
}) {
  const dotColor =
    !isOnline       ? "#ef4444" :
    connectionError ? "#f97316" :
    retryCount > 0  ? "#eab308" : "#4ade80";

  const label =
    !isOnline       ? "Offline" :
    isInitialLoad   ? "Connecting…" :
    connectionError ? `Retrying (${retryCount})` :
    retryCount > 0  ? "Reconnected" :
    lastChecked.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "5px 12px", borderRadius: 100,
      background: "rgba(180,140,100,0.08)",
      border: `1px solid rgba(180,140,100,0.15)`,
    }}>
      <motion.div
        animate={{ opacity: connectionError ? [1, 0.3, 1] : 1 }}
        transition={{ duration: 1.5, repeat: connectionError ? Infinity : 0 }}
        style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }}
      />
      <span style={{ fontFamily: T.fontMono, fontSize: "10px", color: "#a07850", letterSpacing: "0.04em" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Idle Screen ──────────────────────────────────────────────────────────────

interface IdleScreenProps {
  deviceInfo: { deviceToken: string; counterName: string; branchName: string } | null;
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
  deviceInfo, now, lastChecked, connectionError,
  onReset, showResetConfirm, onResetConfirmChange,
  isOnline, retryCount, isInitialLoad,
}: IdleScreenProps) {
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden flex flex-col"
      style={{ background: T.creamIdle }}
    >
      {/* ── Atmospheric background layers ─────────────────────────────────── */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Radial amber glows */}
        <div style={{
          position: "absolute", top: 0, left: 0, width: "60%", height: "60%",
          background: "radial-gradient(ellipse at 10% 10%, rgba(185,137,81,0.13) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", bottom: 0, right: 0, width: "50%", height: "50%",
          background: "radial-gradient(ellipse at 90% 90%, rgba(185,137,81,0.09) 0%, transparent 65%)",
        }} />
        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.055,
          backgroundImage: `radial-gradient(circle, ${T.gold550} 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }} />
        {/* Grain texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.018,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: T.ease }}
        style={{
          position: "relative", zIndex: 10,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "28px 36px 0",
        }}
      >
        {/* Left: identity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Connection dot */}
            <motion.div
              animate={{ opacity: connectionError ? [1, 0.2, 1] : [0.9, 0.45, 0.9] }}
              transition={{ duration: connectionError ? 1.5 : 2.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 7, height: 7, borderRadius: "50%", background: connectionError ? "#f97316" : T.gold550, flexShrink: 0 }}
            />
            <span style={{ fontFamily: T.fontMono, fontSize: "11px", color: T.gold550, letterSpacing: "0.08em" }}>
              {deviceInfo?.branchName ?? "—"}
            </span>
            <span style={{ color: T.gold400, fontSize: "10px" }}>·</span>
            <span style={{ fontFamily: T.fontMono, fontSize: "11px", color: "#9a7550", letterSpacing: "0.08em" }}>
              {deviceInfo?.counterName ?? "—"}
            </span>
          </div>
          <StatusPill
            isOnline={isOnline}
            connectionError={connectionError}
            retryCount={retryCount}
            isInitialLoad={isInitialLoad}
            lastChecked={lastChecked}
          />
        </div>

        {/* Right: clock */}
        <div style={{ textAlign: "right" }}>
          <p style={{
            fontFamily: T.fontDisplay,
            fontSize: "38px", fontWeight: 700,
            color: T.brown800,
            letterSpacing: "0.02em", lineHeight: 1,
          }}>
            {timeStr}
          </p>
          <p style={{ fontFamily: T.fontSans, fontSize: "12px", color: T.gold550, marginTop: 5 }}>
            {dateStr}
          </p>
        </div>
      </motion.div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10,
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 48px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 72, maxWidth: 800, width: "100%" }}>

          {/* ── QR panel ── */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: T.ease }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, flexShrink: 0 }}
          >
            {/* QR container card */}
            <div style={{
              background: T.creamCard,
              border: `1.5px solid ${T.border}`,
              borderRadius: 24,
              padding: 16,
              boxShadow: T.shadowCard,
              backdropFilter: "blur(16px)",
            }}>
              {deviceInfo
                ? <CounterQrCode deviceToken={deviceInfo.deviceToken} />
                : <div style={{ width: 200, height: 200, borderRadius: 14, background: T.gold100 }} />
              }
            </div>

            {/* "Scan to begin" label */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 18, height: 1, background: T.gold200 }} />
              <span style={{ fontFamily: T.fontMono, fontSize: "10px", color: T.gold550, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                Scan to begin
              </span>
              <div style={{ width: 18, height: 1, background: T.gold200 }} />
            </div>
          </motion.div>

          {/* ── OR divider ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flexShrink: 0 }}
          >
            <div style={{ width: 1, height: 52, background: T.gold200 }} />
            <span style={{ fontFamily: T.fontMono, fontSize: "9px", color: T.gold400, letterSpacing: "0.12em" }}>OR</span>
            <div style={{ width: 1, height: 52, background: T.gold200 }} />
          </motion.div>

          {/* ── Right panel ── */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.2, ease: T.ease }}
            style={{ display: "flex", flexDirection: "column", gap: 28 }}
          >
            {/* Headline */}
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "5px 14px", borderRadius: 100,
                background: T.gold100, border: `1px solid rgba(185,137,81,0.22)`,
                marginBottom: 14,
              }}>
                <motion.div
                  animate={{ opacity: [0.9, 0.45, 0.9], scale: [1, 0.88, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold600 }}
                />
                <span style={{ fontFamily: T.fontMono, fontSize: "10px", color: "#8f5f35", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                  Awaiting Servicer
                </span>
              </div>

              <h1 style={{
                fontFamily: T.fontDisplay,
                fontSize: "clamp(32px, 4vw, 50px)",
                fontWeight: 600, color: T.brown800,
                lineHeight: 1.12, marginBottom: 10,
              }}>
                Waiting for a<br />
                <em style={{ color: T.gold550 }}>Servicer</em>
              </h1>

              <p style={{ fontFamily: T.fontSans, fontSize: "14px", color: "#a07850", lineHeight: 1.6, maxWidth: 300 }}>
                A servicer must scan this QR to begin a session before customers can leave feedback.
              </p>
            </div>

            {/* Step list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { n: "1", text: "Open your phone camera" },
                { n: "2", text: "Scan the QR code" },
                { n: "3", text: "Log in with your credentials" },
              ].map(({ n, text }, i) => (
                <motion.div
                  key={n}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.06, ease: T.ease }}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: T.gold100,
                    border: `1.5px solid rgba(185,137,81,0.28)`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <span style={{ fontFamily: T.fontMono, fontSize: "10px", color: T.gold600, fontWeight: 700 }}>{n}</span>
                  </div>
                  <span style={{ fontFamily: T.fontSans, fontSize: "13.5px", color: "#9a7550" }}>{text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.45, ease: T.ease }}
        style={{
          position: "relative", zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 36px 28px",
        }}
      >
        {/* Brand wordmark */}
        <span style={{ fontFamily: T.fontDisplay, fontSize: "16px", color: "#c4a882", fontStyle: "italic" }}>
          FeedbackPro
        </span>

        {/* Reset controls */}
        <AnimatePresence mode="wait">
          {!showResetConfirm ? (
            <motion.button
              key="reset-btn"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => onResetConfirmChange(true)}
              style={{
                fontFamily: T.fontMono, fontSize: "10px", color: T.gold400,
                background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em",
              }}
            >
              Reset device
            </motion.button>
          ) : (
            <motion.div
              key="reset-confirm"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span style={{ fontFamily: T.fontSans, fontSize: "12px", color: "#a07850" }}>Reset this device?</span>
              <button
                onClick={onReset}
                style={{ fontFamily: T.fontSans, fontSize: "12px", fontWeight: 600, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
              >
                Yes, reset
              </button>
              <button
                onClick={() => onResetConfirmChange(false)}
                style={{ fontFamily: T.fontSans, fontSize: "12px", color: "#a07850", background: "none", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Feedback Screen ──────────────────────────────────────────────────────────

function FeedbackScreen({ session, onComplete }: { session: ActiveSession; onComplete: () => void }) {
  const [state, setState] = useState<FeedbackState>({
    selectedRating: null,
    selectedTagIds: [],
    comment: "",
    step: "rate",
    submitting: false,
  });

  const [tags,          setTags]          = useState<Tag[]>([]);
  const [servicer,      setServicer]      = useState<ServicerInfo | null>(null);
  const [loadingTags,   setLoadingTags]   = useState(true);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const token = localStorage.getItem("counter_device_token");
        const res   = await axios.get<{ servicer: ServicerInfo; tags: Tag[] }>(
          "/api/counter/feedback-data",
          { headers: { "X-Counter-Token": token } }
        );
        if (res.data.servicer) setServicer(res.data.servicer);
        setTags(res.data.tags ?? []);
      } catch { setTags([]); }
      finally { setLoadingTags(false); }
    };
    fetch();
  }, []);

  const theme        = state.selectedRating ?? RATINGS[0];
  const servicerName = servicer?.name ?? session.servicer_name;

  const handleRatingSelect = (rating: RatingLevel) => {
    setState((s) => ({ ...s, selectedRating: rating }));
    setTimeout(() => setState((s) => ({ ...s, step: "detail" })), 380);
  };

  const toggleTag = (id: number) =>
    setState((s) => ({
      ...s,
      selectedTagIds: s.selectedTagIds.includes(id)
        ? s.selectedTagIds.filter((t) => t !== id)
        : [...s.selectedTagIds, id],
    }));

  const handleSubmit = async () => {
    if (!state.selectedRating) return;
    setState((s) => ({ ...s, submitting: true }));
    setSubmitError(null);
    try {
      const token = localStorage.getItem("counter_device_token");
      const res   = await axios.post(
        "/api/counter/feedback",
        { rating: state.selectedRating.value, tag_ids: state.selectedTagIds, comment: state.comment.trim() || null },
        { headers: { "X-Counter-Token": token } }
      );
      if (res.status === 201 && res.data.success) {
        setState((s) => ({ ...s, submitting: false, step: "done" }));
        setTimeout(() => {
          setState({ selectedRating: null, selectedTagIds: [], comment: "", step: "rate", submitting: false });
          onComplete();
        }, THANK_YOU_DURATION * 1000);
      } else {
        setSubmitError(res.data.message || "Unable to submit feedback.");
        setState((s) => ({ ...s, submitting: false }));
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setSubmitError(e.response?.data?.error || e.message || "Failed to submit.");
      setState((s) => ({ ...s, submitting: false }));
    }
  };

  const handleEndSession = async () => {
    if (endingSession) return;
    setEndingSession(true);
    try {
      const token = localStorage.getItem("counter_device_token");
      const res   = await axios.post("/api/counter/session/end", {}, { headers: { "X-Counter-Token": token } });
      if (res.data.success) { onComplete(); return; }
      setSubmitError(res.data.message || "Unable to end session.");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setSubmitError(e.message || "Failed to end session.");
    } finally { setEndingSession(false); }
  };

  return (
<motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        minHeight: "100vh", width: "100%",
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column",
        background: "#faf4ec",
      }}
    >
      {/* ── Atmospheric background — same as setup page ───────────────────── */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: 0, left: 0, width: "65%", height: "65%",
          background: "radial-gradient(ellipse at 12% 8%, rgba(185,137,81,0.10) 0%, transparent 60%)",
        }} />
        <div style={{
          position: "absolute", bottom: 0, right: 0, width: "50%", height: "50%",
          background: "radial-gradient(ellipse at 88% 88%, rgba(185,137,81,0.07) 0%, transparent 60%)",
        }} />
        <div style={{
          position: "absolute", inset: 0, opacity: 0.018,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* ── Animated top accent bar ───────────────────────────────────────── */}
      <motion.div
        animate={{ backgroundColor: state.selectedRating ? state.selectedRating.accent : T.gold600 }}
        transition={{ duration: 0.5 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 20 }}
      />

      <AnimatePresence mode="wait">

        {/* ════════════════════════════════════════════════════════════════════
            RATE STEP — centered card layout matching setup page
        ════════════════════════════════════════════════════════════════════ */}
        {state.step === "rate" && (
          <motion.div
            key="rate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(2px)" }}
            transition={{ duration: 0.28, ease: T.ease }}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              minHeight: "100vh", position: "relative", zIndex: 2,
              padding: "40px 24px",
            }}
          >
            {/* ── Page header — mirrors setup page header ── */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: T.ease }}
              style={{ textAlign: "center", marginBottom: 32 }}
            >
              {/* Servicer badge — replaces the "COUNTER SETUP" badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 16px", borderRadius: 100,
                background: T.gold100,
                border: `1px solid rgba(185,137,81,0.22)`,
                marginBottom: 16,
              }}>
                {servicer?.avatar_url ? (
                  <img
                    src={servicer.avatar_url} alt={servicerName}
                    style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: T.gold200,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <span style={{ fontFamily: T.fontMono, fontSize: "9px", color: T.gold600, fontWeight: 700, lineHeight: 1 }}>
                      {servicerName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span style={{ fontFamily: T.fontMono, fontSize: "10px", color: "#8f5f35", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                  Served by {servicerName}
                </span>
              </div>

              {/* Multilingual headline */}
              <h1 style={{
                fontFamily: T.fontKh,
                fontSize: "clamp(22px, 3.5vw, 36px)", fontWeight: 700,
                color: T.brown900, lineHeight: 1.55, marginBottom: 6,
              }}>
                តើការបំរើសេវាកម្មរបស់ខ្ញុំយ៉ាងដូចម្តេច?
              </h1>
              <p style={{ fontFamily: T.fontSans, fontSize: "clamp(14px, 1.8vw, 17px)", color: "#4b5563", marginBottom: 2 }}>
                How was my service today?
              </p>
              <p style={{ fontFamily: T.fontSans, fontSize: "clamp(13px, 1.6vw, 16px)", fontWeight: 600, color: T.brown800 }}>
                我的服務如何？
              </p>
            </motion.div>

            {/* Gradient divider */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.18, duration: 0.55, ease: T.ease }}
              style={{
                width: "100%", maxWidth: 520, height: 1, marginBottom: 36,
                background: `linear-gradient(90deg, transparent, ${T.border}, transparent)`,
                transformOrigin: "center",
              }}
            />

            {/* ── Rating buttons card ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.55, ease: T.ease }}
              style={{
                background: T.creamCard,
                border: `1.5px solid ${T.border}`,
                borderRadius: 24,
                boxShadow: T.shadowCard,
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                padding: "32px 40px",
                width: "100%",
                maxWidth: 750,
              }}
            >
              <div style={{
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                gap: "clamp(10px, 3vw, 44px)", flexWrap: "wrap",
              }}>
                {RATINGS.map((rating, idx) => {
                  const selected    = state.selectedRating?.value === rating.value;
                  const smileySizes = [84, 74, 64, 56, 48];
                  return (
                    <motion.button
                      key={rating.value}
                      initial={{ opacity: 0, y: 22 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18 + idx * 0.055, ease: T.ease, duration: 0.42 }}
                      whileHover={{ y: -9, scale: 1.09 }}
                      whileTap={{ scale: 0.89 }}
                      onClick={() => handleRatingSelect(rating)}
                      style={{
                        background:    selected ? rating.bg    : "transparent",
                        border:        `2px solid ${selected ? rating.color : "transparent"}`,
                        borderRadius:  20,
                        padding:       "12px 14px 10px",
                        cursor:        "pointer",
                        display:       "flex", flexDirection: "column", alignItems: "center", gap: 10,
                        outline:       "none",
                        transition:    "background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease",
                        boxShadow:     selected ? `0 4px 20px ${rating.color}22` : "none",
                      }}
                    >
                      <motion.div
                        animate={
                          selected
                            ? { scale: 1.2, y: -5, filter: `drop-shadow(0 8px 18px ${rating.color}50)` }
                            : { scale: 1,   y: 0,  filter: "none" }
                        }
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <SmileyFace
                          type={RATING_SMILEY[rating.value]}
                          color={rating.color}
                          size={smileySizes[idx]}
                        />
                      </motion.div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                        <span style={{
                          fontFamily:    T.fontSans, fontSize: "12px",
                          fontWeight:    selected ? 700 : 500,
                          color:         selected ? rating.color : "#9ca3af",
                          letterSpacing: "0.01em", transition: "color 0.2s",
                        }}>
                          {rating.label}
                        </span>
                        <span style={{
                          fontFamily: T.fontKh, fontSize: "10px",
                          color: selected ? rating.color : "rgba(156,163,175,0.6)",
                          transition: "color 0.2s",
                        }}>
                          {rating.labelKh}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Gradient divider */}
            <div style={{
              width: "100%", maxWidth: 520, height: 1, margin: "32px 0 24px",
              background: `linear-gradient(90deg, transparent, ${T.border}, transparent)`,
            }} />

            {/* Appreciation note */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ textAlign: "center" }}
            >
              <p style={{ fontFamily: T.fontKh, fontSize: "clamp(12px, 1.6vw, 15px)", fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>
                យើងខ្ញុំវាយតម្លៃបំពេញការវាយតំលៃរបស់លោកអ្នក
              </p>
              <p style={{ fontFamily: T.fontSans, fontSize: "12.5px", color: "#9ca3af" }}>
                We appreciate your feedback · 我們感謝您的回饋
              </p>
            </motion.div>

            {/* Bottom wordmark */}
            <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center" }}>
              <span style={{ fontFamily: T.fontDisplay, fontSize: "15px", color: "#c4a882", fontStyle: "italic" }}>
                FeedbackPro
              </span>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            DETAIL STEP — card centered on cream, same pattern
        ════════════════════════════════════════════════════════════════════ */}
        {state.step === "detail" && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 36, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0,  filter: "blur(0px)" }}
            exit={{   opacity: 0, x: -36, filter: "blur(4px)" }}
            transition={{ duration: 0.38, ease: T.ease }}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              minHeight: "100vh", position: "relative", zIndex: 2,
              padding: "40px 24px",
            }}
          >
            {/* ── Page header ── */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: T.ease }}
              style={{ textAlign: "center", marginBottom: 28 }}
            >
              {/* Rating + servicer badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "7px 16px 7px 10px", borderRadius: 100,
                background: T.gold100,
                border: `1px solid rgba(185,137,81,0.22)`,
                marginBottom: 16,
              }}>
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.05 }}
                  style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: theme.bg,
                    border: `1.5px solid ${theme.accent}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <SmileyFace
                    type={RATING_SMILEY[state.selectedRating?.value ?? 5]}
                    color={theme.accent}
                    size={16}
                  />
                </motion.div>
                <span style={{ fontFamily: T.fontMono, fontSize: "10px", color: "#8f5f35", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                  {state.selectedRating?.label} · {servicerName}
                </span>
              </div>

              <h1 style={{
                fontFamily: T.fontDisplay,
                fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700,
                color: T.brown900, letterSpacing: "-0.01em", lineHeight: 1.1,
                marginBottom: 6,
              }}>
                Tell us more
              </h1>
              <p style={{ fontFamily: T.fontSans, fontSize: "14px", color: "#9e7a52" }}>
                Your extra details help us improve.
              </p>
            </motion.div>

            {/* ── Main card ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.55, ease: T.ease }}
              style={{
                background: T.creamCard,
                border: `1.5px solid ${T.border}`,
                borderRadius: 24,
                boxShadow: T.shadowCard,
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                padding: "28px 32px",
                width: "100%",
                maxWidth: 600,
              }}
            >
              {/* Tags */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontFamily: T.fontMono, fontSize: "10px",
                  color: T.gold600, letterSpacing: "0.10em",
                  textTransform: "uppercase", marginBottom: 14,
                }}>
                  Select tags{" "}
                  <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {loadingTags
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{
                          height: 34,
                          width: ([72, 88, 64, 96, 80] as number[])[i],
                          borderRadius: 8,
                          background: T.gold100,
                          animation: "fp-shimmer 1.5s ease-in-out infinite",
                          animationDelay: `${i * 0.12}s`,
                        }} />
                      ))
                    : tags.length === 0
                      ? <p style={{ fontFamily: T.fontSans, fontSize: "13px", color: "#9ca3af" }}>No tags available.</p>
                      : tags.map((tag, i) => {
                          const sel = state.selectedTagIds.includes(tag.id);
                          return (
                            <motion.button
                              key={tag.id}
                              initial={{ opacity: 0, scale: 0.88 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.04, ease: T.ease }}
                              onClick={() => toggleTag(tag.id)}
                              whileTap={{ scale: 0.93 }}
                              style={{
                                fontFamily:   T.fontSans, fontSize: "13px",
                                color:        sel ? tag.color : "#6b7280",
                                background:   sel ? tag.color + "14" : "rgba(61,44,30,0.03)",
                                border:       `1.5px solid ${sel ? tag.color : T.borderSoft}`,
                                borderRadius: 8, padding: "7px 14px",
                                cursor: "pointer", fontWeight: sel ? 600 : 400,
                                transition: "all 0.15s", outline: "none",
                              }}
                            >
                              {tag.name}
                            </motion.button>
                          );
                        })
                  }
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: "100%", height: 1, background: T.borderSoft, marginBottom: 20 }} />

              {/* Comment textarea */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontFamily: T.fontMono, fontSize: "10px",
                  color: T.gold600, letterSpacing: "0.10em",
                  textTransform: "uppercase", marginBottom: 10,
                }}>
                  Additional comments{" "}
                  <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
                </p>
                <textarea
                  value={state.comment}
                  onChange={(e) => setState((s) => ({ ...s, comment: e.target.value }))}
                  placeholder="Tell us more about your experience…"
                  style={{
                    width: "100%", height: 100,
                    fontFamily: T.fontSans, fontSize: "14px",
                    padding: "12px 14px",
                    border: `1.5px solid ${theme.accent}38`,
                    borderRadius: 12, resize: "none", outline: "none",
                    color: T.brown800,
                    background: "rgba(255,255,255,0.5)",
                    transition: "border-color 0.2s",
                    lineHeight: 1.55,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = theme.accent; }}
                  onBlur={(e)  => { e.target.style.borderColor = theme.accent + "38"; }}
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {submitError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{   opacity: 0, height: 0 }}
                    style={{ overflow: "hidden", marginBottom: 16 }}
                  >
                    <div style={{
                      fontFamily: T.fontSans, fontSize: "13px", color: "#ef4444",
                      background: "#fef2f2", border: "1px solid #fecaca",
                      borderRadius: 10, padding: "10px 14px",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
                      {submitError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <motion.button
                onClick={handleSubmit}
                disabled={state.submitting}
                whileHover={!state.submitting ? { y: -2, boxShadow: `0 10px 32px ${theme.accent}38` } : {}}
                whileTap={!state.submitting  ? { scale: 0.98 } : {}}
                style={{
                  fontFamily:    T.fontSans, fontSize: "15px", fontWeight: 600,
                  color:         "#fdf6ec",
                  background:    state.submitting ? "#9ca3af" : T.brown800,
                  border:        "none", borderRadius: 16,
                  padding:       "14px 32px", width: "100%",
                  cursor:        state.submitting ? "not-allowed" : "pointer",
                  letterSpacing: "0.01em",
                  display:       "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition:    "background 0.25s, box-shadow 0.25s",
                  outline:       "none",
                }}
              >
                {state.submitting ? (
                  <>
                    <div style={{
                      width: 15, height: 15, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white",
                      animation: "fp-spin 0.7s linear infinite",
                      flexShrink: 0,
                    }} />
                    Submitting…
                  </>
                ) : (
                  <>
                    Submit Feedback
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="#fdf6ec" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </motion.button>
            </motion.div>

            {/* Back + End Session row — below the card, subtle */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}
            >
              <button
                onClick={() => setState((s) => ({ ...s, step: "rate", selectedRating: null }))}
                style={{
                  fontFamily: T.fontSans, fontSize: "13px",
                  color: T.brown600,
                  background: "none", border: "none",
                  cursor: "pointer", outline: "none",
                  display: "flex", alignItems: "center", gap: 4, opacity: 0.7,
                }}
              >
                ← Change rating
              </button>
              <span style={{ color: T.gold200, fontSize: "12px" }}>·</span>
              <button
                onClick={handleEndSession}
                disabled={endingSession}
                style={{
                  fontFamily: T.fontSans, fontSize: "13px",
                  color: "#ef4444",
                  background: "none", border: "none",
                  cursor: endingSession ? "not-allowed" : "pointer",
                  outline: "none", opacity: endingSession ? 0.6 : 0.75,
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {endingSession && (
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    border: "1.5px solid rgba(239,68,68,0.3)",
                    borderTopColor: "#ef4444",
                    animation: "fp-spin 0.7s linear infinite",
                    flexShrink: 0,
                  }} />
                )}
                {endingSession ? "Ending session…" : "End session"}
              </button>
            </motion.div>

            {/* Bottom wordmark */}
            <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center" }}>
              <span style={{ fontFamily: T.fontDisplay, fontSize: "15px", color: "#c4a882", fontStyle: "italic" }}>
                FeedbackPro
              </span>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            DONE STEP — centered on cream, matches setup success card
        ════════════════════════════════════════════════════════════════════ */}
        {state.step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1,    filter: "blur(0px)" }}
            transition={{ duration: 0.42, ease: T.ease }}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              minHeight: "100vh", position: "relative", zIndex: 2,
              padding: "48px 24px", textAlign: "center",
            }}
          >
            {/* ── Success card ── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.55, ease: T.ease }}
              style={{
                background: T.creamCard,
                border: `1.5px solid ${T.border}`,
                borderRadius: 24,
                boxShadow: T.shadowCard,
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                padding: "48px 48px 40px",
                width: "100%", maxWidth: 480,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
              }}
            >
              {/* Success ring */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.12 }}
                style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: `${theme.accent}12`,
                  border: `2px solid ${theme.accent}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 0 10px ${theme.accent}0a`,
                  marginBottom: 24,
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <motion.path
                    d="M8 16l5.5 5.5 10.5-11"
                    stroke={theme.accent}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, delay: 0.28, ease: "easeOut" }}
                  />
                </svg>
              </motion.div>

              {/* Thank you copy */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, ease: T.ease }}
                style={{ marginBottom: 20 }}
              >
                <p style={{
                  fontFamily: T.fontDisplay,
                  fontSize: "clamp(32px, 5.5vw, 52px)", fontWeight: 700,
                  color: T.brown900,
                  marginBottom: 8, letterSpacing: "-0.02em", lineHeight: 1.05,
                }}>
                  Thank You!
                </p>
                <p style={{
                  fontFamily: T.fontKh,
                  fontSize: "clamp(14px, 2.2vw, 20px)",
                  color: theme.accent, fontWeight: 600,
                  marginBottom: 8, lineHeight: 1.5,
                }}>
                  អរគុណចំពោះមតិកែលម្អរបស់អ្នក
                </p>
                <p style={{ fontFamily: T.fontSans, fontSize: "14px", color: "#9e7a52", lineHeight: 1.5 }}>
                  Your feedback has been recorded.
                </p>
                <p style={{ fontFamily: T.fontSans, fontSize: "13px", color: "#9ca3af", marginTop: 2 }}>
                  我們感謝您的回饋。
                </p>
              </motion.div>

              {/* Progress bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.42 }}
                style={{ width: "100%", maxWidth: 240 }}
              >
                <div style={{
                  width: "100%", height: 3, borderRadius: 2,
                  background: `${theme.accent}18`, overflow: "hidden",
                }}>
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: THANK_YOU_DURATION - 0.44, ease: "linear", delay: 0.44 }}
                    style={{ height: "100%", background: theme.accent, borderRadius: 2 }}
                  />
                </div>
                <p style={{
                  fontFamily: T.fontMono, fontSize: "10px",
                  color: `${theme.accent}70`,
                  letterSpacing: "0.06em", marginTop: 8,
                }}>
                  Returning to idle…
                </p>
              </motion.div>
            </motion.div>

            {/* Bottom wordmark */}
            <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center" }}>
              <span style={{ fontFamily: T.fontDisplay, fontSize: "15px", color: "#c4a882", fontStyle: "italic" }}>
                FeedbackPro
              </span>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CounterActive() {
  const now              = useClock();
  const { apiCall, isOnline } = useApiWithRetry();

  const [deviceInfo,      setDeviceInfo]      = useState<ReturnType<typeof readDeviceInfo>>(null);
  const [activeSession,   setActiveSession]   = useState<ActiveSession | null>(null);
  const [lastChecked,     setLastChecked]     = useState(new Date());
  const [pollingPaused,   setPollingPaused]   = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [showResetConfirm,setShowResetConfirm]= useState(false);
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
        { onRetry: (attempt, error) => { console.warn(`Poll retry ${attempt}:`, error); setRetryCount(attempt); } }
      );
      setLastChecked(new Date());
      setConnectionError(false);
      setRetryCount(0);
      setIsInitialLoad(false);
      if (res.data.active && res.data.session) setActiveSession(res.data.session);
      else if (activeSession) { setActiveSession(null); setPollingPaused(false); }
    } catch (error: unknown) {
      const e = error as ApiError;
      if (e.code === "401") { clearDeviceState(); router.visit(route("counter.setup")); return; }
      setConnectionError(true);
      setIsInitialLoad(false);
    }
  }, [pollingPaused, apiCall, activeSession, isOnline]);

  useEffect(() => {
    if (!deviceInfo) return;
    pollSession();
    const interval = setInterval(pollSession, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [deviceInfo, pollSession]);

  const handleReset           = () => { setPollingPaused(true); clearDeviceState(); router.visit(route("counter.setup")); };
  const handleFeedbackComplete = () => { setActiveSession(null); setPollingPaused(false); };

  if (!deviceInfo) return null;

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Noto+Sans+Khmer:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        * { -webkit-font-smoothing: antialiased; box-sizing: border-box; }
        button { outline: none; }
        button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
        @keyframes fp-shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fp-spin     { to { transform: rotate(360deg); } }
        .fp-spinner {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          animation: fp-spin 0.7s linear infinite;
        }
      `}</style>

      <AnimatePresence mode="wait">
        {activeSession ? (
          <FeedbackScreen key="feedback" session={activeSession} onComplete={handleFeedbackComplete} />
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
    </>
  );
}