import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, CheckCircle2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

interface ContratoFormProps {
    contratoEdicao?: any;
    onClose: () => void;
    onSuccess: () => void;
}

export function ContratoForm({ contratoEdicao, onClose, onSuccess }: ContratoFormProps) {
    const isEdit = !!contratoEdicao;
    const [loading, setLoading] = useState(false);
    
    // Dados Section 1
    const [numeroContrato, setNumeroContrato] = useState('');
    const [clienteId, setClienteId] = useState('');
    const [status, setStatus] = useState('ativo');
    const [dataInicio, setDataInicio] = useState('');
    const [dataEncerramento, setDataEncerramento] = useState('');
    const [valorMensal, setValorMensal] = useState('');
    const [valorTotal, setValorTotal] = useState('');
    const [observacoes, setObservacoes] = useState('');

    // Dados auxiliares para dropdowns
    const [clientes, setClientes] = useState<any[]>([]);
    const [equipamentosDisponiveis, setEquipamentosDisponiveis] = useState<any[]>([]);

    // Dados Section 2 (Equipamentos em memoria pro form)
    const [equipamentosSelecionados, setEquipamentosSelecionados] = useState<any[]>([]);
    const [equipamentoToAdd, setEquipamentoToAdd] = useState('');
    const [valorUnitarioEquip, setValorUnitarioEquip] = useState('');
    const [dataRetornoPrevistaEquip, setDataRetornoPrevistaEquip] = useState('');

    // Dados Section 3 (Documentos em memoria pro form)
    const presetDocs = ['ART', 'Ordem de Serviço', 'Nota Fiscal', 'Contrato Assinado'];
    const [documentos, setDocumentos] = useState<any[]>([]);
    const [docNome, setDocNome] = useState('');
    const [docDescricao, setDocDescricao] = useState('');

    const carregarDependencias = async () => {
        try {
            const [cliRes, equipRes] = await Promise.all([
                supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
                supabase.from('equipamentos').select('id, nome, codigo_patrimonio').eq('status', 'disponivel').order('nome')
            ]);
            
            if (cliRes.data) setClientes(cliRes.data);
            if (equipRes.data) setEquipamentosDisponiveis(equipRes.data);
            
            if (isEdit) {
                setNumeroContrato(contratoEdicao.numero_contrato || '');
                setClienteId(contratoEdicao.cliente_id || '');
                setStatus(contratoEdicao.status || 'ativo');
                setDataInicio(contratoEdicao.data_inicio || '');
                setDataEncerramento(contratoEdicao.data_prevista_encerramento || '');
                setValorMensal(contratoEdicao.valor_mensal ? contratoEdicao.valor_mensal.toString() : '');
                setValorTotal(contratoEdicao.valor_total ? contratoEdicao.valor_total.toString() : '');
                setObservacoes(contratoEdicao.observacoes || '');

                const [eqRes, docRes] = await Promise.all([
                    supabase.from('contrato_equipamentos').select('*, equipamento:equipamentos(nome, codigo_patrimonio)').eq('contrato_id', contratoEdicao.id),
                    supabase.from('contrato_documentos').select('*').eq('contrato_id', contratoEdicao.id)
                ]);

                if (eqRes.data) {
                    setEquipamentosSelecionados(eqRes.data.map((e: any) => ({
                        equipamento_id: e.equipamento_id,
                        nome: e.equipamento?.nome,
                        codigo: e.equipamento?.codigo_patrimonio,
                        valor_unitario: e.valor_unitario || 0,
                        data_retorno_prevista: e.data_retorno_prevista || null
                    })));
                }

                if (docRes.data) {
                    setDocumentos(docRes.data.map((d: any) => ({
                        nome: d.nome,
                        descricao: d.descricao,
                        concluido: d.concluido,
                        arquivo_url: d.arquivo_url
                    })));
                }
            }
        } catch {
            toast.error('Erro ao carregar dados auxiliares');
        }
    };

    useEffect(() => {
        carregarDependencias();
        // eslint-disable-next-line
    }, []);

    // Metodos Equipamentos
    const handleAddEquipamento = () => {
        if (!equipamentoToAdd) return;
        const equip = equipamentosDisponiveis.find(e => e.id === equipamentoToAdd);
        if (!equip) return;
        
        setEquipamentosSelecionados([...equipamentosSelecionados, {
            equipamento_id: equip.id,
            nome: equip.nome,
            codigo: equip.codigo_patrimonio,
            valor_unitario: valorUnitarioEquip ? parseFloat(valorUnitarioEquip) : 0,
            data_retorno_prevista: dataRetornoPrevistaEquip || null
        }]);

        // Retira do dropdown para nao adicionar duplo
        setEquipamentosDisponiveis(equipamentosDisponiveis.filter(e => e.id !== equipamentoToAdd));
        setEquipamentoToAdd('');
        setValorUnitarioEquip('');
        setDataRetornoPrevistaEquip('');
    };

    const handleRemoveEquipamento = (id: string, equipName: string, equipCode: string) => {
        setEquipamentosSelecionados(equipamentosSelecionados.filter(e => e.equipamento_id !== id));
        // Devolve pro dropdown
        setEquipamentosDisponiveis([...equipamentosDisponiveis, { id, nome: equipName, codigo_patrimonio: equipCode }]);
    };

    // Metodos Docs
    const handleAddDocumento = (nome: string, descricao: string = '') => {
        if (!nome.trim()) return;
        setDocumentos([...documentos, {
            nome,
            descricao,
            concluido: false
        }]);
        setDocNome('');
        setDocDescricao('');
    };

    const handleRemoveDocumento = (index: number) => {
        setDocumentos(documentos.filter((_, i) => i !== index));
    };

    const handleDocFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limite para base64 razoável
            toast.error('O arquivo deve ter no máximo 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setDocumentos(prev => {
                const newDocs = [...prev];
                newDocs[index].arquivo_url = reader.result as string;
                return newDocs;
            });
        };
        reader.readAsDataURL(file);
    };

    const removeDocAttachment = (index: number) => {
        setDocumentos(prev => {
            const newDocs = [...prev];
            delete newDocs[index].arquivo_url;
            return newDocs;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);

            // Inicia payload principal
            const contratoPayload = {
                numero_contrato: numeroContrato || null,
                cliente_id: clienteId,
                status,
                data_inicio: dataInicio,
                data_prevista_encerramento: dataEncerramento || null,
                valor_mensal: valorMensal ? parseFloat(valorMensal) : null,
                valor_total: valorTotal ? parseFloat(valorTotal) : null,
                observacoes
            };

            let contratoId = '';

            if (isEdit) {
                const { error: errUpd } = await supabase
                    .from('contratos')
                    .update(contratoPayload)
                    .eq('id', contratoEdicao.id);
                if (errUpd) throw errUpd;
                contratoId = contratoEdicao.id;

                const { data: oldEqs } = await supabase.from('contrato_equipamentos').select('equipamento_id').eq('contrato_id', contratoId);
                if (oldEqs && oldEqs.length > 0) {
                    const oldIds = oldEqs.map(e => e.equipamento_id);
                    await supabase.from('equipamentos').update({ status: 'disponivel' }).in('id', oldIds);
                }

                await supabase.from('contrato_equipamentos').delete().eq('contrato_id', contratoId);
                await supabase.from('contrato_documentos').delete().eq('contrato_id', contratoId);
            } else {
                const { data: contData, error: contErr } = await supabase
                    .from('contratos')
                    .insert(contratoPayload)
                    .select()
                    .single();
                if (contErr) throw contErr;
                contratoId = contData.id;
            }

            if (equipamentosSelecionados.length > 0) {
                const eqPayload = equipamentosSelecionados.map(eq => ({
                    contrato_id: contratoId,
                    equipamento_id: eq.equipamento_id,
                    data_saida: dataInicio,
                    data_retorno_prevista: eq.data_retorno_prevista,
                    valor_unitario: eq.valor_unitario
                }));
                await supabase.from('contrato_equipamentos').insert(eqPayload);

                const eqIds = equipamentosSelecionados.map(e => e.equipamento_id);
                await supabase.from('equipamentos').update({ status: 'alugado' }).in('id', eqIds);
            }

            if (documentos.length > 0) {
                const docPayload = documentos.map(d => ({
                    contrato_id: contratoId,
                    nome: d.nome,
                    descricao: d.descricao,
                    concluido: d.concluido,
                    arquivo_url: d.arquivo_url || null
                }));
                await supabase.from('contrato_documentos').insert(docPayload);
            }

            toast.success('Contrato salvo com sucesso!');
            onSuccess();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Erro ao salvar contrato');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header">
                    <h2>{isEdit ? 'Editar Contrato' : 'Novo Contrato'}</h2>
                    <button className="btn-close" onClick={onClose} disabled={loading}><X size={20} /></button>
                </div>

                <form className="form-container" onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                        <h3 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>1. Dados do Contrato</h3>
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Número do Contrato</label>
                                <input type="text" value={numeroContrato} onChange={e => setNumeroContrato(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ flex: 2 }}>
                                <label>Cliente *</label>
                                <select value={clienteId} onChange={e => setClienteId(e.target.value)} required>
                                    <option value="">Selecione um cliente...</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id}>{c.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Data de Início *</label>
                                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Prev. Encerramento</label>
                                <input type="date" value={dataEncerramento} onChange={e => setDataEncerramento(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select value={status} onChange={e => setStatus(e.target.value)}>
                                    <option value="ativo">Ativo</option>
                                    <option value="em_negociacao">Em Negociação</option>
                                    <option value="suspenso">Suspenso</option>
                                    <option value="encerrado">Encerrado</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Valor Mensal (R$)</label>
                                <input type="number" step="0.01" value={valorMensal} onChange={e => setValorMensal(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Valor Total (R$)</label>
                                <input type="number" step="0.01" value={valorTotal} onChange={e => setValorTotal(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Observações</label>
                            <textarea rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                        <h3 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>2. Equipamentos Vinculados</h3>
                        
                        <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '16px' }}>
                            <div className="form-row" style={{ alignItems: 'flex-end' }}>
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Equipamento Disponível</label>
                                    <select value={equipamentoToAdd} onChange={e => setEquipamentoToAdd(e.target.value)}>
                                        <option value="">Selecionar...</option>
                                        {equipamentosDisponiveis.map(e => (
                                            <option key={e.id} value={e.id}>{e.nome} ({e.codigo_patrimonio})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>V/Unitário Locação</label>
                                    <input type="number" placeholder="Opcional" value={valorUnitarioEquip} onChange={e => setValorUnitarioEquip(e.target.value)} />
                                </div>
                                <button type="button" className="btn-secondary" onClick={handleAddEquipamento} style={{ height: '42px' }}>
                                    <Plus size={16} /> Adicionar
                                </button>
                            </div>
                        </div>

                        {equipamentosSelecionados.length > 0 && (
                            <table className="data-table" style={{ fontSize: '14px' }}>
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Código</th>
                                        <th>Unitário/Mês</th>
                                        <th>Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipamentosSelecionados.map((eq, i) => (
                                        <tr key={i}>
                                            <td>{eq.nome}</td>
                                            <td>{eq.codigo}</td>
                                            <td>{eq.valor_unitario ? `R$ ${eq.valor_unitario}` : '-'}</td>
                                            <td>
                                                <button type="button" className="btn-icon text-error" onClick={() => handleRemoveEquipamento(eq.equipamento_id, eq.nome, eq.codigo)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>3. Checklist de Documentos</h3>
                        
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            {presetDocs.map(doc => (
                                <button key={doc} type="button" className="btn-secondary" style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '13px' }}
                                    onClick={() => handleAddDocumento(doc)}>
                                    <Plus size={14} /> {doc}
                                </button>
                            ))}
                        </div>

                        <div className="form-row" style={{ alignItems: 'flex-end', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label>Novo Documento</label>
                                <input type="text" value={docNome} onChange={e => setDocNome(e.target.value)} placeholder="Ex: Cópia RG" />
                            </div>
                            <div className="form-group" style={{ flex: 2 }}>
                                <label>Descrição</label>
                                <input type="text" value={docDescricao} onChange={e => setDocDescricao(e.target.value)} placeholder="Opcional" />
                            </div>
                            <button type="button" className="btn-secondary" onClick={() => handleAddDocumento(docNome, docDescricao)} style={{ height: '42px' }}>
                                Adicionar
                            </button>
                        </div>

                        {documentos.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {documentos.map((doc, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                            <CheckCircle2 size={18} style={{ color: doc.arquivo_url ? 'var(--text-success)' : 'var(--text-secondary)' }} />
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{doc.nome}</div>
                                                {doc.descricao && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{doc.descricao}</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {doc.arquivo_url ? (
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-success)', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>
                                                        <CheckCircle2 size={14} /> Anexado
                                                    </span>
                                                    <button type="button" onClick={() => removeDocAttachment(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--primary-red)', color: 'white', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }} title="Remover anexo">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="btn-secondary" style={{ cursor: 'pointer', margin: 0, padding: '4px 12px', fontSize: '12px', height: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Upload size={14} /> Anexar
                                                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => handleDocFileChange(i, e)} />
                                                </label>
                                            )}
                                            <button type="button" className="btn-icon text-error" onClick={() => handleRemoveDocumento(i)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="modal-actions" style={{ position: 'sticky', bottom: '-20px', backgroundColor: 'var(--bg-surface)', padding: '16px 0', borderTop: '1px solid var(--border-color)', margin: '0 -24px', paddingLeft: '24px', paddingRight: '24px' }}>
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar Contrato'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
