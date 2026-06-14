import React, { useRef, useState } from 'react';
import { Moon, Sun, Download, Upload, LogOut, Database, Shield, Monitor, Server, Loader2, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DeviceIntegrationHub } from './settings/DeviceIntegrationHub';
import { ActivityLogs } from './settings/ActivityLogs';
import { createFullBackup, restoreFullBackup } from '../lib/backupRestore';

interface SettingsProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ isDarkMode, toggleTheme, onLogout }) => {
  const { hasPermission } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeviceHub, setShowDeviceHub] = useState(false);
  const [showActivityLogs, setShowActivityLogs] = useState(false);

  const [progressStatus, setProgressStatus] = useState<string | null>(null);

  const handleBackup = async () => {
    try {
      setProgressStatus('Initializing backup...');
      const backupData = await createFullBackup((status) => {
        setProgressStatus(status);
      });
      
      setProgressStatus('Generating file...');
      const dataStr = JSON.stringify(backupData);
      const blob = new Blob([dataStr], { type: 'application/json' });
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
      alert('Failed to create backup: ' + (err as Error).message);
    } finally {
      setProgressStatus(null);
    }
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('WARNING: Restoring from a backup will OVERWRITE all your existing ERP data for this company. Are you absolutely sure you want to proceed?')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = e.target?.result as string;
        setProgressStatus('Parsing backup file...');
        const backupData = JSON.parse(result);

        await restoreFullBackup(backupData, (status) => {
          setProgressStatus(status);
        });

        alert('Data restored successfully! The application will now reload to apply the restored state.');
        window.location.reload();
      } catch (err) {
        console.error('Restore failed:', err);
        alert('Restore failed: ' + (err as Error).message);
        setProgressStatus(null);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      alert('Failed to read backup file.');
    };
    reader.readAsText(file);
  };

  if (showActivityLogs) {
    return (
      <div className="p-8 md:p-12 h-full overflow-y-auto animate-page-enter bg-slate-50 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setShowActivityLogs(false)}
            className="mb-6 flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm active:scale-95"
          >
            ← Back to Settings
          </button>
          <ActivityLogs />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 h-full overflow-y-auto animate-page-enter relative">
      {progressStatus && (
        <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col gap-4 rounded-xl">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Processing...</h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-md text-center">{progressStatus}</p>
        </div>
      )}

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

          {/* Device Integration Section */}
          {hasPermission('org.settings.manage') && (
            <section className="bg-white dark:bg-zinc-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-violet-50 dark:bg-violet-900/30 rounded-2xl text-violet-600 dark:text-violet-400">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Device Integration</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Connect barcode scanners, cameras, and attendance machines.</p>
                </div>
              </div>

              {showDeviceHub ? (
                <div>
                  <button
                    onClick={() => setShowDeviceHub(false)}
                    className="mb-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    ← Back to Settings
                  </button>
                  <DeviceIntegrationHub />
                </div>
              ) : (
                <button
                  onClick={() => setShowDeviceHub(true)}
                  className="w-full flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-violet-500 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group"
                >
                  <Server className="w-6 h-6 text-zinc-400 group-hover:text-violet-600 dark:group-hover:text-violet-400" />
                  <span className="font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-violet-700 dark:group-hover:text-violet-400">Open Device Hub</span>
                </button>
              )}
            </section>
          )}

          {/* Activity Log Section */}
          {hasPermission('org.settings.manage') && (
            <section className="bg-white dark:bg-zinc-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Activity Audit Log</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Track data entry addition, edit, delete, and session logins/logouts.</p>
                </div>
              </div>

              <button
                onClick={() => setShowActivityLogs(true)}
                className="w-full flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
              >
                <Clock className="w-6 h-6 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                <span className="font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">Open Activity Logs</span>
              </button>
            </section>
          )}

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
                  disabled={!!progressStatus}
                  className="flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-6 h-6 text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                  <span className="font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">Backup Data</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!progressStatus}
                  className="flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group relative disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleRestore}
                    accept=".json"
                    className="hidden"
                    disabled={!!progressStatus}
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