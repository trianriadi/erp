import React, { useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Helmet } from 'react-helmet';
    import { useNavigate } from 'react-router-dom';
    import { 
      Package, Send, ShoppingCart, Users, AlertTriangle, FilePlus, PackageSearch, Truck, ChevronsRight
    } from 'lucide-react';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { useData } from '@/contexts/DataContext';
    import EmptyState from '@/components/EmptyState';

    const InventoryDashboard = () => {
        const { items, purchaseRequests, purchaseOrders, suppliers, loading, goodsReceipts } = useData();
        const navigate = useNavigate();

        const stats = useMemo(() => {
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            const receivingThisMonth = goodsReceipts ? goodsReceipts.filter(gr => {
                const receiptDate = new Date(gr.receipt_date);
                return receiptDate.getMonth() === currentMonth && receiptDate.getFullYear() === currentYear;
            }).length : 0;

            return {
                totalStockItems: items.length,
                pendingRequests: purchaseRequests.filter(pr => pr.status === 'pending').length,
                approvedRequests: purchaseRequests.filter(pr => pr.status === 'approved').length,
                openPurchaseOrders: purchaseOrders.filter(po => po.status !== 'closed' && po.status !== 'received').length,
                lowStockItems: 0, // Placeholder, logic needs to be implemented
                totalSuppliers: suppliers.length,
                receivingThisMonth,
            };
        }, [items, purchaseRequests, purchaseOrders, suppliers, goodsReceipts]);
        
        const hasData = items.length > 0 || purchaseRequests.length > 0 || purchaseOrders.length > 0 || suppliers.length > 0;
        
        const statCards = [
            { title: 'Jenis Barang di Gudang', value: stats.totalStockItems, icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100', link: '/inventory/items' },
            { title: 'Permintaan Pending', value: stats.pendingRequests, icon: Send, color: 'text-yellow-600', bgColor: 'bg-yellow-100', link: '/inventory/requests' },
            { title: 'Purchase Order Open', value: stats.openPurchaseOrders, icon: ShoppingCart, color: 'text-green-600', bgColor: 'bg-green-100', link: '/inventory/purchase-orders' },
            { title: 'Penerimaan Bulan Ini', value: stats.receivingThisMonth, icon: Truck, color: 'text-cyan-600', bgColor: 'bg-cyan-100', link: '/dashboard/receiving-monitor' },
            { title: 'Stok Hampir Habis', value: stats.lowStockItems, icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100', link: '/inventory/items' },
            { title: 'Total Supplier', value: stats.totalSuppliers, icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-100', link: '/inventory/suppliers' },
        ];
        
        const quickLinks = [
            { title: 'Buat Permintaan Barang', icon: FilePlus, link: '/inventory/requests' },
            { title: 'Cek Stok Barang', icon: PackageSearch, link: '/inventory/items' },
            { title: 'Buat Purchase Order', icon: ShoppingCart, link: '/inventory/purchase-orders' },
            { title: 'Pengeluaran Barang', icon: ChevronsRight, link: '/inventory/material-issues' },
        ];

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
                    <title>Dashboard Inventory - Sistem ERP Trimatrakarya</title>
                    <meta name="description" content="Dashboard modul Inventory & Purchasing." />
                </Helmet>
                
                <div className="space-y-6">
                    {loading ? (
                        <div className="text-center py-10">Memuat data dashboard...</div>
                    ) : !hasData ? (
                        <EmptyState
                            icon={Package}
                            title="Selamat Datang di Modul Inventory!"
                            description="Belum ada data barang, supplier, atau transaksi. Mari mulai dengan menambahkan master barang pertama Anda."
                            actionText="Tambah Master Barang"
                            onActionClick={() => navigate('/inventory/items')}
                        />
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {statCards.map((stat) => <StatCard key={stat.title} card={stat} />)}
                            </div>
                            
                           {(stats.totalStockItems === 0 && stats.pendingRequests === 0 && stats.openPurchaseOrders === 0 && stats.receivingThisMonth === 0) && (
                                <Card>
                                    <CardContent className="p-6 text-center text-gray-500">
                                        Belum ada data bulan ini.
                                    </CardContent>
                                </Card>
                            )}

                            <Card>
                                <CardHeader>
                                    <CardTitle>Akses Cepat</CardTitle>
                                    <CardDescription>Navigasi cepat ke menu-menu penting.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        {quickLinks.map((link, index) => {
                                            const Icon = link.icon;
                                            return (
                                                <motion.div
                                                  key={link.title}
                                                  initial={{ opacity: 0, scale: 0.9 }}
                                                  animate={{ opacity: 1, scale: 1 }}
                                                  transition={{ delay: 0.1 * index }}
                                                >
                                                    <Button variant="outline" className="w-full h-24 text-left justify-start flex-col items-start p-4" onClick={() => navigate(link.link)}>
                                                        <Icon className="h-6 w-6 mb-2 text-blue-600" />
                                                        <span className="font-semibold">{link.title}</span>
                                                    </Button>
                                                </motion.div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </>
        );
    };

    export default InventoryDashboard;