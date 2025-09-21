import React, { useState, useEffect, useCallback } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { useData } from '@/contexts/DataContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Upload, FileImage as ImageIcon, ClipboardSignature as Signature, Building2 } from 'lucide-react';
    import EmptyState from '@/components/EmptyState';

    const bankList = [
        "BCA (Bank Central Asia)",
        "Bank Mandiri",
        "BRI (Bank Rakyat Indonesia)",
        "BNI (Bank Negara Indonesia)",
        "CIMB Niaga",
        "Bank Danamon",
        "Bank Permata",
        "Maybank Indonesia",
        "Panin Bank",
        "OCBC NISP",
        "Bank BTN (Bank Tabungan Negara)",
        "Bank Syariah Indonesia (BSI)",
        "Lainnya"
    ];

    const initialFormData = {
        company_name: '', address: '', phone: '', email: '', npwp: '',
        bank_name: '', bank_account_no: '', bank_account_name: '',
        logo_url: '', signature_url: '', is_active: true
    };

    const CompanyProfilePage = () => {
        const { companyProfile, loading, refreshData } = useData();
        const [formData, setFormData] = useState(initialFormData);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [logoFile, setLogoFile] = useState(null);
        const [signatureFile, setSignatureFile] = useState(null);
        const [showForm, setShowForm] = useState(false);
        const { toast } = useToast();

        useEffect(() => {
            if (companyProfile) {
                setFormData(companyProfile);
                setShowForm(true);
            } else if (!loading) {
                setFormData(initialFormData);
                setShowForm(false);
            }
        }, [companyProfile, loading]);

        const handleInputChange = (e) => {
            const { id, value } = e.target;
            setFormData(prev => ({ ...prev, [id]: value }));
        };

        const handleSelectChange = (value) => {
            setFormData(prev => ({ ...prev, bank_name: value }));
        };

        const handleFileChange = (e, fileType) => {
            const file = e.target.files[0];
            if (file) {
                if (fileType === 'logo') setLogoFile(file);
                if (fileType === 'signature') setSignatureFile(file);
            }
        };
        
        const setupStorageBucket = useCallback(async () => {
            try {
                const { data: buckets, error: listError } = await supabase.storage.listBuckets();
                if (listError) throw listError;
        
                const bucketExists = buckets.some(bucket => bucket.name === 'company-assets');
        
                if (!bucketExists) {
                    const { error: createBucketError } = await supabase.storage
                      .createBucket('company-assets', {
                        public: true,
                        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
                        fileSizeLimit: '5MB'
                      });

                    if (createBucketError) {
                        if (createBucketError.message.includes('already exists')) {
                           console.warn("Bucket 'company-assets' already exists. Proceeding...");
                        } else {
                            throw createBucketError;
                        }
                    } else {
                         toast({ title: 'Info', description: 'Bucket "company-assets" berhasil dibuat.' });
                    }
                }
            } catch (error) {
                 toast({ variant: 'destructive', title: 'Gagal menyiapkan storage', description: error.message });
                 throw error;
            }
        }, [toast]);
        
        const uploadFile = async (file, path) => {
            if (!file) return null;
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${path}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('company-assets')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });

            if (uploadError) {
                throw new Error(`Gagal mengunggah file: ${uploadError.message}`);
            }

            const { data } = supabase.storage
                .from('company-assets')
                .getPublicUrl(fileName);

            return data.publicUrl;
        };


        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSubmitting(true);

            try {
                await setupStorageBucket();
                let updatedData = { ...formData };

                if (logoFile) {
                  const logoUrl = await uploadFile(logoFile, 'logos');
                  if (logoUrl) updatedData.logo_url = logoUrl;
                }
                
                if (signatureFile) {
                  const signatureUrl = await uploadFile(signatureFile, 'signatures');
                  if (signatureUrl) updatedData.signature_url = signatureUrl;
                }
                
                updatedData.is_active = true;
                
                const dataToUpsert = { ...updatedData };
                delete dataToUpsert.created_at;
                delete dataToUpsert.updated_at;
                if (!dataToUpsert.id) {
                    delete dataToUpsert.id;
                }

                const { error } = await supabase
                    .from('company_profile')
                    .upsert(dataToUpsert, { onConflict: 'is_active', ignoreDuplicates: false });

                if (error) throw error;

                toast({ title: 'Sukses', description: 'Profil perusahaan berhasil disimpan.' });
                setLogoFile(null);
                setSignatureFile(null);
                await refreshData();
            } catch (error) {
                console.error("Submit error:", error);
                toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
            } finally {
                setIsSubmitting(false);
            }
        };

        const renderForm = () => (
            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Profil Perusahaan</CardTitle>
                        <CardDescription>Kelola informasi perusahaan yang akan tampil di quotation dan invoice.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Informasi Dasar</h3>
                                <div><Label htmlFor="company_name">Nama Perusahaan</Label><Input id="company_name" value={formData.company_name || ''} onChange={handleInputChange} /></div>
                                <div><Label htmlFor="address">Alamat</Label><Textarea id="address" value={formData.address || ''} onChange={handleInputChange} /></div>
                                <div><Label htmlFor="phone">Telepon</Label><Input id="phone" value={formData.phone || ''} onChange={handleInputChange} /></div>
                                <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={formData.email || ''} onChange={handleInputChange} /></div>
                                <div><Label htmlFor="npwp">NPWP</Label><Input id="npwp" value={formData.npwp || ''} onChange={handleInputChange} /></div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Informasi Bank</h3>
                                <div>
                                    <Label htmlFor="bank_name">Nama Bank</Label>
                                    <Select onValueChange={handleSelectChange} value={formData.bank_name || ''}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih bank" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bankList.map(bank => (
                                                <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div><Label htmlFor="bank_account_no">Nomor Rekening</Label><Input id="bank_account_no" value={formData.bank_account_no || ''} onChange={handleInputChange} /></div>
                                <div><Label htmlFor="bank_account_name">Atas Nama</Label><Input id="bank_account_name" value={formData.bank_account_name || ''} onChange={handleInputChange} /></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                            <div className="space-y-2">
                                <Label htmlFor="logo" className="flex items-center gap-2 font-semibold"><ImageIcon size={16}/> Logo Perusahaan</Label>
                                {formData.logo_url && <img src={`${formData.logo_url}?t=${new Date().getTime()}`} alt="Logo Perusahaan Saat Ini" className="h-20 w-auto object-contain bg-gray-100 p-2 rounded"/>}
                                <Input id="logo" type="file" onChange={(e) => handleFileChange(e, 'logo')} accept="image/png, image/jpeg, image/webp" />
                                <p className="text-xs text-muted-foreground">Unggah file baru untuk mengganti logo yang ada.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signature" className="flex items-center gap-2 font-semibold"><Signature size={16}/> Tanda Tangan Digital</Label>
                                {formData.signature_url && <img src={`${formData.signature_url}?t=${new Date().getTime()}`} alt="Tanda Tangan Saat Ini" className="h-20 w-auto object-contain bg-gray-100 p-2 rounded"/>}
                                <Input id="signature" type="file" onChange={(e) => handleFileChange(e, 'signature')} accept="image/png, image/jpeg, image/webp"/>
                                <p className="text-xs text-muted-foreground">Tanda tangan ini akan digunakan sebagai stempel resmi di dokumen.</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <Button type="submit" disabled={isSubmitting}>
                                <Upload className="mr-2 h-4 w-4" />
                                {isSubmitting ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        );

        return (
            <>
                <Helmet>
                    <title>Profil Perusahaan - Sistem Keuangan</title>
                    <meta name="description" content="Kelola informasi perusahaan, logo, dan tanda tangan untuk digunakan di quotation dan invoice." />
                </Helmet>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    {loading ? (
                        <p>Memuat profil...</p>
                    ) : showForm ? (
                        renderForm()
                    ) : (
                        <EmptyState
                            icon={Building2}
                            title="Profil Perusahaan Belum Dibuat"
                            description="Silakan lengkapi profil perusahaan Anda. Data ini akan digunakan secara otomatis pada kop surat quotation dan invoice."
                            actionText="Buat Profil Perusahaan"
                            onActionClick={() => setShowForm(true)}
                        />
                    )}
                </motion.div>
            </>
        );
    };

    export default CompanyProfilePage;