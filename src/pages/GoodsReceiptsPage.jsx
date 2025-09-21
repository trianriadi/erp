import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Eye, Truck, CheckCircle, PlusCircle, MinusCircle, ChevronsUpDown, Check, Download, Send } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import EmptyState from '@/components/EmptyState';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ProductSelector } from '@/components/ProductSelector';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SupplierAutoComplete } from '@/components/SupplierAutoComplete';
import { cn } from '@/lib/utils';
import { generateGoodsReceiptPDF } from '@/lib/pdfUtils';
import DocumentPreviewDialog from '@/components/DocumentPreviewDialog';
import ConfirmationDialog from '@/components/ConfirmationDialog';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), "d MMMM yyyy", { locale: id }) : '';

const ItemWithDimensions = ({ item, index, onUpdate, onRemove, isPoBased }) => {
    const [itemType, setItemType] = useState('');
    const [specifications, setSpecifications] = useState(item.specifications || {});

    useEffect(() => {
        if (item.specifications) {
            if (item.specifications.diameter) setItemType('Roundbar');
            else if (item.specifications.tebal) setItemType('Plat');
            else if (item.specifications.diameter_luar) setItemType('Pipa');
            else setItemType('');
            setSpecifications(item.specifications);
        }
    }, [item.specifications]);

    const handleSpecChange = (field, value) => {
        const newSpecs = { ...specifications, [field]: value };
        setSpecifications(newSpecs);
        onUpdate(index, 'specifications', newSpecs);
    };

    const handleTypeChange = (type) => {
        setItemType(type);
        setSpecifications({});
        onUpdate(index, 'specifications', {});
    };

    const renderDimensionInput = (label, field, placeholder) => (
        <div className="relative">
            <Label>{label}</Label>
            <Input 
                type="number" 
                placeholder={placeholder} 
                value={specifications[field] || ''} 
                onChange={e => handleSpecChange(field, e.target.value)} 
                className="pr-10"
                min="0"
            />
            <span className="absolute inset-y-0 right-0 top-5 pr-3 flex items-center text-sm text-muted-foreground">mm</span>
        </div>
    );

    const renderDimensionInputs = () => {
        switch (itemType) {
            case 'Roundbar': return <>{renderDimensionInput("Diameter", "diameter", "Ø")}{renderDimensionInput("Panjang", "panjang", "P")}</>;
            case 'Plat': return <>{renderDimensionInput("Tebal", "tebal", "T")}{renderDimensionInput("Panjang", "panjang", "P")}{renderDimensionInput("Lebar", "lebar", "L")}</>;
            case 'Pipa': return <>{renderDimensionInput("Ø Luar", "diameter_luar", "DL")}{renderDimensionInput("Ø Dalam", "diameter_dalam", "DD")}{renderDimensionInput("Panjang", "panjang", "P")}</>;
            default: return null;
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border p-3 rounded-md bg-slate-50">
            <div className="md:col-span-4 space-y-1"><Label>Item</Label><ProductSelector value={item.item_id} onSelectProduct={(selected) => onUpdate(index, 'item_id', selected.id)} isRawMaterialMode={true} disabled={isPoBased} /></div>
            <div className="md:col-span-2 space-y-1"><Label>Jml Diterima</Label><Input type="number" placeholder="Jml" value={item.quantity_received} onChange={e => onUpdate(index, 'quantity_received', parseInt(e.target.value) || 0)} min="0" /></div>
            <div className="md:col-span-2 space-y-1"><Label>Harga Aktual</Label><Input type="number" placeholder="Harga" value={item.actual_price || ''} onChange={e => onUpdate(index, 'actual_price', parseFloat(e.target.value) || 0)} /></div>
            <div className="md:col-span-3 space-y-1"><Label>Catatan Item</Label><Input placeholder="Catatan" value={item.notes} onChange={e => onUpdate(index, 'notes', e.target.value)} /></div>
            <div className="md:col-span-1 flex justify-end">{!isPoBased && <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}><MinusCircle className="h-5 w-5 text-red-500" /></Button>}</div>
            <div className="md:col-span-12 flex items-center gap-4 pt-2 mt-2 border-t">
                <Label className="text-xs shrink-0">Tipe Dimensi:</Label>
                <div className="flex items-center gap-2">
                    <Checkbox id={`type-none-${index}`} checked={!itemType} onCheckedChange={() => handleTypeChange('')} /><Label htmlFor={`type-none-${index}`} className="text-xs font-normal">None</Label>
                    <Checkbox id={`type-roundbar-${index}`} checked={itemType === 'Roundbar'} onCheckedChange={() => handleTypeChange('Roundbar')} /><Label htmlFor={`type-roundbar-${index}`} className="text-xs font-normal">AS</Label>
                    <Checkbox id={`type-plat-${index}`} checked={itemType === 'Plat'} onCheckedChange={() => handleTypeChange('Plat')} /><Label htmlFor={`type-plat-${index}`} className="text-xs font-normal">Plat</Label>
                    <Checkbox id={`type-pipa-${index}`} checked={itemType === 'Pipa'} onCheckedChange={() => handleTypeChange('Pipa')} /><Label htmlFor={`type-pipa-${index}`} className="text-xs font-normal">Pipa</Label>
                </div>
            </div>
            {itemType && <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">{renderDimensionInputs()}</div>}
        </div>
    );
};

const GoodsReceiptsPage = () => {
    const { user } = useAuth();
    const { goodsReceipts, purchaseRequests, companyProfile, warehouses, loading, refreshData, accountsPayable } = useData();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingGR, setEditingGR] = useState(null);
    const [previewingGR, setPreviewingGR] = useState(null);
    const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
    const [pdfDataUri, setPdfDataUri] = useState('');
    const [pdfFileName, setPdfFileName] = useState('');
    const [deletingGR, setDeletingGR] = useState(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

    const defaultFormState = { id: null, receipt_date: new Date().toISOString().slice(0, 10), pr_id: '', po_id: '', supplier_id: '', notes: '', warehouse_id: '' };
    const [formData, setFormData] = useState(defaultFormState);
    const [grItems, setGrItems] = useState([{ item_id: '', quantity_received: 0, actual_price: 0, notes: '', specifications: {} }]);

    const approvedPurchaseRequests = useMemo(() => (purchaseRequests || []).filter(pr => pr.status === 'approved'), [purchaseRequests]);
    const payablesData = useMemo(() => {
        const map = new Map();
        accountsPayable.forEach(ap => {
            if (ap.reference_type === 'goods_receipt' && ap.reference_id) {
                map.set(ap.reference_id, { hasPayable: true, amount_paid: ap.amount_paid });
            }
        });
        return map;
    }, [accountsPayable]);

    const resetForm = () => {
        setEditingGR(null);
        setFormData(defaultFormState);
        setGrItems([{ item_id: '', quantity_received: 0, actual_price: 0, notes: '', specifications: {} }]);
    };

    const handleOpenForm = async (gr = null) => {
        if (gr) {
            const { data: items, error } = await supabase.from('goods_receipt_items').select('*').eq('gr_id', gr.id);
            if (error) {
                toast({ variant: 'destructive', title: 'Gagal memuat item GR', description: error.message });
                return;
            }
            setEditingGR(gr);
            setFormData({
                id: gr.id,
                receipt_date: gr.receipt_date,
                pr_id: gr.pr_id || '',
                po_id: gr.po_id || '',
                supplier_id: gr.supplier_id,
                notes: gr.notes,
                warehouse_id: gr.warehouse_id || (warehouses[0]?.id || '')
            });
            setGrItems(items);
        } else {
            resetForm();
            if (warehouses && warehouses.length > 0) {
                setFormData(prev => ({ ...prev, warehouse_id: warehouses[0].id }));
            }
        }
        setIsFormOpen(true);
    };

    const handleOpenPreview = async (gr) => {
        const { data: items, error } = await supabase.from('goods_receipt_items').select('*, item:items(name, code, unit)').eq('gr_id', gr.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Gagal memuat detail item', description: error.message });
            return;
        }
        setPreviewingGR({ ...gr, items });
    };

    const handleDownloadPDF = async (gr) => {
        toast({ title: "Membuat PDF...", description: "Mohon tunggu sebentar." });
        setPdfDataUri('');
        setPdfFileName('');
        setIsPdfPreviewOpen(true);

        const { data: items, error } = await supabase.from('goods_receipt_items').select('*, item:items(name, code, unit)').eq('gr_id', gr.id);
        if (error) {
            setIsPdfPreviewOpen(false);
            toast({ variant: 'destructive', title: 'Gagal memuat detail item', description: error.message });
            return;
        }

        const { dataUri, fileName } = await generateGoodsReceiptPDF(gr, items, companyProfile);
        if (dataUri) {
            setPdfDataUri(dataUri);
            setPdfFileName(fileName);
        } else {
            setIsPdfPreviewOpen(false);
            toast({ variant: 'destructive', title: 'Gagal Membuat PDF' });
        }
    };
    
    const handleForwardToFinance = async (grId) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.rpc('create_payable_from_gr', { p_gr_id: grId });
            if (error) throw error;
            toast({ title: "Sukses!", description: "Hutang berhasil dibuat dan diteruskan ke bagian Keuangan." });
            await refreshData();
        } catch (error) {
            console.error("Error forwarding to finance:", error);
            toast({ variant: 'destructive', title: 'Gagal Meneruskan ke Keuangan', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = (gr) => {
        setDeletingGR(gr);
        setIsConfirmDeleteOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingGR) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.rpc('delete_goods_receipt', { p_gr_id: deletingGR.id });
            if (error) throw error;
            toast({ title: 'Sukses', description: `Penerimaan Barang ${deletingGR.gr_number} berhasil dihapus.` });
            await refreshData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal Menghapus', description: error.message });
        } finally {
            setIsSubmitting(false);
            setIsConfirmDeleteOpen(false);
            setDeletingGR(null);
        }
    };

    const handlePrChange = async (prId) => {
        const selectedPr = approvedPurchaseRequests.find(pr => pr.id === prId);
        if (!selectedPr) return;
        setFormData(prev => ({ ...prev, pr_id: prId, po_id: '', supplier_id: '' }));
        const { data, error } = await supabase.from('purchase_request_items').select('*, item:items(id, name, unit)').eq('pr_id', prId);
        if (error) {
            toast({ variant: 'destructive', title: 'Gagal memuat item PR' });
            setGrItems([]);
            return;
        }
        setGrItems(data.map(item => ({ item_id: item.item_id, quantity_received: item.quantity, actual_price: item.price || 0, notes: `Dari PR: ${selectedPr.pr_number}`, specifications: {} })));
    };
    
    const handleItemChange = (index, field, value) => {
        const newItems = [...grItems];
        newItems[index][field] = value;
        setGrItems(newItems);
    };

    const addItem = () => setGrItems([...grItems, { item_id: '', quantity_received: 0, actual_price: 0, notes: '', specifications: {} }]);
    const removeItem = (index) => setGrItems(grItems.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        if (!formData.warehouse_id || !formData.supplier_id || grItems.some(item => !item.item_id || item.quantity_received <= 0)) {
            toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Pastikan Gudang, Supplier, dan semua item telah diisi dengan benar.' });
            setIsSubmitting(false);
            return;
        }

        if (editingGR) {
            const { error: revertError } = await supabase.rpc('delete_goods_receipt', { p_gr_id: editingGR.id });
            if (revertError) {
                toast({ variant: 'destructive', title: 'Gagal mengembalikan stok lama', description: revertError.message });
                setIsSubmitting(false);
                return;
            }
        }

        const gr_number = editingGR?.gr_number || `GR-${Date.now()}`;
        
        const grPayload = {
            gr_number, 
            receipt_date: formData.receipt_date,
            pr_id: formData.pr_id || null,
            po_id: formData.po_id || null,
            supplier_id: formData.supplier_id,
            notes: formData.notes,
            warehouse_id: formData.warehouse_id,
            user_id: user.id 
        };

        if (editingGR) {
            grPayload.id = editingGR.id;
        }

        const { data, error } = await supabase
            .from('goods_receipts')
            .upsert([grPayload])
            .select()
            .single();

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal menyimpan GR', description: error.message });
            setIsSubmitting(false);
            return;
        }

        const newGRId = data.id;
        const itemsToInsert = grItems.map(item => ({
            gr_id: newGRId,
            item_id: item.item_id,
            quantity_received: item.quantity_received,
            actual_price: item.actual_price,
            notes: item.notes,
            specifications: item.specifications,
            user_id: user.id
        }));

        const { error: itemsError } = await supabase.from('goods_receipt_items').insert(itemsToInsert);

        if (itemsError) {
            toast({ variant: 'destructive', title: 'Gagal menyimpan item GR', description: itemsError.message });
        } else {
            const { error: stockUpdateError } = await supabase.rpc('process_goods_receipt_stock_update', { p_gr_id: newGRId });
            if (stockUpdateError) {
                toast({ variant: 'destructive', title: 'Gagal memperbarui stok', description: stockUpdateError.message });
            } else {
                toast({ title: 'Sukses!', description: `Penerimaan barang berhasil ${editingGR ? 'diperbarui' : 'dicatat'}.` });
                await refreshData();
                setIsFormOpen(false);
            }
        }

        setIsSubmitting(false);
    };
    
    const PRSelector = ({ value, onChange }) => {
        const [open, setOpen] = useState(false);
        const [searchValue, setSearchValue] = useState("");
        const selected = useMemo(() => approvedPurchaseRequests.find(pr => pr.id === value), [approvedPurchaseRequests, value]);
        
        const filteredPRs = useMemo(() => {
            if (!searchValue) return approvedPurchaseRequests;
            return approvedPurchaseRequests.filter(pr => 
                pr.pr_number.toLowerCase().includes(searchValue.toLowerCase()) ||
                pr.requester?.full_name?.toLowerCase().includes(searchValue.toLowerCase())
            );
        }, [searchValue, approvedPurchaseRequests]);

        return (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between">{selected ? `${selected.pr_number} - ${selected.requester?.full_name}` : "Pilih PR (Approved)..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command><CommandInput placeholder="Cari nomor PR atau pemohon..." value={searchValue} onValueChange={setSearchValue} /><CommandList><CommandEmpty>PR tidak ditemukan.</CommandEmpty><CommandGroup>
                    {filteredPRs.map(pr => (<CommandItem key={pr.id} value={pr.pr_number} onSelect={() => { onChange(pr.id); setOpen(false); setSearchValue(""); }}><Check className={cn("mr-2 h-4 w-4", value === pr.id ? "opacity-100" : "opacity-0")} />{pr.pr_number} - {pr.requester?.full_name}</CommandItem>))}
                </CommandGroup></CommandList></Command>
            </PopoverContent>
          </Popover>
        );
    };

    return (
        <>
            <Helmet><title>Penerimaan Barang - Inventory</title></Helmet>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div><h1 className="text-2xl font-bold">Penerimaan Barang (Goods Receipt)</h1><p className="text-gray-500">Catat barang yang diterima dari supplier.</p></div>
                    <div className="flex gap-2"><Button onClick={() => handleOpenForm()}><Plus className="h-4 w-4 mr-2" />Catat Penerimaan</Button></div>
                </div>

                {loading ? <p>Memuat...</p> : !goodsReceipts || goodsReceipts.length === 0 ? <EmptyState icon={Truck} title="Belum Ada Penerimaan Barang" description="Belum ada barang yang diterima. Klik tombol di atas untuk mencatat." actionText="Catat Penerimaan" onActionClick={() => handleOpenForm()} /> :
                 (<Card><CardHeader><CardTitle>Riwayat Penerimaan Barang</CardTitle></CardHeader><CardContent><div className="space-y-4">
                    {goodsReceipts.map((gr, index) => {
                        const payableInfo = payablesData.get(gr.id);
                        const hasPayable = payableInfo?.hasPayable;
                        const isPaid = payableInfo?.amount_paid > 0;
                        const canEditOrDelete = !isPaid;

                        return (
                            <motion.div key={gr.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="border rounded-lg p-4 space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg">{gr.gr_number}</p>
                                        <p className="text-sm text-gray-500">Ref. PO: {gr.po?.po_number || 'N/A'} | Tanggal: {formatDate(gr.receipt_date)}</p>
                                        <p className="text-sm text-gray-500">Supplier: {gr.supplier?.name || 'N/A'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       {hasPayable ? (
                                            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}><CheckCircle className="h-3 w-3" /> {isPaid ? 'Sudah Dibayar' : 'Diteruskan'}</span>
                                        ) : (
                                            <Button variant="outline" size="sm" onClick={() => handleForwardToFinance(gr.id)} disabled={isSubmitting}><Send className="h-4 w-4 mr-2"/>Teruskan ke Finance</Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenPreview(gr)}><Eye className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(gr)}><Download className="h-4 w-4 text-blue-600" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(gr)} disabled={!canEditOrDelete}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(gr)} disabled={!canEditOrDelete}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div></CardContent></Card>)}
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>{editingGR ? 'Edit' : 'Catat'} Penerimaan Barang</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2"><Label>Tanggal Penerimaan</Label><Input type="date" value={formData.receipt_date} onChange={e => setFormData({ ...formData, receipt_date: e.target.value })} required /></div>
                            <div className="space-y-2"><Label>Dari Permintaan Barang (Opsional)</Label><PRSelector value={formData.pr_id} onChange={handlePrChange} /></div>
                            <div className="space-y-2"><Label>Gudang Tujuan</Label>
                                <Select value={formData.warehouse_id} onValueChange={(value) => setFormData(prev => ({...prev, warehouse_id: value}))} required><SelectTrigger><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
                                <SelectContent>{(warehouses || []).length > 0 ? warehouses.map(wh => (<SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>)) : <p className="p-2 text-sm text-muted-foreground">Tidak ada gudang.</p>}</SelectContent></Select>
                            </div>
                        </div>
                        <div className="space-y-2"><Label>Supplier</Label><SupplierAutoComplete onSupplierChange={(supplier) => setFormData(prev => ({ ...prev, supplier_id: supplier?.id || '' }))} initialSupplierId={formData.supplier_id} /></div>
                        <div className="space-y-4 pt-4"><Label className="text-lg font-semibold">Item Diterima</Label>
                            {grItems.map((item, index) => (<ItemWithDimensions key={item.id || index} item={item} index={index} onUpdate={handleItemChange} onRemove={removeItem} isPoBased={!!formData.pr_id} />))}
                            {!formData.pr_id && <Button type="button" variant="outline" onClick={addItem} className="w-full"><PlusCircle className="h-4 w-4 mr-2" />Tambah Item Manual</Button>}
                        </div>
                        <div className="space-y-2 pt-4"><Label>Catatan Umum</Label><Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
                        <DialogFooter className="pt-6"><Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button><Button type="submit" disabled={isSubmitting || (warehouses || []).length === 0}>{isSubmitting ? 'Menyimpan...' : 'Simpan Penerimaan'}</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={!!previewingGR} onOpenChange={() => setPreviewingGR(null)}>
                <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Detail Penerimaan: {previewingGR?.gr_number}</DialogTitle><DialogDescription>Supplier: {previewingGR?.supplier?.name}</DialogDescription></DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto space-y-4">
                        <ul className="divide-y divide-gray-200">{previewingGR?.items.map(item => (<li key={item.id} className="py-2"><strong>{item.item?.name || 'Item Dihapus'}:</strong> {item.quantity_received} {item.item?.unit} @ {formatCurrency(item.actual_price)}</li>))}</ul>
                    </div>
                <DialogFooter><Button onClick={() => setPreviewingGR(null)}>Tutup</Button></DialogFooter></DialogContent>
            </Dialog>
            <DocumentPreviewDialog isOpen={isPdfPreviewOpen} onOpenChange={setIsPdfPreviewOpen} pdfDataUri={pdfDataUri} title="Pratinjau Bukti Penerimaan Barang" fileName={pdfFileName} />
            <ConfirmationDialog
                open={isConfirmDeleteOpen}
                onOpenChange={setIsConfirmDeleteOpen}
                onConfirm={handleDeleteConfirm}
                title={`Yakin ingin menghapus GR ${deletingGR?.gr_number}?`}
                description="Aksi ini akan menghapus GR, mengembalikan stok, dan menghapus hutang terkait (jika ada & belum dibayar). Aksi ini tidak dapat dibatalkan."
                isSubmitting={isSubmitting}
                confirmText="Ya, Hapus"
            />
        </>
    );
};

export default GoodsReceiptsPage;