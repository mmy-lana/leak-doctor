# @leak-doctor/toolbar

Shadow-DOM web component diagnostic HUD for [LeakDoctor](https://github.com/mmy-lana/leak-doctor) — live heap usage, active trackers, and detected-leak reports in a drop-in widget.

## Install

```bash
npm install -D @leak-doctor/toolbar
```

## Usage

```ts
import '@leak-doctor/toolbar';

if (process.env.NODE_ENV === 'development') {
  document.body.appendChild(document.createElement('leak-doctor-toolbar'));
}
```

`track`, `trackElement`, and `leakDoctor` are re-exported from `@leak-doctor/profiler` for convenience.

## License

[MIT](./LICENSE) © 2026 Muhammad Maulana Yusuf
