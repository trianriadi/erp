import React, { useMemo } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import { SlidersHorizontal, FileText, Package, ListChecks } from 'lucide-react';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { useData } from '@/contexts/DataContext';
    import { Button } from '@/components/ui/button';

    const EngineeringDashboard = () => {
        const { products, boms, workOrders, loading } = useData();
        const navigate = useNavigate();

        const stats = useMemo(() => {
            if (loading) return { totalProducts: 0, totalBOMs: 0, pendingWOs: 0 };
            return {
                totalProducts: products.length,
                totalBOMs: boms.length,
                pendingWOs: workOrders.filter(wo => wo.engineering_status === 'Pending Approval').length,
            };
        }, [products, boms, workOrders, loading]);

        const statCards = [
            { title: 'Total Produk Manufaktur', value: stats.totalProducts, icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100', link: '/engineering/products' },
            { title: 'Total Bill of Materials', value: stats.totalBOMs, icon: FileText, color: 'text-green-600', bgColor: 'bg-green-100', link: '/engineering/boms' },
            { title: 'Work Order Pending Approval', value: stats.pendingWOs, icon: ListChecks, color: 'text-yellow-600', bgColor: 'bg-yellow-100', link: '/engineering/work-orders' },
        ];

        const quickLinks = [
            { title: 'Manajemen Produk', icon: Package, link: '/engineering/products' },
            { title: 'Manajemen BOM', icon: FileText, link: '/engineering/boms' },
            { title: 'Work Orders', icon: ListChecks, link: '/engineering/work-orders' },
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

        if (loading) {
            return <div className="text-center py-10">Memuat data dashboard...</div>;
        }

        return (
            <>
                <Helmet>
                    <title>Dashboard Engineering - Sistem ERP</title>
                    <meta name="description" content="Dashboard untuk departemen Engineering." />
                </Helmet>
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold">Dashboard Engineering</h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {statCards.map((stat) => <StatCard key={stat.title} card={stat} />)}
                    </div>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Akses Cepat</CardTitle>
                            <CardDescription>Navigasi cepat ke menu-menu penting di departemen Engineering.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                </div>
            </>
        );
    };

    export default EngineeringDashboard;