"use client";
import { SignupForm } from "@/components/public/register/SignUpForm";

export default function RegisterPage() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-white shadow-2xl dark:bg-background">
      <SignupForm />
    </div>
  );
}
