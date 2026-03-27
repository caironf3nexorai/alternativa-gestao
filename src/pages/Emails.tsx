import { useState, useEffect } from 'react';
import { Mail, Send, File, Trash2, ArrowLeft, Reply, Forward, Search, Pencil } from 'lucide-react';
import { listMessages, getMessage, markAsRead, markAsUnread, trashMessage, sendMessage, replyMessage } from '../lib/gmailApi';
import { getValidAccessToken, getGoogleAuthUrl } from '../lib/googleAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import './Emails.css';

type MailboxType = 'INBOX' | 'SENT' | 'DRAFT' | 'TRASH';

function decodeBase64Utf8(base64Str: string) {
    if (!base64Str) return '';
    try {
        const raw = atob(base64Str.replace(/-/g, '+').replace(/_/g, '/'));
        const arr = new Uint8Array(new ArrayBuffer(raw.length));
        for (let i = 0; i < raw.length; i++) {
            arr[i] = raw.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(arr);
    } catch {
        return '';
    }
}

function extractEmailBody(payload: any): string {
    if (!payload) return '';
    let body = '';
    
    function searchParts(parts: any[]): string {
        let textPlain = '';
        let textHtml = '';
        
        for (const p of parts) {
            if (p.mimeType === 'text/html' && p.body?.data) {
                textHtml = decodeBase64Utf8(p.body.data);
            } else if (p.mimeType === 'text/plain' && p.body?.data) {
                textPlain = decodeBase64Utf8(p.body.data);
            } else if (p.parts?.length) {
                const sub = searchParts(p.parts);
                if (sub) return sub;
            }
        }
        return textHtml || textPlain;
    }

    if (payload.parts) {
        body = searchParts(payload.parts);
    } else if (payload.body?.data) {
        body = decodeBase64Utf8(payload.body.data);
    }
    
    return body;
}

function getHeader(headers: any[], name: string) {
    if (!headers) return '';
    const h = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
    return h ? h.value : '';
}

export function Emails() {
    // Auth State
    const [token, setToken] = useState<string | null>(null);

    // Box State
    const [mailbox, setMailbox] = useState<MailboxType>('INBOX');
    const [unreadCount, setUnreadCount] = useState(0);

    // List State
    const [messagesList, setMessagesList] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);

    // View State
    const [selectedMessage, setSelectedMessage] = useState<any>(null);
    const [loadingMessage, setLoadingMessage] = useState(false);
    
    // Mobile State
    const [isMobileViewOpen, setIsMobileViewOpen] = useState(false);
    
    // Compose/Reply State
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isReplyOpen, setIsReplyOpen] = useState(false);
    const [composeForm, setComposeForm] = useState({ to: '', subject: '', body: '' });
    const [sending, setSending] = useState(false);

    useEffect(() => {
        checkAuth();
        fetchUnreadCount();
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        if (token) {
            fetchMessages(true);
        }
        // eslint-disable-next-line
    }, [mailbox, token]);

    const checkAuth = async () => {
        const valid = await getValidAccessToken();
        setToken(valid);
        if (!valid) toast.error('Conecte o Google Calendar em Configurações primeiro!');
    };

    const fetchUnreadCount = async () => {
        try {
            // Lazy search for unread INBOX count
            const res = await listMessages(['INBOX', 'UNREAD']);
            if (res.messages) {
                setUnreadCount(res.resultSizeEstimate || res.messages.length);
            } else {
                setUnreadCount(0);
            }
        } catch {
            setUnreadCount(0);
        }
    };

    const fetchMessages = async (reset: boolean = false) => {
        try {
            if (reset) {
                setLoadingList(true);
                setMessagesList([]);
                setSelectedMessage(null);
            }
            const res = await listMessages([mailbox], reset ? undefined : (nextPageToken || undefined));
            
            if (res.messages && res.messages.length > 0) {
                // Fetch snippets para preencher a lista. Precisamos chamar getMessage para cada um para ter Assunto, Header e Snippet no MVP
                // O listMessages nativo tem um "?format=metadata" que a gente não configurou no gmailApi mas o getMessage puro serve pro MVP,
                // vamos puxar em paralelo o format=metadata ou full pra todos da list (limitado aos 10/20 que vêm da api):
                const fullMsgs = await Promise.all(res.messages.map((m: any) => getMessage(m.id)));
                
                if (reset) {
                    setMessagesList(fullMsgs);
                } else {
                    setMessagesList(prev => [...prev, ...fullMsgs]);
                }
            } else if (reset) {
                setMessagesList([]); // Empty mailbox
            }
            
            setNextPageToken(res.nextPageToken || null);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao carregar mensagens.');
        } finally {
            setLoadingList(false);
        }
    };

    const handleSelectMessage = async (msg: any) => {
        try {
            setLoadingMessage(true);
            setSelectedMessage(msg);
            setIsMobileViewOpen(true);
            setIsReplyOpen(false);

            // Fetch latest status/body se quiser, mas ja trouxemos tudo com getMessage na lista
            // Se for não lida, marcar memo e api
            const isUnread = msg.labelIds?.includes('UNREAD');
            if (isUnread) {
                await markAsRead(msg.id);
                setMessagesList(prev => prev.map(m => {
                    if (m.id === msg.id) {
                        return { ...m, labelIds: m.labelIds.filter((l: string) => l !== 'UNREAD') };
                    }
                    return m;
                }));
                setUnreadCount(c => Math.max(0, c - 1));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingMessage(false);
        }
    };

    const handleToggleRead = async () => {
        if (!selectedMessage) return;
        try {
            const isUnread = selectedMessage.labelIds?.includes('UNREAD');
            if (isUnread) {
                await markAsRead(selectedMessage.id);
                toast.success('Marcada como lida');
            } else {
                await markAsUnread(selectedMessage.id);
                toast.success('Marcada como não lida');
            }
            
            const newLabelIds = isUnread 
                ? selectedMessage.labelIds.filter((l: string) => l !== 'UNREAD')
                : [...(selectedMessage.labelIds || []), 'UNREAD'];

            setSelectedMessage({ ...selectedMessage, labelIds: newLabelIds });
            setMessagesList(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, labelIds: newLabelIds } : m));
            setUnreadCount(c => isUnread ? Math.max(0, c - 1) : c + 1);
        } catch {
            toast.error('Erro ao atualizar status.');
        }
    };

    const handleTrash = async () => {
        if (!selectedMessage) return;
        try {
            await trashMessage(selectedMessage.id);
            toast.success('Movida para a lixeira');
            setMessagesList(prev => prev.filter(m => m.id !== selectedMessage.id));
            setSelectedMessage(null);
            setIsMobileViewOpen(false);
        } catch {
            toast.error('Erro ao mover.');
        }
    };

    const handleSendCompose = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSending(true);
            await sendMessage(composeForm.to, composeForm.subject, composeForm.body.replace(/\n/g, '<br>'));
            toast.success('Email enviado com sucesso!');
            setIsComposeOpen(false);
            setComposeForm({ to: '', subject: '', body: '' });
        } catch (err: any) {
            toast.error(err.message || 'Erro ao enviar.');
        } finally {
            setSending(false);
        }
    };

    const handleSendReply = async () => {
        if (!composeForm.body.trim() || !selectedMessage) return;
        try {
            setSending(true);
            await replyMessage(selectedMessage.id, selectedMessage.threadId, composeForm.body.replace(/\n/g, '<br>'), composeForm.to, composeForm.subject);
            toast.success('Resposta enviada com sucesso!');
            setIsReplyOpen(false);
            setComposeForm({ to: '', subject: '', body: '' });
        } catch (err: any) {
            toast.error(err.message || 'Erro ao responder.');
        } finally {
            setSending(false);
        }
    };

    const openReplyPanel = (forward = false) => {
        if (!selectedMessage) return;
        const originalFrom = getHeader(selectedMessage.payload.headers, 'From');
        const originalSubj = getHeader(selectedMessage.payload.headers, 'Subject');
        
        if (forward) {
            setComposeForm({ to: '', subject: `Fwd: ${originalSubj}`, body: '' });
            setIsComposeOpen(true); // Modal novo msg (encaminhar usara a mesma interface mas ideal seria funcao propria)
            // Pra simplificar, vamos usar o compose normal mas injetar 'Fwd' no subject
        } else {
            // Pegamos apenas o email "to", limpando o nome `<email@domain.com>`
            const matchMail = originalFrom.match(/<(.+)>/);
            setComposeForm({ 
                to: matchMail ? matchMail[1] : originalFrom, 
                subject: originalSubj.startsWith('Re:') ? originalSubj : `Re: ${originalSubj}`, 
                body: '' 
            });
            setIsReplyOpen(true);
            setTimeout(() => {
                document.getElementById('reply-area')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    };

    const formatShortDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return format(d, 'dd/MM/yyyy');
        } catch {
            return dateStr;
        }
    };

    if (!token) {
        return (
            <div className="module-container" style={{ padding: '40px', textAlign: 'center' }}>
                <Mail size={48} color="var(--text-secondary)" style={{ marginBottom: 16 }} />
                <h3>Módulo de E-mails Desconectado</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8, marginBottom: 24 }}>Vá até Configurações ou clique no botão abaixo para autorizar os novos escopos do Gmail e exibir suas caixas de e-mail aqui.</p>
                <button className="btn-primary" onClick={() => window.location.href = getGoogleAuthUrl('/emails')} style={{ display: 'inline-flex' }}>
                    Conectar Google Workspace
                </button>
            </div>
        );
    }

    return (
        <div className="emails-module-container">
            {/* COMPOSER MODAL (Novo Email ou Forward) */}
            {isComposeOpen && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content email-compose-modal">
                        <div className="modal-header">
                            <h2>Nova Mensagem</h2>
                            <button className="btn-close" onClick={() => setIsComposeOpen(false)} disabled={sending}>
                                <File size={20} />
                            </button>
                        </div>
                        <form className="form-container" onSubmit={handleSendCompose} style={{ padding: '24px' }}>
                            <div className="form-group">
                                <label>Para</label>
                                <input type="email" required value={composeForm.to} onChange={e => setComposeForm({...composeForm, to: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Assunto</label>
                                <input type="text" required value={composeForm.subject} onChange={e => setComposeForm({...composeForm, subject: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Mensagem</label>
                                <textarea rows={10} required value={composeForm.body} onChange={e => setComposeForm({...composeForm, body: e.target.value})}></textarea>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsComposeOpen(false)} disabled={sending}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={sending}>
                                    <Send size={16} style={{ marginRight: 6 }}/> {sending ? 'Enviando...' : 'Enviar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* COL 1: Sidebar Caixas */}
            <div className={`emails-sidebar ${isMobileViewOpen ? 'hidden-mobile' : ''}`}>
                <button className="btn-primary emails-new-btn" onClick={() => { setComposeForm({ to:'', subject:'', body:''}); setIsComposeOpen(true); }}>
                    <Pencil size={18} /> Novo Email
                </button>

                <div className={`emails-nav-item ${mailbox === 'INBOX' ? 'active' : ''}`} onClick={() => setMailbox('INBOX')}>
                    <div className="emails-nav-item-left">
                        <Mail size={18} /> <span>Entrada</span>
                    </div>
                    {unreadCount > 0 && <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </div>
                <div className={`emails-nav-item ${mailbox === 'SENT' ? 'active' : ''}`} onClick={() => setMailbox('SENT')}>
                    <div className="emails-nav-item-left">
                        <Send size={18} /> <span>Enviados</span>
                    </div>
                </div>
                <div className={`emails-nav-item ${mailbox === 'DRAFT' ? 'active' : ''}`} onClick={() => setMailbox('DRAFT')}>
                    <div className="emails-nav-item-left">
                        <File size={18} /> <span>Rascunhos</span>
                    </div>
                </div>
                <div className={`emails-nav-item ${mailbox === 'TRASH' ? 'active' : ''}`} onClick={() => setMailbox('TRASH')}>
                    <div className="emails-nav-item-left">
                        <Trash2 size={18} /> <span>Lixeira</span>
                    </div>
                </div>
            </div>

            {/* COL 2: Lista de Emails */}
            <div className="emails-list-col">
                <div className="emails-list-header">
                    <h3 style={{ fontSize: '15px' }}>
                        {mailbox === 'INBOX' ? 'Caixa de Entrada' : mailbox === 'SENT' ? 'Enviados' : mailbox === 'TRASH' ? 'Lixeira' : 'Rascunhos'}
                    </h3>
                    <div style={{ color: 'var(--text-secondary)' }}><Search size={16} /></div>
                </div>
                
                <div className="emails-list-content hide-scrollbar">
                    {loadingList && messagesList.length === 0 ? (
                        <div style={{ padding: '16px' }}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="email-list-item">
                                    <div className="skeleton-row" style={{ width: '40%' }}></div>
                                    <div className="skeleton-row" style={{ width: '80%' }}></div>
                                    <div className="skeleton-row" style={{ width: '90%' }}></div>
                                </div>
                            ))}
                        </div>
                    ) : messagesList.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            <Mail size={32} opacity={0.5} style={{ marginBottom: '16px' }} />
                            <p>Nenhum email encontrado nesta caixa.</p>
                        </div>
                    ) : (
                        messagesList.map(msg => {
                            const isSelected = selectedMessage?.id === msg.id;
                            const isUnread = msg.labelIds?.includes('UNREAD');
                            const from = getHeader(msg.payload.headers, 'From');
                            const subject = getHeader(msg.payload.headers, 'Subject') || '(Sem Assunto)';
                            const date = getHeader(msg.payload.headers, 'Date');
                            const senderName = from.split('<')[0].replace(/"/g, '').trim() || from;

                            return (
                                <div 
                                    key={msg.id} 
                                    className={`email-list-item ${isSelected ? 'selected' : ''} ${isUnread ? 'unread' : ''}`}
                                    onClick={() => handleSelectMessage(msg)}
                                >
                                    <div className="email-list-item-top">
                                        <span className="email-sender">{senderName}</span>
                                        <span className="email-date">{formatShortDate(date)}</span>
                                    </div>
                                    <div className="email-subject">{subject}</div>
                                    <div className="email-snippet" dangerouslySetInnerHTML={{ __html: msg.snippet }} />
                                </div>
                            );
                        })
                    )}
                    
                    {nextPageToken && !loadingList && (
                        <div style={{ padding: '16px', textAlign: 'center' }}>
                            <button className="btn-secondary" onClick={() => fetchMessages(false)} style={{ width: '100%', fontSize: '13px' }}>
                                Carregar mais
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* COL 3: Visualizador */}
            <div className={`emails-viewer-col ${isMobileViewOpen ? 'open' : ''}`}>
                {/* Mobile Back Button Overlay Header */}
                <div className="mobile-only-header" style={{ display: 'none', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
                    <button className="btn-icon" onClick={() => setIsMobileViewOpen(false)}>
                        <ArrowLeft size={20} /> Voltar
                    </button>
                </div>

                {!selectedMessage ? (
                    <div className="emails-viewer-empty">
                        <Mail size={48} opacity={0.2} />
                        <p>Selecione um email para visualizar</p>
                    </div>
                ) : (
                    <>
                        <div className="emails-viewer-toolbar">
                            <div className="emails-viewer-actions">
                                <button className="btn-icon" title="Responder" onClick={() => openReplyPanel(false)}><Reply size={18} /></button>
                                <button className="btn-icon" title="Encaminhar" onClick={() => openReplyPanel(true)}><Forward size={18} /></button>
                                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 8px' }}></div>
                                <button className="btn-icon" title={selectedMessage.labelIds?.includes('UNREAD') ? "Marcar como Lida" : "Marcar como Não Lida"} onClick={handleToggleRead}>
                                    <Mail size={18} fill={!selectedMessage.labelIds?.includes('UNREAD') ? "currentColor" : "none"} />
                                </button>
                                <button className="btn-icon text-error" title="Mover para Lixeira" onClick={handleTrash}><Trash2 size={18} /></button>
                            </div>
                        </div>

                        <div className="emails-viewer-header">
                            <h2 className="emails-viewer-subject">{getHeader(selectedMessage.payload?.headers, 'Subject') || '(Sem Assunto)'}</h2>
                            <div className="emails-viewer-meta">
                                <div>
                                    <div className="emails-viewer-from">De: {getHeader(selectedMessage.payload?.headers, 'From')}</div>
                                    <div className="emails-viewer-to">Para: {getHeader(selectedMessage.payload?.headers, 'To')}</div>
                                </div>
                                <div className="emails-viewer-date">{formatShortDate(getHeader(selectedMessage.payload?.headers, 'Date'))}</div>
                            </div>
                        </div>

                        <div className="emails-viewer-body">
                            {loadingMessage ? (
                                <div style={{ color: 'var(--text-tertiary)', padding: '24px' }}>Carregando conteúdo...</div>
                            ) : (
                                <iframe 
                                    className="emails-iframe" 
                                    sandbox="allow-same-origin"
                                    srcDoc={`
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <style>
                                                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 0; margin: 0; color: #111; word-wrap: break-word; }
                                                a { color: #2563eb; }
                                                img { max-width: 100%; height: auto; }
                                            </style>
                                        </head>
                                        <body>
                                            ${extractEmailBody(selectedMessage.payload)}
                                        </body>
                                        </html>
                                    `} 
                                />
                            )}
                        </div>

                        {/* Reply Panel Inject */}
                        {isReplyOpen && (
                            <div className="emails-reply-panel" id="reply-area">
                                <div className="emails-reply-header">
                                    <h4 style={{ color: 'var(--primary-color)' }}>Responder Mensagem</h4>
                                    <button className="btn-icon" onClick={() => setIsReplyOpen(false)}><ArrowLeft size={16} /></button>
                                </div>
                                <div className="form-group">
                                    <label>Para</label>
                                    <input type="text" value={composeForm.to} onChange={e => setComposeForm({...composeForm, to: e.target.value})} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <textarea rows={6} placeholder="Escreva sua resposta..." value={composeForm.body} onChange={e => setComposeForm({...composeForm, body: e.target.value})} style={{ width: '100%' }}></textarea>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 12 }}>
                                    <button className="btn-primary" onClick={handleSendReply} disabled={sending}>
                                        <Send size={16} style={{ marginRight: 6 }}/> {sending ? 'Enviando...' : 'Enviar Resposta'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
