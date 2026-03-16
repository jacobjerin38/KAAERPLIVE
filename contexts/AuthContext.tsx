import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';


interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    currentCompanyId: string | null;
    selectCompany: (companyId: string) => void;
    userRole: string | null;
    permissions: string[];
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);

    const fetchUserRoleAndPermissions = async (userId: string, roleNameOverride?: string) => {
        try {
            let roleName = roleNameOverride;

            if (!roleName) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role, role_id')
                    .eq('id', userId)
                    .maybeSingle();

                if (profileError) {
                    console.warn('Could not fetch profile (RLS?), defaulting to Admin:', profileError.message);
                    // If we can't even read the profile, grant full access to avoid lockout
                    setUserRole('Admin');
                    setPermissions(['*']);
                    return;
                }
                roleName = profile?.role || 'Admin'; // Default to Admin instead of essp_user
            }

            setUserRole(roleName);

            // Admin bypass - don't even need to look up permissions
            if (roleName?.toLowerCase() === 'admin') {
                setPermissions(['*']);
                return;
            }

            // Fetch permissions from roles table for non-admin roles
            const { data: roleData, error: roleError } = await supabase
                .from('roles')
                .select('permissions')
                .ilike('name', roleName)
                .maybeSingle();

            if (roleError) {
                console.warn('Could not fetch role permissions (RLS?), granting full access:', roleError.message);
                setPermissions(['*']);
                return;
            }

            if (roleData?.permissions && roleData.permissions.length > 0) {
                setPermissions(roleData.permissions);
            } else {
                // Fallback: grant full access if role has no permissions defined
                setPermissions(['*']);
            }
        } catch (err) {
            console.error('Permission fetch crashed, granting full access:', err);
            setUserRole('Admin');
            setPermissions(['*']);
        }
    };

    useEffect(() => {
        // Init Session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            // Restore company from local storage if valid
            const storedCompany = localStorage.getItem('app.current_company');
            if (storedCompany) setCurrentCompanyId(storedCompany);

            // Fetch user role from profile
            if (session?.user) {
                await fetchUserRoleAndPermissions(session.user.id);
            }

            setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            if (!session) {
                localStorage.removeItem('app.current_company');
                setCurrentCompanyId(null);
                setUserRole(null);
                setPermissions([]);
            } else {
                fetchUserRoleAndPermissions(session.user.id);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const selectCompany = async (companyId: string) => {
        setCurrentCompanyId(companyId);
        localStorage.setItem('app.current_company', companyId);

        // Re-fetch role for the selected company context
        if (user) {
            await fetchUserRoleAndPermissions(user.id);
        }

        // 1. Update Profile in DB (Source of Truth for RLS Fallback)
        if (user) {
            await supabase.from('profiles').update({ company_id: companyId }).eq('id', user.id);
        }

        // 2. Update Supabase Global Headers (Optimization for RLS)
        // @ts-ignore
        if (supabase.rest) supabase.rest.headers['x-company-id'] = companyId;

        // 3. Force token refresh to ensure claims (if using custom claims later) are updated
        await supabase.auth.refreshSession();

        // No reload needed if our app is reactive, but good for clean slate
    };

    const signOut = async () => {
        localStorage.removeItem('app.current_company');
        setCurrentCompanyId(null);
        setCurrentCompanyId(null);
        setUserRole(null);
        setPermissions([]);
        // Clear header
        // @ts-ignore
        delete supabase.rest.headers['x-company-id'];

        await supabase.auth.signOut();
    };

    // Restore header on init
    useEffect(() => {
        if (currentCompanyId) {
            // @ts-ignore
            supabase.rest.headers['x-company-id'] = currentCompanyId;
        }
    }, [currentCompanyId]);

    const hasPermission = (permission: string) => {
        if (permissions.includes('*')) return true; // Super admin wildcard
        if (userRole?.toLowerCase() === 'admin') return true; // Admin bypass (case insensitive)
        return permissions.includes(permission);
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signOut, currentCompanyId, selectCompany, userRole, permissions, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
