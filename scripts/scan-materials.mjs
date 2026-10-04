import { readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only inventory of the two user-selected folders. No media is copied.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.argv[2] || 'D:\\BaiduNetdiskDownload');
const files = [], skipped = [];
async function walk(directory, book) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    if (item.isSymbolicLink()) { skipped.push({ path: path.relative(sourceRoot, full), reason: 'symbolic link' }); continue; }
    if (item.isDirectory()) await walk(full, book);
    else if (item.isFile()) {
      const info = await stat(full);
      files.push({ book, relativePath: path.relative(sourceRoot, full), extension: path.extname(full).toLowerCase(), bytes: info.size });
    }
  }
}
await walk(path.join(sourceRoot, '新概念一'), 'book1');
await walk(path.join(sourceRoot, '新概念二'), 'book2');
files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN', { numeric: true }));
const folders = [];
for (const book of ['book1', 'book2']) {
  const groups = new Map();
  for (const file of files.filter(f => f.book === book)) {
    const folder = file.relativePath.split(path.sep).slice(0, 2).join(path.sep);
    const group = groups.get(folder) || { book, relativePath: folder, files: 0, bytes: 0, types: {} };
    group.files++; group.bytes += file.bytes;
    group.types[file.extension] = (group.types[file.extension] || 0) + 1;
    groups.set(folder, group);
  }
  folders.push(...groups.values());
}
const result = { version: 1, scannedAt: new Date().toISOString(), sourceRoot, totalFiles: files.length, totalBytes: files.reduce((sum, f) => sum + f.bytes, 0), folders, skipped, files };
await mkdir(path.join(project, 'planning'), { recursive: true });
await writeFile(path.join(project, 'planning', 'materials-inventory.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ totalFiles: result.totalFiles, GiB: +(result.totalBytes / 1024 ** 3).toFixed(2), books: ['book1', 'book2'].map(book => ({ book, files: files.filter(f => f.book === book).length })), zeroByteFiles: files.filter(f => !f.bytes).map(f => f.relativePath), unfinishedFiles: files.filter(f => /\.(baiduyun|downloading|part|tmp)$/i.test(f.relativePath)).map(f => f.relativePath), skipped }, null, 2));
