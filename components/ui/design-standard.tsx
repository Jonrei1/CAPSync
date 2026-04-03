"use client"

import { useMemo } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type HeadingLevel = "h1" | "h2" | "h3" | "h4"

type InteractiveState = {
  active?: boolean
  disabled?: boolean
}

const clickableBase = "cursor-pointer transition-colors duration-150"
const clickableHover = "hover:bg-muted/60 hover:text-foreground"
const clickableDisabled = "cursor-not-allowed opacity-60"
const buttonEnhanced = "h-9 px-3 transition-colors duration-150"

export const designTokens = {
  font: {
    sans: "font-sans",
    mono: "font-mono",
    weight: {
      regular: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  fontSize: {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-2xl",
    "3xl": "text-3xl",
  },
  radius: {
    xs: "rounded-md",
    sm: "rounded-lg",
    md: "rounded-xl",
    lg: "rounded-2xl",
    full: "rounded-full",
  },
  radiusValue: {
    xs: "0.375rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    full: "9999px",
  },
  spacing: {
    px: "p-1",
    xs: "p-2",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
    xl: "p-8",
    sectionY: "py-6",
    sectionX: "px-4 sm:px-6",
    section: "space-y-4",
    block: "space-y-3",
    field: "space-y-1.5",
    stackXs: "space-y-1",
    stackSm: "space-y-2",
    stackMd: "space-y-3",
    stackLg: "space-y-4",
    stackXl: "space-y-6",
    gapXs: "gap-1",
    gapSm: "gap-2",
    gapMd: "gap-3",
    gapLg: "gap-4",
    gapXl: "gap-6",
  },
  margin: {
    xs: "m-1",
    sm: "m-2",
    md: "m-4",
    lg: "m-6",
    xl: "m-8",
    sectionTop: "mt-6",
    sectionBottom: "mb-6",
  },
  text: {
    title: "text-[16px] font-semibold tracking-tight",
    subtitle: "text-[12px] leading-relaxed text-muted-foreground",
    label: "text-xs font-medium text-foreground",
    help: "text-[11px] leading-relaxed text-muted-foreground",
    h1: "text-3xl font-bold tracking-tight text-foreground",
    h2: "text-2xl font-semibold tracking-tight text-foreground",
    h3: "text-xl font-semibold tracking-tight text-foreground",
    h4: "text-lg font-semibold text-foreground",
    body: "text-sm text-foreground",
    muted: "text-sm text-muted-foreground",
  },
  palette: {
    app: {
      brandPrimary: "#4f46e5",
      brandAccent: "#16a34a",
      sidebarBg: "#ffffff",
      sidebarText: "#18181b",
      pageBg: "#f8fafc",
      cardBg: "#ffffff",
      border: "#e4e4e7",
      memberSet: ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"],
      circleSet: ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"],
      status: {
        online: "#22c55e",
        warning: "#f59e0b",
        danger: "#dc2626",
      },
    },
    primary: {
      hex: "#4f46e5",
      bg: "bg-primary",
      text: "text-primary",
      border: "border-primary",
    },
    secondary: {
      hex: "#64748b",
      bg: "bg-secondary",
      text: "text-secondary-foreground",
      border: "border-secondary",
    },
    success: {
      hex: "#16a34a",
      bg: "bg-green-600",
      text: "text-green-700",
      border: "border-green-300",
    },
    warning: {
      hex: "#f59e0b",
      bg: "bg-amber-500",
      text: "text-amber-700",
      border: "border-amber-300",
    },
    danger: {
      hex: "#dc2626",
      bg: "bg-destructive",
      text: "text-destructive",
      border: "border-destructive",
    },
    neutral: {
      hex: "#64748b",
      bg: "bg-muted",
      text: "text-muted-foreground",
      border: "border-border",
    },
  },
  surfaces: {
    card: "rounded-2xl border border-border/70 bg-card shadow-sm",
    panel: "rounded-xl border border-border/70 bg-background",
    mutedPanel: "rounded-xl border border-border/70 bg-muted/40",
    elevated: "rounded-2xl border border-border/70 bg-card shadow-lg",
    glass: "rounded-2xl border border-border/70 bg-background/80 shadow-sm backdrop-blur",
  },
} as const

const headingClassMap: Record<HeadingLevel, string> = {
  h1: designTokens.text.h1,
  h2: designTokens.text.h2,
  h3: designTokens.text.h3,
  h4: designTokens.text.h4,
}

export function getSeoHeadingClass(level: HeadingLevel, className?: string) {
  return cn(headingClassMap[level], className)
}

export function interactiveClassName(
  className?: string,
  state: InteractiveState = {},
) {
  if (state.disabled) {
    return cn(className, clickableDisabled)
  }

  return cn(clickableBase, clickableHover, state.active && "bg-muted text-foreground", className)
}

export function clickableCardClassName(
  className?: string,
  state: InteractiveState = {},
) {
  return interactiveClassName(
    cn(
      "w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-left transition-all",
      "hover:-translate-y-0.5 hover:border-border hover:bg-muted/40",
      state.active && "border-primary bg-primary/10 shadow-sm",
      className,
    ),
    state,
  )
}

export const designStandard = {
  seo: {
    pageTitle: designTokens.text.h1,
    sectionTitle: designTokens.text.h2,
    blockTitle: designTokens.text.h3,
    subBlockTitle: designTokens.text.h4,
    headingOrder: ["h1", "h2", "h3", "h4"] as const,
    landmark: {
      main: "[&>h1]:mb-2",
      section: "space-y-3 [&>h2]:mb-1",
      article: "space-y-2 [&>h3]:mb-1",
    },
  },
  clickable: {
    base: clickableBase,
    hover: clickableHover,
    disabled: clickableDisabled,
    icon: cn(clickableBase, "inline-flex items-center justify-center", "hover:bg-muted hover:text-foreground"),
    subtle: cn(clickableBase, "text-muted-foreground hover:text-foreground"),
    ghost: cn(clickableBase, "rounded-md hover:bg-muted"),
    link: cn(clickableBase, "text-primary underline-offset-4 hover:underline"),
  },
  button: {
    primary: buttonVariants({
      variant: "default",
      size: "default",
      className: cn(clickableBase, buttonEnhanced, "hover:bg-primary/90"),
    }),
    outline: buttonVariants({
      variant: "outline",
      size: "default",
      className: cn(clickableBase, buttonEnhanced, "hover:bg-muted/80"),
    }),
    secondary: buttonVariants({
      variant: "secondary",
      size: "default",
      className: cn(clickableBase, buttonEnhanced, "hover:bg-secondary/90"),
    }),
    ghost: buttonVariants({
      variant: "ghost",
      size: "default",
      className: cn(clickableBase, buttonEnhanced, "hover:bg-muted/80"),
    }),
    destructive: buttonVariants({
      variant: "destructive",
      size: "default",
      className: cn(clickableBase, buttonEnhanced, "hover:bg-destructive/30"),
    }),
    link: buttonVariants({
      variant: "link",
      size: "default",
      className: cn(clickableBase, buttonEnhanced),
    }),
    small: buttonVariants({ variant: "outline", size: "sm", className: clickableBase }),
    extraSmall: buttonVariants({ variant: "outline", size: "xs", className: clickableBase }),
    icon: buttonVariants({ variant: "ghost", size: "icon-sm", className: clickableBase }),
    iconXs: buttonVariants({ variant: "ghost", size: "icon-xs", className: clickableBase }),
    iconLg: buttonVariants({ variant: "ghost", size: "icon-lg", className: clickableBase }),
    solidPrimary: cn(buttonVariants({ variant: "default", size: "default" }), "cursor-pointer"),
    solidDanger: cn(buttonVariants({ variant: "destructive", size: "default" }), "cursor-pointer"),
  },
  modal: {
    overlay:
      "fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-black/55 px-3 py-4 backdrop-blur-[2px] sm:items-center sm:px-4",
    card: "relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl",
    closeButton: cn(
      "absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md",
      "text-muted-foreground transition-colors",
      clickableBase,
      "hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60",
    ),
    shell: "max-h-[calc(100vh-9rem)] overflow-y-auto px-4 pb-4 sm:px-6",
    header: "px-4 pt-5 pb-3 pr-14 sm:px-6",
    badge:
      "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
    title: designTokens.text.title,
    description: cn("mt-1", designTokens.text.subtitle),
    body: "space-y-4",
    actions: "flex justify-end gap-2 border-t pt-3",
  },
  field: {
    wrapper: designTokens.spacing.field,
    label: designTokens.text.label,
    help: designTokens.text.help,
    input: cn(
      "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
      "outline-none transition-[color,box-shadow,border-color]",
      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
      "disabled:cursor-not-allowed disabled:opacity-60",
    ),
    selectTrigger: cn(
      "h-10 w-full justify-between rounded-md border border-input bg-background px-3 text-sm",
      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
      "disabled:cursor-not-allowed disabled:opacity-60",
      clickableBase,
    ),
    error: "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700",
  },
  tabs: {
    wrapper: "grid grid-cols-2 gap-2 rounded-md border bg-muted p-1",
    tabBase: cn("h-7 justify-center text-xs", clickableBase),
    active: "border border-border bg-background text-foreground shadow-xs",
    inactive: "text-muted-foreground hover:text-foreground",
  },
  cards: {
    panel: designTokens.surfaces.panel,
    mutedPanel: designTokens.surfaces.mutedPanel,
    elevated: designTokens.surfaces.elevated,
    glass: designTokens.surfaces.glass,
    compact: "rounded-lg border border-border/70 bg-background p-3 shadow-xs",
    stat: "rounded-xl border border-border/70 bg-card p-4 shadow-sm",
    interactive: clickableCardClassName(),
  },
  calendar: {
    page: "space-y-3 text-zinc-900",
    card: "rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden",
    toolbar: "flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3",
    dateJump: "inline-flex items-center gap-1.5 border-l border-zinc-200 pl-2",
    dateJumpLabel: "text-[11px] text-zinc-500",
    dateJumpPopover:
      "w-auto overflow-hidden rounded-lg border border-zinc-200 bg-white p-0 text-zinc-900 shadow-lg",
    tooltip:
      "pointer-events-none fixed top-0 left-0 z-90 min-w-44 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-xs text-zinc-700 shadow-lg backdrop-blur",
    tooltipTitle: "mb-1 text-[11px] font-semibold text-zinc-900",
    tooltipRow: "flex items-center gap-1.5",
    tooltipDot: "h-1.5 w-1.5 rounded-full",
  },
  colorPicker: {
    wrapper: "space-y-2",
    row: "flex flex-wrap items-center gap-2",
    input:
      "h-9 w-11 cursor-pointer rounded-md border border-border/70 bg-background p-1 transition-colors hover:border-border",
    swatch:
      "h-7 w-7 cursor-pointer rounded-full border border-border/70 transition-all hover:-translate-y-0.5 hover:shadow-sm",
    swatchActive: "ring-2 ring-ring ring-offset-2 ring-offset-background",
    label: designTokens.text.label,
    helper: designTokens.text.help,
    grid: "grid grid-cols-8 gap-2",
  },
  layout: {
    container: "mx-auto w-full max-w-6xl",
    page: "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6",
    section: designTokens.spacing.section,
    block: designTokens.spacing.block,
    sectionPad: cn(designTokens.spacing.sectionX, designTokens.spacing.sectionY),
    panelPad: "p-4 sm:p-5",
    cardPad: "p-3 sm:p-4",
    grid2: "grid grid-cols-1 gap-3 md:grid-cols-2",
    grid3: "grid grid-cols-1 gap-3 md:grid-cols-3",
    stack: {
      xs: designTokens.spacing.stackXs,
      sm: designTokens.spacing.stackSm,
      md: designTokens.spacing.stackMd,
      lg: designTokens.spacing.stackLg,
      xl: designTokens.spacing.stackXl,
    },
    margin: designTokens.margin,
    row: "flex items-center gap-2",
    rowBetween: "flex items-center justify-between gap-2",
  },
} as const

export function useDesignStandard() {
  return useMemo(
    () => ({
      ...designStandard,
      designTokens,
      getSeoHeadingClass,
      interactiveClassName,
      clickableCardClassName,
    }),
    [],
  )
}
