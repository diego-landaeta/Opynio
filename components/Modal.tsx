import React, { ReactNode } from 'react';

interface ModalProps {
    title: string;
    children: ReactNode;
    onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ title, children, onClose }) => {
    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-modal-overlay"
            aria-modal="true"
            role="dialog"
            aria-labelledby="modal-title"
            onClick={onClose} // Close on overlay click
        >
            <div
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-[90vw] sm:max-w-md p-3 sm:p-5 md:p-6 relative animate-modal-content max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    aria-label="Cerrar modal"
                >
                    <i className="fa-solid fa-times text-lg sm:text-xl"></i>
                </button>
                <h2 id="modal-title" className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 text-center pr-6 sm:pr-0">{title}</h2>
                <div>{children}</div>
            </div>
             {/* Opacity-only animation to prevent CLS */}
             <style>{`
                @keyframes modal-overlay-in {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                @keyframes modal-content-in {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .animate-modal-overlay {
                    animation: modal-overlay-in 0.2s ease-out forwards;
                }
                .animate-modal-content {
                    animation: modal-content-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default Modal;