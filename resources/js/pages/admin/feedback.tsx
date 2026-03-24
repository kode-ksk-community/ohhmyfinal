import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { router } from "@inertiajs/react";
import AdminLayout from "../Layouts/Adminlayout";

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

const ratingEmojis: Record<number, string> = {
  1: "😡",
  2: "😞",
  3: "😐",
  4: "😊",
  5: "😍",
};

const sentimentColors: Record<string, string> = {
  very_positive: "bg-green-100 text-green-700",
  positive: "bg-emerald-100 text-emerald-700",
  neutral: "bg-gray-100 text-gray-700",
  negative: "bg-orange-100 text-orange-700",
  very_negative: "bg-red-100 text-red-700",
};

export default function AdminFeedback({ feedbacks }: Props) {
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [sentimentFilter, setSentimentFilter] = useState<string | "all">("all");
  const [sortBy, setSortBy] = useState<"recent" | "rating_high" | "rating_low">("recent");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Feedback | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | null>(null);

  // Filter and sort feedback
  const filtered = useMemo(() => {
    const result = feedbacks.data.filter((f) => {
      const matchesSearch =
        f.comment?.toLowerCase().includes(search.toLowerCase()) ||
        f.servicer_name.toLowerCase().includes(search.toLowerCase()) ||
        f.counter_name.toLowerCase().includes(search.toLowerCase()) ||
        f.branch_name.toLowerCase().includes(search.toLowerCase());

      const matchesRating = ratingFilter === "all" ? true : f.rating === ratingFilter;
      const matchesSentiment =
        sentimentFilter === "all" ? true : f.sentiment_label === sentimentFilter;

      return matchesSearch && matchesRating && matchesSentiment;
    });

    // Sort feedback
    result.sort((a, b) => {
      if (sortBy === "rating_high") return b.rating - a.rating;
      if (sortBy === "rating_low") return a.rating - b.rating;
      // recent
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    });

    return result;
  }, [feedbacks.data, search, ratingFilter, sentimentFilter, sortBy]);

  // Get unique values for basic filtering
  const branches = useMemo(() => {
    return Array.from(new Set(feedbacks.data.map((f) => f.branch_name))).sort();
  }, [feedbacks.data]);

  const servicers = useMemo(() => {
    return Array.from(new Set(feedbacks.data.map((f) => f.servicer_name))).sort();
  }, [feedbacks.data]);

  const handleDelete = (feedback: Feedback) => {
    setDeleteTarget(feedback);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    router.delete(route("feedback.destroy", deleteTarget.id), {
      onSuccess: () => {
        toast.success("Feedback deleted successfully");
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error("Failed to delete feedback");
      },
    });
  };

  // Export functionality
  const handleExport = (format: "csv" | "json") => {
    let content: string;
    let filename: string;
    let type: string;

    if (format === "csv") {
      // Prepare CSV data
      const headers = [
        "ID",
        "Rating",
        "Sentiment",
        "Comment",
        "Servicer",
        "Counter",
        "Branch",
        "Tags",
        "Submitted At",
      ];
      const rows = filtered.map((f) => [
        f.id,
        f.rating,
        f.sentiment_label || "N/A",
        `"${f.comment?.replace(/"/g, '""') || ""}"`,
        f.servicer_name,
        f.counter_name,
        f.branch_name,
        `"${f.tags.join(", ")}"`,
        f.submitted_at,
      ]);

      content = [headers, ...rows].map((row) => row.join(",")).join("\n");
      filename = `feedback-export-${new Date().toISOString().split("T")[0]}.csv`;
      type = "text/csv";
    } else {
      // JSON export
      content = JSON.stringify(filtered, null, 2);
      filename = `feedback-export-${new Date().toISOString().split("T")[0]}.json`;
      type = "application/json";
    }

    const element = document.createElement("a");
    element.setAttribute("href", `data:${type};charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute("download", filename);
    element.style.display = "none";

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast.success(`Exported ${filtered.length} feedback records as ${format.toUpperCase()}`);
    setExportFormat(null);
  };

  return (
    <AdminLayout
      title="Customer Feedback"
      active="feedback"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
          >
            Export JSON
          </button>
        </div>
      }
    >
      <Toaster position="top-right" />

      <div className="space-y-6 p-6">
        {/* Header with Export */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Feedback</h1>
            <p className="mt-1 text-gray-500">View and manage all customer feedback submissions</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setExportFormat(exportFormat ? null : "csv")}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              📥 Export
            </button>
            {exportFormat && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-32 rounded-lg border border-gray-200 bg-white shadow-lg"
              >
                <button
                  onClick={() => handleExport("csv")}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  📊 Export as CSV
                </button>
                <button
                  onClick={() => handleExport("json")}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-200"
                >
                  📄 Export as JSON
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">Total Feedback</div>
            <div className="mt-1 text-2xl font-bold">{feedbacks.total}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">Filtered Results</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">{filtered.length}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">Avg Rating</div>
            <div className="mt-1 text-2xl font-bold">
              {filtered.length > 0
                ? (filtered.reduce((sum, f) => sum + f.rating, 0) / filtered.length).toFixed(1)
                : "0.0"}{" "}
              ⭐
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">😍 5-Star</div>
            <div className="mt-1 text-2xl font-bold text-green-600">
              {filtered.filter((f) => f.rating === 5).length}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">😡 1-Star</div>
            <div className="mt-1 text-2xl font-bold text-red-600">
              {filtered.filter((f) => f.rating === 1).length}
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          {/* Basic Filters */}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Search</label>
              <input
                type="text"
                placeholder="Comment, servicer, counter, branch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Rating</label>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Ratings</option>
                <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                <option value="4">⭐⭐⭐⭐ Good</option>
                <option value="3">⭐⭐⭐ Neutral</option>
                <option value="2">⭐⭐ Bad</option>
                <option value="1">⭐ Very Bad</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Sentiment</label>
              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Sentiments</option>
                <option value="very_positive">Very Positive</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
                <option value="very_negative">Very Negative</option>
              </select>
            </div>
          </div>

          {/* Sort and Advanced Options */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="recent">Most Recent</option>
                <option value="rating_high">Highest Rating</option>
                <option value="rating_low">Lowest Rating</option>
              </select>
            </div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              ⚙️ Advanced {showAdvanced ? "▼" : "▶"}
            </button>
          </div>

          {/* Advanced Filters Collapse */}
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 border-t border-gray-200 pt-3"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Branch</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Servicer</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">All Servicers</option>
                    {servicers.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500">💡 Additional filters coming soon: date range, tags, and more</p>
            </motion.div>
          )}
        </div>

        {/* Results Info */}
        <div className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filtered.length}</span> of{" "}
          <span className="font-semibold">{feedbacks.total}</span> total feedback
          {search ||
          ratingFilter !== "all" ||
          sentimentFilter !== "all" ||
          sortBy !== "recent" ? (
            <button
              onClick={() => {
                setSearch("");
                setRatingFilter("all");
                setSentimentFilter("all");
                setSortBy("recent");
              }}
              className="ml-2 text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {/* Feedback List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-gray-500">No feedback found matching your filters</p>
            </div>
          ) : (
            filtered.map((feedback) => (
              <motion.div
                key={feedback.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{ratingEmojis[feedback.rating]}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{feedback.servicer_name}</span>
                          <span className="text-xs text-gray-500">at {feedback.counter_name}</span>
                          <span className="text-xs text-gray-500">({feedback.branch_name})</span>
                        </div>
                        <div className="text-xs text-gray-400">{feedback.submitted_at}</div>
                      </div>
                    </div>

                    {feedback.comment && (
                      <p className="mt-3 text-gray-700 italic">"{feedback.comment}"</p>
                    )}

                    {feedback.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {feedback.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {feedback.sentiment_label && (
                      <div className="mt-2">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                            sentimentColors[feedback.sentiment_label]
                          }`}
                        >
                          {feedback.sentiment_label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* <button
                    onClick={() => handleDelete(feedback)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete feedback"
                  >
                    ✕
                  </button> */}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteTarget(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg bg-white p-6 shadow-lg"
            >
              <h3 className="text-lg font-bold text-gray-900">Delete Feedback?</h3>
              <p className="mt-2 text-gray-600">
                Are you sure you want to delete this feedback? This action cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
