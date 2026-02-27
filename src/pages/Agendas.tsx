import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Calendar, CheckSquare, Clock, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { AgendaForm } from '../components/AgendaForm';
import { AnotacaoForm } from '../components/AnotacaoForm';
import { ConfirmModal } from '../components/ConfirmModal';
import './Agendas.css';

interface Agenda {
    id: string;
    nome: string;
    cor: string;
    pendentes?: number; // Contagem sintética
}

interface Anotacao {
    id: string;
    agenda_id: string;
    titulo: string;
    descricao: string | null;
    data_vencimento: string | null;
    status: 'pendente' | 'concluido';
}

export function Agendas() {
    const [agendas, setAgendas] = useState<Agenda[]>([]);
    const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
    const [agendaAtivaId, setAgendaAtivaId] = useState<string | null>(null);

    const [loadingAgendas, setLoadingAgendas] = useState(true);
    const [loadingAnotacoes, setLoadingAnotacoes] = useState(false);
    const [exibirConcluidas, setExibirConcluidas] = useState(false);

    // Controle Modais
    const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
    const [agendaEditando, setAgendaEditando] = useState<Agenda | null>(null);

    const [isAnotacaoModalOpen, setIsAnotacaoModalOpen] = useState(false);
    const [anotacaoEditando, setAnotacaoEditando] = useState<Anotacao | null>(null);

    const [deleteAgendaModalOpen, setDeleteAgendaModalOpen] = useState(false);
    const [agendaParaDeletar, setAgendaParaDeletar] = useState<Agenda | null>(null);
    const [deleteAnotacaoModalOpen, setDeleteAnotacaoModalOpen] = useState(false);
    const [anotacaoParaDeletar, setAnotacaoParaDeletar] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchAgendas = async () => {
        try {
            setLoadingAgendas(true);
            const { data, error } = await supabase
                .from('agendas')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) {
                if (error.code !== '42P01') toast.error('Erro ao buscar agendas');
                return;
            }

            const agendasData = data || [];

            // Buscar contagem de pendentes para cada agenda
            const { data: anotData } = await supabase
                .from('agendas_anotacoes')
                .select('agenda_id, status')
                .eq('status', 'pendente');

            const contagens = (anotData || []).reduce((acc: any, curr: any) => {
                acc[curr.agenda_id] = (acc[curr.agenda_id] || 0) + 1;
                return acc;
            }, {});

            const agendasComContagem = agendasData.map(a => ({
                ...a,
                pendentes: contagens[a.id] || 0
            }));

            setAgendas(agendasComContagem);

            // Se não tiver agenda ativa e existir alguma, seleciona a primeira
            if (!agendaAtivaId && agendasComContagem.length > 0) {
                setAgendaAtivaId(agendasComContagem[0].id);
            } else if (agendasComContagem.length === 0) {
                setAgendaAtivaId(null);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoadingAgendas(false);
        }
    };

    const fetchAnotacoes = async (aId: string) => {
        try {
            setLoadingAnotacoes(true);
            const { data, error } = await supabase
                .from('agendas_anotacoes')
                .select('*')
                .eq('agenda_id', aId);

            if (error) throw error;
            setAnotacoes(data || []);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao buscar anotações da agenda');
        } finally {
            setLoadingAnotacoes(false);
        }
    };

    useEffect(() => {
        fetchAgendas();
    }, []);

    useEffect(() => {
        if (agendaAtivaId) {
            fetchAnotacoes(agendaAtivaId);
        } else {
            setAnotacoes([]);
        }
    }, [agendaAtivaId]);

    // Helpers Data
    const getTodayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const getTomorrowStr = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const isVencida = (dataVencimento: string | null, status: string) => {
        if (!dataVencimento || status === 'concluido') return false;
        return dataVencimento < getTodayStr();
    };

    const isHoje = (dataVencimento: string | null, status: string) => {
        if (!dataVencimento || status === 'concluido') return false;
        return dataVencimento === getTodayStr();
    };

    const isAmanha = (dataVencimento: string | null, status: string) => {
        if (!dataVencimento || status === 'concluido') return false;
        return dataVencimento === getTomorrowStr();
    };

    const formataData = (dataStr: string | null) => {
        if (!dataStr) return '';
        const partes = dataStr.split('-');
        if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return dataStr;
    };

    // Ordenação e Filtragem das Anotações
    const anotacoesProcessadas = useMemo(() => {
        let lista = anotacoes.filter(a => exibirConcluidas ? a.status === 'concluido' : a.status === 'pendente');

        return lista.sort((a, b) => {
            // Regra 1: Concluidas por ultimo
            if (a.status !== b.status) {
                return a.status === 'concluido' ? 1 : -1;
            }

            // Regra 2: Se pendente, vencidas ou de hoje primeiro (menor data ganha)
            if (a.status === 'pendente') {
                if (a.data_vencimento && b.data_vencimento) {
                    return a.data_vencimento.localeCompare(b.data_vencimento);
                }
                if (a.data_vencimento && !b.data_vencimento) return -1;
                if (!a.data_vencimento && b.data_vencimento) return 1;
            }
            return 0; // empate na criação se não houver data
        });
    }, [anotacoes, exibirConcluidas]);

    // Ações Agenda
    const handleNovaAgenda = () => {
        setAgendaEditando(null);
        setIsAgendaModalOpen(true);
    };

    const handleEditarAgenda = (agenda: Agenda, e: React.MouseEvent) => {
        e.stopPropagation();
        setAgendaEditando(agenda);
        setIsAgendaModalOpen(true);
    };

    const handleExcluirAgenda = async (agenda: Agenda, e: React.MouseEvent) => {
        e.stopPropagation();

        // Verificar se tem anotações primeiro (no state local dá se for a ativa, mas o view geral é nos pendentes/db)
        const { count } = await supabase
            .from('agendas_anotacoes')
            .select('*', { count: 'exact', head: true })
            .eq('agenda_id', agenda.id);

        if (count && count > 0) {
            toast.error('Esta Agenda possui anotações. Exclua ou mova as anotações antes de deletá-la.');
            return;
        }

        setAgendaParaDeletar(agenda);
        setDeleteAgendaModalOpen(true);
    };

    const confirmExcluirAgenda = async () => {
        if (!agendaParaDeletar) return;

        try {
            setIsDeleting(true);
            const { error } = await supabase.from('agendas').delete().eq('id', agendaParaDeletar.id);
            if (error) {
                toast.error('Erro ao excluir agenda');
            } else {
                toast.success('Agenda excluída.');
                if (agendaAtivaId === agendaParaDeletar.id) setAgendaAtivaId(null);
                setDeleteAgendaModalOpen(false);
                setAgendaParaDeletar(null);
                fetchAgendas();
            }
        } finally {
            setIsDeleting(false);
        }
    };

    // Ações Anotacao
    const handleNovaAnotacao = () => {
        if (!agendaAtivaId) return;
        setAnotacaoEditando(null);
        setIsAnotacaoModalOpen(true);
    };

    const handleToggleStatus = async (anotacao: Anotacao) => {
        const novoStatus = anotacao.status === 'pendente' ? 'concluido' : 'pendente';

        // Optimistic UI update
        setAnotacoes(prev => prev.map(a => a.id === anotacao.id ? { ...a, status: novoStatus } : a));

        const { error } = await supabase
            .from('agendas_anotacoes')
            .update({ status: novoStatus })
            .eq('id', anotacao.id);

        if (error) {
            toast.error('Erro ao atualizar status');
            // Rollback on error
            fetchAnotacoes(agendaAtivaId!);
        } else {
            // Atualizar o contador da sidebar visualmente de forma estúpida e rápida
            setAgendas(prev => prev.map(ag => {
                if (ag.id === agendaAtivaId) {
                    return { ...ag, pendentes: novoStatus === 'concluido' ? (ag.pendentes || 1) - 1 : (ag.pendentes || 0) + 1 };
                }
                return ag;
            }));
        }
    };

    const handleDeletarAnotacao = (id: string) => {
        setAnotacaoParaDeletar(id);
        setDeleteAnotacaoModalOpen(true);
    };

    const confirmDeletarAnotacao = async () => {
        if (!anotacaoParaDeletar) return;

        try {
            setIsDeleting(true);
            const { error } = await supabase.from('agendas_anotacoes').delete().eq('id', anotacaoParaDeletar);
            if (error) {
                toast.error('Erro ao excluir anotação');
            } else {
                toast.success('Anotação excluída');
                setDeleteAnotacaoModalOpen(false);
                setAnotacaoParaDeletar(null);
                fetchAnotacoes(agendaAtivaId!);
                fetchAgendas(); // atualiza counter se precisou
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const agendaAtivaObj = useMemo(() => agendas.find(a => a.id === agendaAtivaId), [agendas, agendaAtivaId]);

    return (
        <div className="module-container">
            <div className="agendas-container">
                {/* Master: Lista de Agendas */}
                <div className={`agendas-sidebar ${agendaAtivaId ? 'is-hidden-mobile' : ''}`}>
                    <div className="agendas-sidebar-header">
                        <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 600 }}>Agendas</h2>
                        <button className="btn-primary" onClick={handleNovaAgenda} style={{ padding: '8px', borderRadius: '50%' }} title="Criar Nova Agenda">
                            <Plus size={18} />
                        </button>
                    </div>

                    <div className="agendas-list">
                        {loadingAgendas ? (
                            <div className="text-secondary" style={{ textAlign: 'center', padding: '20px' }}>Carregando...</div>
                        ) : agendas.length === 0 ? (
                            <div className="text-secondary" style={{ textAlign: 'center', padding: '20px', fontSize: '14px' }}>
                                Nenhuma agenda criada. Clique no + acima.
                            </div>
                        ) : (
                            agendas.map(agenda => (
                                <div
                                    key={agenda.id}
                                    className={`agenda-item ${agendaAtivaId === agenda.id ? 'active' : ''}`}
                                    onClick={() => setAgendaAtivaId(agenda.id)}
                                    style={{ borderLeftColor: agendaAtivaId === agenda.id ? agenda.cor : 'transparent' }}
                                >
                                    <div className="agenda-item-main">
                                        <div className="agenda-dot" style={{ backgroundColor: agenda.cor }}></div>
                                        <span className="agenda-title">{agenda.nome}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="agenda-badge">{agenda.pendentes || 0}</span>
                                        <div className="agenda-actions">
                                            <button className="btn-icon" onClick={(e) => handleEditarAgenda(agenda, e)}><Edit2 size={14} /></button>
                                            <button className="btn-icon text-error" onClick={(e) => handleExcluirAgenda(agenda, e)}><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Detail: Lista de Anotações */}
                <div className={`anotacoes-main ${!agendaAtivaId ? 'is-hidden-mobile' : ''}`}>
                    {!agendaAtivaId ? (
                        <div className="empty-state-agenda">
                            <Clock size={48} opacity={0.5} />
                            <h3>Bem-vindo às Agendas</h3>
                            <p>Crie sua primeira agenda no menu lateral esquerdo ou selecione uma existente para organizar suas anotações.</p>
                        </div>
                    ) : (
                        <>
                            <div className="anotacoes-header">
                                <div className="anotacoes-header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        className="btn-icon btn-voltar-mobile"
                                        onClick={() => setAgendaAtivaId(null)}
                                        style={{ marginRight: '8px' }}
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <h2 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="agenda-dot" style={{ backgroundColor: agendaAtivaObj?.cor, width: '12px', height: '12px' }}></div>
                                        {agendaAtivaObj?.nome}
                                    </h2>
                                </div>
                                <div className="anotacoes-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={exibirConcluidas}
                                            onChange={(e) => setExibirConcluidas(e.target.checked)}
                                            style={{ accentColor: 'var(--primary-red)' }}
                                        />
                                        Exibir Concluídas
                                    </label>
                                    <button className="btn-primary" onClick={handleNovaAnotacao}>
                                        <Plus size={18} /> Nova Anotação
                                    </button>
                                </div>
                            </div>

                            <div className="anotacoes-list">
                                {loadingAnotacoes ? (
                                    <div className="text-secondary" style={{ textAlign: 'center', padding: '40px' }}>Carregando anotações...</div>
                                ) : anotacoesProcessadas.length === 0 ? (
                                    <div className="empty-state-agenda">
                                        <CheckSquare size={48} opacity={0.3} />
                                        <h3>Tudo limpo por aqui!</h3>
                                        <p>Você não tem nenhuma anotação {exibirConcluidas ? 'concluída' : 'pendente'} nesta agenda.</p>
                                    </div>
                                ) : (
                                    anotacoesProcessadas.map(anot => {
                                        const cConcluida = anot.status === 'concluido';
                                        const cVencida = isVencida(anot.data_vencimento, anot.status);
                                        const cHoje = isHoje(anot.data_vencimento, anot.status);
                                        const cAmanha = isAmanha(anot.data_vencimento, anot.status);

                                        let cardClass = 'anotacao-card';
                                        let dateClass = 'anotacao-date';
                                        let dateLabel = formataData(anot.data_vencimento);

                                        if (cConcluida) {
                                            cardClass += ' concluida';
                                        } else if (cVencida) {
                                            cardClass += ' vencida';
                                            dateClass += ' vencida-label';
                                            dateLabel = `Vencida em ${dateLabel}`;
                                        } else if (cHoje) {
                                            cardClass += ' hoje';
                                            dateClass += ' hoje-label';
                                            dateLabel = 'Hoje';
                                        } else if (cAmanha) {
                                            cardClass += ' amanha';
                                            dateClass += ' amanha-label';
                                            dateLabel = 'Amanhã';
                                        }

                                        return (
                                            <div key={anot.id} className={cardClass}>
                                                <div className="anotacao-header">
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                                                        <input
                                                            type="checkbox"
                                                            className="anotacao-checkbox"
                                                            checked={cConcluida}
                                                            onChange={() => handleToggleStatus(anot)}
                                                            title="Marcar como concluída"
                                                        />
                                                        <div>
                                                            <h4 className="anotacao-title">{anot.titulo}</h4>
                                                            {anot.descricao && <p className="anotacao-desc" style={{ marginTop: '8px' }}>{anot.descricao}</p>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="anotacao-footer">
                                                    <div>
                                                        {anot.data_vencimento && (
                                                            <span className={dateClass}>
                                                                <Calendar size={14} />
                                                                {dateLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            className="btn-icon text-secondary"
                                                            onClick={() => { setAnotacaoEditando(anot); setIsAnotacaoModalOpen(true); }}
                                                            title="Editar"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            className="btn-icon text-error-hover"
                                                            style={{ color: 'var(--text-secondary)' }}
                                                            onClick={() => handleDeletarAnotacao(anot.id)}
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* MODAIS */}
            {isAgendaModalOpen && (
                <AgendaForm
                    agendaEdicao={agendaEditando}
                    onClose={() => { setIsAgendaModalOpen(false); setAgendaEditando(null); }}
                    onSuccess={() => { setIsAgendaModalOpen(false); setAgendaEditando(null); fetchAgendas(); }}
                />
            )}

            {isAnotacaoModalOpen && agendaAtivaId && (
                <AnotacaoForm
                    agendaId={agendaAtivaId}
                    anotacaoEdicao={anotacaoEditando}
                    onClose={() => { setIsAnotacaoModalOpen(false); setAnotacaoEditando(null); }}
                    onSuccess={() => { setIsAnotacaoModalOpen(false); setAnotacaoEditando(null); fetchAnotacoes(agendaAtivaId); fetchAgendas(); }}
                />
            )}

            <ConfirmModal
                isOpen={deleteAgendaModalOpen}
                title="Excluir Agenda"
                description={<>Tem certeza que deseja apagar a agenda <strong>{agendaParaDeletar?.nome}</strong>?</>}
                onConfirm={confirmExcluirAgenda}
                onCancel={() => {
                    setDeleteAgendaModalOpen(false);
                    setAgendaParaDeletar(null);
                }}
                isLoading={isDeleting}
            />

            <ConfirmModal
                isOpen={deleteAnotacaoModalOpen}
                title="Excluir Anotação"
                description="Tem certeza que deseja apagar esta anotação? Esta ação não pode ser desfeita."
                onConfirm={confirmDeletarAnotacao}
                onCancel={() => {
                    setDeleteAnotacaoModalOpen(false);
                    setAnotacaoParaDeletar(null);
                }}
                isLoading={isDeleting}
            />
        </div>
    );
}
