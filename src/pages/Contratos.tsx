import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit2, Eye, Power } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateBR } from '../lib/utils';
import { ContratoForm } from '../components/ContratoForm';
import { ModalEncerrarContrato } from '../components/ModalEncerrarContrato';
import './Contratos.css';

interface Contrato {
    id: string;
    numero_contrato: string;
    cliente_id: string;
    data_inicio: string;
    data_prevista_encerramento: string;
    data_encerramento_real: string;
    valor_mensal: number;
    valor_total: number;
    status: 'ativo' | 'encerrado' | 'suspenso' | 'em_negociacao';
    observacoes: string;
    created_at: string;
    cliente?: { nome: string }; // joined data
}

type FilterStatus = 'todos' | 'ativo' | 'encerrado' | 'suspenso' | 'em_negociacao';

export function Contratos() {
    const [contratos, setContratos] = useState<Contrato[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('todos');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contratoEditando, setContratoEditando] = useState<Contrato | null>(null);
    const [contratoParaEncerrar, setContratoParaEncerrar] = useState<string | null>(null);
    
    // WIP Modals integration to come
    const navigate = useNavigate();

    const fetchContratos = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('contratos')
                .select(`
                    *,
                    cliente:clientes(nome)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code !== '42P01') {
                    toast.error('Erro ao buscar contratos. Tem certeza que rodou o SQL no Supabase?');
                }
                return;
            }

            setContratos((data as any) || []);
        } catch {
            toast.error('Erro de conexão ao buscar contratos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContratos();
    }, []);

    const contratosFiltrados = contratos.filter(contrato => {
        const numMatch = contrato.numero_contrato?.toLowerCase().includes(searchQuery.toLowerCase());
        const cliMatch = contrato.cliente?.nome?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSearch = numMatch || cliMatch;

        if (statusFilter !== 'todos') return matchesSearch && contrato.status === statusFilter;
        return matchesSearch;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ativo': return <span className="status-badge status-ativo">Ativo</span>;
            case 'em_negociacao': return <span className="status-badge status-negociacao">Em Negociação</span>;
            case 'suspenso': return <span className="status-badge status-suspenso">Suspenso</span>;
            case 'encerrado': return <span className="status-badge status-encerrado">Encerrado</span>;
            default: return <span className="status-badge">{status}</span>;
        }
    };

    const handleEncerrar = (contrato: Contrato) => {
        if (contrato.status === 'encerrado') return;
        setContratoParaEncerrar(contrato.id);
    };

    return (
        <div className="module-container">
            <div className="module-header">
                <div className="search-filters">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar por número ou cliente..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="filter-group hide-scrollbar" style={{ overflowX: 'auto', display: 'flex' }}>
                        <button className={`filter-btn ${statusFilter === 'todos' ? 'active' : ''}`} onClick={() => setStatusFilter('todos')}>Todos</button>
                        <button className={`filter-btn ${statusFilter === 'ativo' ? 'active' : ''}`} onClick={() => setStatusFilter('ativo')}>Ativos</button>
                        <button className={`filter-btn ${statusFilter === 'em_negociacao' ? 'active' : ''}`} onClick={() => setStatusFilter('em_negociacao')}>Em Negociação</button>
                        <button className={`filter-btn ${statusFilter === 'suspenso' ? 'active' : ''}`} onClick={() => setStatusFilter('suspenso')}>Suspensos</button>
                        <button className={`filter-btn ${statusFilter === 'encerrado' ? 'active' : ''}`} onClick={() => setStatusFilter('encerrado')}>Encerrados</button>
                    </div>
                </div>

                <button className="btn-primary btn-danger-theme" onClick={() => { setContratoEditando(null); setIsModalOpen(true); }} style={{ backgroundColor: 'var(--primary-red)' }}>
                    <Plus size={18} />
                    Novo Contrato
                </button>
            </div>

            <div className="table-container">
                {loading ? (
                    <div className="loading-state">Carregando dados...</div>
                ) : contratosFiltrados.length === 0 ? (
                    <div className="empty-state">Nenhum contrato encontrado.</div>
                ) : (
                    <div className="table-wrapper desktop-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Número</th>
                                    <th>Cliente</th>
                                    <th>Data Início</th>
                                    <th>Prev. Encerramento</th>
                                    <th>Valor Mensal</th>
                                    <th>Status</th>
                                    <th className="action-column">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contratosFiltrados.map((contrato) => (
                                    <tr key={contrato.id}>
                                        <td className="fw-600">{contrato.numero_contrato || '-'}</td>
                                        <td>{contrato.cliente?.nome || '-'}</td>
                                        <td>{contrato.data_inicio ? formatDateBR(contrato.data_inicio) : '-'}</td>
                                        <td>{contrato.data_prevista_encerramento ? formatDateBR(contrato.data_prevista_encerramento) : '-'}</td>
                                        <td>{contrato.valor_mensal ? formatCurrency(contrato.valor_mensal) : '-'}</td>
                                        <td>{getStatusBadge(contrato.status)}</td>
                                        <td className="action-column">
                                            <button className="btn-icon" title="Visualizar" onClick={() => navigate(`/contratos/${contrato.id}`)}>
                                                <Eye size={16} />
                                            </button>
                                            <button className="btn-icon" title="Editar" onClick={() => { setContratoEditando(contrato); setIsModalOpen(true); }}>
                                                <Edit2 size={16} />
                                            </button>
                                            {contrato.status !== 'encerrado' && (
                                                <button className="btn-icon text-error" title="Encerrar Contrato" onClick={() => handleEncerrar(contrato)}>
                                                    <Power size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            {isModalOpen && (
                <ContratoForm
                    contratoEdicao={contratoEditando}
                    onClose={() => { setIsModalOpen(false); setContratoEditando(null); }}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        setContratoEditando(null);
                        fetchContratos();
                    }}
                />
            )}

            {contratoParaEncerrar && (
                <ModalEncerrarContrato 
                    contratoId={contratoParaEncerrar}
                    onClose={() => setContratoParaEncerrar(null)}
                    onSuccess={() => {
                        setContratoParaEncerrar(null);
                        fetchContratos();
                    }}
                />
            )}
        </div>
    );
}
