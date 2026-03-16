import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, Info, AlertTriangle, AlertOctagon, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUI } from '../contexts/UIContext';
import { useNavigate } from 'react-router-dom';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    link?: string;
    is_read: boolean;
    created_at: string;
}

export const NotificationsPopover: React.FC = () => {
    const { isNotificationsOpen, toggleNotifications } = useUI();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (isNotificationsOpen) {
            fetchNotifications();
        }
    }, [isNotificationsOpen]);

    const fetchNotifications = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) setNotifications(data as Notification[]);
        }
        setLoading(false);
    };

    const markAsRead = async (id: string) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const markAllAsRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    useEffect(() => {
        let subscription: any;

        const setupMsgListener = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            subscription = supabase
                .channel('public:notifications')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
                    setNotifications(prev => [payload.new as Notification, ...prev]);
                })
                .subscribe();
        }

        setupMsgListener();

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    const handleItemClick = (notification: Notification) => {
        if (!notification.is_read) markAsRead(notification.id);
        if (notification.link) {
            toggleNotifications(false);
            navigate(notification.link);
        }
    };

    if (!isNotificationsOpen) return null;

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="absolute top-16 right-6 w-[400px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-zinc-800 z-[60] animate-scale-in origin-top-right overflow-hidden flex flex-col max-h-[70vh]">

            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900/50 backdrop-blur">
                <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-slate-700 dark:text-white" />
                    <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                    {unreadCount > 0 && <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                </div>
                <button onClick={() => toggleNotifications(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {loading && <div className="text-center p-8 text-slate-400 text-sm">Loading...</div>}

                {!loading && notifications.length === 0 && (
                    <div className="text-center p-8 text-slate-400">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Bell className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold">All caught up!</p>
                        <p className="text-xs text-slate-400 mt-1">No new notifications.</p>
                    </div>
                )}

                {notifications.map(n => (
                    <div
                        key={n.id}
                        onClick={() => handleItemClick(n)}
                        className={`p-4 rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-zinc-700 ${n.is_read ? 'bg-white dark:bg-zinc-900 opacity-70 hover:opacity-100' : 'bg-blue-50/50 dark:bg-blue-900/10'}`}
                    >
                        <div className="flex gap-3">
                            <div className={`mt-1 shrink-0`}>
                                {n.type === 'INFO' && <Info className="w-5 h-5 text-blue-500" />}
                                {n.type === 'SUCCESS' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                                {n.type === 'WARNING' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                                {n.type === 'ERROR' && <AlertOctagon className="w-5 h-5 text-rose-500" />}
                            </div>
                            <div>
                                <h4 className={`text-sm font-semibold ${n.is_read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>{n.title}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                                <p className="text-[10px] text-slate-400 mt-2 font-medium">{new Date(n.created_at).toLocaleDateString()}</p>
                            </div>
                            {!n.is_read && <div className="shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-center">
                <button onClick={markAllAsRead} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Mark all as read</button>
            </div>
        </div>
    );
};
