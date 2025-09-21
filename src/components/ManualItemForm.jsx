
    import React, { useState, useMemo, useEffect, useCallback } from 'react';
    import { useData } from '@/contexts/DataContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
    import { Checkbox } from '@/components/ui/checkbox';

    export const ManualItemForm = ({ onFinished, onCancel }) => {
        const { user } = useAuth();
        const { itemCategories, warehouses, refreshData } = useData();
        const { toast } = useToast();
        const [isSubmitting, setIsSubmitting] = useState(false);
        
        const [itemType, setItemType] = useState(null);
        const [specifications, setSpecifications] = useState({});
        const [manualName, setManualName] = useState('');
        const [formData, setFormData] = useState({
            code: '',
            unit: 'unit',
            category_id: null,
            standard_cost: '',
            warehouse_id: null,
            quantity_required: 1,
        });

        const resetLocalForm = () => {
            setManualName('');
            setItemType(null);
            setSpecifications({});
            setFormData({
                code: '',
                unit: 'unit',
                category_id: formData.category_id, // Keep category and warehouse for next entry
                standard_cost: '',
                warehouse_id: formData.warehouse_id,
                quantity_required: 1,
            });
        };

        const generatedDimensionString = useMemo(() => {
            if (!itemType) return '';
            let specString = '';
            switch (itemType) {
                case 'roundbar':
                    specString = `AS Ø${specifications.diameter || '...'}mm x ${specifications.panjang || '...'}mm`;
                    break;
                case 'plat':
                    specString = `Plat ${specifications.tebal || '...'}mm x ${specifications.panjang || '...'}mm x ${specifications.lebar || '...'}mm`;
                    break;
                case 'pipa':
                    specString = `Pipa Ø${specifications.diameter_luar || '...'}mm x Ø${specifications.diameter_dalam || '...'}mm x ${specifications.panjang || '...'}mm`;
                    break;
                case 'flange':
                    specString = `Flange ${specifications.tebal || '...'}mm x Ø${specifications.diameter || '...'}mm`;
                    break;
                case 'siku':
                    specString = `Siku ${specifications.lebar1 || '...'}x${specifications.lebar2 || '...'}x${specifications.tebal || '...'} x ${specifications.panjang || '...'}mm`;
                    break;
                case 'hollow':
                    specString = `Hollow ${specifications.lebar1 || '...'}x${specifications.lebar2 || '...'}x${specifications.tebal || '...'} x ${specifications.panjang || '...'}mm`;
                    break;
                case 'unp':
                    specString = `UNP ${specifications.lebar || '...'} x ${specifications.tebal || '...'} x ${specifications.panjang || '...'}mm`;
                    break;
                default:
                    specString = '';
            }
            return specString ? `(${specString})` : '';
        }, [itemType, specifications]);

        const finalName = useMemo(() => {
            return `${manualName || ''} ${generatedDimensionString || ''}`.trim();
        }, [manualName, generatedDimensionString]);

        const handleFormChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
        const handleSpecificationChange = (field, value) => setSpecifications(prev => ({...prev, [field]: value}));

        const handleTypeChange = (type) => {
            const newType = itemType === type ? null : type;
            setItemType(newType);
            if (newType) {
                setSpecifications({ type: newType });
            } else {
                setSpecifications({});
            }
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (!finalName || !formData.unit || !formData.category_id || !formData.warehouse_id || formData.quantity_required <= 0) {
                toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Nama, kategori, gudang, dan jumlah (harus > 0) wajib diisi.' });
                return;
            }
            setIsSubmitting(true);
            try {
                const uniqueCode = formData.code || `MANUAL-${Date.now()}`;
                const upsertData = {
                    name: finalName,
                    code: uniqueCode,
                    user_id: user.id,
                    unit: formData.unit,
                    category_id: formData.category_id,
                    standard_cost: parseFloat(formData.standard_cost) || 0,
                    specifications: itemType ? specifications : null,
                    warehouse_id: formData.warehouse_id,
                    is_deleted: false,
                    standard_price: 0, 
                    low_stock_threshold: 0,
                    stock: 0,
                };

                const { data: returnData, error } = await supabase.from('items').insert(upsertData).select().single();
                if (error) {
                    if (error.code === '23505') throw new Error(`Kode barang "${uniqueCode}" sudah ada.`);
                    throw error;
                }

                toast({ title: 'Sukses!', description: `Barang manual "${finalName}" berhasil dibuat dan ditambahkan.` });
                
                if (onFinished) {
                    const bomItem = {
                        raw_material_item_id: returnData.id,
                        item: { ...returnData, total_stock: 0, stock_levels: [] },
                        quantity_required: parseFloat(formData.quantity_required)
                    };
                    onFinished(bomItem);
                    resetLocalForm();
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Gagal menyimpan barang manual', description: error.message });
            } finally {
                setIsSubmitting(false);
            }
        };
        
        const materialCategories = itemCategories.filter(cat => !["Barang Jadi", "Setengah Jadi"].includes(cat.name));

        const renderDimensionInput = (label, field, placeholder) => (
            <div className="relative">
                <Label>{label}</Label>
                <Input 
                    type="number" 
                    placeholder={placeholder} 
                    value={specifications[field] || ''} 
                    onChange={e => handleSpecificationChange(field, e.target.value)} 
                    className="pr-10"
                    min="0"
                />
                <span className="absolute inset-y-0 right-0 top-5 pr-3 flex items-center text-sm text-muted-foreground">mm</span>
            </div>
        );

        return (
            <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-background">
                <h4 className="font-semibold text-lg">Tambah Komponen Manual Baru</h4>
                <p className="text-sm text-muted-foreground">Buat item baru dan tambahkan langsung ke BOM ini.</p>
                 <div className="space-y-2">
                    <Label htmlFor="item-name">Nama Barang</Label>
                    <Input id="item-name" value={manualName} onChange={e => setManualName(e.target.value)} required placeholder={'cth: Baut M6'}/>
                    {itemType && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 flex items-center gap-2">
                           <AlertCircle className="h-4 w-4" />
                           <span>Nama Final: <span className="font-semibold">{finalName}</span></span>
                        </div>
                    )}
                </div>

                 <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                    <Label className="font-semibold">Tipe Barang (Opsional)</Label>
                     <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <div className="flex items-center space-x-2"><Checkbox id="manual-type-roundbar" checked={itemType === 'roundbar'} onCheckedChange={() => handleTypeChange('roundbar')} /><label htmlFor="manual-type-roundbar" className="text-sm font-medium">Roundbar</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="manual-type-plat" checked={itemType === 'plat'} onCheckedChange={() => handleTypeChange('plat')} /><label htmlFor="manual-type-plat" className="text-sm font-medium">Plat</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="manual-type-pipa" checked={itemType === 'pipa'} onCheckedChange={() => handleTypeChange('pipa')} /><label htmlFor="manual-type-pipa" className="text-sm font-medium">Pipa</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="manual-type-flange" checked={itemType === 'flange'} onCheckedChange={() => handleTypeChange('flange')} /><label htmlFor="manual-type-flange" className="text-sm font-medium">Flange</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="manual-type-siku" checked={itemType === 'siku'} onCheckedChange={() => handleTypeChange('siku')} /><label htmlFor="manual-type-siku" className="text-sm font-medium">Siku</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="manual-type-hollow" checked={itemType === 'hollow'} onCheckedChange={() => handleTypeChange('hollow')} /><label htmlFor="manual-type-hollow" className="text-sm font-medium">Hollow</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="manual-type-unp" checked={itemType === 'unp'} onCheckedChange={() => handleTypeChange('unp')} /><label htmlFor="manual-type-unp" className="text-sm font-medium">UNP</label></div>
                    </div>
                    
                    {itemType === 'roundbar' && (<div className="grid grid-cols-2 gap-4 pt-2">{renderDimensionInput("Diameter", "diameter", "cth: 25")}{renderDimensionInput("Panjang", "panjang", "cth: 6000")}</div>)}
                    {itemType === 'plat' && (<div className="grid grid-cols-3 gap-4 pt-2">{renderDimensionInput("Tebal", "tebal", "cth: 10")}{renderDimensionInput("Panjang", "panjang", "cth: 2400")}{renderDimensionInput("Lebar", "lebar", "cth: 1200")}</div>)}
                    {itemType === 'pipa' && (<div className="grid grid-cols-3 gap-4 pt-2">{renderDimensionInput("Dia. Luar", "diameter_luar", "DL")}{renderDimensionInput("Dia. Dalam", "diameter_dalam", "DD")}{renderDimensionInput("Panjang", "panjang", "Panjang")}</div>)}
                    {itemType === 'flange' && (<div className="grid grid-cols-2 gap-4 pt-2">{renderDimensionInput("Tebal", "tebal", "cth: 10")}{renderDimensionInput("Diameter", "diameter", "cth: 250")}</div>)}
                    {itemType === 'siku' && (<div className="grid grid-cols-4 gap-4 pt-2">{renderDimensionInput("Lebar 1", "lebar1", "40")}{renderDimensionInput("Lebar 2", "lebar2", "40")}{renderDimensionInput("Tebal", "tebal", "3")}{renderDimensionInput("Panjang", "panjang", "6000")}</div>)}
                    {itemType === 'hollow' && (<div className="grid grid-cols-4 gap-4 pt-2">{renderDimensionInput("Lebar 1", "lebar1", "40")}{renderDimensionInput("Lebar 2", "lebar2", "40")}{renderDimensionInput("Tebal", "tebal", "1.5")}{renderDimensionInput("Panjang", "panjang", "6000")}</div>)}
                    {itemType === 'unp' && (<div className="grid grid-cols-3 gap-4 pt-2">{renderDimensionInput("Lebar", "lebar", "100")}{renderDimensionInput("Tebal", "tebal", "5")}{renderDimensionInput("Panjang", "panjang", "6000")}</div>)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Kategori</Label><Select required value={formData.category_id || ''} onValueChange={value => handleFormChange('category_id', value)}><SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{materialCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Satuan</Label><Input required value={formData.unit} onChange={e => handleFormChange('unit', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Harga Beli (HPP)</Label><Input type="number" value={formData.standard_cost} onChange={e => handleFormChange('standard_cost', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Gudang Awal</Label><Select required value={formData.warehouse_id || ''} onValueChange={value => handleFormChange('warehouse_id', value)}><SelectTrigger><SelectValue placeholder="Pilih gudang" /></SelectTrigger><SelectContent>{(warehouses || []).map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label>Jumlah yang dibutuhkan di BOM</Label><Input type="number" required value={formData.quantity_required} onChange={e => handleFormChange('quantity_required', e.target.value)} /></div>

                <div className="flex gap-2 justify-end pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Selesai Manual</Button>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Tambah ke BOM'}</Button>
                </div>
            </form>
        );
    };
  