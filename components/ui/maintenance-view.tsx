"use client"

import { Construction, Wallet, ArrowLeft, Layers, TrendingUp, ShieldCheck } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { designStandard, designTokens } from "@/components/ui/design-standard"
import { cn } from "@/lib/utils"

interface MaintenanceViewProps {
  title: string
  description?: string
}

export function MaintenanceView({ 
  title, 
  description = "We're currently building something great. This feature will be available soon." 
}: MaintenanceViewProps) {
  const features = [
    {
      icon: <Wallet className="h-5 w-5 text-indigo-500" />,
      title: "Expense Management",
      description: "Track and categorize group expenses with ease."
    },
    {
      icon: <Layers className="h-5 w-5 text-emerald-500" />,
      title: "Shared Contributions",
      description: "Manage member contributions and automated reminders."
    },
    {
      icon: <TrendingUp className="h-5 w-5 text-amber-500" />,
      title: "Financial Analytics",
      description: "Visual insights into your group's spending patterns."
    },
    {
      icon: <ShieldCheck className="h-5 w-5 text-blue-500" />,
      title: "Secure Transactions",
      description: "Enterprise-grade security for all financial data."
    }
  ]

  return (
    <div className={cn("flex min-h-[70vh] flex-col items-center justify-center", designStandard.layout.page)}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border/50 bg-card/50 p-8 shadow-2xl backdrop-blur-xl md:p-12">
        {/* Back Button */}
   

        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <Construction className="h-10 w-10 animate-pulse" />
          </div>

          <div className="mb-2 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium tracking-wider text-primary uppercase">
            Work in Progress
          </div>
          
          <h1 className={cn("mb-3", designStandard.seo.pageTitle)}>
            {title}
          </h1>
          
          <p className={cn("mb-10 max-w-md", designTokens.text.subtitle)}>
            {description}
          </p>

          <div className="grid w-full grid-cols-1 gap-4 text-left md:grid-cols-2">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="group rounded-2xl border border-border/40 bg-background/40 p-4 transition-all hover:border-border/80 hover:bg-background/60"
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="rounded-lg bg-background p-2 shadow-sm">
                    {feature.icon}
                  </div>
                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                </div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-4">
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "h-11 rounded-xl px-8 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 active:scale-[0.98]",
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
 
    </div>
  )
}
