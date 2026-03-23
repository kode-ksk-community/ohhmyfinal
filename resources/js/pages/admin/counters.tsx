/**
 * AdminCounters.tsx
 *
 * Admin page to manage counters (Create, Read, Update, Delete).
 * Counters belong to a branch and have a PIN for device login.
 *
 * Route:    GET /admin/counters
 * File:     resources/js/Pages/Admin/Counters.tsx
 *
 * Features:
 *   - Table with search + branch filter
 *   - Slide-in drawer with branch selector + PIN field
 *   - PIN auto-generator button
 *   - Occupied / Idle status badge (from active session)
 *   - Force-end active session action
 *   - Feedback count badge per counter
 *
 * ✅ DYNAMIC MODE: Fully integrated with Laravel backend via Inertia.js
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { router } from "@inertiajs/react";
import toast, { Toaster } from "react-hot-toast";
import AdminLayout from "../Layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  created_at: string;
}

interface Branch { id: number; name: string; }

// ─── Props from Inertia ───────────────────────────────────────────────────────

interface Props {
  counters: Counter[];
  branches: Branch[];
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function CounterDrawer({ counter, branches, onClose }: {
  counter: Partial<Counter> | null;
  branches: Branch[];
  onClose: () => void;
}) {
  const isEdit = !!counter?.id;
  const [form, setForm] = useState({
    branch_id: counter?.branch_id ?? branches[0]?.id ?? 1,
    name: counter?.name ?? "",
    description: counter?.description ?? "",
    pin: "",   // PIN is never pre-filled for security
    is_active: counter?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const generatePin = () => {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    setForm(p => ({ ...p, pin }));
    setShowPin(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Counter name is required"); return; }
    if (!isEdit && !form.pin) { toast.error("PIN is required for new counters"); return; }
    setSaving(true);
    try {
      if (isEdit && counter?.id) {
        router.put(route('admin.counters.update', counter.id), form, {
          onSuccess: () => {
            toast.success("Counter updated!");
            onClose();
            window.location.reload();
          },
          onError: (errors) => {
            toast.error("Failed to update counter");
            console.error(errors);
          }
        });
      } else {
        router.post(route('admin.counters.store'), form, {
          onSuccess: () => {
            toast.success("Counter created!");
            onClose();
            window.location.reload();
          },
          onError: (errors) => {
            toast.error("Failed to create counter");
            console.error(errors);
          }
        });
      }
    } catch (error) {
      toast.error("An error occurred");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-30"
        style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(2px)" }} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 bottom-0 z-40 flex flex-col"
        style={{ width: 420, background: "#ffffff", boxShadow: "-8px 0 40px rgba(15,23,42,0.12)" }}>

        <div className="flex items-center justify-between px-7 py-5"
          style={{ borderBottom: "1px solid #f1f5f9" }}>
          <div>
            <h2 style={{
              fontFamily: "'Syne', sans-serif", fontSize: "17px",
              fontWeight: 800, color: "#0f172a", marginBottom: "2px"
            }}>
              {isEdit ? "Edit Counter" : "New Counter"}
            </h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#94a3b8" }}>
              {isEdit ? `Editing: ${counter?.name}` : "Register a new counter device"}
            </p>
          </div>
          <button onClick={onClose}
            style={{
              background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
              width: 32, height: 32, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "16px"
            }}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 flex flex-col gap-5">

          {/* Branch selector */}
          <div className="space-y-1">
            <Label htmlFor="counter-branch" className="text-sm">Branch *</Label>
            <Select value={String(form.branch_id)} onValueChange={value => setForm(p => ({ ...p, branch_id: Number(value) }))}>
              <SelectTrigger id="counter-branch" className="w-full">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name + Description */}
          {[
            { key: "name", label: "Counter Name *", placeholder: "e.g. Counter 1" },
            { key: "description", label: "Description", placeholder: "e.g. Ground floor, near entrance" },
          ].map(f => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`counter-${f.key}`} className="text-sm">{f.label}</Label>
              <Input
                id={`counter-${f.key}`}
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
              />
            </div>
          ))}

          {/* PIN field */}
          <div>
            <label style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
              fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px"
            }}>
              {isEdit ? "New PIN (leave blank to keep current)" : "Counter PIN *"}
            </label>
            <div className="flex gap-2">
              <Input
                type={showPin ? "text" : "password"}
                value={form.pin}
                onChange={e => setForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                placeholder="4–6 digit PIN"
                maxLength={6}
                className="flex-1 font-mono text-lg tracking-widest"
              />
              <Button variant="outline" size="sm" onClick={() => setShowPin(p => !p)}>
                {showPin ? "🙈" : "👁"}
              </Button>
              <Button variant="default" size="sm" onClick={generatePin}>Generate</Button>
            </div>            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: "11px",
              color: "#94a3b8", marginTop: 6
            }}>
              PIN is hashed before storage. Share it securely with staff.
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl"
            style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
            <div>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                fontWeight: 600, color: "#374151", marginBottom: "2px"
              }}>Active</p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#94a3b8" }}>
                Inactive counters won't appear in device setup
              </p>
            </div>
            <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
              style={{
                width: 44, height: 24, borderRadius: 12, border: "none", position: "relative",
                background: form.is_active ? "#22c55e" : "#d1d5db", cursor: "pointer"
              }}>
              <motion.div animate={{ left: form.is_active ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                style={{
                  position: "absolute", top: 2, width: 20, height: 20,
                  borderRadius: "50%", background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)"
                }} />
            </button>
          </div>
        </div>

        <div className="px-7 py-5 flex gap-3 border-t border-slate-200">
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-2">
            {saving ? (
              <>
                <span className="h-3 w-3 rounded-full border border-white border-t-white/40 animate-spin" />
                Saving...
              </>
            ) : isEdit ? "Save Changes" : "Create Counter"}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminCounters({ counters: initialCounters, branches }: Props) {
  const [counters, setCounters] = useState<Counter[]>(initialCounters);
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState<number | "all">("all");
  const [drawer, setDrawer] = useState<Partial<Counter> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Counter | null>(null);

  const filtered = useMemo(() => counters
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.branch_name.toLowerCase().includes(search.toLowerCase()))
    .filter(c => filterBranch === "all" ? true : c.branch_id === filterBranch),
    [counters, search, filterBranch]);

  const handleForceEnd = (counter: Counter) => {
    router.patch(route('admin.counters.force-end-session', counter.id), {}, {
      onSuccess: () => {
        window.location.reload();
      },
      onError: () => {
        toast.error("Failed to end session");
      }
    });
  };

  const handleToggleActive = (counter: Counter) => {
    router.patch(route('admin.counters.toggle', counter.id), {}, {
      onSuccess: () => {
        window.location.reload();
      },
      onError: () => {
        toast.error("Failed to toggle counter status");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    router.delete(route('admin.counters.destroy', deleteTarget.id), {
      onSuccess: () => {
        window.location.reload();
      },
      onError: (errors) => {
        toast.error("Failed to delete counter");
        setDeleteTarget(null);
      }
    });
  };

  return (
    <AdminLayout title="Counters" active="counters">
      <Toaster position="top-right" toastOptions={{
        style: { fontFamily: "'DM Sans', sans-serif", borderRadius: "12px", fontSize: "13px" },
      }} />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#94a3b8" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search counters..."
              style={{
                paddingLeft: 34, paddingRight: 14, paddingTop: 9, paddingBottom: 9,
                borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#ffffff",
                fontFamily: "'DM Sans',sans-serif", fontSize: "13px", color: "#0f172a",
                outline: "none", width: 200
              }}
              onFocus={e => (e.target.style.borderColor = "#0f172a")}
              onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value === "all" ? "all" : Number(e.target.value))}
            style={{
              padding: "8px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0",
              background: "#ffffff", fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
              color: "#374151", outline: "none", cursor: "pointer"
            }}>
            <option value="all">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => setDrawer({})}
          style={{
            padding: "9px 20px", borderRadius: 12, border: "none", background: "#0f172a",
            color: "#ffffff", fontFamily: "'Syne',sans-serif", fontSize: "13px",
            fontWeight: 700, cursor: "pointer"
          }}>
          + New Counter
        </motion.button>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{
          background: "#ffffff", border: "1px solid #e2e8f0",
          boxShadow: "0 1px 6px rgba(0,0,0,0.04)"
        }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["Counter", "Branch", "Status", "Feedback", "Actions"].map(h => (
                <th key={h} style={{
                  padding: "12px 16px", textAlign: "left",
                  fontFamily: "'DM Mono',monospace", fontSize: "10px",
                  color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{
                  padding: "48px", textAlign: "center",
                  fontFamily: "'DM Sans',sans-serif", fontSize: "14px", color: "#94a3b8"
                }}>
                  No counters found
                </td></tr>
              ) : filtered.map((counter, i) => (
                <motion.tr key={counter.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafbfc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "14px 16px" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                        style={{ background: "#f0f9ff", flexShrink: 0 }}>🖥️</div>
                      <div>
                        <p style={{
                          fontFamily: "'Syne',sans-serif", fontSize: "13px",
                          fontWeight: 700, color: "#0f172a"
                        }}>{counter.name}</p>
                        <p style={{
                          fontFamily: "'DM Sans',sans-serif", fontSize: "11px",
                          color: "#94a3b8"
                        }}>{counter.description ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
                      color: "#64748b"
                    }}>{counter.branch_name}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {counter.is_occupied ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full"
                            style={{ background: "#22c55e", boxShadow: "0 0 4px #22c55e" }} />
                          <span style={{
                            fontFamily: "'DM Sans',sans-serif", fontSize: "11px",
                            fontWeight: 600, color: "#16a34a"
                          }}>Occupied</span>
                        </div>
                        <p style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#94a3b8" }}>
                          {counter.current_servicer}
                        </p>
                      </div>
                    ) : counter.is_active ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#94a3b8" }} />
                        <span style={{
                          fontFamily: "'DM Sans',sans-serif", fontSize: "11px",
                          fontWeight: 600, color: "#94a3b8"
                        }}>Idle</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#ef4444" }} />
                        <span style={{
                          fontFamily: "'DM Sans',sans-serif", fontSize: "11px",
                          fontWeight: 600, color: "#ef4444"
                        }}>Inactive</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "13px", color: "#3b82f6" }}>
                      {counter.feedback_count.toLocaleString()}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div className="flex items-center gap-2">
                      {counter.is_occupied && (
                        <button onClick={() => handleForceEnd(counter)}
                          style={{
                            padding: "6px 10px", borderRadius: 8,
                            border: "1px solid #fef9c3", background: "#fefce8",
                            fontFamily: "'DM Sans',sans-serif", fontSize: "11px",
                            color: "#854d0e", cursor: "pointer", fontWeight: 600
                          }}>
                          End Session
                        </button>
                      )}
                      <button onClick={() => handleToggleActive(counter)}
                        style={{
                          padding: "6px 10px", borderRadius: 8,
                          border: "1px solid #e2e8f0", background: "transparent",
                          fontFamily: "'DM Sans',sans-serif", fontSize: "11px",
                          color: counter.is_active ? "#16a34a" : "#ef4444", cursor: "pointer"
                        }}>
                        {counter.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => setDrawer(counter)}
                        style={{
                          padding: "6px 12px", borderRadius: 8,
                          border: "1px solid #e2e8f0", background: "transparent",
                          fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
                          color: "#374151", cursor: "pointer"
                        }}>
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget(counter)}
                        style={{
                          padding: "6px 10px", borderRadius: 8,
                          border: "1px solid #fecaca", background: "#fff1f0",
                          fontSize: "12px", color: "#ef4444", cursor: "pointer"
                        }}>
                        🗑
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        <div className="px-6 py-3" style={{ borderTop: "1px solid #f1f5f9", background: "#fafbfc" }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#94a3b8" }}>
            Showing {filtered.length} of {counters.length} counters
          </span>
        </div>
      </div>

      <AnimatePresence>
        {drawer !== null && (
          <CounterDrawer counter={drawer} branches={branches}
            onClose={() => setDrawer(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)} className="fixed inset-0 z-30"
              style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)" }} />
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed z-40 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: 380, background: "#ffffff", borderRadius: 20, padding: "28px",
                boxShadow: "0 20px 60px rgba(15,23,42,0.2)"
              }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                style={{ background: "#fff1f0" }}>🗑️</div>
              <h3 style={{
                fontFamily: "'Syne',sans-serif", fontSize: "16px",
                fontWeight: 800, color: "#0f172a", marginBottom: "8px"
              }}>
                Delete "{deleteTarget.name}"?
              </h3>
              <p style={{
                fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
                color: "#64748b", lineHeight: 1.6, marginBottom: "20px"
              }}>
                The counter device will lose access. Historical feedback data is preserved.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 10,
                    border: "1.5px solid #e2e8f0", background: "transparent",
                    fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
                    fontWeight: 600, color: "#64748b", cursor: "pointer"
                  }}>Cancel</button>
                <button onClick={handleDelete}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 10, border: "none",
                    background: "#ef4444", fontFamily: "'DM Sans',sans-serif",
                    fontSize: "13px", fontWeight: 700, color: "#ffffff", cursor: "pointer"
                  }}>
                  Delete Counter
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </AdminLayout>
  );
}