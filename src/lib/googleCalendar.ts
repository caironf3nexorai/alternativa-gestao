import { getValidAccessToken } from './googleAuth';

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

interface GoogleEvent {
    summary: string;
    description?: string;
    location?: string;
    colorId?: string; // 1-11
    start: {
        dateTime?: string;
        date?: string; // for all-day events
        timeZone?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    conferenceData?: {
        createRequest?: {
            requestId: string;
            conferenceSolutionKey: {
                type: 'hangoutsMeet'
            }
        }
    };
}

async function fetchWithToken(url: string, options: RequestInit = {}) {
    const token = await getValidAccessToken();
    if (!token) {
        throw new Error('Sessão do Google expirada ou inválida. Por favor, conecte novamente.');
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        throw new Error('Autorização negada pelo Google.');
    }

    if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error?.message || `Erro da API Google: ${response.statusText}`);
    }

    // DELETE returns 204 No Content
    if (response.status === 204) return null;

    return response.json();
}

/**
 * Busca eventos num range de tempo no Google Calendar primário do usuário.
 */
export async function listEvents(timeMin: Date, timeMax: Date) {
    const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true', // Expand recurring events
        orderBy: 'startTime',
        maxResults: '2500' // Prevenindo paginação chata para volumes razoáveis num mês
    });

    const data = await fetchWithToken(`${CALENDAR_API_URL}?${params.toString()}`);
    return data.items || [];
}

/**
 * Cria ou insere um evento no Google Calendar primário.
 */
export async function insertEvent(eventBody: GoogleEvent) {
    return await fetchWithToken(`${CALENDAR_API_URL}?conferenceDataVersion=1`, {
        method: 'POST',
        body: JSON.stringify(eventBody)
    });
}

/**
 * Atualiza um evento usando PUT. Necessita do ID do evento no Google.
 */
export async function updateEvent(eventId: string, eventBody: GoogleEvent) {
    return await fetchWithToken(`${CALENDAR_API_URL}/${eventId}?conferenceDataVersion=1`, {
        method: 'PUT',
        body: JSON.stringify(eventBody)
    });
}

/**
 * Remove um evento pelo ID.
 */
export async function deleteEvent(eventId: string) {
    return await fetchWithToken(`${CALENDAR_API_URL}/${eventId}`, {
        method: 'DELETE'
    });
}
