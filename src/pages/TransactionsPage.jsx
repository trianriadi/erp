
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Plus, Search, Trash2, RefreshCw, Download, FileText, FileSpreadsheet, PlusCircle, XCircle, Edit, Eye, Printer, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import EmptyState from '@/components/EmptyState';
import { CreditCard, Calendar as CalendarIcon } from 'lucide-react';
import { format as formatDateFn, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { id as dateFnsId } from 'date-fns/locale';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useLocation, useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const JournalForm = ({ onSave, editingTransaction }) => {
  const { user } = useAuth();
  const { chartOfAccounts } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [transactionType, setTransactionType] = useState('pemasukan');

  const initialFormState = useMemo(() => ({
    journal_no: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    details: [
      { account_id: '', debit: '0', credit: '0' },
      { account_id: '', debit: '0', credit: '0' },
    ]
  }), []);
  
  const [journalData, setJournalData] = useState(initialFormState);

  const accountFilters = useMemo(() => {
    return {
      cash: chartOfAccounts.filter(a => a.is_cash_account),
      pendapatan: chartOfAccounts.filter(a => a.type === 'Pendapatan'),
      beban: chartOfAccounts.filter(a => a.type === 'Beban'),
      hutang: chartOfAccounts.filter(a => a.code === '2110'), // Utang Usaha
      asetBeban: chartOfAccounts.filter(a => a.type === 'Beban' || (a.type === 'Aset' && !a.is_cash_account)),
    };
  }, [chartOfAccounts]);

  const updateDetailsFromAmount = useCallback((type, amountStr, detailsToUpdate) => {
    const amount = parseFloat(amountStr) || 0;
    const newDetails = [...detailsToUpdate];

    if (newDetails.length < 2) {
        newDetails.push({ account_id: '', debit: '0', credit: '0' }, { account_id: '', debit: '0', credit: '0' });
    }

    if (type === 'pemasukan') {
        newDetails[0] = { ...newDetails[0], debit: amount.toString(), credit: '0' };
        newDetails[1] = { ...newDetails[1], debit: '0', credit: amount.toString() };
    } else if (type === 'pengeluaran') {
        newDetails[0] = { ...newDetails[0], debit: amount.toString(), credit: '0' };
        newDetails[1] = { ...newDetails[1], debit: '0', credit: amount.toString() };
    } else if (type === 'hutang') {
        newDetails[0] = { ...newDetails[0], debit: amount.toString(), credit: '0' };
        newDetails[1] = { ...newDetails[1], debit: '0', credit: amount.toString() };
    } else if (type === 'pelunasan') {
        newDetails[0] = { ...newDetails[0], debit: amount.toString(), credit: '0' };
        newDetails[1] = { ...newDetails[1], debit: '0', credit: amount.toString() };
    }
    
    setJournalData(prev => ({ ...prev, amount: amountStr, details: newDetails }));
  }, []);

  const deduceTransactionType = useCallback((entries) => {
    if (entries.length !== 2) return 'manual';

    const debitEntry = entries.find(e => parseFloat(e.debit) > 0);
    const creditEntry = entries.find(e => parseFloat(e.credit) > 0);

    if (!debitEntry || !creditEntry) return 'manual';

    const debitAccount = chartOfAccounts.find(a => a.id === debitEntry.account.id);
    const creditAccount = chartOfAccounts.find(a => a.id === creditEntry.account.id);

    if (!debitAccount || !creditAccount) return 'manual';

    if (debitAccount.is_cash_account && creditAccount.type === 'Pendapatan') return 'pemasukan';
    if (debitAccount.type === 'Beban' && creditAccount.is_cash_account) return 'pengeluaran';
    if (debitAccount.code === '2110' && creditAccount.is_cash_account) return 'pelunasan';
    if ((debitAccount.type === 'Beban' || (debitAccount.type === 'Aset' && !debitAccount.is_cash_account)) && creditAccount.code === '2110') return 'hutang';
    
    return 'manual';
  }, [chartOfAccounts]);
  
  useEffect(() => {
    if (editingTransaction) {
      const deducedType = deduceTransactionType(editingTransaction.journal_entries);
      setTransactionType(deducedType);
      
      const totalAmount = editingTransaction.journal_entries.reduce((sum, je) => sum + parseFloat(je.debit), 0);
      
      let detailsForState;
      if (deducedType !== 'manual') {
        const debitEntry = editingTransaction.journal_entries.find(e => parseFloat(e.debit) > 0);
        const creditEntry = editingTransaction.journal_entries.find(e => parseFloat(e.credit) > 0);
        detailsForState = [
          { account_id: debitEntry.account.id, debit: debitEntry.debit.toString(), credit: '0' },
          { account_id: creditEntry.account.id, debit: '0', credit: creditEntry.credit.toString() }
        ];
      } else {
        detailsForState = editingTransaction.journal_entries.map(je => ({
          account_id: je.account.id,
          debit: je.debit.toString(),
          credit: je.credit.toString(),
        }));
      }

      setJournalData({
        journal_no: editingTransaction.journal_no || '',
        date: editingTransaction.date,
        description: editingTransaction.description,
        amount: totalAmount.toString(),
        details: detailsForState
      });

    } else {
      setJournalData(initialFormState);
      setTransactionType('pemasukan');
    }
  }, [editingTransaction, initialFormState, deduceTransactionType]);
  
  const handleFieldChange = useCallback((field, value) => {
    setJournalData(prev => ({ ...prev, [field]: value }));
  }, []);
  
  const handleDetailChange = (index, field, value) => {
    setJournalData(prev => {
        const newDetails = [...prev.details];
        newDetails[index] = { ...newDetails[index], [field]: value };

        if (transactionType === 'manual') {
          if (field === 'debit' && parseFloat(value) > 0) newDetails[index].credit = '0';
          if (field === 'credit' && parseFloat(value) > 0) newDetails[index].debit = '0';
        }

        return { ...prev, details: newDetails };
    });
  };
  
  const handleTypeChange = (type) => {
    setTransactionType(type);
    
    setJournalData(prev => {
        const amount = parseFloat(prev.amount) || 0;
        let newDetails = [];

        const findAccountId = (accounts, defaultIndex = 0) => accounts[defaultIndex]?.id || '';
        
        if (type === 'pemasukan') {
            newDetails = [
                { account_id: findAccountId(accountFilters.cash), debit: amount.toString(), credit: '0' },
                { account_id: findAccountId(accountFilters.pendapatan), debit: '0', credit: amount.toString() }
            ];
        } else if (type === 'pengeluaran') {
            newDetails = [
                { account_id: findAccountId(accountFilters.beban), debit: amount.toString(), credit: '0' },
                { account_id: findAccountId(accountFilters.cash), debit: '0', credit: amount.toString() }
            ];
        } else if (type === 'hutang') {
            newDetails = [
                { account_id: findAccountId(accountFilters.asetBeban), debit: amount.toString(), credit: '0' },
                { account_id: findAccountId(accountFilters.hutang), debit: '0', credit: amount.toString() }
            ];
        } else if (type === 'pelunasan') {
            newDetails = [
                { account_id: findAccountId(accountFilters.hutang), debit: amount.toString(), credit: '0' },
                { account_id: findAccountId(accountFilters.cash), debit: '0', credit: amount.toString() }
            ];
        } else { // manual
            return { ...prev, details: initialFormState.details };
        }
        
        return { ...prev, details: newDetails };
    });
  };
  
  const handleAmountChange = (e) => {
    const sanitizedValue = e.target.value.replace(/[^0-9.]/g, '');
    setJournalData(prev => ({...prev, amount: sanitizedValue}));
    updateDetailsFromAmount(transactionType, sanitizedValue, journalData.details);
  };

  const addDetailRow = () => setJournalData(prev => ({ ...prev, details: [...prev.details, { account_id: '', debit: '0', credit: '0' }] }));
  const removeDetailRow = (index) => setJournalData(prev => ({ ...prev, details: prev.details.filter((_, i) => i !== index) }));

  const { totalDebit, totalCredit, isBalanced } = useMemo(() => {
    const totals = journalData.details.reduce((acc, d) => ({
      debit: acc.debit + (parseFloat(d.debit) || 0),
      credit: acc.credit + (parseFloat(d.credit) || 0),
    }), { debit: 0, credit: 0 });
    return { totalDebit: totals.debit, totalCredit: totals.credit, isBalanced: totals.debit > 0 && totals.debit.toFixed(5) === totals.credit.toFixed(5) };
  }, [journalData.details]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    for (const detail of journalData.details) {
      if (!detail.account_id && (parseFloat(detail.debit) > 0 || parseFloat(detail.credit) > 0)) {
        toast({ title: 'Akun Tidak Valid', description: 'Harap pilih akun yang valid untuk semua baris jurnal.', variant: 'destructive' });
        return;
      }
    }

    if (!isBalanced) {
      toast({ title: 'Jurnal Tidak Seimbang', description: 'Total debit harus sama dengan total kredit.', variant: 'destructive' });
      return;
    }
    const journalDetails = journalData.details
      .filter(d => d.account_id && (parseFloat(d.debit) > 0 || parseFloat(d.credit) > 0))
      .map(d => ({ account_id: d.account_id, debit: parseFloat(d.debit) || 0, credit: parseFloat(d.credit) || 0 }));
    
    if (journalDetails.length < 2) {
      toast({ title: 'Entri Tidak Lengkap', description: 'Jurnal harus memiliki setidaknya dua baris (debit & kredit) yang valid.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    
    const rpcCall = editingTransaction ? 'update_journal_with_details' : 'create_journal_with_details';
    const params = {
      p_date: journalData.date,
      p_description: journalData.description,
      p_journal_details: journalDetails,
      p_user_id: user.id,
      p_journal_no: journalData.journal_no || null
    };

    if (editingTransaction) {
      params.p_transaction_id = editingTransaction.id;
    }

    const { error } = await supabase.rpc(rpcCall, params);

    if (error) {
      toast({ title: 'Error Menyimpan Jurnal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sukses', description: `Jurnal berhasil ${editingTransaction ? 'diperbarui' : 'disimpan'}.` });
      onSave();
    }
    setIsSubmitting(false);
  };
  
  const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 2 }).format(amount);
  const availableAccounts = useMemo(() => chartOfAccounts.sort((a, b) => a.code.localeCompare(b.code)), [chartOfAccounts]);

  const renderSimpleForm = () => {
    let debitProps = { options: [], label: 'Akun Debit' };
    let creditProps = { options: [], label: 'Akun Kredit' };

    switch(transactionType) {
      case 'pemasukan':
        debitProps = { options: accountFilters.cash, label: "Setor Ke" };
        creditProps = { options: accountFilters.pendapatan, label: "Sumber Pemasukan" };
        break;
      case 'pengeluaran':
        debitProps = { options: accountFilters.beban, label: "Jenis Beban" };
        creditProps = { options: accountFilters.cash, label: "Ambil Dari" };
        break;
      case 'hutang':
        debitProps = { options: accountFilters.asetBeban, label: "Untuk Beban/Aset" };
        creditProps = { options: accountFilters.hutang, label: "Akun Hutang" };
        break;
      case 'pelunasan':
        debitProps = { options: accountFilters.hutang, label: "Akun Hutang" };
        creditProps = { options: accountFilters.cash, label: "Bayar Dari" };
        break;
      default: break;
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{debitProps.label}</Label>
            <Select value={journalData.details[0]?.account_id || ''} onValueChange={v => handleDetailChange(0, 'account_id', v)}>
              <SelectTrigger><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
              <SelectContent>{debitProps.options.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{creditProps.label}</Label>
             <Select value={journalData.details[1]?.account_id || ''} onValueChange={v => handleDetailChange(1, 'account_id', v)}>
              <SelectTrigger><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
              <SelectContent>{creditProps.options.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Nominal</Label>
          <Input id="amount" type="text" placeholder="0" value={journalData.amount} onChange={handleAmountChange} required className="text-right" />
        </div>
      </div>
    );
  };
  
  const renderManualForm = () => (
    <div className="space-y-2">
      <Label>Detail Jurnal</Label>
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr,150px,150px,auto] text-sm font-medium bg-gray-50 text-gray-600">
          <div className="p-2 border-b">Akun</div><div className="p-2 border-b text-right">Debit</div><div className="p-2 border-b text-right">Kredit</div><div className="p-2 border-b"></div>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {journalData.details.map((detail, index) => (
            <div key={index} className="grid grid-cols-[1fr,150px,150px,auto] items-center gap-2 p-2 border-b last:border-b-0">
              <Select value={detail.account_id} onValueChange={v => handleDetailChange(index, 'account_id', v)}>
                <SelectTrigger><SelectValue placeholder="Pilih akun..."/></SelectTrigger>
                <SelectContent>{availableAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="text" placeholder="0.00" className="text-right" value={detail.debit} onChange={e => handleDetailChange(index, 'debit', e.target.value.replace(/[^0-9.]/g, ''))} />
              <Input type="text" placeholder="0.00" className="text-right" value={detail.credit} onChange={e => handleDetailChange(index, 'credit', e.target.value.replace(/[^0-9.]/g, ''))} />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeDetailRow(index)} className="text-red-500 hover:bg-red-100 hover:text-red-600"><XCircle className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addDetailRow} className="mt-2"><PlusCircle className="h-4 w-4 mr-2" />Tambah Baris</Button>
    </div>
  );

  return (
    <>
      <form id="journal-form" onSubmit={handleSubmit} className="h-full flex flex-col">
        <div className="flex-grow p-6 pt-0 pr-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 220px)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Jenis Transaksi</Label>
                <Select value={transactionType} onValueChange={handleTypeChange}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pemasukan">Pemasukan</SelectItem>
                    <SelectItem value="pengeluaran">Pengeluaran</SelectItem>
                    <SelectItem value="hutang">Penerimaan Hutang</SelectItem>
                    <SelectItem value="pelunasan">Pelunasan Hutang</SelectItem>
                    <SelectItem value="manual">Jurnal Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="journal-date">Tanggal</Label>
                <Input id="journal-date" type="date" value={journalData.date} onChange={e => handleFieldChange('date', e.target.value)} required/>
              </div>

              <div className="space-y-2">
                <Label htmlFor="journal-no">Nomor Jurnal</Label>
                <Input id="journal-no" value={journalData.journal_no} onChange={e => handleFieldChange('journal_no', e.target.value)} placeholder="Otomatis jika kosong"/>
              </div>
              
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="description">Keterangan</Label>
                <Textarea id="description" value={journalData.description} onChange={e => handleFieldChange('description', e.target.value)} placeholder="Contoh: Pembelian ATK bulan September" required/>
              </div>

              <div className="md:col-span-2 space-y-4">
                {transactionType === 'manual' ? renderManualForm() : renderSimpleForm()}
              </div>
            </div>
        </div>
        
        {(transactionType === 'manual') && (
            <div className="p-4 mx-6 mt-4 bg-gray-50 rounded-lg space-y-2 border">
              <div className="flex justify-between font-medium"><span>Total Debit</span><span>{formatCurrency(totalDebit)}</span></div>
              <div className="flex justify-between font-medium"><span>Total Kredit</span><span className="text-right">{formatCurrency(totalCredit)}</span></div>
              <div className={`flex justify-between font-bold text-lg pt-2 border-t mt-2 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                <span>Keseimbangan</span><span>{formatCurrency(totalDebit - totalCredit)}</span>
              </div>
            </div>
        )}
      </form>
      <DialogFooter className="p-6 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onSave}>Batal</Button>
        <Button type="submit" form="journal-form" disabled={isSubmitting || !isBalanced}>{isSubmitting ? 'Menyimpan...' : (isBalanced ? 'Simpan' : 'Jurnal Tidak Seimbang')}</Button>
      </DialogFooter>
    </>
  );
};

const TransactionsPage = () => {
  const { chartOfAccounts, transactions, loading, refreshData, closedPeriods } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'viewer';
  
  const [isJournalDialogOpen, setIsJournalDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [previewTransaction, setPreviewTransaction] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [dateRange, setDateRange] = useState({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const canManageAll = userRole === 'admin' || userRole === 'finance';

  const isDateInClosedPeriod = useCallback((date) => {
    if (!date || !closedPeriods || closedPeriods.length === 0) return false;
    const txDate = new Date(date);
    return closedPeriods.some(p => {
        const startDate = new Date(p.start_date);
        const endDate = new Date(p.end_date);
        return txDate >= startOfDay(startDate) && txDate <= endOfDay(endDate);
    });
  }, [closedPeriods]);

  useEffect(() => {
    if (location.state?.action) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate]);

  const filteredTransactions = useMemo(() => {
    return transactions.map(t => {
      const txDate = new Date(t.date);
      const searchMatch = searchTerm ? (t.description.toLowerCase().includes(searchTerm.toLowerCase()) || (t.journal_no && t.journal_no.toLowerCase().includes(searchTerm.toLowerCase()))) : true;
      const accountMatch = filterAccount !== 'all' ? t.journal_entries.some(je => je.account_id === filterAccount) : true;
      const dateMatch = dateRange.from && dateRange.to ? txDate >= startOfDay(dateRange.from) && txDate <= endOfDay(dateRange.to) : true;
      
      return {
        ...t,
        isLocked: isDateInClosedPeriod(t.date),
        isVisible: searchMatch && accountMatch && dateMatch,
      };
    }).filter(t => t.isVisible);
  }, [transactions, searchTerm, filterAccount, dateRange, isDateInClosedPeriod]);
  
  const handleSave = async () => {
      await refreshData();
      setIsJournalDialogOpen(false);
      setEditingTransaction(null);
  };

  const handleEdit = (transaction) => {
    if (transaction.isLocked) {
        toast({ variant: 'destructive', title: 'Transaksi Terkunci', description: 'Periode transaksi ini sudah ditutup dan tidak dapat diubah.' });
        return;
    }
    setEditingTransaction(transaction);
    setIsJournalDialogOpen(true);
  };

  const handleNewJournal = () => {
    setEditingTransaction(null);
    setIsJournalDialogOpen(true);
  };

  const handleDelete = async (transaction) => {
    if (transaction.isLocked) {
        toast({ variant: 'destructive', title: 'Transaksi Terkunci', description: 'Periode transaksi ini sudah ditutup dan tidak dapat dihapus.' });
        return;
    }
    const isConfirmed = window.confirm("Apakah Anda yakin ingin menghapus transaksi ini? Jika transaksi ini terkait pengeluaran barang, stok akan dikembalikan. Aksi ini tidak dapat dibatalkan.");
    if (!isConfirmed) return;

    const { error } = await supabase.rpc('delete_transaction_and_material_issue', { p_transaction_id: transaction.id });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sukses', description: 'Transaksi berhasil dihapus dan stok (jika ada) telah dikembalikan.' });
      await refreshData();
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 2 }).format(amount);

  const handlePreview = (transaction) => {
    setPreviewTransaction(transaction);
  };

  const exportData = (format) => {
    const dataToExport = filteredTransactions.flatMap(t => t.journal_entries.map(je => ({ 'No. Jurnal': t.journal_no, 'Tanggal': formatDateFn(new Date(t.date), 'dd MMMM yyyy', { locale: dateFnsId }), 'Keterangan': t.description, 'Akun': `${je.account.code} - ${je.account.name}`, 'Debit': je.debit, 'Kredit': je.credit, })));
    const period = `${formatDateFn(dateRange.from, 'dd-MM-yy')} - ${formatDateFn(dateRange.to, 'dd-MM-yy')}`;
    if (format === 'xlsx') { const ws = utils.json_to_sheet(dataToExport); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, 'Jurnal Umum'); writeFile(wb, `Jurnal-Umum-${period}.xlsx`); } 
    else if (format === 'pdf') { const doc = new jsPDF(); doc.text('Jurnal Umum', 14, 16); doc.text(`Periode: ${period}`, 14, 22); doc.autoTable({ head: [['No. Jurnal', 'Tanggal', 'Keterangan', 'Akun', 'Debit', 'Kredit']], body: dataToExport.map(item => [item['No. Jurnal'], item['Tanggal'], item['Keterangan'], item['Akun'], formatCurrency(item['Debit']), formatCurrency(item['Kredit'])]), startY: 30 }); doc.save(`Jurnal-Umum-${period}.pdf`); }
    toast({ title: `Ekspor ${format.toUpperCase()} Berhasil`, description: `File laporan telah diunduh.` });
  };

  const availableAccounts = useMemo(() => chartOfAccounts.sort((a, b) => a.code.localeCompare(b.code)), [chartOfAccounts]);

  const totalPreviewDebit = useMemo(() => {
    if (!previewTransaction) return 0;
    return previewTransaction.journal_entries.reduce((sum, je) => sum + je.debit, 0);
  }, [previewTransaction]);

  return (
    <>
      <Helmet><title>Jurnal Umum - Sistem Keuangan</title></Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-2xl font-bold text-gray-900">Jurnal Umum</h1><p className="text-gray-500">Kelola semua entri jurnal transaksi.</p></div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="icon" onClick={refreshData} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
            <Button type="button" onClick={handleNewJournal}><Plus className="h-4 w-4 mr-2" />Buat Jurnal</Button>
            
            <Popover><PopoverTrigger asChild><Button type="button" variant="outline"><Download className="h-4 w-4 mr-2" /> Ekspor</Button></PopoverTrigger><PopoverContent className="w-auto p-2"><div className="flex flex-col space-y-1"><Button type="button" variant="ghost" className="justify-start" onClick={() => exportData('xlsx')}><FileSpreadsheet className="h-4 w-4 mr-2" />Ekspor ke Excel (XLSX)</Button><Button type="button" variant="ghost" className="justify-start" onClick={() => exportData('pdf')}><FileText className="h-4 w-4 mr-2" />Ekspor ke PDF</Button></div></PopoverContent></Popover>
          </div>
        </div>

        <Dialog open={isJournalDialogOpen} onOpenChange={(open) => { if (!open) setEditingTransaction(null); setIsJournalDialogOpen(open); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>{editingTransaction ? 'Edit Jurnal' : 'Buat Jurnal Baru'}</DialogTitle>
              <DialogDescription>
                {editingTransaction ? 'Ubah detail transaksi jurnal yang sudah ada.' : 'Pilih jenis transaksi atau gunakan mode manual untuk entri yang kompleks.'}
              </DialogDescription>
            </DialogHeader>
            <JournalForm onSave={handleSave} editingTransaction={editingTransaction} />
          </DialogContent>
        </Dialog>

        <Dialog open={!!previewTransaction} onOpenChange={(open) => { if (!open) setPreviewTransaction(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Pratinjau Jurnal: {previewTransaction?.journal_no}</DialogTitle>
              <DialogDescription>
                {formatDateFn(new Date(previewTransaction?.date || new Date()), 'd MMMM yyyy', { locale: dateFnsId })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="font-semibold">Keterangan</Label>
                <p className="text-sm text-gray-700">{previewTransaction?.description}</p>
              </div>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Akun</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Kredit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewTransaction?.journal_entries.map(je => (
                      <TableRow key={je.id}>
                        <TableCell>{je.account.code} - {je.account.name}</TableCell>
                        <TableCell className="text-right">{je.debit > 0 ? formatCurrency(je.debit) : '-'}</TableCell>
                        <TableCell className="text-right">{je.credit > 0 ? formatCurrency(je.credit) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end font-bold text-lg pt-2 border-t mt-2">
                <div className="w-1/2 text-right pr-4">Total:</div>
                <div className="w-1/2 text-right">{formatCurrency(totalPreviewDebit)}</div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewTransaction(null)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Card><CardContent className="p-6"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"><Input placeholder="Cari No. Jurnal atau Keterangan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-white" /><Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className="w-full justify-start text-left font-normal bg-white"><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? (<>{formatDateFn(dateRange.from, "LLL dd, y")} - {formatDateFn(dateRange.to, "LLL dd, y")}</>) : (formatDateFn(dateRange.from, "LLL dd, y"))) : (<span>Pilih tanggal</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent></Popover><Select value={filterAccount} onValueChange={setFilterAccount}><SelectTrigger className="bg-white"><SelectValue placeholder="Filter Akun..."/></SelectTrigger><SelectContent><SelectItem value="all">Semua Akun</SelectItem>{availableAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>

        {loading ? <p className="text-center py-10">Memuat transaksi...</p> : 
         filteredTransactions.length === 0 ? <EmptyState icon={CreditCard} title="Belum Ada Transaksi" description="Tidak ada transaksi yang cocok dengan filter Anda. Coba filter lain atau tambahkan transaksi baru." actionText="Buat Jurnal Baru" onActionClick={handleNewJournal} /> :
         (<Card><CardHeader><CardTitle>Daftar Transaksi</CardTitle><CardDescription>{filteredTransactions.length} transaksi ditemukan.</CardDescription></CardHeader><CardContent><div className="space-y-4">{filteredTransactions.map((tx, index) => (<motion.div key={tx.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={`p-4 rounded-lg border ${tx.isLocked ? 'bg-gray-100' : 'bg-gray-50'}`}><div className="flex items-start justify-between"><div><p className="text-xs text-gray-500">{tx.journal_no}</p><h4 className="font-medium">{tx.description}</h4><p className="text-sm text-gray-500">{new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div><div className="flex items-center space-x-2"><p className="font-bold text-gray-800">{formatCurrency(tx.journal_entries.find(je => je.debit > 0)?.debit || 0)}</p>{canManageAll && (tx.isLocked ? <Lock className="h-4 w-4 text-gray-500" /> : <><Button type="button" size="sm" variant="outline" onClick={() => handlePreview(tx)}><Eye className="h-3 w-3" /></Button><Button type="button" size="sm" variant="outline" onClick={() => handleEdit(tx)}><Edit className="h-3 w-3" /></Button><Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(tx)}><Trash2 className="h-3 w-3" /></Button></>)}</div></div><div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-1">{tx.journal_entries.map(je => (<div key={je.id} className="flex justify-between text-sm"><p className="text-gray-600">{je.account.code} - {je.account.name}</p><div className="flex"><p className="text-green-600 w-28 text-right">{je.debit > 0 ? formatCurrency(je.debit) : ''}</p><p className="text-red-600 w-28 text-right">{je.credit > 0 ? formatCurrency(je.credit) : ''}</p></div></div>))}</div></motion.div>))}</div></CardContent></Card>)}
      </div>
    </>
  );
};

export default TransactionsPage;
  