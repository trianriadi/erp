import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Plus, Edit, Trash2, Shield, User, Eye, RefreshCw, Briefcase, Factory, HardHat, Package, Landmark } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/customSupabaseClient';
import EmptyState from '@/components/EmptyState';

const roleConfig = {
  admin: { icon: Shield, color: 'text-red-600', label: 'Admin' },
  finance: { icon: Landmark, color: 'text-blue-600', label: 'Finance' },
  sales: { icon: Briefcase, color: 'text-purple-600', label: 'Sales' },
  inventory: { icon: Package, color: 'text-green-600', label: 'Inventory' },
  manufacture: { icon: Factory, color: 'text-orange-600', label: 'Production' },
  engineering: { icon: HardHat, color: 'text-slate-600', label: 'Engineering' },
  viewer: { icon: Eye, color: 'text-gray-500', label: 'Viewer' },
};

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const { users, loading, refreshData } = useData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ full_name: '', email: '', role: 'viewer', password: '' });

  const resetForm = () => {
    setFormData({ full_name: '', email: '', role: 'viewer', password: '' });
    setEditingUser(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email || !formData.role) {
        toast({ title: 'Error', description: 'Harap isi semua field yang wajib diisi.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);

    try {
        if (editingUser) {
            const { error: updateAuthError } = await supabase.functions.invoke('update-user-by-admin', {
                body: { 
                    userId: editingUser.id,
                    metadata: { 
                        name: formData.full_name,
                        role: formData.role 
                    },
                    ...(formData.password && { password: formData.password })
                },
            });

            if (updateAuthError) throw new Error(updateAuthError.message);

            toast({ title: 'Sukses', description: 'Pengguna berhasil diperbarui' });
        } else {
            const { error: createError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.full_name,
                        role: formData.role,
                    }
                }
            });
            if (createError) throw createError;
            
            toast({ title: 'Sukses', description: 'Pengguna berhasil dibuat. Cek email untuk konfirmasi.' });
        }
        await refreshData();
        resetForm();
        setIsDialogOpen(false);
    } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({ full_name: user.full_name || '', email: user.email, role: user.role || 'viewer', password: '' });
    setIsDialogOpen(true);
  };

  const handleDelete = async (userId) => {
    try {
        const { error } = await supabase.functions.invoke('delete-user-by-admin', {
            body: { userId },
        });

        if (error) throw new Error(error.message);
        
        toast({ title: 'Sukses', description: 'Pengguna berhasil dihapus' });
        await refreshData();
    } catch (error) {
        toast({ title: 'Error', description: `Gagal menghapus pengguna: ${error.message}`, variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet><title>Pengguna - Sistem Keuangan</title></Helmet>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold">Manajemen Pengguna</h1><p className="text-gray-500">Kelola semua pengguna sistem</p></div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
              <Button onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Tambah Pengguna</Button>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingUser ? 'Edit' : 'Tambah'} Pengguna</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2"><Label>Nama Lengkap</Label><Input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required/></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!!editingUser} required/></div>
                  <div className="space-y-2"><Label>Role</Label>
                    <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}><SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{Object.entries(roleConfig).map(([key, {label}]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Password {editingUser && "(Kosongkan jika tidak diubah)"}</Label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingUser}/></div>
                  <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button></div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? <p className="text-center py-10">Memuat pengguna...</p> : 
         !users || users.length === 0 ? <EmptyState icon={User} title="Belum Ada Pengguna" description="Tidak ada pengguna lain yang ditemukan. Tambahkan pengguna baru untuk mulai berkolaborasi." actionText="Tambah Pengguna Baru" onActionClick={() => setIsDialogOpen(true)} /> :
         (<Card>
          <CardHeader><CardTitle>Daftar Pengguna</CardTitle><CardDescription>Total {users.length} pengguna terdaftar</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map((user, index) => {
                const userRoleData = roleConfig[user.role] || roleConfig.viewer;
                const Icon = userRoleData.icon;
                return(
                  <motion.div key={user.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center space-x-4">
                      <Avatar><AvatarFallback>{user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback></Avatar>
                      <div><h4 className="font-medium">{user.full_name || 'Tanpa Nama'}</h4><p className="text-sm text-gray-500">{user.email}</p></div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`flex items-center gap-1.5 font-medium ${userRoleData.color}`}><Icon className="h-4 w-4"/> {userRoleData.label}</span>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(user)}><Edit className="h-3 w-3" /></Button>
                        {currentUser.id !== user.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="text-red-500 hover:text-red-600"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Anda yakin?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Ini akan menghapus pengguna secara permanen dari sistem.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(user.id)} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )})}
            </div>
          </CardContent>
        </Card>)}
      </div>
    </>
  );
};
export default UsersPage;