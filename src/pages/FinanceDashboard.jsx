import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, TrendingDown, Landmark, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Link } from 'react-router-dom';

const FinanceDashboard = () => {
    const { accounts, transactions, accountsPayable, loading: dataLoading } = useData();
    const { user } = useAuth();
    const [chartData, setChartData] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('monthly');
    const [currentDate, setCurrentDate] = useState(new Date());

    const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setLoading(true);
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;

            const rpcName = timeframe === 'monthly' ? 'get_monthly_chart_data' : 'get_yearly_chart_data';
            const params = timeframe === 'monthly' ? { p_year: year, p_month: month } : { p_year: year };

            const [chartRes, reportRes] = await Promise.all([
                supabase.rpc(rpcName, params),
                supabase.rpc('get_profit_loss_report', { p_year: year })
            ]);

            if (chartRes.error) {
                console.error('Error fetching chart data:', chartRes.error);
            } else {
                setChartData(chartRes.data);
            }

            if (reportRes.error) {
                console.error('Error fetching report data:', reportRes.error);
            } else {
                setReportData(reportRes.data);
            }
            
            setLoading(false);
        };

        if (user) {
            fetchData();
        }
    }, [timeframe, currentDate, user]);

    const totalBalance = useMemo(() => {
        if (!accounts || !transactions) return 0;
        let balance = 0;
        accounts.forEach(acc => {
            transactions.forEach(tx => {
                tx.journal_entries.forEach(je => {
                    if (je.account_id === acc.id) {
                        balance += je.debit - je.credit;
                    }
                });
            });
        });
        return balance;
    }, [accounts, transactions]);

    const totalLiabilities = useMemo(() => {
        if (!accountsPayable) return 0;
        return accountsPayable.reduce((sum, item) => sum + (item.amount - item.amount_paid), 0);
    }, [accountsPayable]);

    const { totalIncome, totalExpense } = useMemo(() => {
        if (!chartData) return { totalIncome: 0, totalExpense: 0 };
        return chartData.reduce((acc, item) => {
            acc.totalIncome += item.income;
            acc.totalExpense += item.expense;
            return acc;
        }, { totalIncome: 0, totalExpense: 0 });
    }, [chartData]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="p-2 bg-white border rounded-lg shadow-lg">
                    <p className="label">{`${timeframe === 'monthly' ? 'Tanggal' : 'Bulan'}: ${label}`}</p>
                    <p className="text-green-500">{`Pemasukan: ${formatCurrency(payload[0].value)}`}</p>
                    <p className="text-red-500">{`Pengeluaran: ${formatCurrency(payload[1].value)}`}</p>
                </div>
            );
        }
        return null;
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    if (dataLoading) {
        return <div className="flex justify-center items-center h-full">Memuat data dashboard...</div>;
    }

    return (
        <>
            <Helmet>
                <title>Dashboard Keuangan - Sistem ERP</title>
                <meta name="description" content="Ringkasan kondisi keuangan perusahaan." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard Keuangan</h1>
                    <Select value={timeframe} onValueChange={setTimeframe}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Pilih Jangka Waktu" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monthly">Bulanan</SelectItem>
                            <SelectItem value="yearly">Tahunan</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <motion.div variants={cardVariants} initial="hidden" animate="visible">
                        <Card className="glass-effect">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Saldo Kas & Bank</CardTitle>
                                <Landmark className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
                                <p className="text-xs text-muted-foreground">Total dari semua rekening kas & bank</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div variants={cardVariants} initial="hidden" animate="visible" style={{ transitionDelay: '0.1s' }}>
                        <Card className="glass-effect">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Pemasukan ({timeframe === 'monthly' ? 'Bulan Ini' : 'Tahun Ini'})</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
                                <p className="text-xs text-muted-foreground">Berdasarkan grafik</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div variants={cardVariants} initial="hidden" animate="visible" style={{ transitionDelay: '0.2s' }}>
                        <Card className="glass-effect">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Pengeluaran ({timeframe === 'monthly' ? 'Bulan Ini' : 'Tahun Ini'})</CardTitle>
                                <TrendingDown className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
                                <p className="text-xs text-muted-foreground">Berdasarkan grafik</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div variants={cardVariants} initial="hidden" animate="visible" style={{ transitionDelay: '0.3s' }}>
                        <Card className="glass-effect">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Hutang Belum Lunas</CardTitle>
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalLiabilities)}</div>
                                <p className="text-xs text-muted-foreground">Total dari semua hutang usaha</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                <motion.div variants={cardVariants} initial="hidden" animate="visible" style={{ transitionDelay: '0.4s' }}>
                    <Card className="glass-effect">
                        <CardHeader>
                            <CardTitle>Grafik Arus Kas ({timeframe === 'monthly' ? 'Bulan Ini' : 'Tahun Ini'})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[350px]">
                                {loading ? <p>Memuat grafik...</p> :
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey={timeframe === 'monthly' ? 'day' : 'month'} />
                                        <YAxis tickFormatter={formatCurrency} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="income" fill="#22c55e" name="Pemasukan" />
                                        <Bar dataKey="expense" fill="#ef4444" name="Pengeluaran" />
                                    </BarChart>
                                </ResponsiveContainer>
                                }
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <div className="grid gap-6 md:grid-cols-2">
                    <motion.div variants={cardVariants} initial="hidden" animate="visible" style={{ transitionDelay: '0.5s' }}>
                        <Card className="glass-effect h-full">
                            <CardHeader>
                                <CardTitle>Akses Cepat</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Link to="/finance/transactions" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors">
                                    <span>Lihat Jurnal Umum</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link to="/finance/liabilities" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors">
                                    <span>Kelola Hutang</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link to="/finance/financial-reports" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors">
                                    <span>Laporan Keuangan</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link to="/finance/chart-of-accounts" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors">
                                    <span>Bagan Akun</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div variants={cardVariants} initial="hidden" animate="visible" style={{ transitionDelay: '0.6s' }}>
                        <Card className="glass-effect h-full">
                            <CardHeader>
                                <CardTitle>Ringkasan Laba Rugi (Tahun Ini)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {loading ? <p>Memuat ringkasan...</p> : reportData ? (
                                    <>
                                        <div className="flex justify-between"><span>Pendapatan</span> <span className="font-medium">{formatCurrency(reportData.pendapatan)}</span></div>
                                        <div className="flex justify-between"><span>Total Beban</span> <span className="font-medium">{formatCurrency(reportData.total_beban)}</span></div>
                                        <div className="flex justify-between font-bold pt-2 border-t"><span>Laba/Rugi</span> <span className={reportData.profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(reportData.profit)}</span></div>
                                    </>
                                ) : <p>Data tidak tersedia.</p>}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </>
    );
};

export default FinanceDashboard;