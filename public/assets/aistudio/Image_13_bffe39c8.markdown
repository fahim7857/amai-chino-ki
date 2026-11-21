---
name: Pastel Play Quiz
colors:
  surface: '#fdf7ff'
  surface-dim: '#ded7e7'
  surface-bright: '#fdf7ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f1ff'
  surface-container: '#f2ebfb'
  surface-container-high: '#ece5f6'
  surface-container-highest: '#e6e0f0'
  on-surface: '#1d1a25'
  on-surface-variant: '#494552'
  inverse-surface: '#322f3b'
  inverse-on-surface: '#f5eefe'
  outline: '#7b7483'
  outline-variant: '#cbc3d4'
  surface-tint: '#6b4ab3'
  primary: '#6947b1'
  on-primary: '#ffffff'
  primary-container: '#8261cc'
  on-primary-container: '#fffbff'
  inverse-primary: '#d1bcff'
  secondary: '#98443e'
  on-secondary: '#ffffff'
  secondary-container: '#f99188'
  on-secondary-container: '#732824'
  tertiary: '#545e59'
  on-tertiary: '#ffffff'
  tertiary-container: '#6c7771'
  on-tertiary-container: '#f5fff8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d1bcff'
  on-primary-fixed: '#24005b'
  on-primary-fixed-variant: '#53309a'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb3ac'
  on-secondary-fixed: '#3f0204'
  on-secondary-fixed-variant: '#7a2e29'
  tertiary-fixed: '#dae5de'
  tertiary-fixed-dim: '#bec9c3'
  on-tertiary-fixed: '#141e1a'
  on-tertiary-fixed-variant: '#3f4944'
  background: '#fdf7ff'
  on-background: '#1d1a25'
  surface-variant: '#e6e0f0'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
This design system establishes a warm, delightful, and approachable social gaming aesthetic for lightweight personal trivia and interpersonal discovery quizzes. The core emotional goal is lighthearted connection: making players feel secure, celebrated, and curious through low-stakes competition.

The aesthetic fuses **Soft Modern Minimalism** with tactile, buoyant elements. High visual clarity prevents clutter, while oversized rounded geometries, gentle confectionary pastels, and expressive typography infuse personality. The interface prioritizes breathability, generous negative space, and inviting touch targets tailored for mobile interactions.

## Colors
The palette pairs an expressive pastel foundation with high-contrast interactive elements.

- **Primary Interactive (#9D7BE8 - Soft Lilac):** Main focal points, primary action triggers, progress indicators, and active selection fills. Provides sufficient contrast against pale backgrounds while maintaining a playful tone.
- **Secondary Accent (#F28B82 - Warm Peach):** Secondary calls to action, badges, streak indicators, and celebration accents.
- **Surface Pastels:**
  - Lavender (`#F1EAFC`): Default quiz shell surfaces, subtle highlights.
  - Baby Pink (`#FCEAF1`): Playful callouts, recipient indicator cards.
  - Cream (`#FFF7EB`): Base canvas tone to avoid sterile coldness.
  - Mint (`#EAF5EE`): Success states, correct answer selections, verification chips.
  - White (`#FFFFFF`): Elevated card tiles, input fields, interactive resting states.
- **Typography & Tonal Contrast:**
  - Main Text (`#34313D`): Deep charcoal-slate providing legible text across all light tints without stark pitch-black harshness.
  - Secondary Text (`#898593`): Muted slate for metadata, instructions, and inactive states.

## Typography
Plus Jakarta Sans serves as the single font family across all roles. Its geometric build, open counters, and humanist proportions reinforce warmth and readability across screen sizes.

Headlines employ tighter letter-spacing and higher weights (700-800) to keep game prompt questions punchy and prominent. Body and functional labels balance clarity and geometric rhythm, maintaining legibility even when rendered inside tinted pastel badges or active pills.

## Layout & Spacing
This design system uses a mobile-first, centered fluid grid designed around a max content container of 640px for single-task quiz flows, expanding to a 12-column container (max 1080px) for analytics and group leaderboards.

- **Mobile (< 640px):** Single-column stacked flows with `margin: 1rem` and `gutter: 1rem`. Focus stays centered on single interactive cards without edge bleed.
- **Tablet (640px - 1024px):** Single card layout centered within `margin-tablet: 2rem`, or dynamic 2-column answer matrices with `space-md` gaps.
- **Desktop (> 1024px):** Fixed-width centered application stage with `margin-desktop: 3rem` outer margins. Content avoids stretching, keeping focus tight and game-like.

## Elevation & Depth
Depth relies on soft atmospheric layers rather than sharp shadows.

- **Tonal Layering:** The primary canvas rests on Cream (`#FFF7EB`). Content cards float on Pure White (`#FFFFFF`) or pale pastel surfaces.
- **Diffused Ambient Shadows:**
  - Base floating card: `0px 10px 30px -4px rgba(157, 123, 232, 0.08)` (lilac-tinted shadow providing a floating cushion).
  - Active / Hover card: `0px 14px 36px -2px rgba(157, 123, 232, 0.14)`.
  - Floating pill CTA: `0px 8px 20px -2px rgba(157, 123, 232, 0.35)`.
- **Soft Border Definition:** Elements use subtle 1.5px borders tinted with their respective accent color at 20% opacity (e.g., `rgba(157, 123, 232, 0.2)` or `rgba(52, 49, 61, 0.08)`) to maintain silhouette clarity against pastel backdrops without harsh structural outlines.

## Shapes
Shapes lean heavily into hyper-rounded, organic curves that feel friendly and tactile.

- **Pill Geometry (Radius 9999px / Level 3):** Reserved for interactive drivers: primary buttons, filter tags, progress bar capsules, and score counters.
- **Container Geometry:**
  - Standard Cards: `1.25rem` (20px) to `1.5rem` (24px) border radius.
  - Inner Option Cards & Selectable Tiles: `1rem` (16px) border radius.
  - Floating Tooltips & Modals: `1.5rem` (24px) border radius.

## Components

### Buttons
- **Primary Action Button:** Full pill radius (`9999px`), background in Soft Lilac (`#9D7BE8`), text in Pure White (`#FFFFFF`). Padding: `0.875rem 2rem`. Diffused lilac drop shadow. Scale transformation (scale: 0.98) on press for physical feedback.
- **Secondary Action Button:** Full pill radius, background in Baby Pink (`#FCEAF1`) or Warm Peach (`#F28B82`), text matching contrast standards.
- **Ghost / Outlined Button:** Full pill radius, transparent background, 1.5px border in `#9D7BE8`, text in `#34313D`.

### Quiz Option Cards (Selectable)
- Minimum height of 64px for easy mobile tapping.
- Surface: `#FFFFFF` resting, with subtle border `1.5px solid rgba(52, 49, 61, 0.08)`.
- Corner radius: `1rem` (16px).
- Hover / Focus state: Border shifts to `#9D7BE8`, surface shifts to `#F1EAFC`.
- Selected state: Background `#9D7BE8`, text `#FFFFFF`, border-color `#9D7BE8`.
- Correct / Feedback state: Mint (`#EAF5EE`) background with `#34313D` text and green accent border.

### Chips & Badges
- Pill-shaped (`rounded-full`), padding `0.25rem 0.75rem`.
- Backgrounds leverage pastel variations: Mint for status, Pink for category flags, Cream for question counts.
- Text rendered in `label-sm` or `label-md` using `#34313D`.

### Input Fields
- Enclosed input boxes with `rounded-xl` (16px) or full pill radius.
- Background: Pure White (`#FFFFFF`).
- Border: `1.5px solid #F1EAFC`, transitioning to `1.5px solid #9D7BE8` on active focus.
- Placeholder text in Secondary Text (`#898593`).

### Checkboxes & Radio Indicators
- Radio elements for single-choice answers; fully circular with a 2-pixel gap and `#9D7BE8` interior dot.
- Checkboxes: `0.5rem` (8px) rounded edges, smooth spring animation on toggle.

### Progress Bars
- Track: 12px height, full pill radius, filled with `#F1EAFC`.
- Fill Indicator: Soft Lilac (`#9D7BE8`) with optional gradient into Warm Peach (`#F28B82`) for endgame streaks.

### Score Summary & Result Cards
- Generous container padding (`space-xl`), `1.5rem` (24px) border radius.
- White surface resting on Cream base canvas with ambient shadow.
- Avatar overlap clusters framed in crisp 3px white borders.