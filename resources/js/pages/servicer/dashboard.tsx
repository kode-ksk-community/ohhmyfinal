'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Clock, LogOut, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';

interface ActiveSession {
    id: number;
    counter_id: number;
    user_id: number;
    started_at: string;
    ended_at: string | null;
    counter: {
        id: number;
        label: string;
        branch_id: number;
        branch: {
            id: number;
            name: string;
            location: string;
        };
    };
}

export default function ServicerDashboard() {
    const [session, setSession] = useState<ActiveSession | null>(null);
    const [elapsedTime, setElapsedTime] = useState('');
    const [loading, setLoading] = useState(true);
    const [terminating, setTerminating] = useState(false);

    useEffect(() => {
        fetchSession();
    }, []);

    const fetchSession = async () => {
        try {
            const response = await axios.get('/api/servicer/active-session', {
                withCredentials: true, // Include session cookie with request
            });
            setSession(response.data.session);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch active session:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!session) return;

        const updateElapsedTime = () => {
            const startTime = new Date(session.started_at);
            const now = new Date();
            const elapsed = formatDistanceToNow(startTime, { addSuffix: false });
            setElapsedTime(elapsed);
        };

        updateElapsedTime();
        const interval = setInterval(updateElapsedTime, 1000);
        return () => clearInterval(interval);
    }, [session]);

    const handleTerminateSession = async () => {
        if (!session) return;

        if (!window.confirm('Are you sure you want to terminate this session?')) {
            return;
        }

        setTerminating(true);
        try {
            await axios.post(`/api/servicer/terminate-session/${session.id}`, {}, {
                withCredentials: true, // Include session cookie with request
            });
            // Redirect to idle screen or home
            window.location.href = '/counter/idle';
        } catch (error) {
            console.error('Failed to terminate session:', error);
            setTerminating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading your session...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                <Card className="p-8 max-w-sm mx-4 text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">No Active Session</h1>
                    <p className="text-gray-600 mb-6">You don't have an active counter session.</p>
                    <a href="/counter/idle" className="text-indigo-600 hover:text-indigo-700 font-medium">
                        Return to Counter Setup
                    </a>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 pb-32">
            {/* Main Session Card */}
            <div className="max-w-md mx-auto space-y-4">
                {/* Status Header */}
                <div className="text-center pt-4">
                    <Badge className="bg-green-500 hover:bg-green-600 text-white text-lg px-4 py-2">
                        Active Session
                    </Badge>
                </div>

                {/* Counter Information */}
                <Card className="p-6 shadow-lg rounded-xl">
                    <div className="space-y-4">
                        {/* Counter Label */}
                        <div className="text-center">
                            <h2 className="text-4xl font-bold text-indigo-600 mb-2">
                                {session.counter.label}
                            </h2>
                            <p className="text-sm text-gray-500">Counter Number</p>
                        </div>

                        {/* Branch Information */}
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2 text-gray-700">
                                <Building2 size={18} className="text-indigo-600 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium">{session.counter.branch.name}</p>
                                    <p className="text-xs text-gray-500">Branch</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                                <MapPin size={18} className="text-indigo-600 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium">{session.counter.branch.location}</p>
                                    <p className="text-xs text-gray-500">Location</p>
                                </div>
                            </div>
                        </div>

                        {/* Elapsed Time */}
                        <div className="bg-indigo-50 rounded-lg p-4 border-2 border-indigo-200">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Clock size={20} className="text-indigo-600" />
                                <p className="text-sm font-medium text-gray-600">Time Elapsed</p>
                            </div>
                            <p className="text-3xl font-bold text-indigo-600 text-center">
                                {elapsedTime}
                            </p>
                            <p className="text-xs text-gray-500 text-center mt-2">
                                Since {new Date(session.started_at).toLocaleTimeString()}
                            </p>
                        </div>

                        {/* Session Start Time */}
                        <div className="text-center text-sm">
                            <p className="text-gray-600">
                                Started at <span className="font-semibold">{new Date(session.started_at).toLocaleString()}</span>
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Terminate Button */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 max-w-md mx-auto">
                    <Button
                        onClick={handleTerminateSession}
                        disabled={terminating}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-6 rounded-lg flex items-center justify-center gap-2"
                        size="lg"
                    >
                        <LogOut size={20} />
                        {terminating ? 'Terminating...' : 'Terminate Session'}
                    </Button>
                </div>
            </div>
        </div>
    );
}