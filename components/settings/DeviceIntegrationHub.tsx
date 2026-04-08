import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Wifi, WifiOff, Plus, RefreshCw, Trash2, Copy, CheckCircle, XCircle,
    Clock, Server, Fingerprint, Camera, QrCode, Shield, Activity,
    AlertTriangle, Eye, EyeOff, Zap, ArrowRight, X, Monitor
} from 'lucide-react';

interface DeviceIntegration {
    id: string;
    device_name: string;
    device_type: string;
    connection_type: string;
    ip_address: string | null;
    port: number | null;
    api_key: string;
    status: string;
    last_sync_at: string | null;
    sync_count: number;
    metadata: Record<string, unknown>;
    created_at: string;
}

interface SyncStatus {
    total_devices: number;
    active_devices: number;
    pending_logs: number;
    synced_today: number;
    failed_logs: number;
    devices: Array<{
        id: string;
        name: string;
        type: string;
        status: string;
        last_sync: string | null;
        sync_count: number;
        pending: number;
    }>;
}

interface AttendanceLog {
    id: string;
    employee_identifier: string;
    employee_id: string | null;
    punch_time: string;
    punch_type: string;
    sync_status: string;
    sync_error: string | null;
    created_at: string;
    device_integrations?: { device_name: string };
    employees?: { name: string; employee_code: string };
}

const DEVICE_TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bgColor: string }> = {
    barcode_scanner: { icon: QrCode, label: 'Barcode Scanner', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 dark:bg-violet-900/20' },
    camera: { icon: Camera, label: 'Camera', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
    biometric: { icon: Fingerprint, label: 'Biometric Device', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' },
    attendance_machine: { icon: Monitor, label: 'Attendance Machine', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
};

export const DeviceIntegrationHub: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [devices, setDevices] = useState<DeviceIntegration[]>([]);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'logs'>('overview');
    const [showAddModal, setShowAddModal] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

    // Add device form
    const [newDevice, setNewDevice] = useState({
        device_name: '',
        device_type: 'attendance_machine',
        connection_type: 'webhook',
        ip_address: '',
        port: '',
    });

    const fetchData = useCallback(async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        try {
            // Fetch devices
            const { data: devicesData } = await supabase
                .from('device_integrations')
                .select('*')
                .eq('company_id', currentCompanyId)
                .order('created_at', { ascending: false });
            setDevices((devicesData as DeviceIntegration[]) || []);

            // Fetch sync status
            const { data: statusData } = await supabase
                .rpc('rpc_get_device_sync_status', { p_company_id: currentCompanyId });
            setSyncStatus(statusData as unknown as SyncStatus);

            // Fetch recent logs
            const { data: logsData } = await supabase
                .from('device_attendance_logs')
                .select('*, device_integrations(device_name), employees(name, employee_code)')
                .eq('company_id', currentCompanyId)
                .order('created_at', { ascending: false })
                .limit(100);
            setLogs((logsData as unknown as AttendanceLog[]) || []);

        } catch (err) {
            console.error('Error fetching device data:', err);
        } finally {
            setLoading(false);
        }
    }, [currentCompanyId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAddDevice = async () => {
        if (!currentCompanyId || !newDevice.device_name.trim()) return;
        try {
            const { error } = await supabase
                .from('device_integrations')
                .insert({
                    company_id: currentCompanyId,
                    device_name: newDevice.device_name.trim(),
                    device_type: newDevice.device_type,
                    connection_type: newDevice.connection_type,
                    ip_address: newDevice.ip_address || null,
                    port: newDevice.port ? parseInt(newDevice.port) : null,
                });
            if (error) throw error;
            setShowAddModal(false);
            setNewDevice({ device_name: '', device_type: 'attendance_machine', connection_type: 'webhook', ip_address: '', port: '' });
            fetchData();
        } catch (err: any) {
            alert('Failed to add device: ' + err.message);
        }
    };

    const handleDeleteDevice = async (id: string) => {
        if (!confirm('Delete this device? This will also remove all its logs.')) return;
        try {
            await supabase.from('device_attendance_logs').delete().eq('device_id', id);
            const { error } = await supabase.from('device_integrations').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert('Failed to delete: ' + err.message);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            const { error } = await supabase
                .from('device_integrations')
                .update({ status: newStatus })
                .eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert('Failed to update: ' + err.message);
        }
    };

    const handleSyncNow = async () => {
        if (!currentCompanyId) return;
        setSyncing(true);
        try {
            const { data, error } = await supabase
                .rpc('rpc_sync_device_attendance', { p_company_id: currentCompanyId });
            if (error) throw error;
            const result = data as unknown as { synced: number; failed: number };
            alert(`Sync complete! ${result.synced} synced, ${result.failed} failed.`);
            fetchData();
        } catch (err: any) {
            alert('Sync failed: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(id);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const toggleRevealKey = (id: string) => {
        setRevealedKeys(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const webhookUrl = `https://euoaoyzpurbvcoxydunl.supabase.co/functions/v1/device-webhook`;

    const formatTime = (ts: string | null) => {
        if (!ts) return 'Never';
        return new Date(ts).toLocaleString();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Server className="w-6 h-6 text-indigo-600" />
                        Device Integration Hub
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Connect barcode scanners, cameras, and attendance machines to your ERP.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSyncNow}
                        disabled={syncing || (syncStatus?.pending_logs || 0) === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : `Sync Now${syncStatus?.pending_logs ? ` (${syncStatus.pending_logs})` : ''}`}
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" /> Add Device
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg w-fit">
                {(['overview', 'devices', 'logs'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${activeTab === tab ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="py-20 text-center text-slate-400">Loading device data...</div>
            ) : (
                <>
                    {/* Overview Tab */}
                    {activeTab === 'overview' && syncStatus && (
                        <div className="space-y-6">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <StatCard icon={Server} label="Total Devices" value={syncStatus.total_devices} color="indigo" />
                                <StatCard icon={Wifi} label="Active" value={syncStatus.active_devices} color="emerald" />
                                <StatCard icon={Clock} label="Pending Sync" value={syncStatus.pending_logs} color="amber" />
                                <StatCard icon={CheckCircle} label="Synced Today" value={syncStatus.synced_today} color="green" />
                                <StatCard icon={XCircle} label="Failed" value={syncStatus.failed_logs} color="rose" />
                            </div>

                            {/* Webhook Info Card */}
                            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                    <h3 className="font-semibold text-slate-800 dark:text-white">Webhook Endpoint</h3>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                    Configure your attendance machines to POST data to this URL with the device's API key.
                                </p>
                                <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
                                    <code className="text-sm text-indigo-700 dark:text-indigo-300 font-mono flex-1 break-all">
                                        POST {webhookUrl}
                                    </code>
                                    <button
                                        onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                                        className="text-indigo-500 hover:text-indigo-700 p-1"
                                        title="Copy URL"
                                    >
                                        {copiedKey === 'webhook' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="mt-3 bg-slate-800 dark:bg-zinc-900 rounded-lg p-3 text-xs font-mono text-slate-300">
                                    <span className="text-slate-500"># Example: POST with API key</span><br />
                                    <span className="text-emerald-400">curl</span> -X POST {webhookUrl} \<br />
                                    &nbsp;&nbsp;-H <span className="text-amber-300">"x-api-key: YOUR_DEVICE_API_KEY"</span> \<br />
                                    &nbsp;&nbsp;-H <span className="text-amber-300">"Content-Type: application/json"</span> \<br />
                                    &nbsp;&nbsp;-d <span className="text-cyan-300">{'\'{"punches":[{"employee_id":"EMP001","timestamp":"2026-04-09T08:00:00Z","type":"check_in"}]}\''}</span>
                                </div>
                            </div>

                            {/* Device Status List */}
                            {syncStatus.devices.length > 0 && (
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
                                        <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-indigo-500" /> Device Status
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {syncStatus.devices.map(d => {
                                            const config = DEVICE_TYPE_CONFIG[d.type] || DEVICE_TYPE_CONFIG.attendance_machine;
                                            const Icon = config.icon;
                                            return (
                                                <div key={d.id} className="px-5 py-4 flex items-center gap-4">
                                                    <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
                                                        <Icon className={`w-5 h-5 ${config.color}`} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-slate-800 dark:text-white text-sm">{d.name}</p>
                                                        <p className="text-xs text-slate-400">{config.label} • Last sync: {formatTime(d.last_sync)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs">
                                                        {d.pending > 0 && (
                                                            <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full font-medium">
                                                                {d.pending} pending
                                                            </span>
                                                        )}
                                                        <span className="font-mono text-slate-400">{d.sync_count} synced</span>
                                                        <span className={`flex items-center gap-1 ${d.status === 'active' ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                            {d.status === 'active' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                                            {d.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {syncStatus.devices.length === 0 && (
                                <div className="py-16 text-center">
                                    <Server className="w-12 h-12 text-slate-200 dark:text-zinc-700 mx-auto mb-4" />
                                    <p className="text-slate-400 dark:text-zinc-500 font-medium">No devices registered yet</p>
                                    <p className="text-sm text-slate-300 dark:text-zinc-600 mt-1">Click "Add Device" to connect your first device.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Devices Tab */}
                    {activeTab === 'devices' && (
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                            {devices.length === 0 ? (
                                <div className="py-16 text-center text-slate-400">No devices registered yet.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs text-slate-500 font-medium uppercase">Device</th>
                                            <th className="px-5 py-3 text-left text-xs text-slate-500 font-medium uppercase">Type</th>
                                            <th className="px-5 py-3 text-left text-xs text-slate-500 font-medium uppercase">API Key</th>
                                            <th className="px-5 py-3 text-center text-xs text-slate-500 font-medium uppercase">Status</th>
                                            <th className="px-5 py-3 text-left text-xs text-slate-500 font-medium uppercase">Last Sync</th>
                                            <th className="px-5 py-3 text-center text-xs text-slate-500 font-medium uppercase w-20">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {devices.map(device => {
                                            const config = DEVICE_TYPE_CONFIG[device.device_type] || DEVICE_TYPE_CONFIG.attendance_machine;
                                            const Icon = config.icon;
                                            const keyRevealed = revealedKeys.has(device.id);
                                            return (
                                                <tr key={device.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${config.bgColor}`}>
                                                                <Icon className={`w-4 h-4 ${config.color}`} />
                                                            </div>
                                                            <span className="font-medium text-slate-800 dark:text-white">{device.device_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-500 text-xs">{config.label}</td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <code className="text-xs font-mono text-slate-500 bg-slate-50 dark:bg-zinc-800 px-2 py-1 rounded max-w-[200px] truncate">
                                                                {keyRevealed ? device.api_key : '••••••••••••••••'}
                                                            </code>
                                                            <button onClick={() => toggleRevealKey(device.id)} className="text-slate-300 hover:text-slate-500 p-0.5">
                                                                {keyRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <button onClick={() => copyToClipboard(device.api_key, device.id)} className="text-slate-300 hover:text-indigo-500 p-0.5">
                                                                {copiedKey === device.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <button
                                                            onClick={() => handleToggleStatus(device.id, device.status)}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${device.status === 'active'
                                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                                                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:bg-slate-200'}`}
                                                        >
                                                            {device.status === 'active' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                                            {device.status}
                                                        </button>
                                                    </td>
                                                    <td className="px-5 py-4 text-xs text-slate-400">{formatTime(device.last_sync_at)}</td>
                                                    <td className="px-5 py-4 text-center">
                                                        <button
                                                            onClick={() => handleDeleteDevice(device.id)}
                                                            className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* Logs Tab */}
                    {activeTab === 'logs' && (
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                            {logs.length === 0 ? (
                                <div className="py-16 text-center text-slate-400">No attendance logs yet.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs text-slate-500 font-medium uppercase">Employee</th>
                                            <th className="px-5 py-3 text-left text-xs text-slate-500 font-medium uppercase">Device</th>
                                            <th className="px-5 py-3 text-left text-xs text-slate-500 font-medium uppercase">Punch Time</th>
                                            <th className="px-5 py-3 text-center text-xs text-slate-500 font-medium uppercase">Type</th>
                                            <th className="px-5 py-3 text-center text-xs text-slate-500 font-medium uppercase">Sync Status</th>
                                            <th className="px-5 py-3 text-left text-xs text-slate-500 font-medium uppercase">Error</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-white text-xs">
                                                            {log.employees?.name || log.employee_identifier}
                                                        </p>
                                                        {log.employees?.employee_code && (
                                                            <p className="text-[10px] text-slate-400 font-mono">{log.employees.employee_code}</p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 text-xs text-slate-500">
                                                    {log.device_integrations?.device_name || '-'}
                                                </td>
                                                <td className="px-5 py-3 text-xs text-slate-500 font-mono">
                                                    {new Date(log.punch_time).toLocaleString()}
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.punch_type === 'check_in' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                                                        log.punch_type === 'check_out' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                                                        'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-slate-400'}`}>
                                                        {log.punch_type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${log.sync_status === 'synced' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                                                        log.sync_status === 'pending' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                                                        log.sync_status === 'failed' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' :
                                                        'bg-slate-100 text-slate-500'}`}>
                                                        {log.sync_status === 'synced' && <CheckCircle className="w-3 h-3" />}
                                                        {log.sync_status === 'pending' && <Clock className="w-3 h-3" />}
                                                        {log.sync_status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                                                        {log.sync_status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-xs text-rose-400 max-w-[200px] truncate" title={log.sync_error || ''}>
                                                    {log.sync_error || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Add Device Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-slate-200 dark:border-zinc-800">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Plus className="w-5 h-5 text-indigo-500" /> Register New Device
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-300 hover:text-slate-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Device Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Main Entrance Biometric"
                                    value={newDevice.device_name}
                                    onChange={e => setNewDevice(p => ({ ...p, device_name: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Device Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(DEVICE_TYPE_CONFIG).map(([key, cfg]) => {
                                        const Icon = cfg.icon;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setNewDevice(p => ({
                                                    ...p,
                                                    device_type: key,
                                                    connection_type: (key === 'biometric' || key === 'attendance_machine') ? 'webhook' : key === 'camera' ? 'camera' : 'usb',
                                                }))}
                                                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium ${newDevice.device_type === key
                                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                                    : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-slate-300'}`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {(newDevice.device_type === 'biometric' || newDevice.device_type === 'attendance_machine') && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">IP Address (optional)</label>
                                            <input
                                                type="text"
                                                placeholder="192.168.1.100"
                                                value={newDevice.ip_address}
                                                onChange={e => setNewDevice(p => ({ ...p, ip_address: e.target.value }))}
                                                className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Port (optional)</label>
                                            <input
                                                type="number"
                                                placeholder="4370"
                                                value={newDevice.port}
                                                onChange={e => setNewDevice(p => ({ ...p, port: e.target.value }))}
                                                className="w-full px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
                                        <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                        <p className="text-xs text-amber-700 dark:text-amber-400">
                                            After adding, configure your device's push URL to the webhook endpoint with the generated API key.
                                            Supports ZKTeco ADMS, HikVision ISAPI, and custom HTTP POST formats.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-zinc-800">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddDevice}
                                disabled={!newDevice.device_name.trim()}
                                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
                            >
                                <ArrowRight className="w-4 h-4" /> Register Device
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Stats Card Component
const StatCard: React.FC<{ icon: React.ElementType; label: string; value: number; color: string }> = ({ icon: Icon, label, value, color }) => {
    const colorMap: Record<string, string> = {
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
        rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
    };
    return (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-medium">{label}</p>
                </div>
            </div>
        </div>
    );
};
