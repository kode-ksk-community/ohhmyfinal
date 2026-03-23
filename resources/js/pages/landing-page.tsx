import { Head } from '@inertiajs/react';

export default function LandingPage() {
    return (
        <>
            <Head title="Home" />
            <div className="min-h-screen bg-[#f8f1e8] flex items-center justify-center p-6">
                <div
                    className="max-w-4xl w-full bg-white/95 backdrop-blur-lg rounded-3xl border border-[#e5d5c3] shadow-[0_30px_90px_rgba(90,62,37,0.15)] p-10"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                    <div className="grid gap-8 md:grid-cols-2">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-[#a07a52] font-semibold">
                                feedback dashboard
                            </p>
                            <h1 className="text-4xl sm:text-5xl font-black text-[#3d2c1e] leading-tight mt-3">
                                “Customer voice, now on display.”
                            </h1>
                            <p className="mt-4 text-[#6b5d4d] text-lg leading-relaxed">
                                Centralized counter, servicer activation, and gratitude capture in one polished experience.
                            </p>
                        </div>
                        <div className="flex flex-col items-start justify-center gap-3">
                            <a
                                href="/counter/setup"
                                className="w-full text-center px-6 py-3 bg-[#b98951] text-white rounded-xl font-semibold shadow-md hover:bg-[#a5743f] transition"
                            >
                                Start Counter Setup
                            </a>
                            <a
                                href="/admin/dashboard"
                                className="w-full text-center px-6 py-3 bg-[#533d2c] text-white rounded-xl font-semibold shadow-md hover:bg-[#402f23] transition"
                            >
                                Open Admin Panel
                            </a>
                            <a
                                href="/counter/idle"
                                className="w-full text-center px-6 py-3 border-2 border-[#d7b98d] text-[#5a4634] rounded-xl font-semibold hover:bg-[#fff6eb] transition"
                            >
                                View Counter Mode
                            </a>
                        </div>
                    </div>
                    <p className="mt-6 text-sm text-[#9e8563]">Touch the QR code when you're ready to onboard the next servicer.</p>
                </div>
            </div>
        </>
    );
}
