
import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { BookLock, Calendar as CalendarIcon, History, Unlock } from 'lucide-react';
import { format as formatDateFn } from 'date-fns';
import { id as dateFnsId } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import EmptyState from '@/components/EmptyState';
import ConfirmationDialog from '@/components/ConfirmationDialog';

const CloseBookPage = () => {
    const { closedPeriods, refreshData, loading } = useData();
    const { user } = useAuth();
    const userRole = user?.user_metadata?.role;

    const [endDate, setEndDate] = useState(new Date());
    const [periodName, setPeriodName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [reopenTarget, setReopenTarget] = useState(null);

    const lastClosedDate = useMemo(() => {
        if (!closedPeriods || closedPeriods.length === 0) return null;
        const sortedPeriods = [...closedPeriods].sort((a, b) => new Date(b.end_date) - new Date(a.end_date));
        return new Date(sortedPeriods[0].end_date);
    }, [closedPeriods]);

    const handleCloseBook = async () => {
        if (!endDate || !periodName) {
            toast({ variant: 'destructive', title: 'Data Tidak Lengkap', description: 'Harap isi nama periode dan tanggal tutup buku.' });
            return;
        }
        if (lastClosedDate && endDate <= lastClosedDate) {
            toast({ variant: 'destructive', title: 'Tanggal Tidak Valid', description: `Tanggal tutup buku harus setelah ${formatDateFn(lastClosedDate, 'd MMMM yyyy', { locale: dateFnsId })}.` });
            return;
        }

        setIsSubmitting(true);
        const { error } = await supabase.rpc('close_book', {
            p_end_date: formatDateFn(endDate, 'yyyy-MM-dd'),
            p_period_name: periodName
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal Tutup Buku', description: error.message });
        } else {
            toast({ title: 'Sukses', description: `Proses tutup buku untuk periode ${periodName} berhasil.` });
            setPeriodName('');
            await refreshData();
        }
        setIsSubmitting(false);
    };

    const handleReopenBook = async () => {
        if (!reopenTarget) return;
        setIsSubmitting(true);
        const { error } = await supabase.rpc('reopen_book', { p_close_book_id: reopenTarget.id });

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal Membuka Periode', description: error.message });
        } else {
            toast({ title: 'Sukses', description: `Periode ${reopenTarget.period} berhasil dibuka kembali.` });
            await refreshData();
        }
        setIsSubmitting(false);
        setReopenTarget(null);
        setDialogOpen(false);
    };

    const sortedClosedPeriods = useMemo(() => {
        return [...closedPeriods].sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
    }, [closedPeriods]);

    return (
        <>
            <Helmet>
                <title>Tutup Buku - Sistem Keuangan</title>
                <meta name="description" content="Lakukan proses tutup buku untuk memfinalisasi transaksi pada suatu periode." />
            </Helmet>

            <ConfirmationDialog
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onConfirm={handleReopenBook}
                title="Buka Kembali Periode Tutup Buku?"
                description={`Anda akan membuka kembali periode ${reopenTarget?.period}. Ini akan menghapus jurnal penutup yang terkait dan membuka kunci semua transaksi dalam periode tersebut. Aksi ini hanya untuk tujuan pengujian dan akan dicatat. Lanjutkan?`}
                confirmText="Ya, Buka Kembali"
                isDestructive
                isLoading={isSubmitting}
            />

            <div className="space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Tutup Buku Akuntansi</h1>
                        <p className="text-gray-500">Finalisasi transaksi dengan membuat jurnal penutup otomatis.</p>
                    </div>
                </div>

                <Card className="glass-effect">
                    <CardHeader>
                        <CardTitle>Proses Tutup Buku Baru</CardTitle>
                        <CardDescription>
                            Pilih tanggal akhir periode yang akan ditutup. Semua transaksi hingga tanggal ini akan dikunci.
                            {lastClosedDate && ` Periode terakhir ditutup pada ${formatDateFn(lastClosedDate, 'd MMMM yyyy', { locale: dateFnsId })}.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="period-name">Nama Periode</Label>
                                <Input
                                    id="period-name"
                                    placeholder="Contoh: Kuartal 1 2025"
                                    value={periodName}
                                    onChange={(e) => setPeriodName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end-date">Tanggal Tutup Buku</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="end-date" variant={"outline"} className="w-full justify-start text-left font-normal bg-white">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? formatDateFn(endDate, "d MMMM yyyy", { locale: dateFnsId }) : <span>Pilih tanggal</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleCloseBook} disabled={isSubmitting}>
                            <BookLock className="mr-2 h-4 w-4" />
                            {isSubmitting ? 'Memproses...' : 'Jalankan Tutup Buku'}
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Riwayat Tutup Buku</CardTitle>
                        <CardDescription>Daftar periode yang telah selesai diproses tutup buku.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p>Memuat riwayat...</p>
                        ) : sortedClosedPeriods.length === 0 ? (
                            <EmptyState
                                icon={History}
                                title="Belum Ada Riwayat"
                                description="Belum ada periode yang ditutup buku."
                            />
                        ) : (
                            <div className="space-y-4">
                                {sortedClosedPeriods.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                                        <div>
                                            <p className="font-semibold text-gray-800">{p.period}</p>
                                            <p className="text-sm text-gray-500">
                                                Periode: {formatDateFn(new Date(p.start_date), 'd MMM yyyy')} - {formatDateFn(new Date(p.end_date), 'd MMM yyyy')}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Ditutup pada: {formatDateFn(new Date(p.closed_at), 'd MMM yyyy, HH:mm')}
                                            </p>
                                        </div>
                                        {userRole === 'admin' && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => {
                                                    setReopenTarget(p);
                                                    setDialogOpen(true);
                                                }}
                                            >
                                                <Unlock className="mr-2 h-4 w-4" />
                                                Buka Kembali
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default CloseBookPage;
  