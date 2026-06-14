import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { HelpDeskModule } from './hrms/HelpDeskModule';
import { Employee } from '../hrms/types';
import { Loader2 } from 'lucide-react';

export const HelpDeskHub: React.FC = () => {
    const { user } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // Fetch current company id from profiles
                const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle();
                if (!profile?.company_id) {
                    setLoading(false);
                    return;
                }

                // Fetch current employee
                const { data: emp } = await supabase.from('employees').select('*').eq('profile_id', user.id).maybeSingle();
                if (emp) {
                    setCurrentEmployee({ ...emp, id: emp.id, joinDate: emp.join_date, company_id: emp.company_id } as any);
                }

                // Fetch all employees in company
                const { data: empData } = await supabase.from('employees')
                    .select('*')
                    .eq('company_id', profile.company_id)
                    .order('name');
                
                if (empData) {
                    setEmployees(empData.map((e: any) => ({
                        ...e,
                        joinDate: e.join_date,
                        salary: e.salary_amount,
                        avatar: e.profile_photo_url
                    })) as any);
                }
            } catch (err) {
                console.error("Error loading Help Desk data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
                <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 dark:bg-zinc-950 overflow-y-auto">
            <HelpDeskModule employees={employees} currentEmployee={currentEmployee} />
        </div>
    );
};
