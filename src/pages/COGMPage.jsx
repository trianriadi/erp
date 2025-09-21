import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Calculator, Save, Search, Lock, Edit } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import useDebounce from '@/hooks/useDebounce';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

const CostEditDialog = ({ wo, isOpen, onOpenChange, onFinished }) => {
    const { toast } = useToast();
    const [overheadCost, setOverheadCost] = useState(wo?.costs?.[0]?.overhead_cost || 0);
    const [laborCost, setLaborCost] = useState(wo?.costs?.[0]?.labor_cost || 0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const costData = {
            work_order_id: wo.id,
            overhead_cost: parseFloat(overheadCost) || 0,
            labor_cost: parseFloat(laborCost) || 0,
        };

        const { error } = await supabase
            .from('work_order_costs')
            .upsert(costData, { onConflict: 'work_order_id' });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal Menyimpan Biaya', description: error.message });
        } else {
            toast({ title: 'Sukses', description: 'Biaya produksi berhasil diperbarui.' });
            onFinished();
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Biaya Produksi: {wo.wo_number}</DialogTitle>
                    <DialogDescription>Masukkan biaya aktual untuk Overhead dan Tenaga Kerja. Biaya ini akan dikunci saat WO selesai.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="overhead">Biaya Overhead</Label>
                        <Input
                            id="overhead"
                            type="number"
                            value={overheadCost}
                            onChange={(e) => setOverheadCost(e.target.value)}
                            placeholder="Masukkan biaya overhead"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="labor">Biaya Tenaga Kerja</Label>
                        <Input
                            id="labor"
                            type="number"
                            value={laborCost}
                            onChange={(e) => setLaborCost(e.target.value)}
                            placeholder="Masukkan biaya tenaga kerja"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Menyimpan...' : <><Save className="mr-2 h-4 w-4" /> Simpan Biaya</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const COGMPage = () => {
    const { workOrders, loading, refreshData } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedWO, setSelectedWO] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [filter, setFilter] = useState('all');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const handleEditClick = (wo) => {
        setSelectedWO(wo);
        setIsDialogOpen(true);
    };

    const handleDialogFinished = () => {
        setIsDialogOpen(false);
        setSelectedWO(null);
        refreshData();
    };

    const cogmData = useMemo(() => {
        return workOrders
            .map(wo => {
                const isFinal = wo.costs?.[0]?.is_final || false;
                
                const ongoingMaterialCost = wo.material_issues.reduce((total, mi) => {
                    const transactionValue = mi.transaction?.journal_entries.reduce((sum, je) => sum + je.debit, 0) || 0;
                    return total + transactionValue;
                }, 0);

                const standardCost = wo.items.reduce((total, item) => {
                    const bomCost = item.bom?.total_cost || 0;
                    return total + (bomCost * item.quantity);
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
                const variance = standardCost > 0 ? actualCOGM - standardCost : 0;

                return {
                    ...wo,
                    is_final: isFinal,
                    product_name: wo.items.map(i => i.product?.name || i.description).join(', '),
                    product_qty: wo.items.reduce((sum, i) => sum + i.quantity, 0),
                    material_cost: materialCost,
                    standard_cost: standardCost,
                    overhead_cost: overheadCost,
                    labor_cost: laborCost,
                    actual_cogm: actualCOGM,
                    variance: variance,
                };
            })
            .filter(wo => {
                const searchMatch = !debouncedSearchTerm || 
                    wo.wo_number.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                    wo.product_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
                
                if (!searchMatch) return false;

                if (filter === 'ongoing') return !wo.is_final;
                if (filter === 'final') return wo.is_final;
                return true;
            });
    }, [workOrders, debouncedSearchTerm, filter]);

    return (
        <>
            <Helmet>
                <title>COGM - Biaya Produksi</title>
                <meta name="description" content="Monitoring biaya produksi aktual (Cost of Goods Manufactured) per Work Order." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Cost of Goods Manufactured (COGM)</h1>
                        <p className="text-gray-500">Monitoring biaya produksi real-time dan final.</p>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari WO atau produk..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Daftar COGM per Work Order</CardTitle>
                        <CardDescription>Total {cogmData.length} Work Order ditampilkan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={filter} onValueChange={setFilter} className="mb-4">
                            <TabsList>
                                <TabsTrigger value="all">Semua WO</TabsTrigger>
                                <TabsTrigger value="ongoing">WO Berjalan (Monitoring)</TabsTrigger>
                                <TabsTrigger value="final">WO Selesai (Final)</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        {loading ? <p className="text-center py-10">Memuat data COGM...</p> :
                        cogmData.length === 0 ? <EmptyState icon={Calculator} title="Belum Ada Data COGM" description="Data COGM akan muncul di sini untuk Work Order yang sedang atau telah diproduksi." /> :
                        (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>WO Number</TableHead>
                                            <TableHead>Produk</TableHead>
                                            <TableHead>Status Biaya</TableHead>
                                            <TableHead className="text-right">Biaya Material</TableHead>
                                            <TableHead className="text-right">Biaya Overhead</TableHead>
                                            <TableHead className="text-right">Biaya T. Kerja</TableHead>
                                            <TableHead className="text-right font-bold">Total COGM</TableHead>
                                            <TableHead className="text-right">HPP Standar</TableHead>
                                            <TableHead className="text-right">Varians</TableHead>
                                            <TableHead className="text-center">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cogmData.map(wo => (
                                            <TableRow key={wo.id}>
                                                <TableCell className="font-medium">{wo.wo_number}</TableCell>
                                                <TableCell>{wo.product_name}</TableCell>
                                                <TableCell>
                                                    {wo.is_final ? (
                                                        <Badge variant="success"><Lock className="h-3 w-3 mr-1" /> Final</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-blue-600 border-blue-600">Monitoring</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(wo.material_cost)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(wo.overhead_cost)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(wo.labor_cost)}</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(wo.actual_cogm)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(wo.standard_cost)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={wo.variance > 0 ? 'destructive' : 'success'}>
                                                        {formatCurrency(wo.variance)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button variant="outline" size="sm" onClick={() => handleEditClick(wo)} disabled={wo.is_final}>
                                                        {wo.is_final ? <Lock className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            {selectedWO && (
                <CostEditDialog
                    wo={selectedWO}
                    isOpen={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    onFinished={handleDialogFinished}
                />
            )}
        </>
    );
};

export default COGMPage;
