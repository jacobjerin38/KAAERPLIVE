import React, { useRef } from 'react';
import { Moon, Sun, Download, Upload, LogOut, Database, Shield, Monitor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SettingsProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ isDarkMode, toggleTheme, onLogout }) => {
  const { hasPermission } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = () => {
    try {
      // Get all local storage data
      const data = JSON.stringify(localStorage);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `kaa_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup failed:', err);
      alert('Failed to create backup.');
    }
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const data = JSON.parse(result);

        if (confirm('This will overwrite all current data. Are you sure you want to restore?')) {
          localStorage.clear();
          Object.keys(data).forEach((key) => {
            localStorage.setItem(key, data[key]);
          });
          alert('Data restored successfully. The page will now reload.');
          window.location.reload();
        }
      } catch (err) {
        console.error('Restore failed:', err);
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 md:p-12 h-full overflow-y-auto animate-page-enter">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-12 text-lg">Manage your preferences and system data.</p>

        <div className="space-y-8">
          {/* Appearance Section */}
          <section className="bg-white dark:bg-zinc-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Appearance</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Customize the look and feel of your workspace.</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <span className="font-medium text-slate-700 dark:text-slate-200">Dark Mode</span>
              <button
                onClick={toggleTheme}
                className={`w-16 h-8 rounded-full p-1 transition-all duration-300 flex items-center ${isDarkMode ? 'bg-indigo-600 justify-end' : 'bg-zinc-300 justify-start'}`}
              >
                <div className="w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                  {isDarkMode ? <Moon className="w-3 h-3 text-indigo-600" /> : <Sun className="w-3 h-3 text-amber-500" />}
                </div>
              </button>
            </div>
          </section>

          {/* Data Management Section */}
          {hasPermission('org.settings.manage') && (
            <section className="bg-white dark:bg-zinc-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Data Management</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Securely backup or restore your local ERP data.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleBackup}
                  className="flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
                >
                  <Download className="w-6 h-6 text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                  <span className="font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">Backup Data</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group relative"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleRestore}
                    accept=".json"
                    className="hidden"
                  />
                  <Upload className="w-6 h-6 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  <span className="font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-blue-700 dark:group-hover:text-blue-400">Restore Data</span>
                </button>
              </div>
            </section>
          )}

          {/* Account Section */}
          <section className="bg-white dark:bg-zinc-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Account Session</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Manage your active session securely.</p>
              </div>
            </div>

            <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-2xl flex items-center justify-between border border-rose-100 dark:border-rose-900/30">
              <div className="flex flex-col">
                <span className="font-bold text-rose-900 dark:text-rose-200">Sign Out</span>
                <span className="text-xs text-rose-700 dark:text-rose-400">End your current session safely.</span>
              </div>
              <button
                onClick={onLogout}
                className="px-6 py-3 bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 font-bold rounded-xl shadow-sm border border-rose-100 dark:border-zinc-700 hover:bg-rose-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </section>
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs font-bold text-slate-300 dark:text-zinc-700 uppercase tracking-widest">Kaa ERP • 2026</p>
        </div>
      </div>
    </div>
  );
};