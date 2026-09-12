import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableOption {
    value: string;
    label: string;
    code?: string;
    type?: string;
    sublabel?: string;
}

interface SearchableSelectProps {
    options: SearchableOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
    buttonClassName?: string;
    dropdownClassName?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Search & select...',
    disabled = false,
    required = false,
    className = '',
    buttonClassName = '',
    dropdownClassName = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [openUpward, setOpenUpward] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Selected option object
    const selectedOption = useMemo(() => {
        return options.find(o => String(o.value) === String(value));
    }, [options, value]);

    // Filter and score options based on query
    const filteredOptions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;

        return options
            .map(opt => {
                const codeStr = (opt.code || '').toLowerCase();
                const labelStr = (opt.label || '').toLowerCase();
                const typeStr = (opt.type || '').toLowerCase();
                const subStr = (opt.sublabel || '').toLowerCase();

                let score = 0;
                // Exact code match
                if (codeStr === q) score += 120;
                // Code starts with query (e.g. typing "55" matches "5510")
                else if (codeStr.startsWith(q)) score += 100;
                // Code contains query
                else if (codeStr.includes(q)) score += 60;

                // Exact label match
                if (labelStr === q) score += 90;
                // Label starts with query (e.g. typing "rent" matches "Rent Expense")
                else if (labelStr.startsWith(q)) score += 80;
                // Label word starts with query
                else if (labelStr.includes(' ' + q)) score += 60;
                // Label contains query
                else if (labelStr.includes(q)) score += 40;

                // Type matches
                if (typeStr.startsWith(q)) score += 30;
                else if (typeStr.includes(q)) score += 15;

                // Sublabel matches
                if (subStr.includes(q)) score += 10;

                return { opt, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.opt);
    }, [options, query]);

    const openDropdown = useCallback((initialQuery = '') => {
        if (disabled) return;
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setOpenUpward(spaceBelow < 280 && rect.top > 280);
        }
        setQuery(initialQuery);
        setIsOpen(true);
    }, [disabled]);

    const closeDropdown = useCallback(() => {
        setIsOpen(false);
        setQuery('');
    }, []);

    // Set highlighted index when opened or query changes
    useEffect(() => {
        if (!isOpen) return;
        if (!query) {
            const currentIdx = filteredOptions.findIndex(o => String(o.value) === String(value));
            setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
        } else {
            setHighlightedIndex(0);
        }
    }, [isOpen, query, filteredOptions, value]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    const len = inputRef.current.value.length;
                    inputRef.current.setSelectionRange(len, len);
                }
            }, 30);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                closeDropdown();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, closeDropdown]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (isOpen && listRef.current) {
            const activeElem = listRef.current.children[highlightedIndex] as HTMLElement;
            if (activeElem && typeof activeElem.scrollIntoView === 'function') {
                activeElem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex, isOpen]);

    const handleSelect = (optValue: string) => {
        onChange(optValue);
        closeDropdown();
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDropdown('');
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                openDropdown(e.key);
            }
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredOptions[highlightedIndex]) {
                handleSelect(filteredOptions[highlightedIndex].value);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeDropdown();
        } else if (e.key === 'Tab') {
            if (filteredOptions[highlightedIndex] && query.trim()) {
                handleSelect(filteredOptions[highlightedIndex].value);
            } else {
                closeDropdown();
            }
        }
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Hidden native input for required form validation */}
            {required && (
                <input
                    type="text"
                    tabIndex={-1}
                    value={value || ''}
                    required={required}
                    onChange={() => {}}
                    className="absolute opacity-0 pointer-events-none -bottom-1 left-4 w-1 h-1"
                />
            )}

            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && (isOpen ? closeDropdown() : openDropdown(''))}
                onKeyDown={handleTriggerKeyDown}
                disabled={disabled}
                className={`w-full p-2 bg-slate-50 dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-bold text-left flex items-center justify-between gap-2 transition-all outline-none focus:ring-2 focus:ring-purple-500/30 ${
                    disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer'
                } ${isOpen ? 'ring-2 ring-purple-500/30 border-purple-400 dark:border-purple-500' : ''} ${buttonClassName}`}
            >
                <div className="truncate flex-1">
                    {selectedOption ? (
                        <div className="flex items-center gap-1.5 truncate">
                            {selectedOption.code && (
                                <span className="px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded text-[10px] font-mono font-black shrink-0">
                                    {selectedOption.code}
                                </span>
                            )}
                            <span className="truncate text-slate-800 dark:text-white">
                                {selectedOption.label}
                            </span>
                            {selectedOption.type && (
                                <span className="text-[10px] text-slate-400 font-normal shrink-0">
                                    ({selectedOption.type})
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-slate-400 font-normal">{placeholder}</span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {!disabled && selectedOption && (
                        <span
                            role="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                            className="p-0.5 text-slate-400 hover:text-rose-500 rounded transition-colors"
                            title="Clear"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-purple-600' : ''}`} />
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className={`absolute z-[999] left-0 min-w-full sm:min-w-[340px] max-w-[520px] ${
                    openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                } bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${dropdownClassName}`}>
                    {/* Search Input Box */}
                    <div className="p-2 border-b border-slate-100 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/90">
                        <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Type to search code or name..."
                                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options List */}
                    <div
                        ref={listRef}
                        className="max-h-56 overflow-y-auto divide-y divide-slate-50 dark:divide-zinc-700/40"
                    >
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-slate-400 font-medium">
                                No matching results found for "{query}"
                            </div>
                        ) : (
                            filteredOptions.map((opt, i) => {
                                const isSelected = String(opt.value) === String(value);
                                const isHighlighted = i === highlightedIndex;

                                return (
                                    <div
                                        key={opt.value}
                                        onClick={() => handleSelect(opt.value)}
                                        onMouseEnter={() => setHighlightedIndex(i)}
                                        className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                                            isHighlighted
                                                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200'
                                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-700/40'
                                        } ${isSelected ? 'font-bold bg-purple-100/50 dark:bg-purple-950/60' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {opt.code && (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                                                    isSelected
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-slate-300'
                                                }`}>
                                                    {opt.code}
                                                </span>
                                            )}
                                            <span className="truncate">{opt.label}</span>
                                            {opt.type && (
                                                <span className="text-[10px] text-slate-400 font-normal shrink-0">
                                                    ({opt.type})
                                                </span>
                                            )}
                                        </div>

                                        {isSelected && (
                                            <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
