/**
 * AdminTags.tsx
 *
 * Admin page to manage feedback tags.
 *
 * Route:    GET /admin/tags
 * File:     resources/js/Pages/Admin/Tags.tsx
 *
 * Key improvements over original:
 *  - No more window.location.reload() — Inertia redirect cycle handles all updates
 *  - Flash messages read from usePage().props.flash (single source of truth)
 *  - handleSave / onSave prop removed — drawer owns its router calls directly
 *  - Proper onSuccess / onError / onFinish callbacks in TagDrawer
 *  - Server-side validation errors shown inline per field
 *  - Delete modal has deleting state to prevent double-submit
 *  - Duplicate "Sentiment" section in the drawer removed
 *  - preserveScroll: true on all mutations
 */

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Head, router, usePage } from "@inertiajs/react";
import toast, { Toaster } from "react-hot-toast";
import AdminLayout from '@/layouts/app-layout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tag {
  id: number;
  branch_id: number | null;
  branch_name: string | null;
  name: string;
  name_kh: string | null;
  color: string;
  icon: string | null;
  emoji_levels?: string[];
  sentiment: "very_positive" | "positive" | "neutral" | "negative" | "very_negative";
  sort_order: number;
  is_active: boolean;
  usage_count: number;
}

interface Branch {
  id: number;
  name: string;
}

interface PageProps {
  tags: Tag[];
  branches: Branch[];
  flash?: { success?: string; error?: string };
  [key: string]: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#10b981", "#6366f1",
  "#84cc16", "#0ea5e9", "#d946ef", "#64748b", "#0f172a",
];

const SENTIMENT_CONFIG = {
  very_positive: { label: "Very Positive", color: "#22c55e", bg: "#f0fdf4", icon: "😊", level: 5 },
  positive:      { label: "Positive",      color: "#84cc16", bg: "#fafce8", icon: "👍", level: 4 },
  neutral:       { label: "Neutral",       color: "#94a3b8", bg: "#f8fafc", icon: "😐", level: 3 },
  negative:      { label: "Negative",      color: "#f97316", bg: "#fff7ed", icon: "👎", level: 2 },
  very_negative: { label: "Very Negative", color: "#ef4444", bg: "#fef2f2", icon: "😭", level: 1 },
};

type Sentiment = keyof typeof SENTIMENT_CONFIG;

// ─── Tag Chip Preview ─────────────────────────────────────────────────────────

function TagChipPreview({
  name,
  color,
  icon,
  size = "md",
}: {
  name: string;
  color: string;
  icon: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-xs px-2.5 py-1",
    md: "text-sm px-4 py-2",
    lg: "text-base px-5 py-2.5",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-medium ${sizes[size]}`}
      style={{
        background: `${color}20`,
        color,
        border: `1.5px solid ${color}50`,
      }}
    >
      {icon && <span style={{ fontSize: size === "lg" ? 18 : 14 }}>{icon}</span>}
      {name || "Tag preview"}
    </span>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function TagDrawer({
  tag,
  branches,
  onClose,
}: {
  tag: Partial<Tag> | null;
  branches: Branch[];
  onClose: () => void;
}) {
  const isEdit = !!tag?.id;
  const [form, setForm] = useState({
    name:       tag?.name       ?? "",
    name_kh:    tag?.name_kh    ?? "",
    color:      tag?.color      ?? "#22c55e",
    icon:       tag?.icon       ?? "",
    sentiment:  (tag?.sentiment ?? "positive") as Sentiment,
    branch_id:  tag?.branch_id  ?? (null as number | null),
    sort_order: tag?.sort_order ?? 0,
    is_active:  tag?.is_active  ?? true,
  });
  const [customColor, setCustomColor] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const handleSave = () => {
    if (!form.name.trim()) {
      setErrors({ name: "Tag name is required" });
      return;
    }
    setErrors({});
    setSaving(true);

    const options = {
      preserveScroll: true,
      onSuccess: () => onClose(),
      onError: (errs: Record<string, string>) => {
        setErrors(errs);
        setSaving(false);
      },
      onFinish: () => setSaving(false),
    };

    if (isEdit && tag?.id) {
      router.put(route("admin.tags.update", tag.id), form, options);
    } else {
      router.post(route("admin.tags.store"), form, options);
    }
  };

  const inputBase: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 12,
    border: "1.5px solid #e2e8f0", background: "#fafbfc",
    fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
    color: "#0f172a", outline: "none",
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-30"
        style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(2px)" }}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 bottom-0 z-40 flex flex-col"
        style={{ width: 460, background: "#ffffff", boxShadow: "-8px 0 40px rgba(15,23,42,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5"
          style={{ borderBottom: "1px solid #f1f5f9" }}>
          <div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "17px", fontWeight: 800, color: "#0f172a", marginBottom: "2px" }}>
              {isEdit ? "Edit Tag" : "New Tag"}
            </h2>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "#94a3b8" }}>
              {isEdit ? `Editing: ${tag?.name}` : "Create a new feedback tag"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close drawer"
            style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "16px" }}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-5 flex flex-col gap-5">

          {/* Live preview */}
          <div className="p-4 rounded-2xl flex flex-col items-center gap-3"
            style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Live Preview
            </p>
            <TagChipPreview name={form.name} color={form.color} icon={form.icon || null} size="lg" />
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", color: "#94a3b8" }}>
              {SENTIMENT_CONFIG[form.sentiment].icon} {SENTIMENT_CONFIG[form.sentiment].label} — Level {SENTIMENT_CONFIG[form.sentiment].level}
            </p>
          </div>

          {/* Name EN */}
          <div>
            <label style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px" }}>
              Tag Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setErrors((p) => ({ ...p, name: "" })); }}
              placeholder="រស់រាយរាក់ទាក់ | Friendly Staff | 友好的员工"
              style={{ ...inputBase, borderColor: errors.name ? "#f87171" : "#e2e8f0" }}
              onFocus={(e) => (e.target.style.borderColor = "#0f172a")}
              onBlur={(e) => (e.target.style.borderColor = errors.name ? "#f87171" : "#e2e8f0")}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Name KH */}
          {/* <div>
            <label style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px" }}>
              Tag Name (Khmer) <span style={{ color: "#94a3b8", fontWeight: 400 }}>— optional</span>
            </label>
            <input
              value={form.name_kh}
              onChange={(e) => setForm((p) => ({ ...p, name_kh: e.target.value }))}
              placeholder="ឧ. បុគ្គលិកស្នាក់"
              style={inputBase}
              onFocus={(e) => (e.target.style.borderColor = "#0f172a")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div> */}

          {/* Icon */}
          {/* <div>
            <label style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px" }}>
              Icon / Emoji <span style={{ color: "#94a3b8", fontWeight: 400 }}>— optional</span>
            </label>
            <input
              value={form.icon}
              onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
              placeholder="e.g. 😊"
              maxLength={4}
              style={{ ...inputBase, fontSize: "20px", textAlign: "center", width: 80 }}
            />
          </div> */}

          {/* Sentiment */}
          <div>
            <label style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "10px" }}>
              Sentiment <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: 400, color: "#94a3b8", marginLeft: 6 }}>— affects sentiment analysis score</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.entries(SENTIMENT_CONFIG) as [Sentiment, typeof SENTIMENT_CONFIG[Sentiment]][]).map(([key, cfg]) => (
                <button key={key}
                  onClick={() => setForm((p) => ({ ...p, sentiment: key }))}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                  style={{
                    border: `1.5px solid ${form.sentiment === key ? cfg.color : "#e2e8f0"}`,
                    background: form.sentiment === key ? cfg.bg : "transparent",
                    cursor: "pointer",
                  }}>
                  <span style={{ fontSize: 22 }}>{cfg.icon}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", fontWeight: form.sentiment === key ? 600 : 400, color: form.sentiment === key ? cfg.color : "#94a3b8" }}>
                    Lvl {cfg.level}
                  </span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: form.sentiment === key ? 600 : 400, color: form.sentiment === key ? cfg.color : "#94a3b8", textAlign: "center", lineHeight: 1 }}>
                    {cfg.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Color palette */}
          <div>
            <label style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "10px" }}>
              Color
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((c) => (
                <button key={c}
                  onClick={() => { setForm((p) => ({ ...p, color: c })); setCustomColor(false); }}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    background: c, cursor: "pointer",
                    boxShadow: form.color === c ? `0 0 0 3px ${c}40, 0 0 0 2px white` : "none",
                    transform: form.color === c ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
              <button
                onClick={() => setCustomColor((p) => !p)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                style={{ background: customColor ? "#f8fafc" : "#f1f5f9", border: "1.5px dashed #d1d5db", cursor: "pointer", color: "#94a3b8" }}>
                +
              </button>
            </div>
            <AnimatePresence>
              {customColor && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                    style={{ width: 40, height: 40, border: "none", borderRadius: 10, cursor: "pointer", padding: 2, background: "none" }}
                  />
                  <input
                    value={form.color}
                    onChange={(e) => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) setForm((p) => ({ ...p, color: e.target.value })); }}
                    style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontFamily: "'DM Mono',monospace", fontSize: "13px", color: "#0f172a", outline: "none" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            {errors.color && <p className="text-xs text-red-500 mt-1">{errors.color}</p>}
          </div>

          {/* Branch scope */}
          <div>
            <label style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px" }}>
              Scope
            </label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setForm((p) => ({ ...p, branch_id: null }))}
                style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1.5px solid ${!form.branch_id ? "#0f172a" : "#e2e8f0"}`, background: !form.branch_id ? "#0f172a" : "transparent", color: !form.branch_id ? "#ffffff" : "#64748b", fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: !form.branch_id ? 600 : 400, cursor: "pointer" }}>
                🌐 Global (all branches)
              </button>
              <button
                onClick={() => setForm((p) => ({ ...p, branch_id: p.branch_id ?? branches[0]?.id ?? null }))}
                style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1.5px solid ${form.branch_id ? "#0f172a" : "#e2e8f0"}`, background: form.branch_id ? "#0f172a" : "transparent", color: form.branch_id ? "#ffffff" : "#64748b", fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: form.branch_id ? 600 : 400, cursor: "pointer" }}>
                🏢 Branch-specific
              </button>
            </div>
            <AnimatePresence>
              {form.branch_id && (
                <motion.select
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  value={form.branch_id}
                  onChange={(e) => setForm((p) => ({ ...p, branch_id: Number(e.target.value) }))}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#fafbfc", fontFamily: "'DM Sans',sans-serif", fontSize: "13px", color: "#0f172a", outline: "none", cursor: "pointer" }}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </motion.select>
              )}
            </AnimatePresence>
          </div>

          {/* Sort order + Active */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px" }}>
                Sort Order
              </label>
              <input
                type="number"
                value={form.sort_order}
                min={0}
                max={9999}
                onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                style={{ ...inputBase, fontFamily: "'DM Mono',monospace", fontSize: "14px" }}
              />
            </div>
            <div className="flex-1 flex flex-col justify-between p-4 rounded-2xl"
              style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Active
              </p>
              <button
                role="switch"
                aria-checked={form.is_active}
                onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                style={{ width: 44, height: 24, borderRadius: 12, border: "none", position: "relative", background: form.is_active ? "#22c55e" : "#d1d5db", cursor: "pointer", flexShrink: 0 }}>
                <motion.div
                  animate={{ left: form.is_active ? 22 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  style={{ position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%", background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 flex gap-3" style={{ borderTop: "1px solid #f1f5f9" }}>
          <button onClick={onClose} disabled={saving}
            style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1.5px solid #e2e8f0", background: "transparent", fontFamily: "'DM Sans',sans-serif", fontSize: "13px", fontWeight: 600, color: "#64748b", cursor: "pointer", opacity: saving ? 0.5 : 1 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: saving ? "#d1d5db" : "#0f172a", fontFamily: "'Syne',sans-serif", fontSize: "13px", fontWeight: 700, color: "#ffffff", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving
              ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite" }} /> Saving…</>
              : isEdit ? "Save Changes" : "Create Tag"}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  tag,
  onClose,
  onConfirm,
  deleting,
}: {
  tag: Tag;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-30"
        style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="fixed z-40 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 360, background: "#ffffff", borderRadius: 20, padding: "28px", boxShadow: "0 20px 60px rgba(15,23,42,0.2)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          {tag.emoji_levels?.map((emoji, idx) => (
            <span key={idx} style={{ fontSize: "24px" }}>{emoji}</span>
          ))}
          <div>
            <h4 style={{ fontFamily: "'Syne',sans-serif", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
              {tag.name}
            </h4>
            {tag.name_kh && (
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", color: "#94a3b8" }}>{tag.name_kh}</p>
            )}
          </div>
        </div>
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: "16px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
          Delete this tag?
        </h3>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "13px", color: "#64748b", lineHeight: 1.6, marginBottom: "20px" }}>
          Used <strong>{tag.usage_count.toLocaleString()}</strong> times. Existing feedback records will keep their tag associations.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={deleting}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "transparent", fontFamily: "'DM Sans',sans-serif", fontSize: "13px", fontWeight: 600, color: "#64748b", cursor: "pointer", opacity: deleting ? 0.5 : 1 }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: deleting ? "#d1d5db" : "#ef4444", fontFamily: "'DM Sans',sans-serif", fontSize: "13px", fontWeight: 700, color: "#ffffff", cursor: deleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {deleting
              ? <><div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite" }} /> Deleting…</>
              : "Delete Tag"}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminTags({ tags, branches }: { tags: Tag[]; branches: Branch[] }) {
  const { props } = usePage<PageProps>();

  const [search,       setSearch]       = useState("");
  const [filterSent,   setFilterSent]   = useState<string>("all");
  const [filterScope,  setFilterScope]  = useState<"all" | "global" | "branch">("all");
  const [viewMode,     setViewMode]     = useState<"grid" | "table">("grid");
  const [drawer,       setDrawer]       = useState<Partial<Tag> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── Flash messages ────────────────────────────────────────────────────────
  useEffect(() => {
    if (props.flash?.success) toast.success(props.flash.success);
    if (props.flash?.error)   toast.error(props.flash.error);
  }, [props.flash]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    tags
      .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
      .filter((t) => filterSent  === "all" ? true : t.sentiment === filterSent)
      .filter((t) => filterScope === "all" ? true : filterScope === "global" ? !t.branch_id : !!t.branch_id)
      .sort((a, b) => a.sort_order - b.sort_order),
    [tags, search, filterSent, filterScope]
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleToggle = (tag: Tag) => {
    router.patch(route("admin.tags.toggle", tag.id), {}, {
      preserveScroll: true,
      onError: () => toast.error("Failed to update tag status"),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    router.delete(route("admin.tags.destroy", deleteTarget.id), {
      preserveScroll: true,
      onSuccess: () => setDeleteTarget(null),
      onError: () => toast.error("Failed to delete tag"),
      onFinish: () => setDeleting(false),
    });
  };

  // ── Shared action buttons (used in both grid and table) ───────────────────

  const ActionButtons = ({ tag }: { tag: Tag }) => (
    <div className="flex gap-2">
      <button onClick={() => setDrawer(tag)} title="Edit tag"
        style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "transparent", fontFamily: "'DM Sans',sans-serif", fontSize: "11px", color: "#374151", cursor: "pointer" }}>
        Edit
      </button>
      <button
        onClick={() => handleToggle(tag)}
        title={tag.is_active ? "Deactivate" : "Activate"}
        style={{ padding: "5px 8px", borderRadius: 8, fontSize: "11px", border: `1px solid ${tag.is_active ? "#bbf7d0" : "#fecaca"}`, background: tag.is_active ? "#f0fdf4" : "#fff1f0", color: tag.is_active ? "#16a34a" : "#dc2626", cursor: "pointer" }}>
        {tag.is_active ? "On" : "Off"}
      </button>
      <button onClick={() => setDeleteTarget(tag)} title="Delete tag"
        style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff1f0", fontSize: "11px", color: "#ef4444", cursor: "pointer" }}>
        🗑
      </button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Tags" active="tags">
      <Head title="Tags" />
      <Toaster position="top-right" toastOptions={{
        style: { fontFamily: "'DM Sans',sans-serif", borderRadius: "12px", fontSize: "13px" },
      }} />

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#94a3b8" }}>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tags…"
              style={{ paddingLeft: 34, paddingRight: 14, paddingTop: 9, paddingBottom: 9, borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#ffffff", fontFamily: "'DM Sans',sans-serif", fontSize: "13px", color: "#0f172a", outline: "none", width: 190 }}
              onFocus={(e) => (e.target.style.borderColor = "#0f172a")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>

          {/* Sentiment filter */}
          <div className="flex gap-1 p-1 rounded-xl overflow-x-auto"
            style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
            {(["all", "very_positive", "positive", "neutral", "negative", "very_negative"] as const).map((s) => {
              const cfg = s !== "all" ? SENTIMENT_CONFIG[s] : null;
              return (
                <button key={s} onClick={() => setFilterSent(s)}
                  style={{ padding: "5px 10px", borderRadius: 9, border: "none", background: filterSent === s ? "#0f172a" : "transparent", color: filterSent === s ? "#fff" : "#64748b", fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {cfg && <span style={{ fontSize: 13 }}>{cfg.icon}</span>}
                  {s === "all" ? "All" : `Lvl ${cfg?.level}`}
                </button>
              );
            })}
          </div>

          {/* Scope filter */}
          <select value={filterScope} onChange={(e) => setFilterScope(e.target.value as any)}
            style={{ padding: "8px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#ffffff", fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "#374151", outline: "none", cursor: "pointer" }}>
            <option value="all">All Scopes</option>
            <option value="global">Global Only</option>
            <option value="branch">Branch-specific</option>
          </select>

          {/* View mode toggle */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
            {([["grid", "⊞"], ["table", "☰"]] as const).map(([mode, icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{ padding: "5px 10px", borderRadius: 9, border: "none", background: viewMode === mode ? "#0f172a" : "transparent", color: viewMode === mode ? "#fff" : "#64748b", cursor: "pointer", fontSize: "14px" }}>
                {icon}
              </button>
            ))}
          </div>
        </div>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => setDrawer({})}
          style={{ padding: "9px 20px", borderRadius: 12, border: "none", background: "#0f172a", color: "#ffffff", fontFamily: "'Syne',sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          + New Tag
        </motion.button>
      </div>

      {/* ── Stats bar ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total Tags",   value: tags.length,                                                            color: "#0f172a" },
          { label: "Active",       value: tags.filter((t) => t.is_active).length,                                 color: "#22c55e" },
          { label: "Very Positive",value: tags.filter((t) => t.sentiment === "very_positive").length,             color: "#22c55e" },
          { label: "Positive",     value: tags.filter((t) => t.sentiment === "positive").length,                  color: "#84cc16" },
          { label: "Neutral",      value: tags.filter((t) => t.sentiment === "neutral").length,                   color: "#94a3b8" },
          { label: "Negative+",    value: tags.filter((t) => ["negative", "very_negative"].includes(t.sentiment)).length, color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl px-5 py-4"
            style={{ background: "#ffffff", border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
            <p style={{ fontFamily: "'Syne',sans-serif", fontSize: "22px", fontWeight: 800, color: s.color, letterSpacing: "-.03em", lineHeight: 1, marginBottom: 4 }}>
              {s.value}
            </p>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", color: "#94a3b8" }}>
              {s.label}
            </p>
          </div>
        ))}
      </motion.div>

      {/* ── Grid view ── */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((tag, i) => {
              const sentCfg = SENTIMENT_CONFIG[tag.sentiment];
              return (
                <motion.div key={tag.id}
                  layout
                  initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl p-4 flex flex-col gap-3 border"
                  style={{ background: "#ffffff",  boxShadow: "0 1px 4px rgba(0,0,0,.04)", opacity: tag.is_active ? 1 : 0.5 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <TagChipPreview name={tag.name} color={tag.color} icon={tag.icon} size="sm" />
                    {!tag.branch_id
                      ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#94a3b8", letterSpacing: "0.06em", flexShrink: 0 }}>GLOBAL</span>
                      : <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#3b82f6", letterSpacing: "0.06em", flexShrink: 0 }}>BRANCH</span>
                    }
                  </div>

                  {tag.name_kh && (
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "#94a3b8" }}>{tag.name_kh}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: 600, color: sentCfg.color }}>
                      {sentCfg.icon} {sentCfg.label}
                    </span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#94a3b8" }}>
                      ×{tag.usage_count.toLocaleString()}
                    </span>
                  </div>

                  <div className="pt-1" style={{ borderTop: "1px solid #f8fafc" }}>
                    <ActionButtons tag={tag} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="col-span-4 py-16 text-center" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "14px", color: "#94a3b8" }}>
              No tags found
            </div>
          )}
        </div>
      )}

      {/* ── Table view ── */}
      {viewMode === "table" && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 6px rgba(0,0,0,.04)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["#", "Tag", "Khmer", "Sentiment", "Scope", "Usage", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px", textAlign: "center", fontFamily: "'DM Sans',sans-serif", fontSize: "14px", color: "#94a3b8" }}>
                      No tags found
                    </td>
                  </tr>
                ) : filtered.map((tag, i) => {
                  const sentCfg = SENTIMENT_CONFIG[tag.sentiment];
                  return (
                    <motion.tr key={tag.id}
                      layout
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03 }}
                      style={{ borderBottom: "1px solid #f1f5f9", opacity: tag.is_active ? 1 : 0.5 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafbfc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#94a3b8" }}>{tag.sort_order}</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <TagChipPreview name={tag.name} color={tag.color} icon={tag.icon} size="sm" />
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "#94a3b8" }}>
                          {tag.name_kh ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: 600, color: sentCfg.color }}>
                          {sentCfg.icon} {sentCfg.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {tag.branch_id
                          ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#3b82f6" }}>{tag.branch_name}</span>
                          : <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#94a3b8" }}>Global</span>
                        }
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "#0f172a", fontWeight: 700 }}>
                          {tag.usage_count.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <ActionButtons tag={tag} />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          <div className="px-5 py-3" style={{ borderTop: "1px solid #f1f5f9", background: "#fafbfc" }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#94a3b8" }}>
              Showing {filtered.length} of {tags.length} tag{tags.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* ── Drawer ── */}
      <AnimatePresence>
        {drawer !== null && (
          <TagDrawer tag={drawer} branches={branches} onClose={() => setDrawer(null)} />
        )}
      </AnimatePresence>

      {/* ── Delete modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            tag={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            deleting={deleting}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </AdminLayout>
  );
}