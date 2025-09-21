
import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Factory } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import useDebounce from '@/hooks/useDebounce';
import EmptyState from '@/components/EmptyState';

const mainStatusConfig = {
  Draft: { label: 'Draft', color: 'bg-gray-200 text-gray-800' },
  'Pending Inventory': { label: 'Menunggu Inventory', color: 'bg-yellow-200 text-yellow-800' },
  'Tunggu Antrian': { label: 'Antrian Produksi', color: 'bg-blue-200 text-blue-800' },
  Proses: { label: 'Proses Produksi', color: 'bg-indigo-200 text-indigo-800' },
  QC: { label: 'QC', color: 'bg-cyan-200 text-cyan-800'},
  Terkirim: { label: 'Terkirim', color: 'bg-green-200 text-green-800' },
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return format(new Date(dateStr), "d MMM yyyy", { locale: id });
};

const ProgressBar = ({ value, isLate }) => {
    const colorClass = isLate ? 'bg-red-500' : 'bg-blue-500';
    return (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className={`${colorClass} h-2.5 rounded-full`} style={{ width: `${value}%` }}></div>
        </div>
    );
};

const ProductionMonitorPage = () => {
    const { workOrders, loading } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const productionData = useMemo(() => {
        return workOrders
            .filter(wo => wo.sales_order) // Only show WOs linked to an SO
            .map(wo => {
                const totalBomItems = wo.items.reduce((sum, item) => sum + (item.bom?.bom_items?.length || 0), 0);
                const issuedItems = wo.material_issues.reduce((sum, mi) => sum + (mi.material_issue_items?.length || 0), 0);
                
                let progress = 0;
                if (totalBomItems > 0) {
                    progress = (issuedItems / totalBomItems) * 100;
                }
                if (wo.status === 'Terkirim') {
                    progress = 100;
                }

                const isLate = wo.estimated_ship_date && new Date(wo.estimated_ship_date) < new Date() && wo.status !== 'Terkirim';

                return {
                    ...wo,
                    progress: Math.min(progress, 100),
                    isLate,
                };
            });
    }, [workOrders]);

    const filteredData = useMemo(() => {
        return productionData.filter(item => {
            const searchMatch = debouncedSearchTerm ? (
                item.sales_order?.so_number.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                item.wo_number.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                item.customer?.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            ) : true;

            const statusMatch = statusFilter !== 'all' ? item.status === statusFilter : true;

            return searchMatch && statusMatch;
        });
    }, [productionData, debouncedSearchTerm, statusFilter]);

    if (loading) {
        return <div className="text-center py-10">Memuat data monitoring...</div>;
    }

    return (
        <>
            <Helmet>
                <title>Monitoring Produksi</title>
                <meta name="description" content="Pantau progres produksi dari semua Sales Order." />
            </Helmet>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Monitoring Produksi</CardTitle>
                        <CardDescription>Pantau progres produksi dari semua Sales Order yang berjalan.</CardDescription>
                        <div className="flex flex-col md:flex-row gap-4 pt-4">
                            <div className="relative flex-grow">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari No. SO, No. WO, atau Pelanggan..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full md:w-[180px]">
                                    <SelectValue placeholder="Filter Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    {Object.keys(mainStatusConfig).map(status => (
                                        <SelectItem key={status} value={status}>{mainStatusConfig[status].label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredData.length === 0 ? (
                            <EmptyState
                                icon={Factory}
                                title="Tidak Ada Data Produksi"
                                description="Belum ada Work Order yang terkait dengan Sales Order."
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No. SO</TableHead>
                                        <TableHead>Pelanggan</TableHead>
                                        <TableHead>No. WO</TableHead>
                                        <TableHead>Progress Produksi</TableHead>
                                        <TableHead>Status WO</TableHead>
                                        <TableHead>Estimasi Kirim</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <Button variant="link" asChild className="p-0 h-auto">
                                                    <Link to="/sales/orders" state={{ soId: item.sales_order.id }}>{item.sales_order.so_number}</Link>
                                                </Button>
                                            </TableCell>
                                            <TableCell>{item.customer?.name || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Button variant="link" asChild className="p-0 h-auto">
                                                    <Link to="/manufacture/work-orders" state={{ woId: item.id }}>{item.wo_number}</Link>
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <ProgressBar value={item.progress} isLate={item.isLate} />
                                                    <span className="text-xs font-medium">{item.progress.toFixed(0)}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`${mainStatusConfig[item.status]?.color || 'bg-gray-200'}`}>
                                                    {mainStatusConfig[item.status]?.label || item.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={item.isLate ? 'text-red-500 font-medium' : ''}>
                                                {formatDate(item.estimated_ship_date)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default ProductionMonitorPage;
  