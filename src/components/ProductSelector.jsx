import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ChevronsUpDown, PlusCircle, Check } from 'lucide-react';
import { ProductItemForm, RawMaterialItemForm } from '@/components/ItemForms';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

export function ProductSelector({ value, onSelectProduct, disabled, filterOutId, isRawMaterialMode = false, mode = 'full', dataSource: propDataSource }) {
  const [open, setOpen] = useState(false);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const { items, products, refreshData } = useData();
  const [localProducts, setLocalProducts] = useState([]);
  const { toast } = useToast();
  
  const fetchQuotationProducts = useCallback(async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, specification, standard_price, standard_cost, category_name, stock_levels:inventory_stock(quantity)')
        .in('category_name', ['Barang Jadi', 'Setengah Jadi'])
        .order('name', { ascending: true });

      if (error) {
        toast({ variant: 'destructive', title: 'Gagal memuat produk', description: error.message });
      } else {
        const processed = data.map(p => ({
            ...p,
            total_stock: p.stock_levels.reduce((sum, s) => sum + s.quantity, 0)
        }));
        setLocalProducts(processed || []);
      }
  }, [toast]);


  useEffect(() => {
    if (mode === 'quotation' && !isRawMaterialMode) {
      fetchQuotationProducts();
    }
  }, [mode, isRawMaterialMode, fetchQuotationProducts]);
  
  const dataSource = propDataSource || (isRawMaterialMode ? items : (mode === 'quotation' ? localProducts : products));
  const selectedItem = useMemo(() => (dataSource || []).find(item => item.id === value), [dataSource, value]);

  const dialogTitle = isRawMaterialMode ? 'Bahan Baku' : 'Produk';
  const placeholderText = isRawMaterialMode ? 'Pilih bahan baku...' : 'Pilih produk...';
  const searchPlaceholder = isRawMaterialMode ? 'Cari atau tambah bahan baku...' : 'Cari atau tambah produk...';
  const emptySearchText = isRawMaterialMode ? 'Bahan baku' : 'Produk';

  const handleNewItemAdded = async (newItem) => {
    await refreshData();
    if (mode === 'quotation' && !isRawMaterialMode) {
        await fetchQuotationProducts();
    }
    if (newItem && newItem.id) {
      onSelectProduct(newItem);
    }
    setIsItemFormOpen(false);
    setNewItemName('');
  };

  const handleAddNewClick = (name = '') => {
    setNewItemName(name);
    setOpen(false);
    setIsItemFormOpen(true);
  };

  const ItemFormWrapper = ({ onFinished, initialData }) => {
    if (isRawMaterialMode) {
      return <RawMaterialItemForm item={null} onFinished={onFinished} initialData={initialData} />;
    }
    return <ProductItemForm item={null} onFinished={onFinished} initialData={initialData} />;
  };

  const filteredItems = useMemo(() => {
    let tempItems = dataSource || [];
    if (filterOutId) {
        tempItems = tempItems.filter(item => item.id !== filterOutId);
    }
    if (!searchValue) return tempItems;
    return tempItems.filter(item =>
      item.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchValue.toLowerCase()))
    );
  }, [dataSource, searchValue, filterOutId]);
  
  const showAddNewOption = searchValue && !filteredItems.some(c => c.name.toLowerCase() === searchValue.toLowerCase());

  const handleSelect = (item) => {
    onSelectProduct(item);
    setOpen(false);
    setSearchValue('');
  };

  const renderItemDetails = (item) => {
    const stock = item.total_stock ?? item.stock ?? 0;
    if (mode === 'quotation') {
      return `Stok: ${stock} | Harga: ${formatCurrency(item.standard_price)}`;
    }
    return `Stok: ${stock} | ${isRawMaterialMode ? `HPP: ${formatCurrency(item.standard_cost)}` : `Harga: ${formatCurrency(item.standard_price)}` }`;
  };

  const renderItemName = (item) => {
    const stock = item.total_stock ?? item.stock ?? 0;
    const stockInfo = stock === 0 ? <span className="text-red-500 ml-2">(Stok Kosong)</span> : '';
    return <>{item.name} {stockInfo}</>;
  }

  return (
    <Dialog open={isItemFormOpen} onOpenChange={setIsItemFormOpen}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedItem ? selectedItem.name : placeholderText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {searchValue ? `${emptySearchText} "${searchValue}" tidak ditemukan.` : 'Mulai ketik untuk mencari...'}
              </CommandEmpty>
              <CommandGroup>
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.name}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                    <div>
                      <p>{renderItemName(item)}</p>
                      <p className="text-xs text-muted-foreground">{renderItemDetails(item)}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                {showAddNewOption && (
                  <CommandItem
                    onSelect={() => handleAddNewClick(searchValue)}
                    className="cursor-pointer"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Tambah {dialogTitle}: "{searchValue}"
                  </CommandItem>
                )}
                <CommandItem
                    onSelect={() => handleAddNewClick()}
                    className="cursor-pointer"
                >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Tambah {dialogTitle} Baru...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <DialogContent>
        <DialogHeader>
            <DialogTitle>{newItemName ? `Tambah ${dialogTitle}: "${newItemName}"` : `Tambah ${dialogTitle} Baru`}</DialogTitle>
        </DialogHeader>
        <ItemFormWrapper onFinished={handleNewItemAdded} initialData={{ name: newItemName }} />
      </DialogContent>
    </Dialog>
  );
}