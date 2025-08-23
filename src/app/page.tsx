"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Shield,
  Users,
  ArrowRight,
  Check,
  Play,
  Sparkles,
  ChevronDown,
  X,
  Menu,
  PiggyBank,
  Brain,
  CreditCard,
  Target,
  Lock,
  Building,
  Database,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export default function HomePage() {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingPeriod, setPricingPeriod] = useState<"monthly" | "annual">(
    "monthly"
  );

  const features = [
    {
      title: "AI-Powered Budgeting",
      description: "Smart categorization and predictive spending analysis",
      icon: BarChart3,
    },
    {
      title: "Goal Tracking",
      description: "Set and track financial goals with AI-powered insights",
      icon: PiggyBank,
    },
    {
      title: "Bank-Level Security",
      description: "256-bit encryption and biometric authentication",
      icon: Shield,
    },
    {
      title: "Smart Insights",
      description: "Get personalized financial advice and recommendations",
      icon: Brain,
    },
    {
      title: "Expense Tracking",
      description: "Automatically track and categorize expenses",
      icon: CreditCard,
    },
    {
      title: "Investment Tracking",
      description: "Monitor your portfolio and track performance",
      icon: Target,
    },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Marketing Director",
      company: "TechCorp",
      content:
        "Vectr has completely transformed how I manage my finances. The AI insights helped me save $5,000 in just 3 months!",
      avatar: "/avatars/sarah.jpg",
      rating: 5,
    },
    {
      name: "Marcus Johnson",
      role: "Small Business Owner",
      company: "Local Coffee Shop",
      content:
        "As a business owner, keeping track of both personal and business finances was overwhelming. Vectr makes it seamless.",
      avatar: "/avatars/marcus.jpg",
      rating: 5,
    },
    {
      name: "Emily Rodriguez",
      role: "Software Engineer",
      company: "StartupXYZ",
      content:
        "The AI-powered budgeting is incredible. It is like having a financial advisor in my pocket 24/7.",
      avatar: "/avatars/emily.jpg",
      rating: 5,
    },
  ];

  const pricingTiers = [
    {
      name: "Starter",
      price: { monthly: 0, annual: 0 },
      description: "Perfect for getting started",
      features: [
        "Basic budgeting",
        "Expense tracking",
        "Goal setting",
        "Mobile app access",
        "Email support",
      ],
      popular: false,
    },
    {
      name: "Pro",
      price: { monthly: 9.99, annual: 99.99 },
      description: "For serious budgeters",
      features: [
        "Everything in Starter",
        "AI-powered insights",
        "Investment tracking",
        "Advanced analytics",
        "Priority support",
        "Unlimited goals",
      ],
      popular: true,
    },
    {
      name: "Business",
      price: { monthly: 19.99, annual: 199.99 },
      description: "For teams and businesses",
      features: [
        "Everything in Pro",
        "Team collaboration",
        "Business analytics",
        "Custom integrations",
        "Dedicated support",
        "Advanced security",
      ],
      popular: false,
    },
  ];

  const securityFeatures = [
    { name: "SOC 2 Type II", icon: Shield },
    { name: "256-bit Encryption", icon: Lock },
    { name: "FDIC Insured", icon: Building },
    { name: "PCI DSS", icon: Database },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50"
      >
        Skip to main content
      </a>

      {/* Navigation */}
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
              <Button variant="ghost" asChild>
                <a href="/public/login">Sign In</a>
              </Button>
              <Button asChild>
                <a href="/public/register" className="group">
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
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
                    <a href="/public/login">Sign In</a>
                  </Button>
                  <Button className="w-full" asChild>
                    <a href="/public/register">Get Started Free</a>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <main id="main-content">
        <section className="relative pt-20 pb-32 px-6 sm:px-8 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
          </div>

          <div className="max-w-7xl mx-auto relative">
            <div className="text-center max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Badge variant="secondary" className="mb-4">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI-Powered Finance Management
                </Badge>
                <motion.h1
                  className="text-foreground mb-8 font-sans text-6xl font-bold leading-none tracking-tight"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                >
                  Take Control of Your{" "}
                  <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent font-extrabold drop-shadow-md">
                    Financial Future
                  </span>
                </motion.h1>
                <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Join 100,000+ users who have saved millions with Vectr&apos;s
                  AI-powered budgeting, goal tracking, and financial insights.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="group" asChild>
                    <a href="/signup">
                      Start Free Trial
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" className="group">
                    <Play className="w-4 h-4 mr-2" />
                    Watch Demo
                  </Button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="mt-16 flex justify-center"
              >
                <div className="rounded-2xl shadow-xl bg-white/80 border border-slate-200 p-4 w-full max-w-4xl">
                  <div className="flex flex-col items-center">
                    <Image
                      src="/dashboard_preview.png"
                      alt="Vectr Dashboard Preview"
                      width={900}
                      height={400}
                      className="rounded-xl border mb-2 object-cover"
                      style={{ background: "#f3f4f6" }}
                    />
                    <span className="text-lg font-semibold text-gray-800">
                      Vectr Dashboard Preview
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-6 sm:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything You Need to Master Your Money
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed to help you save more, spend smarter,
                and achieve your financial goals faster.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                        <feature.icon className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-muted/50">
          <div className="max-w-7xl mx-auto px-6 sm:px-8">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  $2.4M+
                </div>
                <div className="text-muted-foreground">Total Saved</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  100K+
                </div>
                <div className="text-muted-foreground">Active Users</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  4.9/5
                </div>
                <div className="text-muted-foreground">User Rating</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  99.9%
                </div>
                <div className="text-muted-foreground">Uptime</div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section id="security" className="py-24 px-6 sm:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Bank-Level Security & Privacy
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Your financial data is protected with the same security
                standards used by major banks.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {securityFeatures.map((feature) => (
                <Card key={feature.name} className="text-center">
                  <CardHeader>
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <feature.icon className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.name}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-24 px-6 sm:px-8 bg-muted/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Loved by 100,000+ Users
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Real stories from real people who have transformed their
                finances with Vectr.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Card className="h-full">
                    <CardHeader>
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {testimonial.name}
                          </CardTitle>
                          <CardDescription>
                            {testimonial.role} at {testimonial.company}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex mb-2">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star
                            key={i}
                            className="w-4 h-4 fill-primary text-primary"
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground">
                        &quot;{testimonial.content}&quot;
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 px-6 sm:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Choose the plan that is right for you. Start free, upgrade
                anytime.
              </p>
            </div>

            <div className="flex justify-center mb-8">
              <div className="bg-muted p-1 rounded-lg">
                <button
                  onClick={() => setPricingPeriod("monthly")}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    pricingPeriod === "monthly"
                      ? "bg-background text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setPricingPeriod("annual")}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    pricingPeriod === "annual"
                      ? "bg-background text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Annual (Save 17%)
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {pricingTiers.map((tier) => (
                <Card
                  key={tier.name}
                  className={`relative ${
                    tier.popular ? "border-primary shadow-lg scale-105" : ""
                  }`}
                >
                  {tier.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Most Popular
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-3xl font-bold">
                        ${tier.price[pricingPeriod]}
                      </span>
                      <span className="text-muted-foreground">
                        /{pricingPeriod}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-center">
                          <Check className="w-4 h-4 text-primary mr-2" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full mt-6"
                      variant={tier.popular ? "default" : "outline"}
                      asChild
                    >
                      <a href="/public/register">Get Started</a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 px-6 sm:px-8 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-xl text-muted-foreground">
                Everything you need to know about Vectr
              </p>
            </div>

            <div className="space-y-6">
              {[
                {
                  question: "Is my financial data secure?",
                  answer:
                    "Absolutely. We use bank-level 256-bit encryption, SOC 2 Type II compliance, and never store your banking credentials. Your data is protected with the same security standards used by major financial institutions.",
                },
                {
                  question: "How does the AI budgeting work?",
                  answer:
                    "Our AI analyzes your spending patterns, income, and financial goals to create personalized budgets. It learns from your behavior and provides smart insights to help you save more money automatically.",
                },
                {
                  question: "Can I connect all my bank accounts?",
                  answer:
                    "Yes! Vectr supports connections to over 12,000 financial institutions including banks, credit cards, investment accounts, and even digital wallets like PayPal and Venmo.",
                },
                {
                  question: "What happens after the free trial?",
                  answer:
                    "You can continue using our free plan with basic features, or upgrade to Pro for $9.99/month to unlock AI insights, advanced analytics, and priority support. No hidden fees, cancel anytime.",
                },
                {
                  question: "Is there a mobile app?",
                  answer:
                    "Yes! Vectr is available on both iOS and Android with full feature parity. You can manage your finances on-the-go with biometric authentication and offline access.",
                },
                {
                  question: "How much can I realistically save?",
                  answer:
                    "On average, our users save $347 in their first month and $2,400+ in their first year. The AI identifies spending patterns and suggests specific actions tailored to your financial situation.",
                },
              ].map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-2">
                      {faq.question}
                    </h3>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6 sm:px-8 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Start Saving Money Today
              </h2>
              <p className="text-xl opacity-90 mb-8">
                Join 100,000+ users who have saved over $2.4 million with
                Vectr&apos;s AI-powered budgeting
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Button size="lg" variant="secondary" className="group" asChild>
                  <a href="/signup">
                    Start Free 14-Day Trial
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                  asChild
                >
                  <a href="#features">View Live Demo</a>
                </Button>
              </div>

              <div className="flex items-center justify-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Setup in 2 minutes</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-muted/50 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-foreground rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">Vectr</span>
              </div>
              <p className="text-muted-foreground">
                AI-powered personal finance management for everyone.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#features"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="#security"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Security
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Careers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Status
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 Vectr. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
