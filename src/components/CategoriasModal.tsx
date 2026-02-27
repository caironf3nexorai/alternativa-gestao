import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal } from './ConfirmModal';
import './CategoriasModal.css';

interface Categoria {
    id: string;
    nome: string;
}

interface CategoriasModalProps {
    onClose: () => void;
}

export function CategoriasModal({ onClose }: CategoriasModalProps) {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [novaCategoria, setNovaCategoria] = useState('');
    const [adicionando, setAdicionando] = useState(false);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [categoriaParaDeletar, setCategoriaParaDeletar] = useState<{ id: string, nome: string } | null>(null);
    const [deletando, setDeletando] = useState(false);

    useEffect(() => {
        fetchCategorias();
    }, []);

    const fetchCategorias = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('categorias_equipamento')
                .select('*')
                .order('nome');

            if (error) {
                if (error.code !== '42P01') {
                    toast.error('Erro ao buscar categorias.');
                }
                return;
            }
            setCategorias(data || []);
        } catch {
            toast.error('Ocorreu um erro na conexão.');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!novaCategoria.trim()) return;

        try {
            setAdicionando(true);
            const { data, error } = await supabase
                .from('categorias_equipamento')
                .insert([{ nome: novaCategoria.trim() }])
                .select();

            if (error) throw error;

            toast.success('Categoria criada!');
            setNovaCategoria('');
            if (data) {
                setCategorias([...categorias, data[0]].sort((a, b) => a.nome.localeCompare(b.nome)));
            } else {
                fetchCategorias();
            }
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao adicionar categoria.');
        } finally {
            setAdicionando(false);
        }
    };

    const handleDeleteRequest = (id: string, nome: string) => {
        setCategoriaParaDeletar({ id, nome });
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!categoriaParaDeletar) return;

        try {
            setDeletando(true);
            const { error } = await supabase
                .from('categorias_equipamento')
                .delete()
                .eq('id', categoriaParaDeletar.id);

            if (error) {
                // FK Violation
                if (error.code === '23503') {
                    toast.error('Não é possível excluir esta categoria pois existem equipamentos vinculados a ela.');
                } else {
                    throw error;
                }
                return;
            }

            toast.success('Categoria excluída com sucesso.');
            setCategorias(categorias.filter(c => c.id !== categoriaParaDeletar.id));
            setDeleteModalOpen(false);
            setCategoriaParaDeletar(null);
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao excluir categoria.');
        } finally {
            setDeletando(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content modal-categorias">
                <div className="modal-header">
                    <h2>Gerenciar Categorias</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="categorias-body">
                    <form className="add-categoria-form" onSubmit={handleAdd}>
                        <input
                            type="text"
                            placeholder="Nova Categoria..."
                            value={novaCategoria}
                            onChange={(e) => setNovaCategoria(e.target.value)}
                            disabled={loading || adicionando}
                        />
                        <button type="submit" className="btn-primary" disabled={loading || adicionando || !novaCategoria.trim()}>
                            <Plus size={16} /> Adicionar
                        </button>
                    </form>

                    <div className="categorias-list">
                        {loading ? (
                            <div className="categorias-mensagens">Carregando categorias...</div>
                        ) : categorias.length === 0 ? (
                            <div className="categorias-mensagens">Nenhuma categoria cadastrada.</div>
                        ) : (
                            <ul>
                                {categorias.map(cat => (
                                    <li key={cat.id}>
                                        <span>{cat.nome}</span>
                                        <button
                                            type="button"
                                            className="btn-icon btn-delete"
                                            onClick={() => handleDeleteRequest(cat.id, cat.nome)}
                                            title="Excluir Categoria"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={deleteModalOpen}
                title="Excluir Categoria"
                description={<>Tem certeza que deseja excluir a categoria <strong>{categoriaParaDeletar?.nome}</strong>?</>}
                onConfirm={confirmDelete}
                onCancel={() => {
                    setDeleteModalOpen(false);
                    setCategoriaParaDeletar(null);
                }}
                isLoading={deletando}
            />
        </div>
    );
}
