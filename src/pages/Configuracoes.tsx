import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Upload, User, Globe, Building2, Link as LinkIcon, Database, Calendar as CalendarIcon, Loader2, Key, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../hooks/useSettings';
import { ConfirmModal } from '../components/ConfirmModal';
import './Configuracoes.css';

export function Configuracoes() {
    const { refetchSettings } = useSettings();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

    // Identidade da Empresa
    const [logoUrl, setLogoUrl] = useState('');
    const [empresaNome, setEmpresaNome] = useState('');
    const [cnpj, setCnpj] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [endereco, setEndereco] = useState('');

    // Upload State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');

    // Preferências
    const [usuarioNome, setUsuarioNome] = useState('');
    const [fusoHorario, setFusoHorario] = useState('America/Sao_Paulo');
    const [chaveQr, setChaveQr] = useState('');
    const [showChaveQr, setShowChaveQr] = useState(false);

    // Conexões
    const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
    const [calendarConnected, setCalendarConnected] = useState(false);
    const [calendarEmail, setCalendarEmail] = useState('');

    useEffect(() => {
        loadSettings();
        checkConnections();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('configuracoes')
                .select('*');

            if (error) throw error;

            if (data) {
                const settingsMap = data.reduce((acc, curr) => ({ ...acc, [curr.chave]: curr.valor }), {});
                setLogoUrl(settingsMap['logo_url'] || '');
                setEmpresaNome(settingsMap['empresa_nome'] || '');
                setCnpj(settingsMap['cnpj'] || '');
                setTelefone(settingsMap['telefone'] || '');
                setEmail(settingsMap['email'] || '');
                setEndereco(settingsMap['endereco'] || '');
                setUsuarioNome(settingsMap['usuario_nome'] || '');
                setFusoHorario(settingsMap['fuso_horario'] || 'America/Sao_Paulo');
                setChaveQr(settingsMap['chave_qr'] || '');

                if (settingsMap['logo_url']) {
                    setPreviewUrl(settingsMap['logo_url']);
                }
            }
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            toast.error('Erro ao carregar configurações.');
        } finally {
            setIsLoading(false);
        }
    };

    const checkConnections = async () => {
        // Supabase Ping
        try {
            const { error } = await supabase.from('configuracoes').select('id').limit(1);
            setSupabaseStatus(error ? 'disconnected' : 'connected');
        } catch {
            setSupabaseStatus('disconnected');
        }

        // Google Calendar Token Check
        try {
            const { data, error } = await supabase.from('auth_tokens').select('*').limit(1).maybeSingle();
            if (!error && data) {
                setCalendarConnected(true);
                // We'd ideally store email alongside the token, but for now we just show connected
                setCalendarEmail('Conta vinculada');
            } else {
                setCalendarConnected(false);
            }
        } catch {
            setCalendarConnected(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.includes('image/')) {
                toast.error('Por favor, selecione uma imagem válida (PNG ou JPG).');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                toast.error('A imagem deve ter no máximo 2MB.');
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleConfirmDisconnect = async () => {
        try {
            const { error } = await supabase.from('auth_tokens').delete().neq('id', '0'); // delete all
            if (error) throw error;
            setIsDisconnectModalOpen(false);
            setCalendarConnected(false);
            setCalendarEmail('');
            toast.success('Google Calendar desconectado com sucesso.');
        } catch (error) {
            console.error("Erro ao desconectar:", error);
            toast.error("Falha ao desconectar Google Calendar.");
            setIsDisconnectModalOpen(false);
        }
    };

    const handleDisconnectCalendar = () => {
        setIsDisconnectModalOpen(true);
    };

    const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 14) value = value.slice(0, 14);
        value = value.replace(/^(\d{2})(\d)/, '$1.$2');
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
        value = value.replace(/(\d{4})(\d)/, '$1-$2');
        setCnpj(value);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        value = value.replace(/(\d)(\d{4})$/, '$1-$2');
        setTelefone(value);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let finalLogoUrl = logoUrl;

            // 1. Upload Logo se houver arquivo novo
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `logo_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('public-assets')
                    .upload(`logos/${fileName}`, selectedFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage
                    .from('public-assets')
                    .getPublicUrl(`logos/${fileName}`);

                finalLogoUrl = publicUrlData.publicUrl;
                setLogoUrl(finalLogoUrl);
            }

            // 2. Preparar payload para batch upsert
            const settingsToSave = [
                { chave: 'logo_url', valor: finalLogoUrl },
                { chave: 'empresa_nome', valor: empresaNome },
                { chave: 'cnpj', valor: cnpj },
                { chave: 'telefone', valor: telefone },
                { chave: 'email', valor: email },
                { chave: 'endereco', valor: endereco },
                { chave: 'usuario_nome', valor: usuarioNome },
                { chave: 'fuso_horario', valor: fusoHorario },
                { chave: 'chave_qr', valor: chaveQr },
            ];

            const { error: upsertError } = await supabase
                .from('configuracoes')
                .upsert(settingsToSave, { onConflict: 'chave' });

            if (upsertError) throw upsertError;

            toast.success('Configurações salvas com sucesso!');
            refetchSettings(); // Atualiza o contexto global para a sidebar reativa

        } catch (error: any) {
            console.error('Erro ao salvar as configurações:', error);
            toast.error(error.message || 'Erro ao tentar salvar as configurações.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="module-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <Loader2 size={32} className="skeleton-box" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-red)' }} />
                <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Carregando configurações...</p>
            </div>
        );
    }

    return (
        <div className="module-container">
            <div className="module-header configuration-header">
                <div className="header-titles">
                    <h2>Configurações Globais</h2>
                    <p className="subtitle">Gerencie as preferências e a identidade da sua conta</p>
                </div>
            </div>

            <div className="config-grid">
                {/* Lado Esquerdo - Identidade */}
                <div className="config-panel">
                    <div className="panel-badge-title">
                        <Building2 size={18} />
                        <h3>Identidade da Empresa</h3>
                    </div>

                    <div className="config-form">
                        <div className="logo-upload-section">
                            <div className="logo-preview-box">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Logo" className="logo-preview-image" />
                                ) : (
                                    <div className="logo-preview-placeholder">
                                        <Upload size={24} />
                                        <span>Sem Logo</span>
                                    </div>
                                )}
                            </div>
                            <div className="logo-upload-actions">
                                <p className="help-text">JPG ou PNG (Máximo 2MB). Idealmente quadrada.</p>
                                <label className="btn-secondary upload-btn">
                                    <Upload size={16} />
                                    <span>Alterar Logo</span>
                                    <input
                                        type="file"
                                        style={{ display: 'none' }}
                                        accept="image/png, image/jpeg, image/jpg"
                                        onChange={handleFileChange}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Nome Fantasia (exibido no menu lateral)</label>
                            <input
                                type="text"
                                value={empresaNome}
                                onChange={(e) => setEmpresaNome(e.target.value)}
                                placeholder="Alternativa Gestão"
                            />
                        </div>

                        <div className="form-grid-inner">
                            <div className="form-group">
                                <label>CNPJ</label>
                                <input
                                    type="text"
                                    value={cnpj}
                                    onChange={handleCnpjChange}
                                    placeholder="00.000.000/0000-00"
                                    maxLength={18}
                                />
                            </div>
                            <div className="form-group">
                                <label>Telefone Principal</label>
                                <input
                                    type="text"
                                    value={telefone}
                                    onChange={handlePhoneChange}
                                    placeholder="(00) 00000-0000"
                                    maxLength={15}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>E-mail de Contato</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="contato@empresa.com.br"
                            />
                        </div>

                        <div className="form-group">
                            <label>Endereço Físico (Opcional)</label>
                            <input
                                type="text"
                                value={endereco}
                                onChange={(e) => setEndereco(e.target.value)}
                                placeholder="Rua Exemplo, 123 - Bairro, Cidade/UF"
                            />
                        </div>
                    </div>
                </div>

                {/* Lado Direito - Preferências e Conexões */}
                <div className="config-side-panels">

                    {/* Preferências */}
                    <div className="config-panel">
                        <div className="panel-badge-title">
                            <User size={18} />
                            <h3>Preferências Pessoais</h3>
                        </div>
                        <div className="config-form">
                            <div className="form-group">
                                <label>Como quer ser chamado?</label>
                                <input
                                    type="text"
                                    value={usuarioNome}
                                    onChange={(e) => setUsuarioNome(e.target.value)}
                                    placeholder="Seu nome"
                                />
                                <p className="help-text-sm">Isso customiza saudações no Dashboard.</p>
                            </div>

                            <div className="form-group">
                                <label>Fuso Horário Padrão</label>
                                <div className="timezone-select-wrapper">
                                    <Globe size={16} className="input-icon" />
                                    <select value={fusoHorario} onChange={(e) => setFusoHorario(e.target.value)}>
                                        <option value="America/Sao_Paulo">Horário de Brasília (UTC-3)</option>
                                        <option value="America/Manaus">Manaus / Roraima (UTC-4)</option>
                                        <option value="America/Rio_Branco">Acre (UTC-5)</option>
                                        <option value="America/Noronha">Fernando de Noronha (UTC-2)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Key size={14} /> Chave de Segurança QR
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type={showChaveQr ? 'text' : 'password'}
                                        value={chaveQr}
                                        onChange={(e) => setChaveQr(e.target.value)}
                                        placeholder="Ex: 1234, admin, segredo"
                                        style={{ paddingRight: '40px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowChaveQr(!showChaveQr)}
                                        style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title={showChaveQr ? "Ocultar Chave" : "Mostrar Chave"}
                                    >
                                        {showChaveQr ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <p className="help-text-sm" style={{ color: 'var(--warning)', marginTop: '6px' }}>Esta chave é necessária para alterar o status de equipamentos via QR Code no pátio.</p>
                            </div>
                        </div>
                    </div>

                    {/* Conexões */}
                    <div className="config-panel">
                        <div className="panel-badge-title">
                            <LinkIcon size={18} />
                            <h3>Status das Conexões</h3>
                        </div>

                        <div className="connections-list">
                            {/* Supabase Connection */}
                            <div className="connection-card">
                                <div className="connection-info">
                                    <div className="connection-icon-wrapper supabase-theme">
                                        <Database size={20} />
                                    </div>
                                    <div className="connection-details">
                                        <h4>Banco de Dados (Supabase)</h4>
                                        <div className={`status-badge-inline ${supabaseStatus === 'connected' ? 'status-ok' : supabaseStatus === 'disconnected' ? 'status-error' : ''}`}>
                                            <span className="dot"></span>
                                            {supabaseStatus === 'connected' ? 'Conectado' : supabaseStatus === 'disconnected' ? 'Desconectado' : 'Checando...'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Google Calendar Connection */}
                            <div className="connection-card">
                                <div className="connection-info">
                                    <div className="connection-icon-wrapper google-theme">
                                        <CalendarIcon size={20} />
                                    </div>
                                    <div className="connection-details">
                                        <h4>Integração Google Calendar</h4>
                                        <div className={`status-badge-inline ${calendarConnected ? 'status-ok' : 'status-waiting'}`}>
                                            <span className="dot"></span>
                                            {calendarConnected ? `Vinculado (${calendarEmail})` : 'Aguardando Login'}
                                        </div>
                                    </div>
                                </div>
                                {calendarConnected && (
                                    <button className="btn-disconnect" onClick={handleDisconnectCalendar}>
                                        Desconectar
                                    </button>
                                )}
                            </div>

                        </div>
                    </div>

                </div>
            </div>

            <ConfirmModal
                isOpen={isDisconnectModalOpen}
                title="Desconectar Calendar?"
                description="Deseja realmente revogar a conexão com o Google Calendar? O sistema perderá acesso imediato à sua agenda externa de eventos."
                confirmText="Sim, Desconectar"
                onConfirm={handleConfirmDisconnect}
                onCancel={() => setIsDisconnectModalOpen(false)}
            />

            {/* Fixed Footer Actions */}
            <div className="config-footer-actions">
                <button
                    className="btn-primary"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <>
                            <Loader2 size={16} className="spin-anim" /> Salvando...
                        </>
                    ) : (
                        <>
                            <Save size={18} /> Salvar Alterações
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
