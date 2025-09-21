import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { motion } from 'framer-motion';
import { DollarSign, FileText, FileCheck, AlertCircle, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

const StatCard = ({ title, value, icon: Icon, color, bgColor, link, onClick }) => {
    return (
        <motion.div whileHover={{ scale: 1.05 }} className="cursor-pointer" onClick={() => onClick(link)}>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <div className={`p-2 rounded-md ${bgColor}`}>
                        <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{value}</div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

const SalesDashboard = () => {
    const { salesOrders, quotations, invoices, customers, loading } = useData();
    const navigate = useNavigate();

    const stats = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const salesThisMonth = salesOrders.filter(so => {
            const soDate = new Date(so.order_date);
            return soDate.getMonth() === currentMonth && soDate.getFullYear() === currentYear;
        });

        const totalSalesAmount = salesThisMonth.reduce((sum, so) => sum + so.total_amount, 0);
        const totalSalesOrders = salesThisMonth.length;
        
        const quotationStatus = quotations.reduce((acc, q) => {
            acc[q.status] = (acc[q.status] || 0) + 1;
            return acc;
        }, {draft:0, sent:0, accepted:0, rejected:0});
        const openQuotations = quotationStatus.draft + quotationStatus.sent;

        const outstandingInvoices = invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'partial');
        const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + (inv.total_amount - inv.amount_paid), 0);

        return {
            totalSalesAmount,
            totalSalesOrders,
            openQuotations,
            acceptedQuotations: quotationStatus.accepted,
            outstandingInvoicesCount: outstandingInvoices.length,
            outstandingAmount
        };
    }, [salesOrders, quotations, invoices]);
    
    const monthlySalesTrend = useMemo(() => {
        const trend = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return { month: d.toLocaleString('id-ID', { month: 'short' }), year: d.getFullYear(), sales: 0 };
        }).reverse();
        
        salesOrders.forEach(so => {
            const soDate = new Date(so.order_date);
            const month = soDate.toLocaleString('id-ID', { month: 'short' });
            const year = soDate.getFullYear();
            const index = trend.findIndex(t => t.month === month && t.year === year);
            if (index !== -1) {
                trend[index].sales += so.total_amount;
            }
        });
        return trend.map(t => ({...t, name: t.month}));
    }, [salesOrders]);

    const topCustomers = useMemo(() => {
        const customerSales = salesOrders.reduce((acc, so) => {
            if (so.customer) {
                acc[so.customer.name] = (acc[so.customer.name] || 0) + so.total_amount;
            }
            return acc;
        }, {});
        
        return Object.entries(customerSales)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, total]) => ({ name, total }));
    }, [salesOrders]);
    
    const handleCardClick = (link) => {
        if(link) navigate(link);
    };

    if (loading) return <div className="flex justify-center items-center h-full"><p>Memuat data dashboard...</p></div>;

    return (
        <>
            <Helmet>
                <title>Dashboard Penjualan</title>
                <meta name="description" content="Ringkasan dan analitik aktivitas penjualan." />
            </Helmet>
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">Dashboard Penjualan</h1>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Penjualan (Bulan Ini)" value={formatCurrency(stats.totalSalesAmount)} icon={DollarSign} color="text-green-600" bgColor="bg-green-100" link="/sales/orders" onClick={handleCardClick} />
                    <StatCard title="Jumlah Order (Bulan Ini)" value={stats.totalSalesOrders} icon={ShoppingCart} color="text-blue-600" bgColor="bg-blue-100" link="/sales/orders" onClick={handleCardClick} />
                    <StatCard title="Quotation Open" value={stats.openQuotations} icon={FileText} color="text-yellow-600" bgColor="bg-yellow-100" link="/sales/quotations" onClick={handleCardClick} />
                    <StatCard title="Invoice Belum Dibayar" value={stats.outstandingInvoicesCount} icon={AlertCircle} color="text-red-600" bgColor="bg-red-100" link="/sales/invoices" onClick={handleCardClick} />
                </div>
                
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-full lg:col-span-4">
                        <CardHeader>
                            <CardTitle>Tren Penjualan (6 Bulan Terakhir)</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-2">
                             <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={monthlySalesTrend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(value)} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="sales" name="Penjualan" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card className="col-span-full lg:col-span-3">
                        <CardHeader>
                            <CardTitle>Top 5 Pelanggan</CardTitle>
                        </CardHeader>
                        <CardContent>
                             {topCustomers.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pelanggan</TableHead>
                                            <TableHead className="text-right">Total Penjualan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topCustomers.map(customer => (
                                            <TableRow key={customer.name}>
                                                <TableCell className="font-medium">{customer.name}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(customer.total)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">Belum ada data penjualan.</p>
                             )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
};

export default SalesDashboard;