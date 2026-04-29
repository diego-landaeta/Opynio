import React, { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import Modal from '../components/Modal';

interface ConfirmOptions {
    title: string;
    message?: ReactNode;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
}

interface ConfirmContextType {
    confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [opts, setOpts] = useState<ConfirmOptions | null>(null);
    const resolverRef = useRef<((v: boolean) => void) | null>(null);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
            setOpts(options);
        });
    }, []);

    const close = (result: boolean) => {
        if (resolverRef.current) {
            resolverRef.current(result);
            resolverRef.current = null;
        }
        setOpts(null);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {opts && (
                <Modal title={opts.title} onClose={() => close(false)}>
                    <div className="space-y-4 mt-4">
                        {opts.message && (
                            <div className="text-gray-700 dark:text-gray-300">
                                {opts.message}
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => close(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
                            >
                                {opts.cancelText ?? 'Cancelar'}
                            </button>
                            <button
                                type="button"
                                onClick={() => close(true)}
                                className={
                                    opts.danger
                                        ? 'px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors'
                                        : 'px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-opacity-90 transition-colors'
                                }
                            >
                                {opts.confirmText ?? 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = (): ConfirmContextType => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
    return ctx;
};
