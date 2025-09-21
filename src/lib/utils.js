import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as fnsFormat } from 'date-fns';
import { id } from 'date-fns/locale';

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (amount) => {
    if (typeof amount !== 'number') {
        amount = Number(amount) || 0;
    }
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        return fnsFormat(new Date(dateStr), "d MMMM yyyy", { locale: id });
    } catch (error) {
        console.error("Invalid date format:", dateStr, error);
        return 'Tanggal tidak valid';
    }
};