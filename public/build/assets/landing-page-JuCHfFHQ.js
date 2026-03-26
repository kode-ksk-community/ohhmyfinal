import{K as n,j as e,L as o,$ as i}from"./app-Cq4XtoOn.js";function d(){var r,a;const t=n().props;return e.jsxs(e.Fragment,{children:[e.jsx(o,{title:"FeedbackPro"}),e.jsx("style",{children:`
                @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                html, body { height: 100%; -webkit-font-smoothing: antialiased; }

                .root {
                    min-height: 100vh;
                    background-color: #faf4ec;
                    font-family: 'DM Sans', sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    padding: 24px;
                }

                /* Atmospheric layers */
                .root::before {
                    content: '';
                    position: fixed; inset: 0; pointer-events: none;
                    background:
                        radial-gradient(ellipse 65% 55% at 12% 8%,  rgba(185,137,81,0.10) 0%, transparent 60%),
                        radial-gradient(ellipse 50% 45% at 88% 88%, rgba(185,137,81,0.07) 0%, transparent 60%);
                }
                .root::after {
                    content: '';
                    position: fixed; inset: 0; pointer-events: none; opacity: 0.018;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");
                }

                /* Card */
                .card {
                    position: relative; z-index: 1;
                    background: rgba(255,255,255,0.82);
                    border: 1.5px solid rgba(185,137,81,0.18);
                    border-radius: 24px;
                    box-shadow:
                        0 2px 4px   rgba(90,62,37,0.04),
                        0 8px 24px  rgba(90,62,37,0.08),
                        0 24px 48px rgba(90,62,37,0.05);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    padding: 48px 44px 40px;
                    width: 100%;
                    max-width: 420px;
                    text-align: center;
                    animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
                }

                /* Badge */
                .badge {
                    display: inline-flex; align-items: center; gap: 7px;
                    padding: 5px 14px; border-radius: 100px;
                    background: rgba(185,137,81,0.10);
                    border: 1px solid rgba(185,137,81,0.22);
                    margin-bottom: 24px;
                    animation: fadeUp 0.6s 0.05s cubic-bezier(0.22,1,0.36,1) both;
                }
                .badge-dot {
                    width: 6px; height: 6px; border-radius: 50%;
                    background: #b98951;
                    animation: breathe 2.2s ease-in-out infinite;
                }
                .badge-text {
                    font-family: 'DM Mono', monospace;
                    font-size: 10px; font-weight: 500;
                    color: #8f5f35; letter-spacing: 0.10em; text-transform: uppercase;
                }

                /* Title */
                .title {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: clamp(36px, 6vw, 48px);
                    font-weight: 700;
                    color: #2c1f12;
                    letter-spacing: -0.02em;
                    line-height: 1.08;
                    margin-bottom: 12px;
                    animation: fadeUp 0.6s 0.10s cubic-bezier(0.22,1,0.36,1) both;
                }
                .title em { font-style: italic; color: #b48c64; }

                /* Subtitle */
                .subtitle {
                    font-size: 14px; font-weight: 400;
                    color: #9e7a52; line-height: 1.6;
                    max-width: 320px; margin: 0 auto 36px;
                    animation: fadeUp 0.6s 0.15s cubic-bezier(0.22,1,0.36,1) both;
                }

                /* Divider */
                .divider {
                    width: 100%; height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(185,137,81,0.18), transparent);
                    margin-bottom: 28px;
                    animation: fadeUp 0.6s 0.18s cubic-bezier(0.22,1,0.36,1) both;
                }

                /* Buttons */
                .btn-group {
                    display: flex; flex-direction: column; gap: 10px;
                    animation: fadeUp 0.6s 0.22s cubic-bezier(0.22,1,0.36,1) both;
                }

                .btn {
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    width: 100%; padding: 13px 24px; border-radius: 14px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 14px; font-weight: 600;
                    text-decoration: none; cursor: pointer;
                    border: none; letter-spacing: 0.01em;
                    transition: transform 0.18s cubic-bezier(0.22,1,0.36,1),
                                box-shadow 0.22s ease,
                                background 0.18s ease;
                }

                .btn-primary {
                    background: #3d2c1e;
                    color: #fdf6ec;
                }
                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(61,44,30,0.20);
                }
                .btn-primary:active { transform: translateY(0); }

                .btn-secondary {
                    background: rgba(185,137,81,0.10);
                    color: #6b4c2f;
                    border: 1.5px solid rgba(185,137,81,0.22);
                }
                .btn-secondary:hover {
                    background: rgba(185,137,81,0.16);
                    transform: translateY(-1px);
                }

                .btn-ghost {
                    background: transparent;
                    color: #9e7a52;
                    font-weight: 400;
                    font-size: 13px;
                }
                .btn-ghost:hover { color: #6b4c2f; }

                /* Arrow icon */
                .btn-arrow {
                    width: 14px; height: 14px;
                    opacity: 0.7; flex-shrink: 0;
                }

                /* Footer hint */
                .footer-hint {
                    margin-top: 24px; position: relative; z-index: 1;
                    font-family: 'DM Mono', monospace;
                    font-size: 10.5px; color: rgba(185,137,81,0.45);
                    letter-spacing: 0.04em; text-align: center;
                    animation: fadeUp 0.6s 0.35s cubic-bezier(0.22,1,0.36,1) both;
                }

                /* Animations */
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes breathe {
                    0%, 100% { opacity: 0.9; transform: scale(1); }
                    50%       { opacity: 0.45; transform: scale(0.88); }
                }
            `}),e.jsxs("div",{className:"root",children:[e.jsxs("div",{className:"card",children:[e.jsxs("div",{className:"badge",children:[e.jsx("span",{className:"badge-dot"}),e.jsx("span",{className:"badge-text",children:"Feedback Intelligence"})]}),e.jsxs("h1",{className:"title",children:["Feedback",e.jsx("br",{}),e.jsx("em",{children:"Pro"})]}),e.jsx("p",{className:"subtitle",children:"Capture customer voices, activate servicers, and turn every interaction into insight."}),e.jsx("div",{className:"divider"}),e.jsxs("div",{className:"btn-group",children:[((a=(r=t==null?void 0:t.auth)==null?void 0:r.user)==null?void 0:a.role)!=="servicer"?e.jsxs(i,{href:"/counter/setup",className:"btn btn-primary",children:["Set Up a Counter",e.jsx("svg",{className:"btn-arrow",viewBox:"0 0 14 14",fill:"none",children:e.jsx("path",{d:"M2 7h10M8 3l4 4-4 4",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})]}):null,e.jsxs(i,{href:route("dashboard"),className:"btn btn-secondary",children:["Open Admin Panel",e.jsx("svg",{className:"btn-arrow",viewBox:"0 0 14 14",fill:"none",children:e.jsx("path",{d:"M2 7h10M8 3l4 4-4 4",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})]})]})]}),e.jsx("p",{className:"footer-hint",children:"This device will remember its counter after setup"})]})]})}export{d as default};
