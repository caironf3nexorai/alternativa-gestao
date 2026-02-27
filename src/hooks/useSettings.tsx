import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface SettingsContextType {
    logoUrl: string;
    empresaNome: string;
    usuarioNome: string;
    fusoHorario: string;
    isLoading: boolean;
    refetchSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [logoUrl, setLogoUrl] = useState('');
    const [empresaNome, setEmpresaNome] = useState('Gestão');
    const [usuarioNome, setUsuarioNome] = useState('');
    const [fusoHorario, setFusoHorario] = useState('America/Sao_Paulo');
    const [isLoading, setIsLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('configuracoes')
                .select('*')
                .in('chave', ['logo_url', 'empresa_nome', 'usuario_nome', 'fuso_horario']);

            if (error) throw error;

            if (data && data.length > 0) {
                const settingsMap = data.reduce((acc, curr) => ({ ...acc, [curr.chave]: curr.valor }), {} as any);
                if (settingsMap['logo_url']) setLogoUrl(settingsMap['logo_url']);
                if (settingsMap['empresa_nome']) setEmpresaNome(settingsMap['empresa_nome']);
                if (settingsMap['usuario_nome']) setUsuarioNome(settingsMap['usuario_nome']);
                if (settingsMap['fuso_horario']) setFusoHorario(settingsMap['fuso_horario']);
            }
        } catch (error) {
            console.error('Erro ao buscar configurações globais:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    return (
        <SettingsContext.Provider value={{ logoUrl, empresaNome, usuarioNome, fusoHorario, isLoading, refetchSettings: fetchSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings deve ser usado dentro de um SettingsProvider');
    }
    return context;
}
