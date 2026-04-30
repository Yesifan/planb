---
name: Planb
description: AI-driven interactive storytelling system
colors:
  background: "oklch(1 0.005 260)"
  foreground: "oklch(0.145 0.005 260)"
  card: "oklch(1 0.005 260)"
  card-foreground: "oklch(0.145 0.005 260)"
  popover: "oklch(1 0.005 260)"
  popover-foreground: "oklch(0.145 0.005 260)"
  primary: "oklch(0.205 0.01 260)"
  primary-foreground: "oklch(0.985 0.001 260)"
  secondary: "oklch(0.97 0.005 260)"
  secondary-foreground: "oklch(0.205 0.01 260)"
  muted: "oklch(0.97 0.004 260)"
  muted-foreground: "oklch(0.556 0.01 260)"
  accent: "oklch(0.58 0.22 260)"
  accent-foreground: "oklch(0.985 0.001 260)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.922 0.006 260)"
  input: "oklch(0.922 0.006 260)"
  ring: "oklch(0.68 0.16 260)"
typography:
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "Geist Mono, monospace"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "Quicksand, Geist, system-ui, sans-serif"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
---

# Design System: Planb

## 1. Overview

**Creative North Star: "The Quiet Canvas"**

A minimal, focused interface that puts story content and conversation front and center. The design is intentionally restrained with subtle purple-tinted neutrals and a single saturated accent color for moments of personality. The interface feels calm and trustworthy, with just enough playful detail to avoid feeling sterile.

The system rejects flashy SaaS tropes — no hero metrics, no gradient text, no glassmorphism. Depth comes from subtle layering and careful spacing, not heavy shadows. Animation is purposeful and restrained, used only to communicate state changes, not to draw attention to itself.

**Key Characteristics:**
- Tinted neutral palette with a single purple/violet brand hue (260°)
- Dual-theme support (light and dark) with seamless system preference adaptation
- Subtle rounded corners with consistent scale
- Generous whitespace that lets content breathe
- Purposeful motion — state feedback only, no decorative animation
- Clean typographic hierarchy with distinct voice for headings

## 2. Colors

The palette follows a **Restrained** color strategy — tinted neutrals with one accent used sparingly (≤10% of any screen). All neutrals carry a subtle purple tint from the brand hue, creating visual harmony without being loud.

### Primary
- **Near-Black Violet Tint** (oklch(0.205 0.01 260)): Primary text and interactive elements. Dark enough for maximum contrast, with just enough chroma to feel warm, not cold. Used for default buttons and high-contrast text.

### Secondary
- **Off-White Violet Tint** (oklch(0.97 0.005 260)): Secondary button backgrounds and subtle interactive surfaces. Creates a soft pressed state on hover.

### Accent
- **Vibrant Violet** (oklch(0.58 0.22 260)): The "playful" color. Used sparingly for focus rings, highlights, and moments of personality. This is the only saturated color in the system — its rarity is its strength.

### Neutral
- **Canvas White** (oklch(1 0.005 260)): Page background, purest white with a hint of violet.
- **Card Surface** (oklch(1 0.005 260)): Same as background in light mode, distinct in dark mode.
- **Subtle Border** (oklch(0.922 0.006 260)): Input borders, dividers, card edges.
- **Muted Text** (oklch(0.556 0.01 260)): Secondary text, descriptions, placeholders.
- **Foreground** (oklch(0.145 0.005 260)): Primary body text.

### Semantic
- **Destructive Red** (oklch(0.577 0.245 27.325)): Error states, destructive actions.
- **Focus Ring** (oklch(0.68 0.16 260)): Keyboard focus indicator.

### Named Rules
**The One Voice Rule.** The vibrant violet accent is used on ≤10% of any given screen. Its rarity is the point — it draws attention only to what matters.

**The Tint Continuity Rule.** Every neutral color carries the same brand hue (260°). No grays, no off-blacks — every surface has a subtle violet undertone that ties the system together.

**The Dark Mode Symmetry Rule.** Dark mode is not an afterthought. Every color token has a direct dark-mode counterpart that maintains the same relative contrast and feeling. Switching modes should feel like turning down the lights, not entering a different app.

## 3. Typography

**Body Font:** Geist (with system-ui fallback)  
**Heading Font:** Quicksand (with Geist fallback)  
**Mono Font:** Geist Mono (with monospace fallback)

The pairing balances technical clarity (Geist) with approachable warmth (Quicksand headings). Body text is clean and readable for long reading sessions; headings have a subtle rounded personality that fits the storytelling theme.

### Hierarchy
- **Display** (500, clamp(1.5rem, 3vw, 2.5rem), 1.2): Page titles, hero headings. Quicksand.
- **Headline** (500, 1.25rem, 1.3): Section headers, card titles. Quicksand.
- **Title** (500, 1rem, 1.3): Sub-section headers, form labels. Geist medium.
- **Body** (400, 0.875rem, 1.5): Paragraph text, conversation messages. Geist regular. Line length capped at ~65ch for readability.
- **Label** (500, 0.75rem, 1.4, uppercase or not): Button text, UI labels, metadata. Geist medium.

### Named Rules
**The Readability First Rule.** Conversation text is the product. Body text must maintain comfortable line length (≤65ch), adequate line height (1.5), and AA+ contrast in both modes. Never sacrifice reading comfort for aesthetic effect.

**The Whisper Rule.** Muted text is intentionally soft but never unreadable. It should fade into the background when you don't need it, but still be there when you do. Minimum contrast: 4.5:1.

## 4. Elevation

This system uses **flat-by-default tonal layering** instead of shadows. Depth is communicated through background color shifts and subtle borders, not through drop shadows. Cards have a faint 1px ring, not a shadow. This keeps the interface clean and focused on content.

If shadows are used (e.g., for popovers or dropdowns), they are soft, subtle, and low-opacity. The goal is to suggest depth, not declare it.

### Shadow Vocabulary
- **Subtle Lift** (`0 2px 8px rgba(0,0,0,0.08)`): Used only for elevated surfaces that need to sit above content — popovers, dropdown menus, toasts. Never used on cards or buttons at rest.

### Named Rules
**The No-Shadow-at-Rest Rule.** Buttons, cards, inputs, and all primary UI elements have no drop shadow in their default state. Shadows appear only as a response to state (hover, focus, elevation), and even then, they are subtle.

**The Ring Preference Rule.** When you need to define a surface edge, use a 1px semi-transparent ring before reaching for a shadow. It's cleaner and fits the minimal aesthetic.

## 5. Components

### Buttons
- **Shape**: Soft rounded corners (0.625rem / lg). Gently curved, not aggressively rounded, not sharp.
- **Primary**: Near-black violet background (`primary`), high-contrast light text (`primary-foreground`). 8px vertical padding, 16px horizontal. 80% opacity on hover.
- **Outline**: Transparent background, border in `border` color. Muted background on hover.
- **Secondary**: Soft off-white background (`secondary`), dark text. 80% opacity on hover.
- **Ghost**: No background, no border. Muted background on hover.
- **Destructive**: 10% red background, red text. 20% opacity on hover.
- **Hover / Focus**: All variants use subtle opacity shifts for hover. Focus uses 3px `ring` color ring with 50% opacity, plus border color change.

### Inputs / Text Fields
- **Style**: Transparent background, 1px border in `border` color. Rounded lg (0.625rem).
- **Height**: 32px compact height.
- **Padding**: 4px vertical, 10px horizontal.
- **Focus**: Border shifts to `ring` color, plus 3px ring at 50% opacity.
- **Error**: Border shifts to `destructive`, with matching ring.

### Cards / Containers
- **Corner Style**: Generously rounded (0.875rem / xl). Softer than buttons — cards are containers, not interactive elements.
- **Background**: `card` color (matches background in light mode, distinct in dark mode).
- **Border Strategy**: Subtle 1px ring at 10% opacity (`ring-1 ring-foreground/10`). No shadow at rest.
- **Internal Padding**: 16px padding (sm size: 12px).
- **Internal Spacing**: 16px gap between sections (sm size: 12px).
- **Footer**: Muted background at 50% opacity, top border, 16px padding.

### Dialog / Modal
- **Shape**: Rounded xl, matching cards.
- **Elevation**: Uses the Subtle Lift shadow only when open.
- **Backdrop**: Semi-transparent dark overlay.

### Navigation
- **Style**: Minimal, no dedicated nav bar chrome.
- **States**: Ghost buttons for navigation items, with background shift on hover/active.

## 6. Do's and Don'ts

### Do:
- **Do** tint every neutral toward the brand hue (260°). No pure grays anywhere.
- **Do** use the vibrant violet accent sparingly — ≤10% of any screen.
- **Do** maintain full light/dark mode parity for every token and component.
- **Do** prefer rings over shadows for surface definition.
- **Do** use Quicksand for headings, Geist for body text — the contrast is intentional.
- **Do** cap conversation text line length at ~65ch for readability.
- **Do** animate only state changes — hover, focus, transitions between views.

### Don't:
- **Don't** use gradient text. Decorative, never meaningful.
- **Don't** use glassmorphism effects. Blurred backgrounds add visual noise without value.
- **Don't** add shadows to buttons or cards at rest. Keep surfaces flat and clean.
- **Don't** introduce new colors outside the palette. The system works because it's constrained.
- **Don't** use heavy border-radius on interactive elements. The lg scale for buttons, xl for cards is the maximum.
- **Don't** add decorative animations that don't communicate state. If it doesn't tell the user something, remove it.
- **Don't** create SaaS landing-page clichés: hero metrics, feature grids with icons, generic testimonials.
