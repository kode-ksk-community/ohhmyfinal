/**
* AdminUsers.tsx
*
* Admin page to manage all users across all roles.
* (Super Admin, Admin, Branch Manager, Servicer)
*
* Route:    GET /admin/users
* File:     resources/js/Pages/Admin/Users.tsx
*
* Features:
*   - Table with search + role filter + branch filter
*   - Slide-in drawer for Create / Edit
*   - Role badge with color
*   - Active / Inactive toggle
*   - QR token status for servicers (generate / revoke)
*   - Password reset button
*
 * ✅ DYNAMIC MODE: Fully integrated with Laravel backend via Inertia.js
*/

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, router } from "@inertiajs/react";
import toast, { Toaster } from "react-hot-toast";
import AdminLayout from "../Layouts/AdminLayout";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "super_admin" | "admin" | "branch_manager" | "servicer";

interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  branch_id: number | null;
  branch_name: string | null;
  is_active: boolean;
  has_qr_token: boolean;
  feedback_count: number;
  last_active: string | null;
  created_at: string;
}

interface Branch { id: number; name: string; }

// ─── Props from Inertia ───────────────────────────────────────────────────────

interface Props {
  users: User[];
  branches: Branch[];
}

// ─── Role Configuration ───────────────────────────────────────────────────────

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string }> = {
  super_admin: {
    label: "Super Admin",
    color: "#dc2626",
    bg: "#fee2e2",
  },
  admin: {
    label: "Admin",
    color: "#2563eb",
    bg: "#dbeafe",
  },
  branch_manager: {
    label: "Branch Manager",
    color: "#9333ea",
    bg: "#f3e8ff",
  },
  servicer: {
    label: "Servicer",
    color: "#16a34a",
    bg: "#f0fdf4",
  },
};

// ─── Drawer ───────────────────────────────────────────────────────────────────

function UserDrawer({ user, branches, onClose, onSave }: {
  user: Partial<User> | null;
  branches: Branch[];
  onClose: () => void;
  onSave: (data: Partial<User>) => void;
}) {
  const isEdit = !!user?.id;
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "servicer" as Role,
    branch_id: user?.branch_id ?? null as number | null,
    is_active: user?.is_active ?? true,
    password: "",
  });
  const [saving, setSaving] = useState(false);

  const needsBranch = ["branch_manager", "servicer"].includes(form.role);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.email.trim()) { toast.error("Email is required"); return; }
    if (!isEdit && !form.password) { toast.error("Password is required for new users"); return; }
    if (needsBranch && !form.branch_id) { toast.error("Branch is required for this role"); return; }
    setSaving(true);
    try {
      if (isEdit && user?.id) {
        router.put(route('admin.users.update', user.id), form, {
          onSuccess: () => {
            toast.success("User updated!");
            onClose();
            window.location.reload();
          },
          onError: (errors) => {
            toast.error("Failed to update user");
            console.error(errors);
          }
        });
      } else {
        router.post(route('admin.users.store'), form, {
          onSuccess: () => {
            toast.success("User created!");
            onClose();
            window.location.reload();
          },
          onError: (errors) => {
            toast.error("Failed to create user");
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
        style={{ width: 440, background: "#ffffff", boxShadow: "-8px 0 40px rgba(15,23,42,0.12)" }}>

        <div className="flex items-center justify-between px-7 py-5"
          style={{ borderBottom: "1px solid #f1f5f9" }}>
          <div>
            <h2 style={{
              fontFamily: "'Syne',sans-serif", fontSize: "17px",
              fontWeight: 800, color: "#0f172a", marginBottom: "2px"
            }}>
              {isEdit ? "Edit User" : "New User"}
            </h2>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "#94a3b8" }}>
              {isEdit ? `Editing: ${user?.name}` : "Create a new staff account"}
            </p>
          </div>
          <button onClick={onClose}
            style={{
              background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
              width: 32, height: 32, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "16px"
            }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 flex flex-col gap-5">

          {/* Name + Email */}
          {[
            { key: "name", label: "Full Name *", placeholder: "e.g. Sophea Chan", type: "text" },
            { key: "email", label: "Email Address *", placeholder: "staff@company.com", type: "email" },
          ].map(f => (
            <div key={f.key}>
              <label style={{
                fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
                fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px"
              }}>{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 12,
                  border: "1.5px solid #e2e8f0", background: "#fafbfc",
                  fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
                  color: "#0f172a", outline: "none", transition: "border-color .2s"
                }}
                onFocus={e => (e.target.style.borderColor = "#0f172a")}
                onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
              />
            </div>
          ))}

          {/* Password */}
          <div>
            <label style={{
              fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
              fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px"
            }}>
              {isEdit ? "New Password (leave blank to keep)" : "Password *"}
            </label>
            <input type="password" value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Min. 8 characters"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 12,
                border: "1.5px solid #e2e8f0", background: "#fafbfc",
                fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
                color: "#0f172a", outline: "none"
              }}
              onFocus={e => (e.target.style.borderColor = "#0f172a")}
              onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>

          {/* Role selector */}
          <div>
            <label style={{
              fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
              fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px"
            }}>
              Role *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, cfg]) => (
                <button key={role} onClick={() => setForm(p => ({ ...p, role }))}
                  style={{
                    padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                    border: `1.5px solid ${form.role === role ? cfg.color : "#e2e8f0"}`,
                    background: form.role === role ? cfg.bg : "transparent",
                    display: "flex", alignItems: "center", gap: 8
                  }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: cfg.color }} />
                  <span style={{
                    fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
                    fontWeight: form.role === role ? 600 : 400,
                    color: form.role === role ? cfg.color : "#64748b"
                  }}>
                    {cfg.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Branch (conditional) */}
          <AnimatePresence>
            {needsBranch && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}>
                <label style={{
                  fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
                  fontWeight: 600, color: "#374151", display: "block", marginBottom: "7px"
                }}>
                  Branch *
                </label>
                <select value={form.branch_id ?? ""}
                  onChange={e => setForm(p => ({ ...p, branch_id: e.target.value ? Number(e.target.value) : null }))}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: 12,
                    border: "1.5px solid #e2e8f0", background: "#fafbfc",
                    fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
                    color: "#0f172a", outline: "none", cursor: "pointer"
                  }}>
                  <option value="">Select branch...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl"
            style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
            <div>
              <p style={{
                fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
                fontWeight: 600, color: "#374151", marginBottom: "2px"
              }}>Active Account</p>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "12px", color: "#94a3b8" }}>
                Inactive accounts cannot log in
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
                  borderRadius: "50%", background: "#ffffff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.15)"
                }} />
            </button>
          </div>
        </div>

        <div className="px-7 py-5 flex gap-3" style={{ borderTop: "1px solid #f1f5f9" }}>
          <button onClick={onClose}
            style={{
              flex: 1, padding: "11px", borderRadius: 12,
              border: "1.5px solid #e2e8f0", background: "transparent",
              fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
              fontWeight: 600, color: "#64748b", cursor: "pointer"
            }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{
              flex: 2, padding: "11px", borderRadius: 12, border: "none",
              background: saving ? "#d1d5db" : "#0f172a",
              fontFamily: "'Syne',sans-serif", fontSize: "13px", fontWeight: 700,
              color: "#ffffff", cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}>
            {saving
              ? <><div style={{
                width: 14, height: 14, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff",
                animation: "spin .7s linear infinite"
              }} /> Saving...</>
              : isEdit ? "Save Changes" : "Create User"}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({ user, onClose, onConfirm }: {
  user: User; onClose: () => void; onConfirm: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative max-w-md w-full"
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            background: "#ffffff", borderRadius: 20, overflow: "hidden",
            boxShadow: "0 20px 40px rgba(15,23,42,0.15)"
          }}>
            <div className="p-7">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
                  style={{ background: "#fef2f2", color: "#dc2626" }}>⚠️</div>
                <div>
                  <h3 style={{
                    fontFamily: "'Syne',sans-serif", fontSize: "17px",
                    fontWeight: 800, color: "#0f172a", marginBottom: "4px"
                  }}>Delete User</h3>
                  <p style={{
                    fontFamily: "'DM Sans',sans-serif", fontSize: "14px", color: "#64748b"
                  }}>Delete "{user.name}"?</p>
                </div>
              </div>
              <p style={{
                fontFamily: "'DM Sans',sans-serif", fontSize: "13px", color: "#64748b",
                lineHeight: 1.5, marginBottom: "24px"
              }}>
                This will soft-delete the user. Historical feedback data will be preserved.
                The user will no longer be able to log in.
              </p>
            </div>
            <div className="px-7 py-5 flex gap-3" style={{ borderTop: "1px solid #f1f5f9" }}>
              <button onClick={onClose}
                style={{
                  flex: 1, padding: "11px", borderRadius: 12,
                  border: "1.5px solid #e2e8f0", background: "transparent",
                  fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
                  fontWeight: 600, color: "#64748b", cursor: "pointer"
                }}>Cancel</button>
              <button onClick={() => { setDeleting(true); onConfirm(); }} disabled={deleting}
                style={{
                  flex: 1, padding: "11px", borderRadius: 12, border: "none",
                  background: deleting ? "#d1d5db" : "#dc2626",
                  fontFamily: "'Syne',sans-serif", fontSize: "13px", fontWeight: 700,
                  color: "#ffffff", cursor: deleting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                }}>
                {deleting
                  ? <><div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff",
                    animation: "spin .7s linear infinite"
                  }} /> Deleting...</>
                  : "Delete User"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsers({ users: initialUsers, branches }: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "all">("all");
  const [filterBranch, setFilterBranch] = useState<number | "all">("all");
  const [drawer, setDrawer] = useState<Partial<User> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const filtered = useMemo(() => users
    .filter(u => u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()))
    .filter(u => filterRole === "all" ? true : u.role === filterRole)
    .filter(u => filterBranch === "all" ? true : u.branch_id === filterBranch),
    [users, search, filterRole, filterBranch]);

  const handleSave = (data: Partial<User>) => {
    // API calls are handled in UserDrawer component
    setDrawer(null);
  };

  const handleToggleActive = (user: User) => {
    router.patch(route('admin.users.toggle', user.id), {}, {
      onSuccess: () => {
        window.location.reload();
        toast.success(`${user.name} ${!user.is_active ? "activated" : "deactivated"}`);
      },
      onError: () => {
        toast.error("Failed to update user status");
      }
    });
  };

  const handleGenerateQR = (user: User) => {
    router.post(route('admin.users.generate-qr', user.id), {}, {
      onSuccess: () => {
        window.location.reload();
        toast.success(`QR token generated for ${user.name}`);
      },
      onError: () => {
        toast.error("Failed to generate QR token");
      }
    });
  };

  const handleResetPassword = (user: User) => {
    router.post(route('admin.users.reset-password', user.id), {}, {
      onSuccess: () => {
        toast.success(`Password reset email sent to ${user.email}`);
      },
      onError: () => {
        toast.error("Failed to send password reset email");
      }
    });
  };

  return (
    <AdminLayout title="Users" active="users">
      <Toaster position="top-right" toastOptions={{
        style: { fontFamily: "'DM Sans',sans-serif", borderRadius: "12px", fontSize: "13px" },
      }} />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#94a3b8" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
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
          <select value={filterRole} onChange={e => setFilterRole(e.target.value as Role | "all")}
            style={{
              padding: "8px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0",
              background: "#ffffff", fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
              color: "#374151", outline: "none", cursor: "pointer"
            }}>
            <option value="all">All Roles</option>
            {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
              <option key={role} value={role}>{cfg.label}</option>
            ))}
          </select>
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
          + New User
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
              {["User", "Role", "Branch", "Status", "Last Active", "Actions"].map(h => (
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
                <tr><td colSpan={6} style={{
                  padding: "48px", textAlign: "center",
                  fontFamily: "'DM Sans',sans-serif", fontSize: "14px", color: "#94a3b8"
                }}>
                  No users found
                </td></tr>
              ) : filtered.map((user, i) => {
                const roleConf = ROLE_CONFIG[user.role];
                return (
                  <motion.tr key={user.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.04 }}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafbfc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* User */}
                    <td style={{ padding: "14px 16px" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: `linear-gradient(135deg,${roleConf.color}cc,${roleConf.color})` }}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p style={{
                            fontFamily: "'Syne',sans-serif", fontSize: "13px",
                            fontWeight: 700, color: "#0f172a"
                          }}>{user.name}</p>
                          <p style={{
                            fontFamily: "'DM Mono',monospace", fontSize: "10px",
                            color: "#94a3b8"
                          }}>{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "4px 10px", borderRadius: 100,
                        background: roleConf.bg,
                        fontFamily: "'DM Sans',sans-serif", fontSize: "11px",
                        fontWeight: 600, color: roleConf.color
                      }}>
                        <div className="w-1.5 h-1.5 rounded-full"
                          style={{ background: roleConf.color, flexShrink: 0 }} />
                        {roleConf.label}
                      </span>
                    </td>

                    {/* Branch */}
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
                        color: "#64748b"
                      }}>
                        {user.branch_name ?? <span style={{ color: "#cbd5e1" }}>Global</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "14px 16px" }}>
                      <button onClick={() => handleToggleActive(user)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{
                          background: user.is_active ? "#f0fdf4" : "#fef2f2",
                          border: `1px solid ${user.is_active ? "#bbf7d0" : "#fecaca"}`,
                          cursor: "pointer"
                        }}>
                        <div className="w-1.5 h-1.5 rounded-full"
                          style={{ background: user.is_active ? "#22c55e" : "#ef4444" }} />
                        <span style={{
                          fontFamily: "'DM Sans',sans-serif", fontSize: "11px",
                          fontWeight: 600, color: user.is_active ? "#16a34a" : "#dc2626"
                        }}>
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>

                    {/* Last active */}
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#94a3b8" }}>
                        {user.last_active ?? "Never"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "14px 16px" }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={route('admin.users.show', user.id)}
                          style={{
                            padding: "6px 12px", borderRadius: 8,
                            border: "1px solid #e2e8f0", background: "transparent",
                            fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
                            color: "#374151", cursor: "pointer", textDecoration: 'none'
                          }}
                        >
                          View
                        </Link>
                        <button onClick={() => setDrawer(user)}
                          style={{
                            padding: "6px 12px", borderRadius: 8,
                            border: "1px solid #e2e8f0", background: "transparent",
                            fontFamily: "'DM Sans',sans-serif", fontSize: "12px",
                            color: "#374151", cursor: "pointer"
                          }}>Edit</button>
                        {/* <button onClick={() => handleResetPassword(user)}
                          style={{
                            padding: "6px 10px", borderRadius: 8,
                            border: "1px solid #e2e8f0", background: "transparent",
                            fontSize: "12px", color: "#64748b", cursor: "pointer"
                          }}>🔑</button> */}
                        {/* {user.role === "servicer" && (
                          <button onClick={() => handleGenerateQR(user)}
                            style={{
                              padding: "6px 10px", borderRadius: 8,
                              border: `1px solid ${user.has_qr_token ? "#bbf7d0" : "#e2e8f0"}`,
                              background: user.has_qr_token ? "#f0fdf4" : "transparent",
                              fontSize: "12px", color: user.has_qr_token ? "#16a34a" : "#64748b",
                              cursor: "pointer", fontFamily: "'DM Mono',monospace"
                            }}>
                            {user.has_qr_token ? "📱 QR" : "+ QR"}
                          </button>
                        )} */}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        <div className="px-6 py-3" style={{ borderTop: "1px solid #f1f5f9", background: "#fafbfc" }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#94a3b8" }}>
            Showing {filtered.length} of {users.length} users
          </span>
        </div>
      </div>

      <AnimatePresence>
        {drawer !== null && (
          <UserDrawer user={drawer} branches={branches}
            onClose={() => setDrawer(null)} onSave={handleSave} />
        )}
      </AnimatePresence>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </AdminLayout>
  );
}