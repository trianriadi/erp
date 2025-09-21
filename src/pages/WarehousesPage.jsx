import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, RefreshCw, Warehouse } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import EmptyState from '@/components/EmptyState';
import ConfirmationDialog from '@/components/ConfirmationDialog';

const WarehousesPage = () => {
  const { user } = useAuth();
  const { warehouses, loading, refreshData } = useData();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);

  const defaultFormState = { name: '', location: '' };
  const [formData, setFormData] = useState(defaultFormState);
  
  const [warehouseToDelete, setWarehouseToDelete] = useState(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const resetForm = () => {
    setEditingWarehouse(null);
    setFormData(defaultFormState);
  };

  const handleOpenForm = (warehouse = null) => {
    if (warehouse) {
      setEditingWarehouse(warehouse);
      setFormData({ name: warehouse.name, location: warehouse.location });
    } else {
      resetForm();
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!formData.name) {
      toast({ variant: 'destructive', title: 'Nama gudang wajib diisi.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const upsertData = {
        id: editingWarehouse?.id,
        name: formData.name,
        location: formData.location,
        user_id: user.id
      };
      
      if (!upsertData.id) {
          delete upsertData.id;
      }
      
      const { error } = await supabase.from('warehouses').upsert(upsertData);

      if (error) throw error;

      toast({ title: 'Sukses!', description: 'Gudang berhasil disimpan.' });
      await refreshData();
      setIsFormOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan gudang', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const confirmDelete = (warehouse) => {
    setWarehouseToDelete(warehouse);
    setIsConfirmDeleteOpen(true);
  };
  
  const handleDelete = async () => {
    if(!warehouseToDelete) return;
    // Check if warehouse has stock
    const { data, error: stockError } = await supabase
        .from('inventory_stock')
        .select('id', { count: 'exact' })
        .eq('warehouse_id', warehouseToDelete.id)
        .limit(1);
        
    if(stockError){
        toast({ variant: "destructive", title: "Gagal Memeriksa Stok", description: stockError.message});
        setIsConfirmDeleteOpen(false);
        return;
    }
        
    if(data && data.length > 0) {
        toast({ variant: "destructive", title: "Gagal Hapus", description: "Gudang tidak dapat dihapus karena masih memiliki stok."});
        setIsConfirmDeleteOpen(false);
        return;
    }

    const { error } = await supabase.from('warehouses').delete().eq('id', warehouseToDelete.id);
    if (error) {
        toast({ variant: 'destructive', title: 'Gagal menghapus gudang', description: error.message });
    } else {
        toast({ title: 'Sukses', description: `Gudang "${warehouseToDelete.name}" berhasil dihapus.` });
        await refreshData();
    }
    setIsConfirmDeleteOpen(false);
  }

  return (
    <>
      <Helmet><title>Manajemen Gudang - Inventory</title></Helmet>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Manajemen Gudang</h1>
            <p className="text-gray-500">Kelola daftar gudang untuk penyimpanan stok.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => handleOpenForm()}>
              <Plus className="h-4 w-4 mr-2" />Tambah Gudang
            </Button>
          </div>
        </div>

        {loading ? (
          <p>Memuat...</p>
        ) : !warehouses || warehouses.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Belum Ada Gudang"
            description="Anda belum memiliki gudang. Tambahkan gudang pertama Anda untuk mulai mengelola stok."
            actionText="Tambah Gudang"
            onActionClick={() => handleOpenForm()}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Daftar Gudang</CardTitle>
              <CardDescription>Total {warehouses.length} gudang terdaftar.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Nama Gudang</th>
                      <th className="p-2 text-left">Lokasi</th>
                      <th className="p-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouses.map((warehouse, index) => (
                      <motion.tr
                        key={warehouse.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="p-2 font-semibold">{warehouse.name}</td>
                        <td className="p-2">{warehouse.location || '-'}</td>
                        <td className="p-2 text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenForm(warehouse)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => confirmDelete(warehouse)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? 'Edit Gudang' : 'Tambah Gudang Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Gudang</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Lokasi</Label>
              <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <ConfirmationDialog
        open={isConfirmDeleteOpen}
        onOpenChange={setIsConfirmDeleteOpen}
        onConfirm={handleDelete}
        title="Yakin Hapus Gudang?"
        description={`Gudang "${warehouseToDelete?.name}" akan dihapus permanen. Aksi ini tidak dapat dilakukan jika gudang masih memiliki stok.`}
        confirmText="Ya, Hapus"
      />
    </>
  );
};

export default WarehousesPage;