import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Download, UploadCloud, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import * as xlsx from 'xlsx';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ParsedRow {
    index: number;
    codigo_patrimonio: string;
    nome: string;
    tag: string;
    categoria: string;
    status_raw: string;
    valor_raw: string;
    data_raw: string;
    descricao: string;
    observacoes: string;

    // Parsed and validated
    _errors: string[];
    _normalizedStatus?: string;
    _parsedValor?: number | null;
    _parsedDate?: string | null;
}

export function ImportacaoEquipamentosModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [summary, setSummary] = useState<{ totais: number, validos: number, erros: number } | null>(null);

    // Estado pós-importação
    const [importResult, setImportResult] = useState<{ success: number, ignored: number } | null>(null);

    // Dicionário de Categorias Existentes (nome_lower_case -> id)
    const [mapaCategorias, setMapaCategorias] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            fetchCategorias();
            setPreviewData([]);
            setSummary(null);
            setImportResult(null);
        }
    }, [isOpen]);

    const fetchCategorias = async () => {
        const { data, error } = await supabase.from('categorias_equipamento').select('id, nome');
        if (!error && data) {
            const map: Record<string, string> = {};
            data.forEach(c => {
                map[c.nome.trim().toLowerCase()] = c.id;
            });
            setMapaCategorias(map);
        }
    };

    if (!isOpen) return null;

    // --- 1. DOWNLOAD TEMPLATE ---
    const handleDownloadTemplate = () => {
        const headers = [
            "Código de Patrimônio",
            "Nome do Equipamento",
            "TAG",
            "Categoria",
            "Status",
            "Valor de Aquisição",
            "Data de Aquisição (dd/mm/aaaa)",
            "Descrição",
            "Observações"
        ];

        const exampleRow = [
            "PAT-001",
            "Furadeira de Impacto Bosch",
            "OBRA-A",
            "Ferramentas Elétricas",
            "Disponível",
            "450.00",
            "22/02/2025",
            "Furadeira 220V com maleta",
            ""
        ];

        const instructionRow = [
            "",
            "",
            "",
            "",
            "Valores aceitos: disponivel, alugado, manutencao, baixado",
            "",
            "",
            "",
            ""
        ];

        const ws = xlsx.utils.aoa_to_sheet([headers, exampleRow, instructionRow]);

        // Auto-sizing columns roughly
        ws['!cols'] = [
            { wch: 20 }, // Código de Patrimônio
            { wch: 30 }, // Nome do Equipamento
            { wch: 15 }, // TAG
            { wch: 20 }, // Categoria
            { wch: 15 }, // Status
            { wch: 20 }, // Valor de Aquisição
            { wch: 20 }, // Data de Aquisição
            { wch: 40 }, // Descrição
            { wch: 30 }, // Observações
        ];


        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Template_Equipamentos");
        xlsx.writeFile(wb, "Template_Importacao_Equipamentos.xlsx");
    };

    // --- 2. UPLOAD & PARSING ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setImportResult(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = xlsx.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Convert to array of arrays
                const data = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (data.length <= 1) {
                    toast.error("O arquivo está vazio ou contém apenas o cabeçalho.");
                    setIsProcessing(false);
                    return;
                }

                // Parse and validate logic
                const parsedRows: ParsedRow[] = [];
                let validCount = 0;
                let errorCount = 0;

                // Start from index 1 (skipping header)
                for (let i = 1; i < data.length; i++) {
                    const row = data[i];
                    // Skip completely empty rows
                    if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
                        continue;
                    }

                    const codigoRaw = String(row[0] || '').trim();
                    const nomeRaw = String(row[1] || '').trim();
                    const tagRaw = String(row[2] || '').trim();
                    const categoriaRaw = String(row[3] || '').trim();
                    const statusRaw = String(row[4] || '').trim();
                    const valorRaw = String(row[5] || '').trim();
                    const dataRaw = String(row[6] || '').trim();
                    const descRaw = String(row[7] || '').trim();
                    const obsRaw = String(row[8] || '').trim();

                    const errors: string[] = [];

                    // 1. Validate Nome (Required)
                    if (!nomeRaw) {
                        errors.push("Nome do equipamento é obrigatório.");
                    }

                    // 2. Validate & Normalize Status
                    let normalizedStatus = 'disponivel';
                    if (statusRaw) {
                        const sLower = statusRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        if (sLower === 'disponivel' || sLower === 'alugado' || sLower === 'manutencao' || sLower === 'baixado') {
                            normalizedStatus = sLower;
                        } else {
                            errors.push("Status inválido (use: disponivel, alugado, manutencao, baixado).");
                        }
                    }

                    // 3. Validate Valor (Must be numeric if present)
                    let parsedValor: number | null = null;
                    if (valorRaw) {
                        // Handle R$ and comma decimals
                        const cleanStr = valorRaw.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                        const num = parseFloat(cleanStr);
                        if (isNaN(num)) {
                            errors.push("Valor não é numérico.");
                        } else {
                            parsedValor = num;
                        }
                    }

                    // 4. Validate Data — aceita dd/mm/aaaa, ddmmaaaa ou aaaa-mm-dd
                    let parsedDate: string | null = null;
                    if (dataRaw) {
                        let day: number | undefined, month: number | undefined, year: number | undefined;

                        if (dataRaw.includes('/')) {
                            // dd/mm/aaaa
                            const parts = dataRaw.split('/');
                            if (parts.length === 3) {
                                day = parseInt(parts[0], 10);
                                month = parseInt(parts[1], 10);
                                year = parseInt(parts[2], 10);
                            }
                        } else if (dataRaw.includes('-')) {
                            // aaaa-mm-dd
                            const parts = dataRaw.split('-');
                            if (parts.length === 3 && parts[0].length === 4) {
                                year = parseInt(parts[0], 10);
                                month = parseInt(parts[1], 10);
                                day = parseInt(parts[2], 10);
                            }
                        } else if (/^\d{8}$/.test(dataRaw)) {
                            // ddmmaaaa sem separadores
                            day = parseInt(dataRaw.slice(0, 2), 10);
                            month = parseInt(dataRaw.slice(2, 4), 10);
                            year = parseInt(dataRaw.slice(4, 8), 10);
                        } else if (!isNaN(Number(dataRaw))) {
                            // Serial do Excel
                            const dateObj = new Date((parseInt(dataRaw) - (25567 + 1)) * 86400 * 1000);
                            day = dateObj.getUTCDate();
                            month = dateObj.getUTCMonth() + 1;
                            year = dateObj.getUTCFullYear();
                        }

                        const isValid = day && month && year &&
                            !isNaN(day) && !isNaN(month) && !isNaN(year) &&
                            month >= 1 && month <= 12 &&
                            day >= 1 && day <= 31 &&
                            year >= 1900 && year <= 2100;

                        if (isValid) {
                            parsedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        } else {
                            errors.push("Data inválida. Use dd/mm/aaaa, ddmmaaaa ou aaaa-mm-dd.");
                        }
                    }

                    if (errors.length > 0) errorCount++;
                    else validCount++;

                    parsedRows.push({
                        index: i + 1, // Excel row number
                        codigo_patrimonio: codigoRaw,
                        nome: nomeRaw,
                        tag: tagRaw,
                        categoria: categoriaRaw,
                        status_raw: statusRaw,
                        valor_raw: valorRaw,
                        data_raw: dataRaw,
                        descricao: descRaw,
                        observacoes: obsRaw,
                        _errors: errors,
                        _normalizedStatus: normalizedStatus,
                        _parsedValor: parsedValor,
                        _parsedDate: parsedDate
                    });
                }

                setPreviewData(parsedRows);
                setSummary({ totais: parsedRows.length, validos: validCount, erros: errorCount });

            } catch (err) {
                console.error(err);
                toast.error("Erro ao analisar o arquivo. Verifique se é um XLSX ou CSV válido.");
            } finally {
                setIsProcessing(false);
                // Reset file input
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- 3. EXECUTAR IMPORTAÇÃO ---
    const handleImportar = async () => {
        const validRows = previewData.filter(r => r._errors.length === 0);
        if (validRows.length === 0) {
            toast.error("Nenhuma linha válida para importar.");
            return;
        }

        setIsImporting(true);

        try {
            // Passo 1: Descobrir e criar categorias inexistentes
            const categoriasSet = new Set<string>();
            validRows.forEach(r => {
                if (r.categoria) categoriasSet.add(r.categoria.trim());
            });

            // Usamos um clone do map para não ter corrida de dados
            const currentCache = { ...mapaCategorias };

            for (const catName of Array.from(categoriasSet)) {
                const lower = catName.toLowerCase();
                if (!currentCache[lower]) {
                    // Categoria precisa ser criada
                    const { data: newCat, error: catErr } = await supabase
                        .from('categorias_equipamento')
                        .insert({ nome: catName })
                        .select()
                        .single();

                    if (newCat && !catErr) {
                        currentCache[lower] = newCat.id;
                    }
                }
            }

            // Atualiza o cache principal se criamos novas
            setMapaCategorias(currentCache);

            // Passo 2: Construir payload final do Supabase
            const payload = validRows.map(r => ({
                codigo_patrimonio: r.codigo_patrimonio || null,
                nome: r.nome,
                tag: r.tag || null,
                categoria_id: r.categoria ? currentCache[r.categoria.trim().toLowerCase()] : null,
                status: r._normalizedStatus || 'disponivel',
                valor_aquisicao: r._parsedValor !== null ? r._parsedValor : null,
                data_aquisicao: r._parsedDate || null,
                descricao: r.descricao || null,
                observacoes: r.observacoes || null
            }));

            // Passo 3: Bulk Insert
            const { error: insError } = await supabase
                .from('equipamentos')
                .insert(payload);

            if (insError) throw insError;

            // Sucesso!
            setImportResult({
                success: validRows.length,
                ignored: summary?.erros || 0
            });

            // Notificamos sucesso e limpamos prévia, o usuário agora vê a tela de conclusão final e fecha
            toast.success('Importação concluída com sucesso!');
            setPreviewData([]);
            setSummary(null);
            onSuccess(); // Dispara fechamento lá do pai ou refresh na tela

        } catch (err: any) {
            console.error(err);
            toast.error("Falha ao salvar no banco de dados.");
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '900px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>Importação de Equipamentos</h2>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {importResult ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '16px' }} />
                            <h3>Importação Finalizada!</h3>
                            <p style={{ marginTop: '12px', fontSize: '15px' }}>
                                <strong style={{ color: 'var(--success)' }}>{importResult.success}</strong> equipamentos inseridos com sucesso.<br />
                                {importResult.ignored > 0 && <span style={{ color: 'var(--error)' }}>{importResult.ignored} linhas com erros foram ignoradas.</span>}
                            </p>
                            <button className="btn-primary" onClick={onClose} style={{ marginTop: '24px', margin: 'auto' }}>
                                Fechar e Ver Listagem
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* AÇÕES DE ARQUIVO */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', backgroundColor: 'var(--bg-main)' }}>
                                    <div style={{ marginBottom: '12px' }}><Download size={32} color="var(--primary-red)" /></div>
                                    <h4 style={{ marginBottom: '8px' }}>1. Baixe o Modelo</h4>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                        Preencha a planilha modelo com os seus dados respeitando as colunas.
                                    </p>
                                    <button className="btn-secondary" onClick={handleDownloadTemplate} style={{ margin: 'auto' }}>
                                        Baixar Template XLSX
                                    </button>
                                </div>

                                <div style={{ padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', backgroundColor: 'var(--bg-main)', position: 'relative' }}>
                                    <div style={{ marginBottom: '12px' }}><UploadCloud size={32} color="#3498db" /></div>
                                    <h4 style={{ marginBottom: '8px' }}>2. Faça o Upload</h4>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                        Selecione o arquivo Excel ou CSV preenchido para validação.
                                    </p>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        className="btn-primary"
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{ margin: 'auto' }}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? 'Lendo...' : 'Selecionar Arquivo'}
                                    </button>
                                </div>
                            </div>

                            {/* PREVIEW */}
                            {summary && (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                    <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0, fontSize: '15px' }}>Pré-visualização de Importação</h4>
                                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', fontWeight: 600 }}>
                                            <span style={{ color: 'var(--success)' }}>Válidos: {summary.validos}</span>
                                            {summary.erros > 0 && <span style={{ color: 'var(--error)' }}>Com Erros: {summary.erros}</span>}
                                        </div>
                                    </div>

                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        <table className="data-table" style={{ margin: 0 }}>
                                            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                                <tr>
                                                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                                    <th>Código</th>
                                                    <th>Nome *</th>
                                                    <th>Status</th>
                                                    <th>Categoria</th>
                                                    <th>Erros Encontrados</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.map((row, idx) => (
                                                    <tr key={idx} style={{ backgroundColor: row._errors.length > 0 ? 'rgba(231, 76, 60, 0.05)' : 'transparent' }}>
                                                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.index}</td>
                                                        <td>{row.codigo_patrimonio}</td>
                                                        <td style={{ fontWeight: 600 }}>{row.nome || '-'}</td>
                                                        <td>
                                                            {row.status_raw ? (
                                                                <span className={`status-badge ${row._errors.some(e => e.includes('Status inválido')) ? 'badge-baixado' : `badge-${row._normalizedStatus}`}`}>
                                                                    {row.status_raw}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td>{row.categoria || '-'}</td>
                                                        <td>
                                                            {row._errors.length > 0 ? (
                                                                <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--error)', fontSize: '12px' }}>
                                                                    {row._errors.map((e, i) => <li key={i}>{e}</li>)}
                                                                </ul>
                                                            ) : (
                                                                <span style={{ color: 'var(--success)', fontSize: '12px' }}><CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> OK</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* MODAL FOOTER */}
                {!importResult && summary && (
                    <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {summary.erros > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={16} color="var(--error)" />
                                    Linhas com erro serão ignoradas. Novas categorias serão criadas.
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn-secondary" onClick={onClose} disabled={isImporting}>Cancelar</button>
                            <button
                                className="btn-primary"
                                onClick={handleImportar}
                                disabled={isImporting || summary.validos === 0}
                            >
                                {isImporting ? 'Importando...' : `Confirmar Importação (${summary.validos})`}
                                {!isImporting && <ChevronRight size={18} style={{ marginLeft: '4px' }} />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
