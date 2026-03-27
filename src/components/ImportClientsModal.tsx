import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface ImportClientsModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface ParsedRow {
    index: number;
    nome: string;
    cnpj: string;
    contato_nome: string;
    contato_telefone: string;
    contato_email: string;
    endereco: string;
    observacoes: string;
    isValid: boolean;
    errorReason?: string;
}

export function ImportClientsModal({ onClose, onSuccess }: ImportClientsModalProps) {
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [isUploaded, setIsUploaded] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const COL_NOME = 'Nome da Empresa';
    const COL_CNPJ = 'CNPJ';
    const COL_CONTATO = 'Nome do Contato';
    const COL_TELEFONE = 'Telefone';
    const COL_EMAIL = 'Email';
    const COL_ENDERECO = 'Endereço';
    const COL_OBS = 'Observações';

    const handleDownloadTemplate = () => {
        const wsData = [
            ["NÃO REMOVA OU ALTERE OS TÍTULOS DAS COLUNAS."], // Aviso
            [COL_NOME, COL_CNPJ, COL_CONTATO, COL_TELEFONE, COL_EMAIL, COL_ENDERECO, COL_OBS], // Header real
            ["Empresa Exemplo LTDA", "12.345.678/0001-90", "João Silva", "(11) 99999-9999", "joao@exemplo.com", "Rua das Flores, 123", "Cliente VIP"] // Linha exemplo
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Merge da primeira linha
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
        
        // Estilizar a primeira linha se pudesse, xlsx open source nao frita estilo facil mas o merge ajuda
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template_Clientes");
        
        XLSX.writeFile(wb, "Template_Importacao_Clientes.xlsx");
    };

    const cleanCnpj = (cnpj: string) => {
        if (!cnpj) return '';
        return String(cnpj).replace(/\D/g, '');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAnalyzing(true);
        setIsUploaded(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Read array of arrays to handle the offset message row
                const rawData = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
                
                // Find where the real header is (should be row 1, since row 0 is the warning)
                // We'll look for the row that has 'Nome da Empresa'
                let headerRowIndex = 1;
                for (let i = 0; i < Math.min(5, rawData.length); i++) {
                    const row = rawData[i];
                    if (row && row.includes(COL_NOME)) {
                        headerRowIndex = i;
                        break;
                    }
                }

                const headers = rawData[headerRowIndex] as string[];
                const dataRows = rawData.slice(headerRowIndex + 1);

                // Fetch all CNPJs from DB to avoid duplicates
                const { data: dbClientes, error: dbError } = await supabase.from('clientes').select('cnpj');
                if (dbError) throw dbError;

                const existingCnpjs = new Set(
                    (dbClientes || []).map(c => cleanCnpj(c.cnpj)).filter(Boolean)
                );

                const parsedRows: ParsedRow[] = [];
                const cnpjsInFile = new Set<string>();

                dataRows.forEach((row, index) => {
                    // Ignorar linhas 100% vazias
                    if (!row || row.length === 0 || row.every((c: unknown) => !c)) return;

                    // Mapeia por indice baseado no array de headers
                    const getCol = (colName: string) => {
                        const idx = headers.indexOf(colName);
                        return idx !== -1 ? (row[idx] || '') : '';
                    };

                    const nome = String(getCol(COL_NOME)).trim();
                    const rawCnpj = String(getCol(COL_CNPJ)).trim();
                    const cnpjLimpo = cleanCnpj(rawCnpj);
                    
                    let isValid = true;
                    let errorReason = '';

                    if (!nome) {
                        isValid = false;
                        errorReason = 'Nome da Empresa é obrigatório.';
                    } else if (cnpjLimpo && existingCnpjs.has(cnpjLimpo)) {
                        isValid = false;
                        errorReason = 'CNPJ já cadastrado no sistema.';
                    } else if (cnpjLimpo && cnpjsInFile.has(cnpjLimpo)) {
                        isValid = false;
                        errorReason = 'CNPJ duplicado nesta mesma planilha.';
                    }

                    if (cnpjLimpo) {
                        cnpjsInFile.add(cnpjLimpo);
                    }

                    parsedRows.push({
                        index: index + 1,
                        nome,
                        cnpj: rawCnpj,
                        contato_nome: String(getCol(COL_CONTATO)).trim(),
                        contato_telefone: String(getCol(COL_TELEFONE)).trim(),
                        contato_email: String(getCol(COL_EMAIL)).trim(),
                        endereco: String(getCol(COL_ENDERECO)).trim(),
                        observacoes: String(getCol(COL_OBS)).trim(),
                        isValid,
                        errorReason
                    });
                });

                setRows(parsedRows);
            } catch (error) {
                console.error(error);
                toast.error('Erro ao ler a planilha. Verifique o formato.');
                setIsUploaded(false);
            } finally {
                setAnalyzing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmImport = async () => {
        const validRows = rows.filter(r => r.isValid);
        if (validRows.length === 0) {
            toast.error('Não há linhas válidas para importar.');
            return;
        }

        try {
            setLoading(true);

            // Prepara payload pro batch insert
            const payload = validRows.map(r => ({
                nome: r.nome,
                cnpj: r.cnpj || null,
                contato_nome: r.contato_nome || null,
                contato_telefone: r.contato_telefone || null,
                contato_email: r.contato_email || null,
                endereco: r.endereco || null,
                observacoes: r.observacoes || null,
                ativo: true
            }));

            const { error } = await supabase.from('clientes').insert(payload);

            if (error) throw error;

            const errosCount = rows.length - validRows.length;
            toast.success(`${validRows.length} clientes importados com sucesso. ${errosCount} linhas ignoradas.`);
            
            onSuccess();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Erro ao importar clientes para o banco.');
        } finally {
            setLoading(false);
        }
    };

    const validCount = rows.filter(r => r.isValid).length;
    const errorCount = rows.filter(r => !r.isValid).length;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>Importar Clientes</h2>
                    <button className="btn-close" onClick={onClose} disabled={loading || analyzing}>
                        <X size={20} />
                    </button>
                </div>

                <div className="form-container" style={{ flex: 1, overflowY: 'auto' }}>
                    {!isUploaded ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', margin: '40px 0' }}>
                            <div style={{ textAlign: 'center', maxWidth: '400px', color: 'var(--text-secondary)' }}>
                                <p style={{ marginBottom: '16px' }}>
                                    Baixe o arquivo de template, preencha com seus dados usando Excel ou Google Sheets e faça o upload aqui.
                                </p>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button className="btn-secondary" onClick={handleDownloadTemplate} type="button">
                                    <Download size={18} /> Baixar Template
                                </button>

                                <div>
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls, .csv" 
                                        onChange={handleFileUpload} 
                                        style={{ display: 'none' }} 
                                        ref={fileInputRef}
                                    />
                                    <button className="btn-primary" onClick={() => fileInputRef.current?.click()} type="button">
                                        <Upload size={18} /> Fazer Upload
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {analyzing ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}>Analisando planilha...</div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#25D366' }}>
                                                <CheckCircle2 size={16} /> {validCount} válidos
                                            </span>
                                            {errorCount > 0 && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-red)' }}>
                                                    <AlertCircle size={16} /> {errorCount} {errorCount === 1 ? 'erro' : 'erros'}
                                                </span>
                                            )}
                                        </div>
                                        <button className="btn-secondary" onClick={() => setIsUploaded(false)} type="button" disabled={loading} style={{ padding: '6px 12px', fontSize: '13px' }}>
                                            Carregar outro arquivo
                                        </button>
                                    </div>

                                    <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        <table className="data-table">
                                            <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-secondary)' }}>
                                                <tr>
                                                    <th style={{ width: '40px' }}>#</th>
                                                    <th>Nome da Empresa</th>
                                                    <th>CNPJ</th>
                                                    <th>Contato</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map((row, i) => (
                                                    <tr key={i} style={{ backgroundColor: row.isValid ? 'transparent' : 'rgba(239, 68, 68, 0.05)' }}>
                                                        <td style={{ color: 'var(--text-secondary)' }}>{row.index}</td>
                                                        <td style={{ fontWeight: 500 }}>{row.nome || '-'}</td>
                                                        <td>{row.cnpj || '-'}</td>
                                                        <td>{row.contato_nome || '-'}</td>
                                                        <td>
                                                            {row.isValid ? (
                                                                <span className="status-badge badge-active" style={{ backgroundColor: 'rgba(37, 211, 102, 0.1)', color: '#25D366' }}>OK</span>
                                                            ) : (
                                                                <span className="status-badge badge-inactive" title={row.errorReason} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--primary-red)' }}>
                                                                    Erro
                                                                </span>
                                                            )}
                                                            {!row.isValid && <div style={{ fontSize: '11px', color: 'var(--primary-red)', marginTop: '4px' }}>{row.errorReason}</div>}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {rows.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Nenhum dado encontrado na planilha.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-actions" style={{ marginTop: '20px', padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    {isUploaded && !analyzing && rows.length > 0 && (
                        <button type="button" className="btn-primary" onClick={handleConfirmImport} disabled={loading || validCount === 0}>
                            {loading ? 'Importando...' : `Confirmar Importação (${validCount})`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
