
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { BarChart, Edit, Save, X, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import EmptyState from '@/components/EmptyState';

const OperationalCostsPage = () => {
    const { chartOfAccounts, refreshData } = useData();
    const { user } = useAuth();
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [newBudgets, setNewBudgets] = useState({});

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);

    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
    const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('id-ID', { month: 'long' }) }));

    const operationalAccounts = useMemo(() => {
        return chartOfAccounts.filter(acc => acc.code.startsWith('6'));
    }, [chartOfAccounts]);

    useEffect(() => {
        const fetchReport = async () => {
            if (!user) return;
            setLoading(true);
            const { data, error } = await supabase.rpc('get_operational_costs_report', {
                p_year: year,
                p_month: month,
                p_user_id: user.id
            });
            if (error) {
                toast({ variant: 'destructive', title: 'Gagal memuat laporan', description: error.message });
                setReportData([]);
            } else {
                setReportData(data || []);
            }
            setLoading(false);
        };
        fetchReport();
    }, [year, month, user]);

    const handleEdit = (accountId) => {
        const rowData = reportData.find(r => r.account_id === accountId);
        setEditingRow(accountId);
        setNewBudgets(prev => ({ ...prev, [accountId]: rowData.budgeted_amount }));
    };

    const handleCancel = () => {
        setEditingRow(null);
        setNewBudgets({});
    };

    const handleSave = async (accountId) => {
        const newAmount = newBudgets[accountId];
        if (newAmount === undefined || newAmount < 0) {
            toast({ variant: 'destructive', title: 'Nilai tidak valid', description: 'Anggaran harus berupa angka positif.' });
            return;
        }

        const { error } = await supabase
            .from('standard_operational_costs')
            .upsert({
                account_id: accountId,
                year: year,
                month: month,
                budgeted_amount: newAmount,
                user_id: user.id
            }, { onConflict: 'account_id,year,month,user_id' });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal menyimpan anggaran', description: error.message });
        } else {
            toast({ title: 'Sukses', description: 'Anggaran berhasil diperbarui.' });
            setEditingRow(null);
            setNewBudgets({});
            // Refetch data
            const { data, error: fetchError } = await supabase.rpc('get_operational_costs_report', { p_year: year, p_month: month, p_user_id: user.id });
            if (!fetchError) setReportData(data);
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);

    const totals = useMemo(() => {
        return reportData.reduce((acc, row) => {
            acc.budgeted += Number(row.budgeted_amount);
            acc.actual += Number(row.actual_amount);
            acc.variance += Number(row.variance);
            return acc;
        }, { budgeted: 0, actual: 0, variance: 0 });
    }, [reportData]);

    return (
        <>
            <Helmet>
                <title>Standar Biaya Operasional - Sistem Keuangan</title>
                <meta name="description" content="Kelola dan monitor anggaran biaya operasional." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Standar Biaya Operasional</h1>
                        <p className="text-gray-500">Atur anggaran untuk setiap akun biaya operasional dan bandingkan dengan realisasi.</p>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select value={year} onValueChange={(val) => setYear(Number(val))}>
                                <SelectTrigger><SelectValue placeholder="Pilih Tahun..." /></SelectTrigger>
                                <SelectContent>
                                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={month} onValueChange={(val) => setMonth(Number(val))}>
                                <SelectTrigger><SelectValue placeholder="Pilih Bulan..." /></SelectTrigger>
                                <SelectContent>
                                    {months.map(m => <SelectItem key={m.value} value={m.value}>{m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Laporan Anggaran vs Realisasi</CardTitle>
                        <CardDescription>Periode: {months.find(m => m.value === month)?.name} {year}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-3 text-left font-medium text-gray-600">Kode Akun</th>
                                        <th className="p-3 text-left font-medium text-gray-600">Nama Akun</th>
                                        <th className="p-3 text-right font-medium text-gray-600">Anggaran</th>
                                        <th className="p-3 text-right font-medium text-gray-600">Realisasi</th>
                                        <th className="p-3 text-right font-medium text-gray-600">Varian</th>
                                        <th className="p-3 text-center font-medium text-gray-600">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="6" className="text-center p-6 text-gray-500">Memuat data...</td></tr>
                                    ) : reportData.length > 0 ? (
                                        reportData.map((row, index) => (
                                            <motion.tr
                                                key={row.account_id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="border-b hover:bg-gray-50"
                                            >
                                                <td className="p-3">{row.account_code}</td>
                                                <td className="p-3 font-medium">{row.account_name}</td>
                                                <td className="p-3 text-right">
                                                    {editingRow === row.account_id ? (
                                                        <Input
                                                            type="number"
                                                            value={newBudgets[row.account_id] || ''}
                                                            onChange={(e) => setNewBudgets(prev => ({ ...prev, [row.account_id]: e.target.value }))}
                                                            className="text-right h-8"
                                                        />
                                                    ) : (
                                                        formatCurrency(row.budgeted_amount)
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">{formatCurrency(row.actual_amount)}</td>
                                                <td className={`p-3 text-right font-medium ${row.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {formatCurrency(row.variance)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {editingRow === row.account_id ? (
                                                        <div className="flex justify-center gap-2">
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-100" onClick={() => handleSave(row.account_id)}><Save className="h-4 w-4" /></Button>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500 hover:bg-gray-100" onClick={handleCancel}><X className="h-4 w-4" /></Button>
                                                        </div>
                                                    ) : (
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-100" onClick={() => handleEdit(row.account_id)}><Edit className="h-4 w-4" /></Button>
                                                    )}
                                                </td>
                                            </motion.tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="6" className="text-center p-0"><EmptyState icon={BarChart} title="Tidak Ada Data" description="Tidak ada data biaya operasional untuk periode yang dipilih." /></td></tr>
                                    )}
                                </tbody>
                                {reportData.length > 0 && (
                                    <tfoot className="font-bold bg-gray-100">
                                        <tr>
                                            <td colSpan="2" className="p-3 text-left">Total</td>
                                            <td className="p-3 text-right">{formatCurrency(totals.budgeted)}</td>
                                            <td className="p-3 text-right">{formatCurrency(totals.actual)}</td>
                                            <td className={`p-3 text-right ${totals.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totals.variance)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default OperationalCostsPage;
  