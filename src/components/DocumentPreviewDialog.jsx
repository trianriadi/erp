import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const DocumentPreviewDialog = ({ isOpen, onOpenChange, pdfDataUri, title, fileName }) => {
    const handleDownloadClick = () => {
        if (pdfDataUri) {
            const link = document.createElement('a');
            link.href = pdfDataUri;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>Periksa dokumen sebelum mengunduh. Gunakan tombol di bawah untuk mengunduh.</DialogDescription>
                </DialogHeader>
                <div className="h-[calc(90vh-150px)] w-full">
                    {pdfDataUri ? (
                        <iframe src={pdfDataUri} width="100%" height="100%" title="PDF Preview" className="border-0" />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p>Membuat pratinjau...</p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
                    <Button onClick={handleDownloadClick} disabled={!pdfDataUri}>
                        <Download className="mr-2 h-4 w-4" /> Unduh PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DocumentPreviewDialog;