import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export function ConfirmModal({
    isOpen,
    title,
    description,
    confirmText = 'Sim, Excluir',
    cancelText = 'Cancelar',
    onConfirm,
    onCancel,
    isLoading = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-content" style={{ maxWidth: '400px', padding: '24px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertTriangle size={24} color="var(--error)" />
                    </div>
                </div>
                <h3 style={{ marginTop: 0, marginBottom: '8px' }}>{title}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                    {description}
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button className="btn-secondary" onClick={onCancel} disabled={isLoading}>
                        {cancelText}
                    </button>
                    <button className="btn-primary" style={{ backgroundColor: 'var(--error)' }} onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? 'Processando...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
