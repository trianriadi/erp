
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Download, FileText, FileSpreadsheet, Calendar as CalendarIcon, BarChart2 } from 'lucide-react';
import { format as formatDateFn, startOfMonth, endOfMonth } from 'date-fns';
import { id as dateFnsId } from 'date-fns/locale';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import EmptyState from '@/components/EmptyState';

const FinancialReportsPage = () => {
    const { user } = useAuth();
    const [dateRange, setDateRange] = useState({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            if (!dateRange.from || !dateRange.to || !user) return;
            setLoading(true);
            const { data, error } = await supabase.rpc('get_financial_report', {
                p_start_date: formatDateFn(dateRange.from, 'yyyy-MM-dd'),
                p_end_date: formatDateFn(dateRange.to, 'yyyy-MM-dd'),
                p_user_id: user.id
            });

            if (error) {
                toast({ variant: 'destructive', title: 'Gagal memuat laporan', description: error.message });
                setReportData(null);
            } else {
                setReportData(data);
            }
            setLoading(false);
        };
        fetchReport();
    }, [dateRange, user]);

    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);

    const ProfitLossReport = ({ data }) => {
        if (!data) return <p>Memuat data...</p>;
        const { summary, details } = data;
        const pendapatanDetails = details?.filter(d => d.type === 'Pendapatan') || [];
        const bebanDetails = details?.filter(d => d.type === 'Beban') || [];

        return (
            <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Ringkasan Laba Rugi</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Pendapatan</span><span>{formatCurrency(summary.pendapatan)}</span></div>
                        <div className="flex justify-between"><span>Harga Pokok Penjualan (HPP)</span><span>({formatCurrency(summary.hpp)})</span></div>
                        <div className="flex justify-between font-semibold border-t pt-1"><span>Laba Kotor</span><span>{formatCurrency(summary.laba_kotor)}</span></div>
                        <div className="flex justify-between mt-2"><span>Beban Operasional</span><span>({formatCurrency(summary.beban_operasional)})</span></div>
                        <div className="flex justify-between font-semibold border-t pt-1"><span>Laba Usaha</span><span>{formatCurrency(summary.laba_usaha)}</span></div>
                        <div className="flex justify-between mt-2"><span>Pendapatan Lain-lain</span><span>{formatCurrency(summary.pendapatan_lain)}</span></div>
                        <div className="flex justify-between"><span>Beban Lain-lain</span><span>({formatCurrency(summary.beban_lain)})</span></div>
                        <div className="flex justify-between font-bold text-lg border-t-2 pt-2 mt-2"><span>Laba Bersih</span><span>{formatCurrency(summary.laba_bersih)}</span></div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold mb-2">Detail Pendapatan</h3>
                        {pendapatanDetails.length > 0 ? (
                            pendapatanDetails.map(item => <div key={item.code} className="flex justify-between text-sm"><span>{item.name}</span><span>{formatCurrency(item.amount)}</span></div>)
                        ) : <p className="text-sm text-gray-500">Tidak ada pendapatan.</p>}
                    </div>
                    <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold mb-2">Detail Beban</h3>
                        {bebanDetails.length > 0 ? (
                            bebanDetails.map(item => <div key={item.code} className="flex justify-between text-sm"><span>{item.name}</span><span>{formatCurrency(item.amount)}</span></div>)
                        ) : <p className="text-sm text-gray-500">Tidak ada beban.</p>}
                    </div>
                </div>
            </div>
        );
    };

    const BalanceSheetReport = ({ data }) => {
        if (!data) return <p>Memuat data...</p>;
        const { aset, kewajiban, ekuitas, laba_ditahan_awal, laba_berjalan } = data;
        const totalAset = aset?.reduce((sum, item) => sum + Number(item.balance), 0) || 0;
        const totalKewajiban = kewajiban?.reduce((sum, item) => sum + Number(item.balance), 0) || 0;
        const totalModal = ekuitas?.reduce((sum, item) => sum + Number(item.balance), 0) || 0;
        const totalLabaDitahan = laba_ditahan_awal + laba_berjalan;
        const totalEkuitas = totalModal + totalLabaDitahan;
        const totalKewajibanDanEkuitas = totalKewajiban + totalEkuitas;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Aset</h3>
                    {aset?.map(item => <div key={item.code} className="flex justify-between text-sm"><span>{item.name}</span><span>{formatCurrency(item.balance)}</span></div>)}
                    <div className="flex justify-between font-bold border-t pt-2"><span>Total Aset</span><span>{formatCurrency(totalAset)}</span></div>
                </div>
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Kewajiban & Ekuitas</h3>
                    <h4 className="font-medium">Kewajiban</h4>
                    {kewajiban?.map(item => <div key={item.code} className="flex justify-between text-sm"><span>{item.name}</span><span>{formatCurrency(item.balance)}</span></div>)}
                    <div className="flex justify-between font-semibold border-t pt-2"><span>Total Kewajiban</span><span>{formatCurrency(totalKewajiban)}</span></div>
                    
                    <h4 className="font-medium mt-4">Ekuitas</h4>
                    {ekuitas?.map(item => <div key={item.code} className="flex justify-between text-sm"><span>{item.name}</span><span>{formatCurrency(item.balance)}</span></div>)}
                    <div className="flex justify-between text-sm"><span>Laba Ditahan</span><span>{formatCurrency(totalLabaDitahan)}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-2"><span>Total Ekuitas</span><span>{formatCurrency(totalEkuitas)}</span></div>

                    <div className="flex justify-between font-bold border-t-2 pt-2 mt-4"><span>Total Kewajiban & Ekuitas</span><span>{formatCurrency(totalKewajibanDanEkuitas)}</span></div>
                </div>
            </div>
        );
    };

    return (
        <>
            <Helmet>
                <title>Laporan Keuangan - Sistem Keuangan</title>
                <meta name="description" content="Lihat laporan laba rugi dan neraca keuangan perusahaan." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan</h1>
                        <p className="text-gray-500">Analisis kesehatan finansial perusahaan Anda.</p>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-6 flex flex-col md:flex-row gap-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className="w-full md:w-auto justify-start text-left font-normal bg-white">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (dateRange.to ? (<>{formatDateFn(dateRange.from, "d LLL y")} - {formatDateFn(dateRange.to, "d LLL y")}</>) : (formatDateFn(dateRange.from, "d LLL y"))) : (<span>Pilih tanggal</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full md:w-auto"><Download className="h-4 w-4 mr-2" /> Ekspor</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2">
                                <div className="flex flex-col space-y-1">
                                    <Button variant="ghost" className="justify-start"><FileSpreadsheet className="h-4 w-4 mr-2" />Ekspor ke Excel</Button>
                                    <Button variant="ghost" className="justify-start"><FileText className="h-4 w-4 mr-2" />Ekspor ke PDF</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </CardContent>
                </Card>

                <Tabs defaultValue="profit-loss" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="profit-loss">Laba Rugi</TabsTrigger>
                        <TabsTrigger value="balance-sheet">Neraca</TabsTrigger>
                    </TabsList>
                    <TabsContent value="profit-loss">
                        <Card>
                            <CardHeader>
                                <CardTitle>Laporan Laba Rugi</CardTitle>
                                <CardDescription>Periode: {dateRange.from && formatDateFn(dateRange.from, 'd MMM yyyy')} - {dateRange.to && formatDateFn(dateRange.to, 'd MMM yyyy')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? <p>Memuat laporan...</p> : reportData ? <ProfitLossReport data={reportData.profit_loss} /> : <EmptyState icon={BarChart2} title="Tidak Ada Data" description="Tidak ada data untuk ditampilkan pada periode yang dipilih." />}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="balance-sheet">
                        <Card>
                            <CardHeader>
                                <CardTitle>Laporan Posisi Keuangan (Neraca)</CardTitle>
                                <CardDescription>Per tanggal: {dateRange.to && formatDateFn(dateRange.to, 'd MMMM yyyy')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? <p>Memuat laporan...</p> : reportData ? <BalanceSheetReport data={reportData.balance_sheet} /> : <EmptyState icon={BarChart2} title="Tidak Ada Data" description="Tidak ada data untuk ditampilkan pada periode yang dipilih." />}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
};

export default FinancialReportsPage;
  