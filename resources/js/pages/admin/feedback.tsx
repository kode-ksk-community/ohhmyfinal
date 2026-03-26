import { useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Head, router } from "@inertiajs/react";
import toast, { Toaster } from "react-hot-toast";
import AdminLayout from '@/layouts/app-layout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feedback {
  id: number;
  rating: number;
  sentiment_label: string | null;
  sentiment_score: number | null;
  comment: string | null;
  counter_name: string;
  branch_name: string;
  servicer_name: string;
  tags: string[];
  submitted_at: string;
}

interface Props {
  feedbacks: {
    data: Feedback[];
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RATING_CONFIG: Record<number, { emoji: string; label: string; color: string; bg: string }> = {
  1: { emoji: "😡", label: "Very Bad",  color: "text-red-600",    bg: "bg-red-50 border-red-200"    },
  2: { emoji: "😞", label: "Bad",       color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
  3: { emoji: "😐", label: "Neutral",   color: "text-yellow-500", bg: "bg-yellow-50 border-yellow-200" },
  4: { emoji: "😊", label: "Good",      color: "text-emerald-500",bg: "bg-emerald-50 border-emerald-200" },
  5: { emoji: "😍", label: "Excellent", color: "text-green-600",  bg: "bg-green-50 border-green-200" },
};

const SENTIMENT_CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  very_positive: { label: "Very Positive", classes: "bg-green-100 text-green-700 border border-green-200",    dot: "bg-green-500" },
  positive:      { label: "Positive",      classes: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-400" },
  neutral:       { label: "Neutral",       classes: "bg-slate-100 text-slate-600 border border-slate-200",    dot: "bg-slate-400" },
  negative:      { label: "Negative",      classes: "bg-orange-100 text-orange-700 border border-orange-200", dot: "bg-orange-500" },
  very_negative: { label: "Very Negative", classes: "bg-red-100 text-red-700 border border-red-200",          dot: "bg-red-500" },
};

const SORT_OPTIONS = [
  { value: "recent",      label: "Most Recent" },
  { value: "rating_high", label: "Highest Rating" },
  { value: "rating_low",  label: "Lowest Rating" },
] as const;

type SortOption = typeof SORT_OPTIONS[number]["value"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${accent ?? "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function RatingBar({ rating, count, total }: { rating: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const { emoji, label, color } = RATING_CONFIG[rating];
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-5 text-center">{emoji}</span>
      <span className="w-14 text-gray-500">{label}</span>
      <div className="relative flex-1 h-1.5 rounded-full bg-gray-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`absolute inset-y-0 left-0 rounded-full ${color.replace("text-", "bg-")}`}
        />
      </div>
      <span className="w-7 text-right font-medium text-gray-600">{count}</span>
    </div>
  );
}

function FeedbackCard({ feedback, onDelete }: { feedback: Feedback; onDelete: (f: Feedback) => void }) {
  const cfg = RATING_CONFIG[feedback.rating];
  const sent = feedback.sentiment_label ? SENTIMENT_CONFIG[feedback.sentiment_label] : null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={`group rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${cfg.bg}`}
    >
      <div className="flex items-start gap-4">
        {/* Rating badge */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <span className="text-3xl leading-none">{cfg.emoji}</span>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {/* Header row */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-gray-900">{feedback.servicer_name}</span>
            <span className="text-xs text-gray-400">
              {feedback.counter_name} · {feedback.branch_name}
            </span>
            <span className="ml-auto text-xs text-gray-400">{feedback.submitted_at}</span>
          </div>

          {/* Comment */}
          {feedback.comment && (
            <blockquote className="border-l-2 border-gray-200 pl-3 text-sm italic text-gray-600 line-clamp-3">
              {feedback.comment}
            </blockquote>
          )}

          {/* Footer: tags + sentiment */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {feedback.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/80 border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 shadow-sm"
              >
                {tag}
              </span>
            ))}

            {sent && (
              <span className={`ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${sent.classes}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sent.dot}`} />
                {sent.label}
              </span>
            )}
          </div>
        </div>

        {/* Delete — hidden until hover */}
        <button
          onClick={() => onDelete(feedback)}
          aria-label="Delete feedback"
          className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 focus:opacity-100"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.article>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
      <span className="text-5xl">📭</span>
      <p className="mt-4 font-semibold text-gray-700">No feedback found</p>
      <p className="mt-1 text-sm text-gray-400">
        {hasFilters ? "Try adjusting your filters" : "No submissions yet"}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

function DeleteModal({
  target,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  target: Feedback;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.94, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Delete Feedback</h3>
            <p className="text-sm text-gray-500">This cannot be undone</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-600">
          Remove feedback from <strong>{target.servicer_name}</strong> submitted on{" "}
          <strong>{target.submitted_at}</strong>?
        </p>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminFeedback({ feedbacks }: Props) {
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [sentimentFilter, setSentimentFilter] = useState<string | "all">("all");
  const [branchFilter, setBranchFilter] = useState<string | "all">("all");
  const [servicerFilter, setServicerFilter] = useState<string | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showDistribution, setShowDistribution] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Feedback | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Derived data ────────────────────────────────────────────────────────────

  const branches = useMemo(
    () => Array.from(new Set(feedbacks.data.map((f) => f.branch_name))).sort(),
    [feedbacks.data]
  );

  const servicers = useMemo(
    () => Array.from(new Set(feedbacks.data.map((f) => f.servicer_name))).sort(),
    [feedbacks.data]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return feedbacks.data
      .filter((f) => {
        if (q && !f.comment?.toLowerCase().includes(q) &&
            !f.servicer_name.toLowerCase().includes(q) &&
            !f.counter_name.toLowerCase().includes(q) &&
            !f.branch_name.toLowerCase().includes(q)) return false;
        if (ratingFilter !== "all" && f.rating !== ratingFilter) return false;
        if (sentimentFilter !== "all" && f.sentiment_label !== sentimentFilter) return false;
        if (branchFilter !== "all" && f.branch_name !== branchFilter) return false;
        if (servicerFilter !== "all" && f.servicer_name !== servicerFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rating_high") return b.rating - a.rating;
        if (sortBy === "rating_low")  return a.rating - b.rating;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
  }, [feedbacks.data, search, ratingFilter, sentimentFilter, branchFilter, servicerFilter, sortBy]);

  const avgRating = filtered.length > 0
    ? (filtered.reduce((s, f) => s + f.rating, 0) / filtered.length).toFixed(1)
    : "—";

  const ratingCounts = useMemo(() =>
    [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: filtered.filter((f) => f.rating === r).length })),
    [filtered]
  );

  const hasFilters = search !== "" || ratingFilter !== "all" || sentimentFilter !== "all" ||
    branchFilter !== "all" || servicerFilter !== "all" || sortBy !== "recent";

  // ── Handlers ────────────────────────────────────────────────────────────────

  const clearFilters = useCallback(() => {
    setSearch("");
    setRatingFilter("all");
    setSentimentFilter("all");
    setBranchFilter("all");
    setServicerFilter("all");
    setSortBy("recent");
    searchRef.current?.focus();
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    router.delete(route("feedback.destroy", deleteTarget.id), {
      onSuccess: () => {
        toast.success("Feedback deleted");
        setDeleteTarget(null);
      },
      onError: () => toast.error("Failed to delete feedback"),
      onFinish: () => setIsDeleting(false),
    });
  }, [deleteTarget]);

  const handleExport = useCallback((format: "csv" | "json") => {
    let content: string, filename: string, type: string;

    if (format === "csv") {
      const headers = ["ID","Rating","Sentiment","Comment","Servicer","Counter","Branch","Tags","Submitted At"];
      const rows = filtered.map((f) => [
        f.id, f.rating, f.sentiment_label ?? "N/A",
        `"${f.comment?.replace(/"/g, '""') ?? ""}"`,
        f.servicer_name, f.counter_name, f.branch_name,
        `"${f.tags.join(", ")}"`, f.submitted_at,
      ]);
      content  = [headers, ...rows].map((r) => r.join(",")).join("\n");
      filename = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
      type     = "text/csv";
    } else {
      content  = JSON.stringify(filtered, null, 2);
      filename = `feedback-${new Date().toISOString().slice(0, 10)}.json`;
      type     = "application/json";
    }

    const a = Object.assign(document.createElement("a"), {
      href: `data:${type};charset=utf-8,${encodeURIComponent(content)}`,
      download: filename,
      style: "display:none",
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`Exported ${filtered.length} records as ${format.toUpperCase()}`);
  }, [filtered]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Head title="Customer Feedback" />
      <AdminLayout
        title="Customer Feedback"
        active="feedback"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("csv")}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
            <button
              onClick={() => handleExport("json")}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 shadow-sm hover:bg-blue-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              JSON
            </button>
          </div>
        }
      >
        <Toaster position="top-right" toastOptions={{ className: "text-sm" }} />

        <div className="space-y-5 p-6">

          {/* ── Stats row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total Feedback" value={feedbacks.total} />
            <StatCard label="Filtered" value={filtered.length} accent="text-blue-600"
              sub={filtered.length !== feedbacks.total ? "of total" : undefined} />
            <StatCard label="Avg Rating" value={`${avgRating} ⭐`} />
            <StatCard label="5-Star" value={ratingCounts[0].count}
              accent="text-green-600" sub={`${filtered.length ? Math.round((ratingCounts[0].count / filtered.length) * 100) : 0}%`} />
            <StatCard label="1-Star" value={ratingCounts[4].count}
              accent="text-red-600" sub={`${filtered.length ? Math.round((ratingCounts[4].count / filtered.length) * 100) : 0}%`} />
          </div>

          {/* ── Distribution toggle ────────────────────────────────────────── */}
          <button
            onClick={() => setShowDistribution((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <span>Rating Distribution</span>
            <motion.span animate={{ rotate: showDistribution ? 180 : 0 }} transition={{ duration: 0.2 }}>
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {showDistribution && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="space-y-2">
                  {ratingCounts.map(({ rating, count }) => (
                    <RatingBar key={rating} rating={rating} count={count} total={filtered.length} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Filters ───────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
            {/* Search */}
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                placeholder="Search comment, servicer, counter or branch…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter row */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/* Rating */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Rating</label>
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All Ratings</option>
                  {[5,4,3,2,1].map((r) => (
                    <option key={r} value={r}>{RATING_CONFIG[r].emoji} {RATING_CONFIG[r].label}</option>
                  ))}
                </select>
              </div>

              {/* Sentiment */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sentiment</label>
                <select
                  value={sentimentFilter}
                  onChange={(e) => setSentimentFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All Sentiments</option>
                  {Object.entries(SENTIMENT_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Branch */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* Servicer */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Servicer</label>
                <select
                  value={servicerFilter}
                  onChange={(e) => setServicerFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All Servicers</option>
                  {servicers.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Sort + active filter chips */}
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Sort:</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      className={`px-3 py-1.5 transition-colors ${
                        sortBy === opt.value
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* ── Results summary ────────────────────────────────────────────── */}
          <p className="text-xs text-gray-400">
            Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of{" "}
            <span className="font-semibold text-gray-600">{feedbacks.total}</span> submissions
          </p>

          {/* ── Feedback list ──────────────────────────────────────────────── */}
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
            ) : (
              <div className="space-y-3">
                {filtered.map((feedback) => (
                  <FeedbackCard
                    key={feedback.id}
                    feedback={feedback}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Delete modal ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {deleteTarget && (
            <DeleteModal
              target={deleteTarget}
              onConfirm={confirmDelete}
              onCancel={() => setDeleteTarget(null)}
              isDeleting={isDeleting}
            />
          )}
        </AnimatePresence>
      </AdminLayout>
    </>
  );
}