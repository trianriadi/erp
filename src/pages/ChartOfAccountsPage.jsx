import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Plus, Edit, Trash2, RefreshCw, BookOpen, Landmark, Coins as HandCoins, Building, TrendingUp, TrendingDown, Wallet, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import EmptyState from '@/components/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const ACCOUNT_TYPES_CONFIG = {
    'Aset': { icon: Wallet, color: 'text-green-500', bg: 'bg-green-50' },
    'Kewajiban': { icon: HandCoins, color: 'text-orange-500', bg: 'bg-orange-50' },
    'Ekuitas': { icon: Building, color: 'text-blue-500', bg: 'bg-blue-50' },
    'Pendapatan': { icon: TrendingUp, color: 'text-teal-500', bg: 'bg-teal-50' },
    'Beban': { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
};

const ChartOfAccountsPage = () => {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role;
  const { chartOfAccounts, transactions, loading, refreshData } = useData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false);
  const [isCleanupRunning, setIsCleanupRunning] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'Aset',
    is_cash_account: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend validation for duplicate code
    const isDuplicate = chartOfAccounts.some(
      (acc) => acc.code === formData.code && acc.id !== editingAccount?.id
    );

    if (isDuplicate) {
      toast({
        title: "Kode Duplikat",
        description: "Kode akun ini sudah digunakan. Silakan gunakan kode lain.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const accountData = { ...formData, user_id: user.id };

    let error;
    if (editingAccount) {
      const { error: updateError } = await supabase.from('chart_of_accounts').update(accountData).eq('id', editingAccount.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('chart_of_accounts').insert(accountData);
      error = insertError;
    }

    if (error) {
      if (error.message.includes('duplicate key value violates unique constraint')) {
        toast({ title: "Gagal Menyimpan", description: "Kode akun sudah ada. Silakan gunakan kode lain.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Sukses", description: `Akun berhasil ${editingAccount ? 'diperbarui' : 'ditambahkan'}.` });
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
      type: account.type,
      is_cash_account: account.is_cash_account,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (accountId) => {
    const hasTransactions = transactions.some(t => t.journal_entries.some(je => je.account_id === accountId));
    if (hasTransactions) {
      toast({ title: "Tidak Dapat Menghapus", description: "Akun ini memiliki transaksi terkait dan tidak dapat dihapus.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', accountId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Akun Dihapus", description: "Akun berhasil dihapus." });
      await refreshData();
    }
  };

  const handleRunMaintenance = async () => {
      setIsMaintenanceRunning(true);
      const { error } = await supabase.rpc('seed_default_coa_for_user', { p_user_id: user.id });
      if (error) {
          toast({ variant: 'destructive', title: 'Gagal menjalankan perbaikan', description: error.message });
      } else {
          toast({ title: 'Sukses', description: 'Bagan Akun berhasil diperbarui dengan akun standar.' });
          await refreshData();
      }
      setIsMaintenanceRunning(false);
  };

  const handleCleanupDuplicates = async () => {
    setIsCleanupRunning(true);
    const { data, error } = await supabase.rpc('cleanup_coa_duplicates_and_add_constraint');
    if (error) {
        toast({ variant: 'destructive', title: 'Gagal Membersihkan Duplikat', description: error.message });
    } else {
        toast({ title: 'Pembersihan Selesai', description: data });
        await refreshData();
    }
    setIsCleanupRunning(false);
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', type: 'Aset', is_cash_account: false });
    setEditingAccount(null);
  };

  const groupedAccounts = useMemo(() => {
    const uniqueAccounts = Array.from(new Map(chartOfAccounts.map(item => [item.code, item])).values());
    const groups = { 'Aset': [], 'Kewajiban': [], 'Ekuitas': [], 'Pendapatan': [], 'Beban': [] };
    uniqueAccounts.forEach(acc => {
      if (groups[acc.type]) {
        groups[acc.type].push(acc);
      }
    });
    for (const type in groups) {
        groups[type].sort((a, b) => a.code.localeCompare(b.code));
    }
    return groups;
  }, [chartOfAccounts]);

  return (
    <>
      <Helmet>
        <title>Bagan Akun - Sistem Keuangan</title>
        <meta name="description" content="Kelola bagan akun (Chart of Accounts) perusahaan." />
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bagan Akun (Chart of Accounts)</h1>
            <p className="text-gray-500">Daftar semua akun yang digunakan dalam pencatatan keuangan.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
            {userRole === 'admin' && (
              <Button variant="outline" onClick={handleRunMaintenance} disabled={isMaintenanceRunning}>
                <Sparkles className={`h-4 w-4 mr-2 ${isMaintenanceRunning ? 'animate-spin' : ''}`} />
                Perbarui Akun Standar
              </Button>
            )}
            {userRole === 'admin' && (
              <Button variant="destructive" onClick={handleCleanupDuplicates} disabled={isCleanupRunning}>
                <ShieldCheck className={`h-4 w-4 mr-2 ${isCleanupRunning ? 'animate-spin' : ''}`} />
                Bersihkan Akun Duplikat
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Tambah Akun</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingAccount ? 'Edit Akun' : 'Tambah Akun Baru'}</DialogTitle>
                  <DialogDescription>{editingAccount ? 'Perbarui detail akun Anda.' : 'Buat akun baru untuk pencatatan keuangan.'}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label htmlFor="code">Kode Akun</Label><Input id="code" placeholder="Contoh: 1130" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} required /></div>
                  <div className="space-y-2"><Label htmlFor="name">Nama Akun</Label><Input id="name" placeholder="Contoh: Bank Mandiri" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required /></div>
                  <div className="space-y-2"><Label>Tipe Akun</Label><Select required value={formData.type} onValueChange={v => setFormData({...formData, type: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.keys(ACCOUNT_TYPES_CONFIG).map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
                  <div className="flex items-center space-x-2 pt-2"><Switch id="is_cash_account" checked={formData.is_cash_account} onCheckedChange={c => setFormData({...formData, is_cash_account: c})} /><Label htmlFor="is_cash_account">Tandai sebagai Rekening Kas/Bank</Label></div>
                  <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan Akun'}</Button></div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? <p className="text-center py-10">Memuat bagan akun...</p> : 
         chartOfAccounts.length === 0 ? <EmptyState icon={BookOpen} title="Bagan Akun Kosong" description="Mulai dengan menambahkan akun pertama Anda." actionText="Tambah Akun" onActionClick={() => setIsDialogOpen(true)} /> :
         (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(groupedAccounts).map(([type, accounts]) => {
              const config = ACCOUNT_TYPES_CONFIG[type] || { icon: BookOpen, color: 'text-gray-500', bg: 'bg-gray-50' };
              const Icon = config.icon;
              return accounts.length > 0 && (
                <motion.div key={type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={`${config.bg} border-t-4 ${config.color.replace('text-', 'border-')}`}>
                    <CardHeader>
                      <CardTitle className={`flex items-center gap-3 ${config.color}`}>
                          <Icon className="h-6 w-6"/>
                          {type}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {accounts.map(account => (
                          <div key={account.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-white transition-colors group">
                            <div>
                              <p className="font-medium text-gray-800">{account.name}</p>
                              <p className="text-sm text-gray-500">{account.code} {account.is_cash_account && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full ml-2">Kas/Bank</span>}</p>
                            </div>
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" onClick={() => handleEdit(account)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(account.id)} className="h-8 w-8 text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default ChartOfAccountsPage;