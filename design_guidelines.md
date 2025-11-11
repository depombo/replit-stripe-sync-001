# Color Palette Generator - Design Guidelines

## Design Approach

**Reference-Based Strategy**: Draw inspiration from modern creative tools like Coolors.co, Figma, and Adobe Color. The design should feel premium, inspire creativity, and make colors the hero of the experience.

**Core Principle**: Let generated colors shine through a clean, minimal interface with strategic use of subtle gradients and smooth animations that enhance rather than distract.

## Typography

**Font Stack**: 
- Primary: Inter (via Google Fonts CDN) for UI and body text
- Display: Space Grotesk for headings and pricing tiers

**Hierarchy**:
- Hero headline: 3xl/4xl, bold (700)
- Section headings: 2xl, semibold (600)
- Palette labels: base/lg, medium (500)
- Hex codes: mono (monospace), regular (400)
- Body text: base, regular (400)

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24 for consistent rhythm

**Container Strategy**:
- Max width: 7xl for hero and main sections
- Palette display area: 6xl centered
- Pricing cards: 5xl grid container
- Form elements: xl for optimal readability

**Grid Patterns**:
- Color swatches: 5-column grid on desktop, stack on mobile
- Pricing tiers: 3-column on desktop (Free/Pro/Unlimited), single column mobile
- Feature comparisons: 2-column split

## Component Library

### Navigation
- Sticky header with subtle backdrop blur when scrolled
- Logo left, navigation center (Home, Pricing, Gallery), user profile/login right
- Generation counter badge: "0/1 free generations" prominent in nav
- Mobile: Hamburger menu with slide-in drawer

### Hero Section
- Full-width gradient background (subtle, complementary colors)
- Large headline: "Create Beautiful Color Palettes in Seconds"
- Subheading explaining the freemium model
- Primary CTA: "Generate Free Palette" (large, prominent)
- Live mini-palette preview cycling through example schemes
- No hero image - let the color gradients create visual interest

### Palette Generator (Core Feature)
- Large color swatches in horizontal row (equal width columns)
- Each swatch displays:
  - Full-height color block (min 200px height)
  - Hex code overlay at bottom
  - Copy button (appears on hover with blur background)
  - Lock icon to freeze individual colors during regeneration
- "Generate New Palette" button centered below swatches
- Harmony selector dropdown: Complementary, Analogous, Triadic, Monochromatic
- Export options: Download PNG, Copy CSS, Copy as JSON

### Paywall Modal
- Appears after first free generation
- Semi-transparent dark overlay
- Centered card with gradient accent border
- Headline: "You've Used Your Free Generation"
- Pricing tiers in compact card grid
- "Continue Creating" CTA for each tier
- "View Full Pricing" link to pricing page

### Pricing Section
- Three pricing cards with distinct visual hierarchy
- Free tier: Subtle border, muted styling
- Pro tier: Elevated with shadow, accent border (recommended badge)
- Unlimited tier: Premium gradient border
- Each card includes:
  - Tier name and price
  - Generation limit clearly stated
  - Feature list with checkmarks
  - CTA button (style matches tier importance)
  - Small print about payment processing

### User Dashboard
- Welcome message with generation count
- Recent palettes grid (3-4 columns)
- Quick actions: Generate New, View Pricing, Manage Subscription
- Subscription status card (if paid user)

### Footer
- Multi-column layout: About, Features, Legal, Social
- Newsletter signup embedded
- Payment badge: "Secured by Stripe"
- Links to terms, privacy, refund policy

### Form Elements
- Stripe Elements for payment (pre-built, secure)
- Rounded corners (md radius)
- Generous padding (4-6 units)
- Focus states with ring accent
- Error messages in red with icon
- Success states in green

## Visual Treatment

### Palette Display Enhancements
- Smooth color transitions (300ms ease-in-out)
- Subtle scale transform on swatch hover (1.05)
- Copy confirmation: Toast notification with color preview
- Lock icon state changes: outline when unlocked, filled when locked

### Pricing Cards
- Card hover: Subtle lift (shadow-lg) and scale (1.02)
- Recommended badge: Absolute positioned, slight rotation (-2deg)
- Price emphasis: Large size, bold weight
- Feature list: Icon + text rows with subtle dividers

### Interactive States
- Buttons: Solid background with hover brightness increase
- Links: Underline on hover with smooth transition
- Disabled states: 50% opacity with not-allowed cursor
- Loading states: Shimmer effect on skeleton loaders

## Accessibility

- All color swatches include ARIA labels with hex values
- Keyboard navigation for palette generation and copying
- Focus indicators on all interactive elements
- Minimum contrast ratio 4.5:1 for text overlays on colors
- Screen reader announcements for generation count and copy actions

## Images

**No traditional imagery needed.** The app's visual interest comes from:
- Generated color palettes (the core product)
- Subtle gradient backgrounds
- Color-based visual elements

**Icon Usage**: Font Awesome (via CDN) for UI icons - copy, lock, check, export, user profile

## Page Structure

**Landing Page Flow**:
1. Hero with gradient + CTA
2. Live palette generator (accessible without login)
3. Feature showcase (3-column grid)
4. Pricing comparison
5. Social proof (testimonials in card carousel)
6. Final CTA section
7. Footer

**Post-Login Flow**:
1. Dashboard header with generation count
2. Full palette generator
3. Recent palettes gallery
4. Manage subscription card (if applicable)

## Critical UX Considerations

- Make the free generation count highly visible (nav badge)
- Clear distinction between free and paid features
- One-click palette copying to encourage sharing
- Immediate visual feedback on all actions
- Graceful paywall that doesn't feel pushy
- Export features available to all users (good will gesture)