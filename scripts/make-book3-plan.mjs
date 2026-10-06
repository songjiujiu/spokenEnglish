import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const sourceNotes=[
  '第三册资料来自用户指定的 D:/BaiduNetdiskDownload/新概念三。学生用书《新概念3.pdf》275页为课号、正式课名和题目位置的主依据；目录全部60课已视觉核对。教材印刷页码加2即该文件PDF页序号。',
  '提取《新概念英语第三册课文及翻译.pdf》80页文字，按60课读取开篇及中文结尾，结合《新概念第三册笔记[minxue].pdf》315页的课文解说整理主题；并未逐页校勘全部讲义或试听全部音视频。',
  '汇编有错配：L7英文开篇误混入其他内容，L47、L51等标题也与学生用书不同。L7以学生用书PDF第40页的残钞鉴别故事核对；课名统一按学生用书目录，禁止将汇编错误自动导入学习任务。笔记中未检出Lesson46标题，不以此认定该课缺失，L46依据学生用书目录及课文汇编内容整理。',
  '视觉抽读学生用书L1正文后的摘要、作文和句型题（PDF17–18页）、L21书面题（PDF110页）与L60书面题（PDF272页）。L1摘要不超过80词、作文约150词；L21摘要不超过80词、作文不超过250词且四段；L60摘要不超过80词且限末段、作文250–350词。其他课按各自原题要求，不统一套用这些字数。',
  '每课的focus、canDo、分段阅读提示、三句双语表达和自查标准是本项目依据课文主题设计的练习，不是教材原题或官方能力等级。既有1–102周保持原编号，第三册从第103周追加。',
  '第三册按一课一周、每10课后复盘一周，共66周；60个教学周与6个复盘周均为每天45分钟、每周6天。教材作文较长时顺延，不要求在一周内强行完成所有配套练习。',
  '本轮只增量盘点第三册1488个文件；原第一、二册资料在当前根目录下已不存在，保留此前盘点与路线，不将旧盘点日期改作本次实查日期。发布文件只包含索引和原创任务，教材及音视频不打包。'
];

export async function loadBook3Catalog(root,inventory) {
  const lines=(await readFile(path.join(root,'planning/book3-curriculum.tsv'),'utf8')).trim().split(/\r?\n/).slice(1);
  const audioFiles=inventory.files.filter(file=>file.book==='book3' && file.extension==='.mp3' && file.relativePath.includes('英音-(MP3+LRC)'));
  const units=lines.map((line,index)=> {
    const [number,title,focus,canDo,part1,part2,...phrases]=line.split('\t');
    const lesson=Number(number), page=lesson<=20?14+(lesson-1)*4:lesson<=40?106+(lesson-21)*4:192+(lesson-41)*4;
    const audio=audioFiles.find(file=>Number(/^(\d+)/.exec(path.basename(file.relativePath))?.[1])===lesson);
    if(lesson!==index+1 || !audio || [title,focus,canDo,part1,part2].some(value=>!value) || phrases.length!==3) throw Error(`第三册L${number}目录或音频不完整`);
    const examples=phrases.map(phrase=>{const [en,zh,...extra]=phrase.split('｜');if(!en || !zh || extra.length)throw Error(`第三册L${number}双语表达不完整`);return {en,zh};});
    const writing=lesson===1?'本课摘要不超过80词；作文依教材提示扩写到约150词。':lesson===21?'摘要不超过80词，仅写与Humphries争执后的职业经历；作文不超过250词，按教材要求分四段。':lesson===60?'摘要不超过80词，只写末段女孩在车站的经历；作文从教材两个题目中选一个，写250–350词。':'按本课Summary writing限定的内容、字数和要求写摘要；Composition选择本课题目，按原题字数与分段要求完成。';
    return {start:lesson,end:lesson,title:title.replace('｜',' '),focus,canDo,parts:[part1,part2],phrases:examples,printPageStart:page,pdfPageStart:page+2,pdfPageEnd:page+5,audioPath:audio.relativePath.replaceAll('\\','/'),writing,check:`能说清“${part1}”与“${part2}”的关系；至少4条信息符合原文，能把本课表达用于自己的例子。`};
  });
  if(units.length!==60) throw Error('第三册必须包含连续60课');
  const catalog={book:'book3',sourceNotes,units};
  await writeFile(path.join(root,'planning/book3-lesson-map.json'),JSON.stringify(catalog,null,2)+'\n');
  await writeFile(path.join(root,'planning/book3-audit.json'),JSON.stringify({auditedAt:'2026-10-06',sourceRoot:'D:/BaiduNetdiskDownload/新概念三',files:inventory.files.filter(file=>file.book==='book3').length,audioLessons:units.map(unit=>unit.start),sourceNotes,scope:'目录全60课；文字汇编逐课主题；教材目录及L1/L7/L21/L60选定页视觉核对；未逐段试听'},null,2)+'\n');
  return catalog;
}

export const book3Resources=[
  {id:'b3-text',book:'book3',title:'第三册学生用书',relativePath:'新概念三/新概念3 教材笔记讲义习题详解/新概念3.pdf',role:'主线教材',note:'60课。计划给出本PDF页序号；摘要、作文和练习按本课原题要求。'},
  {id:'b3-audio',book:'book3',title:'第三册英音课文 MP3',relativePath:'新概念三/新概念第3册MP3音频/第三册课文MP3+LRC/英音-(MP3+LRC)',role:'听读与复述',note:'按01–60课号找到对应MP3。固定使用一套录音，长课分段听，不要求一次听清全部生词。'},
  {id:'b3-handout',book:'book3',title:'第三册逐课学习笔记',relativePath:'新概念三/新概念3 教材笔记讲义习题详解/新概念第三册笔记[minxue].pdf',role:'查长句与词义',note:'只查当天课号下的词语或句子。汇编如有错字、漏课或标题差异，以学生用书为准。'},
  {id:'b3-video',book:'book3',title:'第三册课文精讲精练',relativePath:'新概念三/新概念3 课文精讲精练视频 新版',role:'按疑点选看',note:'每课可能有多段讲解；当天最多选看15分钟，到点记录续看位置。'},
  {id:'b3-answers',book:'book3',title:'第三册练习详解',relativePath:'新概念三/新概念3 教材笔记讲义习题详解/新概念英语 练习详解 3.pdf',role:'独立作答后核对',note:'按课号查已做题的解释，先保留自己的答案，再写错因。'}
];

const resources=book3Resources.map(item=>item.id);
const tasks=entries=>entries.map(([minutes,text])=>({minutes,text}));
const day=(number,title,lessons,done,outcome,entries)=>({day:number,title,lessons,done,outcome,tasks:tasks(entries)});
const name=unit=>`第三册 L${unit.start}《${unit.title}》`;
const stages=[
  ['根据线索讲清事件','报告、证据、人物反应和事件先后','90秒至2分钟复述，区分事实与推断','一篇约150词的原创经历短文，包含背景、经过和结果'],
  ['解释误会，比较不同经历','人物知道的信息、想象与现实、两条时间线','约2分钟讲述经历，并解释一处误会或比较','一篇150–180词的原创比较或经历短文，段落关系清楚'],
  ['从故事提炼观点','传记、文化差异、商业诱因与价值判断','2–3分钟表达一个观点，并用课文事例支持','一篇180–220词的原创短文，观点有事例支持且包含一句限定'],
  ['组织复杂叙事与推理','多线叙事、线索核实、因果链与误导信息','约3分钟讲清复杂事件，回答3个关于原因或依据的追问','一篇200–250词的原创叙事或说明文，交代转折与证据'],
  ['比较方案，讨论现实问题','城乡、出行、媒体、污染和个人习惯','约3分钟比较两种选择，说明至少2条理由并回应不同意见','一篇约250词的原创议论短文，含观点、理由、例子和让步'],
  ['独立完成长篇阅读与表达','预测、科学条件、公共事务、回忆与生活选择','3–4分钟围绕熟悉主题表达，并区分事实、推断和个人看法','完成L60教材作文250–350词，保留提纲、初稿和修改稿']
];

function addToday(day,unit,week,listenTitle,instruction,optional=false,listenUnits=[unit]) {
  day.today={goal:day.outcome,done:day.done,review:week===103 && day.day===1?'先回忆二册最后一次作品中的3句表达；若直接从三册开始，先用英语说3句熟悉经历。':day.day===1?'先回忆上一学习周的3句表达，再看本周课题。':`先回忆本周第${day.day-1}天的三句表达，卡住时核对后再说一次。`,phrases:unit.phrases.map(phrase=>({...phrase})),listen:{title:listenTitle,instruction,optional,resourceIds:['b3-audio'],lessons:listenUnits.map(item=>({book:'book3',lesson:item.start}))}};
  return day;
}

function teachingDays(unit,week,oralGoal) {
  const label=name(unit), [part1,part2]=unit.parts;
  const pageHint=`学生用书PDF第${unit.pdfPageStart}–${unit.pdfPageEnd}页（印刷页${unit.printPageStart}–${unit.printPageStart+3}）`;
  const days=[
    day(1,`L${unit.start} · 初听与全文地图`,label,'听一遍并通读全文，留下主题句、3条信息和2个待解决问题。',`能说出《${unit.title}》讲什么，并辨认两部分：${part1}；${part2}。`,[[5,`打开${pageHint}，定位L${unit.start}与同课MP3；先看标题预测内容。`],[10,'不看文本听一遍；记人物、事件或作者观点，允许空缺，剩余时间只重听最不确定片段。'],[15,`通读全文，标记“${part1}”与“${part2}”的分界；最多查5个阻碍理解的词。`],[10,'核对刚才记录的3条信息，用简单英语说出主题和两部分内容。'],[5,'写下2个问题，并保存今天的3条信息；不提前做整套题。']]),
    day(2,`L${unit.start} · 精读：${part1}`,label,`读完“${part1}”部分，拆清2个句子并跟读3句；记录停下的句子。`,`能用自己的话解释：${part1}。`,[[5,'不翻书说回昨天3条信息。'],[15,`从课文开头精读到“${part1}”结束，圈主干与修饰；疑点只查本课笔记或精讲片段，阅读与查讲解共15分钟。`],[10,'选本部分2个长句，标主语、谓语和连接关系；先说简短主干再加细节。'],[10,'本部分选3句听原音、暂停跟读，每句两遍，再用自己的信息替换一句。'],[5,'合上书说回2条信息，记下下一次从哪句继续。']]),
    day(3,`L${unit.start} · 精读：${part2}`,label,`接续读完“${part2}”，画出全文关系，完成3句迁移表达。`,`能围绕“${unit.focus}”解释两部分怎样连接。`,[[5,'回忆昨天2条信息和1个句子主干。'],[15,`接续精读“${part2}”到课文最后一句；疑点结合本课笔记查明，查讲解也计入这15分钟。`],[10,'听本部分原音，选最难2句跟读，再从头说明全文事件顺序或论证关系。'],[10,`围绕“${unit.focus}”写3个自己的句子；使用页面三句作提示后更换人物、情境或信息。`],[5,'检查句子主干、时态和连接词，改一处错误；标明尚未理解的一句。']]),
    day(4,`L${unit.start} · 理解题与摘要`,label,'完成本课理解题或理解类选择题，留下符合本课要求的摘要和一次修改。','能筛选摘要需要的信息，保留原意并压缩表达。',[[5,'不看课文说出主题及3条依据。'],[10,'先做本课Comprehension；没有独立此栏时做多项选择中的理解题，最多3题，独立回答后核对。'],[10,`读Summary writing原题，圈定所限段落、字数及要点。${unit.writing}`],[15,'按提纲写本课摘要，不抄完整原段；检查只写题目要求的范围，过长就删重复信息。'],[5,'核对事实和字数，改一处偏差，保存摘要；遇到未完成处记录续写位置。']]),
    day(5,`L${unit.start} · 开口迁移与作文草稿`,label,'留下1段自己的口头表达、作文提纲和草稿；长稿注明下一句准备写什么。',`能${unit.canDo}。`,[[5,'回忆本课三句表达，并换成自己的信息。'],[10,`仅看关键词录音：${unit.canDo}。本阶段练习目标为${oralGoal}；短课可复述加个人例子，不机械凑时长。`],[10,`读本课Composition，选一个题目，列段落提纲与字数要求。${unit.writing}`],[15,'按提纲写作文草稿；只做今天一项写作任务，未写完记下断点，明天继续。'],[5,'对照提纲检查一处结构或时态问题；保存录音和草稿。']]),
    day(6,`L${unit.start} · 改稿与独立自查`,label,'补完并修改选定作文，完成本课5道句型/词汇练习与10项自查；未达标则接续补练。',`能独立完成：${unit.canDo}。`,[[5,'闭卷回忆本课3条事实和3句可迁移表达。'],[10,`只看关键词重说本课。${unit.check} 回听自己的录音，修正后重说一句。`],[15,'续写并修改昨天的作文；按原题检查事实、字数、分段和衔接，保留原稿与修改稿。'],[10,'从本课Key structures/Special difficulties/词汇题选5题独立作答，不足5题时补同课词汇选择题；先做再查详解。'],[5,'自查10项：5题练习、3条事实、口头任务、书面任务各计1项；至少8/10且口头和书面均完成再进入新课，否则下一学习日继续本课。']])
  ];
  return days.map(item=> {
    const optional=item.day>=4;
    const section=item.day===2?part1:item.day===3?part2:'全文';
    return addToday(item,unit,week,`${optional?'可选回听：':''}第三册 L${unit.start} · ${optional?'本课难句':section}`,optional?'今天以理解、输出或修改为主。只在核对信息时回听本课难句，不新增必做录音。':`打开L${unit.start}对应MP3，${item.day===1?'先不看文字听全文，抓主题和3条信息。':`找到“${section}”所在片段，听一句、暂停、跟读一句。`}`,optional);
  });
}

function reviewDays(units,phase,week) {
  const chunks=[units.slice(0,4),units.slice(4,7),units.slice(7)];
  const range=`第三册 L${units[0].start}–${units.at(-1).start}`;
  const days=chunks.map((chunk,index)=> {
    const first=chunk[0],last=chunk.at(-1),label=`第三册 L${first.start}–${last.start}`;
    const d=day(index+1,`${label} · 复听与错题`,label,`回顾${chunk.map(u=>`L${u.start}《${u.title}》`).join('、')}，完成两课各3条信息、5道错题与3句迁移表达。`,`能再次说明：${first.canDo}；${last.canDo}。`,[[5,`看课名回忆${chunk.map(u=>`L${u.start}`).join('、')}的主题，不翻正文。`],[10,`回听L${first.start}与L${last.start}各一段，每课记3条信息，核对与原文是否一致。`],[15,`从${label}的错题选5题重做，重点复查“${first.focus} / ${last.focus}”。`],[10,`闭卷说出3句迁移表达，并口头完成：${last.canDo}。`],[5,'记录仍需提示的两项及课号；已掌握的题不重复抄写。']]);
    return addToday(d,last,week,`第三册 L${first.start}、L${last.start} · 本段复听`,'两课各选一段回听，每课说对3条信息；剩余难点按原课号查阅。',false,[first,last]);
  });
  const chosen=units[Math.floor(units.length/2)];
  days.push(addToday(day(4,'阶段口语作品 · 用例子说清楚',range,'保存一段阶段口语录音与一次重录，并记录3个追问及回答。',phase.outcomes[1].text,[[5,'从前3天的记录挑一个仍需提示的表达。'],[10,`回听L${units[0].start}和L${chosen.start}的相关片段，选可用于本次表达的3个结构。`],[10,`列关键词提纲：${phase.outcomes[1].text} 可借用“${chosen.canDo}”作为主题。`],[15,'仅看关键词录音，回听后改一处结构问题；自己提出3个追问并回答，再重录。'],[5,'保存两次录音，写明哪一句进步了、哪一处仍卡住。']]),chosen,week,`第三册 L${units[0].start}、L${chosen.start} · 表达准备`,'只回听与本次作品有关的片段，选3个结构。',false,[units[0],chosen]));
  const last=units.at(-1);
  days.push(addToday(day(5,'阶段书面作品 · 写完整并修改',range,'完成本阶段书面作品，保存初稿、修改稿和3处修改说明。',phase.outcomes[2].text,[[5,'回忆第4天口头表达中最有用的3个结构。'],[10,`确定主题和段落提纲：${phase.outcomes[2].text} 优先处理未完成作文，再安排本阶段作品；未完成时顺延。`],[15,'按提纲完成本次作品；到点写下准确续写位置，不为了赶进度省略结尾。'],[10,'检查观点或事件、段落衔接和词语搭配，修改3处表达并说明原因。'],[5,'保存提纲、初稿与修改稿，标明课号或原创主题。']]),last,week,`可选回听：第三册 L${last.start} 难句`,'今天主要完成书面作品，需要核对表达时才回听。',true));
  days.push(addToday(day(6,'阶段自查 · 决定继续还是补练',range,'记录10项自查结果，完成一段口头复查；确认作文完整后再进入下一阶段。',phase.achievement,[[10,`回听L${units[0].start}和L${last.start}的熟悉片段，各独立说出3条信息。`],[10,`从${range}抽取5个词句或结构提示作答，先闭卷再核对。`],[10,'仅看关键词复说第4天作品的核心部分，再回答一个追问。'],[10,'复查第5天作品，确认题目、结构和字数都符合要求；补改一处问题。'],[5,'记录10项：5个提示、3条事实、口头和书面作品各1项；至少8/10且两份作品均完成才推进，否则写下课号与下一次补练的具体任务。']]),last,week,`第三册 L${units[0].start}、L${last.start} · 阶段听力自查`,'两课各选熟悉片段，听后各说3条信息，再核对。',false,[units[0],last]));
  return days;
}

export function buildBook3Plan(catalog,startWeek=103) {
  const phases=[],weeks=[];
  for(let block=0;block<6;block++) {
    const units=catalog.units.slice(block*10,block*10+10),[achievement,focus,oralGoal,writingGoal]=stages[block];
    const first=startWeek+block*11,last=first+10;
    const phase={id:`b3-${block+1}`,book:'book3',label:achievement,achievement,lessons:`L${units[0].start}–${units.at(-1).start}`,weeks:11,weekStart:first,weekEnd:last,focus,output:`${oralGoal}；${writingGoal}。`,checkpoint:'10项抽查至少8项正确，且口头和书面作品均独立完成；否则顺延补练。',resourceIds:resources,outcomes:[{skill:'听懂',text:`听本段熟悉录音，提取至少4条关键信息，并识别${focus}。`},{skill:'开口',text:oralGoal+'。'},{skill:'写出',text:writingGoal+'。'}],evidence:'一份阶段口语录音与重录、一份书面初稿与修改稿，以及10项自查记录。',passCriteria:'隔天不看全文，复述或说明至少4条准确信息，能回答3个追问；书面作品完整且经过修改；10项自查至少8/10且口头、书面均完成。',schedule:[]};
    units.forEach((unit,index)=> {
      const slot={week:first+index,lessons:`L${unit.start}（一课）`,kind:'学习',goal:'一课六天：初听、两次精读、摘要、表达与作文、自查；第7天休息。'};
      phase.schedule.push(slot);
      weeks.push({...slot,book:'book3',phaseId:phase.id,title:unit.title,learn:[`课文前段：${unit.parts[0]}`,`课文后段：${unit.parts[1]}`,`表达重点：${unit.focus}`],finish:`学完L${unit.start}正文；学生用书PDF第${unit.pdfPageStart}–${unit.pdfPageEnd}页（印刷页${unit.printPageStart}–${unit.printPageStart+3}）。完成一份摘要、选定作文及5道句型/词汇题，不要求看完所有视频。`,canDo:[`能${unit.canDo}。`,unit.check],deliverable:'一张全文信息图、3句迁移表达、一份摘要、一段录音、选定作文初稿及修改稿、5题错因。',passCriteria:`${unit.check} 10项自查至少8/10且口头和书面任务均完成；作文未完成则记录断点，下一个学习日继续。`,resourceIds:resources,days:teachingDays(unit,slot.week,oralGoal)});
    });
    const slot={week:last,lessons:`L${units[0].start}–${units.at(-1).start} 回顾`,kind:'复盘',goal:'本阶段10课集中复盘，补完作品并自查，不安排新课。'};
    phase.schedule.push(slot);
    weeks.push({...slot,book:'book3',phaseId:phase.id,title:`${phase.lessons} · ${achievement}`,learn:[units.slice(0,4),units.slice(4,7),units.slice(7)].map(chunk=>chunk.map(unit=>`L${unit.start}《${unit.title}》`).join(' / ')),finish:`停在第三册L${units.at(-1).start}，完成本阶段录音、书面修改稿和自查。`,canDo:phase.outcomes.map(item=>item.text),deliverable:phase.evidence,passCriteria:phase.passCriteria,resourceIds:resources,days:reviewDays(units,phase,last)});
    phases.push(phase);
  }
  return {phases,weeks};
}
