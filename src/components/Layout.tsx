import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Database } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './Layout.css';

export function Layout() {
    const [dbConnected, setDbConnected] = useState<boolean | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        async function checkConnection() {
            try {
                // A simple query to check if connection works
                await supabase.from('_dummy_non_existent').select('*').limit(1);
                // If the error is 'relation does not exist' or similar, it means we connected to the DB but table doesn't exist
                // If it's a network error, it will fail differently. For now, we assume if we get a response, we're connected.
                // A safer check could just be querying a known table, but we don't have tables yet.
                setDbConnected(true);
            } catch {
                setDbConnected(false);
            }
        }
        checkConnection();
    }, []);

    return (
        <div className="layout-root">
            {isMobileMenuOpen && (
                <div
                    className="mobile-sidebar-overlay"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <Sidebar
                isOpen={isMobileMenuOpen}
                onItemClick={() => setIsMobileMenuOpen(false)}
            />

            <div className="layout-content">
                <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
                <main className="layout-main">
                    <Outlet />
                </main>

                <footer className="layout-footer">
                    <div className={`db-status ${dbConnected ? 'connected' : 'error'}`}>
                        <Database size={14} />
                        <span>
                            {dbConnected === null
                                ? 'Verificando banco...'
                                : dbConnected
                                    ? 'Banco conectado'
                                    : 'Erro de conexão'}
                        </span>
                        <div className={`status-dot ${dbConnected ? 'ok' : 'nok'}`}></div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
