import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { listEvents } from '../lib/googleCalendar';
import { DollarSign, Package, Settings, ClipboardList, Calendar as CalendarIcon, AlertTriangle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useSettings } from '../hooks/useSettings';
import './Dashboard.css';

export function Dashboard() {
    const navigate = useNavigate();
    const { usuarioNome } = useSettings();
    const [loadingResumo, setLoadingResumo] = useState(true);
    const [loadingCalendar, setLoadingCalendar] = useState(true);
    const [loadingAnotacoes, setLoadingAnotacoes] = useState(true);
    const [loadingOperation, setLoadingOperation] = useState(true);

    const [sumario, setSumario] = useState({
        patrimonioTotal: 0,
        equipamentosDisponiveis: 0,
        operacao: 0,
        tarefasPendentes: 0,
        contratosAtivos: 0
    });

    const [compromissos, setCompromissos] = useState<any[]>([]);
    const [authCalendarError, setAuthCalendarError] = useState(false);

    const [anotacoesCriticas, setAnotacoesCriticas] = useState<any[]>([]);
    const [contratosAlerta, setContratosAlerta] = useState<any[]>([]);
    const [equipamentosEmCampo, setEquipamentosEmCampo] = useState<any[]>([]);

    useEffect(() => {
        const fetchSumario = async () => {
            try {
                // 1) Equipamentos Ativos ( != 'baixado' ) para soma e counters
                const { data: equipAtivos, error: errEquip } = await supabase
                    .from('equipamentos')
                    .select('valor_aquisicao, status')
                    .neq('status', 'baixado');

                if (errEquip) throw errEquip;

                let sumPatrimonio = 0;
                let countDisponiveis = 0;
                let countOperacao = 0;

                equipAtivos?.forEach(e => {
                    sumPatrimonio += Number(e.valor_aquisicao || 0);
                    if (e.status === 'disponivel') countDisponiveis++;
                    if (e.status === 'alugado' || e.status === 'manutencao') countOperacao++;
                });

                // 2) Anotações Pendentes Globais
                const { count: countPendentes, error: errAnot } = await supabase
                    .from('agendas_anotacoes')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pendente');

                if (errAnot) throw errAnot;

                // 3) Contratos Ativos
                const { count: countContratos, error: errContratos } = await supabase
                    .from('contratos')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'ativo');
                
                if (errContratos) throw errContratos;

                setSumario({
                    patrimonioTotal: sumPatrimonio,
                    equipamentosDisponiveis: countDisponiveis,
                    operacao: countOperacao,
                    tarefasPendentes: countPendentes || 0,
                    contratosAtivos: countContratos || 0
                });

            } catch (err: any) {
                console.error("Erro fetchSumario", err);
                toast.error("Falha ao carregar Resumo.");
            } finally {
                setLoadingResumo(false);
            }
        };

        const fetchCalendarEvents = async () => {
            try {
                // Next 7 days
                const now = new Date();
                const next7Days = new Date();
                next7Days.setDate(next7Days.getDate() + 7);

                const events = await listEvents(now, next7Days);
                setCompromissos(events);
                setAuthCalendarError(false);
            } catch (err: any) {
                console.error("Dashboard Calendar:", err);
                setAuthCalendarError(true);
            } finally {
                setLoadingCalendar(false);
            }
        };

        const fetchAnotacoesCriticas = async () => {
            try {
                // Supabase doesn't fully support logical `status = X AND date <= Y OR date = Tomorrow` properly
                // in a single simple syntax if we want custom ordering. We will fetch pendentes and filter/sort in memory.
                const { data, error } = await supabase
                    .from('agendas_anotacoes')
                    .select('id, titulo, data_vencimento, status, current_agenda_nome:agendas(nome)')
                    .eq('status', 'pendente')
                    .not('data_vencimento', 'is', null);

                if (error) throw error;

                const todayStr = (() => {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })();
                const tomorrowStr = (() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })();

                const criticas = (data || []).map(anot => {
                    let level = 3; // 0 = vencida, 1 = hoje, 2 = amanha, 3 = ignorar
                    if (anot.data_vencimento < todayStr) level = 0;
                    else if (anot.data_vencimento === todayStr) level = 1;
                    else if (anot.data_vencimento === tomorrowStr) level = 2;
                    return { ...anot, level };
                }).filter(a => a.level < 3).sort((a, b) => a.level - b.level);

                setAnotacoesCriticas(criticas);

            } catch (err: any) {
                console.error(err);
            } finally {
                setLoadingAnotacoes(false);
            }
        };

        const fetchContratosAlerta = async () => {
            try {
                // Fetch active contratos with encerramento date
                const { data, error } = await supabase
                    .from('contratos')
                    .select('id, numero_contrato, data_prevista_encerramento, cliente:clientes(nome)')
                    .eq('status', 'ativo')
                    .not('data_prevista_encerramento', 'is', null);

                if (error) throw error;

                const today = new Date();
                today.setHours(0,0,0,0);

                const comAlertas = (data || []).map(c => {
                    const prevDate = new Date(c.data_prevista_encerramento);
                    const diffTime = prevDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return { ...c, diffDays };
                }).filter(c => c.diffDays <= 7).sort((a, b) => a.diffDays - b.diffDays);
                
                setContratosAlerta(comAlertas);
            } catch (err) {
                console.error("Erro fetchContratosAlerta", err);
            }
        };

        const fetchEquipamentosEmCampo = async () => {
            try {
                const { data, error } = await supabase
                    .from('equipamentos')
                    .select('*, cat:categorias_equipamento(nome)')
                    .in('status', ['alugado', 'manutencao']);

                if (error) throw error;
                // sort default por status
                setEquipamentosEmCampo(data || []);
            } catch (err: any) {
                console.error(err);
            } finally {
                setLoadingOperation(false);
            }
        };

        // Função orquestradora que vai disparar as promessas paralelamente em breve
        const fetchAllDashboardData = async () => {
            setLoadingResumo(true);
            setLoadingCalendar(true);
            setLoadingAnotacoes(true);
            setLoadingOperation(true);

            Promise.all([
                fetchSumario(),
                fetchCalendarEvents(),
                fetchAnotacoesCriticas(),
                fetchContratosAlerta(),
                fetchEquipamentosEmCampo()
            ]);
        };

        fetchAllDashboardData();

        const channel = supabase
            .channel('public:equipamentos_dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipamentos' }, () => {
                // Atualiza contadores e a listagem inferior caso algum equipamento mude via QR
                fetchSumario();
                fetchEquipamentosEmCampo();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, []);

    // Placeholder do Esqueleto base que faremos genérico por hora pra teste visual
    const renderSkeleton = (height = '100px') => (
        <div className="skeleton-box" style={{ height, width: '100%', borderRadius: '8px' }}></div>
    );

    // Lógica da Saudação
    const horaAtual = new Date().getHours();
    let saudacao = 'Boa noite';
    if (horaAtual >= 5 && horaAtual < 12) {
        saudacao = 'Bom dia';
    } else if (horaAtual >= 12 && horaAtual < 18) {
        saudacao = 'Boa tarde';
    }

    return (
        <div className="module-container dashboard-root">

            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                    {saudacao}, {usuarioNome || 'Usuário'}! 👋
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                    Aqui está o resumo da sua operação hoje.
                </p>
            </div>

            {/* Bloco 1 - Resumo Topo */}
            <div className="dashboard-summary-grid">
                {loadingResumo ? (
                    <>
                        {renderSkeleton('120px')}
                        {renderSkeleton('120px')}
                        {renderSkeleton('120px')}
                        {renderSkeleton('120px')}
                    </>
                ) : (
                    <>
                        <div className="summary-card" onClick={() => navigate('/patrimonio')}>
                            <div className="summary-icon" style={{ backgroundColor: 'rgba(204, 34, 34, 0.1)', color: 'var(--primary-red)' }}>
                                <DollarSign size={24} />
                            </div>
                            <div className="summary-info">
                                <h3>Patrimônio Ativo</h3>
                                <p className="summary-value">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sumario.patrimonioTotal)}
                                </p>
                            </div>
                        </div>
                        <div className="summary-card" onClick={() => navigate('/equipamentos')}>
                            <div className="summary-icon" style={{ backgroundColor: 'rgba(46, 204, 113, 0.1)', color: 'var(--success)' }}>
                                <Package size={24} />
                            </div>
                            <div className="summary-info">
                                <h3>Equip. Disponíveis</h3>
                                <p className="summary-value">{sumario.equipamentosDisponiveis}</p>
                            </div>
                        </div>
                        <div className="summary-card" onClick={() => navigate('/equipamentos')}>
                            <div className="summary-icon" style={{ backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db' }}>
                                <Settings size={24} />
                            </div>
                            <div className="summary-info">
                                <h3>Em Operação</h3>
                                <p className="summary-value">{sumario.operacao}</p>
                            </div>
                        </div>
                        <div className="summary-card" onClick={() => navigate('/agendas')}>
                            <div className="summary-icon" style={{ backgroundColor: 'rgba(243, 156, 18, 0.1)', color: 'var(--warning)' }}>
                                <ClipboardList size={24} />
                            </div>
                            <div className="summary-info">
                                <h3>Tarefas Pendentes</h3>
                                <p className="summary-value">{sumario.tarefasPendentes}</p>
                            </div>
                        </div>
                        <div className="summary-card" onClick={() => navigate('/contratos')}>
                            <div className="summary-icon" style={{ backgroundColor: 'rgba(156, 163, 175, 0.1)', color: 'var(--text-main)' }}>
                                <FileText size={24} />
                            </div>
                            <div className="summary-info">
                                <h3>Contratos Ativos</h3>
                                <p className="summary-value">{sumario.contratosAtivos}</p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Bloco 2 - Esquerda/Direita */}
            <div className="dashboard-split-grid">

                {/* Painel Esquerdo - Calendário */}
                <div className="dashboard-panel">
                    <div className="panel-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CalendarIcon size={20} color="var(--primary-red)" />
                            <h2>Próximos 7 Dias</h2>
                        </div>
                        <button className="btn-link" onClick={() => navigate('/compromissos')}>Ver Calendário &rarr;</button>
                    </div>
                    <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {loadingCalendar ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {renderSkeleton('60px')}
                                {renderSkeleton('60px')}
                                {renderSkeleton('60px')}
                            </div>
                        ) : authCalendarError ? (
                            <div className="empty-state-panel" style={{ color: 'var(--error)', borderColor: 'rgba(231, 76, 60, 0.3)' }}>
                                <p>Sessão do Google Calendário expirada. Faça login em Compromissos.</p>
                            </div>
                        ) : compromissos.length === 0 ? (
                            <div className="empty-state-panel">
                                <p>Nenhum compromisso nos próximos 7 dias.</p>
                            </div>
                        ) : (
                            compromissos.map((ev, idx) => (
                                <div key={idx} style={{
                                    padding: '12px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: '8px',
                                    borderLeft: `4px solid ${ev.colorId ? '#cc2222' : 'var(--primary-red)'}`
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{ev.summary}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {ev.start.dateTime
                                            ? format(new Date(ev.start.dateTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                            : format(new Date(ev.start.date!), "dd/MM/yyyy (Dia Inteiro)", { locale: ptBR })
                                        }
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Painel Direito - Anotações Urgentes */}
                <div className="dashboard-panel">
                    <div className="panel-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={20} color="var(--warning)" />
                            <h2>Tarefas Críticas</h2>
                        </div>
                        <button className="btn-link" onClick={() => navigate('/agendas')}>Ver Agendas &rarr;</button>
                    </div>
                    <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {loadingAnotacoes ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {renderSkeleton('70px')}
                                {renderSkeleton('70px')}
                            </div>
                        ) : anotacoesCriticas.length === 0 ? (
                            <div className="empty-state-panel success">
                                <p>Tudo em dia! Nenhuma tarefa urgente.</p>
                            </div>
                        ) : (
                            anotacoesCriticas.map((anot) => (
                                <div key={anot.id} style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    backgroundColor: 'var(--bg-main)',
                                    border: `1px solid ${anot.level === 0 ? 'var(--error)' : anot.level === 1 ? 'var(--warning)' : '#f1c40f'}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{anot.titulo}</div>
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backgroundColor: anot.level === 0 ? 'rgba(231, 76, 60, 0.2)' : anot.level === 1 ? 'rgba(243, 156, 18, 0.2)' : 'rgba(241, 196, 15, 0.2)',
                                            color: anot.level === 0 ? 'var(--error)' : anot.level === 1 ? 'var(--warning)' : '#f1c40f'
                                        }}>
                                            {anot.level === 0 ? 'VENCIDA' : anot.level === 1 ? 'HOJE' : 'AMANHÃ'}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        Agenda: {anot.current_agenda_nome?.nome || 'Sem Agenda'}
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Listar os contratos vencendo/vencidos abaixo das anotações se houver */}
                        {!loadingAnotacoes && contratosAlerta.map(c => (
                            <div key={`cont-${c.id}`} style={{
                                padding: '12px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--bg-main)',
                                border: `1px solid ${c.diffDays < 0 ? 'var(--error)' : 'var(--warning)'}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={14}/> Contrato {c.numero_contrato || c.id.split('-')[0]}</div>
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: c.diffDays < 0 ? 'rgba(231, 76, 60, 0.2)' : 'rgba(243, 156, 18, 0.2)',
                                        color: c.diffDays < 0 ? 'var(--error)' : 'var(--warning)'
                                    }}>
                                        {c.diffDays < 0 ? `Vencido há ${Math.abs(c.diffDays)} dias` : c.diffDays === 0 ? 'Vence HOJE' : `Vence em ${c.diffDays} dias`}
                                    </div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Cliente: {c.cliente?.nome || '-'}
                                </div>
                            </div>
                        ))}

                    </div>
                </div>

            </div>

            {/* Bloco 3 - Equipamentos em Operação */}
            <div className="dashboard-panel full-width">
                <div className="panel-header" style={{ marginBottom: '16px' }}>
                    <h2>Equipamentos em Campo</h2>
                    <button className="btn-link" onClick={() => navigate('/patrimonio')}>Ver Patrimônio Completo &rarr;</button>
                </div>
                <div className="panel-content table-wrapper">
                    {loadingOperation ? (
                        <div style={{ marginTop: '16px' }}>{renderSkeleton('200px')}</div>
                    ) : equipamentosEmCampo.length === 0 ? (
                        <div className="empty-state-panel">
                            <p>Nenhum equipamento em campo no momento.</p>
                        </div>
                    ) : (
                        <>
                            <div className="table-wrapper desktop-table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>CÓDIGO</th>
                                            <th>NOME</th>
                                            <th>CATEGORIA</th>
                                            <th>STATUS / APLICAÇÃO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipamentosEmCampo.map(eq => (
                                            <tr key={eq.id}>
                                                <td style={{ fontWeight: '500' }}>#{eq.codigo_patrimonio}</td>
                                                <td>{eq.nome}</td>
                                                <td>{eq.cat?.nome || '-'}</td>
                                                <td>
                                                    <span className={`status-badge ${eq.status}`}>
                                                        {eq.status === 'alugado' ? 'ALUGADO' :
                                                            eq.status === 'manutencao' ? 'EM MANUTENÇÃO' :
                                                                eq.status.toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mobile-card-list">
                                {equipamentosEmCampo.map(eq => (
                                    <div key={eq.id} className="mobile-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3>{eq.nome}</h3>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>#{eq.codigo_patrimonio}</span>
                                        </div>
                                        <p>Categoria: {eq?.cat?.nome || '-'}</p>
                                        <div className="mobile-card-footer">
                                            <span className={`status-badge ${eq.status}`}>
                                                {eq.status === 'alugado' ? 'ALUGADO' :
                                                    eq.status === 'manutencao' ? 'EM MANUTENÇÃO' :
                                                        eq.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

        </div>
    );
}
