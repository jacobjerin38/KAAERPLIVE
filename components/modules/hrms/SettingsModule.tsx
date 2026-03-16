import React from 'react';
import { Settings } from 'lucide-react';

export const SettingsModule: React.FC = () => {
    return (
        <div className="p-8 h-full flex flex-col animate-page-enter">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">Settings</h2>
            <div className="flex-1 flex flex-col items-center justify-center text-center bg-white/40 dark:bg-zinc-900/40 rounded-[2rem] border border-white/50 dark:border-zinc-800 shadow-sm">
                <div className="w-20 h-20 bg-slate-100/50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-6">
                    <Settings className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Settings Module</h3>
                <p className="text-slate-500 dark:text-slate-500 max-w-sm">This module is part of the enterprise suite and is currently under development.</p>
            </div>
        </div>
    );
};
