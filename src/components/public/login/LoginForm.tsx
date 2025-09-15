"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Image from "next/image";

import { cn } from "@/lib/utils/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/public/register/FormField";
import { SocialLoginButtons } from "@/components/public/register/SocialLoginButtons";

// No longer need to import anything from Supabase directly in this file

interface LoginFormData {
  email: string;
  password: string;
  general?: string;
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleInputChange =
    (field: keyof LoginFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));

      // Clear specific field error when user starts typing
      if (errors[field] || errors.general) {
        setErrors((prev) => ({
          ...prev,
          [field]: undefined,
          general: undefined,
        }));
      }
    };

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginFormData> = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({}); // Clear previous errors on new submission

    // FormData will be sent to our server-side API route
    const formElement = e.currentTarget;
    const formDataPayload = new FormData(formElement);

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        body: formDataPayload,
      });

      const json = await response.json();

      if (!response.ok || json?.error) {
        throw new Error(json?.error || "Login failed. Please try again.");
      }

      // If the server returned a session object, update the client Supabase session
      // so the client-side auth SDK and hooks (useAuth) reflect the new session
      // immediately. Cookies will still be set by the server response.
      if (json?.session) {
        try {
          await supabase.auth.setSession(json.session);
        } catch (err) {
          // Non-fatal: still proceed to refresh and navigate; server cookies are authoritative.
          console.warn(
            "Failed to set client session from server response",
            err
          );
        }
      }

      console.log(
        "Login successful, refreshing and redirecting to /private/dashboard"
      );

  // Refresh server components to pick up the new session cookie, then navigate.
  void router.refresh();
  void router.push("/private/dashboard");
    } catch (error: unknown) {
      let message = "An unexpected error occurred.";
      if (error instanceof Error) {
        message = error.message;
      }
      console.error("Login submission failed:", message);
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 bg-card border-border shadow-sm hover:shadow-md transition-all duration-300">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={(e) => void handleSubmit(e)} className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
                <p className="text-muted-foreground text-balance text-sm">
                  Enter your credentials to access your financial dashboard
                </p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <FormField
                  id="email"
                  label="Email"
                  name="email" // Ensure name attribute is set for FormData
                  type="email"
                  placeholder="john@example.com"
                  required
                  value={formData.email}
                  onChange={handleInputChange("email")}
                />
                {errors.email && (
                  <p className="text-destructive text-xs">{errors.email}</p>
                )}

                <FormField
                  id="password"
                  label="Password"
                  name="password" // Ensure name attribute is set for FormData
                  type="password"
                  placeholder="Enter your password"
                  required
                  value={formData.password}
                  onChange={handleInputChange("password")}
                />
                {errors.password && (
                  <p className="text-destructive text-xs">{errors.password}</p>
                )}

                {errors.general && (
                  <p className="text-destructive text-xs text-center">
                    {errors.general}
                  </p>
                )}

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => void (async () => {
                      // In a real app, navigate to forgot password route
                    })()}
                    className="text-primary hover:text-primary/80 transition-colors duration-200 text-xs font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              {/* Divider */}
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="bg-card text-muted-foreground relative z-10 px-2 text-xs">
                  Or continue with
                </span>
              </div>

              {/* Social Login */}
              <SocialLoginButtons />

              {/* Sign Up Link */}
              <div className="text-center text-sm">
                <span className="text-muted-foreground">
                  Don&apos;t have an account?{" "}
                </span>
                <a
                  href="/public/register"
                  className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                >
                  Sign up
                </a>
              </div>
            </div>
          </form>

          {/* Image Panel */}
          <div className="bg-muted relative hidden md:block">
            <Image
              src="https://images.unsplash.com/photo-1554224155-1696413565d3?q=80&w=2070&auto=format&fit=crop"
              alt="Financial analytics and insights dashboard"
              fill
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.3]"
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <div className="text-primary-foreground">
                <h3 className="text-xl font-semibold mb-2">
                  Your financial command center
                </h3>
                <p className="text-sm opacity-90">
                  Access powerful insights, intelligent budgeting, and
                  comprehensive financial tracking.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <div className="text-muted-foreground text-center text-xs">
        <div className="text-balance">
          Your data is protected with bank-level security.{" "}
          <button
            type="button"
            onClick={() => {
              // Replace with modal or navigation in a real app
            }}
            className="text-foreground underline underline-offset-4 hover:text-primary"
          >
            Learn more
          </button>
          .
        </div>
      </div>
    </div>
  );
}
