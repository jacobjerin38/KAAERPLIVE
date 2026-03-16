import React, { useState, useRef, useEffect } from 'react';
import { AppView } from '../types';
import { LayoutGrid, Settings, Bell, Search, LogOut, KeyRound } from 'lucide-react';
import { KAA_LOGO_URL } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  if (currentView === AppView.HRMS) return null;

  const { signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  const handleChangePassword = async () => {
    const currentPass = prompt("Enter your current password:");
    if (!currentPass) { setShowMenu(false); return; }

    // Verify current password by re-authenticating
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser?.email) { alert("Could not verify user."); setShowMenu(false); return; }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPass,
    });

    if (signInError) {
      alert("Current password is incorrect.");
      setShowMenu(false);
      return;
    }

    const newPass = prompt("Enter your new password:");
    if (!newPass) { setShowMenu(false); return; }
    if (newPass.length < 6) { alert("Password must be at least 6 characters."); setShowMenu(false); return; }

    const confirmPass = prompt("Confirm your new password:");
    if (newPass !== confirmPass) { alert("Passwords do not match."); setShowMenu(false); return; }

    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) alert("Error: " + error.message);
    else alert("Password changed successfully!");
    setShowMenu(false);
  };

  return (
    <div className="h-screen w-20 flex flex-col items-center py-6 bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800 z-50 transition-colors duration-300">
      {/* Brand Icon (Image) */}
      <div
        className="mb-12 cursor-pointer flex justify-center w-full active:scale-95 transition-transform duration-200 overflow-hidden px-2"
        onClick={() => onNavigate(AppView.DASHBOARD)}
      >
        <img src={KAA_LOGO_URL} alt="Kaa" className="w-16 h-auto object-contain brightness-100 dark:brightness-110" />
      </div>

      {/* Main Nav Actions */}
      <div className="flex flex-col gap-4 flex-1 w-full items-center">
        <NavItem
          icon={LayoutGrid}
          label="Apps"
          active={currentView === AppView.DASHBOARD}
          onClick={() => onNavigate(AppView.DASHBOARD)}
        />
        <NavItem icon={Search} label="Search" />
        <NavItem icon={Bell} label="Notifications" hasBadge />
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-6 w-full items-center mb-6 relative" ref={menuRef}>
        <NavItem
          icon={Settings}
          label="Settings"
          active={currentView === AppView.SETTINGS}
          onClick={() => onNavigate(AppView.SETTINGS)}
        />

        {/* User Menu Popover */}
        {showMenu && (
          <div className="absolute bottom-2 left-16 min-w-[200px] bg-white dark:bg-zinc-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-zinc-700 p-2 animate-scale-in origin-bottom-left overflow-hidden z-[60]">
            <button onClick={handleChangePassword} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors text-left">
              <KeyRound className="w-4 h-4" /> Change Password
            </button>
            <div className="h-px bg-slate-100 dark:bg-zinc-700/50 my-1"></div>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors text-left">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}

        <div
          className="w-10 h-10 rounded-full p-[2px] border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
          onClick={() => setShowMenu(!showMenu)}
        >
          <img src="https://i.pravatar.cc/150?u=EMP001" alt="User" className="w-full h-full rounded-full object-cover" />
        </div>
      </div>
    </div>
  );
};

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  hasBadge?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, hasBadge, onClick }) => {
  return (
    <div
      className={`group relative flex items-center justify-center w-10 h-10 rounded-xl cursor-pointer transition-all duration-200 ${active
        ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
        : 'text-zinc-400 dark:text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
        }`}
      onClick={onClick}
    >
      <Icon className="w-5 h-5" strokeWidth={2} />
      {hasBadge && (
        <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white dark:border-zinc-900"></span>
      )}

      {/* Minimal Tooltip */}
      <div className="absolute left-14 px-3 py-1.5 bg-black dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 whitespace-nowrap pointer-events-none z-50 shadow-lg border border-transparent dark:border-zinc-700">
        {label}
      </div>
    </div>
  );
};