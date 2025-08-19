import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/public/register/FormField";
import { SocialLoginButtons } from "@/components/public/register/SocialLoginButtons";
import { supabase } from "@/lib/supabaseClient";

import { AuthError } from "@supabase/supabase-js";

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

  const handleInputChange =
    (field: keyof LoginFormData) =>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        throw error;
      }

      console.log("Login successful, redirecting to /private/dashboard");
      router.push("/private/dashboard");
    } catch (error) {
      console.error("Login failed:", (error as AuthError).message);
      setErrors({ general: (error as AuthError).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 bg-card border-border shadow-sm hover:shadow-md transition-all duration-300">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit} className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col items-center text-center">
                <h1 className="text-page-title mb-2">Welcome back</h1>
                <p className="text-muted-foreground text-balance font-sans text-sm font-normal">
                  Enter your credentials to access your financial dashboard
                </p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
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
                  placeholder="Enter your password"
                  required
                  value={formData.password}
                  onChange={handleInputChange("password")}
                />
                {errors.password && (
                  <p className="text-destructive font-sans text-xs font-normal">
                    {errors.password}
                  </p>
                )}

                {errors.general && (
                  <p className="text-destructive font-sans text-xs font-normal text-center">
                    {errors.general}
                  </p>
                )}

                {/* Forgot Password Link */}
                <div className="text-right">
                  <a
                    href="#"
                    className="text-primary hover:text-primary/80 transition-colors duration-200 font-sans text-xs font-medium"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-sans text-sm font-medium transition-all duration-200"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              {/* Divider */}
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-card text-muted-foreground relative z-10 px-2 font-sans text-xs font-medium">
                  Or continue with
                </span>
              </div>

              {/* Social Login */}
              <SocialLoginButtons />

              {/* Sign Up Link */}
              <div className="text-center font-sans text-sm font-normal">
                <span className="text-muted-foreground">
                  Don&apos;t have an account?{" "}
                </span>
                <a
                  href="/public/register"
                  className="text-foreground underline underline-offset-4 hover:text-primary transition-colors duration-200"
                >
                  Sign up
                </a>
              </div>
            </div>
          </form>

          <div className="bg-muted relative hidden md:block">
            <Image
              src="https://cdn.bathroomtakeaway.com/media/catalog/product/9/e/9eb1_130-0601-4005pp_lifestyle1.jpg?width=700&height=700&store=uk_view&image-type=image"
              alt="Financial analytics and insights dashboard"
              fill
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <div className="text-primary-foreground">
                <h3 className="text-section-title mb-2">
                  Your financial command center
                </h3>
                <p className="font-sans text-sm font-normal opacity-90">
                  Access powerful insights, intelligent budgeting, and
                  comprehensive financial tracking.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <div className="text-muted-foreground text-center font-sans text-xs font-normal">
        <div className="text-balance">
          Your data is protected with bank-level security.{" "}
          <a
            href="#"
            className="text-foreground underline underline-offset-4 hover:text-primary transition-colors duration-200"
          >
            Learn more
          </a>
          .
        </div>
      </div>
    </div>
  );
}
