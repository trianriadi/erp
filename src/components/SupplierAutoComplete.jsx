import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ChevronsUpDown, PlusCircle, Check } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const AddNewSupplierForm = ({ onFinished }) => {
    const { user } = useAuth();
    const { refreshData } = useData();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: ''
    });

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) {
            toast({ variant: "destructive", title: "Nama Supplier Wajib Diisi" });
            return;
        }
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .insert({ ...formData, user_id: user.id })
                .select()
                .single();
            if (error) throw error;
            toast({ title: "Sukses!", description: `Supplier "${data.name}" berhasil ditambahkan.` });
            await refreshData();
            onFinished(data);
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal Menambahkan Supplier", description: error.message });
            onFinished(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="supplier-name">Nama Supplier</Label>
                <Input id="supplier-name" value={formData.name} onChange={e => handleFormChange('name', e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="contact-person">Kontak Person</Label>
                    <Input id="contact-person" value={formData.contact_person} onChange={e => handleFormChange('contact_person', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Telepon</Label>
                    <Input id="phone" value={formData.phone} onChange={e => handleFormChange('phone', e.target.value)} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => handleFormChange('email', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="address">Alamat</Label>
                <Textarea id="address" value={formData.address} onChange={e => handleFormChange('address', e.target.value)} />
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onFinished(null)}>Batal</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
        </form>
    );
};

export function SupplierAutoComplete({ onSupplierChange, initialSupplierId }) {
  const [open, setOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  
  const { suppliers } = useData();

  useEffect(() => {
    if (initialSupplierId && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.id === initialSupplierId);
      if (supplier) {
        setSelectedSupplier(supplier);
      }
    } else {
        setSelectedSupplier(null);
    }
  }, [initialSupplierId, suppliers]);


  const handleSelect = (supplier) => {
    setSelectedSupplier(supplier);
    onSupplierChange(supplier);
    setOpen(false);
  };
  
  const handleAddNewFinished = (newSupplier) => {
    setIsAddSupplierOpen(false);
    if (newSupplier) {
      handleSelect(newSupplier);
    }
  };

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
            {selectedSupplier
              ? selectedSupplier.name
              : "Pilih atau cari supplier..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Cari nama supplier..." />
            <CommandList>
                <CommandEmpty>Supplier tidak ditemukan.</CommandEmpty>
                <CommandGroup>
                  {suppliers.map((supplier) => (
                    <CommandItem
                      key={supplier.id}
                      value={supplier.name}
                      onSelect={() => handleSelect(supplier)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSupplier?.id === supplier.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {supplier.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                    <CommandItem onSelect={() => {
                        setOpen(false);
                        setIsAddSupplierOpen(true);
                    }}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Tambah Supplier Baru
                    </CommandItem>
                </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Tambah Supplier Baru</DialogTitle>
            </DialogHeader>
            <AddNewSupplierForm onFinished={handleAddNewFinished} />
        </DialogContent>
      </Dialog>
    </>
  );
}