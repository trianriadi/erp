
    import React, { useState, useMemo, useEffect, useCallback } from 'react';
    import { useDropzone } from 'react-dropzone';
    import { useData } from '@/contexts/DataContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { DialogFooter } from '@/components/ui/dialog';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Textarea } from '@/components/ui/textarea';
    import { Upload, File as FileIcon, X, AlertCircle } from 'lucide-react';
    import { Checkbox } from '@/components/ui/checkbox';

    const FileUploader = ({ file, onFileChange, label }) => {
        const onDrop = useCallback(acceptedFiles => {
            onFileChange(acceptedFiles[0]);
        }, [onFileChange]);

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
            onDrop, maxFiles: 1,
            accept: { 'image/*': ['.jpeg', '.png', '.jpg'], 'application/pdf': ['.pdf'] }
        });

        return (
            <div>
                <Label>{label}</Label>
                {file ? (
                    <div className="flex items-center gap-2 p-2 border rounded-md">
                        <FileIcon className="h-5 w-5 text-gray-500" />
                        <span className="text-sm truncate flex-1">{typeof file === 'string' ? file.split('/').pop() : file.name}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => onFileChange(null)}><X className="h-4 w-4" /></Button>
                    </div>
                ) : (
                    <div {...getRootProps()} className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer ${isDragActive ? 'border-primary' : ''}`}>
                        <input {...getInputProps()} />
                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-500">{isDragActive ? 'Jatuhkan file...' : 'Seret file, atau klik untuk memilih'}</p>
                    </div>
                )}
            </div>
        );
    };

    export const ProductItemForm = ({ item, onFinished, initialData }) => {
        const { user } = useAuth();
        const { itemCategories, refreshData } = useData();
        const { toast } = useToast();
        const [isSubmitting, setIsSubmitting] = useState(false);
        
        const [imageFile, setImageFile] = useState(null);
        const [drawingFile, setDrawingFile] = useState(null);

        const defaultFormState = {
            code: '', name: '', unit: 'unit', category_id: null,
            standard_price: '', standard_cost: '', model_no: '', 
            specification: '', image_url: '', drawing_url: '',
        };
        
        const getInitialState = () => {
            const stateFromItem = item ? { ...defaultFormState, ...item, standard_price: item.standard_price || '', standard_cost: item.standard_cost || '' } : defaultFormState;
            return { ...stateFromItem, ...initialData };
        };

        const [formData, setFormData] = useState(getInitialState);

        useEffect(() => {
            setFormData(getInitialState());
            if (item) {
                if (item.image_url) setImageFile(item.image_url);
                if (item.drawing_url) setDrawingFile(item.drawing_url);
            }
        }, [item, initialData]);

        const handleFormChange = (field, value) => {
            const sanitizedValue = typeof value === 'string' ? value.replace(/,/g, '.') : value;
            setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
        };

        const uploadFile = async (file, folder) => {
            if (!file || typeof file === 'string') return typeof file === 'string' ? file : null;
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `${folder}/${fileName}`;
            const { error } = await supabase.storage.from('product_files').upload(filePath, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('product_files').getPublicUrl(filePath);
            return publicUrl;
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSubmitting(true);
            if (!formData.name || !formData.model_no || !formData.category_id || !formData.specification) {
                toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Model/Tipe, Nama, Kategori, dan Spesifikasi wajib diisi.' });
                setIsSubmitting(false); return;
            }
            try {
                const imageUrl = await uploadFile(imageFile, 'images');
                const drawingUrl = await uploadFile(drawingFile, 'drawings');
                const selectedCategory = itemCategories.find(cat => cat.id === formData.category_id);

                const upsertData = {
                    ...formData, id: item?.id, user_id: user.id, image_url: imageUrl, drawing_url: drawingUrl,
                    standard_price: parseFloat(String(formData.standard_price).replace(/,/g, '.')) || 0, 
                    standard_cost: parseFloat(String(formData.standard_cost).replace(/,/g, '.')) || 0,
                    is_deleted: false, low_stock_threshold: 0,
                    category_name: selectedCategory?.name || null,
                };
                if (!upsertData.id) delete upsertData.id;

                const { data: returnData, error } = await supabase.from('products').upsert(upsertData, { onConflict: 'id' }).select().single();

                if (error) {
                    if (error.code === '23505') throw new Error(`Model No "${formData.model_no}" atau Kode "${formData.code}" sudah ada.`);
                    throw error;
                }
                
                toast({ title: 'Sukses!', description: `Produk "${formData.name}" berhasil disimpan.` });
                await refreshData();
                if(onFinished) onFinished(returnData);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
            } finally { setIsSubmitting(false); }
        };
        
        const productCategories = itemCategories.filter(cat => ["Barang Jadi", "Setengah Jadi"].includes(cat.name));

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="model-no">No. Model / Tipe</Label><Input id="model-no" value={formData.model_no || ''} onChange={e => handleFormChange('model_no', e.target.value)} required /></div>
                    <div className="space-y-2"><Label htmlFor="item-name">Nama Produk</Label><Input id="item-name" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} required /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="specification">Spesifikasi / Deskripsi</Label><Textarea id="specification" value={formData.specification || ''} onChange={e => handleFormChange('specification', e.target.value)} required /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="item-category">Kategori</Label>
                        <Select value={formData.category_id || ''} onValueChange={value => handleFormChange('category_id', value)} required>
                            <SelectTrigger id="item-category"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                            <SelectContent>{productCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="standard_cost">Harga Pokok (HPP)</Label>
                        <Input id="standard_cost" type="text" placeholder="Isi manual atau update dari BOM" value={formData.standard_cost || ''} onChange={e => handleFormChange('standard_cost', e.target.value)} />
                        <p className="text-xs text-muted-foreground">Biaya HPP dapat diupdate melalui halaman Manajemen BOM.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FileUploader file={imageFile} onFileChange={setImageFile} label="Foto Produk" /><FileUploader file={drawingFile} onFileChange={setDrawingFile} label="File Drawing" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2"><Label htmlFor="standard_price">Harga Jual</Label><Input id="standard_price" type="text" value={formData.standard_price || ''} onChange={e => handleFormChange('standard_price', e.target.value)} /></div>
                     <div className="space-y-2">
                        <Label htmlFor="item-code">Kode Produk (Opsional)</Label>
                        <Input id="item-code" value={formData.code || ''} onChange={e => handleFormChange('code', e.target.value)} placeholder="Otomatis jika kosong"/>
                    </div>
                </div>
                <DialogFooter>
                  {onFinished && <Button type="button" variant="outline" onClick={() => onFinished(null)}>Batal</Button>}
                  <Button type="submit" disabled={isSubmitting || !formData.model_no || !formData.name || !formData.category_id || !formData.specification}>
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}
                  </Button>
                </DialogFooter>
            </form>
        );
    };

    export const RawMaterialItemForm = ({ item, onFinished, initialData }) => {
        const { user } = useAuth();
        const { itemCategories, warehouses, refreshData } = useData();
        const { toast } = useToast();
        const [isSubmitting, setIsSubmitting] = useState(false);
        
        const [itemType, setItemType] = useState(null);
        const [specifications, setSpecifications] = useState({});
        const [manualName, setManualName] = useState('');

        const defaultFormState = {
            code: '', name: '', unit: 'unit', category_id: null,
            standard_cost: '', low_stock_threshold: 0,
            initial_stock: 0, warehouse_id: null,
        };
        
        const getInitialState = () => {
            const stateFromItem = item ? { ...defaultFormState, ...item, standard_cost: item.standard_cost || '' } : defaultFormState;
            return { ...stateFromItem, ...initialData };
        };

        const [formData, setFormData] = useState(getInitialState);

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
            const name = manualName || '';
            const dimString = generatedDimensionString || '';
            return `${name} ${dimString}`.trim();
        }, [manualName, generatedDimensionString]);


        useEffect(() => {
            const state = getInitialState();
            setFormData(state);

            if (state.specifications && typeof state.specifications === 'object') {
                const specType = state.specifications.type;
                setItemType(specType || null);
                setSpecifications(state.specifications);
            } else {
                 setItemType(null);
                 setSpecifications({});
            }
            const nameMatch = state.name?.match(/^(.*?)\s*\(/);
            setManualName(nameMatch ? nameMatch[1].trim() : state.name || '');

        }, [item, initialData]);

        const handleSpecificationChange = (field, value) => {
            const sanitizedValue = value.replace(/,/g, '.');
            setSpecifications(prev => ({...prev, [field]: sanitizedValue}));
        };
        
        const handleFormChange = (field, value) => {
            const sanitizedValue = typeof value === 'string' ? value.replace(/,/g, '.') : value;
            setFormData(prev => ({...prev, [field]: sanitizedValue}));
        }

        const handleTypeChange = (type) => {
            const newType = itemType === type ? null : type;
            setItemType(newType);
            if (newType) {
                setSpecifications({ type: newType });
            } else {
                setSpecifications({});
            }
        };

        const handleSubmit = async () => {
            if (!finalName || !formData.unit || !formData.category_id || !formData.warehouse_id) {
                toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Nama, Satuan, Kategori, dan Gudang wajib diisi.' });
                return;
            }
            
            setIsSubmitting(true);

            try {
                const uniqueCode = formData.code || `RM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                const isNewItem = !item?.id;

                const { initial_stock, ...itemData } = formData;
                
                const sanitizedSpecifications = itemType ? Object.entries(specifications).reduce((acc, [key, value]) => {
                    acc[key] = typeof value === 'string' ? value.replace(/,/g, '.') : value;
                    return acc;
                }, {}) : null;

                const upsertData = {
                    id: item?.id,
                    user_id: user.id,
                    name: finalName,
                    code: uniqueCode,
                    unit: formData.unit,
                    category_id: formData.category_id,
                    standard_cost: parseFloat(String(formData.standard_cost).replace(/,/g, '.')) || 0,
                    low_stock_threshold: parseFloat(String(formData.low_stock_threshold).replace(/,/g, '.')) || 0,
                    is_deleted: false,
                    specifications: sanitizedSpecifications,
                    warehouse_id: formData.warehouse_id
                };
                if (!upsertData.id) delete upsertData.id;

                const { data: returnData, error } = await supabase.from('items').upsert(upsertData, { onConflict: 'id' }).select(`*, stock_levels:inventory_stock!inventory_stock_item_id_fkey(warehouse_id, quantity)`).single();
                if (error) {
                    if (error.code === '23505' && error.message.includes('code')) {
                        throw new Error(`Kode barang "${uniqueCode}" sudah ada.`);
                    }
                    throw error;
                }
                
                if (isNewItem && initial_stock > 0) {
                    const stockQty = parseFloat(String(initial_stock).replace(/,/g, '.'));
                    if (!isNaN(stockQty) && stockQty > 0) {
                        const { error: stockError } = await supabase.from('inventory_stock').upsert({ 
                            item_id: returnData.id,
                            warehouse_id: formData.warehouse_id,
                            quantity: stockQty,
                            user_id: user.id,
                            last_updated_at: new Date().toISOString()
                        }, { onConflict: 'item_id, warehouse_id' });
                        if (stockError) {
                            toast({ variant: 'destructive', title: 'Gagal menambah stok awal', description: stockError.message });
                        }
                    }
                }

                toast({ title: 'Sukses!', description: `Barang "${finalName}" berhasil disimpan.` });
                await refreshData();
                
                const fullNewItem = {
                    ...returnData,
                    total_stock: returnData.stock_levels?.reduce((sum, level) => sum + level.quantity, 0) ?? 0,
                };

                if (onFinished) onFinished(fullNewItem);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
            } finally { setIsSubmitting(false); }
        };
        
        const materialCategories = itemCategories.filter(cat => !["Barang Jadi", "Setengah Jadi"].includes(cat.name));

        const renderDimensionInput = (label, field, placeholder) => (
            <div className="relative">
                <Label>{label}</Label>
                <Input 
                    type="text" 
                    inputMode="decimal"
                    placeholder={placeholder} 
                    value={specifications[field] || ''} 
                    onChange={e => handleSpecificationChange(field, e.target.value)} 
                    className="pr-10"
                />
                <span className="absolute inset-y-0 right-0 top-5 pr-3 flex items-center text-sm text-muted-foreground">mm</span>
            </div>
        );

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="item-name">Nama Barang</Label>
                        <Input id="item-name" value={manualName} onChange={e => setManualName(e.target.value)} required placeholder={'cth: SS 304'}/>
                        {itemType && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 flex items-center gap-2">
                               <AlertCircle className="h-4 w-4" />
                               <span>Nama Final: <span className="font-semibold">{finalName}</span></span>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2"><Label htmlFor="item-code">Kode Barang (Opsional)</Label><Input id="item-code" value={formData.code || ''} onChange={e => handleFormChange('code', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2"><Label htmlFor="item-category">Kategori</Label>
                        <Select value={formData.category_id || ''} onValueChange={value => handleFormChange('category_id', value)} required>
                            <SelectTrigger id="item-category"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                            <SelectContent>{materialCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2"><Label htmlFor="item-unit">Satuan</Label><Input id="item-unit" value={formData.unit || ''} onChange={e => handleFormChange('unit', e.target.value)} required /></div>
                </div>

                <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                    <Label className="font-semibold">Tipe Barang (Spesifikasi Khusus)</Label>
                     <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <div className="flex items-center space-x-2"><Checkbox id="type-roundbar" checked={itemType === 'roundbar'} onCheckedChange={() => handleTypeChange('roundbar')} /><label htmlFor="type-roundbar" className="text-sm font-medium">Roundbar</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="type-plat" checked={itemType === 'plat'} onCheckedChange={() => handleTypeChange('plat')} /><label htmlFor="type-plat" className="text-sm font-medium">Plat</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="type-pipa" checked={itemType === 'pipa'} onCheckedChange={() => handleTypeChange('pipa')} /><label htmlFor="type-pipa" className="text-sm font-medium">Pipa</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="type-flange" checked={itemType === 'flange'} onCheckedChange={() => handleTypeChange('flange')} /><label htmlFor="type-flange" className="text-sm font-medium">Flange</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="type-siku" checked={itemType === 'siku'} onCheckedChange={() => handleTypeChange('siku')} /><label htmlFor="type-siku" className="text-sm font-medium">Siku</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="type-hollow" checked={itemType === 'hollow'} onCheckedChange={() => handleTypeChange('hollow')} /><label htmlFor="type-hollow" className="text-sm font-medium">Hollow</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="type-unp" checked={itemType === 'unp'} onCheckedChange={() => handleTypeChange('unp')} /><label htmlFor="type-unp" className="text-sm font-medium">UNP</label></div>
                    </div>
                    
                    {itemType === 'roundbar' && (<div className="grid grid-cols-2 gap-4 pt-2">{renderDimensionInput("Diameter", "diameter", "cth: 25")}{renderDimensionInput("Panjang", "panjang", "cth: 6000")}</div>)}
                    {itemType === 'plat' && (<div className="grid grid-cols-3 gap-4 pt-2">{renderDimensionInput("Tebal", "tebal", "cth: 10")}{renderDimensionInput("Panjang", "panjang", "cth: 2400")}{renderDimensionInput("Lebar", "lebar", "cth: 1200")}</div>)}
                    {itemType === 'pipa' && (<div className="grid grid-cols-3 gap-4 pt-2">{renderDimensionInput("Dia. Luar", "diameter_luar", "DL")}{renderDimensionInput("Dia. Dalam", "diameter_dalam", "DD")}{renderDimensionInput("Panjang", "panjang", "Panjang")}</div>)}
                    {itemType === 'flange' && (<div className="grid grid-cols-2 gap-4 pt-2">{renderDimensionInput("Tebal", "tebal", "cth: 10")}{renderDimensionInput("Diameter", "diameter", "cth: 250")}</div>)}
                    {itemType === 'siku' && (<div className="grid grid-cols-4 gap-4 pt-2">{renderDimensionInput("Lebar 1", "lebar1", "40")}{renderDimensionInput("Lebar 2", "lebar2", "40")}{renderDimensionInput("Tebal", "tebal", "3")}{renderDimensionInput("Panjang", "panjang", "6000")}</div>)}
                    {itemType === 'hollow' && (<div className="grid grid-cols-4 gap-4 pt-2">{renderDimensionInput("Lebar 1", "lebar1", "40")}{renderDimensionInput("Lebar 2", "lebar2", "40")}{renderDimensionInput("Tebal", "tebal", "1.5")}{renderDimensionInput("Panjang", "panjang", "6000")}</div>)}
                    {itemType === 'unp' && (<div className="grid grid-cols-3 gap-4 pt-2">{renderDimensionInput("Lebar", "lebar", "100")}{renderDimensionInput("Tebal", "tebal", "5")}{renderDimensionInput("Panjang", "panjang", "6000")}</div>)}
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="standard_cost">Harga Beli Standar (HPP)</Label><Input id="standard_cost" type="text" inputMode="decimal" value={formData.standard_cost || ''} onChange={e => handleFormChange('standard_cost', e.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="low_stock">Ambang Stok Rendah</Label><Input id="low_stock" type="text" inputMode="decimal" value={formData.low_stock_threshold || ''} onChange={e => handleFormChange('low_stock_threshold', e.target.value)} /></div>
                </div>
                 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="warehouse">Gudang</Label>
                        <Select value={formData.warehouse_id || ''} onValueChange={value => handleFormChange('warehouse_id', value)} required>
                            <SelectTrigger id="warehouse"><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
                            <SelectContent>
                                {warehouses && warehouses.length > 0 ? warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>) : <SelectItem value="no-wh" disabled>Tidak ada gudang</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>
                     {!item?.id && (
                         <div className="space-y-2"><Label htmlFor="initial_stock">Stok Awal</Label><Input id="initial_stock" type="text" inputMode="decimal" value={formData.initial_stock || ''} onChange={e => handleFormChange('initial_stock', e.target.value)} /></div>
                    )}
                </div>
                
                <DialogFooter>
                  {onFinished && <Button type="button" variant="outline" onClick={() => onFinished(null)}>Batal</Button>}
                  <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !finalName || !formData.unit || !formData.category_id || !formData.warehouse_id}>
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Barang'}
                  </Button>
                </DialogFooter>
            </div>
        );
    };
  