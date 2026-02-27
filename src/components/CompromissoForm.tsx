import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, MapPin, AlignLeft, Tag, Video, Copy, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';
import { insertEvent, updateEvent } from '../lib/googleCalendar';

interface CompromissoFormProps {
    onClose: () => void;
    onSuccess: () => void;
    onDelete?: (id: string) => void;
    dataInicial?: Date; // Quando clica num dia vazio do grid
    eventoEdicao?: any; // Objeto sujo retornado do google calendar caso seja edição
}

const GOOGLE_COLORS = [
    { id: '11', hex: '#d50000', label: 'Vermelho' },     // Tomato
    { id: '6', hex: '#f09300', label: 'Laranja' },       // Tangerine
    { id: '5', hex: '#f6bf26', label: 'Amarelo' },       // Banana
    { id: '10', hex: '#0b8043', label: 'Verde' },        // Basil
    { id: '7', hex: '#039be5', label: 'Azul' },          // Peacock
    { id: '8', hex: '#616161', label: 'Cinza' }          // Graphite
];

const EVENT_TYPES = [
    'Reunião',
    'Visita Técnica',
    'Mobilização',
    'Desmobilização',
    'Vencimento',
    'Outro'
];

export function CompromissoForm({ onClose, onSuccess, onDelete, dataInicial, eventoEdicao }: CompromissoFormProps) {
    const [loading, setLoading] = useState(false);

    const [titulo, setTitulo] = useState('');
    const [tipo, setTipo] = useState('Reunião');
    const [local, setLocal] = useState('');
    const [descricao, setDescricao] = useState('');
    const [diaInteiro, setDiaInteiro] = useState(false);
    const [cor, setCor] = useState('7'); // Azul default

    const [dataInicio, setDataInicio] = useState('');
    const [horaInicio, setHoraInicio] = useState('09:00');
    const [dataFim, setDataFim] = useState('');
    const [horaFim, setHoraFim] = useState('10:00');

    // Google Meet
    const [gerarMeet, setGerarMeet] = useState(false);
    const [meetLink, setMeetLink] = useState('');

    // Parse Initial Data
    useEffect(() => {
        if (eventoEdicao) {
            setTitulo(eventoEdicao.summary || '');
            setLocal(eventoEdicao.location || '');

            // Extract Tipo from description if we saved it there or we can try to guess from title.
            // As Google doesn't have a native "Type" field that isn't extended properties, we inject it in description or just let user re-select.
            // A simpler way is to prefix the title or inject string in description. Let's assume we read from title prefix "[Tipo] Titulo"
            let parsedTitle = eventoEdicao.summary || '';
            let defaultTipo = 'Outro';
            const typeMatch = parsedTitle.match(/^\[(.*?)\] (.*)/);
            if (typeMatch && EVENT_TYPES.includes(typeMatch[1])) {
                defaultTipo = typeMatch[1];
                parsedTitle = typeMatch[2];
            }

            setTipo(defaultTipo);
            setTitulo(parsedTitle);

            // Strip out type metadata from description if we injected
            setDescricao(eventoEdicao.description || '');

            setCor(eventoEdicao.colorId || '7');

            // Handling times (Google Event logic)
            if (eventoEdicao.start?.date) {
                // Dia inteiro
                setDiaInteiro(true);
                setDataInicio(eventoEdicao.start.date);

                // End date in google for all-day is exclusive (next day). So if event is 10 Oct to 10 Oct, end is 11 Oct.
                // We should subtract 1 day from end date for viewing in the form to not confuse user
                if (eventoEdicao.end?.date) {
                    const eD = new Date(eventoEdicao.end.date);
                    eD.setDate(eD.getDate() - 1);
                    setDataFim(eD.toISOString().split('T')[0]);
                }
            } else if (eventoEdicao.start?.dateTime) {
                setDiaInteiro(false);
                const sDt = new Date(eventoEdicao.start.dateTime);
                setDataInicio(`${sDt.getFullYear()}-${String(sDt.getMonth() + 1).padStart(2, '0')}-${String(sDt.getDate()).padStart(2, '0')}`);
                setHoraInicio(`${String(sDt.getHours()).padStart(2, '0')}:${String(sDt.getMinutes()).padStart(2, '0')}`);

                const eDt = new Date(eventoEdicao.end.dateTime);
                setDataFim(`${eDt.getFullYear()}-${String(eDt.getMonth() + 1).padStart(2, '0')}-${String(eDt.getDate()).padStart(2, '0')}`);
                setHoraFim(`${String(eDt.getHours()).padStart(2, '0')}:${String(eDt.getMinutes()).padStart(2, '0')}`);
            }

            // Extract Meet Link if exists
            if (eventoEdicao.conferenceData?.entryPoints) {
                const videoEntryPoint = eventoEdicao.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
                if (videoEntryPoint && videoEntryPoint.uri) {
                    setMeetLink(videoEntryPoint.uri);
                }
            }

        } else if (dataInicial) {
            // New Event via click on Grid
            const dStr = `${dataInicial.getFullYear()}-${String(dataInicial.getMonth() + 1).padStart(2, '0')}-${String(dataInicial.getDate()).padStart(2, '0')}`;
            setDataInicio(dStr);
            setDataFim(dStr);

            // If the user clicked in a month view, it gives 00:00 time. If clicked on week view, gives the specific time.
            if (dataInicial.getHours() !== 0 || dataInicial.getMinutes() !== 0) {
                setHoraInicio(`${String(dataInicial.getHours()).padStart(2, '0')}:${String(dataInicial.getMinutes()).padStart(2, '0')}`);
                const endH = new Date(dataInicial.getTime() + 60 * 60 * 1000); // +1 hour
                setHoraFim(`${String(endH.getHours()).padStart(2, '0')}:${String(endH.getMinutes()).padStart(2, '0')}`);
            }
        } else {
            // Generic new
            const d = new Date();
            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            setDataInicio(dStr);
            setDataFim(dStr);
        }
    }, [dataInicial, eventoEdicao]);

    // Handle Auto-Cor do Tipo
    const handleTipoChange = (novoTipo: string) => {
        setTipo(novoTipo);
        if (novoTipo === 'Mobilização') setCor('11'); // Red
        else if (novoTipo === 'Desmobilização') setCor('8'); // Grey
        else if (novoTipo === 'Vencimento') setCor('5'); // Yellow
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!titulo.trim() || !dataInicio || !dataFim) {
            toast.error('Preencha os campos obrigatórios (Título e Datas)');
            return;
        }

        try {
            setLoading(true);

            // Montando payload do Google
            const prefixo = tipo !== 'Outro' ? `[${tipo}] ` : '';
            const payload: any = {
                summary: `${prefixo}${titulo.trim()}`,
                description: descricao.trim(),
                location: local.trim(),
                colorId: cor
            };

            // Injecting Conference Data se marcar a opção
            if (gerarMeet && !meetLink) {
                payload.conferenceData = {
                    createRequest: {
                        requestId: `ag-meet-${Date.now()}`,
                        conferenceSolutionKey: {
                            type: "hangoutsMeet"
                        }
                    }
                };
            }

            // Resolvendo DataTimeZone issues
            // Para não ter erro de shift, compomos ISO String a partir da data local do usuário enviando o timeZone explícito da origin

            if (diaInteiro) {
                // Allday requires ONLY date (YYYY-MM-DD)
                // O Google espera que a data fim seja o dia *seguinte* ao encerramento (Exclusive end date)
                const dFinal = new Date(dataFim);
                dFinal.setDate(dFinal.getDate() + 1);

                payload.start = { date: dataInicio };
                payload.end = { date: `${dFinal.getFullYear()}-${String(dFinal.getMonth() + 1).padStart(2, '0')}-${String(dFinal.getDate()).padStart(2, '0')}` };
            } else {
                // Specific time
                // Format: 2015-05-28T09:00:00-07:00
                const finalStartStr = `${dataInicio}T${horaInicio}:00`;
                const finalEndStr = `${dataFim}T${horaFim}:00`;

                payload.start = { dateTime: new Date(finalStartStr).toISOString() };
                payload.end = { dateTime: new Date(finalEndStr).toISOString() };
            }

            if (eventoEdicao) {
                await updateEvent(eventoEdicao.id, payload);
                toast.success('Compromisso atualizado!');
            } else {
                await insertEvent(payload);
                toast.success('Compromisso sincronizado no Google Calendar!');
            }

            onSuccess();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h2>{eventoEdicao ? 'Detalhes do Compromisso' : 'Novo Compromisso'}</h2>
                    <button className="btn-close" onClick={onClose} disabled={loading}>
                        <X size={20} />
                    </button>
                </div>

                <form className="modal-body form-container" onSubmit={handleSubmit}>

                    <div className="form-group mb-4">
                        <label>Título *</label>
                        <input
                            type="text"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder="Ex: Reunião de Alinhamento"
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    <div className="form-grid" style={{ marginBottom: '16px' }}>
                        <div className="form-group">
                            <label>Tipo (Categoria)</label>
                            <div style={{ position: 'relative' }}>
                                <Tag size={16} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
                                <select
                                    style={{ paddingLeft: '36px' }}
                                    value={tipo}
                                    onChange={(e) => handleTipoChange(e.target.value)}
                                    disabled={loading}
                                >
                                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Cor do Marcador</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', height: '40px', padding: '0 8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                                {GOOGLE_COLORS.map(c => (
                                    <div
                                        key={c.id}
                                        title={c.label}
                                        onClick={() => !loading && setCor(c.id)}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            backgroundColor: c.hex,
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            border: cor === c.id ? '2px solid white' : '2px solid transparent',
                                            boxShadow: cor === c.id ? `0 0 0 2px ${c.hex}` : 'none',
                                            opacity: (cor !== c.id && cor !== '') ? 0.3 : 1
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <CalendarIcon size={18} color="var(--primary-red)" />
                            <h4 style={{ margin: 0, fontWeight: 500 }}>Data e Horário</h4>

                            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                <input
                                    type="checkbox"
                                    checked={diaInteiro}
                                    onChange={(e) => setDiaInteiro(e.target.checked)}
                                    disabled={loading}
                                    style={{ accentColor: 'var(--primary-red)' }}
                                />
                                Dia Inteiro
                            </label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                                <label>Início</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <input
                                        type="date"
                                        value={dataInicio}
                                        onChange={(e) => setDataInicio(e.target.value)}
                                        style={{ flex: 1, minWidth: '150px' }}
                                        disabled={loading}
                                        required
                                    />
                                    {!diaInteiro && (
                                        <input
                                            type="time"
                                            value={horaInicio}
                                            onChange={(e) => setHoraInicio(e.target.value)}
                                            style={{ flex: 1, minWidth: '100px' }}
                                            disabled={loading}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Término</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <input
                                        type="date"
                                        value={dataFim}
                                        onChange={(e) => setDataFim(e.target.value)}
                                        style={{ flex: 1, minWidth: '150px' }}
                                        disabled={loading}
                                        required
                                    />
                                    {!diaInteiro && (
                                        <input
                                            type="time"
                                            value={horaFim}
                                            onChange={(e) => setHoraFim(e.target.value)}
                                            style={{ flex: 1, minWidth: '100px' }}
                                            disabled={loading}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-group mb-4" style={{ marginBottom: '16px' }}>
                        <label>Localização</label>
                        <div style={{ position: 'relative' }}>
                            <MapPin size={16} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                value={local}
                                onChange={(e) => setLocal(e.target.value)}
                                placeholder="Endereço físico, link do Meet ou Teams"
                                style={{ paddingLeft: '36px' }}
                                disabled={loading}
                            />
                        </div>
                        {local.trim().length > 0 && (
                            <a
                                href={`https://www.google.com/maps/search/?q=${encodeURIComponent(local.trim())}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', textDecoration: 'none', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.1)' }}
                            >
                                <Navigation size={12} color="var(--primary-red)" /> Abrir no Google Maps
                            </a>
                        )}
                    </div>

                    <div className="form-group mb-4" style={{ marginBottom: '16px', backgroundColor: 'var(--bg-main)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Video size={18} color="#00C473" />
                            <h4 style={{ margin: 0, fontWeight: 500 }}>Videochamada</h4>
                        </div>
                        {meetLink ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                                <a href={meetLink} target="_blank" rel="noopener noreferrer" style={{ color: '#039be5', textDecoration: 'underline', fontSize: '14px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {meetLink}
                                </a>
                                <button type="button" className="btn-icon" onClick={() => {
                                    navigator.clipboard.writeText(meetLink);
                                    toast.success('Link copiado!');
                                }} title="Copiar link">
                                    <Copy size={16} />
                                </button>
                            </div>
                        ) : (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginTop: '12px' }}>
                                <input
                                    type="checkbox"
                                    checked={gerarMeet}
                                    onChange={(e) => setGerarMeet(e.target.checked)}
                                    disabled={loading || eventoEdicao}
                                    style={{ accentColor: '#00C473' }}
                                />
                                Gerar link do Google Meet automaticamente ao salvar
                            </label>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Observações</label>
                        <div style={{ position: 'relative' }}>
                            <AlignLeft size={16} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
                            <textarea
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Mencionar pautas, links de convite adicionais..."
                                rows={3}
                                style={{ paddingLeft: '36px', resize: 'vertical' }}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            {eventoEdicao && onDelete && (
                                <button type="button" className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'var(--border-color)' }} onClick={() => onDelete(eventoEdicao.id)} disabled={loading}>
                                    Apagar Compromisso
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Sincronizando...' : (eventoEdicao ? 'Salvar Alterações' : 'Criar Compromisso')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
