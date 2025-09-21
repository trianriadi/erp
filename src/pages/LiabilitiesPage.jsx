import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { Filter, Briefcase, CheckCircle2, AlertCircle, RefreshCw, Hand, Plus, DollarSign, Edit, Trash2, ShoppingCart, FileText, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmptyState from '@/components/EmptyState';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SupplierAutoComplete } from '@/components/SupplierAutoComplete';
import ConfirmationDialog from '@/components/ConfirmationDialog';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
const formatDateShort = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

const GRSelector = ({ isOpen, onOpenChange, goodsReceipts, onGRSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGRId, setSelectedGRId] = useState(null);

  const availableGRs = useMemo(() => {
    return (goodsReceipts || []).filter(gr => 
        !gr.linked_to_ap && 
        (gr.gr_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
         gr.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [goodsReceipts, searchTerm]);

  const handleSelect = () => {
      const selected = availableGRs.find(gr => gr.id === selectedGRId);
      if (selected) {
          onGRSelect(selected);
          onOpenChange(false);
      }
  };

  return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                  <DialogTitle>Pilih Penerimaan Barang (GR)</DialogTitle>
                  <DialogDescription>Pilih GR yang akan dibuatkan hutang. GR yang sudah memiliki hutang tidak akan ditampilkan.</DialogDescription>
              </DialogHeader>
              <Input placeholder="Cari nomor GR atau nama supplier..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="my-2" />
              <div className="max-h-[60vh] overflow-y-auto">
                  <Table>
                      <TableHeader><TableRow><TableHead className="w-[50px]"></TableHead><TableHead>No. GR</TableHead><TableHead>Supplier</TableHead><TableHead>Tanggal</TableHead></TableRow></TableHeader>
                      <TableBody>
                          {availableGRs.length > 0 ? availableGRs.map(gr => (
                              <TableRow key={gr.id} onClick={() => setSelectedGRId(gr.id)} className={`cursor-pointer ${selectedGRId === gr.id ? 'bg-accent' : ''}`}>
                                  <TableCell><RadioGroup><RadioGroupItem value={gr.id} checked={selectedGRId === gr.id} /></RadioGroup></TableCell>
                                  <TableCell className="font-medium">{gr.gr_number}</TableCell>
                                  <TableCell>{gr.supplier?.name}</TableCell>
                                  <TableCell>{formatDateShort(gr.receipt_date)}</TableCell>
                              </TableRow>
                          )) : <TableRow><TableCell colSpan={4} className="text-center h-24">Tidak ada GR yang tersedia.</TableCell></TableRow>}
                      </TableBody>
                  </Table>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                  <Button onClick={handleSelect} disabled={!selectedGRId}>Pilih GR Ini</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
  );
};


const POSelectorModal = ({ isOpen, onOpenChange, purchaseOrders, onPOSelect }) => {
    const [selectedPOId, setSelectedPOId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPOs = useMemo(() => {
        return (purchaseOrders || []).filter(po => 
            po.status !== 'paid' && 
            po.status !== 'cancelled' &&
            (po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
             po.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [purchaseOrders, searchTerm]);
    
    const handleSelect = () => {
        const selected = filteredPOs.find(p => p.id === selectedPOId);
        if (selected) {
            onPOSelect(selected);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Pilih Purchase Order</DialogTitle>
                    <DialogDescription>Pilih PO yang relevan. PO yang sudah lunas atau dibatalkan tidak ditampilkan.</DialogDescription>
                </DialogHeader>
                 <Input placeholder="Cari nomor PO atau nama supplier..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="my-2" />
                <div className="max-h-[60vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>No. PO</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead className="text-right">Jumlah</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPOs.length > 0 ? filteredPOs.map(po => (
                                <TableRow key={po.id} onClick={() => setSelectedPOId(po.id)} className={`cursor-pointer ${selectedPOId === po.id ? 'bg-accent' : ''}`}>
                                    <TableCell><RadioGroup><RadioGroupItem value={po.id} checked={selectedPOId === po.id} /></RadioGroup></TableCell>
                                    <TableCell className="font-medium">{po.po_number}</TableCell>
                                    <TableCell>{po.supplier.name}</TableCell>
                                    <TableCell>{formatDateShort(po.order_date)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(po.total_amount)}</TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={5} className="text-center h-24">Tidak ada PO yang aktif.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button onClick={handleSelect} disabled={!selectedPOId}>Pilih PO Ini</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const LiabilityFormDialog = ({ isOpen, onOpenChange, onFinished, liability }) => {
    const { chartOfAccounts, purchaseOrders, goodsReceipts } = useData();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sourceType, setSourceType] = useState('manual');
    const [isPOModalOpen, setIsPOModalOpen] = useState(false);
    const [isGRModalOpen, setIsGRModalOpen] = useState(false);
    
    const defaultForm = { id: null, date: new Date().toISOString().slice(0, 10), supplier_id: '', reference_no: '', amount: '', notes: '', debit_account_id: '', po_id: null, gr_id: null };
    const [formData, setFormData] = useState(defaultForm);

    useEffect(() => {
        if (isOpen) {
            if (liability) {
                setFormData({
                    id: liability.id, date: liability.date, supplier_id: liability.supplier_id, reference_no: liability.reference_no, amount: liability.amount,
                    notes: liability.notes, debit_account_id: '', po_id: liability.reference_type === 'purchase_order' ? liability.reference_id : null,
                    gr_id: liability.reference_type === 'goods_receipt' ? liability.reference_id : null,
                });
                setSourceType(liability.reference_type || 'manual');
            } else {
                setFormData(defaultForm);
                setSourceType('manual');
            }
        }
    }, [isOpen, liability]);

    const handlePOSelect = (po) => {
        if (po) { setFormData(prev => ({ ...prev, amount: po.total_amount, reference_no: `Hutang dari PO ${po.po_number}`, po_id: po.id, supplier_id: po.supplier_id, gr_id: null })); }
    }

    const handleGRSelect = async (gr) => {
        if (gr) {
            const { data, error } = await supabase.from('goods_receipt_items').select('quantity_received, actual_price').eq('gr_id', gr.id);
            if (error) { toast({ variant: 'destructive', title: 'Gagal Kalkulasi Total GR' }); return; }
            const totalAmount = data.reduce((sum, item) => sum + (item.quantity_received * item.actual_price), 0);
            setFormData(prev => ({ ...prev, amount: totalAmount, reference_no: `Hutang dari GR ${gr.gr_number}`, gr_id: gr.id, supplier_id: gr.supplier_id, po_id: null, date: gr.receipt_date }));
        }
    };

    const handleSourceChange = (type) => {
        setSourceType(type);
        setFormData(prev => ({...defaultForm, date: prev.date, debit_account_id: prev.debit_account_id}));
        if (type === 'po') { setIsPOModalOpen(true); }
        if (type === 'gr') { setIsGRModalOpen(true); }
    };
    
    const handleSubmit = async () => {
        if (!formData.date || !formData.supplier_id || !formData.amount) { toast({ variant: 'destructive', title: 'Data tidak lengkap!', description: 'Pastikan Supplier, Tanggal, dan Jumlah terisi.'}); return; }
        if (!formData.id && !formData.debit_account_id) { toast({ variant: 'destructive', title: 'Akun Debit Wajib Dipilih', description: 'Untuk hutang baru, Anda harus memilih akun debit.'}); return; }
        setIsSubmitting(true);
        
        let error;
        if (formData.id) {
            const { error: updateError } = await supabase.from('accounts_payable').update({ date: formData.date, supplier_id: formData.supplier_id, reference_no: formData.reference_no, notes: formData.notes, amount: parseFloat(formData.amount), }).eq('id', formData.id);
            error = updateError;
        } else {
            const { error: createError } = await supabase.rpc('create_manual_payable', { p_date: formData.date, p_supplier_id: formData.supplier_id, p_reference_no: formData.reference_no, p_amount: parseFloat(formData.amount), p_notes: formData.notes, p_debit_account_id: formData.debit_account_id, p_po_id: formData.po_id, p_gr_id: formData.gr_id });
            error = createError;
        }

        setIsSubmitting(false);
        if (error) { toast({ variant: 'destructive', title: 'Gagal menyimpan hutang', description: error.message }); } 
        else { toast({ title: 'Sukses!', description: 'Hutang berhasil disimpan.' }); onFinished(); }
    };
    
    const debitableAccounts = useMemo(() => chartOfAccounts.filter(acc => !['Kewajiban', 'Ekuitas', 'Pendapatan'].includes(acc.type_info?.description)), [chartOfAccounts]);
    const isSourceLocked = !!formData.po_id || !!formData.gr_id;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{formData.id ? 'Edit' : 'Catat'} Hutang Usaha</DialogTitle>
                        <DialogDescription>{formData.id ? 'Ubah detail hutang.' : 'Buat entri hutang baru secara manual atau dari dokumen.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                         {!formData.id && (<div className="space-y-3"><Label>Sumber Hutang</Label><RadioGroup defaultValue="manual" value={sourceType} onValueChange={handleSourceChange} className="flex space-x-4">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="manual" id="r-manual" /><Label htmlFor="r-manual" className="font-normal">Manual</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="po" id="r-po" /><Label htmlFor="r-po" className="font-normal">Dari PO</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="gr" id="r-gr" /><Label htmlFor="r-gr" className="font-normal">Dari Penerimaan</Label></div>
                         </RadioGroup></div>)}

                         {formData.po_id && (<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm"><p className="font-semibold text-blue-800">Terhubung dengan PO <span className="font-bold">{purchaseOrders.find(p => p.id === formData.po_id)?.po_number}</span></p><p className="text-blue-600">Jumlah dan supplier telah terisi otomatis.</p></div>)}
                         {formData.gr_id && (<div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm"><p className="font-semibold text-green-800">Terhubung dengan GR <span className="font-bold">{goodsReceipts.find(g => g.id === formData.gr_id)?.gr_number}</span></p><p className="text-green-600">Jumlah dan supplier telah terisi otomatis.</p></div>)}
                        
                         <div className="space-y-2"><Label>Supplier</Label><SupplierAutoComplete onSupplierChange={(supplier) => setFormData(prev => ({ ...prev, supplier_id: supplier?.id || '' }))} initialSupplierId={formData.supplier_id} disabled={isSourceLocked}/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Tanggal Hutang</Label><Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                            <div className="space-y-2"><Label>Jumlah Hutang</Label><Input type="number" placeholder="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} disabled={isSourceLocked} /></div>
                        </div>
                        <div className="space-y-2"><Label>Nomor Referensi</Label><Input placeholder="e.g. INV-123" value={formData.reference_no} onChange={e => setFormData({...formData, reference_no: e.target.value})} disabled={isSourceLocked} /></div>
                        
                        {!formData.id && (<div className="space-y-2"><Label>Debit ke Akun</Label><Select value={formData.debit_account_id} onValueChange={val => setFormData({...formData, debit_account_id: val})}><SelectTrigger><SelectValue placeholder="Pilih akun untuk di-debit..." /></SelectTrigger><SelectContent>{debitableAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Pilih akun yang biayanya bertambah, misal "Beban Operasional" atau "Persediaan".</p></div>)}

                        <div className="space-y-2"><Label>Keterangan</Label><Textarea placeholder="Catatan tambahan..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan Hutang'}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <POSelectorModal isOpen={isPOModalOpen} onOpenChange={(open) => { setIsPOModalOpen(open); if (!open && !formData.po_id) setSourceType('manual'); }} purchaseOrders={purchaseOrders} onPOSelect={handlePOSelect} />
            <GRSelector isOpen={isGRModalOpen} onOpenChange={(open) => { setIsGRModalOpen(open); if (!open && !formData.gr_id) setSourceType('manual'); }} goodsReceipts={goodsReceipts} onGRSelect={handleGRSelect} />
        </>
    );
};

const PayLiabilityDialog = ({ isOpen, onOpenChange, liability, onPaid }) => {
    const { user } = useAuth();
    const { accounts: cashAccounts } = useData();
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
    const [cashAccountId, setCashAccountId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const remainingAmount = liability ? liability.amount - liability.amount_paid : 0;
    
    useEffect(() => {
        if (liability) setPaymentAmount(remainingAmount.toString());
        if (cashAccounts.length > 0 && !cashAccountId) {
            const defaultCashAccount = cashAccounts.find(acc => acc.code === '1110');
            setCashAccountId(defaultCashAccount ? defaultCashAccount.id : cashAccounts[0].id);
        }
    }, [liability, cashAccounts, cashAccountId]);

    const handleSubmit = async () => {
        if (!paymentAmount || !paymentDate || !cashAccountId || !liability) return;
        const amount = parseFloat(paymentAmount);
        if (amount <= 0 || amount > remainingAmount + 0.01) { toast({ variant: 'destructive', title: 'Jumlah tidak valid', description: 'Jumlah pembayaran tidak boleh lebih dari sisa hutang.' }); return; }
        setIsSubmitting(true);
        const { error } = await supabase.rpc('pay_account_payable', { p_ap_id: liability.id, p_payment_amount: amount, p_payment_date: paymentDate, p_cash_account_id: cashAccountId, p_user_id: user.id });
        setIsSubmitting(false);

        if (error) { toast({ variant: 'destructive', title: 'Gagal membayar hutang', description: error.message }); } 
        else { toast({ title: 'Sukses', description: 'Pembayaran hutang berhasil dicatat.' }); onPaid(); onOpenChange(false); }
    };

    if (!liability) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Bayar Hutang: {liability.reference_no}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Sisa Hutang</Label><Input value={formatCurrency(remainingAmount)} disabled /></div>
                    <div className="space-y-2"><Label htmlFor="paymentAmount">Jumlah Bayar</Label><Input id="paymentAmount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="paymentDate">Tanggal Bayar</Label><Input id="paymentDate" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="cashAccount">Bayar Dari Akun</Label>
                        <Select value={cashAccountId} onValueChange={setCashAccountId}><SelectTrigger><SelectValue placeholder="Pilih akun kas/bank..."/></SelectTrigger>
                            <SelectContent>{cashAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Memproses...' : 'Bayar'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const LiabilitiesPage = () => {
    const { accountsPayable, loading, refreshData } = useData();
    const [filter, setFilter] = useState({ status: 'unpaid', source: 'all' });
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [selectedLiability, setSelectedLiability] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredLiabilities = useMemo(() => {
        return (accountsPayable || []).filter(l => {
            const statusMatch = filter.status === 'all' || (filter.status === 'unpaid' && (l.status === 'unpaid' || l.status === 'partial')) || l.status === filter.status;
            const sourceMatch = filter.source === 'all' || l.reference_type === filter.source;
            return statusMatch && sourceMatch;
        });
    }, [accountsPayable, filter]);
    
    const handleFormOpen = (liability = null) => { setSelectedLiability(liability); setIsFormOpen(true); };
    const handleFormFinished = () => { setIsFormOpen(false); refreshData(); };
    const handlePayClick = (liability) => { setSelectedLiability(liability); setIsPayDialogOpen(true); };
    
    const handleDeleteClick = (liability) => {
        if (liability.amount_paid > 0) {
            toast({ variant: "destructive", title: "Hapus Gagal", description: "Hutang yang sudah dibayar (walau sebagian) tidak dapat dihapus." });
            return;
        }
        setSelectedLiability(liability);
        setIsConfirmDeleteOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedLiability) return;
        setIsSubmitting(true);
        
        try {
            const { data: apData, error: fetchError } = await supabase.from('accounts_payable').select('transaction_id').eq('id', selectedLiability.id).single();
            if (fetchError) throw new Error(`Gagal mengambil data hutang: ${fetchError.message}`);
            if (!apData) throw new Error("Data hutang tidak ditemukan.");
            
            if (apData.transaction_id) {
                const { error: jeError } = await supabase.from('journal_entries').delete().eq('transaction_id', apData.transaction_id);
                if (jeError) throw new Error(`Gagal menghapus jurnal: ${jeError.message}`);
                
                const { error: txError } = await supabase.from('transactions').delete().eq('id', apData.transaction_id);
                if (txError) throw new Error(`Gagal menghapus transaksi: ${txError.message}`);
            }

            const { error: apError } = await supabase.from('accounts_payable').delete().eq('id', selectedLiability.id);
            if (apError) throw new Error(`Gagal menghapus hutang: ${apError.message}`);
            
            toast({ title: "Sukses", description: "Hutang dan jurnal terkait berhasil dihapus." });
            await refreshData();
        } catch (error) {
            toast({ variant: 'destructive', title: "Gagal Menghapus", description: error.message });
        } finally {
            setIsSubmitting(false);
            setIsConfirmDeleteOpen(false);
        }
    };
    
    const getStatusBadge = (status) => {
        if (status === 'paid') return <div className="flex items-center text-xs font-medium text-green-800 bg-green-100 px-2 py-1 rounded-full"><CheckCircle2 className="h-3 w-3 mr-1" />Lunas</div>;
        if (status === 'partial') return <div className="flex items-center text-xs font-medium text-yellow-800 bg-yellow-100 px-2 py-1 rounded-full"><DollarSign className="h-3 w-3 mr-1" />Sebagian</div>;
        return <div className="flex items-center text-xs font-medium text-red-800 bg-red-100 px-2 py-1 rounded-full"><AlertCircle className="h-3 w-3 mr-1" />Belum Lunas</div>;
    };

    const getTypeBadge = (type) => {
        if (type === 'manual') return <div className="flex items-center text-xs font-medium text-blue-800 bg-blue-100 px-2 py-1 rounded-full"><FileText className="h-3 w-3 mr-1" />Manual</div>;
        if (type === 'purchase_order') return <div className="flex items-center text-xs font-medium text-indigo-800 bg-indigo-100 px-2 py-1 rounded-full"><ShoppingCart className="h-3 w-3 mr-1" />PO</div>;
        if (type === 'goods_receipt') return <div className="flex items-center text-xs font-medium text-cyan-800 bg-cyan-100 px-2 py-1 rounded-full"><Truck className="h-3 w-3 mr-1" />Penerimaan</div>;
        return <div className="flex items-center text-xs font-medium text-purple-800 bg-purple-100 px-2 py-1 rounded-full"><Briefcase className="h-3 w-3 mr-1" />Otomatis</div>;
    };
    
    const canEdit = (liability) => liability.reference_type === 'manual';
    const canDelete = (liability) => liability.amount_paid <= 0;

    return (
    <>
        <Helmet><title>Daftar Hutang - Sistem Keuangan</title></Helmet>
        
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900">Daftar Hutang Usaha</h1><p className="text-gray-500">Lacak semua hutang ke supplier yang tercatat.</p></div>
                <div className="flex gap-2">
                    <Button onClick={() => handleFormOpen(null)}><Plus className="h-4 w-4 mr-2" />Catat Hutang Baru</Button>
                    <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle className="flex items-center"><Filter className="h-4 w-4 mr-2" /> Filter Hutang</CardTitle></CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                    <Select value={filter.status} onValueChange={(v) => setFilter(f => ({...f, status: v}))}><SelectTrigger className="w-full md:w-1/3"><SelectValue/></SelectTrigger>
                        <SelectContent><SelectItem value="all">Semua Status</SelectItem><SelectItem value="unpaid">Belum Lunas</SelectItem><SelectItem value="partial">Bayar Sebagian</SelectItem><SelectItem value="paid">Lunas</SelectItem></SelectContent>
                    </Select>
                    <Select value={filter.source} onValueChange={(v) => setFilter(f => ({...f, source: v}))}><SelectTrigger className="w-full md:w-1/3"><SelectValue/></SelectTrigger>
                        <SelectContent><SelectItem value="all">Semua Sumber</SelectItem><SelectItem value="manual">Manual</SelectItem><SelectItem value="purchase_order">Dari PO</SelectItem><SelectItem value="goods_receipt">Dari Penerimaan</SelectItem></SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {loading ? <p className="text-center py-10">Memuat data hutang...</p> :
            !accountsPayable || accountsPayable.length === 0 ? (<EmptyState icon={Briefcase} title="Tidak Ada Hutang" description="Selamat! Anda tidak memiliki hutang usaha yang tercatat." actionText="Catat Hutang Baru" onActionClick={() => handleFormOpen(null)}/>) : 
            filteredLiabilities.length === 0 ? (<EmptyState icon={Filter} title="Tidak Ada Hutang Ditemukan" description="Tidak ada data hutang yang cocok dengan filter Anda." actionText="Reset Filter" onActionClick={() => setFilter({ status: 'all', source: 'all' })} />) : 
            (<Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Referensi</TableHead><TableHead>Tanggal</TableHead><TableHead className="text-right">Total Hutang</TableHead><TableHead className="text-right">Sisa Hutang</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>{filteredLiabilities.map((liability) => (<TableRow key={liability.id}><TableCell className="font-medium">{liability.supplier?.name || 'N/A'}</TableCell><TableCell><div>{liability.reference_no}</div><div className="mt-1">{getTypeBadge(liability.reference_type)}</div></TableCell><TableCell>{formatDateShort(liability.date)}</TableCell><TableCell className="text-right">{formatCurrency(liability.amount)}</TableCell><TableCell className="text-right font-bold">{formatCurrency(liability.amount - liability.amount_paid)}</TableCell><TableCell>{getStatusBadge(liability.status)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1">
                {liability.status !== 'paid' && (<Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handlePayClick(liability)}><Hand className="h-4 w-4" /></Button>)}
                <Button variant="ghost" size="icon" onClick={() => handleFormOpen(liability)} disabled={!canEdit(liability)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteClick(liability)} disabled={!canDelete(liability)}><Trash2 className="h-4 w-4" /></Button>
            </div></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>)}
        </div>
        
        <PayLiabilityDialog isOpen={isPayDialogOpen} onOpenChange={setIsPayDialogOpen} liability={selectedLiability} onPaid={refreshData} />
        <LiabilityFormDialog isOpen={isFormOpen} onOpenChange={setIsFormOpen} onFinished={handleFormFinished} liability={selectedLiability} />
        <ConfirmationDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen} onConfirm={handleDeleteConfirm} title={`Yakin ingin menghapus hutang ${selectedLiability?.reference_no}?`} description="Aksi ini akan menghapus hutang beserta jurnal akuntansi terkait. Aksi ini tidak dapat dibatalkan." isSubmitting={isSubmitting} confirmText="Ya, Hapus" />
    </>
    );
};

export default LiabilitiesPage;