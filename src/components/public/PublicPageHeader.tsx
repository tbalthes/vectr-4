"use client";
import React from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, ChevronDown, Menu, X } from "lucide-react";

type Feature = {
  title: string;
  description: string;
  icon: React.ElementType;
};

interface PublicPageHeaderProps {
  features: Feature[];
}

export default function PublicPageHeader({ features }: PublicPageHeaderProps) {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-foreground rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Vectr</span>
            </motion.div>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <div className="relative">
              <button
                onClick={() => setFeaturesOpen(!featuresOpen)}
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1"
                aria-expanded={featuresOpen}
                aria-controls="features-dropdown"
              >
                <span>Features</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    featuresOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {featuresOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg"
                  >
                    <div className="p-2">
                      {features.map((feature) => (
                        <a
                          key={feature.title}
                          href="#"
                          className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md transition-colors"
                        >
                          <feature.icon className="w-4 h-4" />
                          <span className="text-sm">{feature.title}</span>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <a
              href="#pricing"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </a>
            <a
              href="#security"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Security
            </a>
            <a
              href="#testimonials"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Testimonials
            </a>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <a href="/public/login">Sign In</a>
            </Button>
            <Button asChild>
              <a href="/public/register" className="group">
                Sign Up
              </a>
            </Button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border"
          >
            <div className="px-6 py-4 space-y-4">
              <a
                href="#features"
                className="block text-muted-foreground hover:text-foreground"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="block text-muted-foreground hover:text-foreground"
              >
                Pricing
              </a>
              <a
                href="#security"
                className="block text-muted-foreground hover:text-foreground"
              >
                Security
              </a>
              <a
                href="#testimonials"
                className="block text-muted-foreground hover:text-foreground"
              >
                Testimonials
              </a>
              <div className="space-y-2 pt-4 border-t border-border">
                <Button variant="ghost" className="w-full" asChild>
                  <a href="/login">Sign In</a>
                </Button>
                <Button className="w-full" asChild>
                  <a href="/signup">Sign Up</a>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}