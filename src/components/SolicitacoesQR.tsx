import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface SolicitacaoQR {
    id: string;
    equipamento_id: string;
    tipo: 'limpeza' | 'insumos' | 'avaria' | 'duvida' | 'status';
    status_solicitado: string;
    identificacao_solicitante: string;
    observacao: string;
    status: 'Pendente' | 'Resolvido';
    created_at: string;
    equipamentos?: {
        nome: string;
        codigo_patrimonio: string;
    }
}

export function SolicitacoesQR() {
    const [solicitacoes, setSolicitacoes] = useState<SolicitacaoQR[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSolicitacoes = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('qr_solicitacoes')
                .select(`
                    *,
                    equipamentos(nome, codigo_patrimonio)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSolicitacoes(data || []);
        } catch (err: any) {
            if (err.code !== '42P01') {
                toast.error('Erro ao buscar as solicitações. A tabela pode não existir ainda.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSolicitacoes();

        // Inscrevendo para realtime updates de novas solicitacoes QR!
        const channel = supabase
            .channel('public:qr_solicitacoes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'qr_solicitacoes' }, (payload) => {
                console.log('Realtime QR:', payload);
                fetchSolicitacoes();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }

    }, []);

    const handleResolver = async (id: string) => {
        try {
            const { error } = await supabase
                .from('qr_solicitacoes')
                .update({ status: 'Resolvido' })
                .eq('id', id);

            if (error) throw error;
            toast.success('Solicitação marcada como Resolvida!');
            // O realtime channel vai auto atualizar a lista mas também atualizamos o local otimisticamente
            setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status: 'Resolvido' } : s));
        } catch {
            toast.error('Falha ao resolver solicitação.');
        }
    };

    const getTipoBadge = (tipo: string) => {
        switch (tipo) {
            case 'limpeza': return <span className="status-badge" style={{ backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db', border: '1px solid #3498db' }}>Limpeza</span>;
            case 'insumos': return <span className="status-badge" style={{ backgroundColor: 'rgba(46, 204, 113, 0.1)', color: 'var(--success)', border: '1px solid var(--success)' }}>Insumos</span>;
            case 'avaria': return <span className="status-badge" style={{ backgroundColor: 'rgba(231, 76, 60, 0.1)', color: 'var(--error)', border: '1px solid var(--error)' }}>Avaria</span>;
            case 'duvida': return <span className="status-badge" style={{ backgroundColor: 'rgba(155, 89, 182, 0.1)', color: '#9b59b6', border: '1px solid #9b59b6' }}>Dúvida</span>;
            case 'status': return <span className="status-badge" style={{ backgroundColor: 'rgba(243, 156, 18, 0.1)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>Status</span>;
            default: return <span className="status-badge">{tipo}</span>;
        }
    };

    if (loading) {
        return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Carregando solicitações em tempo real...</div>;
    }

    if (solicitacoes.length === 0) {
        return (
            <div className="empty-state">
                <p>O painel de solicitações e QRs está tranquilo. Nenhuma demanda externa encontrada!</p>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '16px' }}>
            <div className="table-wrapper desktop-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Data/Hora</th>
                            <th>Equipamento</th>
                            <th>Tipo Solicit.</th>
                            <th>Solicitante</th>
                            <th>Observação</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {solicitacoes.map(sol => (
                            <tr key={sol.id} style={{ opacity: sol.status === 'Resolvido' ? 0.6 : 1 }}>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                    {format(new Date(sol.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </td>
                                <td>
                                    <strong>{sol.equipamentos?.nome || '-'}</strong>
                                    <br />
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>#{sol.equipamentos?.codigo_patrimonio}</span>
                                </td>
                                <td>{getTipoBadge(sol.tipo)}</td>
                                <td>
                                    {sol.identificacao_solicitante || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Anônimo</span>}
                                </td>
                                <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sol.observacao}>
                                    {sol.observacao || '-'}
                                </td>
                                <td>
                                    {sol.status === 'Pendente' ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontWeight: 600, fontSize: '13px' }}>
                                            <Clock size={14} /> Pendente
                                        </span>
                                    ) : (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontWeight: 600, fontSize: '13px' }}>
                                            <CheckCircle size={14} /> Resolvido
                                        </span>
                                    )}
                                </td>
                                <td>
                                    {sol.status === 'Pendente' && (
                                        <button
                                            className="btn-link"
                                            style={{ color: 'var(--success)', fontSize: '13px' }}
                                            onClick={() => handleResolver(sol.id)}
                                        >
                                            Dar Baixa
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mobile-card-list">
                {solicitacoes.map(sol => (
                    <div key={sol.id} className="mobile-card" style={{ borderLeft: sol.status === 'Pendente' ? '4px solid var(--warning)' : '4px solid var(--success)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {format(new Date(sol.created_at), "dd/MM/yyyy HH:mm")}
                            </span>
                            {getTipoBadge(sol.tipo)}
                        </div>

                        <h3 style={{ fontSize: '16px', margin: '0 0 4px 0' }}>{sol.equipamentos?.nome || '-'}</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <p><strong>De:</strong> {sol.identificacao_solicitante || 'Anônimo'}</p>
                            {sol.observacao && <p><strong>Obs:</strong> {sol.observacao}</p>}
                        </div>

                        <div className="mobile-card-footer" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {sol.status === 'Pendente' ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontWeight: 600, fontSize: '13px' }}>
                                    <Clock size={14} /> Pendente
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontWeight: 600, fontSize: '13px' }}>
                                    <CheckCircle size={14} /> Resolvido
                                </span>
                            )}

                            {sol.status === 'Pendente' && (
                                <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => handleResolver(sol.id)}>
                                    Dar Baixa
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
