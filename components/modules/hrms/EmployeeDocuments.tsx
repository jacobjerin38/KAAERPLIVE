import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Upload, File, Trash2, Eye, Check, X, Loader2, Download, FileText, Image, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface Document {
    id: string;
    document_type: string;
    document_name: string;
    file_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    issue_date: string | null;
    expiry_date: string | null;
    verified: boolean;
    created_at: string;
}

interface EmployeeDocumentsProps {
    employeeId: string;
    companyId: string;
    readOnly?: boolean;
}

const DOCUMENT_TYPES = [
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'QID', label: 'QID (Qatar ID)' },
    { value: 'VISA', label: 'Visa' },
    { value: 'HAMAD_CARD', label: 'Hamad Health Card' },
    { value: 'DRIVING_LICENSE', label: 'Driving License' },
    { value: 'ID_PROOF', label: 'ID Proof (Aadhaar, PAN, etc.)' },
    { value: 'ADDRESS_PROOF', label: 'Address Proof' },
    { value: 'EDUCATION', label: 'Education Certificate' },
    { value: 'EXPERIENCE', label: 'Experience Letter' },
    { value: 'OFFER_LETTER', label: 'Offer Letter' },
    { value: 'CONTRACT', label: 'Employment Contract' },
    { value: 'MEDICAL', label: 'Medical Report / Fitness' },
    { value: 'INSURANCE', label: 'Insurance Document' },
    { value: 'AIR_TICKET', label: 'Air Ticket' },
    { value: 'SALARY_CERT', label: 'Salary Certificate' },
    { value: 'NOC', label: 'No Objection Certificate (NOC)' },
    { value: 'PHOTO', label: 'Photo / Image' },
    { value: 'PDF', label: 'PDF Document' },
    { value: 'WORD', label: 'Word Document' },
    { value: 'EXCEL', label: 'Excel / Spreadsheet' },
    { value: 'OTHER', label: 'Other' }
];

const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
    if (mimeType?.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
};

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const EmployeeDocuments: React.FC<EmployeeDocumentsProps> = ({ employeeId, companyId, readOnly = false }) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Upload form state
    const [uploadForm, setUploadForm] = useState({
        document_type: 'PASSPORT',
        document_name: '',
        issue_date: '',
        expiry_date: '',
        notes: ''
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    useEffect(() => {
        if (employeeId) {
            fetchDocuments();
        }
    }, [employeeId]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            // @ts-ignore
            const { data, error } = await (supabase as any)
                .from('employee_documents')
                .select('*')
                .eq('employee_id', employeeId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments((data as any[]) || []);
        } catch (err: any) {
            console.error('Error fetching documents:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                setError('File size must be less than 10MB');
                return;
            }
            setSelectedFile(file);
            if (!uploadForm.document_name) {
                setUploadForm(prev => ({ ...prev, document_name: file.name.split('.')[0] }));
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !uploadForm.document_name) {
            setError('Please select a file and enter a document name');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            // Generate unique file path
            const fileExt = selectedFile.name.split('.').pop();
            const filePath = `${companyId}/${employeeId}/${Date.now()}_${uploadForm.document_type}.${fileExt}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('employee-documents')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            // Create document record
            const { error: insertError } = await (supabase as any)
                .from('employee_documents')
                .insert([{
                    company_id: companyId,
                    employee_id: employeeId,
                    document_type: uploadForm.document_type,
                    document_name: uploadForm.document_name,
                    file_name: selectedFile.name,
                    file_path: filePath,
                    file_size: selectedFile.size,
                    mime_type: selectedFile.type,
                    issue_date: uploadForm.issue_date || null,
                    expiry_date: uploadForm.expiry_date || null,
                    notes: uploadForm.notes || null,
                    is_active: true
                }]);

            if (insertError) throw insertError;

            // Reset and refresh
            setShowUploadModal(false);
            setSelectedFile(null);
            setUploadForm({
                document_type: 'PASSPORT',
                document_name: '',
                issue_date: '',
                expiry_date: '',
                notes: ''
            });
            fetchDocuments();
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (doc: Document) => {
        if (!confirm(`Delete document "${doc.document_name}"?`)) return;

        try {
            // Soft delete the record
            const { error } = await (supabase as any)
                .from('employee_documents')
                .update({ is_active: false })
                .eq('id', doc.id);

            if (error) throw error;
            fetchDocuments();
        } catch (err: any) {
            console.error('Delete error:', err);
            setError(err.message);
        }
    };

    const handleView = async (doc: Document) => {
        try {
            const { data, error } = await supabase.storage
                .from('employee-documents')
                .createSignedUrl(doc.file_path, 60); // 60 second expiry

            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (err: any) {
            console.error('View error:', err);
            setError(err.message);
        }
    };

    const handleDownload = async (doc: Document) => {
        try {
            const { data, error } = await supabase.storage
                .from('employee-documents')
                .download(doc.file_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.file_name;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error('Download error:', err);
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-slate-500 dark:text-slate-400">Loading documents...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Documents</h3>
                {!readOnly && (
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        Upload Document
                    </button>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Documents List */}
            {documents.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border-2 border-dashed border-slate-200 dark:border-zinc-700">
                    <File className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
                    <p className="text-slate-500 dark:text-slate-400">No documents uploaded yet</p>
                    {!readOnly && (
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Upload your first document
                        </button>
                    )}
                </div>
            ) : (
                    <div className="grid gap-3">
                    {documents.map(doc => (
                        <div
                            key={doc.id}
                            className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                        >
                            {/* File Icon */}
                            <div className="flex-shrink-0 w-10 h-10 bg-slate-100 dark:bg-zinc-700 rounded-lg flex items-center justify-center">
                                {getFileIcon(doc.mime_type)}
                            </div>

                            {/* Document Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-slate-900 dark:text-white truncate">{doc.document_name}</h4>
                                    {doc.verified && (
                                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                            <Check className="w-3 h-3" /> Verified
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                                    <span>{DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type}</span>
                                    <span>•</span>
                                    <span>{formatFileSize(doc.file_size)}</span>
                                    {doc.expiry_date && (
                                        <>
                                            <span>•</span>
                                            <span className={new Date(doc.expiry_date) < new Date() ? 'text-red-500 dark:text-red-400' : ''}>
                                                Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleView(doc)}
                                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                    title="View"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDownload(doc)}
                                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                    title="Download"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                {!readOnly && (
                                    <button
                                        onClick={() => handleDelete(doc)}
                                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6 m-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Document</h3>
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded text-gray-500 dark:text-gray-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* File Drop Zone */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                />
                                {selectedFile ? (
                                    <div className="flex items-center justify-center gap-2">
                                        {getFileIcon(selectedFile.type)}
                                        <span className="font-medium">{selectedFile.name}</span>
                                        <span className="text-gray-500">({formatFileSize(selectedFile.size)})</span>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                        <p className="text-gray-600">Click to select a file</p>
                                        <p className="text-xs text-gray-400 mt-1">PDF, Images, Word, Excel (Max 10MB)</p>
                                    </>
                                )}
                            </div>

                            {/* Document Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document Type</label>
                                <select
                                    value={uploadForm.document_type}
                                    onChange={e => setUploadForm(prev => ({ ...prev, document_type: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {DOCUMENT_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Document Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document Name *</label>
                                <input
                                    type="text"
                                    value={uploadForm.document_name}
                                    onChange={e => setUploadForm(prev => ({ ...prev, document_name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., Passport, QID"
                                />
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issue Date</label>
                                    <input
                                        type="date"
                                        value={uploadForm.issue_date}
                                        onChange={e => setUploadForm(prev => ({ ...prev, issue_date: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                                    <input
                                        type="date"
                                        value={uploadForm.expiry_date}
                                        onChange={e => setUploadForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading || !selectedFile || !uploadForm.document_name}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Upload
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeDocuments;
