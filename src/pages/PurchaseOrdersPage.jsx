import React, { useState, useEffect } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Plus, Edit, Trash2, Printer, Eye, ShoppingCart, PlusCircle, MinusCircle, FileText, CheckCircle2, Clock, Truck } from 'lucide-react';
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
    import ConfirmationDialog from '@/components/ConfirmationDialog';
    import DocumentPreviewDialog from '@/components/DocumentPreviewDialog';
    import { ProductSelector } from '@/components/ProductSelector';
    import { SupplierAutoComplete } from '@/components/SupplierAutoComplete';
    import jsPDF from 'jspdf';
    import 'jspdf-autotable';
    import { format } from 'date-fns';
    import { id } from 'date-fns/locale';
    import { addCompanyHeader } from '@/lib/pdfUtils';

    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
    const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), "d MMMM yyyy", { locale: id }) : '';

    const POPreviewDialog = ({ isOpen, onOpenChange, po, poItems }) => {
        if (!po) return null;
        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detail PO: {po.po_number}</DialogTitle>
                        <DialogDescription>
                            Kepada: {po.supplier?.name || 'N/A'} | Tanggal: {formatDate(po.order_date)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <div><p className="font-semibold">Status:</p><p>{po.status}</p></div>
                            <div><p className="font-semibold">Total:</p><p className="font-bold">{formatCurrency(po.total_amount)}</p></div>
                        </div>
                        <h4 className="font-semibold">Item Dipesan:</h4>
                        <ul className="list-disc list-inside space-y-2">
                        {poItems.map(item => (
                            <li key={item.id}>
                                {item.item.name} ({item.quantity} {item.item.unit}) @ {formatCurrency(item.unit_price)} = {formatCurrency(item.subtotal)}
                            </li>
                        ))}
                        </ul>
                        {po.notes && (
                            <div className="pt-2 border-t">
                                <h4 className="font-semibold">Catatan:</h4>
                                <p className="text-sm italic">{po.notes}</p>
                            </div>
                        )}
                    </div>
                     <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    const PurchaseOrdersPage = () => {
      const { user } = useAuth();
      const { purchaseOrders, companyProfile, loading, refreshData } = useData();
      const { toast } = useToast();
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [editingPO, setEditingPO] = useState(null);
      
      const [isPreviewOpen, setIsPreviewOpen] = useState(false);
      const [selectedPO, setSelectedPO] = useState(null);
      const [selectedPOItems, setSelectedPOItems] = useState([]);
      const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
      const [poToDelete, setPoToDelete] = useState(null);

      const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
      const [pdfDataUri, setPdfDataUri] = useState('');

      const defaultFormState = { order_date: new Date().toISOString().slice(0, 10), supplier_id: '', notes: '', total_amount: 0, status: 'draft' };
      const [formData, setFormData] = useState(defaultFormState);
      const [poItems, setPoItems] = useState([{ item_id: '', quantity: '', unit_price: 0, subtotal: 0 }]);

      const resetForm = () => {
        setEditingPO(null);
        setFormData(defaultFormState);
        setPoItems([{ item_id: '', quantity: '', unit_price: 0, subtotal: 0 }]);
      };
      
      const handleOpenForm = async (po = null) => {
        if (po) {
            setEditingPO(po);
            setFormData({
                order_date: po.order_date,
                supplier_id: po.supplier_id,
                notes: po.notes || '',
                total_amount: po.total_amount,
                status: po.status,
            });
            
            const { data: itemsData, error } = await supabase
                .from('purchase_order_items')
                .select('*')
                .eq('po_id', po.id);

            if (error) {
                toast({ variant: "destructive", title: "Gagal memuat item PO", description: error.message });
                return;
            }
            setPoItems(itemsData.length > 0 ? itemsData : [{ item_id: '', quantity: '', unit_price: 0, subtotal: 0 }]);
        } else {
            resetForm();
        }
        setIsFormOpen(true);
      };
      
      const handleItemChange = (index, field, value) => {
        const newItems = [...poItems];
        newItems[index][field] = value;
        if (field === 'quantity' || field === 'unit_price') {
            const qty = parseFloat(String(newItems[index].quantity).replace(/,/g, '.')) || 0;
            const price = parseFloat(String(newItems[index].unit_price).replace(/,/g, '.')) || 0;
            newItems[index].subtotal = qty * price;
        }
        setPoItems(newItems);
        updateTotalAmount(newItems);
      };

      const handleItemSelect = (index, selectedItem) => {
        const newItems = [...poItems];
        newItems[index].item_id = selectedItem.id;
        newItems[index].unit_price = selectedItem.standard_cost || 0;
        const qty = parseFloat(String(newItems[index].quantity).replace(/,/g, '.')) || 1;
        if (newItems[index].quantity === '' || newItems[index].quantity === null) {
            newItems[index].quantity = 1;
        }
        newItems[index].subtotal = qty * (selectedItem.standard_cost || 0);
        setPoItems(newItems);
        updateTotalAmount(newItems);
      };
      
      const updateTotalAmount = (currentItems) => {
        const total = currentItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        setFormData(prev => ({...prev, total_amount: total}));
      };

      const addItem = () => setPoItems([...poItems, { item_id: '', quantity: '', unit_price: 0, subtotal: 0 }]);
      const removeItem = (index) => {
        const newItems = poItems.filter((_, i) => i !== index);
        setPoItems(newItems);
        updateTotalAmount(newItems);
      };

      const handleSubmit = async (e) => {
        e.preventDefault();
        
        const finalItems = poItems.filter(item => item.item_id && parseFloat(String(item.quantity).replace(/,/g,'.') || '0') > 0);

        if (!formData.supplier_id || finalItems.length === 0) {
            toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Pastikan supplier dan minimal satu item dengan kuantitas lebih dari 0 telah diisi.' });
            return;
        }
        
        setIsSubmitting(true);

        try {
            const po_number = editingPO?.po_number || `PO-${Date.now()}`;
            const { data: poData, error: poError } = await supabase.from('purchase_orders').upsert({
                id: editingPO?.id, po_number,
                order_date: formData.order_date,
                supplier_id: formData.supplier_id,
                notes: formData.notes,
                total_amount: formData.total_amount,
                status: formData.status, user_id: user.id
            }).select().single();
            if (poError) throw poError;

            if (editingPO) await supabase.from('purchase_order_items').delete().eq('po_id', poData.id);

            const itemsToInsert = finalItems.map(item => ({ 
                po_id: poData.id, 
                item_id: item.item_id,
                quantity: parseFloat(String(item.quantity).replace(/,/g,'.') || '0'),
                unit_price: parseFloat(String(item.unit_price).replace(/,/g,'.') || '0'),
                subtotal: (parseFloat(String(item.quantity).replace(/,/g,'.') || '0')) * (parseFloat(String(item.unit_price).replace(/,/g,'.') || '0')),
                user_id: user.id 
            }));
            const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
            
            toast({ title: 'Sukses!', description: 'Purchase Order berhasil disimpan.' });
            await refreshData();
            setIsFormOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal menyimpan PO', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
      };

      const handlePreview = async (po) => {
        setSelectedPO(po);
        const { data, error } = await supabase.from('purchase_order_items').select('*, item:items(name, code, unit)').eq('po_id', po.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Gagal memuat item PO' });
            return;
        }
        setSelectedPOItems(data);
        setIsPreviewOpen(true);
      };

      const handleDelete = async () => {
        if (!poToDelete) return;
        
        if (poToDelete.status !== 'draft') {
            toast({ variant: 'destructive', title: 'Gagal Hapus', description: 'Hanya PO berstatus "Draft" yang dapat dihapus.' });
            setIsConfirmDeleteOpen(false);
            return;
        }
        
        setIsSubmitting(true);
        const { error } = await supabase.from('purchase_orders').delete().eq('id', poToDelete.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal menghapus PO', description: error.message });
        } else {
            toast({ title: 'Sukses', description: `PO ${poToDelete.po_number} berhasil dihapus.` });
            await refreshData();
        }
        setIsSubmitting(false);
        setIsConfirmDeleteOpen(false);
        setPoToDelete(null);
      };
      
      const generatePDF = async (po) => {
        if (!companyProfile) {
            toast({ variant: 'destructive', title: 'Profil perusahaan belum lengkap' }); return null;
        }
        const { data: poItemsData, error } = await supabase.from('purchase_order_items').select('*, item:items(name, code, unit)').eq('po_id', po.id);
        if (error) { toast({ variant: 'destructive', title: 'Gagal memuat item PO untuk PDF' }); return null; }

        const doc = new jsPDF();
        let contentStartY = await addCompanyHeader(doc, companyProfile);

        doc.setFontSize(16); doc.setFont('helvetica', 'bold');
        doc.text('PURCHASE ORDER', doc.internal.pageSize.getWidth() - 15, contentStartY, { align: 'right' });
        
        let infoStartY = contentStartY + 10;
        
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`PO Number: ${po.po_number}`, 15, infoStartY);
        doc.text(`Order Date: ${formatDate(po.order_date)}`, 15, infoStartY + 5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`Kepada Yth,`, doc.internal.pageSize.getWidth() - 15, infoStartY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(`${po.supplier?.name || 'N/A'}`, doc.internal.pageSize.getWidth() - 15, infoStartY + 5, { align: 'right' });
        const supplierAddress = doc.splitTextToSize(po.supplier?.address || '', 60);
        doc.text(supplierAddress, doc.internal.pageSize.getWidth() - 15, infoStartY + 10, { align: 'right' });


        let tableStartY = infoStartY + supplierAddress.length * 4 + 15;

        doc.autoTable({
            startY: tableStartY,
            head: [['Item Code', 'Item Name', 'Quantity', 'Unit Price', 'Subtotal']],
            body: poItemsData.map(item => [
                item.item.code, item.item.name, `${item.quantity} ${item.item.unit}`, 
                formatCurrency(item.unit_price), formatCurrency(item.subtotal)
            ]),
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        });

        let finalY = doc.previousAutoTable.finalY;
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('Total Amount:', 140, finalY + 10, { align: 'right' });
        doc.text(formatCurrency(po.total_amount), 200, finalY + 10, { align: 'right' });

        if (po.notes) {
            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            doc.text('Notes:', 15, finalY + 20);
            doc.text(po.notes, 15, finalY + 25, { maxWidth: 180 });
        }
        
        const fileName = `PO-${po.po_number}.pdf`;
        const dataUri = doc.output('datauristring');
        return { dataUri, fileName };
      };

      const handlePreviewPDF = async (po) => {
        setSelectedPO(po);
        setPdfDataUri('');
        setIsPdfPreviewOpen(true);
        const pdf = await generatePDF(po);
        if (pdf) {
            setPdfDataUri(pdf.dataUri);
        } else {
            setIsPdfPreviewOpen(false);
        }
      };

      const statusConfig = {
        draft: { icon: Clock, color: 'text-gray-500 bg-gray-100', label: 'Draft' },
        submitted: { icon: FileText, color: 'text-blue-500 bg-blue-100', label: 'Submitted' },
        approved: { icon: CheckCircle2, color: 'text-green-500 bg-green-100', label: 'Approved' },
        received: { icon: Truck, color: 'text-purple-500 bg-purple-100', label: 'Received' },
      };

      return (
        <>
          <Helmet><title>Purchase Order - Inventory</title></Helmet>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div><h1 className="text-2xl font-bold">Purchase Order (PO)</h1><p className="text-gray-500">Buat dan kelola pesanan pembelian ke supplier.</p></div>
              <div className="flex gap-2"><Button onClick={() => handleOpenForm()}><Plus className="h-4 w-4 mr-2" />Buat PO Baru</Button></div>
            </div>

            {loading ? <p>Memuat...</p> : 
             !purchaseOrders || purchaseOrders.length === 0 ? 
             <EmptyState icon={ShoppingCart} title="Belum Ada Purchase Order" description="Belum ada PO yang dibuat. Klik tombol di atas untuk membuat PO pertama Anda." actionText="Buat PO Baru" onActionClick={() => handleOpenForm()} /> :
             (
                <Card>
                    <CardHeader><CardTitle>Daftar Purchase Order</CardTitle><CardDescription>Total {purchaseOrders.length} PO.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {purchaseOrders.map((po, index) => {
                                const currentStatus = statusConfig[po.status] || {};
                                const StatusIcon = currentStatus.icon || Clock;
                                return (
                                <motion.div key={po.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="border rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-lg">{po.po_number}</p>
                                            <p className="text-sm text-gray-500">Supplier: {po.supplier?.name || 'N/A'} | Tanggal: {formatDate(po.order_date)}</p>
                                            <p className="font-bold text-md text-blue-600">{formatCurrency(po.total_amount)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${currentStatus.color}`}><StatusIcon className="h-3 w-3" /> {currentStatus.label}</span>
                                            <Button size="icon" variant="ghost" onClick={() => handlePreview(po)}><Eye className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" onClick={() => handlePreviewPDF(po)}><Printer className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" onClick={() => handleOpenForm(po)}><Edit className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => { setPoToDelete(po); setIsConfirmDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )})}
                        </div>
                    </CardContent>
                </Card>
             )}
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader><DialogTitle>{editingPO ? 'Edit' : 'Buat'} Purchase Order</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Tanggal PO</Label><Input type="date" value={formData.order_date} onChange={e => setFormData({ ...formData, order_date: e.target.value })} required /></div>
                  <div className="space-y-2"><Label>Supplier</Label><SupplierAutoComplete selectedSupplierId={formData.supplier_id} onSupplierChange={(supplier) => setFormData(prev => ({...prev, supplier_id: supplier?.id || ''}))} /></div>
                  <div className="space-y-2"><Label>Status</Label>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {Object.entries(statusConfig).map(([key, {label}]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                    <Label className="text-lg font-semibold">Item Pesanan</Label>
                    {poItems.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center border p-2 rounded-md">
                            <div className="col-span-5"><ProductSelector value={item.item_id} onSelectProduct={(selected) => handleItemSelect(index, selected)} isRawMaterialMode={true} /></div>
                            <div className="col-span-2"><Input type="text" inputMode="decimal" placeholder="Jml" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} /></div>
                            <div className="col-span-2"><Input type="text" inputMode="decimal" placeholder="Harga Satuan" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} /></div>
                            <div className="col-span-2"><Input value={formatCurrency(item.subtotal)} disabled className="text-right font-semibold" /></div>
                            <div className="col-span-1 flex justify-end">
                                {poItems.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}><MinusCircle className="h-5 w-5 text-red-500" /></Button>}
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addItem} className="w-full"><PlusCircle className="h-4 w-4 mr-2" />Tambah Item</Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2"><Label>Catatan</Label><Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
                    <div className="space-y-2 text-right">
                        <Label className="text-sm text-gray-500">Total Keseluruhan</Label>
                        <p className="text-2xl font-bold">{formatCurrency(formData.total_amount)}</p>
                    </div>
                </div>

                <DialogFooter className="pt-6">
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <POPreviewDialog isOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen} po={selectedPO} poItems={selectedPOItems} />

          <ConfirmationDialog
            open={isConfirmDeleteOpen}
            onOpenChange={setIsConfirmDeleteOpen}
            onConfirm={handleDelete}
            isSubmitting={isSubmitting}
            title={`Yakin ingin menghapus PO ${poToDelete?.po_number}?`}
            description="Aksi ini akan menghapus PO secara permanen. Hanya PO berstatus 'Draft' yang bisa dihapus."
           />

          <DocumentPreviewDialog 
            isOpen={isPdfPreviewOpen} 
            onOpenChange={setIsPdfPreviewOpen}
            pdfDataUri={pdfDataUri}
            title="Pratinjau Purchase Order"
            fileName={`PO-${selectedPO?.po_number}.pdf`}
           />
        </>
      );
    };

    export default PurchaseOrdersPage;