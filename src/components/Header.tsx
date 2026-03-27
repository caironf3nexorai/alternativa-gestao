import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './Header.css';

const routeNames: Record<string, string> = {
    '/': 'Dashboard',
    '/clientes': 'Clientes',
    '/equipamentos': 'Equipamentos',
    '/patrimonio': 'Patrimônio',
    '/agendas': 'Agendas',
    '/compromissos': 'Compromissos',
    '/configuracoes': 'Configurações',
    '/contratos': 'Contratos',
};

interface HeaderProps {
    onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    const location = useLocation();
    let pageTitle = routeNames[location.pathname];
    
    if (!pageTitle) {
        if (location.pathname.startsWith('/contratos/')) {
            pageTitle = 'Detalhes do Contrato';
        } else {
            pageTitle = 'Página Não Encontrada';
        }
    }

    const currentDate = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    // Capitalize first letter
    const formattedDate = currentDate.charAt(0).toUpperCase() + currentDate.slice(1);

    return (
        <header className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button className="mobile-menu-btn" onClick={onMenuClick}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <h1 className="page-title">{pageTitle}</h1>
            </div>
            <div className="page-date">{formattedDate}</div>
        </header>
    );
}
