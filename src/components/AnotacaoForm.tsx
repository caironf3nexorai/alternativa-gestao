import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface AnotacaoFormProps {
    agendaId: string;
    anotacaoEdicao?: {
        id: string;
        titulo: string;
        descricao: string | null;
        data_vencimento: string | null;
        status: 'pendente' | 'concluido';
    } | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function AnotacaoForm({ agendaId, anotacaoEdicao, onClose, onSuccess }: AnotacaoFormProps) {
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [dataVencimento, setDataVencimento] = useState('');
    const [status, setStatus] = useState<'pendente' | 'concluido'>('pendente');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (anotacaoEdicao) {
            setTitulo(anotacaoEdicao.titulo);
            setDescricao(anotacaoEdicao.descricao || '');
            setDataVencimento(anotacaoEdicao.data_vencimento || '');
            setStatus(anotacaoEdicao.status);
        }
    }, [anotacaoEdicao]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!titulo.trim()) {
            toast.error('O título é obrigatório');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                agenda_id: agendaId,
                titulo: titulo.trim(),
                descricao: descricao.trim() || null,
                data_vencimento: dataVencimento || null,
                status
            };

            if (anotacaoEdicao) {
                const { error } = await supabase
                    .from('agendas_anotacoes')
                    .update(payload)
                    .eq('id', anotacaoEdicao.id);

                if (error) throw error;
                toast.success('Anotação atualizada!');
            } else {
                const { error } = await supabase
                    .from('agendas_anotacoes')
                    .insert([payload]);

                if (error) throw error;
                toast.success('Anotação criada!');
            }

            onSuccess();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Erro ao salvar anotação');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2>{anotacaoEdicao ? 'Editar Anotação' : 'Nova Anotação'}</h2>
                    <button className="btn-close" onClick={onClose} disabled={loading}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="form-container">
                    <div className="form-grid">
                        <div className="form-group span-2">
                            <label>Título *</label>
                            <input
                                type="text"
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                                placeholder="Ex: Ligar para fornecedor"
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        <div className="form-group span-2">
                            <label>Descrição</label>
                            <textarea
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Detalhes adicionais..."
                                disabled={loading}
                                rows={4}
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div className="form-group">
                            <label>Data de Vencimento</label>
                            <input
                                type="date"
                                value={dataVencimento}
                                onChange={(e) => setDataVencimento(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as 'pendente' | 'concluido')}
                                disabled={loading}
                            >
                                <option value="pendente">Pendente</option>
                                <option value="concluido">Concluído</option>
                            </select>
                        </div>
                    </div> {/* Fecha form-grid */}

                    <div className="modal-actions" style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            Salvar Anotação
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
