import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../components/hrms/types';
import { useAuth } from './AuthContext';

interface ESSPContextType {
    employeeProfile: Employee | null;
    reportingManager: { name: string, id: string } | null;
    roleFlags: {
        isManager: boolean;
        isHR: boolean;
        isApprover: boolean;
    };
    loading: boolean;
    refreshESSPData: () => Promise<void>;
}

const ESSPContext = createContext<ESSPContextType | undefined>(undefined);

export const ESSPProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
    const [reportingManager, setReportingManager] = useState<{ name: string, id: string } | null>(null);
    const [roleFlags, setRoleFlags] = useState({ isManager: false, isHR: false, isApprover: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            refreshESSPData();
        } else {
            setLoading(false);
        }
    }, [user]);

    const refreshESSPData = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // 0. Check Profile for Link first
            let linkedEmployeeId = null;
            const { data: profile } = await supabase.from('profiles').select('employee_id').eq('id', user.id).maybeSingle();
            if (profile?.employee_id) linkedEmployeeId = profile.employee_id;

            // 1. Fetch Employee Profile
            // @ts-ignore
            let query = supabase.from('employees').select(`
                    *,
                    reporting_manager:manager_id(id, name),
                    departments:department_id(id, name),
                    org_designations:designation_id(id, name),
                    org_grades:grade_id(id, name),
                    org_employment_types:employment_type_id(id, name),
                    locations:location_id(id, name)
                `);

            if (linkedEmployeeId) {
                query = query.eq('id', linkedEmployeeId);
            } else {
                query = query.eq('email', user.email);
            }

            const { data: empData, error } = await query.maybeSingle();

            if (error) {
                console.error("ESSP Data Fetch Error:", error);
                setLoading(false);
                return;
            }

            if (!empData) {
                // Fallback attempt with ID if email match fails (depends on schemas)
                // Only try this if we haven't already tried linkedId
                if (!linkedEmployeeId) {
                    // @ts-ignore
                    const { data: empDataById } = await supabase.from('employees').select('*, reporting_manager:manager_id(id, name), departments:department_id(id, name), org_designations:designation_id(id, name), org_grades:grade_id(id, name), org_employment_types:employment_type_id(id, name), locations:location_id(id, name)').eq('id', user.id).maybeSingle();
                    if (empDataById) {
                        processEmployeeData(empDataById);
                        return;
                    }
                }
                setLoading(false);
                return;
            }

            processEmployeeData(empData);

        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const processEmployeeData = async (empData: any) => {
        setEmployeeProfile(empData);
        setReportingManager(empData.reporting_manager);

        // 2. Derive Role Flags from real data
        // Check if this employee is a manager for anyone
        const { count } = await supabase
            .from('employees')
            .select('id', { count: 'exact', head: true })
            .eq('manager_id', empData.id);

        // Check HR role (simple check on department or role name for now)
        const isHR = empData.department?.toLowerCase()?.includes('hr') || empData.role?.toLowerCase()?.includes('hr') || false;

        setRoleFlags({
            isManager: (count || 0) > 0,
            isHR: isHR,
            isApprover: (count || 0) > 0 // Simplistic for now
        });
        setLoading(false);
    }

    return (
        <ESSPContext.Provider value={{
            employeeProfile,
            reportingManager,
            roleFlags,
            loading,
            refreshESSPData
        }}>
            {children}
        </ESSPContext.Provider>
    );
};

export const useESSP = () => {
    const context = useContext(ESSPContext);
    if (!context) {
        throw new Error('useESSP must be used within an ESSPProvider');
    }
    return context;
};
