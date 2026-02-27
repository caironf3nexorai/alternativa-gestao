import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

interface QRCodeModalProps {
    equipamentoNome: string;
    codigoPatrimonio: string;
    qrToken: string;
    onClose: () => void;
}

export function QRCodeModal({ equipamentoNome, codigoPatrimonio, qrToken, onClose }: QRCodeModalProps) {
    // A URL base que o QR Code vai apontar. Pode ser a origin atual.
    const baseUrl = window.location.origin;
    const qrUrl = `${baseUrl}/qr/${qrToken}`;
    const printRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(qrUrl);
        toast.success('Link do QR Code copiado!');
    }

    const handleDownloadLabel = async () => {
        if (!printRef.current) return;
        try {
            setDownloading(true);
            const canvas = await html2canvas(printRef.current, { scale: 3, backgroundColor: '#ffffff' });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `etiqueta-${codigoPatrimonio || 'equipamento'}.png`;
            link.href = dataUrl;
            link.click();
            toast.success('Etiqueta salva com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar PNG da etiqueta:', error);
            toast.error('Erro ao baixar a etiqueta.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            {/* Adicionando classe root-no-print para sumir os fundos na hora da impressão, 
                isso funciona se configurarmos o CSS global depois */}
            <div className="modal-content qr-modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                <div className="modal-header no-print">
                    <h2>QR Code - Equipamento</h2>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="print-area" ref={printRef} style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', background: '#fff', borderRadius: '8px' }}>

                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', margin: 0, paddingBottom: '4px', width: '100%' }}>
                        {equipamentoNome}
                    </h3>
                    <div style={{ fontSize: '14px', color: '#64748b', margin: 0, paddingBottom: '8px', borderBottom: '1px solid #eee', width: '100%' }}>
                        #{codigoPatrimonio}
                    </div>

                    <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <QRCodeSVG
                            value={qrUrl}
                            size={200}
                            bgColor={"#ffffff"}
                            fgColor={"#000000"}
                            level={"Q"}
                            includeMargin={false}
                        />
                    </div>

                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Escaneie para Solicitações Externas</p>

                </div>

                <div className="modal-actions no-print" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px', flexWrap: 'wrap' }}>
                    <button className="btn-secondary" onClick={handleDownloadLabel} disabled={downloading} style={{ justifyContent: 'center' }}>
                        <Download size={18} /> {downloading ? 'Gerando...' : 'Baixar Imagem'}
                    </button>
                    <button className="btn-secondary" onClick={handleCopyLink}>
                        Copiar Link
                    </button>
                    <button className="btn-primary" onClick={handlePrint} style={{ flex: 1, minWidth: '150px', justifyContent: 'center' }}>
                        <Printer size={18} /> Imprimir Etiqueta
                    </button>
                </div>

            </div>
        </div>
    );
}
