
    import React, { useState, useMemo, useEffect, useCallback } from 'react';
    import { Helmet } from 'react-helmet';
    import { useSearchParams, useNavigate } from 'react-router-dom';
    import { motion } from 'framer-motion';
    import { Plus, Edit, RefreshCw, Trash2, Save, X, Search, FileText, ArrowLeft, Eye } from 'lucide-react';
    import { useData } from '@/contexts/DataContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import EmptyState from '@/components/EmptyState';
    import ConfirmationDialog from '@/components/ConfirmationDialog';
    import { CreatableItemSelector } from '@/components/CreatableItemSelector';
    import { Textarea } from '@/components/ui/textarea';
    import { DatePicker } from '@/components/ui/datepicker';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

    const FORM_MODE = {
      LIST: 'list',
      CREATE: 'create',
      EDIT: 'edit',
    };

    const MaterialIssuesPage = () => {
        const { user } = useAuth();
        const { materialIssues, workOrders, items, warehouses, refreshData, loading: dataLoading } = useData();
        const { toast } = useToast();
        const navigate = useNavigate();
        const [searchParams, setSearchParams] = useSearchParams();

        const [mode, setMode] = useState(FORM_MODE.LIST);
        const [selectedIssue, setSelectedIssue] = useState(null);
        const [issueDetails, setIssueDetails] = useState({
            issue_date: new Date(),
            type: 'manual',
            work_order_id: null,
            destination: '',
            notes: '',
        });
        const [issueItems, setIssueItems] = useState([]);
        
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [itemToDelete, setItemToDelete] = useState(null);
        const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
        const [searchTerm, setSearchTerm] = useState('');
        const [previewIssue, setPreviewIssue] = useState(null);

        const availableWorkOrders = useMemo(() => {
            return workOrders.filter(wo => wo.inventory_status === 'Barang Siap');
        }, [workOrders]);

        useEffect(() => {
            const editId = searchParams.get('edit');
            const createNew = searchParams.get('create');
            const fromWo = searchParams.get('from_wo');

            if (dataLoading) return;

            if (editId) {
                const issueToEdit = materialIssues.find(i => i.id === editId);
                if (issueToEdit) {
                    setSelectedIssue(issueToEdit);
                    setIssueDetails({
                        issue_date: new Date(issueToEdit.issue_date),
                        type: issueToEdit.type,
                        work_order_id: issueToEdit.work_order_id,
                        destination: issueToEdit.destination,
                        notes: issueToEdit.notes,
                    });
                    setIssueItems(issueToEdit.manual_material_issue_items || []);
                    setMode(FORM_MODE.EDIT);
                } else {
                    toast({ variant: 'destructive', title: 'Pengeluaran Barang tidak ditemukan' });
                    navigate('/inventory/material-issues');
                }
            } else if (createNew) {
                resetForm();
                setMode(FORM_MODE.CREATE);
                if (fromWo) {
                    const wo = workOrders.find(w => w.id === fromWo);
                    if (wo) {
                        setIssueDetails(prev => ({
                            ...prev,
                            type: 'work_order',
                            work_order_id: fromWo,
                            notes: `Pengeluaran barang untuk WO: ${wo.wo_number}`
                        }));
                    }
                }
            } else {
                setMode(FORM_MODE.LIST);
                resetForm();
            }
        }, [searchParams, materialIssues, workOrders, dataLoading, navigate, toast]);

        const resetForm = () => {
            setSelectedIssue(null);
            setIssueItems([]);
            setIssueDetails({
                issue_date: new Date(),
                type: 'manual',
                work_order_id: null,
                destination: '',
                notes: '',
            });
        };

        const handleBackToList = () => {
            resetForm();
            setSearchParams({});
        };

        const handleCreateNew = () => setSearchParams({ create: 'new' });
        const handleEditClick = (issue) => setSearchParams({ edit: issue.id });

        const handleDetailChange = (field, value) => {
            setIssueDetails(prev => ({ ...prev, [field]: value }));
            if (field === 'type' && value === 'work_order') {
                setIssueItems([]);
            }
        };

        const handleMaterialSelect = useCallback((selectedItem) => {
            if (!selectedItem || !selectedItem.id) return;
            if (issueItems.some(i => i.item_id === selectedItem.id)) {
                toast({ variant: 'destructive', title: 'Item sudah ada di daftar' });
                return;
            }
            
            const availableStock = selectedItem.stock_levels.filter(sl => sl.quantity > 0);
            if (availableStock.length === 0) {
                toast({ variant: 'destructive', title: 'Stok Habis', description: 'Barang ini tidak memiliki stok di gudang manapun.' });
                return;
            }

            // Prioritize warehouse with the most stock
            const warehouseWithMostStock = availableStock.sort((a, b) => b.quantity - a.quantity)[0];

            const newItem = {
                item_id: selectedItem.id,
                items: selectedItem,
                quantity_issued: 1,
                warehouse_id: warehouseWithMostStock.warehouse_id,
            };
            setIssueItems(prev => [...prev, newItem]);
        }, [issueItems, toast]);

        const handleItemChange = (index, field, value) => {
            const newItems = [...issueItems];
            const currentItem = newItems[index];
            
            if (field === 'quantity_issued') {
                const stockLevel = currentItem.items.stock_levels.find(sl => sl.warehouse_id === currentItem.warehouse_id);
                const maxStock = stockLevel ? stockLevel.quantity : 0;
                if (value > maxStock) {
                    toast({ variant: 'destructive', title: 'Stok Tidak Cukup', description: `Stok di gudang ini hanya ${maxStock}.` });
                    newItems[index][field] = maxStock;
                } else {
                    newItems[index][field] = value;
                }
            } else {
                newItems[index][field] = value;
            }
            setIssueItems(newItems);
        };

        const removeItem = (index) => setIssueItems(issueItems.filter((_, i) => i !== index));

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (issueDetails.type === 'manual' && issueItems.length === 0) {
                toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Harap tambahkan minimal satu barang.' });
                return;
            }
            setIsSubmitting(true);

            try {
                if (issueDetails.type === 'manual') {
                    const itemsPayload = issueItems.map(item => ({
                        item_id: item.item_id,
                        quantity: item.quantity_issued,
                        warehouse_id: item.warehouse_id,
                    }));

                    const { error } = await supabase.rpc('create_manual_material_issue', {
                        p_issue_date: issueDetails.issue_date,
                        p_notes: issueDetails.notes,
                        p_destination: issueDetails.destination,
                        p_items: itemsPayload,
                    });
                    if (error) throw error;
                } else if (issueDetails.type === 'work_order') {
                    const warehouseWithStock = warehouses.find(w => items.some(i => i.stock_levels.some(sl => sl.warehouse_id === w.id && sl.quantity > 0)));
                    if (!warehouseWithStock) {
                        throw new Error("Tidak ada gudang yang memiliki stok untuk item WO.");
                    }
                    const { error } = await supabase.rpc('generate_material_issue_from_wo', {
                        p_work_order_id: issueDetails.work_order_id,
                        p_warehouse_id: warehouseWithStock.id,
                    });
                    if (error) throw error;
                }

                toast({ title: 'Sukses!', description: 'Pengeluaran barang berhasil dicatat.' });
                await refreshData();
                handleBackToList();
            } catch (error) {
                toast({ variant: 'destructive', title: 'Gagal mencatat pengeluaran', description: `Terjadi kesalahan: ${error.message}.` });
            } finally {
                setIsSubmitting(false);
            }
        };

        const confirmDeleteItem = (item) => {
            setItemToDelete(item);
            setIsConfirmDeleteOpen(true);
        };

        const handleDeleteItem = async () => {
            if (!itemToDelete) return;
            setIsSubmitting(true);
            try {
                const { error } = await supabase.rpc('delete_material_issue', { p_mi_id: itemToDelete.id });
                if (error) throw error;
                toast({ title: 'Sukses', description: `Dokumen "${itemToDelete.issue_no}" berhasil dihapus.` });
                await refreshData();
            } catch (error) {
                toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
            } finally {
                setIsSubmitting(false);
                setIsConfirmDeleteOpen(false);
                setItemToDelete(null);
            }
        };

        const filteredIssues = useMemo(() => {
            return (materialIssues || []).filter(issue =>
                issue.issue_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                issue.work_order?.wo_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                issue.notes?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }, [materialIssues, searchTerm]);

        if (mode === FORM_MODE.LIST) {
            return (
                <>
                    <Helmet><title>Pengeluaran Barang</title></Helmet>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold">Pengeluaran Barang</h1>
                                <p className="text-gray-500">Catat dan kelola barang yang keluar dari gudang.</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="icon" onClick={refreshData} disabled={dataLoading}><RefreshCw className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`} /></Button>
                                <Button onClick={handleCreateNew}><Plus className="h-4 w-4 mr-2" />Buat Pengeluaran Baru</Button>
                            </div>
                        </div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Daftar Pengeluaran Barang</CardTitle>
                                <div className="relative mt-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Cari no. dokumen, no. WO, atau catatan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                {dataLoading ? <p>Memuat...</p> : filteredIssues.length === 0 ? <EmptyState icon={FileText} title="Belum Ada Pengeluaran" description="Buat dokumen baru untuk memulai." onActionClick={handleCreateNew} actionText="Buat Baru" /> : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b"><th className="p-2 text-left">No. Dokumen</th><th className="p-2 text-left">Tanggal</th><th className="p-2 text-left">Tipe</th><th className="p-2 text-left">Referensi</th><th className="p-2 text-left">Catatan</th><th className="p-2 text-right">Aksi</th></tr></thead>
                                            <tbody>
                                                {filteredIssues.map(issue => (
                                                    <motion.tr key={issue.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b hover:bg-gray-50">
                                                        <td className="p-2 font-semibold">{issue.issue_no}</td>
                                                        <td className="p-2">{formatDate(issue.issue_date)}</td>
                                                        <td className="p-2">{issue.type === 'work_order' ? 'Work Order' : 'Manual'}</td>
                                                        <td className="p-2">{issue.work_order?.wo_number || issue.destination || '-'}</td>
                                                        <td className="p-2">{issue.notes}</td>
                                                        <td className="p-2 text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => setPreviewIssue(issue)}><Eye className="h-4 w-4" /></Button>
                                                            {issue.type === 'manual' && <Button variant="ghost" size="icon" onClick={() => handleEditClick(issue)}><Edit className="h-4 w-4" /></Button>}
                                                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => confirmDeleteItem(issue)}><Trash2 className="h-4 w-4" /></Button>
                                                        </td>
                                                    </motion.tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <ConfirmationDialog
                        open={isConfirmDeleteOpen}
                        onOpenChange={setIsConfirmDeleteOpen}
                        onConfirm={handleDeleteItem}
                        isSubmitting={isSubmitting}
                        title="Yakin Hapus Dokumen?"
                        description={`Dokumen "${itemToDelete?.issue_no}" dan stok terkait akan dikembalikan. Aksi ini tidak bisa dibatalkan.`}
                        confirmText="Ya, Hapus"
                    />
                    <Dialog open={!!previewIssue} onOpenChange={() => setPreviewIssue(null)}>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Preview: {previewIssue?.issue_no}</DialogTitle>
                                <DialogDescription>Tanggal: {formatDate(previewIssue?.issue_date)}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                                <h3 className="font-semibold text-lg">Item Dikeluarkan</h3>
                                <div className="border rounded-md">
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b bg-gray-50"><th className="p-2 text-left">Nama Barang</th><th className="p-2 text-right">Jumlah</th></tr></thead>
                                        <tbody>
                                            {(previewIssue?.manual_material_issue_items || []).map(item => (
                                                <tr key={item.id} className="border-b">
                                                    <td className="p-2">{item.items?.name}</td>
                                                    <td className="p-2 text-right">{item.quantity_issued} {item.items?.unit}</td>
                                                </tr>
                                            ))}
                                            {(previewIssue?.material_issue_items || []).map(item => (
                                                <tr key={item.id} className="border-b">
                                                    <td className="p-2">{item.items?.name}</td>
                                                    <td className="p-2 text-right">{item.quantity_issued} {item.items?.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={() => setPreviewIssue(null)}>Tutup</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            );
        }

        return (
            <>
                <Helmet><title>{mode === FORM_MODE.CREATE ? 'Buat' : 'Edit'} Pengeluaran Barang</title></Helmet>
                <div className="max-w-4xl mx-auto space-y-6">
                    <Button variant="outline" onClick={handleBackToList}><ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Daftar</Button>
                    <form onSubmit={handleSubmit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>{mode === FORM_MODE.CREATE ? 'Buat Dokumen Pengeluaran Baru' : `Edit: ${selectedIssue?.issue_no}`}</CardTitle>
                                <CardDescription>Isi detail pengeluaran barang dari gudang.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="issue-date">Tanggal Pengeluaran</Label>
                                        <DatePicker date={issueDetails.issue_date} setDate={(date) => handleDetailChange('issue_date', date)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="issue-type">Tipe Pengeluaran</Label>
                                        <Select value={issueDetails.type} onValueChange={(value) => handleDetailChange('type', value)} disabled={mode === FORM_MODE.EDIT}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="manual">Manual</SelectItem>
                                                <SelectItem value="work_order">Dari Work Order</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {issueDetails.type === 'work_order' ? (
                                    <div className="space-y-2">
                                        <Label>Pilih Work Order</Label>
                                        <Select value={issueDetails.work_order_id} onValueChange={(value) => handleDetailChange('work_order_id', value)} disabled={mode === FORM_MODE.EDIT}>
                                            <SelectTrigger><SelectValue placeholder="Pilih WO yang barangnya sudah siap..." /></SelectTrigger>
                                            <SelectContent>
                                                {availableWorkOrders.map(wo => (
                                                    <SelectItem key={wo.id} value={wo.id}>{wo.wo_number} - {wo.customer?.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label htmlFor="destination">Tujuan / Departemen</Label>
                                        <Input id="destination" value={issueDetails.destination} onChange={(e) => handleDetailChange('destination', e.target.value)} />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Catatan</Label>
                                    <Textarea id="notes" value={issueDetails.notes} onChange={(e) => handleDetailChange('notes', e.target.value)} />
                                </div>
                            </CardContent>
                        </Card>

                        {issueDetails.type === 'manual' && (
                            <>
                                <div className="mt-6 border-t pt-6">
                                    <Label className="font-semibold text-base">Tambah Barang</Label>
                                    <p className="text-sm text-muted-foreground mb-2">Pilih barang yang akan dikeluarkan. Hanya barang dengan stok tersedia yang ditampilkan.</p>
                                    <CreatableItemSelector
                                        onValueChange={handleMaterialSelect}
                                        placeholder="Pilih barang..."
                                        filterStock={true}
                                    />
                                </div>
                                <Card className="mt-6">
                                    <CardHeader><CardTitle>Daftar Barang</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            {issueItems.map((item, index) => (
                                                <div key={item.item_id || index} className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                                                    <p className="flex-1 font-medium">{item.items?.name || 'Barang tidak ditemukan'}</p>
                                                    <Input type="number" value={item.quantity_issued} onChange={e => handleItemChange(index, 'quantity_issued', parseFloat(e.target.value) || 0)} className="w-24" />
                                                    <span className="w-16 text-sm text-muted-foreground">{item.items?.unit || 'unit'}</span>
                                                    <Select value={item.warehouse_id} onValueChange={(value) => handleItemChange(index, 'warehouse_id', value)} disabled>
                                                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}

                        <div className="flex justify-end gap-2 mt-6">
                            <Button type="button" variant="outline" onClick={handleBackToList}>Batal</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                <Save className="mr-2 h-4 w-4" /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </div>
                    </form>
                </div>
            </>
        );
    };

    export default MaterialIssuesPage;
  