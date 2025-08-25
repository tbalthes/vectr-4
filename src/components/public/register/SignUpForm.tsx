import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/public/register/FormField";
import { SocialLoginButtons } from "@/components/public/register/SocialLoginButtons";
import { supabase } from "@/lib/supabase";

import { AuthError } from "@supabase/supabase-js";

interface SignupFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  general?: string;
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [formData, setFormData] = useState<SignupFormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<SignupFormData>>({});
  const router = useRouter();

  const handleInputChange =
    (field: keyof SignupFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));

      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({
          ...prev,
          [field]: "",
        }));
      }
    };

  const validateForm = (): boolean => {
    const newErrors: Partial<SignupFormData> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      console.log("Signup successful, redirecting to /private/dashboard");
      router.push("/private/dashboard");
    } catch (error) {
      console.error("Signup failed:", (error as AuthError).message);
      setErrors({ general: (error as AuthError).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 bg-card border border-border max-w-2xl mx-auto rounded-xl shadow-lg shadow-black/10 dark:shadow-white/10">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit} className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col items-center text-center">
                <h1 className="text-page-title mb-2 text-foreground">
                  Create your account
                </h1>
                <p className="text-muted-foreground text-balance font-sans text-sm font-normal">
                  Join Vectr Financial and start managing your money smarter
                </p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <FormField
                  id="fullName"
                  label="Full Name"
                  type="text"
                  placeholder="John Doe"
                  required
                  value={formData.fullName}
                  onChange={handleInputChange("fullName")}
                />
                {errors.fullName && (
                  <p className="text-destructive font-sans text-xs font-normal">
                    {errors.fullName}
                  </p>
                )}

                <FormField
                  id="email"
                  label="Email"
                  type="email"
                  placeholder="john@example.com"
                  required
                  value={formData.email}
                  onChange={handleInputChange("email")}
                />
                {errors.email && (
                  <p className="text-destructive font-sans text-xs font-normal">
                    {errors.email}
                  </p>
                )}

                <FormField
                  id="password"
                  label="Password"
                  type="password"
                  placeholder="Create a strong password"
                  required
                  value={formData.password}
                  onChange={handleInputChange("password")}
                />
                {errors.password && (
                  <p className="text-destructive font-sans text-xs font-normal">
                    {errors.password}
                  </p>
                )}

                <FormField
                  id="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  placeholder="Confirm your password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-destructive font-sans text-xs font-normal">
                    {errors.confirmPassword}
                  </p>
                )}

                {errors.general && (
                  <p className="text-destructive font-sans text-xs font-normal text-center">
                    {errors.general}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-sans text-sm font-medium transition-all duration-200"
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>

              {/* Divider */}
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-card text-muted-foreground relative z-10 px-2 font-sans text-xs font-medium">
                  Or continue with
                </span>
              </div>

              {/* Social Login */}
              <SocialLoginButtons />

              {/* Sign In Link */}
              <div className="text-center font-sans text-sm font-normal">
                <span className="text-muted-foreground">
                  Already have an account?{" "}
                </span>
                <a
                  href="/public/login"
                  className="text-foreground underline underline-offset-4 hover:text-primary transition-colors duration-200"
                >
                  Sign in
                </a>
              </div>
            </div>
          </form>

          {/* Side Image */}
          <div className="bg-muted relative hidden md:block">
            <img
              src="https://cdn.bathroomtakeaway.com/media/catalog/product/9/e/9eb1_130-0601-4005pp_lifestyle1.jpg?width=700&height=700&store=uk_view&image-type=image"
              alt="Modern financial dashboard on mobile and desktop"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <div className="text-primary-foreground">
                <h3 className="text-section-title mb-2">
                  Start your financial journey
                </h3>
                <p className="font-sans text-sm font-normal opacity-90">
                  Join thousands of users who have already taken control of
                  their financial future with Vectr.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms */}
      <div className="text-muted-foreground text-center font-sans text-xs font-normal">
        <div className="text-balance">
          By creating an account, you agree to our{" "}
          <a
            href="#"
            className="text-foreground underline underline-offset-4 hover:text-primary transition-colors duration-200"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="#"
            className="text-foreground underline underline-offset-4 hover:text-primary transition-colors duration-200"
          >
            Privacy Policy
          </a>
          .
        </div>
      </div>
    </div>
  );
}
