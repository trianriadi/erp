import React, { useState } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useData } from '@/contexts/DataContext';
    import { PlusCircle, Edit, Trash2, FileText } from 'lucide-react';
    import EmptyState from '@/components/EmptyState';

    const TemplateForm = ({ template, onFinished }) => {
        const [formData, setFormData] = useState(
            template || {
                template_name: '',
                document_type: 'quotation',
                terms_and_conditions: '',
            }
        );
        const [isSubmitting, setIsSubmitting] = useState(false);
        const { toast } = useToast();
        const { user } = useAuth();
        const { refreshData } = useData();

        const handleSave = async () => {
            setIsSubmitting(true);
            if (!formData.template_name || !formData.terms_and_conditions) {
                toast({ variant: 'destructive', title: 'Semua field harus diisi' });
                setIsSubmitting(false);
                return;
            }

            const dataToSave = {
                ...formData,
                user_id: user.id,
            };

            const { error } = await supabase.from('document_templates').upsert(dataToSave, { onConflict: 'id' });

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
            <div className="space-y-4">
                <div>
                    <Label htmlFor="template_name">Nama Template</Label>
                    <Input
                        id="template_name"
                        value={formData.template_name}
                        onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                        placeholder="Cth: Pembayaran DP 40%"
                    />
                </div>
                <div>
                    <Label htmlFor="document_type">Tipe Dokumen</Label>
                    <Select
                        value={formData.document_type}
                        onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih tipe dokumen" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="quotation">Quotation</SelectItem>
                            <SelectItem value="invoice">Invoice</SelectItem>
                            <SelectItem value="all">Keduanya</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="terms_and_conditions">Isi Syarat & Ketentuan</Label>
                    <Textarea
                        id="terms_and_conditions"
                        value={formData.terms_and_conditions}
                        onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                        rows={8}
                        placeholder="Tuliskan syarat dan ketentuan di sini..."
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? 'Menyimpan...' : 'Simpan Template'}
                    </Button>
                </DialogFooter>
            </div>
        );
    };

    const TermsTemplatesPage = () => {
        const { termsTemplates, loading, refreshData } = useData();
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
            if (!window.confirm('Yakin ingin menghapus template ini?')) return;
            const { error } = await supabase.from('document_templates').delete().eq('id', id);
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
                    <title>Template Syarat & Ketentuan - Sistem Keuangan</title>
                    <meta name="description" content="Kelola template Syarat & Ketentuan untuk quotation dan invoice." />
                </Helmet>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Template Syarat & Ketentuan</CardTitle>
                                <CardDescription>Atur template untuk mempercepat pengisian dokumen.</CardDescription>
                            </div>
                            <Button onClick={handleAddNew}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Buat Template Baru
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <p>Memuat template...</p>
                            ) : termsTemplates.length === 0 ? (
                                <EmptyState
                                    icon={FileText}
                                    title="Belum Ada Template"
                                    description="Buat template pertama Anda untuk Syarat & Ketentuan."
                                    actionText="Buat Template"
                                    onActionClick={handleAddNew}
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {termsTemplates.map((template) => (
                                        <Card key={template.id} className="flex flex-col">
                                            <CardHeader>
                                                <CardTitle className="text-lg">{template.template_name}</CardTitle>
                                                <CardDescription>
                                                    Untuk: {template.document_type === 'all' ? 'Quotation & Invoice' : template.document_type}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex-grow">
                                                <p className="text-sm text-muted-foreground line-clamp-3">
                                                    {template.terms_and_conditions}
                                                </p>
                                            </CardContent>
                                            <CardFooter className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{selectedTemplate ? 'Edit Template' : 'Template Baru'}</DialogTitle>
                            </DialogHeader>
                            <TemplateForm template={selectedTemplate} onFinished={() => setIsFormOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </motion.div>
            </>
        );
    };

    export default TermsTemplatesPage;