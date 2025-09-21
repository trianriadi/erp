import React, { useState, useMemo, useEffect } from 'react';
    import { useData } from '@/contexts/DataContext';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { PlusCircle, Edit, Trash2, Mail, Phone, MapPin, Users, User, Search } from 'lucide-react';
    import { motion } from 'framer-motion';
    import EmptyState from '@/components/EmptyState';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import useDebounce from '@/hooks/useDebounce';

    export const CustomerForm = ({ customer, onFinished }) => {
      const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        address: '',
        phone: '',
        email: '',
      });
      const [loading, setLoading] = useState(false);
      const { toast } = useToast();
      const { refreshData } = useData();
      const { user } = useAuth();

      useEffect(() => {
        if (customer) {
          setFormData({
            name: customer.name || '',
            contact_person: customer.contact_person || '',
            address: customer.address || '',
            phone: customer.phone || '',
            email: customer.email || '',
          });
        } else {
          setFormData({
            name: '',
            contact_person: '',
            address: '',
            phone: '',
            email: '',
          });
        }
      }, [customer]);

      const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
      };

      const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const customerData = { ...formData, user_id: user.id };

        let data, error;
        if (customer?.id) {
          ({ data, error } = await supabase.from('customers').update(customerData).eq('id', customer.id).select().single());
        } else {
          ({ data, error } = await supabase.from('customers').insert(customerData).select().single());
        }

        if (error) {
          toast({ variant: 'destructive', title: 'Gagal menyimpan pelanggan', description: error.message });
        } else {
          toast({ title: `Pelanggan berhasil ${customer?.id ? 'diperbarui' : 'disimpan'}` });
          await refreshData();
          if (onFinished) {
            onFinished(data);
          }
        }
        setLoading(false);
      };

      return (
        <>
            <DialogHeader>
                <DialogTitle>{customer ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div>
                <Label htmlFor="name">Nama Perusahaan/Pelanggan</Label>
                <Input id="name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="contact_person">Contact Person (UP)</Label>
                <Input id="contact_person" value={formData.contact_person} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="address">Alamat</Label>
                <Textarea id="address" value={formData.address} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="phone">Telepon</Label>
                <Input id="phone" type="tel" value={formData.phone} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={handleInputChange} />
              </div>
              <DialogFooter>
                  <Button type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</Button>
              </DialogFooter>
            </form>
        </>
      );
    };

    const CustomersPage = () => {
      const { customers, loading, refreshData } = useData();
      const { user } = useAuth();
      const userRole = user?.user_metadata?.role;
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [selectedCustomer, setSelectedCustomer] = useState(null);
      const [searchTerm, setSearchTerm] = useState('');
      const debouncedSearchTerm = useDebounce(searchTerm, 300);
      const { toast } = useToast();

      const filteredCustomers = useMemo(() => {
        if (!debouncedSearchTerm) return customers;
        const lowercasedTerm = debouncedSearchTerm.toLowerCase();
        return customers.filter(customer =>
          customer.name?.toLowerCase().includes(lowercasedTerm) ||
          customer.contact_person?.toLowerCase().includes(lowercasedTerm) ||
          customer.email?.toLowerCase().includes(lowercasedTerm) ||
          customer.phone?.toLowerCase().includes(lowercasedTerm)
        );
      }, [customers, debouncedSearchTerm]);

      const handleEdit = (customer) => {
        setSelectedCustomer(customer);
        setIsFormOpen(true);
      };

      const handleAddNew = () => {
        setSelectedCustomer(null);
        setIsFormOpen(true);
      };


      const handleDelete = async (customerId) => {
        if (userRole !== 'admin') {
            toast({ variant: "destructive", title: "Akses Ditolak", description: "Hanya admin yang dapat menghapus pelanggan." });
            return;
        }
        if (!window.confirm('Apakah Anda yakin ingin menghapus pelanggan ini? Ini akan menghapus semua quotation dan invoice terkait.')) return;
        
        const { error } = await supabase.from('customers').delete().eq('id', customerId);
        if (error) {
          toast({ variant: 'destructive', title: 'Gagal menghapus pelanggan', description: error.message });
        } else {
          toast({ title: 'Pelanggan berhasil dihapus' });
          await refreshData();
        }
      };

      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                  <CardTitle>Daftar Pelanggan</CardTitle>
                  <p className="text-sm text-muted-foreground">Cari dan kelola semua pelanggan Anda.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          placeholder="Cari pelanggan..."
                          className="pl-10"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <Button onClick={handleAddNew} className="w-full sm:w-auto">
                      <PlusCircle className="mr-2 h-4 w-4" /> Tambah Pelanggan
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-10">Memuat data pelanggan...</p>
              ) : customers.length === 0 ? (
                <EmptyState 
                  icon={Users}
                  title="Belum ada pelanggan"
                  description="Anda bisa mulai dengan menambahkan pelanggan baru."
                  actionText="Tambah Pelanggan"
                  onActionClick={handleAddNew}
                />
              ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-10">
                      <p className="text-lg font-semibold">Data tidak ditemukan</p>
                      <p className="text-muted-foreground">Tidak ada pelanggan yang cocok dengan kata kunci "{debouncedSearchTerm}".</p>
                  </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCustomers.map((customer) => (
                    <motion.div key={customer.id} whileHover={{ y: -5 }} className="bg-white rounded-lg shadow-md p-4 border border-gray-200 flex flex-col justify-between">
                      <div>
                          <div className="flex justify-between items-start">
                              <h3 className="font-bold text-lg text-blue-700">{customer.name}</h3>
                              <div className="flex space-x-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(customer)}><Edit className="h-4 w-4" /></Button>
                                  {userRole === 'admin' && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(customer.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                              </div>
                          </div>
                          <div className="mt-2 space-y-2 text-sm text-gray-600">
                              {customer.contact_person && <p className="flex items-center"><User className="mr-2 h-4 w-4 text-gray-400" /> UP: {customer.contact_person}</p>}
                              {customer.email && <p className="flex items-center"><Mail className="mr-2 h-4 w-4 text-gray-400" /> {customer.email}</p>}
                              {customer.phone && <p className="flex items-center"><Phone className="mr-2 h-4 w-4 text-gray-400" /> {customer.phone}</p>}
                              {customer.address && <p className="flex items-start"><MapPin className="mr-2 h-4 w-4 text-gray-400 mt-1 flex-shrink-0" /> {customer.address}</p>}
                          </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-4">Dibuat: {new Date(customer.created_at).toLocaleDateString('id-ID')}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
           <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogContent>
                  <CustomerForm customer={selectedCustomer} onFinished={() => setIsFormOpen(false)} />
              </DialogContent>
          </Dialog>
        </motion.div>
      );
    };

    export default CustomersPage;