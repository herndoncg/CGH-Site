// Runs right after the site is built (see "build" in package.json). It finishes the security header that
// tells browsers which scripts this site is allowed to run.
//
// Plain version: a web page can only hurt a visitor if someone manages to slip their own script into it.
// This writes a rule, sent with every page, that says "only run scripts that came from cghoperations.com
// itself". Anything else is refused by the browser, even if it somehow got onto the page.
//
// How: most of the site's scripts are files under /_astro/, which the rule allows by saying 'self'. A few
// tiny scripts are written straight into the pages (the menu button, the footer folds, the hero video).
// Those are allowed one by one, by fingerprint: this file reads every built page, fingerprints each of
// those small scripts, and adds the fingerprints to the Content-Security-Policy line in dist/_headers.
// A script whose fingerprint is not on the list does not run. Nothing here needs upkeep: add or change a
// script and the next build picks up its new fingerprint by itself.
//
// The build stops with a plain message if a page tries to load a script from another website, or uses an
// old-style onclick="..." attribute, because the rule would silently block both.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const dist = process.argv[2] || 'dist';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
const RUNS = /^(module|text\/javascript|application\/javascript)$/i; // a script with any other type is data, not code

export function scan(files) {
  const hashes = new Set(), problems = [];
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const attrs = m[1], body = m[2];
      const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1] || '';
      if (type && !RUNS.test(type)) continue;
      const src = (/\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1];
      if (src) { if (/^(https?:)?\/\//i.test(src)) problems.push(`${file}: loads a script from another website (${src})`); continue; }
      hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
    }
    const handler = /<[a-z][^>]*\son[a-z]+\s*=\s*["'][^>]*>/i.exec(html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, ''));
    if (handler) problems.push(`${file}: uses an on...="" attribute (${handler[0].slice(0, 80)})`);
  }
  return { hashes: [...hashes].sort(), problems };
}

export function finishHeaders(text, hashes) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => /^\s+Content-Security-Policy:/i.test(l));
  if (at < 0) throw new Error('public/_headers has no Content-Security-Policy line to finish.');
  if (/script-src/i.test(lines[at])) throw new Error('The Content-Security-Policy line already has script rules. Remove them from public/_headers; this script writes them.');
  lines[at] = `${lines[at].trimEnd().replace(/;$/, '')}; script-src 'self' ${hashes.join(' ')}; script-src-attr 'none'`.replace(/\s+;/g, ';');
  return lines.join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('csp.mjs')) {
  const headersFile = join(dist, '_headers');
  if (!existsSync(headersFile)) { console.error(`csp: ${headersFile} is missing. Was the site built?`); process.exit(1); }
  const files = walk(dist), { hashes, problems } = scan(files);
  if (problems.length) { console.error('csp: the script rule would block these. Bundle the script with the site instead (import it), then build again:\n  ' + problems.join('\n  ')); process.exit(1); }
  writeFileSync(headersFile, finishHeaders(readFileSync(headersFile, 'utf8'), hashes));
  console.log(`csp: ${files.length} pages checked, ${hashes.length} small in-page scripts allowed by fingerprint, everything else from this site only.`);
}
