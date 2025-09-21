import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';

const ReceivingMonitorPage = () => {
    const { goodsReceipts, loading } = useData();
    const navigate = useNavigate();

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const monthlyReceivings = useMemo(() => {
        if (!goodsReceipts) return [];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        return goodsReceipts.filter(gr => {
            const receiptDate = new Date(gr.receipt_date);
            return receiptDate.getMonth() === currentMonth && receiptDate.getFullYear() === currentYear;
        });
    }, [goodsReceipts]);
    
    const totalReceivings = monthlyReceivings.length;

    if (loading) {
        return <div className="text-center py-10">Memuat data penerimaan...</div>;
    }

    return (
        <>
            <Helmet>
                <title>Monitor Penerimaan Bulan Ini</title>
                <meta name="description" content="Rincian monitor penerimaan barang untuk bulan ini." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Monitor Penerimaan Bulan Ini</h1>
                        <p className="text-gray-500">Ringkasan semua penerimaan barang yang dicatat bulan ini.</p>
                    </div>
                </div>

                {totalReceivings === 0 ? (
                    <EmptyState
                        icon={Truck}
                        title="Tidak Ada Penerimaan Bulan Ini"
                        description="Belum ada barang yang diterima bulan ini. Catat penerimaan barang baru untuk memulai."
                    />
                ) : (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Penerimaan Bulan Ini</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold text-cyan-600">{totalReceivings} Kali Penerimaan</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Rincian Penerimaan Barang</CardTitle>
                                <CardDescription>Total {totalReceivings} penerimaan ditemukan.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No. Penerimaan</TableHead>
                                            <TableHead>Supplier</TableHead>
                                            <TableHead>No. PO</TableHead>
                                            <TableHead>Tanggal Terima</TableHead>
                                            <TableHead>Catatan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyReceivings.map(gr => (
                                            <TableRow key={gr.id}>
                                                <TableCell className="font-medium">{gr.gr_number}</TableCell>
                                                <TableCell>{gr.supplier?.name || 'N/A'}</TableCell>
                                                <TableCell>{gr.po?.po_number || 'N/A'}</TableCell>
                                                <TableCell>{formatDate(gr.receipt_date)}</TableCell>
                                                <TableCell>{gr.notes || '-'}</TableCell>
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

export default ReceivingMonitorPage;