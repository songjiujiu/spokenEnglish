import { readdir, stat, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only inventory of the three user-selected folders. No media is copied.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.argv[2] || 'D:\\BaiduNetdiskDownload');
const selectedBooks = process.argv[3] ? [process.argv[3]] : ['book1','book2','book3'];
const bookFolders = {book1:'新概念一',book2:'新概念二',book3:'新概念三'};
if (selectedBooks.some(book=>!bookFolders[book])) throw Error('未知册号');
let previous = null;
if (selectedBooks.length < 3) previous = JSON.parse(await readFile(path.join(project,'planning/materials-inventory.json'),'utf8'));
if (previous && path.resolve(previous.sourceRoot)!==sourceRoot) throw Error('增量盘点需使用同一资料根目录');
const files = [], skipped = [];
if (previous) files.push(...previous.files.filter(file=>!selectedBooks.includes(file.book)));
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
for (const book of selectedBooks) await walk(path.join(sourceRoot, bookFolders[book]), book);
files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN', { numeric: true }));
const folders = [];
for (const book of ['book1', 'book2', 'book3']) {
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
result.retainedBooks = previous ? Object.keys(bookFolders).filter(book=>!selectedBooks.includes(book)) : [];
result.bookScannedAt = Object.fromEntries(Object.keys(bookFolders).map(book=>[book,selectedBooks.includes(book)?result.scannedAt:previous?.bookScannedAt?.[book] || previous?.scannedAt]));
await mkdir(path.join(project, 'planning'), { recursive: true });
await writeFile(path.join(project, 'planning', 'materials-inventory.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ totalFiles: result.totalFiles, GiB: +(result.totalBytes / 1024 ** 3).toFixed(2), books: ['book1', 'book2', 'book3'].map(book => ({ book, files: files.filter(f => f.book === book).length })), zeroByteFiles: files.filter(f => !f.bytes).map(f => f.relativePath), unfinishedFiles: files.filter(f => /\.(baiduyun|downloading|part|tmp)$/i.test(f.relativePath)).map(f => f.relativePath), skipped }, null, 2));
