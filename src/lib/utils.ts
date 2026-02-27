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
