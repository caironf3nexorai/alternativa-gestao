import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit2, Power, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPhone, formatCnpj } from '../lib/utils';
import { ClienteForm } from '../components/ClienteForm';
import { ImportClientsModal } from '../components/ImportClientsModal';
import './Clientes.css';

interface Cliente {
    id: string;
    nome: string;
    cnpj: string;
    contato_nome: string;
    contato_telefone: string;
    contato_email: string;
    endereco: string;
    observacoes: string;
    ativo: boolean;
    created_at: string;
    contratos?: any[];
}

type FilterStatus = 'todos' | 'ativos' | 'inativos';

export function Clientes() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('todos');

    // Controle do Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const fetchClientes = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('clientes')
                .select('*, contratos(id, status)')
                .order('created_at', { ascending: false });

            if (error) {
                // Ignorar se a tabela não existe ainda (para testes visuais antes do DB pronto)
                if (error.code !== '42P01') {
                    toast.error('Erro ao buscar clientes');
                }
                return;
            }

            setClientes(data || []);
        } catch {
            toast.error('Erro de conexão ao buscar clientes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClientes();
    }, []);

    const handleToggleStatus = async (cliente: Cliente) => {
        try {
            const novoStatus = !cliente.ativo;
            const { error } = await supabase
                .from('clientes')
                .update({ ativo: novoStatus })
                .eq('id', cliente.id);

            if (error) throw error;

            // Update local state optimistic
            setClientes(clientes.map(c => c.id === cliente.id ? { ...c, ativo: novoStatus } : c));
            toast.success(`Cliente ${novoStatus ? 'ativado' : 'inativado'} com sucesso!`);
        } catch {
            toast.error('Erro ao alterar status do cliente');
        }
    };

    const handleNovo = () => {
        setClienteEditando(null);
        setIsModalOpen(true);
    };

    const handleEditar = (cliente: Cliente) => {
        setClienteEditando(cliente);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setClienteEditando(null);
    };

    const handleSuccessModal = () => {
        handleCloseModal();
        fetchClientes(); // Atualiza a lista após criar/editar
    };

    // Filtragem local
    const clientesFiltrados = clientes.filter(cliente => {
        const matchesSearch =
            cliente.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (cliente.cnpj && cliente.cnpj.includes(searchQuery));

        if (statusFilter === 'ativos') return matchesSearch && cliente.ativo;
        if (statusFilter === 'inativos') return matchesSearch && !cliente.ativo;
        return matchesSearch;
    });

    return (
        <div className="module-container">
            <div className="module-header">
                <div className="search-filters">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou CNPJ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="filter-group">
                        <button
                            className={`filter-btn ${statusFilter === 'todos' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('todos')}
                        >
                            Todos
                        </button>
                        <button
                            className={`filter-btn ${statusFilter === 'ativos' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('ativos')}
                        >
                            Ativos
                        </button>
                        <button
                            className={`filter-btn ${statusFilter === 'inativos' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('inativos')}
                        >
                            Inativos
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary" onClick={() => setIsImportModalOpen(true)}>
                        <Download size={18} />
                        Importar
                    </button>
                    <button className="btn-primary" onClick={handleNovo}>
                        <Plus size={18} />
                        Novo Cliente
                    </button>
                </div>
            </div>

            <div className="table-container">
                {loading ? (
                    <div className="loading-state">Carregando dados...</div>
                ) : clientesFiltrados.length === 0 ? (
                    <div className="empty-state">
                        Nenhum cliente encontrado.
                    </div>
                ) : (
                    <>
                        <div className="table-wrapper desktop-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>CNPJ</th>
                                        <th>Contato</th>
                                        <th>Telefone</th>
                                        <th>Status</th>
                                        <th className="action-column">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientesFiltrados.map((cliente) => (
                                        <tr key={cliente.id} className={!cliente.ativo ? 'row-inactive' : ''}>
                                            <td className="fw-600">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {cliente.nome}
                                                    {cliente.contratos && cliente.contratos.filter((c: any) => c.status === 'ativo').length > 0 && (
                                                        <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--primary-red)', padding: '2px 6px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                                            {cliente.contratos.filter((c: any) => c.status === 'ativo').length} Contrato(s)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{cliente.cnpj ? formatCnpj(cliente.cnpj) : '-'}</td>
                                            <td>{cliente.contato_nome || '-'}</td>
                                            <td>{cliente.contato_telefone ? formatPhone(cliente.contato_telefone) : '-'}</td>
                                            <td>
                                                <span className={`status-badge ${cliente.ativo ? 'badge-active' : 'badge-inactive'}`}>
                                                    {cliente.ativo ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td className="action-column">
                                                <button className="btn-icon" title="Editar" onClick={() => handleEditar(cliente)}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className={`btn-icon ${cliente.ativo ? 'text-error' : 'text-success'}`}
                                                    title={cliente.ativo ? "Inativar" : "Ativar"}
                                                    onClick={() => handleToggleStatus(cliente)}
                                                >
                                                    <Power size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mobile-card-list">
                            {clientesFiltrados.map((cliente) => (
                                <div key={cliente.id} className="mobile-card">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <h3 style={{ margin: 0 }}>{cliente.nome}</h3>
                                        {cliente.contratos && cliente.contratos.filter((c: any) => c.status === 'ativo').length > 0 && (
                                            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--primary-red)', padding: '2px 6px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                                {cliente.contratos.filter((c: any) => c.status === 'ativo').length} Contrato(s)
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ marginTop: '4px' }}>{cliente.cnpj ? formatCnpj(cliente.cnpj) : '-'}</p>
                                    <p>Contato: {cliente.contato_nome || '-'}</p>
                                    <p>Tel: {cliente.contato_telefone ? formatPhone(cliente.contato_telefone) : '-'}</p>
                                    <div className="mobile-card-footer">
                                        <span className={`status-badge ${cliente.ativo ? 'badge-active' : 'badge-inactive'}`}>
                                            {cliente.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                        <div className="mobile-card-actions">
                                            <button className="btn-icon" title="Editar" onClick={() => handleEditar(cliente)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className={`btn-icon ${cliente.ativo ? 'text-error' : 'text-success'}`}
                                                title={cliente.ativo ? "Inativar" : "Ativar"}
                                                onClick={() => handleToggleStatus(cliente)}
                                            >
                                                <Power size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>                {isModalOpen && (
                    <ClienteForm
                        clienteEdicao={clienteEditando}
                        onClose={handleCloseModal}
                        onSuccess={handleSuccessModal}
                    />
                )}

                {isImportModalOpen && (
                    <ImportClientsModal
                        onClose={() => setIsImportModalOpen(false)}
                        onSuccess={() => { setIsImportModalOpen(false); fetchClientes(); }}
                    />
                )}
        </div>
    );
}
