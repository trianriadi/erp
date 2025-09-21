import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';

const RegisterPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('viewer');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();
    
    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await signUp(email, password, { 
            data: { 
                name: name,
                role: role,
            } 
        });

        if (error) {
            setLoading(false);
        } else {
            toast({
                title: "Pendaftaran Berhasil!",
                description: "Silakan cek email Anda untuk verifikasi.",
            });
            navigate('/login');
        }
    };

    return (
        <>
            <Helmet>
                <title>Register - Sistem ERP Trimatrakarya</title>
            </Helmet>
             <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
                    <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_500px_at_50%_200px,#C9EBFF,transparent)]"></div>
                </div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, type: 'spring' }}
                >
                    <Card className="w-full max-w-md shadow-2xl glass-effect">
                        <CardHeader className="text-center">
                            <motion.div 
                                className="w-full flex justify-center mb-4"
                                initial={{ y: -20, opacity: 0}}
                                animate={{ y: 0, opacity: 1}}
                                transition={{ delay: 0.2 }}
                            >
                               <img src="https://horizons-cdn.hostinger.com/6b964ebd-fe0f-42aa-b76d-6e3d24348311/539a44a587f54c7f20d1853b01b8fb4f.png" alt="Logo" className="h-16 object-contain" />
                            </motion.div>
                            <CardTitle className="text-2xl font-bold">Buat Akun Baru</CardTitle>
                            <CardDescription>Isi detail di bawah untuk mendaftar.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nama Lengkap</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input id="name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required className="pl-10"/>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input id="email" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10"/>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input id="password" type="password" placeholder="Minimal 6 karakter" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10"/>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Peran / Role</Label>
                                     <Select value={role} onValueChange={setRole}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih Peran Anda" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sales">Sales</SelectItem>
                                            <SelectItem value="finance">Finance</SelectItem>
                                            <SelectItem value="inventory">Inventory</SelectItem>
                                            <SelectItem value="manufacture">Manufacture</SelectItem>
                                            <SelectItem value="engineering">Engineering</SelectItem>
                                            <SelectItem value="viewer">Viewer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white" disabled={loading}>
                                    {loading ? 'Mendaftarkan...' : 'Daftar'}
                                </Button>
                            </form>
                        </CardContent>
                        <CardFooter className="text-center text-sm">
                            <p className="w-full">
                                Sudah punya akun?{' '}
                                <Link to="/login" className="font-semibold text-blue-600 hover:underline">
                                     <ArrowLeft className="inline h-3 w-3"/> Kembali ke Login
                                </Link>
                            </p>
                        </CardFooter>
                    </Card>
                </motion.div>
            </div>
        </>
    );
};

export default RegisterPage;