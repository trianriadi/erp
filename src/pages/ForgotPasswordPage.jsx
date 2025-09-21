import React, { useState } from 'react';
    import { Link } from 'react-router-dom';
    import { motion } from 'framer-motion';
    import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
    import { Helmet } from 'react-helmet';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { useToast } from '@/components/ui/use-toast';

    const ForgotPasswordPage = () => {
      const { resetPasswordForEmail } = useAuth();
      const { toast } = useToast();
      const [email, setEmail] = useState('');
      const [loading, setLoading] = useState(false);
      const [sent, setSent] = useState(false);

      const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        const { error } = await resetPasswordForEmail(email);

        if (error) {
            toast({
                variant: "destructive",
                title: "Gagal Mengirim Email",
                description: error.message,
            });
        } else {
            setSent(true);
            toast({
                title: "Email Terkirim",
                description: "Silakan cek email Anda untuk instruksi reset password.",
            });
        }
        setLoading(false);
      };

      return (
        <>
          <Helmet>
            <title>Lupa Password - Sistem Keuangan Trimatrakarya</title>
            <meta name="description" content="Reset password untuk akun sistem keuangan Trimatrakarya" />
          </Helmet>
          
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200 rounded-full blur-3xl animate-pulse-slow" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-200 rounded-full blur-3xl animate-pulse-slow" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-md relative z-10"
            >
              <Card className="glass-effect border-gray-200">
                <CardHeader className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="mx-auto w-16 h-16 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center mb-4"
                  >
                    <KeyRound className="h-8 w-8 text-white" />
                  </motion.div>
                  <CardTitle className="text-2xl font-bold gradient-text">
                    {sent ? 'Email Terkirim!' : 'Lupa Password?'}
                  </CardTitle>
                  <CardDescription className="text-gray-500">
                    {sent 
                      ? 'Silakan cek email Anda untuk instruksi reset password'
                      : 'Masukkan email Anda untuk reset password'
                    }
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {!sent ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-gray-700">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="nama@trimatrakarya.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500"
                            required
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium"
                        disabled={loading}
                      >
                        {loading ? "Mengirim..." : "Kirim Email Reset"}
                      </Button>
                    </form>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="p-4 bg-green-100 border border-green-200 rounded-lg">
                        <p className="text-green-700 text-sm">
                          Email reset password telah dikirim ke <strong>{email}</strong>
                        </p>
                      </div>
                      <Button
                        onClick={() => setSent(false)}
                        variant="outline"
                        className="w-full border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        Kirim Ulang
                      </Button>
                    </div>
                  )}

                  <div className="mt-6 text-center">
                    <Link 
                      to="/login" 
                      className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Kembali ke Login
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      );
    };

    export default ForgotPasswordPage;