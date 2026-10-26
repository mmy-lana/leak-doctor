# @leak-doctor/profiler

Core memory-profiling engine for [LeakDoctor](https://github.com/mmy-lana/leak-doctor): tracks suspect objects and DOM nodes with native `WeakRef`/`FinalizationRegistry` and reports detached-DOM leaks and asserted should-be-freed retention.

## Install

```bash
npm install @leak-doctor/profiler
```

## Usage

```ts
import { track, trackElement, leakDoctor } from '@leak-doctor/profiler';

// Detached DOM leak detection (reported when a removed node stays retained)
trackElement(document.getElementById('user-modal')!, 'User Modal');

// Retention watch (no report while alive) — assert should-be-freed objects explicitly
track(cachedBuffer, 'Cached Payload', { expectFreed: true });

leakDoctor.on('leak', (report) => console.warn('leak', report));
leakDoctor.start();
```

**Semantics:** non-DOM targets are retention-watched by default and never reported while alive; pass `meta: { expectFreed: true }` to assert the target should be garbage-collected once your code drops it. Detached DOM elements retained past `leakThresholdMs` are always reported.

Browser-only at runtime (guarded for SSR); `performance.memory` displays are Chromium-only.

## License

[MIT](./LICENSE) © 2026 Muhammad Maulana Yusuf
