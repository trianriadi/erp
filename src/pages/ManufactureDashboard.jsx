import React, { useMemo } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { HardHat, ListTodo, Hourglass, CheckCircle } from 'lucide-react';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { useData } from '@/contexts/DataContext';
    import { useNavigate } from 'react-router-dom';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Badge } from '@/components/ui/badge';
    import { format } from 'date-fns';
    import { id } from 'date-fns/locale';

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return format(new Date(dateStr), "d MMM yyyy", { locale: id });
    };

    const ManufactureDashboard = () => {
        const { workOrders, loading } = useData();
        const navigate = useNavigate();

        const stats = useMemo(() => {
            if (!workOrders) return { total: 0, inProgress: 0, inQueue: 0, completed: 0, recentWOs: [] };

            const total = workOrders.length;
            const inProgress = workOrders.filter(wo => wo.status === 'Proses' || wo.status === 'QC').length;
            const inQueue = workOrders.filter(wo => wo.status === 'Tunggu Antrian').length;
            const completed = workOrders.filter(wo => wo.status === 'Terkirim').length;
            const recentWOs = workOrders.filter(wo => !['Terkirim', 'Draft'].includes(wo.status)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

            return { total, inProgress, inQueue, completed, recentWOs };
        }, [workOrders]);

        const statCards = [
            { title: 'Total Work Order', value: stats.total, icon: ListTodo, color: 'text-blue-600', bgColor: 'bg-blue-100', link: '/manufacture/work-orders' },
            { title: 'Sedang Dikerjakan', value: stats.inProgress, icon: HardHat, color: 'text-indigo-600', bgColor: 'bg-indigo-100', link: '/manufacture/work-orders' },
            { title: 'Dalam Antrian', value: stats.inQueue, icon: Hourglass, color: 'text-yellow-600', bgColor: 'bg-yellow-100', link: '/manufacture/work-orders' },
            { title: 'Selesai & Terkirim', value: stats.completed, icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', link: '/manufacture/work-orders' },
        ];

        const StatCard = ({ card }) => {
            const Icon = card.icon;
            return (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -5 }}
                    className="cursor-pointer h-full"
                    onClick={() => card.link && navigate(card.link)}
                >
                    <Card className="glass-effect border-gray-200 h-full">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 mb-1">{card.title}</p>
                                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                            </div>
                            <div className={`p-4 rounded-full ${card.bgColor}`}>
                                <Icon className={`h-8 w-8 ${card.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            );
        };

        return (
            <>
                <Helmet>
                    <title>Dashboard Manufaktur</title>
                    <meta name="description" content="Dashboard untuk departemen manufaktur dan produksi." />
                </Helmet>
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold">Dashboard Manufaktur</h1>

                    {loading ? (
                        <p>Memuat data...</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {statCards.map(card => <StatCard key={card.title} card={card} />)}
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Work Order Prioritas (Terbaru)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No. WO</TableHead>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Status Produksi</TableHead>
                                                <TableHead>Tgl. Estimasi Kirim</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {stats.recentWOs.length > 0 ? stats.recentWOs.map(wo => (
                                                <TableRow key={wo.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate('/manufacture/work-orders', { state: { woId: wo.id } })}>
                                                    <TableCell className="font-medium">{wo.wo_number}</TableCell>
                                                    <TableCell>{wo.customer?.name || 'N/A'}</TableCell>
                                                    <TableCell><Badge variant="info">{wo.production_status}</Badge></TableCell>
                                                    <TableCell>{formatDate(wo.estimated_ship_date)}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center h-24">Tidak ada Work Order aktif.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </>
        );
    };

    export default ManufactureDashboard;