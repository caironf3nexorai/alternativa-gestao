import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Database } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { checkMissingGmailScopes, getGoogleAuthUrl } from '../lib/googleAuth';
import { Mail, RefreshCw } from 'lucide-react';
import './Layout.css';

export function Layout() {
    const [dbConnected, setDbConnected] = useState<boolean | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [missingGmailScopes, setMissingGmailScopes] = useState(false);

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

        async function verifyScopes() {
            const missing = await checkMissingGmailScopes();
            setMissingGmailScopes(missing);
        }

        checkConnection();
        verifyScopes();
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
                    {missingGmailScopes && (
                        <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid var(--primary-color)', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Mail size={18} />
                                </div>
                                <div style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.5' }}>
                                    <strong style={{ display: 'block', fontSize: '15px', color: 'var(--primary-color)' }}>Nova funcionalidade disponível!</strong>
                                    Reconecte sua conta Google para ativar o módulo de Emails.
                                </div>
                            </div>
                            <button className="btn-primary" onClick={() => window.location.href = getGoogleAuthUrl(window.location.pathname)} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '36px', padding: '0 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                <RefreshCw size={14} /> Reconectar
                            </button>
                        </div>
                    )}
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
