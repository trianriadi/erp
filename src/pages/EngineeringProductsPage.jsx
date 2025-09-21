import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Plus, Edit, RefreshCw, Package, Search, ChevronDown, Download, Trash2, Save, Warehouse } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import EmptyState from '@/components/EmptyState';
import useDebounce from '@/hooks/useDebounce';
import { ProductItemForm } from '@/components/ItemForms';
import { useNavigate } from 'react-router-dom';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { supabase } from '@/lib/customSupabaseClient';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
const BOM_ENABLED_CATEGORIES = ["Barang Jadi", "Setengah Jadi"];

const UpdateStockDialog = ({ product, open, onOpenChange, onFinished }) => {
    const [newStock, setNewStock] = useState(0);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { warehouses } = useData();
    const { toast } = useToast();
    const { user } = useAuth();

    React.useEffect(() => {
        if (open) {
            if (product?.stock_levels && product.stock_levels.length > 0) {
                const whId = selectedWarehouseId || warehouses[0]?.id;
                const stockLevel = product.stock_levels.find(sl => sl.warehouse_id === whId);
                setNewStock(stockLevel?.quantity || 0);
            } else {
                setNewStock(0);
            }
    
            if (warehouses && warehouses.length > 0 && !selectedWarehouseId) {
                setSelectedWarehouseId(warehouses[0].id);
            }
        }
    }, [product, open, warehouses, selectedWarehouseId]);

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
                product_id: product.id,
                warehouse_id: warehouseIdToUpdate,
                quantity: stockValue,
                user_id: user.id,
                last_updated_at: new Date().toISOString()
            }, { onConflict: 'product_id, warehouse_id' });

            if (error) throw error;
            
            toast({ title: 'Sukses', description: `Stok untuk ${product.name} berhasil diperbarui.` });
            onFinished();

        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal update stok', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!product) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Stok: {product.name}</DialogTitle>
                    <DialogDescription>Masukkan jumlah stok baru untuk produk ini.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                     {warehouses.length === 0 ? (
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
                        <Button type="submit" disabled={isSubmitting || warehouses.length === 0}>{isSubmitting ? 'Menyimpan...' : <><Save className="mr-2 h-4 w-4" /> Simpan</>}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const EngineeringProductsPage = () => {
    const { user } = useAuth();
    const userRole = user?.user_metadata?.role;
    const { products, loading, refreshData } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [expandedRows, setExpandedRows] = useState({});
    
    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productToUpdateStock, setProductToUpdateStock] = useState(null);
    const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
    
    const navigate = useNavigate();
    const { toast } = useToast();

    const canManage = ['admin', 'engineering'].includes(userRole);
    const canManageStock = ['admin', 'inventory', 'production', 'engineering'].includes(userRole);

    const relevantProducts = useMemo(() => {
        return (products || []).filter(item => item.category_name && BOM_ENABLED_CATEGORIES.includes(item.category_name));
    }, [products]);

    const filteredData = useMemo(() => {
        if (!relevantProducts) return [];
        return relevantProducts.filter(item => {
            const term = debouncedSearchTerm.toLowerCase();
            return (
                item.name.toLowerCase().includes(term) ||
                (item.code && item.code.toLowerCase().includes(term)) ||
                (item.model_no && item.model_no.toLowerCase().includes(term)) ||
                (item.category_name && item.category_name.toLowerCase().includes(term))
            );
        });
    }, [relevantProducts, debouncedSearchTerm]);

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };
    
    const handleOpenItemDialog = (item = null) => {
        setEditingItem(item);
        setIsItemDialogOpen(true);
    };

    const handleOpenStockDialog = (product) => {
        setProductToUpdateStock(product);
        setIsStockDialogOpen(true);
    };

    const onStockUpdateFinished = () => {
        setIsStockDialogOpen(false);
        setProductToUpdateStock(null);
        refreshData();
    };

    const onItemFormFinished = () => {
        setIsItemDialogOpen(false);
        setEditingItem(null);
        refreshData();
    };

    const handleDeleteClick = (items) => {
        setSelectedItems(Array.isArray(items) ? items : [items]);
        setIsConfirmOpen(true);
    };
    
    const handleDeleteConfirm = async () => {
        if (selectedItems.length === 0) return;
        setIsSubmitting(true);
        
        let successCount = 0;
        let errorCount = 0;
        let errorMessages = [];

        for (const item of selectedItems) {
            const { data, error } = await supabase.rpc('soft_delete_product', { p_product_id: item.id });
            if (error) {
                errorCount++;
                errorMessages.push(`Gagal hapus ${item.name}: ${error.message}`);
            } else if (data && data.startsWith('Gagal')) {
                errorCount++;
                errorMessages.push(data);
            } else {
                successCount++;
            }
        }
        
        if (successCount > 0) {
            toast({ title: 'Sukses', description: `${successCount} produk berhasil dihapus.` });
        }
        if (errorCount > 0) {
            toast({ variant: 'destructive', title: `Gagal menghapus ${errorCount} produk`, description: errorMessages.join('; ') });
        }

        setIsConfirmOpen(false);
        setSelectedItems([]);
        setIsSubmitting(false);
        await refreshData();
    };
    
    const handleBomAction = (product, bomId = null) => {
        if (bomId) {
            navigate(`/engineering/boms?edit=${bomId}`);
        } else {
            navigate(`/engineering/boms?create=new&productId=${product.id}`);
        }
    };

    const getBomTotalCost = (bom) => {
      if (!bom || !bom.bom_items) return 0;
      return bom.bom_items.reduce((total, bomItem) => {
          const itemCost = bomItem.item?.standard_cost || 0;
          const quantity = bomItem.quantity_required || 0;
          return total + (itemCost * quantity);
      }, 0);
    };
    
    const handleSelectAll = (checked) => {
      setSelectedItems(checked ? filteredData.map(item => item) : []);
    };

    const handleSelectItem = (item, checked) => {
      setSelectedItems(prev => 
        checked ? [...prev, item] : prev.filter(i => i.id !== item.id)
      );
    };

    const isAllSelected = selectedItems.length > 0 && selectedItems.length === filteredData.length;

    return (
        <>
            <Helmet>
                <title>Produk - Engineering</title>
            </Helmet>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Manajemen Produk</h1>
                        <p className="text-gray-500">Kelola produk jadi & setengah jadi, dan tautkan ke BOM.</p>
                    </div>
                     <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
                        {canManage && <Button onClick={() => handleOpenItemDialog()}><Plus className="h-4 w-4 mr-2" />Tambah Produk</Button>}
                    </div>
                </div>

                <Card>
                    <CardHeader>
                         <div className="flex justify-between items-center gap-4">
                             <div className="flex-1">
                                <CardTitle>Daftar Produk Manufaktur</CardTitle>
                                <CardDescription>Cari dan kelola produk Anda.</CardDescription>
                             </div>
                             <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Cari produk..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        {selectedItems.length > 0 && canManage && (
                            <div className="mt-4">
                                <Button variant="destructive" onClick={() => handleDeleteClick(selectedItems)}>
                                    <Trash2 className="h-4 w-4 mr-2"/> Hapus {selectedItems.length} Produk Terpilih
                                </Button>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        {loading ? <p>Memuat...</p> : 
                        filteredData.length === 0 ? <EmptyState icon={Package} title="Produk Tidak Ditemukan" description="Tidak ada produk manufaktur yang cocok. Coba buat produk baru." actionText={canManage ? 'Tambah Produk' : undefined} onActionClick={canManage ? () => handleOpenItemDialog() : undefined} /> :
                        (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-10">
                                              {canManage && <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />}
                                            </TableHead>
                                            <TableHead className="w-10"></TableHead>
                                            <TableHead>Produk</TableHead>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead>Total Stok</TableHead>
                                            <TableHead className="text-right">Harga Jual</TableHead>
                                            <TableHead className="text-right">HPP Manual</TableHead>
                                            <TableHead className="text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {filteredData.map(item => {
                                        return (
                                        <React.Fragment key={item.id}>
                                            <TableRow className="hover:bg-muted/50">
                                                <TableCell>
                                                  {canManage && <Checkbox checked={selectedItems.some(i => i.id === item.id)} onCheckedChange={(checked) => handleSelectItem(item, checked)} />}
                                                </TableCell>
                                                <TableCell className="p-2 text-center">
                                                    {(item.bill_of_materials?.length || 0) > 0 && (
                                                        <Button variant="ghost" size="icon" onClick={() => toggleRow(item.id)}>
                                                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedRows[item.id] ? 'rotate-180' : ''}`} />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                      {item.image_url ? (
                                                        <img src={item.image_url} alt={item.name} className="h-10 w-10 object-cover rounded-md" />
                                                      ) : (
                                                        <div className="h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                                                            <Package className="h-5 w-5 text-gray-400"/>
                                                        </div>
                                                      )}
                                                      <div>
                                                          <p className="font-semibold">{item.name}</p>
                                                          <p className="text-xs text-muted-foreground">{item.model_no || item.code}</p>
                                                      </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.category_name || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{item.total_stock ?? 0} {item.unit}</span>
                                                        {canManageStock && <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleOpenStockDialog(item)}><Edit className="h-3 w-3" /></Button>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-green-600">{formatCurrency(item.standard_price)}</TableCell>
                                                <TableCell className="text-right font-medium text-red-600">{formatCurrency(item.standard_cost)}</TableCell>
                                                <TableCell className="text-right">
                                                    {canManage && (
                                                        <div className="flex items-center justify-end">
                                                            <Button variant="ghost" size="sm" onClick={() => handleBomAction(item)}><Plus className="h-4 w-4 mr-1"/>BOM Baru</Button>
                                                            {item.drawing_url && (
                                                              <a href={item.drawing_url} target="_blank" rel="noopener noreferrer">
                                                                <Button variant="ghost" size="icon"><Download className="h-4 w-4"/></Button>
                                                              </a>
                                                            )}
                                                            <Button variant="ghost" size="icon" onClick={() => handleOpenItemDialog(item)}><Edit className="h-4 w-4" /></Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(item)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {expandedRows[item.id] && item.bill_of_materials && item.bill_of_materials.length > 0 && (
                                                <TableRow className="bg-gray-50">
                                                    <TableCell colSpan="8" className="p-4">
                                                        <Card className="bg-white">
                                                            <CardHeader><CardTitle>Daftar BOM untuk {item.name}</CardTitle></CardHeader>
                                                            <CardContent>
                                                                <ul className="space-y-2">
                                                                {item.bill_of_materials.map(bom => {
                                                                    const bomTotalCost = getBomTotalCost(bom);
                                                                    return (
                                                                    <li key={bom.id} className="flex justify-between items-center py-2 px-3 border rounded-md">
                                                                        <div>
                                                                            <span className="font-semibold">{bom.name}</span>
                                                                            <p className="text-xs text-muted-foreground">Total Biaya Komponen: {formatCurrency(bomTotalCost)}</p>
                                                                        </div>
                                                                        <Button variant="outline" size="sm" onClick={() => handleBomAction(item, bom.id)}><Edit className="h-3 w-3 mr-1"/>Edit BOM</Button>
                                                                    </li>
                                                                )})}
                                                                </ul>
                                                            </CardContent>
                                                        </Card>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    )})}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            {canManage && (
                <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'Tambah'} Produk</DialogTitle></DialogHeader>
                      <ProductItemForm item={editingItem} onFinished={onItemFormFinished} />
                    </DialogContent>
                </Dialog>
            )}

            <UpdateStockDialog 
                product={productToUpdateStock}
                open={isStockDialogOpen}
                onOpenChange={setIsStockDialogOpen}
                onFinished={onStockUpdateFinished}
            />

            <ConfirmationDialog 
              open={isConfirmOpen}
              onOpenChange={setIsConfirmOpen}
              onConfirm={handleDeleteConfirm}
              title={`Yakin ingin menghapus ${selectedItems.length} produk terpilih?`}
              description="Aksi ini tidak akan menghapus data secara permanen, melainkan menyembunyikannya dari daftar. Produk yang masih terpakai di BOM aktif tidak akan dihapus."
              confirmText={`Ya, Hapus ${selectedItems.length} Produk`}
              isSubmitting={isSubmitting}
            />
        </>
    );
};

export default EngineeringProductsPage;