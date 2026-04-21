import React, { useState, useEffect } from 'react';
import {
    Layout,
    CheckSquare,
    Monitor,
    Headphones,
    Radio,
    Star,
    Users,
    BookOpen,
    Fingerprint,
    MapPin,
    Briefcase,
    Coffee,
    Settings,
    Bell,
    Calendar,
    Clock,
    LogOut,
    User,
    FileText,
    Clipboard,
    Check,
    Sparkles, // [NEW] For Assistant
    TrendingUp, // [NEW] For Skills
    Zap, // [NEW] For Insights
    Landmark,
    X
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest } from '../hrms/types';
import { KAA_LOGO_URL } from '../../constants';
import { ReportsListView } from './reports/ReportsListView';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext'; // Keeping if needed elsewhere, but mainly replaced
import { useESSP } from '../../contexts/ESSPContext';
import { WorkflowEngine } from '../../lib/WorkflowEngine'; // [NEW] Unified Engine
import { CareerTimeline } from '../hrms/transitions/CareerTimeline'; // [NEW] Integrated real timeline
// Reusing some components/styles from HRMS for consistency, but tailor for ESSP

export const ESSP: React.FC = () => {
    const { employeeProfile, roleFlags, loading: esspLoading } = useESSP();
    const { user } = useAuth(); // Restored for backward compatibility
    const currentEmployee = employeeProfile;
    const isManager = roleFlags.isManager;

    // Local state for dashboard data
    const [activeTab, setActiveTab] = useState('DASHBOARD');

    // Dashboard State
    const [punchStatus, setPunchStatus] = useState<'In' | 'Out'>('Out');
    const [punchLoading, setPunchLoading] = useState(false);
    const [lastAttendanceId, setLastAttendanceId] = useState<string | null>(null);
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [punchDuration, setPunchDuration] = useState<string>('--:--');

    const [attendanceLog, setAttendanceLog] = useState<any[]>([]);
    const [leaveBalance, setLeaveBalance] = useState(0);
    const [lastSalary, setLastSalary] = useState<number | null>(null);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [holidays, setHolidays] = useState<any[]>([]);

    useEffect(() => {
        if (currentEmployee) {
            refreshDashboard(currentEmployee.id, currentEmployee.company_id);
        }
    }, [currentEmployee]);

    const refreshDashboard = async (empId: string, companyId: string) => {
        // 1. Attendance Status (Today)
        const today = new Date().toISOString().split('T')[0];
        const { data: activePunch } = await supabase.from('attendance')
            .select('*')
            .eq('employee_id', empId)
            .eq('date', today)
            .is('check_out', null) // Only find open sessions
            .maybeSingle();

        if (activePunch) {
            setPunchStatus('In');
            setLastAttendanceId(activePunch.id);
        } else {
            setPunchStatus('Out');
            setLastAttendanceId(null);
        }

        // 2. Attendance Log (Recent 3)
        const { data: recentLogs } = await supabase.from('attendance')
            .select('*').eq('employee_id', empId).order('date', { ascending: false }).limit(3);
        if (recentLogs) setAttendanceLog(recentLogs);

        // 3. Leave Balance (Calculated from org_leave_types default_balance - Approved Leaves)
        // Fetch leave types from master for dynamic balance and dropdown
        let totalDefaultBalance = 22; // Ultimate fallback
        if (companyId) {
            const { data: ltData } = await supabase.from('org_leave_types')
                .select('*').eq('company_id', companyId);
            if (ltData && ltData.length > 0) {
                setLeaveTypes(ltData);
                totalDefaultBalance = ltData.reduce((sum: number, lt: any) => sum + (lt.default_balance || 0), 0);
            }
        }
        const currentYear = new Date().getFullYear();
        const { count } = await supabase.from('leaves')
            .select('*', { count: 'exact', head: true })
            .eq('employee_id', empId)
            .eq('status', 'Approved')
            .gte('start_date', `${currentYear}-01-01`);

        setLeaveBalance(totalDefaultBalance - (count || 0));

        // 4. Last Pay (Locked/Paid only)
        // Using 'payroll_records' as per types.ts
        const { data: pay } = await supabase.from('payroll_records')
            .select('net_pay')
            .eq('employee_id', empId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (pay) setLastSalary(pay.net_pay);

        // 5. Announcements
        const { data: ann } = await supabase.from('announcements') // Reverted to original
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (ann) setAnnouncements(ann);
        // Fallback or specific table check might be needed if 'ann_announcements' fails, 
        // but 'announcements' was used before. Let's stick to 'announcements' which is likely correct if it existed.
        // Reverting to 'announcements' for safety unless I know otherwise.
    };

    const getCurrentLocation = (): Promise<string | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve(`${position.coords.latitude},${position.coords.longitude}`);
                },
                () => resolve(null),
                { timeout: 5000 }
            );
        });
    };

    const handlePunch = async () => {
        if (!currentEmployee) return;
        setPunchLoading(true);

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const isoNow = now.toISOString(); // Full ISO timestamp for DB
        const locStr = await getCurrentLocation();

        if (punchStatus === 'Out') {
            // PUNCH IN
            const { data, error } = await (supabase as any).from('attendance').insert([{
                employee_id: currentEmployee.id,
                company_id: currentEmployee.company_id,
                date: today,
                check_in: isoNow,
                check_in_location: locStr,
                status: 'Present',
                total_hours: 0,
                source: 'punch'
            }]).select().single();

            if (error) {
                console.error("Punch In Error:", error);
                alert("Failed to punch in. Please try again.");
            } else {
                setPunchStatus('In');
                setLastAttendanceId(data.id);
                // alert("Punched In Successfully!");
            }
        } else {
            // PUNCH OUT
            if (!lastAttendanceId) {
                // Should not happen if logic is correct, but try to find the open record
                const { data: activePunch } = await supabase.from('attendance')
                    .select('id, check_in')
                    .eq('employee_id', currentEmployee.id)
                    .eq('date', today)
                    .is('check_out', null)
                    .maybeSingle();

                if (!activePunch) {
                    alert("No active session found to punch out from.");
                    setPunchLoading(false);
                    setPunchStatus('Out');
                    return;
                }

                // Use found ID
                await performPunchOut(activePunch.id, activePunch.check_in, isoNow, locStr);
            } else {
                // Fetch check_in time to calculate duration
                const { data: currentRecord } = await supabase.from('attendance').select('check_in').eq('id', lastAttendanceId).single();
                if (currentRecord) {
                    await performPunchOut(lastAttendanceId, currentRecord.check_in, isoNow, locStr);
                }
            }
        }

        // Refresh data
        refreshDashboard(currentEmployee.id, currentEmployee.company_id);
        setPunchLoading(false);
    };

    const performPunchOut = async (recordId: string, checkInTime: string, checkOutTime: string, locationStr: string | null = null) => {
        // Calculate Duration from full ISO timestamps
        const d1 = new Date(checkInTime);
        const d2 = new Date(checkOutTime);
        const diffMs = d2.getTime() - d1.getTime();
        const durationHours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));

        const updateData: any = {
            check_out: checkOutTime,
            total_hours: durationHours
        };
        if (locationStr) {
            updateData.check_out_location = locationStr;
        }

        const { error } = await supabase.from('attendance').update(updateData).eq('id', recordId);

        if (error) {
            console.error("Punch Out Error:", error);
            alert("Failed to punch out.");
        } else {
            setPunchStatus('Out');
            setLastAttendanceId(null);
        }
    };

    const Dashboard = () => (
        <div className="p-6 md:p-10 h-full overflow-y-auto animate-page-enter">
            {/* Wellness / Welcome Header */}
            <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">My Dashboard</h1>
                    <p className="text-slate-500 font-medium">Here's what's happening today.</p>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* [NEW] Intelligence Insight Cards (Carousel Logic Mock) */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-center gap-4">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600"><Clock className="w-4 h-4" /></div>
                        <div>
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide">Overtime Alert</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">+22% vs last month. Take a break?</p>
                        </div>
                    </div>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600"><TrendingUp className="w-4 h-4" /></div>
                        <div>
                            <p className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wide">Growth</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">New Skill Added: React.js</p>
                        </div>
                    </div>
                </div>

                {/* Left Col: Punch & Stats */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Punch Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl shadow-slate-900/20">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`w-3 h-3 rounded-full ${punchStatus === 'In' ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]' : 'bg-rose-500'}`}></span>
                                    <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Current Status</span>
                                </div>
                                <h2 className="text-5xl font-black tracking-tight mb-2">{punchStatus === 'In' ? 'Checked In' : 'Checked Out'}</h2>
                                <p className="text-slate-400 font-medium">
                                    {punchStatus === 'In' ? 'You are currently active.' : 'Your session has ended.'}
                                </p>
                            </div>

                            <button
                                onClick={handlePunch}
                                disabled={punchLoading}
                                className={`w-full md:w-auto px-10 py-5 rounded-2xl font-bold text-lg transition-transform active:scale-95 flex items-center justify-center gap-3 ${punchStatus === 'Out'
                                    ? 'bg-white text-slate-900 hover:bg-slate-50'
                                    : 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-900/50'
                                    }`}
                            >
                                <Fingerprint className="w-6 h-6" />
                                {punchLoading ? 'Processing...' : punchStatus === 'Out' ? 'Punch In' : 'Punch Out'}
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Leave Balance */}
                        <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between h-48 group hover:border-emerald-200 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600 dark:text-emerald-400">
                                    <Briefcase className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available</span>
                            </div>
                            <div>
                                <span className="text-4xl font-black text-slate-800 dark:text-white group-hover:text-emerald-600 transition-colors">{leaveBalance}</span>
                                <p className="text-sm font-bold text-slate-500">Annual Leaves</p>
                            </div>
                        </div>

                        {/* Last Pay */}
                        <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between h-48 group hover:border-indigo-200 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 dark:text-indigo-400">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Payout</span>
                            </div>
                            <div>
                                <span className="text-4xl font-black text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors">
                                    {lastSalary ? `$${lastSalary.toLocaleString()}` : '--'}
                                </span>
                                <p className="text-sm font-bold text-slate-500">Net Salary</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Col: Updates */}
                <div className="space-y-8">
                    {/* Announcements */}
                    <div className="bg-white dark:bg-zinc-900/50 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-[400px]">
                        <div className="p-6 border-b border-slate-50 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Announcements</h3>
                            <Bell className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {announcements.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                                    <Bell className="w-8 h-8 mb-3 opacity-20" />
                                    <p className="text-sm">No new announcements</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {announcements.map(ann => (
                                        <div key={ann.id} className={`p-4 rounded-xl border ${ann.is_pinned ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'} transition-all hover:scale-[0.98]`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{ann.title}</h4>
                                                {ann.is_pinned && <MapPin className="w-3 h-3 text-indigo-500" />}
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-2">{ann.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Holidays */}
                    <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-[2rem] p-8 border border-pink-100 dark:border-pink-900/30">
                        <div className="flex items-center gap-3 mb-6 text-pink-700 dark:text-pink-400">
                            <Calendar className="w-6 h-6" />
                            <span className="font-bold text-sm uppercase tracking-wide">Upcoming Holidays</span>
                        </div>
                        <div className="space-y-4">
                            {holidays.length === 0 ? (
                                <p className="text-sm text-pink-600/60 font-medium italic">No upcoming holidays.</p>
                            ) : (
                                holidays.map(hol => (
                                    <div key={hol.id} className="flex justify-between items-center group">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-pink-600 transition-colors">{hol.name}</span>
                                            <span className="text-xs text-slate-500">{new Date(hol.date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-pink-300 group-hover:bg-pink-500 transition-colors"></div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const MyApprovals = () => {
        const [requests, setRequests] = useState<any[]>([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            if (currentEmployee) fetchApprovals();
        }, [currentEmployee]);

        const fetchApprovals = async () => {
            setLoading(true);
            try {
                if (currentEmployee) {
                    // Use Unified Engine
                    const requests = await WorkflowEngine.getMyApprovals(currentEmployee.id);
                    setRequests(requests || []);
                }
            } catch (error) {
                console.error("Error fetching approvals:", error);
            }
            setLoading(false);
        };

        const handleAction = async (id: string, action: 'Approved' | 'Rejected') => {
            if (!confirm(`Are you sure you want to ${action} this request?`)) return;

            // Use Unified Engine
            if (action === 'Approved') {
                await WorkflowEngine.approve(id, currentEmployee?.id);
            } else {
                await WorkflowEngine.reject(id, currentEmployee?.id);
            }
            fetchApprovals();
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Approvals</h1>
                        <p className="text-slate-500 font-medium">Review and act on pending requests.</p>
                    </div>
                </div>

                <div className="space-y-4 max-w-4xl">
                    {loading ? (
                        <p className="text-slate-400">Loading requests...</p>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                            <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-medium">All caught up! No pending approvals.</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-6">
                                {/* Employee Info */}
                                <div className="flex items-start gap-4 md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-zinc-800 pb-4 md:pb-0 md:pr-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                                        {req.employee?.profile_photo_url ? (
                                            <img src={req.employee.profile_photo_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full font-bold text-slate-400">{req.employee?.name?.[0]}</div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{req.employee?.name}</h3>
                                        <p className="text-xs text-slate-500 mb-1">{req.employee?.designation}</p>
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wide">
                                            {req.leave_type || req.type} Leave
                                        </span>
                                    </div>
                                </div>

                                {/* Request Details */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            {req.trigger_type} {/* Generic Display */}
                                        </div>
                                        <span className="text-xs font-mono text-slate-400">{new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm text-slate-500 mb-6 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl italic">"{req.reason}"</p>

                                    <div className="flex gap-3 justify-end">
                                        <button
                                            onClick={() => handleAction(req.id, 'Rejected')}
                                            className="px-5 py-2 rounded-xl text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition-colors"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleAction(req.id, 'Approved')}
                                            className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                        >
                                            Approve Request
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    const SkillsView = () => {
        // Mock Data for V1.2
        const skills = [
            { id: 1, name: 'React.js', level: 4, status: 'Verified' },
            { id: 2, name: 'TypeScript', level: 3, status: 'Self-Declared' },
            { id: 3, name: 'Project Management', level: 2, status: 'Self-Declared' }
        ];

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-8 tracking-tight">Skills & Growth</h1>

                {/* Skill Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp className="w-32 h-32" /></div>
                        <h3 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Skills Declared</h3>
                        <p className="text-5xl font-black">{skills.length}</p>
                        <p className="mt-4 text-sm font-medium bg-white/20 px-3 py-1 rounded-lg w-fit">Top 10% in Dept</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
                        <h3 className="text-slate-500 font-bold mb-2">Skill Gaps</h3>
                        <p className="text-4xl font-black text-rose-500">2</p>
                        <p className="text-xs text-slate-400 mt-2">Critical for next role</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
                        <h3 className="text-slate-500 font-bold mb-2">Readiness Score</h3>
                        <p className="text-4xl font-black text-emerald-500">85%</p>
                        <p className="text-xs text-slate-400 mt-2">Sr. Engineer Role</p>
                    </div>
                </div>

                {/* Career Path Visual */}
                {/* Career Path Visual - Integrated Real Timeline */}
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Career Timeline</h2>
                <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    {currentEmployee?.id ? (
                        <CareerTimeline employeeId={currentEmployee.id} />
                    ) : (
                        <p className="text-slate-500">Loading career history...</p>
                    )}
                </div>
            </div>
        );
    };

    const AssistantView = () => {
        const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
            { role: 'ai', text: `Hi ${currentEmployee?.name?.split(' ')[0]}! I'm your People Intelligence Agent. Ask me about your leaves, salary trends, or critical skills.` }
        ]);
        const [input, setInput] = useState('');
        const [thinking, setThinking] = useState(false);

        const handleSend = async () => {
            if (!input.trim()) return;
            const newMsgs = [...messages, { role: 'user', text: input }];
            setMessages(newMsgs as any);
            setInput('');
            setThinking(true);

            // Mock Response Logic for V1.2 Prototype
            setTimeout(() => {
                let response = "I'm processing that request...";
                const q = input.toLowerCase();

                if (q.includes('leave') || q.includes('balance')) {
                    response = `You have ${leaveBalance} annual leaves remaining. Your last leave was taken in December.`;
                } else if (q.includes('salary') || q.includes('pay')) {
                    response = `Your last net pay was $${lastSalary?.toLocaleString()}. This is consistent with your average over the last 3 months.`;
                } else if (q.includes('skill') || q.includes('career')) {
                    response = "You are currently tracked as 'Software Engineer'. You need to improve 'System Design' to progress to Senior Engineer.";
                } else {
                    response = "I can help with attendance, leaves, payroll, and skill queries. Try asking 'How many leaves do I have?'";
                }

                setMessages([...newMsgs as any, { role: 'ai', text: response }]);
                setThinking(false);
            }, 1000);
        };

        return (
            <div className="h-full flex flex-col bg-slate-50 dark:bg-black">
                {/* Header */}
                <div className="p-6 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-white">Super Agent</h2>
                        <p className="text-xs text-green-500 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online</p>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-bl-none border border-slate-100 dark:border-zinc-700'
                                }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {thinking && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl rounded-bl-none border border-slate-100 dark:border-zinc-700 flex gap-2 items-center">
                                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></span>
                                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-75"></span>
                                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-150"></span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-6 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800">
                    <div className="flex gap-4">
                        <input
                            type="text"
                            className="flex-1 bg-slate-100 dark:bg-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
                            placeholder="Ask me anything about your work data..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button onClick={handleSend} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                            <Zap className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const navItems = [
        { id: 'DASHBOARD', icon: Layout, label: 'My Dashboard' },
        { id: 'ASSISTANT', icon: Sparkles, label: 'AI Assistant', highlight: true }, // [NEW]
        { id: 'SKILLS', icon: TrendingUp, label: 'Skills & Growth' }, // [NEW]
        { id: 'APPROVALS', icon: CheckSquare, label: 'My Approvals' },
        { id: 'PROFILE', icon: User, label: 'My Profile' },
        { id: 'ATTENDANCE', icon: Clock, label: 'My Attendance' },
        ...(isManager ? [{ id: 'TEAM_ATTENDANCE', icon: Users, label: 'Team Attendance' }] : []),
        { id: 'LEAVES', icon: Briefcase, label: 'My Leaves' },
        { id: 'PAYSLIPS', icon: FileText, label: 'My Payslips' },
        { id: 'ASSETS', icon: Monitor, label: 'My Assets' },
        { id: 'SUPPORT', icon: Headphones, label: 'Support' },
        { id: 'RESIGNATION', icon: LogOut, label: 'Resignation' },
        { id: 'ANNOUNCEMENTS', icon: Bell, label: 'Announcements' },
        // { id: 'BUZZ', icon: Radio, label: 'Buzz Feed' }, // Removed pending features for clarity
        { id: 'SURVEYS', icon: Clipboard, label: 'Surveys' },
        { id: 'KUDOS', icon: Star, label: 'Kudos & Rewards' },
        { id: 'DIRECTORY', icon: Users, label: 'People Directory' },
        { id: 'LEARNING', icon: BookOpen, label: 'Learning' },
        { id: 'REPORTS', icon: Clipboard, label: 'Reports' },
    ];

    const MyProfile = () => (
        <div className="p-8 h-full overflow-y-auto animate-page-enter">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-8 tracking-tight">My Profile</h1>
            {!currentEmployee ? (
                <div className="max-w-lg mx-auto text-center py-20">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <User className="w-10 h-10 text-slate-300" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-3">Employee Profile Not Linked</h2>
                    <p className="text-slate-500 mb-2">Your login account <span className="font-bold text-slate-700 dark:text-slate-200">({user?.email})</span> is not linked to an employee record.</p>
                    <p className="text-slate-400 text-sm">Please contact your HR administrator to link your account to your employee profile.</p>
                </div>
            ) : (
                <div className="max-w-4xl">
                    <div className="bg-white dark:bg-zinc-900/50 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-8">
                        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                        <div className="px-8 pb-8">
                            <div className="relative flex justify-between items-end -mt-12 mb-6">
                                <div className="flex items-end gap-6">
                                    <div className="w-24 h-24 rounded-2xl bg-white dark:bg-zinc-800 p-1 shadow-lg relative overflow-hidden group">
                                        {currentEmployee?.profile_photo_url ? (
                                            <img
                                                src={currentEmployee.profile_photo_url}
                                                alt={currentEmployee.name}
                                                className="w-full h-full rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full rounded-xl bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-2xl font-bold text-slate-400">
                                                {currentEmployee?.name?.charAt(0) || 'U'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="pb-1">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{currentEmployee?.name}</h2>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">{currentEmployee?.role || 'Employee'}</p>
                                    </div>
                                </div>
                                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider">
                                    {currentEmployee?.status || 'Active'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-10">
                                    <section>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
                                            <Briefcase className="w-4 h-4" /> Professional Details
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Employee ID</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{currentEmployee?.employee_code || currentEmployee?.id?.slice(0, 8).toUpperCase()}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Department</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{(currentEmployee as any)?.departments?.name || currentEmployee?.department || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Designation</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{(currentEmployee as any)?.org_designations?.name || (currentEmployee as any)?.designation || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Grade</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{(currentEmployee as any)?.org_grades?.name || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Employment Type</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{(currentEmployee as any)?.org_employment_types?.name || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Date of Joining</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{currentEmployee?.join_date ? new Date(currentEmployee.join_date).toLocaleDateString() : '-'}</p>
                                            </div>
                                            <div className="col-span-1 sm:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Reporting Manager</label>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-slate-500">
                                                        {(currentEmployee as any)?.reporting_manager?.name?.charAt(0) || '?'}
                                                    </div>
                                                    <p className="text-slate-900 dark:text-white font-semibold">{(currentEmployee as any)?.reporting_manager?.name || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
                                            <MapPin className="w-4 h-4" /> Work Location
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Office Location</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{(currentEmployee as any)?.locations?.name || (currentEmployee as any)?.work_location || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Date Format</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">DD/MM/YYYY</p>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                <div className="space-y-10">
                                    <section>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
                                            <User className="w-4 h-4" /> Personal Details
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Mobile Number</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{currentEmployee?.office_mobile || currentEmployee?.personal_mobile || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Email (Official)</label>
                                                <p className="text-slate-900 dark:text-white font-semibold break-all">{currentEmployee?.email || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Gender</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{currentEmployee?.gender || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Date of Birth</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{currentEmployee?.date_of_birth ? new Date(currentEmployee.date_of_birth).toLocaleDateString() : '-'}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
                                            <Landmark className="w-4 h-4" /> Financial Details
                                        </h3>
                                        <div className="grid grid-cols-1 gap-y-6">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 block mb-1">Bank Name</label>
                                                <p className="text-slate-900 dark:text-white font-semibold">{(currentEmployee as any)?.bank_name || '-'}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 block mb-1">Account Number</label>
                                                    <p className="text-slate-900 dark:text-white font-semibold font-mono">
                                                        {currentEmployee?.account_number ? `XXXXXX${currentEmployee.account_number.slice(-4)}` : '-'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 block mb-1">IFSC Code</label>
                                                    <p className="text-slate-900 dark:text-white font-semibold font-mono">{(currentEmployee as any)?.ifsc_code || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const PeopleDirectory = () => {
        const [people, setPeople] = useState<any[]>([]);
        const [search, setSearch] = useState('');

        useEffect(() => {
            const fetchPeople = async () => {
                if (!currentEmployee?.company_id) return;
                const { data } = await supabase.from('employees')
                    .select('id, name, org_designations(name), departments(name), email, mobile:office_mobile, status')
                    .eq('company_id', currentEmployee.company_id)
                    .eq('status', 'Active');
                if (data) {
                    setPeople(data.map((p: any) => ({
                        ...p,
                        designation: p.org_designations?.name,
                        department: p.departments?.name
                    })));
                }
            };
            fetchPeople();
        }, [currentEmployee]);

        const filteredPeople = people.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.designation?.toLowerCase().includes(search.toLowerCase()) ||
            p.department?.toLowerCase().includes(search.toLowerCase())
        );

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">People Directory</h1>
                        <p className="text-slate-500 font-medium">Connect with your colleagues.</p>
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name, role, or department..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full md:w-96 px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPeople.map(person => (
                        <div key={person.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group shadow-sm hover:shadow-md">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 font-bold text-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    {person.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{person.name}</h3>
                                    <p className="text-xs text-slate-500 font-medium">{person.designation}</p>
                                </div>
                            </div>
                            <div className="space-y-2 pt-4 border-t border-slate-50 dark:border-zinc-800">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Briefcase className="w-3.5 h-3.5" />
                                    {person.department}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <MapPin className="w-3.5 h-3.5" />
                                    New York Office
                                </div>
                                <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                    Active Now
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };


    const MyAttendance = () => {
        const [records, setRecords] = useState<any[]>([]);
        const [loading, setLoading] = useState(true);
        const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
        const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, halfDay: 0 });

        // Missed Punch Request
        const [showMissedPunch, setShowMissedPunch] = useState(false);
        const [missedPunchForm, setMissedPunchForm] = useState({
            request_date: new Date().toISOString().split('T')[0],
            punch_type: 'check_in' as 'check_in' | 'check_out',
            requested_time: '',
            reason: ''
        });
        const [submittingMissed, setSubmittingMissed] = useState(false);
        const [missedRequests, setMissedRequests] = useState<any[]>([]);

        useEffect(() => {
            if (currentEmployee) {
                fetchAttendance();
                fetchMissedRequests();
            }
        }, [currentEmployee, filterDate]);

        const fetchAttendance = async () => {
            setLoading(true);
            const startOfMonth = `${filterDate}-01`;
            const endOfMonth = `${filterDate}-31`;

            const { data } = await supabase.from('attendance')
                .select('*')
                .eq('employee_id', currentEmployee.id)
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
                .order('date', { ascending: false });

            if (data) {
                setRecords(data);
                const stats = data.reduce((acc, curr) => {
                    if (curr.status === 'Present') acc.present++;
                    else if (curr.status === 'Absent') acc.absent++;
                    else if (curr.status === 'Half Day') acc.halfDay++;
                    return acc;
                }, { present: 0, absent: 0, late: 0, halfDay: 0 });
                setStats(stats);
            }
            setLoading(false);
        };

        const fetchMissedRequests = async () => {
            const { data } = await (supabase as any).from('missed_punch_requests')
                .select('*')
                .eq('employee_id', currentEmployee.id)
                .order('created_at', { ascending: false })
                .limit(10);
            if (data) setMissedRequests(data);
        };

        const handleSubmitMissedPunch = async () => {
            if (!missedPunchForm.requested_time || !missedPunchForm.reason.trim()) {
                alert('Please fill in all fields including the reason.');
                return;
            }
            setSubmittingMissed(true);

            const requestedTimestamp = new Date(`${missedPunchForm.request_date}T${missedPunchForm.requested_time}:00`).toISOString();

            const { error } = await (supabase as any).from('missed_punch_requests').insert([{
                company_id: currentEmployee.company_id,
                employee_id: currentEmployee.id,
                request_date: missedPunchForm.request_date,
                punch_type: missedPunchForm.punch_type,
                requested_time: requestedTimestamp,
                reason: missedPunchForm.reason,
                status: 'Pending'
            }]);

            if (error) {
                alert('Failed to submit request: ' + error.message);
            } else {
                setShowMissedPunch(false);
                setMissedPunchForm({ request_date: new Date().toISOString().split('T')[0], punch_type: 'check_in', requested_time: '', reason: '' });
                fetchMissedRequests();
            }
            setSubmittingMissed(false);
        };

        const fmtTime = (val: string | null) => {
            if (!val) return '--:--';
            try {
                return new Date(val).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            } catch {
                if (val.includes(':')) {
                    const [h, m] = val.split(':');
                    const hour = parseInt(h);
                    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
                }
                return val;
            }
        };

        const pendingCount = missedRequests.filter(r => r.status === 'Pending').length;

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">My Attendance</h1>
                        <p className="text-slate-500">Track your working hours and request corrections.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowMissedPunch(true)}
                            className="px-4 py-2.5 bg-amber-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2"
                        >
                            <Clock className="w-4 h-4" />
                            Request Missed Punch
                            {pendingCount > 0 && (
                                <span className="ml-1 bg-white text-amber-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{pendingCount}</span>
                            )}
                        </button>
                        <input
                            type="month"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-slate-700 dark:text-white font-bold outline-none ring-indigo-500/20 focus:ring-2"
                        />
                    </div>
                </div>

                {/* Monthly Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Present', value: stats.present, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                        { label: 'Absent', value: stats.absent, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
                        { label: 'Half Day', value: stats.halfDay, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                        { label: 'Late', value: stats.late, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-900/20' },
                    ].map((stat, idx) => (
                        <div key={idx} className={`${stat.bg} rounded-2xl p-6 flex flex-col items-center justify-center border border-transparent hover:border-current dark:border-transparent transition-all`}>
                            <span className={`text-4xl font-black ${stat.color} mb-1`}>{stat.value}</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Pending Missed Punch Requests */}
                {missedRequests.length > 0 && (
                    <div className="mb-8 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30 overflow-hidden">
                        <div className="px-6 py-3 border-b border-amber-100 dark:border-amber-800/30 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-600" />
                            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400">Missed Punch Requests</h3>
                        </div>
                        <div className="divide-y divide-amber-100 dark:divide-amber-800/20">
                            {missedRequests.slice(0, 5).map(req => (
                                <div key={req.id} className="px-6 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                {req.punch_type === 'check_in' ? 'Check In' : 'Check Out'} — {new Date(req.request_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Requested: {fmtTime(req.requested_time)} · "{req.reason}"
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                                        req.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                        req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                    }`}>{req.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Attendance Table */}
                <div className="bg-white dark:bg-zinc-900/50 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-zinc-800/50">
                            <tr>
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Check In</th>
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Check Out</th>
                                <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-400">No records found for this month.</td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-6 font-bold text-slate-700 dark:text-slate-200">
                                            {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${record.status === 'Present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                record.status === 'Absent' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                }`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="p-6 font-mono text-sm text-slate-600 dark:text-slate-400">{fmtTime(record.check_in)}</td>
                                        <td className="p-6 font-mono text-sm text-slate-600 dark:text-slate-400">{fmtTime(record.check_out)}</td>
                                        <td className="p-6 font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{record.total_hours ? `${record.total_hours}h` : '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Missed Punch Request Modal */}
                {showMissedPunch && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-fade-in" onClick={() => setShowMissedPunch(false)}>
                        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-white/50 dark:border-zinc-800 animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Request Missed Punch</h3>
                                    <p className="text-xs text-slate-500 mt-1">Submit a correction for a missed check-in or check-out</p>
                                </div>
                                <button onClick={() => setShowMissedPunch(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                                    <input
                                        type="date"
                                        value={missedPunchForm.request_date}
                                        onChange={e => setMissedPunchForm({ ...missedPunchForm, request_date: e.target.value })}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Punch Type</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(['check_in', 'check_out'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setMissedPunchForm({ ...missedPunchForm, punch_type: type })}
                                                className={`p-3 rounded-xl text-sm font-bold border-2 transition-all ${
                                                    missedPunchForm.punch_type === type
                                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                                        : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-slate-300'
                                                }`}
                                            >
                                                {type === 'check_in' ? '🟢 Check In' : '🔴 Check Out'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time</label>
                                    <input
                                        type="time"
                                        value={missedPunchForm.requested_time}
                                        onChange={e => setMissedPunchForm({ ...missedPunchForm, requested_time: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono text-sm outline-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        Reason <span className="text-rose-500">*</span>
                                    </label>
                                    <textarea
                                        required
                                        value={missedPunchForm.reason}
                                        onChange={e => setMissedPunchForm({ ...missedPunchForm, reason: e.target.value })}
                                        placeholder="e.g., Forgot to punch in, system was down..."
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none h-24 resize-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <button
                                    onClick={handleSubmitMissedPunch}
                                    disabled={submittingMissed}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    {submittingMissed ? 'Submitting...' : <><Calendar className="w-5 h-5" /> Submit Request</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const TeamAttendance = () => {
        const [records, setRecords] = useState<any[]>([]);
        const [loading, setLoading] = useState(true);
        const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10)); // Today

        useEffect(() => {
            if (currentEmployee) fetchTeamAttendance();
        }, [currentEmployee, filterDate]);

        const fetchTeamAttendance = async () => {
            setLoading(true);
            // Fetch direct reportees first
            const { data: reportees } = await supabase.from('employees')
                .select('id, name, department, role, profile_photo_url')
                .eq('manager_id', currentEmployee.id);

            if (!reportees || reportees.length === 0) {
                setRecords([]);
                setLoading(false);
                return;
            }

            const reporteeIds = reportees.map(r => r.id);

            // Fetch attendance for these reportees on the selected date
            const { data: attendance } = await supabase.from('attendance')
                .select('*')
                .in('employee_id', reporteeIds)
                .eq('date', filterDate);

            // Merge data
            const merged = reportees.map(rep => {
                const record = attendance?.find(a => a.employee_id === rep.id);
                return {
                    ...rep,
                    attendance: record || { status: 'Not Marked', check_in: null, check_out: null }
                };
            });

            setRecords(merged);
            setLoading(false);
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Team Attendance</h1>
                        <p className="text-slate-500">Monitor your team's presence.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-slate-700 dark:text-white font-bold outline-none ring-indigo-500/20 focus:ring-2"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {records.map(rec => (
                        <div key={rec.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 font-bold text-lg overflow-hidden">
                                {rec.profile_photo_url ? <img src={rec.profile_photo_url} className="w-full h-full object-cover" /> : rec.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 dark:text-white">{rec.name}</h3>
                                <p className="text-xs text-slate-500 mb-3">{rec.role}</p>

                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide mb-3 ${rec.attendance.status === 'Present' ? 'bg-emerald-100 text-emerald-700' :
                                    rec.attendance.status === 'Absent' ? 'bg-rose-100 text-rose-700' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>
                                    <div className={`w-2 h-2 rounded-full ${rec.attendance.status === 'Present' ? 'bg-emerald-500' :
                                        rec.attendance.status === 'Absent' ? 'bg-rose-500' :
                                            'bg-slate-400'
                                        }`}></div>
                                    {rec.attendance.status}
                                </div>

                                <div className="flex gap-4 text-xs font-mono text-slate-500">
                                    <div className="flex flex-col">
                                        <span className="uppercase text-[10px] tracking-wider mb-0.5">In</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{rec.attendance.check_in || '--:--'}</span>
                                    </div>
                                    <div className="w-px bg-slate-200 dark:bg-zinc-700"></div>
                                    <div className="flex flex-col">
                                        <span className="uppercase text-[10px] tracking-wider mb-0.5">Out</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{rec.attendance.check_out || '--:--'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {records.length === 0 && !loading && (
                        <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-[2rem]">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No reportees found or no data available.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const MyLeaves = () => {
        const [leaves, setLeaves] = useState<any[]>([]);
        const [showForm, setShowForm] = useState(false);
        const [formData, setFormData] = useState({ leave_type_id: '', type: 'Annual', from: '', to: '', reason: '' });
        const [submitting, setSubmitting] = useState(false);

        useEffect(() => {
            if (currentEmployee) refreshLeaves();
        }, [currentEmployee]);

        // Set initial leave type when leaveTypes load
        useEffect(() => {
            if (leaveTypes.length > 0 && !formData.leave_type_id) {
                setFormData(prev => ({ ...prev, leave_type_id: leaveTypes[0].id, type: leaveTypes[0].name }));
            }
        }, [leaveTypes]);

        const refreshLeaves = async () => {
            const { data } = await supabase.from('leaves').select('*').eq('employee_id', currentEmployee.id).order('created_at', { ascending: false });
            if (data) setLeaves(data);
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);

            const { data, error } = await (supabase as any).from('leaves').insert([{
                employee_id: currentEmployee.id,
                leave_type_id: parseInt(formData.leave_type_id),
                start_date: formData.from,
                end_date: formData.to,
                reason: formData.reason,
                status: 'Pending',
                company_id: currentEmployee.company_id
            }]).select();

            if (error) {
                alert('Failed to submit leave application: ' + error.message);
                setSubmitting(false);
                return;
            }

            // Trigger Workflow
            if (data && currentEmployee) {
                try {
                    await WorkflowEngine.startWorkflow(
                        currentEmployee.company_id,
                        'LEAVE_REQUEST',
                        data[0].id,
                        currentEmployee.id,
                        'HRMS'
                    );
                } catch (wfErr) {
                    console.warn('Workflow trigger failed (may not be configured):', wfErr);
                }
            }

            alert('Leave application submitted successfully!');
            setShowForm(false);
            setSubmitting(false);
            refreshLeaves();
            setFormData({ leave_type_id: leaveTypes[0]?.id || '', type: leaveTypes[0]?.name || 'Annual', from: '', to: '', reason: '' });
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">My Leaves</h1>
                        <p className="text-slate-500">Manage your time off.</p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20">
                        {showForm ? 'Cancel' : '+ Apply Leave'}
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-10 bg-white dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-lg animate-in slide-in-from-top-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
                                <select className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" value={formData.leave_type_id} onChange={e => { const lt = leaveTypes.find((t: any) => t.id === e.target.value); setFormData({ ...formData, leave_type_id: e.target.value, type: lt?.name || e.target.value }); }}>
                                    {leaveTypes.length > 0 ? leaveTypes.map((lt: any) => (
                                        <option key={lt.id} value={lt.id}>{lt.name}</option>
                                    )) : (
                                        <>
                                            <option>Annual</option>
                                            <option>Sick</option>
                                            <option>Casual</option>
                                            <option>Unpaid</option>
                                        </>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From</label>
                                <input type="date" required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" value={formData.from} onChange={e => setFormData({ ...formData, from: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To</label>
                                <input type="date" required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" value={formData.to} onChange={e => setFormData({ ...formData, to: e.target.value })} />
                            </div>
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reason</label>
                            <input type="text" required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" placeholder="Going to Hawaii..." value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                        </div>
                        <div className="text-right">
                            <button type="submit" disabled={submitting} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Submitting...' : 'Submit Application'}</button>
                        </div>
                    </form>
                )}

                <div className="space-y-4">
                    {leaves.map(leave => (
                        <div key={leave.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 rounded-xl text-slate-500">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{leave.leave_type} Leave</h3>
                                    <p className="text-sm text-slate-500">{new Date(leave.start_date).toLocaleDateString()} &rarr; {new Date(leave.end_date).toLocaleDateString()} • <span className="italic">{leave.reason}</span></p>
                                </div>
                            </div>
                            <span className={`px-4 py-2 font-bold text-sm rounded-xl ${leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                leave.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                {leave.status}
                            </span>
                        </div>
                    ))}
                    {leaves.length === 0 && !showForm && (
                        <p className="text-center text-slate-400 py-10">No leave history.</p>
                    )}
                </div>
            </div>
        );
    };




    const Resignation = () => {
        const [activeResignation, setActiveResignation] = useState<any>(null);
        const [formData, setFormData] = useState({ category: 'Personal Reasons', reason: '', lastDate: '' });
        const [loading, setLoading] = useState(false);

        useEffect(() => {
            const checkStatus = async () => {
                if (!currentEmployee) return;
                const { data } = await supabase.from('resignations').select('*').eq('employee_id', currentEmployee.id).in('status', ['Pending', 'Approved']).single();
                if (data) setActiveResignation(data);
            };
            checkStatus();
        }, [currentEmployee]);

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!currentEmployee) return;
            setLoading(true);
            const { data: newResignation, error } = await supabase.from('resignations').insert([{
                company_id: currentEmployee.company_id,
                employee_id: currentEmployee.id,
                reason_category: formData.category,
                reason_text: formData.reason,
                proposed_last_working_date: formData.lastDate,
                status: 'Pending'
            }]).select().single();

            if (!error && newResignation) {
                // Trigger Workflow
                try {
                    await WorkflowEngine.startWorkflow(
                        currentEmployee.company_id,
                        'RESIGNATION',
                        newResignation.id,
                        currentEmployee.id,
                        'HRMS'
                    );
                } catch (wfErr) {
                    console.warn('Workflow trigger failed (may not be configured):', wfErr);
                }

                // simple refresh
                const { data } = await supabase.from('resignations').select('*').eq('employee_id', currentEmployee.id).order('created_at', { ascending: false }).limit(1).single();
                setActiveResignation(data);
            }
            setLoading(false);
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Resignation</h1>
                <p className="text-slate-500 mb-10">Submit your resignation request</p>

                {activeResignation ? (
                    <div className="max-w-2xl bg-white dark:bg-zinc-900/50 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-xl text-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <LogOut className="w-8 h-8 text-slate-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Request Submitted</h2>
                        <p className="text-slate-500 mb-6">Your resignation request is currently <strong>{activeResignation.status}</strong>.</p>
                        <div className="text-left bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-2xl text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Proposed Last Day:</span>
                                <span className="font-bold">{new Date(activeResignation.proposed_last_working_date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Reason:</span>
                                <span>{activeResignation.reason_category}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="max-w-xl bg-white dark:bg-zinc-900/50 p-8 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-xl">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reason Category</label>
                                <select
                                    className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <option>Personal Reasons</option>
                                    <option>Better Opportunity</option>
                                    <option>Relocation</option>
                                    <option>Health</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Detailed Reason</label>
                                <textarea
                                    required
                                    className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[120px] text-slate-900 dark:text-white"
                                    placeholder="Please allow me to resign..."
                                    value={formData.reason}
                                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Proposed Last Working Day</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
                                    value={formData.lastDate}
                                    onChange={e => setFormData({ ...formData, lastDate: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Submitting...' : 'Submit Resignation'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        );
    };

    const Announcements = () => {
        const [list, setList] = useState<any[]>([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            if (currentEmployee) fetchAnnouncements();
        }, [currentEmployee]);

        const fetchAnnouncements = async () => {
            setLoading(true);
            const { data } = await supabase.from('announcements')
                .select('*')
                .eq('company_id', currentEmployee.company_id)
                .order('created_at', { ascending: false });
            if (data) setList(data);
            setLoading(false);
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Announcements</h1>
                <p className="text-slate-500 mb-8">Stay updated with company news.</p>

                {loading ? (
                    <div className="text-center text-slate-400 py-10">Loading announcements...</div>
                ) : list.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                        <Bell className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-medium">No announcements yet</p>
                    </div>
                ) : (
                    <div className="space-y-6 max-w-4xl">
                        {list.map(item => (
                            <div key={item.id} className={`p-6 rounded-2xl border ${item.is_pinned ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white border-slate-200 dark:bg-zinc-900/50 dark:border-zinc-800'} shadow-sm`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${item.is_pinned ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {item.is_pinned ? <MapPin className="w-5 h-5 fill-current" /> : <Bell className="w-5 h-5" />}
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{item.title}</h3>
                                    </div>
                                    <span className="text-xs font-bold text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="prose dark:prose-invert max-w-none">
                                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const KudosRewards = () => {
        const [feed, setFeed] = useState<any[]>([]);
        const [categories, setCategories] = useState<any[]>([]);
        const [peers, setPeers] = useState<any[]>([]);
        const [showGiveModal, setShowGiveModal] = useState(false);
        const [giveForm, setGiveForm] = useState({ receiverId: '', categoryId: '', message: '' });

        useEffect(() => {
            if (currentEmployee) {
                fetchFeed();
                fetchCategories();
                fetchPeers();
            }
        }, [currentEmployee]);

        const fetchFeed = async () => {
            const { data } = await supabase.from('kudos_rewards')
                .select(`
                    *,
                    sender:sender_id(name, designation, profile_photo_url),
                    receiver:receiver_id(name, designation, profile_photo_url),
                    category:category_id(name, icon, points)
                `)
                .eq('company_id', currentEmployee.company_id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setFeed(data);
        };

        const fetchCategories = async () => {
            const { data } = await supabase.from('master_kudos_categories')
                .select('*')
                .eq('company_id', currentEmployee.company_id)
                .eq('status', 'Active');
            if (data) setCategories(data);
        };

        const fetchPeers = async () => {
            const { data } = await supabase.from('employees')
                .select('id, name, designation')
                .eq('company_id', currentEmployee.company_id)
                .eq('status', 'Active')
                .neq('id', currentEmployee.id); // Cannot give kudos to self
            if (data) setPeers(data);
        };

        const handleGiveKudos = async (e: React.FormEvent) => {
            e.preventDefault();
            const { error } = await (supabase as any).from('kudos_rewards').insert([{
                company_id: currentEmployee.company_id,
                sender_id: currentEmployee.id,
                receiver_id: giveForm.receiverId,
                category_id: parseInt(giveForm.categoryId),
                message: giveForm.message
            }]);

            if (!error) {
                setShowGiveModal(false);
                setGiveForm({ receiverId: '', categoryId: '', message: '' });
                fetchFeed();
            } else {
                alert("Failed to send kudos. Please try again.");
            }
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Kudos & Rewards</h1>
                        <p className="text-slate-500 font-medium">Celebrate your team's wins!</p>
                    </div>
                    <button
                        onClick={() => setShowGiveModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-500/30 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Star className="w-5 h-5 fill-current" /> Give Kudos
                    </button>
                </div>

                {/* Feed */}
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Poll Removed - Now in Buzz Feed module */}

                    {feed.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Star className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Be the first to recognize a colleague!</p>
                        </div>
                    ) : (
                        feed.map((kudos) => (
                            <div key={kudos.id} className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                                {/* Decorative BG */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 rounded-bl-[100%] -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 font-bold">
                                            {kudos.sender?.name?.[0]}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{kudos.sender?.name}</span>
                                            <span className="text-xs text-slate-500">recognized <span className="text-indigo-600 dark:text-indigo-400 font-bold">{kudos.receiver?.name}</span></span>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="text-4xl">{kudos.category?.icon || '🏆'}</div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{kudos.category?.name}</h3>
                                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed italic">"{kudos.message}"</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-50 dark:border-zinc-800">
                                        <div className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            <Clock className="w-3 h-3" />
                                            {new Date(kudos.created_at).toLocaleDateString()}
                                        </div>
                                        {kudos.category?.points > 0 && (
                                            <div className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 rounded-full text-xs font-bold flex items-center gap-1">
                                                <Star className="w-3 h-3 fill-current" />
                                                {kudos.category?.points} Points
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Give Kudos Modal */}
                {showGiveModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2rem] p-8 shadow-2xl animate-scale-up relative">
                            <button onClick={() => setShowGiveModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><LogOut className="w-4 h-4 text-slate-400 rotate-180" /></button>

                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Give Kudos</h2>

                            <form onSubmit={handleGiveKudos} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Peer</label>
                                    <select
                                        required
                                        className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white"
                                        value={giveForm.receiverId}
                                        onChange={e => setGiveForm({ ...giveForm, receiverId: e.target.value })}
                                    >
                                        <option value="">Choose a colleague...</option>
                                        {peers.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} - {p.designation}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Category</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {categories.map(cat => (
                                            <div
                                                key={cat.id}
                                                onClick={() => setGiveForm({ ...giveForm, categoryId: cat.id })}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${String(giveForm.categoryId) === String(cat.id)
                                                    ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500'
                                                    : 'bg-white border-slate-200 hover:border-indigo-300'
                                                    }`}
                                            >
                                                <span className="text-xl">{cat.icon || '🏆'}</span>
                                                <span className="text-sm font-bold text-slate-700">{cat.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message</label>
                                    <textarea
                                        required
                                        placeholder="What did they do great?"
                                        className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none h-32 resize-none text-slate-900 dark:text-white"
                                        value={giveForm.message}
                                        onChange={e => setGiveForm({ ...giveForm, message: e.target.value })}
                                    ></textarea>
                                </div>

                                <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors active:scale-95">
                                    Send Kudos 🚀
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const Support = () => {
        const [tickets, setTickets] = useState<any[]>([]);
        const [showForm, setShowForm] = useState(false);
        const [formData, setFormData] = useState({ subject: '', category: 'IT Support', priority: 'Medium', description: '' });

        useEffect(() => {
            if (currentEmployee) refreshTickets();
        }, [currentEmployee]);

        const refreshTickets = async () => {
            const { data } = await supabase.from('tickets').select('*').eq('employee_id', currentEmployee.id).order('created_at', { ascending: false });
            if (data) setTickets(data);
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            const { error } = await ((supabase as any).from('tickets').insert as any)([{
                company_id: currentEmployee.company_id,
                employee_id: currentEmployee.id,
                subject: formData.subject,
                category: formData.category,
                priority: formData.priority,
                description: formData.description,
                status: 'Open',
                created_at: new Date().toISOString()
            }]);
            if (!error) {
                setShowForm(false);
                setFormData({ subject: '', category: 'IT Support', priority: 'Medium', description: '' });
                refreshTickets();
            } else {
                alert("Failed to submit ticket: " + error.message);
            }
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Help Desk</h1>
                        <p className="text-slate-500">Raise tickets for IT, HR, or Payroll.</p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">
                        {showForm ? 'Cancel' : '+ New Ticket'}
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-10 bg-white dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-lg animate-in slide-in-from-top-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                                <select className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                    <option>IT Support</option>
                                    <option>HR Query</option>
                                    <option>Payroll Discrepancy</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Priority</label>
                                <select className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                </select>
                            </div>
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                            <input type="text" required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} />
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                            <textarea required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none h-24 text-slate-900 dark:text-white" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                        </div>
                        <div className="text-right">
                            <button type="submit" className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/30">Submit Ticket</button>
                        </div>
                    </form>
                )}

                <div className="space-y-4">
                    {tickets.map(ticket => (
                        <div key={ticket.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${ticket.status === 'Open' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    <Headphones className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{ticket.subject}</h3>
                                    <p className="text-sm text-slate-500">{ticket.category} • {new Date(ticket.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <span className={`px-3 py-1 text-xs font-bold uppercase rounded-lg ${ticket.status === 'Open' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                {ticket.status}
                            </span>
                        </div>
                    ))}
                    {tickets.length === 0 && !showForm && (
                        <p className="text-center text-slate-400 py-10">No tickets found.</p>
                    )}
                </div>
            </div>
        );
    };


    const MyPayslips = () => {
        const [payslips, setPayslips] = useState<any[]>([]);

        useEffect(() => {
            const fetchPayslips = async () => {
                if (!currentEmployee) return;
                const { data } = await supabase.from('payroll').select('*').eq('employee_id', currentEmployee.id).order('month', { ascending: false });
                if (data) setPayslips(data);
            };
            fetchPayslips();
        }, [currentEmployee]);

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-8">My Payslips</h1>
                {payslips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-medium">No details available</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {payslips.map(slip => (
                            <div key={slip.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-lg uppercase">{slip.status}</span>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{new Date(slip.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                                <p className="text-slate-500 text-sm font-medium mb-6">Net Pay: <span className="text-slate-900 dark:text-white font-bold">${slip.net_salary.toLocaleString()}</span></p>

                                <button className="w-full py-3 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2">
                                    <Monitor className="w-4 h-4" /> View Slip
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const MyAssets = () => {
        const [assets, setAssets] = useState<any[]>([]);

        useEffect(() => {
            const fetchAssets = async () => {
                if (!currentEmployee) return;
                const { data } = await supabase.from('assets').select('*').eq('assigned_to', currentEmployee.id).eq('status', 'Assigned');
                if (data) setAssets(data);
            };
            fetchAssets();
        }, [currentEmployee]);

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-8">My Assets</h1>
                {assets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                        <Monitor className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-medium">No assets assigned</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {assets.map(asset => (
                            <div key={asset.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-6">
                                <div className="p-4 bg-slate-100 dark:bg-zinc-800 rounded-2xl text-slate-500">
                                    <Monitor className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{asset.name}</h3>
                                    <p className="text-sm text-slate-500 font-mono mb-2">{asset.asset_id}</p>
                                    <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 rounded-lg uppercase tracking-wide">
                                        {asset.type}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const Buzz = () => {
        const [polls, setPolls] = useState<any[]>([]);

        useEffect(() => {
            fetchPolls();
        }, []);

        const fetchPolls = async () => {
            if (!currentEmployee) return;
            const { data: pl } = await (supabase as any).from('polls')
                .select('*, poll_options(*)')
                .eq('company_id', currentEmployee.company_id)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (pl) {
                const { data: votes } = await (supabase as any).from('poll_votes').select('poll_id, option_id').eq('employee_id', currentEmployee.id);

                const merged = (pl as any[]).map(p => ({
                    ...p,
                    poll_options: p.poll_options.sort((a: any, b: any) => b.vote_count - a.vote_count), // Show popular first
                    my_vote: (votes as any[])?.find(v => v.poll_id === p.id)?.option_id,
                    total_votes: p.poll_options.reduce((sum: number, o: any) => sum + o.vote_count, 0)
                }));
                setPolls(merged);
            }
        };

        const handleVote = async (pollId: string, optionId: string) => {
            const { error } = await (supabase as any).rpc('rpc_vote_poll', {
                p_poll_id: pollId,
                p_option_id: optionId,
                p_employee_id: (currentEmployee as any).id
            });

            if (error) alert(error.message);
            else fetchPolls();
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-8">Buzz Feed</h1>
                <div className="max-w-3xl space-y-8">
                    {/* Announcements */}
                    {announcements.map(ann => (
                        <div key={ann.id} className={`bg-white dark:bg-zinc-900/50 p-8 rounded-[2rem] border ${ann.is_pinned ? 'border-indigo-200 dark:border-indigo-900 ring-4 ring-indigo-50 dark:ring-indigo-900/20' : 'border-slate-200 dark:border-zinc-800'} shadow-lg relative overflow-hidden`}>
                            {ann.is_pinned && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Pinned</div>}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-lg ${ann.type === 'Alert' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    <Radio className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{ann.title}</h3>
                                    <p className="text-xs text-slate-500">{new Date(ann.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg whitespace-pre-wrap">{ann.content}</p>
                        </div>
                    ))}

                    {/* Polls */}
                    {polls.map(poll => (
                        <div key={poll.id} className="bg-gradient-to-br from-indigo-600 to-violet-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-500/20">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg">
                                    <Users className="w-5 h-5" />
                                </div>
                                <span className="font-bold uppercase tracking-widest text-sm opacity-80">Team Poll</span>
                                <span className="ml-auto text-xs font-mono opacity-60">{poll.total_votes} votes</span>
                            </div>
                            <h3 className="text-2xl font-bold mb-6">{poll.question}</h3>
                            <div className="space-y-3">
                                {poll.poll_options.map((opt: any) => {
                                    const percent = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                                    const isVoted = poll.my_vote === opt.id;
                                    const isDisabled = !!poll.my_vote; // Disable if already voted

                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => !isDisabled && handleVote(poll.id, opt.id)}
                                            disabled={isDisabled}
                                            className={`w-full text-left p-4 rounded-xl relative overflow-hidden transition-all border ${isVoted ? 'bg-white text-indigo-900 border-white' : 'bg-white/10 border-white/10 hover:bg-white/20'} font-medium flex justify-between group`}
                                        >
                                            {/* Progress Bar Background */}
                                            {isDisabled && <div className="absolute inset-0 bg-white/20" style={{ width: `${percent}%` }}></div>}

                                            <div className="relative z-10 flex justify-between w-full items-center">
                                                <span className="flex items-center gap-2">
                                                    {opt.option_text}
                                                    {isVoted && <Check className="w-4 h-4" />}
                                                </span>
                                                {isDisabled ? (
                                                    <span className="font-bold">{percent}%</span>
                                                ) : (
                                                    <span className="opacity-0 group-hover:opacity-100">Vote</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };



    const Surveys = () => {
        const [surveys, setSurveys] = useState<any[]>([]);
        const [activeSurvey, setActiveSurvey] = useState<any | null>(null);
        const [questions, setQuestions] = useState<any[]>([]);
        const [answers, setAnswers] = useState<Record<string, any>>({});
        const [showModal, setShowModal] = useState(false);

        useEffect(() => {
            const fetchSurveys = async () => {
                if (!currentEmployee) return;
                // Fetch active surveys
                const { data } = await supabase.from('surveys').select('*').eq('company_id', currentEmployee.company_id).eq('is_active', true);
                if (data) setSurveys(data);
            };
            fetchSurveys();
        }, [currentEmployee]);

        const startSurvey = async (survey: any) => {
            const { data } = await supabase.from('survey_questions').select('*').eq('survey_id', survey.id).order('created_at');
            if (data) {
                setQuestions(data);
                setActiveSurvey(survey);
                setShowModal(true);
                setAnswers({});
            }
        };

        const submitSurvey = async () => {
            if (!activeSurvey || !currentEmployee) return;
            const { error } = await supabase.from('survey_responses').insert([{
                company_id: currentEmployee.company_id,
                survey_id: activeSurvey.id,
                employee_id: currentEmployee.id,
                responses: answers
            }]);

            if (!error) {
                alert("Thank you for your feedback!");
                setShowModal(false);
                setActiveSurvey(null);
            } else {
                alert("Failed to submit. Please try again.");
            }
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-8">Surveys</h1>
                {surveys.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                        <Clipboard className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-medium">No active surveys</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {surveys.map(item => (
                            <div key={item.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between h-48">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{item.title}</h3>
                                    <p className="text-slate-500 text-sm line-clamp-3">{item.description}</p>
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expires: {new Date(item.expiration_date).toLocaleDateString()}</span>
                                    <button onClick={() => startSurvey(item)} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">Start Survey</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showModal && activeSurvey && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2rem] p-8 shadow-2xl animate-scale-up relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><LogOut className="w-4 h-4 text-slate-400 rotate-180" /></button>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{activeSurvey.title}</h2>
                            <div className="space-y-6 mb-8">
                                {questions.map((q, idx) => (
                                    <div key={q.id}>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{idx + 1}. {q.question_text}</label>
                                        {q.question_type === 'Text' ? (
                                            <textarea className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" rows={3} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}></textarea>
                                        ) : q.question_type === 'Multiple Choice' ? (
                                            <div className="space-y-2">
                                                {q.options?.map((opt: string) => (
                                                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name={q.id} value={opt} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} className="w-4 h-4 text-indigo-600" />
                                                        <span className="text-slate-600">{opt}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                            <button onClick={submitSurvey} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors">Submit Responses</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const Learning = () => {
        const [courses, setCourses] = useState<any[]>([]);

        useEffect(() => {
            const fetchCourses = async () => {
                if (!currentEmployee) return;
                const { data } = await supabase.from('learning_courses').select('*').eq('company_id', currentEmployee.company_id).eq('is_published', true);
                if (data) setCourses(data);
            };
            fetchCourses();
        }, [currentEmployee]);

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-8">Learning Center</h1>
                {courses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                        <BookOpen className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-medium">No courses available</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {courses.map(course => (
                            <div key={course.id} className="group bg-white dark:bg-zinc-900/50 rounded-[2rem] border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                <div className="h-48 bg-slate-200 dark:bg-zinc-800 relative">
                                    {course.thumbnail_url ? (
                                        <img src={course.thumbnail_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                            <BookOpen className="w-12 h-12 text-white/50" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 transition-colors">{course.title}</h3>
                                    <p className="text-slate-500 text-sm mb-6 line-clamp-2">{course.description}</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{course.total_modules} Modules</span>
                                        <button className="text-indigo-600 font-bold text-sm">Start Learning &rarr;</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };




    return (
        <div className="flex h-full relative z-10 overflow-hidden bg-slate-50 dark:bg-black">
            {/* Expanded Sidebar for ESSP */}
            <div className="w-20 lg:w-72 flex-shrink-0 bg-white/80 dark:bg-zinc-900/80 border-r border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden backdrop-blur-xl">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <img src={KAA_LOGO_URL} alt="Logo" className="h-8 w-auto" />
                        <span className="text-xl font-black text-slate-800 dark:text-white tracking-tighter hidden lg:block">ESSP</span>
                    </div>
                    <div className="flex flex-col gap-1 overflow-y-auto h-[calc(100vh-140px)] pr-2 scrollbar-hide">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-200 group ${activeTab === item.id
                                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.id ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                <span className="font-bold text-sm hidden lg:block">{item.label}</span>
                                {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 hidden lg:block"></div>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'DASHBOARD' && <Dashboard />}
                {activeTab === 'ASSISTANT' && <AssistantView />}
                {activeTab === 'SKILLS' && <SkillsView />}
                {activeTab === 'APPROVALS' && <MyApprovals />}
                {activeTab === 'PROFILE' && <MyProfile />}
                {activeTab === 'ATTENDANCE' && <MyAttendance />}
                {activeTab === 'TEAM_ATTENDANCE' && <TeamAttendance />}
                {activeTab === 'LEAVES' && <MyLeaves />}
                {activeTab === 'PAYSLIPS' && <MyPayslips />}
                {activeTab === 'ASSETS' && <MyAssets />}
                {activeTab === 'SUPPORT' && <Support />}
                {activeTab === 'RESIGNATION' && <Resignation />}
                {activeTab === 'ANNOUNCEMENTS' && <Announcements />}
                {activeTab === 'BUZZ' && <Buzz />}
                {activeTab === 'SURVEYS' && <Surveys />}
                {activeTab === 'KUDOS' && <KudosRewards />}
                {activeTab === 'DIRECTORY' && <PeopleDirectory />}
                {activeTab === 'LEARNING' && <Learning />}
                {activeTab === 'REPORTS' && <ReportsListView />}

                {activeTab !== 'DASHBOARD' && activeTab !== 'APPROVALS' && activeTab !== 'PROFILE' && activeTab !== 'ATTENDANCE' && activeTab !== 'TEAM_ATTENDANCE' && activeTab !== 'LEAVES' && activeTab !== 'PAYSLIPS' && activeTab !== 'ASSETS' && activeTab !== 'SUPPORT' && activeTab !== 'RESIGNATION' && activeTab !== 'BUZZ' && activeTab !== 'SURVEYS' && activeTab !== 'KUDOS' && activeTab !== 'DIRECTORY' && activeTab !== 'LEARNING' && activeTab !== 'REPORTS' && (
                    <div className="p-10 flex flex-col items-center justify-center h-full text-slate-400 animate-page-enter">
                        <Settings className="w-16 h-16 mb-6 opacity-20" />
                        <h2 className="text-2xl font-black text-slate-300 dark:text-zinc-700 mb-2">Module Loading...</h2>
                        <p className="font-medium">The {navItems.find(n => n.id === activeTab)?.label} module is being initialized.</p>
                    </div>
                )}
            </div>
        </div>
    );
};



