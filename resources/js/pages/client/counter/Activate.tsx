/**
 * ServicerActivation.tsx
 *
 * Opens on the SERVICER'S PHONE after they scan the counter's QR code.
 *
 * ── What changed from the previous version ────────────────────────────────────
 * Before: QR contained the servicer's personal token → auto-activated
 * Now:    QR contains the COUNTER's device_token → servicer logs in with email/password
 *
 * URL format:
 *   /counter/activate?counter_token=<counter_device_token>
 *
 * Flow:
 *   1. Page reads ?counter_token from URL
 *   2. Calls GET /api/counter/activate-info?counter_token=X
 *      → validates the token, returns counter + branch name
 *   3. Shows the counter info so the servicer knows which counter they're activating
 *   4. Servicer enters email + password
 *   5. POST /api/counter/activate-session { counter_token, email, password }
 *      → server authenticates servicer + creates CounterSession
 *   6. On success → shows confirmation screen
 *   7. Counter idle screen detects the session within 4 seconds → goes live
 *
 * ── States ────────────────────────────────────────────────────────────────────
 *   loading   → fetching counter info from token
 *   login     → email + password form
 *   submitting → POST in progress
 *   success   → session created, counter will go live
 *   busy      → counter is occupied → list of idle counters in same branch
 *   error     → invalid token / expired
 *
 * ── Laravel side needed ───────────────────────────────────────────────────────
 * routes/web.php:
 *   Route::get('/counter/activate', [ServicerActivationController::class, 'show'])
 *        ->name('counter.activate');
 *
 * routes/api.php (public — no auth needed):
 *   Route::get('/counter/activate-info',    [ServicerActivationController::class, 'info']);
 *   Route::post('/counter/activate-session', [ServicerActivationController::class, 'activateSession']);
 *
 * ServicerActivationController@info:
 *   $counter = Counter::where('device_token', $request->counter_token)
 *       ->where('is_active', true)->with('branch')->firstOrFail();
 *   if ($counter->isOccupied()) → 409 + idle_counters
 *   return { counter: { id, name, branch_name, branch_id } }
 *
 * ServicerActivationController@activateSession:
 *   $counter = Counter::where('device_token', $request->counter_token)->firstOrFail();
 *   $user = User::where('email', $request->email)
 *       ->where('role', 'servicer')
 *       ->where('branch_id', $counter->branch_id)
 *       ->where('is_active', true)->first();
 *   if (!$user || !Hash::check($request->password, $user->password)) → 422
 *   if ($counter->isOccupied()) → 409 + idle_counters
 *   CounterSession::create([...])
 *   return { success: true }
 *
 * File: resources/js/Pages/Counter/Activate.tsx
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CounterInfo {
  id: number;
  name: string;
  branch_name: string;
  branch_id: number;
}

interface IdleCounter {
  id: number;
  name: string;
  description: string | null;
}

type PageState = "loading" | "confirming" | "login" | "submitting" | "success" | "busy" | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read ?counter_token from the current URL query string */
function getCounterToken(): string | null {
  return new URLSearchParams(window.location.search).get("counter_token");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated scanning lines during loading state */
function ScanLines() {
  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      {[
        "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
        "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
        "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
        "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
      ].map((cls, i) => (
        <div key={i} className={`absolute w-5 h-5 ${cls}`}
          style={{ borderColor: "#b98951" }} />
      ))}
      <motion.div
        className="absolute left-2 right-2 h-px"
        style={{ background: "linear-gradient(90deg, transparent, #b98951, transparent)" }}
        animate={{ top: ["12%", "88%", "12%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="#b98951" strokeWidth="1.5" />
          <rect x="5" y="5" width="3" height="3" fill="#b98951" />
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="#b98951" strokeWidth="1.5" />
          <rect x="16" y="5" width="3" height="3" fill="#b98951" />
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="#b98951" strokeWidth="1.5" />
          <rect x="5" y="16" width="3" height="3" fill="#b98951" />
          <path d="M14 14h2v2h-2zM18 14h3v1h-3zM14 17h1v3h-1zM17 17h1v1h-1zM19 17h2v2h-2zM16 20h5v1h-5z"
            fill="#b98951" />
        </svg>
      </motion.div>
    </div>
  );
}

/** Success burst rings */
function SuccessBurst() {
  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ border: "2px solid #b98951" }}
          initial={{ width: 40, height: 40, opacity: 0.8 }}
          animate={{ width: 120, height: 120, opacity: 0 }}
          transition={{ duration: 1.2, delay: i * 0.3, repeat: Infinity }}
        />
      ))}
      <motion.div
        initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: "rgba(185,137,81,0.12)", border: "2px solid #b98951",
          fontSize: "30px", color: "#b98951"
        }}>
        ✓
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServicerActivation() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [counter, setCounter] = useState<CounterInfo | null>(null);
  const [idleCounters, setIdleCounters] = useState<IdleCounter[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [servicerName, setServicerName] = useState("");  // from success response

  // Form fields (only used in guest / login state)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const counterToken = getCounterToken();

  // ── On mount: validate token → try auto-activate if already logged in ───────
  useEffect(() => {
    if (!counterToken) {
      setErrorMsg("Invalid QR code — no counter token found.");
      setPageState("error");
      return;
    }

    (async () => {
      try {
        /**
         * Step 1: GET /api/counter/activate-info?counter_token=<token>
         * Validates the token and returns counter info.
         * 404 → invalid token
         * 403 → counter/branch inactive
         * 409 → counter busy → { message, idle_counters }
         */
        const infoRes = await axios.get<{
          counter: CounterInfo;
          session_owner?: boolean;
          servicer_name?: string;
        }>(
          "/api/counter/activate-info",
          { params: { counter_token: counterToken } }
        );
        const counterData = infoRes.data.counter;
        setCounter(counterData);

        // If user already owns this counter session, show success immediately
        if (infoRes.data.session_owner && infoRes.data.servicer_name) {
          setServicerName(infoRes.data.servicer_name);
          setPageState("success");
          return;
        }

        /**
         * Step 2: Try auto-activate via PATH A (already logged in).
         * POST /api/counter/activate-session with just the counter_token.
         * If the servicer's phone already has a Laravel session cookie,
         * the server activates without needing credentials.
         *
         * Response: { success: true, servicer_name, already_logged_in: true }
         * 422 with requires_login: true → not logged in, show form instead
         * 403 → logged in but wrong branch → show error
         */
        try {
          const activateRes = await axios.post<{
            success: boolean;
            servicer_name: string;
            already_logged_in: boolean;
          }>("/api/counter/activate-session", {
            counter_token: counterToken,
            // No email/password — server detects session cookie automatically
          });

          // PATH A success — counter activated without showing any form
          setServicerName(activateRes.data.servicer_name);
          setPageState("success");

        } catch (autoErr: any) {
          const autoStatus = autoErr.response?.status;
          const autoData = autoErr.response?.data;

          if (autoStatus === 422 && autoData?.requires_login) {
            // Not logged in — show the login form (PATH B)
            setPageState("login");
          } else if (autoStatus === 409) {
            // Counter became busy between info check and auto-activate
            setIdleCounters(autoData?.idle_counters ?? []);
            setPageState("busy");
          } else if (autoStatus === 403) {
            // Logged in as wrong role or wrong branch
            setErrorMsg(autoData?.message ?? "You are not assigned to this branch.");
            setPageState("error");
          } else {
            // Any other error from auto-activate → fall back to login form
            setPageState("login");
          }
        }

      } catch (err: any) {
        // Info fetch failed
        const status = err.response?.status;
        if (status === 409) {
          setIdleCounters(err.response.data.idle_counters ?? []);
          setPageState("busy");
        } else {
          setErrorMsg(
            err.response?.data?.message ??
            "Invalid or expired QR code. Please ask your manager to regenerate it."
          );
          setPageState("error");
        }
      }
    })();
  }, [counterToken]);

  // ── Submit login form (PATH B — guest credentials) ───────────────────────
  const handleLogin = async () => {
    setFieldErrors({});

    if (!email.trim()) { setFieldErrors({ email: "Email is required." }); return; }
    if (!password) { setFieldErrors({ password: "Password is required." }); return; }

    setPageState("submitting");

    try {
      /**
       * POST /api/counter/activate-session
       * Body: { counter_token, email, password }
       *
       * Server detects guest (no session cookie) → PATH B:
       *   - Authenticates with credentials
       *   - Logs them into Laravel session (next scan = PATH A, no password)
       *   - Creates CounterSession
       *
       * Response: { success: true, servicer_name, already_logged_in: false }
       */
      const res = await axios.post<{
        success: boolean;
        servicer_name: string;
        already_logged_in: boolean;
      }>("/api/counter/activate-session", {
        counter_token: counterToken,
        email: email.trim(),
        password,
      });

      setServicerName(res.data.servicer_name);
      setPageState("success");

    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message;
      const errors = err.response?.data?.errors;

      if (status === 422) {
        if (errors?.email) setFieldErrors(p => ({ ...p, email: errors.email[0] }));
        if (errors?.password) setFieldErrors(p => ({ ...p, password: errors.password[0] }));
        if (!errors) setFieldErrors({ password: message ?? "Invalid email or password." });
        setPageState("login");
      } else if (status === 409) {
        setIdleCounters(err.response.data.idle_counters ?? []);
        setPageState("busy");
      } else if (status === 403) {
        setFieldErrors({ email: message ?? "You are not assigned to this branch." });
        setPageState("login");
      } else {
        setErrorMsg(message ?? "Something went wrong. Please try again.");
        setPageState("error");
      }
    }
  };

  // ── Pick an idle counter instead ─────────────────────────────────────────
  const handlePickCounter = (idleCounter: IdleCounter & { device_token?: string }) => {
    if (idleCounter.device_token) {
      window.location.href = `/counter/activate?counter_token=${idleCounter.device_token}`;
    }
  };

  // ── Logout from counter session ─────────────────────────────────────────
  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to end the current counter session?")) {
      return;
    }

    setIsLoggingOut(true);

    try {
      const res = await axios.post<{
        success: boolean;
        message: string;
      }>(
        "/api/counter/session/end",
        {
          counter_token: counterToken,
        },
        {
          headers: {
            "X-Counter-Token": counterToken,
          },
        }
      );

      if (res.data.success) {
        // Show a brief confirmation then redirect to dashboard
        setErrorMsg("Session ended. Thank you!");
        setPageState("success");

        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1200);
      }
    } catch (err: any) {
      const message = err.response?.data?.message ?? "Failed to end session. Please try again.";
      setErrorMsg(message);
      setPageState("error");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Mobile-first warm cream screen */}
      <div className="min-h-screen w-full flex flex-col relative overflow-hidden"
        style={{ background: "#f8f1e8", maxWidth: "420px", margin: "0 auto" }}>

        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-[-10%] left-[10%] w-56 h-56 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle,#d4a574,transparent 70%)", filter: "blur(50px)" }} />
          <div className="absolute bottom-[-10%] right-[10%] w-44 h-44 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle,#b98951,transparent 70%)", filter: "blur(40px)" }} />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(rgba(90,62,37,.4) 1px,transparent 1px),
                      linear-gradient(90deg,rgba(90,62,37,.4) 1px,transparent 1px)`,
              backgroundSize: "40px 40px"
            }} />
        </div>

        {/* Logo bar */}
        <div className="relative z-10 flex items-center justify-between px-7 pt-10 pb-2">
          <span style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: "15px",
            fontWeight: 800, color: "#5a4634", letterSpacing: "0.05em"
          }}>
            FEEDBACK<span style={{ color: "rgba(90,62,37,0.3)" }}>PRO</span>
          </span>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ background: "rgba(185,137,81,0.08)", border: "1px solid rgba(185,137,81,0.2)" }}>
            <div className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#b98951", boxShadow: "0 0 6px #b98951", animation: "pulse 2s infinite" }} />
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: "10px",
              color: "#7a6345", letterSpacing: "0.08em"
            }}>SECURE</span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-7 py-6">
          <AnimatePresence mode="wait">

            {/* ── Loading ── */}
            {(pageState === "loading") && (
              <motion.div key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-7 text-center">
                <ScanLines />
                <div>
                  <p style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: "24px",
                    fontWeight: 700, color: "#3d2c1e", marginBottom: "8px"
                  }}>
                    Verifying Counter
                  </p>
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                    color: "#8f5f35"
                  }}>
                    Please wait...
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Login form ── */}
            {(pageState === "login" || pageState === "submitting") && counter && (
              <motion.div key="login"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-6 w-full"
              >
                {/* Counter card */}
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl p-5 relative overflow-hidden"
                  style={{
                    background: "rgba(185,137,81,0.08)",
                    border: "1px solid rgba(185,137,81,0.2)"
                  }}>
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-15 pointer-events-none"
                    style={{
                      background: "radial-gradient(circle,#b98951,transparent 70%)",
                      filter: "blur(16px)"
                    }} />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full"
                        style={{ background: "#b98951", boxShadow: "0 0 6px #b98951" }} />
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: "10px",
                        color: "#8f5f35", letterSpacing: "0.08em", textTransform: "uppercase"
                      }}>
                        Activating
                      </span>
                    </div>
                    <p style={{
                      fontFamily: "'Cormorant Garamond', serif", fontSize: "32px",
                      fontWeight: 700, color: "#3d2c1e", letterSpacing: "-0.02em",
                      marginBottom: "3px"
                    }}>
                      {counter.name}
                    </p>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
                      color: "#8f5f35"
                    }}>
                      {counter.branch_name}
                    </p>
                  </div>
                </motion.div>

                {/* Heading */}
                <div>
                  <h1 style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: "28px",
                    fontWeight: 700, color: "#3d2c1e", letterSpacing: "-0.02em",
                    marginBottom: "6px"
                  }}>
                    Sign in to activate
                  </h1>
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                    color: "#8f5f35", lineHeight: 1.5
                  }}>
                    Use your staff account credentials.
                    You must be assigned to {counter.branch_name}.
                  </p>
                </div>

                {/* Email field */}
                <div>
                  <label style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                    fontWeight: 600, color: "#5a4634",
                    display: "block", marginBottom: "7px"
                  }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); }}
                    placeholder="your@email.com"
                    autoComplete="email"
                    disabled={pageState === "submitting"}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: 12,
                      border: `1.5px solid ${fieldErrors.email ? "#c85a54" : "rgba(185,137,81,0.25)"}`,
                      background: fieldErrors.email ? "rgba(200,90,84,0.08)" : "rgba(255,255,255,0.5)",
                      fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
                      color: "#4c3829", outline: "none",
                      transition: "border-color 0.2s",
                    }}
                  />
                  <AnimatePresence>
                    {fieldErrors.email && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                          color: "#c85a54", marginTop: "5px"
                        }}>
                        {fieldErrors.email}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Password field */}
                <div>
                  <label style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                    fontWeight: 600, color: "#5a4634",
                    display: "block", marginBottom: "7px"
                  }}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={pageState === "submitting"}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      style={{
                        width: "100%", padding: "12px 44px 12px 14px", borderRadius: 12,
                        border: `1.5px solid ${fieldErrors.password ? "#c85a54" : "rgba(185,137,81,0.25)"}`,
                        background: fieldErrors.password ? "rgba(200,90,84,0.08)" : "rgba(255,255,255,0.5)",
                        fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
                        color: "#4c3829", outline: "none",
                      }}
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer",
                        color: "#9e8563", fontSize: "15px", padding: 0
                      }}>
                      {showPass ? "🙈" : "👁"}
                    </button>
                  </div>
                  <AnimatePresence>
                    {fieldErrors.password && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                          color: "#c85a54", marginTop: "5px"
                        }}>
                        {fieldErrors.password}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Submit button */}
                <motion.button
                  whileHover={pageState !== "submitting" ? { scale: 1.02 } : {}}
                  whileTap={pageState !== "submitting" ? { scale: 0.97 } : {}}
                  onClick={handleLogin}
                  disabled={pageState === "submitting"}
                  style={{
                    width: "100%", padding: "15px", borderRadius: 16, border: "none",
                    background: pageState === "submitting" ? "rgba(185,137,81,0.3)" : "#b98951",
                    color: "#ffffff",
                    fontFamily: "'Cormorant Garamond', serif", fontSize: "16px", fontWeight: 700,
                    cursor: pageState === "submitting" ? "not-allowed" : "pointer",
                    boxShadow: pageState === "submitting" ? "none" : "0 8px 32px rgba(185,137,81,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {pageState === "submitting" ? (
                    <>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#ffffff",
                        animation: "spin .7s linear infinite"
                      }} />
                      Signing in...
                    </>
                  ) : "Activate Counter →"}
                </motion.button>
              </motion.div>
            )}

            {/* ── Success ── */}
            {pageState === "success" && counter && (
              <motion.div key="success"
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center gap-6 text-center w-full"
              >
                <SuccessBurst />
                <div>
                  <p style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: "32px",
                    fontWeight: 700, color: "#3d2c1e", letterSpacing: "-0.02em",
                    marginBottom: "8px"
                  }}>
                    Session Active!
                  </p>
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
                    color: "#8f5f35", lineHeight: 1.6
                  }}>
                    {servicerName && <>{servicerName} · </>}
                    {counter?.name} · {counter?.branch_name}<br />
                    is now ready for customers.
                  </p>
                </div>
                <div className="w-full rounded-2xl p-4"
                  style={{
                    background: "rgba(185,137,81,0.08)",
                    border: "1px solid rgba(185,137,81,0.15)"
                  }}>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: "10px",
                      color: "#9e8563", letterSpacing: "0.06em"
                    }}>COUNTER</span>
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                      color: "#4c3829", fontWeight: 500
                    }}>{counter.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: "10px",
                      color: "#9e8563", letterSpacing: "0.06em"
                    }}>STARTED</span>
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                      color: "#b98951", fontWeight: 500
                    }}>
                      {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    </span>
                  </div>
                </div>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                  color: "#9e8563", textAlign: "center"
                }}>
                  You can close this page. The counter is now live.
                </p>
                <motion.button
                  whileHover={!isLoggingOut ? { scale: 1.02 } : {}}
                  whileTap={!isLoggingOut ? { scale: 0.97 } : {}}
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(200,90,84,0.4)",
                    background: isLoggingOut ? "rgba(200,90,84,0.15)" : "transparent",
                    color: "#c85a54",
                    fontFamily: "'Cormorant Garamond', serif", fontSize: "15px", fontWeight: 700,
                    cursor: isLoggingOut ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    letterSpacing: "-0.01em",
                    marginTop: "12px"
                  }}
                >
                  {isLoggingOut ? (
                    <>
                      <div style={{
                        width: 14, height: 14, borderRadius: "50%",
                        border: "2px solid rgba(200,90,84,0.4)", borderTopColor: "#c85a54",
                        animation: "spin .7s linear infinite"
                      }} />
                      Logging out...
                    </>
                  ) : "End Session"}
                </motion.button>
              </motion.div>
            )}

            {/* ── Busy ── */}
            {pageState === "busy" && (
              <motion.div key="busy"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5 w-full"
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 280, damping: 18 }}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                    style={{
                      background: "rgba(249,115,22,0.12)",
                      border: "2px solid rgba(249,115,22,0.4)"
                    }}>
                    🔒
                  </motion.div>
                  <div>
                    <p style={{
                      fontFamily: "'Cormorant Garamond', serif", fontSize: "24px",
                      fontWeight: 700, color: "#3d2c1e", marginBottom: "6px"
                    }}>
                      Counter Occupied
                    </p>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                      color: "#8f5f35", lineHeight: 1.6
                    }}>
                      This counter is currently in use.<br />
                      Pick another counter below.
                    </p>
                  </div>
                </div>

                {idleCounters.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <p style={{
                      fontFamily: "'DM Mono', monospace", fontSize: "10px",
                      color: "#9e8563", letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}>
                      Available counters
                    </p>
                    {idleCounters.map((ic, i) => (
                      <motion.button key={ic.id}
                        initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => handlePickCounter(ic)}
                        className="w-full p-4 rounded-2xl text-left flex items-center justify-between"
                        style={{
                          background: "rgba(185,137,81,0.08)",
                          border: "1px solid rgba(185,137,81,0.15)", cursor: "pointer"
                        }}>
                        <div>
                          <p style={{
                            fontFamily: "'Cormorant Garamond', serif", fontSize: "16px",
                            fontWeight: 700, color: "#3d2c1e", marginBottom: "2px"
                          }}>
                            {ic.name}
                          </p>
                          {ic.description && (
                            <p style={{
                              fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                              color: "#8f5f35"
                            }}>
                              {ic.description}
                            </p>
                          )}
                        </div>
                        <span style={{ color: "#b98951", fontSize: "18px" }}>→</span>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6"
                    style={{ color: "#9e8563" }}>
                    <p style={{ fontSize: "28px", marginBottom: "8px" }}>😔</p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px" }}>
                      No other counters available.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Error ── */}
            {pageState === "error" && (
              <motion.div key="error"
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 text-center"
              >
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  className="w-18 h-18 rounded-full flex items-center justify-center text-3xl"
                  style={{
                    width: 72, height: 72,
                    background: "rgba(200,90,84,0.12)",
                    border: "2px solid rgba(200,90,84,0.35)", color: "#c85a54"
                  }}>
                  ✕
                </motion.div>
                <div>
                  <p style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: "24px",
                    fontWeight: 700, color: "#3d2c1e", marginBottom: "8px"
                  }}>
                    Invalid QR Code
                  </p>
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                    color: "#8f5f35", lineHeight: 1.6
                  }}>
                    {errorMsg}
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
      `}</style>
    </>
  );
}