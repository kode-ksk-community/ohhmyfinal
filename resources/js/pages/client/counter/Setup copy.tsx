/**
 * CounterSetup.tsx
 *
 * Counter device setup page — shown on first visit or when the device
 * has no active device_token in localStorage.
 *
 * Flow:
 *   Step 1 → Select Branch   (branches passed via Inertia props)
 *   Step 2 → Select Counter  (fetched from API after branch is chosen)
 *   Step 3 → Enter PIN       (submitted to API → device_token returned)
 *   ✅ Done → token stored in localStorage → Inertia redirect to /counter/idle
 *
 * Route:    GET  /counter/setup
 *           (renders this page via CounterSetupController@show)
 * File:     resources/js/Pages/Counter/Setup.tsx
 *
 * ─── Laravel side you need ────────────────────────────────────────────────────
 *
 * routes/web.php:
 *   Route::get('/counter/setup', [CounterSetupController::class, 'show'])
 *        ->name('counter.setup');
 *   Route::get('/counter/idle',  [CounterSetupController::class, 'idle'])
 *        ->name('counter.idle');
 *
 * routes/api.php:
 *   Route::get('/branches/{branch}/counters', [CounterSetupController::class, 'counters']);
 *   Route::post('/counter/activate-device',   [CounterSetupController::class, 'activateDevice']);
 *
 * CounterSetupController@show:
 *   return Inertia::render('Counter/Setup', [
 *       'branches' => Branch::active()->select('id','name','address')->get(),
 *   ]);
 *
 * CounterSetupController@counters  (JSON):
 *   $branch = Branch::findOrFail($branch);
 *   return response()->json([
 *       'data' => $branch->counters()
 *           ->active()
 *           ->select('id','branch_id','name','description')
 *           ->get(),
 *   ]);
 *
 * CounterSetupController@activateDevice  (JSON):
 *   $validated = $request->validate([
 *       'counter_id' => 'required|exists:counters,id',
 *       'pin'        => 'required|string',
 *   ]);
 *   $counter = Counter::findOrFail($validated['counter_id']);
 *   if (!Hash::check($validated['pin'], $counter->pin)) {
 *       return response()->json(['message' => 'Incorrect PIN.'], 422);
 *   }
 *   $token = $counter->issueDeviceToken(); // generates + stores Str::random(64)
 *   return response()->json(['device_token' => $token]);
 * ─────────────────────────────────────────────────────────────────────────────
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

/**
 * Props injected by Inertia (CounterSetupController@show).
 * `branches` is always present — it is loaded server-side so the page
 * renders instantly without a client-side fetch on load.
 */
interface Props {
  branches: Branch[];
}

// ─── Animation variants ───────────────────────────────────────────────────────

const stepVariants = {
  enter: { opacity: 0, x: 48, filter: "blur(4px)" },
  center: {
    opacity: 1, x: 0, filter: "blur(0px)",
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0, x: -48, filter: "blur(4px)",
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Branch", "Counter", "PIN"];
  return (
    <div className="flex items-center gap-3 mb-10 justify-center">
      {steps?.map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={label} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={{
                  backgroundColor: isDone ? "#10b981" : isActive ? "#f8fafc" : "transparent",
                  borderColor: isDone ? "#10b981" : isActive ? "#f8fafc" : "rgba(248,250,252,0.2)",
                  scale: isActive ? 1.12 : 1,
                }}
                transition={{ duration: 0.3 }}
                className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
              >
                {isDone ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="text-white text-sm font-bold">✓</motion.span>
                ) : (
                  <span className="text-sm font-bold"
                    style={{
                      color: isActive ? "#0f172a" : "rgba(248,250,252,0.3)",
                      fontFamily: "'DM Mono', monospace"
                    }}>
                    {step}
                  </span>
                )}
              </motion.div>
              <span className="text-xs tracking-widest uppercase"
                style={{
                  color: isActive ? "#f8fafc" : isDone ? "#10b981" : "rgba(248,250,252,0.3)",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 500,
                }}>
                {label}
              </span>
            </div>
            {i < steps?.length - 1 && (
              <motion.div className="w-14 h-px mb-5"
                animate={{ backgroundColor: isDone ? "#10b981" : "rgba(248,250,252,0.12)" }}
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

function SelectCard({ label, sublabel, selected, onClick, index }: {
  label: string;
  sublabel?: string | null;
  selected: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full text-left px-5 py-4 rounded-2xl border-2 transition-colors"
      style={{
        borderColor: selected ? "#f8fafc" : "rgba(248,250,252,0.1)",
        backgroundColor: selected ? "rgba(248,250,252,0.1)" : "rgba(248,250,252,0.03)",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-semibold"
            style={{
              color: selected ? "#f8fafc" : "rgba(248,250,252,0.65)",
              fontFamily: "'Syne', sans-serif",
            }}>
            {label}
          </p>
          {sublabel && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(248,250,252,0.35)" }}>
              {sublabel}
            </p>
          )}
        </div>
        <motion.div
          animate={{ scale: selected ? 1 : 0.4, opacity: selected ? 1 : 0 }}
          className="w-6 h-6 rounded-full bg-white flex items-center justify-center flex-shrink-0"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
        </motion.div>
      </div>
    </motion.button>
  );
}

// ─── PIN Keypad ───────────────────────────────────────────────────────────────

function PinKeypad({ pin, onChange, disabled }: {
  pin: string;
  onChange: (pin: string) => void;
  disabled?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  const handleKey = (key: string) => {
    if (disabled) return;
    if (key === "del") onChange(pin.slice(0, -1));
    else if (pin?.length < 6) onChange(pin + key);
  };

  return (
    <div className="flex flex-col items-center gap-7">
      {/* Dots */}
      <div className="flex gap-4">
        {Array.from({ length: 6 })?.map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scale: i === pin?.length - 1 ? [1, 1.35, 1] : 1,
              backgroundColor: i < pin?.length ? "#f8fafc" : "rgba(248,250,252,0.15)",
            }}
            transition={{ duration: 0.15 }}
            className="w-3.5 h-3.5 rounded-full"
          />
        ))}
      </div>

      {/* Keys */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
        {keys?.map((key, i) => {
          if (key === "") return <div key={i} />;
          return (
            <motion.button
              key={i}
              whileHover={!disabled ? { scale: 1.06 } : {}}
              whileTap={!disabled ? { scale: 0.91 } : {}}
              onClick={() => handleKey(key)}
              disabled={disabled}
              className="h-14 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: key === "del" ? "rgba(248,250,252,0.05)" : "rgba(248,250,252,0.08)",
                border: "1px solid rgba(248,250,252,0.1)",
                color: disabled ? "rgba(248,250,252,0.3)" : "rgba(248,250,252,0.9)",
                fontSize: key === "del" ? "15px" : "20px",
                fontFamily: key === "del" ? "inherit" : "'DM Mono', monospace",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {key === "del" ? "⌫" : key}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Spinner helper ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: "rgba(248,250,252,0.4)", borderTopColor: "transparent" }} />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CounterSetup({ branches }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<Counter | null>(null);
  const [pin, setPin] = useState("");
  const [loadingCounters, setLoadingCounters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Step 1 → 2: Fetch counters for selected branch ────────────────────────

  const handleBranchSelect = useCallback(async (branch: Branch) => {
    setSelectedBranch(branch);
    setSelectedCounter(null);
    setCounters([]);
    setLoadingCounters(true);

    try {
      /**
       * GET /api/branches/{id}/counters
       * Returns: { data: Counter[] }
       *
       * Controller: CounterSetupController@counters
       *   → Branch::findOrFail($id)
       *   → $branch->counters()->active()->get(['id','branch_id','name','description'])
       */
      const res = await axios.get<{ data: Counter[] }>(
        `/api/branches/${branch.id}/counters`
      );
      setCounters(res.data.data);
      setStep(2);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ?? "Failed to load counters. Please try again."
      );
    } finally {
      setLoadingCounters(false);
    }
  }, []);

  // ── Step 2 → 3: Counter selected ─────────────────────────────────────────

  const handleCounterSelect = useCallback((counter: Counter) => {
    setSelectedCounter(counter);
    setPin("");
    setStep(3);
  }, []);

  // ── Step 3: Submit PIN ────────────────────────────────────────────────────

  const handlePinSubmit = useCallback(async () => {
    if (!selectedCounter) return;
    if (pin?.length < 4) {
      toast.error("Please enter your PIN");
      return;
    }

    setSubmitting(true);

    try {
      /**
       * POST /api/counter/activate-device
       * Body:    { counter_id: number, pin: string }
       * Returns: { device_token: string }
       *
       * Controller: CounterSetupController@activateDevice
       *   → Validate counter_id + pin
       *   → Hash::check($pin, $counter->pin)  ← server-side only, never client-side
       *   → $counter->issueDeviceToken()       ← generates Str::random(64) + saves
       *   → return ['device_token' => $token]
       */
      const res = await axios.post<{ device_token: string }>(
        "/api/counter/activate-device",
        {
          counter_id: selectedCounter.id,
          pin,
        }
      );

      /**
       * Store device identity in localStorage.
       * These keys are read by CounterIdle.tsx and CounterFeedback.tsx
       * to know which counter this device is without requiring a re-login.
       *
       * The device_token is sent as a header (X-Counter-Token) on every
       * subsequent API request from this device to identify it server-side.
       */
      localStorage.setItem("counter_device_token", res.data.device_token);
      localStorage.setItem("counter_id", String(selectedCounter.id));
      localStorage.setItem("counter_name", selectedCounter.name);
      localStorage.setItem("branch_id", String(selectedBranch!.id));
      localStorage.setItem("branch_name", selectedBranch!.name);

      setSuccess(true);

      // Small delay so the user sees the success animation before redirect
      setTimeout(() => {
        /**
         * Inertia visit to the idle screen.
         * The idle screen will start polling for an active servicer session.
         */
        router.visit(route("counter.idle"));
      }, 1800);

    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 422) {
        // Validation error — most likely incorrect PIN
        toast.error(message ?? "Incorrect PIN. Please try again.");
      } else if (status === 403) {
        // Counter is inactive or not found in this branch
        toast.error(message ?? "This counter is not available.");
      } else {
        // Network or server error
        toast.error("Something went wrong. Please check your connection.");
      }

      setPin(""); // Always clear PIN on failure for security
    } finally {
      setSubmitting(false);
    }
  }, [selectedCounter, selectedBranch, pin]);

  // Auto-submit when PIN reaches 6 digits
  const handlePinChange = useCallback((newPin: string) => {
    setPin(newPin);
    if (newPin?.length === 6) {
      // Small delay so user sees all 6 dots filled before submitting
      setTimeout(() => handlePinSubmit(), 300);
    }
  }, [handlePinSubmit]);

  // ── Back navigation ───────────────────────────────────────────────────────

  const goBackToStep1 = () => {
    setStep(1);
    // Keep selectedBranch so it stays highlighted when going back
  };

  const goBackToStep2 = () => {
    setStep(2);
    setPin("");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Head title="Counter Setup" />
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1e293b",
            color: "#f8fafc",
            border: "1px solid rgba(248,250,252,0.1)",
            borderRadius: "12px",
            fontFamily: "'DM Sans', sans-serif",
          },
        }}
      />

      {/* Full-screen background */}
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
        style={{ backgroundColor: "#0a0f1e" }}
      >
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: "radial-gradient(circle,#3b82f6,transparent 70%)", filter: "blur(70px)" }}
          />
          <div
            className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-15"
            style={{ background: "radial-gradient(circle,#8b5cf6,transparent 70%)", filter: "blur(70px)" }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(248,250,252,.5) 1px,transparent 1px),
                                linear-gradient(90deg,rgba(248,250,252,.5) 1px,transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5"
              style={{ background: "rgba(248,250,252,0.06)", border: "1px solid rgba(248,250,252,0.1)" }}
            >
              <div
                className="w-2 h-2 rounded-full bg-emerald-400"
                style={{ boxShadow: "0 0 8px #34d399", animation: "pulse 2s infinite" }}
              />
              <span style={{
                color: "rgba(248,250,252,0.5)",
                fontFamily: "'DM Mono', monospace",
                fontSize: "11px",
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}>
                Counter Setup
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              style={{
                color: "#f8fafc",
                fontFamily: "'Syne', sans-serif",
                fontSize: "30px",
                fontWeight: 800,
                letterSpacing: "-.02em",
                marginBottom: "6px",
              }}
            >
              Activate This Device
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ color: "rgba(248,250,252,0.4)", fontSize: "14px" }}
            >
              Set up this counter to start collecting feedback
            </motion.p>
          </div>

          {/* Step indicator */}
          <StepIndicator current={step} />

          {/* Glass panel */}
          <div
            className="rounded-3xl p-7"
            style={{
              background: "rgba(248,250,252,0.04)",
              border: "1px solid rgba(248,250,252,0.08)",
              backdropFilter: "blur(20px)",
            }}
          >
            <AnimatePresence mode="wait">

              {/* ── Step 1: Select Branch ──────────────────────────────────── */}
              {step === 1 && !success && (
                <motion.div
                  key="s1"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <p style={{
                    color: "#f8fafc", fontFamily: "'Syne', sans-serif",
                    fontSize: "17px", fontWeight: 700, marginBottom: "4px",
                  }}>
                    Select your branch
                  </p>
                  <p style={{ color: "rgba(248,250,252,0.4)", fontSize: "13px", marginBottom: "18px" }}>
                    Which location is this device at?
                  </p>

                  {/* Branch list — from Inertia props (no loading state needed) */}
                  {branches?.length === 0 ? (
                    <div className="text-center py-8" style={{ color: "rgba(248,250,252,0.35)" }}>
                      <p style={{ fontSize: "36px", marginBottom: "10px" }}>🏢</p>
                      <p style={{ fontSize: "14px" }}>No active branches found.</p>
                      <p style={{ fontSize: "12px", marginTop: "4px" }}>Ask your admin to create branches first.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {branches?.map((b, i) => (
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

                  {/* Loading spinner shown while fetching counters */}
                  {loadingCounters && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center gap-2 mt-5"
                    >
                      <Spinner />
                      <span style={{ color: "rgba(248,250,252,0.4)", fontSize: "13px" }}>
                        Loading counters...
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ── Step 2: Select Counter ─────────────────────────────────── */}
              {step === 2 && !success && (
                <motion.div
                  key="s2"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {/* Back + title */}
                  <div className="flex items-center gap-3 mb-5">
                    <button
                      onClick={goBackToStep1}
                      style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "rgba(248,250,252,0.07)",
                        color: "rgba(248,250,252,0.6)",
                        border: "none", cursor: "pointer", fontSize: "16px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >←</button>
                    <div>
                      <p style={{
                        color: "#f8fafc", fontFamily: "'Syne', sans-serif",
                        fontSize: "17px", fontWeight: 700
                      }}>
                        Select counter
                      </p>
                      <p style={{ color: "rgba(248,250,252,0.4)", fontSize: "12px" }}>
                        {selectedBranch?.name}
                      </p>
                    </div>
                  </div>

                  {/* Counter list — fetched from API */}
                  {counters?.length === 0 ? (
                    <div className="text-center py-8" style={{ color: "rgba(248,250,252,0.35)" }}>
                      <p style={{ fontSize: "36px", marginBottom: "10px" }}>🖥️</p>
                      <p style={{ fontSize: "14px" }}>No active counters in this branch.</p>
                      <p style={{ fontSize: "12px", marginTop: "4px" }}>
                        Ask your admin to create and activate counters.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {counters?.map((c, i) => (
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

              {/* ── Step 3: Enter PIN ──────────────────────────────────────── */}
              {step === 3 && !success && (
                <motion.div
                  key="s3"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {/* Back + title */}
                  <div className="flex items-center gap-3 mb-6">
                    <button
                      onClick={goBackToStep2}
                      disabled={submitting}
                      style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "rgba(248,250,252,0.07)",
                        color: "rgba(248,250,252,0.6)",
                        border: "none", cursor: submitting ? "not-allowed" : "pointer",
                        fontSize: "16px", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        opacity: submitting ? 0.4 : 1,
                      }}
                    >←</button>
                    <div>
                      <p style={{
                        color: "#f8fafc", fontFamily: "'Syne', sans-serif",
                        fontSize: "17px", fontWeight: 700
                      }}>
                        Enter counter PIN
                      </p>
                      <p style={{ color: "rgba(248,250,252,0.4)", fontSize: "12px" }}>
                        {selectedBranch?.name} — {selectedCounter?.name}
                      </p>
                    </div>
                  </div>

                  {/* PIN keypad */}
                  <PinKeypad
                    pin={pin}
                    onChange={handlePinChange}
                    disabled={submitting}
                  />

                  {/* Manual submit button for 4–5 digit PINs */}
                  <AnimatePresence>
                    {pin?.length >= 4 && pin?.length < 6 && !submitting && (
                      <motion.button
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        onClick={handlePinSubmit}
                        className="w-full mt-7 py-4 rounded-2xl font-semibold"
                        style={{
                          background: "#f8fafc",
                          color: "#0a0f1e",
                          fontFamily: "'Syne', sans-serif",
                          fontSize: "14px",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Activate Counter →
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Submitting state */}
                  {submitting && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center gap-3 mt-6"
                    >
                      <Spinner />
                      <span style={{ color: "rgba(248,250,252,0.4)", fontSize: "13px" }}>
                        Verifying PIN...
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ── Success ────────────────────────────────────────────────── */}
              {success && (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                    style={{ background: "rgba(16,185,129,0.15)", border: "2px solid #10b981" }}
                  >
                    ✓
                  </motion.div>
                  <div>
                    <p style={{
                      color: "#f8fafc", fontFamily: "'Syne', sans-serif",
                      fontSize: "20px", fontWeight: 700, marginBottom: "6px",
                    }}>
                      Counter Activated!
                    </p>
                    <p style={{ color: "rgba(248,250,252,0.45)", fontSize: "13px" }}>
                      {selectedBranch?.name} — {selectedCounter?.name}
                    </p>
                    <p style={{ color: "rgba(248,250,252,0.3)", fontSize: "12px", marginTop: "4px" }}>
                      Redirecting to idle screen...
                    </p>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Footer */}
          <p
            className="text-center mt-4"
            style={{ color: "rgba(248,250,252,0.2)", fontFamily: "'DM Mono', monospace", fontSize: "11px" }}
          >
            This device will remember its counter after setup.
          </p>
        </motion.div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </>
  );
}