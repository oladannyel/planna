# Third-Party Notices

plAnna includes material adapted from the third-party projects below. Their
license terms are reproduced in full as required.

---

## TailAdmin — Free Next.js Admin Dashboard

- **Source:** https://github.com/TailAdmin/free-nextjs-admin-dashboard
- **Version referenced:** 2.5.0
- **License:** MIT

### What plAnna adapts

plAnna's design system is derived from TailAdmin's. No TailAdmin source file is
copied into this repository — the two projects target different major versions
of Next.js, React and Tailwind CSS, so the work was a re-implementation rather
than a copy. What was carried across:

| Adapted                                                                                          | Where it lives in plAnna           |
| ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Neutral gray ramp (Untitled UI values)                                                           | `tailwind.config.ts`               |
| Elevation scale (`shadow-theme-xs` … `shadow-theme-xl`, focus ring)                              | `tailwind.config.ts`               |
| Type scale (`text-title-*`, `text-heading-*`)                                                    | `tailwind.config.ts`               |
| Extra breakpoints (`2xsm`, `xsm`, `3xl`) and the z-index scale                                   | `tailwind.config.ts`               |
| Status ramps (success / warning / error)                                                         | `tailwind.config.ts`               |
| `menu-item*` composite classes, translated from Tailwind v4 `@utility` to v3 `@layer components` | `src/app/globals.css`              |
| Shell, card and board layout patterns                                                            | `src/components/`, `src/features/` |

plAnna's brand ramp is **not** TailAdmin's. It is built around plAnna's own
`#7C3AED`, not TailAdmin's `#465FFF`.

### License

```
MIT License

Copyright (c) 2023 TailAdmin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Fonts

- **Inter** — SIL Open Font License 1.1 — https://github.com/rsms/inter
- **Outfit** — SIL Open Font License 1.1 — https://github.com/Outfitio/Outfit-Fonts

Both are served through `next/font/google` and are not redistributed in this
repository.

---

Runtime dependencies are listed in `package.json`; their licenses ship inside
`node_modules` and are not reproduced here.
