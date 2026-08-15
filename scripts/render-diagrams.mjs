import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

/**
 * Renders every diagrams/*.mmd to SVG and PNG. Mermaid needs a DOM, so it runs inside the
 * Chromium that Playwright already installed for the E2E suite rather than pulling a
 * second browser in for the sake of five diagrams.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'diagrams');
const outputDir = join(sourceDir, 'exports');

const mermaidScript = await readFile(
  join(root, 'node_modules/mermaid/dist/mermaid.min.js'),
  'utf8',
);

async function render(page, definition) {
  return page.evaluate(async (source) => {
    const { svg } = await window.mermaid.render(`d${Date.now()}`, source);
    return svg;
  }, definition);
}

const files = (await readdir(sourceDir)).filter((name) => name.endsWith('.mmd')).sort();
if (files.length === 0) throw new Error(`no .mmd files in ${sourceDir}`);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
await page.setContent('<!doctype html><html><body><div id="host"></div></body></html>');
await page.addScriptTag({ content: mermaidScript });
await page.evaluate(() => {
  window.mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
});

for (const file of files) {
  const name = file.replace(/\.mmd$/, '');
  const definition = await readFile(join(sourceDir, file), 'utf8');
  const svg = await render(page, definition);

  await writeFile(join(outputDir, `${name}.svg`), svg, 'utf8');

  // Screenshot the rendered SVG rather than converting the file, so the PNG matches what
  // Mermaid actually lays out including fonts.
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:#fff;display:inline-block">${svg}</body></html>`,
  );
  const element = await page.$('svg');
  if (!element) throw new Error(`${file} produced no SVG element`);
  await element.screenshot({ path: join(outputDir, `${name}.png`), scale: 'device' });

  console.log(`rendered ${name}`);
}

await browser.close();
console.log(`\n${files.length} diagrams written to diagrams/exports/`);
