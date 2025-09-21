import React from 'react';
    import {
      AlertDialog,
      AlertDialogContent,
      AlertDialogDescription,
      AlertDialogFooter,
      AlertDialogHeader,
      AlertDialogTitle,
      AlertDialogCancel,
    } from '@/components/ui/alert-dialog';
    import { Button } from './ui/button';

    const ConfirmationDialog = ({ open, onOpenChange, onConfirm, title, description, isSubmitting, confirmText = "Lanjutkan" }) => {
      return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>
                {description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
              <Button onClick={onConfirm} disabled={isSubmitting} variant="destructive">
                {isSubmitting ? 'Memproses...' : confirmText}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    };

    export default ConfirmationDialog;