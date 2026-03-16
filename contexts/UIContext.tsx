import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UIContextType {
    isSearchOpen: boolean;
    toggleSearch: (isOpen?: boolean) => void;
    isNotificationsOpen: boolean;
    toggleNotifications: (isOpen?: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

    // Keyboard shortcut for Search (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsSearchOpen(false);
                setIsNotificationsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const toggleSearch = (isOpen?: boolean) => {
        setIsSearchOpen(prev => isOpen ?? !prev);
        if (isOpen) setIsNotificationsOpen(false); // Close other panels
    };

    const toggleNotifications = (isOpen?: boolean) => {
        setIsNotificationsOpen(prev => isOpen ?? !prev);
        if (isOpen) setIsSearchOpen(false);
    };

    return (
        <UIContext.Provider value={{ isSearchOpen, toggleSearch, isNotificationsOpen, toggleNotifications }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
