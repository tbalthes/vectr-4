"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RulesRedirectPage() {
  const router = useRouter();

  // Auto-redirect after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/private/rules/enhanced");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Enhanced Rules System</CardTitle>
          <CardDescription>
            We've upgraded to a more powerful rules system with advanced AND/OR
            logic, similar to Monarch Money's sophisticated rule builder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              ✨ New Features:
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Complex AND/OR condition groups</li>
              <li>• User-friendly rule descriptions</li>
              <li>• Advanced rule preview with transaction matching</li>
              <li>• Drag-and-drop rule prioritization</li>
              <li>• Enhanced categorization actions</li>
            </ul>
          </div>

          <div className="flex flex-col space-y-3">
            <Link href="/private/rules/enhanced">
              <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                <Zap className="w-4 h-4 mr-2" />
                Go to Enhanced Rules
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            <p className="text-xs text-gray-500 text-center">
              Redirecting automatically in 3 seconds...
            </p>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-gray-600 text-center">
              Looking for the old rules interface? It's been replaced with this
              enhanced version that supports complex transaction matching logic.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
