import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit2, RotateCcw, Settings, X, QrCode, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { EquipamentoForm } from '../components/EquipamentoForm';
import { CategoriasModal } from '../components/CategoriasModal';
import { EquipamentoStatusModal } from '../components/EquipamentoStatusModal';
import { QRCodeModal } from '../components/QRCodeModal';
import { SolicitacoesQR } from '../components/SolicitacoesQR';
import { ImportacaoEquipamentosModal } from '../components/ImportacaoEquipamentosModal';
import './Equipamentos.css';
import { formatCurrency } from '../lib/currencyUtils';

interface Equipamento {
    id: string;
    nome: string;
    descricao: string;
    categoria_id: string | null;
    codigo_patrimonio: string;
    status: 'disponivel' | 'alugado' | 'manutencao' | 'baixado';
    valor_aquisicao: number | null;
    data_aquisicao: string | null;
    foto_url: string;
    observacoes: string;
    tag?: string;
    qr_token?: string;
    categorias_equipamento?: { nome: string }; // Join relation
}

export function Equipamentos() {
    const location = useLocation();
    const navigate = useNavigate();

    const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
    const [categoriasLista, setCategoriasLista] = useState<{ id: string, nome: string }[]>([]);

    const [loading, setLoading] = useState(true);

    // Filtros
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');

    // Modais
    const [isEquipamentoModalOpen, setIsEquipamentoModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [equipamentoEditando, setEquipamentoEditando] = useState<Equipamento | null>(null);

    const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);

    // Vizualização de imagem
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    const [equipamentoStatusID, setEquipamentoStatusID] = useState<string | null>(null);
    const [equipamentoStatusName, setEquipamentoStatusName] = useState('');
    const [equipamentoStatusAtual, setEquipamentoStatusAtual] = useState('');

    // Aba ativa
    const [activeTab, setActiveTab] = useState<'equipamentos' | 'solicitacoes'>('equipamentos');

    // Estado do Modal QR Code
    const [qrModalData, setQrModalData] = useState<{ id: string, nome: string, codigoPatrimonio: string, token: string } | null>(null);

    const fetchDados = async () => {
        try {
            setLoading(true);

            // Buscar categorias para o filtro primeiro
            const catRes = await supabase.from('categorias_equipamento').select('*').order('nome');
            if (catRes.data) setCategoriasLista(catRes.data);

            const { data, error } = await supabase
                .from('equipamentos')
                .select(`
          *,
          categorias_equipamento(nome)
        `)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code !== '42P01') toast.error('Erro ao buscar equipamentos');
                return;
            }

            setEquipamentos(data || []);
        } catch {
            toast.error('Erro de conexão ao buscar equipamentos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDados();

        const channel = supabase
            .channel('public:equipamentos_list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipamentos' }, () => {
                fetchDados();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, []);

    // Interceptar requisição de Edição Vinda do Módulo Patrimônio
    useEffect(() => {
        if (location.state?.openEditFormId && equipamentos.length > 0) {
            const eqpToEdit = equipamentos.find(e => e.id === location.state.openEditFormId);
            if (eqpToEdit) {
                setEquipamentoEditando(eqpToEdit);
                setIsEquipamentoModalOpen(true);
                // Limpar o state para não reabrir infinito caso a página sofra um refresh nativo depois
                navigate('.', { replace: true, state: {} });
            }
        }
    }, [location.state, equipamentos, navigate]);

    const handleEditar = (equipamento: Equipamento) => {
        setEquipamentoEditando(equipamento);
        setIsEquipamentoModalOpen(true);
    };

    const handleModificarStatus = (eqp: Equipamento) => {
        setEquipamentoStatusID(eqp.id);
        setEquipamentoStatusName(eqp.nome);
        setEquipamentoStatusAtual(eqp.status);
    };

    // Filtragem local
    const filtrados = equipamentos.filter(eqp => {
        const matchesSearch =
            eqp.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (eqp.codigo_patrimonio && eqp.codigo_patrimonio.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesStatus = statusFilter === 'todos' || eqp.status === statusFilter;
        const matchesCategoria = categoriaFilter === 'todas' || eqp.categoria_id === categoriaFilter;

        return matchesSearch && matchesStatus && matchesCategoria;
    });

    const getStatusLabel = (s: string) => {
        const labels: Record<string, string> = {
            disponivel: 'Disponível',
            alugado: 'Alugado',
            manutencao: 'Manutenção',
            baixado: 'Baixado'
        };
        return labels[s] || s;
    };

    return (
        <div className="module-container">

            {/* Tabs Navigation */}
            <div className="tabs-container" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', paddingBottom: '0' }}>
                <button
                    className={`tab-btn ${activeTab === 'equipamentos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('equipamentos')}
                    style={{ background: 'none', border: 'none', padding: '12px 0', fontSize: '15px', fontWeight: activeTab === 'equipamentos' ? 600 : 500, color: activeTab === 'equipamentos' ? 'var(--text-main)' : 'var(--text-secondary)', borderBottom: activeTab === 'equipamentos' ? '2px solid var(--primary-red)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    Listagem de Equipamentos
                </button>
                <button
                    className={`tab-btn ${activeTab === 'solicitacoes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('solicitacoes')}
                    style={{ background: 'none', border: 'none', padding: '12px 0', fontSize: '15px', fontWeight: activeTab === 'solicitacoes' ? 600 : 500, color: activeTab === 'solicitacoes' ? 'var(--text-main)' : 'var(--text-secondary)', borderBottom: activeTab === 'solicitacoes' ? '2px solid var(--primary-red)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    Solicitações Externas (QR)
                </button>
            </div>

            {activeTab === 'equipamentos' ? (
                <>
                    <div className="module-header flex-wrap">
                        <div className="search-filters">
                            <div className="search-box">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nome ou código..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="filter-group">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="select-filter"
                                >
                                    <option value="todos">Todos</option>
                                    <option value="disponivel">Disponíveis</option>
                                    <option value="alugado">Alugados</option>
                                    <option value="manutencao">Manutenção</option>
                                    <option value="baixado">Baixados</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                                <select
                                    value={categoriaFilter}
                                    onChange={(e) => setCategoriaFilter(e.target.value)}
                                    className="select-filter"
                                    style={{ flex: 1, minWidth: '150px' }}
                                >
                                    <option value="todas">Todas as Categorias</option>
                                    {categoriasLista.map(c => (
                                        <option key={c.id} value={c.id}>{c.nome}</option>
                                    ))}
                                </select>

                                <button
                                    className="btn-icon"
                                    title="Gerenciar Categorias"
                                    onClick={() => setIsCategoriaModalOpen(true)}
                                    style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                                >
                                    <Settings size={20} />
                                </button>

                                <button
                                    className="btn-secondary"
                                    onClick={() => setIsImportModalOpen(true)}
                                    style={{ flex: 1, minWidth: '120px', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}
                                    title="Importar planilhas"
                                >
                                    <Download size={20} /> Importar
                                </button>

                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        setEquipamentoEditando(null);
                                        setIsEquipamentoModalOpen(true);
                                    }}
                                    style={{ flex: 1, minWidth: '150px', justifyContent: 'center' }}
                                >
                                    <Plus size={20} /> Novo Equipamento
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="table-container">
                        {loading ? (
                            <div className="loading-state">Carregando dados...</div>
                        ) : filtrados.length === 0 ? (
                            <div className="empty-state">
                                Nenhum equipamento encontrado.
                            </div>
                        ) : (
                            <>
                                <div className="table-wrapper desktop-table-wrapper">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Código</th>
                                                <th>Nome e Detalhes</th>
                                                <th>Categoria</th>
                                                <th>Status</th>
                                                <th>Valor Aquis.</th>
                                                <th className="action-column">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtrados.map((eqp) => (
                                                <tr key={eqp.id} className={eqp.status === 'baixado' ? 'row-baixado' : ''}>
                                                    <td>{eqp.codigo_patrimonio || '-'}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            {eqp.foto_url ? (
                                                                <div
                                                                    className="eqp-thumbnail"
                                                                    style={{ cursor: 'pointer' }}
                                                                    onClick={() => setZoomedImage(eqp.foto_url)}
                                                                    title="Ampliar Foto"
                                                                >
                                                                    <img src={eqp.foto_url} alt="foto" />
                                                                </div>
                                                            ) : (
                                                                <div className="eqp-thumbnail empty"></div>
                                                            )}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '300px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span className="fw-600">{eqp.nome}</span>
                                                                    {eqp.tag && (
                                                                        <span style={{ backgroundColor: 'var(--primary-red)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                                                            {eqp.tag}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {eqp.descricao && (
                                                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {eqp.descricao}
                                                                    </span>
                                                                )}
                                                                {eqp.observacoes && (
                                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        Obs: {eqp.observacoes}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{eqp.categorias_equipamento?.nome || '-'}</td>
                                                    <td>
                                                        <span className={`status-badge badge-${eqp.status}`}>
                                                            {getStatusLabel(eqp.status)}
                                                        </span>
                                                    </td>
                                                    <td>{eqp.valor_aquisicao ? formatCurrency((eqp.valor_aquisicao * 100).toString()) : '-'}</td>
                                                    <td className="action-column">
                                                        <button className="btn-icon" title="Exibir QR Code" onClick={() => setQrModalData({ id: eqp.id, nome: eqp.nome, codigoPatrimonio: eqp.codigo_patrimonio, token: eqp.qr_token || eqp.id })}>
                                                            <QrCode size={16} />
                                                        </button>
                                                        <button className="btn-icon text-primary" title="Editar" onClick={() => handleEditar(eqp)}>
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            className="btn-icon"
                                                            title="Alterar Status"
                                                            onClick={() => handleModificarStatus(eqp)}
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mobile-card-list">
                                    {filtrados.map((eqp) => (
                                        <div key={eqp.id} className="mobile-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <h3>{eqp.nome}</h3>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>#{eqp.codigo_patrimonio}</span>
                                            </div>
                                            <p>Categoria: {eqp.categorias_equipamento?.nome || '-'}</p>
                                            <p>Tag: {eqp.tag || '-'}</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                                    {eqp.valor_aquisicao ? formatCurrency((eqp.valor_aquisicao * 100).toString()) : 'R$ 0,00'}
                                                </span>
                                                <span className={`status-badge ${eqp.status}`}>
                                                    {eqp.status === 'alugado' ? 'ALUGADO' :
                                                        eqp.status === 'manutencao' ? 'EM MANUTENÇÃO' :
                                                            eqp.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="mobile-card-footer" style={{ paddingTop: '8px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ações do Equipamento</span>
                                                <div className="mobile-card-actions">
                                                    <button className="btn-icon" title="Exibir QR Code" onClick={() => setQrModalData({ id: eqp.id, nome: eqp.nome, codigoPatrimonio: eqp.codigo_patrimonio, token: eqp.qr_token || eqp.id })}>
                                                        <QrCode size={16} />
                                                    </button>
                                                    <button className="btn-icon text-primary" title="Editar" onClick={() => handleEditar(eqp)}>
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button className="btn-icon" title="Alterar Status" onClick={() => handleModificarStatus(eqp)}>
                                                        <RotateCcw size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </>
            ) : (
                <SolicitacoesQR />
            )}

            {isEquipamentoModalOpen && (
                <EquipamentoForm
                    equipamentoEdicao={equipamentoEditando}
                    onClose={() => {
                        setIsEquipamentoModalOpen(false);
                        setEquipamentoEditando(null);
                    }}
                    onSuccess={() => {
                        setIsEquipamentoModalOpen(false);
                        setEquipamentoEditando(null);
                        fetchDados();
                    }}
                />
            )}

            {isCategoriaModalOpen && (
                <CategoriasModal
                    onClose={() => {
                        setIsCategoriaModalOpen(false);
                        fetchDados(); // Atualiza a combobox p/ refletir caso tenham modificado
                    }}
                />
            )}

            {equipamentoStatusID && (
                <EquipamentoStatusModal
                    equipamentoId={equipamentoStatusID}
                    equipamentoNome={equipamentoStatusName}
                    statusAtual={equipamentoStatusAtual}
                    onClose={() => setEquipamentoStatusID(null)}
                    onSuccess={() => {
                        setEquipamentoStatusID(null);
                        fetchDados();
                    }}
                />
            )}

            {zoomedImage && (
                <div
                    className="modal-overlay"
                    onClick={() => setZoomedImage(null)}
                    style={{ zIndex: 9999 }}
                >
                    <div
                        style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setZoomedImage(null)}
                            style={{ position: 'absolute', top: '-40px', right: '0', background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                            <X size={28} />
                        </button>
                        <img
                            src={zoomedImage}
                            alt="Zoomed"
                            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                        />
                    </div>
                </div>
            )}

            {isImportModalOpen && (
                <ImportacaoEquipamentosModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    onSuccess={() => {
                        setIsImportModalOpen(false);
                        fetchDados();
                    }}
                />
            )}

            {qrModalData && (
                <QRCodeModal
                    equipamentoNome={qrModalData.nome}
                    codigoPatrimonio={qrModalData.codigoPatrimonio}
                    qrToken={qrModalData.token}
                    onClose={() => setQrModalData(null)}
                />
            )}

        </div>
    );
}
