This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## UI regression checks

Run `npm run lint` and `npm run build` for production checks.

The browser suite renders the actual page components, app layout, and landing
navigation with test-only Clerk/routing adapters and mocked API responses. It
checks 320, 390, 768, 1024, and 1440px layouts, long content, citation navigation,
mobile upload dialogs, partial upload retries, and chat error recovery. It does
not exercise live authentication, document ingestion, or answer generation.

```bash
npx playwright install chromium
npm run test:e2e
```

To use an installed Chrome browser in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm run test:e2e
```

Test adapters are bundled only by `tests/serve.mjs`; production routes retain
Clerk authentication. Screenshots and failure traces go to `test-results/`.
