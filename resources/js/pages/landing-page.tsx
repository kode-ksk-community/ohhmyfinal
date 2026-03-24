import { Head } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

export default function LandingPage() {
    const heroRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const hero = heroRef.current;
        if (!hero) return;

        const handleMouseMove = (e: MouseEvent) => {
            const { left, top, width, height } = hero.getBoundingClientRect();
            const x = ((e.clientX - left) / width - 0.5) * 20;
            const y = ((e.clientY - top) / height - 0.5) * 20;
            hero.style.setProperty('--mouse-x', `${x}px`);
            hero.style.setProperty('--mouse-y', `${y}px`);
        };

        hero.addEventListener('mousemove', handleMouseMove);
        return () => hero.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <>
            <Head title="Feedback Dashboard" />

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:wght@300;400;500&display=swap');

                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                :root {
                    --ink: #1a0f0a;
                    --cream: #fdf6ee;
                    --warm: #f5e8d4;
                    --gold: #c49a4a;
                    --rust: #9c4a2e;
                    --sienna: #6b3a22;
                    --mouse-x: 0px;
                    --mouse-y: 0px;
                }

                html, body { height: 100%; }

                .root-wrap {
                    min-height: 100vh;
                    background-color: var(--cream);
                    background-image:
                        radial-gradient(ellipse 80% 60% at 70% 10%, rgba(196,154,74,0.18) 0%, transparent 65%),
                        radial-gradient(ellipse 60% 70% at 10% 90%, rgba(156,74,46,0.12) 0%, transparent 60%),
                        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
                    font-family: 'DM Sans', sans-serif;
                    display: flex;
                    flex-direction: column;
                    overflow-x: hidden;
                }

                nav {
                    position: fixed;
                    top: 0; left: 0; right: 0;
                    z-index: 100;
                    padding: 20px 48px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: linear-gradient(to bottom, rgba(253,246,238,0.9) 0%, transparent 100%);
                    backdrop-filter: blur(4px);
                }

                .nav-logo {
                    font-family: 'Playfair Display', serif;
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--ink);
                    letter-spacing: 0.01em;
                }

                .nav-logo span { color: var(--gold); }

                .nav-badge {
                    font-size: 0.68rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.14em;
                    color: var(--sienna);
                    background: rgba(196,154,74,0.12);
                    border: 1px solid rgba(196,154,74,0.3);
                    border-radius: 100px;
                    padding: 5px 14px;
                }

                .hero {
                    flex: 1;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    min-height: 100vh;
                    padding-top: 80px;
                }

                @media (max-width: 768px) {
                    .hero { grid-template-columns: 1fr; }
                    nav { padding: 16px 24px; }
                    .hero-left { padding: 60px 24px 40px; }
                    .hero-right { padding: 40px 24px 80px; }
                    .big-number { font-size: 7rem !important; }
                    h1 { font-size: 2.6rem !important; }
                    .cards-grid { grid-template-columns: 1fr !important; }
                }

                .hero-left {
                    padding: 80px 48px 80px 72px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    position: relative;
                    transform: translate(calc(var(--mouse-x) * 0.3), calc(var(--mouse-y) * 0.3));
                    transition: transform 0.4s ease;
                }

                .eyebrow {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 28px;
                    animation: fadeUp 0.7s ease both;
                }

                .eyebrow-line {
                    width: 32px; height: 1.5px;
                    background: var(--gold);
                }

                .eyebrow-text {
                    font-size: 0.7rem;
                    font-weight: 500;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: var(--gold);
                }

                h1 {
                    font-family: 'Playfair Display', serif;
                    font-size: clamp(2.8rem, 5vw, 4.2rem);
                    font-weight: 900;
                    line-height: 1.05;
                    color: var(--ink);
                    animation: fadeUp 0.7s 0.1s ease both;
                }

                h1 em {
                    font-style: italic;
                    color: var(--rust);
                }

                .sub {
                    margin-top: 24px;
                    font-size: 1.05rem;
                    line-height: 1.75;
                    color: #6b5a4a;
                    font-weight: 300;
                    max-width: 420px;
                    animation: fadeUp 0.7s 0.2s ease both;
                }

                .cta-group {
                    margin-top: 48px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    max-width: 320px;
                    animation: fadeUp 0.7s 0.3s ease both;
                }

                .btn {
                    display: block;
                    width: 100%;
                    text-align: center;
                    padding: 15px 28px;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    letter-spacing: 0.04em;
                    text-decoration: none;
                    transition: all 0.22s ease;
                    position: relative;
                    overflow: hidden;
                    font-family: 'DM Sans', sans-serif;
                }

                .btn::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent);
                    transform: translateX(-100%);
                    transition: transform 0.5s ease;
                }

                .btn:hover::after { transform: translateX(100%); }

                .btn-primary {
                    background: linear-gradient(135deg, var(--rust) 0%, #7a3520 100%);
                    color: #fff;
                    box-shadow: 0 8px 28px rgba(156,74,46,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 14px 36px rgba(156,74,46,0.4);
                }

                .btn-gold {
                    background: linear-gradient(135deg, var(--gold) 0%, #a87e32 100%);
                    color: #fff;
                    box-shadow: 0 8px 28px rgba(196,154,74,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
                }

                .btn-gold:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 14px 36px rgba(196,154,74,0.38);
                }

                .btn-outline {
                    background: transparent;
                    color: var(--sienna);
                    border: 1.5px solid rgba(107,58,34,0.3);
                }

                .btn-outline:hover {
                    background: rgba(107,58,34,0.05);
                    border-color: var(--sienna);
                    transform: translateY(-1px);
                }

                .hint {
                    margin-top: 20px;
                    font-size: 0.75rem;
                    color: #a08060;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .hint-dot {
                    width: 5px; height: 5px;
                    border-radius: 50%;
                    background: var(--gold);
                    flex-shrink: 0;
                }

                .hero-right {
                    background: linear-gradient(160deg, #2a1a10 0%, #1a0f0a 100%);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: 80px 56px;
                    position: relative;
                    overflow: hidden;
                }

                .hero-right::before {
                    content: '';
                    position: absolute;
                    top: -80px; right: -80px;
                    width: 320px; height: 320px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(196,154,74,0.2) 0%, transparent 70%);
                    animation: pulse 6s ease-in-out infinite;
                }

                .hero-right::after {
                    content: '';
                    position: absolute;
                    bottom: -60px; left: -60px;
                    width: 240px; height: 240px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(156,74,46,0.2) 0%, transparent 70%);
                    animation: pulse 8s 2s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.15); opacity: 0.7; }
                }

                .panel-label {
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    letter-spacing: 0.22em;
                    color: rgba(196,154,74,0.6);
                    font-weight: 500;
                    margin-bottom: 36px;
                    animation: fadeUp 0.7s 0.4s ease both;
                }

                .big-number {
                    font-family: 'Playfair Display', serif;
                    font-size: clamp(5rem, 10vw, 9rem);
                    font-weight: 900;
                    line-height: 1;
                    color: transparent;
                    background: linear-gradient(135deg, var(--gold) 0%, rgba(196,154,74,0.4) 100%);
                    -webkit-background-clip: text;
                    background-clip: text;
                    animation: fadeUp 0.7s 0.45s ease both;
                }

                .big-number-sub {
                    font-size: 0.8rem;
                    font-weight: 400;
                    color: rgba(255,255,255,0.35);
                    letter-spacing: 0.08em;
                    margin-top: 4px;
                    margin-bottom: 40px;
                    animation: fadeUp 0.7s 0.5s ease both;
                }

                .cards-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    position: relative;
                    z-index: 1;
                    animation: fadeUp 0.7s 0.55s ease both;
                }

                .stat-card {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 12px;
                    padding: 18px;
                    transition: background 0.2s ease;
                }

                .stat-card:hover { background: rgba(255,255,255,0.07); }

                .stat-icon { font-size: 1.1rem; margin-bottom: 10px; display: block; }

                .stat-value {
                    font-family: 'Playfair Display', serif;
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: #fff;
                }

                .stat-label {
                    font-size: 0.7rem;
                    color: rgba(255,255,255,0.35);
                    letter-spacing: 0.08em;
                    margin-top: 2px;
                }

                .divider-card {
                    grid-column: 1 / -1;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: rgba(196,154,74,0.08);
                    border: 1px solid rgba(196,154,74,0.2);
                    border-radius: 12px;
                    padding: 14px 18px;
                }

                .divider-card-dot {
                    width: 8px; height: 8px;
                    border-radius: 50%;
                    background: var(--gold);
                    flex-shrink: 0;
                    box-shadow: 0 0 10px rgba(196,154,74,0.7);
                    animation: blink 2s ease-in-out infinite;
                }

                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }

                .divider-card-text {
                    font-size: 0.75rem;
                    color: rgba(255,255,255,0.5);
                    line-height: 1.5;
                }

                .footer-strip {
                    position: fixed;
                    bottom: 0; left: 0; right: 0;
                    padding: 14px 48px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: linear-gradient(to top, rgba(253,246,238,0.95) 0%, transparent 100%);
                    z-index: 50;
                }

                .footer-copy {
                    font-size: 0.7rem;
                    color: #b09070;
                    letter-spacing: 0.05em;
                }

                .footer-status {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    font-size: 0.7rem;
                    color: #7a6a5a;
                }

                .status-dot {
                    width: 6px; height: 6px;
                    border-radius: 50%;
                    background: #5ca86a;
                    box-shadow: 0 0 8px rgba(92,168,106,0.7);
                    animation: blink 2.5s ease-in-out infinite;
                }

                .deco-ring {
                    position: absolute;
                    border-radius: 50%;
                    border: 1px solid;
                    pointer-events: none;
                }

                .deco-1 {
                    width: 360px; height: 360px;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    border-color: rgba(196,154,74,0.07);
                    animation: spin 40s linear infinite;
                }

                .deco-2 {
                    width: 240px; height: 240px;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    border-color: rgba(156,74,46,0.08);
                    animation: spin 30s linear infinite reverse;
                }

                @keyframes spin { to { transform: translate(-50%, -50%) rotate(360deg); } }

                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(22px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div className="root-wrap" ref={heroRef}>
                <nav>
                    <div className="nav-logo">Voca<span>Loop</span></div>
                    <div className="nav-badge">Feedback Dashboard</div>
                </nav>

                <main className="hero">
                    {/* LEFT */}
                    <div className="hero-left">
                        <div className="deco-1 deco-ring" />
                        <div className="deco-2 deco-ring" />

                        <div className="eyebrow">
                            <span className="eyebrow-line" />
                            <span className="eyebrow-text">Customer Voice Platform</span>
                        </div>

                        <h1>
                            Every voice<br />
                            <em>heard,</em> every<br />
                            insight counted.
                        </h1>

                        <p className="sub">
                            One elegant system to capture feedback, activate servicers, and turn customer gratitude into actionable intelligence.
                        </p>

                        <div className="cta-group">
                            <a href="/counter/setup" className="btn btn-primary">
                                Start Counter Setup →
                            </a>
                            <a href="/admin/dashboard" className="btn btn-gold">
                                Open Admin Panel →
                            </a>
                            <a href="/counter/idle" className="btn btn-outline">
                                View Counter Mode
                            </a>
                        </div>

                        <div className="hint">
                            <span className="hint-dot" />
                            Touch the QR code when ready to onboard the next servicer.
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div className="hero-right">
                        <p className="panel-label">Live overview</p>
                        <div className="big-number">98.4<span style={{ fontSize: '0.4em', verticalAlign: 'super' }}>%</span></div>
                        <p className="big-number-sub">Satisfaction rate — this quarter</p>

                        <div className="cards-grid">
                            <div className="stat-card">
                                <span className="stat-icon">📋</span>
                                <div className="stat-value">2,847</div>
                                <div className="stat-label">Responses logged</div>
                            </div>
                            <div className="stat-card">
                                <span className="stat-icon">👥</span>
                                <div className="stat-value">34</div>
                                <div className="stat-label">Active servicers</div>
                            </div>
                            <div className="stat-card">
                                <span className="stat-icon">⭐</span>
                                <div className="stat-value">4.93</div>
                                <div className="stat-label">Avg. rating</div>
                            </div>
                            <div className="stat-card">
                                <span className="stat-icon">⚡</span>
                                <div className="stat-value">1.2s</div>
                                <div className="stat-label">Avg. response time</div>
                            </div>
                            <div className="divider-card">
                                <div className="divider-card-dot" />
                                <div className="divider-card-text">
                                    System online · Last sync 42 seconds ago
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <div className="footer-strip">
                    <span className="footer-copy">© 2025 VocaLoop · Feedback Intelligence</span>
                    <div className="footer-status">
                        <div className="status-dot" />
                        All systems operational
                    </div>
                </div>
            </div>
        </>
    );
}