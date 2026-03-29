import React from 'react';
import {
    Search, Plus, MoreHorizontal
} from 'lucide-react';
import { Employee, Department, Role, Designation } from '../../hrms/types';

interface EmployeeDirectoryProps {
    employees: Employee[];
    roles: Role[];
    departments: Department[];
    designations: Designation[];
    onSelectEmployee: (emp: Employee) => void;
    onAddEmployee: () => void;
}

export const EmployeeDirectory: React.FC<EmployeeDirectoryProps> = ({
    employees, roles, departments, designations, onSelectEmployee, onAddEmployee
}) => {
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">People</h2>
                <div className="flex gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input type="text" placeholder="Search people..." className="pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/20 w-72 shadow-sm transition-all text-slate-800 dark:text-slate-200" />
                    </div>
                    <button onClick={onAddEmployee} className="bg-slate-900 dark:bg-white text-white dark:text-black px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-200 hover:shadow-lg active:scale-95 transition-all">
                        <Plus className="w-4 h-4" /> Add Employee
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
                <div className="overflow-auto h-full">
                    <table className="w-full text-left min-w-[900px]">
                        <thead className="bg-slate-50/80 dark:bg-zinc-800/80 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200/60 dark:border-zinc-700">
                            <tr>
                                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Employee</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Position</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Department</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Client</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Join Date</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Contact</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50 dark:divide-zinc-800/50">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors group cursor-pointer" onClick={() => onSelectEmployee(emp)}>
                                    {/* Employee - Name + Staff No */}
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <img src={emp.avatar || `https://ui-avatars.com/api/?name=${emp.name}&background=random`} alt="" className="w-9 h-9 rounded-full border-2 border-white dark:border-zinc-700 shadow-sm group-hover:scale-105 transition-transform" />
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-white leading-tight">{emp.name}</p>
                                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{emp.employee_code || '-'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {/* Position / Designation */}
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 px-2.5 py-1 rounded-lg">
                                            {designations.find(d => Number(d.id) === emp.designation_id)?.name || emp.designation || '-'}
                                        </span>
                                    </td>
                                    {/* Department */}
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2.5 py-1 rounded-lg shadow-sm">
                                            {departments.find(d => Number(d.id) === emp.department_id)?.name || emp.department || '-'}
                                        </span>
                                    </td>
                                    {/* Client */}
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                            {emp.client_name || '-'}
                                        </span>
                                    </td>
                                    {/* Join Date */}
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                            {formatDate(emp.joinDate || emp.join_date)}
                                        </span>
                                    </td>
                                    {/* Contact */}
                                    <td className="px-4 py-3">
                                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{emp.personal_mobile || emp.phone || '-'}</div>
                                    </td>
                                    {/* Status */}
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${emp.status === 'Active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                            {emp.status}
                                        </span>
                                    </td>
                                    {/* Action */}
                                    <td className="px-4 py-3 text-right">
                                        <button className="text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white/50 dark:bg-zinc-800/50 p-2 rounded-xl hover:bg-white dark:hover:bg-zinc-800 hover:shadow-md"><MoreHorizontal className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
