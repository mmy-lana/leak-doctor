# LeakDoctor

> **Zero-dependency, SOLID-compliant Frontend Memory Leak Diagnostic Suite & Headless Web Auditor.**

[![npm version](https://img.shields.io/npm/v/@leak-doctor/profiler.svg?color=38bdf8)](https://www.npmjs.com/package/@leak-doctor/profiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-ef4444.svg)](https://turbo.build/repo)
[![pnpm](https://img.shields.io/badge/Package%20Manager-pnpm-f6921e.svg)](https://pnpm.io/)

---

## Live Demos & Links

* **Interactive Playground (React 19 + Vite):** [https://leak-doctor-playground.vercel.app](https://leak-doctor-playground.vercel.app)
* **Headless Web Scanner (Next.js + Puppeteer):** [https://leak-doctor-web.vercel.app](https://leak-doctor-web.vercel.app)
* **GitHub Repository:** [https://github.com/mmy-lana/leak-doctor](https://github.com/mmy-lana/leak-doctor)

### Official npm Packages
* **[`@leak-doctor/profiler`](https://www.npmjs.com/package/@leak-doctor/profiler)** — Core Memory Profiling Engine
* **[`@leak-doctor/toolbar`](https://www.npmjs.com/package/@leak-doctor/toolbar)** — Shadow DOM Web Component Dev Widget
* **[`@leak-doctor/shared`](https://www.npmjs.com/package/@leak-doctor/shared)** — Shared Diagnostic Schemas & Formatters
---

## What is LeakDoctor?

### In Plain English (For Non-IT Users)
Imagine your browser is like a desk. Every time you open a page or click a button, new papers (data, buttons, images) are placed on the desk. Normally, when you navigate away, a clean-up worker called **Garbage Collector (GC)** throws away old papers you no longer need.

However, sometimes a page "remembers" old papers and forgets to throw them away. Over time, your desk gets cluttered, making your browser **slow down, freeze, or crash**. This is called a **Memory Leak**.

**LeakDoctor** acts like a smart digital inspector. It monitors your website while you use it, detects forgotten items clogging up memory, and alerts you before your users experience lag or browser crashes.

---

### Technical Overview (For Engineers)
`LeakDoctor` is a modern JavaScript monorepo engine leveraging **ES2021 `WeakRef`** and **`FinalizationRegistry`** APIs to track object lifecycle dynamics in browser runtimes. 

It identifies:
1. **Detached DOM Nodes:** HTML elements removed from the document tree but still referenced in JavaScript state.
2. **Uncollected Objects & Closures:** Large arrays, buffers, or scope closures retained past their expected lifespan.
3. **Uncleared Event Listeners:** Unremoved event callbacks attached to global targets like `window` or `document`.

---

## Is LeakDoctor Lightweight?

**Yes, ultra-lightweight.**

| Metric | Measurement | Why It Matters |
| :--- | :--- | :--- |
| **Bundle Size** | **< 10 KB total (gzipped)** | Adds negligible load time to your development bundle. |
| **Dependencies** | **0 External Dependencies** | Zero risk of supply-chain vulnerabilities or dependency bloat. |
| **Runtime Overhead** | **Zero-Copy Weak References** | Uses native `WeakRef`, meaning the profiler **never** prevents Garbage Collection or causes memory leaks itself. |
| **Production Impact** | **Dev-Only Execution** | Designed to automatically disable or tree-shake out in production builds. |

---

## Monorepo Package Architecture

```
leak-doctor-monorepo/
├── packages/
│   ├── profiler (@leak-doctor/profiler) # WeakRef & FinalizationRegistry core engine
│   ├── toolbar (@leak-doctor/toolbar)   # Zero-dep Shadow DOM Web Component widget
│   └── shared (@leak-doctor/shared)     # Formatters, diagnostic schemas & TypeScript types
└── apps/
    ├── playground                       # Interactive React 19 leak simulation environment
    └── web                              # Next.js 15/16 + Puppeteer CDP automated web auditor
```

### Official Packages

* **[`@leak-doctor/profiler`](https://www.npmjs.com/package/@leak-doctor/profiler)**: Core JS engine for weak tracking, sample sweeps, and memory snapshotting.
* **[`@leak-doctor/toolbar`](https://www.npmjs.com/package/@leak-doctor/toolbar)**: Self-contained Shadow DOM Web Component (`<leak-doctor-toolbar>`) for live dev diagnostics.
* **[`@leak-doctor/shared`](https://www.npmjs.com/package/@leak-doctor/shared)**: Zero-dependency shared contracts, `formatBytes`, and severity logic.

---

## 📖 Step-by-Step Usage Guide

### Option A: For Web Developers (Adding to Your App)

#### 1. Install Packages
```bash
npm install @leak-doctor/profiler @leak-doctor/toolbar
# or
pnpm add @leak-doctor/profiler @leak-doctor/toolbar
```

#### 2. Import & Mount the Dev Toolbar
In your application entry point (`main.tsx`, `index.tsx`, or `App.tsx`):

```tsx
import { track, trackElement } from '@leak-doctor/profiler';
import '@leak-doctor/toolbar';

// Mount toolbar during local development
if (process.env.NODE_ENV === 'development') {
  const toolbar = document.createElement('leak-doctor-toolbar');
  document.body.appendChild(toolbar);
}
```

#### 3. Track Prone Components & Memory Targets
```tsx
import React, { useEffect, useRef } from 'react';
import { trackElement, track } from '@leak-doctor/profiler';

export function UserModal({ onClose }: { onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Register DOM element for detached leak tracking
    if (modalRef.current) {
      trackElement(modalRef.current, 'User Settings Modal');
    }

    // Register large buffer closure
    const dataBuffer = new Array(1000000).fill('Heavy Data');
    track(dataBuffer, 'Modal Data Buffer');

    return () => {
      // Clean up your references here
    };
  }, []);

  return <div ref={modalRef}>Modal Content</div>;
}
```

---

### Option B: For QA, Product Managers & Non-IT Users (No Coding Required)

1. Open the **Headless Web Scanner:** [https://leak-doctor-web.vercel.app](https://leak-doctor-web.vercel.app)
2. Enter any public website URL (e.g., `https://example.com`) and click **"Run Audit"**.
3. View the generated report:
   * **Health Score (0 - 100):** Overall memory hygiene rating.
   * **Retained Leak Size:** Amount of uncollected JavaScript memory leftover post-Garbage Collection.
   * **Diagnostic Recommendations:** Actionable tips to share with your development team.

---

## Interactive Playground & Testing Checklist

Test memory leak detection live without setting up a local project:

1. Open [https://leak-doctor-playground.vercel.app](https://leak-doctor-playground.vercel.app).
2. Click **"➕ Leak Detached DOM Node"** or **"⚡ Leak 10MB Object Buffer"**.
3. Watch the bottom-right floating **LeakDoctor** widget track active references.
4. Wait 8 seconds: the widget highlights flagged memory leaks with severity ratings (`MEDIUM`, `HIGH`, or `CRITICAL`).
5. Click **"Release References"** and press **"Sweep"** to verify manual garbage collection clearing.

---

## Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/mmy-lana/leak-doctor.git
cd leak-doctor

# 2. Install dependencies across workspace
pnpm install

# 3. Build shared packages
pnpm build

# 4. Start concurrent development servers
pnpm dev
```

* **Playground:** `http://localhost:5173`
* **Web Scanner:** `http://localhost:3000`

---

## Roadmap & Future Upgrades

- [ ] **Chrome DevTools Extension:** Native browser tab extension for deep heap snapshot tree diffing.
- [ ] **CI/CD GitHub Action:** Automated memory leak assertion on Pull Requests (fail build if post-GC heap growth exceeds threshold).
- [ ] **Heap Retainment Path Analyzer:** Graphical visualizer illustrating strong reference retainer chains.
- [ ] **Framework Adapters:** Dedicated React Hooks (`useLeakDoctor`), Vue directives (`v-track-leak`), and Angular decorators.

---

## License

Distributed under the [MIT License](LICENSE). Copyright © 2026 Muhammad Maulana Yusuf.
