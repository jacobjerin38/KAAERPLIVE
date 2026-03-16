import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, Building2, User, Loader2 } from 'lucide-react';
import { KAA_LOGO_URL } from '../constants';
import { supabase } from '../lib/supabase';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    // Sign Up Extra Fields
    const [fullName, setFullName] = useState('');
    const [companyName, setCompanyName] = useState('');

    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                // 1. Sign Up
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (authError) throw authError;
                if (!authData.user) throw new Error("No user created");

                // Check if session was created (if not, email confirmation might be required)
                if (!authData.session && !authData.user.aud) {
                    // This is a rough check. improved below.
                }

                // 2. Create Company (auto-generate code from name)
                const companyCode = companyName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'COMP';
                const { data: companyData, error: companyError } = await supabase
                    .from('companies')
                    .insert([{ name: companyName, code: companyCode, status: 'active', subscription_status: 'active' }])
                    .select()
                    .single();

                if (companyError) throw companyError;

                // 3. Create Profile (Link User -> Company)
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([{
                        id: authData.user.id,
                        company_id: companyData.id,
                        full_name: fullName,
                        role: 'admin'
                    }]);

                if (profileError) throw profileError;

                // Auto sign in happens usually, or allow them to log in
                if (authData.session) {
                    // 4. Create User Company Access (Explicit Link)
                    // We skip role_id for now as the role might not exist yet, 
                    // but we link the user to the company to ensure visibility.
                    const { error: accessError } = await supabase
                        .from('user_company_access')
                        .insert([{
                            user_id: authData.user.id,
                            company_id: companyData.id,
                            role_id: null, // Will fallback to profile role string
                            is_default: true,
                            status: 'active'
                        }]);

                    if (accessError) console.error("Access Link Error:", accessError);

                    alert("Account created successfully! You are now logged in.");
                } else {
                    alert("Account created! Please check your email to confirm your registration before logging in.");
                    setIsSignUp(false); // Switch to login view
                }

            } else {
                // Sign In
                // Transform User ID to Email if needed
                let loginEmail = email.trim();
                if (!loginEmail.includes('@')) {
                    loginEmail = `${loginEmail}@kaa.com`;
                }

                const { error } = await supabase.auth.signInWithPassword({
                    email: loginEmail,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            console.error("Auth Error:", err);
            let msg = err.message || 'Authentication failed';
            if (msg.includes("Invalid login credentials")) {
                msg = "Invalid email or password. If you haven't created an account yet, switch to 'Register Company'.";
            }
            setError(msg);

            // Add shake animation logic here if ref was used, but simple error state is fine for now
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 relative overflow-hidden transition-colors duration-500">
            {/* Ambient Background - Matches Dashboard */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] animate-blob mix-blend-multiply dark:mix-blend-normal"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-normal"></div>
                <div className="absolute top-[40%] left-[20%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-normal"></div>
            </div>

            <div className="w-full max-w-[420px] relative z-10 perspective-1000">
                <div className={`relative bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-2xl shadow-indigo-500/10 dark:shadow-black/40 rounded-[2.5rem] p-8 md:p-10 transition-all duration-500 ${isLoading ? 'scale-[0.98] opacity-90' : 'scale-100 opacity-100'}`}>

                    {/* Header */}
                    <div className="flex flex-col items-center mb-10">
                        <div className="relative mb-6 group">
                            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500 opacity-0 group-hover:opacity-100"></div>
                            <img src={KAA_LOGO_URL} alt="Kaa Logo" className="h-16 w-auto relative z-10 drop-shadow-sm" />
                        </div>
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight mb-2">
                            {isSignUp ? 'Join the Future' : 'Welcome Back'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium text-center">
                            {isSignUp ? 'Set up your intelligent enterprise workspace.' : 'Enter your credentials to access the dashboard.'}
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 mx-2 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-xs font-semibold text-center animate-shake">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <div className="space-y-4 animate-slide-up">
                                <div className="group relative">
                                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300" />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 border-2 border-transparent group-focus-within:border-indigo-500/20 rounded-2xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
                                        required
                                    />
                                </div>
                                <div className="group relative">
                                    <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300" />
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        placeholder="Company Name"
                                        className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 border-2 border-transparent group-focus-within:border-indigo-500/20 rounded-2xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="group relative">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300" />
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={isSignUp ? "Email Address" : "Email or User ID"}
                                    className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 border-2 border-transparent group-focus-within:border-indigo-500/20 rounded-2xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
                                    required
                                />
                            </div>

                            <div className="group relative">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 border-2 border-transparent group-focus-within:border-indigo-500/20 rounded-2xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
                                    required
                                />
                            </div>
                        </div>

                        {!isSignUp && (
                            <div className="flex justify-end">
                                <a href="#" className="text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 transition-colors">Forgot Password?</a>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-sm shadow-xl shadow-slate-900/10 dark:shadow-white/5 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-6 group relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        {isSignUp ? 'Create Workspace' : 'Sign In'} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </span>
                            {/* Button Shine Effect */}
                            <div className="absolute inset-0 -translate-x-[100%] group-hover:animate-shine bg-gradient-to-r from-transparent via-white/20 to-transparent z-0"></div>
                        </button>
                    </form>

                    <div className="mt-8 text-center pt-6 border-t border-slate-200/50 dark:border-white/5">
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                            {isSignUp ? "Already a partner?" : "New to Kaa ERP?"}
                            <button
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-700 dark:hover:text-indigo-300 ml-1.5 transition-all outline-none focus:underline"
                            >
                                {isSignUp ? "Log In Here" : "Create Account"}
                            </button>
                        </p>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[10px] text-slate-400/60 dark:text-slate-600 font-bold uppercase tracking-[0.2em] hover:text-slate-500 transition-colors cursor-default">
                        Powered by Kaa Technologies
                    </p>
                </div>
            </div>

            {/* Dev Helper: Quick Seed */}
            {
                import.meta.env.DEV && (
                    <button
                        onClick={async () => {
                            if (!confirm("This will create specific demo users (admin@kaa.com, staff@kaa.com). Continue?")) return;
                            setIsLoading(true);
                            try {
                                const password = "kaa12345";

                                // 0. Try Login First checking if already good
                                const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
                                    email: 'admin@kaa.com',
                                    password: password
                                });

                                if (loginData.session) {
                                    alert("Admin user (admin@kaa.com) already exists and password is correct! You can just log in.");
                                    setIsLoading(false);
                                    return;
                                }

                                // 1. Create Admin
                                console.log("Creating admin...");
                                const { data: adminAuth, error: adminErr } = await supabase.auth.signUp({
                                    email: 'admin@kaa.com',
                                    password: password,
                                });

                                if (adminErr) throw adminErr;

                                // CHECK: Failed Session (User exists or Email Verify on)
                                if (adminAuth.user && !adminAuth.session) {
                                    alert("⚠️ User 'admin@kaa.com' already exists OR Email Confirmation is ON.\n\nSince you cannot log in, the password might be wrong or the user is unconfirmed.\n\nACTION REQUIRED:\n1. Go to Supabase Dashboard -> Authentication -> Users.\n2. DELETE 'admin@kaa.com' and 'staff@kaa.com'.\n3. Refresh this page and click this button again.");
                                    setIsLoading(false);
                                    return;
                                }

                                if (adminAuth.user) {
                                    // Create Company
                                    const { data: company } = await supabase.from('companies').insert([{ name: 'Kaa Tech Demo' }]).select().single();
                                    if (company) {
                                        // Admin Profile
                                        await supabase.from('profiles').upsert({
                                            id: adminAuth.user.id,
                                            company_id: company.id,
                                            full_name: 'Kaa Admin',
                                            role: 'admin'
                                        });

                                        // 2. Create Employee User
                                        await supabase.auth.signOut();

                                        const { data: empAuth } = await supabase.auth.signUp({
                                            email: 'staff@kaa.com',
                                            password: password
                                        });

                                        if (empAuth.user) {
                                            // Employee Profile
                                            await supabase.from('profiles').upsert({
                                                id: empAuth.user.id,
                                                company_id: company.id, // Same company
                                                full_name: 'Sarah Staff',
                                                role: 'employee'
                                            });

                                            // Employee Record in HRMS table
                                            await supabase.from('employees').insert({
                                                company_id: company.id,
                                                profile_id: empAuth.user.id, // Link to auth user
                                                name: 'Sarah Staff',
                                                email: 'staff@kaa.com',
                                                role: 'Product Designer',
                                                department: 'Design',
                                                status: 'Active',
                                                join_date: new Date().toISOString().split('T')[0],
                                                salary_amount: 60000
                                            });
                                        }
                                    }
                                }
                                await supabase.auth.signOut();
                                alert(`Demo Users Created!\n\nAdmin: admin@kaa.com\nStaff: staff@kaa.com\nPassword: ${password}`);
                            } catch (e: any) {
                                console.error(e);
                                alert("Seeding failed: " + e.message);
                            } finally {
                                setIsLoading(false);
                            }
                        }}
                        className="absolute top-4 right-4 px-3 py-1 bg-white/50 backdrop-blur text-slate-500 text-xs font-bold rounded-lg border border-slate-200/50 hover:bg-white/80 transition-colors z-50"
                    >
                        ⚡ Seed Demo Data
                    </button>
                )
            }
        </div >
    );
};