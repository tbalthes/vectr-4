"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePlaidLink } from "react-plaid-link";
import { X } from "lucide-react";

interface PlaidLinkPopupProps {
  linkToken: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (public_token: string, metadata: unknown) => void;
}

export function PlaidLinkPopup({
  linkToken,
  isOpen,
  onClose,
  onSuccess,
}: PlaidLinkPopupProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const { open: openPlaidLink, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      onSuccess(public_token, metadata);
    },
    onExit: () => {
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen && linkToken && ready) {
      // Small delay to ensure everything is rendered
      const timer = setTimeout(() => {
        openPlaidLink();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isOpen, linkToken, ready, openPlaidLink]);

  if (!mounted || !isOpen) {
    return null;
  }

  // Render the popup using a portal to ensure it's at the top level
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-50"
      style={{ zIndex: 99999 }}
    >
      <div className="relative bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div className="text-left">
              <h2 className="text-xl font-semibold text-gray-900">
                Connect with Plaid
              </h2>
              <p className="text-sm text-gray-600">
                Securely link your bank account
              </p>
            </div>
          </div>

          {!ready && (
            <div className="space-y-3">
              <div className="animate-pulse flex space-x-4">
                <div className="rounded-full bg-gray-300 h-10 w-10"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Preparing secure connection...
              </p>
            </div>
          )}

          {ready && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  🔒 Your connection is secured by 256-bit encryption
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Plaid Link will open momentarily to connect your account
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
