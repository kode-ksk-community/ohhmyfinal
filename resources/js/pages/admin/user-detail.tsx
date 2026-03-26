import { useEffect, useMemo, useState } from "react";
import { Head, Link } from "@inertiajs/react";
import axios from "axios";
import AdminLayout from '@/layouts/app-layout';
import toast, { Toaster } from "react-hot-toast";

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

interface FeedbackItem {
    id: number;
    rating: number;
    sentiment_label: string | null;
    sentiment_score: number | null;
    comment: string | null;
    counter_name: string;
    branch_name: string;
    submitted_at: string;
}

type Period = "daily" | "weekly" | "monthly" | "yearly";

interface Props {
    user: User;
}

const PERIOD_LABELS: Record<Period, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
};

const RATING_EMOJI: Record<number, string> = {
    1: "😡",
    2: "😞",
    3: "😐",
    4: "😊",
    5: "😍",
};

const FIELD_CSS = {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#fff",
    fontFamily: "'DM Sans',sans-serif",
    fontSize: "13px",
};



export default function UserDetail({ user }: Props) {
    const [period, setPeriod] = useState<Period>("monthly");
    const [stats, setStats] = useState({
        total_feedbacks: 0,
        average_rating: 0,
        average_sentiment: 0,
        positive_percentage: 0,
        negative_percentage: 0,
    });
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(false);

    const [hasLoaded, setHasLoaded] = useState(false);

    const isServicer = user.role === "servicer";

    const loadServicerData = async () => {
        if (!isServicer) {
            return;
        }

        setLoading(true);

        const params = {
            period,
        };

        try {
            const res = await axios.get(`/admin/users/${user.id}/stats`, { params, withCredentials: true });
            const data = res.data;

            setStats({
                total_feedbacks: data.total_feedbacks ?? 0,
                average_rating: data.average_rating ?? 0,
                average_sentiment: data.average_sentiment ?? 0,
                positive_percentage: data.positive_percentage ?? 0,
                negative_percentage: data.negative_percentage ?? 0,
            });

            setFeedbacks(data.feedbacks || []);
            setHasLoaded(true);
        } catch (error: unknown) {
            console.error(error);
            const apiError = error as {
                response?: { data?: { message?: string; error?: string } };
                message?: string;
            };
            const errMsg = apiError.response?.data?.message || apiError.response?.data?.error || apiError.message || "Failed to load servicer statistics";
            toast.error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadServicerData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, user.id]);

    const feedbackTable = useMemo(() => {
        if (!feedbacks.length) {
            return <p style={{ color: "#64748b" }}>No feedback in this period.</p>;
        }

        return (
            <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                            {['Date', 'Rating', 'Sentiment', 'Comment', 'Counter', 'Branch'].map((h) => (
                                <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 12, color: '#64748b' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {feedbacks.map((fb) => (
                            <tr key={fb.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: 10, fontSize: 12 }}>{fb.submitted_at}</td>
                                <td style={{ padding: 10, fontSize: 12 }}>{RATING_EMOJI[fb.rating] || fb.rating}</td>
                                <td style={{ padding: 10, fontSize: 12 }}>{fb.sentiment_label || 'N/A'}</td>
                                <td style={{ padding: 10, fontSize: 12, maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={fb.comment || ''}>
                                    {fb.comment || '-'}
                                </td>
                                <td style={{ padding: 10, fontSize: 12 }}>{fb.counter_name}</td>
                                <td style={{ padding: 10, fontSize: 12 }}>{fb.branch_name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }, [feedbacks]);

    return (
        <AdminLayout title="User Detail" active="users">
            <Head title="User Detail" />
            <Toaster position="top-right" />

            <div className="flex justify-between items-center mb-5">
                <div>
                    <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>User Detail</h2>
                    <p style={{ color: "#475569", marginTop: 3 }}>
                        {user.name} ({user.role.replace('_', ' ')})
                    </p>
                </div>
                <Link
                    href={route('admin.users.index')}
                    style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        color: "#0f172a",
                        fontSize: 12,
                        textDecoration: "none",
                    }}
                >
                    ← Back to users
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div style={FIELD_CSS}>
                    <p style={{ fontWeight: 600 }}>Name</p>
                    <p>{user.name}</p>
                </div>
                <div style={FIELD_CSS}>
                    <p style={{ fontWeight: 600 }}>Email</p>
                    <p>{user.email}</p>
                </div>
                <div style={FIELD_CSS}>
                    <p style={{ fontWeight: 600 }}>Role</p>
                    <p>{user.role}</p>
                </div>
                <div style={FIELD_CSS}>
                    <p style={{ fontWeight: 600 }}>Branch</p>
                    <p>{user.branch_name ?? 'N/A'}</p>
                </div>
                <div style={FIELD_CSS}>
                    <p style={{ fontWeight: 600 }}>Active</p>
                    <p>{user.is_active ? 'Yes' : 'No'}</p>
                </div>
                <div style={FIELD_CSS}>
                    <p style={{ fontWeight: 600 }}>Feedback Count</p>
                    <p>{user.feedback_count}</p>
                </div>
            </div>

            {!isServicer && (
                <div style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
                    <h3 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700 }}>Servicer analytics not available</h3>
                    <p style={{ color: '#64748b' }}>This user is not a servicer. Switch to a servicer account to view feedback statistics.</p>
                </div>
            )}

            {isServicer && (
                <>
                    <div className="flex items-center gap-2 mb-4">
                        {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                style={{
                                    padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0',
                                    background: period === p ? '#0f172a' : '#fff', color: period === p ? '#fff' : '#0f172a',
                                    cursor: 'pointer', fontSize: 12,
                                }}
                            >
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                        <div style={{ ...FIELD_CSS, background: '#f8fafc' }}>
                            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Feedback in range</p>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>{stats.total_feedbacks}</p>
                        </div>
                        <div style={{ ...FIELD_CSS, background: '#f8fafc' }}>
                            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Avg Rating</p>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>{Number(stats.average_rating).toFixed(2)}</p>
                        </div>
                        <div style={{ ...FIELD_CSS, background: '#f8fafc' }}>
                            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Avg Sentiment</p>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>{Number(stats.average_sentiment).toFixed(3)}</p>
                        </div>
                        <div style={{ ...FIELD_CSS, background: '#f8fafc' }}>
                            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Positive %</p>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>{stats.positive_percentage}%</p>
                        </div>
                        <div style={{ ...FIELD_CSS, background: '#f8fafc' }}>
                            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Negative %</p>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>{stats.negative_percentage}%</p>
                        </div>
                    </div>

                    <section style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
                        <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Feedback records</h3>
                        {loading && <p>Loading feedback...</p>}
                        {!loading && hasLoaded && feedbackTable}
                        {!loading && !hasLoaded && <p>Initializing …</p>}
                    </section>
                </>
            )}
        </AdminLayout>
    );
}
