"""Read the user-selected PDFs without modifying the source materials."""
from pathlib import Path
import json
from pypdf import PdfReader

project = Path(__file__).resolve().parent.parent
folder = Path(r'D:\BaiduNetdiskDownload\新概念三\新概念3 教材笔记讲义习题详解')
scratch = project / 'tmp' / 'pdfs' / 'book3'
scratch.mkdir(parents=True, exist_ok=True)
records = []
for name in ['新概念3.pdf', '新概念英语第三册课文及翻译.pdf', '新概念英语 练习详解 3.pdf', '李彦隆3册写作讲义.pdf']:
    source = folder / name
    reader = PdfReader(source)
    pages = [page.extract_text() or '' for page in reader.pages]
    target = scratch / (source.stem + '.txt')
    target.write_text('\n'.join(f'\n=== PDF PAGE {i+1} ===\n{text}' for i,text in enumerate(pages)), encoding='utf-8')
    records.append({'file':name, 'pages':len(pages), 'characters':sum(map(len,pages)), 'textFile':str(target), 'firstText':next((text[:700] for text in pages if len(text)>100),'')})
print(json.dumps(records,ensure_ascii=False,indent=2))
