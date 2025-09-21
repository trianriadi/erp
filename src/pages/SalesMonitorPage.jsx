import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';

const SalesMonitorPage = () => {
    const { invoices, loading } = useData();
    const navigate = useNavigate();

    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const monthlySales = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        return invoices.filter(inv => {
            const invDate = new Date(inv.date);
            return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
        });
    }, [invoices]);
    
    const totalSales = useMemo(() => monthlySales.reduce((sum, inv) => sum + inv.total_amount, 0), [monthlySales]);

    if (loading) {
        return <div className="text-center py-10">Memuat data penjualan...</div>;
    }

    return (
        <>
            <Helmet>
                <title>Monitor Penjualan Bulan Ini</title>
                <meta name="description" content="Rincian monitor penjualan untuk bulan ini." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Monitor Penjualan Bulan Ini</h1>
                        <p className="text-gray-500">Ringkasan semua invoice yang dibuat bulan ini.</p>
                    </div>
                </div>

                {monthlySales.length === 0 ? (
                    <EmptyState
                        icon={ShoppingCart}
                        title="Tidak Ada Penjualan Bulan Ini"
                        description="Belum ada invoice yang tercatat untuk bulan ini. Buat invoice baru untuk memulai."
                    />
                ) : (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Penjualan Bulan Ini</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold text-green-600">{formatCurrency(totalSales)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Rincian Invoice</CardTitle>
                                <CardDescription>Total {monthlySales.length} invoice ditemukan.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No. Invoice</TableHead>
                                            <TableHead>Pelanggan</TableHead>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead className="text-right">Jumlah</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlySales.map(invoice => (
                                            <TableRow key={invoice.id}>
                                                <TableCell className="font-medium">{invoice.invoice_no}</TableCell>
                                                <TableCell>{invoice.customer?.name || 'N/A'}</TableCell>
                                                <TableCell>{formatDate(invoice.date)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(invoice.total_amount)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={invoice.status === 'paid' ? 'success' : invoice.status === 'partial' ? 'warning' : 'destructive'}>
                                                        {invoice.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </>
    );
};

export default SalesMonitorPage;