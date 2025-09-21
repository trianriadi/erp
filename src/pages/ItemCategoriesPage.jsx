import React, { useState, useMemo } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Plus, Edit, Trash2, RefreshCw, Folder } from 'lucide-react';
    import { useData } from '@/contexts/DataContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import EmptyState from '@/components/EmptyState';

    const ItemCategoriesPage = () => {
      const { itemCategories, loading, refreshData } = useData();
      const { user } = useAuth();
      const userRole = user?.user_metadata?.role;
      const { toast } = useToast();
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [editingCategory, setEditingCategory] = useState(null);

      const defaultFormState = { name: '' };
      const [formData, setFormData] = useState(defaultFormState);
      
      const canManage = userRole === 'admin' || userRole === 'inventory';
      
      const visibleCategories = useMemo(() => {
          return itemCategories.filter(cat => cat.name !== 'Bahan Baku Manual');
      }, [itemCategories]);

      const resetForm = () => {
        setEditingCategory(null);
        setFormData(defaultFormState);
      };

      const handleOpenDialog = (category = null) => {
        if (!canManage) return;
        if (category) {
          setEditingCategory(category);
          setFormData({ name: category.name });
        } else {
          resetForm();
        }
        setIsDialogOpen(true);
      };
      
      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast({ variant: 'destructive', title: 'Nama tidak boleh kosong' });
            return;
        }
        setIsSubmitting(true);
        try {
          const { error } = await supabase.from('item_categories').upsert({
            id: editingCategory?.id,
            user_id: user.id,
            name: formData.name,
          });
          if (error) throw error;
          toast({ title: 'Sukses!', description: `Kategori "${formData.name}" berhasil disimpan.` });
          await refreshData();
          setIsDialogOpen(false);
        } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
        } finally {
          setIsSubmitting(false);
        }
      };

      const handleDelete = async (categoryId) => {
        if (!canManage) return;
        try {
          const { data: items, error: itemsError } = await supabase
            .from('items')
            .select('id')
            .eq('category_id', categoryId)
            .limit(1);

          if (itemsError) throw itemsError;

          if (items.length > 0) {
            toast({
              variant: 'destructive',
              title: 'Gagal menghapus',
              description: 'Kategori ini masih digunakan oleh beberapa barang. Hapus atau pindahkan barang tersebut terlebih dahulu.',
            });
            return;
          }

          const { error } = await supabase.from('item_categories').delete().eq('id', categoryId);
          if (error) throw error;
          toast({ title: 'Kategori dihapus', description: 'Kategori barang berhasil dihapus.' });
          await refreshData();
        } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
        }
      };

      return (
        <>
          <Helmet>
            <title>Kategori Barang - Inventory</title>
          </Helmet>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div><h1 className="text-2xl font-bold">Kategori Barang</h1><p className="text-gray-500">Kelola kategori untuk pengelompokan barang.</p></div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
                  <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />Tambah Kategori</Button>
                </div>
              )}
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Kategori</CardTitle>
                    <CardDescription>Total {visibleCategories.length} kategori.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <p>Memuat...</p> : 
                    !visibleCategories || visibleCategories.length === 0 ? 
                    <EmptyState 
                        icon={Folder}
                        title="Belum Ada Kategori"
                        description="Buat kategori untuk mengelompokkan barang-barang Anda, seperti 'Bahan Baku' atau 'Barang Jadi'."
                        actionText={canManage ? "Tambah Kategori" : undefined}
                        onActionClick={canManage ? () => handleOpenDialog() : undefined}
                    /> : 
                    (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visibleCategories.map(category => (
                            <motion.div key={category.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                              <Card className="flex justify-between items-center p-4">
                                <div>
                                    <p className="font-bold text-lg">{category.name}</p>
                                </div>
                                {canManage && (
                                  <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(category)}><Edit className="h-4 w-4" /></Button>
                                      <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                              <AlertDialogHeader><AlertDialogTitle>Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Pastikan tidak ada barang yang menggunakan kategori ini sebelum menghapusnya.</AlertDialogDescription></AlertDialogHeader>
                                              <AlertDialogFooter>
                                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                                  <AlertDialogAction onClick={() => handleDelete(category.id)} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
                                              </AlertDialogFooter>
                                          </AlertDialogContent>
                                      </AlertDialog>
                                  </div>
                                )}
                              </Card>
                            </motion.div>
                        ))}
                        </div>
                    )}
                </CardContent>
            </Card>
          </div>

          {canManage && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? 'Edit' : 'Tambah'} Kategori</DialogTitle>
                  <DialogDescription>Isi nama kategori di bawah ini.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="category-name">Nama Kategori</Label>
                    <Input id="category-name" value={formData.name} onChange={e => setFormData({name: e.target.value})} required />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </>
      );
    };

    export default ItemCategoriesPage;