/**
 * CustomerFeedback.tsx
 *
 * The main customer-facing feedback page shown on the counter device.
 * No login required — fully anonymous guest submission.
 *
 * Flow:
 *   Step 1 → Pick emoji rating (1–5)
 *   Step 2 → Optional: select tags + write comment
 *   Step 3 → Submit → Thank-you screen (auto-resets after N seconds)
 *
 * Route:    GET /counter/feedback
 * File:     resources/js/Pages/Counter/Feedback.tsx
 *
 * 🔧 STATIC MODE:
 *   All data is hardcoded. Submission is simulated.
 *   Search "TODO: REPLACE" to find every backend swap point.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Head } from "@inertiajs/react";
import toast, { Toaster } from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tag {
  id: number;
  name: string;
  color: string;
  sentiment: "positive" | "negative" | "neutral";
}

interface Servicer {
  id: number;
  name: string;
  avatar_url: string | null;
}

interface RatingLevel {
  value: number;
  emoji: string;
  label: string;
  labelKh: string;
  bg: string;       // background color wash
  accent: string;   // ring + button color
  text: string;     // heading text color
}

// ─── 🔧 Static Mock Data ──────────────────────────────────────────────────────

const RATINGS: RatingLevel[] = [
  { value: 1, emoji: "😡", label: "Very Bad", labelKh: "អន់ខ្លាំង", bg: "#fff1f0", accent: "#ef4444", text: "#7f1d1d" },
  { value: 2, emoji: "😞", label: "Bad", labelKh: "អន់", bg: "#fff7ed", accent: "#f97316", text: "#7c2d12" },
  { value: 3, emoji: "😐", label: "Neutral", labelKh: "មធ្យម", bg: "#fefce8", accent: "#eab308", text: "#713f12" },
  { value: 4, emoji: "😊", label: "Good", labelKh: "ល្អ", bg: "#f0fdf4", accent: "#22c55e", text: "#14532d" },
  { value: 5, emoji: "😍", label: "Excellent", labelKh: "ល្អណាស់", bg: "#eff6ff", accent: "#3b82f6", text: "#1e3a8a" },
];

const MOCK_SERVICER: Servicer = {
  id: 1,
  name: "Sophea Chan",
  avatar_url: null,
};

const MOCK_TAGS: Tag[] = [
  { id: 1, name: "Friendly Staff", color: "#22c55e", sentiment: "positive" },
  { id: 2, name: "Helpful", color: "#22c55e", sentiment: "positive" },
  { id: 3, name: "Fast Service", color: "#3b82f6", sentiment: "positive" },
  { id: 4, name: "Clean Environment", color: "#06b6d4", sentiment: "positive" },
  { id: 5, name: "Professional", color: "#8b5cf6", sentiment: "positive" },
  { id: 6, name: "Slow Service", color: "#f97316", sentiment: "negative" },
  { id: 7, name: "Long Wait", color: "#f97316", sentiment: "negative" },
  { id: 8, name: "Rude Staff", color: "#ef4444", sentiment: "negative" },
  { id: 9, name: "Need Improvement", color: "#6b7280", sentiment: "neutral" },
];

// Thank-you screen auto-reset duration in seconds
const THANK_YOU_DURATION = 4;

// ─── Emoji Button ─────────────────────────────────────────────────────────────

function EmojiButton({ rating, selected, onSelect }: {
  rating: RatingLevel;
  selected: boolean;
  onSelect: (r: RatingLevel) => void;
}) {
  return (
    <motion.button
      onClick={() => onSelect(rating)}
      whileTap={{ scale: 0.88 }}
      className="flex flex-col items-center gap-3 focus:outline-none"
      style={{ background: "none", border: "none", cursor: "pointer" }}
    >
      {/* Emoji circle */}
      <motion.div
        animate={selected ? {
          scale: 1.25,
          y: -8,
          filter: `drop-shadow(0 12px 28px ${rating.accent}55)`,
        } : {
          scale: 1,
          y: 0,
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.08))",
        }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: 80, height: 80,
          background: selected
            ? `radial-gradient(circle at 35% 35%, white, ${rating.bg})`
            : "radial-gradient(circle at 35% 35%, #ffffff, #f8f8f8)",
          border: `3px solid ${selected ? rating.accent : "rgba(0,0,0,0.06)"}`,
          transition: "border-color 0.2s, background 0.2s",
        }}
      >
        <span style={{ fontSize: "38px", lineHeight: 1, userSelect: "none" }}>
          {rating.emoji}
        </span>

        {/* Selected ring pulse */}
        {selected && (
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.6, repeat: Infinity }}
            style={{ border: `2px solid ${rating.accent}` }}
          />
        )}
      </motion.div>

      {/* Label */}
      <motion.span
        animate={{ color: selected ? rating.accent : "#9ca3af", fontWeight: selected ? 700 : 400 }}
        transition={{ duration: 0.2 }}
        style={{
          fontSize: "12px", fontFamily: "'DM Sans', sans-serif",
          letterSpacing: "0.01em", whiteSpace: "nowrap"
        }}
      >
        {rating.label}
      </motion.span>
    </motion.button>
  );
}

// ─── Tag Chip ─────────────────────────────────────────────────────────────────

function TagChip({ tag, selected, onToggle }: {
  tag: Tag; selected: boolean; onToggle: (id: number) => void;
}) {
  return (
    <motion.button
      onClick={() => onToggle(tag.id)}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="px-4 py-2 rounded-full text-sm font-medium transition-all"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: selected ? tag.color : "rgba(0,0,0,0.04)",
        color: selected ? "#fff" : "#6b7280",
        border: `1.5px solid ${selected ? tag.color : "rgba(0,0,0,0.08)"}`,
        cursor: "pointer",
        boxShadow: selected ? `0 4px 16px ${tag.color}44` : "none",
      }}
    >
      {selected && <span style={{ marginRight: "4px" }}>✓</span>}
      {tag.name}
    </motion.button>
  );
}

// ─── Thank You Screen ─────────────────────────────────────────────────────────

function ThankYouScreen({ rating, onReset }: {
  rating: RatingLevel; onReset: () => void;
}) {
  const [countdown, setCountdown] = useState(THANK_YOU_DURATION);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); onReset(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onReset]);

  return (
    <motion.div
      key="thankyou"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8"
      style={{ background: rating.bg }}
    >
      {/* Big emoji */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
        style={{ fontSize: "100px", lineHeight: 1, filter: `drop-shadow(0 16px 40px ${rating.accent}44)` }}
      >
        {rating.emoji}
      </motion.div>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-center"
      >
        <h2 style={{
          fontFamily: "'Syne', sans-serif", fontSize: "36px",
          fontWeight: 800, color: rating.text, marginBottom: "10px",
          letterSpacing: "-0.02em"
        }}>
          Thank You!
        </h2>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "16px",
          color: rating.accent, fontWeight: 500, marginBottom: "6px"
        }}>
          អរគុណ! · {rating.label}
        </p>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
          color: rating.text, opacity: 0.55
        }}>
          Your feedback helps us improve our service.
        </p>
      </motion.div>

      {/* Countdown ring */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col items-center gap-2"
      >
        <svg width="56" height="56" viewBox="0 0 56 56">
          {/* Track */}
          <circle cx="28" cy="28" r="24" fill="none"
            stroke={`${rating.accent}22`} strokeWidth="3" />
          {/* Progress */}
          <motion.circle cx="28" cy="28" r="24" fill="none"
            stroke={rating.accent} strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 24}`}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 24 }}
            transition={{ duration: THANK_YOU_DURATION, ease: "linear" }}
            style={{ transformOrigin: "28px 28px", transform: "rotate(-90deg)" }}
          />
          <text x="28" y="33" textAnchor="middle"
            style={{
              fontFamily: "'DM Mono', monospace", fontSize: "16px",
              fontWeight: 700, fill: rating.accent
            }}>
            {countdown}
          </text>
        </svg>
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
          color: rating.text, opacity: 0.4
        }}>
          Resetting...
        </span>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerFeedback() {
  // TODO: REPLACE — get servicer from active session via Inertia props
  // Controller: return Inertia::render('Counter/Feedback', ['servicer' => $session->servicer, 'tags' => ...])
  const servicer = MOCK_SERVICER;
  const tags = MOCK_TAGS;

  const [selectedRating, setSelectedRating] = useState<RatingLevel | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [comment, setComment] = useState("");
  const [step, setStep] = useState<"rate" | "detail" | "done">("rate");
  const [submitting, setSubmitting] = useState(false);
  const [lang, setLang] = useState<"en" | "kh">("en");

  // Current color theme based on selected rating
  const theme = selectedRating ?? RATINGS[3]; // default to "Good" colors

  // ── Auto-advance to detail after rating pick ──────────────────────────────
  const handleRatingSelect = (rating: RatingLevel) => {
    setSelectedRating(rating);
    // Small delay so user sees the selection animation before advancing
    setTimeout(() => setStep("detail"), 420);
  };

  // ── Tag toggle ────────────────────────────────────────────────────────────
  const toggleTag = (id: number) => {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!selectedRating) return;
    setSubmitting(true);

    // TODO: REPLACE with:
    // const token = localStorage.getItem('counter_device_token');
    // await axios.post('/api/feedback', {
    //   rating:   selectedRating.value,
    //   tag_ids:  selectedTagIds,
    //   comment:  comment.trim() || null,
    // }, { headers: { 'X-Counter-Token': token } });
    setTimeout(() => {
      setSubmitting(false);
      setStep("done");
    }, 700);
  };

  // ── Reset after thank-you ─────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setSelectedRating(null);
    setSelectedTagIds([]);
    setComment("");
    setStep("rate");
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Head title="Customer Feedback" />
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <Toaster position="top-center" />

      {/* Full-screen wrapper — background transitions with rating */}
      <motion.div
        className="min-h-screen w-full relative overflow-hidden flex flex-col"
        animate={{ backgroundColor: step === "done" ? theme.bg : "#ffffff" }}
        transition={{ duration: 0.5 }}
      >
        {/* Subtle top accent bar */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-1"
          animate={{ backgroundColor: theme.accent }}
          transition={{ duration: 0.4 }}
        />

        {/* ── Header ── */}
        {step !== "done" && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 flex items-center justify-between px-8 pt-8 pb-2"
          >
            {/* Servicer info */}
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}bb)` }}>
                {servicer.name.charAt(0)}
              </div>
              <div>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                  color: "#9ca3af", marginBottom: "1px"
                }}>
                  {lang === "en" ? "Served by" : "បម្រើដោយ"}
                </p>
                <p style={{
                  fontFamily: "'Syne', sans-serif", fontSize: "15px",
                  fontWeight: 700, color: "#1f2937"
                }}>
                  {servicer.name}
                </p>
              </div>
            </div>

            {/* Language toggle */}
            <button
              onClick={() => setLang(l => l === "en" ? "kh" : "en")}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                fontFamily: "'DM Mono', monospace",
                background: "rgba(0,0,0,0.05)", color: "#6b7280",
                border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer"
              }}
            >
              {lang === "en" ? "ខ្មែរ" : "EN"}
            </button>
          </motion.div>
        )}

        {/* ── Step: Rate ── */}
        <AnimatePresence mode="wait">

          {step === "rate" && (
            <motion.div key="rate"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col items-center justify-center gap-10 px-6 pb-8"
            >
              {/* Heading */}
              <div className="text-center">
                <motion.h1
                  style={{
                    fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px,5vw,42px)",
                    fontWeight: 800, color: "#1f2937", letterSpacing: "-0.02em",
                    lineHeight: 1.15, marginBottom: "10px"
                  }}
                >
                  {lang === "en" ? "How was your experience?" : "សេវាមានភាពដូចម្ដេច?"}
                </motion.h1>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "15px",
                  color: "#9ca3af", fontWeight: 300
                }}>
                  {lang === "en"
                    ? "Tap an emoji to rate your service"
                    : "សូមចុចលើរូបភាព ដើម្បីវាយតម្លៃ"}
                </p>
              </div>

              {/* Emoji row */}
              <div className="flex items-end justify-center gap-5 w-full max-w-sm">
                {RATINGS.map(r => (
                  <EmojiButton key={r.value} rating={r}
                    selected={selectedRating?.value === r.value}
                    onSelect={handleRatingSelect} />
                ))}
              </div>

              {/* Skip to submit */}
              {selectedRating && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setStep("detail")}
                  className="px-8 py-3 rounded-2xl font-semibold text-white text-sm"
                  style={{
                    background: theme.accent, border: "none", cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: `0 6px 24px ${theme.accent}44`
                  }}
                >
                  Continue →
                </motion.button>
              )}
            </motion.div>
          )}

          {/* ── Step: Detail ── */}
          {step === "detail" && selectedRating && (
            <motion.div key="detail"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col gap-6 px-7 py-6 overflow-y-auto"
            >
              {/* Selected rating recap */}
              <div className="flex items-center gap-3 p-4 rounded-2xl"
                style={{ background: `${theme.accent}11`, border: `1.5px solid ${theme.accent}33` }}>
                <span style={{ fontSize: "32px" }}>{selectedRating.emoji}</span>
                <div>
                  <p style={{
                    fontFamily: "'Syne', sans-serif", fontSize: "16px",
                    fontWeight: 700, color: theme.text
                  }}>
                    {selectedRating.label}
                  </p>
                  <button onClick={() => setStep("rate")}
                    style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
                      color: theme.accent, background: "none", border: "none",
                      cursor: "pointer", padding: 0
                    }}>
                    Change rating
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <p style={{
                  fontFamily: "'Syne', sans-serif", fontSize: "14px",
                  fontWeight: 700, color: "#374151", marginBottom: "12px"
                }}>
                  {lang === "en" ? "What best describes your experience? (Optional)" : "តើមានអ្វីដែលពណ៌នាបានល្អ? (ស្រេចចិត្ត)"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <TagChip key={tag.id} tag={tag}
                      selected={selectedTagIds.includes(tag.id)}
                      onToggle={toggleTag} />
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <p style={{
                  fontFamily: "'Syne', sans-serif", fontSize: "14px",
                  fontWeight: 700, color: "#374151", marginBottom: "10px"
                }}>
                  {lang === "en" ? "Leave a comment (Optional)" : "បញ្ចេញមតិ (ស្រេចចិត្ត)"}
                </p>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder={lang === "en"
                    ? "Tell us more about your experience..."
                    : "សូមប្រាប់យើងបន្ថែមអំពីបទពិសោធន៍របស់អ្នក..."}
                  style={{
                    width: "100%", padding: "14px 16px",
                    borderRadius: "16px", resize: "none",
                    border: `1.5px solid ${comment ? theme.accent + "66" : "rgba(0,0,0,0.08)"}`,
                    background: "rgba(0,0,0,0.02)",
                    fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
                    color: "#374151", lineHeight: 1.6,
                    outline: "none", transition: "border-color 0.2s",
                  }}
                />
                <p style={{
                  fontFamily: "'DM Mono', monospace", fontSize: "11px",
                  color: "#d1d5db", textAlign: "right", marginTop: "4px"
                }}>
                  {comment.length}/300
                </p>
              </div>

              {/* Submit button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-4 rounded-2xl font-bold text-white text-base"
                style={{
                  background: submitting ? "#d1d5db" : `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
                  border: "none", cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: "'Syne', sans-serif", fontSize: "16px",
                  boxShadow: submitting ? "none" : `0 8px 32px ${theme.accent}44`,
                  transition: "background 0.3s, box-shadow 0.3s",
                }}
              >
                {submitting ? "Submitting..." : lang === "en" ? "Submit Feedback" : "បញ្ជូនមតិ"}
              </motion.button>

              {/* Skip detail */}
              <button onClick={handleSubmit}
                style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                  color: "#9ca3af", background: "none", border: "none",
                  cursor: "pointer", textAlign: "center"
                }}>
                {lang === "en" ? "Skip and submit" : "រំលង ហើយបញ្ជូន"}
              </button>
            </motion.div>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && selectedRating && (
            <ThankYouScreen rating={selectedRating} onReset={handleReset} />
          )}

        </AnimatePresence>

      </motion.div>
    </>
  );
}