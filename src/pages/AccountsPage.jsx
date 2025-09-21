import React, { useState, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Helmet } from 'react-helmet';
    import { 
      Plus, 
      Edit, 
      Trash2, 
      PiggyBank,
      TrendingUp,
      TrendingDown,
      RefreshCw
    } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
    import { toast } from '@/components/ui/use-toast';
    import { useData } from '@/contexts/DataContext';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import EmptyState from '@/components/EmptyState';
    import { Link } from 'react-router-dom';

    const AccountsPage = () => {
      const { user } = useAuth();
      const { accounts, transactions, loading, refreshData } = useData();
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [editingAccount, setEditingAccount] = useState(null);
      const [formData, setFormData] = useState({
        code: '',
        name: '',
        initial_balance: ''
      });

      const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const accountData = {
          code: formData.code,
          name: formData.name,
          type: 'Aset',
          is_cash_account: true,
          user_id: user.id,
        };

        let error;
        if (editingAccount) {
          const { error: updateError } = await supabase
            .from('chart_of_accounts')
            .update({ name: accountData.name, code: accountData.code })
            .eq('id', editingAccount.id);
          error = updateError;
        } else {
          const { error: insertError } = await supabase.from('chart_of_accounts').insert(accountData).select().single();
          error = insertError;
          if (!error && formData.initial_balance > 0) {
              const { error: journalError } = await supabase.rpc('create_journal_with_details', {
                  p_date: new Date().toISOString().split('T')[0],
                  p_description: `Saldo awal untuk ${formData.name}`,
                  p_journal_details: JSON.stringify([
                    { account_code: formData.code, debit: parseFloat(formData.initial_balance), credit: 0 },
                    { account_code: '3110', credit: parseFloat(formData.initial_balance), debit: 0 } // Modal Disetor
                  ]),
                  p_user_id: user.id
              });
              if (journalError) {
                  toast({ title: "Gagal mencatat saldo awal", description: journalError.message, variant: "destructive" });
              }
          }
        }

        if (error) {
          if (error.message.includes('duplicate key value violates unique constraint')) {
            toast({ title: "Gagal Menyimpan", description: "Kode atau nama akun sudah ada. Silakan gunakan yang lain.", variant: "destructive" });
          } else {
            toast({ title: "Error", description: error.message, variant: "destructive" });
          }
        } else {
          toast({ title: "Sukses", description: `Rekening berhasil ${editingAccount ? 'diperbarui' : 'ditambahkan'}.` });
          await refreshData();
          resetForm();
          setIsDialogOpen(false);
        }
        setIsSubmitting(false);
      };

      const handleEdit = (account) => {
        setEditingAccount(account);
        setFormData({
          code: account.code,
          name: account.name,
          initial_balance: ''
        });
        setIsDialogOpen(true);
      };

      const handleDelete = async (accountId) => {
        const hasTransactions = transactions.some(t => 
          t.journal_entries.some(je => je.account_id === accountId)
        );

        if (hasTransactions) {
          toast({ title: "Tidak Dapat Menghapus", description: "Rekening ini memiliki transaksi dan tidak dapat dihapus.", variant: "destructive" });
          return;
        }

        const { error } = await supabase.from('chart_of_accounts').delete().eq('id', accountId);

        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Rekening Dihapus", description: "Rekening berhasil dihapus." });
          await refreshData();
        }
      };

      const resetForm = () => {
        setFormData({ code: '', name: '', initial_balance: '' });
        setEditingAccount(null);
      };

      const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

      const accountBalances = useMemo(() => {
        const balances = {};
        accounts.forEach(acc => balances[acc.id] = 0);

        transactions.forEach(tx => {
            tx.journal_entries.forEach(je => {
                if (balances[je.account_id] !== undefined) {
                    balances[je.account_id] += je.debit;
                    balances[je.account_id] -= je.credit;
                }
            });
        });
        return balances;
      }, [transactions, accounts]);

      const getAccountStats = (accountId) => {
        let income = 0;
        let expense = 0;
        transactions.forEach(tx => {
            tx.journal_entries.forEach(je => {
                if (je.account_id === accountId) {
                    if (je.debit > 0) income += je.debit;
                    if (je.credit > 0) expense += je.credit;
                }
            });
        });
        return { income, expense };
      };

      return (
        <>
          <Helmet>
            <title>Rekening Kas & Bank - Sistem Keuangan</title>
            <meta name="description" content="Kelola rekening kas dan bank, saldo, dan jenis rekening" />
          </Helmet>
          
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Rekening Kas & Bank</h1>
                <p className="text-gray-500">Kelola semua rekening likuid perusahaan Anda. Untuk daftar akun lengkap, kunjungi <Link to="/finance/chart-of-accounts" className="text-blue-600 hover:underline">Bagan Akun</Link>.</p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Rekening
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-effect border-gray-200 text-gray-900 max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingAccount ? 'Edit Rekening' : 'Tambah Rekening Baru'}</DialogTitle>
                      <DialogDescription className="text-gray-500">{editingAccount ? 'Perbarui data rekening' : 'Masukkan detail rekening baru. Ini akan ditambahkan sebagai Aset.'}</DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="code">Kode Akun</Label>
                        <Input id="code" placeholder="Contoh: 1130" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Nama Rekening</Label>
                        <Input id="name" placeholder="Contoh: Bank Mandiri" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="initial_balance">Saldo Awal</Label>
                        <Input id="initial_balance" type="number" placeholder="Masukkan saldo awal" value={formData.initial_balance} onChange={(e) => setFormData({...formData, initial_balance: e.target.value})} disabled={!!editingAccount} />
                        {editingAccount && <p className="text-xs text-gray-500">Saldo awal tidak dapat diubah. Gunakan fitur transaksi untuk menyesuaikan saldo.</p>}
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : (editingAccount ? 'Perbarui' : 'Simpan')}</Button>
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-300 text-gray-700 hover:bg-gray-100">Batal</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {loading ? (
               <p className="text-center py-10">Memuat rekening...</p>
            ) : accounts.length === 0 ? (
              <EmptyState icon={PiggyBank} title="Belum Ada Rekening Kas/Bank" description="Anda bisa mulai dengan menambahkan rekening kas atau bank baru." actionText="Tambah Rekening" onActionClick={() => setIsDialogOpen(true)} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {accounts.map((account, index) => {
                  const { income, expense } = getAccountStats(account.id);
                  const balance = accountBalances[account.id] || 0;
                  return (
                    <motion.div key={account.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                      <Card className="glass-effect border-gray-200 card-hover h-full flex flex-col">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-gray-900 flex items-center"><PiggyBank className="h-5 w-5 mr-2 text-blue-500" />{account.name}</CardTitle>
                              <p className="text-sm text-gray-500">{account.code}</p>
                            </div>
                            <div className="flex space-x-2">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(account)} className="border-gray-300 text-gray-700 hover:bg-gray-100"><Edit className="h-3 w-3" /></Button>
                              <Button size="sm" variant="outline" onClick={() => handleDelete(account.id)} className="border-red-300 text-red-600 hover:bg-red-100"><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-grow flex flex-col justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Saldo Saat Ini</p>
                            <p className={`text-3xl font-bold mb-4 ${balance < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatCurrency(balance)}</p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center space-x-2">
                                <div className="p-1.5 bg-green-100 rounded-full"><TrendingUp className="h-4 w-4 text-green-600" /></div>
                                <div><p className="text-gray-500">Debit</p><p className="font-medium text-gray-900">{formatCurrency(income)}</p></div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="p-1.5 bg-red-100 rounded-full"><TrendingDown className="h-4 w-4 text-red-600" /></div>
                                <div><p className="text-gray-500">Kredit</p><p className="font-medium text-gray-900">{formatCurrency(expense)}</p></div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">Dibuat pada: {new Date(account.created_at).toLocaleDateString('id-ID')}</div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      );
    };

    export default AccountsPage;