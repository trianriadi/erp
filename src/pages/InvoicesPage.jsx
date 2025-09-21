import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { PlusCircle, Edit, Trash2, FileText, DollarSign, Download, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import EmptyState from '@/components/EmptyState';
import useDebounce from '@/hooks/useDebounce';
import { addCompanyHeader } from '@/lib/pdfUtils';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (date) => format(new Date(date), "d MMMM yyyy", { locale: id });

const statusConfig = {
    unpaid: { label: 'Belum Lunas', color: 'bg-red-200 text-red-800' },
    partial: { label: 'Lunas Sebagian', color: 'bg-yellow-200 text-yellow-800' },
    paid: { label: 'Lunas', color: 'bg-green-200 text-green-800' },
};

const PDFPreviewDialog = ({ isOpen, onOpenChange, pdfDataUri, onDownload, fileName }) => {
    const handleDownloadClick = () => {
         if (pdfDataUri) {
            const link = document.createElement('a');
            link.href = pdfDataUri;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        onDownload();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Pratinjau PDF</DialogTitle>
                    <DialogDescription>Periksa dokumen sebelum mengunduh. Gunakan tombol di bawah untuk mengunduh.</DialogDescription>
                </DialogHeader>
                <div className="h-[calc(90vh-150px)] w-full">
                    {pdfDataUri ? (
                        <iframe src={pdfDataUri} width="100%" height="100%" title="PDF Preview" className="border-0" />
                    ) : (
                        <div className="flex items-center justify-center h-full">Membuat pratinjau...</div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
                    <Button onClick={handleDownloadClick} disabled={!pdfDataUri}>
                        <Download className="mr-2 h-4 w-4" /> Unduh PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const InvoiceForm = ({ invoice, onFinished, quotationData = null }) => {
    const { customers, layoutTemplates, termsTemplates, refreshData, chartOfAccounts } = useData();
    const { user } = useAuth();
    const [isGeneratingNo, setIsGeneratingNo] = useState(false);
    const [formData, setFormData] = useState({
        id: invoice?.id || null,
        invoice_no: invoice?.invoice_no || '',
        customer_id: invoice?.customer_id || quotationData?.customer_id || '',
        date: invoice?.date || new Date().toISOString().split('T')[0],
        due_date: invoice?.due_date || new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
        po_number: invoice?.po_number || quotationData?.po_number || '',
        notes: invoice?.notes || quotationData?.notes || '',
        template_id: invoice?.template_id || quotationData?.template_id || null,
        payment_type: invoice?.payment_type || 'full',
        dp_percent: invoice?.dp_percent || 0,
        discount: invoice?.discount ?? quotationData?.discount ?? 0,
        delivery_cost: invoice?.delivery_cost ?? quotationData?.delivery_cost ?? 0,
        product_status: invoice?.product_status || quotationData?.product_status || '',
    });
    const [items, setItems] = useState(invoice?.items || quotationData?.items || [{ description: '', specification: '', qty: 1, unit_price: 0 }]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

     useEffect(() => {
        if (!formData.template_id && layoutTemplates.length > 0) {
            const defaultTemplate = layoutTemplates.find(t => t.is_default) || layoutTemplates[0];
            if (defaultTemplate) {
                setFormData(prev => ({ ...prev, template_id: defaultTemplate.id }));
            }
        }
    }, [layoutTemplates, formData.template_id]);
    
     useEffect(() => {
        const generateAndSetNewNo = async () => {
            if (!formData.id && !formData.invoice_no) { // Only run for new, empty invoices
                setIsGeneratingNo(true);
                const { data: newInvoiceNo, error: noError } = await supabase.rpc('generate_document_no', { prefix: 'INV' });
                 if (noError) {
                    toast({ variant: 'destructive', title: 'Gagal membuat nomor invoice otomatis', description: noError.message });
                } else {
                    setFormData(prev => ({ ...prev, invoice_no: newInvoiceNo }));
                }
                setIsGeneratingNo(false);
            }
        };
        generateAndSetNewNo();
    }, [formData.id, formData.invoice_no, toast]);

    useEffect(() => {
        const fetchItems = async () => {
            if (invoice?.id && !quotationData) {
                const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('created_at');
                if (error) {
                    toast({ variant: 'destructive', title: 'Gagal memuat item invoice', description: error.message });
                } else {
                    setItems(data.length > 0 ? data : [{ description: '', specification: '', qty: 1, unit_price: 0 }]);
                }
            }
        };
        fetchItems();
    }, [invoice, quotationData, toast]);


    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const parsedValue = parseFloat(value);
        newItems[index][field] = ['description', 'specification'].includes(field) ? value : (isNaN(parsedValue) ? '' : parsedValue);
        setItems(newItems);
    };

    const handleTermsTemplateChange = (templateId) => {
        const selectedTemplate = termsTemplates.find(t => t.id === templateId);
        if (selectedTemplate) {
            setFormData(prev => ({ ...prev, notes: selectedTemplate.terms_and_conditions }));
        }
    };

    const addItem = () => setItems([...items, { description: '', specification: '', qty: 1, unit_price: 0 }]);
    const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

    const { subtotal, totalAmount, dpAmount, remainingAmount } = useMemo(() => {
        const sub = items.reduce((sum, item) => sum + ((item.qty || 0) * (item.unit_price || 0)), 0);
        const afterDiscount = sub - (formData.discount || 0);
        const total = afterDiscount + (formData.delivery_cost || 0);
        
        let dp = 0;
        let remaining = total;
        if (formData.payment_type === 'dp' && formData.dp_percent > 0) {
            dp = total * (formData.dp_percent / 100);
            remaining = total - dp;
        }
        return { subtotal: sub, totalAmount: total, dpAmount: dp, remainingAmount: remaining };
    }, [items, formData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customer_id) { toast({ variant: 'destructive', title: 'Pelanggan harus dipilih' }); return; }
        if (!formData.invoice_no) { toast({ variant: 'destructive', title: 'Nomor invoice harus diisi' }); return; }
        if (!chartOfAccounts.find(a => a.code === '1210') || !chartOfAccounts.find(a => a.code === '4110')) {
            toast({ variant: 'destructive', title: 'Akun Belum Lengkap', description: 'Pastikan akun Piutang Usaha (1210) dan Pendapatan Penjualan (4110) ada.' });
            return;
        }
        setLoading(true);

        const invoicePayload = {
            ...(invoice?.id && { id: invoice.id }),
            invoice_no: formData.invoice_no,
            customer_id: formData.customer_id,
            date: formData.date,
            due_date: formData.due_date,
            po_number: formData.po_number,
            notes: formData.notes,
            template_id: formData.template_id,
            payment_type: formData.payment_type,
            dp_percent: formData.dp_percent,
            discount: formData.discount,
            delivery_cost: formData.delivery_cost,
            product_status: formData.product_status,
            subtotal: subtotal,
            total_amount: totalAmount,
            dp_amount: dpAmount,
            remaining_amount: remainingAmount,
            quotation_id: quotationData?.id || invoice?.quotation_id,
        };

        const itemsPayload = items.map(item => ({
            description: item.description,
            specification: item.specification,
            qty: item.qty || 1,
            unit_price: item.unit_price || 0,
            subtotal: (item.qty || 1) * (item.unit_price || 0),
        }));

        const { error } = await supabase.rpc('create_or_update_invoice_with_journal', {
            p_invoice_data: invoicePayload,
            p_items_data: itemsPayload,
            p_user_id: user.id
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal menyimpan invoice', description: error.message });
        } else {
            toast({ title: `Invoice berhasil ${invoice?.id ? 'diperbarui' : 'dibuat'}` });
            await refreshData();
            onFinished();
        }
        
        setLoading(false);
    };

    const filteredTermsTemplates = termsTemplates.filter(t => t.document_type === 'invoice' || t.document_type === 'all');

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="customer">Pelanggan</Label>
                    <Select value={formData.customer_id} onValueChange={(value) => setFormData({ ...formData, customer_id: value })} required>
                        <SelectTrigger><SelectValue placeholder="Pilih Pelanggan" /></SelectTrigger>
                        <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label>Template Layout</Label>
                    <Select value={formData.template_id || ''} onValueChange={(v) => setFormData({...formData, template_id: v})}>
                        <SelectTrigger><SelectValue placeholder="Pilih Template" /></SelectTrigger>
                        <SelectContent>{layoutTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="invoice_no">Nomor Invoice</Label>
                    <Input id="invoice_no" value={formData.invoice_no} onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })} required disabled={isGeneratingNo} />
                </div>
                <div><Label htmlFor="po_number">No. PO</Label><Input id="po_number" value={formData.po_number} onChange={(e) => setFormData({ ...formData, po_number: e.target.value })} /></div>
                <div><Label htmlFor="date">Tanggal Terbit</Label><Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required /></div>
                <div><Label htmlFor="due_date">Jatuh Tempo</Label><Input id="due_date" type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} required /></div>
                 <div>
                    <Label htmlFor="product_status">Status Produk</Label>
                    <Input id="product_status" placeholder="Cth: Preorder 14-21 hari" value={formData.product_status} onChange={(e) => setFormData({ ...formData, product_status: e.target.value })} />
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle>Item Invoice</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {items.map((item, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3 relative">
                            <Button type="button" variant="destructive" size="icon" className="absolute -top-3 -right-3 h-7 w-7" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4" /></Button>
                            <Input placeholder="Deskripsi" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} required />
                            <Textarea placeholder="Spesifikasi Barang" value={item.specification || ''} onChange={(e) => handleItemChange(index, 'specification', e.target.value)} />
                            <div className="flex items-end gap-2">
                                <Input type="number" className="w-20" placeholder="Qty" value={item.qty} onChange={(e) => handleItemChange(index, 'qty', e.target.value)} required />
                                <Input type="number" className="flex-grow" placeholder="Harga" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} required />
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addItem}>Tambah Item</Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="notes">Catatan / Syarat & Ketentuan</Label>
                    <Select onValueChange={handleTermsTemplateChange}>
                        <SelectTrigger className="mb-2">
                            <SelectValue placeholder="Gunakan Template Syarat & Ketentuan" />
                        </SelectTrigger>
                        <SelectContent>
                            {filteredTermsTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                    <div className="mt-4">
                        <Label>Tipe Pembayaran</Label>
                         <RadioGroup value={formData.payment_type} onValueChange={(v) => setFormData({ ...formData, payment_type: v, dp_percent: v === 'full' ? 0 : formData.dp_percent })} className="flex gap-4 mt-2">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="full" id="full_payment" /><Label htmlFor="full_payment">Full Payment</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="dp" id="dp_payment" /><Label htmlFor="dp_payment">Down Payment (DP)</Label></div>
                        </RadioGroup>
                        {formData.payment_type === 'dp' && (
                            <div className="mt-2 flex items-center gap-2">
                                <Input type="number" className="w-24" placeholder="DP (%)" value={formData.dp_percent} onChange={(e) => setFormData({ ...formData, dp_percent: parseFloat(e.target.value) || 0 })} />
                                <span className="text-sm text-muted-foreground">({formatCurrency(dpAmount)})</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div><Label htmlFor="discount">Diskon</Label><Input id="discount" type="number" value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}/></div>
                        <div><Label htmlFor="delivery_cost">Biaya Kirim</Label><Input id="delivery_cost" type="number" value={formData.delivery_cost} onChange={(e) => setFormData({ ...formData, delivery_cost: parseFloat(e.target.value) || 0 })}/></div>
                    </div>
                    <div className="text-right space-y-1 pt-2">
                        <p>Subtotal: {formatCurrency(subtotal)}</p>
                        <p>Diskon: -{formatCurrency(formData.discount)}</p>
                        <p>Biaya Kirim: {formatCurrency(formData.delivery_cost)}</p>
                        <p className="font-bold text-lg">Total: {formatCurrency(totalAmount)}</p>
                        {formData.payment_type === 'dp' && (
                            <>
                                <p className="text-blue-600">DP ({formData.dp_percent}%): {formatCurrency(dpAmount)}</p>
                                <p className="text-red-600">Sisa Pelunasan: {formatCurrency(remainingAmount)}</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <DialogFooter><Button type="submit" disabled={loading || isGeneratingNo}>{loading ? 'Menyimpan...' : 'Simpan Invoice'}</Button></DialogFooter>
        </form>
    );
};

const PaymentForm = ({ invoice, onFinished }) => {
    const { accounts, refreshData } = useData();
    const [amount, setAmount] = useState('');
    const [payment_date, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [payment_method, setPaymentMethod] = useState('Bank Transfer');
    const [cash_account_id, setCashAccountId] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (accounts.length > 0 && !cash_account_id) {
            const cashAccounts = accounts.filter(a => a.is_cash_account);
            const defaultAccount = cashAccounts.find(a => a.name.toLowerCase().includes('bank')) || cashAccounts[0];
            if (defaultAccount) setCashAccountId(defaultAccount.id);
        }
    }, [accounts, cash_account_id]);


    const remainingBalance = useMemo(() => {
        const totalPaid = invoice.amount_paid;
        return invoice.total_amount - totalPaid;
    }, [invoice]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!cash_account_id) {
            toast({ variant: 'destructive', title: 'Rekening penerima harus dipilih' });
            return;
        }
        setLoading(true);
        const { error } = await supabase.rpc('handle_invoice_payment', {
            p_invoice_id: invoice.id,
            p_amount: parseFloat(amount),
            p_payment_date: payment_date,
            p_payment_method: payment_method,
            p_cash_account_id: cash_account_id
        });
        if (error) {
            toast({ variant: 'destructive', title: 'Gagal mencatat pembayaran', description: error.message });
        } else {
            toast({ title: 'Pembayaran berhasil dicatat' });
            await refreshData();
            onFinished();
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Sisa Tagihan: {formatCurrency(remainingBalance)}</Label></div>
            <div>
                <Label htmlFor="cash_account_id">Setor ke Akun</Label>
                <Select value={cash_account_id} onValueChange={setCashAccountId} required>
                    <SelectTrigger><SelectValue placeholder="Pilih akun kas/bank..." /></SelectTrigger>
                    <SelectContent>{accounts.filter(a => a.is_cash_account).map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div><Label htmlFor="amount">Jumlah Bayar</Label><Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required max={remainingBalance}/></div>
            <div><Label htmlFor="payment_date">Tanggal Bayar</Label><Input id="payment_date" type="date" value={payment_date} onChange={(e) => setPaymentDate(e.target.value)} required /></div>
            <div><Label htmlFor="payment_method">Metode</Label><Input id="payment_method" value={payment_method} onChange={(e) => setPaymentMethod(e.target.value)} required /></div>
            <DialogFooter><Button type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan Pembayaran'}</Button></DialogFooter>
        </form>
    );
};

const InvoicesPage = () => {
    const { invoices, companyProfile, layoutTemplates, loading, refreshData } = useData();
    const { user } = useAuth();
    const userRole = user?.user_metadata?.role;
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [pdfDataUri, setPdfDataUri] = useState('');
    const [pdfFileName, setPdfFileName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const { toast } = useToast();
    
    const filteredInvoices = useMemo(() => {
        if (!debouncedSearchTerm) return invoices;
        const lowercasedTerm = debouncedSearchTerm.toLowerCase();
        return invoices.filter(inv =>
            inv.invoice_no?.toLowerCase().includes(lowercasedTerm) ||
            inv.customer?.name?.toLowerCase().includes(lowercasedTerm) ||
            statusConfig[inv.status]?.label.toLowerCase().includes(lowercasedTerm)
        );
    }, [invoices, debouncedSearchTerm]);


    const handleAction = (invoice, action) => {
        setSelectedInvoice(invoice);
        if (action === 'edit') {
            setIsFormOpen(true);
        }
        if (action === 'delete') handleDelete(invoice.id);
        if (action === 'payment') setIsPaymentFormOpen(true);
    };
    
    const generatePDF = async (invoiceId) => {
        if (!companyProfile) {
            toast({ variant: 'destructive', title: 'Profil perusahaan belum lengkap', description: 'Harap lengkapi profil perusahaan sebelum mengekspor PDF.' });
            return { dataUri: null, fileName: '' };
        }
        
        const { data: invoice, error: qError } = await supabase.from('invoices').select('*, customer:customers(*), template:quotation_templates(*), creator:users(*)').eq('id', invoiceId).single();
        const { data: items, error: iError } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('created_at');
    
        if (qError || iError) {
            toast({ variant: 'destructive', title: 'Gagal memuat data untuk PDF', description: qError?.message || iError?.message });
            return { dataUri: null, fileName: '' };
        }
        
        const customerName = invoice.customer?.name.replace(/[^a-z0-9]/gi, '_') || 'Customer';
        const fileName = `${customerName}-${invoice.invoice_no}.pdf`;
        setPdfFileName(fileName);

        const totalPaid = invoice.amount_paid;
        const template = invoice.template || layoutTemplates.find(t => t.is_default) || {};
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        let contentStartY = await addCompanyHeader(doc, companyProfile);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', 200, contentStartY, { align: 'right' });
        
        let infoStartY = contentStartY + 10;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('KEPADA YTH,', 15, infoStartY);
        doc.setFont('helvetica', 'normal');
        
        let customerInfoY = infoStartY + 5;
        if (invoice.customer.name) {
            doc.text(invoice.customer.name, 15, customerInfoY);
            customerInfoY += 5;
        }
        if (invoice.customer.contact_person) {
            doc.text(`UP: ${invoice.customer.contact_person}`, 15, customerInfoY);
            customerInfoY += 5;
        }

        const customerAddressLines = doc.splitTextToSize(invoice.customer.address || '', 80);
        doc.text(customerAddressLines, 15, customerInfoY);
        customerInfoY += customerAddressLines.length * 4;
        doc.text(invoice.customer.phone || '', 15, customerInfoY);

        const headerInfo = [
            { title: "Invoice #", value: invoice.invoice_no },
            { title: "Tanggal Terbit", value: formatDate(invoice.date) },
            { title: "Jatuh Tempo", value: formatDate(invoice.due_date) },
            { title: "No. PO", value: invoice.po_number || '-' }
        ];

        let headerInfoY = infoStartY;
        headerInfo.forEach(info => {
             doc.setFont('helvetica', 'bold');
             doc.text(info.title, 140, headerInfoY, {align: 'left'});
             doc.setFont('helvetica', 'normal');
             doc.text(`: ${info.value}`, 165, headerInfoY, {align: 'left'});
             headerInfoY += 5;
        });

        const tableStartY = Math.max(customerInfoY, headerInfoY) + 10;
        
        const tableBody = [];
        items.forEach((item, index) => {
            tableBody.push([
                { content: index + 1 },
                { content: item.description },
                { content: item.qty },
                { content: formatCurrency(item.unit_price) },
                { content: formatCurrency(item.subtotal) },
            ]);
            if (item.specification) {
                tableBody.push([
                    { content: '' },
                    { content: `Spesifikasi: ${item.specification}`, colSpan: 4, styles: { fontStyle: 'italic', textColor: [100, 100, 100], fontSize: 8 } }
                ]);
            }
        });

        doc.autoTable({
            head: [['No', 'Description', 'Qty', 'Unit Price', 'Amount']],
            body: tableBody,
            startY: tableStartY,
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            columnStyles: { 
                0: { cellWidth: 10, halign: 'center' }, 
                1: { halign: 'left' },
                2: { halign: 'center' }, 
                3: { halign: 'center' }, 
                4: { halign: 'center' } 
            },
            theme: template.table_style === 'minimal' ? 'striped' : 'grid',
        });
        
        let finalY = doc.previousAutoTable.finalY;
        const itemSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        
        const summary = [];
        
        summary.push({ label: 'Subtotal', value: formatCurrency(itemSubtotal) });
        if (invoice.discount > 0) {
            summary.push({ label: 'Diskon', value: formatCurrency(-invoice.discount) });
        }
         if (invoice.delivery_cost > 0) {
            summary.push({ label: 'Biaya Kirim', value: formatCurrency(invoice.delivery_cost) });
        }
        
        summary.push(
            { label: 'Total Tagihan', value: formatCurrency(invoice.total_amount), bold: true }
        );

        if (invoice.payment_type === 'dp' && invoice.dp_amount > 0) {
            summary.push({ label: `DP (${invoice.dp_percent}%)`, value: formatCurrency(invoice.dp_amount) });
        }
        summary.push({ label: 'Sudah Dibayar', value: formatCurrency(totalPaid) });
        summary.push({ label: 'Sisa Tagihan', value: formatCurrency(invoice.total_amount - totalPaid), bold: true });

        summary.forEach((item, index) => {
            doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
            doc.text(item.label, 140, finalY + 8 + (index * 5));
            doc.text(item.value, 200, finalY + 8 + (index * 5), { align: 'right' });
        });

        finalY += summary.length * 5 + 5;

        if (template.show_terms && invoice.notes) {
            finalY += 5;
            doc.setFont('helvetica', 'bold');
            doc.text('Syarat & Ketentuan:', 15, finalY);
            doc.setFont('helvetica', 'normal');
            const notesLines = doc.splitTextToSize(invoice.notes, 180);
            let notesY = finalY + 5;
            notesLines.forEach(line => {
                doc.text(line, 15, notesY);
                notesY += 5;
            });
            finalY = notesY;

             if (invoice.product_status) {
                finalY += 5;
                doc.setFont('helvetica', 'bold');
                doc.text('Status Produk:', 15, finalY);
                doc.setFont('helvetica', 'normal');
                doc.text(invoice.product_status, 40, finalY);
                finalY += 5;
            }
        } else if (invoice.product_status) {
            finalY += 5;
            doc.setFont('helvetica', 'bold');
            doc.text('Status Produk:', 15, finalY);
            doc.setFont('helvetica', 'normal');
            doc.text(invoice.product_status, 40, finalY);
            finalY += 5;
        }
        
        const signatureY = finalY > 230 ? 240 : Math.max(finalY + 15, 230);
        doc.setFont('helvetica', 'bold');
        doc.text('Hormat Kami,', 170, signatureY, { align: 'center' });
        
        doc.setLineWidth(0.3);
        doc.line(150, signatureY + 25, 190, signatureY + 25);

        doc.setFont('helvetica', 'normal');
        const creatorName = invoice.creator?.full_name || user?.user_metadata?.full_name || '(............................)';
        doc.text(creatorName, 170, signatureY + 30, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text('Finance Manager', 170, signatureY + 35, { align: 'center' });


        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150);
        doc.text('INVOICE INI DIBUAT OTOMATIS OLEH SYSTEM ERP PT TRIMATRA KARYA INOVASI', doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' });


        return { dataUri: doc.output('datauristring'), fileName };
    };

    const handlePreviewPDF = async (invoiceId) => {
        setPdfDataUri('');
        setIsPreviewOpen(true);
        const { dataUri, fileName } = await generatePDF(invoiceId);
        if (dataUri) {
            setPdfDataUri(dataUri);
            setPdfFileName(fileName);
        } else {
            setIsPreviewOpen(false);
        }
    };

    const handleAddNew = () => {
        setSelectedInvoice(null);
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus invoice ini? Aksi ini akan menghapus semua jurnal, pembayaran, dan data terkait secara permanen.')) return;
        
        const { data, error } = await supabase.rpc('delete_invoice_with_relations', { p_invoice_id: id, p_user_id: user.id });
        
        if (error) { 
            toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message }); 
        } else {
            toast({ title: 'Sukses', description: data });
            refreshData();
        }
    };

    const handleFormFinished = () => {
        setIsFormOpen(false);
        setSelectedInvoice(null);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Daftar Invoice</CardTitle>
                        <p className="text-sm text-muted-foreground">Kelola semua tagihan Anda.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari invoice..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                            <DialogTrigger asChild><Button className="w-full sm:w-auto" onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> Buat Invoice</Button></DialogTrigger>
                            <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{selectedInvoice ? 'Edit Invoice' : 'Invoice Baru'}</DialogTitle></DialogHeader>
                            <InvoiceForm 
                                invoice={selectedInvoice} 
                                onFinished={handleFormFinished} 
                            />
                            </DialogContent>
                        </Dialog>
                        <Dialog open={isPaymentFormOpen} onOpenChange={setIsPaymentFormOpen}>
                            <DialogTrigger asChild><Button variant="outline" className="hidden">Catat Pembayaran</Button></DialogTrigger>
                            <DialogContent><DialogHeader><DialogTitle>Catat Pembayaran</DialogTitle></DialogHeader>{selectedInvoice && <PaymentForm invoice={selectedInvoice} onFinished={() => setIsPaymentFormOpen(false)} />}</DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <p className="text-center py-10">Memuat...</p> : invoices.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title="Belum ada invoice"
                            description="Mulai buat invoice baru untuk menagih pelanggan."
                            actionText="Buat Invoice"
                            onActionClick={handleAddNew}
                        />
                    ) : filteredInvoices.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-lg font-semibold">Data tidak ditemukan</p>
                            <p className="text-muted-foreground">Tidak ada invoice yang cocok dengan kata kunci "{debouncedSearchTerm}".</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredInvoices.map(inv => (
                                <Card key={inv.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-grow">
                                            <div className={`hidden sm:block w-2 h-16 rounded-full ${statusConfig[inv.status]?.color || 'bg-gray-200'}`}></div>
                                            <div>
                                                <p className="font-bold text-blue-700">{inv.invoice_no}</p>
                                                <p className="text-sm text-gray-800">{inv.customer?.name}</p>
                                                <p className="text-xs text-gray-500">Jatuh Tempo: {formatDate(inv.due_date)}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                                            <div className="text-right">
                                                <p className="font-semibold">{formatCurrency(inv.total_amount)}</p>
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig[inv.status]?.color || 'bg-gray-200 text-gray-800'}`}>{statusConfig[inv.status]?.label || inv.status}</span>
                                            </div>
                                            {userRole === 'admin' && inv.status !== 'paid' && <Button variant="outline" size="sm" onClick={() => handleAction(inv, 'payment')}><DollarSign className="h-4 w-4 mr-1" /> Bayar</Button>}
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreviewPDF(inv.id)}><Download className="h-4 w-4 text-green-600" /></Button>
             
                               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction(inv, 'edit')}><Edit className="h-4 w-4" /></Button>
                                            {userRole === 'admin' && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(inv.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            <PDFPreviewDialog 
                isOpen={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                pdfDataUri={pdfDataUri}
                fileName={pdfFileName}
                onDownload={() => setIsPreviewOpen(false)}
            />
        </motion.div>
    );
};

export default InvoicesPage;