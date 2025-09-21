import React, { useState, useMemo } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Plus, Edit, Trash2, RefreshCw, Users, Search } from 'lucide-react';
    import { useData } from '@/contexts/DataContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import EmptyState from '@/components/EmptyState';
    import useDebounce from '@/hooks/useDebounce';

    const SupplierForm = ({ supplier, onSave, onCancel, isSubmitting }) => {
        const { user } = useAuth();
        const defaultFormState = { name: '', contact_person: '', phone: '', email: '', address: '' };
        const [formData, setFormData] = useState(supplier ? { ...defaultFormState, ...supplier } : defaultFormState);

        const handleSubmit = (e) => {
            e.preventDefault();
            onSave({
                id: supplier?.id,
                user_id: user.id,
                ...formData,
            });
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nama Supplier</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Contact Person</Label><Input value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Telepon</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                <div className="space-y-2"><Label>Alamat</Label><Textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
                </DialogFooter>
            </form>
        );
    }

    const SuppliersPage = ({ isDialogMode = false, onSupplierCreated }) => {
      const { suppliers, loading, refreshData } = useData();
      const { user } = useAuth();
      const userRole = user?.user_metadata?.role;
      const { toast } = useToast();
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [editingSupplier, setEditingSupplier] = useState(null);
      const [searchTerm, setSearchTerm] = useState('');
      const debouncedSearchTerm = useDebounce(searchTerm, 300);

      const canManage = useMemo(() => userRole === 'admin' || userRole === 'inventory' || userRole === 'finance', [userRole]);

      const filteredSuppliers = useMemo(() => {
        return suppliers.filter(supplier => 
            supplier.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            (supplier.contact_person && supplier.contact_person.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
        );
      }, [suppliers, debouncedSearchTerm]);
      
      const handleOpenDialog = (supplier = null) => {
        if (!canManage) return;
        setEditingSupplier(supplier);
        setIsDialogOpen(true);
      };
      
      const handleSave = async (formData) => {
        if (!canManage) return;
        setIsSubmitting(true);
        try {
          const { data, error } = await supabase.from('suppliers').upsert(formData).select().single();
          if (error) throw error;
          toast({ title: 'Sukses!', description: `Supplier "${formData.name}" berhasil disimpan.` });
          await refreshData();
          setIsDialogOpen(false);
          if (onSupplierCreated) onSupplierCreated(data);
        } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
        } finally {
          setIsSubmitting(false);
        }
      };

      const handleDelete = async (supplierId) => {
        if (!canManage) return;
        try {
          const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
          if (error) throw error;
          toast({ title: 'Supplier dihapus', description: 'Data supplier berhasil dihapus.' });
          await refreshData();
        } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
        }
      };
      
      if (isDialogMode) {
          return <SupplierForm 
              onSave={handleSave} 
              onCancel={() => { if(onSupplierCreated) onSupplierCreated(null); }}
              isSubmitting={isSubmitting}
          />;
      }

      return (
        <>
          <Helmet>
            <title>Supplier - Inventory</title>
            <meta name="description" content="Kelola data supplier." />
          </Helmet>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div><h1 className="text-2xl font-bold">Manajemen Supplier</h1><p className="text-gray-500">Tambah, edit, dan kelola semua supplier Anda.</p></div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
                {canManage && <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />Tambah Supplier</Button>}
              </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Supplier</CardTitle>
                    <CardDescription>Cari dan kelola supplier Anda.</CardDescription>
                    <div className="relative pt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input 
                            placeholder="Cari supplier..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <p>Memuat...</p> : 
                    filteredSuppliers.length === 0 ? 
                    <EmptyState 
                        icon={Users}
                        title="Belum Ada Supplier"
                        description="Anda belum memiliki data supplier. Tambahkan supplier pertama untuk memulai proses pembelian."
                        actionText={canManage ? "Tambah Supplier" : null}
                        onActionClick={canManage ? () => handleOpenDialog() : null}
                    /> : 
                    (
                        <div className="space-y-4">
                        {filteredSuppliers.map(supplier => (
                            <motion.div key={supplier.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center p-4 border rounded-lg">
                            <div>
                                <p className="font-bold">{supplier.name}</p>
                                <p className="text-sm text-gray-500">{supplier.contact_person || 'N/A'} - {supplier.phone || 'N/A'}</p>
                            </div>
                            {canManage && (
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(supplier)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Ini akan menghapus supplier secara permanen.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(supplier.id)} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            )}
                            </motion.div>
                        ))}
                        </div>
                    )}
                </CardContent>
            </Card>

          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSupplier ? 'Edit' : 'Tambah'} Supplier</DialogTitle>
                <DialogDescription>Isi detail supplier di bawah ini.</DialogDescription>
              </DialogHeader>
              <SupplierForm 
                supplier={editingSupplier}
                onSave={handleSave}
                onCancel={() => setIsDialogOpen(false)}
                isSubmitting={isSubmitting}
              />
            </DialogContent>
          </Dialog>
        </>
      );
    };

    export default SuppliersPage;