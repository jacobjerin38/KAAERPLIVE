import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Users, Building2, Search, ChevronRight, User, Mail, Phone, MapPin } from 'lucide-react';
import { Department, Employee } from '../../hrms/types';

interface StructureViewProps {
    className?: string;
}

export const StructureView: React.FC<StructureViewProps> = ({ className }) => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDeptId, setSelectedDeptId] = useState<string | number | 'ALL'>('ALL');
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle();
            if (!profile) return;

            const [deptRes, empRes] = await Promise.all([
                supabase.from('departments').select('*').eq('company_id', profile.company_id).eq('status', 'Active').order('name'),
                supabase.from('employees').select('*, role:roles(name)').eq('company_id', profile.company_id).eq('status', 'Active')
            ]);

            if (deptRes.data) setDepartments(deptRes.data.map((d: any) => ({
                ...d,
                status: (d.status === 'Active' || d.status === 'Inactive') ? d.status : 'Active'
            })) as Department[]);

            if (empRes.data) setEmployees(empRes.data.map((e: any) => ({
                ...e,
                joinDate: e.join_date || '',
                salary: e.salary_amount || 0,
                avatar: e.profile_photo_url || '',
                location: e.location || 'Unknown',
                role: e.role?.name || e.role // Assuming e.role is the joined object
            })) as Employee[]);
        } catch (error) {
            console.error("Error fetching org structure", error);
        }
        setLoading(false);
    };

    // Filter Logic
    const filteredEmployees = employees.filter(emp => {
        const roleName = typeof emp.role === 'object' && emp.role !== null ? (emp.role as any).name : emp.role;
        const matchesSearch = (emp.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (roleName || '').toLowerCase().includes(search.toLowerCase());

        if (!matchesSearch) return false;

        if (selectedDeptId === 'ALL') return true;
        if (selectedDeptId === 'UNASSIGNED') return !emp.department_id;
        return emp.department_id == selectedDeptId; // Loose equality for string/number mismatch safety
    });

    const getDeptCount = (deptId: string | number) => employees.filter(e => e.department_id == deptId).length;

    if (loading) return <div className="p-8 text-slate-500">Loading structure...</div>;

    return (
        <div className={`p-8 h-full flex flex-col animate-page-enter ${className}`}>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <Users className="w-8 h-8 text-indigo-500" /> Organization Structure
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Visualize departments and reporting lines.</p>
                </div>
                <div className="relative w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search employee or role..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
            </div>

            <div className="flex gap-8 h-full overflow-hidden">
                {/* Left Panel: Departments */}
                <div className="w-1/4 min-w-[250px] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Directory</h3>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        <button
                            onClick={() => setSelectedDeptId('ALL')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex justify-between items-center transition-all ${selectedDeptId === 'ALL' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                        >
                            <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> All Departments</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${selectedDeptId === 'ALL' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-zinc-700'}`}>{employees.length}</span>
                        </button>

                        {departments.map(dept => (
                            <button
                                key={dept.id}
                                onClick={() => setSelectedDeptId(dept.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex justify-between items-center transition-all ${selectedDeptId === dept.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                            >
                                <span className="truncate">{dept.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${selectedDeptId === dept.id ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-zinc-700'}`}>{getDeptCount(dept.id)}</span>
                            </button>
                        ))}

                        <button
                            onClick={() => setSelectedDeptId('UNASSIGNED')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex justify-between items-center transition-all ${selectedDeptId === 'UNASSIGNED' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                        >
                            <span className="flex items-center gap-2 text-amber-500"><Users className="w-4 h-4" /> Unassigned</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${selectedDeptId === 'UNASSIGNED' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-zinc-700'}`}>{employees.filter(e => !e.department_id).length}</span>
                        </button>
                    </div>
                </div>

                {/* Right Panel: Employees Grid */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredEmployees.map((emp: any) => (
                            <div key={emp.id} className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group cursor-pointer relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="w-5 h-5 text-slate-400" />
                                </div>

                                <div className="flex items-center gap-4 mb-4">
                                    {emp.avatar || emp.profile_photo_url ? (
                                        <img src={emp.avatar || emp.profile_photo_url} alt={emp.name} className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl uppercase">
                                            {emp.name.substring(0, 2)}
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white leading-tight">{emp.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                                            {emp.designation || (typeof emp.role === 'object' && emp.role ? (emp.role as any).name : emp.role) || 'Employee'}
                                        </p>
                                        <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-lg border uppercase font-bold tracking-wider ${emp.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                            {emp.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Mail className="w-3.5 h-3.5 text-indigo-400" />
                                        <span className="truncate">{emp.email || 'No Email'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Phone className="w-3.5 h-3.5 text-indigo-400" />
                                        <span>{emp.phone || emp.mobile || 'No Phone'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredEmployees.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <Users className="w-16 h-16 mb-4" />
                            <p className="font-bold">No employees found in this view</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
