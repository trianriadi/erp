import React, { useState, useMemo, useEffect, useCallback } from 'react';
    import { useNavigate } from 'react-router-dom';
    import { useData } from '@/contexts/DataContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { PlusCircle, Edit, Trash2, FileText, Download, FileCheck, Search, ShoppingCart, MinusCircle, Loader2 } from 'lucide-react';
    import { motion } from 'framer-motion';
    import { format } from 'date-fns';
    import { id } from 'date-fns/locale';
    import jsPDF from 'jspdf';
    import 'jspdf-autotable';
    import EmptyState from '@/components/EmptyState';
    import { CustomerSelector } from '@/components/CustomerSelector';
    import { ProductSelector } from '@/components/ProductSelector';
    import useDebounce from '@/hooks/useDebounce';
    import { addCompanyHeader } from '@/lib/pdfUtils';

    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
    const formatDate = (date) => date ? format(new Date(date), "d MMMM yyyy", { locale: id }) : '';

    const statusConfig = {
        draft: { label: 'Draft', color: 'bg-gray-200 text-gray-800' },
        sent: { label: 'Terkirim', color: 'bg-blue-200 text-blue-800' },
        accepted: { label: 'Diterima', color: 'bg-green-200 text-green-800' },
        rejected: { label: 'Ditolak', color: 'bg-red-200 text-red-800' },
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

    const QuotationForm = ({ quotation, onFinished }) => {
        const { companyProfile, layoutTemplates, termsTemplates, refreshData } = useData();
        const { user } = useAuth();
        const [isGeneratingNo, setIsGeneratingNo] = useState(false);
        const [formData, setFormData] = useState({
            id: quotation?.id || null,
            quotation_no: quotation?.quotation_no || '',
            customer_id: quotation?.customer_id || '',
            date: quotation?.date || new Date().toISOString().split('T')[0],
            valid_until: quotation?.valid_until || new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
            status: quotation?.status || 'draft',
            notes: quotation?.notes || '',
            sales_name: quotation?.sales_name || user?.user_metadata?.full_name || '',
            discount: quotation?.discount || 0,
            delivery_cost: quotation?.delivery_cost || 0,
            template_id: quotation?.template_id || null,
            product_status: quotation?.product_status || 'Ready Stock',
        });
        const [items, setItems] = useState([]);
        const [loading, setLoading] = useState(false);
        const { toast } = useToast();

        useEffect(() => {
            const generateAndSetNewNo = async () => {
                if (!formData.id && !formData.quotation_no) { // Only for new quotations
                    setIsGeneratingNo(true);
                    const { data: newQuotationNo, error: noError } = await supabase.rpc('generate_document_no', { prefix: 'QTN' });
                    if (noError) {
                        toast({ variant: 'destructive', title: 'Gagal membuat nomor otomatis', description: noError.message });
                    } else {
                        setFormData(prev => ({ ...prev, quotation_no: newQuotationNo }));
                    }
                    setIsGeneratingNo(false);
                }
            };
            generateAndSetNewNo();
        }, [formData.id, formData.quotation_no, toast]);


        useEffect(() => {
            if (!formData.template_id && layoutTemplates.length > 0) {
                const defaultTemplate = layoutTemplates.find(t => t.is_default) || layoutTemplates[0];
                if (defaultTemplate) {
                    setFormData(prev => ({ ...prev, template_id: defaultTemplate.id }));
                }
            }
        }, [layoutTemplates, formData.template_id]);

        useEffect(() => {
            const fetchItems = async () => {
                if (quotation?.id) {
                    const { data, error } = await supabase.from('quotation_items').select('*, product:products(*)').eq('quotation_id', quotation.id).order('created_at');
                    if (error) {
                        toast({ variant: 'destructive', title: 'Gagal memuat item quotation', description: error.message });
                        setItems([{ product_id: null, description: '', specification: '', qty: 1, unit_price: 0, hpp: 0 }]);
                    } else {
                        setItems(data.length > 0 ? data.map(i => ({...i, product_id: i.product?.id || i.product_id })) : [{ product_id: null, description: '', specification: '', qty: 1, unit_price: 0, hpp: 0 }]);
                    }
                } else {
                     setItems([{ product_id: null, description: '', specification: '', qty: 1, unit_price: 0, hpp: 0 }]);
                }
            };
            fetchItems();
        }, [quotation, toast]);

        const handleItemChange = (index, field, value) => {
            const newItems = [...items];
            const item = newItems[index];
            
            if (['qty', 'unit_price', 'hpp'].includes(field)) {
                const parsedValue = parseFloat(value);
                item[field] = isNaN(parsedValue) ? '' : parsedValue;
            } else {
                item[field] = value;
            }

            setItems(newItems);
        };
        
        const handleProductSelect = (product) => {
            addItem(product);
        };

        const handleTermsTemplateChange = (templateId) => {
            const selectedTemplate = termsTemplates.find(t => t.id === templateId);
            if (selectedTemplate) {
                setFormData(prev => ({ ...prev, notes: selectedTemplate.terms_and_conditions }));
            }
        };

        const addItem = (product = null) => {
            const newItem = {
                product_id: product?.id || null,
                description: product?.name || '',
                specification: product?.specification || '',
                qty: 1,
                unit_price: product?.standard_price || 0,
                hpp: product?.standard_cost || 0
            };
            setItems([...items, newItem]);
        };
        const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

        const subtotal = useMemo(() => items.reduce((sum, item) => sum + ((item.qty || 0) * (item.unit_price || 0)), 0), [items]);
        const grandTotal = useMemo(() => subtotal - (formData.discount || 0) + (formData.delivery_cost || 0), [subtotal, formData.discount, formData.delivery_cost]);

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!formData.customer_id) {
                toast({ variant: 'destructive', title: 'Pelanggan harus dipilih' });
                return;
            }
            if (!formData.quotation_no) {
                toast({ variant: 'destructive', title: 'Nomor quotation harus diisi' });
                return;
            }
            setLoading(true);

            const quotationData = {
                ...formData,
                total_amount: grandTotal,
                created_by: quotation?.created_by || user.id,
                company_name: companyProfile?.company_name,
                company_address: companyProfile?.address,
                company_phone: companyProfile?.phone,
                company_email: companyProfile?.email,
            };

            const itemDataToSave = items.filter(item => item.description).map(item => ({
                product_id: item.product_id,
                description: item.description,
                specification: item.specification,
                qty: item.qty || 0,
                unit_price: item.unit_price || 0,
                hpp: item.hpp || 0,
                subtotal: (item.qty || 0) * (item.unit_price || 0),
            }));

            if (!quotationData.id) {
                delete quotationData.id;
            }

            const { data: upsertedQuotation, error } = await supabase.from('quotations').upsert(quotationData).select().single();
            
            if (error) {
                toast({ variant: 'destructive', title: 'Gagal menyimpan quotation', description: error.message });
                setLoading(false); return;
            }
            
            await supabase.from('quotation_items').delete().eq('quotation_id', upsertedQuotation.id);
            const itemData = itemDataToSave.map(({ id, created_at, ...item }) => ({ ...item, quotation_id: upsertedQuotation.id }));
            const { error: itemError } = await supabase.from('quotation_items').insert(itemData);

            if (itemError) {
                toast({ variant: 'destructive', title: 'Gagal menyimpan item quotation', description: itemError.message });
            } else {
                toast({ title: `Quotation berhasil ${quotation?.id ? 'diperbarui' : 'dibuat'}` });
                await refreshData();
                onFinished();
            }
            
            setLoading(false);
        };

        if (!items.length && quotation?.id) {
            return <p>Memuat item...</p>;
        }

        const filteredTermsTemplates = termsTemplates.filter(t => t.document_type === 'quotation' || t.document_type === 'all');

        return (
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="customer">Pelanggan</Label>
                        <CustomerSelector
                            selectedCustomerId={formData.customer_id}
                            onCustomerSelect={(customerId) => setFormData(prev => ({ ...prev, customer_id: customerId }))}
                        />
                    </div>
                     <div>
                        <Label>Template Layout</Label>
                        <Select value={formData.template_id || ''} onValueChange={(v) => setFormData({...formData, template_id: v})}>
                            <SelectTrigger><SelectValue placeholder="Pilih Template" /></SelectTrigger>
                            <SelectContent>{layoutTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="quotation_no">Nomor Quotation</Label>
                        <Input id="quotation_no" value={formData.quotation_no} onChange={(e) => setFormData({ ...formData, quotation_no: e.target.value })} required disabled={isGeneratingNo} />
                    </div>
                    <div>
                        <Label htmlFor="date">Tanggal Quotation</Label>
                        <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                    </div>
                     <div>
                        <Label htmlFor="valid_until">Berlaku Hingga</Label>
                        <Input id="valid_until" type="date" value={formData.valid_until} onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })} required />
                    </div>
                     <div>
                        <Label htmlFor="product_status">Status Produk</Label>
                        <Input id="product_status" placeholder="Cth: Preorder 14-21 hari" value={formData.product_status} onChange={(e) => setFormData({ ...formData, product_status: e.target.value })} />
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Item Penawaran</CardTitle>
                        <CardDescription>Pilih produk dari daftar atau isi manual.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {items.map((item, index) => (
                            <div key={item.id || index} className="p-4 border rounded-lg space-y-3 relative">
                                <Button type="button" variant="destructive" size="icon" className="absolute -top-3 -right-3 h-7 w-7" onClick={() => removeItem(index)}><MinusCircle className="h-4 w-4" /></Button>
                                <Input placeholder="Nama Barang" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} required />
                                <Textarea placeholder="Spesifikasi Barang" value={item.specification || ''} onChange={(e) => handleItemChange(index, 'specification', e.target.value)} />
                                <div className="grid grid-cols-2 gap-2">
                                    <Input type="number" placeholder="Qty" value={item.qty} onChange={(e) => handleItemChange(index, 'qty', e.target.value)} required />
                                    <Input type="number" placeholder="Harga" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} required />
                                </div>
                                <Input type="hidden" value={item.hpp} />
                            </div>
                        ))}
                        <ProductSelector onSelectProduct={handleProductSelect} isRawMaterialMode={false} mode="quotation" />
                    </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                         <Label>Catatan / Syarat & Ketentuan</Label>
                         <Select onValueChange={handleTermsTemplateChange}>
                            <SelectTrigger className="mb-2">
                                <SelectValue placeholder="Gunakan Template Syarat & Ketentuan" />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredTermsTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Textarea placeholder="Syarat dan ketentuan tambahan..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                         <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label htmlFor="discount">Diskon</Label>
                                <Input id="discount" type="number" placeholder="Diskon" value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })} />
                            </div>
                             <div>
                                <Label htmlFor="delivery_cost">Biaya Kirim</Label>
                                <Input id="delivery_cost" type="number" placeholder="Biaya Kirim" value={formData.delivery_cost} onChange={(e) => setFormData({ ...formData, delivery_cost: parseFloat(e.target.value) || 0 })} />
                            </div>
                         </div>
                         <p className="text-right font-semibold">Subtotal: {formatCurrency(subtotal)}</p>
                         <p className="text-right">Diskon: -{formatCurrency(formData.discount)}</p>
                         <p className="text-right">Biaya Kirim: {formatCurrency(formData.delivery_cost)}</p>
                         <p className="text-right font-bold text-lg">Grand Total: {formatCurrency(grandTotal)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <Label>Status Quotation</Label>
                        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                            <SelectTrigger><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(statusConfig).map(([key, { label }]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                     </div>
                     <div>
                        <Label>Disiapkan oleh (Sales)</Label>
                        <Input placeholder="Nama Sales" value={formData.sales_name} onChange={(e) => setFormData({ ...formData, sales_name: e.target.value })} />
                     </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onFinished}>Batal</Button>
                    <Button type="submit" disabled={loading || isGeneratingNo}>{loading ? 'Menyimpan...' : 'Simpan Quotation'}</Button>
                </DialogFooter>
            </form>
        );
    };


    const QuotationsPage = () => {
        const { quotations, companyProfile, layoutTemplates, loading, refreshData } = useData();
        const { user } = useAuth();
        const userRole = user?.user_metadata?.role;
        const [isFormOpen, setIsFormOpen] = useState(false);
        const [selectedQuotation, setSelectedQuotation] = useState(null);
        const [isConvertingInvoice, setIsConvertingInvoice] = useState(null);
        const [isPreviewOpen, setIsPreviewOpen] = useState(false);
        const [pdfDataUri, setPdfDataUri] = useState('');
        const [pdfFileName, setPdfFileName] = useState('');
        const [searchTerm, setSearchTerm] = useState('');
        const debouncedSearchTerm = useDebounce(searchTerm, 300);
        const { toast } = useToast();
        const navigate = useNavigate();

        const filteredQuotations = useMemo(() => {
            if (!debouncedSearchTerm) return quotations;
            const lowercasedTerm = debouncedSearchTerm.toLowerCase();
            return quotations.filter(q =>
                q.quotation_no?.toLowerCase().includes(lowercasedTerm) ||
                q.customer?.name?.toLowerCase().includes(lowercasedTerm) ||
                formatDate(q.date).toLowerCase().includes(lowercasedTerm)
            );
        }, [quotations, debouncedSearchTerm]);

        const handleAction = async (quotation, action) => {
            const { data: fullQuotation, error: qError } = await supabase.from('quotations').select('*, customer:customers(*)').eq('id', quotation.id).single();
             if (qError) {
                toast({variant: 'destructive', title: 'Gagal memuat detail quotation'});
                return;
            }
            
            setSelectedQuotation(fullQuotation);
            if (action === 'edit') setIsFormOpen(true);
        };

        const handleAddNew = () => {
            if (!companyProfile?.company_name) {
                toast({ variant: 'destructive', title: 'Profil perusahaan belum lengkap', description: 'Harap lengkapi profil perusahaan sebelum membuat quotation.' });
                return;
            }
            setSelectedQuotation(null);
            setIsFormOpen(true);
        };

        const handleDelete = async (id) => {
            if (!['admin', 'sales'].includes(userRole)) {
                toast({ variant: 'destructive', title: 'Akses Ditolak' });
                return;
            }
            if (!window.confirm('Yakin ingin menghapus quotation ini?')) return;
            
            await supabase.from('quotation_items').delete().eq('quotation_id', id);

            const { error } = await supabase.from('quotations').delete().eq('id', id);
            if (error) {
                toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
            } else {
                toast({ title: 'Quotation berhasil dihapus' });
                refreshData();
            }
        };

        const handleConvertToSalesOrder = async (quotation) => {
            const { data: items, error } = await supabase.from('quotation_items').select('*, product:products(*)').eq('quotation_id', quotation.id);
            if (error) {
                toast({ variant: 'destructive', title: 'Gagal memuat item quotation', description: error.message });
                return;
            }
        
            const quotationToConvert = {
                id: quotation.id,
                quotation_no: quotation.quotation_no,
                customer_id: quotation.customer_id,
                notes: quotation.notes,
                items: items.map(item => ({...item, product_id: item.product?.id || item.product_id})),
            };
        
            navigate('/sales/orders', { state: { quotationToConvert } });
        };

        const handleConvertToInvoice = async (quotationId) => {
            setIsConvertingInvoice(quotationId);
            const { data, error } = await supabase.rpc('create_invoice_from_quotation', {
                p_quotation_id: quotationId
            });

            if (error) {
                toast({ variant: 'destructive', title: 'Gagal Membuat Invoice', description: error.message });
            } else {
                toast({ title: 'Invoice Berhasil Dibuat', description: `Invoice ${data.invoice_no} telah dibuat.` });
                await refreshData();
                navigate('/sales/invoices');
            }
            setIsConvertingInvoice(null);
        };

        const generatePDF = async (quotationId) => {
             if (!companyProfile) {
                toast({ variant: 'destructive', title: 'Profil perusahaan belum lengkap', description: 'Harap lengkapi profil perusahaan sebelum mengekspor PDF.' });
                return { dataUri: null, fileName: '' };
            }

            const { data: quotation, error: qError } = await supabase.from('quotations').select('*, customer:customers(*), template:quotation_templates(*)').eq('id', quotationId).single();
            const { data: items, error: iError } = await supabase.from('quotation_items').select('*').eq('quotation_id', quotationId).order('created_at');
        
            if(qError || iError) {
                toast({variant: 'destructive', title: 'Gagal memuat data untuk PDF', description: qError?.message || iError?.message });
                return { dataUri: null, fileName: '' };
            }

            const template = quotation.template || layoutTemplates.find(t => t.is_default) || {};
            const customerName = quotation.customer?.name.replace(/[^a-z0-9]/gi, '_') || 'Customer';
            const fileName = `${customerName}-${quotation.quotation_no}.pdf`;

            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            
            let contentStartY = await addCompanyHeader(doc, companyProfile);

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('QUOTATION', 200, contentStartY, { align: 'right' });
            
            let infoStartY = contentStartY + 10;
            
            const headerInfo = [
                { title: "Quotation No.", value: quotation.quotation_no },
                { title: "Date", value: formatDate(quotation.date) },
                { title: "Valid Until", value: formatDate(quotation.valid_until) }
            ];

            let headerInfoY = infoStartY;
            doc.setFontSize(9);
            headerInfo.forEach(info => {
                 doc.setFont('helvetica', 'bold');
                 doc.text(info.title, 148, headerInfoY, {align: 'left'});
                 doc.setFont('helvetica', 'normal');
                 doc.text(`: ${info.value}`, 168, headerInfoY, {align: 'left'});
                 headerInfoY += 5;
            });

            doc.setFont('helvetica', 'bold');
            doc.text('Kepada Yth,', 15, infoStartY);
            doc.setFont('helvetica', 'normal');
            
            let customerInfoY = infoStartY + 5;
            if (quotation.customer.name) {
                doc.text(quotation.customer.name, 15, customerInfoY);
                customerInfoY += 5;
            }
            if (quotation.customer.contact_person) {
                doc.text(`UP: ${quotation.customer.contact_person}`, 15, customerInfoY);
                customerInfoY += 5;
            }

            const customerAddressLines = doc.splitTextToSize(quotation.customer.address || '', 80);
            doc.text(customerAddressLines, 15, customerInfoY);
            customerInfoY += customerAddressLines.length * 4;
            doc.text(quotation.customer.phone || '', 15, customerInfoY);
            
            const tableStartY = Math.max(customerInfoY, headerInfoY) + 10;

            const tableBody = [];
            items.forEach((item, index) => {
                tableBody.push([
                    { content: index + 1 },
                    { content: item.description },
                    { content: item.qty },
                    { content: formatCurrency(item.unit_price) },
                    { content: formatCurrency((item.qty || 0) * (item.unit_price || 0)) },
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
            const summaryY = finalY + 8;
            doc.setFontSize(9);

            doc.setFont('helvetica', 'bold');
            doc.text('Subtotal', 148, summaryY, { align: 'right' });
            doc.text('Discount', 148, summaryY + 5, { align: 'right' });
            doc.text('Delivery', 148, summaryY + 10, { align: 'right' });
            doc.text('Grand Total', 148, summaryY + 15, { align: 'right' });

            doc.setFont('helvetica', 'normal');
            const subtotal = items.reduce((sum, item) => sum + ((item.qty || 0) * (item.unit_price || 0)), 0);
            doc.text(formatCurrency(subtotal), 200, summaryY, { align: 'right' });
            doc.text('-' + formatCurrency(quotation.discount), 200, summaryY + 5, { align: 'right' });
            doc.text(formatCurrency(quotation.delivery_cost), 200, summaryY + 10, { align: 'right' });
            doc.setFont('helvetica', 'bold');
            doc.text(formatCurrency(quotation.total_amount), 200, summaryY + 15, { align: 'right' });

            finalY = summaryY + 25;
            
            if (quotation.notes) {
                doc.setFont('helvetica', 'bold');
                doc.text('Terms and Condition:', 15, finalY);
                doc.setFont('helvetica', 'normal');
                
                const notesLines = doc.splitTextToSize(quotation.notes, 180);
                let notesY = finalY + 5;
                notesLines.forEach(line => {
                    doc.text(line, 15, notesY);
                    notesY += 5;
                });
                finalY = notesY;
            }

            if (quotation.product_status) {
                finalY = finalY > 15 ? finalY : finalY + 5; // ensure some space
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text('Status Produk:', 15, finalY);
                doc.setFont('helvetica', 'normal');
                doc.text(quotation.product_status, 40, finalY);
                finalY += 10;
            }
            
            let signatureY = finalY > 230 ? finalY + 10 : 230;

            doc.setFont('helvetica', 'normal');
            doc.text('Disiapkan Oleh,', 15, signatureY);
            doc.text('Disetujui Oleh,', 148, signatureY, {align: 'center'});
            
            doc.setLineWidth(0.3);
            doc.line(15, signatureY + 25, 65, signatureY + 25); // Line for sales
            doc.line(128, signatureY + 25, 178, signatureY + 25); // Line for customer
            
            doc.setFont('helvetica', 'normal');
            doc.text(`( ${quotation.sales_name || user?.user_metadata?.full_name || 'Nama Sales'} )`, 15, signatureY + 30);
            doc.text(`( Nama & Stempel Perusahaan )`, 148, signatureY + 30, {align: 'center'});

            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(150);
            doc.text('QUOTATION INI DIBUAT OTOMATIS OLEH SYSTEM ERP PT TRIMATRA KARYA INOVASI', doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' });

            return { dataUri: doc.output('datauristring'), fileName };
        };

        const handlePreviewPDF = async (quotationId) => {
            setPdfDataUri('');
            setPdfFileName('');
            setIsPreviewOpen(true);
            try {
                const { dataUri, fileName } = await generatePDF(quotationId);
                if (dataUri) {
                    setPdfDataUri(dataUri);
                    setPdfFileName(fileName);
                } else {
                    setIsPreviewOpen(false); // Close preview if PDF generation fails
                    toast({ variant: 'destructive', title: 'Gagal Membuat PDF', description: 'Terjadi kesalahan saat membuat pratinjau PDF.' });
                }
            } catch (error) {
                console.error('PDF Generation Error:', error);
                setIsPreviewOpen(false);
                toast({ variant: 'destructive', title: 'Error Pembuatan PDF', description: 'Tanda tangan mungkin tidak tersedia atau terjadi kesalahan lain.' });
            }
        };
        
        return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Card>
                    <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Daftar Quotation</CardTitle>
                            <p className="text-sm text-muted-foreground">Kelola semua penawaran Anda.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari quotation..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                                <DialogTrigger asChild>
                                    <Button onClick={handleAddNew} className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Buat Quotation</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                        <DialogTitle>{selectedQuotation ? 'Edit Quotation' : 'Quotation Baru'}</DialogTitle>
                                        <DialogDescription>Isi detail penawaran untuk pelanggan.</DialogDescription>
                                    </DialogHeader>
                                    <QuotationForm quotation={selectedQuotation} onFinished={() => {setIsFormOpen(false); setSelectedQuotation(null);}} />
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? <p className="text-center py-10">Memuat...</p> : quotations.length === 0 ? (
                            <EmptyState
                                icon={FileText}
                                title="Belum ada quotation"
                                description="Anda bisa mulai dengan membuat penawaran harga untuk pelanggan."
                                actionText="Buat Quotation"
                                onActionClick={handleAddNew}
                            />
                        ) : filteredQuotations.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-lg font-semibold">Data tidak ditemukan</p>
                                <p className="text-muted-foreground">Tidak ada quotation yang cocok dengan kata kunci "{debouncedSearchTerm}".</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredQuotations.map(q => {
                                    const currentStatus = statusConfig[q.status] ? q.status : 'draft';
                                    const { label, color } = statusConfig[currentStatus];
                                    const isConverting = isConvertingInvoice === q.id;

                                    return (
                                    <Card key={q.id} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 flex-grow">
                                                <div className={`hidden sm:block w-2 h-16 rounded-full ${color}`}></div>
                                                <div>
                                                    <p className="font-bold text-blue-700">{q.quotation_no}</p>
                                                    <p className="text-sm text-gray-800">{q.customer?.name}</p>
                                                    <p className="text-xs text-gray-500">{formatDate(q.date)}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                                                <div className="text-right">
                                                    <p className="font-semibold">{formatCurrency(q.total_amount)}</p>
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>{label}</span>
                                                </div>
                                                 <div className="flex gap-2">
                                                    {currentStatus === 'accepted' && (
                                                        <>
                                                            <Button variant="outline" size="sm" onClick={() => handleConvertToSalesOrder(q)}><ShoppingCart className="h-4 w-4 mr-1" /> Buat SO</Button>
                                                            <Button variant="outline" size="sm" onClick={() => handleConvertToInvoice(q.id)} disabled={isConverting}>
                                                                {isConverting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileCheck className="h-4 w-4 mr-1" />}
                                                                {isConverting ? 'Proses...' : 'Buat Invoice'}
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreviewPDF(q.id)}><Download className="h-4 w-4 text-green-600" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction(q, 'edit')}><Edit className="h-4 w-4" /></Button>
                                                    {['admin','sales'].includes(userRole) && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(q.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                                })}
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

    export default QuotationsPage;