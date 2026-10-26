# @leak-doctor/shared

Zero-runtime-overhead shared TypeScript contracts, schemas, and formatters for [LeakDoctor](https://github.com/mmy-lana/leak-doctor).

## Install

```bash
npm install @leak-doctor/shared
```

## Contents

- Type contracts: `LeakReport`, `MemorySnapshot`, `DiagnosticMetrics`, `ProfilerConfig`, `LeakSeverity`, `LeakType`, and friends.
- Utilities: `formatBytes`, `formatDurationMs`, `computeSeverity`, `SharedLogger`.

```ts
import { formatBytes, computeSeverity } from '@leak-doctor/shared';

formatBytes(1536); // '1.5 KB'
computeSeverity(20000); // 'medium'
```

## License

[MIT](./LICENSE) © 2026 Muhammad Maulana Yusuf
