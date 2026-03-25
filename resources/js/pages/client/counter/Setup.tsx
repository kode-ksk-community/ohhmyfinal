/**
 * CounterSetup.tsx — Redesigned
 *
 * Counter device setup page — shown on first visit or when the device
 * has no active device_token in localStorage.
 *
 * Flow:
 *   Step 1 → Select Branch   (branches passed via Inertia props)
 *   Step 2 → Select Counter  (fetched from API after branch is chosen)
 *   Step 3 → Enter PIN       (submitted to API → device_token returned)
 *   ✅ Done → token stored in localStorage → Inertia redirect to /counter/idle
 */

import { useState, useCallback } from "react";
import { router, Head } from "@inertiajs/react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch {
  id: number;
  name: string;
  address: string | null;
}

interface Counter {
  id: number;
  branch_id: number;
  name: string;
  description: string | null;
}

interface Props {
  branches: Branch[];
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Branch", "Counter", "PIN"];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;

        return (
          <div key={label} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center" style={{ width: 56 }}>
              <motion.div
                animate={{
                  backgroundColor: isDone
                    ? "#b98951"
                    : isActive
                      ? "#3d2c1e"
                      : "transparent",
                  borderColor: isDone
                    ? "#b98951"
                    : isActive
                      ? "#3d2c1e"
                      : "rgba(61,44,30,0.2)",
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center mb-1.5"
              >
                {isDone ? (
                  <motion.svg
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <motion.path
                      d="M2 6l3 3 5-5"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.svg>
                ) : (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      fontFamily: "'DM Mono', monospace",
                      color: isActive ? "#f8f1e8" : "rgba(61,44,30,0.35)",
                    }}
                  >
                    {step}
                  </span>
                )}
              </motion.div>
              <span
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 500,
                  color: isActive
                    ? "#3d2c1e"
                    : isDone
                      ? "#b98951"
                      : "rgba(61,44,30,0.3)",
                  transition: "color 0.3s",
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector */}
            {i < steps.length - 1 && (
              <motion.div
                style={{ width: 40, height: 1, marginBottom: 20, flexShrink: 0 }}
                animate={{
                  backgroundColor: isDone
                    ? "#b98951"
                    : "rgba(61,44,30,0.12)",
                }}
                transition={{ duration: 0.4 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Selectable Card ──────────────────────────────────────────────────────────

function SelectCard({
  label,
  sublabel,
  selected,
  onClick,
  index,
}: {
  label: string;
  sublabel?: string | null;
  selected: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.055,
        duration: 0.38,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className="w-full text-left group"
      style={{
        padding: "14px 18px",
        borderRadius: 16,
        border: `1.5px solid ${selected ? "#b98951" : "rgba(61,44,30,0.1)"}`,
        backgroundColor: selected
          ? "rgba(185,137,81,0.06)"
          : "rgba(61,44,30,0.015)",
        transition: "border-color 0.2s, background-color 0.2s",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: "15px",
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            color: selected ? "#3d2c1e" : "rgba(61,44,30,0.65)",
            transition: "color 0.2s",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </p>
        {sublabel && (
          <p
            style={{
              fontSize: "12px",
              color: "rgba(61,44,30,0.4)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sublabel}
          </p>
        )}
      </div>

      {/* Selection indicator */}
      <motion.div
        animate={{
          scale: selected ? 1 : 0.6,
          opacity: selected ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: "#b98951",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5l2.5 2.5 3.5-4"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </motion.button>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "36px 16px",
        borderRadius: 16,
        border: "1.5px dashed rgba(61,44,30,0.12)",
        backgroundColor: "rgba(61,44,30,0.02)",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: "14px", color: "rgba(61,44,30,0.6)", fontWeight: 500 }}>
        {title}
      </p>
      <p style={{ fontSize: "12px", color: "rgba(61,44,30,0.35)", marginTop: 4 }}>
        {hint}
      </p>
    </div>
  );
}

// ─── Back Button ──────────────────────────────────────────────────────────────

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "rgba(61,44,30,0.06)",
        border: "1.5px solid rgba(61,44,30,0.1)",
        color: disabled ? "rgba(61,44,30,0.25)" : "#6b4c2f",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "opacity 0.2s",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M9 11L5 7l4-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ─── PIN Keypad ───────────────────────────────────────────────────────────────

function PinKeypad({
  pin,
  onChange,
  disabled,
}: {
  pin: string;
  onChange: (pin: string) => void;
  disabled?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
  const PIN_LENGTH = 6;

  const handleKey = (key: string) => {
    if (disabled) return;
    if (key === "del") onChange(pin.slice(0, -1));
    else if (pin.length < PIN_LENGTH) onChange(pin + key);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
      {/* Dot indicators */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < pin.length;
          const isJustFilled = i === pin.length - 1;
          return (
            <motion.div
              key={i}
              animate={{
                scale: isJustFilled ? [1, 1.4, 1] : 1,
                backgroundColor: filled ? "#3d2c1e" : "rgba(61,44,30,0.12)",
              }}
              transition={{ duration: 0.18 }}
              style={{
                width: filled ? 12 : 10,
                height: filled ? 12 : 10,
                borderRadius: "50%",
                transition: "width 0.15s, height 0.15s",
              }}
            />
          );
        })}
      </div>

      {/* Keypad grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          width: "100%",
          maxWidth: 252,
        }}
      >
        {keys.map((key, i) => {
          if (key === "")
            return <div key={i} style={{ height: 52 }} />;

          const isDel = key === "del";
          return (
            <motion.button
              key={i}
              whileTap={!disabled ? { scale: 0.88 } : {}}
              onClick={() => handleKey(key)}
              disabled={disabled}
              style={{
                height: 52,
                borderRadius: 14,
                border: "1.5px solid rgba(61,44,30,0.1)",
                backgroundColor: isDel
                  ? "rgba(61,44,30,0.03)"
                  : "rgba(61,44,30,0.05)",
                color: disabled ? "rgba(61,44,30,0.25)" : "#3d2c1e",
                fontSize: isDel ? 16 : 19,
                fontFamily: isDel ? "'DM Sans', sans-serif" : "'DM Mono', monospace",
                fontWeight: isDel ? 400 : 500,
                cursor: disabled ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.15s",
              }}
            >
              {isDel ? (
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  <path
                    d="M6.5 1H17V13H6.5L1 7l5.5-6z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 5l4 4M14 5l-4 4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                key
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16, color = "#b98951" }: { size?: number; color?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${color}30`,
        borderTopColor: color,
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  backButton,
}: {
  title: string;
  subtitle: string;
  backButton?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
      {backButton}
      <div>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "20px",
            fontWeight: 700,
            color: "#3d2c1e",
            lineHeight: 1.2,
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: "12.5px", color: "#9e7a52", marginTop: 3 }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Page transition variants ─────────────────────────────────────────────────

const pageVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 32,
    filter: "blur(3px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -32,
    filter: "blur(3px)",
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CounterSetup({ branches }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState(1);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<Counter | null>(null);
  const [pin, setPin] = useState("");
  const [loadingCounters, setLoadingCounters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const goTo = (s: 1 | 2 | 3, dir: number) => {
    setDirection(dir);
    setStep(s);
  };

  // Step 1 → 2
  const handleBranchSelect = useCallback(async (branch: Branch) => {
    setSelectedBranch(branch);
    setSelectedCounter(null);
    setCounters([]);
    setLoadingCounters(true);

    try {
      const res = await axios.get<{ data: Counter[] }>(
        `/api/branches/${branch.id}/counters`
      );
      setCounters(res.data.data);
      goTo(2, 1);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ?? "Failed to load counters. Please try again."
      );
    } finally {
      setLoadingCounters(false);
    }
  }, []);

  // Step 2 → 3
  const handleCounterSelect = useCallback((counter: Counter) => {
    setSelectedCounter(counter);
    setPin("");
    goTo(3, 1);
  }, []);

  // Submit PIN
  const handlePinSubmit = useCallback(async () => {
    if (!selectedCounter) return;
    if (pin.length < 4) {
      toast.error("Please enter your PIN");
      return;
    }

    setSubmitting(true);

    try {
      const res = await axios.post<{ device_token: string }>(
        "/api/counter/activate-device",
        { counter_id: selectedCounter.id, pin }
      );

      localStorage.setItem("counter_device_token", res.data.device_token);
      localStorage.setItem("counter_id", String(selectedCounter.id));
      localStorage.setItem("counter_name", selectedCounter.name);
      localStorage.setItem("branch_id", String(selectedBranch!.id));
      localStorage.setItem("branch_name", selectedBranch!.name);

      setSuccess(true);
      setTimeout(() => router.visit(route("counter.idle")), 1800);
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 422) {
        toast.error(message ?? "Incorrect PIN. Please try again.");
      } else if (status === 403) {
        toast.error(message ?? "This counter is not available.");
      } else {
        toast.error("Something went wrong. Please check your connection.");
      }

      setPin("");
    } finally {
      setSubmitting(false);
    }
  }, [selectedCounter, selectedBranch, pin]);

  const handlePinChange = useCallback(
    (newPin: string) => {
      setPin(newPin);
      // if (newPin.length === 6) {
      //   setTimeout(() => handlePinSubmit(), 500);
      // }
    },
    [handlePinSubmit]
  );

  const goBackToStep1 = () => goTo(1, -1);
  const goBackToStep2 = () => { goTo(2, -1); setPin(""); };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Head title="Counter Setup" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#fdf6ec",
            color: "#3d2c1e",
            border: "1.5px solid rgba(185,137,81,0.25)",
            borderRadius: 14,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13.5px",
            boxShadow: "0 8px 24px rgba(90,62,37,0.1)",
          },
          error: {
            iconTheme: { primary: "#b98951", secondary: "#fdf6ec" },
          },
        }}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes breathe { 0%,100% { opacity:.9; transform:scale(1); } 50% { opacity:.5; transform:scale(.92); } }
        * { -webkit-font-smoothing: antialiased; box-sizing: border-box; }
        button { outline: none; }
        button:focus-visible {
          outline: 2px solid #b98951;
          outline-offset: 2px;
          border-radius: 12px;
        }
      `}</style>

      {/* Page background */}
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: "#faf4ec",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle texture overlay */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              radial-gradient(ellipse 70% 60% at 15% 10%, rgba(185,137,81,0.1) 0%, transparent 60%),
              radial-gradient(ellipse 50% 50% at 85% 85%, rgba(185,137,81,0.07) 0%, transparent 60%)
            `,
            pointerEvents: "none",
          }}
        />
        {/* Grain texture */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.018,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            pointerEvents: "none",
          }}
        />

        {/* Main container */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            {/* Live badge */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 14px",
                borderRadius: 100,
                background: "rgba(185,137,81,0.1)",
                border: "1px solid rgba(185,137,81,0.22)",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "#b98951",
                  display: "block",
                  animation: "breathe 2.2s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  color: "#8f5f35",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "10.5px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                Counter Setup
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(30px, 6vw, 40px)",
                fontWeight: 700,
                color: "#2c1f12",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                marginBottom: 8,
              }}
            >
              Activate This Device
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ fontSize: "14px", color: "#9e7a52", lineHeight: 1.5 }}
            >
              Set up this counter to start collecting feedback
            </motion.p>
          </div>

          {/* ── Step indicator ──────────────────────────────────────────────── */}
          <StepIndicator current={step} />

          {/* ── Card ────────────────────────────────────────────────────────── */}
          <motion.div
            layout
            style={{
              borderRadius: 24,
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(20px)",
              border: "1.5px solid rgba(185,137,81,0.16)",
              boxShadow:
                "0 2px 4px rgba(90,62,37,0.04), 0 8px 24px rgba(90,62,37,0.08), 0 24px 48px rgba(90,62,37,0.06)",
              padding: "28px 26px",
              overflow: "hidden",
            }}
          >
            <AnimatePresence mode="wait" custom={direction}>

              {/* ── Step 1: Select Branch ─────────────────────────────────── */}
              {step === 1 && !success && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <SectionHeader
                    title="Select your branch"
                    subtitle="Which location is this device at?"
                  />

                  {branches.length === 0 ? (
                    <EmptyState
                      icon="🏢"
                      title="No active branches found"
                      hint="Ask your admin to create branches first."
                    />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {branches.map((b, i) => (
                        <SelectCard
                          key={b.id}
                          index={i}
                          label={b.name}
                          sublabel={b.address}
                          selected={selectedBranch?.id === b.id}
                          onClick={() => handleBranchSelect(b)}
                        />
                      ))}
                    </div>
                  )}

                  <AnimatePresence>
                    {loadingCounters && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          marginTop: 18,
                          paddingTop: 4,
                        }}
                      >
                        <Spinner size={14} />
                        <span style={{ fontSize: "13px", color: "#9e7a52" }}>
                          Loading counters…
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ── Step 2: Select Counter ────────────────────────────────── */}
              {step === 2 && !success && (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <SectionHeader
                    title="Select a counter"
                    subtitle={`Available at ${selectedBranch?.name}`}
                    backButton={<BackButton onClick={goBackToStep1} />}
                  />

                  {counters.length === 0 ? (
                    <EmptyState
                      icon="🖥️"
                      title="No active counters here"
                      hint="Ask your admin to create and activate counters."
                    />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {counters.map((c, i) => (
                        <SelectCard
                          key={c.id}
                          index={i}
                          label={c.name}
                          sublabel={c.description}
                          selected={selectedCounter?.id === c.id}
                          onClick={() => handleCounterSelect(c)}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Step 3: Enter PIN ─────────────────────────────────────── */}
              {step === 3 && !success && (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <SectionHeader
                    title="Enter counter PIN"
                    subtitle={`Activating ${selectedCounter?.name}`}
                    backButton={
                      <BackButton onClick={goBackToStep2} disabled={submitting} />
                    }
                  />

                  <div style={{ marginTop: 8 }}>
                    <PinKeypad
                      pin={pin}
                      onChange={handlePinChange}
                      disabled={submitting}
                    />
                  </div>

                  {/* Manual submit for 4–5 digit PINs */}
                  <AnimatePresence>
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      onClick={handlePinSubmit}
                      disabled={!((pin.length >= 4 && pin.length <= 6) || submitting)}
                      style={{
                        width: "100%",
                        marginTop: 24,
                        padding: "14px",
                        borderRadius: 16,
                        background: "#3d2c1e",
                        color: "#fdf6ec",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "15px",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        letterSpacing: "0.01em",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      Activate Counter
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 8h10M9 4l4 4-4 4"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.button>
                    {/* {pin.length >= 4 && pin.length < 6 && !submitting && (
                    )} */}
                  </AnimatePresence>

                  {/* Submitting state */}
                  <AnimatePresence>
                    {submitting && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          marginTop: 20,
                        }}
                      >
                        <Spinner size={14} />
                        <span style={{ fontSize: "13px", color: "#9e7a52" }}>
                          Verifying PIN…
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ── Success ───────────────────────────────────────────────── */}
              {success && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    padding: "28px 16px",
                    gap: 16,
                  }}
                >
                  {/* Animated checkmark circle */}
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.05 }}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "rgba(185,137,81,0.1)",
                      border: "2px solid #b98951",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                      <motion.path
                        d="M5 13l5.5 5.5L21 8"
                        stroke="#b98951"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }}
                      />
                    </svg>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <p
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "26px",
                        fontWeight: 700,
                        color: "#2c1f12",
                        marginBottom: 6,
                      }}
                    >
                      Counter Activated!
                    </p>
                    <p style={{ fontSize: "14px", color: "#8f5f35", marginBottom: 4 }}>
                      {selectedBranch?.name} · {selectedCounter?.name}
                    </p>
                    <p style={{ fontSize: "12px", color: "rgba(61,44,30,0.35)" }}>
                      Redirecting to idle screen…
                    </p>
                  </motion.div>

                  {/* Progress bar */}
                  <motion.div
                    style={{
                      width: "100%",
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: "rgba(185,137,81,0.15)",
                      overflow: "hidden",
                      marginTop: 8,
                    }}
                  >
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.6, ease: "linear" }}
                      style={{ height: "100%", backgroundColor: "#b98951", borderRadius: 2 }}
                    />
                  </motion.div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{
              textAlign: "center",
              marginTop: 16,
              fontFamily: "'DM Mono', monospace",
              fontSize: "10.5px",
              color: "rgba(185,137,81,0.35)",
              letterSpacing: "0.04em",
            }}
          >
            This device will remember its counter after setup
          </motion.p>
        </motion.div>
      </div>
    </>
  );
}