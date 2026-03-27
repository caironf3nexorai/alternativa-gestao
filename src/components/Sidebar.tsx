import { LayoutDashboard, Users, Wrench, Package, Book, Calendar, Settings, FileText } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import './Sidebar.css';

interface SidebarProps {
    onItemClick?: () => void;
    isOpen?: boolean;
}

export function Sidebar({ onItemClick, isOpen }: SidebarProps) {
    const { logoUrl, empresaNome } = useSettings();
    const menuItems = [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
        { name: 'Clientes', path: '/clientes', icon: <Users size={20} /> },
        { name: 'Contratos', path: '/contratos', icon: <FileText size={20} /> },
        { name: 'Equipamentos', path: '/equipamentos', icon: <Wrench size={20} /> },
        { name: 'Patrimônio', path: '/patrimonio', icon: <Package size={20} /> },
        { name: 'Agendas', path: '/agendas', icon: <Book size={20} /> },
        { name: 'Compromissos', path: '/compromissos', icon: <Calendar size={20} /> },
        { name: 'Configurações', path: '/configuracoes', icon: <Settings size={20} /> },
    ];

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                {logoUrl ? (
                    <img src={logoUrl} alt="Logo da Empresa" className="sidebar-logo-image" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                    <div className="logo-placeholder"></div>
                )}
                <div className="logo-text">{empresaNome || 'Alternativa'}<br /><span>Gestão</span></div>
            </div>
            <nav className="sidebar-nav">
                <ul>
                    {menuItems.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                onClick={onItemClick}
                                className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
                            >
                                {item.icon}
                                <span>{item.name}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
}
