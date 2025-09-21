import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Package, PackageCheck, PackageX, DollarSign, TrendingUp } from 'lucide-react';
import useDebounce from '@/hooks/useDebounce';
import EmptyState from '@/components/EmptyState';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
const RELEVANT_CATEGORIES = ["Barang Jadi", "Setengah Jadi"];

const SalesProductsPage = () => {
    const { products, loading } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const relevantItems = useMemo(() => {
        if (!products) return [];
        return products.filter(item => item.category_name && RELEVANT_CATEGORIES.includes(item.category_name));
    }, [products]);

    const filteredItems = useMemo(() => {
        if (!relevantItems) return [];
        const term = debouncedSearchTerm.toLowerCase();
        if (!term) return relevantItems;

        return relevantItems.filter(item => {
            return (
                item.name.toLowerCase().includes(term) ||
                item.model_no?.toLowerCase().includes(term) ||
                item.category_name?.toLowerCase().includes(term)
            );
        });
    }, [relevantItems, debouncedSearchTerm]);

    const getStockStatus = (item) => {
        const stock = item.stock ?? 0;
        const threshold = item.low_stock_threshold ?? 0;
        if (stock <= 0) {
            return { label: 'Stok Habis', icon: PackageX, color: 'bg-red-200 text-red-800' };
        }
        if (threshold > 0 && stock <= threshold) {
            return { label: 'Stok Rendah', icon: PackageX, color: 'bg-yellow-200 text-yellow-800' };
        }
        return { label: 'Tersedia', icon: PackageCheck, color: 'bg-green-200 text-green-800' };
    };

    if (loading) {
        return <div className="text-center py-10">Memuat daftar produk...</div>;
    }

    return (
        <>
            <Helmet>
                <title>Daftar Produk - Sales</title>
                <meta name="description" content="Lihat daftar produk lengkap dengan informasi stok dan harga." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Daftar Produk Sales</h1>
                        <p className="text-gray-500">Informasi produk, stok, dan harga untuk tim penjualan.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                             <CardTitle>Produk Tersedia</CardTitle>
                             <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari produk (nama, model, kategori)..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredItems.length === 0 ? (
                            <EmptyState 
                                icon={Package}
                                title={searchTerm ? "Produk Tidak Ditemukan" : "Belum Ada Produk Relevan"}
                                description={searchTerm ? `Tidak ada produk yang cocok dengan "${debouncedSearchTerm}".` : "Tidak ada produk dengan kategori 'Barang Jadi' atau 'Barang Setengah Jadi'."}
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produk</TableHead>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead className="text-center">Status Stok</TableHead>
                                            <TableHead className="text-right">Harga Jual</TableHead>
                                            <TableHead className="text-right">HPP</TableHead>
                                            <TableHead className="text-right">Margin</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredItems.map(item => {
                                            const stockStatus = getStockStatus(item);
                                            const price = item.standard_price || 0;
                                            const cost = item.standard_cost || 0;
                                            const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            {item.image_url ? (
                                                                <img src={item.image_url} alt={item.name} className="h-10 w-10 object-cover rounded-md" />
                                                            ) : (
                                                                <div className="h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                                                                    <Package className="h-5 w-5 text-gray-400"/>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="font-bold">{item.name}</p>
                                                                <p className="text-xs text-muted-foreground">{item.model_no || item.code}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{item.category_name || 'N/A'}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className={`gap-1 ${stockStatus.color} border-0`}>
                                                            <stockStatus.icon className="h-3 w-3" />
                                                            {stockStatus.label} ({item.stock ?? 0} {item.unit})
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-green-600">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <DollarSign className="h-4 w-4 opacity-70"/> {formatCurrency(price)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-red-600">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <DollarSign className="h-4 w-4 opacity-70"/> {formatCurrency(cost)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-blue-600">
                                                         <div className="flex items-center justify-end gap-1">
                                                            <TrendingUp className="h-4 w-4 opacity-70"/> {margin.toFixed(1)}%
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default SalesProductsPage;