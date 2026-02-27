import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPhone, formatCnpj, isValidEmail } from '../lib/utils';
import './ClienteForm.css';

interface Cliente {
    id?: string;
    nome: string;
    cnpj: string;
    contato_nome: string;
    contato_telefone: string;
    contato_email: string;
    endereco: string;
    observacoes: string;
    ativo: boolean;
}

interface ClienteFormProps {
    clienteEdicao: Cliente | null;
    onClose: () => void;
    onSuccess: () => void;
}

const estadoInicial: Cliente = {
    nome: '',
    cnpj: '',
    contato_nome: '',
    contato_telefone: '',
    contato_email: '',
    endereco: '',
    observacoes: '',
    ativo: true
};

export function ClienteForm({ clienteEdicao, onClose, onSuccess }: ClienteFormProps) {
    const [formData, setFormData] = useState<Cliente>(estadoInicial);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (clienteEdicao) {
            setFormData(clienteEdicao);
        }
    }, [clienteEdicao]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        // Tratamento de checkboxes e switchs baseados em booleanos
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
            return;
        }

        // Tratamento de máscaras nos inputs específicos
        let finalValue = value;

        if (name === 'cnpj') {
            finalValue = formatCnpj(value);
        } else if (name === 'contato_telefone') {
            finalValue = formatPhone(value);
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nome.trim()) {
            toast.error('O nome da empresa é obrigatório.');
            return;
        }

        if (formData.contato_email && !isValidEmail(formData.contato_email)) {
            toast.error('Informe um formato de email válido.');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                nome: formData.nome,
                cnpj: formData.cnpj, // Poderia ser limpado aqui: formData.cnpj.replace(/\D/g, '')
                contato_nome: formData.contato_nome,
                contato_telefone: formData.contato_telefone,
                contato_email: formData.contato_email,
                endereco: formData.endereco,
                observacoes: formData.observacoes,
                ativo: formData.ativo
            };

            if (formData.id) {
                // Editando
                const { error } = await supabase
                    .from('clientes')
                    .update(payload)
                    .eq('id', formData.id);

                if (error) throw error;
                toast.success('Cliente atualizado com sucesso!');
            } else {
                // Criando Novo
                const { error } = await supabase
                    .from('clientes')
                    .insert([payload]);

                if (error) throw error;
                toast.success('Cliente cadastrado com sucesso!');
            }

            onSuccess();
        } catch (err: any) {
            console.error(err);
            toast.error(err?.message || 'Erro ao salvar os dados na tabela clientes.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>{formData.id ? 'Editar Cliente' : 'Novo Cliente'}</h2>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="form-container">
                    <div className="form-grid">

                        <div className="form-group span-2">
                            <label>Nome da Empresa *</label>
                            <input
                                type="text"
                                name="nome"
                                value={formData.nome}
                                onChange={handleChange}
                                placeholder="Razão Social ou Nome Fantasia"
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>CNPJ</label>
                            <input
                                type="text"
                                name="cnpj"
                                value={formData.cnpj}
                                onChange={handleChange}
                                placeholder="00.000.000/0000-00"
                                maxLength={18}
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group span-2">
                            <label>Endereço</label>
                            <input
                                type="text"
                                name="endereco"
                                value={formData.endereco}
                                onChange={handleChange}
                                placeholder="Logradouro, Número, Bairro, Cidade"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="form-section-title">Contato</div>

                    <div className="form-grid">
                        <div className="form-group span-2">
                            <label>Nome do Responsável/Contato</label>
                            <input
                                type="text"
                                name="contato_nome"
                                value={formData.contato_nome}
                                onChange={handleChange}
                                placeholder="Nome da pessoa focal"
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Telefone</label>
                            <input
                                type="text"
                                name="contato_telefone"
                                value={formData.contato_telefone}
                                onChange={handleChange}
                                placeholder="(00) 00000-0000"
                                maxLength={15}
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>E-mail</label>
                            <input
                                type="email"
                                name="contato_email"
                                value={formData.contato_email}
                                onChange={handleChange}
                                placeholder="email@empresa.com"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="form-group mt-16">
                        <label>Observações Internas</label>
                        <textarea
                            name="observacoes"
                            value={formData.observacoes}
                            onChange={handleChange}
                            placeholder="Condições especiais, horários de atendimento, etc."
                            rows={3}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-toggle-group">
                        <label className="toggle-label">
                            <input
                                type="checkbox"
                                name="ativo"
                                checked={formData.ativo}
                                onChange={handleChange}
                                disabled={loading}
                            />
                            <span className="toggle-text">Status: {formData.ativo ? 'Ativo' : 'Inativo'}</span>
                        </label>
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
    );
}
