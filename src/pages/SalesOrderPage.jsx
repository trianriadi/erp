
import React, { useState, useMemo, useEffect, useCallback } from 'react';
        import { useLocation, useNavigate, Link } from 'react-router-dom';
        import { Helmet } from 'react-helmet';
        import { motion } from 'framer-motion';
        import { PlusCircle, Edit, Trash2, Search, Package, MinusCircle, CheckCircle, Send, HardHat, FileText, MoreVertical, Factory } from 'lucide-react';
        import { useData } from '@/contexts/DataContext';
        import { useAuth } from '@/contexts/SupabaseAuthContext';
        import { Button } from '@/components/ui/button';
        import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
        import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
        import { Input } from '@/components/ui/input';
        import { Label } from '@/components/ui/label';
        import { Textarea } from '@/components/ui/textarea';
        import { useToast } from '@/components/ui/use-toast';
        import { supabase } from '@/lib/customSupabaseClient';
        import EmptyState from '@/components/EmptyState';
        import { CustomerSelector } from '@/components/CustomerSelector';
        import { ProductSelector } from '@/components/ProductSelector';
        import useDebounce from '@/hooks/useDebounce';
        import { format } from 'date-fns';
        import { id } from 'date-fns/locale';
        import { Checkbox } from '@/components/ui/checkbox';
        import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
        import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
        import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
        import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
        import ConfirmationDialog from '@/components/ConfirmationDialog';
        import { DatePicker } from "@/components/ui/datepicker";
        import { Badge } from '@/components/ui/badge';

        const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
        const formatDate = (date) => date ? format(new Date(date), "d MMMM yyyy", { locale: id }) : '';

        const statusConfig = {
            'pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
            'confirmed': { label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
            'approved': { label: 'Approved', color: 'bg-blue-100 text-blue-800' },
            'processing': { label: 'Processing', color: 'bg-indigo-100 text-indigo-800' },
            'shipped': { label: 'Shipped', color: 'bg-purple-100 text-purple-800' },
            'completed': { label: 'Completed', color: 'bg-green-100 text-green-800' },
            'cancelled': { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
        };

        const mainStatusConfig = {
          Draft: { label: 'Draft', color: 'bg-gray-200 text-gray-800' },
          'Pending Inventory': { label: 'Menunggu Inventory', color: 'bg-yellow-200 text-yellow-800' },
          'Tunggu Antrian': { label: 'Antrian Produksi', color: 'bg-blue-200 text-blue-800' },
          Proses: { label: 'Proses Produksi', color: 'bg-indigo-200 text-indigo-800' },
          QC: { label: 'QC', color: 'bg-cyan-200 text-cyan-800'},
          Terkirim: { label: 'Terkirim', color: 'bg-green-200 text-green-800' },
        };

        const GenerateWOForm = ({ onFinished, initialSO }) => {
            const { toast } = useToast();
            const [formData, setFormData] = useState({
                notes: '',
                estimated_ship_date: null,
            });
            const [isSubmitting, setIsSubmitting] = useState(false);

            const handleSubmit = async (e) => {
                e.preventDefault();
                setIsSubmitting(true);

                const payload = {
                    p_sales_order_id: initialSO?.id,
                    p_notes: formData.notes || null,
                    p_estimated_ship_date: formData.estimated_ship_date ? format(formData.estimated_ship_date, "yyyy-MM-dd") : null,
                };

                const { error } = await supabase.rpc('create_work_order', payload);

                if (error) {
                    toast({ variant: 'destructive', title: 'Gagal membuat Work Order', description: error.message });
                } else {
                    toast({ title: 'Sukses', description: 'Work Order berhasil dibuat.' });
                    onFinished();
                }
                setIsSubmitting(false);
            };

            return (
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Pelanggan</Label>
                            <Input value={initialSO?.customer?.name || '...'} disabled />
                        </div>
                        <div className="space-y-1">
                            <Label>Nomor Referensi SO</Label>
                            <Input value={initialSO?.so_number || 'Manual'} disabled />
                        </div>
                    </div>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Item Work Order</CardTitle>
                            <CardDescription>Item akan disalin secara otomatis dari Sales Order. Pastikan semua item di SO sudah benar.</CardDescription>
                        </CardHeader>
                    </Card>

                    <div className="space-y-1">
                        <Label htmlFor="estimated_ship_date">Estimasi Pengiriman</Label>
                         <DatePicker 
                           date={formData.estimated_ship_date}
                           onDateChange={(date) => setFormData(prev => ({ ...prev, estimated_ship_date: date }))}
                           placeholder="Pilih tanggal estimasi"
                         />
                    </div>

                    <div className="space-y-1">
                        <Label>Catatan Umum WO (Opsional)</Label>
                        <Textarea value={formData.notes} onChange={e => setFormData(prev => ({...prev, notes: e.target.value}))} placeholder="Tambahkan catatan jika ada..." />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onFinished(false)}>Batal</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Membuat WO...' : 'Buat Work Order'}</Button>
                    </DialogFooter>
                </form>
            );
        };

        const ProductionProgressTab = ({ soId }) => {
            const { workOrders, loading } = useData();
            const relevantWOs = useMemo(() => workOrders.filter(wo => wo.sales_order_id === soId), [workOrders, soId]);

            if (loading) return <p>Memuat progress...</p>;
            if (relevantWOs.length === 0) {
                return <EmptyState icon={Factory} title="Belum Ada Work Order" description="Progress produksi akan muncul di sini setelah Work Order dibuat." />;
            }

            return (
                <div className="space-y-4 p-4">
                    {relevantWOs.map(wo => {
                        const totalQtyOrdered = wo.items.reduce((sum, item) => sum + item.quantity, 0);
                        // NOTE: Qty finished logic is a placeholder. This should be updated based on actual production output tracking.
                        const qtyFinished = wo.status === 'Terkirim' ? totalQtyOrdered : 0;
                        const progress = totalQtyOrdered > 0 ? (qtyFinished / totalQtyOrdered) * 100 : 0;

                        return (
                            <Card key={wo.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle>{wo.wo_number}</CardTitle>
                                        <Badge className={`${mainStatusConfig[wo.status]?.color || 'bg-gray-200'}`}>{mainStatusConfig[wo.status]?.label || wo.status}</Badge>
                                    </div>
                                    <CardDescription>
                                        Produk: {wo.items.map(i => i.product?.name || i.description).join(', ')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Estimasi Selesai</p>
                                            <p className="font-medium">{formatDate(wo.estimated_ship_date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Progress Kuantitas</p>
                                            <p className="font-medium">{qtyFinished} / {totalQtyOrdered} ({progress.toFixed(0)}%)</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            );
        };

        const SalesOrderList = () => {
              const { salesOrders, loading, refreshData, products } = useData();
              const { user } = useAuth();
              const userRole = user?.user_metadata?.role;
              const { toast } = useToast();
              const location = useLocation();
              const navigate = useNavigate();

              const [isFormOpen, setIsFormOpen] = useState(false);
              const [isGenerateWOOpen, setIsGenerateWOOpen] = useState(false);
              const [selectedSO, setSelectedSO] = useState(null);
              const [soToDelete, setSoToDelete] = useState(null);
              const [isDeleting, setIsDeleting] = useState(false);
              const [searchTerm, setSearchTerm] = useState('');
              const debouncedSearchTerm = useDebounce(searchTerm, 300);
              const [selectedSOs, setSelectedSOs] = useState(new Set());
              const [expandedRow, setExpandedRow] = useState(null);

              useEffect(() => {
                const quotationToConvert = location.state?.quotationToConvert;
                if (quotationToConvert) {
                  const newSO = {
                    so_number: `SO-${quotationToConvert.quotation_no}`,
                    customer_id: quotationToConvert.customer_id,
                    quotation_id: quotationToConvert.id,
                    notes: quotationToConvert.notes,
                    status: 'confirmed',
                    items: quotationToConvert.items.map(i => ({
                      product_id: i.product_id,
                      description: i.description,
                      specification: i.specification,
                      qty: i.qty,
                      unit_price: i.unit_price
                    })),
                  };
                  setSelectedSO(newSO);
                  setIsFormOpen(true);
                  navigate(location.pathname, { replace: true, state: {} });
                }
              }, [location, navigate]);

              const eligibleSOs = useMemo(() => {
                return salesOrders.filter(so => ['confirmed', 'approved'].includes(so.status));
              }, [salesOrders]);

              const filteredSOs = useMemo(() => {
                if (!debouncedSearchTerm) return salesOrders;
                return salesOrders.filter(so =>
                  so.so_number.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                  so.customer?.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                );
              }, [salesOrders, debouncedSearchTerm]);

              const handleEdit = async (so) => {
                const { data: items, error } = await supabase.from('sales_order_items').select('*, product:products(*)').eq('so_id', so.id);
                if (error) {
                    toast({ variant: 'destructive', title: 'Gagal memuat item SO', description: error.message });
                    return;
                }
                setSelectedSO({ ...so, items });
                setIsFormOpen(true);
              };
              
              const handleOpenGenerateWO = async (so) => {
                const { data: items, error } = await supabase.from('sales_order_items').select('*').eq('so_id', so.id);
                if (error) {
                    toast({ variant: 'destructive', title: 'Gagal memuat item SO', description: error.message });
                    return;
                }
                
                const enrichedItems = items.map(item => {
                    const product = products.find(p => p.id === item.product_id);
                    return {
                        ...item,
                        description: item.description || product?.name || 'Produk tidak ditemukan',
                        specification: item.specification || product?.specification || '',
                    };
                });

                setSelectedSO({ ...so, items: enrichedItems });
                setIsGenerateWOOpen(true);
              };

              const handleDelete = async () => {
                if (!soToDelete) return;
                setIsDeleting(true);
                const { error } = await supabase.from('sales_orders').delete().eq('id', soToDelete.id);

                if (error) {
                  toast({ variant: 'destructive', title: 'Gagal menghapus SO', description: error.message });
                } else {
                  toast({ title: 'Sales Order berhasil dihapus' });
                  refreshData();
                }
                setIsDeleting(false);
                setSoToDelete(null);
              };

              const handleFormFinished = () => {
                  setIsFormOpen(false);
                  refreshData();
              }
              
              const handleGenerateWOFinished = () => {
                setIsGenerateWOOpen(false);
                refreshData();
              };

              const handleSelectionChange = (soId) => {
                const newSelection = new Set(selectedSOs);
                if (newSelection.has(soId)) {
                  newSelection.delete(soId);
                } else {
                  newSelection.add(soId);
                }
                setSelectedSOs(newSelection);
              };
              
              const handleSelectAll = (isChecked) => {
                if (isChecked) {
                  setSelectedSOs(new Set(filteredSOs.filter(so => so.work_order_count === 0).map(so => so.id)));
                } else {
                  setSelectedSOs(new Set());
                }
              };

              const toggleRow = (id) => setExpandedRow(expandedRow === id ? null : id);

              const isAllSelected = filteredSOs.filter(so => so.work_order_count === 0).length > 0 && selectedSOs.size === filteredSOs.filter(so => so.work_order_count === 0).length;

              return (
                <>
                    <Card>
                      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                          <CardTitle>Sales Orders</CardTitle>
                          <p className="text-sm text-muted-foreground">Kelola pesanan penjualan dan buat Work Order (WO).</p>
                        </div>
                         <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                          <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Cari SO..."
                              className="pl-10"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                          <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Buat SO</Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {loading ? <p>Memuat...</p> : salesOrders.length === 0 ? (
                          <EmptyState icon={Package} title="Belum Ada Sales Order" description="Buat SO baru atau konversi dari quotation yang diterima." actionText="Buat SO Baru" onActionClick={() => setIsFormOpen(true)}/>
                        ) : filteredSOs.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-lg font-semibold">Data tidak ditemukan</p>
                                <p className="text-muted-foreground">Tidak ada Sales Order yang cocok.</p>
                            </div>
                        ) : (
                          <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[20px]"></TableHead>
                                    <TableHead>Sales Order</TableHead>
                                    <TableHead>Pelanggan</TableHead>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>WO Status</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSOs.map(so => {
                                    const hasWO = so.work_order_count > 0;
                                    return (
                                    <React.Fragment key={so.id}>
                                        <TableRow data-state={selectedSOs.has(so.id) && "selected"}>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => toggleRow(so.id)} disabled={!hasWO} title="Lihat Progress Produksi">
                                                  <Factory className={`h-4 w-4 ${hasWO ? 'text-blue-600' : 'text-gray-400'}`} />
                                                </Button>
                                            </TableCell>
                                            <TableCell className="font-medium">{so.so_number}</TableCell>
                                            <TableCell>{so.customer?.name}</TableCell>
                                            <TableCell>{formatDate(so.order_date)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(so.total_amount)}</TableCell>
                                            <TableCell><Badge className={`${statusConfig[so.status]?.color || 'bg-gray-200'}`}>{statusConfig[so.status]?.label || so.status}</Badge></TableCell>
                                            <TableCell>
                                                {hasWO ? <span className="flex items-center text-xs text-green-700 font-medium"><CheckCircle className="h-4 w-4 mr-1"/>WO Dibuat</span> : <span className="text-xs text-muted-foreground">Belum Dibuat</span>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {!hasWO && <Button variant="outline" size="sm" onClick={() => handleOpenGenerateWO(so)}>Buat WO</Button>}
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(so)}><Edit className="h-4 w-4" /></Button>
                                                {userRole === 'admin' && <Button variant="ghost" size="icon" onClick={() => setSoToDelete(so)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                                            </TableCell>
                                        </TableRow>
                                        {expandedRow === so.id && (
                                            <TableRow>
                                                <TableCell colSpan={8} className="p-0 bg-gray-100">
                                                    <ProductionProgressTab soId={so.id} />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                )})}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>{selectedSO?.id ? 'Edit' : 'Buat'} Sales Order</DialogTitle>
                          <DialogDescription>Isi detail pesanan penjualan.</DialogDescription>
                        </DialogHeader>
                        <SalesOrderForm salesOrder={selectedSO} onFinished={handleFormFinished} />
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isGenerateWOOpen} onOpenChange={setIsGenerateWOOpen}>
                        <DialogContent className="max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>Buat Work Order</DialogTitle>
                                <DialogDescription>
                                    {selectedSO ? `Membuat WO dari Sales Order ${selectedSO.so_number}.` : 'Membuat Work Order manual untuk produk kustom.'}
                                </DialogDescription>
                            </DialogHeader>
                            <GenerateWOForm onFinished={handleGenerateWOFinished} initialSO={selectedSO} />
                        </DialogContent>
                    </Dialog>
                    
                    <ConfirmationDialog
                        open={!!soToDelete}
                        onOpenChange={() => setSoToDelete(null)}
                        onConfirm={handleDelete}
                        title="Anda yakin ingin menghapus Sales Order ini?"
                        description="Tindakan ini akan menghapus data Sales Order dan semua item di dalamnya secara permanen."
                        isSubmitting={isDeleting}
                    />
                </>
            );
        }

        const SalesOrderPage = () => {
            return (
                <>
                    <Helmet>
                        <title>Penjualan - Sales</title>
                        <meta name="description" content="Kelola Sales Order (SO) dan Work Order (WO)." />
                    </Helmet>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">
                        <SalesOrderList />
                    </motion.div>
                </>
            )
        }

        const SalesOrderForm = ({ salesOrder, onFinished }) => {
              const { user } = useAuth();
              const { refreshData } = useData();
              const { toast } = useToast();
              const [formData, setFormData] = useState({
                id: salesOrder?.id || null,
                so_number: salesOrder?.so_number || '',
                customer_id: salesOrder?.customer_id || '',
                quotation_id: salesOrder?.quotation_id || null,
                order_date: salesOrder?.order_date || new Date().toISOString().split('T')[0],
                expected_delivery_date: salesOrder?.expected_delivery_date || null,
                notes: salesOrder?.notes || '',
                status: salesOrder?.status || 'pending',
              });
              const [items, setItems] = useState(salesOrder?.items || [{ product_id: null, description: '', specification: '', qty: 1, unit_price: 0 }]);
              const [loading, setLoading] = useState(false);
              
              const subtotal = useMemo(() => items.reduce((sum, item) => sum + ((item.qty || 0) * (item.unit_price || 0)), 0), [items]);
              const grandTotal = subtotal;

              const handleItemChange = (index, field, value) => {
                const newItems = [...items];
                newItems[index][field] = value;
                setItems(newItems);
              };

              const handleProductSelect = (product) => {
                  const newItem = {
                    product_id: product.id,
                    description: product.name,
                    specification: product.specification,
                    qty: 1,
                    unit_price: product.standard_price,
                  };
                  setItems([...items, newItem]);
              };

              const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

              const handleSubmit = async (e) => {
                e.preventDefault();
                if (!formData.customer_id) {
                  toast({ variant: 'destructive', title: 'Pelanggan harus dipilih' });
                  return;
                }
                setLoading(true);

                const soData = {
                  ...formData,
                  total_amount: grandTotal,
                  user_id: user.id,
                  created_by: salesOrder?.created_by || user.id,
                };
                
                if(!soData.id) {
                    delete soData.id;
                }

                const { data: upsertedSO, error: soError } = await supabase.from('sales_orders').upsert(soData).select().single();
                if (soError) {
                  toast({ variant: 'destructive', title: 'Gagal menyimpan Sales Order', description: soError.message });
                  setLoading(false);
                  return;
                }

                await supabase.from('sales_order_items').delete().eq('so_id', upsertedSO.id);
                const itemData = items.map(item => ({
                  so_id: upsertedSO.id,
                  product_id: item.product_id,
                  description: item.description,
                  specification: item.specification,
                  qty: item.qty,
                  unit_price: item.unit_price,
                  subtotal: item.qty * item.unit_price,
                }));
                
                const { error: itemsError } = await supabase.from('sales_order_items').insert(itemData);

                if (itemsError) {
                  toast({ variant: 'destructive', title: 'Gagal menyimpan item Sales Order', description: itemsError.message });
                } else {
                  toast({ title: `Sales Order berhasil ${salesOrder?.id ? 'diperbarui' : 'dibuat'}` });
                  await refreshData();
                  onFinished();
                }
                setLoading(false);
              };
              
              return (
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Pelanggan</Label>
                      <CustomerSelector selectedCustomerId={formData.customer_id} onCustomerSelect={(id) => setFormData({...formData, customer_id: id})} />
                    </div>
                    <div>
                      <Label>Nomor SO</Label>
                      <Input value={formData.so_number} onChange={(e) => setFormData({...formData, so_number: e.target.value})} required />
                    </div>
                    <div>
                      <Label>Tanggal Order</Label>
                      <Input type="date" value={formData.order_date} onChange={(e) => setFormData({...formData, order_date: e.target.value})} required />
                    </div>
                    <div>
                      <Label>Tanggal Kirim (Estimasi)</Label>
                      <Input type="date" value={formData.expected_delivery_date || ''} onChange={(e) => setFormData({...formData, expected_delivery_date: e.target.value})} />
                    </div>
                     <div className="md:col-span-2">
                        <Label htmlFor="status">Status</Label>
                        <select id="status" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full mt-1 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                            {Object.keys(statusConfig).map(key => (
                                <option key={key} value={key}>{statusConfig[key].label}</option>
                            ))}
                        </select>
                    </div>
                  </div>
                  
                  <Card>
                    <CardHeader><CardTitle>Item Order</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {items.map((item, index) => (
                         <div key={index} className="p-4 border rounded-lg space-y-3 relative">
                            <Button type="button" variant="destructive" size="icon" className="absolute -top-3 -right-3 h-7 w-7" onClick={() => removeItem(index)}><MinusCircle className="h-4 w-4" /></Button>
                            <Input placeholder="Nama Barang" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} required />
                            <Textarea placeholder="Spesifikasi Barang" value={item.specification || ''} onChange={(e) => handleItemChange(index, 'specification', e.target.value)} />
                            <div className="grid grid-cols-2 gap-2">
                                <Input type="number" placeholder="Qty" value={item.qty} onChange={(e) => handleItemChange(index, 'qty', e.target.value)} required />
                                <Input type="number" placeholder="Harga" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} required />
                            </div>
                        </div>
                      ))}
                       <ProductSelector onSelectProduct={handleProductSelect} isRawMaterialMode={false} />
                    </CardContent>
                  </Card>
                  
                  <div className="space-y-2">
                    <Label>Catatan</Label>
                    <Textarea value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-lg">Grand Total: {formatCurrency(grandTotal)}</p>
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan Sales Order'}</Button>
                  </DialogFooter>
                </form>
              );
            };

        export default SalesOrderPage;
