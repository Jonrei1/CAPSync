"use client"

import { useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDesignStandard } from "@/components/ui/design-standard"
import { cn } from "@/lib/utils"

export default function DesignStandardPage() {
  const ds = useDesignStandard()
  const [openPreview, setOpenPreview] = useState(false)
  const [name, setName] = useState("")
  const [methodology, setMethodology] = useState("scrum")
  const [pickedColor, setPickedColor] = useState("#4f46e5")

  const palette = [
    { id: "primary", token: ds.designTokens.palette.primary },
    { id: "secondary", token: ds.designTokens.palette.secondary },
    { id: "success", token: ds.designTokens.palette.success },
    { id: "warning", token: ds.designTokens.palette.warning },
    { id: "danger", token: ds.designTokens.palette.danger },
    { id: "neutral", token: ds.designTokens.palette.neutral },
  ]

  const appPalette = [
    { id: "brand-primary", hex: ds.designTokens.palette.app.brandPrimary, label: "Brand Primary" },
    { id: "brand-accent", hex: ds.designTokens.palette.app.brandAccent, label: "Brand Accent" },
    { id: "status-online", hex: ds.designTokens.palette.app.status.online, label: "Status Online" },
    { id: "status-warning", hex: ds.designTokens.palette.app.status.warning, label: "Status Warning" },
    { id: "status-danger", hex: ds.designTokens.palette.app.status.danger, label: "Status Danger" },
    ...ds.designTokens.palette.app.circleSet.map((hex, index) => ({
      id: `circle-${index + 1}`,
      hex,
      label: `Circle ${index + 1}`,
    })),
  ]

  const radiusPreview = [
    { label: "xs", className: ds.designTokens.radius.xs },
    { label: "sm", className: ds.designTokens.radius.sm },
    { label: "md", className: ds.designTokens.radius.md },
    { label: "lg", className: ds.designTokens.radius.lg },
    { label: "full", className: ds.designTokens.radius.full },
  ]

  return (
    <main className={ds.layout.page}>
      <section className={ds.layout.section + " " + ds.layout.sectionPad}>
        <header className={ds.layout.stack.md}>
          <h1 className={ds.seo.pageTitle}>Design Standard</h1>
          <p className={ds.designTokens.text.muted}>
            Canonical style reference for spacing, typography, SEO heading order, forms, buttons, cards, color system,
            modal structure, and layout presets.
          </p>
        </header>

        <section className={ds.layout.grid2 + " " + ds.layout.margin.sectionTop}>
          <article className={ds.cards.stat + " " + ds.layout.cardPad + " " + ds.layout.stack.sm}>
            <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Typography + SEO Headings</h2>
            <p className={ds.designTokens.text.help}>Use semantic order: h1 then h2, h3, h4 for better crawler structure.</p>

            <div className={ds.layout.stack.xs}>
              <h2 className={ds.seo.sectionTitle}>Section Heading (h2)</h2>
              <h3 className={ds.seo.blockTitle}>Block Heading (h3)</h3>
              <h4 className={ds.seo.subBlockTitle}>Sub Block Heading (h4)</h4>
              <p className={ds.designTokens.text.body}>Body text sample for readable default content blocks.</p>
            </div>
          </article>

          <article className={ds.cards.stat + " " + ds.layout.cardPad + " " + ds.layout.stack.sm}>
            <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Spacing + Layout</h2>
            <p className={ds.designTokens.text.help}>Page and section spacing below come directly from ds.layout and token scales.</p>
            <div className={ds.layout.row + " " + ds.layout.stack.xs}>
              <span className="rounded-md border bg-muted px-2 py-1 text-xs">{ds.designTokens.spacing.sectionX}</span>
              <span className="rounded-md border bg-muted px-2 py-1 text-xs">{ds.designTokens.spacing.sectionY}</span>
              <span className="rounded-md border bg-muted px-2 py-1 text-xs">{ds.designTokens.spacing.gapMd}</span>
            </div>
          </article>
        </section>

        <section className={ds.layout.grid2 + " " + ds.layout.margin.sectionTop}>
          <article className={ds.cards.panel + " " + ds.layout.panelPad + " " + ds.layout.stack.sm}>
            <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Clickable + Buttons</h2>
            <div className="flex flex-wrap gap-2">
              <Button className={ds.button.primary}>Primary</Button>
              <Button variant="outline" className={ds.button.outline}>Outline</Button>
              <Button variant="secondary" className={ds.button.secondary}>Secondary</Button>
              <Button variant="ghost" className={ds.button.ghost}>Ghost</Button>
              <Button variant="destructive" className={ds.button.destructive}>Danger</Button>
              <button type="button" className={ds.clickable.link}>Text link style</button>
            </div>
          </article>

          <article className={ds.cards.panel + " " + ds.layout.panelPad + " " + ds.layout.stack.sm}>
            <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Form Controls</h2>
            <div className={ds.field.wrapper}>
              <label className={ds.field.label} htmlFor="example-name">Circle Name</label>
              <Input
                id="example-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Thesis Group A"
              />
            </div>
            <div className={ds.field.wrapper + " mt-3"}>
              <label className={ds.field.label}>Methodology</label>
              <Select value={methodology} onValueChange={setMethodology}>
                <SelectTrigger className={ds.field.selectTrigger}>
                  <SelectValue placeholder="Select methodology" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scrum">Scrum</SelectItem>
                  <SelectItem value="agile">Agile</SelectItem>
                  <SelectItem value="kanban">Kanban</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </article>
        </section>

        <section className={ds.layout.grid2 + " " + ds.layout.margin.sectionTop}>
          <article className={ds.cards.panel + " " + ds.layout.panelPad + " " + ds.layout.stack.sm}>
            <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Color Palette</h2>
            <div className={ds.layout.row + " flex-wrap"}>
              {palette.map(({ id, token }) => (
                <div key={id} className="w-32 rounded-lg border border-border/70 bg-background p-2">
                  <div className="h-9 rounded-md border border-border/70" style={{ backgroundColor: token.hex }} />
                  <div className="mt-1 text-[11px] font-medium">{token.hex}</div>
                </div>
              ))}
            </div>
          </article>

          <article className={ds.cards.panel + " " + ds.layout.panelPad + " " + ds.layout.stack.sm}>
            <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Color Picker</h2>
            <div className={ds.colorPicker.wrapper}>
              <label className={ds.colorPicker.label} htmlFor="theme-color">Theme color</label>
              <div className={ds.colorPicker.row}>
                <input
                  id="theme-color"
                  type="color"
                  value={pickedColor}
                  onChange={(event) => setPickedColor(event.target.value)}
                  className={ds.colorPicker.input}
                />
                <span className="text-xs text-muted-foreground">{pickedColor}</span>
              </div>
              <div className={ds.colorPicker.grid}>
                {palette.map(({ id, token }) => {
                  const isActive = token.hex.toLowerCase() === pickedColor.toLowerCase()
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPickedColor(token.hex)}
                      className={cn(ds.colorPicker.swatch, isActive && ds.colorPicker.swatchActive)}
                      style={{ backgroundColor: token.hex }}
                      aria-label={`Pick ${token.hex}`}
                    />
                  )
                })}
              </div>
            </div>
          </article>
        </section>

        <section className={ds.cards.panel + " " + ds.layout.panelPad + " " + ds.layout.margin.sectionTop}>
          <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>App Color Palette (Canonical)</h2>
          <p className={ds.designTokens.text.help}>Use this set for circle chips, avatar accents, status markers, and theme highlights.</p>
          <div className={ds.layout.margin.sectionTop + " " + ds.layout.grid3}>
            {appPalette.map((swatch) => (
              <div key={swatch.id} className="rounded-lg border border-border/70 bg-background p-3">
                <div className="h-10 rounded-md border border-border/70" style={{ backgroundColor: swatch.hex }} />
                <div className="mt-2 text-xs font-medium text-foreground">{swatch.label}</div>
                <div className="text-[11px] text-muted-foreground">{swatch.hex}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={ds.layout.grid2 + " " + ds.layout.margin.sectionTop}>
          <article className={ds.cards.panel + " " + ds.layout.panelPad + " " + ds.layout.stack.sm}>
            <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Card Styles</h2>
            <div className={ds.layout.grid2}>
              <div className={ds.cards.compact}>Compact</div>
              <div className={ds.cards.elevated + " p-3"}>Elevated</div>
              <div className={ds.cards.glass + " p-3"}>Glass</div>
              <button type="button" className={ds.cards.interactive}>Interactive Card</button>
            </div>
          </article>

          <article className={ds.cards.panel + " " + ds.layout.panelPad + " " + ds.layout.stack.sm}>
            <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Border Radius</h2>
            <div className={ds.layout.row + " flex-wrap"}>
              {radiusPreview.map((item) => (
                <div key={item.label} className="w-24">
                  <div className={cn("h-12 border border-border/70 bg-muted", item.className)} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.label} ({ds.designTokens.radiusValue[item.label]})
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className={ds.cards.panel + " " + ds.layout.panelPad + " " + ds.layout.margin.sectionTop}>
          <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Modal Standard</h2>
          <p className={ds.designTokens.text.muted + " mb-3"}>
            Uses standardized modal classes from the central design standard.
          </p>
          <Button onClick={() => setOpenPreview(true)} className={ds.button.primary}>Open Modal Preview</Button>
        </section>

        <section className={ds.cards.panel + " " + ds.layout.panelPad + " " + ds.layout.margin.sectionTop}>
          <h2 className={ds.getSeoHeadingClass("h2", ds.designTokens.fontSize.sm)}>Calendar Standard (/calendar)</h2>
          <p className={ds.designTokens.text.muted + " mb-3"}>
            The /calendar route is the canonical calendar UI. Use ds.calendar tokens for the shell, date jump popover,
            and hover tooltip so future calendar views stay visually aligned.
          </p>

          <div className={ds.calendar.card}>
            <div className={ds.calendar.toolbar}>
              <div className={ds.layout.row}>
                <Button variant="outline" className={ds.button.outline}>Previous</Button>
                <Button variant="outline" className={ds.button.outline}>Today</Button>
                <Button variant="outline" className={ds.button.outline}>Next</Button>
              </div>

              <div className={ds.calendar.dateJump}>
                <span className={ds.calendar.dateJumpLabel}>Go to date</span>
                <div className={ds.calendar.dateJumpPopover}>
                  <div className="px-3 py-2 text-[11px] text-zinc-600">Calendar popover shell (canonical)</div>
                </div>
              </div>
            </div>
          </div>

          <div className={ds.layout.margin.sectionTop + " " + ds.layout.grid2}>
            <div className={ds.cards.compact}>
              <div className="mb-2 text-xs font-semibold text-zinc-800">Required Tokens</div>
              <ul className="space-y-1 text-[11px] text-zinc-600">
                <li>ds.calendar.card</li>
                <li>ds.calendar.toolbar</li>
                <li>ds.calendar.dateJump</li>
                <li>ds.calendar.dateJumpPopover</li>
              </ul>
            </div>

            <div className={ds.cards.compact}>
              <div className="mb-2 text-xs font-semibold text-zinc-800">Tooltip Standard</div>
              <div className={ds.calendar.tooltip + " static min-w-0"}>
                <div className={ds.calendar.tooltipTitle}>Task Name</div>
                <div className={ds.calendar.tooltipRow}>
                  <span className={ds.calendar.tooltipDot} style={{ backgroundColor: ds.designTokens.palette.app.brandPrimary }} />
                  <span>09:00 AM - 10:00 AM</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      {openPreview ? (
        <div className={ds.modal.overlay} onClick={() => setOpenPreview(false)}>
          <div className={ds.modal.card} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label="Close preview"
              className={ds.modal.closeButton}
              onClick={() => setOpenPreview(false)}
            >
              <X className="size-4" />
            </button>

            <div className={ds.modal.header}>
              <div className={ds.modal.badge}>Modal System</div>
              <h2 className={ds.modal.title}>Create circle</h2>
              <p className={ds.modal.description}>
                This preview demonstrates the standardized modal shell and form elements.
              </p>
            </div>

            <div className={ds.modal.shell}>
              <div className={ds.modal.body}>
                <div className={ds.field.wrapper}>
                  <label className={ds.field.label} htmlFor="modal-circle-name">Circle name</label>
                  <Input id="modal-circle-name" placeholder="e.g. Mobile Dev Team" />
                </div>

                <div className={ds.field.wrapper}>
                  <label className={ds.field.label}>Methodology</label>
                  <Select defaultValue="scrum">
                    <SelectTrigger className={ds.field.selectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scrum">Scrum</SelectItem>
                      <SelectItem value="agile">Agile</SelectItem>
                      <SelectItem value="kanban">Kanban</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className={ds.modal.actions}>
                  <Button variant="outline" className={ds.button.outline} onClick={() => setOpenPreview(false)}>
                    Cancel
                  </Button>
                  <Button className={ds.button.primary} onClick={() => setOpenPreview(false)}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
