const steps = [
  {
    number: "01",
  title: "Bring your documents",
  description:
    "Upload PDFs to Contextly. Your documents are processed, chunked for precise retrieval, and kept private to your workspace.",
  label: "UPLOAD",
  meta: "PDF support · Private workspace",
  },
  {
    number: "02",
    title: "Ask in plain language",
    description:
      'No query syntax. No keyword hunting. Ask the way you think — “What’s the refund policy?” or “Summarize the compliance requirements” — and Contextly finds the right passages.',
    label: "ASK",
    meta: "Multi-document queries · Conversational follow-ups",
  },
  {
    number: "03",
    title: "Trust your answer",
    description:
  "Every response includes citations with the document name, page number, and supporting excerpt so you can verify the answer against the source.",
    label: "VERIFY",
    meta: "Page-level citations · Source highlighting",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="px-6 py-28 md:py-36"
    >
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.28em] text-blue-400">
            How it works
          </p>

          <h2 className="mt-7 font-serif text-4xl font-normal leading-[1.18] tracking-tight text-zinc-100 md:text-5xl lg:text-[54px]">
            From document to
            <span className="mt-2 block">answer in three steps</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3">
          {steps.map((step, index) => (
            <article
              key={step.number}
              className={`relative flex min-h-[365px] flex-col py-10 md:px-10 ${
                index === 0
                  ? "md:pl-0"
                  : "md:border-l md:border-white/[0.08]"
              }`}
            >
              {/* Step number + label */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-400">
                  {step.number}
                </span>

                <span className="rounded border border-white/[0.07] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                  {step.label}
                </span>
              </div>

              {/* Main content */}
              <div className="mt-10">
                <h3 className="text-lg font-medium tracking-tight text-zinc-100">
                  {step.title}
                </h3>

                <p className="mt-5 max-w-[360px] text-sm leading-7 text-zinc-500">
                  {step.description}
                </p>
              </div>

              {/* Bottom meta */}
              <div className="mt-auto pt-12">
                <div className="border-t border-white/[0.06] pt-6">
                  <p className="font-mono text-[10px] leading-5 tracking-wide text-zinc-700">
                    {step.meta}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}