import React from 'react';
import {
    Edit3
} from 'lucide-react';
import { AttendanceRecord, Employee } from '../../hrms/types';
import { AttendanceReports } from '../../modules/hrms/AttendanceReports';

interface AttendanceModuleProps {
    viewMode: 'LIST' | 'REPORTS';
    setViewMode: (mode: 'LIST' | 'REPORTS') => void;
    attendanceDate: string;
    setAttendanceDate: (date: string) => void;
    refreshData: () => void;
    attendance: AttendanceRecord[];
    employees: Employee[];
    onEditAttendance: (id: string) => void;
    onExportCSV: () => void;
    onMarkAllPresent: () => void;
    formatTime: (time: string | null) => string;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
    viewMode, setViewMode, attendanceDate, setAttendanceDate, refreshData,
    attendance, employees, onEditAttendance, onExportCSV, onMarkAllPresent, formatTime
}) => {
    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <header className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Attendance</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                        {viewMode === 'LIST' ? 'Daily Logs & Adjustments' : 'Monthly Performance Analytics'}
                    </p>
                </div>

                <div className="flex gap-3 items-center">
                    {/* View Toggles */}
                    <div className="bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl flex gap-1 mr-4">
                        <button
                            onClick={() => setViewMode('LIST')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500'}`}
                        >
                            Daily Log
                        </button>
                        <button
                            onClick={() => setViewMode('REPORTS')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'REPORTS' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500'}`}
                        >
                            Analytics
                        </button>
                    </div>

                    <input
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => {
                            setAttendanceDate(e.target.value);
                            refreshData();
                        }}
                        className="px-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />

                    {viewMode === 'LIST' && (
                        <>
                            <button onClick={onExportCSV} className="px-5 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all">Export CSV</button>

                            <button onClick={onMarkAllPresent} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all">Mark All Present</button>
                        </>
                    )}
                </div>
            </header>

            {viewMode === 'REPORTS' ? (
                <div className="flex-1 overflow-y-auto">
                    <AttendanceReports attendance={attendance} employees={employees} month={attendanceDate.substring(0, 7)} />
                </div>
            ) : (
                <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200/60 dark:border-zinc-700">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Check In</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Check Out</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Duration</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                                {attendance.length > 0 ? attendance.map(rec => {
                                    const emp = employees.find(e => e.id === rec.employeeId);
                                    return (
                                        <tr key={rec.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-zinc-800">
                                                        {emp?.name.charAt(0) || '?'}
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{emp?.name || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-sm text-slate-600 dark:text-slate-400 font-mono bg-slate-50/50 dark:bg-zinc-800/50 rounded-lg w-fit px-2">{formatTime(rec.checkIn)}</td>
                                            <td className="px-8 py-4 text-sm text-slate-600 dark:text-slate-400 font-mono">{formatTime(rec.checkOut)}</td>
                                            <td className="px-8 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">{rec.duration} hrs</td>
                                            <td className="px-8 py-4">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm ${rec.status === 'Present' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                    rec.status === 'Absent' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                                        'bg-amber-100 text-amber-700 border-amber-200'
                                                    }`}>{rec.status}</span>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <button onClick={() => onEditAttendance(rec.id)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={6} className="text-center py-10 text-slate-400">No attendance records for this date.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
