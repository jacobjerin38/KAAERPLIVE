import React, { useState, useEffect } from 'react';
import { Plus, Check, X, Headphones } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Ticket, Employee } from '../../hrms/types';
import { Modal } from '../../ui/Modal';

interface HelpDeskModuleProps {
    employees: Employee[];
    currentEmployee: Employee | null;
}

export const HelpDeskModule: React.FC<HelpDeskModuleProps> = ({ employees, currentEmployee }) => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [showTicketModal, setShowTicketModal] = useState(false);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        const { data } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
        if (data) {
            const mappedTickets = data.map((t: any) => ({
                ...t,
                employeeId: t.employee_id, // Map for UI if needed
                createdAt: t.created_at
            }));
            setTickets(mappedTickets);
        }
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentEmployee) {
            alert("Employee profile not found. Cannot create ticket.");
            return;
        }

        const formData = new FormData(e.target as HTMLFormElement);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();

        const { error } = await (supabase as any).from('tickets').insert([{
            company_id: profile?.company_id,
            employee_id: currentEmployee.id,
            subject: formData.get('subject'),
            category: formData.get('category'),
            priority: formData.get('priority'),
            description: formData.get('description') || '',
            status: 'Open',
            created_at: new Date().toISOString()
        } as any]);

        if (error) alert("Error creating ticket: " + error.message);
        else {
            alert("Ticket created successfully");
            setShowTicketModal(false);
            fetchTickets();
        }
    };

    const handleUpdateTicketStatus = async (id: string, status: string) => {
        const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
        if (error) alert("Failed to update ticket");
        else fetchTickets();
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Help Desk</h2>
                <button onClick={() => setShowTicketModal(true)} className="bg-rose-600 text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-rose-700 hover:shadow-lg shadow-rose-500/30 transition-all active:scale-95">
                    <Plus className="w-4 h-4" /> New Ticket
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 overflow-y-auto pb-10">
                {tickets.map(ticket => {
                    // ticket.employee_id is the source of truth from DB map
                    const emp = employees.find(e => e.id === ticket.employee_id);
                    return (
                        <div key={ticket.id} className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 dark:border-zinc-800 shadow-lg shadow-slate-200/50 dark:shadow-black/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${ticket.priority === 'High' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                        }`}>{ticket.priority}</span>
                                    <span className="text-xs text-slate-400 font-medium">{formatDate(ticket.created_at)}</span>
                                </div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{ticket.subject}</h3>
                                {ticket.description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{ticket.description}</p>}
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-700/50">
                                    {emp?.avatar ? (
                                        <img src={emp.avatar} className="w-6 h-6 rounded-full" alt="" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                            {emp?.name?.charAt(0) || '?'}
                                        </div>
                                    )}
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Requested by {emp?.name || 'Unknown'}</span>
                                </div>
                                <div className="mt-4 flex justify-between items-center">
                                    <select
                                        value={ticket.status}
                                        onChange={(e) => handleUpdateTicketStatus(ticket.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs font-bold bg-slate-100 dark:bg-zinc-800 rounded-lg px-2 py-1 outline-none border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300"
                                    >
                                        <option value="Open">Open</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Resolved">Resolved</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {tickets.length === 0 && (
                    <div className="col-span-full text-center py-20 text-slate-400 italic">
                        No support tickets found.
                    </div>
                )}
            </div>

            {showTicketModal && (
                <Modal title="Create Support Ticket" onClose={() => setShowTicketModal(false)}>
                    <form onSubmit={handleCreateTicket} className="space-y-4">
                        <input name="subject" required placeholder="Subject" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" />
                        <select name="category" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                            <option value="IT">IT Support</option>
                            <option value="HR">HR Query</option>
                            <option value="Finance">Finance/Payroll</option>
                        </select>
                        <select name="priority" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white">
                            <option value="Low">Low Priority</option>
                            <option value="Medium">Medium Priority</option>
                            <option value="High">High Priority</option>
                        </select>
                        <textarea name="description" placeholder="Description" className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white min-h-[100px]"></textarea>
                        <button className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-lg shadow-rose-500/30 hover:shadow-xl active:scale-95 transition-all">Create Ticket</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};
