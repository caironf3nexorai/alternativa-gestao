import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface AnotacaoItem {
    id?: string;
    texto: string;
    concluido: boolean;
    ordem: number;
}

interface AnotacaoFormProps {
    agendaId: string;
    anotacaoEdicao?: {
        id: string;
        titulo: string;
        descricao: string | null;
        data_vencimento: string | null;
        status: 'pendente' | 'concluido';
        tipo?: 'descricao' | 'lista';
    } | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function AnotacaoForm({ agendaId, anotacaoEdicao, onClose, onSuccess }: AnotacaoFormProps) {
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [dataVencimento, setDataVencimento] = useState('');
    const [status, setStatus] = useState<'pendente' | 'concluido'>('pendente');
    const [tipo, setTipo] = useState<'descricao' | 'lista'>('descricao');
    
    // Checklist state
    const [itens, setItens] = useState<AnotacaoItem[]>([]);
    const [novoItemTexto, setNovoItemTexto] = useState('');

    const [loading, setLoading] = useState(false);
    const [loadingItens, setLoadingItens] = useState(false);

    useEffect(() => {
        if (anotacaoEdicao) {
            setTitulo(anotacaoEdicao.titulo);
            setDescricao(anotacaoEdicao.descricao || '');
            setDataVencimento(anotacaoEdicao.data_vencimento || '');
            setStatus(anotacaoEdicao.status);
            setTipo(anotacaoEdicao.tipo || 'descricao');

            if (anotacaoEdicao.tipo === 'lista') {
                carregarItens(anotacaoEdicao.id);
            }
        }
    }, [anotacaoEdicao]);

    const carregarItens = async (anotacaoId: string) => {
        try {
            setLoadingItens(true);
            const { data, error } = await supabase
                .from('agendas_anotacoes_itens')
                .select('*')
                .eq('anotacao_id', anotacaoId)
                .order('ordem', { ascending: true });

            if (error) throw error;
            setItens(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar itens da lista');
        } finally {
            setLoadingItens(false);
        }
    };

    const handleAdicionarItem = () => {
        if (!novoItemTexto.trim()) return;
        if (itens.length >= 30) {
            toast.error('Limite de 30 itens atingido');
            return;
        }

        const newItem: AnotacaoItem = {
            texto: novoItemTexto.trim(),
            concluido: false,
            ordem: itens.length
        };

        setItens([...itens, newItem]);
        setNovoItemTexto('');
    };

    const handleRemoverItem = (index: number) => {
        const newItens = [...itens];
        newItens.splice(index, 1);
        // Reordenar
        newItens.forEach((item, i) => item.ordem = i);
        setItens(newItens);
    };

    const handleMoverCima = (index: number) => {
        if (index === 0) return;
        const newItens = [...itens];
        const temp = newItens[index];
        newItens[index] = newItens[index - 1];
        newItens[index - 1] = temp;
        // Reordenar
        newItens.forEach((item, i) => item.ordem = i);
        setItens(newItens);
    };

    const handleMoverBaixo = (index: number) => {
        if (index === itens.length - 1) return;
        const newItens = [...itens];
        const temp = newItens[index];
        newItens[index] = newItens[index + 1];
        newItens[index + 1] = temp;
        // Reordenar
        newItens.forEach((item, i) => item.ordem = i);
        setItens(newItens);
    };

    const handleEditarTextoItem = (index: number, novoTexto: string) => {
        const newItens = [...itens];
        newItens[index].texto = novoTexto;
        setItens(newItens);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!titulo.trim()) {
            toast.error('O título é obrigatório');
            return;
        }

        try {
            setLoading(true);

            // Determine checkly status auto-completion safely
            let finalStatus = status;
            if (tipo === 'lista' && itens.length > 0) {
                const todosConcluidos = itens.every(i => i.concluido);
                finalStatus = todosConcluidos ? 'concluido' : 'pendente';
            }

            const payload = {
                agenda_id: agendaId,
                titulo: titulo.trim(),
                descricao: tipo === 'descricao' ? (descricao.trim() || null) : null,
                data_vencimento: dataVencimento || null,
                status: finalStatus,
                tipo
            };

            let anotacaoId = anotacaoEdicao?.id;

            if (anotacaoEdicao) {
                const { error } = await supabase
                    .from('agendas_anotacoes')
                    .update(payload)
                    .eq('id', anotacaoEdicao.id);

                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('agendas_anotacoes')
                    .insert([payload])
                    .select('id')
                    .single();

                if (error) throw error;
                anotacaoId = data.id;
            }

            if (tipo === 'lista' && anotacaoId) {
                // Delete all existing items first to recreate (simplest sync strategy)
                if (anotacaoEdicao) {
                    await supabase.from('agendas_anotacoes_itens').delete().eq('anotacao_id', anotacaoId);
                }

                if (itens.length > 0) {
                    const itensPayload = itens.map(item => ({
                        anotacao_id: anotacaoId,
                        texto: item.texto,
                        concluido: item.concluido,
                        ordem: item.ordem
                    }));

                    const { error: errorItens } = await supabase
                        .from('agendas_anotacoes_itens')
                        .insert(itensPayload);

                    if (errorItens) throw errorItens;
                }
            } else if (tipo === 'descricao' && anotacaoEdicao?.tipo === 'lista') {
                // Changed from lista to descricao, clean up items
                await supabase.from('agendas_anotacoes_itens').delete().eq('anotacao_id', anotacaoId);
            }

            toast.success(anotacaoEdicao ? 'Anotação atualizada!' : 'Anotação criada!');
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
            <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
                <div className="modal-header">
                    <h2>{anotacaoEdicao ? 'Editar Anotação' : 'Nova Anotação'}</h2>
                    <button className="btn-close" onClick={onClose} disabled={loading}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                    <button 
                        className={`btn-secondary ${tipo === 'descricao' ? 'active' : ''}`} 
                        onClick={() => setTipo('descricao')}
                        style={{ flex: 1, backgroundColor: tipo === 'descricao' ? 'var(--bg-secondary)' : 'transparent', border: tipo === 'descricao' ? '1px solid var(--border-color)' : '1px dashed var(--border-color)' }}
                        type="button"
                    >
                        📝 Descrição
                    </button>
                    <button 
                        className={`btn-secondary ${tipo === 'lista' ? 'active' : ''}`} 
                        onClick={() => setTipo('lista')}
                        style={{ flex: 1, backgroundColor: tipo === 'lista' ? 'var(--bg-secondary)' : 'transparent', border: tipo === 'lista' ? '1px solid var(--border-color)' : '1px dashed var(--border-color)' }}
                        type="button"
                    >
                        ✅ Lista de Itens
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
                                placeholder="Tema da anotação..."
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        {tipo === 'descricao' && (
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
                        )}

                        {tipo === 'lista' && (
                            <div className="form-group span-2">
                                <label>Itens do Checklist</label>
                                
                                {loadingItens ? (
                                    <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando itens...</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                        {itens.map((item, index) => (
                                            <div key={item.id || index} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={item.concluido}
                                                    onChange={(e) => {
                                                        const newItens = [...itens];
                                                        newItens[index].concluido = e.target.checked;
                                                        setItens(newItens);
                                                    }}
                                                    style={{ accentColor: 'var(--primary-red)' }}
                                                    title="Pode ser marcado depois no card"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.texto}
                                                    onChange={(e) => handleEditarTextoItem(index, e.target.value)}
                                                    style={{ flex: 1, border: 'none', backgroundColor: 'transparent', padding: 0, margin: 0 }}
                                                    placeholder="Texto do item..."
                                                />
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button type="button" className="btn-icon" onClick={() => handleMoverCima(index)} disabled={index === 0} title="Mover para cima">
                                                        <ChevronUp size={16} />
                                                    </button>
                                                    <button type="button" className="btn-icon" onClick={() => handleMoverBaixo(index)} disabled={index === itens.length - 1} title="Mover para baixo">
                                                        <ChevronDown size={16} />
                                                    </button>
                                                    <button type="button" className="btn-icon text-error" onClick={() => handleRemoverItem(index)} title="Remover item">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {itens.length < 30 ? (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <input
                                                    type="text"
                                                    value={novoItemTexto}
                                                    onChange={(e) => setNovoItemTexto(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarItem(); } }}
                                                    placeholder="Novo item..."
                                                    style={{ flex: 1 }}
                                                />
                                                <button type="button" className="btn-secondary" onClick={handleAdicionarItem} style={{ padding: '8px 12px' }}>
                                                    <Plus size={18} /> Adicionar
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' }}>
                                                Limite de 30 itens atingido.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

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
                                disabled={loading || (tipo === 'lista' && itens.length > 0)}
                                title={tipo === 'lista' ? 'Gerenciado pelos itens do checklist' : ''}
                            >
                                <option value="pendente">Pendente</option>
                                <option value="concluido">Concluído</option>
                            </select>
                        </div>
                    </div>

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
