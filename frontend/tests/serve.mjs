import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";

const result = await build({
  entryPoints: ["tests/preview.tsx"], bundle: true, write: false,
  jsx: "automatic", format: "esm", platform: "browser",
  define: { "process.env.NEXT_PUBLIC_API_URL": '"/test-api"' },
  plugins: [{ name: "test-adapters", setup(builder) {
    builder.onResolve({ filter: /^(@clerk\/nextjs(?:\/server)?|next\/navigation|next\/link)$/ },
      () => ({ path: resolve("tests/adapters.tsx") }));
  } }],
});
const css = await postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), {
  from: resolve("src/app/globals.css"),
});
createServer((req, res) => {
  if (req.url === "/preview.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end(result.outputFiles[0].text);
  } else if (req.url === "/preview.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css.css);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>');
  }
}).listen(4173, "127.0.0.1");
