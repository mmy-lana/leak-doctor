# Security Policy

## Reporting a Vulnerability

Please report security issues **privately** via [GitHub Security Advisories](https://github.com/mmy-lana/leak-doctor/security/advisories/new) for this repository (or email the maintainer through the profile linked in the README). Do not open public issues for exploitable vulnerabilities.

Include: affected component/package and version, reproduction steps, impact, and any suggested fix. You will receive an acknowledgement within 7 days and status updates until resolution.

## Scope Notes

- The hosted web auditor (`leak-doctor-web.vercel.app`) executes headless Chromium against user-supplied **public** URLs. Targets resolving to loopback, private, link-local, or cloud-metadata ranges are rejected, and browser sandbox/web-security flags are not disabled in production. Reports of bypasses (e.g. SSRF via DNS rebinding or redirect tricks) are in scope and appreciated.
- The npm packages run in consumer applications during development; reports of leaks, XSS, or supply-chain issues in the packages themselves are in scope.

## Supported Versions

Security fixes are applied to the latest published versions of `@leak-doctor/profiler`, `@leak-doctor/toolbar`, and `@leak-doctor/shared`, and to the deployed web apps. Older versions are not patched.

## Known Considerations

- The scan endpoint enforces per-IP rate limits and a global concurrency cap **per serverless instance**; deployments at scale should back these with a shared store.
- Scanned URLs are fetched server-side; treat scan results and server logs as potentially sensitive.
