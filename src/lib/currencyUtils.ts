// Adicionar formatador de Moeda
export const formatCurrency = (value: string | number) => {
    const numericValue = typeof value === 'string' ? value.replace(/\D/g, '') : value.toString();
    if (!numericValue) return '';

    const amount = parseFloat(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(amount);
};

// Converte valor monetário formatado de volta para numérico antes de salvar no DB
export const parseCurrency = (value: string) => {
    const numericString = value.replace(/\D/g, '');
    if (!numericString) return 0;
    return parseFloat(numericString) / 100;
};
