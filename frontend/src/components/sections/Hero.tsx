import Link from "next/link";

export default function Hero() {
  return (
    // <section className="border-b border-white/5">
<section>
      <div className="mx-auto flex min-h-[600px] sm:min-h-[720px] max-w-7xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs text-blue-400">
          RAG-powered · Source-verified
        </div>

        <h1 className="mt-8 max-w-4xl text-5xl font-medium tracking-tight text-white sm:text-6xl md:text-7xl">
          Your knowledge,
          <span className="block italic text-zinc-300">grounded.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 md:text-lg">
          Upload your documents. Ask any question. Get precise answers backed by
          verifiable citations — pulled directly from your source material, not
          guessed.
        </p>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Link
            href="#product"
            className="rounded-md border border-white/10 px-5 py-2.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            See how it works
          </Link>

          <Link
            href="/sign-up"
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Get Started →
          </Link>
        </div>
      </div>
    </section>
  );
}