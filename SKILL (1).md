---
name: liquid-glass
description: Teaches an AI agent how to design and build UI with Apple's "Liquid Glass" design language (iOS/iPadOS/macOS 26 era) — the core material properties, Apple's design principles with do/don't guidance, native SwiftUI/UIKit/AppKit APIs, web CSS/SVG recreations, and copy-paste recipes for glass panels, toolbars, tab bars, buttons, sheets, and sliders. Use it whenever a task asks for "Liquid Glass", "glass morphism done the Apple way", floating translucent controls, or glass effect layers.
---

# Liquid Glass UI Skill

Follow these instructions when designing or building any interface that uses Liquid Glass. All factual claims and API names below were verified against Apple's official documentation, WWDC25 session transcripts, and the Apple Newsroom announcement (see Sources). Anything that could not be verified is explicitly marked `UNVERIFIED` — treat those items as leads to check, not facts.

## 1. What Liquid Glass is

Liquid Glass is the dynamic material Apple introduced on June 9, 2025 at WWDC25. It is the first design language to extend across all platforms at once — iOS 26, iPadOS 26, macOS Tahoe 26, watchOS 26, and tvOS 26 — while keeping each platform's distinct qualities.

Understand and use these verified material properties when you design with it:

- **Translucency with refraction (lensing).** Liquid Glass is translucent, reflects and refracts its surroundings, and dynamically bends, shapes, and concentrates light in real time. Apple calls the light-bending behavior "lensing"; it is the primary way the material visually defines itself. Unlike earlier materials that scattered light, Liquid Glass concentrates it.
- **Specular highlights and reflection.** The material uses real-time rendering and reacts to movement with specular highlights. Light sources in the environment produce highlights that respond to geometry; lighting can respond to device motion so the material feels aware of its position in the real world.
- **Adaptive layers.** Liquid Glass is composed of multiple layers that continuously adapt to what is behind it: tint amount, shadow opacity, and dynamic range all shift to keep controls legible while letting content show through. Small elements (nav bars, tab bars) can flip between light and dark appearance based on the background.
- **Size changes thickness.** When glass flexes or morphs to larger sizes (for example, a menu presented from a toolbar button), it simulates a thicker material: deeper shadows, more pronounced lensing and refraction, softer light scattering.
- **Fluidity.** Motion was designed together with visuals. The material has a gel-like flexibility, responds to interaction by flexing and energizing with light, and moves in tandem with touch.
- **Materialization, not fading.** Glass objects materialize in and out by gradually modulating light bending and lensing instead of a plain opacity fade.
- **Morphing.** Controls morph between contexts, maintaining the concept of a single floating plane that controls live on. Menus pop open from the button bubble in place.
- **Interactivity.** Touching glass makes it illuminate from within; the glow spreads from under the fingertip across the element and onto nearby glass elements.
- **A distinct functional layer.** Liquid Glass forms a separate functional layer for controls and navigation (tab bars, sidebars, toolbars) that floats above the content layer, establishing hierarchy between functional elements and content.

## 2. Design principles

Apply every principle below. Each has a reason and a do/don't example.

### P1 — Glass belongs to the navigation/control layer, never the content layer

- **Principle:** Liquid Glass is reserved for the navigation layer that floats above app content: toolbars, tab bars, sidebars, menus, sheets, popovers, controls. Content — lists, tables, images, text bodies — stays in the content layer using regular materials or plain surfaces.
- **Why:** The material's entire value is creating a clear distinction between interactive elements and content. Making a table view Liquid Glass makes it compete with real controls and muddies the hierarchy (Apple's own example from the "Meet Liquid Glass" session).
- **Exception (verified):** Controls that live inside the content layer but are transient and interactive — sliders and toggles — may take on a Liquid Glass appearance to emphasize interactivity when a person activates them. HIG permits this narrow exception only for transient interactive elements.
- **Do:** Put your app's tab bar, toolbar, and floating action buttons in glass; keep the photo grid or document list behind them on ordinary surfaces.
- **Don't:** Wrap article text, collection views, cards of content, or whole screens in Liquid Glass "because it looks nice".

### P2 — Hierarchy and depth: content below, controls above

- **Principle:** Establish a clear visual hierarchy — content at the bottom, a single floating functional layer of glass above it. Keep content and glass separated; elements float above content and content peeks through beneath them.
- **Why:** Liquid Glass exists to bring focus to content. Depth and layer separation communicate what is interactive.
- **Do:** Let content scroll and peek through beneath glass bars; use scroll edge effects (see P10) to keep separation while scrolling.
- **Don't:** Let content intersect glass elements in steady states (for example, at app launch). Reposition or scale content to maintain separation. (Verified guidance from the Meet Liquid Glass session.)

### P3 — Concentricity and shape consistency

- **Principle:** The shape of the hardware informs the curvature of software. Controls, bars, sheets, and windows adopt rounder forms that nest concentrically into the rounded corners of windows and displays. Apple builds concentric layouts with three shape types (verified from the design-system session): **fixed** shapes (constant corner radius), **capsules** (radius = half the container height), and **concentric** shapes (radius = parent's radius minus the padding between them).
- **Why:** Aligning radii and margins around a shared center lets shapes nest comfortably within each other, creating a unified rhythm between hardware and software.
- **Do:** Choose corner radii so nested elements stay concentric (a control inside a bar inside a window all curve around the same center). Use capsules for small floating controls; use `glassEffect(in: .rect(cornerRadius:))` to match surrounding container radii.
- **Don't:** Mix arbitrary radii that don't nest, or put square glass controls inside rounded containers.

### P4 — Regular vs Clear variants — choose deliberately

- **Principle:** Liquid Glass has exactly two variants, Regular and Clear. Apple states they should never be mixed.
  - **Regular** is the most versatile: it blurs and adjusts the luminosity of background content to stay legible, adapts automatically, works at any size over any content, and can hold anything on top. Most system components use it.
  - **Clear** is permanently more translucent with no adaptive behaviors. It exists to prioritize visibility of underlying content and is ideal floating over media-rich backgrounds (photos, videos).
- **Why:** Legibility. Regular guarantees legibility in any context; Clear trades legibility for maximum content visibility and therefore demands a dimming layer.
- **Use Clear only when all three conditions hold (verified from Meet Liquid Glass):**
  1. The element floats over media-rich content;
  2. The content layer won't be negatively affected by adding a dimming layer;
  3. The content displayed on top of the glass is bold and bright.
- **Do (verified HIG + API doc):** When content beneath clear glass is bright, add a dark dimming layer — HIG cites about 35% opacity — beneath the glass. If underlying content is already dark, or the media controls provide their own dimming (e.g., AVKit), no dimming layer is needed. Apple's documented SwiftUI example: `glassEffect(.clear)` plus `.background(.black.opacity(0.3))`.
- **Do:** Use Regular whenever there is significant text on the glass (alerts, sidebars, popovers) or any chance of legibility problems.
- **Don't:** Use Clear over text-heavy or busy content without dimming; don't use Regular and Clear side by side in the same component cluster.

### P5 — Legibility and contrast over any background

- **Principle:** Liquid Glass adapts so controls stay legible over anything. Small elements flip between light and dark as the background changes; large elements (menus, sidebars) do not flip — they keep one appearance and adapt more subtly. Symbols and glyphs on top of Regular glass flip light-to-dark mirroring the glass to maximize contrast; this treatment is automatic.
- **Why:** The material must remain visually clear while deferring to content underneath.
- **Do:** Trust the system's automatic adaptation for standard components. Keep labels/symbols as system-provided vibrant content where possible.
- **Don't:** Force custom foreground colors that can't adapt, or hand-pick opacities per screen to "fix" contrast.

### P6 — Never stack glass on glass; keep glass sparse

- **Principle:** Avoid placing Liquid Glass elements on top of other Liquid Glass elements. Use Liquid Glass effects sparingly and only on the most important functional elements.
- **Why:** Stacked glass feels cluttered and confusing; overuse distracts from content and provides a subpar experience (verified in both the Meet Liquid Glass session and HIG).
- **Do:** When elements must sit on top of glass (for example, content inside a floating toolbar), use fills, transparency, and vibrancy so the top elements read as a thin overlay that is part of the material.
- **Don't:** Put a glass panel in a glass sidebar; tint or glass-ify every custom control you have.

### P7 — Tinting: only for emphasis, never decoration

- **Principle:** Use color/tint only on elements serving a distinct functional purpose — to bring attention to primary actions. Liquid Glass tinting maps the chosen color to a range of tones based on the brightness of the content underneath (like real colored glass), preserving legibility. Prefer the system tinting over solid opaque fills.
- **Why:** Solid opaque fills break the visual character of Liquid Glass. Tinting is natively compatible with all glass behaviors. When everything is tinted, nothing stands out.
- **Do:** Tint the single primary action in a toolbar (Apple's example: a red "View Bag" button as the primary action in a food delivery app). Imbue general color into the app through the content layer instead.
- **Don't:** Tint all controls; use a solid filled rectangle on top of glass for emphasis.

### P8 — Morphing, grouping, and containers

- **Principle:** Glass controls that belong together should morph fluidly between states and share a single visual plane. In SwiftUI, wrap multiple glass elements in a `GlassEffectContainer` so their shapes can blend as they near each other and morph into each other during transitions. Use `glassEffectID` for morphing pairs and `glassEffectUnion` to fuse several views into one capsule shape at rest.
- **Why:** Morphing maintains the concept of a singular floating plane; grouping also improves rendering performance (fewer render passes).
- **Do:** Group related toolbar actions with the platform grouping APIs so they share one background; animate controls in/out within a container so shapes morph.
- **Don't:** Scatter unrelated glass elements across the screen without containers; animate glass shapes appearing/disappearing without identities when you want them to morph.

### P9 — Interactive behavior

- **Principle:** Glass controls respond to touch and pointer in real time — they flex, energize with light, glow from the point of contact, and can lift up temporarily during interaction while resting quietly otherwise.
- **Why:** This response makes the interface feel alive and communicates interactivity without heavy chrome.
- **Do (SwiftUI):** Apply `.interactive()` on custom glass controls so they react like standard buttons. Keep the resting state visually quiet.
- **Don't:** Add custom press animations that fight the system behavior, or make permanently-lit "always active" glass decorations.

### P10 — Scroll edge effects and bar behavior

- **Principle:** Scroll edge effects work with Liquid Glass to maintain separation between UI and content layers as content scrolls beneath floating bars. The system provides an automatic style; the `soft` style gives a subtle blurred transition and the `hard` style gives a more opaque, clearly defined linear boundary (use hard when pinned content such as column headers sits under a bar). In iOS 26, tab bars shrink when the user scrolls and expand when they scroll back up (opt-in via API).
- **Why:** Legibility of floating controls without permanently hiding content.
- **Do:** Let system toolbars adopt the scroll edge effect by default; opt into tab bar minimization for feed-like content.
- **Don't:** Paint custom gradient scrims over scroll edges for standard bars — you'll fight the system effect.

### P11 — Accessibility is automatic — and you must still test

- **Principle:** Liquid Glass responds to system accessibility settings:
  - **Reduce Transparency** makes glass frostier and obscures more of the content behind it.
  - **Increase Contrast** makes elements predominantly black or white with a contrasting border.
  - **Reduce Motion** decreases the intensity of some effects and disables the material's elastic properties.
- **Why:** The magic of the material must not come at the cost of usability.
- **Do:** Test custom glass elements, colors, and animations with these settings enabled, plus light/dark appearance and preferred looks for Liquid Glass. Standard components adapt automatically; custom ones are your responsibility.
- **Don't:** Ship a custom glass control you have only ever seen in full-transparency light mode.

## 3. Building with SwiftUI (iOS 26 / iPadOS 26 / macOS 26 / tvOS 26 / watchOS 26)

### 3.1 Core API map (verified signatures)

| API | Purpose |
| --- | --- |
| `glassEffect(_ glass: Glass = .regular, in shape: some Shape = DefaultGlassEffectShape())` | Applies Liquid Glass to a view; default shape is a capsule |
| `Glass` (`struct`) | Material configuration; `.regular`, `.clear`, `.identity`; `.tint(_ color: Color?)`; `.interactive(_ isEnabled: Bool = true)` |
| `GlassEffectContainer(spacing:content:)` | Combines multiple glass shapes; enables blending and morphing; higher `spacing` → blending starts sooner |
| `glassEffectID(_ id: (some Hashable & Sendable)?, in namespace: Namespace.ID)` | Gives a glass effect an identity for morphing transitions; requires `@Namespace` and a container |
| `glassEffectUnion(id:namespace:)` | Fuses multiple views' glass into a single shape at rest |
| `glassEffectTransition(_ transition: GlassEffectTransition)` | Chooses transition behavior: `.matchedGeometry` (derive geometry from a nearby shape; adds scale/offset effects), `.materialize` (fade content, animate glass in/out, no geometry matching), `.identity` (no changes) |
| `DefaultGlassEffectShape` | The default capsule shape applied by glass effects (not used directly) |
| `.buttonStyle(.glass)` / `.buttonStyle(.glassProminent)` | `GlassButtonStyle` / `GlassProminentButtonStyle` for standard glass buttons |
| `tabBarMinimizeBehavior(_:)` | Tab bar minimization: `.automatic`, `.never`, `.onScrollDown`, `.onScrollUp` |
| `ToolbarSpacer(.fixed / .flexible, placement:)` | Standard fixed or flexible gaps that separate toolbar groups sharing a background |
| `scrollEdgeEffectStyle(_ style: ScrollEdgeEffectStyle?, for edges: Edge.Set)` | `.automatic`, `.soft`, `.hard`, or `nil` to remove; on scroll views |
| `backgroundExtensionEffect()` | Mirrors adjacent content under a sidebar/inspector with a blur for an edge-to-edge feel (modifier exists on `View`; exact parameter list UNVERIFIED — check Xcode) |

Usage rules (verified): apply `glassEffect` **after** other appearance-affecting modifiers; the material fills the view's frame including padding; pair `glassEffectID`/`glassEffectUnion` with a container; limit how many glass effects are on screen at once for performance.

### 3.2 Basic glass element

```swift
// Regular variant (default), capsule shape
Text("Hello, World!")
    .font(.title)
    .padding()
    .glassEffect()

// Custom rounded-rectangle shape
Text("Hello, World!")
    .font(.title)
    .padding()
    .glassEffect(in: .rect(cornerRadius: 16.0))

// Tinted + interactive custom control
Text("Hello, World!")
    .font(.title)
    .padding()
    .glassEffect(.regular.tint(.orange).interactive())
```

### 3.3 Clear variant with a dimming layer (Apple's documented pattern)

```swift
Label("Flag", systemImage: "flag.fill")
    .padding()
    .glassEffect(.clear)
    .background(.black.opacity(0.3))   // dimming layer beneath clear glass
```

Follow the HIG dimming guidance from P4: about 35% black dimming over bright content; none over already-dark content.

### 3.4 Blending shapes in a container

```swift
GlassEffectContainer(spacing: 40.0) {
    HStack(spacing: 40.0) {
        Image(systemName: "scribble.variable")
            .frame(width: 80.0, height: 80.0)
            .font(.system(size: 36))
            .glassEffect()

        Image(systemName: "eraser.fill")
            .frame(width: 80.0, height: 80.0)
            .font(.system(size: 36))
            .glassEffect()
            .offset(x: -40.0, y: 0.0)   // near shapes blend fluidly
    }
}
```

Tune `spacing`: the larger it is, the sooner shapes blend as they approach each other. If the container's spacing exceeds the interior layout spacing, effects blend at rest.

### 3.5 Morphing between glass shapes

```swift
@State private var isExpanded: Bool = false
@Namespace private var namespace

var body: some View {
    GlassEffectContainer(spacing: 40.0) {
        HStack(spacing: 40.0) {
            Image(systemName: "scribble.variable")
                .frame(width: 80.0, height: 80.0)
                .font(.system(size: 36))
                .glassEffect()
                .glassEffectID("pencil", in: namespace)

            if isExpanded {
                Image(systemName: "eraser.fill")
                    .frame(width: 80.0, height: 80.0)
                    .font(.system(size: 36))
                    .glassEffect()
                    .glassEffectID("eraser", in: namespace)
            }
        }
    }

    Button("Toggle") {
        withAnimation { isExpanded.toggle() }
    }
    .buttonStyle(.glass)
}
```

Optionally choose the transition explicitly:

```swift
Image(systemName: "note")
    .glassEffect()
    .glassEffectID("note", in: namespace)
    .glassEffectTransition(.matchedGeometry)   // or .materialize
```

### 3.6 Fusing shapes into one capsule (union)

```swift
let symbolSet = ["cloud.bolt.rain.fill", "sun.rain.fill", "moon.stars.fill", "moon.fill"]

GlassEffectContainer(spacing: 20.0) {
    HStack(spacing: 20.0) {
        ForEach(symbolSet.indices, id: \.self) { item in
            Image(systemName: symbolSet[item])
                .frame(width: 80.0, height: 80.0)
                .font(.system(size: 36))
                .glassEffect()
                .glassEffectUnion(id: item < 2 ? "1" : "2", namespace: namespace)
        }
    }
}
```

### 3.7 Glass buttons

```swift
Button("Add") { }
    .buttonStyle(.glass)              // standard glass button

Button("Continue") { }
    .buttonStyle(.glassProminent)     // prominent (tinted) glass button
```

Prefer these over building buttons from raw `glassEffect`. Tint via `.tint(...)` on the button to mark the primary action (P7).

### 3.8 Tab bars, toolbars, and scroll edges

```swift
TabView {
    Tab("Feed", systemImage: "list.bullet") { FeedView() }
    Tab("Profile", systemImage: "person") { ProfileView() }
}
.tabBarMinimizeBehavior(.onScrollDown)   // shrinks on scroll down, expands on scroll up
```

```swift
// Toolbar grouping with a standard spacer (customizable toolbars included)
.toolbar(id: "main-toolbar") {
    ToolbarItem(id: "tag")   { TagButton() }
    ToolbarItem(id: "share") { ShareButton() }
    ToolbarSpacer(.fixed)
    ToolbarItem(id: "more")  { MoreButton() }
}
```

```swift
// Hard scroll edge under pinned content; soft for a gentle blur
ScrollView {
    LazyVStack { ForEach(data) { RowView(item) } }
}
.scrollEdgeEffectStyle(.hard, for: .all)
```

### 3.9 Edge-to-edge content under bars (background extension)

Use the background extension effect so backgrounds appear to continue under a sidebar or inspector (the system mirrors adjacent content and blurs it). In SwiftUI use the `backgroundExtensionEffect` view modifier; in the Landmarks sample code Apple demonstrates this for hero images. (Exact modifier parameters UNVERIFIED — confirm in Xcode.)

### 3.10 When NOT to use glassEffect in SwiftUI

- Content-layer elements (P1) — use standard materials/backgrounds instead.
- Decorative labels, static text, images that never receive interaction.
- More than a handful of separate glass elements per screen — combine with `GlassEffectContainer` or restyle to fewer elements.

## 4. UIKit and AppKit equivalents

### 4.1 UIKit (iOS 26+)

- **`UIGlassEffect`** — a `UIVisualEffect` subclass that renders glass. Verified members: `init(style: UIGlassEffect.Style)`, `var isInteractive: Bool`, `var tintColor: UIColor?`, and a nested `Style` enumeration. Apply it through a standard `UIVisualEffectView`. (The exact `Style` case names are UNVERIFIED in this research — check the iOS 26 headers; expect variants matching Regular/Clear.)
- **`UIGlassContainerEffect`** — renders multiple glass elements as one combined effect; has a `spacing` property. Nest individual glass-configured views inside the visual effect view's `contentView` so the container renders them together (like SwiftUI's `GlassEffectContainer`).
- **`UIBackgroundExtensionView`** — extends content to fill its bounds (e.g., under a sidebar or inspector), with `contentView` and `automaticallyPlacesContentView`.
- **Button configurations** — `UIButton.Configuration` provides glass variants (verified names): `glass(_:)`, `clearGlass(_:)`, `prominentGlass(_:)`, `prominentClearGlass(_:)`. (Exact parameter lists UNVERIFIED — check headers; the zero-argument call compiles when parameters have defaults.)

```swift
// UIKit glass panel
let glass = UIGlassEffect()
glass.isInteractive = true          // touch response
glass.tintColor = .systemOrange     // tint for a primary control (P7)
let glassView = UIVisualEffectView(effect: glass)
glassView.frame = CGRect(x: 20, y: 100, width: 280, height: 56)
view.addSubview(glassView)
```

Note: there is no dedicated `UIGlassEffectView` class — use `UIVisualEffectView` with `UIGlassEffect`.

### 4.2 AppKit (macOS 26+)

- **`NSGlassEffectView`** — embeds its `contentView` in a dynamic glass effect. Verified properties: `contentView`, `cornerRadius`, `effectIsInteractive`, `style`, `tintColor`.
- **`NSGlassEffectContainerView`** — efficiently merges descendant glass effect views when they are within a specified proximity; improves rendering performance.
- **`NSBackgroundExtensionView`** — the macOS background extension equivalent.
- **Buttons** — `NSButton.BezelStyle.glass` gives buttons the glass bezel.

```swift
// AppKit glass panel
let glassView = NSGlassEffectView()
glassView.contentView = titleLabel          // any NSView
glassView.cornerRadius = 16
glassView.effectIsInteractive = true
glassView.tintColor = .controlAccentColor   // only for emphasis (P7)
containerView.addSubview(glassView)
```

### 4.3 Compatibility escape hatch

If you must ship against the new SDK while keeping the old look, add the `UIDesignRequiresCompatibility` key to the Info.plist (verified key name).

## 5. Web / CSS recreation

You cannot reproduce Apple's real-time refraction exactly in a browser. Aim for the same *feel*: blur, saturation lift, translucent background, edge highlight, adaptive light/dark, and — where supported — lensing via SVG displacement. Acknowledge in comments that this is an approximation.

### 5.1 Core recipe (works in all evergreen browsers)

```css
.glass {
  /* translucent base — the content's colors show through */
  background: rgba(255, 255, 255, 0.12);           /* light mode; see 5.2 for dark */

  /* blur + saturation = the "regular variant" look */
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  backdrop-filter: blur(20px) saturate(1.8);

  /* concentric, rounded shape (P3) */
  border-radius: 20px;

  /* 1px edge + specular top highlight + grounded shadow */
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),       /* top specular highlight */
    inset 0 -1px 0 rgba(255, 255, 255, 0.08),      /* bottom bounce light */
    0 8px 32px rgba(0, 0, 0, 0.25);                /* depth shadow */

  /* keep content legible (P5) */
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
```

Tuning guidance (community practice, consistent with the material's behavior):
- Larger elements need slightly stronger blur and lower background opacity (they read as "thicker" glass, P-properties above); small chips and buttons can take higher opacity.
- Add `saturate()` so colorful content behind bleeds into the glass like adaptive tinting.
- Keep the highlight on one side (top) — it sells the "lit from above" lensing.

### 5.2 Light/dark adaptive variants

```css
:root { color-scheme: light dark; }

@media (prefers-color-scheme: dark) {
  .glass {
    background: rgba(20, 20, 22, 0.38);
    border-color: rgba(255, 255, 255, 0.14);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      0 8px 32px rgba(0, 0, 0, 0.45);
  }
}
```

Also honor `prefers-reduced-transparency`, `prefers-reduced-motion`, and `prefers-contrast` — the web equivalents of the accessibility settings in P11:

```css
@media (prefers-reduced-transparency: reduce) {
  .glass { background: rgba(32, 32, 34, 0.94); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
@media (prefers-reduced-motion: reduce) {
  .glass { transition: none; }
  .glass:active { transform: none; }
}
```

### 5.3 Clear variant + dimming layer (CSS)

Mirror Apple's pattern from P4: highly translucent glass over media, with a dimming layer beneath when the media is bright:

```css
.glass-clear { background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(4px) saturate(1.4); }

/* dimming layer under the glass — HIG cites ~35% black over bright media */
.glass-clear::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: rgba(0, 0, 0, 0.35);
}
```

### 5.4 Refraction/lensing with SVG displacement (Chrome-only)

This technique (documented in the kube.io reference) approximates the lensing property. Verified mechanics:

- SVG `<feDisplacementMap>` consumes a displacement map image where each pixel's RGBA channels encode displacement per axis. Each channel is 8-bit, so displacement is limited to −128…+127 pixels; `128` is the neutral value.
- Compose maps and highlights with `<feImage>` + `<feBlend>` (refracted image underneath, highlight on top).
- Apply the filter via `backdrop-filter: url(#filterId)`.
- **This is Chromium-only today** — SVG filters as `backdrop-filter` are not interoperable; standardization of "backdrop displacement/refraction" is still an open issue (W3C svgwg #1142). Always ship 5.1 as the base and layer this on with `@supports` and UA checks.
- `backdrop-filter` region does not auto-size to the element — generate filter images at the element's size.

```html
<svg style="display:none" color-interpolation-filters="sRGB">
  <filter id="lg-displace">
    <feImage href="displacement-map.png" result="map" x="0" y="0" width="100%" height="100%" />
    <feDisplacementMap in="SourceGraphic" in2="map" scale="70"
                       xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>
```

```css
/* progressive enhancement only */
.glass-refract { backdrop-filter: url(#lg-displace); }
```

Generate displacement maps from the shape's normal/refraction math (see kube.io for the Snell's-law derivation) rather than hand-painting them.

### 5.5 Fallbacks and performance

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: rgba(28, 28, 30, 0.92); }  /* opaque fallback keeps contrast */
}
```

- Avoid many large blurred surfaces animating simultaneously; blur is expensive on low-end devices.
- Prefer `will-change: transform` sparingly; animate `transform`/`opacity` for press states, not `backdrop-filter` values.
- Verify `backdrop-filter` support at runtime with `@supports` or `CSS.supports()` before enabling glass-only styling.

## 6. Recipes

Each recipe = short intent + copy-paste code. Apply P1–P11 when adapting them.

### R1 — Glass slide/panel (floating side panel over media)

Use for a floating control panel or "slide" of controls above a photo/video background. Regular variant unless the background is rich media and content on top is bold (then Clear + dimming, P4).

```css
.slide-panel {
  position: absolute;
  inset-inline: 16px;
  bottom: 16px;
  padding: 16px 20px;
  border-radius: 28px;                     /* capsule-like; concentric with content margins */
  background: rgba(255, 255, 255, 0.14);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0 12px 40px rgba(0, 0, 0, 0.30);
  color: #fff;
}
```

```swift
// SwiftUI equivalent
Text("Now Playing")
    .padding(20)
    .glassEffect(in: .rect(cornerRadius: 28.0))
```

### R2 — Glass card (one-off floating information card)

Glass is normally NOT for content cards (P1). Reserve this for a genuinely interactive floating card — e.g., a mini-player or live-activity-like widget that hosts controls.

```swift
HStack(spacing: 12) {
    Image(systemName: "play.circle.fill").font(.largeTitle)
    VStack(alignment: .leading) {
        Text("Track Title").font(.headline)
        Text("Artist").font(.subheadline)
    }
    Spacer()
    Image(systemName: "forward.fill")
}
.padding(16)
.glassEffect(in: .rect(cornerRadius: 22.0))
```

```css
.mini-player {
  display: flex; gap: 12px; align-items: center; padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.14);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  backdrop-filter: blur(20px) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 8px 32px rgba(0,0,0,.25);
}
```

### R3 — Glass toolbar (bottom or top toolbar of grouped actions)

On Apple platforms, system toolbars already adopt Liquid Glass — use the standard toolbar API rather than custom glass. Use `ToolbarSpacer` to separate groups that share a background.

```swift
.toolbar {
    ToolbarItemGroup {
        Button { } label: { Image(systemName: "square.and.arrow.up") }   // accessibility label in real code!
        Button { } label: { Image(systemName: "heart") }
    }
    ToolbarSpacer(.fixed)
    ToolbarItemGroup {
        Button { } label: { Image(systemName: "trash") }
    }
}
```

```css
/* Web equivalent: floating bottom toolbar of grouped actions */
.toolbar-glass {
  position: fixed;
  left: 50%; transform: translateX(-50%);
  bottom: 16px;
  display: flex; gap: 4px; padding: 8px;
  border-radius: 9999px;                       /* capsule */
  background: rgba(255, 255, 255, 0.12);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 10px 36px rgba(0,0,0,.28);
}
.toolbar-glass .divider { width: 1px; margin: 4px 6px; background: rgba(255,255,255,.25); }
```

### R4 — Glass tab bar (that minimizes on scroll)

```swift
TabView {
    Tab("Home", systemImage: "house") { HomeView() }
    Tab("Search", systemImage: "magnifyingglass") { SearchView() }
    Tab("Profile", systemImage: "person") { ProfileView() }
}
.tabBarMinimizeBehavior(.onScrollDown)   // verified values: .automatic / .never / .onScrollDown / .onScrollUp
```

Do not rebuild the tab bar from raw `glassEffect` unless you have a custom reason; standard tab bars already pick up the material, the scroll edge effect, and minimization for free.

### R5 — Glass button (standard and prominent)

```swift
Button("Share") { }
    .buttonStyle(.glass)                      // secondary action

Button("Buy Now") { }
    .buttonStyle(.glassProminent)             // primary action
    .tint(.orange)                            // tint only the primary action (P7)
```

```css
.glass-btn {
  padding: 10px 20px;
  border-radius: 9999px;                      /* capsule */
  background: rgba(255, 255, 255, 0.14);
  -webkit-backdrop-filter: blur(12px) saturate(1.6);
  backdrop-filter: blur(12px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 4px 16px rgba(0,0,0,.22);
  color: #fff; font-weight: 600;
  transition: transform 0.15s ease;
}
.glass-btn:active { transform: scale(0.96); }  /* touch response (P9) */
.glass-btn--prominent { background: rgba(255, 149, 0, 0.55); } /* tint = emphasis only */
```

### R6 — Glass sheet / popover

Use the system sheet/popover — they adopt Liquid Glass automatically (rounder corners; iOS 26 half-sheets are inset from the display edge and become more opaque when expanded to full height; popovers originate from their source control).

```swift
struct ContentView: View {
    @State private var showSheet = false

    var body: some View {
        Button("Options") { showSheet = true }
            .popover(isPresented: $showSheet) {
                OptionsPanel()               // rendered with glass by the system
                    .presentationDetents([.medium])
            }
    }
}
```

```css
/* Web equivalent: glass popover anchored to the triggering control */
.popover-glass {
  position: absolute; top: calc(100% + 8px); left: 0;
  min-width: 240px; padding: 8px;
  border-radius: 20px;
  background: rgba(28, 28, 30, 0.45);
  -webkit-backdrop-filter: blur(28px) saturate(1.8);
  backdrop-filter: blur(28px) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 16px 48px rgba(0,0,0,.4);
}
```

### R7 — Glass slider (content-layer transient control)

Sliders/toggles in the content layer may take on Liquid Glass when activated (verified HIG exception, P1). Keep the resting state quiet; let the knob/lens come alive on interaction.

```swift
// Host the slider in a small glass capsule so its interactivity reads clearly
Slider(value: $volume)
    .padding(.horizontal, 14)
    .padding(.vertical, 10)
    .glassEffect(.regular.interactive(), in: .capsule)
```

```css
.slider-glass {
  appearance: none;
  height: 36px; padding: 0 14px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.14);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.3);
}
.slider-glass::-webkit-slider-thumb {
  appearance: none;
  width: 26px; height: 26px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0,0,0,.35);
}
```

## 7. Common mistakes checklist

Run through every item before delivering any glass UI:

- [ ] **Glass in the content layer.** Lists, tables, article bodies, static cards, or whole screens wrapped in glass. Fix: move glass to navigation/controls only (P1).
- [ ] **Glass on glass.** A glass control placed on a glass bar or panel. Fix: use fills, transparency, and vibrancy for upper elements (P6).
- [ ] **Glass everywhere.** Tinted or glass-ified every custom control. Fix: restrict to the most important functional elements (P6); tint only primary actions (P7).
- [ ] **Mixing Regular and Clear.** Variants combined in one component cluster. Fix: pick one; never mix (P4).
- [ ] **Clear glass over bright media with no dimming.** Fix: add ~35% black dimming beneath, or switch to Regular (P4).
- [ ] **Clear used over text-heavy or busy content.** Fix: use Regular (P4).
- [ ] **Broken concentricity.** Corner radii that don't nest with their containers or hardware corners. Fix: use fixed/capsule/concentric radius math (P3).
- [ ] **Solid opaque fill for emphasis.** Opaque colored blocks on glass. Fix: use the system tinting (`.tint`, `tintColor`) so glass stays glass (P7).
- [ ] **Custom scrim under standard bars.** Hand-painted gradients fighting the scroll edge effect. Fix: let the system apply it; use `scrollEdgeEffectStyle` if you must adjust (P10).
- [ ] **Intersections at rest.** Content colliding with floating glass in steady states. Fix: reposition or scale content (P2).
- [ ] **Too many glass elements.** Numerous ungrouped `glassEffect` views. Fix: group in a container, or reduce the count (P8/performance).
- [ ] **No accessibility testing.** Never checked Reduce Transparency / Increase Contrast / Reduce Motion / dark mode / preferred Liquid Glass look. Fix: test all of them (P11).
- [ ] **Missing labels on icon-only controls.** Icon buttons in glass bars without accessibility labels. Fix: always add them.
- [ ] **Web: glass without fallback.** `backdrop-filter` assumed universally available. Fix: `@supports` fallback with an opaque surface (5.5).
- [ ] **Web: SVG displacement enabled everywhere.** Chrome-only feature shipped to all browsers. Fix: progressive enhancement only (5.4).

## 8. Quality checklist (run before delivery)

Confirm each statement about the final UI; fix anything false:

- [ ] Every glass element sits in the navigation/control layer or is a transient interactive control (slider/toggle) — never pure content.
- [ ] Content is visible and legible beneath and around glass; nothing important is obscured at rest.
- [ ] All glass shapes are concentric with their containers; radii follow fixed/capsule/concentric logic.
- [ ] Exactly one variant (Regular or Clear) is used per component cluster; Clear is only over media-rich content with bold, bright content on top and a dimming layer when the media is bright.
- [ ] Tint appears only on primary actions; color generally lives in the content layer.
- [ ] No glass stacks on glass; related glass elements are grouped in one container and morph rather than float separately.
- [ ] Interactive glass responds to touch/pointer (`.interactive()` / `isInteractive` / `effectIsInteractive` set, or `:active` state on web).
- [ ] Scroll edge behavior is system-managed (`scrollEdgeEffectStyle` adjusted only when needed); tab bar minimization is opt-in and appropriate for the content.
- [ ] Interface was checked with Reduce Transparency, Increase Contrast, Reduce Motion, light and dark mode, and the available Liquid Glass preferred looks.
- [ ] All icon-only glass controls have accessibility labels.
- [ ] Performance: number of simultaneous glass effects is small; grouped where possible; no long jank-inducing blur animations on web.
- [ ] On web: `@supports` fallback verified; SVG refraction is an opt-in enhancement only.
- [ ] Every Apple API name used matches the verified list in Section 3/4 (or was re-verified in the latest Xcode SDK); anything uncertain is flagged, not invented.

## 9. Sources

Official Apple sources (documentation, sessions, and announcement verified during research):

1. Apple Developer — *Adopting Liquid Glass*: https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
2. Apple Developer — *Liquid Glass* (technology overview): https://developer.apple.com/documentation/technologyoverviews/liquid-glass
3. Apple Developer — *Applying Liquid Glass to custom views* (SwiftUI article with code): https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views
4. Apple Human Interface Guidelines — *Materials* (Liquid Glass section, variants, dimming guidance): https://developer.apple.com/design/human-interface-guidelines/materials
5. Apple Developer — `glassEffect(_:in:)`: https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)
6. Apple Developer — `Glass`: https://developer.apple.com/documentation/swiftui/glass (see also `Glass/clear`, `Glass/regular`, `Glass/tint(_:)`, `Glass/interactive(_:)`)
7. Apple Developer — `GlassEffectContainer`: https://developer.apple.com/documentation/swiftui/glasseffectcontainer
8. Apple Developer — `glassEffectID(_:in:)`: https://developer.apple.com/documentation/swiftui/view/glasseffectid(_:in:)
9. Apple Developer — `glassEffectUnion(id:namespace:)`: https://developer.apple.com/documentation/swiftui/view/glasseffectunion(id:namespace:)
10. Apple Developer — `glassEffectTransition(_:)` and `GlassEffectTransition`: https://developer.apple.com/documentation/swiftui/view/glasseffecttransition(_:)
11. Apple Developer — `GlassButtonStyle` / `GlassProminentButtonStyle`: https://developer.apple.com/documentation/swiftui/glassbuttonstyle , https://developer.apple.com/documentation/swiftui/glassprominentbuttonstyle
12. Apple Developer — `tabBarMinimizeBehavior(_:)` / `TabBarMinimizeBehavior`: https://developer.apple.com/documentation/swiftui/view/tabbarminimizebehavior(_:)
13. Apple Developer — `scrollEdgeEffectStyle(_:for:)` / `ScrollEdgeEffectStyle`: https://developer.apple.com/documentation/swiftui/view/scrolledgeeffectstyle(_:for:)
14. Apple Developer — `ToolbarSpacer`: https://developer.apple.com/documentation/swiftui/toolbarspacer
15. Apple Developer — `UIGlassEffect`: https://developer.apple.com/documentation/uikit/uiglasseffect ; `UIGlassContainerEffect`: https://developer.apple.com/documentation/uikit/uiglasscontainereffect ; `UIBackgroundExtensionView`: https://developer.apple.com/documentation/uikit/uibackgroundextensionview
16. Apple Developer — `NSGlassEffectView`: https://developer.apple.com/documentation/appkit/nsglasseffectview ; `NSGlassEffectContainerView`: https://developer.apple.com/documentation/appkit/nsglasseffectcontainerview
17. Apple Newsroom — *Apple introduces a delightful and elegant new software design* (June 9, 2025): https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
18. WWDC25 session 219 — *Meet Liquid Glass*: https://developer.apple.com/videos/play/wwdc2025/219/
19. WWDC25 session 356 — *Get to know the new design system*: https://developer.apple.com/videos/play/wwdc2025/356/
20. WWDC25 session 323 — *Build a SwiftUI app with the new design*: https://developer.apple.com/videos/play/wwdc2025/323/
21. WWDC25 session 284 — *Build a UIKit app with the new design*: https://developer.apple.com/videos/play/wwdc2025/284/
22. WWDC25 session 310 — *Build an AppKit app with the new design*: https://developer.apple.com/videos/play/wwdc2025/310/
23. Apple sample code — *Landmarks: Building an app with Liquid Glass*: https://developer.apple.com/documentation/swiftui/landmarks-building-an-app-with-liquid-glass

Reputable secondary sources:

24. Kube — *Liquid Glass in the Browser: Refraction with CSS and SVG* (SVG displacement-map mechanics, `feImage`/`feDisplacementMap`, Chromium-only caveat): https://kube.io/blog/liquid-glass-css-svg/
25. W3C SVG Working Group issue #1142 — *Filter Effects: define interoperable backdrop displacement/refraction for "liquid glass" UI* (confirms non-interoperability of SVG-filter backdrop displacement): https://github.com/w3c/svgwg/issues/1142
26. MDN — `backdrop-filter`: https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter

Verification notes:

- All SwiftUI/UIKit/AppKit API names, signatures, and platform availability (26-era releases) were checked against Apple's documentation data in this research; code snippets in Sections 3 and 6 (SwiftUI) are adapted from Apple's own documented examples.
- Items marked UNVERIFIED (UIKit `UIGlassEffect.Style` case names, exact parameter lists for `UIButton.Configuration` glass variants and the SwiftUI `backgroundExtensionEffect` modifier) were not confirmable from public documentation at research time. Verify in Xcode before relying on their exact forms.
- Version-specific browser support figures for `backdrop-filter` were intentionally omitted; use `@supports` detection instead of hard-coded version checks.
