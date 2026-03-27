import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Clock, CheckCircle2, Package, FileText, AlertTriangle, Download } from 'lucide-react';
import { formatCurrency, formatDateBR, formatPhone } from '../lib/utils';
import toast from 'react-hot-toast';

export function ContratoDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [contrato, setContrato] = useState<any>(null);
    const [equipamentos, setEquipamentos] = useState<any[]>([]);
    const [documentos, setDocumentos] = useState<any[]>([]);

    const fetchDetail = async () => {
        if (!id) return;
        try {
            setLoading(true);
            
            // 1. Fetch Contrato + Cliente
            const { data: cData, error: cErr } = await supabase
                .from('contratos')
                .select('*, cliente:clientes(*)')
                .eq('id', id)
                .single();
            if (cErr) throw cErr;
            setContrato(cData);

            // 2. Fetch Equipamentos
            const { data: eData, error: eErr } = await supabase
                .from('contrato_equipamentos')
                .select('*, equipamento:equipamentos(*)')
                .eq('contrato_id', id);
            if (eErr) throw eErr;
            setEquipamentos(eData || []);

            // 3. Fetch Documentos
            const { data: dData, error: dErr } = await supabase
                .from('contrato_documentos')
                .select('*')
                .eq('contrato_id', id);
            if (dErr) throw dErr;
            setDocumentos(dData || []);

        } catch (err: any) {
            toast.error(err.message || 'Erro ao carregar detalhes');
            navigate('/contratos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
        // eslint-disable-next-line
    }, [id]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ativo': return <span className="status-badge status-ativo">Ativo</span>;
            case 'em_negociacao': return <span className="status-badge status-negociacao">Em Negociação</span>;
            case 'suspenso': return <span className="status-badge status-suspenso">Suspenso</span>;
            case 'encerrado': return <span className="status-badge status-encerrado">Encerrado</span>;
            default: return <span className="status-badge">{status}</span>;
        }
    };

    const toggleDocumento = async (docId: string, atualConcluido: boolean) => {
        try {
            const { error } = await supabase
                .from('contrato_documentos')
                .update({ concluido: !atualConcluido })
                .eq('id', docId);
            
            if (error) throw error;
            setDocumentos(documentos.map(d => d.id === docId ? { ...d, concluido: !atualConcluido } : d));
        } catch {
            toast.error("Erro ao atualizar o documento.");
        }
    };

    if (loading) return <div className="module-container" style={{ padding: '40px', textAlign: 'center' }}>Carregando detalhes do contrato...</div>;
    if (!contrato) return null;

    // Verificar se está vencendo ou vencido
    const prevDate = contrato.data_prevista_encerramento ? new Date(contrato.data_prevista_encerramento) : null;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let alertMsg = null;
    let alertType = ''; // warning, error
    if (prevDate && contrato.status !== 'encerrado') {
        const diffTime = prevDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            alertMsg = `Contrato vencido há ${Math.abs(diffDays)} dias!`;
            alertType = 'error';
        } else if (diffDays <= 7) {
            alertMsg = `Atenção: Contrato vence em ${diffDays} dias!`;
            alertType = 'warning';
        }
    }

    return (
        <div className="module-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="module-header" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button className="btn-icon" onClick={() => navigate('/contratos')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            Contrato {contrato.numero_contrato || `#${contrato.id.split('-')[0]}`}
                            {getStatusBadge(contrato.status)}
                        </h2>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Criado em {formatDateBR(contrato.created_at)}</span>
                    </div>
                </div>
            </div>

            {alertMsg && (
                <div style={{ backgroundColor: alertType === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: alertType === 'error' ? 'var(--primary-red)' : '#f59e0b', padding: '16px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 500, border: `1px solid ${alertType === 'error' ? 'var(--primary-red)' : '#f59e0b'}` }}>
                    <AlertTriangle size={20} />
                    {alertMsg}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div className="table-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', color: 'var(--primary-color)' }}>Dados do Cliente</h3>
                    <div><strong>Nome:</strong> {contrato.cliente?.nome}</div>
                    <div><strong>Contato:</strong> {contrato.cliente?.contato_nome || '-'}</div>
                    <div><strong>Telefone:</strong> {contrato.cliente?.contato_telefone ? formatPhone(contrato.cliente.contato_telefone) : '-'}</div>
                    {contrato.observacoes && (
                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '14px' }}>
                            <strong>Observações do Contrato:</strong><br/>
                            {contrato.observacoes}
                        </div>
                    )}
                </div>

                <div className="table-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', color: 'var(--primary-color)' }}>Valores e Vigência</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Data Início</div>
                            <div style={{ fontWeight: 500 }}><Clock size={14} style={{ display: 'inline', marginRight: '4px' }}/>{formatDateBR(contrato.data_inicio)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Data Prev. Encerramento</div>
                            <div style={{ fontWeight: 500 }}>{contrato.data_prevista_encerramento ? formatDateBR(contrato.data_prevista_encerramento) : '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Valor Mensal</div>
                            <div style={{ fontWeight: 500 }}>{contrato.valor_mensal ? formatCurrency(contrato.valor_mensal) : '-'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Valor Total</div>
                            <div style={{ fontWeight: 500 }}>{contrato.valor_total ? formatCurrency(contrato.valor_total) : '-'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="table-container" style={{ padding: '24px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', color: 'var(--primary-color)' }}>
                    <Package size={20} /> Equipamentos Vinculados ({equipamentos.length})
                </h3>
                
                {equipamentos.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)' }}>Nenhum equipamento vinculado a este contrato.</div>
                ) : (
                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Equipamento</th>
                                    <th>Código</th>
                                    <th>Status Atual (Geral)</th>
                                    <th>V. Unitário (Contrato)</th>
                                    <th>Retorno Previsto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {equipamentos.map(eq => (
                                    <tr key={eq.id}>
                                        <td className="fw-600">{eq.equipamento?.nome}</td>
                                        <td>{eq.equipamento?.codigo_patrimonio}</td>
                                        <td><span className="status-badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)' }}>{eq.equipamento?.status}</span></td>
                                        <td>{eq.valor_unitario ? formatCurrency(eq.valor_unitario) : '-'}</td>
                                        <td>{eq.data_retorno_prevista ? formatDateBR(eq.data_retorno_prevista) : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="table-container" style={{ padding: '24px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', color: 'var(--primary-color)' }}>
                    <FileText size={20} /> Checklist de Documentos ({documentos.filter(d => d.concluido).length}/{documentos.length})
                </h3>
                
                {documentos.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)' }}>Nenhum documento listado.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {documentos.map(doc => (
                            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', cursor: 'pointer', opacity: doc.concluido ? 0.6 : 1 }} onClick={() => toggleDocumento(doc.id, doc.concluido)}>
                                <div style={{ color: doc.concluido ? '#25D366' : 'var(--text-secondary)' }}>
                                    <CheckCircle2 size={20} />
                                </div>
                                <div style={{ flex: 1, textDecoration: doc.concluido ? 'line-through' : 'none' }}>
                                    <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{doc.nome}</div>
                                    {doc.descricao && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{doc.descricao}</div>}
                                </div>
                                {doc.arquivo_url && (
                                    <button 
                                        type="button" 
                                        className="btn-secondary" 
                                        style={{ padding: '4px 10px', fontSize: '12px', height: 'auto', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 10 }} 
                                        onClick={(e) => { e.stopPropagation(); window.open(doc.arquivo_url, '_blank'); }}
                                        title="Baixar / Visualizar Anexo"
                                    >
                                        <Download size={14} /> Anexo
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
