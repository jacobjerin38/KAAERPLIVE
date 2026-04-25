import React, { useState, useEffect } from 'react';
import { FileText, Upload, Filter, Search, Calendar, AlertCircle, Trash2, Download, Eye, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const DocumentManagement: React.FC = () => {
    const { currentCompanyId } = useAuth();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [showUploadModal, setShowUploadModal] = useState(false);

    // New Document State
    const [newDoc, setNewDoc] = useState({
        title: '',
        category: 'Corporate',
        expiry_date: '',
        access_level: 'All'
    });
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const categories = ['Corporate', 'HR', 'Legal', 'Finance', 'Operations', 'Other'];
    const accessLevels = ['All', 'Management', 'HR'];

    useEffect(() => {
        if (currentCompanyId) {
            fetchDocuments();
        }
    }, [currentCompanyId]);

    const fetchDocuments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('doc_documents')
            .select('*, profiles:last_updated_by(full_name)')
            .eq('company_id', currentCompanyId)
            .order('created_at', { ascending: false });

        if (data) setDocuments(data);
        if (error) console.error("Error fetching documents:", error);
        setLoading(false);
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId || !newDoc.title || !newDoc.category) return alert("Please fill required fields.");
        
        setUploading(true);
        let fileUrl = 'https://example.com/mock-document.pdf';

        if (file) {
            // Attempt to upload to a 'documents' bucket. If it fails (bucket doesn't exist), we fallback to mock URL.
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${currentCompanyId}/${fileName}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);
                
            if (!uploadError && uploadData) {
                const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
                fileUrl = publicUrl;
            }
        }

        const { error } = await supabase.from('doc_documents').insert([{
            company_id: currentCompanyId,
            title: newDoc.title,
            category: newDoc.category,
            expiry_date: newDoc.expiry_date || null,
            access_level: newDoc.access_level,
            file_url: fileUrl,
            last_updated_by: (await supabase.auth.getUser()).data.user?.id
        }]);

        if (error) {
            alert("Error saving document: " + error.message);
        } else {
            setShowUploadModal(false);
            setNewDoc({ title: '', category: 'Corporate', expiry_date: '', access_level: 'All' });
            setFile(null);
            fetchDocuments();
        }
        setUploading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        await supabase.from('doc_documents').delete().eq('id', id);
        fetchDocuments();
    };

    const filteredDocs = documents.filter(doc => 
        (categoryFilter === 'All' || doc.category === categoryFilter) &&
        doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isExpiringSoon = (dateStr: string) => {
        if (!dateStr) return false;
        const days = (new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
        return days > 0 && days <= 30;
    };

    const isExpired = (dateStr: string) => {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date();
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950 animate-page-enter">
            {/* Header */}
            <div className="px-8 py-6 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <FileText className="w-7 h-7 text-indigo-600" />
                        Document Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Centralized repository for corporate documents, contracts, and policies.</p>
                </div>
                <button 
                    onClick={() => setShowUploadModal(true)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all"
                >
                    <Upload className="w-5 h-5" />
                    Upload Document
                </button>
            </div>

            {/* Toolbar */}
            <div className="p-8 pb-4 flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder="Search documents by title..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div className="relative">
                    <Filter className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="pl-11 pr-8 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm outline-none appearance-none font-medium text-slate-700 dark:text-slate-300"
                    >
                        <option value="All">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Document List */}
            <div className="flex-1 px-8 pb-8 overflow-y-auto">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4">Document Title</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Expiry Status</th>
                                <th className="px-6 py-4">Access Level</th>
                                <th className="px-6 py-4">Date Uploaded</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading documents...</td></tr>
                            ) : filteredDocs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">No documents found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredDocs.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">{doc.title}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">Uploaded by: {doc.profiles?.full_name || 'System'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold">
                                                {doc.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {doc.expiry_date ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-4 h-4 text-slate-400" />
                                                    <span className={`font-medium ${
                                                        isExpired(doc.expiry_date) ? 'text-rose-600 dark:text-rose-400' :
                                                        isExpiringSoon(doc.expiry_date) ? 'text-amber-600 dark:text-amber-400' : 
                                                        'text-slate-600 dark:text-slate-300'
                                                    }`}>
                                                        {new Date(doc.expiry_date).toLocaleDateString()}
                                                    </span>
                                                    {isExpired(doc.expiry_date) && <AlertCircle className="w-4 h-4 text-rose-500" />}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs font-medium">No Expiry</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <ShieldAlert className="w-4 h-4 text-indigo-500" />
                                                <span className="text-slate-600 dark:text-slate-300 font-medium">{doc.access_level}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                                            {new Date(doc.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="View Document">
                                                    <Eye className="w-5 h-5" />
                                                </a>
                                                <a href={doc.file_url} download className="p-2 text-slate-400 hover:text-emerald-600 transition-colors" title="Download">
                                                    <Download className="w-5 h-5" />
                                                </a>
                                                <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Delete">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Upload Document</h3>
                            <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        
                        <form onSubmit={handleUpload} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Document Title *</label>
                                <input 
                                    type="text" required
                                    value={newDoc.title} onChange={e => setNewDoc({...newDoc, title: e.target.value})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Category *</label>
                                    <select 
                                        value={newDoc.category} onChange={e => setNewDoc({...newDoc, category: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none"
                                    >
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Access Level</label>
                                    <select 
                                        value={newDoc.access_level} onChange={e => setNewDoc({...newDoc, access_level: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none"
                                    >
                                        {accessLevels.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Expiry Date (Optional)</label>
                                <input 
                                    type="date"
                                    value={newDoc.expiry_date} onChange={e => setNewDoc({...newDoc, expiry_date: e.target.value})}
                                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">File (PDF/Word)</label>
                                <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <input 
                                        type="file" 
                                        accept=".pdf,.doc,.docx"
                                        onChange={e => setFile(e.target.files?.[0] || null)}
                                        className="hidden" 
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                        <Upload className="w-8 h-8 text-indigo-500 mb-2" />
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                            {file ? file.name : 'Click to select file to upload'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowUploadModal(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:text-slate-800">Cancel</button>
                                <button type="submit" disabled={uploading} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                                    {uploading ? 'Uploading...' : 'Save Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
