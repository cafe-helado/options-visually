# Vendored code

`anthropic-sdk-1.6.0.mjs` is the official Anthropic TypeScript SDK
(`@anthropic-ai/sdk@1.6.0`, MIT, licence in `anthropic-sdk.LICENSE`) bundled
into one browser ES module so the tutor loads no third-party script at runtime.

Rebuild (in a scratch folder, not in this repo):

    npm install @anthropic-ai/sdk@1.6.0 esbuild@0.25.10
    echo 'export { default as Anthropic } from "@anthropic-ai/sdk";' > entry.mjs
    npx esbuild entry.mjs --bundle --format=esm --platform=browser --minify \
      --legal-comments=eof --outfile=anthropic-sdk-1.6.0.mjs

sha256 of the shipped file:
1f09f1bd4cee7b65632bd7c2382042343e1ec17ca17d28c60ff31f49dc4999e2

Upgrade by changing the version in the filename, the import in
`assets/tutor.js` and this note together, and bump `CACHE` in `sw.js`.
