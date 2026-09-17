export default function ProductPreview() {
  return (
    // <section id="product" className="border-b border-white/5 px-6 pb-24">
    <section id="product" className="px-6 pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0D0D10] shadow-2xl shadow-black/20">
          <div className="flex h-10 items-center border-b border-white/10 px-4">
            <span className="text-xs text-zinc-500">
              app.contextly.ai/workspace
            </span>
          </div>

          <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[260px_1fr_300px]">
            <aside className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Documents
              </p>

              <div className="mt-5 space-y-3">
                {[
                  ["Technical Manual v3.2", "142 pages"],
                  ["API Reference", "88 pages"],
                  ["Deployment Guide", "34 pages"],
                  ["Security Whitepaper", "56 pages"],
                ].map(([name, meta]) => (
                  <div
                    key={name}
                    className="rounded-md border border-white/5 bg-white/[0.02] p-3"
                  >
                    <p className="text-sm text-zinc-200">{name}</p>
                    <p className="mt-1 text-xs text-zinc-600">{meta}</p>
                  </div>
                ))}
              </div>
            </aside>

            <div className="flex flex-col p-6 md:p-8">
              <div className="ml-auto max-w-md rounded-lg bg-blue-600 px-4 py-3 text-sm text-white">
                What are the deployment requirements for a production cluster?
              </div>

              <div className="mt-8 max-w-2xl">
                <p className="text-sm font-medium text-white">Contextly</p>

                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  For a production cluster, the deployment requirements include:
                </p>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                  <li>
                    <span className="text-zinc-200">Compute:</span> Minimum 4 CPU
                    cores and 16 GB RAM per node
                    <span className="ml-1 text-blue-400">[1]</span>
                  </li>

                  <li>
                    <span className="text-zinc-200">Container runtime:</span>{" "}
                    Docker 24.x with host network mode enabled
                    <span className="ml-1 text-blue-400">[2]</span>
                  </li>

                  <li>
                    <span className="text-zinc-200">Storage:</span> 500 GB SSD
                    minimum per node
                    <span className="ml-1 text-blue-400">[2]</span>
                  </li>

                  <li>
                    <span className="text-zinc-200">Load balancing:</span>{" "}
                    Required across compute nodes for high availability
                    <span className="ml-1 text-blue-400">[1]</span>
                  </li>
                </ul>

                <p className="mt-6 text-xs text-zinc-600">
                  2 sources grounded in uploaded documents
                </p>
              </div>

              <div className="mt-auto pt-10">
                <div className="flex items-center rounded-lg border border-white/10 bg-black/20 px-4 py-3">
                  <span className="text-sm text-zinc-600">
                    Ask a question about your documents...
                  </span>

                  <button
                    type="button"
                    className="ml-auto rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>

            <aside className="border-t border-white/10 p-5 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Sources
                </p>

                <span className="text-xs text-zinc-600">2 passages</span>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                  <p className="text-sm text-zinc-200">Technical Manual.pdf</p>
                  <p className="mt-1 text-xs text-blue-400">Page 14</p>

                  <p className="mt-4 text-xs leading-6 text-zinc-400">
                    “Production deployment requires a minimum of 4 CPU cores and
                    16 GB RAM per compute node. Load balancing must be configured
                    across all nodes for high availability.”
                  </p>
                </div>

                <div className="rounded-lg border border-white/10 p-4">
                  <p className="text-sm text-zinc-200">Deployment Guide.pdf</p>
                  <p className="mt-1 text-xs text-zinc-500">Page 7</p>

                  <p className="mt-4 text-xs leading-6 text-zinc-500">
                    “Ensure Docker 24.x is installed and SSD storage of at least
                    500 GB per node is available.”
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}