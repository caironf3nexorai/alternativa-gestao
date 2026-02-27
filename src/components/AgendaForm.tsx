import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface AgendaFormProps {
    agendaEdicao?: { id: string, nome: string, cor: string } | null;
    onClose: () => void;
    onSuccess: () => void;
}

const COLORS = [
    { value: '#3498db', label: 'Azul' },
    { value: '#2ecc71', label: 'Verde' },
    { value: '#e74c3c', label: 'Vermelho' },
    { value: '#f39c12', label: 'Laranja' },
    { value: '#9b59b6', label: 'Roxo' },
    { value: '#f1c40f', label: 'Amarelo' },
    { value: '#e84393', label: 'Rosa' },
    { value: '#95a5a6', label: 'Cinza' }
];

export function AgendaForm({ agendaEdicao, onClose, onSuccess }: AgendaFormProps) {
    const [nome, setNome] = useState('');
    const [cor, setCor] = useState(COLORS[0].value);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (agendaEdicao) {
            setNome(agendaEdicao.nome);
            setCor(agendaEdicao.cor);
        }
    }, [agendaEdicao]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!nome.trim()) {
            toast.error('O nome da agenda é obrigatório');
            return;
        }

        try {
            setLoading(true);

            if (agendaEdicao) {
                const { error } = await supabase
                    .from('agendas')
                    .update({ nome: nome.trim(), cor })
                    .eq('id', agendaEdicao.id);

                if (error) throw error;
                toast.success('Agenda atualizada com sucesso!');
            } else {
                const { error } = await supabase
                    .from('agendas')
                    .insert([{ nome: nome.trim(), cor }]);

                if (error) throw error;
                toast.success('Agenda criada com sucesso!');
            }

            onSuccess();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Erro ao salvar agenda');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2>{agendaEdicao ? 'Editar Agenda' : 'Nova Agenda'}</h2>
                    <button className="btn-close" onClick={onClose} disabled={loading}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group">
                        <label>Nome da Agenda *</label>
                        <input
                            type="text"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Ex: Reuniões de Diretoria"
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Cor de Identificação</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {COLORS.map(c => (
                                <div
                                    key={c.value}
                                    onClick={() => setCor(c.value)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        backgroundColor: c.value,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: cor === c.value ? '2px solid white' : '2px solid transparent',
                                        boxShadow: cor === c.value ? `0 0 0 2px ${c.value}` : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                    title={c.label}
                                >
                                    {cor === c.value && <Check size={16} color="white" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar Agenda'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
