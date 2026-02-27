import { useState, useEffect } from 'react';
import { getGoogleAuthUrl, exchangeCodeForTokens, getValidAccessToken } from '../lib/googleAuth';
import { supabase } from '../lib/supabase';
import { Calendar as BigCalendar, dateFnsLocalizer, type View, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, LogOut, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { listEvents, deleteEvent } from '../lib/googleCalendar';
import { CompromissoForm } from '../components/CompromissoForm';
import './Compromissos.css';

const locales = {
    'pt-BR': ptBR,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

export function Compromissos() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState<View>(Views.MONTH);
    const [events, setEvents] = useState<any[]>([]);

    // Modal state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [slotSelecionado, setSlotSelecionado] = useState<Date | undefined>(undefined);
    const [eventoSelecionado, setEventoSelecionado] = useState<any>(null);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [eventoParaDeletar, setEventoParaDeletar] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        checkAuthAndHandleCallback();
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            fetchListaCalendario();
        }
    }, [isAuthenticated, currentDate, currentView]);

    const fetchListaCalendario = async () => {
        try {
            // Calculate range based on current view/date. To keep simple, we fetch +- 2 months from view date.
            const min = new Date(currentDate);
            min.setMonth(min.getMonth() - 2);
            const max = new Date(currentDate);
            max.setMonth(max.getMonth() + 2);

            const items = await listEvents(min, max);

            const eventsParsed = items.map((gc: any) => {
                // Se é All Day, terminam no dia seguinte 00:00. O react-big-calendar entende isso se deixarmos as datas puras.
                const start = gc.start.dateTime ? new Date(gc.start.dateTime) : new Date(`${gc.start.date}T00:00:00`);
                let end = gc.end.dateTime ? new Date(gc.end.dateTime) : new Date(`${gc.end.date}T00:00:00`);

                // Big Calendar allDay adjustment: 
                // Google api sets end date as exclusive (e.g. 10th to 11th). RBC treats 00:00 next day correctly as all day if we tell it it's allDay.
                const isAllDay = !gc.start.dateTime;

                return {
                    id: gc.id,
                    title: gc.summary,
                    start,
                    end,
                    allDay: isAllDay,
                    resource: gc // Salva payload original bruto pra mandar pro Form na Edição
                };
            });
            setEvents(eventsParsed);
        } catch (error: any) {
            console.error(error);
            if (error.message.includes('Autorização negada') || error.message.includes('expirada')) {
                setIsAuthenticated(false);
            } else {
                toast.error('Erro ao baixar eventos do Google');
            }
        }
    };

    const checkAuthAndHandleCallback = async () => {
        try {
            // 1. Verificar se estamos voltando do Google com um CODE na URL
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');

            if (code) {
                setIsAuthenticating(true);
                toast.loading('Autenticando com o Google...', { id: 'oauth' });

                // Limpar URL rapidinho para não ficar feio
                window.history.replaceState({}, document.title, window.location.pathname);

                // Trocar code por tokens
                const tokens = await exchangeCodeForTokens(code);

                if (tokens.access_token) {
                    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

                    // Limpar tokens antigos (já que queremos manter a session única globalizada aqui)
                    await supabase.from('auth_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');

                    // Inserir os novos validos
                    const { error } = await supabase.from('auth_tokens').insert([{
                        access_token: tokens.access_token,
                        refresh_token: tokens.refresh_token, // Se vier, salva. Se não vier, fodeu o prompt=consent
                        expires_at: expiresAt
                    }]);

                    if (error) throw error;

                    toast.success('Conectado ao Google Calendar!', { id: 'oauth' });
                    setIsAuthenticated(true);
                }
            } else {
                // 2. Não há code. Vamos checar se o token salvo é valido (silencioso)
                const token = await getValidAccessToken();
                if (token) {
                    setIsAuthenticated(true);
                    // Aqui onde chamaríamos fetchEvents no futuro
                } else {
                    setIsAuthenticated(false);
                }
            }
        } catch (err: any) {
            console.error('Auth Erro:', err);
            toast.error(err.message || 'Erro ao autenticar', { id: 'oauth' });
            setIsAuthenticated(false);
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleConnectGoogle = () => {
        window.location.href = getGoogleAuthUrl();
    };

    const handleNovaInteracao = (date?: Date) => {
        setSlotSelecionado(date);
        setEventoSelecionado(null);
        setIsFormOpen(true);
    };

    const handleDeletarEvento = (eventId: string) => {
        setEventoParaDeletar(eventId);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!eventoParaDeletar) return;

        try {
            setIsDeleting(true);
            await deleteEvent(eventoParaDeletar);
            toast.success('Compromisso removido!');
            setIsFormOpen(false);
            setIsDeleteModalOpen(false);
            setEventoParaDeletar(null);
            fetchListaCalendario();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao remover');
        } finally {
            setIsDeleting(false);
        }
    };

    // Estilo customizado por Evento
    const eventPropGetter = (event: any) => {
        const gc = event.resource;
        let colorHex = '#039be5'; // default azul

        if (gc.colorId) {
            const GOOGLE_COLORS: Record<string, string> = {
                '11': '#d50000', // Vermelho
                '6': '#f09300',  // Laranja
                '5': '#f6bf26',  // Amarelo
                '10': '#0b8043', // Verde
                '7': '#039be5',  // Azul
                '8': '#616161',  // Cinza
            };
            if (GOOGLE_COLORS[gc.colorId]) {
                colorHex = GOOGLE_COLORS[gc.colorId];
            }
        }

        return {
            style: {
                backgroundColor: colorHex,
                border: `1px solid ${colorHex}`,
                opacity: 0.9
            }
        };
    };

    // Custom Toolbar Component for react-big-calendar
    const CustomToolbar = (toolbar: any) => {
        const goToBack = () => { toolbar.onNavigate('PREV'); };
        const goToNext = () => { toolbar.onNavigate('NEXT'); };
        const goToToday = () => { toolbar.onNavigate('TODAY'); };

        return (
            <div className="calendar-header-custom">
                <div className="calendar-nav">
                    <button onClick={goToToday}>Hoje</button>
                    <button onClick={goToBack} className="btn-icon"><ChevronLeft size={20} /></button>
                    <button onClick={goToNext} className="btn-icon"><ChevronRight size={20} /></button>
                    <h2 className="calendar-nav-title">{toolbar.label}</h2>
                </div>

                <div className="calendar-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div className="view-selector-group">
                        <button
                            className={`view-btn ${currentView === Views.MONTH ? 'active' : ''}`}
                            onClick={() => { setCurrentView(Views.MONTH); toolbar.onView(Views.MONTH); }}
                        >
                            Mês
                        </button>
                        <button
                            className={`view-btn ${currentView === Views.WEEK ? 'active' : ''}`}
                            onClick={() => { setCurrentView(Views.WEEK); toolbar.onView(Views.WEEK); }}
                        >
                            Semana
                        </button>
                        <button
                            className={`view-btn ${currentView === Views.DAY ? 'active' : ''}`}
                            onClick={() => { setCurrentView(Views.DAY); toolbar.onView(Views.DAY); }}
                        >
                            Dia
                        </button>
                    </div>

                    <button className="btn-primary" onClick={() => handleNovaInteracao()}>
                        <Plus size={18} /> Novo Compromisso
                    </button>
                    {/* LogOut action silencioso caso queira trocar de conta */}
                    <button className="btn-icon" onClick={() => {
                        toast('Para deslogar, revoque a permissão no painel do Google');
                    }} title="Desconectar">
                        <LogOut size={20} color="var(--text-secondary)" />
                    </button>
                </div>
            </div>
        );
    };

    if (isAuthenticated === null || isAuthenticating) {
        return (
            <div className="module-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <span className="text-secondary">Verificando autorização...</span>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="module-container" style={{ padding: '24px' }}>
                <div className="empty-state-oauth">
                    <CalendarIcon size={64} style={{ color: 'var(--primary-red)' }} />
                    <h2>Conecte seu Google Calendar</h2>
                    <p>
                        Para gerenciar seus compromissos, agendamentos, visitas técnicas e mobilizações de forma segura e sincronizada, autorize o aplicativo acessar o seu Google Agenda.
                    </p>
                    <button className="google-auth-btn" onClick={handleConnectGoogle}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google Logo" style={{ width: '24px' }} />
                        Conectar ao Google
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '16px' }}>
                        Nenhum evento será salvo em nossos servidores. Leitura bidirecional autorizada OAuth 2.0.
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="module-container compromissos-page">
            <div className="compromissos-container">
                <BigCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ flex: 1, minHeight: 0 }}
                    culture="pt-BR"
                    messages={{
                        allDay: 'Dia todo',
                        previous: 'Anterior',
                        next: 'Próximo',
                        today: 'Hoje',
                        month: 'Mês',
                        week: 'Semana',
                        day: 'Dia',
                        agenda: 'Agenda',
                        date: 'Data',
                        time: 'Hora',
                        event: 'Compromisso',
                        noEventsInRange: 'Não há compromissos nesta data.',
                        showMore: total => `+ Ver mais (${total})`
                    }}
                    formats={{
                        dayFormat: (date: Date, culture?: string, loc?: any) => {
                            const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
                            return loc?.format(date, isMobile ? 'dd/MM' : 'dd eeee', culture) as string;
                        },
                        weekdayFormat: (date: Date, culture?: string, loc?: any) => {
                            const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
                            const fullStr = loc?.format(date, 'eeee', culture) as string || '';
                            return isMobile ? fullStr.substring(0, 3) + '.' : fullStr;
                        }
                    }}
                    view={currentView}
                    date={currentDate}
                    onNavigate={date => setCurrentDate(date)}
                    onView={(view: View) => setCurrentView(view)}
                    selectable
                    eventPropGetter={eventPropGetter}
                    onSelectSlot={(slotInfo) => handleNovaInteracao(slotInfo.start)}
                    onSelectEvent={(event) => {
                        setSlotSelecionado(undefined);
                        setEventoSelecionado(event.resource);
                        setIsFormOpen(true);
                    }}
                    components={{
                        toolbar: CustomToolbar
                    }}
                />
            </div>

            {isFormOpen && (
                <CompromissoForm
                    dataInicial={slotSelecionado}
                    eventoEdicao={eventoSelecionado}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={() => {
                        setIsFormOpen(false);
                        fetchListaCalendario();
                    }}
                    onDelete={handleDeletarEvento}
                />
            )}

            {isDeleteModalOpen && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ maxWidth: '400px', padding: '24px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertTriangle size={24} color="var(--error)" />
                            </div>
                        </div>
                        <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Excluir Compromisso?</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                            Tem certeza que deseja apagar este compromisso?
                            <br />Esta ação não pode ser desfeita e <strong>isso refletirá no seu Google Calendar imediatamente</strong>.
                        </p>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button className="btn-secondary" onClick={() => {
                                setIsDeleteModalOpen(false);
                                setEventoParaDeletar(null);
                            }} disabled={isDeleting}>
                                Cancelar
                            </button>
                            <button className="btn-primary" style={{ backgroundColor: 'var(--error)' }} onClick={confirmDelete} disabled={isDeleting}>
                                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
