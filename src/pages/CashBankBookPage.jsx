
import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Helmet } from 'react-helmet';
    import { Download, FileText, FileSpreadsheet, Calendar as CalendarIcon, Search, Landmark } from 'lucide-react';
    import { format as formatDateFn, startOfMonth, endOfDay } from 'date-fns';
    import { id as dateFnsId } from 'date-fns/locale';
    import { utils, writeFile } from 'xlsx';
    import jsPDF from 'jspdf';
    import 'jspdf-autotable';
    
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Calendar } from '@/components/ui/calendar';
    import { toast } from '@/components/ui/use-toast';
    import EmptyState from '@/components/EmptyState';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useData } from '@/contexts/DataContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import useDebounce from '@/hooks/useDebounce';

    const CashBankBookPage = () => {
      const { accounts: cashBankAccounts } = useData();
      const { user } = useAuth();
      
      const [selectedAccount, setSelectedAccount] = useState('');
      const [dateRange, setDateRange] = useState({ from: startOfMonth(new Date()), to: endOfDay(new Date()) });
      const [searchTerm, setSearchTerm] = useState('');
      const [reportData, setReportData] = useState([]);
      const [loading, setLoading] = useState(false);
      const [totals, setTotals] = useState({ debit: 0, credit: 0, finalBalance: 0 });

      const debouncedSearchTerm = useDebounce(searchTerm, 300);

      const fetchReportData = useCallback(async () => {
        if (!selectedAccount || !dateRange.from || !dateRange.to || !user) {
          setReportData([]);
          return;
        }
        
        setLoading(true);
        const { data, error } = await supabase.rpc('get_cash_bank_book', {
          p_account_id: selectedAccount,
          p_start_date: formatDateFn(dateRange.from, 'yyyy-MM-dd'),
          p_end_date: formatDateFn(dateRange.to, 'yyyy-MM-dd')
        });

        if (error) {
          toast({ variant: 'destructive', title: 'Gagal memuat laporan', description: error.message });
          setReportData([]);
        } else {
          setReportData(data || []);
        }
        setLoading(false);
      }, [selectedAccount, dateRange, user]);

      useEffect(() => {
        if (cashBankAccounts.length > 0 && !selectedAccount) {
          setSelectedAccount(cashBankAccounts[0].id);
        }
      }, [cashBankAccounts, selectedAccount]);

      useEffect(() => {
        fetchReportData();
      }, [fetchReportData]);
      
      const filteredReportData = useMemo(() => {
        return reportData.filter(item => {
          if (item.description === 'Saldo Awal') return true;
          const searchMatch = debouncedSearchTerm 
            ? item.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
              item.journal_no?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            : true;
          return searchMatch;
        });
      }, [reportData, debouncedSearchTerm]);

      useEffect(() => {
        if (filteredReportData.length > 0) {
          const totalDebit = filteredReportData.reduce((sum, item) => sum + (item.description !== 'Saldo Awal' ? Number(item.debit) : 0), 0);
          const totalCredit = filteredReportData.reduce((sum, item) => sum + (item.description !== 'Saldo Awal' ? Number(item.credit) : 0), 0);
          const finalBalance = filteredReportData[filteredReportData.length - 1]?.running_balance || 0;
          setTotals({ debit: totalDebit, credit: totalCredit, finalBalance: finalBalance });
        } else {
          setTotals({ debit: 0, credit: 0, finalBalance: 0 });
        }
      }, [filteredReportData]);

      const formatCurrency = (amount) => {
        const number = Number(amount);
        if (isNaN(number)) return 'Rp 0,00';
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 2 }).format(number);
      };

      const exportData = (format) => {
        if (filteredReportData.length === 0) {
          toast({ variant: 'destructive', title: 'Tidak ada data untuk diekspor' });
          return;
        }

        const accountName = cashBankAccounts.find(a => a.id === selectedAccount)?.name || 'Akun';
        const period = `${formatDateFn(dateRange.from, 'dd-MM-yy')} - ${formatDateFn(dateRange.to, 'dd-MM-yy')}`;
        
        const dataToExport = filteredReportData.map(item => ({
          'Tanggal': formatDateFn(new Date(item.date), 'dd MMMM yyyy', { locale: dateFnsId }),
          'No. Jurnal': item.journal_no,
          'Keterangan': item.description,
          'Debit': Number(item.debit),
          'Kredit': Number(item.credit),
          'Saldo': Number(item.running_balance)
        }));

        if (format === 'xlsx') {
          const ws = utils.json_to_sheet([]);
          const wb = utils.book_new(); 
          utils.sheet_add_aoa(ws, [
            ["Buku Kas/Bank: " + accountName],
            ["Periode: " + period],
            []
          ], { origin: "A1" });
          ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
          utils.sheet_add_json(ws, dataToExport, { origin: 'A4' });
          utils.book_append_sheet(wb, ws, 'Buku Kas Bank');
          writeFile(wb, `Buku-Kas-Bank-${accountName}-${period}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.setFontSize(16);
          doc.text(`Buku Kas / Bank - ${accountName}`, 14, 16);
          doc.setFontSize(10);
          doc.text(`Periode: ${period}`, 14, 22);

          doc.autoTable({
            head: [['Tanggal', 'No. Jurnal', 'Keterangan', 'Debit', 'Kredit', 'Saldo']],
            body: dataToExport.map(item => [
              item['Tanggal'],
              item['No. Jurnal'],
              item['Keterangan'],
              formatCurrency(item['Debit']),
              formatCurrency(item['Kredit']),
              formatCurrency(item['Saldo'])
            ]),
            foot: [
                ['', '', 'Total', formatCurrency(totals.debit), formatCurrency(totals.credit), ''],
                ['', '', 'Saldo Akhir', '', '', formatCurrency(totals.finalBalance)],
            ],
            startY: 30,
            headStyles: { fillColor: [22, 160, 133] },
            footStyles: { fillColor: [241, 243, 244], textColor: 50, fontStyle: 'bold' }
          });
          doc.save(`Buku-Kas-Bank-${accountName}-${period}.pdf`);
        }
        toast({ title: `Ekspor ${format.toUpperCase()} Berhasil`, description: 'File laporan telah diunduh.' });
      };

      return (
        <>
          <Helmet>
            <title>Buku Kas & Bank - Sistem Keuangan</title>
            <meta name="description" content="Lacak transaksi dan saldo berjalan untuk setiap rekening kas dan bank." />
          </Helmet>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Buku Kas & Bank</h1>
                <p className="text-gray-500">Monitor transaksi dan saldo untuk rekening kas dan bank Anda.</p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Ekspor</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="flex flex-col space-y-1">
                    <Button variant="ghost" className="justify-start" onClick={() => exportData('xlsx')}><FileSpreadsheet className="h-4 w-4 mr-2" />Ekspor ke Excel</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => exportData('pdf')}><FileText className="h-4 w-4 mr-2" />Ekspor ke PDF</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Akun Kas/Bank..." /></SelectTrigger>
                    <SelectContent>
                      {cashBankAccounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button id="date" variant={"outline"} className="w-full justify-start text-left font-normal bg-white">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (dateRange.to ? (<>{formatDateFn(dateRange.from, "d LLL y")} - {formatDateFn(dateRange.to, "d LLL y")}</>) : (formatDateFn(dateRange.from, "d LLL y"))) : (<span>Pilih tanggal</span>)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                    </PopoverContent>
                  </Popover>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Cari keterangan atau no. jurnal..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Laporan Buku Bank</CardTitle>
                <CardDescription>
                  Menampilkan transaksi untuk akun <span className="font-semibold">{cashBankAccounts.find(a => a.id === selectedAccount)?.name || '...'}</span> dari periode {dateRange.from && formatDateFn(dateRange.from, 'd MMM yyyy')} sampai {dateRange.to && formatDateFn(dateRange.to, 'd MMM yyyy')}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3 text-left font-medium text-gray-600">Tanggal</th>
                        <th className="p-3 text-left font-medium text-gray-600">No. Jurnal</th>
                        <th className="p-3 text-left font-medium text-gray-600">Keterangan</th>
                        <th className="p-3 text-right font-medium text-gray-600">Debit</th>
                        <th className="p-3 text-right font-medium text-gray-600">Kredit</th>
                        <th className="p-3 text-right font-medium text-gray-600">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan="6" className="text-center p-6 text-gray-500">Memuat data laporan...</td></tr>
                      ) : filteredReportData.length > 0 ? (
                        filteredReportData.map((item, index) => (
                          <motion.tr
                            key={index}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className={`border-b ${item.description === 'Saldo Awal' ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'}`}
                          >
                            <td className="p-3 whitespace-nowrap">{formatDateFn(new Date(item.date), 'd MMM yyyy')}</td>
                            <td className="p-3">{item.journal_no}</td>
                            <td className="p-3">{item.description}</td>
                            <td className="p-3 text-right text-green-600">{Number(item.debit) > 0 ? formatCurrency(item.debit) : '-'}</td>
                            <td className="p-3 text-right text-red-600">{Number(item.credit) > 0 ? formatCurrency(item.credit) : '-'}</td>
                            <td className={`p-3 text-right font-medium ${Number(item.running_balance) < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              {formatCurrency(item.running_balance)}
                            </td>
                          </motion.tr>
                        ))
                      ) : (
                        <tr><td colSpan="6" className="text-center p-0"><EmptyState icon={Landmark} title="Tidak Ada Data" description="Tidak ada transaksi ditemukan untuk akun dan periode yang dipilih." /></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              {filteredReportData.length > 0 && (
              <CardFooter className="bg-gray-50 p-4 rounded-b-lg grid grid-cols-3 gap-4 font-semibold">
                  <div className="text-right">
                      <p className="text-xs text-gray-500">Total Debit</p>
                      <p className="text-green-600">{formatCurrency(totals.debit)}</p>
                  </div>
                  <div className="text-right">
                      <p className="text-xs text-gray-500">Total Kredit</p>
                      <p className="text-red-600">{formatCurrency(totals.credit)}</p>
                  </div>
                  <div className="text-right">
                      <p className="text-xs text-gray-500">Saldo Akhir</p>
                      <p className={`${Number(totals.finalBalance) < 0 ? 'text-red-600' : 'text-gray-800'}`}>{formatCurrency(totals.finalBalance)}</p>
                  </div>
              </CardFooter>
              )}
            </Card>
          </div>
        </>
      );
    };

    export default CashBankBookPage;
  