import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = localStorage.getItem('finance-app-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (email, password) => {
    const storedUsers = JSON.parse(localStorage.getItem('finance-app-users') || '[]');
    const foundUser = storedUsers.find(u => u.email === email && u.password === password);

    if (foundUser) {
      const userToStore = { email: foundUser.email, role: foundUser.role, name: foundUser.name };
      localStorage.setItem('finance-app-user', JSON.stringify(userToStore));
      setUser(userToStore);
      toast({
        title: "Login Berhasil!",
        description: `Selamat datang kembali, ${userToStore.name}!`,
      });
      return true;
    } else {
      toast({
        variant: "destructive",
        title: "Login Gagal",
        description: "Email atau password salah.",
      });
      return false;
    }
  };

  const register = (name, email, password) => {
    const storedUsers = JSON.parse(localStorage.getItem('finance-app-users') || '[]');
    const userExists = storedUsers.some(u => u.email === email);

    if (userExists) {
      toast({
        variant: "destructive",
        title: "Registrasi Gagal",
        description: "Email sudah terdaftar.",
      });
      return false;
    }

    const newUser = { name, email, password, role: 'staf' }; // Default role is 'staf'
    const updatedUsers = [...storedUsers, newUser];
    localStorage.setItem('finance-app-users', JSON.stringify(updatedUsers));
    
    toast({
      title: "Registrasi Berhasil!",
      description: "Silakan login dengan akun baru Anda.",
    });
    return true;
  };

  const logout = () => {
    localStorage.removeItem('finance-app-user');
    setUser(null);
    toast({
      title: "Logout Berhasil",
      description: "Anda telah berhasil keluar.",
    });
  };

  const forgotPassword = (email) => {
    const storedUsers = JSON.parse(localStorage.getItem('finance-app-users') || '[]');
    const userExists = storedUsers.some(u => u.email === email);

    if (userExists) {
      toast({
        title: "Email Terkirim",
        description: "Jika email terdaftar, Anda akan menerima link untuk reset password.",
      });
    } else {
       toast({
        title: "Email Terkirim",
        description: "Jika email terdaftar, Anda akan menerima link untuk reset password.",
      });
    }
    // This is a mock. In a real app, you'd send an email.
    console.log(`Password reset link sent to ${email} (mock)`);
  };

  const value = {
    user,
    login,
    register,
    logout,
    forgotPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}