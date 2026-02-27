import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, Edit2, DollarSign, Package, CheckCircle, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../lib/currencyUtils';
import './Patrimonio.css';

interface Equipamento {
    id: string;
    nome: string;
    codigo_patrimonio: string;
    status: 'disponivel' | 'alugado' | 'manutencao' | 'baixado';
    valor_aquisicao: number | null;
    data_aquisicao: string | null;
    categorias_equipamento?: any; // Join relation
}

export function Patrimonio() {
    const navigate = useNavigate();
    const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
    const [categoriasLista, setCategoriasLista] = useState<{ id: string, nome: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('todos_ativos'); // default "todos os ativos"
    const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');

    const fetchDados = async () => {
        try {
            setLoading(true);

            const catRes = await supabase.from('categorias_equipamento').select('*').order('nome');
            if (catRes.data) setCategoriasLista(catRes.data);

            const { data, error } = await supabase
                .from('equipamentos')
                .select(`
          id,
          nome,
          codigo_patrimonio,
          status,
          valor_aquisicao,
          data_aquisicao,
          categorias_equipamento(nome)
        `)
                .order('nome');

            if (error) {
                if (error.code !== '42P01') toast.error('Erro ao buscar dados do patrimônio');
                return;
            }

            setEquipamentos(data || []);
        } catch {
            toast.error('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDados();

        const channel = supabase
            .channel('public:equipamentos_patrimonio')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipamentos' }, () => {
                fetchDados();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, []);

    // Lógica de filtragem
    const filtrados = useMemo(() => {
        return equipamentos.filter(eqp => {
            // Regra 1: Filtro de Busca Textual
            const matchesSearch =
                eqp.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (eqp.codigo_patrimonio && eqp.codigo_patrimonio.toLowerCase().includes(searchQuery.toLowerCase()));

            // Regra 2: Filtro de Status E tratamento especial do "Todos os Ativos"
            let matchesStatus = false;
            if (statusFilter === 'todos_ativos') {
                matchesStatus = eqp.status !== 'baixado';
            } else if (statusFilter === 'em_operacao') {
                matchesStatus = eqp.status === 'alugado' || eqp.status === 'manutencao';
            } else {
                matchesStatus = eqp.status === statusFilter;
            }

            // Regra 3: Filtro de Categoria
            const matchesCategoria = categoriaFilter === 'todas' ||
                // gambiarra para match com category. Não trouxemos o categoria_id pra não sobrecarregar
                // mas podemos filtrar pelo text se tivéssemos armazenado. 
                // Idealmente teríamos categoria_id na query. Vamos assumir que a app busca com ou sem.
                eqp.categorias_equipamento?.nome === categoriasLista.find(c => c.id === categoriaFilter)?.nome;

            return matchesSearch && matchesStatus && matchesCategoria;
        });
    }, [equipamentos, searchQuery, statusFilter, categoriaFilter, categoriasLista]);

    // Estatísticas Dinâmicas Baseadas nos Filtros
    const stats = useMemo(() => {
        let patrimonioTotal = 0;
        let qtdAtivos = 0;
        let qtdDisponiveis = 0;
        let qtdOperacao = 0; // Alugado + Manutenção

        // Calculamos as estatísticas SOMENTE sobre os itens filtrados, OU sobre a base inteira?
        // A especificação diz "Os cards do topo atualizam automaticamente conforme os filtros".
        filtrados.forEach(eqp => {
            // Só somamos patrimônio total de não-baixados (o filtro de todos_ativos já esconde eles, 
            // mas se statusFilter = 'baixado', o array terá baixados. A spec diz 'sem listar baixados' no Patrimônio Total Ativo)
            if (eqp.status !== 'baixado') {
                if (eqp.valor_aquisicao) patrimonioTotal += eqp.valor_aquisicao;
                qtdAtivos++;
            }

            if (eqp.status === 'disponivel') qtdDisponiveis++;
            if (eqp.status === 'alugado' || eqp.status === 'manutencao') qtdOperacao++;
        });

        return { patrimonioTotal, qtdAtivos, qtdDisponiveis, qtdOperacao };
    }, [filtrados]);

    // Cálculos de Totalizador do Rodapé
    const footerTotalValor = filtrados.reduce((acc, eqp) => acc + (eqp.valor_aquisicao || 0), 0);
    const footerTotalItens = filtrados.length;

    const handleEditar = (id: string) => {
        // Redireciona para Equipamentos mandando de presente o "openEditModal" nas engrenagens (location.state)
        navigate('/equipamentos', { state: { openEditFormId: id } });
    };

    const getStatusLabel = (s: string) => {
        switch (s) {
            case 'disponivel': return 'Disponível';
            case 'alugado': return 'Alugado';
            case 'manutencao': return 'Manutenção';
            case 'baixado': return 'Baixado';
            default: return s;
        }
    };

    const formataData = (dataStr: string | null) => {
        if (!dataStr) return '-';
        // O html input type date usa YYYY-MM-DD
        const partes = dataStr.split('-');
        if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return dataStr;
    };

    return (
        <div className="module-container">
            {/* SEÇÃO 1: CARDS */}
            <div className="patrimonio-cards">
                <div
                    className={`stat-card stat-primary ${statusFilter === 'todos_ativos' ? 'active-filter' : ''}`}
                    onClick={() => setStatusFilter('todos_ativos')}
                >
                    <div className="stat-icon-wrap bg-primary-light">
                        <DollarSign size={24} color="var(--primary-red)" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Patrimônio Ativo</span>
                        <span className="stat-value">{formatCurrency((stats.patrimonioTotal * 100).toString())}</span>
                    </div>
                </div>

                <div
                    className={`stat-card ${statusFilter === 'todos_ativos' ? 'active-filter' : ''}`}
                    onClick={() => setStatusFilter('todos_ativos')}
                >
                    <div className="stat-icon-wrap" style={{ backgroundColor: 'rgba(240, 240, 240, 0.1)' }}>
                        <Package size={24} color="var(--text-main)" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Total de Equip.</span>
                        <span className="stat-value">{stats.qtdAtivos}</span>
                    </div>
                </div>

                <div
                    className={`stat-card stat-success ${statusFilter === 'disponivel' ? 'active-filter' : ''}`}
                    onClick={() => setStatusFilter('disponivel')}
                >
                    <div className="stat-icon-wrap" style={{ backgroundColor: 'rgba(46, 204, 113, 0.15)' }}>
                        <CheckCircle size={24} color="var(--success)" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Disponíveis</span>
                        <span className="stat-value" style={{ color: 'var(--success)' }}>{stats.qtdDisponiveis}</span>
                    </div>
                </div>

                <div
                    className={`stat-card stat-info ${statusFilter === 'em_operacao' ? 'active-filter' : ''}`}
                    onClick={() => setStatusFilter('em_operacao')}
                >
                    <div className="stat-icon-wrap" style={{ backgroundColor: 'rgba(52, 152, 219, 0.15)' }}>
                        <Wrench size={24} color="#3498db" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Em Operação</span>
                        <span className="stat-value" style={{ color: '#3498db' }}>{stats.qtdOperacao}</span>
                    </div>
                </div>
            </div>

            {/* SEÇÃO 2: TABELA E FILTROS */}
            <div className="module-header flex-wrap" style={{ marginTop: '8px' }}>
                <div className="search-filters">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar equipamento..."
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
                            <option value="todos_ativos">Todos os Ativos</option>
                            <option value="disponivel">Disponível</option>
                            <option value="em_operacao">Em Operação</option>
                            <option value="alugado">Alugado</option>
                            <option value="manutencao">Manutenção</option>
                            <option value="baixado">Baixados (Ocultos)</option>
                        </select>
                    </div>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <select
                            value={categoriaFilter}
                            onChange={(e) => setCategoriaFilter(e.target.value)}
                            className="select-filter"
                        >
                            <option value="todas">Todas as Categorias</option>
                            {categoriasLista.map(c => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="table-container" style={{ position: 'relative', paddingBottom: '50px' }}>
                {loading ? (
                    <div className="loading-state">Calculando patrimônio...</div>
                ) : filtrados.length === 0 ? (
                    <div className="empty-state">
                        Nenhum equipamento listado neste filtro.
                    </div>
                ) : (
                    <>
                        <div className="table-wrapper desktop-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Equipamento</th>
                                        <th>Categoria</th>
                                        <th>Status</th>
                                        <th>Data Aquis.</th>
                                        <th style={{ textAlign: 'right' }}>Valor Aquis.</th>
                                        <th style={{ width: '60px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtrados.map((eqp) => (
                                        <tr key={eqp.id} className={eqp.status === 'baixado' ? 'row-baixado' : ''}>
                                            <td>{eqp.codigo_patrimonio || '-'}</td>
                                            <td className="fw-600">{eqp.nome}</td>
                                            <td>{eqp.categorias_equipamento?.nome || '-'}</td>
                                            <td>
                                                <span className={`status-badge badge-${eqp.status}`}>
                                                    {getStatusLabel(eqp.status)}
                                                </span>
                                            </td>
                                            <td>{formataData(eqp.data_aquisicao)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '500', color: eqp.status === 'baixado' ? 'inherit' : 'var(--text-main)' }}>
                                                {eqp.valor_aquisicao ? formatCurrency((eqp.valor_aquisicao * 100).toString()) : 'R$ 0,00'}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn-icon"
                                                    title="Editar Equipamento no seu módulo"
                                                    onClick={() => handleEditar(eqp.id)}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mobile-card-list">
                            {filtrados.map((eqp) => (
                                <div key={eqp.id} className="mobile-card" style={eqp.status === 'baixado' ? { opacity: 0.6 } : {}}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3>{eqp.nome}</h3>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            {eqp.codigo_patrimonio || '-'}
                                        </span>
                                    </div>
                                    <p>Categoria: {eqp.categorias_equipamento?.nome || '-'}</p>
                                    <p>Data Aquis.: {formataData(eqp.data_aquisicao)}</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                        <span style={{ color: eqp.status === 'baixado' ? 'inherit' : 'var(--text-main)', fontWeight: 600 }}>
                                            {eqp.valor_aquisicao ? formatCurrency((eqp.valor_aquisicao * 100).toString()) : 'R$ 0,00'}
                                        </span>
                                        <span className={`status-badge badge-${eqp.status}`}>
                                            {getStatusLabel(eqp.status)}
                                        </span>
                                    </div>
                                    <div className="mobile-card-footer" style={{ paddingTop: '8px', marginTop: '4px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Módulo Patrimônio</span>
                                        <div className="mobile-card-actions">
                                            <button className="btn-icon" title="Editar" onClick={() => handleEditar(eqp.id)}>
                                                <Edit2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* RODAPÉ TOTALIZADOR FLUTUANTE */}
                {!loading && filtrados.length > 0 && (
                    <div className="table-footer-totalizer">
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Monitorando <strong>{footerTotalItens}</strong> equipamentos
                        </span>
                        <div className="totalizer-amount">
                            <span>Subtotal dessa lista:</span>
                            <strong style={{ marginLeft: '12px', fontSize: '18px', color: 'var(--text-main)' }}>
                                {formatCurrency((footerTotalValor * 100).toString())}
                            </strong>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
