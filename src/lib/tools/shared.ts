export function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

export function getCurrentYear() {
  return new Date().getFullYear();
}

export const CURRENT_YEAR = getCurrentYear();

export function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function normalizeToolText(text: string) {
  return typeof text === 'string' ? text.trim() : '';
}
