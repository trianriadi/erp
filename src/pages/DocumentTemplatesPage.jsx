import React, { useState, useEffect } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
    import { Switch } from '@/components/ui/switch';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useData } from '@/contexts/DataContext';
    import { PlusCircle, Edit, Trash2, LayoutTemplate } from 'lucide-react';
    import EmptyState from '@/components/EmptyState';
    
    const defaultTemplate = {
      name: '',
      logo_position: 'left',
      logo_size: 'medium',
      header_alignment: 'left',
      table_style: 'full',
      show_terms: true,
      show_signature: true,
    };
    
    const TemplateEditor = ({ template, onFinished }) => {
      const [formData, setFormData] = useState(template || defaultTemplate);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const { toast } = useToast();
      const { user } = useAuth();
      const { refreshData } = useData();
    
      useEffect(() => {
        setFormData(template || defaultTemplate);
      }, [template]);
    
      const handleSave = async () => {
        setIsSubmitting(true);
        if (!formData.name) {
          toast({ variant: 'destructive', title: 'Nama template harus diisi' });
          setIsSubmitting(false);
          return;
        }
        
        const dataToSave = {
          ...formData,
          user_id: user.id
        };
    
        const { error } = await supabase
          .from('quotation_templates')
          .upsert(dataToSave, { onConflict: 'id' });
    
        if (error) {
          toast({ variant: 'destructive', title: 'Gagal menyimpan template', description: error.message });
        } else {
          toast({ title: 'Template berhasil disimpan' });
          await refreshData();
          onFinished();
        }
        setIsSubmitting(false);
      };
    
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Preview Pane */}
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Pratinjau Layout</h3>
            <div className="border rounded-lg p-4 aspect-[210/297] bg-white w-full overflow-hidden shadow-sm relative">
                <div className={`flex w-full ${formData.logo_position === 'left' ? 'justify-start' : formData.logo_position === 'center' ? 'justify-center' : 'justify-end'}`}>
                    <div className={`bg-gray-300 rounded ${formData.logo_size === 'small' ? 'w-16 h-8' : formData.logo_size === 'medium' ? 'w-24 h-12' : 'w-32 h-16'}`}></div>
                </div>
                <div className={`mt-4 ${formData.header_alignment === 'left' ? 'text-left' : formData.header_alignment === 'center' ? 'text-center' : 'text-right'}`}>
                    <div className="h-4 bg-gray-300 w-1/3 rounded inline-block"></div>
                    <div className="h-3 bg-gray-200 w-1/2 rounded mt-1"></div>
                </div>
                <div className="mt-8">
                    <div className={`w-full ${formData.table_style === 'full' ? 'border' : 'border-b border-t'}`}>
                        <div className="h-6 bg-gray-300 w-full"></div>
                        <div className="h-5 bg-gray-200 w-full mt-px"></div>
                        <div className="h-5 bg-gray-200 w-full mt-px"></div>
                    </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-xs text-gray-400">
                    {formData.show_terms && <div className="h-8 bg-gray-200 w-full rounded mb-2"></div>}
                    {formData.show_signature && <div className="h-8 bg-gray-200 w-2/3 rounded"></div>}
                </div>
            </div>
          </div>
          
          {/* Controls Pane */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Pengaturan Layout</h3>
            <div>
              <Label htmlFor="name">Nama Template</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
    
            <div className="space-y-2">
              <Label>Posisi Logo</Label>
              <RadioGroup value={formData.logo_position} onValueChange={(v) => setFormData({ ...formData, logo_position: v })} className="flex gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="left" id="logo-left" /><Label htmlFor="logo-left">Kiri</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="center" id="logo-center" /><Label htmlFor="logo-center">Tengah</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="right" id="logo-right" /><Label htmlFor="logo-right">Kanan</Label></div>
              </RadioGroup>
            </div>
    
            <div className="space-y-2">
              <Label>Ukuran Logo</Label>
              <RadioGroup value={formData.logo_size} onValueChange={(v) => setFormData({ ...formData, logo_size: v })} className="flex gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="small" id="size-small" /><Label htmlFor="size-small">Kecil</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="medium" id="size-medium" /><Label htmlFor="size-medium">Sedang</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="large" id="size-large" /><Label htmlFor="size-large">Besar</Label></div>
              </RadioGroup>
            </div>
    
            <div className="space-y-2">
              <Label>Gaya Tabel</Label>
              <RadioGroup value={formData.table_style} onValueChange={(v) => setFormData({ ...formData, table_style: v })} className="flex gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="full" id="table-full" /><Label htmlFor="table-full">Penuh</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="minimal" id="table-minimal" /><Label htmlFor="table-minimal">Minimal</Label></div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
                <Label>Visibilitas Footer</Label>
                <div className="flex items-center space-x-2"><Switch id="show-terms" checked={formData.show_terms} onCheckedChange={(c) => setFormData({...formData, show_terms: c})} /><Label htmlFor="show-terms">Tampilkan Syarat & Ketentuan</Label></div>
                <div className="flex items-center space-x-2"><Switch id="show-signature" checked={formData.show_signature} onCheckedChange={(c) => setFormData({...formData, show_signature: c})} /><Label htmlFor="show-signature">Tampilkan Bagian Tanda Tangan</Label></div>
            </div>
    
            <DialogFooter className="pt-4">
              <Button onClick={handleSave} disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Template"}</Button>
            </DialogFooter>
          </div>
        </div>
      );
    };
    
    const DocumentTemplatesPage = () => {
      const { layoutTemplates, loading, refreshData } = useData();
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [selectedTemplate, setSelectedTemplate] = useState(null);
      const { toast } = useToast();
    
      const handleAddNew = () => {
        setSelectedTemplate(null);
        setIsFormOpen(true);
      };
    
      const handleEdit = (template) => {
        setSelectedTemplate(template);
        setIsFormOpen(true);
      };
    
      const handleDelete = async (id) => {
        if (!window.confirm("Yakin ingin menghapus template ini?")) return;
        const { error } = await supabase.from('quotation_templates').delete().eq('id', id);
        if (error) {
          toast({ variant: 'destructive', title: 'Gagal menghapus template', description: error.message });
        } else {
          toast({ title: 'Template berhasil dihapus' });
          refreshData();
        }
      };
    
      return (
        <>
          <Helmet>
            <title>Template Layout Dokumen - Sistem Keuangan</title>
            <meta name="description" content="Kelola template layout untuk quotation dan invoice." />
          </Helmet>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Template Layout Dokumen</CardTitle>
                  <CardDescription>Atur layout untuk Quotation dan Invoice Anda.</CardDescription>
                </div>
                <Button onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> Buat Template Baru</Button>
              </CardHeader>
              <CardContent>
                {loading ? <p>Memuat template...</p> : layoutTemplates.length === 0 ? (
                  <EmptyState 
                    icon={LayoutTemplate}
                    title="Belum Ada Template"
                    description="Buat template pertama Anda untuk menyesuaikan tampilan quotation dan invoice."
                    actionText="Buat Template"
                    onActionClick={handleAddNew}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {layoutTemplates.map((template) => (
                      <Card key={template.id} className="flex flex-col">
                        <CardHeader>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                          <ul className="text-sm text-muted-foreground list-disc pl-5">
                            <li>Logo: {template.logo_position}, {template.logo_size}</li>
                            <li>Tabel: {template.table_style}</li>
                          </ul>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
    
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogContent className="max-w-5xl">
                <DialogHeader>
                  <DialogTitle>{selectedTemplate ? 'Edit Template' : 'Template Baru'}</DialogTitle>
                </DialogHeader>
                <TemplateEditor template={selectedTemplate} onFinished={() => setIsFormOpen(false)} />
              </DialogContent>
            </Dialog>
    
          </motion.div>
        </>
      );
    };
    
    export default DocumentTemplatesPage;