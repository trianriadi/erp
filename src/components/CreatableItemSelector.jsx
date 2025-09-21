
import React, { useState, useMemo, useCallback } from 'react';
    import { Button } from '@/components/ui/button';
    import {
      Command,
      CommandEmpty,
      CommandGroup,
      CommandInput,
      CommandItem,
      CommandList,
    } from '@/components/ui/command';
    import {
      Popover,
      PopoverContent,
      PopoverTrigger,
    } from '@/components/ui/popover';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { ChevronsUpDown, Check, PlusCircle } from 'lucide-react';
    import { cn } from '@/lib/utils';
    import { RawMaterialItemForm } from '@/components/ItemForms';
    import { useData } from '@/contexts/DataContext';

    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

    export function CreatableItemSelector({ onValueChange, onNewItemCreated, placeholder = "Pilih atau buat barang...", filterStock = true, value: controlledValue }) {
      const { items } = useData();
      const [open, setOpen] = useState(false);
      const [search, setSearch] = useState('');
      const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

      const filteredItems = useMemo(() => {
        const baseItems = filterStock ? items.filter(item => (item.total_stock || 0) > 0) : items;
        if (!search) return baseItems;
        return baseItems.filter(item =>
          (item.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
          (item.code?.toLowerCase() || '').includes(search.toLowerCase())
        );
      }, [items, search, filterStock]);

      const handleSelect = useCallback((selectedItemName) => {
        const item = items.find(i => i.name.toLowerCase() === selectedItemName.toLowerCase());
        if (item) {
          if (onValueChange) {
            onValueChange(item);
          }
        }
        setOpen(false);
        setSearch('');
      }, [onValueChange, items]);

      const handleCreateNew = () => {
        setOpen(false);
        setIsCreateDialogOpen(true);
      };
      
      const handleNewItemFormFinished = useCallback((newItem) => {
        setIsCreateDialogOpen(false);
        if (newItem && onNewItemCreated) {
          onNewItemCreated(newItem);
        }
      }, [onNewItemCreated]);


      return (
        <>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
              >
                {placeholder}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command
                filter={(value, search) => {
                  const item = items.find(i => i.name === value);
                  if (!item) return 0;
                  const nameMatch = item.name.toLowerCase().includes(search.toLowerCase());
                  const codeMatch = item.code?.toLowerCase().includes(search.toLowerCase());
                  return nameMatch || codeMatch ? 1 : 0;
                }}
              >
                <CommandInput
                  placeholder="Cari nama atau kode barang..."
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    <button
                      type="button"
                      onClick={handleCreateNew}
                      className="w-full text-left p-2 rounded-sm text-sm hover:bg-accent"
                    >
                      <span className="font-semibold">"{search}"</span> tidak ditemukan. Buat barang baru?
                    </button>
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.name}
                        onSelect={() => handleSelect(item.name)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            controlledValue === item.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{`Stok: ${item.total_stock || 0} | HPP: ${formatCurrency(item.standard_cost)}`}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup>
                    <CommandItem onSelect={handleCreateNew} className="cursor-pointer">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Buat Barang Baru
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                  <DialogTitle>Buat Barang Bahan Baku Baru</DialogTitle>
                  <DialogDescription>
                    Barang ini akan disimpan di master barang dan bisa digunakan di transaksi lain.
                  </DialogDescription>
              </DialogHeader>
              <RawMaterialItemForm item={null} onFinished={handleNewItemFormFinished} />
            </DialogContent>
          </Dialog>
        </>
      );
    }
