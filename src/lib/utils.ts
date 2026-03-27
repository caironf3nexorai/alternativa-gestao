// Formata CNPJ: XX.XXX.XXX/XXXX-XX
export const formatCnpj = (value: string) => {
    const cnpj = value.replace(/\D/g, '');
    return cnpj
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,4})/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})/, '$1-$2')
        .substring(0, 18);
};

// Formata Telefone: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
export const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, '');
    if (phone.length <= 10) {
        return phone
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .substring(0, 14);
    }
    return phone
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .substring(0, 15);
};

export const isValidEmail = (email: string) => {
    if (!email) return true; // Se for vazio não invalida pois pode não ser obrigatorio
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
};

export const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(num);
};

export const formatDateBR = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return new Intl.DateTimeFormat('pt-BR').format(correctedDate);
};
