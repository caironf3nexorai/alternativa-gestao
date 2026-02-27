import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Clientes } from './pages/Clientes';
import { Equipamentos } from './pages/Equipamentos';
import { Patrimonio } from './pages/Patrimonio';
import { Agendas } from './pages/Agendas';
import { Compromissos } from './pages/Compromissos';
import { Configuracoes } from './pages/Configuracoes';
import { SolicitacaoPublica } from './pages/SolicitacaoPublica';
import { SettingsProvider } from './hooks/useSettings';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border-color)' },
        success: { iconTheme: { primary: 'var(--success)', secondary: '#fff' } },
        error: { iconTheme: { primary: 'var(--error)', secondary: '#fff' } }
      }} />
      <SettingsProvider>
        <Routes>
          {/* Rota Pública do QR Code (Fora do Layout interno da plataforma) */}
          <Route path="/qr/:token" element={<SolicitacaoPublica />} />

          {/* Rotas Privadas (Com Menu Lateral) */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="equipamentos" element={<Equipamentos />} />
            <Route path="/patrimonio" element={<Patrimonio />} />
            <Route path="/agendas" element={<Agendas />} />
            <Route path="/compromissos" element={<Compromissos />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<div>Página não encontrada</div>} />
          </Route>
        </Routes>
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;
