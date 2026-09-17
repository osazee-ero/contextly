import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export default async function Navbar() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.05] bg-[#09090B]/90 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Link
            href="/"
            className="text-sm font-semibold text-white"
          >
            Contextly
          </Link>

          <div className="hidden items-center gap-7 text-sm text-zinc-500 md:flex">
            <Link
              href="/#product"
              className="transition hover:text-white"
            >
              Product
            </Link>

            <Link
              href="/#how-it-works"
              className="transition hover:text-white"
            >
              How it works
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-blue-600 px-3 py-2.5 text-xs sm:px-4 sm:text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm text-zinc-500 transition hover:text-white"
              >
                Sign in
              </Link>

              <Link
                href="/sign-up"
                className="rounded-md bg-blue-600 px-3 py-2.5 text-xs sm:px-4 sm:text-sm font-medium text-white transition hover:bg-blue-500"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}