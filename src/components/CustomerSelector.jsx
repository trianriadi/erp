import React, { useState } from 'react';
    import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
    import { useData } from '@/contexts/DataContext';
    import { cn } from '@/lib/utils';
    import { Button } from '@/components/ui/button';
    import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { CustomerForm } from '@/pages/CustomersPage';

    export function CustomerSelector({ selectedCustomerId, onCustomerSelect, disabled }) {
      const [open, setOpen] = useState(false);
      const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
      const [newCustomerName, setNewCustomerName] = useState('');
      const [searchValue, setSearchValue] = useState('');
      const { customers, refreshData } = useData();

      const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId);

      const handleNewCustomerAdded = async (newCustomer) => {
        await refreshData();
        if (newCustomer && newCustomer.id) {
          onCustomerSelect(newCustomer.id);
        }
        setIsCustomerFormOpen(false);
        setNewCustomerName('');
      };

      const handleAddNewClick = (name = '') => {
        setNewCustomerName(name);
        setOpen(false);
        setIsCustomerFormOpen(true);
      };

      const CustomerFormWrapper = ({ onFinished, initialName }) => {
        const initialData = initialName ? { name: initialName } : null;
        return <CustomerForm customer={initialData} onFinished={onFinished} isDialog={true} />;
      };

      const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchValue.toLowerCase())
      );

      const showAddNewOption = searchValue && !filteredCustomers.some(c => c.name.toLowerCase() === searchValue.toLowerCase());

      const handleSelectCustomer = (customerId) => {
        onCustomerSelect(customerId);
        setOpen(false);
        setSearchValue('');
      };

      return (
        <Dialog open={isCustomerFormOpen} onOpenChange={setIsCustomerFormOpen}>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
                disabled={disabled}
              >
                {selectedCustomer ? selectedCustomer.name : 'Pilih Pelanggan...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput 
                  placeholder="Cari atau tambah pelanggan..." 
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList>
                  <CommandEmpty>
                    {searchValue ? `Tidak ada pelanggan bernama "${searchValue}".` : 'Mulai ketik untuk mencari...'}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredCustomers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={customer.name}
                        onSelect={() => handleSelectCustomer(customer.id)}
                        onClick={() => handleSelectCustomer(customer.id)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedCustomerId === customer.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {customer.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup>
                    {showAddNewOption && (
                      <CommandItem
                        onSelect={() => handleAddNewClick(searchValue)}
                        onClick={() => handleAddNewClick(searchValue)}
                        className="cursor-pointer"
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Tambah Pelanggan: "{searchValue}"
                      </CommandItem>
                    )}
                    <CommandItem
                        onSelect={() => handleAddNewClick()}
                        onClick={() => handleAddNewClick()}
                        className="cursor-pointer"
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Tambah Pelanggan Baru...
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>{newCustomerName ? `Tambah Pelanggan: "${newCustomerName}"` : 'Tambah Pelanggan Baru'}</DialogTitle>
            </DialogHeader>
            <CustomerFormWrapper onFinished={handleNewCustomerAdded} initialName={newCustomerName} />
          </DialogContent>
        </Dialog>
      );
    }