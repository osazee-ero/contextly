import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="px-6 pb-28 md:pb-36">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-20 text-center md:px-12 md:py-28">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-600">
            Get started
          </p>

          <h2 className="mx-auto mt-7 max-w-3xl font-serif text-4xl font-normal leading-[1.08] tracking-tight text-zinc-100 md:text-5xl lg:text-[56px]">
            Your documents already have
            <span className="block">the answers.</span>

            <span className="mt-2 block italic text-zinc-500">
              Contextly helps you find them.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-zinc-600">
            Start with your own documents and get grounded answers backed by
            citations you can verify.
          </p>

          <div className="mt-9">
            <Link
              href="/sign-up"
              className="inline-flex items-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Start using Contextly →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}