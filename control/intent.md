# Intent

## Goal

Develop a high-performance, type-safe password entropy widget for the Mission Control Center using Next.js 16, focusing on real-time security telemetry and strict architectural compliance.

## Requirements

- Implement the PasswordStats interface in types/password.ts with exhaustive type safety (no 'any').
- Develop non-blocking asynchronous entropy calculation logic in lib/utils/entropy.ts utilizing Web Workers or optimized microtasks.
- Build the SecurityTelemetry.tsx component using Tailwind CSS with Atomic Blue accents and a dynamic tri-color progress bar.
- Ensure compatibility with Next.js 16 Server Components and the new Metadata API standards.
- Incorporate accessibility (ARIA) for the visual security feedback to ensure screen reader compatibility.
- Optimize for 'Cyber Lime' high-visibility states when entropy exceeds 128 bits.

