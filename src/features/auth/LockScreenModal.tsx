import React, { useState } from 'react';
import { useAuthStore } from './authStore';
import { PinPad } from '@/components/shared/PinPad';
import { Lock, Store, Loader2 } from 'lucide-react';

export const LockScreenModal: React.FC = () => {
  const { currentUser, isLocked, unlockScreen, error, isLoading, clearError } = useAuthStore();
  const [pin, setPin] = useState('');

  if (!isLocked || !currentUser) {
    return null;
  }

  const handleComplete = async (enteredPin: string) => {
    clearError();
    const success = await unlockScreen(enteredPin);
    if (!success) {
      setPin('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-screen-title"
    >
      <div className="bg-background border border-border w-full max-w-sm rounded-card p-8 shadow-2xl flex flex-col items-center gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="size-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
            <Lock className="size-6" />
          </div>
          <h2 id="lock-screen-title" className="font-serif font-bold text-xl text-foreground mt-1">
            Layar Kasir Terkunci
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Store className="size-3.5" />
            <span>Toko Sembako Berkah</span>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 bg-card border border-input px-4 py-2.5 rounded-pill w-full">
          <div className="size-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex flex-col flex-1 text-left">
            <span className="text-sm font-semibold text-foreground leading-tight">
              {currentUser.name}
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              Masukkan PIN untuk membuka
            </span>
          </div>
        </div>

        {/* PinPad */}
        <PinPad
          value={pin}
          onChange={setPin}
          onComplete={handleComplete}
          disabled={isLoading}
          error={error}
        />

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <Loader2 className="size-4 animate-spin" />
            <span>Memverifikasi PIN...</span>
          </div>
        )}
      </div>
    </div>
  );
};
