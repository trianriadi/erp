
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Save, Printer, MoreVertical, Trash2, HardHat, PackageCheck, ThumbsUp, Factory, Search, ClipboardList, Send, ChevronsRight, Image as ImageIcon, File as FileIcon, Paperclip, X as XIcon, Folder, ShoppingCart, Package, PlusCircle } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { generateWOPDF, generateWOBOMPDF } from '@/lib/pdfUtils';
import useDebounce from '@/hooks/useDebounce';
import { DatePicker } from '@/components/ui/datepicker';
import { useLocation, useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreatableItemSelector } from '@/components/CreatableItemSelector';


const formatDate = (dateStr, withTime = false) => {
    if (!dateStr) return 'N/A';
    const formatString = withTime ? "d MMMM yyyy, HH:mm" : "d MMMM yyyy";
    return format(new Date(dateStr), formatString, { locale: id });
};

const mainStatusConfig = {
  Draft: { label: 'Draft', color: 'bg-gray-200 text-gray-800' },
  'Pending Inventory': { label: 'Menunggu Inventory', color: 'bg-yellow-200 text-yellow-800' },
  'Tunggu Antrian': { label: 'Tunggu Antrian Produksi', color: 'bg-blue-200 text-blue-800' },
  Proses: { label: 'Proses Produksi', color: 'bg-indigo-200 text-indigo-800' },
  QC: { label: 'QC', color: 'bg-cyan-200 text-cyan-800'},
  Terkirim: { label: 'Terkirim', color: 'bg-green-200 text-green-800' },
};

const departmentStatusConfig = {
    'Pending Approval': { variant: 'warning', label: 'Pending' },
    'Approved': { variant: 'success', label: 'Approved' },
    'Revise': { variant: 'destructive', label: 'Revisi' },
    'Barang Siap': { variant: 'success', label: 'Siap' },
    'Barang Siap Parsial': { variant: 'info', label: 'Parsial' },
    'Barang Dikeluarkan': { variant: 'success', label: 'Dikeluarkan' },
    'Antrian': { variant: 'warning', label: 'Antrian' },
    'Tunggu Antrian': { variant: 'default', label: 'Antrian' },
    'Proses': { variant: 'info', label: 'Proses' },
    'QC': { variant: 'info', label: 'QC' },
    'Terkirim': { variant: 'success', label: 'Terkirim' },
    'Barang Disiapkan': { variant: 'success', label: 'Disiapkan' },
};


const BOMSelector = ({ selectedBOM, onBOMSelect, boms, disabled }) => {
    return (
        <Select value={selectedBOM || ''} onValueChange={onBOMSelect} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Pilih BOM..." /></SelectTrigger>
            <SelectContent>
                {boms.length > 0 ? boms.map(bom => (
                    <SelectItem key={bom.id} value={bom.id}>{bom.name} (Produk: {bom.product?.name || 'N/A'})</SelectItem>
                )) : <p className="p-2 text-sm text-muted-foreground">Tidak ada BOM tersedia.</p>}
            </SelectContent>
        </Select>
    );
};

const DrawingSelector = ({ selectedDrawing, onDrawingSelect, drawings, disabled }) => {
    return (
        <Select value={selectedDrawing || ''} onValueChange={onDrawingSelect} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Pilih Paket Drawing..." /></SelectTrigger>
            <SelectContent>
                {drawings.length > 0 ? drawings.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                )) : <p className="p-2 text-sm text-muted-foreground">Tidak ada paket drawing.</p>}
            </SelectContent>
        </Select>
    );
};

const ApprovalDialog = ({ wo, department, isOpen, onOpenChange, onFinished }) => {
    const { toast } = useToast();
    const { boms, products, drawings } = useData();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [engApprovalStatus, setEngApprovalStatus] = useState('Approved');
    const [engNotes, setEngNotes] = useState('');
    const [itemBomUpdates, setItemBomUpdates] = useState({});
    const [selectedDrawingId, setSelectedDrawingId] = useState('');
    
    const [invApprovalStatus, setInvApprovalStatus] = useState('Barang Siap');
    const [invNotes, setInvNotes] = useState('');
    
    const [prodStatus, setProdStatus] = useState('Proses');
    const [prodNotes, setProdNotes] = useState('');
    const [estimatedShipDate, setEstimatedShipDate] = useState(null);

    const isEngineeringApproved = wo?.engineering_status === 'Approved';

    useEffect(() => {
        if(isOpen && wo) {
            const initialUpdates = {};
            (wo.items || []).forEach(item => {
                initialUpdates[item.id] = { bom_id: item.bom_id, notes: item.engineering_notes || '', product_id: item.product_id };
            });
            setItemBomUpdates(initialUpdates);
            setSelectedDrawingId(wo.drawing_id || '');
            setEstimatedShipDate(wo.estimated_ship_date ? new Date(wo.estimated_ship_date) : null);
            if (department === 'manufacture') {
                if (wo.production_status === 'Tunggu Antrian') setProdStatus('Proses');
                else if (wo.production_status === 'Proses') setProdStatus('QC');
                else if (wo.production_status === 'QC') setProdStatus('Terkirim');
                else setProdStatus(wo.production_status);
            }
        } else {
             setItemBomUpdates({});
             setEngNotes('');
             setInvNotes('');
             setProdNotes('');
             setEstimatedShipDate(null);
             setSelectedDrawingId('');
        }
    }, [isOpen, wo, department]);

    const handleBomItemUpdate = (itemId, field, value) => {
        const newUpdates = { ...itemBomUpdates[itemId], [field]: value };
    
        if (field === 'bom_id') {
            const selectedBom = boms.find(b => b.id === value);
            if (selectedBom) {
                newUpdates.product_id = selectedBom.product_id;
            }
        }

        setItemBomUpdates(prev => ({
            ...prev,
            [itemId]: newUpdates
        }));
    };
    
    const handleSubmit = async () => {
        setIsSubmitting(true);
        let newStatus, notes, bomUpdates = null, shipDate = null, drawingId = null;
        let dept = department;

        if (department === 'engineering') {
            newStatus = engApprovalStatus;
            notes = engNotes;
            bomUpdates = Object.entries(itemBomUpdates).map(([itemId, updates]) => ({ item_id: itemId, bom_id: updates.bom_id, product_id: updates.product_id, notes: updates.notes }));
            drawingId = selectedDrawingId || null;
        } else if (department === 'inventory') {
            newStatus = invApprovalStatus;
            notes = invNotes;
        } else if (department === 'manufacture') {
            newStatus = prodStatus;
            notes = prodNotes;
            shipDate = estimatedShipDate ? format(estimatedShipDate, 'yyyy-MM-dd') : null;
        }

        const { error } = await supabase.rpc('update_wo_status', {
            p_work_order_id: wo.id,
            p_department: dept,
            p_new_status: newStatus,
            p_notes: notes,
            p_bom_updates: bomUpdates,
            p_estimated_ship_date: shipDate,
            p_drawing_id: drawingId,
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal Update Status', description: error.message });
        } else {
            toast({ title: 'Sukses', description: `Status Work Order berhasil diupdate.` });
            onFinished();
        }
        setIsSubmitting(false);
    };

    const renderEngineeringForm = () => (
        <div className="space-y-4">
            <h4 className="font-semibold">Persetujuan Teknis</h4>
            {(wo.items || []).map(item => {
                const currentItemState = itemBomUpdates[item.id] || {};
                const product = products.find(p => p.id === currentItemState.product_id);
                return (
                    <Card key={item.id} className="p-4 bg-slate-50">
                        <p className="font-medium">{item.description || product?.name} (Qty: {item.quantity})</p>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                            <div className="space-y-1">
                                <Label>BOM Terpilih</Label>
                                <BOMSelector 
                                    selectedBOM={currentItemState.bom_id} 
                                    onBOMSelect={bomId => handleBomItemUpdate(item.id, 'bom_id', bomId)} 
                                    boms={boms} 
                                    disabled={isEngineeringApproved}
                                />
                            </div>
                             <div className="space-y-1">
                                <Label>Spesifikasi / Catatan</Label>
                                <Textarea 
                                    placeholder="Catatan untuk item ini" 
                                    value={currentItemState.notes || ''} 
                                    onChange={e => handleBomItemUpdate(item.id, 'notes', e.target.value)} 
                                    disabled={isEngineeringApproved}
                                />
                            </div>
                        </div>
                    </Card>
                )
            })}
            <div className="space-y-2">
                <Label>Paket Drawing</Label>
                <DrawingSelector
                    selectedDrawing={selectedDrawingId}
                    onDrawingSelect={setSelectedDrawingId}
                    drawings={drawings}
                    disabled={isEngineeringApproved}
                />
            </div>
            {!isEngineeringApproved && (
                <>
                    <div className="space-y-2">
                        <Label>Status Persetujuan</Label>
                        <Select value={engApprovalStatus} onValueChange={setEngApprovalStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Approved">Approve</SelectItem>
                                <SelectItem value="Revise">Revisi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Catatan Umum</Label>
                        <Textarea value={engNotes} onChange={e => setEngNotes(e.target.value)} placeholder="Tambahkan catatan umum untuk tim selanjutnya..." />
                    </div>
                </>
            )}
        </div>
    );

    const renderInventoryForm = () => (
         <div className="space-y-4">
            <h4 className="font-semibold">Kesiapan Material</h4>
            <div className="space-y-2">
                <Label>Referensi Produk</Label>
                <p className="text-sm p-2 bg-gray-100 rounded-md">
                    {wo.items?.map(i => i.description || i.product?.name).join(', ') || 'N/A'}
                </p>
            </div>
            <div className="space-y-2">
                <Label>Status Kesiapan</Label>
                <Select value={invApprovalStatus} onValueChange={setInvApprovalStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Barang Siap">Semua Material Siap</SelectItem>
                        <SelectItem value="Barang Siap Parsial">Siap Sebagian (Sambil Jalan)</SelectItem>
                        <SelectItem value="Antrian">Antrian (Stok Belum Ada)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Catatan Inventaris</Label>
                <Textarea value={invNotes} onChange={e => setInvNotes(e.target.value)} placeholder="Catatan ketersediaan material, dll." />
            </div>
        </div>
    );
    
    const renderProductionForm = () => (
         <div className="space-y-4">
            <h4 className="font-semibold">Update Status Produksi</h4>
            <div className="space-y-2">
                <Label>Referensi Produk</Label>
                <p className="text-sm p-2 bg-gray-100 rounded-md">
                    {wo.items?.map(i => i.description || i.product?.name).join(', ') || 'N/A'}
                </p>
            </div>
            <div className="space-y-2">
                <Label>Ubah Status Ke</Label>
                <Select value={prodStatus} onValueChange={setProdStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {wo.production_status === 'Tunggu Antrian' && <SelectItem value="Proses">Mulai Proses Produksi</SelectItem>}
                        {wo.production_status === 'Proses' && <SelectItem value="QC">Selesai, Masuk QC</SelectItem>}
                        {wo.production_status === 'QC' && <SelectItem value="Terkirim">Terkirim ke Pelanggan</SelectItem>}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Estimasi Tanggal Pengiriman</Label>
                <DatePicker
                  date={estimatedShipDate}
                  onDateChange={setEstimatedShipDate}
                  placeholder="Pilih tanggal estimasi"
                />
            </div>
             <div className="space-y-2">
                <Label>Catatan Produksi</Label>
                <Textarea value={prodNotes} onChange={e => setProdNotes(e.target.value)} placeholder="Update progres, kendala, dll." />
            </div>
        </div>
    );

    const formContent = {
        engineering: wo && renderEngineeringForm(),
        inventory: wo && renderInventoryForm(),
        manufacture: wo && renderProductionForm(),
    };

    if (!wo) return null; 

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Update Work Order: {wo.wo_number}</DialogTitle>
                    <DialogDescription>Departemen: <span className="font-semibold capitalize">{department}</span></DialogDescription>
                </DialogHeader>
                <div className="py-4 max-h-[70vh] overflow-y-auto px-1">
                    {formContent[department]}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || (department === 'engineering' && isEngineeringApproved) }>{isSubmitting ? 'Menyimpan...' : <><Save className="mr-2 h-4 w-4" /> Simpan</>}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const WOBomDetails = ({ wo, onPrint, userRole, onFinished }) => {
    const { toast } = useToast();
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [isProcessingMI, setIsProcessingMI] = useState(false);
    const [isProcessingPR, setIsProcessingPR] = useState(false);

    const canGenerateMI = ['inventory', 'admin'].includes(userRole);
    const canGeneratePR = ['inventory', 'manufacture', 'admin'].includes(userRole);
    const canPrintBOM = ['engineering', 'manufacture', 'inventory', 'admin'].includes(userRole);
    const canSelectItems = canGenerateMI || canGeneratePR;

    const { itemsForMI, itemsForPR } = useMemo(() => {
        const forMI = new Set();
        const forPR = new Set();
        if (!wo.items) return { itemsForMI, itemsForPR };

        wo.items.forEach(woItem => {
            woItem.bom?.bom_items?.forEach(bomItem => {
                if (checkedItems.has(bomItem.id)) {
                    const stock = bomItem.item?.total_stock ?? 0;
                    const required = bomItem.quantity_required;
                    if (stock >= required) {
                        forMI.add(bomItem.id);
                    } else {
                        forPR.add(bomItem.id);
                    }
                }
            });
        });
        return { itemsForMI: forMI, itemsForPR: forPR };
    }, [checkedItems, wo.items]);

    const allBomsPresent = wo.items.every(item => item.bom);
    const engApproval = (wo.history || []).find(h => h.department === 'engineering' && h.to_status === 'Approved');

    const handleCheckboxChange = (bomItemId, isChecked) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(bomItemId);
            } else {
                newSet.delete(bomItemId);
            }
            return newSet;
        });
    };

    const handleGenerateMI = async () => {
        if (itemsForMI.size === 0) {
            toast({ variant: 'destructive', title: 'Tidak ada item valid', description: 'Pilih item dengan stok cukup untuk membuat Pengeluaran Barang.' });
            return;
        }
        setIsProcessingMI(true);
        const selectedItemsPayload = Array.from(itemsForMI).map(id => ({ bom_item_id: id }));

        const { data, error } = await supabase.rpc('generate_mi_from_wo_selection', {
            p_work_order_id: wo.id,
            p_selected_items: selectedItemsPayload
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal Membuat MI', description: error.message });
        } else {
            toast({ title: 'Sukses!', description: `${data.material_issues_created} item berhasil dikeluarkan.` });
            setCheckedItems(new Set());
            onFinished();
        }
        setIsProcessingMI(false);
    };

    const handleGeneratePR = async () => {
        if (itemsForPR.size === 0) {
            toast({ variant: 'destructive', title: 'Tidak ada item valid', description: 'Pilih item dengan stok kurang untuk membuat Permintaan Barang.' });
            return;
        }
        setIsProcessingPR(true);
        const selectedItemsPayload = Array.from(itemsForPR).map(id => ({ bom_item_id: id }));

        const { data, error } = await supabase.rpc('generate_pr_from_wo_selection', {
            p_work_order_id: wo.id,
            p_selected_items: selectedItemsPayload
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal Membuat PR', description: error.message });
        } else {
            toast({ title: 'Sukses!', description: `${data.purchase_requests_created} item dibuatkan Permintaan Barang.` });
            setCheckedItems(new Set());
            onFinished();
        }
        setIsProcessingPR(false);
    };

    return (
        <div className="p-4 bg-gray-50 space-y-4 col-span-full">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                     <h4 className="font-semibold">Detail Bill of Materials (BOM)</h4>
                     <p className="text-sm text-muted-foreground">
                        {engApproval ? `Disetujui oleh ${engApproval.changed_by_user?.full_name || 'Sistem'} pada ${formatDate(engApproval.changed_at, true)}` : 'Menunggu persetujuan Engineering.'}
                     </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {canGenerateMI && (
                        <Button onClick={handleGenerateMI} size="sm" disabled={isProcessingMI || itemsForMI.size === 0}>
                            <Package className="h-4 w-4 mr-2" /> {isProcessingMI ? 'Memproses...' : `Buat Pengeluaran (${itemsForMI.size})`}
                        </Button>
                    )}
                    {canGeneratePR && (
                        <Button onClick={handleGeneratePR} size="sm" variant="outline" disabled={isProcessingPR || itemsForPR.size === 0}>
                            <ShoppingCart className="h-4 w-4 mr-2" /> {isProcessingPR ? 'Memproses...' : `Buat Permintaan (${itemsForPR.size})`}
                        </Button>
                    )}
                    {canPrintBOM && (
                        <Button onClick={onPrint} size="sm"><Printer className="h-4 w-4 mr-2" /> Cetak BOM</Button>
                    )}
                </div>
            </div>

            {!allBomsPresent && <p className="text-sm text-yellow-600">Beberapa item belum memiliki BOM. Lengkapi melalui menu approval engineering.</p>}

            {wo.items.map(woItem => (
                <Card key={woItem.id} className="bg-white">
                    <CardHeader>
                        <CardTitle className="text-base">{woItem.product?.name || woItem.description}</CardTitle>
                        <CardDescription>Qty: {woItem.quantity} {woItem.product?.unit || 'Pcs'} | BOM: {woItem.bom?.name || 'Belum Dipilih'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {woItem.bom && woItem.bom.bom_items && woItem.bom.bom_items.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {canSelectItems && <TableHead className="w-[50px]">Pilih</TableHead>}
                                            <TableHead>Nama Material</TableHead>
                                            <TableHead>Catatan</TableHead>
                                            <TableHead className="text-right">Dibutuhkan</TableHead>
                                            <TableHead className="text-right">Stok Gudang</TableHead>
                                            <TableHead className="text-right">Ketersediaan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {woItem.bom.bom_items.map(bomItem => {
                                            const stock = bomItem.item?.total_stock ?? 0;
                                            const required = bomItem.quantity_required;
                                            const isSufficient = stock >= required;
                                            const isChecked = checkedItems.has(bomItem.id);

                                            const rowClass = isChecked ? 'bg-blue-50' : '';

                                            return (
                                                <TableRow key={bomItem.id} className={rowClass}>
                                                    {canSelectItems && (
                                                        <TableCell>
                                                            <Checkbox
                                                                id={`check-${bomItem.id}`}
                                                                checked={isChecked}
                                                                onCheckedChange={(checked) => handleCheckboxChange(bomItem.id, checked)}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="font-medium whitespace-nowrap">{bomItem.item?.name || 'N/A'}</TableCell>
                                                    <TableCell className="text-muted-foreground">{woItem.engineering_notes || '-'}</TableCell>
                                                    <TableCell className="text-right whitespace-nowrap">{required} {bomItem.item?.unit || 'N/A'}</TableCell>
                                                    <TableCell className="text-right whitespace-nowrap">{stock} {bomItem.item?.unit || 'N/A'}</TableCell>
                                                    <TableCell className="text-right">
                                                        {isSufficient ? (
                                                            <Badge variant='success'>Cukup</Badge>
                                                        ) : (
                                                            <Badge variant='destructive'>Kurang {required - stock}</Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Tidak ada komponen dalam BOM ini.</p>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

const DrawingAttachment = ({ wo }) => {
    const canView = ['admin', 'engineering', 'manufacture'].includes(useAuth().user?.user_metadata?.role);
    if (!canView || !wo.drawing) return null;

    const { name, description, files } = wo.drawing;

    return (
        <div className="p-4 bg-gray-50 space-y-4">
            <h4 className="font-semibold">Lampiran Drawing</h4>
            <Card className="bg-white">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Folder className="h-5 w-5 text-blue-500" /> {name}</CardTitle>
                    <CardDescription>{description || 'Tidak ada deskripsi.'}</CardDescription>
                </CardHeader>
                <CardContent>
                    {files && files.length > 0 ? (
                        <div className="space-y-2">
                            {files.map(file => (
                                <div key={file.id} className="flex items-center justify-between p-2 border rounded-md">
                                    <div className="flex items-center gap-2">
                                        {file.file_type.startsWith('image/') ? <ImageIcon className="h-5 w-5 text-blue-500" /> : <FileIcon className="h-5 w-5 text-red-500" />}
                                        <span className="text-sm">{file.file_name}</span>
                                    </div>
                                    {/* Download/Preview buttons can be added here if needed */}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Tidak ada file dalam paket drawing ini.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

const AmendmentForm = ({ wo, onFinished }) => {
    const { warehouses, refreshData } = useData();
    const { toast } = useToast();
    const [selectedItem, setSelectedItem] = useState(null);
    const [warehouseId, setWarehouseId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleItemSelect = (item) => {
        setSelectedItem(item);
    };

    const handleNewItemCreated = (newItem) => {
        refreshData();
        setSelectedItem(newItem);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedItem || !warehouseId || !quantity) {
            toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Harap pilih barang, gudang, dan isi jumlah.' });
            return;
        }
        setIsSubmitting(true);
        const { error } = await supabase.from('work_order_amendments').insert({
            work_order_id: wo.id,
            item_id: selectedItem.id,
            warehouse_id: warehouseId,
            quantity: quantity,
            notes: notes,
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal menambah amandemen', description: error.message });
        } else {
            toast({ title: 'Sukses', description: 'Amandemen material berhasil ditambahkan.' });
            setSelectedItem(null);
            setWarehouseId('');
            setQuantity(1);
            setNotes('');
            onFinished();
        }
        setIsSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-white">
            <h5 className="font-semibold">Tambah Material Amandemen</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-1 col-span-1 md:col-span-2">
                    <Label>Barang</Label>
                    <CreatableItemSelector
                        onValueChange={handleItemSelect}
                        onNewItemCreated={handleNewItemCreated}
                        placeholder={selectedItem ? selectedItem.name : "Pilih atau buat barang..."}
                        filterStock={false}
                    />
                </div>
                <div className="space-y-1">
                    <Label>Gudang</Label>
                    <Select value={warehouseId} onValueChange={setWarehouseId}>
                        <SelectTrigger><SelectValue placeholder="Pilih gudang" /></SelectTrigger>
                        <SelectContent>
                            {warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label>Jumlah</Label>
                    <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" />
                </div>
                <div className="space-y-1 col-span-1 md:col-span-2 lg:col-span-3">
                    <Label>Catatan</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan (opsional)" />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full lg:w-auto">
                    {isSubmitting ? 'Menambahkan...' : <><PlusCircle className="h-4 w-4 mr-2" /> Tambah</>}
                </Button>
            </div>
        </form>
    );
};

const AmendmentDetails = ({ wo, userRole, onFinished }) => {
    const { toast } = useToast();
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [isProcessingMI, setIsProcessingMI] = useState(false);
    const [isProcessingPR, setIsProcessingPR] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const canGenerateMI = ['inventory', 'admin'].includes(userRole);
    const canGeneratePR = ['inventory', 'manufacture', 'admin'].includes(userRole);
    const canManage = ['inventory', 'manufacture', 'admin'].includes(userRole);

    const { itemsForMI, itemsForPR } = useMemo(() => {
        const forMI = new Set();
        const forPR = new Set();
        if (!wo.work_order_amendments) return { itemsForMI, itemsForPR };

        wo.work_order_amendments.forEach(amendment => {
            if (checkedItems.has(amendment.id)) {
                const stock = amendment.item?.total_stock ?? 0;
                const required = amendment.quantity;
                if (stock >= required) {
                    forMI.add(amendment.id);
                } else {
                    forPR.add(amendment.id);
                }
            }
        });
        return { itemsForMI: forMI, itemsForPR: forPR };
    }, [checkedItems, wo.work_order_amendments]);

    const handleCheckboxChange = (amendmentId, isChecked) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (isChecked) newSet.add(amendmentId);
            else newSet.delete(amendmentId);
            return newSet;
        });
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);
        const { error } = await supabase.from('work_order_amendments').delete().eq('id', itemToDelete.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Gagal hapus', description: error.message });
        } else {
            toast({ title: 'Sukses', description: 'Amandemen berhasil dihapus.' });
            onFinished();
        }
        setIsDeleting(false);
        setItemToDelete(null);
    };

    // TODO: Implement generate MI/PR for amendments
    const handleGenerateMI = () => toast({ title: 'Segera Hadir', description: 'Fitur ini sedang dalam pengembangan.' });
    const handleGeneratePR = () => toast({ title: 'Segera Hadir', description: 'Fitur ini sedang dalam pengembangan.' });

    return (
        <div className="p-4 bg-gray-50 space-y-4 col-span-full">
            {canManage && <AmendmentForm wo={wo} onFinished={onFinished} />}

            <Card className="bg-white mt-4">
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                            <CardTitle className="text-base">Daftar Material Amandemen</CardTitle>
                            <CardDescription>Material tambahan di luar BOM.</CardDescription>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {canGenerateMI && (
                                <Button onClick={handleGenerateMI} size="sm" disabled={isProcessingMI || itemsForMI.size === 0}>
                                    <Package className="h-4 w-4 mr-2" /> {isProcessingMI ? 'Memproses...' : `Buat Pengeluaran (${itemsForMI.size})`}
                                </Button>
                            )}
                            {canGeneratePR && (
                                <Button onClick={handleGeneratePR} size="sm" variant="outline" disabled={isProcessingPR || itemsForPR.size === 0}>
                                    <ShoppingCart className="h-4 w-4 mr-2" /> {isProcessingPR ? 'Memproses...' : `Buat Permintaan (${itemsForPR.size})`}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {wo.work_order_amendments && wo.work_order_amendments.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {canManage && <TableHead className="w-[50px]">Pilih</TableHead>}
                                        <TableHead>Nama Material</TableHead>
                                        <TableHead>Gudang</TableHead>
                                        <TableHead className="text-right">Dibutuhkan</TableHead>
                                        <TableHead className="text-right">Stok Gudang</TableHead>
                                        <TableHead className="text-right">Ketersediaan</TableHead>
                                        {canManage && <TableHead className="text-right">Aksi</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {wo.work_order_amendments.map(amendment => {
                                        const stock = amendment.item?.total_stock ?? 0;
                                        const required = amendment.quantity;
                                        const isSufficient = stock >= required;
                                        const isChecked = checkedItems.has(amendment.id);
                                        return (
                                            <TableRow key={amendment.id} className={isChecked ? 'bg-blue-50' : ''}>
                                                {canManage && (
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => handleCheckboxChange(amendment.id, checked)}
                                                        />
                                                    </TableCell>
                                                )}
                                                <TableCell className="font-medium whitespace-nowrap">{amendment.item?.name || 'N/A'}</TableCell>
                                                <TableCell>{amendment.warehouse?.name || 'N/A'}</TableCell>
                                                <TableCell className="text-right">{required} {amendment.item?.unit}</TableCell>
                                                <TableCell className="text-right">{stock} {amendment.item?.unit}</TableCell>
                                                <TableCell className="text-right">
                                                    {isSufficient ? <Badge variant='success'>Cukup</Badge> : <Badge variant='destructive'>Kurang {required - stock}</Badge>}
                                                </TableCell>
                                                {canManage && (
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => setItemToDelete(amendment)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Belum ada material amandemen.</p>
                    )}
                </CardContent>
            </Card>
            <ConfirmationDialog
                open={!!itemToDelete}
                onOpenChange={() => setItemToDelete(null)}
                onConfirm={handleDelete}
                title="Hapus Amandemen?"
                description={`Anda yakin ingin menghapus amandemen untuk "${itemToDelete?.item?.name}"?`}
                confirmText="Ya, Hapus"
                isSubmitting={isDeleting}
            />
        </div>
    );
};


const DepartmentStatusBadge = ({ status }) => {
    const config = departmentStatusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
};

const WorkOrdersPage = () => {
    const { workOrders, loading, refreshData, companyProfile } = useData();
    const { user } = useAuth();
    const { toast } = useToast();
    const userRole = user?.user_metadata?.role;
    const location = useLocation();
    
    const [selectedWO, setSelectedWO] = useState(null);
    const [isApprovalOpen, setIsApprovalOpen] = useState(false);
    const [approvalDepartment, setApprovalDepartment] = useState('');
    const [expandedRow, setExpandedRow] = useState(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    useEffect(() => {
        if (location.state?.woId) {
            setExpandedRow(location.state.woId);
        }
    }, [location.state]);

    const handleOpenApproval = (wo, department) => {
        setSelectedWO(wo);
        setApprovalDepartment(department);
        setIsApprovalOpen(true);
    };

    const handleApprovalFinished = () => {
        setIsApprovalOpen(false);
        setSelectedWO(null);
        setApprovalDepartment('');
        refreshData();
    };
    
    const handlePrint = async (wo) => {
        if (!companyProfile) {
            toast({ variant: "destructive", title: "Gagal Cetak", description: "Profil perusahaan belum lengkap." });
            return;
        }
        toast({ title: "Mencetak PDF...", description: "Mohon tunggu sebentar." });
        await generateWOPDF(wo, companyProfile, user);
    };

    const handlePrintBom = async (wo) => {
         if (!companyProfile) {
            toast({ variant: "destructive", title: "Gagal Cetak", description: "Profil perusahaan belum lengkap." });
            return;
        }
        toast({ title: "Mencetak BOM PDF...", description: "Mohon tunggu sebentar." });
        await generateWOBOMPDF(wo, companyProfile);
    }

    const handleDeleteClick = (wo) => {
        setSelectedWO(wo);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedWO) return;
        setIsSubmittingDelete(true);
        const { error } = await supabase.rpc('delete_work_order', { p_work_order_id: selectedWO.id });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal Hapus WO', description: error.message });
        } else {
            toast({ title: 'Sukses', description: `Work Order ${selectedWO.wo_number} telah dihapus permanen.` });
            refreshData();
        }
        setIsSubmittingDelete(false);
        setIsDeleteDialogOpen(false);
        setSelectedWO(null);
    };

    const toggleRow = (id) => setExpandedRow(expandedRow === id ? null : id);
    
    const activeWorkOrders = useMemo(() => {
        const filtered = workOrders;
        if (!debouncedSearchTerm) return filtered;
        
        const lowercasedTerm = debouncedSearchTerm.toLowerCase();
        return filtered.filter(wo => 
            wo.wo_number.toLowerCase().includes(lowercasedTerm) ||
            (wo.customer?.name && wo.customer.name.toLowerCase().includes(lowercasedTerm)) ||
            wo.status.toLowerCase().includes(lowercasedTerm)
        );
    }, [workOrders, debouncedSearchTerm]);

  return (
    <>
      <Helmet>
        <title>Work Orders</title>
        <meta name="description" content="Kelola semua Work Orders (WO) dari berbagai departemen." />
      </Helmet>
      <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Manajemen Work Order</h1>
              <p className="text-gray-500">Lacak dan kelola semua perintah kerja dari berbagai departemen.</p>
            </div>
             <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari WO, customer..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
          
            {loading ? <p className="text-center py-10">Memuat data Work Orders...</p> : 
            activeWorkOrders.length === 0 ? <EmptyState icon={HardHat} title="Belum Ada Work Order" description="Work order akan muncul di sini setelah dibuat dari Sales Order." /> :
            (
                <Card>
                    <CardHeader>
                        <CardTitle>Semua Work Order</CardTitle>
                        <CardDescription>Total {activeWorkOrders.length} work order aktif tercatat.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[20px]"></TableHead>
                                        <TableHead>WO Number</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Status Utama</TableHead>
                                        <TableHead>Eng.</TableHead>
                                        <TableHead>Inv.</TableHead>
                                        <TableHead>Prod.</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activeWorkOrders.map(wo => {
                                        const canDelete = userRole === 'admin';
                                        const isEngApproved = wo.engineering_status === 'Approved';
                                        
                                        const isEng = userRole === 'admin' || userRole === 'engineering';
                                        const isInv = userRole === 'admin' || userRole === 'inventory';
                                        const isProd = userRole === 'admin' || userRole === 'manufacture';
                                        
                                        const canApproveEng = isEng && wo.engineering_status === 'Pending Approval';
                                        const canApproveInv = isInv && wo.inventory_status === 'Pending Approval' && isEngApproved;
                                        const canUpdateProd = isProd && isEngApproved && (wo.inventory_status.startsWith('Barang Siap') || wo.inventory_status === 'Barang Dikeluarkan' || wo.inventory_status === 'Barang Disiapkan') && wo.production_status !== 'Terkirim';
                                        
                                        return (
                                        <React.Fragment key={wo.id}>
                                            <TableRow>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => toggleRow(wo.id)} title="Lihat Detail">
                                                      <ClipboardList className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="font-medium">{wo.wo_number}</TableCell>
                                                <TableCell>{wo.customer?.name || 'N/A'}</TableCell>
                                                <TableCell><Badge className={`${mainStatusConfig[wo.status]?.color || 'bg-gray-200'} whitespace-nowrap`}>{mainStatusConfig[wo.status]?.label || wo.status}</Badge></TableCell>
                                                <TableCell><DepartmentStatusBadge status={wo.engineering_status} /></TableCell>
                                                <TableCell><DepartmentStatusBadge status={wo.inventory_status} /></TableCell>
                                                <TableCell><DepartmentStatusBadge status={wo.production_status} /></TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Buka menu</span><MoreVertical className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {isEng && <DropdownMenuItem onClick={() => handleOpenApproval(wo, 'engineering')}><ThumbsUp className="mr-2 h-4 w-4" />{canApproveEng ? 'Approval' : 'Review'} Engineering</DropdownMenuItem>}
                                                            {isInv && <DropdownMenuItem onClick={() => handleOpenApproval(wo, 'inventory')} disabled={!canApproveInv}><PackageCheck className="mr-2 h-4 w-4" /> Approval Inventory</DropdownMenuItem>}
                                                            {isProd && <DropdownMenuItem onClick={() => handleOpenApproval(wo, 'manufacture')} disabled={!canUpdateProd}><Factory className="mr-2 h-4 w-4" /> Update Produksi</DropdownMenuItem>}
                                                            
                                                            <DropdownMenuItem onClick={() => handlePrint(wo)}><Printer className="mr-2 h-4 w-4" /> Cetak WO</DropdownMenuItem>
                                                            {canDelete && <DropdownMenuItem onClick={() => handleDeleteClick(wo)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                            {expandedRow === wo.id && (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="p-0 bg-gray-100">
                                                        <div className="p-4">
                                                            <Tabs defaultValue="bom">
                                                                <TabsList>
                                                                    <TabsTrigger value="bom">BOM & Drawing</TabsTrigger>
                                                                    <TabsTrigger value="amendment">Amandemen Material</TabsTrigger>
                                                                </TabsList>
                                                                <TabsContent value="bom">
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-gray-200 mt-4">
                                                                        <WOBomDetails wo={wo} onPrint={() => handlePrintBom(wo)} userRole={userRole} onFinished={refreshData} />
                                                                        <DrawingAttachment wo={wo} />
                                                                    </div>
                                                                </TabsContent>
                                                                <TabsContent value="amendment">
                                                                    <AmendmentDetails wo={wo} userRole={userRole} onFinished={refreshData} />
                                                                </TabsContent>
                                                            </Tabs>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    )})}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

          {isApprovalOpen && selectedWO && (
              <ApprovalDialog 
                isOpen={isApprovalOpen} 
                onOpenChange={setIsApprovalOpen} 
                wo={selectedWO}
                department={approvalDepartment}
                onFinished={handleApprovalFinished}
              />
          )}

          <ConfirmationDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={confirmDelete}
                title="Anda yakin ingin menghapus Work Order ini?"
                description="Tindakan ini akan menghapus data Work Order secara permanen dari sistem dan tidak dapat dibatalkan."
                confirmText="Ya, Hapus Permanen"
                isSubmitting={isSubmittingDelete}
            />
      </div>
    </>
  );
};

export default WorkOrdersPage;
