import { Head } from '@inertiajs/react';

export default function LandingPage() {
    return (
        <>
            <Head title="Home" />
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        Welcome to Feedback System
                    </h1>
                    <p className="text-xl text-gray-600 mb-8">
                        Collect and manage customer feedback efficiently
                    </p>
                    <div className="space-x-4">
                        <a
                            href="/counter/setup"
                            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                        >
                            Start Feedback
                        </a>
                        <a
                            href="/admin/dashboard"
                            className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                        >
                            Admin Dashboard
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
}
