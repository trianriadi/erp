
    import React, { useState, useMemo } from 'react';
    import { Helmet } from 'react-helmet';
    import { useData } from '@/contexts/DataContext';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Badge } from '@/components/ui/badge';
    import { Input } from '@/components/ui/input';
    import { Search, FileText } from 'lucide-react';
    import EmptyState from '@/components/EmptyState';
    import useDebounce from '@/hooks/useDebounce';
    import { format } from 'date-fns';
    import { id } from 'date-fns/locale';
    import { DatePickerWithRange } from '@/components/ui/datepicker';

    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
    const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), "d MMM yyyy", { locale: id }) : 'N/A';

    const mainStatusConfig = {
      Draft: { label: 'Draft', color: 'bg-gray-200 text-gray-800' },
      'Pending Inventory': { label: 'Menunggu Inventory', color: 'bg-yellow-200 text-yellow-800' },
      'Tunggu Antrian': { label: 'Antrian Produksi', color: 'bg-blue-200 text-blue-800' },
      Proses: { label: 'Proses Produksi', color: 'bg-indigo-200 text-indigo-800' },
      QC: { label: 'QC', color: 'bg-cyan-200 text-cyan-800'},
      Terkirim: { label: 'Terkirim', color: 'bg-green-200 text-green-800' },
    };

    const ProductionReportPage = () => {
        const { workOrders, loading } = useData();
        const [searchTerm, setSearchTerm] = useState('');
        const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
        const debouncedSearchTerm = useDebounce(searchTerm, 300);

        const processedData = useMemo(() => {
            return workOrders
                .map(wo => {
                    const isFinal = wo.costs?.[0]?.is_final || false;
                    
                    const ongoingMaterialCost = wo.material_issues.reduce((total, mi) => {
                        const transactionValue = mi.transaction?.journal_entries.reduce((sum, je) => sum + je.debit, 0) || 0;
                        return total + transactionValue;
                    }, 0);

                    const ongoingOverheadCost = wo.costs?.[0]?.overhead_cost || 0;
                    const ongoingLaborCost = wo.costs?.[0]?.labor_cost || 0;

                    const finalMaterialCost = wo.costs?.[0]?.final_material_cost || 0;
                    const finalOverheadCost = wo.costs?.[0]?.final_overhead_cost || 0;
                    const finalLaborCost = wo.costs?.[0]?.final_labor_cost || 0;

                    const materialCost = isFinal ? finalMaterialCost : ongoingMaterialCost;
                    const overheadCost = isFinal ? finalOverheadCost : ongoingOverheadCost;
                    const laborCost = isFinal ? finalLaborCost : ongoingLaborCost;

                    const actualCOGM = materialCost + overheadCost + laborCost;
                    
                    const totalBomItems = wo.items.reduce((sum, item) => sum + (item.bom?.bom_items?.length || 0), 0);
                    const issuedItemsCount = wo.material_issues.reduce((sum, mi) => sum + (mi.material_issue_items?.length || 0), 0);
                    const progress = totalBomItems > 0 ? (issuedItemsCount / totalBomItems) * 100 : 0;

                    return {
                        ...wo,
                        product_name: wo.items.map(i => i.product?.name || i.description).join(', '),
                        product_qty: wo.items.reduce((sum, i) => sum + i.quantity, 0),
                        cogm: actualCOGM,
                        material_cost: materialCost,
                        overhead_cost: overheadCost,
                        labor_cost: laborCost,
                        progress: Math.min(progress, 100),
                        start_date: (wo.history || []).find(h => h.to_status === 'Proses')?.changed_at,
                        actual_ship_date: (wo.history || []).find(h => h.to_status === 'Terkirim')?.changed_at,
                    };
                })
                .filter(wo => {
                    const searchMatch = !debouncedSearchTerm || 
                        wo.wo_number.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                        wo.product_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                        (wo.sales_order?.so_number && wo.sales_order.so_number.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
                        (wo.customer?.name && wo.customer.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

                    if (!searchMatch) return false;

                    if (dateRange.from && new Date(wo.created_at) < dateRange.from) return false;
                    if (dateRange.to && new Date(wo.created_at) > dateRange.to) return false;
                    
                    return true;
                });
        }, [workOrders, debouncedSearchTerm, dateRange]);

        return (
            <>
                <Helmet>
                    <title>Laporan Produksi</title>
                    <meta name="description" content="Laporan detail progress dan biaya produksi." />
                </Helmet>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold">Laporan Produksi</h1>
                            <p className="text-gray-500">Detail progress, jadwal, dan biaya produksi per Work Order.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari WO, SO, Customer..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Detail Laporan</CardTitle>
                            <CardDescription>Total {processedData.length} Work Order ditampilkan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? <p className="text-center py-10">Memuat data laporan...</p> :
                            processedData.length === 0 ? <EmptyState icon={FileText} title="Tidak Ada Data" description="Tidak ada data produksi yang cocok dengan filter Anda." /> :
                            (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>WO Number</TableHead>
                                                <TableHead>SO / Customer</TableHead>
                                                <TableHead>Produk</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Tgl Mulai</TableHead>
                                                <TableHead>Tgl Target</TableHead>
                                                <TableHead>Tgl Aktual Kirim</TableHead>
                                                <TableHead className="text-right">Progress</TableHead>
                                                <TableHead className="text-right">Total COGM</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {processedData.map(wo => (
                                                <TableRow key={wo.id}>
                                                    <TableCell className="font-medium">{wo.wo_number}</TableCell>
                                                    <TableCell>
                                                        <div>{wo.sales_order?.so_number || 'N/A'}</div>
                                                        <div className="text-xs text-muted-foreground">{wo.customer?.name || 'N/A'}</div>
                                                    </TableCell>
                                                    <TableCell>{wo.product_name}</TableCell>
                                                    <TableCell><Badge className={`${mainStatusConfig[wo.status]?.color || 'bg-gray-200'}`}>{mainStatusConfig[wo.status]?.label || wo.status}</Badge></TableCell>
                                                    <TableCell>{formatDate(wo.start_date)}</TableCell>
                                                    <TableCell>{formatDate(wo.estimated_ship_date)}</TableCell>
                                                    <TableCell>{formatDate(wo.actual_ship_date)}</TableCell>
                                                    <TableCell className="text-right">{wo.progress.toFixed(0)}%</TableCell>
                                                    <TableCell className="text-right font-semibold">{formatCurrency(wo.cogm)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    };

    export default ProductionReportPage;
  