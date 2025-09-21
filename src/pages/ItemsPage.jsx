import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Plus, Edit, RefreshCw, Box, Search, Trash2, Save, Warehouse } from 'lucide-react';
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
import useDebounce from '@/hooks/useDebounce';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { RawMaterialItemForm } from '@/components/ItemForms';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

const UpdateStockDialog = ({ item, open, onOpenChange, onFinished }) => {
    const [newStock, setNewStock] = useState(0);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { warehouses } = useData();
    const { toast } = useToast();
    const { user } = useAuth();

    React.useEffect(() => {
        if(open){
            if (item?.stock_levels && item.stock_levels.length > 0) {
                const whId = selectedWarehouseId || warehouses[0]?.id;
                const stockLevel = item.stock_levels.find(sl => sl.warehouse_id === whId);
                setNewStock(stockLevel?.quantity || 0);
            } else {
                setNewStock(0);
            }
    
            if (warehouses && warehouses.length > 0 && !selectedWarehouseId) {
                setSelectedWarehouseId(warehouses[0].id);
            }
        }
    }, [item, open, warehouses, selectedWarehouseId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const stockValue = parseFloat(newStock);
        if (isNaN(stockValue) || stockValue < 0) {
            toast({ variant: 'destructive', title: 'Nilai stok tidak valid' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const warehouseIdToUpdate = selectedWarehouseId || warehouses?.[0]?.id;
            if (!warehouseIdToUpdate) {
                toast({ variant: 'destructive', title: 'Gudang tidak ditemukan', description: 'Silakan buat gudang terlebih dahulu di menu Inventory > Gudang.' });
                setIsSubmitting(false);
                return;
            }

            const { error } = await supabase.from('inventory_stock').upsert({
                item_id: item.id,
                warehouse_id: warehouseIdToUpdate,
                quantity: stockValue,
                user_id: user.id,
                last_updated_at: new Date().toISOString()
            }, { onConflict: 'item_id, warehouse_id' });

            if (error) throw error;
            
            toast({ title: 'Sukses', description: `Stok untuk ${item.name} berhasil diperbarui.` });
            onFinished();

        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal update stok', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Stok: {item.name}</DialogTitle>
                    <DialogDescription>Masukkan jumlah stok baru untuk barang ini.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                     {(warehouses || []).length === 0 ? (
                        <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm flex items-center gap-2">
                           <Warehouse className="h-4 w-4" />
                           <span>Tidak ada gudang ditemukan. Stok akan gagal diperbarui. Buat gudang terlebih dahulu.</span>
                        </div>
                    ) : (
                         <div className="space-y-2">
                            <Label htmlFor="warehouse">Gudang</Label>
                            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                                <SelectTrigger id="warehouse">
                                    <SelectValue placeholder="Pilih gudang..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(wh => (
                                        <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div>
                        <Label htmlFor="stock-quantity">Jumlah Stok Baru</Label>
                        <Input id="stock-quantity" type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)} min="0" required />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button type="submit" disabled={isSubmitting || (warehouses || []).length === 0}>{isSubmitting ? 'Menyimpan...' : <><Save className="mr-2 h-4 w-4" /> Simpan</>}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const ItemsPage = () => {
    const { items, itemCategories, loading, refreshData } = useData();
    const { user } = useAuth();
    const userRole = user?.user_metadata?.role;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [categoryFilter, setCategoryFilter] = useState('all');

    const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [itemToUpdateStock, setItemToUpdateStock] = useState(null);
    const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);

    const { toast } = useToast();
    
    const allItems = useMemo(() => {
        return items;
    }, [items]);

    const filteredItems = useMemo(() => {
      return (allItems || []).filter(item => {
        const searchMatch = item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                            (item.code && item.code.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
        const categoryMatch = categoryFilter === 'all' || item.category_id === categoryFilter;
        return searchMatch && categoryMatch;
      });
    }, [allItems, debouncedSearchTerm, categoryFilter]);
    
    const handleOpenDialog = (item = null) => {
      setEditingItem(item);
      setIsDialogOpen(true);
    };

    const handleOpenStockDialog = (item) => {
        setItemToUpdateStock(item);
        setIsStockDialogOpen(true);
    };
    
    const handleDeleteClick = (itemsToDelete) => {
      setSelectedItems(Array.isArray(itemsToDelete) ? itemsToDelete : [itemsToDelete]);
      setIsConfirmDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (selectedItems.length === 0) return;
        setIsSubmitting(true);
        
        const itemIds = selectedItems.map(item => item.id);
        const { error } = await supabase
            .from('items')
            .update({ is_deleted: true })
            .in('id', itemIds);
        
        if (error) {
            toast({ variant: 'destructive', title: `Gagal menghapus ${selectedItems.length} barang`, description: error.message });
        } else {
            toast({ title: 'Sukses', description: `${selectedItems.length} barang berhasil dihapus.` });
        }

        setSelectedItems([]);
        setIsConfirmDeleteDialogOpen(false);
        setIsSubmitting(false);
        await refreshData();
    };
    
    const onFormFinished = () => {
      setIsDialogOpen(false);
      setEditingItem(null);
      refreshData();
    };

    const onStockUpdateFinished = () => {
        setIsStockDialogOpen(false);
        setItemToUpdateStock(null);
        refreshData();
    };
    
    const handleSelectAll = (checked) => {
      setSelectedItems(checked ? filteredItems.map(item => item) : []);
    };

    const handleSelectItem = (item, checked) => {
      setSelectedItems(prev => 
        checked ? [...prev, item] : prev.filter(i => i.id !== item.id)
      );
    };

    const isAllSelected = selectedItems.length > 0 && selectedItems.length === filteredItems.length;

    const materialCategories = useMemo(() => itemCategories.filter(cat => !["Barang Jadi", "Setengah Jadi"].includes(cat.name)), [itemCategories]);

    const canManage = userRole === 'admin' || userRole === 'inventory' || userRole === 'engineering';

    return (
      <>
        <Helmet><title>Master Barang - Inventory</title></Helmet>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div><h1 className="text-2xl font-bold">Master Barang</h1><p className="text-gray-500">Daftar semua bahan baku dan barang non-produk.</p></div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
              {canManage && <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />Tambah Barang</Button>}
            </div>
          </div>
          
          <Card>
              <CardHeader>
                  <CardTitle>Daftar Barang</CardTitle>
                  <CardDescription>Cari dan kelola master barang Anda.</CardDescription>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div className="relative md:col-span-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                          <Input placeholder="Cari barang (nama atau kode)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                      </div>
                       <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                          <SelectTrigger><SelectValue placeholder="Filter kategori" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Semua Kategori</SelectItem>
                              {materialCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                   </div>
                   {selectedItems.length > 0 && canManage && (
                    <div className="mt-4">
                      <Button variant="destructive" onClick={() => handleDeleteClick(selectedItems)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Hapus {selectedItems.length} Barang Terpilih
                      </Button>
                    </div>
                  )}
              </CardHeader>
              <CardContent>
                  {loading ? <p>Memuat...</p> : 
                  filteredItems.length === 0 ? <EmptyState icon={Box} title="Barang Tidak Ditemukan" description="Tidak ada bahan baku yang cocok. Coba buat barang baru." actionText={canManage ? "Tambah Barang" : undefined} onActionClick={canManage ? () => handleOpenDialog() : undefined} /> :
                  (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              {canManage && <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} aria-label="Select all" />}
                            </TableHead>
                            <TableHead>Nama Barang</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Total Stok</TableHead>
                            <TableHead className="text-right">Harga Beli Standar</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.map(item => (
                            <TableRow key={item.id} data-state={selectedItems.some(i => i.id === item.id) && "selected"}>
                              <TableCell>
                                {canManage && <Checkbox checked={selectedItems.some(i => i.id === item.id)} onCheckedChange={(checked) => handleSelectItem(item, checked)} aria-label={`Select ${item.name}`} />}
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold">{item.name}</div>
                                <div className="text-xs text-muted-foreground">{item.code}</div>
                              </TableCell>
                              <TableCell>{item.item_category?.name || 'N/A'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{item.total_stock ?? 0} {item.unit}</span>
                                  {canManage && <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleOpenStockDialog(item)}><Edit className="h-3 w-3"/></Button>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium text-red-600">{formatCurrency(item.standard_cost)}</TableCell>
                              <TableCell className="text-right">
                                {canManage && (
                                  <div className="flex items-center justify-end">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(item)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </CardContent>
          </Card>
        </div>

        {canManage && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                  <DialogTitle>
                      {editingItem ? `Edit Barang` : `Tambah Barang Baru`}
                  </DialogTitle>
              </DialogHeader>
              <RawMaterialItemForm item={editingItem} onFinished={onFormFinished} />
            </DialogContent>
          </Dialog>
        )}

        <UpdateStockDialog
            item={itemToUpdateStock}
            open={isStockDialogOpen}
            onOpenChange={setIsStockDialogOpen}
            onFinished={onStockUpdateFinished}
        />

        <ConfirmationDialog 
            open={isConfirmDeleteDialogOpen}
            onOpenChange={setIsConfirmDeleteDialogOpen}
            onConfirm={handleDelete}
            isSubmitting={isSubmitting}
            title={`Yakin ingin menghapus ${selectedItems.length} barang terpilih?`}
            description="Aksi ini tidak akan menghapus data secara permanen, melainkan menyembunyikannya dari daftar. Anda dapat memulihkannya melalui database."
            confirmText={`Ya, Hapus ${selectedItems.length} Barang`}
        />
      </>
    );
};

export default ItemsPage;