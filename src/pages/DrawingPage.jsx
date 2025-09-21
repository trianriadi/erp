import React, { useState, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { PlusCircle, Search, Download, Trash2, Eye, File as FileIcon, Image as ImageIcon, Loader2, ChevronDown, ChevronRight, Edit, Folder, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import EmptyState from '@/components/EmptyState';
import useDebounce from '@/hooks/useDebounce';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return format(new Date(dateStr), "d MMMM yyyy", { locale: id });
};

const FilePreviewDialog = ({ file, isOpen, onOpenChange }) => {
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        if (isOpen && file) {
            setLoading(true);
            const getUrl = async () => {
                const { data, error } = await supabase.storage.from('drawings').createSignedUrl(file.file_path, 60);
                if (error) {
                    console.error('Error getting signed URL:', error);
                    setUrl(null);
                } else {
                    setUrl(data.signedUrl);
                }
                setLoading(false);
            };
            getUrl();
        }
    }, [isOpen, file]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{file?.file_name}</DialogTitle>
                </DialogHeader>
                <div className="h-full w-full flex items-center justify-center">
                    {loading ? <Loader2 className="h-8 w-8 animate-spin" /> :
                     url ? (
                        file.file_type.startsWith('image/') ? (
                            <img src={url} alt={file.file_name} className="max-h-full max-w-full object-contain" />
                        ) : (
                            <iframe src={url} className="w-full h-full" title={file.file_name} />
                        )
                    ) : <p>Gagal memuat pratinjau.</p>}
                </div>
            </DialogContent>
        </Dialog>
    );
};

const ManageDrawingDialog = ({ isOpen, onOpenChange, onFinished, drawing }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        if (drawing) {
            setName(drawing.name);
            setDescription(drawing.description || '');
        } else {
            setName('');
            setDescription('');
        }
    }, [drawing, isOpen]);

    const handleSubmit = async () => {
        if (!name) {
            toast({ variant: 'destructive', title: 'Nama paket wajib diisi.' });
            return;
        }
        setIsSubmitting(true);
        
        const payload = { name, description, created_by: user.id };
        let error;

        if (drawing) {
            ({ error } = await supabase.from('drawings').update(payload).eq('id', drawing.id));
        } else {
            ({ error } = await supabase.from('drawings').insert(payload));
        }

        if (error) {
            toast({ variant: 'destructive', title: 'Gagal menyimpan paket drawing', description: error.message });
        } else {
            toast({ title: 'Sukses', description: `Paket drawing berhasil ${drawing ? 'diperbarui' : 'dibuat'}.` });
            onFinished();
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{drawing ? 'Edit' : 'Buat'} Paket Drawing</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input placeholder="Nama Paket Drawing" value={name} onChange={e => setName(e.target.value)} />
                    <Textarea placeholder="Deskripsi (opsional)" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const DrawingPage = () => {
    const { drawings, loading, refreshData } = useData();
    const { user } = useAuth();
    const userRole = user?.user_metadata?.role;
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    
    const [expandedDrawingId, setExpandedDrawingId] = useState(null);
    const [drawingFiles, setDrawingFiles] = useState([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    const [isManageOpen, setIsManageOpen] = useState(false);
    const [selectedDrawing, setSelectedDrawing] = useState(null);
    
    const [filesToUpload, setFilesToUpload] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const [previewFile, setPreviewFile] = useState(null);
    const [deleteFile, setDeleteFile] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteDrawing, setDeleteDrawing] = useState(null);

    const filteredDrawings = useMemo(() => {
        if (!debouncedSearchTerm) return drawings;
        const lowercasedTerm = debouncedSearchTerm.toLowerCase();
        return drawings.filter(d => d.name.toLowerCase().includes(lowercasedTerm));
    }, [drawings, debouncedSearchTerm]);

    const onDrop = useCallback(acceptedFiles => {
        setFilesToUpload(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpeg', '.jpg'], 'image/png': ['.png'] }
    });

    const removeFileFromUpload = (fileToRemove) => {
        setFilesToUpload(filesToUpload.filter(file => file !== fileToRemove));
    };

    const handleUploadFiles = async () => {
        if (filesToUpload.length === 0 || !expandedDrawingId) return;
        setIsUploading(true);

        const uploadPromises = filesToUpload.map(async file => {
            const filePath = `${user.id}/${expandedDrawingId}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage.from('drawings').upload(filePath, file);
            if (uploadError) return { error: uploadError, file };

            const { error: dbError } = await supabase.from('drawing_files').insert({
                drawing_id: expandedDrawingId,
                file_name: file.name,
                file_path: filePath,
                file_type: file.type,
                uploaded_by: user.id
            });
            if (dbError) return { error: dbError, file };
            return { success: true, file };
        });

        const results = await Promise.all(uploadPromises);
        const successes = results.filter(r => r.success);
        const failures = results.filter(r => r.error);

        if (successes.length > 0) {
            toast({ title: 'Sukses', description: `${successes.length} file berhasil diunggah.` });
            await refreshData();
            toggleRow(expandedDrawingId);
        }
        failures.forEach(f => toast({ variant: 'destructive', title: `Gagal unggah ${f.file.name}`, description: f.error.message }));
        
        setIsUploading(false);
        setFilesToUpload([]);
    };

    const toggleRow = async (drawingId) => {
        if (expandedDrawingId === drawingId) {
            setExpandedDrawingId(null);
            setDrawingFiles([]);
        } else {
            setExpandedDrawingId(drawingId);
            setIsLoadingFiles(true);
            const { data, error } = await supabase
                .from('drawing_files')
                .select('*, uploader:uploaded_by(full_name)')
                .eq('drawing_id', drawingId)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });
            
            if (error) {
                toast({ variant: 'destructive', title: 'Gagal memuat file', description: error.message });
                setDrawingFiles([]);
            } else {
                setDrawingFiles(data);
            }
            setIsLoadingFiles(false);
        }
    };

    const handleDownload = async (file) => {
        const { data, error } = await supabase.storage.from('drawings').download(file.file_path);
        if (error) {
            toast({ variant: 'destructive', title: 'Gagal unduh', description: error.message });
            return;
        }
        const blob = new Blob([data]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.file_name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleDeleteFile = async () => {
        if (!deleteFile) return;
        setIsDeleting(true);
        const { error } = await supabase.from('drawing_files').update({ is_deleted: true }).eq('id', deleteFile.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Gagal hapus file', description: error.message });
        } else {
            toast({ title: 'Sukses', description: 'File berhasil dihapus.' });
            await refreshData();
            toggleRow(deleteFile.drawing_id);
        }
        setIsDeleting(false);
        setDeleteFile(null);
    };

    const handleDeleteDrawing = async () => {
        if (!deleteDrawing) return;
        setIsDeleting(true);
        const { error } = await supabase.from('drawings').update({ is_deleted: true }).eq('id', deleteDrawing.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Gagal hapus paket', description: error.message });
        } else {
            toast({ title: 'Sukses', description: 'Paket drawing berhasil dihapus.' });
            refreshData();
        }
        setIsDeleting(false);
        setDeleteDrawing(null);
    };

    const handleManageClick = (drawing = null) => {
        setSelectedDrawing(drawing);
        setIsManageOpen(true);
    };

    const canManage = userRole === 'admin' || userRole === 'engineering';

    return (
        <>
            <Helmet>
                <title>Manajemen Drawing - Engineering</title>
                <meta name="description" content="Kelola paket gambar kerja teknis." />
            </Helmet>
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Manajemen Drawing</CardTitle>
                            <CardDescription>Kelola paket gambar kerja teknis.</CardDescription>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <Input placeholder="Cari paket..." className="w-full md:w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            {canManage && <Button onClick={() => handleManageClick()}><PlusCircle className="h-4 w-4 mr-2" /> Buat Paket</Button>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <p className="text-center py-10">Memuat data...</p> :
                     filteredDrawings.length === 0 ? (
                        <EmptyState icon={Folder} title="Belum Ada Paket Drawing" description="Buat paket drawing pertama Anda untuk mengelola file." actionText={canManage ? "Buat Paket" : undefined} onActionClick={canManage ? () => handleManageClick() : undefined} />
                     ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Nama Paket</TableHead>
                                    <TableHead>Deskripsi</TableHead>
                                    <TableHead className="text-right">Jumlah File</TableHead>
                                    {canManage && <TableHead className="text-right">Aksi</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredDrawings.map(drawing => (
                                    <React.Fragment key={drawing.id}>
                                        <TableRow className="cursor-pointer" onClick={() => toggleRow(drawing.id)}>
                                            <TableCell>{expandedDrawingId === drawing.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                                            <TableCell className="font-medium">{drawing.name}</TableCell>
                                            <TableCell>{drawing.description || '-'}</TableCell>
                                            <TableCell className="text-right">{drawing.files_count || 0}</TableCell>
                                            {canManage && (
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleManageClick(drawing); }}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteDrawing(drawing); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                        {expandedDrawingId === drawing.id && (
                                            <TableRow>
                                                <TableCell colSpan={canManage ? 5 : 4} className="p-0">
                                                    <div className="p-4 bg-gray-50 space-y-4">
                                                        {isLoadingFiles ? <p>Memuat file...</p> : (
                                                            <>
                                                                {canManage && (
                                                                    <div className="space-y-2">
                                                                        <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                                                                            <input {...getInputProps()} />
                                                                            <p>Seret file ke sini, atau klik untuk memilih</p>
                                                                        </div>
                                                                        {filesToUpload.length > 0 && (
                                                                            <div className="space-y-2">
                                                                                {filesToUpload.map((file, i) => (
                                                                                    <div key={i} className="flex items-center justify-between p-2 border rounded-md bg-white">
                                                                                        <span className="text-sm">{file.name}</span>
                                                                                        <Button variant="ghost" size="icon" onClick={() => removeFileFromUpload(file)}><X className="h-4 w-4" /></Button>
                                                                                    </div>
                                                                                ))}
                                                                                <Button onClick={handleUploadFiles} disabled={isUploading}>{isUploading ? 'Mengunggah...' : `Unggah ${filesToUpload.length} File`}</Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {drawingFiles.length > 0 ? (
                                                                    <Table>
                                                                        <TableHeader><TableRow><TableHead>Nama File</TableHead><TableHead>Pengunggah</TableHead><TableHead>Tanggal</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                                                                        <TableBody>
                                                                            {drawingFiles.map(file => (
                                                                                <TableRow key={file.id}>
                                                                                    <TableCell>{file.file_name}</TableCell>
                                                                                    <TableCell>{file.uploader?.full_name || 'N/A'}</TableCell>
                                                                                    <TableCell>{formatDate(file.created_at)}</TableCell>
                                                                                    <TableCell className="text-right">
                                                                                        <Button variant="ghost" size="icon" onClick={() => setPreviewFile(file)}><Eye className="h-4 w-4" /></Button>
                                                                                        <Button variant="ghost" size="icon" onClick={() => handleDownload(file)}><Download className="h-4 w-4" /></Button>
                                                                                        {canManage && <Button variant="ghost" size="icon" onClick={() => setDeleteFile(file)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                ) : !canManage && <p className="text-sm text-muted-foreground text-center py-4">Tidak ada file dalam paket ini.</p>}
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                     )}
                </CardContent>
            </Card>

            {isManageOpen && <ManageDrawingDialog isOpen={isManageOpen} onOpenChange={setIsManageOpen} onFinished={() => { setIsManageOpen(false); refreshData(); }} drawing={selectedDrawing} />}
            {previewFile && <FilePreviewDialog file={previewFile} isOpen={!!previewFile} onOpenChange={() => setPreviewFile(null)} />}
            <ConfirmationDialog open={!!deleteFile} onOpenChange={() => setDeleteFile(null)} onConfirm={handleDeleteFile} title="Hapus File?" description={`Anda yakin ingin menghapus file "${deleteFile?.file_name}"?`} isSubmitting={isDeleting} confirmText="Ya, Hapus" />
            <ConfirmationDialog open={!!deleteDrawing} onOpenChange={() => setDeleteDrawing(null)} onConfirm={handleDeleteDrawing} title="Hapus Paket Drawing?" description={`Anda yakin ingin menghapus paket "${deleteDrawing?.name}"? Semua file di dalamnya juga akan terhapus.`} isSubmitting={isDeleting} confirmText="Ya, Hapus" />
        </>
    );
};

export default DrawingPage;