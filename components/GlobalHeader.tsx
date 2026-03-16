import React, { useState, useRef, useEffect } from 'react';
import { AppView } from '../types';
import { Settings, Bell, LogOut, KeyRound, Search, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../contexts/UIContext';
import { NotificationsPopover } from './NotificationsPopover';
import { KAA_LOGO_URL } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface GlobalHeaderProps {
    currentView: AppView;
    onNavigate?: (view: AppView) => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({ currentView }) => {
    const navigate = useNavigate();
    const { signOut, currentCompanyId, selectCompany } = useAuth();
    const { toggleSearch, toggleNotifications, isNotificationsOpen, isSearchOpen } = useUI();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [companyName, setCompanyName] = useState<string>('');
    const [companyLoaded, setCompanyLoaded] = useState(false);

    // Fetch company name on mount
    useEffect(() => {
        if (currentCompanyId) {
            setCompanyLoaded(false);
            supabase.from('companies').select('display_name').eq('id', currentCompanyId).maybeSingle()
                .then(({ data, error }) => {
                    if (data) setCompanyName(data.display_name);
                    else setCompanyName('');
                    setCompanyLoaded(true);
                });
        } else {
            setCompanyName('');
            setCompanyLoaded(true);
        }
    }, [currentCompanyId]);

    const handleSwitchCompany = () => {
        selectCompany(null as any);
        window.location.reload();
    };

    const handleLogout = async () => {
        await signOut();
    };

    const handleChangePassword = async () => {
        const newPass = prompt("Enter new password:");
        if (newPass) {
            const { error } = await supabase.auth.updateUser({ password: newPass });
            if (error) alert("Error: " + error.message);
            else alert("Password updated successfully!");
        }
        setShowMenu(false);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 z-50">
            {/* Left: Logo and Company Name */}
            <div className="flex items-center gap-4">
                <div
                    className="flex items-center cursor-pointer active:scale-95 transition-transform"
                    onClick={() => navigate('/')}
                >
                    <img src={KAA_LOGO_URL} alt="Kaa" className="h-10 w-auto object-contain brightness-100 dark:brightness-110" />
                </div>

                {/* Company Badge */}
                {companyName && (
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 rounded-full border border-slate-200 dark:border-zinc-700">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 max-w-[150px] truncate">
                            {companyName}
                        </span>
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4 relative" ref={menuRef}>
                {/* Search */}
                <button
                    onClick={() => toggleSearch()}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-full hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                    <Search className="w-5 h-5" />
                </button>

                {/* Notifications */}
                <div className="relative">
                    <button
                        onClick={() => toggleNotifications()}
                        className={`p-2 transition-colors rounded-full hover:bg-slate-50 dark:hover:bg-zinc-800 ${isNotificationsOpen ? 'text-blue-500 bg-blue-50 dark:bg-zinc-800' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-zinc-900"></span>
                        <Bell className="w-5 h-5" />
                    </button>
                    <NotificationsPopover />
                </div>

                {/* Profile */}
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-zinc-700"
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-xs shadow-md shadow-blue-500/20">
                        {/* Initials or generic icon */}
                        <span className="text-white">U</span>
                    </div>
                </button>

                {/* User Menu Popover */}
                {showMenu && (
                    <div className="absolute top-12 right-0 min-w-[200px] bg-white dark:bg-zinc-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-zinc-700 p-2 animate-scale-in origin-top-right overflow-hidden z-[60]">
                        <div className="px-3 py-2 border-b border-slate-50 dark:border-zinc-700/50 mb-1">
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Current Organization</p>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{companyName || (companyLoaded ? 'No Organization' : 'Loading...')}</p>
                        </div>

                        <button onClick={handleSwitchCompany} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors text-left">
                            <Building2 className="w-4 h-4" /> Switch Organization
                        </button>

                        <button onClick={handleChangePassword} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors text-left">
                            <KeyRound className="w-4 h-4" /> Reset Password
                        </button>

                        <div className="h-px bg-slate-100 dark:bg-zinc-700/50 my-1"></div>

                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors text-left">
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
