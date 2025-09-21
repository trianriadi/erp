import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle2, XCircle, Clock, Check, Ban, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import EmptyState from '@/components/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const formatCurrency = (amount) => {
  if (typeof amount !== 'number') return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const RequestPreviewDialog = ({ isOpen, onOpenChange, request, onApprove, onReject, isProcessing }) => {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  React.useEffect(() => {
    if (isOpen && request) {
      const fetchItems = async () => {
        setLoadingItems(true);
        const { data, error } = await supabase
          .from('purchase_request_items')
          .select('*, item:items(name, code, unit)')
          .eq('pr_id', request.id);

        if (error) {
          console.error("Error fetching request items:", error);
        } else {
          setItems(data);
        }
        setLoadingItems(false);
      };
      fetchItems();
    }
  }, [isOpen, request]);

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail Permintaan: {request.pr_number}</DialogTitle>
          <DialogDescription>
            Diajukan oleh {request.requester?.full_name || 'N/A'} pada {new Date(request.request_date).toLocaleDateString('id-ID')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4">
          {loadingItems ? (
            <p>Memuat item...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barang</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Harga Est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.item.name} ({item.item.code})</TableCell>
                    <TableCell>{item.quantity} {item.item.unit}</TableCell>
                    <TableCell>{formatCurrency(item.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {request.notes && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-1">Catatan:</h4>
              <p className="text-sm text-gray-600 italic">{request.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          {request.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => onReject(request)}
                disabled={isProcessing}
              >
                <Ban className="h-4 w-4 mr-1" />
                Tolak
              </Button>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={() => onApprove(request)}
                disabled={isProcessing}
              >
                <Check className="h-4 w-4 mr-1" />
                Setujui
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const FinancePurchaseRequestsPage = () => {
  const { user } = useAuth();
  const { purchaseRequests, loading, refreshData } = useData();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const handleApproval = async (request, newStatus) => {
    if (request.requester_id === user.id) {
      toast({
        variant: 'destructive',
        title: 'Aksi Ditolak',
        description: 'Anda tidak dapat menyetujui atau menolak permintaan yang Anda buat sendiri.',
      });
      return;
    }

    setIsProcessing(request.id);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({
          status: newStatus,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: 'Sukses!',
        description: `Permintaan barang telah berhasil di-${newStatus === 'approved' ? 'setujui' : 'tolak'}.`,
      });
      await refreshData();
      setIsPreviewOpen(false);
      setSelectedRequest(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal Memproses Permintaan',
        description: error.message,
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const openPreview = (request) => {
    setSelectedRequest(request);
    setIsPreviewOpen(true);
  };

  const statusConfig = {
    pending: { icon: Clock, color: 'text-yellow-500', label: 'Pending' },
    approved: { icon: CheckCircle2, color: 'text-green-500', label: 'Approved' },
    rejected: { icon: XCircle, color: 'text-red-500', label: 'Rejected' },
  };

  return (
    <>
      <Helmet><title>Persetujuan Permintaan Barang - Finance</title></Helmet>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Persetujuan Permintaan Barang</h1>
            <p className="text-gray-500">Tinjau dan proses permintaan barang dari semua departemen.</p>
          </div>
          <Button variant="outline" size="icon" onClick={refreshData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <p>Memuat data permintaan...</p>
        ) : !purchaseRequests || purchaseRequests.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Tidak Ada Permintaan"
            description="Saat ini tidak ada permintaan barang yang perlu diproses."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Daftar Permintaan</CardTitle>
              <CardDescription>Total {purchaseRequests.length} permintaan.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. PR</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Pemohon</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseRequests.map((pr) => {
                    const currentStatus = statusConfig[pr.status] || { icon: Clock, color: 'text-gray-500', label: 'Unknown' };
                    const StatusIcon = currentStatus.icon;
                    const itemCount = Array.isArray(pr.purchase_request_items) && pr.purchase_request_items[0]?.count ? pr.purchase_request_items[0].count : 0;

                    return (
                      <motion.tr key={pr.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <TableCell className="font-medium">{pr.pr_number}</TableCell>
                        <TableCell>{new Date(pr.request_date).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>{pr.requester?.full_name || 'N/A'}</TableCell>
                        <TableCell>{itemCount} item</TableCell>
                        <TableCell className="text-center">
                          <span className={`flex items-center justify-center gap-2 ${currentStatus.color}`}>
                            <StatusIcon className="h-4 w-4" />
                            {currentStatus.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {pr.status === 'pending' ? (
                            <div className="flex gap-2 justify-center">
                               <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPreview(pr)}
                                disabled={isProcessing === pr.id}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Preview
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-500 hover:bg-green-600 text-white"
                                onClick={() => handleApproval(pr, 'approved')}
                                disabled={isProcessing === pr.id}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Setujui
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleApproval(pr, 'rejected')}
                                disabled={isProcessing === pr.id}
                              >
                                <Ban className="h-4 w-4 mr-1" />
                                Tolak
                              </Button>
                            </div>
                          ) : (
                             <p className="text-xs text-gray-500">
                                Diproses oleh {pr.approver?.full_name || 'N/A'} <br />
                                pada {pr.approved_at ? new Date(pr.approved_at).toLocaleString('id-ID') : '-'}
                            </p>
                          )}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
      <RequestPreviewDialog
        isOpen={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        request={selectedRequest}
        onApprove={(req) => handleApproval(req, 'approved')}
        onReject={(req) => handleApproval(req, 'rejected')}
        isProcessing={isProcessing === selectedRequest?.id}
      />
    </>
  );
};

export default FinancePurchaseRequestsPage;