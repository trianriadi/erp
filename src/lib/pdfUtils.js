import { supabase } from '@/lib/customSupabaseClient';
    import jsPDF from 'jspdf';
    import 'jspdf-autotable';
    import { format } from 'date-fns';
    import { id } from 'date-fns/locale';

    const formatDate = (dateStr, formatStr = "d MMMM yyyy") => {
        if (!dateStr) return 'N/A';
        return format(new Date(dateStr), formatStr, { locale: id });
    };
    
    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

    const addPageFooter = async (doc, user) => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);

            const pageNumText = `Halaman ${i} dari ${pageCount}`;
            doc.text(pageNumText, pageWidth / 2, pageHeight - 10, { align: 'center' });

            const printDateText = `Dicetak pada: ${formatDate(new Date(), "d MMM yyyy, HH:mm")}`;
            doc.text(printDateText, margin, pageHeight - 10);

            const signatureX = pageWidth - margin;
            const signatureY = pageHeight - margin - 25;
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text('Dibuat oleh,', signatureX, signatureY, { align: 'right' });

            doc.setLineWidth(0.2);
            doc.line(signatureX - 60, signatureY + 20, signatureX, signatureY + 20);
            const userName = user?.user_metadata?.full_name || '(............................)';
            doc.text(userName, signatureX, signatureY + 24, { align: 'right' });
        }
    };

    export const addCompanyHeader = async (doc, companyProfile) => {
      const topMargin = 15;
      const leftMargin = 15;
      const rightMargin = doc.internal.pageSize.getWidth() - 15;

      if (!companyProfile) {
        console.warn("Company profile is missing, header will be minimal.");
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text("Profil Perusahaan tidak ditemukan.", leftMargin, topMargin);
        return topMargin + 10;
      }

      const logoSize = 20;
      let logoDataUrl = null;

      if (companyProfile.logo_url) {
        try {
          const url = new URL(companyProfile.logo_url);
          const pathSegments = url.pathname.split('/');
          const path = pathSegments.slice(pathSegments.indexOf('company-assets') + 1).join('/');
          
          const { data: blob, error: downloadError } = await supabase.storage
            .from('company-assets')
            .download(path);

          if (downloadError) throw downloadError;

          logoDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error("Error loading logo for PDF:", e);
          logoDataUrl = null;
        }
      }
      
      if (logoDataUrl) {
          doc.addImage(logoDataUrl, 'PNG', leftMargin, topMargin, logoSize, logoSize);
      } else {
          doc.setFillColor('#E0E0E0');
          doc.rect(leftMargin, topMargin, logoSize, logoSize, 'F');
          doc.setTextColor('#757575');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('LOGO', leftMargin + logoSize / 2, topMargin + logoSize / 2, { align: 'center', baseline: 'middle' });
      }

      const textX = leftMargin + logoSize + 5;
      let textY = topMargin + 3;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0,0,0);
      doc.text((companyProfile.company_name || 'NAMA PERUSAHAAN').toUpperCase(), textX, textY);
      textY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const addressLines = doc.splitTextToSize(companyProfile.address || 'Alamat Perusahaan', 80);
      doc.text(addressLines, textX, textY);
      textY += addressLines.length * 4;

      let contactInfo = [];
      if (companyProfile.phone) contactInfo.push(`Tel: ${companyProfile.phone}`);
      if (companyProfile.email) contactInfo.push(`Email: ${companyProfile.email}`);
      doc.text(contactInfo.join(' | '), textX, textY);
      textY += 4;

      if (companyProfile.npwp) {
          doc.text(`NPWP: ${companyProfile.npwp}`, textX, textY);
          textY += 4;
      }

      const finalHeaderY = Math.max(topMargin + logoSize, textY);
      const separatorY = finalHeaderY + 5;

      doc.setLineWidth(0.5);
      doc.line(leftMargin, separatorY, rightMargin, separatorY);

      return separatorY + 8;
    };
    
    export const generateBOMPDF = async (bom, companyProfile, user) => {
        if (!bom) {
            console.error("BOM data is null or undefined.");
            return { dataUri: null, fileName: '' };
        }

        const doc = new jsPDF();
        let y = await addCompanyHeader(doc, companyProfile);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('BILL OF MATERIALS', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
        y += 12;

        const leftColX = 15;
        const rightColX = 110;
        const valueOffset = 40;

        doc.setFontSize(10);
        
        const info = [
            { label: 'Nama BOM', value: bom.name || 'N/A', side: 'left' },
            { label: 'Produk Terkait', value: bom.product_name || 'Tidak Ditautkan', side: 'right' },
            { label: 'Tanggal Dibuat', value: formatDate(bom.created_at), side: 'right' },
        ];

        let leftY = y;
        let rightY = y;

        info.forEach(item => {
            doc.setFont('helvetica', 'bold');
            const colX = item.side === 'left' ? leftColX : rightColX;
            let currentY = item.side === 'left' ? leftY : rightY;
            doc.text(item.label + ':', colX, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(String(item.value), colX + valueOffset, currentY);
            if (item.side === 'left') {
                leftY += 6;
            } else {
                rightY += 6;
            }
        });

        y = Math.max(leftY, rightY) + 6;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Komponen Material', 15, y);
        y += 6;

        const bomItems = bom.bom_items || [];
        doc.autoTable({
            startY: y,
            head: [['No.', 'Kode Material', 'Nama Material', 'Qty', 'Unit', 'HPP Satuan', 'Subtotal']],
            body: bomItems.map((item, index) => [
                index + 1,
                item.item?.code || '-',
                item.item?.name || 'Item Dihapus',
                item.quantity_required,
                item.item?.unit || 'N/A',
                formatCurrency(item.item?.standard_cost),
                formatCurrency(item.quantity_required * (item.item?.standard_cost || 0)),
            ]),
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                3: { cellWidth: 15, halign: 'right' },
                4: { cellWidth: 15, halign: 'center' },
                5: { cellWidth: 30, halign: 'right' },
                6: { cellWidth: 30, halign: 'right' },
            },
            didDrawPage: (data) => {
                y = data.cursor.y;
            }
        });
        y = doc.autoTable.previous.finalY;

        const materialCost = bomItems.reduce((sum, item) => sum + (item.quantity_required * (item.item?.standard_cost || 0)), 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Total Biaya Material:', 135, y + 8, { align: 'right' });
        doc.text(formatCurrency(materialCost), 195, y + 8, { align: 'right' });
        y += 12;

        const overhead = bom.overhead_details;
        let overheadCost = 0;
        if (overhead && (overhead.salary_person_count > 0 || (overhead.other_costs && overhead.other_costs.length > 0))) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Biaya Overhead', 15, y);
            y += 6;

            const salaryCost = (parseFloat(String(overhead.salary_person_count || 0).replace(/,/g,'.')) || 0) * (parseFloat(String(overhead.salary_days || 0).replace(/,/g,'.')) || 0) * (parseFloat(String(overhead.salary_per_day || 0).replace(/,/g,'.')) || 0);
            const otherCostsTotal = (overhead.other_costs || []).reduce((sum, c) => sum + (parseFloat(String(c.amount || 0).replace(/,/g,'.')) || 0), 0);
            overheadCost = salaryCost + otherCostsTotal;
            
            const overheadBody = [];
            if(salaryCost > 0) {
                overheadBody.push(['Biaya Gaji', `(${overhead.salary_person_count} org x ${overhead.salary_days} hari x ${formatCurrency(overhead.salary_per_day)})`, formatCurrency(salaryCost)]);
            }
            (overhead.other_costs || []).forEach(cost => {
                if(cost.amount > 0) overheadBody.push(['Biaya Lain-lain', cost.description, formatCurrency(cost.amount)]);
            });

            if (overheadBody.length > 0) {
                 doc.autoTable({
                    startY: y,
                    head: [['Tipe Biaya', 'Deskripsi', 'Jumlah']],
                    body: overheadBody,
                    theme: 'grid',
                    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                    styles: { fontSize: 9, cellPadding: 2 },
                    columnStyles: {
                        2: { halign: 'right' },
                    },
                    didDrawPage: (data) => {
                        y = data.cursor.y;
                    }
                });
                y = doc.autoTable.previous.finalY;
            }

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Total Biaya Overhead:', 135, y + 8, { align: 'right' });
            doc.text(formatCurrency(overheadCost), 195, y + 8, { align: 'right' });
        }

        y += 15;
        doc.setLineWidth(0.5);
        doc.line(130, y, 195, y);
        y += 8;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Total HPP (Harga Pokok Produksi):', 135, y, { align: 'right' });
        doc.text(formatCurrency(bom.total_cost || 0), 195, y, { align: 'right' });

        await addPageFooter(doc, user);

        const fileName = `BOM-${(bom.name || 'Untitled').replace(/[\s/]/g, '_')}.pdf`;
        const dataUri = doc.output('datauristring');
        return { dataUri, fileName };
    };

    export const generateGoodsReceiptPDF = async (gr, grItems, companyProfile) => {
        const doc = new jsPDF();
        let y = await addCompanyHeader(doc, companyProfile);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('BUKTI PENERIMAAN BARANG', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
        y += 12;

        const leftColX = 15;
        const rightColX = 110;
        const valueOffset = 40;

        doc.setFontSize(10);

        const info = [
            { label: 'No. Penerimaan', value: gr.gr_number || 'N/A', side: 'left' },
            { label: 'Tanggal Terima', value: formatDate(gr.receipt_date), side: 'right' },
            { label: 'Supplier', value: gr.supplier?.name || 'N/A', side: 'left' },
            { label: 'No. Ref PO/PR', value: gr.po?.po_number || gr.pr?.pr_number || 'Tanpa Referensi', side: 'right' },
        ];

        let leftY = y;
        let rightY = y;

        info.forEach(item => {
            doc.setFont('helvetica', 'bold');
            const colX = item.side === 'left' ? leftColX : rightColX;
            let currentY = item.side === 'left' ? leftY : rightY;
            doc.text(item.label + ':', colX, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(item.value, colX + valueOffset, currentY);
            if (item.side === 'left') leftY += 6; else rightY += 6;
        });

        y = Math.max(leftY, rightY) + 6;

        doc.autoTable({
            startY: y,
            head: [['No.', 'Kode Barang', 'Nama Barang', 'Qty Diterima', 'Unit', 'Harga Aktual', 'Subtotal']],
            body: grItems.map((item, index) => [
                index + 1,
                item.item?.code || '-',
                item.item?.name || 'Item tidak ditemukan',
                item.quantity_received,
                item.item?.unit || 'Pcs',
                formatCurrency(item.actual_price),
                formatCurrency(item.quantity_received * (item.actual_price || 0)),
            ]),
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                3: { cellWidth: 20, halign: 'right' },
                4: { cellWidth: 15, halign: 'center' },
                5: { cellWidth: 30, halign: 'right' },
                6: { cellWidth: 30, halign: 'right' },
            }
        });
        y = doc.autoTable.previous.finalY;
        
        const totalAmount = grItems.reduce((sum, item) => sum + (item.quantity_received * (item.actual_price || 0)), 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Total Nilai Barang:', 135, y + 8, { align: 'right' });
        doc.text(formatCurrency(totalAmount), 195, y + 8, { align: 'right' });

        y = y + 15;
    
        if (gr.notes) {
            doc.setFont('helvetica', 'bold');
            doc.text('Catatan:', 15, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            const notesLines = doc.splitTextToSize(gr.notes, doc.internal.pageSize.getWidth() - 30);
            doc.text(notesLines, 15, y);
            y += notesLines.length * 5;
        }
    
        y += 10;
    
        const signatureY = y > 240 ? y + 5 : 240;
        doc.setFontSize(10);
        doc.autoTable({
            startY: signatureY,
            body: [
                [
                    { content: 'Diterima oleh', styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: 'Diketahui oleh', styles: { halign: 'center', fontStyle: 'bold' } },
                ],
                [
                    { content: `\n\n\n\n\n${gr.user?.full_name || '(.........................)'}`, styles: { halign: 'center', minCellHeight: 30 } },
                    { content: `\n\n\n\n\n(.........................)`, styles: { halign: 'center', minCellHeight: 30 } },
                ],
            ],
            theme: 'grid',
        });

        const fileName = `penerimaan_barang_${gr.gr_number}.pdf`;
        const dataUri = doc.output('datauristring');
        return { dataUri, fileName };
    };

    export const generateWOPDF = async (wo, companyProfile) => {
        const doc = new jsPDF();
        let y = await addCompanyHeader(doc, companyProfile, wo.creator?.full_name);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('WORK ORDER', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
        y += 10;

        const leftColX = 15;
        const rightColX = 110;
        const valueOffset = 40;

        doc.setFontSize(10);
        
        const info = [
            { label: 'No. Work Order', value: wo.wo_number || 'N/A', side: 'left' },
            { label: 'Status', value: wo.status || 'N/A', side: 'right' },
            { label: 'No. Sales Order', value: wo.sales_order?.so_number || 'N/A', side: 'left' },
            { label: 'Tanggal WO', value: formatDate(wo.created_at), side: 'right' },
            { label: 'Customer', value: wo.customer?.name || 'N/A', side: 'left' },
            { label: 'Estimasi Kirim', value: formatDate(wo.estimated_ship_date), side: 'right' },
        ];

        let leftY = y;
        let rightY = y;

        info.forEach(item => {
            if (item.side === 'left') {
                doc.setFont('helvetica', 'bold');
                doc.text(item.label + ':', leftColX, leftY);
                doc.setFont('helvetica', 'normal');
                doc.text(item.value, leftColX + valueOffset, leftY);
                leftY += 6;
            } else {
                doc.setFont('helvetica', 'bold');
                doc.text(item.label + ':', rightColX, rightY);
                doc.setFont('helvetica', 'normal');
                doc.text(item.value, rightColX + valueOffset, rightY);
                rightY += 6;
            }
        });

        y = Math.max(leftY, rightY) + 4;
        
        doc.autoTable({
            startY: y,
            head: [['No.', 'Nama Produk', 'Spesifikasi / Deskripsi', 'Qty', 'Unit', 'Catatan']],
            body: wo.items.map((item, index) => [
                index + 1,
                item.product?.name || item.description || 'N/A',
                item.engineering_notes || '-',
                item.quantity,
                item.product?.unit || 'Pcs',
                item.notes || '-',
            ]),
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 10 },
                3: { cellWidth: 15, halign: 'center' },
                4: { cellWidth: 15, halign: 'center' },
            }
        });
        y = doc.autoTable.previous.finalY + 10;

        const approvalHistory = wo.history || [];
        const getApprovalInfo = (department) => {
            const approval = approvalHistory.find(h => h.department === department && h.to_status === 'Approved');
            if (approval) {
                return {
                    name: approval.changed_by_user?.full_name || 'Sistem',
                    date: formatDate(approval.changed_at, "dd/MM/yyyy")
                };
            }
            return { name: '.........................', date: '' };
        };

        const engApproval = getApprovalInfo('engineering');
        const invApproval = getApprovalInfo('inventory');
        const prodApproval = getApprovalInfo('manufacture');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('PERSETUJUAN', 15, y);
        y += 6;

        doc.autoTable({
            startY: y,
            body: [
                [
                    { content: 'Engineering', styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: 'Inventory', styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: 'Produksi', styles: { halign: 'center', fontStyle: 'bold' } },
                ],
                [
                    { content: `\n\n\n${engApproval.name}\n( ${engApproval.date} )`, styles: { halign: 'center', minCellHeight: 30 } },
                    { content: `\n\n\n${invApproval.name}\n( ${invApproval.date} )`, styles: { halign: 'center', minCellHeight: 30 } },
                    { content: `\n\n\n${prodApproval.name}\n( ${prodApproval.date} )`, styles: { halign: 'center', minCellHeight: 30 } },
                ],
            ],
            theme: 'grid',
        });
        y = doc.autoTable.previous.finalY + 10;

        if (wo.notes) {
            doc.setFont('helvetica', 'bold');
            doc.text('Catatan Umum:', 15, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            const notesLines = doc.splitTextToSize(wo.notes, doc.internal.pageSize.getWidth() - 30);
            doc.text(notesLines, 15, y);
        }

        doc.save(`WO-${wo.wo_number}.pdf`);
    };

    export const generateWOBOMPDF = async (wo, companyProfile) => {
        const doc = new jsPDF();
        let y = await addCompanyHeader(doc, companyProfile, wo.creator?.full_name);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('DETAIL PRODUKSI - WORK ORDER', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
        y += 10;
        
        doc.setFontSize(10);
        const woInfo = [
            `No. Work Order: ${wo.wo_number || 'N/A'}`,
            `Customer: ${wo.customer?.name || 'N/A'}`,
            `Tanggal WO: ${formatDate(wo.created_at)}`
        ];
        doc.text(woInfo.join(' | '), 15, y);
        y += 8;

        const engApproval = (wo.history || []).find(h => h.department === 'engineering' && h.to_status === 'Approved');
        const approvalText = engApproval ? `Disetujui oleh: ${engApproval.changed_by_user?.full_name || 'Sistem'} pada ${formatDate(engApproval.changed_at, 'd MMM yyyy, HH:mm')}` : 'Menunggu persetujuan Engineering.';
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(approvalText, 15, y);
        y += 8;


        wo.items.forEach((item, itemIndex) => {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            const productTitle = `${item.product?.name || item.description} - Qty: ${item.quantity} ${item.product?.unit || 'Pcs'}`;
            doc.text(productTitle, 15, y);
            y += 2;
            doc.setLineWidth(0.2);
            doc.line(15, y, doc.internal.pageSize.getWidth() - 15, y);
            y += 6;
            
            if (item.bom && item.bom.bom_items && item.bom.bom_items.length > 0) {
                doc.autoTable({
                    startY: y,
                    head: [['No.', 'Kode Material', 'Nama Material', 'Spesifikasi', 'Qty Dibutuhkan', 'Unit']],
                    body: item.bom.bom_items.map((bomItem, index) => [
                        index + 1,
                        bomItem.item?.code || '-',
                        bomItem.item?.name || 'Material tidak ditemukan',
                        bomItem.item?.specification || '-',
                        bomItem.quantity_required,
                        bomItem.item?.unit || 'N/A',
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [41, 128, 185] }, // Blue header
                    styles: { fontSize: 9, cellPadding: 2 },
                    columnStyles: {
                        0: { cellWidth: 10, halign: 'center' },
                        4: { cellWidth: 25, halign: 'right' },
                        5: { cellWidth: 15, halign: 'center' },
                    },
                    didDrawPage: (data) => {
                        y = data.cursor.y;
                    }
                });
                y = doc.autoTable.previous.finalY + 10;
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150, 150, 150);
                doc.text('BOM untuk item ini belum ditentukan atau tidak memiliki komponen.', 15, y);
                doc.setTextColor(0, 0, 0);
                y += 10;
            }
        });

        doc.save(`BOM-WO-${wo.wo_number}.pdf`);
    };

    export const generatePurchaseRequestPDF = async (pr, prItems, companyProfile) => {
        const doc = new jsPDF();
        let y = await addCompanyHeader(doc, companyProfile);
    
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('PERMINTAAN PEMBELIAN BARANG', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
        y += 12;
    
        const leftColX = 15;
        const rightColX = 110;
        const valueOffset = 40;
    
        doc.setFontSize(10);
    
        const info = [
            { label: 'Nomor Permintaan', value: pr.pr_number || 'N/A', side: 'left' },
            { label: 'Tanggal Permintaan', value: formatDate(pr.request_date), side: 'right' },
            { label: 'Peminta', value: pr.requester?.full_name || 'N/A', side: 'left' },
            { label: 'Departemen', value: pr.requester?.role || 'N/A', side: 'right', capitalize: true },
            { label: 'No. Work Order', value: pr.work_order || '-', side: 'left' },
            { label: 'Status', value: pr.status, side: 'right', capitalize: true },
        ];
    
        let leftY = y;
        let rightY = y;
    
        info.forEach(item => {
            const itemValue = item.capitalize ? (item.value.charAt(0).toUpperCase() + item.value.slice(1)) : item.value;
            if (item.side === 'left') {
                doc.setFont('helvetica', 'bold');
                doc.text(item.label + ':', leftColX, leftY);
                doc.setFont('helvetica', 'normal');
                doc.text(itemValue, leftColX + valueOffset, leftY);
                leftY += 6;
            } else {
                doc.setFont('helvetica', 'bold');
                doc.text(item.label + ':', rightColX, rightY);
                doc.setFont('helvetica', 'normal');
                doc.text(itemValue, rightColX + valueOffset, rightY);
                rightY += 6;
            }
        });
    
        y = Math.max(leftY, rightY) + 6;
    
        doc.autoTable({
            startY: y,
            head: [['No.', 'Kode Barang', 'Nama Barang', 'Qty', 'Unit', 'Estimasi Harga', 'Subtotal']],
            body: prItems.map((item, index) => [
                index + 1,
                item.item?.code || '-',
                item.item?.name || 'Item tidak ditemukan',
                item.quantity,
                item.item?.unit || 'Pcs',
                formatCurrency(item.price),
                formatCurrency(item.quantity * (item.price || 0)),
            ]),
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                3: { cellWidth: 15, halign: 'right' },
                4: { cellWidth: 15, halign: 'center' },
                5: { cellWidth: 30, halign: 'right' },
                6: { cellWidth: 30, halign: 'right' },
            }
        });
        y = doc.autoTable.previous.finalY;
        
        const totalAmount = prItems.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Total Estimasi:', 135, y + 8, { align: 'right' });
        doc.text(formatCurrency(totalAmount), 195, y + 8, { align: 'right' });

        y = y + 15;
    
        if (pr.notes) {
            doc.setFont('helvetica', 'bold');
            doc.text('Catatan:', 15, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            const notesLines = doc.splitTextToSize(pr.notes, doc.internal.pageSize.getWidth() - 30);
            doc.text(notesLines, 15, y);
            y += notesLines.length * 5;
        }
    
        y += 10;
    
        const signatureY = y > 240 ? y + 5 : 240;
        doc.setFontSize(10);
        doc.autoTable({
            startY: signatureY,
            body: [
                [
                    { content: 'Diminta oleh', styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: 'Disetujui oleh', styles: { halign: 'center', fontStyle: 'bold' } },
                ],
                [
                    { content: `\n\n\n\n\n${pr.requester?.full_name || 'N/A'}`, styles: { halign: 'center', minCellHeight: 30 } },
                    { content: `\n\n\n\n\n${pr.approver?.full_name || '(.........................)'}`, styles: { halign: 'center', minCellHeight: 30 } },
                ],
            ],
            theme: 'grid',
        });
    
        doc.save(`purchase_request_${pr.pr_number}.pdf`);
    };