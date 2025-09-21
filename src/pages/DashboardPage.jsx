import React, { useMemo, useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Helmet } from 'react-helmet';
    import { 
      TrendingUp, 
      DollarSign, 
      FileText,
      ShoppingCart,
      Users,
      FileCheck,
      Briefcase,
      HardHat
    } from 'lucide-react';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
    import { useData } from '@/contexts/DataContext';
    import { useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';

    const DashboardPage = () => {
      const { salesOrders, invoicePayments, quotations, customers, liabilities, workOrders, loading: dataLoading } = useData();
      const navigate = useNavigate();
      const { toast } = useToast();

      const [chartView, setChartView] = useState('monthly');
      const [chartData, setChartData] = useState([]);
      const [chartLoading, setChartLoading] = useState(false);
      const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
      const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

      const fetchChartData = useCallback(async () => {
        setChartLoading(true);
        let rpcName = '';
        let params = {};

        if (chartView === 'monthly') {
            rpcName = 'get_monthly_chart_data';
            params = { p_year: selectedYear, p_month: selectedMonth };
        } else { // yearly
            rpcName = 'get_yearly_chart_data';
            params = { p_year: selectedYear };
        }

        const { data, error } = await supabase.rpc(rpcName, params);

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal memuat data grafik', description: error.message });
            setChartData([]);
        } else {
            setChartData(data);
        }
        setChartLoading(false);
    }, [chartView, selectedYear, selectedMonth, toast]);

    useEffect(() => {
        if (!dataLoading) {
            fetchChartData();
        }
    }, [dataLoading, fetchChartData]);

      const stats = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const salesThisMonth = salesOrders.filter(so => {
            const soDate = new Date(so.order_date);
            return soDate.getMonth() === currentMonth && soDate.getFullYear() === currentYear;
        });
        const totalSales = salesThisMonth.reduce((sum, so) => sum + so.total_amount, 0);

        const paymentsThisMonth = invoicePayments.filter(p => {
            const paymentDate = new Date(p.payment_date);
            return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
        });
        const totalPaid = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0);
        
        const openWOs = workOrders ? workOrders.filter(wo => !['Terkirim', 'Closed'].includes(wo.status)).length : 0;
        
        return {
          totalSales,
          totalPaid,
          openWorkOrders: openWOs,
          newCustomers: customers.filter(c => {
             const createdDate = new Date(c.created_at);
             return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
          }).length,
          totalLiabilities: liabilities.reduce((sum, l) => sum + l.balance, 0),
          quotationsSent: quotations.filter(q => {
             const createdDate = new Date(q.created_at);
             return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
          }).length
        };
      }, [salesOrders, invoicePayments, customers, liabilities, quotations, workOrders]);

      const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0
        }).format(amount || 0);
      };

      const statCards = [
        { title: 'Penjualan (Bulan Ini)', value: formatCurrency(stats.totalSales), icon: ShoppingCart, color: 'text-indigo-600', bgColor: 'bg-indigo-100', link: '/sales/orders' },
        { title: 'Pembayaran Diterima', value: formatCurrency(stats.totalPaid), icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-100', link: '/finance/cash-bank-book' },
        { title: 'Work Order Open', value: stats.openWorkOrders, icon: HardHat, color: 'text-red-600', bgColor: 'bg-red-100', link: '/manufacture/work-orders' },
        { title: 'Pelanggan Baru', value: stats.newCustomers, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100', link: '/sales/customers' },
        { title: 'Quotation Terkirim', value: stats.quotationsSent, icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100', link: '/sales/quotations' },
        { title: 'Total Hutang Usaha', value: formatCurrency(stats.totalLiabilities), icon: Briefcase, color: 'text-orange-600', bgColor: 'bg-orange-100', link: '/finance/liabilities' },
      ];

      const hasData = chartData && chartData.length > 0;
      const years = Array.from(new Set(salesOrders.map(so => new Date(so.order_date).getFullYear()))).sort((a, b) => b - a);
      if (years.length === 0) years.push(new Date().getFullYear());
      const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(0, i).toLocaleString('id-ID', { month: 'long' }) }));

      const StatCard = ({ card }) => {
        const Icon = card.icon;
        return (
             <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5 }}
                className="cursor-pointer"
                onClick={() => card.link && navigate(card.link)}
            >
                <Card className="glass-effect border-gray-200 h-full">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 mb-1">{card.title}</p>
                                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                            </div>
                            <div className={`p-3 rounded-full ${card.bgColor}`}>
                                <Icon className={`h-6 w-6 ${card.color}`} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
      };

      return (
        <>
          <Helmet>
            <title>Dashboard - Sistem ERP Trimatrakarya</title>
            <meta name="description" content="Dashboard utama sistem ERP Trimatrakarya dengan ringkasan statistik." />
          </Helmet>
          
            <div className="space-y-6">
              {dataLoading ? (
                 <div className="text-center py-10">Memuat data dashboard...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {statCards.map((stat) => <StatCard key={stat.title} card={stat} />)}
                  </div>
                   
                  {(stats.totalSales === 0 && stats.totalPaid === 0) && (
                        <Card>
                            <CardContent className="p-6 text-center text-gray-500">
                                Belum ada transaksi bulan ini.
                            </CardContent>
                        </Card>
                    )}

                  <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Card className="glass-effect border-gray-200">
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <CardTitle className="text-gray-900">Pemasukan vs Pengeluaran (dari Jurnal)</CardTitle>
                                    <CardDescription className="text-gray-500">
                                        Perbandingan berdasarkan periode yang dipilih dari Jurnal Umum.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                     <Select value={chartView} onValueChange={setChartView}>
                                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="monthly">Bulanan</SelectItem>
                                            <SelectItem value="yearly">Tahunan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                     <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {years.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {chartView === 'monthly' && (
                                        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {months.map(month => <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {chartLoading ? <div className="h-[300px] flex items-center justify-center">Memuat data grafik...</div> : 
                             !hasData ? <div className="h-[300px] flex items-center justify-center text-gray-500">Belum ada data untuk periode ini</div> : (
                              <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                  <XAxis dataKey={chartView === 'monthly' ? 'day' : 'month'} stroke="#9ca3af" />
                                  <YAxis stroke="#9ca3af" tickFormatter={(value) => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(value)} />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                    formatter={(value, name) => [formatCurrency(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                                  />
                                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} name="Pemasukan" dot={{ r: 5 }} activeDot={{ r: 8 }}/>
                                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} name="Pengeluaran" dot={{ r: 5 }} activeDot={{ r: 8 }}/>
                                </LineChart>
                              </ResponsiveContainer>
                            )}
                        </CardContent>
                      </Card>
                    </motion.div>
                </>
              )}
            </div>
        </>
      );
    };

    export default DashboardPage;