import { execFile } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { Marked } from 'marked';
import { chromium } from 'playwright-core';

/**
 * Builds the submission package: one PDF with every lifecycle document as a numbered
 * chapter, plus the deployment and source links file.
 *
 * The brief allows a single combined PDF provided each required section is clearly
 * identified, which is why the chapter titles below use the brief's own names rather than
 * the repository's file names.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(root, 'docs');
const config = JSON.parse(await readFile(join(root, 'submission.json'), 'utf8'));

/**
 * Credentials live in server/.env, never in submission.json, because that file is tracked.
 * A `${NAME}` in the config is resolved here so the password only ever reaches the
 * generated links file, which is gitignored.
 */
async function readEnvFile() {
  const contents = await readFile(join(root, 'server', '.env'), 'utf8').catch(() => '');
  const values = {};
  for (const line of contents.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

const secrets = await readEnvFile();
const unresolved = new Set();

function resolveSecrets(value) {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (token, name) => {
    if (!secrets[name]) {
      unresolved.add(name);
      return token;
    }
    return secrets[name];
  });
}

for (const [key, value] of Object.entries(config.credentials)) {
  if (typeof value === 'string') config.credentials[key] = resolveSecrets(value);
}

const CHAPTERS = [
  ['10-srs.md', 'Software Requirements Specification'],
  ['01-requirements.md', 'Requirements Register, Acceptance Criteria, and Traceability'],
  ['02-effort-estimation.md', 'Software Effort Estimation'],
  ['03-architecture.md', 'System Analysis and Design'],
  ['13-implementation.md', 'Implementation'],
  ['04-testing.md', 'Testing Report'],
  ['05-technical-debt-register.md', 'Technical Debt Identification and Management'],
  ['06-deployment.md', 'Deployment and Accessibility'],
  ['user-manual.md', 'User Manual'],
  ['07-maintenance-and-evolution.md', 'Maintenance, Future Evolution, and Limitations'],
  ['09-process-playbook.md', 'Engineering Process and Change Log'],
  ['11-conclusion.md', 'Conclusion'],
  ['12-references.md', 'References and Acknowledgements'],
];

const marked = new Marked({ gfm: true, breaks: false });

function escapeHtml(value) {
  return value.replace(
    /[&<>"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character],
  );
}

/** Drops a document's own H1 so the chapter heading is the single title for that section. */
function withoutLeadingTitle(markdown) {
  return markdown.replace(/^#\s+.*\r?\n/, '');
}

/** Shifts H1..H5 down one level so document headings sit under the chapter heading. */
function demoteHeadings(html) {
  return html.replace(/<(\/?)h([1-5])(\s|>)/g, (_, slash, level, tail) => {
    return `<${slash}h${Number(level) + 1}${tail}`;
  });
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const placeholders = [];
function checked(value, label) {
  if (typeof value === 'string' && value.includes('not yet')) placeholders.push(label);
  return value;
}

const chapters = [];
for (const [file, title] of CHAPTERS) {
  const markdown = await readFile(join(docsDir, file), 'utf8');
  const html = demoteHeadings(marked.parse(withoutLeadingTitle(markdown)));
  chapters.push({ title, html, source: `docs/${file}` });
}

const diagramDir = join(root, 'diagrams', 'exports');
const diagrams = (await readdir(diagramDir).catch(() => []))
  .filter((name) => name.endsWith('.png'))
  .sort();
if (diagrams.length === 0) {
  throw new Error('no exported diagrams — run `npm run docs:diagrams` first');
}

const evidenceDir = join(docsDir, 'uat-evidence');
const evidence = (await readdir(evidenceDir).catch(() => []))
  .filter((name) => name.endsWith('.png'))
  .sort();

function imageFigure(directory, file, caption) {
  const url = pathToFileURL(join(directory, file)).href;
  return `<figure><img src="${url}" alt="${escapeHtml(caption)}"><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
}

chapters.push({
  title: 'Appendix A — Diagrams',
  source: 'diagrams/',
  html: `<p>Rendered from the Mermaid sources in <code>diagrams/</code> by
    <code>npm run docs:diagrams</code>.</p>${diagrams
      .map((file) =>
        imageFigure(
          diagramDir,
          file,
          file
            .replace(/\.png$/, '')
            .replace(/^\d+-/, '')
            .replace(/-/g, ' '),
        ),
      )
      .join('')}`,
});

if (evidence.length > 0) {
  chapters.push({
    title: 'Appendix B — User acceptance testing evidence',
    source: 'docs/uat-evidence/',
    html: `<p>Screenshots captured during the UAT runs recorded in the testing report.</p>${evidence
      .map((file) => imageFigure(evidenceDir, file, file.replace(/\.png$/, '').replace(/-/g, ' ')))
      .join('')}`,
  });
}

const generated = new Date().toISOString().slice(0, 10);

const styles = `
  @page { size: A4; margin: 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.5 "Helvetica Neue", Arial, sans-serif; color: #16181d; margin: 0; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; color: #0b0c0f; page-break-after: avoid; }
  h1 { font-size: 20pt; margin: 0 0 4mm; }
  h2 { font-size: 15pt; margin: 8mm 0 3mm; border-bottom: 1px solid #d6d9e0; padding-bottom: 2mm; }
  h3 { font-size: 12.5pt; margin: 6mm 0 2mm; }
  h4 { font-size: 11pt; margin: 5mm 0 2mm; }
  p, ul, ol { margin: 0 0 3mm; }
  li { margin-bottom: 1mm; }
  code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 8.8pt; background: #f2f3f6; padding: 0.5mm 1mm; border-radius: 2px; }
  pre { background: #f7f8fa; border: 1px solid #e3e5ea; border-radius: 3px; padding: 3mm; overflow: hidden; page-break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 8.2pt; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 4mm; font-size: 8.6pt; page-break-inside: auto; }
  th, td { border: 1px solid #d6d9e0; padding: 1.6mm 2mm; text-align: left; vertical-align: top; word-break: break-word; }
  th { background: #eef0f4; font-weight: 600; }
  tr { page-break-inside: avoid; }
  blockquote { margin: 0 0 3mm; padding-left: 4mm; border-left: 3px solid #d6d9e0; color: #4a4f5a; }
  figure { margin: 0 0 6mm; page-break-inside: avoid; text-align: center; }
  figure img { max-width: 100%; max-height: 210mm; border: 1px solid #e3e5ea; border-radius: 3px; }
  figcaption { font-size: 9pt; color: #565c68; margin-top: 2mm; text-transform: capitalize; }
  a { color: #14449b; text-decoration: none; word-break: break-word; }
  hr { border: none; border-top: 1px solid #d6d9e0; margin: 6mm 0; }

  .cover { height: 257mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .cover .eyebrow { font-size: 11pt; letter-spacing: 0.14em; text-transform: uppercase; color: #565c68; margin-bottom: 6mm; }
  .cover h1 { font-size: 34pt; letter-spacing: -0.01em; margin-bottom: 3mm; }
  .cover .subtitle { font-size: 15pt; color: #363b45; margin-bottom: 14mm; }
  .cover dl { display: grid; grid-template-columns: 42mm 1fr; gap: 2.5mm 6mm; font-size: 10.5pt; margin: 0; }
  .cover dt { color: #565c68; }
  .cover dd { margin: 0; font-weight: 500; }
  .cover .footnote { margin-top: 16mm; font-size: 9.5pt; color: #565c68; }

  .toc { page-break-after: always; }
  .toc ol { list-style: none; counter-reset: chapter; padding: 0; }
  .toc li { counter-increment: chapter; padding: 2mm 0; border-bottom: 1px dotted #d6d9e0; font-size: 11pt; }
  .toc li::before { content: counter(chapter) ". "; color: #565c68; }
  .toc .source { float: right; font-size: 8.5pt; color: #808795; font-family: "SF Mono", Menlo, monospace; }

  .section-map { page-break-after: always; }

  .chapter { page-break-before: always; }
  .chapter > h1 { border-bottom: 2px solid #16181d; padding-bottom: 3mm; margin-bottom: 6mm; }
  .chapter > h1 .number { color: #808795; margin-right: 3mm; }
`;

const toc = chapters
  .map(
    (chapter) =>
      `<li><a href="#${slug(chapter.title)}">${escapeHtml(chapter.title)}</a><span class="source">${escapeHtml(chapter.source)}</span></li>`,
  )
  .join('');

/**
 * The brief names nineteen documentation topics and five separate PDFs, and allows one
 * combined PDF only if every required section is clearly identified. A marker should not
 * have to infer which chapter answers which requirement, so the mapping is stated. Chapter
 * numbers are resolved from the chapter list rather than written down, so they cannot drift.
 */
const REQUIRED_TOPICS = [
  ['Project Title', null, 'Cover page'],
  [
    'Problem Statement',
    'Requirements Register, Acceptance Criteria, and Traceability',
    'Problem statement',
  ],
  [
    'Aim and Objectives',
    'Requirements Register, Acceptance Criteria, and Traceability',
    'Aim; Objectives',
  ],
  [
    'Stakeholders',
    'Requirements Register, Acceptance Criteria, and Traceability',
    'Stakeholders; Actors and roles',
  ],
  [
    'Requirements Analysis',
    'Requirements Register, Acceptance Criteria, and Traceability',
    'Functional and non-functional requirements, MoSCoW priorities, acceptance criteria, traceability',
  ],
  [
    'Software Requirements Specification',
    'Software Requirements Specification',
    'Nine-section SRS',
  ],
  [
    'Software Effort Estimation',
    'Software Effort Estimation',
    'Technique, baseline, re-estimation, actuals, variance',
  ],
  ['System Analysis', 'System Analysis and Design', 'Analysis — core workflow'],
  [
    'System Design',
    'System Analysis and Design',
    'Architecture, data model, API surface, matching design, ADRs',
  ],
  [
    'Implementation',
    'Implementation',
    'Modules, workflows, algorithms, database, API, auth, validation, error handling, security, deviations',
  ],
  [
    'Testing',
    'Testing Report',
    'Strategy, environment, test types, cases, results, defects, corrective actions, retesting, limitations',
  ],
  ['Technical Debt', 'Technical Debt Identification and Management', 'Register and repayment plan'],
  [
    'Deployment',
    'Deployment and Accessibility',
    'Configuration, deployment steps, live verification',
  ],
  ['User Manual', 'User Manual', 'Roles, tasks, common errors, troubleshooting'],
  [
    'Maintenance Strategy',
    'Maintenance, Future Evolution, and Limitations',
    'Corrective, adaptive, perfective, preventive',
  ],
  ['Future Evolution', 'Maintenance, Future Evolution, and Limitations', 'Future evolution'],
  ['Limitations', 'Maintenance, Future Evolution, and Limitations', 'Limitations'],
  ['Conclusion', 'Conclusion', null],
  ['References', 'References and Acknowledgements', null],
];

/**
 * The four PDFs the brief names, each also emitted as its own file so the package matches the
 * structure literally rather than relying on the permission to combine.
 *
 * `SRS.pdf` carries the requirements register with it: section 33 expects acceptance criteria
 * and a traceability matrix inside the SRS, and they live in the register, so a standalone SRS
 * without it would be incomplete.
 */
const REQUIRED_DOCUMENTS = [
  ['SRS.pdf', 'Software Requirements Specification', 'Software Requirements Specification'],
  ['Testing_Report.pdf', 'Testing Report', 'Testing Report'],
  [
    'Technical_Debt_Plan.pdf',
    'Technical Debt Identification and Management',
    'Technical Debt Identification and Management',
  ],
  ['User_Manual.pdf', 'User Manual', 'User Manual'],
];

const STANDALONE_CHAPTERS = {
  'SRS.pdf': [
    'Software Requirements Specification',
    'Requirements Register, Acceptance Criteria, and Traceability',
  ],
  'Testing_Report.pdf': ['Testing Report'],
  'Technical_Debt_Plan.pdf': ['Technical Debt Identification and Management'],
  'User_Manual.pdf': ['User Manual'],
};

function chapterNumber(title) {
  const index = chapters.findIndex((chapter) => chapter.title === title);
  if (index === -1) throw new Error(`section map refers to a missing chapter: ${title}`);
  return index + 1;
}

function locate(title) {
  return title === null
    ? 'Cover'
    : `<a href="#${slug(title)}">Chapter ${chapterNumber(title)} — ${escapeHtml(title)}</a>`;
}

const sectionMap = `
  <h1>Required sections</h1>
  <p>Every documentation topic required by the examination brief, and where it is answered
    in this document.</p>
  <table>
    <thead><tr><th>Required topic</th><th>Location</th><th>Within that chapter</th></tr></thead>
    <tbody>${REQUIRED_TOPICS.map(
      ([topic, title, note]) =>
        `<tr><td>${escapeHtml(topic)}</td><td>${locate(title)}</td><td>${note ? escapeHtml(note) : '—'}</td></tr>`,
    ).join('')}</tbody>
  </table>
  <p>The brief also names separate PDFs. Each one is supplied as its own file in the package
    <em>and</em> appears here as a chapter, so either route reaches the same content.</p>
  <table>
    <thead><tr><th>Required document</th><th>Also in this document</th></tr></thead>
    <tbody>${REQUIRED_DOCUMENTS.map(
      ([name, title]) =>
        `<tr><td><code>${escapeHtml(name)}</code></td><td>${locate(title)}</td></tr>`,
    ).join('')}<tr><td><code>Deployment_and_Source_Links.txt</code></td><td>Supplied as a separate
      file in the submission package, alongside <code>Supporting_Files/</code></td></tr></tbody>
  </table>`;

/**
 * Renders one document. The combined PDF numbers its chapters and carries the contents and
 * section map; a standalone PDF is the same content under its own cover, so the two can never
 * drift apart — there is one source per section, formatted twice.
 */
function documentHtml({ title, subtitle, footnote, entries, numbered = false, front = '' }) {
  const body = entries
    .map(
      (chapter, index) =>
        `<section class="chapter" id="${slug(chapter.title)}">
        <h1>${numbered ? `<span class="number">${index + 1}</span>` : ''}${escapeHtml(chapter.title)}</h1>
        ${chapter.html}
      </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${styles}</style></head>
<body>
  <section class="cover">
    <div class="eyebrow">${escapeHtml(config.course)}</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="subtitle">${escapeHtml(subtitle)}</div>
    <dl>
      <dt>Student</dt><dd>${escapeHtml(checked(config.studentName, 'studentName'))}</dd>
      <dt>Student ID</dt><dd>${escapeHtml(checked(config.studentId, 'studentId'))}</dd>
      <dt>Assessment</dt><dd>${escapeHtml(config.assessment)}</dd>
      <dt>Live application</dt><dd><a href="${config.liveUrl}">${escapeHtml(config.liveUrl)}</a></dd>
      <dt>Source repository</dt><dd><a href="${config.repositoryUrl}">${escapeHtml(config.repositoryUrl)}</a></dd>
      <dt>Compiled</dt><dd>${generated}</dd>
    </dl>
    <p class="footnote">${footnote}</p>
  </section>
  ${front}
  ${body}
</body></html>`;
}

const combinedHtml = documentHtml({
  title: config.projectTitle,
  subtitle: config.projectSubtitle,
  footnote: `This document combines every required submission section. Chapter titles
      follow the examination brief; the source file for each is shown in the contents. The four
      separately named PDFs are also supplied as their own files in this package.`,
  entries: chapters,
  numbered: true,
  front: `<section class="toc"><h1>Contents</h1><ol>${toc}</ol></section>
  <section class="section-map">${sectionMap}</section>`,
});

const documents = [
  { file: 'Project_Documentation.pdf', html: combinedHtml, note: `${chapters.length} chapters` },
  ...REQUIRED_DOCUMENTS.map(([file, chapterTitle, documentTitle]) => {
    const titles = STANDALONE_CHAPTERS[file];
    const entries = titles.map((wanted) => {
      const chapter = chapters.find((candidate) => candidate.title === wanted);
      if (!chapter) throw new Error(`${file} refers to a missing chapter: ${wanted}`);
      return chapter;
    });
    return {
      file,
      note: entries.map((entry) => entry.source).join(', '),
      html: documentHtml({
        title: documentTitle,
        subtitle: `${config.projectTitle} — ${config.projectSubtitle}`,
        footnote: `Required by the examination brief as <code>${escapeHtml(file)}</code>. The same
            content is chapter ${chapterNumber(chapterTitle)} of
            <code>Project_Documentation.pdf</code> in this package${
              entries.length > 1
                ? `, together with chapter ${chapterNumber(titles[1])}, included here because the
                  acceptance criteria and traceability matrix belong with the specification`
                : ''
            }.`,
        entries,
      }),
    };
  }),
];

const submissionDir = join(root, 'submission');
const packageName = `${config.studentId}_LegalConnect_Ghana`.replace(/[<>\s]/g, '');
const outputDir = join(submissionDir, packageName);
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

// Set SUBMISSION_DEBUG_HTML to a path to keep the combined document's source HTML: the PDF's
// own text cannot be grepped, so this is how a layout or section-map change gets checked
// without opening a viewer.
if (process.env.SUBMISSION_DEBUG_HTML) {
  await writeFile(resolve(root, process.env.SUBMISSION_DEBUG_HTML), combinedHtml, 'utf8');
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.emulateMedia({ media: 'print' });

for (const document of documents) {
  await page.setContent(document.html, { waitUntil: 'load' });
  await page.pdf({
    path: join(outputDir, document.file),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-size:8pt;color:#808795;padding:0 16mm;display:flex;justify-content:space-between">
      <span>${escapeHtml(config.projectTitle)} — ${escapeHtml(config.course)}</span>
      <span class="pageNumber"></span>
    </div>`,
    margin: { top: '18mm', bottom: '16mm', left: '0', right: '0' },
  });
}

await browser.close();

const links = `${config.projectTitle} — ${config.projectSubtitle}
${config.course} — ${config.assessment}

Student Name:            ${config.studentName}
Student ID:              ${config.studentId}

Live Application:        ${config.liveUrl}
Admin URL:               ${config.adminUrl}
Source Code Repository:  ${config.repositoryUrl}

Test Credentials
----------------
${config.credentials.note}

Citizen Username:        ${config.credentials.citizenEmail}
Citizen Password:        ${config.credentials.citizenPassword}
Lawyer Username:         ${config.credentials.lawyerEmail}
Lawyer Password:         ${config.credentials.lawyerPassword}
Admin Username:          ${config.credentials.adminEmail}
Admin Password:          ${config.credentials.adminPassword}

Compiled ${generated}.
`;

await writeFile(join(outputDir, 'Deployment_and_Source_Links.txt'), links, 'utf8');

/**
 * The diagrams and the UAT screenshots are already appendices in the PDF. They are copied
 * out as files too so a marker can open an original at full resolution, and so the Mermaid
 * sources travel with the renders.
 */
const supportingDir = join(outputDir, 'Supporting_Files');
await cp(join(root, 'diagrams'), join(supportingDir, 'diagrams'), { recursive: true });
if (evidence.length > 0) {
  await cp(evidenceDir, join(supportingDir, 'uat-evidence'), { recursive: true });
}

const execFileAsync = promisify(execFile);
const archivePath = join(submissionDir, `${packageName}.zip`);
await rm(archivePath, { force: true });
await execFileAsync('zip', ['-qr', archivePath, packageName], { cwd: submissionDir });
const archiveMb = ((await stat(archivePath)).size / 1024 / 1024).toFixed(1);

console.log(`Submission package written to ${outputDir.replace(`${root}/`, '')}/`);
for (const document of documents) {
  console.log(`  ${document.file} — ${document.note}`);
}
console.log('  Deployment_and_Source_Links.txt');
console.log(
  `  Supporting_Files/ — diagrams (sources and renders)${evidence.length > 0 ? `, ${evidence.length} UAT screenshots` : ''}`,
);
console.log(`  ${archivePath.replace(`${root}/`, '')} — ${archiveMb} MB`);

if (placeholders.length > 0) {
  console.log(
    `\nStill placeholder in submission.json: ${placeholders.join(', ')}. The PDF was built, but do not submit it until these are real.`,
  );
}

if (unresolved.size > 0) {
  console.log(
    `\nNot found in server/.env, so the links file still shows the token: ${[...unresolved].join(', ')}.`,
  );
}
