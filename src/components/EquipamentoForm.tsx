import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Upload, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, parseCurrency } from '../lib/currencyUtils';
import { CategoriasModal } from './CategoriasModal';

interface Equipamento {
    id?: string;
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
}

interface EquipamentoFormProps {
    equipamentoEdicao: Equipamento | null;
    onClose: () => void;
    onSuccess: () => void;
}

const estadoInicial: Equipamento = {
    nome: '',
    descricao: '',
    categoria_id: null,
    codigo_patrimonio: '',
    status: 'disponivel',
    valor_aquisicao: null,
    data_aquisicao: '',
    foto_url: '',
    observacoes: '',
    tag: ''
};

export function EquipamentoForm({ equipamentoEdicao, onClose, onSuccess }: EquipamentoFormProps) {
    const [formData, setFormData] = useState<Equipamento>(estadoInicial);
    const [valorFormatado, setValorFormatado] = useState('');
    const [categorias, setCategorias] = useState<{ id: string, nome: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchCategorias();
    }, [isCategoriaModalOpen]); // Atualiza as categorias se o modal de criar conta fechar

    useEffect(() => {
        if (equipamentoEdicao) {
            setFormData(equipamentoEdicao);
            if (equipamentoEdicao.valor_aquisicao) {
                setValorFormatado(formatCurrency((equipamentoEdicao.valor_aquisicao * 100).toString()));
            }
        }
    }, [equipamentoEdicao]);

    const fetchCategorias = async () => {
        const { data } = await supabase.from('categorias_equipamento').select('*').order('nome');
        if (data) setCategorias(data);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatado = formatCurrency(e.target.value);
        setValorFormatado(formatado);
        setFormData(prev => ({ ...prev, valor_aquisicao: parseCurrency(formatado) }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limite para base64 razoável
            toast.error('A imagem deve ter no máximo 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, foto_url: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nome.trim()) {
            toast.error('O nome do equipamento é obrigatório.');
            return;
        }

        try {
            setLoading(true);

            // Remover a propriedade do join da interface original
            const { categorias_equipamento, ...formDataSpecs } = formData as any;

            const payload = {
                ...formDataSpecs,
                categoria_id: formData.categoria_id || null, // Garantir nulo caso vazio
                data_aquisicao: formData.data_aquisicao || null
            };

            if (formData.id) {
                const { error } = await supabase
                    .from('equipamentos')
                    .update(payload)
                    .eq('id', formData.id);

                if (error) throw error;
                toast.success('Equipamento atualizado com sucesso!');
            } else {
                const { error } = await supabase
                    .from('equipamentos')
                    .insert([payload]);

                if (error) throw error;
                toast.success('Equipamento cadastrado com sucesso!');
            }

            onSuccess();
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao salvar os dados do equipamento. Acesse o BD e garanta as tabelas.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-overlay">
                <div className="modal-content" style={{ maxWidth: '800px' }}>
                    <div className="modal-header">
                        <h2>{formData.id ? 'Editar Equipamento' : 'Novo Equipamento'}</h2>
                        <button className="btn-close" onClick={onClose} disabled={loading}>
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="form-container">
                        <div className="form-grid">

                            <div className="form-group span-2">
                                <label>Nome do Equipamento *</label>
                                <input
                                    type="text"
                                    name="nome"
                                    value={formData.nome}
                                    onChange={handleChange}
                                    placeholder="Furadeira de Impacto Bosch"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Código de Patrimônio</label>
                                <input
                                    type="text"
                                    name="codigo_patrimonio"
                                    value={formData.codigo_patrimonio}
                                    onChange={handleChange}
                                    placeholder="EQP-001"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>TAG</label>
                                <input
                                    type="text"
                                    name="tag"
                                    value={formData.tag || ''}
                                    onChange={handleChange}
                                    placeholder="Ex: TAG-1234"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    disabled={loading}
                                    style={{
                                        backgroundColor: 'var(--bg-surface)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-main)',
                                        borderRadius: '6px',
                                        padding: '10px 12px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        width: '100%'
                                    }}
                                >
                                    <option value="disponivel">Disponível</option>
                                    <option value="alugado">Alugado</option>
                                    <option value="manutencao">Manutenção</option>
                                    <option value="baixado">Baixado</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Categoria</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <select
                                        name="categoria_id"
                                        value={formData.categoria_id || ''}
                                        onChange={handleChange}
                                        disabled={loading}
                                        style={{
                                            flex: 1,
                                            backgroundColor: 'var(--bg-surface)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-main)',
                                            borderRadius: '6px',
                                            padding: '10px 12px',
                                            fontSize: '14px',
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="">Sem categoria</option>
                                        {categorias.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.nome}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ padding: '0 12px' }}
                                        onClick={() => setIsCategoriaModalOpen(true)}
                                        title="Nova Categoria"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Valor de Aquisição</label>
                                <input
                                    type="text"
                                    value={valorFormatado}
                                    onChange={handleValorChange}
                                    placeholder="R$ 0,00"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Data de Aquisição</label>
                                <input
                                    type="date"
                                    name="data_aquisicao"
                                    value={formData.data_aquisicao || ''}
                                    onChange={handleChange}
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group span-2">
                                <label>Descrição</label>
                                <input
                                    type="text"
                                    name="descricao"
                                    value={formData.descricao}
                                    onChange={handleChange}
                                    placeholder="Breve descrição do modelo, potência, marca"
                                    disabled={loading}
                                />
                            </div>

                        </div>

                        <div className="form-section-title">Foto e Detalhes</div>

                        <div className="form-grid">

                            <div className="form-group" style={{ gridColumn: '1 / 2' }}>
                                <label>Foto do Equipamento</label>
                                <div
                                    style={{
                                        border: '2px dashed var(--border-color)',
                                        borderRadius: '8px',
                                        height: '160px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {formData.foto_url ? (
                                        <>
                                            <img
                                                src={formData.foto_url}
                                                alt="Preview"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            <div
                                                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(231, 76, 60, 0.9)', color: 'white', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFormData(prev => ({ ...prev, foto_url: '' }));
                                                }}
                                                title="Remover Foto"
                                            >
                                                <X size={16} />
                                            </div>
                                            <div style={{ position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.6)', textAlign: 'center', fontSize: '12px', padding: '4px' }}>
                                                Clique para alterar
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
                                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Fazer Upload da Foto</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.6 }}>(Máx. 2MB)</span>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className="form-group" style={{ gridColumn: '2 / 3' }}>
                                <label>Observações</label>
                                <textarea
                                    name="observacoes"
                                    value={formData.observacoes}
                                    onChange={handleChange}
                                    placeholder="Condição visual, avarias, itens inclusos..."
                                    style={{ height: '160px', resize: 'none' }}
                                    disabled={loading}
                                />
                            </div>

                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Salvando...' : 'Salvar Dados'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {isCategoriaModalOpen && (
                <CategoriasModal onClose={() => setIsCategoriaModalOpen(false)} />
            )}
        </>
    );
}
