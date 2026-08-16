import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Maximize2, Minimize2, Move, GripHorizontal } from 'lucide-react';

export interface ModalProps {
    title?: string | React.ReactNode;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
    noPadding?: boolean;
    hideHeader?: boolean;
    resizable?: boolean;
    draggable?: boolean;
    className?: string;
    closeOnBackdrop?: boolean;
}

const sizeClasses: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
    '2xl': 'max-w-4xl',
    '3xl': 'max-w-5xl',
    '4xl': 'max-w-6xl',
    '5xl': 'max-w-7xl',
    '6xl': 'max-w-[90vw]',
    full: 'max-w-[98vw] h-[96vh]',
};

export const Modal: React.FC<ModalProps> = ({
    title,
    onClose,
    children,
    maxWidth,
    size = '2xl', // Upgraded default from max-w-lg (32rem) to max-w-4xl (56rem/896px)
    noPadding = false,
    hideHeader = false,
    resizable = true,
    draggable = true,
    className = '',
    closeOnBackdrop = true
}) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const modalRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);

    // Escape key listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Drag handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!draggable || isMaximized) return;
        // Don't trigger drag if clicking buttons or inputs inside header
        if ((e.target as HTMLElement).closest('button, input, select, a')) return;

        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    }, [draggable, isMaximized, position]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const nextX = e.clientX - dragStart.x;
            const nextY = e.clientY - dragStart.y;

            // Keep within viewport boundaries
            const maxDeltaX = window.innerWidth / 2;
            const maxDeltaY = window.innerHeight / 2;

            setPosition({
                x: Math.max(-maxDeltaX, Math.min(maxDeltaX, nextX)),
                y: Math.max(-maxDeltaY, Math.min(maxDeltaY, nextY))
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    // Reset position when maximized or restored
    const toggleMaximize = () => {
        if (!isMaximized) {
            setPosition({ x: 0, y: 0 });
        }
        setIsMaximized(prev => !prev);
    };

    // Determine width class
    const resolvedMaxWidth = isMaximized
        ? 'w-[98vw] h-[96vh] max-w-none max-h-none'
        : (maxWidth || sizeClasses[size] || 'max-w-4xl');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-hidden"
            onClick={(e) => {
                if (closeOnBackdrop && e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                ref={modalRef}
                style={{
                    transform: isMaximized ? 'none' : `translate3d(${position.x}px, ${position.y}px, 0)`,
                    transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
                    minWidth: isMaximized ? undefined : '360px',
                    minHeight: isMaximized ? undefined : '260px'
                }}
                className={`bg-white dark:bg-zinc-900 w-full ${resolvedMaxWidth} rounded-[1.75rem] shadow-2xl relative animate-slide-up border border-slate-200/80 dark:border-zinc-800 flex flex-col ${
                    isMaximized ? 'max-h-[96vh]' : 'max-h-[92vh]'
                } ${resizable && !isMaximized ? 'resize overflow-hidden' : ''} ${className}`}
            >
                {/* Modal Header */}
                {!hideHeader && (
                    <div
                        ref={headerRef}
                        onMouseDown={handleMouseDown}
                        className={`flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 select-none flex-shrink-0 ${
                            draggable && !isMaximized ? 'cursor-grab active:cursor-grabbing hover:bg-slate-50/50 dark:hover:bg-zinc-800/30' : ''
                        }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0 pr-4">
                            {draggable && !isMaximized && (
                                <Move className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                            )}
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                {title}
                            </h2>
                        </div>

                        {/* Window action controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Maximize / Restore Toggle */}
                            <button
                                type="button"
                                onClick={toggleMaximize}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                                title={isMaximized ? "Restore Size" : "Maximize Fullscreen"}
                            >
                                {isMaximized ? (
                                    <Minimize2 className="w-4 h-4" />
                                ) : (
                                    <Maximize2 className="w-4 h-4" />
                                )}
                            </button>

                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                                title="Close (Esc)"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Body */}
                <div className={`flex-1 overflow-y-auto custom-scrollbar ${
                    noPadding ? 'p-0' : 'p-6 sm:p-7'
                }`}>
                    {children}
                </div>

                {/* Resizable Corner Handle */}
                {resizable && !isMaximized && (
                    <div className="absolute bottom-1 right-1 pointer-events-none text-slate-300 dark:text-slate-600">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22 22H20V20H22V22ZM22 16H20V18H22V16ZM16 22H18V20H16V22ZM22 12H20V14H22V12ZM12 22H14V20H12V22ZM18 16H16V18H18V16Z" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
};
