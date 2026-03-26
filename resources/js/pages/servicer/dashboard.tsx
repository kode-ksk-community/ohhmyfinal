'use client';

import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Clock, LogOut, MapPin, Building2, Settings, QrCode } from 'lucide-react';
import { Head, usePage, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import axios from 'axios';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { type User } from '@/types';

// Types for better safety
interface ActiveSession {
    id: number;
    started_at: string;
    counter: {
        label: string;
        branch: {
            name: string;
            location: string;
        };
    };
}



function UserInfo({ user, showEmail = false }: { user: User; showEmail?: boolean }) {
    const getInitials = useInitials();

    return (
        <div className="flex flex-col text-center items-center gap-4">
            <Avatar className="h-20 w-20 overflow-hidden rounded-full">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg font-bold text-4xl bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-center text-sm leading-tight">
                <span className="truncate font-bold text-2xl">{user.name}</span>
                {showEmail && <span className="text-muted-foreground truncate text-xs">{user.email}</span>}
            </div>
        </div>
    );
}


export default function ServicerDashboard() {
    const { auth } = usePage().props as any;
    const user = auth.user;

    const [session, setSession] = useState<ActiveSession | null>(null);
    const [elapsedTime, setElapsedTime] = useState('0m');
    const [loading, setLoading] = useState(true);
    const [terminating, setTerminating] = useState(false);

    // 1. Fetch Session Data
    const fetchSession = useCallback(async (isMounted: boolean) => {
        try {
            const { data } = await axios.get('/api/servicer/active-session', { withCredentials: true });
            if (isMounted) {
                setSession(data.session);
                setLoading(false);
            }
        } catch (error) {
            console.error('Session Error:', error);
            if (isMounted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        fetchSession(isMounted);
        return () => { isMounted = false; };
    }, [fetchSession]);

    // 2. Timer Logic
    const sessionStartTime = useMemo(() =>
        session?.started_at ? new Date(session.started_at) : null,
        [session?.started_at]);

    useEffect(() => {
        if (!sessionStartTime) return;

        const tick = () => {
            setElapsedTime(formatDistanceToNow(sessionStartTime, { addSuffix: false }));
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [sessionStartTime]);

    // 3. Terminate Action Logic
    const handleTerminate = async () => {
        if (!session || terminating) return;

        setTerminating(true);
        try {
            await axios.post(`/api/servicer/terminate-session/${session.id}`, {}, { withCredentials: true });
            window.location.href = '/counter/idle';
        } catch (error) {
            setTerminating(false);
            alert('Could not end session. Please check your connection.');
        }
    };

    // --- Loading State ---
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f1e8]">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#aa7b4a]/20 border-t-[#aa7b4a]" />
                <p className="mt-6 text-[#7a634f] font-medium animate-pulse">Syncing Session...</p>
            </div>
        );
    }

    // --- Offline State (Consolidated Card) ---
    if (!session) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f8f1e8] p-6 selection:bg-[#b47d46]/20">
                <Head title="Offline - Servicer Dashboard" />

                <Card className="w-full max-w-sm overflow-hidden border-[#e5d4c0] bg-white/95 shadow-2xl rounded-[2.5rem] animate-in zoom-in-95 duration-500">
                    {/* User Info Header */}
                    <div className="p-8 text-center bg-[#fdfaf7]/80 flex flex-col items-center border-b border-[#e3ceb8]/40">
                        <UserInfo user={user} showEmail={true} />

                        {/* QR Instruction Section */}
                        <div className="mt-6 pt-4 border-t-2 text-center space-y-6">
                            {/* <div className="h-20 w-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto border border-orange-100 shadow-inner">
                            <QrCode size={36} className="text-[#aa7b4a] opacity-80" />
                        </div> */}
                            <div className="space-y-2">
                                {/* <h2 className="text-2xl font-bold text-[#4c3829]">Ready to Work?</h2> */}
                                <p className="text-sm text-[#7a634f] leading-relaxed px-4">
                                    You haven't joined a counter yet. Please <strong>scan the QR code</strong> at your desk or click below to begin your shift.
                                </p>
                            </div>
                            {/* <Button asChild className="w-full bg-[#b47d46] hover:bg-[#8f5f35] text-white h-14 rounded-2xl text-lg font-bold shadow-lg shadow-orange-900/10 transition-all active:scale-95">
                            <a href="/counter/idle">Begin Shift</a>
                        </Button> */}
                        </div>

                        <div className="flex gap-2 mt-6 w-full">
                            <Button variant="outline" asChild className="flex-1 h-11 rounded-xl border-[#e3ceb8] text-[#4c3829] hover:bg-[#f8f1e8] transition-all">
                                <Link href={route('profile.edit')}>
                                    <Settings className="mr-2 h-4 w-4" /> Settings
                                </Link>
                            </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="flex-1 h-11 rounded-xl border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 transition-all">
                                        <LogOut className="mr-2 h-4 w-4" /> Logout
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-[2.5rem] border-[#e5d4c0] bg-white/95 backdrop-blur-lg">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl text-[#4c3829]">Log Out?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-[#7a634f]">
                                            Are you sure you want to end your dashboard session? You will need to sign back in to access your station.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-4 gap-2">
                                        <AlertDialogCancel className="rounded-2xl border-[#e3ceb8] text-[#4c3829]">Cancel</AlertDialogCancel>
                                        <AlertDialogAction asChild className="bg-red-600 hover:bg-red-700 rounded-2xl">
                                            <Link method="post" href={route('logout')} as="button" className="w-full">
                                                Log Out
                                            </Link>
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>


                </Card>
            </div>
        );
    }

    // --- Active State ---
    return (
        <div className="min-h-screen bg-[#f8f1e8] selection:bg-[#b47d46]/20 pb-32">
            <Head title={`Counter ${session.counter.label} - Dashboard`} />

            <main className="max-w-md mx-auto p-4 pt-12 space-y-6">
                <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2">
                    <Badge className="bg-[#b47d46] text-white border-none px-6 py-2 shadow-lg shadow-orange-900/10 rounded-full text-sm font-bold uppercase tracking-widest">
                        <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-2" />
                        On Duty
                    </Badge>
                </div>

                <Card className="relative overflow-hidden p-8 border-[#e5d4c0] bg-white/90 shadow-2xl rounded-[2.5rem] backdrop-blur-sm">
                    <div className="absolute -top-12 -right-12 h-32 w-32 bg-[#b47d46]/5 rounded-full blur-3xl" />

                    <div className="space-y-8 relative">
                        <div className="text-center">
                            <p className="text-[#80664a] font-bold text-xs uppercase tracking-widest mb-1">Station</p>
                            <h2 className="text-6xl font-black text-[#8f5f35] tracking-tighter">
                                {session.counter.label}
                            </h2>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#fdfaf7] p-4 rounded-3xl border border-[#e5d4c0]/50">
                                <Building2 size={18} className="text-indigo-600 mb-2" />
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Branch</p>
                                <p className="text-xs font-bold text-gray-800 truncate">{session.counter.branch.name}</p>
                            </div>
                            <div className="bg-[#fdfaf7] p-4 rounded-3xl border border-[#e5d4c0]/50">
                                <MapPin size={18} className="text-indigo-600 mb-2" />
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Location</p>
                                <p className="text-xs font-bold text-gray-800 truncate">{session.counter.branch.location}</p>
                            </div>
                        </div>

                        <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-900/20 text-center">
                            <div className="flex items-center justify-center gap-2 mb-1 opacity-80">
                                <Clock size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Session Duration</span>
                            </div>
                            <p className="text-4xl font-mono font-bold tracking-tight">
                                {elapsedTime}
                            </p>
                        </div>
                    </div>
                </Card>

                <div className="text-center">
                    <p className="text-[10px] text-[#80664a] font-medium opacity-60">
                        Shift started at {sessionStartTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </main>

            <footer className="fixed bottom-0 left-0 right-0 p-6 bg-white/60 backdrop-blur-xl border-t border-[#e5d4c0]/30 z-40">
                <div className="max-w-md mx-auto">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                disabled={terminating}
                                variant="destructive"
                                className="w-full h-16 rounded-2xl font-bold shadow-lg shadow-red-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {terminating ? (
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                        Ending Session...
                                    </div>
                                ) : (
                                    <>
                                        <LogOut className="mr-2 h-5 w-5" />
                                        Terminate Session
                                    </>
                                )}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2.5rem] border-[#e5d4c0] bg-white/95 backdrop-blur-lg">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl text-[#4c3829]">Terminate Session?</AlertDialogTitle>
                                <AlertDialogDescription className="text-[#7a634f]">
                                    This will end your current shift at Counter <strong>{session.counter.label}</strong>. You will need to scan the QR code again to resume service.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-4 gap-2">
                                <AlertDialogCancel className="rounded-2xl border-[#e3ceb8] text-[#4c3829]">Stay On Duty</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleTerminate}
                                    className="bg-red-600 hover:bg-red-700 rounded-2xl"
                                >
                                    End Shift Now
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </footer>
        </div>
    );
}