import React, { useState, useEffect, useMemo } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Plus, Send, RefreshCw, CheckCircle2, XCircle, Clock, PlusCircle, MinusCircle, FileText, Edit, Trash2, Download, ChevronsUpDown, Eye } from 'lucide-react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useData } from '@/contexts/DataContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
    import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import EmptyState from '@/components/EmptyState';
    import { ProductSelector } from '@/components/ProductSelector';
    import { useLocation } from 'react-router-dom';
    import { generatePurchaseRequestPDF } from '@/lib/pdfUtils';

    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

    const PurchaseRequestsPage = () => {
      const { user } = useAuth();
      const userRole = user?.user_metadata?.role;
      const { purchaseRequests, workOrders, loading, refreshData, companyProfile } = useData();
      const { toast } = useToast();
      const location = useLocation();

      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [editingRequest, setEditingRequest] = useState(null);
      const [requestToDelete, setRequestToDelete] = useState(null);
      const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
      const [previewRequest, setPreviewRequest] = useState(null);
      const [isPreviewOpen, setIsPreviewOpen] = useState(false);
      const [formData, setFormData] = useState({ request_date: new Date().toISOString().slice(0, 10), notes: '', work_order: '' });
      const [requestItems, setRequestItems] = useState([{ item_id: '', quantity: 1, price: 0, notes: '', unit: '' }]);
      const [requestSource, setRequestSource] = useState('non-wo');
      const [selectedWO, setSelectedWO] = useState('');

      const activeWorkOrders = useMemo(() => {
        return (workOrders || []).filter(wo => !['Terkirim', 'Cancelled'].includes(wo.status));
      }, [workOrders]);

      const resetForm = () => {
        setEditingRequest(null);
        setFormData({ request_date: new Date().toISOString().slice(0, 10), notes: '', work_order: '' });
        setRequestItems([{ item_id: '', quantity: 1, price: 0, notes: '', unit: '' }]);
        setRequestSource('non-wo');
        setSelectedWO('');
      };
      
      useEffect(() => {
        if (location.state?.newPrItems) {
            setRequestItems(location.state.newPrItems);
            setFormData(prev => ({ ...prev, work_order: location.state.woNumber || '' }));
            if (location.state.woNumber) {
              setRequestSource('wo');
              const wo = activeWorkOrders.find(w => w.wo_number === location.state.woNumber);
              if (wo) setSelectedWO(wo.id);
            }
            setIsDialogOpen(true);
            window.history.replaceState({}, document.title);
        }
      }, [location.state, activeWorkOrders]);

      useEffect(() => {
        if (requestSource === 'wo' && selectedWO) {
            const wo = activeWorkOrders.find(w => w.id === selectedWO);
            if (wo) {
                setFormData(prev => ({ ...prev, work_order: wo.wo_number }));
                const materials = new Map();
                wo.items.forEach(item => {
                    item.bom?.bom_items?.forEach(bomItem => {
                        if (bomItem.item) {
                            const existing = materials.get(bomItem.item.id);
                            const requiredQty = bomItem.quantity_required * item.quantity;
                            if (existing) {
                                existing.quantity += requiredQty;
                            } else {
                                materials.set(bomItem.item.id, {
                                    item_id: bomItem.item.id,
                                    quantity: requiredQty,
                                    price: bomItem.item.standard_cost || 0,
                                    unit: bomItem.item.unit || '',
                                    notes: `Ref: ${wo.wo_number}`
                                });
                            }
                        }
                    });
                });
                const newItems = Array.from(materials.values());
                setRequestItems(newItems.length > 0 ? newItems : [{ item_id: '', quantity: 1, price: 0, notes: '', unit: '' }]);
            }
        } else if (requestSource === 'non-wo') {
            setFormData(prev => ({ ...prev, work_order: '' }));
            if (!editingRequest) {
              setRequestItems([{ item_id: '', quantity: 1, price: 0, notes: '', unit: '' }]);
            }
        }
      }, [requestSource, selectedWO, activeWorkOrders, editingRequest]);


      const handleItemChange = (index, field, value) => {
        const newItems = [...requestItems];
        newItems[index][field] = value;
        setRequestItems(newItems);
      };

      const handleItemSelect = (index, item) => {
        const newItems = [...requestItems];
        newItems[index].item_id = item.id;
        newItems[index].unit = item.unit;
        newItems[index].price = item.standard_cost || 0;
        setRequestItems(newItems);
      };
      
      const addItem = () => setRequestItems([...requestItems, { item_id: '', quantity: 1, price: 0, notes: '', unit: '' }]);
      const removeItem = (index) => setRequestItems(requestItems.filter((_, i) => i !== index));

      const handleEdit = async (request) => {
        setEditingRequest(request);
        
        if (request.work_order) {
          const wo = activeWorkOrders.find(w => w.wo_number === request.work_order);
          if (wo) {
            setRequestSource('wo');
            setSelectedWO(wo.id);
          } else {
            setRequestSource('non-wo');
            setSelectedWO('');
          }
        } else {
          setRequestSource('non-wo');
          setSelectedWO('');
        }

        setFormData({
            request_date: request.request_date,
            notes: request.notes || '',
            work_order: request.work_order || '',
        });

        const { data: itemsData, error } = await supabase
            .from('purchase_request_items')
            .select('*, item:items(id, name, unit)')
            .eq('pr_id', request.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal mengambil item permintaan', description: error.message });
            return;
        }

        const formattedItems = itemsData.map(item => ({
            ...item,
            unit: item.item?.unit || ''
        }));

        setRequestItems(formattedItems.length > 0 ? formattedItems : [{ item_id: '', quantity: 1, price: 0, notes: '', unit: '' }]);
        setIsDialogOpen(true);
      };

      const handleDelete = async () => {
        if (!requestToDelete) return;
        setIsSubmitting(true);
        try {
            await supabase.from('purchase_request_items').delete().eq('pr_id', requestToDelete.id);
            const { error } = await supabase.from('purchase_requests').delete().eq('id', requestToDelete.id);
            if (error) throw error;
            
            toast({ title: 'Sukses!', description: 'Permintaan barang berhasil dihapus.' });
            await refreshData();
            setIsDeleteAlertOpen(false);
            setRequestToDelete(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal menghapus permintaan', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
      };

      const handlePreview = async (request) => {
        const { data: itemsData, error } = await supabase
            .from('purchase_request_items')
            .select('*, item:items(id, name, code, unit)')
            .eq('pr_id', request.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal mengambil detail item', description: error.message });
            return;
        }
        setPreviewRequest({ ...request, items: itemsData });
        setIsPreviewOpen(true);
      };


      const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (requestItems.some(item => !item.item_id || item.quantity <= 0)) {
            toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Pastikan semua barang telah dipilih dan kuantitas lebih dari nol.' });
            setIsSubmitting(false);
            return;
        }

        try {
            const { data: existingUser, error: userCheckError } = await supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();

            if (userCheckError) throw userCheckError;

            if (!existingUser) {
                const { error: insertUserError } = await supabase.from('users').insert({
                    id: user.id, email: user.email,
                    full_name: user.user_metadata?.name || user.email,
                    role: user.user_metadata?.role || 'viewer',
                });
                if (insertUserError) throw new Error(`Gagal menyinkronkan data pengguna: ${insertUserError.message}`);
            }
            
            const pr_number = editingRequest?.pr_number || `PR-${Date.now()}`;
            
            const prUpsertData = {
                id: editingRequest?.id,
                pr_number,
                request_date: formData.request_date,
                notes: formData.notes,
                work_order: requestSource === 'wo' ? formData.work_order : null,
                requester_id: user.id,
                user_id: user.id,
                status: 'pending',
                approved_by: null,
                approved_at: null,
            };

            if (!prUpsertData.id) delete prUpsertData.id;

            const { data: prData, error: prError } = await supabase.from('purchase_requests').upsert(prUpsertData).select().single();
            if (prError) throw prError;

            await supabase.from('purchase_request_items').delete().eq('pr_id', prData.id);

            const itemsToInsert = requestItems.map(({ item, ...itemData }) => ({
                pr_id: prData.id, item_id: itemData.item_id,
                quantity: itemData.quantity, price: itemData.price,
                notes: itemData.notes, user_id: user.id,
            }));

            const { error: itemsError } = await supabase.from('purchase_request_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
            
            toast({ title: 'Sukses!', description: `Permintaan barang berhasil ${editingRequest ? 'diperbarui dan status dikembalikan ke Pending' : 'disimpan'}.` });
            await refreshData();
            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal menyimpan permintaan', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
      };

      const handleDownloadPDF = async (pr) => {
        if (!companyProfile) {
            toast({ variant: "destructive", title: "Profil Perusahaan Belum Lengkap", description: "Lengkapi profil perusahaan sebelum mencetak PDF." });
            return;
        }

        toast({ title: "Membuat PDF...", description: "Mohon tunggu sebentar." });

        try {
            const { data: prItems, error: itemsError } = await supabase
                .from('purchase_request_items')
                .select('*, item:items(*)')
                .eq('pr_id', pr.id);
            
            if (itemsError) {
                throw itemsError;
            }

            await generatePurchaseRequestPDF(pr, prItems, companyProfile);
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal Membuat PDF", description: error.message });
        }
      };
      
      const statusConfig = {
        pending: { icon: Clock, color: 'text-yellow-500 bg-yellow-100', label: 'Pending' },
        approved: { icon: CheckCircle2, color: 'text-green-500 bg-green-100', label: 'Approved' },
        rejected: { icon: XCircle, color: 'text-red-500 bg-red-100', label: 'Rejected' },
        draft: { icon: FileText, color: 'text-gray-500 bg-gray-100', label: 'Draft' },
      };

      return (
        <>
          <Helmet><title>Permintaan Barang - Inventory</title></Helmet>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div><h1 className="text-2xl font-bold">Permintaan Barang</h1><p className="text-gray-500">Buat dan kelola permintaan barang dari gudang.</p></div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Buat Permintaan</Button>
              </div>
            </div>

            {loading ? <p>Memuat...</p> : 
             !purchaseRequests || purchaseRequests.length === 0 ? 
             <EmptyState icon={Send} title="Belum Ada Permintaan" description="Belum ada permintaan barang yang dibuat. Klik tombol di atas untuk membuat permintaan pertama Anda." actionText="Buat Permintaan" onActionClick={() => { resetForm(); setIsDialogOpen(true); }}/> :
             (
                <Card>
                    <CardHeader><CardTitle>Daftar Permintaan</CardTitle><CardDescription>Total {purchaseRequests.length} permintaan.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {purchaseRequests.map((pr, index) => {
                                const currentStatus = statusConfig[pr.status] || statusConfig.draft;
                                const StatusIcon = currentStatus.icon;
                                const itemCount = Array.isArray(pr.purchase_request_items) && pr.purchase_request_items[0]?.count ? pr.purchase_request_items[0].count : 0;
                                const canBeModified = (userRole === 'admin' || (pr.requester_id === user.id && ['pending', 'draft', 'rejected'].includes(pr.status)));

                                return (
                                <motion.div key={pr.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="border rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-lg">{pr.pr_number}</p>
                                            <p className="text-sm text-gray-500">Pemohon: {pr.requester?.full_name || 'N/A'} | Tanggal: {new Date(pr.request_date).toLocaleDateString('id-ID')}</p>
                                            {pr.work_order && <p className="text-sm text-gray-500">Work Order: <span className="font-semibold">{pr.work_order}</span></p>}
                                            <p className="text-sm text-gray-500">Jumlah Item: {itemCount}</p>
                                            {pr.status !== 'pending' && <p className="text-xs text-gray-500 mt-1">Diproses oleh: {pr.approver?.full_name || 'N/A'}</p>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${currentStatus.color}`}>
                                                <StatusIcon className="h-3 w-3" /> {currentStatus.label}
                                            </span>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handlePreview(pr)}><Eye className="h-4 w-4 text-gray-600" /></Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownloadPDF(pr)}><Download className="h-4 w-4 text-blue-600" /></Button>
                                            {canBeModified ? (
                                                <>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(pr)}><Edit className="h-4 w-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => { setRequestToDelete(pr); setIsDeleteAlertOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                                                </>
                                            ) : (pr.status === 'approved' &&
                                                <Button size="sm" variant="outline" disabled>Telah Disetujui</Button>
                                            )}
                                        </div>
                                    </div>
                                    {pr.notes && <p className="text-sm italic text-gray-600">Catatan: {pr.notes}</p>}
                                </motion.div>
                            )})}
                        </div>
                    </CardContent>
                </Card>
             )}
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setIsDialogOpen(isOpen); }}>
            <DialogContent className="max-w-4xl">
              <DialogHeader><DialogTitle>{editingRequest ? 'Edit' : 'Buat'} Permintaan Barang</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                
                <div className="space-y-2">
                    <Label>Sumber Permintaan</Label>
                    <RadioGroup defaultValue="non-wo" value={requestSource} onValueChange={setRequestSource} className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="non-wo" id="r-non-wo" />
                            <Label htmlFor="r-non-wo">Tanpa Work Order</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="wo" id="r-wo" />
                            <Label htmlFor="r-wo">Dengan Work Order</Label>
                        </div>
                    </RadioGroup>
                </div>

                {requestSource === 'wo' && (
                    <div className="space-y-2">
                        <Label>Pilih Work Order</Label>
                        <Select value={selectedWO} onValueChange={setSelectedWO}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih WO yang aktif..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeWorkOrders.map(wo => (
                                    <SelectItem key={wo.id} value={wo.id}>
                                        {wo.wo_number} - {wo.customer?.name || 'N/A'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Tanggal Permintaan</Label><Input type="date" value={formData.request_date} onChange={e => setFormData({ ...formData, request_date: e.target.value })} required /></div>
                  <div className="space-y-2"><Label>Pemohon</Label><Input value={user?.user_metadata?.name || user.email} disabled /></div>
                </div>
                
                <div className="space-y-4 pt-4">
                    <Label className="text-lg font-semibold">Item yang Diminta</Label>
                    {requestItems.map((item, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border p-2 rounded-md">
                            <div className="md:col-span-4 space-y-1"><Label>Item</Label><ProductSelector value={item.item_id} isRawMaterialMode={true} onSelectProduct={(selected) => handleItemSelect(index, selected)} /></div>
                            <div className="md:col-span-1 space-y-1"><Label>Satuan</Label><Input value={item.unit} disabled placeholder="Unit" /></div>
                            <div className="md:col-span-2 space-y-1"><Label>Jumlah</Label><Input type="number" placeholder="Jml" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)} min="1" /></div>
                            <div className="md:col-span-2 space-y-1"><Label>Estimasi Harga</Label><Input type="number" placeholder="Harga" value={item.price} onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)} min="0" /></div>
                            <div className="md:col-span-2 space-y-1"><Label>Catatan</Label><Input placeholder="Catatan item" value={item.notes} onChange={e => handleItemChange(index, 'notes', e.target.value)} /></div>
                            <div className="md:col-span-1 flex justify-end">
                                {requestItems.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}><MinusCircle className="h-5 w-5 text-red-500" /></Button>}
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addItem} className="w-full"><PlusCircle className="h-4 w-4 mr-2" />Tambah Item</Button>
                </div>

                <div className="space-y-2 pt-4"><Label>Catatan</Label><Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Tambahkan catatan umum untuk permintaan ini..." /></div>

                <DialogFooter className="pt-6">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Anda yakin ingin menghapus?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tindakan ini tidak dapat dibatalkan. Ini akan menghapus permintaan barang secara permanen
                        dari server kami.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
                        {isSubmitting ? "Menghapus..." : "Ya, Hapus"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Detail Permintaan: {previewRequest?.pr_number}</DialogTitle>
                    <DialogDescription>
                        Diminta oleh {previewRequest?.requester?.full_name} pada {previewRequest && new Date(previewRequest.request_date).toLocaleDateString('id-ID')}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2">
                    {previewRequest?.work_order && (
                        <p className="text-sm"><strong>Work Order Terkait:</strong> {previewRequest.work_order}</p>
                    )}
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted">
                                <tr className="border-b">
                                    <th className="p-2 text-left">Item</th>
                                    <th className="p-2 text-right">Jumlah</th>
                                    <th className="p-2 text-right">Harga Est.</th>
                                    <th className="p-2 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewRequest?.items?.map(item => (
                                    <tr key={item.id} className="border-b">
                                        <td className="p-2">
                                            <div className="font-medium">{item.item?.name || 'N/A'}</div>
                                            <div className="text-xs text-muted-foreground">{item.item?.code || 'N/A'}</div>
                                        </td>
                                        <td className="p-2 text-right">{item.quantity} {item.item?.unit}</td>
                                        <td className="p-2 text-right">{formatCurrency(item.price)}</td>
                                        <td className="p-2 text-right font-medium">{formatCurrency(item.quantity * item.price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end font-bold text-base pr-2">
                        Total Estimasi: {formatCurrency(previewRequest?.items?.reduce((sum, item) => sum + (item.quantity * item.price), 0))}
                    </div>
                    {previewRequest?.notes && (
                        <div className="pt-2">
                            <p className="font-semibold">Catatan:</p>
                            <p className="text-sm text-muted-foreground italic">{previewRequest.notes}</p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
    };

    export default PurchaseRequestsPage;