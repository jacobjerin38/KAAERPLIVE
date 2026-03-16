import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
    noPadding?: boolean;
    hideHeader?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ title, onClose, children, maxWidth = "max-w-lg", noPadding = false, hideHeader = false }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-fade-in">
        <div className={`bg-white dark:bg-zinc-900 w-full ${maxWidth} rounded-3xl shadow-2xl relative animate-slide-up border border-slate-100 dark:border-zinc-800 flex flex-col max-h-[90vh] ${noPadding ? 'p-0 overflow-hidden' : 'p-8'}`}>
            {!hideHeader && (
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
                    <button onClick={onClose}><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                </div>
            )}
            <div className={`${noPadding ? 'h-full flex flex-col' : 'overflow-y-auto pr-2 custom-scrollbar'}`}>
                {children}
            </div>
        </div>
    </div>
);
