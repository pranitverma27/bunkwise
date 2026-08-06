---
name: Vibrant Student Pulse
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d4c0d7'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#9d8ba0'
  outline-variant: '#504254'
  surface-tint: '#ebb2ff'
  primary: '#ebb2ff'
  on-primary: '#520072'
  primary-container: '#bc13fe'
  on-primary-container: '#ffffff'
  inverse-primary: '#9800d0'
  secondary: '#d7ffc5'
  on-secondary: '#053900'
  secondary-container: '#2ff801'
  on-secondary-container: '#0f6d00'
  tertiary: '#00dbe9'
  on-tertiary: '#00363a'
  tertiary-container: '#00848d'
  on-tertiary-container: '#000607'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f8d8ff'
  primary-fixed-dim: '#ebb2ff'
  on-primary-fixed: '#320047'
  on-primary-fixed-variant: '#74009f'
  secondary-fixed: '#79ff5b'
  secondary-fixed-dim: '#2ae500'
  on-secondary-fixed: '#022100'
  on-secondary-fixed-variant: '#095300'
  tertiary-fixed: '#7df4ff'
  tertiary-fixed-dim: '#00dbe9'
  on-tertiary-fixed: '#002022'
  on-tertiary-fixed-variant: '#004f54'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 20px
  gutter: 16px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 40px
---

## Brand & Style

The design system targets the Indian college demographic with a "Gen-Z Professional" aesthetic. It balances the high-stakes reality of academic attendance with a playful, high-energy interface that feels more like a social or gaming app than a utility tool.

The style is a fusion of **Glassmorphism** and **Cyberpunk Minimalism**. It utilizes deep charcoal surfaces to allow neon functional accents to pop, creating a clear hierarchy of risk. The emotional response should be one of "controlled chaos"—acknowledging the drama of low attendance while providing the functional clarity needed to fix it. Visuals should feel immersive, using background blurs and subtle glows to create depth.

## Colors

The palette is built on a "Midnight" foundation (`#121212`) to ensure neon accents remain legible and vibrant.

- **Primary (Electric Purple):** Used for main interactions, branding elements, and active states.
- **Secondary (Cyber Lime):** Represents the "Chill" tier (85%+); the ultimate goal.
- **Tertiary (Neon Cyan):** Represents the "Safe" tier (80-85%).
- **Functional Accents:**
    - **Orange:** The "Risky" warning (75-80%).
    - **Neon Red:** The "Danger" zone (70-75%).
    - **Deep Crimson:** "HOD Territory" (<70%), used with high-contrast warning patterns (diagonal stripes) for maximum drama.

## Typography

The typography system uses a high-contrast pairing to distinguish between "data" and "instruction."

- **Headlines:** Space Grotesk provides a technical, geometric edge. Use `display-lg` for attendance percentages to make them feel impactful.
- **Body:** Inter ensures maximum readability for course names and schedules, maintaining a clean, professional look.
- **Labels:** JetBrains Mono is used for status tags, risk tiers, and secondary data points (e.g., "3 classes left to bunk"). The monospaced nature reinforces the "systematic" feel of the app.

## Layout & Spacing

This design system uses a **Fluid Grid** model with a heavy emphasis on vertical stacking. 

- **Mobile First:** A 4-column grid with 20px side margins. 
- **Desktop:** Scales to a 12-column grid, max-width 1200px, centered.
- **Rhythm:** An 8px base unit governs all spacing. Components should predominantly use `stack-md` (24px) for separation to allow the glassmorphism effects enough "breathing room" to be visible against the dark background.

## Elevation & Depth

Depth is achieved through **Glassmorphism** rather than traditional shadows.

1.  **Level 0 (Floor):** Pure `#121212` background.
2.  **Level 1 (Cards):** Surface color of white at 5-8% opacity with a `20px` backdrop blur. A `1px` solid border at 10% white opacity adds definition.
3.  **Level 2 (Active/Modals):** Surface color of white at 12% opacity with a `40px` backdrop blur.
4.  **Accent Glows:** Status-specific glows (e.g., a faint green outer glow for "Chill" status cards) are used to pull the user's eye toward critical information. Shadows are never black; they are low-opacity versions of the accent colors (Cyber Lime, Neon Red, etc.).

## Shapes

The design system uses **Rounded (0.5rem / 8px)** as the base radius for standard components like input fields and small cards. 

Large containers and main dashboard cards use `rounded-lg` (16px) or `rounded-xl` (24px) to create a friendly, modern "app-like" feel. Buttons should be highly rounded (`rounded-xl`) to contrast against the more structured grid-based cards.

## Components

- **Buttons:** Primary buttons use a solid Neon Purple gradient. Secondary buttons use the "Ghost" style—transparent with a 1px Cyber Lime or Cyan border.
- **Risk Cards:** These are the heart of the UI. They must feature a glass effect. When in "HOD Territory," the card background should include a subtle, animated diagonal stripe pattern in the border or a corner "Warning" ribbon.
- **Attendance Chips:** Small, monospaced labels using JetBrains Mono. The background color of the chip matches the Risk Tier color at 20% opacity with 100% opacity text.
- **Input Fields:** Darker than the background (`#000000` at 20% opacity) with a bottom-only border that glows Purple when focused.
- **Progress Bars:** Thick, 12px bars with rounded ends. The unfilled portion is dark grey; the filled portion is a neon gradient corresponding to the risk tier.
- **Humor Modals:** When a user drops a tier, use a high-blur overlay modal with dramatic, oversized Space Grotesk typography for the witty "warning" text.