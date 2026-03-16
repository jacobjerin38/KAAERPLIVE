import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, Upload, X, FileText, Image, File, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { CRMAttachment } from './types';
import { getAttachments, uploadAttachment, deleteAttachment } from './services';

interface AttachmentPanelProps {
    companyId: string;
    module: string;
    recordId: string;
    userId?: string;
}

const getFileIcon = (type?: string) => {
    if (!type) return File;
    if (type.startsWith('image/')) return Image;
    return FileText;
};

const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
};

export const AttachmentPanel: React.FC<AttachmentPanelProps> = ({ companyId, module, recordId, userId }) => {
    const [attachments, setAttachments] = useState<CRMAttachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (recordId) loadAttachments();
    }, [recordId]);

    const loadAttachments = async () => {
        const data = await getAttachments(module, recordId);
        setAttachments(data);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const result = await uploadAttachment(companyId, module, recordId, file, userId);
        if (result) setAttachments(prev => [result, ...prev]);
        else alert('Failed to upload file');
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleDelete = async (att: CRMAttachment) => {
        if (!confirm('Delete this attachment?')) return;
        const ok = await deleteAttachment(att.id, att.file_url);
        if (ok) setAttachments(prev => prev.filter(a => a.id !== att.id));
    };

    return (
        <div className="mt-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Paperclip size={13} /> Attachments ({attachments.length})
                </h4>
                <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg cursor-pointer transition-colors">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
            </div>
            {attachments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No attachments yet</p>
            ) : (
                <div className="space-y-2 max-h-40 overflow-auto">
                    {attachments.map(att => {
                        const Icon = getFileIcon(att.file_type);
                        return (
                            <div key={att.id} className="flex items-center gap-2.5 p-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg text-xs group">
                                <Icon size={14} className="text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-700 dark:text-zinc-300 truncate">{att.file_name}</p>
                                    <p className="text-slate-400 text-[10px]">{formatSize(att.file_size)}</p>
                                </div>
                                <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded transition-colors">
                                    <ExternalLink size={12} className="text-slate-400" />
                                </a>
                                <button onClick={() => handleDelete(att)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 size={12} className="text-red-400" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
