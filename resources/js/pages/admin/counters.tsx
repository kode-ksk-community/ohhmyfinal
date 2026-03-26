/**
 * AdminCounters.tsx
 *
 * Admin page to manage counters (Create, Read, Update, Delete).
 * Counters belong to a branch and have a PIN for device login.
 *
 * Route:    GET /admin/counters
 * File:     resources/js/Pages/Admin/Counters.tsx
 *
 * Key improvements over original:
 *  - handleSave in drawer wired up with proper onSuccess/onError/onFinish callbacks
 *  - No more fire-and-forget router calls — all mutations use preserveScroll: true
 *  - Flash messages read from usePage().props.flash (single source of truth)
 *  - destroy guards the occupied check on the frontend too, with a clear toast
 *  - deleting state on modal prevents double-submit
 *  - Server-side validation errors surfaced inline in the drawer form
 */

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Head, router, usePage } from "@inertiajs/react";
import toast, { Toaster } from "react-hot-toast";
import AdminLayout from '@/layouts/app-layout';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QRCode from "qrcode";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Counter {
  id: number;
  branch_id: number;
  branch_name: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_occupied: boolean;
  current_servicer: string | null;
  feedback_count: number;
  device_token: string;
  created_at: string;
}

interface Branch {
  id: number;
  name: string;
}

interface PageProps {
  counters: Counter[];
  branches: Branch[];
  flash?: { success?: string; error?: string };
  [key: string]: unknown;
}

// ─── QR Code ─────────────────────────────────────────────────────────────────

function CounterQRCode({ counter }: { counter: Counter }) {
  const [qrData, setQrData] = useState<string>("");

  useEffect(() => {
    const setupUrl = `${window.location.origin}/counter/activate?counter_token=${counter.device_token}`;
    QRCode.toDataURL(setupUrl, {
      width: 300,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrData)
      .catch((err) => console.error("QR Generation Error:", err));
  }, [counter.device_token]);

  const downloadQR = () => {
    const link = document.createElement("a");
    link.href = qrData;
    link.download = `QR_${counter.name.replace(/\s+/g, "_")}.png`;
    link.click();
  };

  if (!qrData)
    return <div className="w-10 h-10 animate-pulse bg-slate-100 rounded-lg" />;

  return (
    <div className="group relative flex items-center justify-center w-10">
      <motion.img
        whileHover={{ scale: 1.1 }}
        src={qrData}
        alt={`QR setup for ${counter.name}`}
        onClick={downloadQR}
        className="w-10 h-10 rounded-lg border border-slate-100 cursor-pointer shadow-sm transition-shadow hover:shadow-md"
      />
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
        Click to Download
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function CounterDrawer({
  counter,
  branches,
  onClose,
}: {
  counter: Partial<Counter> | null;
  branches: Branch[];
  onClose: () => void;
}) {
  const isEdit = !!counter?.id;
  const [form, setForm] = useState({
    branch_id: counter?.branch_id ?? branches[0]?.id ?? 1,
    name: counter?.name ?? "",
    description: counter?.description ?? "",
    pin: "",
    is_active: counter?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const generatePin = () => {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    setForm((p) => ({ ...p, pin }));
    setShowPin(true);
  };

  const handleSave = () => {
    // Client-side guards
    const clientErrors: Record<string, string> = {};
    if (!form.name.trim()) clientErrors.name = "Counter name is required";
    if (!isEdit && !form.pin) clientErrors.pin = "PIN is required for new counters";
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
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

    if (isEdit && counter?.id) {
      router.put(route("admin.counters.update", counter.id), form, options);
    } else {
      router.post(route("admin.counters.store"), form, options);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-30"
        style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(2px)" }}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 bottom-0 z-40 flex flex-col"
        style={{
          width: 420,
          background: "#ffffff",
          boxShadow: "-8px 0 40px rgba(15,23,42,0.12)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-7 py-5"
          style={{ borderBottom: "1px solid #f1f5f9" }}
        >
          <div>
            <h2
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "17px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {isEdit ? "Edit Counter" : "New Counter"}
            </h2>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                color: "#94a3b8",
              }}
            >
              {isEdit
                ? `Editing: ${counter?.name}`
                : "Register a new counter device"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
          {/* Branch */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Branch
            </Label>
            <Select
              value={String(form.branch_id)}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, branch_id: Number(v) }))
              }
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.branch_id && (
              <p className="text-xs text-red-500">{errors.branch_id}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Counter Name *
            </Label>
            <Input
              className={`h-11 rounded-xl ${errors.name ? "border-red-400" : ""}`}
              value={form.name}
              onChange={(e) => {
                setForm((p) => ({ ...p, name: e.target.value }));
                if (errors.name) setErrors((p) => ({ ...p, name: "" }));
              }}
              placeholder="e.g. Counter 01"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Description (Optional)
            </Label>
            <Input
              className="h-11 rounded-xl"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Location or specific usage"
            />
          </div>

          {/* PIN */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Security PIN {!isEdit && "*"}
            </Label>
            <div className="flex gap-2">
              <Input
                type={showPin ? "text" : "password"}
                value={form.pin}
                onChange={(e) => {
                  setForm((p) => ({
                    ...p,
                    pin: e.target.value.replace(/\D/g, "").slice(0, 6),
                  }));
                  if (errors.pin) setErrors((p) => ({ ...p, pin: "" }));
                }}
                placeholder={isEdit ? "Leave blank to keep existing" : "4–6 digit PIN"}
                className={`flex-1 font-mono text-lg tracking-[0.3em] h-11 rounded-xl ${errors.pin ? "border-red-400" : ""}`}
              />
              <Button
                variant="outline"
                className="h-11 w-11 p-0 rounded-xl"
                onClick={() => setShowPin(!showPin)}
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
              >
                {showPin ? "🙈" : "👁"}
              </Button>
              <Button
                variant="secondary"
                className="h-11 rounded-xl px-4 font-bold"
                onClick={generatePin}
              >
                Auto
              </Button>
            </div>
            {errors.pin ? (
              <p className="text-xs text-red-500">{errors.pin}</p>
            ) : (
              <p className="text-[11px] text-slate-400 leading-relaxed italic">
                {isEdit
                  ? "Leave blank to keep the existing PIN."
                  : "Staff will use this PIN to log into the counter tablet."}
              </p>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-700">Status</p>
              <p className="text-[11px] text-slate-400">
                Inactive counters cannot be used for service.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={form.is_active}
              onClick={() =>
                setForm((p) => ({ ...p, is_active: !p.is_active }))
              }
              className={`w-12 h-6 rounded-full transition-colors relative ${
                form.is_active ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <motion.div
                animate={{ x: form.is_active ? 26 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-6 border-t border-slate-100 flex gap-3">
          <Button
            onClick={onClose}
            variant="ghost"
            disabled={saving}
            className="flex-1 h-12 rounded-xl text-slate-500 font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] h-12 rounded-xl bg-slate-900 hover:bg-black text-white font-bold"
          >
            {saving
              ? "Saving…"
              : isEdit
              ? "Update Counter"
              : "Create Counter"}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  counter,
  onClose,
  onConfirm,
  deleting,
}: {
  counter: Counter;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed z-[60] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-8 bg-white rounded-[2.5rem] shadow-2xl"
      >
        <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center text-3xl mb-6">
          ⚠️
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">
          Delete this counter?
        </h3>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          You are about to remove{" "}
          <span className="font-bold text-slate-900">"{counter.name}"</span>.
          This will disconnect any connected device immediately. Historical
          feedback data will remain in reports.
        </p>
        <div className="flex gap-4">
          <Button
            onClick={onClose}
            variant="ghost"
            disabled={deleting}
            className="flex-1 h-12 rounded-2xl font-bold"
          >
            Keep it
          </Button>
          <Button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 h-12 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold"
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminCounters({ counters, branches }: { counters: Counter[]; branches: Branch[] }) {
  const { props } = usePage<PageProps>();

  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState<number | "all">("all");
  const [drawer, setDrawer] = useState<Partial<Counter> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Counter | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Flash messages ────────────────────────────────────────────────────────
  useEffect(() => {
    if (props.flash?.success) toast.success(props.flash.success);
    if (props.flash?.error)   toast.error(props.flash.error);
  }, [props.flash]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      counters
        .filter(
          (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.branch_name.toLowerCase().includes(search.toLowerCase())
        )
        .filter((c) =>
          filterBranch === "all" ? true : c.branch_id === filterBranch
        ),
    [counters, search, filterBranch]
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleForceEnd = (id: number) => {
    router.patch(route("admin.counters.force-end-session", id), {}, {
      preserveScroll: true,
      onError: () => toast.error("Failed to end session"),
    });
  };

  const handleToggleActive = (id: number) => {
    router.patch(route("admin.counters.toggle", id), {}, {
      preserveScroll: true,
      onError: () => toast.error("Failed to toggle counter status"),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;

    // Frontend guard: don't allow delete if occupied
    if (deleteTarget.is_occupied) {
      toast.error("Cannot delete a counter with an active session. End the session first.");
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    router.delete(route("admin.counters.destroy", deleteTarget.id), {
      preserveScroll: true,
      onSuccess: () => setDeleteTarget(null),
      onError: () => toast.error("Failed to delete counter"),
      onFinish: () => setDeleting(false),
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Counter Management" active="counters">
      <Head title="Counter Management" />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "'DM Sans', sans-serif",
            borderRadius: "12px",
            fontSize: "13px",
          },
        }}
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or branch…"
              className="pl-11 pr-4 py-2.5 w-[280px] rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
            />
          </div>

          <select
            value={filterBranch}
            onChange={(e) =>
              setFilterBranch(
                e.target.value === "all" ? "all" : Number(e.target.value)
              )
            }
            className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <motion.button
          whileHover={{ scale: 1.02, translateY: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrawer({})}
          className="px-6 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-lg shadow-slate-900/20 flex items-center gap-2"
        >
          <span className="text-lg">+</span> Create Counter
        </motion.button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {["Counter Details", "Branch", "Activity", "Metrics", "Setup", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center text-sm text-slate-400"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      No counters found
                    </td>
                  </tr>
                ) : (
                  filtered.map((counter, idx) => (
                    <motion.tr
                      key={counter.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">
                            🖥️
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">
                              {counter.name}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {counter.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                          {counter.branch_name}
                        </span>
                      </td>

                      {/* Activity */}
                      <td className="px-6 py-4">
                        {counter.is_occupied ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[11px] font-black text-emerald-600 uppercase">
                                Live Now
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-slate-400">
                              {counter.current_servicer}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 opacity-50">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                counter.is_active
                                  ? "bg-slate-400"
                                  : "bg-rose-500"
                              }`}
                            />
                            <span className="text-[11px] font-bold text-slate-500">
                              {counter.is_active ? "Idle" : "Inactive"}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Metrics */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">
                            {counter.feedback_count.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                            Feedbacks
                          </span>
                        </div>
                      </td>

                      {/* QR */}
                      <td className="px-6 py-4">
                        <CounterQRCode counter={counter} />
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {counter.is_occupied && (
                            <button
                              onClick={() => handleForceEnd(counter.id)}
                              title="Force End Session"
                              className="p-2 hover:bg-amber-50 rounded-xl text-amber-600 transition-colors"
                            >
                              🛑
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleActive(counter.id)}
                            title={counter.is_active ? "Deactivate" : "Activate"}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors text-sm font-bold"
                          >
                            {counter.is_active ? "⏸" : "▶"}
                          </button>
                          <button
                            onClick={() => setDrawer(counter)}
                            title="Edit counter"
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                          >
                            ⚙️
                          </button>
                          <button
                            onClick={() => setDeleteTarget(counter)}
                            title="Delete counter"
                            className="p-2 hover:bg-rose-50 rounded-xl text-rose-500 transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div
          className="px-6 py-3"
          style={{ borderTop: "1px solid #f1f5f9", background: "#fafbfc" }}
        >
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "11px",
              color: "#94a3b8",
            }}
          >
            Showing {filtered.length} of {counters.length} counter
            {counters.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Delete Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            counter={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            deleting={deleting}
          />
        )}
      </AnimatePresence>

      {/* ── Drawer ── */}
      <AnimatePresence>
        {drawer !== null && (
          <CounterDrawer
            counter={drawer}
            branches={branches}
            onClose={() => setDrawer(null)}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}