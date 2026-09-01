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
    Folder,
    Zap, // [NEW] For Insights
    Landmark,
    X,
    Paperclip,
    MessageSquare,
    ShieldCheck,
    Loader2,
    Mail,
    Phone
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest } from '../hrms/types';
import { KAA_LOGO_URL } from '../../constants';
import { ReportsListView } from './reports/ReportsListView';
import { TeamChat } from './TeamChat';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useESSP } from '../../contexts/ESSPContext';
import { useDelayLoading } from '../../contexts/GlobalLoadingContext';
import { TableSkeleton, DashboardSkeleton } from '../ui/LoadingSkeletons';
import { Modal } from '../ui/Modal';
import { WorkflowEngine } from '../../lib/WorkflowEngine'; // [NEW] Unified Engine
import { CareerTimeline } from '../hrms/transitions/CareerTimeline'; // [NEW] Integrated real timeline
// Reusing some components/styles from HRMS for consistency, but tailor for ESSP

// Reusable Workflow Timeline component
const WorkflowTimeline: React.FC<{ entityId: string }> = ({ entityId }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [instance, setInstance] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWorkflowLogs = async () => {
            setLoading(true);
            try {
                // Fetch the instance
                const { data: instData, error: instErr } = await (supabase as any)
                    .from('workflow_instances')
                    .select('*')
                    .eq('entity_id', entityId)
                    .maybeSingle();

                if (instErr) throw instErr;
                if (!instData) {
                    setLoading(false);
                    return;
                }

                const inst = instData as any;

                // Resolve assigned user if present
                if (inst.assigned_to_user_id) {
                    const { data: userProfile } = await (supabase as any)
                        .from('profiles')
                        .select('full_name')
                        .eq('id', inst.assigned_to_user_id)
                        .maybeSingle();
                    if (userProfile) {
                        inst.assigned_user_name = userProfile.full_name;
                    }
                }

                setInstance(inst);

                // Fetch action logs
                const { data: actionLogsData, error: logErr } = await (supabase as any)
                    .from('workflow_action_logs')
                    .select('*')
                    .eq('instance_id', inst.id)
                    .order('created_at', { ascending: true });

                if (logErr) throw logErr;

                const actionLogs = (actionLogsData || []) as any[];

                // Resolve actor names
                if (actionLogs && actionLogs.length > 0) {
                    const actorIds = Array.from(new Set(actionLogs.map(l => l.actor_id).filter(Boolean)));
                    const { data: actors } = await (supabase as any)
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', actorIds);

                    const actorMap = (actors || []).reduce((acc: any, curr: any) => {
                        acc[curr.id] = curr.full_name;
                        return acc;
                    }, {});

                    actionLogs.forEach(l => {
                        l.actor_name = actorMap[l.actor_id] || 'System';
                    });
                }

                setLogs(actionLogs);
            } catch (err) {
                console.error("Error fetching workflow logs:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchWorkflowLogs();
    }, [entityId]);

    if (loading) {
        return <div className="text-xs text-slate-400 dark:text-zinc-500 animate-pulse py-2">Loading workflow timeline...</div>;
    }

    if (!instance) {
        return (
            <div className="text-xs text-slate-400 dark:text-zinc-500 py-2 italic">
                No workflow timeline available for this request.
            </div>
        );
    }

    return (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 w-full text-left">
            <h4 className="text-xs font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider mb-3">Approval History</h4>
            <div className="relative border-l border-slate-200 dark:border-zinc-700 pl-4 ml-2 space-y-4">
                {/* Initial Step */}
                <div className="relative">
                    <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/20"></span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-350">Request Submitted</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">{new Date(instance.created_at).toLocaleString()}</p>
                </div>

                {/* Audit Logs */}
                {logs.map((log) => {
                    const isApprove = log.action === 'APPROVE';
                    const isReject = log.action === 'REJECT';
                    const actionColor = isApprove ? 'bg-emerald-500 ring-emerald-100 dark:ring-emerald-950/20' : isReject ? 'bg-rose-500 ring-rose-100 dark:ring-rose-950/20' : 'bg-amber-500 ring-amber-100 dark:ring-amber-950/20';
                    return (
                        <div key={log.id} className="relative">
                            <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${actionColor}`}></span>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-350">
                                {log.action === 'APPROVE' ? 'Approved' : log.action === 'REJECT' ? 'Rejected' : 'Commented'} by {log.actor_name || 'System'}
                            </p>
                            {log.comment && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 bg-slate-50 dark:bg-zinc-800/50 p-2 rounded-lg italic">
                                    "{log.comment}"
                                </p>
                            )}
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                    );
                })}

                {/* Current Pending Step */}
                {instance.status === 'PENDING' && (
                    <div className="relative">
                        <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950/20 animate-pulse"></span>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-350">Pending Review</p>
                        {instance.assigned_user_name && (
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">Assigned to: {instance.assigned_user_name}</p>
                        )}
                    </div>
                )}

                {/* Final Completed Step */}
                {instance.status === 'APPROVED' && (
                    <div className="relative">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/20"></span>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Request Approved &amp; Completed</p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">{new Date(instance.updated_at).toLocaleString()}</p>
                    </div>
                )}
                {instance.status === 'REJECTED' && (
                    <div className="relative">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100 dark:ring-rose-950/20"></span>
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-450">Request Rejected</p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">{new Date(instance.updated_at).toLocaleString()}</p>
                    </div>
                )}
            </div>
        </div>
    );
};


export const ESSP: React.FC = () => {
    const { employeeProfile, roleFlags, loading: esspLoading } = useESSP();
    const delayedLoading = useDelayLoading(esspLoading, 300);
    const { user } = useAuth(); // Restored for backward compatibility
    const currentEmployee = employeeProfile;
    const isManager = roleFlags.isManager;

    // Local state for dashboard data
    const [activeTab, setActiveTab] = useState('DASHBOARD');

    // Dashboard State
    const [punchStatus, setPunchStatus] = useState<'In' | 'Out'>('Out');
    const [punchLoading, setPunchLoading] = useState(false);
    const [lastAttendanceId, setLastAttendanceId] = useState<string | null>(null);
    const [activePunchTime, setActivePunchTime] = useState<string | null>(null);
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
        // 1. Attendance Status: look for active session within a sane 16-hour shift window
        const sixteenHoursAgo = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString();
        const { data: activePunches } = await supabase.from('attendance')
            .select('*')
            .eq('employee_id', empId)
            .is('check_out', null)
            .not('check_in', 'is', null)
            .gte('check_in', sixteenHoursAgo) // Sane active session window (supports night shifts up to 16h)
            .order('check_in', { ascending: false })
            .limit(1);

        const activePunch = activePunches && activePunches.length > 0 ? activePunches[0] : null;

        if (activePunch && activePunch.check_in) {
            setPunchStatus('In');
            setLastAttendanceId(activePunch.id);
            setActivePunchTime(activePunch.check_in);
        } else {
            setPunchStatus('Out');
            setLastAttendanceId(null);
            setActivePunchTime(null);
        }

        // 2. Attendance Log (Recent 3)
        const { data: recentLogs } = await supabase.from('attendance')
            .select('*').eq('employee_id', empId).order('date', { ascending: false }).limit(3);
        if (recentLogs) setAttendanceLog(recentLogs);

        // 3. Leave Balance (Real DB query from employee_leave_balances & org_leave_types)
        if (companyId) {
            const { data: ltData } = await supabase.from('org_leave_types')
                .select('*').eq('company_id', companyId);
            if (ltData && ltData.length > 0) {
                setLeaveTypes(ltData);
            }
        }

        const { data: empBalData } = await supabase.from('employee_leave_balances')
            .select('*')
            .eq('employee_id', empId);

        if (empBalData && empBalData.length > 0) {
            const totalRemaining = empBalData.reduce((sum: number, b: any) => {
                const rem = b.remaining != null ? Number(b.remaining) : ((Number(b.total_balance) || 0) - (Number(b.used) || 0));
                return sum + Math.max(0, rem);
            }, 0);
            setLeaveBalance(totalRemaining);
        } else {
            let totalDefaultBalance = 22;
            if (leaveTypes && leaveTypes.length > 0) {
                totalDefaultBalance = leaveTypes.reduce((sum: number, lt: any) => sum + (lt.default_balance || 0), 0);
            }
            const currentYear = new Date().getFullYear();
            const { data: approvedLeaves } = await supabase.from('leaves')
                .select('start_date, end_date')
                .eq('employee_id', empId)
                .eq('status', 'Approved')
                .gte('start_date', `${currentYear}-01-01`);

            let approvedDays = 0;
            if (approvedLeaves) {
                approvedLeaves.forEach((l: any) => {
                    if (l.start_date && l.end_date) {
                        const start = new Date(l.start_date);
                        const end = new Date(l.end_date);
                        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                            const diffMs = end.getTime() - start.getTime();
                            const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
                            if (days > 0) approvedDays += days;
                        }
                    }
                });
            }
            setLeaveBalance(Math.max(0, totalDefaultBalance - approvedDays));
        }

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

    const getCurrentLocationCoords = (): Promise<{ lat: number; lng: number } | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser or environment.");
                resolve(null);
                return;
            }
            // First attempt with high accuracy
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn("High accuracy geolocation failed, trying fallback:", error);
                    // Fallback attempt without high accuracy (faster / less strict on devices)
                    navigator.geolocation.getCurrentPosition(
                        (fallbackPos) => {
                            resolve({
                                lat: fallbackPos.coords.latitude,
                                lng: fallbackPos.coords.longitude
                            });
                        },
                        (fallbackError) => {
                            console.error("Geolocation failed completely:", fallbackError);
                            let msg = "Could not retrieve your location. ";
                            if (fallbackError.code === fallbackError.PERMISSION_DENIED) {
                                msg += "Location permission was denied. Please allow location access in your browser settings.";
                            } else if (fallbackError.code === fallbackError.POSITION_UNAVAILABLE) {
                                msg += "Position unavailable. Please ensure GPS/Location service is turned on.";
                            } else if (fallbackError.code === fallbackError.TIMEOUT) {
                                msg += "Location request timed out. Please try again.";
                            } else {
                                msg += fallbackError.message || "Please check your location settings.";
                            }
                            alert(msg);
                            resolve(null);
                        },
                        { timeout: 15000, enableHighAccuracy: false }
                    );
                },
                { timeout: 10000, enableHighAccuracy: true }
            );
        });
    };

    const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    };

    const handlePunch = async () => {
        if (!currentEmployee) {
            alert("Employee profile not loaded yet. Please wait a moment or refresh.");
            return;
        }
        setPunchLoading(true);

        try {
            // 1. Fetch current employee config
            const { data: empRecord } = await (supabase as any)
                .from('employees')
                .select('punch_mode, gps_punch_enabled, geo_latitude, geo_longitude, geofence_radius_meters')
                .eq('id', currentEmployee.id)
                .maybeSingle();

            const punchMode = empRecord?.punch_mode || (currentEmployee as any).punch_mode || 'BOTH';
            const gpsEnabled = empRecord?.gps_punch_enabled ?? (currentEmployee as any).gps_punch_enabled ?? true;

            // Validation 1: Punch Mode check
            if (punchMode === 'DEVICE') {
                alert("You are configured for Biometric Device punch only. Web punch is disabled.");
                setPunchLoading(false);
                return;
            }

            // Validation 2: GPS check
            let coords: { lat: number; lng: number } | null = null;
            if (gpsEnabled !== false) {
                coords = await getCurrentLocationCoords();
                if (!coords) {
                    setPunchLoading(false);
                    return;
                }

            // Fetch employee's mapped locations
            const { data: mappedLocs } = await (supabase as any)
                .from('employee_locations')
                .select('*')
                .eq('employee_id', currentEmployee.id);

            const geofences: { lat: number; lng: number; radius: number }[] = [];

            if (mappedLocs && mappedLocs.length > 0) {
                mappedLocs.forEach((l: any) => {
                    const lat = parseFloat(l.latitude != null ? l.latitude : l.geo_latitude);
                    const lng = parseFloat(l.longitude != null ? l.longitude : l.geo_longitude);
                    const radius = Number(l.geofence_radius_meters || l.radius_meters || 500);
                    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
                        geofences.push({ lat, lng, radius });
                    }
                });
            } else {
                // Fallback to employee base coordinates if no mapped locations exist
                const empLat = Number((currentEmployee as any).geo_latitude || empRecord?.geo_latitude);
                const empLng = Number((currentEmployee as any).geo_longitude || empRecord?.geo_longitude);
                const empRadius = Number((currentEmployee as any).geofence_radius_meters || empRecord?.geofence_radius_meters || 500);

                if (!isNaN(empLat) && !isNaN(empLng) && (empLat !== 0 || empLng !== 0)) {
                    geofences.push({ lat: empLat, lng: empLng, radius: empRadius });
                }
            }

            if (geofences.length > 0) {
                const isInAnyFence = geofences.some(gf => {
                    const dist = calculateDistanceMeters(coords!.lat, coords!.lng, gf.lat, gf.lng);
                    return dist <= gf.radius;
                });

                if (!isInAnyFence) {
                    alert("Punch blocked: You are currently outside your designated work location(s).");
                    setPunchLoading(false);
                    return;
                }
            }
        }

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const isoNow = now.toISOString();
        const locStr = coords ? `${coords.lat},${coords.lng}` : null;

        if (punchStatus === 'Out') {
            // First check if there is an open overnight session from yesterday
            const sixteenHoursAgo = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString();
            const { data: openSessions } = await (supabase as any).from('attendance')
                .select('id, check_in, date')
                .eq('employee_id', currentEmployee.id)
                .is('check_out', null)
                .not('check_in', 'is', null)
                .gte('check_in', sixteenHoursAgo)
                .order('check_in', { ascending: false })
                .limit(1);

            const openNightSession = openSessions && openSessions.length > 0 ? openSessions[0] : null;

            if (openNightSession && openNightSession.date !== today) {
                await performPunchOut(openNightSession.id, openNightSession.check_in, isoNow, locStr, coords);
                setPunchStatus('Out');
                setLastAttendanceId(null);
                setActivePunchTime(null);
                alert("Night shift check-out recorded successfully!");
            } else {
                // Standard PUNCH IN
                const insertPayload = {
                    employee_id: currentEmployee.id,
                    company_id: currentEmployee.company_id,
                    date: today,
                    check_in: isoNow,
                    check_in_lat: coords ? coords.lat : null,
                    check_in_lng: coords ? coords.lng : null,
                    check_in_location: locStr,
                    punch_method: 'ONLINE',
                    status: 'Present',
                    total_hours: 0,
                    source: 'punch'
                };

                const { data, error } = await (supabase as any).from('attendance').upsert([insertPayload], { onConflict: 'employee_id,date' }).select().single();

                if (error) {
                    console.error("Punch In Error:", error);
                    alert("Failed to punch in. Please try again.");
                } else {
                    setPunchStatus('In');
                    setLastAttendanceId(data.id);
                    setActivePunchTime(isoNow);
                }
            }
        } else {
            // PUNCH OUT - Always query active open punch directly within the 16-hour session window
            const sixteenHoursAgo = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString();
            const { data: activePunches } = await (supabase as any).from('attendance')
                .select('id, check_in')
                .eq('employee_id', currentEmployee.id)
                .is('check_out', null)
                .not('check_in', 'is', null)
                .gte('check_in', sixteenHoursAgo)
                .order('check_in', { ascending: false })
                .limit(1);

            const activePunch = activePunches && activePunches.length > 0 ? activePunches[0] : null;

            if (!activePunch) {
                alert("No active session found to punch out from.");
                setPunchLoading(false);
                setPunchStatus('Out');
                setLastAttendanceId(null);
                setActivePunchTime(null);
                return;
            }

            await performPunchOut(activePunch.id, activePunch.check_in, isoNow, locStr, coords);
        }

        await refreshDashboard(currentEmployee.id, currentEmployee.company_id);
        } catch (err: any) {
            console.error("Punch execution error:", err);
            alert("An unexpected error occurred while processing punch: " + (err.message || String(err)));
        } finally {
            setPunchLoading(false);
        }
    };

    const performPunchOut = async (
        recordId: string,
        checkInTime: string,
        checkOutTime: string,
        locationStr: string | null = null,
        coords: { lat: number; lng: number } | null = null
    ) => {
        const d1 = new Date(checkInTime);
        const d2 = new Date(checkOutTime);
        const diffMs = Math.max(0, d2.getTime() - d1.getTime());
        // Cap duration at a maximum of 16 hours to prevent abnormal multi-day calculation anomalies
        const durationHours = Math.min(16, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));

        const updateData: any = {
            check_out: checkOutTime,
            check_out_lat: coords ? coords.lat : null,
            check_out_lng: coords ? coords.lng : null,
            total_hours: durationHours,
            duration: durationHours
        };
        if (locationStr) {
            updateData.check_out_location = locationStr;
        }

        const { data, error } = await (supabase as any).from('attendance').update(updateData).eq('id', recordId).select();

        if (error) {
            console.error("Punch Out Error:", error);
            alert("Failed to punch out: " + error.message);
        } else if (!data || data.length === 0) {
            console.error("Punch Out update returned 0 modified rows for id:", recordId);
            alert("Punch out failed: Could not update attendance session.");
        } else {
            setPunchStatus('Out');
            setLastAttendanceId(null);
            setActivePunchTime(null);
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
                                    {punchStatus === 'In'
                                        ? (activePunchTime
                                            ? `Checked in at ${new Date(activePunchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                            : 'You are currently active.')
                                        : 'Your session has ended. Ready to punch in.'}
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
        const [rejectingId, setRejectingId] = useState<string | null>(null);
        const [rejectComment, setRejectComment] = useState('');
        const [actionLoading, setActionLoading] = useState<string | null>(null);

        useEffect(() => {
            if (currentEmployee) fetchApprovals();
        }, [currentEmployee]);

        const fetchApprovals = async () => {
            setLoading(true);
            try {
                    const isHRorAdmin = roleFlags.isHR || roleFlags.isManager || roleFlags.isApprover || (currentEmployee as any)?.role === 'SUPER ADMIN' || (currentEmployee as any)?.role === 'Admin';
                    const results = await WorkflowEngine.getMyApprovals(currentEmployee.id, currentEmployee.company_id, isHRorAdmin);
                    setRequests(results || []);
            } catch (error) {
                console.error("Error fetching approvals:", error);
            }
            setLoading(false);
        };

        const handleApprove = async (id: string) => {
            if (!confirm('Are you sure you want to approve this request?')) return;
            setActionLoading(id);
            try {
                await WorkflowEngine.approve(id, currentEmployee?.id);
                fetchApprovals();
            } catch (err: any) {
                alert('Approval failed: ' + err.message);
            }
            setActionLoading(null);
        };

        const handleReject = async (id: string) => {
            setActionLoading(id);
            try {
                await WorkflowEngine.reject(id, currentEmployee?.id, rejectComment || undefined);
                setRejectingId(null);
                setRejectComment('');
                fetchApprovals();
            } catch (err: any) {
                alert('Rejection failed: ' + err.message);
            }
            setActionLoading(null);
        };

        const getTriggerLabel = (type: string) => {
            const labels: Record<string, string> = {
                'LEAVE_REQUEST': 'Leave Request',
                'OVERTIME_REQUEST': 'Overtime Request',
                'RESIGNATION': 'Resignation',
                'MISSED_PUNCH': 'Missed Punch',
                'SUPPORT_TICKET': 'Support Ticket',
                'EXPENSE_CLAIM': 'Expense Claim',
                'DEAL_APPROVAL': 'Deal Approval',
                'DOCUMENT_APPROVAL': 'Document Approval'
            };
            return labels[type] || type;
        };

        const getTriggerColor = (type: string) => {
            const colors: Record<string, string> = {
                'LEAVE_REQUEST': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                'OVERTIME_REQUEST': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                'RESIGNATION': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
                'MISSED_PUNCH': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                'SUPPORT_TICKET': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                'EXPENSE_CLAIM': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            };
            return colors[type] || 'bg-slate-100 text-slate-600';
        };

        const renderEntityDetails = (req: any) => {
            const d = req.entity_details;
            if (!d) return <p className="text-sm text-slate-400 italic">Details unavailable</p>;

            return (
                <div className="space-y-2">
                    {d.reason && (
                        <p className="text-sm text-slate-500 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl italic">"{d.reason}"</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {req.trigger_type === 'LEAVE_REQUEST' && d.start_date && (
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(d.start_date).toLocaleDateString()} — {new Date(d.end_date).toLocaleDateString()}
                            </span>
                        )}
                        {req.trigger_type === 'OVERTIME_REQUEST' && d.request_date && (
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(d.request_date).toLocaleDateString()}
                            </span>
                        )}
                        {req.trigger_type === 'OVERTIME_REQUEST' && d.ot_hours && (
                            <span className="flex items-center gap-1 font-semibold text-orange-600">
                                ⏱ {d.ot_hours}h requested
                            </span>
                        )}
                        {req.trigger_type === 'MISSED_PUNCH' && d.request_date && (
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {d.punch_type} · {new Date(d.request_date).toLocaleDateString()}
                            </span>
                        )}
                        {req.trigger_type === 'RESIGNATION' && d.proposed_last_working_date && (
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Last day: {new Date(d.proposed_last_working_date).toLocaleDateString()}
                            </span>
                        )}
                        {req.trigger_type === 'SUPPORT_TICKET' && d.subject && (
                            <span className="flex items-center gap-1">
                                <Headphones className="w-3 h-3" />
                                {d.subject} · {d.priority}
                            </span>
                        )}
                        {req.trigger_type === 'EXPENSE_CLAIM' && d.amount && (
                            <span className="flex items-center gap-1 font-bold">
                                Amount: {d.amount}
                            </span>
                        )}
                    </div>
                </div>
            );
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Approvals</h1>
                        <p className="text-slate-500 font-medium">Review and act on pending requests.</p>
                    </div>
                    {requests.length > 0 && (
                        <span className="text-sm font-bold text-slate-400">{requests.length} pending</span>
                    )}
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
                                        {req.requester?.profile_photo_url ? (
                                            <img src={req.requester.profile_photo_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full font-bold text-slate-400">{req.requester?.name?.[0] || '?'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{req.requester?.name || 'Unknown'}</h3>
                                        <p className="text-xs text-slate-500 mb-1">{req.requester?.designation}</p>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getTriggerColor(req.trigger_type)}`}>
                                            {req.entity_details?.type_label || getTriggerLabel(req.trigger_type)}
                                        </span>
                                    </div>
                                </div>

                                {/* Request Details */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            {getTriggerLabel(req.trigger_type)}
                                        </div>
                                        <span className="text-xs font-mono text-slate-400">{new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>

                                    {renderEntityDetails(req)}

                                    {/* Reject Comment Dialog */}
                                    {rejectingId === req.id && (
                                        <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-800/30">
                                            <label className="block text-xs font-bold text-rose-600 mb-2">Reason for Rejection (optional)</label>
                                            <textarea
                                                value={rejectComment}
                                                onChange={e => setRejectComment(e.target.value)}
                                                placeholder="Add a comment..."
                                                rows={2}
                                                className="w-full p-3 bg-white dark:bg-zinc-900 rounded-xl border border-rose-200 dark:border-rose-800 text-sm text-slate-700 dark:text-slate-200 mb-3"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => { setRejectingId(null); setRejectComment(''); }}
                                                    className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700"
                                                >Cancel</button>
                                                <button
                                                    onClick={() => handleReject(req.id)}
                                                    disabled={actionLoading === req.id}
                                                    className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50"
                                                >{actionLoading === req.id ? 'Rejecting...' : 'Confirm Reject'}</button>
                                            </div>
                                        </div>
                                    )}

                                    {rejectingId !== req.id && (
                                        <div className="flex gap-3 justify-end mt-4">
                                            <button
                                                onClick={() => setRejectingId(req.id)}
                                                disabled={actionLoading === req.id}
                                                className="px-5 py-2 rounded-xl text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition-colors disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleApprove(req.id)}
                                                disabled={actionLoading === req.id}
                                                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {actionLoading === req.id ? 'Processing...' : 'Approve Request'}
                                            </button>
                                        </div>
                                    )}
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

            // AI Assistant Response Logic
            setTimeout(() => {
                let response = "I'm processing that request...";
                const q = input.toLowerCase();

                if (q.includes('leave') || q.includes('balance')) {
                    response = `You have ${leaveBalance} leave days available in your balance.`;
                } else if (q.includes('salary') || q.includes('pay')) {
                    response = lastSalary ? `Your latest net pay on record is QAR ${lastSalary.toLocaleString()}.` : `Your salary details are being processed.`;
                } else if (q.includes('skill') || q.includes('career')) {
                    response = `Your current position is '${currentEmployee?.designation || 'Team Member'}'.`;
                } else {
                    response = "I can help with attendance, leaves, payroll, and profile queries. Try asking 'How many leaves do I have?'";
                }

                setMessages([...newMsgs as any, { role: 'ai', text: response }]);
                setThinking(false);
            }, 500);
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
        { id: 'TARGETS', icon: TrendingUp, label: 'My Targets' },
        { id: 'PAYSLIPS', icon: FileText, label: 'My Payslips' },
        { id: 'ASSETS', icon: Monitor, label: 'My Assets' },
        { id: 'DOCUMENTS', icon: Folder, label: 'My Documents' },
        { id: 'SUPPORT', icon: Headphones, label: 'Support' },
        { id: 'PRO_SERVICES', icon: ShieldCheck, label: 'PRO & Govt Services' },
        { id: 'RESIGNATION', icon: LogOut, label: 'Resignation' },
        { id: 'ANNOUNCEMENTS', icon: Bell, label: 'Announcements' },
        // { id: 'BUZZ', icon: Radio, label: 'Buzz Feed' }, // Removed pending features for clarity
        { id: 'SURVEYS', icon: Clipboard, label: 'Surveys' },
        { id: 'KUDOS', icon: Star, label: 'Kudos & Rewards' },
        { id: 'DIRECTORY', icon: Users, label: 'People Directory' },
        { id: 'LEARNING', icon: BookOpen, label: 'Learning' },
        { id: 'CHAT', icon: MessageSquare, label: 'Team Chat' },
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
                    .select('id, name, designation, department, designation_id, department_id, org_designations(name), departments(name), email, office_email, personal_email, phone, office_mobile, personal_mobile, status, profile_photo_url, location_id, locations(name)')
                    .eq('company_id', currentEmployee.company_id)
                    .eq('status', 'Active');
                if (data) {
                    setPeople(data.map((p: any) => ({
                        ...p,
                        designation: p.org_designations?.name || p.designation || 'Staff',
                        department: p.departments?.name || p.department || null,
                        email: p.office_email || p.personal_email || p.email || null,
                        mobile: p.personal_mobile || p.office_mobile || p.phone || null,
                        location: p.locations?.name || null
                    })));
                }
            };
            fetchPeople();
        }, [currentEmployee]);

        const filteredPeople = people.filter(p =>
            (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.designation || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.department || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.mobile || '').toLowerCase().includes(search.toLowerCase())
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
                                {person.profile_photo_url ? (
                                    <img src={person.profile_photo_url} alt={person.name} className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-zinc-700 shadow-sm" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 font-bold text-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0">
                                        {person.name.charAt(0)}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{person.name}</h3>
                                    <p className="text-xs text-slate-500 font-medium truncate">{person.designation}</p>
                                </div>
                            </div>
                            <div className="space-y-2 pt-4 border-t border-slate-50 dark:border-zinc-800">
                                {person.department && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{person.department}</span>
                                    </div>
                                )}
                                {person.email && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <a href={`mailto:${person.email}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 truncate">{person.email}</a>
                                    </div>
                                )}
                                {person.mobile && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <a href={`tel:${person.mobile}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 truncate">{person.mobile}</a>
                                    </div>
                                )}
                                {person.location && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{person.location}</span>
                                    </div>
                                )}
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

        // OT Request
        const [showOTRequest, setShowOTRequest] = useState(false);
        const [otForm, setOTForm] = useState({
            request_date: new Date().toISOString().split('T')[0],
            ot_hours: 1,
            reason: ''
        });
        const [submittingOT, setSubmittingOT] = useState(false);
        const [otRequests, setOtRequests] = useState<any[]>([]);

        useEffect(() => {
            if (currentEmployee) {
                fetchAttendance();
                fetchMissedRequests();
                fetchOTRequests();
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

        const fetchOTRequests = async () => {
            const { data } = await (supabase as any).from('overtime_requests')
                .select('*')
                .eq('employee_id', currentEmployee.id)
                .order('created_at', { ascending: false })
                .limit(10);
            if (data) setOtRequests(data);
        };


        const handleSubmitMissedPunch = async () => {
            if (!missedPunchForm.requested_time || !missedPunchForm.reason.trim()) {
                alert('Please fill in all fields including the reason.');
                return;
            }
            setSubmittingMissed(true);

            const requestedTimestamp = new Date(`${missedPunchForm.request_date}T${missedPunchForm.requested_time}:00`).toISOString();

            try {
                const { data, error } = await (supabase as any).from('missed_punch_requests').insert([{
                    company_id: currentEmployee.company_id,
                    employee_id: currentEmployee.id,
                    request_date: missedPunchForm.request_date,
                    punch_type: missedPunchForm.punch_type,
                    requested_time: requestedTimestamp,
                    reason: missedPunchForm.reason,
                    status: 'Pending'
                }]).select();

                if (error) throw error;

                // Trigger Workflow
                if (data && data[0] && currentEmployee) {
                    try {
                        await WorkflowEngine.startWorkflow(
                            currentEmployee.company_id,
                            'MISSED_PUNCH',
                            data[0].id,
                            currentEmployee.id,
                            'HRMS'
                        );
                    } catch (wfErr) {
                        console.warn('Workflow trigger failed (may not be configured):', wfErr);
                    }
                }

                setShowMissedPunch(false);
                setMissedPunchForm({ request_date: new Date().toISOString().split('T')[0], punch_type: 'check_in', requested_time: '', reason: '' });
                fetchMissedRequests();
            } catch (err: any) {
                alert('Failed to submit request: ' + err.message);
            }
            setSubmittingMissed(false);
        };

        const handleSubmitOT = async () => {
            if (currentEmployee.ot_applicable === false) {
                alert('Overtime requests are not applicable for your role.');
                return;
            }
            if (!otForm.reason.trim()) {
                alert('Please provide a reason for the overtime.');
                return;
            }
            if (otForm.ot_hours < 0.5 || otForm.ot_hours > 12) {
                alert('OT hours must be between 0.5 and 12.');
                return;
            }
            setSubmittingOT(true);
            try {
                const { data, error } = await (supabase as any).from('overtime_requests').insert([{
                    company_id: currentEmployee.company_id,
                    employee_id: currentEmployee.id,
                    request_date: otForm.request_date,
                    ot_hours: otForm.ot_hours,
                    reason: otForm.reason,
                    status: 'Pending'
                }]).select();

                if (error) throw error;

                if (data && data[0] && currentEmployee) {
                    try {
                        await WorkflowEngine.startWorkflow(
                            currentEmployee.company_id,
                            'OVERTIME_REQUEST',
                            data[0].id,
                            currentEmployee.id,
                            'HRMS'
                        );
                    } catch (wfErr) {
                        console.warn('Workflow trigger failed:', wfErr);
                    }
                }

                setShowOTRequest(false);
                setOTForm({ request_date: new Date().toISOString().split('T')[0], ot_hours: 1, reason: '' });
                fetchOTRequests();
            } catch (err: any) {
                alert('Failed to submit OT request: ' + err.message);
            }
            setSubmittingOT(false);
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
        const pendingOTCount = otRequests.filter(r => r.status === 'Pending').length;

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
                            className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                            <Calendar className="w-4 h-4" />
                            Request Missed Punch
                            {pendingCount > 0 && (
                                <span className="ml-1 bg-white text-indigo-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{pendingCount}</span>
                            )}
                        </button>
                        <button
                            onClick={() => setShowOTRequest(true)}
                            className="px-4 py-2.5 bg-orange-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2"
                        >
                            <Clock className="w-4 h-4" />
                            Request Overtime
                            {pendingOTCount > 0 && (
                                <span className="ml-1 bg-white text-orange-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{pendingOTCount}</span>
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

                {/* Pending OT Requests */}
                {otRequests.length > 0 && (
                    <div className="mb-8 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/30 overflow-hidden">
                        <div className="px-6 py-3 border-b border-orange-100 dark:border-orange-800/30 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-600" />
                            <h3 className="text-sm font-bold text-orange-800 dark:text-orange-400">Overtime Requests</h3>
                        </div>
                        <div className="divide-y divide-orange-100 dark:divide-orange-800/20">
                            {otRequests.slice(0, 5).map(req => (
                                <div key={req.id} className="px-6 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                {new Date(req.request_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {req.ot_hours}h
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                "{req.reason}"
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                                        req.status === 'Pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
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
                        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-white/50 dark:border-zinc-800 animate-slide-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Request Missed Punch</h3>
                                    <p className="text-xs text-slate-500 mt-1">Submit a correction for a missed check-in or check-out</p>
                                </div>
                                <button onClick={() => setShowMissedPunch(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-6 space-y-5 overflow-y-auto flex-1">
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

                {/* OT Request Modal */}
                {showOTRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-fade-in" onClick={() => setShowOTRequest(false)}>
                        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-white/50 dark:border-zinc-800 animate-slide-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Request Overtime</h3>
                                    <p className="text-xs text-slate-500 mt-1">Submit an overtime request for approval</p>
                                </div>
                                <button onClick={() => setShowOTRequest(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-6 space-y-5 overflow-y-auto flex-1">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                                    <input
                                        type="date"
                                        value={otForm.request_date}
                                        onChange={e => setOTForm({ ...otForm, request_date: e.target.value })}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">OT Hours</label>
                                    <input
                                        type="number"
                                        min="0.5"
                                        max="12"
                                        step="0.5"
                                        value={otForm.ot_hours}
                                        onChange={e => setOTForm({ ...otForm, ot_hours: parseFloat(e.target.value) })}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        Reason <span className="text-rose-500">*</span>
                                    </label>
                                    <textarea
                                        required
                                        value={otForm.reason}
                                        onChange={e => setOTForm({ ...otForm, reason: e.target.value })}
                                        placeholder="e.g., Working late for project deadline..."
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm outline-none h-24 resize-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <button
                                    onClick={handleSubmitOT}
                                    disabled={submittingOT}
                                    className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/30 hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    {submittingOT ? 'Submitting...' : <><Clock className="w-5 h-5" /> Submit OT Request</>}
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
        const [empBalances, setEmpBalances] = useState<any[]>([]);
        const [showForm, setShowForm] = useState(false);
        const [formData, setFormData] = useState({ leave_type_id: '', type: 'Annual', from: '', to: '', reason: '' });
        const [submitting, setSubmitting] = useState(false);
        const [leaveFile, setLeaveFile] = useState<File | null>(null);
        const [expandedLeaveId, setExpandedLeaveId] = useState<string | null>(null);

        useEffect(() => {
            if (currentEmployee) refreshLeaves();
        }, [currentEmployee]);

        // Set initial leave type when leaveTypes load
        useEffect(() => {
            if (leaveTypes.length > 0 && !formData.leave_type_id) {
                setFormData(prev => ({ ...prev, leave_type_id: leaveTypes[0].id?.toString() || '', type: leaveTypes[0].name }));
            }
        }, [leaveTypes]);

        const refreshLeaves = async () => {
            if (!currentEmployee) return;
            const [lRes, bRes] = await Promise.all([
                supabase.from('leaves').select('*').eq('employee_id', currentEmployee.id).order('created_at', { ascending: false }),
                supabase.from('employee_leave_balances').select('*').eq('employee_id', currentEmployee.id)
            ]);
            if (lRes.data) setLeaves(lRes.data);
            if (bRes.data) setEmpBalances(bRes.data);
        };

        // Live Balance View calculations
        const selectedLeaveType = leaveTypes.find(
            (lt: any) => lt.id?.toString() === formData.leave_type_id?.toString()
        ) || (leaveTypes.length > 0 ? leaveTypes[0] : null);

        const typeName = selectedLeaveType ? selectedLeaveType.name : (formData.type || 'Annual');

        // Check custom employee_leave_balances first, then org_leave_types default, then statutory default
        const customBal = empBalances.find((b: any) => b.leave_type_id?.toString() === formData.leave_type_id?.toString());
        const defaultEntitlement = customBal && customBal.total_balance != null
            ? Number(customBal.total_balance)
            : (selectedLeaveType?.default_balance && Number(selectedLeaveType.default_balance) > 0
                ? Number(selectedLeaveType.default_balance)
                : (selectedLeaveType?.name?.toLowerCase().includes('annual') ? 21 : 14));

        const leavesForSelectedType = leaves.filter((l: any) => {
            if (selectedLeaveType && selectedLeaveType.id && l.leave_type_id) {
                if (l.leave_type_id.toString() === selectedLeaveType.id.toString()) return true;
            }
            const itemType = (l.type || l.leave_type || '').toLowerCase();
            return itemType === (typeName || '').toLowerCase();
        });

        let usedDays = 0;
        let pendingDays = 0;

        leavesForSelectedType.forEach((l: any) => {
            if (l.start_date && l.end_date) {
                const start = new Date(l.start_date);
                const end = new Date(l.end_date);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    if (days > 0) {
                        if (l.status === 'Approved') usedDays += days;
                        else if (l.status === 'Pending') pendingDays += days;
                    }
                }
            }
        });

        const remainingBalance = Math.max(0, defaultEntitlement - usedDays);

        let requestedDays = 0;
        if (formData.from && formData.to) {
            const s = new Date(formData.from);
            const e = new Date(formData.to);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
                const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                if (diff > 0) requestedDays = diff;
            }
        }

        const handleViewAttachment = async (url: string) => {
            const path = url.split('/storage/v1/object/public/attachments/')[1];
            if (!path) return window.open(url, '_blank');
            try {
                const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 60);
                if (error) throw error;
                window.open(data.signedUrl, '_blank');
            } catch (err: any) {
                console.error(err);
                alert('Could not view: ' + err.message);
            }
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);

            try {
                if (!currentEmployee) throw new Error('Employee context not found');

                // 1. Date Validation
                if (!formData.from || !formData.to) {
                    alert("Please select both start and end dates.");
                    setSubmitting(false);
                    return;
                }

                const start = new Date(formData.from);
                const end = new Date(formData.to);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    alert("Invalid date selection.");
                    setSubmitting(false);
                    return;
                }

                if (end < start) {
                    alert("End date cannot be earlier than start date.");
                    setSubmitting(false);
                    return;
                }

                const reqDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                if (reqDays > remainingBalance && remainingBalance > 0) {
                    const proceed = confirm(
                        `Note: You are requesting ${reqDays} days, which exceeds your current balance of ${remainingBalance} days.\n\nDo you want to submit this application for Special/Unpaid Leave approval by HR Management?`
                    );
                    if (!proceed) {
                        setSubmitting(false);
                        return;
                    }
                }

                let attachmentUrl = '';
                let attachmentName = '';

                if (leaveFile) {
                    const path = `${currentEmployee.company_id}/leaves/${Date.now()}_${leaveFile.name}`;
                    const { data: uploadData, error: uploadErr } = await supabase.storage
                        .from('attachments')
                        .upload(path, leaveFile);
                    if (uploadErr) throw uploadErr;

                    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
                    attachmentUrl = urlData.publicUrl;
                    attachmentName = leaveFile.name;
                }

                const selectedLT = leaveTypes.find((lt: any) => lt.id?.toString() === formData.leave_type_id?.toString());
                const finalTypeName = selectedLT ? selectedLT.name : (formData.type || 'Annual');

                const { data, error } = await (supabase as any).from('leaves').insert([{
                    employee_id: currentEmployee.id,
                    leave_type_id: formData.leave_type_id ? parseInt(formData.leave_type_id) : null,
                    type: finalTypeName,
                    start_date: formData.from,
                    end_date: formData.to,
                    reason: formData.reason,
                    status: 'Pending',
                    company_id: currentEmployee.company_id,
                    attachment_url: attachmentUrl || null,
                    attachment_name: attachmentName || null
                }]).select();

                if (error) throw error;

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

                alert('Leave application submitted successfully! It is now visible in the HRMS for approval.');
                setShowForm(false);
                setLeaveFile(null);
                setSubmitting(false);
                refreshLeaves();
                setFormData({
                    leave_type_id: leaveTypes[0]?.id?.toString() || '',
                    type: leaveTypes[0]?.name || 'Annual',
                    from: '',
                    to: '',
                    reason: ''
                });
            } catch (err: any) {
                alert('Failed to submit leave application: ' + (err.message || 'Error occurred'));
                setSubmitting(false);
            }
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">My Leaves</h1>
                        <p className="text-slate-500">Manage your time off.</p>
                    </div>
                    <button onClick={() => { setShowForm(!showForm); setLeaveFile(null); }} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20">
                        {showForm ? 'Cancel' : '+ Apply Leave'}
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-10 bg-white dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-lg animate-in slide-in-from-top-4">
                        {/* Live Balance View Card */}
                        <div className="mb-6 p-5 bg-gradient-to-br from-indigo-50/80 via-slate-50 to-emerald-50/50 dark:from-indigo-950/30 dark:via-zinc-900 dark:to-emerald-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm">
                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-indigo-100/60 dark:border-indigo-900/40">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                                        Live Leave Balance — {typeName}
                                    </span>
                                </div>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                                    {selectedLeaveType?.code || 'LEAVE'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                                <div className="bg-white/80 dark:bg-zinc-800/80 p-3 rounded-xl border border-slate-100 dark:border-zinc-700/50">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Entitlement</p>
                                    <p className="text-lg font-black text-slate-800 dark:text-white">{defaultEntitlement} <span className="text-xs font-normal text-slate-400">days</span></p>
                                </div>
                                <div className="bg-white/80 dark:bg-zinc-800/80 p-3 rounded-xl border border-slate-100 dark:border-zinc-700/50">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Used Days</p>
                                    <p className="text-lg font-black text-rose-600 dark:text-rose-400">{usedDays} <span className="text-xs font-normal text-slate-400">days</span></p>
                                </div>
                                <div className="bg-white/80 dark:bg-zinc-800/80 p-3 rounded-xl border border-slate-100 dark:border-zinc-700/50">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Days</p>
                                    <p className="text-lg font-black text-amber-600 dark:text-amber-400">{pendingDays} <span className="text-xs font-normal text-slate-400">days</span></p>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Remaining Available</p>
                                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{remainingBalance} <span className="text-xs font-normal text-emerald-600/70">days</span></p>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/50 col-span-2 sm:col-span-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Requested Days</p>
                                    <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">{requestedDays} <span className="text-xs font-normal text-indigo-600/70">days</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
                                <select className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" value={formData.leave_type_id} onChange={e => { const lt = leaveTypes.find((t: any) => t.id?.toString() === e.target.value); setFormData({ ...formData, leave_type_id: e.target.value, type: lt?.name || e.target.value }); }}>
                                    {leaveTypes.length > 0 ? leaveTypes.map((lt: any) => (
                                        <option key={lt.id} value={lt.id}>{lt.name}</option>
                                    )) : (
                                        <>
                                            <option value="">Annual</option>
                                            <option value="">Sick</option>
                                            <option value="">Casual</option>
                                            <option value="">Unpaid</option>
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
                            <input type="text" required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white" placeholder="Reason for leave..." value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attachment</label>
                            <input type="file" onChange={(e) => setLeaveFile(e.target.files?.[0] || null)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white font-medium text-sm text-slate-500" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                            {leaveFile && <p className="text-xs text-indigo-500 font-medium mt-1">Selected: {leaveFile.name}</p>}
                        </div>
                        <div className="text-right">
                            <button type="submit" disabled={submitting} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Submitting...' : 'Submit Application'}</button>
                        </div>
                    </form>
                )}

                <div className="space-y-4">
                    {leaves.map(leave => {
                        const isExpanded = expandedLeaveId === leave.id;
                        return (
                            <div key={leave.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-500 dark:text-zinc-400">
                                            <Calendar className="w-6 h-6" />
                                        </div>
                                        <div className="flex flex-col">
                                            <h3 className="font-bold text-slate-900 dark:text-white">{leave.leave_type || leave.type} Leave</h3>
                                            <p className="text-sm text-slate-500 dark:text-zinc-400">{new Date(leave.start_date).toLocaleDateString()} &rarr; {new Date(leave.end_date).toLocaleDateString()} • <span className="italic">{leave.reason}</span></p>
                                            {leave.attachment_url && (
                                                <button onClick={() => handleViewAttachment(leave.attachment_url)} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50 w-fit hover:underline" title={leave.attachment_name || 'View file'}>
                                                    <Paperclip className="w-3.5 h-3.5" /> {leave.attachment_name || 'View file'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setExpandedLeaveId(isExpanded ? null : leave.id)}
                                            className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-150 dark:bg-zinc-850 dark:hover:bg-zinc-800 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold border border-slate-200/50 dark:border-zinc-800 transition-colors"
                                        >
                                            {isExpanded ? 'Hide Timeline' : 'Track Workflow'}
                                        </button>
                                        <span className={`px-4 py-2 font-bold text-sm rounded-xl ${leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                            leave.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {leave.status}
                                        </span>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <WorkflowTimeline entityId={leave.id} />
                                )}
                            </div>
                        );
                    })}
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
        const [resignationFile, setResignationFile] = useState<File | null>(null);

        const toDbDate = (val?: string | null): string | null => {
            if (!val) return null;
            const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (match) {
                return `${match[3]}-${match[2]}-${match[1]}`;
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
            return null;
        };

        useEffect(() => {
            const checkStatus = async () => {
                if (!currentEmployee) return;
                const { data } = await supabase.from('resignations').select('*').eq('employee_id', currentEmployee.id).in('status', ['Pending', 'Approved']).single();
                if (data) setActiveResignation(data);
            };
            checkStatus();
        }, [currentEmployee]);

        const handleViewAttachment = async (url: string) => {
            const path = url.split('/storage/v1/object/public/attachments/')[1];
            if (!path) return window.open(url, '_blank');
            try {
                const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 60);
                if (error) throw error;
                window.open(data.signedUrl, '_blank');
            } catch (err: any) {
                console.error(err);
                alert('Could not view: ' + err.message);
            }
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!currentEmployee) return;

            const dbLastDate = toDbDate(formData.lastDate);
            if (!dbLastDate) {
                alert("Proposed Last Working Day must be in dd/mm/yyyy format");
                return;
            }

            setLoading(true);

            let attachmentUrl = '';
            let attachmentName = '';

            try {
                if (resignationFile) {
                    const path = `${currentEmployee.company_id}/resignations/${Date.now()}_${resignationFile.name}`;
                    const { data: uploadData, error: uploadErr } = await supabase.storage
                        .from('attachments')
                        .upload(path, resignationFile);
                    if (uploadErr) throw uploadErr;

                    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
                    attachmentUrl = urlData.publicUrl;
                    attachmentName = resignationFile.name;
                }

                const { data: newResignation, error } = await supabase.from('resignations').insert([{
                    company_id: currentEmployee.company_id,
                    employee_id: currentEmployee.id,
                    reason_category: formData.category,
                    reason_text: formData.reason,
                    proposed_last_working_date: dbLastDate,
                    status: 'Pending',
                    attachment_url: attachmentUrl || null,
                    attachment_name: attachmentName || null
                }]).select().single();

                if (error) throw error;

                if (newResignation) {
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
            } catch (err: any) {
                alert("Failed to submit resignation request: " + err.message);
            } finally {
                setLoading(false);
            }
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
                                <span className="font-bold">{activeResignation.proposed_last_working_date ? `${String(new Date(activeResignation.proposed_last_working_date).getDate()).padStart(2, '0')}/${String(new Date(activeResignation.proposed_last_working_date).getMonth() + 1).padStart(2, '0')}/${new Date(activeResignation.proposed_last_working_date).getFullYear()}` : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Reason:</span>
                                <span>{activeResignation.reason_category}</span>
                            </div>
                            {activeResignation.attachment_url && (
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Attachment:</span>
                                    <button onClick={() => handleViewAttachment(activeResignation.attachment_url)} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline" title={activeResignation.attachment_name || 'View file'}>
                                        <Paperclip className="w-3.5 h-3.5" /> {activeResignation.attachment_name || 'View file'}
                                    </button>
                                </div>
                            )}
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
                                    type="text"
                                    placeholder="dd/mm/yyyy"
                                    required
                                    className="w-full p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
                                    value={formData.lastDate}
                                    onChange={e => setFormData({ ...formData, lastDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attachment</label>
                                <input type="file" onChange={(e) => setResignationFile(e.target.files?.[0] || null)} className="w-full p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white font-medium text-sm text-slate-500" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                                {resignationFile && <p className="text-xs text-indigo-500 font-medium mt-1">Selected: {resignationFile.name}</p>}
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowGiveModal(false)}>
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2rem] p-8 shadow-2xl animate-scale-up relative flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowGiveModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors z-10"><LogOut className="w-4 h-4 text-slate-400 rotate-180" /></button>

                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex-shrink-0">Give Kudos</h2>

                            <form onSubmit={handleGiveKudos} className="flex flex-col flex-1 overflow-hidden">
                                <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4">
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
                                </div>

                                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex-shrink-0">
                                    <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors active:scale-95">
                                        Send Kudos 🚀
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const MyGovtRequests = () => {
        const [requests, setRequests] = useState<any[]>([]);
        const [loading, setLoading] = useState(true);
        const [showModal, setShowModal] = useState(false);
        const [submitting, setSubmitting] = useState(false);
        const [file, setFile] = useState<File | null>(null);
        const [expandedId, setExpandedId] = useState<string | null>(null);
        const [formData, setFormData] = useState({
            title: '',
            application_type: 'QID_RENEWAL',
            qid_number: (currentEmployee as any)?.q_id || (currentEmployee as any)?.qid || '',
            passport_number: (currentEmployee as any)?.passport_no || (currentEmployee as any)?.passport_number || '',
            dependent_name: '',
            remarks: '',
            urgent_flag: false
        });

        useEffect(() => {
            if (currentEmployee) fetchRequests();
        }, [currentEmployee]);

        const fetchRequests = async () => {
            setLoading(true);
            try {
                const { data } = await (supabase as any).from('pro_applications')
                    .select('*')
                    .eq('applicant_employee_id', currentEmployee.id)
                    .order('created_at', { ascending: false });
                if (data) setRequests(data);
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);

            let attachUrl = '';
            let attachName = '';

            try {
                if (file) {
                    const path = `${currentEmployee.company_id}/pro/${Date.now()}_${file.name}`;
                    const { error: uploadErr } = await supabase.storage
                        .from('attachments')
                        .upload(path, file);
                    if (uploadErr) throw uploadErr;

                    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
                    attachUrl = urlData.publicUrl;
                    attachName = file.name;
                }

                const { data, error } = await (supabase as any).from('pro_applications').insert([{
                    company_id: currentEmployee.company_id,
                    applicant_employee_id: currentEmployee.id,
                    title: formData.title,
                    application_type: formData.application_type,
                    service_category: formData.application_type,
                    qid_number: formData.qid_number || null,
                    passport_number: formData.passport_number || null,
                    dependent_name: formData.dependent_name || null,
                    urgent_flag: formData.urgent_flag,
                    remarks: formData.remarks,
                    submission_date: new Date().toISOString().split('T')[0],
                    status: 'PENDING',
                    stage: 'SUBMITTED',
                    attachment_url: attachUrl || null,
                    attachment_name: attachName || null
                }]).select();

                if (error) throw error;

                if (data && data[0] && currentEmployee) {
                    try {
                        await WorkflowEngine.startWorkflow(
                            currentEmployee.company_id,
                            'PRO_SERVICE_REQUEST',
                            data[0].id,
                            currentEmployee.id,
                            'PRO'
                        );
                    } catch (wfErr) {
                        console.warn('Workflow trigger failed:', wfErr);
                    }
                }

                alert('Government service request submitted successfully!');
                setShowModal(false);
                setFile(null);
                setFormData({
                    title: '',
                    application_type: 'QID_RENEWAL',
                    qid_number: (currentEmployee as any)?.q_id || (currentEmployee as any)?.qid || '',
                    passport_number: (currentEmployee as any)?.passport_no || (currentEmployee as any)?.passport_number || '',
                    dependent_name: '',
                    remarks: '',
                    urgent_flag: false
                });
                fetchRequests();
            } catch (err: any) {
                alert('Submission failed: ' + err.message);
            } finally {
                setSubmitting(false);
            }
        };

        const getServiceLabel = (type: string) => {
            const map: Record<string, string> = {
                'QID_RENEWAL': 'QID / Civil ID Renewal',
                'VISA_RENEWAL': 'Residence / Work Visa Renewal',
                'PASSPORT_RELEASE': 'Passport Release Request',
                'NOC_REQUEST': 'No Objection Certificate (NOC)',
                'EXIT_PERMIT': 'Travel / Exit Clearance',
                'FAMILY_VISA': 'Family Residence Visa',
                'DOC_ATTESTATION': 'Document Attestation / Translation',
                'OTHER': 'General Government Service'
            };
            return map[type] || type;
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">PRO & Govt Services</h1>
                        <p className="text-slate-500 font-medium">Request QID renewals, visa assistance, passport releases, and government approvals.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <ShieldCheck className="w-5 h-5" /> New Government Request
                    </button>
                </div>

                {/* List of Requests */}
                <div className="space-y-4 max-w-4xl">
                    {loading ? (
                        <p className="text-slate-400">Loading requests...</p>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                            <ShieldCheck className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-medium">No government requests submitted yet.</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                {getServiceLabel(req.application_type)}
                                            </span>
                                            {req.urgent_flag && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 uppercase">Urgent</span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{req.title}</h3>
                                        <p className="text-xs text-slate-400 font-mono">Ref: {req.application_number || req.id.slice(0, 8)} • Submitted: {new Date(req.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase ${
                                            req.status === 'APPROVED' || req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        }`}>
                                            {req.stage || req.status}
                                        </span>
                                        <button
                                            onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                                            className="text-xs font-bold text-blue-600 hover:underline"
                                        >
                                            {expandedId === req.id ? 'Hide Details' : 'View Workflow'}
                                        </button>
                                    </div>
                                </div>

                                {req.remarks && (
                                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl italic mb-3">"{req.remarks}"</p>
                                )}

                                {expandedId === req.id && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Approval & Processing Progress</h4>
                                        <WorkflowTimeline entityId={req.id} />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Modal for New Request */}
                {showModal && (
                    <Modal title="New Government Service Request" onClose={() => setShowModal(false)} maxWidth="max-w-2xl">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Service Type *</label>
                                <select
                                    value={formData.application_type}
                                    onChange={e => setFormData({ ...formData, application_type: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium"
                                >
                                    <option value="QID_RENEWAL">QID / Civil ID Renewal</option>
                                    <option value="VISA_RENEWAL">Residence / Work Visa Renewal</option>
                                    <option value="PASSPORT_RELEASE">Passport Release / Hold</option>
                                    <option value="NOC_REQUEST">No Objection Certificate (NOC)</option>
                                    <option value="EXIT_PERMIT">Travel Clearance / Exit Permit</option>
                                    <option value="FAMILY_VISA">Family Residence Visa Assistance</option>
                                    <option value="DOC_ATTESTATION">Document Attestation / Translation</option>
                                    <option value="OTHER">General Government Service</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Request Subject / Title *</label>
                                <input
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                    placeholder="e.g. Annual QID Renewal for 2026"
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QID / Civil ID Number</label>
                                    <input
                                        value={formData.qid_number}
                                        onChange={e => setFormData({ ...formData, qid_number: e.target.value })}
                                        placeholder="QID #"
                                        className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Passport Number</label>
                                    <input
                                        value={formData.passport_number}
                                        onChange={e => setFormData({ ...formData, passport_number: e.target.value })}
                                        placeholder="Passport #"
                                        className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-mono"
                                    />
                                </div>
                            </div>

                            {formData.application_type === 'FAMILY_VISA' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dependent Name</label>
                                    <input
                                        value={formData.dependent_name}
                                        onChange={e => setFormData({ ...formData, dependent_name: e.target.value })}
                                        placeholder="Spouse / Child Name"
                                        className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reason / Details *</label>
                                <textarea
                                    value={formData.remarks}
                                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                    required
                                    placeholder="Provide specific notes or instructions for the PRO team..."
                                    rows={3}
                                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Mark as Urgent Request</span>
                                <input
                                    type="checkbox"
                                    checked={formData.urgent_flag}
                                    onChange={e => setFormData({ ...formData, urgent_flag: e.target.checked })}
                                    className="w-5 h-5 accent-blue-600 rounded"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attach Document (Passport / QID Copy)</label>
                                <input
                                    type="file"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                            >
                                {submitting ? 'Submitting Request...' : 'Submit Request'}
                            </button>
                        </form>
                    </Modal>
                )}
            </div>
        );
    };

    const Support = () => {
        const [tickets, setTickets] = useState<any[]>([]);
        const [showForm, setShowForm] = useState(false);
        const [formData, setFormData] = useState({ subject: '', category: 'IT Support', priority: 'Medium', description: '' });
        const [ticketFile, setTicketFile] = useState<File | null>(null);
        const [submitting, setSubmitting] = useState(false);
        const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

        useEffect(() => {
            if (currentEmployee) refreshTickets();
        }, [currentEmployee]);

        const refreshTickets = async () => {
            const { data } = await supabase.from('tickets').select('*').eq('employee_id', currentEmployee.id).order('created_at', { ascending: false });
            if (data) setTickets(data);
        };

        const handleViewAttachment = async (url: string) => {
            const path = url.split('/storage/v1/object/public/attachments/')[1];
            if (!path) return window.open(url, '_blank');
            try {
                const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 60);
                if (error) throw error;
                window.open(data.signedUrl, '_blank');
            } catch (err: any) {
                console.error(err);
                alert('Could not view: ' + err.message);
            }
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);

            let attachmentUrl = '';
            let attachmentName = '';

            try {
                if (ticketFile) {
                    const path = `${currentEmployee.company_id}/tickets/${Date.now()}_${ticketFile.name}`;
                    const { data: uploadData, error: uploadErr } = await supabase.storage
                        .from('attachments')
                        .upload(path, ticketFile);
                    if (uploadErr) throw uploadErr;

                    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
                    attachmentUrl = urlData.publicUrl;
                    attachmentName = ticketFile.name;
                }

                const { data, error } = await ((supabase as any).from('tickets').insert as any)([{
                    company_id: currentEmployee.company_id,
                    employee_id: currentEmployee.id,
                    subject: formData.subject,
                    category: formData.category,
                    priority: formData.priority,
                    description: formData.description,
                    status: 'Open',
                    created_at: new Date().toISOString(),
                    attachment_url: attachmentUrl || null,
                    attachment_name: attachmentName || null
                }]).select();

                if (error) throw error;

                // Trigger Workflow
                if (data && data[0] && currentEmployee) {
                    try {
                        await WorkflowEngine.startWorkflow(
                            currentEmployee.company_id,
                            'SUPPORT_TICKET',
                            data[0].id,
                            currentEmployee.id,
                            'HRMS'
                        );
                    } catch (wfErr) {
                        console.warn('Workflow trigger failed (may not be configured):', wfErr);
                    }
                }

                setShowForm(false);
                setTicketFile(null);
                setFormData({ subject: '', category: 'IT Support', priority: 'Medium', description: '' });
                refreshTickets();
            } catch (err: any) {
                alert("Failed to submit ticket: " + err.message);
            } finally {
                setSubmitting(false);
            }
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Help Desk</h1>
                        <p className="text-slate-500">Raise tickets for IT, HR, or Payroll.</p>
                    </div>
                    <button onClick={() => { setShowForm(!showForm); setTicketFile(null); }} className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">
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
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attachment</label>
                            <input type="file" onChange={(e) => setTicketFile(e.target.files?.[0] || null)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none text-slate-900 dark:text-white font-medium text-sm text-slate-500" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                            {ticketFile && <p className="text-xs text-indigo-500 font-medium mt-1">Selected: {ticketFile.name}</p>}
                        </div>
                        <div className="text-right">
                            <button type="submit" disabled={submitting} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit Ticket'}</button>
                        </div>
                    </form>
                )}

                <div className="space-y-4">
                    {tickets.map(ticket => {
                        const isExpanded = expandedTicketId === ticket.id;
                        return (
                            <div key={ticket.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${ticket.status === 'Open' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                            <Headphones className="w-6 h-6" />
                                        </div>
                                        <div className="flex flex-col">
                                            <h3 className="font-bold text-slate-900 dark:text-white">{ticket.subject}</h3>
                                            <p className="text-sm text-slate-500 dark:text-zinc-400">{ticket.category} • {new Date(ticket.created_at).toLocaleDateString()}</p>
                                            {ticket.attachment_url && (
                                                <button onClick={() => handleViewAttachment(ticket.attachment_url)} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50 w-fit hover:underline" title={ticket.attachment_name || 'View file'}>
                                                    <Paperclip className="w-3.5 h-3.5" /> {ticket.attachment_name || 'View file'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                                            className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-150 dark:bg-zinc-850 dark:hover:bg-zinc-800 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold border border-slate-200/50 dark:border-zinc-800 transition-colors"
                                        >
                                            {isExpanded ? 'Hide Timeline' : 'Track Workflow'}
                                        </button>
                                        <span className={`px-3 py-1 text-xs font-bold uppercase rounded-lg ${ticket.status === 'Open' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <WorkflowTimeline entityId={ticket.id} />
                                )}
                            </div>
                        );
                    })}
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
                                <p className="text-slate-500 text-sm font-medium mb-6">Net Pay: <span className="text-slate-900 dark:text-white font-bold">QAR {slip.net_salary.toLocaleString()}</span></p>

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
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            const fetchAssets = async () => {
                if (!currentEmployee) return;
                setLoading(true);
                const { data, error } = await supabase
                    .from('assets')
                    .select('*')
                    .eq('assigned_to', currentEmployee.id);
                if (data) setAssets(data);
                if (error) console.error("Error fetching assets:", error);
                setLoading(false);
            };
            fetchAssets();
        }, [currentEmployee]);

        const getStatusBadge = (status: string) => {
            switch (status?.toLowerCase()) {
                case 'in use':
                case 'assigned':
                    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
                case 'available':
                    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                case 'repair':
                case 'maintenance':
                    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                default:
                    return 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300';
            }
        };

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">My Assets</h1>
                        <p className="text-slate-500">View items and company assets assigned to you.</p>
                    </div>
                </div>

                {loading ? (
                    <p className="text-slate-400">Loading assets...</p>
                ) : assets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                        <Monitor className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-medium">No assets assigned to your profile.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {assets.map(asset => {
                            const purchaseDate = asset.purchase_date || asset.purchaseDate;
                            const warrantyExpiry = asset.warranty_expiry_date || asset.warranty_expiry || asset.warranty_date;
                            const serialNum = asset.serial_number || asset.serial || 'N/A';
                            const assetType = asset.type || asset.category || 'Asset';

                            return (
                                <div key={asset.id} className="bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-colors">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 dark:text-indigo-400">
                                                <Monitor className="w-6 h-6" />
                                            </div>
                                            <span className={`px-3 py-1 text-xs font-bold rounded-xl uppercase tracking-wider ${getStatusBadge(asset.status)}`}>
                                                {asset.status || 'Assigned'}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{asset.name}</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">{assetType}</p>

                                        <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 font-medium">Serial Number</span>
                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{serialNum}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 font-medium">Purchase Date</span>
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                    {purchaseDate ? new Date(purchaseDate).toLocaleDateString() : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 font-medium">Warranty Expiry</span>
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                    {warrantyExpiry ? new Date(warrantyExpiry).toLocaleDateString() : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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




    const MyTargets = () => {
        const [targets, setTargets] = useState<any[]>([]);
        const [loadingTargets, setLoadingTargets] = useState(true);

        useEffect(() => {
            if (currentEmployee) {
                fetchMyTargets();
            }
        }, [currentEmployee]);

        const fetchMyTargets = async () => {
            setLoadingTargets(true);
            const { data, error } = await (supabase as any)
                .from('employee_targets')
                .select('*')
                .eq('employee_id', currentEmployee.id)
                .order('target_year', { ascending: false })
                .order('target_period_val', { ascending: false });
            if (error) console.error('Error fetching targets:', error);
            else setTargets(data || []);
            setLoadingTargets(false);
        };

        const formatPeriod = (target: any) => {
            if (target.target_period === 'Monthly') {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${months[target.target_period_val - 1]} ${target.target_year}`;
            }
            if (target.target_period === 'Quarterly') {
                return `Q${target.target_period_val} ${target.target_year}`;
            }
            return `Year ${target.target_year}`;
        };

        const totalTargetAmt = targets.reduce((sum, t) => sum + (t.target_amount || 0), 0);
        const totalAchievedAmt = targets.reduce((sum, t) => sum + (t.achieved_amount || 0), 0);
        const totalIncentiveAmt = targets.reduce((sum, t) => sum + ((t.achieved_amount || 0) * (t.incentive_rate || 0) / 100), 0);

        return (
            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Targets & Commission</h1>
                    <p className="text-slate-500 text-sm mt-0.5 font-medium">Track your target achievements and earned commissions</p>
                </div>

                {loadingTargets ? (
                    <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                        <Loader2 className="animate-spin text-indigo-500" /> Loading targets...
                    </div>
                ) : targets.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-slate-100 dark:border-zinc-800 p-12 text-center text-slate-400 shadow-sm max-w-2xl mx-auto">
                        <TrendingUp className="w-12 h-12 mx-auto text-slate-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No targets assigned</h3>
                        <p className="text-sm mt-1">You do not have any sales/BD targets assigned for the current period.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Period Target</span>
                                <span className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1 block">QAR {totalTargetAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Achieved</span>
                                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">QAR {totalAchievedAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-xs text-slate-400 font-medium mt-1 block">({((totalAchievedAmt / (totalTargetAmt || 1)) * 100).toFixed(1)}% of Target)</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 p-5 rounded-2xl shadow-sm bg-gradient-to-br from-indigo-50/50 to-indigo-100/10 dark:from-indigo-950/20 dark:to-indigo-900/5">
                                <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider block">Estimated Incentives</span>
                                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">QAR {totalIncentiveAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-xs text-slate-400 font-medium mt-1 block">Earned based on achievement rates</span>
                            </div>
                        </div>

                        {/* List */}
                        <div className="bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 font-bold text-slate-700 dark:text-white">Active Targets & Progress</div>
                            <div className="p-6 space-y-6">
                                {targets.map(t => {
                                    const progress = Math.min(100, (t.achieved_amount / (t.target_amount || 1)) * 100);
                                    const incentive = (t.achieved_amount * t.incentive_rate) / 100;
                                    
                                    return (
                                        <div key={t.id} className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 rounded-2xl space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-extrabold text-slate-800 dark:text-white text-base">{formatPeriod(t)}</span>
                                                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/10 px-2 py-0.5 rounded ml-2 font-bold uppercase">{t.target_period}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-extrabold text-slate-800 dark:text-white">QAR {t.achieved_amount.toLocaleString()} / QAR {t.target_amount.toLocaleString()}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">Incentive Rate: {t.incentive_rate}% (Earned: QAR {incentive.toLocaleString()})</div>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[11px] font-bold text-slate-400">
                                                    <span>Progress</span>
                                                    <span>{progress.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full h-3 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500" 
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-full relative z-10 overflow-hidden bg-slate-50 dark:bg-black">
            {/* Expanded Sidebar for ESSP */}
            <div className="w-20 lg:w-72 flex-shrink-0 bg-white/80 dark:bg-zinc-900/80 border-r border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden backdrop-blur-xl">
                <div className="p-6 flex flex-col h-full overflow-hidden">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-1.5 flex items-center justify-center h-10 w-10 shrink-0">
                            <img src={KAA_LOGO_URL} alt="Logo" className="h-full w-full object-contain" />
                        </div>
                        <span className="text-xl font-black text-slate-800 dark:text-white tracking-tighter hidden lg:block">ESSP</span>
                    </div>
                    <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-2 scrollbar-hide">
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
                {delayedLoading ? (
                    activeTab === 'DASHBOARD' ? <DashboardSkeleton /> : <TableSkeleton />
                ) : (
                    <>
                        {activeTab === 'DASHBOARD' && <Dashboard />}
                        {activeTab === 'ASSISTANT' && <AssistantView />}
                        {activeTab === 'SKILLS' && <SkillsView />}
                        {activeTab === 'APPROVALS' && <MyApprovals />}
                        {activeTab === 'PROFILE' && <MyProfile />}
                        {activeTab === 'ATTENDANCE' && <MyAttendance />}
                        {activeTab === 'TEAM_ATTENDANCE' && <TeamAttendance />}
                        {activeTab === 'LEAVES' && <MyLeaves />}
                        {activeTab === 'TARGETS' && <MyTargets />}
                        {activeTab === 'PAYSLIPS' && <MyPayslips />}
                        {activeTab === 'ASSETS' && <MyAssets />}
                        {activeTab === 'DOCUMENTS' && (
                            <div className="p-8 h-full overflow-y-auto animate-page-enter">
                                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">My Documents</h1>
                                <p className="text-slate-500 text-sm mb-8">Access your personal employee documents, contracts, and certificates</p>
                                <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2rem] border border-slate-100 dark:border-zinc-800 text-center text-slate-400 italic">
                                    Your uploaded documents are synchronized automatically from HR records. Contact HR for document requests.
                                </div>
                            </div>
                        )}
                        {activeTab === 'SUPPORT' && <Support />}
                        {activeTab === 'PRO_SERVICES' && <MyGovtRequests />}
                        {activeTab === 'RESIGNATION' && <Resignation />}
                        {activeTab === 'ANNOUNCEMENTS' && <Announcements />}
                        {activeTab === 'BUZZ' && <Buzz />}
                        {activeTab === 'SURVEYS' && <Surveys />}
                        {activeTab === 'KUDOS' && <KudosRewards />}
                        {activeTab === 'DIRECTORY' && <PeopleDirectory />}
                        {activeTab === 'LEARNING' && <Learning />}
                        {activeTab === 'CHAT' && <TeamChat />}
                        {activeTab === 'REPORTS' && <ReportsListView />}

                        {activeTab !== 'DASHBOARD' && activeTab !== 'APPROVALS' && activeTab !== 'PROFILE' && activeTab !== 'ATTENDANCE' && activeTab !== 'TEAM_ATTENDANCE' && activeTab !== 'LEAVES' && activeTab !== 'TARGETS' && activeTab !== 'PAYSLIPS' && activeTab !== 'ASSETS' && activeTab !== 'SUPPORT' && activeTab !== 'RESIGNATION' && activeTab !== 'BUZZ' && activeTab !== 'SURVEYS' && activeTab !== 'KUDOS' && activeTab !== 'DIRECTORY' && activeTab !== 'LEARNING' && activeTab !== 'CHAT' && activeTab !== 'REPORTS' && (
                            <div className="p-10 flex flex-col items-center justify-center h-full text-slate-400 animate-page-enter">
                                <Settings className="w-16 h-16 mb-6 opacity-20" />
                                <h2 className="text-2xl font-black text-slate-300 dark:text-zinc-700 mb-2">Module Loading...</h2>
                                <p className="font-medium">The {navItems.find(n => n.id === activeTab)?.label} module is being initialized.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};



