import { supabase } from './supabase';

// Helper para gerenciar Autenticação e Atualização Silenciosa de Tokens do Google Calendar

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${window.location.origin}/compromissos`; // URL da página de compromissos
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

/**
 * 1. Gera a URL de Autenticação do Google
 * Inclui access_type=offline e prompt=consent para forçar a devolução do refresh_token
 */
export function getGoogleAuthUrl() {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: SCOPES,
    };
    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
}

/**
 * 2. Troca o 'code' retornado na URL por Access & Refresh Tokens
 */
export async function exchangeCodeForTokens(code: string) {
    const url = 'https://oauth2.googleapis.com/token';
    const values = {
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values).toString(),
    });

    if (!response.ok) {
        throw new Error('Falha ao obter tokens OAuth 2.0 do Google');
    }

    const data = await response.json();
    return data; // { access_token, refresh_token, expires_in, ... }
}

/**
 * 3. Usa o Refresh Token antigo para conseguir um novo Access Token
 */
export async function getRefreshToken(refreshToken: string) {
    const url = 'https://oauth2.googleapis.com/token';
    const values = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values).toString(),
    });

    if (!response.ok) {
        throw new Error('Falha ao reciclar Access Token com Refresh Token');
    }

    const data = await response.json();
    return data; // { access_token, expires_in, ... } (Google raramente devolve um novo refresh_token aqui)
}

/**
 * 4. Função Principal OBRIGATÓRIA antes de qualquer call de API.
 * Pega o token do Supabase. Se expirado, renova silenciosamente. Se não, devolve pronto pra uso.
 */
export async function getValidAccessToken(): Promise<string | null> {
    const { data: tokens, error } = await supabase
        .from('auth_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !tokens || tokens.length === 0) {
        return null; // Usuário nunca fez login ou tabela vazia
    }

    const tokenRow = tokens[0];
    const now = new Date();
    const expiresAt = new Date(tokenRow.expires_at);

    // Se ainda for válido (dando 5 minutos de folga por segurança), retorna direto
    if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
        return tokenRow.access_token;
    }

    // Se expirou, e TEM refresh_token, vamos reciclar
    if (tokenRow.refresh_token) {
        try {
            const novaData = await getRefreshToken(tokenRow.refresh_token);
            const novoExpiresAt = new Date(now.getTime() + novaData.expires_in * 1000).toISOString();

            // Salva o novo access_token mantendo o refresh_token antigo (ou o novo se vier)
            const payload = {
                access_token: novaData.access_token,
                refresh_token: novaData.refresh_token || tokenRow.refresh_token,
                expires_at: novoExpiresAt
            };

            await supabase
                .from('auth_tokens')
                .update(payload)
                .eq('id', tokenRow.id);

            return novaData.access_token;
        } catch (err) {
            console.error('Refresh token error:', err);
            return null; // Sinalizando que o usuário provavelmente revogou acesso
        }
    }

    return null; // Caiu em caso estranho de expirado sem refresh_token
}

/**
 * Logout do Calendar
 */
export async function disconnectGoogleCalendar() {
    await supabase.from('auth_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete table content blindly (since it's single user MVP essentially)
}
