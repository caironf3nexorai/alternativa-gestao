import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ModalEncerrarProps {
    contratoId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export function ModalEncerrarContrato({ contratoId, onClose, onSuccess }: ModalEncerrarProps) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    const [dataEncerramentoReal, setDataEncerramentoReal] = useState(new Date().toISOString().split('T')[0]);
    const [equipamentos, setEquipamentos] = useState<any[]>([]);

    useEffect(() => {
        const fetchEquipamentos = async () => {
            try {
                const { data, error } = await supabase
                    .from('contrato_equipamentos')
                    .select('*, equipamento:equipamentos(nome, codigo_patrimonio, status)')
                    .eq('contrato_id', contratoId);
                
                if (error) throw error;
                // Add a local state selection field 'novoStatus' for each equipment
                const mapped = (data || []).map(e => ({
                    ...e,
                    novoStatus: 'disponivel' // default
                }));
                setEquipamentos(mapped);
            } catch {
                toast.error('Erro ao carregar equipamentos vinculados');
                onClose();
            } finally {
                setLoading(false);
            }
        };
        fetchEquipamentos();
    }, [contratoId]);

    const handleStatusChange = (index: number, newStatus: string) => {
        const newEqs = [...equipamentos];
        newEqs[index].novoStatus = newStatus;
        setEquipamentos(newEqs);
    };

    const handleConfirm = async () => {
        try {
            setSubmitting(true);
            
            // 1. Marcar Contrato como 'encerrado' e setar data_encerramento_real
            const { error: cErr } = await supabase
                .from('contratos')
                .update({ 
                    status: 'encerrado',
                    data_encerramento_real: dataEncerramentoReal
                })
                .eq('id', contratoId);
            if (cErr) throw cErr;

            // 2. Para cada equipamento, update a tabela contrato_equipamentos -> data_retorno_real
            // E atualiza a tabela equipamentos -> mudar pro status selecionado (novoStatus)
            for (const eq of equipamentos) {
                await supabase
                    .from('contrato_equipamentos')
                    .update({ data_retorno_real: dataEncerramentoReal })
                    .eq('id', eq.id);

                await supabase
                    .from('equipamentos')
                    .update({ status: eq.novoStatus })
                    .eq('id', eq.equipamento_id);
            }

            toast.success('Contrato encerrado e equipamentos liberados com sucesso!');
            onSuccess();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Erro ao encerrar o contrato.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
            <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-red)' }}>
                        <AlertTriangle size={20} /> Encerrar Contrato
                    </h2>
                    <button className="btn-close" onClick={onClose} disabled={submitting}><X size={20} /></button>
                </div>
                
                <div className="form-container">
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        Confirme a data de encerramento e escolha o destino dos equipamentos vinculados a este contrato.
                    </p>

                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label>Data de Encerramento Real</label>
                        <input 
                            type="date" 
                            value={dataEncerramentoReal} 
                            onChange={e => setDataEncerramentoReal(e.target.value)} 
                            required 
                        />
                    </div>

                    <h3 style={{ fontSize: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                        Destino dos Equipamentos ({equipamentos.length})
                    </h3>

                    {equipamentos.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)' }}>Nenhum equipamento vinculado a este contrato.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {equipamentos.map((eq, i) => (
                                <div key={eq.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{eq.equipamento?.nome}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{eq.equipamento?.codigo_patrimonio}</div>
                                    </div>
                                    <div>
                                        <select 
                                            value={eq.novoStatus} 
                                            onChange={e => handleStatusChange(i, e.target.value)}
                                            style={{ backgroundColor: eq.novoStatus === 'disponivel' ? 'rgba(37,211,102,0.1)' : 'rgba(239,68,68,0.1)', color: eq.novoStatus === 'disponivel' ? '#25D366' : 'var(--primary-red)', borderColor: 'transparent', fontWeight: 600 }}
                                        >
                                            <option value="disponivel">Voltar a Disponível</option>
                                            <option value="manutencao">Enviar p/ Manutenção</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-actions" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
                    <button className="btn-primary" style={{ backgroundColor: 'var(--primary-red)' }} onClick={handleConfirm} disabled={submitting || !dataEncerramentoReal}>
                        {submitting ? 'Encerrando...' : 'Confirmar Encerramento'}
                    </button>
                </div>
            </div>
        </div>
    );
}
