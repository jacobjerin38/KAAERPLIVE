import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface GlobalLoadingContextType {
    isGlobalLoading: boolean;
    showLoader: () => void;
    hideLoader: () => void;
    initialDataLoaded: boolean;
    setInitialDataLoaded: (val: boolean) => void;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextType | undefined>(undefined);

export const GlobalLoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isGlobalLoading, setIsGlobalLoading] = useState(false);
    const [initialDataLoaded, setInitialDataLoaded] = useState(true);

    const showLoader = () => setIsGlobalLoading(true);
    const hideLoader = () => setIsGlobalLoading(false);

    return (
        <GlobalLoadingContext.Provider value={{ isGlobalLoading, showLoader, hideLoader, initialDataLoaded, setInitialDataLoaded }}>
            {children}
        </GlobalLoadingContext.Provider>
    );
};

export const useGlobalLoading = () => {
    const context = useContext(GlobalLoadingContext);
    if (context === undefined) {
        throw new Error('useGlobalLoading must be used within a GlobalLoadingProvider');
    }
    return context;
};

/**
 * Custom hook to delay the visibility of a loading state to prevent flashing.
 * If the loading takes less than `delay` ms, the hook returns false.
 */
export function useDelayLoading(loading: boolean, delay: number = 300): boolean {
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        let timer: any;
        if (loading) {
            timer = setTimeout(() => {
                setShouldShow(true);
            }, delay);
        } else {
            setShouldShow(false);
        }
        return () => clearTimeout(timer);
    }, [loading, delay]);

    return shouldShow;
}
