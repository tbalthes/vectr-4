"use client";

import React, { useState, useEffect } from "react";
import { Plus, Building2, Banknote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Institution,
  CreateInstitutionRequest,
  CreateManualAccountRequest,
  ACCOUNT_TYPES,
  DEPOSITORY_SUBTYPES,
  CREDIT_SUBTYPES,
  LOAN_SUBTYPES,
  INVESTMENT_SUBTYPES,
} from "@/types/institutions";
import { toast } from "sonner";

interface AddManualAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: () => void;
}

export function AddManualAccountModal({
  open,
  onOpenChange,
  onAccountCreated,
}: AddManualAccountModalProps) {
  const [step, setStep] = useState<"account" | "institution">("account");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account form state
  const [accountForm, setAccountForm] = useState({
    name: "",
    type: "",
    subtype: "",
    mask: "",
    currency: "USD",
    initial_balance: "",
    institution_id: "",
  });

  // Institution form state
  const [institutionForm, setInstitutionForm] = useState({
    name: "",
    logo_url: "",
    url: "",
    primary_color: "",
  });

  // Available institutions
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);

  // Load institutions when modal opens
  useEffect(() => {
    if (open && institutions.length === 0) {
      loadInstitutions();
    }
  }, [open, institutions.length]);

  const loadInstitutions = async () => {
    setInstitutionsLoading(true);
    try {
      const response = await fetch("/api/institutions");
      if (response.ok) {
        const data = await response.json();
        setInstitutions(data.institutions || []);
      }
    } catch (err) {
      console.error("Failed to load institutions:", err);
    } finally {
      setInstitutionsLoading(false);
    }
  };

  const getSubtypeOptions = () => {
    switch (accountForm.type) {
      case "depository":
        return DEPOSITORY_SUBTYPES;
      case "credit":
        return CREDIT_SUBTYPES;
      case "loan":
        return LOAN_SUBTYPES;
      case "investment":
        return INVESTMENT_SUBTYPES;
      default:
        return [];
    }
  };

  const handleCreateInstitution = async () => {
    if (!institutionForm.name.trim()) {
      setError("Institution name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const institutionData: CreateInstitutionRequest = {
        name: institutionForm.name.trim(),
        provider: "manual",
        logo_url: institutionForm.logo_url || undefined,
        url: institutionForm.url || undefined,
        primary_color: institutionForm.primary_color || undefined,
      };

      const response = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(institutionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create institution");
      }

      const data = await response.json();
      const newInstitution = data.institution;

      // Add to institutions list and select it
      setInstitutions((prev) => [...prev, newInstitution]);
      setAccountForm((prev) => ({
        ...prev,
        institution_id: newInstitution.id,
      }));

      // Reset institution form and go back to account step
      setInstitutionForm({
        name: "",
        logo_url: "",
        url: "",
        primary_color: "",
      });
      setStep("account");

      toast.success(
        `Institution "${newInstitution.name}" created successfully`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create institution";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!accountForm.name.trim()) {
      setError("Account name is required");
      return;
    }

    if (!accountForm.type) {
      setError("Account type is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accountData: CreateManualAccountRequest = {
        name: accountForm.name.trim(),
        type: accountForm.type as
          | "depository"
          | "credit"
          | "loan"
          | "investment"
          | "other",
        subtype: accountForm.subtype || undefined,
        mask: accountForm.mask || undefined,
        currency: accountForm.currency,
        institution_id: accountForm.institution_id || undefined,
        initial_balance: accountForm.initial_balance
          ? Number(accountForm.initial_balance)
          : undefined,
      };

      const response = await fetch("/api/accounts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create account");
      }

      const data = await response.json();
      const newAccount = data.account;

      toast.success(`Account "${newAccount.name}" created successfully`);

      // Reset form and close modal
      resetForm();
      onOpenChange(false);
      onAccountCreated();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create account";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAccountForm({
      name: "",
      type: "",
      subtype: "",
      mask: "",
      currency: "USD",
      initial_balance: "",
      institution_id: "",
    });
    setInstitutionForm({ name: "", logo_url: "", url: "", primary_color: "" });
    setStep("account");
    setError(null);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {step === "account" ? (
              <>
                <Banknote className="h-5 w-5" />
                <span>Add Manual Account</span>
              </>
            ) : (
              <>
                <Building2 className="h-5 w-5" />
                <span>Create Institution</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === "account"
              ? "Add an account that you'll manage manually (not connected via Plaid)."
              : "Create a new institution to associate with your account."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "account" ? (
          <div className="space-y-4">
            {/* Institution Selection */}
            <div className="space-y-2">
              <Label htmlFor="institution">Institution (Optional)</Label>
              <div className="flex space-x-2">
                <Select
                  value={accountForm.institution_id}
                  onValueChange={(value) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      institution_id: value,
                    }))
                  }
                  disabled={institutionsLoading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={
                        institutionsLoading
                          ? "Loading..."
                          : "Select institution"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No institution</SelectItem>
                    {institutions.map((institution) => (
                      <SelectItem key={institution.id} value={institution.id}>
                        {institution.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("institution")}
                  disabled={loading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Account Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Account Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Main Checking, Savings, Credit Card"
                value={accountForm.name}
                onChange={(e) =>
                  setAccountForm((prev) => ({ ...prev, name: e.target.value }))
                }
                disabled={loading}
              />
            </div>

            {/* Account Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Account Type *</Label>
              <Select
                value={accountForm.type}
                onValueChange={(value) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    type: value,
                    subtype: "",
                  }))
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {type.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account Subtype */}
            {accountForm.type && getSubtypeOptions().length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subtype">Account Subtype</Label>
                <Select
                  value={accountForm.subtype}
                  onValueChange={(value) =>
                    setAccountForm((prev) => ({ ...prev, subtype: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subtype (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSubtypeOptions().map((subtype) => (
                      <SelectItem key={subtype.value} value={subtype.value}>
                        {subtype.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Account Mask */}
            <div className="space-y-2">
              <Label htmlFor="mask">Account Number (Last 4 digits)</Label>
              <Input
                id="mask"
                placeholder="e.g. 1234"
                maxLength={4}
                value={accountForm.mask}
                onChange={(e) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    mask: e.target.value.replace(/\D/g, ""),
                  }))
                }
                disabled={loading}
              />
            </div>

            {/* Currency and Initial Balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={accountForm.currency}
                  onValueChange={(value) =>
                    setAccountForm((prev) => ({ ...prev, currency: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial_balance">Initial Balance</Label>
                <Input
                  id="initial_balance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={accountForm.initial_balance}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      initial_balance: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Institution Name */}
            <div className="space-y-2">
              <Label htmlFor="inst_name">Institution Name *</Label>
              <Input
                id="inst_name"
                placeholder="e.g. Local Credit Union, My Bank"
                value={institutionForm.name}
                onChange={(e) =>
                  setInstitutionForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                disabled={loading}
              />
            </div>

            {/* Optional Fields */}
            <div className="space-y-2">
              <Label htmlFor="inst_logo">Logo URL (Optional)</Label>
              <Input
                id="inst_logo"
                type="url"
                placeholder="https://example.com/logo.png"
                value={institutionForm.logo_url}
                onChange={(e) =>
                  setInstitutionForm((prev) => ({
                    ...prev,
                    logo_url: e.target.value,
                  }))
                }
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inst_url">Website URL (Optional)</Label>
              <Input
                id="inst_url"
                type="url"
                placeholder="https://example.com"
                value={institutionForm.url}
                onChange={(e) =>
                  setInstitutionForm((prev) => ({
                    ...prev,
                    url: e.target.value,
                  }))
                }
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inst_color">Primary Color (Optional)</Label>
              <Input
                id="inst_color"
                placeholder="#1f2937"
                value={institutionForm.primary_color}
                onChange={(e) =>
                  setInstitutionForm((prev) => ({
                    ...prev,
                    primary_color: e.target.value,
                  }))
                }
                disabled={loading}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "account" ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateAccount} disabled={loading}>
                {loading ? "Creating..." : "Create Account"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("account")}
                disabled={loading}
              >
                Back
              </Button>
              <Button onClick={handleCreateInstitution} disabled={loading}>
                {loading ? "Creating..." : "Create Institution"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
