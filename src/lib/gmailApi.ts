import { getValidAccessToken } from './googleAuth';

const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = await getValidAccessToken();
    if (!token) throw new Error('Não autenticado com o Google');

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    
    return fetch(url, { ...options, headers });
}

export async function listMessages(labelIds: string[], pageToken?: string) {
    const params = new URLSearchParams();
    if (labelIds.length) {
        labelIds.forEach(id => params.append('labelIds', id));
    }
    if (pageToken) params.append('pageToken', pageToken);
    
    const url = `${GMAIL_API_URL}?${params.toString()}`;
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Erro ao listar e-mails do Gmail');
    return res.json();
}

export async function getMessage(messageId: string) {
    // format=full traz todo o payload detalhado
    const res = await fetchWithAuth(`${GMAIL_API_URL}/${messageId}?format=full`);
    if (!res.ok) throw new Error('Erro ao buscar e-mail do Gmail');
    return res.json();
}

export async function markAsRead(messageId: string) {
    const res = await fetchWithAuth(`${GMAIL_API_URL}/${messageId}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
    });
    if (!res.ok) throw new Error('Erro ao marcar e-mail como lido');
    return res.json();
}

export async function markAsUnread(messageId: string) {
    const res = await fetchWithAuth(`${GMAIL_API_URL}/${messageId}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds: ['UNREAD'] })
    });
    if (!res.ok) throw new Error('Erro ao marcar e-mail como não lido');
    return res.json();
}

export async function trashMessage(messageId: string) {
    const res = await fetchWithAuth(`${GMAIL_API_URL}/${messageId}/trash`, {
        method: 'POST'
    });
    if (!res.ok) throw new Error('Erro ao mover e-mail para a lixeira');
    return res.json();
}

/**
 * Envia um novo email com raw content codificado em base64 formato web-safe
 */
export async function sendMessage(to: string, subject: string, body: string) {
    const emailStr = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        body
    ].join('\r\n');
    
    const base64EncodedEmail = btoa(unescape(encodeURIComponent(emailStr))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const res = await fetchWithAuth(`${GMAIL_API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: base64EncodedEmail })
    });
    
    if (!res.ok) throw new Error('Erro ao enviar e-mail');
    return res.json();
}

/**
 * Responde um email mantendo a "Thread" e a conversação original
 */
export async function replyMessage(messageId: string, threadId: string, body: string, to: string, subject: string) {
    const emailStr = [
        `To: ${to}`,
        `Subject: ${subject.startsWith('Re:') ? subject : `Re: ${subject}`}`,
        `In-Reply-To: ${messageId}`,
        `References: ${messageId}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        body
    ].join('\r\n');
    
    const base64EncodedEmail = btoa(unescape(encodeURIComponent(emailStr))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const res = await fetchWithAuth(`${GMAIL_API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            raw: base64EncodedEmail,
            threadId: threadId
        })
    });
    
    if (!res.ok) throw new Error('Erro ao responder e-mail');
    return res.json();
}

/**
 * Encaminha um email (faz fetch do original para capturar o conteúdo/Assunto correto)
 */
export async function forwardMessage(messageId: string, to: string, body?: string) {
    const original = await getMessage(messageId);
    
    // Busca header de "Subject" do e-mail original para prefixar com "Fwd:"
    const subjectHeader = original.payload.headers.find((h: any) => h.name.toLowerCase() === 'subject');
    const originalSubject = subjectHeader ? subjectHeader.value : 'Sem Assunto';
    
    // Concatena o body customizado do usuário + a sinalização de forward
    // Num MVP, isso previne o parsing complexo da thread MIME original
    const fwdContent = body ? `${body}<br/><br/>---------- Mensagem Encaminhada ----------<br/>` : `---------- Mensagem Encaminhada ----------<br/>`;
    
    const emailStr = [
        `To: ${to}`,
        `Subject: Fwd: ${originalSubject}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        fwdContent
    ].join('\r\n');
    
    const base64EncodedEmail = btoa(unescape(encodeURIComponent(emailStr))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const res = await fetchWithAuth(`${GMAIL_API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: base64EncodedEmail })
    });
    
    if (!res.ok) throw new Error('Erro ao encaminhar e-mail');
    return res.json();
}
