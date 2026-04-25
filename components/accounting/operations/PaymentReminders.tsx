import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Bell, Send, Clock, AlertTriangle, CheckCircle, Mail } from 'lucide-react';

interface OverdueInvoice {
    id: string; reference: string; date: string; invoice_date_due: string;
    amount_total: number; amount_residual: number;
    partner_name: string; partner_email: string; partner_id: string;
    days_overdue: number; reminder_count: number;
}

export const PaymentReminders: React.FC = () => {
    const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<'all'|'overdue'|'critical'>('all');

    useEffect(() => { fetchOverdue(); }, []);

    const fetchOverdue = async () => {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('accounting_moves')
            .select('id, reference, date, invoice_date_due, amount_total, amount_residual, partner:accounting_partners(id, name, email)')
            .eq('move_type', 'out_invoice').eq('state', 'Posted').gt('amount_residual', 0)
            .lte('invoice_date_due', today)
            .order('invoice_date_due', { ascending: true });

        if (error) { console.error(error); setLoading(false); return; }

        setInvoices((data || []).map((d: any) => {
            const due = new Date(d.invoice_date_due);
            const diff = Math.floor((new Date().getTime() - due.getTime()) / (1000*60*60*24));
            return {
                id: d.id, reference: d.reference || 'INV', date: d.date,
                invoice_date_due: d.invoice_date_due,
                amount_total: Number(d.amount_total), amount_residual: Number(d.amount_residual),
                partner_name: d.partner?.name || 'Unknown', partner_email: d.partner?.email || '',
                partner_id: d.partner?.id || '', days_overdue: diff, reminder_count: 0
            };
        }));
        setLoading(false);
    };

    const sendReminder = async (inv: OverdueInvoice) => {
        setSending(prev => new Set(prev).add(inv.id));
        // Simulate sending — in production, call Edge Function for email
        await new Promise(r => setTimeout(r, 1000));
        alert(`Payment reminder sent to ${inv.partner_name} (${inv.partner_email || 'no email on file'}) for ${inv.reference} — Amount Due: ${inv.amount_residual.toFixed(2)}`);
        setSending(prev => { const n = new Set(prev); n.delete(inv.id); return n; });
    };

    const sendBulk = async () => {
        if (!confirm(`Send reminders to all ${filtered.length} overdue customers?`)) return;
        for (const inv of filtered) { await sendReminder(inv); }
    };

    const filtered = invoices.filter(i => {
        if (filter === 'overdue') return i.days_overdue > 0 && i.days_overdue <= 90;
        if (filter === 'critical') return i.days_overdue > 90;
        return true;
    });

    const severity = (days: number) => {
        if (days > 90) return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Critical', icon: AlertTriangle };
        if (days > 30) return { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', label: 'Warning', icon: Clock };
        return { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', label: 'Due', icon: Clock };
    };

    const totalDue = filtered.reduce((s, i) => s + i.amount_residual, 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Bell className="w-6 h-6 text-amber-500" />Payment Reminders</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{filtered.length} overdue invoices · Total: QAR {totalDue.toLocaleString()}</p>
                </div>
                <button onClick={sendBulk} disabled={filtered.length === 0} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                    <Send className="w-4 h-4" /> Send All Reminders
                </button>
            </div>

            <div className="flex gap-2">
                {(['all','overdue','critical'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filter === f ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400'}`}>{f === 'all' ? 'All Overdue' : f}</button>
                ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Due Date</th><th className="px-5 py-3">Days Overdue</th><th className="px-5 py-3 text-right">Amount Due</th><th className="px-5 py-3 text-center">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr> :
                         filtered.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400"><CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />No overdue invoices!</td></tr> :
                         filtered.map(inv => {
                            const s = severity(inv.days_overdue);
                            return (
                                <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-5 py-3"><div className="font-bold text-slate-700 dark:text-slate-200">{inv.partner_name}</div>{inv.partner_email && <div className="text-[11px] text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{inv.partner_email}</div>}</td>
                                    <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{inv.reference}</td>
                                    <td className="px-5 py-3 text-slate-500">{inv.invoice_date_due}</td>
                                    <td className="px-5 py-3"><span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${s.bg} ${s.color}`}><s.icon className="w-3 h-3" />{inv.days_overdue}d — {s.label}</span></td>
                                    <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-white">QAR {inv.amount_residual.toLocaleString()}</td>
                                    <td className="px-5 py-3 text-center"><button onClick={() => sendReminder(inv)} disabled={sending.has(inv.id)} className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">{sending.has(inv.id) ? 'Sending...' : '📤 Remind'}</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
