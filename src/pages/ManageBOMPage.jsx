
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Edit, RefreshCw, Trash2, Save, X, Search, FileText, AlertTriangle, ArrowLeft, Eye, Download } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import EmptyState from '@/components/EmptyState';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { CreatableItemSelector } from '@/components/CreatableItemSelector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { generateBOMPDF } from '@/lib/pdfUtils';
import DocumentPreviewDialog from '@/components/DocumentPreviewDialog';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

const BOM_FORM_MODE = {
  LIST: 'list',
  EDIT: 'edit',
  CREATE: 'create',
};

const ManageBOMPage = () => {
    const { user } = useAuth();
    const { boms, items, products, companyProfile, refreshData, loading: dataLoading } = useData();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [mode, setMode] = useState(BOM_FORM_MODE.LIST);
    const [selectedBom, setSelectedBom] = useState(null);
    const [bomItems, setBomItems] = useState([]);
    
    const [overheadDetails, setOverheadDetails] = useState({ salary_person_count: 0, salary_days: 0, salary_per_day: 150000, other_costs: [] });
    const [bomDetails, setBomDetails] = useState({ name: '', product_id: null });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bomToDelete, setBomToDelete] = useState(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
    const [previewBom, setPreviewBom] = useState(null);
    const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
    const [pdfDataUri, setPdfDataUri] = useState('');
    const [pdfFileName, setPdfFileName] = useState('');

    const manufacturingProducts = useMemo(() => {
        return (products || []).filter(p => p.category_name === 'Barang Jadi' || p.category_name === 'Setengah Jadi');
    }, [products]);
    
    const salaryCost = useMemo(() => {
        const salaryPerDay = parseFloat(String(overheadDetails.salary_per_day).replace(/,/g, '.')) || 0;
        const personCount = parseFloat(String(overheadDetails.salary_person_count).replace(/,/g, '.')) || 0;
        const days = parseFloat(String(overheadDetails.salary_days).replace(/,/g, '.')) || 0;
        return personCount * days * salaryPerDay;
    }, [overheadDetails.salary_person_count, overheadDetails.salary_days, overheadDetails.salary_per_day]);

    const otherCostsTotal = useMemo(() => {
        return (overheadDetails.other_costs || []).reduce((sum, cost) => sum + (parseFloat(String(cost.amount).replace(/,/g, '.')) || 0), 0);
    }, [overheadDetails.other_costs]);

    const totalOverheadCost = useMemo(() => salaryCost + otherCostsTotal, [salaryCost, otherCostsTotal]);

    useEffect(() => {
        const editId = searchParams.get('edit');
        const createNew = searchParams.get('create');
        const productIdForNew = searchParams.get('productId');

        if (dataLoading || !items.length) return; 

        if (editId) {
            const bomToEdit = boms.find(b => b.id === editId);
            if (bomToEdit) {
                setSelectedBom(bomToEdit);
                setBomDetails({
                    name: bomToEdit.name,
                    product_id: bomToEdit.product_id,
                });
                
                const hydratedBomItems = (bomToEdit.bom_items || []).map(bomItem => {
                    const fullItem = items.find(i => i.id === bomItem.raw_material_item_id);
                    return {
                        ...bomItem,
                        item: fullItem || bomItem.item,
                    };
                }).filter(item => item.item);
                setBomItems(hydratedBomItems);

                setOverheadDetails(bomToEdit.overhead_details || { salary_person_count: 0, salary_days: 0, salary_per_day: 150000, other_costs: [] });
                setMode(BOM_FORM_MODE.EDIT);
            } else {
                toast({ variant: 'destructive', title: 'BOM tidak ditemukan' });
                navigate('/engineering/boms');
            }
        } else if (createNew) {
            if (mode !== BOM_FORM_MODE.CREATE) {
                resetForm();
                if (productIdForNew) {
                    const productName = products.find(p => p.id === productIdForNew)?.name;
                    setBomDetails(prev => ({
                        ...prev, 
                        product_id: productIdForNew,
                        name: productName ? `BOM untuk ${productName}` : ''
                    }));
                }
            }
            setMode(BOM_FORM_MODE.CREATE);
        } else {
            setMode(BOM_FORM_MODE.LIST);
            resetForm();
        }
    }, [searchParams, boms, products, items, dataLoading, navigate, toast, mode]);

    const resetForm = () => {
        setSelectedBom(null);
        setBomItems([]);
        setBomDetails({ name: '', product_id: null });
        setOverheadDetails({ salary_person_count: 0, salary_days: 0, salary_per_day: 150000, other_costs: [] });
    };

    const handleBackToList = () => {
        resetForm();
        setSearchParams({});
    };
    
    const handleCreateNew = () => setSearchParams({create: 'new'});
    const handleEditClick = (bom) => setSearchParams({ edit: bom.id });

    const handleBomDetailChange = (field, value) => setBomDetails(prev => ({ ...prev, [field]: value }));

    const handleMaterialSelect = useCallback((selectedItem) => {
        if (!selectedItem || !selectedItem.id) return;
        if (bomItems.some(i => i.raw_material_item_id === selectedItem.id)) {
            toast({ variant: 'destructive', title: 'Item sudah ada di BOM' });
            return;
        }
        const newItem = {
            raw_material_item_id: selectedItem.id,
            item: selectedItem, 
            quantity_required: 1,
        };
        setBomItems(prev => [...prev, newItem]);
    }, [bomItems, toast]);
    
    const handleNewItemCreated = useCallback((newItem) => {
        if (!newItem) return;
        handleMaterialSelect(newItem);
    }, [handleMaterialSelect]);

    const handleItemQtyChange = (index, qty) => {
        const newItems = [...bomItems];
        const sanitizedQty = String(qty).replace(/,/g, '.');
        newItems[index].quantity_required = parseFloat(sanitizedQty) || 0;
        setBomItems(newItems);
    };

    const removeItem = (index) => setBomItems(bomItems.filter((_, i) => i !== index));

    const totalHPP = useMemo(() => {
        const itemsCost = bomItems.reduce((acc, item) => acc + (item.quantity_required * (item.item?.standard_cost || 0)), 0);
        return itemsCost + totalOverheadCost;
    }, [bomItems, totalOverheadCost]);
    
    const handleOverheadChange = (field, value) => {
        setOverheadDetails(p => ({...p, [field]: value}));
    };
    
    const handleOtherCostChange = (index, field, value) => {
        const newCosts = [...(overheadDetails.other_costs || [])];
        newCosts[index][field] = value;
        setOverheadDetails(p => ({...p, other_costs: newCosts}));
    }
    const addOtherCost = () => setOverheadDetails(p => ({...p, other_costs: [...(p.other_costs || []), {description: '', amount: 0}]}));
    const removeOtherCost = (index) => setOverheadDetails(p => ({...p, other_costs: (p.other_costs || []).filter((_, i) => i !== index)}));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!bomDetails.name) {
            toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Nama BOM wajib diisi.' });
            return;
        }
        setIsSubmitting(true);
        
        try {
            const bomIdToUpsert = mode === BOM_FORM_MODE.EDIT ? selectedBom.id : undefined;

            const { data: upsertedBom, error: bomError } = await supabase.from('bill_of_materials').upsert({
                id: bomIdToUpsert,
                name: bomDetails.name,
                product_id: bomDetails.product_id,
                overhead_details: {
                    ...overheadDetails,
                    salary_per_day: parseFloat(String(overheadDetails.salary_per_day).replace(/,/g,'.')) || 0,
                    salary_person_count: parseFloat(String(overheadDetails.salary_person_count).replace(/,/g,'.')) || 0,
                    salary_days: parseFloat(String(overheadDetails.salary_days).replace(/,/g,'.')) || 0,
                    other_costs: (overheadDetails.other_costs || []).map(c => ({...c, amount: parseFloat(String(c.amount).replace(/,/g,'.')) || 0 }))
                },
                is_active: true,
                user_id: user.id,
            }).select().single();

            if (bomError) throw bomError;

            await supabase.from('bom_items').delete().eq('bom_id', upsertedBom.id);

            if (bomItems.length > 0) {
                const newBomItemsData = bomItems.map(item => ({
                    bom_id: upsertedBom.id,
                    raw_material_item_id: item.raw_material_item_id,
                    quantity_required: item.quantity_required,
                    user_id: user.id,
                }));
                const { error: bomItemsError } = await supabase.from('bom_items').insert(newBomItemsData);
                if (bomItemsError) throw bomItemsError;
            }
            
            if (upsertedBom.product_id) {
                await supabase.from('products').update({ standard_cost: totalHPP }).eq('id', upsertedBom.product_id);
            }

            toast({ title: 'Sukses!', description: 'Bill of Materials berhasil disimpan dan HPP produk diupdate.' });
            await refreshData();
            handleBackToList();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal menyimpan BOM', description: `Terjadi kesalahan: ${error.message}.` });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const confirmDeleteBom = (bom) => {
        setBomToDelete(bom);
        setIsConfirmDeleteOpen(true);
    };
    
    const handleDeleteBom = async () => {
        if (!bomToDelete) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('bill_of_materials').delete().eq('id', bomToDelete.id);
            if (error) throw error;
            toast({ title: 'Sukses', description: `BOM "${bomToDelete.name}" berhasil dihapus.` });
            await refreshData();
            handleBackToList();
        } catch(error) {
            toast({ variant: 'destructive', title: 'Gagal menghapus BOM', description: error.message });
        } finally {
            setIsSubmitting(false);
            setIsConfirmDeleteOpen(false);
            setBomToDelete(null);
        }
    };

    const handleDownloadBOM = async (bom) => {
        try {
            toast({ title: "Membuat PDF...", description: "Mohon tunggu sebentar." });
            setPdfDataUri('');
            setPdfFileName('');
            setIsPdfPreviewOpen(true);
            const { dataUri, fileName } = await generateBOMPDF(bom, companyProfile, user);
            if (dataUri) {
                setPdfDataUri(dataUri);
                setPdfFileName(fileName);
            } else {
                throw new Error("Gagal menghasilkan data URI PDF.");
            }
        } catch (error) {
            setIsPdfPreviewOpen(false);
            toast({ variant: "destructive", title: "Gagal Membuat PDF", description: "Terjadi kesalahan saat membuat file PDF." });
            console.error("PDF Generation Error: ", error);
        }
    };
    
    const filteredBoms = useMemo(() => {
        return (boms || []).map(bom => {
            const product = products.find(p => p.id === bom.product_id);
            const itemsCost = bom.bom_items?.reduce((acc, item) => acc + (item.quantity_required * (item.item?.standard_cost || 0)), 0) || 0;
            const overhead = bom.overhead_details;
            let overheadCost = 0;
            if(overhead) {
                const salary = (parseFloat(String(overhead.salary_person_count).replace(/,/g,'.')) || 0) * (parseFloat(String(overhead.salary_days).replace(/,/g,'.')) || 0) * (parseFloat(String(overhead.salary_per_day).replace(/,/g,'.')) || 0);
                const others = (overhead.other_costs || []).reduce((sum, cost) => sum + (parseFloat(String(cost.amount).replace(/,/g, '.')) || 0), 0);
                overheadCost = salary + others;
            }
            return {
                ...bom,
                product_name: product?.name || 'Produk Dihapus',
                total_cost: itemsCost + overheadCost
            };
        }).filter(bom => bom.name?.toLowerCase().includes(searchTerm.toLowerCase()) || bom.product_name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [boms, products, searchTerm]);

    const selectedProduct = products.find(p => p.id === bomDetails.product_id);

    if (mode === BOM_FORM_MODE.LIST) {
        return (
             <>
                <Helmet><title>Manajemen BOM</title></Helmet>
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold">Manajemen Bill of Materials (BOM)</h1>
                            <p className="text-gray-500">Buat, edit, dan kelola formula produk Anda.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="icon" onClick={refreshData} disabled={dataLoading}><RefreshCw className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`} /></Button>
                            <Button onClick={handleCreateNew}><Plus className="h-4 w-4 mr-2" />Buat BOM Baru</Button>
                        </div>
                    </div>
                     <Card>
                        <CardHeader>
                            <CardTitle>Daftar BOM</CardTitle>
                            <div className="relative mt-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Cari nama BOM atau produk..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                            </div>
                        </CardHeader>
                        <CardContent>
                             {dataLoading ? <p>Memuat...</p> : filteredBoms.length === 0 ? <EmptyState icon={FileText} title="Belum Ada BOM" description="Buat BOM baru untuk memulai." onActionClick={handleCreateNew} actionText="Buat BOM Baru" /> : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b"><th className="p-2 text-left">Nama BOM</th><th className="p-2 text-left">Produk Terkait</th><th className="p-2 text-right">Jumlah Komponen</th><th className="p-2 text-right">Total HPP</th><th className="p-2 text-right">Aksi</th></tr></thead>
                                        <tbody>
                                        {filteredBoms.map(bom => (
                                            <motion.tr key={bom.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b hover:bg-gray-50">
                                                <td className="p-2 font-semibold">{bom.name}</td>
                                                <td className="p-2">{bom.product_name || <span className="text-muted-foreground italic">Tidak ditautkan</span>}</td>
                                                <td className="p-2 text-right">{bom.bom_items?.length || 0}</td>
                                                <td className="p-2 text-right font-medium text-red-600">{formatCurrency(bom.total_cost)}</td>
                                                <td className="p-2 text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => setPreviewBom(bom)}><Eye className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDownloadBOM(bom)}><Download className="h-4 w-4 text-blue-600" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(bom)}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => confirmDeleteBom(bom)}><Trash2 className="h-4 w-4" /></Button>
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
                    onConfirm={handleDeleteBom}
                    isSubmitting={isSubmitting}
                    title="Yakin Hapus BOM?"
                    description={`BOM "${bomToDelete?.name}" akan dihapus permanen. Aksi ini tidak bisa dibatalkan.`}
                    confirmText="Ya, Hapus"
                />
                <Dialog open={!!previewBom} onOpenChange={() => setPreviewBom(null)}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Preview BOM: {previewBom?.name}</DialogTitle>
                            <DialogDescription>Produk Terkait: {previewBom?.product_name}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                            <h3 className="font-semibold text-lg">Komponen Material</h3>
                            <div className="border rounded-md">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-gray-50"><th className="p-2 text-left">Nama</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">HPP</th><th className="p-2 text-right">Subtotal</th></tr>
                                    </thead>
                                    <tbody>
                                        {previewBom?.bom_items?.map(item => (
                                            <tr key={item.id} className="border-b">
                                                <td className="p-2">{item.item?.name}</td>
                                                <td className="p-2 text-right">{item.quantity_required} {item.item?.unit}</td>
                                                <td className="p-2 text-right">{formatCurrency(item.item?.standard_cost)}</td>
                                                <td className="p-2 text-right">{formatCurrency(item.quantity_required * item.item?.standard_cost)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <h3 className="font-semibold text-lg mt-4">Biaya Overhead</h3>
                             <div className="border rounded-md p-4 space-y-2">
                                {previewBom?.overhead_details && (
                                    <>
                                        {previewBom.overhead_details.salary_person_count > 0 && <div className="flex justify-between"><p>Biaya Gaji:</p><p>{formatCurrency((previewBom.overhead_details.salary_person_count || 0) * (previewBom.overhead_details.salary_days || 0) * (previewBom.overhead_details.salary_per_day || 0))}</p></div>}
                                        {previewBom.overhead_details.other_costs?.map((cost, i) => (
                                            <div key={i} className="flex justify-between"><p>{cost.description || 'Biaya Lain'}:</p><p>{formatCurrency(cost.amount)}</p></div>
                                        ))}
                                    </>
                                )}
                            </div>
                            
                            <div className="text-right font-bold text-xl pt-4">Total HPP: {formatCurrency(previewBom?.total_cost)}</div>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => setPreviewBom(null)}>Tutup</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <DocumentPreviewDialog 
                    isOpen={isPdfPreviewOpen} 
                    onOpenChange={setIsPdfPreviewOpen}
                    pdfDataUri={pdfDataUri}
                    title="Pratinjau Bill of Materials"
                    fileName={pdfFileName}
                />
            </>
        )
    }

    return (
        <>
            <Helmet><title>{mode === BOM_FORM_MODE.CREATE ? 'Buat' : 'Edit'} BOM</title></Helmet>
             <div className="max-w-4xl mx-auto space-y-6">
                <Button variant="outline" onClick={handleBackToList}><ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Daftar</Button>
                
                <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader>
                            <CardTitle>{mode === BOM_FORM_MODE.CREATE ? 'Buat Bill of Materials Baru' : `Edit: ${selectedBom?.name}`}</CardTitle>
                            <CardDescription>Tentukan formula dan biaya untuk sebuah produk.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bom-name">Nama BOM</Label>
                                    <Input id="bom-name" value={bomDetails.name} onChange={(e) => handleBomDetailChange('name', e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="product-id">Produk Terkait (Opsional)</Label>
                                    <Popover open={isProductSelectorOpen} onOpenChange={setIsProductSelectorOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" className="w-full justify-between" disabled={dataLoading}>
                                                {selectedProduct ? selectedProduct.name : "Pilih Produk..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Cari Produk..." />
                                                <CommandList>
                                                    <CommandEmpty>Belum ada produk manufaktur.</CommandEmpty>
                                                    <CommandGroup>
                                                        {manufacturingProducts.map((product) => (
                                                            <CommandItem key={product.id} value={product.name} onSelect={() => {handleBomDetailChange('product_id', product.id); setIsProductSelectorOpen(false);}}>
                                                                {product.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="mt-6 border-t pt-6">
                        <Label className="font-semibold text-base">Tambah Komponen</Label>
                        <p className="text-sm text-muted-foreground mb-2">Pilih barang yang sudah ada atau buat barang baru untuk ditambahkan ke BOM.</p>
                        <CreatableItemSelector 
                            onValueChange={handleMaterialSelect} 
                            onNewItemCreated={handleNewItemCreated}
                            filterStock={false}
                        />
                    </div>
                    
                    <Card className="mt-6">
                        <CardHeader><CardTitle>Komponen / Bahan Baku</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                {bomItems.map((item, index) => (
                                    <div key={item.raw_material_item_id || index} className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                                        <p className="flex-1 font-medium">{item.item?.name || 'Barang tidak ditemukan'}</p>
                                        <Input type="text" inputMode="decimal" value={item.quantity_required} onChange={e => handleItemQtyChange(index, e.target.value)} className="w-24" />
                                        <span className="w-16 text-sm text-muted-foreground">{item.item?.unit || 'unit'}</span>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}><X className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mt-6">
                         <CardHeader><CardTitle>Kalkulasi Biaya Overhead</CardTitle></CardHeader>
                         <CardContent className="space-y-6">
                            <div>
                                <h4 className="font-semibold mb-2">Biaya Gaji Tenaga Kerja</h4>
                                <div className="grid grid-cols-3 gap-4 p-4 border rounded-md bg-muted/30">
                                    <div className="space-y-1">
                                        <Label htmlFor="salary_per_day">Gaji / Hari (Rp)</Label>
                                        <Input id="salary_per_day" type="text" inputMode="decimal" value={overheadDetails.salary_per_day || ''} onChange={e => handleOverheadChange('salary_per_day', e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="salary_person_count">Jumlah Orang</Label>
                                        <Input id="salary_person_count" type="text" inputMode="decimal" value={overheadDetails.salary_person_count || ''} onChange={e => handleOverheadChange('salary_person_count', e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="salary_days">Jumlah Hari</Label>
                                        <Input id="salary_days" type="text" inputMode="decimal" value={overheadDetails.salary_days || ''} onChange={e => handleOverheadChange('salary_days', e.target.value)} />
                                    </div>
                                    <div className="col-span-3 text-right">
                                        <p className="font-semibold">Total Biaya Gaji: {formatCurrency(salaryCost)}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">Biaya Lain-lain</h4>
                                <div className="space-y-2 p-4 border rounded-md bg-muted/30">
                                {(overheadDetails.other_costs || []).map((cost, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Input placeholder="Deskripsi biaya" value={cost.description} onChange={e => handleOtherCostChange(index, 'description', e.target.value)} />
                                        <Input type="text" inputMode="decimal" placeholder="Nominal" value={cost.amount} onChange={e => handleOtherCostChange(index, 'amount', e.target.value)} className="w-40"/>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeOtherCost(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={addOtherCost}><Plus className="h-4 w-4 mr-2" />Tambah Biaya</Button>
                                </div>
                            </div>
                         </CardContent>
                    </Card>

                    <Card className="mt-6">
                         <CardHeader><CardTitle>Total Estimasi Biaya (HPP)</CardTitle></CardHeader>
                         <CardContent>
                             <div className="space-y-2 text-right">
                                <p><span className="text-muted-foreground">Total Biaya Bahan:</span> <span className="font-medium">{formatCurrency(bomItems.reduce((acc, item) => acc + (item.quantity_required * (item.item?.standard_cost || 0)), 0))}</span></p>
                                <p><span className="text-muted-foreground">Total Biaya Overhead:</span> <span className="font-medium">{formatCurrency(totalOverheadCost)}</span></p>
                                <p className="text-2xl font-bold">{formatCurrency(totalHPP)}</p>
                            </div>
                         </CardContent>
                         <CardFooter>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                                <p>HPP produk akan otomatis diupdate di master produk setelah BOM ini disimpan.</p>
                            </div>
                         </CardFooter>
                    </Card>

                     <div className="flex justify-end gap-2 mt-6">
                        <Button type="button" variant="outline" onClick={handleBackToList}>Batal</Button>
                        <Button type="submit" disabled={isSubmitting || !bomDetails.name}>
                            <Save className="mr-2 h-4 w-4"/> {isSubmitting ? 'Menyimpan...' : 'Simpan BOM & Update HPP'}
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default ManageBOMPage;
