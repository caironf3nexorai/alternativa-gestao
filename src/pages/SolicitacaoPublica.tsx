import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Equipamento {
    id: string;
    nome: string;
    codigo_patrimonio: string;
    categorias_equipamento?: any;
    status?: string;
}

export function SolicitacaoPublica() {
    const { token } = useParams<{ token: string }>();
    const [equipamento, setEquipamento] = useState<Equipamento | null>(null);
    const [logoUrl, setLogoUrl] = useState<string>('');
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [error, setError] = useState('');

    const [tipo, setTipo] = useState<'limpeza' | 'insumos' | 'avaria' | 'duvida' | 'status'>('limpeza');

    // Campos dinâmicos
    const [identificacao, setIdentificacao] = useState('');
    const [observacao, setObservacao] = useState('');
    const [oqueFalta, setOqueFalta] = useState('');
    const [descAvaria, setDescAvaria] = useState('');
    const [descDuvida, setDescDuvida] = useState('');

    // Campos p/ Alterar Status
    const [novoStatus, setNovoStatus] = useState('Disponível');
    const [chaveSeguranca, setChaveSeguranca] = useState('');
    const [erroChave, setErroChave] = useState('');

    const [enviando, setEnviando] = useState(false);
    const [sucesso, setSucesso] = useState(false);
    const [mensagemSucesso, setMensagemSucesso] = useState('');

    useEffect(() => {
        async function fetchData() {
            if (!token) return;
            try {
                // 1. Busca configurações (Logo)
                const { data: configData } = await supabase
                    .from('configuracoes')
                    .select('chave, valor')
                    .eq('chave', 'logo_url')
                    .single();

                if (configData && configData.valor) {
                    setLogoUrl(configData.valor);
                }

                // 2. Busca Equipamento
                let eqData;
                const { data, error: errQR } = await supabase
                    .from('equipamentos')
                    .select('id, nome, codigo_patrimonio, status, categorias_equipamento(nome)')
                    .eq('qr_token', token)
                    .single();

                if (errQR && errQR.code !== 'PGRST116') throw errQR;

                if (data) {
                    eqData = data;
                } else {
                    const { data: dataById, error: errById } = await supabase
                        .from('equipamentos')
                        .select('id, nome, codigo_patrimonio, status, categorias_equipamento(nome)')
                        .eq('id', token)
                        .single();

                    if (errById) throw errById;
                    eqData = dataById;
                }

                if (eqData) {
                    setEquipamento(eqData);
                } else {
                    setError('Equipamento não encontrado ou QR Code inválido.');
                }

            } catch (err) {
                console.error(err);
                setError('Link inválido ou problema de conexão.');
            } finally {
                setLoadingInfo(false);
            }
        }
        fetchData();
    }, [token]);

    const handleLimparErrorChave = () => {
        if (erroChave) setErroChave('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!equipamento) return;

        try {
            setEnviando(true);
            setErroChave('');

            // Normalize strict db values
            const dbStatus = (() => {
                if (novoStatus === 'Disponível') return 'disponivel';
                if (novoStatus === 'Alugado') return 'alugado';
                if (novoStatus === 'Manutenção') return 'manutencao';
                return novoStatus.toLowerCase();
            })();

            // Se for alteração de status, precisamos validar a chave
            if (tipo === 'status') {
                const { data: chaveData, error: chaveErr } = await supabase
                    .from('configuracoes')
                    .select('valor')
                    .eq('chave', 'chave_qr')
                    .single();

                if (chaveErr || !chaveData || chaveData.valor !== chaveSeguranca) {
                    setErroChave('Chave incorreta');
                    setEnviando(false);
                    return;
                }

                // Atualiza o status nativo do equipamento imediatamente
                const { error: updateErr } = await supabase
                    .from('equipamentos')
                    .update({ status: dbStatus })
                    .eq('id', equipamento.id);

                if (updateErr) throw updateErr;

                setMensagemSucesso(`Status alterado com sucesso para ${novoStatus}!`);
            } else {
                setMensagemSucesso(`Sua mensagem sobre o equipamento ${equipamento.nome} foi enviada e a equipe técnica já foi notificada na base.`);
            }

            // Constroi a observacao baseada no tipo para unificar na tabela qr_solicitacoes
            let mergedObservacao = observacao.trim();
            if (tipo === 'insumos') mergedObservacao = `Faltando: ${oqueFalta.trim()} \n${mergedObservacao}`;
            if (tipo === 'avaria') mergedObservacao = `Avaria: ${descAvaria.trim()} \n${mergedObservacao}`;
            if (tipo === 'duvida') mergedObservacao = `Dúvida: ${descDuvida.trim()}`;

            // Em caso de tipo = 'status' salvamos o log em qr_solicitacoes tb para histórico
            const { error: insErr } = await supabase
                .from('qr_solicitacoes')
                .insert({
                    equipamento_id: equipamento.id,
                    tipo,
                    status_solicitado: tipo === 'status' ? dbStatus : null,
                    identificacao_solicitante: identificacao.trim() || 'Anônimo',
                    observacao: tipo === 'status' ? (observacao.trim() || `Alterou status para ${novoStatus}`) : mergedObservacao.trim(),
                    status: tipo === 'status' ? 'Resolvido' : 'Pendente'
                });

            if (insErr) throw insErr;
            setSucesso(true);

        } catch (err: any) {
            console.error(err);
            alert('Falha interna ao processar: ' + (err?.message || JSON.stringify(err)));
        } finally {
            setEnviando(false);
        }
    };

    const renderDynamicFields = () => {
        switch (tipo) {
            case 'limpeza':
                return (
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', display: 'block' }}>
                            Observações (Opcional)
                        </label>
                        <textarea
                            placeholder="Adicione detalhes complementares..."
                            value={observacao}
                            onChange={e => setObservacao(e.target.value)}
                            rows={3}
                            style={{ width: '100%', padding: '12px', border: '1px solid #2a3a50', borderRadius: '8px', fontSize: '15px', resize: 'vertical', backgroundColor: '#1a2332', color: '#f0f0f0' }}
                        />
                    </div>
                );
            case 'insumos':
                return (
                    <>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', display: 'block' }}>
                                O que está faltando? *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Ex: Papel higiênico, sabonete..."
                                value={oqueFalta}
                                onChange={e => setOqueFalta(e.target.value)}
                                style={{ width: '100%', padding: '12px', border: '1px solid #2a3a50', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1a2332', color: '#f0f0f0' }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', display: 'block' }}>
                                Observações (Opcional)
                            </label>
                            <textarea
                                placeholder="Adicione outros detalhes..."
                                value={observacao}
                                onChange={e => setObservacao(e.target.value)}
                                rows={2}
                                style={{ width: '100%', padding: '12px', border: '1px solid #2a3a50', borderRadius: '8px', fontSize: '15px', resize: 'vertical', backgroundColor: '#1a2332', color: '#f0f0f0' }}
                            />
                        </div>
                    </>
                );
            case 'avaria':
                return (
                    <>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', display: 'block' }}>
                                Descreva a avaria *
                            </label>
                            <textarea
                                required
                                placeholder="Ex: A porta está quebrada e não fecha direito..."
                                value={descAvaria}
                                onChange={e => setDescAvaria(e.target.value)}
                                rows={3}
                                style={{ width: '100%', padding: '12px', border: '1px solid #2a3a50', borderRadius: '8px', fontSize: '15px', resize: 'vertical', backgroundColor: '#1a2332', color: '#f0f0f0' }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', display: 'block' }}>
                                Observações (Opcional)
                            </label>
                            <textarea
                                placeholder="Algum detalhe adicional?"
                                value={observacao}
                                onChange={e => setObservacao(e.target.value)}
                                rows={2}
                                style={{ width: '100%', padding: '12px', border: '1px solid #2a3a50', borderRadius: '8px', fontSize: '15px', resize: 'vertical', backgroundColor: '#1a2332', color: '#f0f0f0' }}
                            />
                        </div>
                    </>
                );
            case 'duvida':
                return (
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', display: 'block' }}>
                            Qual é a sua dúvida? *
                        </label>
                        <textarea
                            required
                            placeholder="Descreva o que você precisa saber..."
                            value={descDuvida}
                            onChange={e => setDescDuvida(e.target.value)}
                            rows={4}
                            style={{ width: '100%', padding: '12px', border: '1px solid #2a3a50', borderRadius: '8px', fontSize: '15px', resize: 'vertical', backgroundColor: '#1a2332', color: '#f0f0f0' }}
                        />
                    </div>
                );
            case 'status':
                return (
                    <>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', display: 'block' }}>
                                Novo Status *
                            </label>
                            <select
                                value={novoStatus}
                                onChange={e => setNovoStatus(e.target.value)}
                                style={{ width: '100%', padding: '12px', border: '1px solid #2a3a50', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1a2332', color: '#f0f0f0', appearance: 'none' }}
                            >
                                <option value="Disponível">Disponível</option>
                                <option value="Alugado">Alugado</option>
                                <option value="Manutenção">Manutenção</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', display: 'block' }}>
                                Chave de Segurança *
                            </label>
                            <input
                                type="password"
                                required
                                placeholder="Digite a chave mestre..."
                                value={chaveSeguranca}
                                onChange={e => { setChaveSeguranca(e.target.value); handleLimparErrorChave(); }}
                                style={{ width: '100%', padding: '12px', border: erroChave ? '1px solid var(--error)' : '1px solid #2a3a50', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1a2332', color: '#f0f0f0' }}
                            />
                            {erroChave && <span style={{ color: 'var(--error)', fontSize: '13px', marginTop: '4px', display: 'block' }}>{erroChave}</span>}
                        </div>
                    </>
                );
        }
    };

    if (loadingInfo) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a2332', padding: '24px' }}>
                <Loader2 className="spin-anim" size={32} color="var(--primary-red)" />
            </div>
        );
    }

    if (error || !equipamento) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a2332', padding: '24px' }}>
                {logoUrl && <img src={logoUrl} alt="Logo da Empresa" style={{ maxHeight: '60px', marginBottom: '32px' }} />}
                <div style={{ background: '#1f2d40', padding: '32px', borderRadius: '12px', textAlign: 'center', maxWidth: '400px', width: '100%', border: '1px solid #2a3a50' }}>
                    <AlertCircle size={48} color="var(--error)" style={{ margin: '0 auto 16px' }} />
                    <h2 style={{ margin: '0 0 8px 0', color: '#f0f0f0' }}>QR Code Inválido</h2>
                    <p style={{ margin: 0, color: '#8a9bb0' }}>{error}</p>
                </div>
            </div>
        );
    }

    if (sucesso) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a2332', padding: '24px' }}>
                {logoUrl && <img src={logoUrl} alt="Logo da Empresa" style={{ maxHeight: '60px', marginBottom: '32px' }} />}
                <div style={{ background: '#1f2d40', padding: '40px 32px', borderRadius: '12px', textAlign: 'center', maxWidth: '400px', width: '100%', border: '1px solid #2a3a50' }}>
                    <CheckCircle size={64} color="var(--success)" style={{ margin: '0 auto 24px' }} />
                    <h2 style={{ margin: '0 0 12px 0', color: '#f0f0f0' }}>Sucesso!</h2>
                    <p style={{ margin: 0, color: '#8a9bb0', lineHeight: 1.5 }}>
                        {mensagemSucesso}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-secondary"
                        style={{ marginTop: '32px', width: '100%', padding: '12px', justifyContent: 'center', borderColor: '#2a3a50', color: '#f0f0f0' }}
                    >
                        Criar Nova Solicitação
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#1a2332', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            {/* LOGO NO TOPO */}
            {logoUrl && (
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                    <img src={logoUrl} alt="Logo da Empresa" style={{ maxHeight: '50px', objectFit: 'contain' }} />
                </div>
            )}

            <div style={{ background: '#1f2d40', borderRadius: '12px', maxWidth: '500px', width: '100%', overflow: 'hidden', border: '1px solid #2a3a50', marginBottom: '32px' }}>

                <div style={{ backgroundColor: '#2a3a50', padding: '24px', color: '#f0f0f0', textAlign: 'center' }}>
                    <h1 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>{equipamento.nome}</h1>
                    <div style={{ fontSize: '13px', color: '#8a9bb0', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>Patrimônio: #{equipamento.codigo_patrimonio}</span>
                        {equipamento.categorias_equipamento && (
                            <>
                                <span>•</span>
                                <span>{Array.isArray(equipamento.categorias_equipamento) ? equipamento.categorias_equipamento[0]?.nome : equipamento.categorias_equipamento.nome}</span>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ padding: '24px' }}>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>

                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '12px', display: 'block' }}>
                                Eu quero registrar um(a): *
                            </label>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                <button type="button" onClick={() => { setTipo('limpeza'); handleLimparErrorChave(); }} style={{ flex: '1 1 calc(50% - 4px)', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: tipo === 'limpeza' ? '2px solid #3498db' : '1px solid #2a3a50', backgroundColor: tipo === 'limpeza' ? 'rgba(52, 152, 219, 0.1)' : '#1a2332', color: tipo === 'limpeza' ? '#3498db' : '#8a9bb0', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    ✨ Limpeza
                                </button>
                                <button type="button" onClick={() => { setTipo('insumos'); handleLimparErrorChave(); }} style={{ flex: '1 1 calc(50% - 4px)', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: tipo === 'insumos' ? '2px solid var(--success)' : '1px solid #2a3a50', backgroundColor: tipo === 'insumos' ? 'rgba(46, 204, 113, 0.1)' : '#1a2332', color: tipo === 'insumos' ? 'var(--success)' : '#8a9bb0', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    📦 Insumos
                                </button>
                                <button type="button" onClick={() => { setTipo('avaria'); handleLimparErrorChave(); }} style={{ flex: '1 1 calc(50% - 4px)', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: tipo === 'avaria' ? '2px solid var(--error)' : '1px solid #2a3a50', backgroundColor: tipo === 'avaria' ? 'rgba(231, 76, 60, 0.1)' : '#1a2332', color: tipo === 'avaria' ? 'var(--error)' : '#8a9bb0', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    ⚠️ Avaria
                                </button>
                                <button type="button" onClick={() => { setTipo('duvida'); handleLimparErrorChave(); }} style={{ flex: '1 1 calc(50% - 4px)', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: tipo === 'duvida' ? '2px solid #9b59b6' : '1px solid #2a3a50', backgroundColor: tipo === 'duvida' ? 'rgba(155, 89, 182, 0.1)' : '#1a2332', color: tipo === 'duvida' ? '#9b59b6' : '#8a9bb0', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    ❓ Dúvida
                                </button>
                                <button type="button" onClick={() => { setTipo('status'); handleLimparErrorChave(); }} style={{ flex: '1 1 100%', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: tipo === 'status' ? '2px solid var(--warning)' : '1px solid #2a3a50', backgroundColor: tipo === 'status' ? 'rgba(243, 156, 18, 0.1)' : '#1a2332', color: tipo === 'status' ? 'var(--warning)' : '#8a9bb0', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    🔄 Alterar Status
                                </button>
                            </div>
                        </div>

                        {renderDynamicFields()}

                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px', display: 'block' }}>
                                Sua Identificação (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: João (Setor de Vendas)"
                                value={identificacao}
                                onChange={e => setIdentificacao(e.target.value)}
                                style={{ width: '100%', padding: '12px', border: '1px solid #2a3a50', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1a2332', color: '#f0f0f0' }}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={enviando}
                            style={{ padding: '14px', fontSize: '16px', justifyContent: 'center', backgroundColor: '#cc2222', borderColor: '#cc2222' }}
                        >
                            {enviando ? <><Loader2 size={18} className="spin-anim" /> Aguarde...</> : 'Enviar Solicitação'}
                        </button>

                    </form>
                </div>
            </div>
        </div>
    );
}
