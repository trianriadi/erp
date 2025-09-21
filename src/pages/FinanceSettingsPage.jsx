import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Settings, Save } from 'lucide-react';

const FinanceSettingsPage = () => {
    const { user } = useAuth();
    const { chartOfAccounts, loading: dataLoading, refreshData } = useData();
    const { toast } = useToast();

    const [settings, setSettings] = useState({
        inventory_account_id: '',
        ap_account_id: '',
        ar_account_id: '',
        sales_revenue_account_id: '',
        cogs_account_id: '',
    });
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!user) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('finance_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) {
                toast({ variant: 'destructive', title: 'Gagal memuat pengaturan', description: error.message });
            } else if (data) {
                setSettings({
                    inventory_account_id: data.inventory_account_id || '',
                    ap_account_id: data.ap_account_id || '',
                    ar_account_id: data.ar_account_id || '',
                    sales_revenue_account_id: data.sales_revenue_account_id || '',
                    cogs_account_id: data.cogs_account_id || '',
                });
            }
            setLoading(false);
        };

        fetchSettings();
    }, [user, toast]);

    const accountOptions = useMemo(() => {
        const options = {
            inventory: [],
            ap: [],
            ar: [],
            revenue: [],
            cogs: [],
        };

        if (chartOfAccounts) {
            chartOfAccounts.forEach(acc => {
                if (acc.type === 'Aset' && !acc.is_cash_account) {
                    options.inventory.push(acc);
                    options.ar.push(acc);
                } else if (acc.type === 'Kewajiban') {
                    options.ap.push(acc);
                } else if (acc.type === 'Pendapatan') {
                    options.revenue.push(acc);
                } else if (acc.type === 'Beban') {
                    options.cogs.push(acc);
                }
            });
        }
        return options;
    }, [chartOfAccounts]);

    const handleSave = async () => {
        if (!user) return;
        setIsSubmitting(true);

        const payload = {
            ...settings,
            user_id: user.id,
        };

        const { error } = await supabase.from('finance_settings').upsert(payload, { onConflict: 'user_id' });

        setIsSubmitting(false);
        if (error) {
            toast({ variant: 'destructive', title: 'Gagal menyimpan pengaturan', description: error.message });
        } else {
            toast({ title: 'Sukses!', description: 'Pengaturan keuangan berhasil disimpan.' });
            await refreshData();
        }
    };

    const handleSelectChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    if (loading || dataLoading) {
        return <div className="flex justify-center items-center h-full"><p>Memuat pengaturan...</p></div>;
    }

    return (
        <>
            <Helmet>
                <title>Pengaturan Keuangan</title>
                <meta name="description" content="Atur akun default untuk otomatisasi jurnal." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Pengaturan Keuangan</h1>
                        <p className="text-gray-500">Atur akun default yang digunakan untuk otomatisasi jurnal akuntansi.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Pemetaan Akun Otomatis</CardTitle>
                        <CardDescription>Pilih akun yang sesuai untuk setiap proses. Ini akan memastikan jurnal otomatis tercatat dengan benar.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="inventory_account">Akun Persediaan (Inventory)</Label>
                                <Select value={settings.inventory_account_id} onValueChange={(v) => handleSelectChange('inventory_account_id', v)}>
                                    <SelectTrigger id="inventory_account"><SelectValue placeholder="Pilih akun persediaan..." /></SelectTrigger>
                                    <SelectContent>
                                        {accountOptions.inventory.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Akun ini akan di-debit saat ada penerimaan barang.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="ap_account">Akun Utang Usaha (Accounts Payable)</Label>
                                <Select value={settings.ap_account_id} onValueChange={(v) => handleSelectChange('ap_account_id', v)}>
                                    <SelectTrigger id="ap_account"><SelectValue placeholder="Pilih akun utang usaha..." /></SelectTrigger>
                                    <SelectContent>
                                        {accountOptions.ap.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Akun ini akan di-kredit saat hutang dari penerimaan barang dibuat.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="ar_account">Akun Piutang Usaha (Accounts Receivable)</Label>
                                <Select value={settings.ar_account_id} onValueChange={(v) => handleSelectChange('ar_account_id', v)}>
                                    <SelectTrigger id="ar_account"><SelectValue placeholder="Pilih akun piutang usaha..." /></SelectTrigger>
                                    <SelectContent>
                                        {accountOptions.ar.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Akun ini akan di-debit saat invoice penjualan dibuat.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="revenue_account">Akun Pendapatan Penjualan</Label>
                                <Select value={settings.sales_revenue_account_id} onValueChange={(v) => handleSelectChange('sales_revenue_account_id', v)}>
                                    <SelectTrigger id="revenue_account"><SelectValue placeholder="Pilih akun pendapatan..." /></SelectTrigger>
                                    <SelectContent>
                                        {accountOptions.revenue.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Akun ini akan di-kredit saat invoice penjualan dibuat.</p>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="cogs_account">Akun Harga Pokok Penjualan (COGS)</Label>
                                <Select value={settings.cogs_account_id} onValueChange={(v) => handleSelectChange('cogs_account_id', v)}>
                                    <SelectTrigger id="cogs_account"><SelectValue placeholder="Pilih akun HPP..." /></SelectTrigger>
                                    <SelectContent>
                                        {accountOptions.cogs.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Akun ini akan di-debit saat barang dikirim (fitur mendatang).</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleSave} disabled={isSubmitting}>
                                <Save className="h-4 w-4 mr-2" />
                                {isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default FinanceSettingsPage;