import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { toast } from '@/components/ui/use-toast';
    
    const DataContext = createContext();
    
    export const useData = () => useContext(DataContext);
    
    export const DataProvider = ({ children }) => {
      const { user } = useAuth();
      const [accounts, setAccounts] = useState([]);
      const [chartOfAccounts, setChartOfAccounts] = useState([]);
      const [transactions, setTransactions] = useState([]);
      const [liabilities, setLiabilities] = useState([]);
      const [users, setUsers] = useState([]);
      const [customers, setCustomers] = useState([]);
      const [quotations, setQuotations] = useState([]);
      const [invoices, setInvoices] = useState([]);
      const [invoicePayments, setInvoicePayments] = useState([]);
      const [salesOrders, setSalesOrders] = useState([]);
      const [companyProfile, setCompanyProfile] = useState(null);
      const [layoutTemplates, setLayoutTemplates] = useState([]);
      const [termsTemplates, setTermsTemplates] = useState([]);
      const [items, setItems] = useState([]);
      const [products, setProducts] = useState([]);
      const [itemCategories, setItemCategories] = useState([]);
      const [purchaseRequests, setPurchaseRequests] = useState([]);
      const [purchaseOrders, setPurchaseOrders] = useState([]);
      const [suppliers, setSuppliers] = useState([]);
      const [goodsReceipts, setGoodsReceipts] = useState([]);
      const [accountsPayable, setAccountsPayable] = useState([]);
      const [accountsPayablePayments, setAccountsPayablePayments] = useState([]);
      const [boms, setBoms] = useState([]);
      const [warehouses, setWarehouses] = useState([]);
      const [workOrders, setWorkOrders] = useState([]);
      const [materialIssues, setMaterialIssues] = useState([]);
      const [drawings, setDrawings] = useState([]);
      const [closedPeriods, setClosedPeriods] = useState([]);
      const [loading, setLoading] = useState(true);
      const userRole = user?.user_metadata?.role;
    
      useEffect(() => {
        console.log('Suppliers:', suppliers);
        console.log('POs:', purchaseOrders);
        console.log('Items fetched:', items);
      }, [suppliers, purchaseOrders, items]);

      const fetchAccounts = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('is_cash_account', true).order('code');
        if (error) {
          console.error('Error fetching cash accounts:', error);
          toast({ variant: 'destructive', title: 'Gagal memuat rekening kas/bank', description: error.message });
        } else {
          setAccounts(data || []);
        }
      }, [user]);

      const fetchChartOfAccounts = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase.from('chart_of_accounts').select('*, type_info:account_types(description)').order('code');
        if (error) {
          console.error('Error fetching chart of accounts:', error);
          toast({ variant: 'destructive', title: 'Gagal memuat bagan akun', description: error.message });
        } else {
          setChartOfAccounts(data || []);
        }
      }, [user]);
    
      const fetchTransactions = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
          .from('transactions')
          .select('*, journal_entries(*, account:chart_of_accounts(id, name, code))')
          .order('date', { ascending: false });
        if (error) {
          console.error('Error fetching transactions:', error);
          toast({ variant: 'destructive', title: 'Gagal memuat transaksi', description: error.message });
        } else {
          setTransactions(data || []);
        }
      }, [user]);

      const fetchLiabilities = useCallback(async () => {
        if (!user || !['admin', 'finance'].includes(userRole)) return;
         const [apRes, apPaymentsRes] = await Promise.all([
          supabase.from('accounts_payable').select('*, supplier:suppliers(name), creator:created_by(full_name)').order('date', { ascending: false }),
          supabase.from('accounts_payable_payments').select('*')
        ]);

        if (apRes.error) {
          console.error('Error fetching accounts payable:', apRes.error);
          toast({ variant: 'destructive', title: 'Gagal memuat hutang usaha', description: apRes.error.message });
        } else {
          setAccountsPayable(apRes.data || []);
        }

        if (apPaymentsRes.error) {
          console.error('Error fetching AP payments:', apPaymentsRes.error);
          toast({ variant: 'destructive', title: 'Gagal memuat pembayaran hutang', description: apPaymentsRes.error.message });
        } else {
          setAccountsPayablePayments(apPaymentsRes.data || []);
        }
      }, [user, userRole]);

      const fetchUsers = useCallback(async () => {
        if (!['admin', 'finance'].includes(userRole)) {
          setUsers([]);
          return;
        }
    
        const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    
        if (error) {
          console.error('Error fetching users:', error);
          toast({ variant: 'destructive', title: 'Gagal memuat pengguna', description: error.message });
          setUsers([]);
        } else {
          setUsers(data || []);
        }
      }, [userRole]);

      const fetchCustomers = useCallback(async () => {
        const rolesWithAccess = ['admin', 'sales', 'engineering', 'manufacture', 'inventory'];
        if (!user || !rolesWithAccess.some(role => (userRole || []).includes(role))) return;
        const { data, error } = await supabase.from('customers').select('*').order('name');
        if (error) {
          console.error('Error fetching customers:', error);
          toast({ variant: 'destructive', title: 'Gagal memuat pelanggan', description: error.message });
        } else {
          setCustomers(data || []);
        }
      }, [user, userRole]);

      const fetchQuotations = useCallback(async () => {
        if (!user || !['admin', 'sales'].includes(userRole)) return;
        const { data, error } = await supabase.from('quotations').select('*, customer:customers(name, contact_person), company_email, product_status, creator:created_by(full_name)').order('created_at', { ascending: false });
        if (error) {
          console.error('Error fetching quotations:', error);
          toast({ variant: 'destructive', title: 'Gagal memuat quotation', description: error.message });
        } else {
          setQuotations(data || []);
        }
      }, [user, userRole]);

      const fetchInvoices = useCallback(async () => {
        if (!user || !['admin', 'sales', 'finance'].includes(userRole)) return;
        
        const [invoicesRes, paymentsRes] = await Promise.all([
             supabase
              .from('invoices')
              .select('*, customer:customers(name, contact_person), product_status, parent_invoice:parent_invoice_id(*), creator:created_by(full_name)')
              .order('created_at', { ascending: false }),
             supabase
              .from('invoice_payments')
              .select('*')
        ]);
        
        if (invoicesRes.error) {
          console.error('Error fetching invoices:', invoicesRes.error);
          toast({ variant: 'destructive', title: 'Gagal memuat invoice', description: invoicesRes.error.message });
          return;
        }
        if(paymentsRes.error){
          console.error('Error fetching invoice payments:', paymentsRes.error);
          toast({ variant: 'destructive', title: 'Gagal memuat pembayaran invoice', description: paymentsRes.error.message });
          return;
        }

        const data = invoicesRes.data || [];
        const payments = paymentsRes.data || [];
        setInvoicePayments(payments);

        const settlementInvoices = data.filter(inv => inv.parent_invoice_id);

        const processedInvoices = data.map(inv => {
          if (inv.payment_type === 'dp') {
            const relatedSettlements = settlementInvoices.filter(s => s.parent_invoice_id === inv.id);
            const settlementPaid = relatedSettlements.reduce((sum, s) => sum + s.amount_paid, 0);
            const totalPaidOnDP = inv.amount_paid + settlementPaid;

            let newStatus = inv.status;
            if (totalPaidOnDP >= inv.total_amount) {
              newStatus = 'paid';
            } else if (totalPaidOnDP > 0) {
              newStatus = 'partial';
            }

            return { ...inv, total_paid_with_settlement: totalPaidOnDP, status: newStatus };
          }
          return inv;
        });

        setInvoices(processedInvoices || []);
        
      }, [user, userRole]);

      const fetchSalesOrders = useCallback(async () => {
        const salesRoles = ['admin', 'sales', 'finance', 'manufacture', 'engineering'];
        if (!user || !salesRoles.includes(userRole)) return;
        const { data, error } = await supabase
          .from('sales_orders')
          .select('*, customer:customers(name), work_order_count:work_orders(count), creator:created_by(full_name)')
          .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching sales orders:', error);
            toast({ variant: 'destructive', title: 'Gagal memuat sales orders', description: error.message });
        } else {
             const processedData = data.map(so => ({
                ...so,
                work_order_count: so.work_order_count[0] ? so.work_order_count[0].count : 0,
            }));
            setSalesOrders(processedData || []);
        }
      }, [user, userRole]);

      const fetchCompanyProfile = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
          .from('company_profile')
          .select('*')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (error) {
            console.error('Error fetching company profile:', error);
            toast({ variant: 'destructive', title: 'Gagal memuat profil perusahaan', description: error.message });
            setCompanyProfile(null);
        } else {
            setCompanyProfile(data);
        }
      }, [user]);

      const fetchLayoutTemplates = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase.from('quotation_templates').select('*').order('created_at');
        if (error) {
          console.error('Error fetching layout templates:', error);
          toast({ variant: 'destructive', title: 'Gagal memuat template layout', description: error.message });
        } else {
          setLayoutTemplates(data || []);
        }
      }, [user]);

      const fetchTermsTemplates = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase.from('document_templates').select('*').order('template_name');
        if (error) {
          console.error('Error fetching terms templates:', error);
          toast({ variant: 'destructive', title: 'Gagal memuat template syarat & ketentuan', description: error.message });
        } else {
          setTermsTemplates(data || []);
        }
      }, [user]);
      
      const fetchProducts = useCallback(async () => {
          if (!user) return;
          const { data, error } = await supabase.from('products').select(`
            *,
            item_category:item_categories(id, name),
            stock_levels:inventory_stock(warehouse_id, quantity),
            bill_of_materials(*, bom_items:bom_items(*, item:items(*)))
          `).eq('is_deleted', false).order('name');

          if (error) {
              console.error("Product fetch error:", error);
              toast({ variant: 'destructive', title: 'Gagal memuat produk manufaktur', description: error.message });
          } else {
               const processedProducts = data.map(product => ({
                  ...product,
                  total_stock: product.stock_levels?.reduce((sum, level) => sum + level.quantity, 0) ?? 0
              }));
              setProducts(processedProducts || []);
          }
      }, [user, toast]);

      const fetchInventoryData = useCallback(async () => {
        if (!user) return;

        const [prRes, itemsRes, whRes, supRes, poRes, catRes, grRes, bomRes, miRes] = await Promise.all([
            supabase.from('purchase_requests').select(`*, requester:requester_id(full_name), approver:approved_by(full_name), purchase_request_items(count)`).order('created_at', { ascending: false }),
            supabase.from('items').select('*, item_category:item_categories(id, name), stock_levels:inventory_stock(warehouse_id, quantity)').eq('is_deleted', false).order('name'),
            supabase.from('warehouses').select('*').order('name'),
            supabase.from('suppliers').select('*').order('name'),
            supabase.from('purchase_orders').select('*, supplier:suppliers(name), purchase_order_items(count)').order('created_at', { ascending: false }),
            supabase.from('item_categories').select('*').order('name'),
            supabase.from('goods_receipts').select('*, po:purchase_orders(po_number), pr:purchase_requests(pr_number), supplier:suppliers(name), user:user_id(full_name)').order('receipt_date', { ascending: false }),
            supabase.from('bill_of_materials').select('*, bom_items:bom_items(*, item:items(*, stock:inventory_stock!left!item_id(quantity))), product:products(id, name)'),
            supabase.from('material_issues').select('*, work_order:work_orders(wo_number), creator:created_by(full_name), manual_material_issue_items(*, items(name, unit)), material_issue_items(*, items(name, unit))').order('issue_date', { ascending: false })
        ]);

        if (prRes.error) toast({ variant: 'destructive', title: 'Gagal memuat permintaan barang', description: prRes.error.message });
        else setPurchaseRequests(prRes.data || []);

        if (itemsRes.error) toast({ variant: 'destructive', title: 'Gagal memuat master barang', description: itemsRes.error.message });
        else {
            const processedItems = itemsRes.data.map(item => ({
                ...item,
                total_stock: item.stock_levels?.reduce((sum, level) => sum + level.quantity, 0) ?? 0
            }));
            setItems(processedItems || []);
        }
        
        if (whRes.error) toast({ variant: 'destructive', title: 'Gagal memuat gudang', description: whRes.error.message });
        else setWarehouses(whRes.data || []);
        
        if (supRes.error) toast({ variant: 'destructive', title: 'Gagal memuat supplier', description: supRes.error.message });
        else setSuppliers(supRes.data || []);

        if (poRes.error) toast({ variant: 'destructive', title: 'Gagal memuat purchase orders', description: poRes.error.message });
        else setPurchaseOrders(poRes.data || []);
        
        if (catRes.error) toast({ variant: 'destructive', title: 'Gagal memuat kategori barang', description: catRes.error.message });
        else setItemCategories(catRes.data || []);
        
        if (grRes.error) {
            console.error("Goods Receipt fetch error:", grRes.error);
            toast({ variant: 'destructive', title: 'Gagal memuat penerimaan barang', description: grRes.error.message });
        } else {
            setGoodsReceipts(grRes.data || []);
        }

        if (bomRes.error) toast({ variant: 'destructive', title: 'Gagal memuat BOMs', description: bomRes.error.message });
        else {
           const processedBoms = bomRes.data.map(bom => {
            const overhead = bom.overhead_details;
            let overheadCost = 0;
            if (overhead) {
                const salary = (parseFloat(String(overhead.salary_person_count || 0).replace(/,/g,'.'))) * (parseFloat(String(overhead.salary_days || 0).replace(/,/g,'.'))) * (parseFloat(String(overhead.salary_per_day || 0).replace(/,/g,'.')));
                const others = (overhead.other_costs || []).reduce((sum, cost) => sum + (parseFloat(String(cost.amount || 0).replace(/,/g, '.'))), 0);
                overheadCost = salary + others;
            }
            const itemsCost = bom.bom_items.reduce((acc, item) => acc + (item.quantity_required * (item.item?.standard_cost || 0)), 0);
            return { ...bom, total_cost: itemsCost + overheadCost };
          });
          setBoms(processedBoms || []);
        }

        if (miRes.error) toast({ variant: 'destructive', title: 'Gagal memuat pengeluaran barang', description: miRes.error.message });
        else setMaterialIssues(miRes.data || []);

      }, [user, toast]);

      const fetchDrawings = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('drawings')
            .select('*, creator:created_by(full_name)')
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Drawings fetch error:", error);
            toast({ variant: 'destructive', title: 'Gagal memuat drawings', description: error.message });
        } else {
            setDrawings(data || []);
        }
    }, [user, toast]);

      const fetchWorkOrders = useCallback(async () => {
        if (!user) {
            setWorkOrders([]);
            return;
        };
        
        const { data, error } = await supabase
            .from('work_orders')
            .select(`
                *,
                customer:customers(id, name),
                sales_order:sales_orders(id, so_number),
                creator:created_by(full_name),
                material_issues:material_issues(*, transaction:transactions(journal_entries(debit, credit))),
                drawing:drawing_id(*, files:drawing_files(*)),
                items:work_order_items(
                    *, 
                    product:products(id, name, code, unit), 
                    bom:bill_of_materials(
                        *, 
                        bom_items:bom_items(
                            *, 
                            item:items(
                                id, name, code, specification, unit, standard_cost,
                                stock:inventory_stock!left(quantity)
                            )
                        )
                    )
                ),
                history:work_order_status_history(*, changed_by_user:users(id, full_name)),
                work_order_amendments(*, item:items(*, stock:inventory_stock!left(quantity)), warehouse:warehouses(name)),
                costs:work_order_costs(*)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Work Orders fetch error:", error);
            toast({ variant: 'destructive', title: 'Gagal memuat Work Orders', description: error.message });
        } else {
             const processedData = data.map(wo => {
                const enrichedAmendments = wo.work_order_amendments.map(amendment => {
                    const totalStock = amendment.item?.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                    return {
                        ...amendment,
                        item: amendment.item ? { ...amendment.item, total_stock: totalStock } : null,
                    };
                });

                return {
                    ...wo,
                    has_material_issue: wo.material_issues.length > 0,
                    work_order_amendments: enrichedAmendments,
                    items: wo.items.map(woItem => {
                        const enrichedBomItems = woItem.bom?.bom_items.map(bomItem => {
                            const totalStock = bomItem.item?.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                            return {
                                ...bomItem,
                                item: bomItem.item ? { ...bomItem.item, total_stock: totalStock } : null,
                            };
                        }) || [];

                        return {
                            ...woItem,
                            bom: woItem.bom ? { ...woItem.bom, bom_items: enrichedBomItems } : null
                        };
                    })
                };
            });
            setWorkOrders(processedData || []);
        }
    }, [user, toast]);

      const fetchClosedPeriods = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase.from('close_books').select('*');
        if (error) {
            console.error('Error fetching closed periods:', error);
            toast({ variant: 'destructive', title: 'Gagal memuat periode tutup buku', description: error.message });
        } else {
            setClosedPeriods(data || []);
        }
      }, [user, toast]);

      const runAccountMaintenance = useCallback(async () => {
        if (!user || userRole !== 'admin') return;
        const { error: ensureError } = await supabase.rpc('ensure_essential_accounts', { p_user_id: user.id });
        if (ensureError) console.error('Error ensuring essential accounts:', ensureError);
        const { data: cleanupMessage, error: cleanupError } = await supabase.rpc('cleanup_duplicate_accounts', { p_user_id: user.id });
        if (cleanupError) console.error('Error cleaning up duplicate accounts:', cleanupError);
        else if (cleanupMessage && !cleanupMessage.includes('Tidak ada')) toast({ title: 'Pemeliharaan Akun', description: cleanupMessage });
      }, [user, userRole]);

      const ensureFinanceSettings = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('finance_settings')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('Error checking finance settings:', error);
            return;
        }

        if (!data) {
            const { error: insertError } = await supabase
                .from('finance_settings')
                .insert({ user_id: user.id });
            if (insertError) {
                console.error('Error creating initial finance settings:', insertError);
            } else {
                console.log('Initial finance settings created for user.');
            }
        }
    }, [user]);
    
      const refreshData = useCallback(async () => {
        setLoading(true);
        if (userRole === 'admin') await runAccountMaintenance();
        
        const promises = [
            ensureFinanceSettings(),
            fetchCompanyProfile(),
            fetchLayoutTemplates(),
            fetchTermsTemplates(),
            fetchProducts(),
            fetchInventoryData(),
            fetchWorkOrders(),
            fetchCustomers(),
            fetchDrawings(),
            fetchClosedPeriods(),
        ];

        // Roles that need finance data
        const financeDataRoles = ['admin', 'finance'];
        if (userRole && financeDataRoles.includes(userRole)) {
            promises.push(fetchAccounts(), fetchChartOfAccounts(), fetchTransactions(), fetchLiabilities(), fetchUsers());
        }
        
        if (userRole && ['admin', 'sales', 'finance', 'manufacture', 'engineering'].includes(userRole)) {
            promises.push(fetchSalesOrders());
        }
        
        if (userRole && ['admin', 'sales'].includes(userRole)) {
            promises.push(fetchQuotations());
        }

        if (userRole && ['admin', 'sales', 'finance'].includes(userRole)) {
            promises.push(fetchInvoices());
        }
        
        await Promise.all(promises);
        setLoading(false);
      }, [userRole, user, fetchAccounts, fetchChartOfAccounts, fetchCompanyProfile, fetchCustomers, fetchInvoices, fetchInventoryData, fetchLayoutTemplates, fetchLiabilities, fetchProducts, fetchQuotations, fetchSalesOrders, fetchTermsTemplates, fetchTransactions, fetchUsers, fetchWorkOrders, runAccountMaintenance, ensureFinanceSettings, fetchDrawings, fetchClosedPeriods]);
    
      useEffect(() => {
        if (user) {
          refreshData();
        } else {
          setLoading(false);
          setAccounts([]);
          setChartOfAccounts([]);
          setTransactions([]);
          setLiabilities([]);
          setUsers([]);
          setCustomers([]);
          setQuotations([]);
          setInvoices([]);
          setInvoicePayments([]);
          setSalesOrders([]);
          setCompanyProfile(null);
          setLayoutTemplates([]);
          setTermsTemplates([]);
          setItems([]);
          setProducts([]);
          setItemCategories([]);
          setPurchaseRequests([]);
          setPurchaseOrders([]);
          setSuppliers([]);
          setGoodsReceipts([]);
          setAccountsPayable([]);
          setAccountsPayablePayments([]);
          setBoms([]);
          setWarehouses([]);
          setWorkOrders([]);
          setMaterialIssues([]);
          setDrawings([]);
          setClosedPeriods([]);
        }
      }, [user, refreshData]);
    
      const value = {
        accounts, chartOfAccounts, transactions, liabilities, users, customers, quotations, invoices, invoicePayments, salesOrders, companyProfile, layoutTemplates, termsTemplates,
        items, products, itemCategories, purchaseRequests, purchaseOrders, suppliers, goodsReceipts, boms, warehouses, workOrders, materialIssues, drawings,
        accountsPayable, accountsPayablePayments, closedPeriods,
        loading, refreshData, runAccountMaintenance
      };
    
      return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
    };