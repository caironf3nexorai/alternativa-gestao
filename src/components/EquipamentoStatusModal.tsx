import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from './ConfirmModal';

interface EquipamentoStatusModalProps {
    equipamentoId: string;
    equipamentoNome: string;
    statusAtual: string;
    onClose: () => void;
    onSuccess: () => void;
}

export function EquipamentoStatusModal({
    equipamentoId,
    equipamentoNome,
    statusAtual,
    onClose,
    onSuccess
}: EquipamentoStatusModalProps) {
    const [status, setStatus] = useState(statusAtual);
    const [loading, setLoading] = useState(false);
    const [confirmBaixadoOpen, setConfirmBaixadoOpen] = useState(false);

    const checkAndSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (status === 'baixado' && statusAtual !== 'baixado') {
            setConfirmBaixadoOpen(true);
            return;
        }

        executeStatusUpdate();
    };

    const executeStatusUpdate = async () => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('equipamentos')
                .update({ status })
                .eq('id', equipamentoId);

            if (error) throw error;

            toast.success('Status atualizado com sucesso!');
            setConfirmBaixadoOpen(false);
            onSuccess();
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao atualizar status.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2>Alterar Status</h2>
                    <button className="btn-close" onClick={onClose} disabled={loading}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={checkAndSubmit} className="form-container">
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                        Equipamento: <strong style={{ color: 'var(--text-main)' }}>{equipamentoNome}</strong>
                    </p>

                    <div className="form-group">
                        <label>Novo Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            disabled={loading}
                            style={{
                                backgroundColor: 'var(--bg-surface)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                borderRadius: '6px',
                                padding: '10px 12px',
                                fontSize: '14px',
                                outline: 'none',
                                width: '100%'
                            }}
                        >
                            <option value="disponivel">Disponível</option>
                            <option value="alugado">Alugado</option>
                            <option value="manutencao">Manutenção</option>
                            <option value="baixado">Baixado</option>
                        </select>
                    </div>

                    {status === 'baixado' && statusAtual !== 'baixado' && (
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            backgroundColor: 'rgba(231, 76, 60, 0.1)',
                            padding: '12px',
                            borderRadius: '6px',
                            marginTop: '16px',
                            alignItems: 'flex-start'
                        }}>
                            <AlertTriangle size={18} color="var(--error)" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ fontSize: '13px', color: 'var(--error)' }}>
                                Ao baixar, este item será considerado fora de uso ou descartado.
                            </span>
                        </div>
                    )}

                    <div className="modal-footer" style={{ marginTop: '24px' }}>
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Salvando...' : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>

            <ConfirmModal
                isOpen={confirmBaixadoOpen}
                title="Baixar Equipamento?"
                description={<>Tem certeza que deseja baixar o equipamento <strong>{equipamentoNome}</strong>? Ele sairá do patrimônio ativo.</>}
                onConfirm={executeStatusUpdate}
                onCancel={() => setConfirmBaixadoOpen(false)}
                isLoading={loading}
            />
        </div>
    );
}
