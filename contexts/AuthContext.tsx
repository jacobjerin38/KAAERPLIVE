import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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
            let companyId: string | null = null;

            if (!roleName) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role, company_id')
                    .eq('id', userId)
                    .maybeSingle();

                if (profileError) {
                    console.warn('Could not fetch profile (RLS?), defaulting to Admin:', profileError.message);
                    setUserRole('Admin');
                    setPermissions(['*']);
                    return;
                }
                roleName = profile?.role || 'Admin';
                companyId = profile?.company_id || null;
            }

            setUserRole(roleName);

            // Admin bypass
            if (['admin', 'super admin'].includes(roleName?.toLowerCase() || '')) {
                setPermissions(['*']);
                return;
            }

            // Fetch role-based permissions
            let rolePerms: string[] = [];
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
                rolePerms = roleData.permissions;
            } else {
                setPermissions(['*']);
                return;
            }

            // Fetch per-user permission overrides and merge (additive)
            const { data: userPerms } = await supabase
                .from('user_permissions')
                .select('permission, granted')
                .eq('user_id', userId)
                .eq('granted', true);

            const extraPerms = userPerms?.map((p: any) => p.permission) || [];
            const merged = Array.from(new Set([...rolePerms, ...extraPerms]));
            setPermissions(merged);
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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

    // ===== Session Timeout (15 min inactivity) =====
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (session) {
            timeoutRef.current = setTimeout(() => {
                alert('Your session has expired due to inactivity. Please log in again.');
                signOut();
            }, TIMEOUT_MS);
        }
    }, [session]);

    useEffect(() => {
        if (!session) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }
        const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(evt => window.addEventListener(evt, resetTimer));
        resetTimer(); // Start the timer
        return () => {
            events.forEach(evt => window.removeEventListener(evt, resetTimer));
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [session, resetTimer]);

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

        // 4. Log LOGIN activity
        if (user) {
            try {
                await supabase.from('activity_logs' as any).insert({
                    company_id: companyId,
                    user_id: user.id,
                    user_email: user.email,
                    action: 'LOGIN',
                    description: `User session activated: ${user.email}`
                });
            } catch (err) {
                console.error('Failed to log login activity:', err);
            }
        }
    };

    const signOut = async () => {
        // Log LOGOUT activity before clearing credentials and session
        try {
            if (user && currentCompanyId) {
                await supabase.from('activity_logs' as any).insert({
                    company_id: currentCompanyId,
                    user_id: user.id,
                    user_email: user.email,
                    action: 'LOGOUT',
                    description: `User session ended: ${user.email}`
                });
            }
        } catch (err) {
            console.error('Failed to log logout activity:', err);
        }

        localStorage.removeItem('app.current_company');
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
        if (['admin', 'super admin'].includes(userRole?.toLowerCase() || '')) return true; // Admin bypass
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
