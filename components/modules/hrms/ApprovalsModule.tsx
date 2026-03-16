import React, { useState, useEffect } from 'react';
import {
    CheckCircle, XCircle, Clock, User, Briefcase, MapPin,
    ArrowRight, Calendar, AlertCircle, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Employee } from '../../hrms/types';
import { JobTransition } from '../../hrms/transitions/types';

interface ApprovalsModuleProps {
    currentEmployee: Employee | null;
}

export const ApprovalsModule: React.FC<ApprovalsModuleProps> = ({ currentEmployee }) => {
    const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
    const [transitions, setTransitions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        fetchTransitions();
    }, [activeTab]);

    const fetchTransitions = async () => {
        setLoading(true);
        let query = supabase
            .from('employee_job_transitions')
            .select(`
        *,
        employee:employees!employee_id(name, email),
        requester:employees!requester_id(name)
      `)
            .order('created_at', { ascending: false });

        if (activeTab === 'PENDING') {
            query = query.eq('status', 'Pending');
        } else {
            query = query.in('status', ['Approved', 'Rejected']);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching transitions:', error);
        } else {
            setTransitions(data || []);
        }
        setLoading(false);
    };

    const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
        if (!currentEmployee?.id) return;
        setProcessingId(id);

        try {
            const { error } = await supabase.rpc('approve_job_transition', {
                p_transition_id: id,
                p_approver_id: currentEmployee.id,
                p_status: status,
                p_remarks: remarks
            });

            if (error) throw error;

            // Refresh
            fetchTransitions();
            setExpandedId(null);
            setRemarks('');
            setProcessingId(null);
        } catch (error) {
            console.error('Error processing approval:', error);
            alert('Failed to process request');
            setProcessingId(null);
        }
    };

    const formatDate = (date: string) => new Date(date).toLocaleDateString();

    const getChangeLabel = (key: string) => {
        const labels: Record<string, string> = {
            designation: 'Designation',
            department: 'Department',
            location: 'Location',
            manager_id: 'Reporting Manager',
            designation_id: 'Designation ID',
            department_id: 'Department ID',
            location_id: 'Location ID'
        };
        return labels[key] || key;
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-black/20 overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Approvals</h1>
                        <p className="text-slate-500 text-sm font-medium">Manage job transition requests and changes</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('PENDING')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'PENDING'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setActiveTab('HISTORY')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'HISTORY'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                        >
                            History
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : transitions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                        <CheckCircle className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No {activeTab.toLowerCase()} requests found</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-w-5xl mx-auto">
                        {transitions.map((item) => (
                            <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden transition-all hover:shadow-md">
                                <div
                                    className="p-5 flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                      ${item.transition_type === 'PROMOTION' ? 'bg-emerald-100 text-emerald-700' :
                                                item.transition_type === 'TRANSFER' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {item.transition_type[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                {item.employee?.name}
                                                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500 font-medium">
                                                    {item.transition_type}
                                                </span>
                                            </h3>
                                            <p className="text-sm text-slate-500 flex items-center gap-4 mt-0.5">
                                                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Filed: {formatDate(item.created_at)}</span>
                                                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Effective: {formatDate(item.effective_date)}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                       ${item.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                item.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {item.status}
                                        </span>
                                        {expandedId === item.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedId === item.id && (
                                    <div className="px-5 pb-5 pt-0 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
                                        <div className="mt-5 grid grid-cols-2 gap-8">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Proposed Changes</h4>
                                                <div className="space-y-2">
                                                    {Object.keys(item.new_data).map(key => {
                                                        // Skip ID fields for display if needed, but here we show them or map them
                                                        if (key.endsWith('_id')) return null; // Simplified: Assuming we only show readable fields or fetched ones.
                                                        // Actually, in JobTransitionModal we saved IDs but might not have saved names in new_data? 
                                                        // The RPC logic or Modal logic should handle this. 
                                                        // If only IDs are saved, we need to fetch master data or rely on UI to display ID for now (MVP).
                                                        // We should ideally have names in snapshot. 
                                                        // Let's assume for V1 we might see IDs or need to fetch. 
                                                        // For simplicity in V1, let's display what we have.
                                                        return (
                                                            <div key={key} className="flex justify-between text-sm py-1 border-b border-slate-200/50 last:border-0">
                                                                <span className="text-slate-500 font-medium">{getChangeLabel(key)}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="line-through text-slate-400 decoration-slate-400/50">{item.current_data[key] || '-'}</span>
                                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.new_data[key]}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {/* Fallback to show IDs if no names found in simple iteration */}
                                                    {Object.keys(item.new_data).filter(k => k.endsWith('_id')).map(key => (
                                                        <div key={key} className="flex justify-between text-sm py-1 border-b border-slate-200/50 last:border-0">
                                                            <span className="text-slate-500 font-medium">{getChangeLabel(key)}</span>
                                                            <span className="font-mono text-slate-800 dark:text-slate-200">{item.new_data[key]}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Reason & Remarks</h4>
                                                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
                                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">"{item.reason}"</p>
                                                    {item.remarks && <p className="text-xs text-slate-500 italic border-t pt-2 mt-2">{item.remarks}</p>}
                                                </div>

                                                {activeTab === 'PENDING' && (
                                                    <div className="mt-4">
                                                        <textarea
                                                            placeholder="Approval/Rejection remarks..."
                                                            value={remarks}
                                                            onChange={(e) => setRemarks(e.target.value)}
                                                            className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-3"
                                                        />
                                                        <div className="flex gap-3">
                                                            <button
                                                                onClick={() => handleAction(item.id, 'Approved')}
                                                                disabled={processingId === item.id}
                                                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                                            >
                                                                <CheckCircle className="w-4 h-4" /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleAction(item.id, 'Rejected')}
                                                                disabled={processingId === item.id}
                                                                className="flex-1 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                                            >
                                                                <XCircle className="w-4 h-4" /> Reject
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
