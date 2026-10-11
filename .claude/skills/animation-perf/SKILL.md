---
name: animation-perf
description: Use when adding or changing any animation, transition, scroll effect, parallax, reveal, pinned section, count-up, smooth scrolling, GSAP, ScrollTrigger or Lenis code in this Horizon theme, or when something animated looks janky, flashes, shifts layout or stays invisible.
---

# Animation performance

## Overview

Every animation ships only if it costs nothing at first paint, runs on the compositor, follows Horizon's real scroll container, and has been measured. **Violating the letter of these rules is violating the spirit.**

## The rules

| # | Rule | Means |
|---|---|---|
| 1 | **Never hide what's on screen at load.** | Only hide elements whose top is below `window.innerHeight` when the script runs. No CSS pre-hide (`opacity: 0` in a stylesheet, `html.js-pending` classes, "failsafe" keyframes). Above-the-fold content animates *from visible* or not at all. If it must start in another state (a count-up starting at 0), the server renders the final value and an inline script placed straight after the element swaps it before paint; nothing is hidden. |
| 2 | **Use Horizon's scroll container.** | At ≥990px Horizon scrolls `.page-wrapper`, not the window (`assets/scroll-container.js`). Use `getScrollContainer()` / `getScrollEventTarget()` in modules; in `assets/pb-motion.js` ScrollTrigger defaults and Lenis already follow it. Never `window.scrollY`, `window.addEventListener('scroll')`, or a ScrollTrigger without the right `scroller`. Use CSS `position: sticky` for pinning, not ScrollTrigger `pin`. |
| 3 | **Animate `transform` and `opacity` only.** | No `width`, `height`, `padding`, `margin`, `top/left`, `font-size`, `clip-path` on large areas, or `filter: blur` while scrolling. Shrinking header: `scale` the logo and `translate` the bar; reserve space so nothing below moves. Height reveals: animate a clip or `scaleY` on an inner wrapper. **Never transform an ancestor of a `position: fixed` element** (Horizon's `.menu-drawer`, dialogs): it becomes their containing block and breaks them; drop the transform while they're open. |
| 4 | **One loop.** | GSAP's ticker drives Lenis (`assets/pb-motion.js`). No extra `requestAnimationFrame` loops or scroll listeners where a ScrollTrigger or IntersectionObserver does the job. |
| 5 | **`will-change` only while moving.** | Set it at tween start, clear it `onComplete` (or use `clearProps`). Never in a stylesheet on many elements. |
| 6 | **Reduced motion = no motion.** | Check `prefers-reduced-motion` before hiding anything; content ends in its final state. Use `gsap.matchMedia()` for anything that must tear down mid-visit. |
| 7 | **Keyboard and no-JS safe.** | Hide with `opacity`, never `visibility`/`display`. Focusing hidden content reveals it. Without JS, everything is visible and final. |
| 8 | **Theme editor safe.** | Sections clean up in `disconnectedCallback` (custom element) or on `shopify:section:unload`; no global listeners left behind. |
| 9 | **Load only where used.** | `defer` or `type="module"`, vendored in `assets/`, loaded by `snippets/pb-head.liquid` behind a theme setting or by the section that needs it. Budget: GSAP+ScrollTrigger+Lenis ≈ 51 KB gzip already; any new plugin needs a stated size and reason. |
| 10 | **Prove it with numbers.** | See Verify. "Looks smooth" is not evidence. |

## Verify (required before calling it done)

Run `shopify theme dev`, Chrome, at **1280px and 390px**:

1. **Performance panel**, record a reload plus a scroll through the effect, 4× CPU throttle. Report: long tasks over 50 ms caused by your code (want 0), Layout Shift entries (want 0), and no purple Layout/Recalculate bars repeating every frame during the animation.
2. **Lighthouse** (mobile) on the page: LCP and CLS no worse than with the Motion settings off.
3. **Rendering → Emulate `prefers-reduced-motion: reduce`**: nothing moves, nothing hidden.
4. **Above the fold**: hard reload, no flash, no blank area.
5. **At 1280px** (`.page-wrapper` scroller): every revealed element reaches `opacity: 1` after scrolling past it.
6. Theme editor: add, edit and remove the section; no console errors.

Put the numbers in your report. If you can't run a browser, say the effect is **unverified** and list these checks for the user.

## Red flags: stop and fix

- "It's above the fold, but a 3 s failsafe covers it"
- "A tiny flash before the fade is fine for the demo"
- "Transitioning `height` / `padding` is only 0.25 s"
- `window.scrollY`, `scroll` listener on `window`, or ScrollTrigger `pin`
- `will-change` in a stylesheet
- `translate`/`scale` on `.header-section` or another ancestor of the menu drawer, with no "drawer open" exception
- "It looks smooth on my machine"
