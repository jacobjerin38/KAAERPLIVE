import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserCompanyAccess } from '../hrms/types';
import { Building2, Check, ChevronRight, LogOut, Shield } from 'lucide-react';

interface CompanySelectorProps {
    onSelect: (companyId: string) => void;
    currentCompanyId?: string;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({ onSelect, currentCompanyId }) => {
    const [companies, setCompanies] = useState<UserCompanyAccess[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase.rpc('rpc_get_user_companies');
            if (error) throw error;
            setCompanies(data || []);

            // Auto-select if only 1 company and no current selection
            if (data && data.length === 1 && !currentCompanyId) {
                onSelect(data[0].company_id);
            }
        } catch (err) {
            console.error('Error fetching companies:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 bg-slate-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    // Group companies by their group_name
    const groupedCompanies = companies.reduce((acc, company) => {
        const groupName = company.group_name || 'Independent Companies';
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(company);
        return acc;
    }, {} as Record<string, UserCompanyAccess[]>);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
                {/* Header */}
                <div className="px-8 py-10 bg-slate-900 text-white text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 z-0"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/20">
                            <Building2 className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Select Organization</h1>
                        <p className="text-slate-400">Choose the company you want to access</p>
                    </div>
                </div>

                {/* List */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {Object.entries(groupedCompanies).map(([groupName, groupCompanies]) => (
                        <div key={groupName} className="mb-6 last:mb-0">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
                                {groupName}
                            </h3>
                            <div className="space-y-2">
                                {groupCompanies.map(company => (
                                    <button
                                        key={company.company_id}
                                        onClick={() => onSelect(company.company_id)}
                                        className={`w-full flex items-center p-4 rounded-xl transition-all border group text-left
                                            ${currentCompanyId === company.company_id
                                                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500/20'
                                                : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50 hover:shadow-md'
                                            }`}
                                    >
                                        <div className={`p-3 rounded-lg mr-4 transition-colors ${currentCompanyId === company.company_id
                                            ? 'bg-blue-100 text-blue-600'
                                            : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-blue-500'
                                            }`}>
                                            <Building2 className="w-5 h-5" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-semibold truncate ${currentCompanyId === company.company_id ? 'text-blue-900' : 'text-slate-900'
                                                }`}>
                                                {company.company_name}
                                            </h4>
                                            <div className="flex items-center text-xs mt-1">
                                                <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${currentCompanyId === company.company_id
                                                    ? 'bg-blue-200 text-blue-700'
                                                    : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    <Shield className="w-3 h-3" />
                                                    {company.role_name || 'Viewer'}
                                                </span>
                                                {company.company_code && (
                                                    <span className="ml-2 text-slate-400 font-mono">
                                                        #{company.company_code}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {currentCompanyId === company.company_id ? (
                                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                                <Check className="w-4 h-4" />
                                            </div>
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                    {Object.keys(groupedCompanies).length === 0 && (
                        <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <p className="text-xs text-amber-600 mb-2">Don't see your company?</p>
                            <button
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const { data, error } = await supabase.rpc('rpc_fix_my_access');
                                        if (error) throw error;
                                        alert(data);
                                        window.location.reload();
                                    } catch (e: any) {
                                        alert("Fix failed: " + e.message);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="text-xs font-bold text-amber-700 underline hover:text-amber-800"
                            >
                                Repair My Access
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors font-medium text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};
