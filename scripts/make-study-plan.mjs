import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeeks } from './make-weekly-plan.mjs';
import { addTodayPlan } from './make-today-plan.mjs';
import {loadBook3Catalog,buildBook3Plan,book3Resources} from './make-book3-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inventory = JSON.parse(await readFile(path.join(root, 'planning/materials-inventory.json'), 'utf8'));
const [book1, book2] = await Promise.all(['book1', 'book2'].map(async book => JSON.parse(await readFile(path.join(root, `planning/${book}-lesson-map.json`), 'utf8'))));
const phraseMap = JSON.parse(await readFile(path.join(root, 'planning/daily-phrase-map.json'), 'utf8'));
const book3 = await loadBook3Catalog(root,inventory);
const resource = (id, book, title, relativePath, role, note) => ({ id, book, title, relativePath, role, note });
const resources = [
  resource('phonetics', 'book1', '音标入门视频', '新概念一/音标入门视频', '起步与按需回看', '27 个 AVI 视频。前两周先练长短元音、字母常见发音与重音；其他音和连读问题跟随课文逐步补，不要求两周看完。'),
  resource('b1-text', 'book1', '第一册学生用书', '新概念一/新概念1 教材笔记讲义习题详解/新概念英语第一册学生用书.pdf', '主线教材', '144 课；奇数课情境对话与紧随的偶数课句型操练组成一组，共 72 组。'),
  resource('b1-video', 'book1', '第一册精讲精练 · 霍娜', '新概念一/新概念第1册课文精讲精练视频 新版 霍娜', '主线讲解', '433 个视频约 65.40 小时，包含导学。每组通常拆为 6 段；优先解决词汇、课文、语法和偶数课疑点，预习与知识拓展选看。'),
  resource('b1-handout', 'book1', '第一册整合讲义', '新概念一/新概念1 教材笔记讲义习题详解/新概念一册专属讲义（整合版供打印使用）.pdf', '主线配套', '配合对应课次阅读一份讲义即可。个别标题可能有笔误，按教材课号和视频课号配对。'),
  resource('b1-audio', 'book1', '第一册课文音频', '新概念一/新概念第1册 MP3音频/第一册课文奇数MP3+LRC', '每日听读', '先不看文字听一遍，再对照教材分句跟读；固定一套录音持续使用。目录中的不同版本不重复计算为新课。'),
  resource('b1-drill-audio', 'book1', '第一册偶数课音频', '新概念一/新概念第1册 MP3音频/第一册mp3{偶数}', '句型操练', '在每组第 3 天，用偶数课音频和教材做替换、问答。'),
  resource('b1-workbook', 'book1', '第一册练习册与答案', '新概念一/新概念1 教材笔记讲义习题详解/新概念英语第一册练习册附答案.pdf', '独立作答后核对', '先选 5–10 题独立作答，再查看答案与详解；记下错误原因，不把看过答案当作首次答对。'),
  resource('b1-speaking', 'book1', '剑桥标准流利口语 Book 1', '新概念一/剑桥标准流利口语-Book1', '可选迁移练习', '一册起步后按主题选用：自我介绍、日常生活、购物、食物等。替换当日一段讲解或口语任务，不额外堆课。'),
  resource('phonics', 'book1', '172 个自然拼读视频', '新概念一/172个自然拼读发音视频', '遇到拼读难点再查', '按正在学的单词查对应拼读规律；不列入必须顺序看完的课程。'),
  resource('b1-live', 'book1', '第一册直播语法专题', '新概念一/新概念一册直播课', '复盘时查漏', '16 组视频与讲义。出现同类时态或句型错误时，选对应专题片段；不和主精讲从头重复观看。'),
  resource('b2-text', 'book2', '第二册学生用书', '新概念二/新概念2 教材笔记讲义习题详解/新概念英语第二册学生用书.pdf', '主线教材', '96 课；每课完成课文理解、复述和教材对应摘要或写作任务。'),
  resource('b2-video', 'book2', '第二册精讲精练', '新概念二/新概念2 课文精讲精练视频 新版', '主线讲解', '291 个视频约 62.16 小时，包含导学和总复习；96 课的主课文与语法片合计约 35.19 小时，词汇与知识拓展按需观看。'),
  resource('b2-handout', 'book2', '第二册逐课讲义', '新概念二/新概念2 教材笔记讲义习题详解/讲义', '主线配套', 'Lesson 1–96 的 PDF 按正在学的课号读取。多套总讲义只选这一套作为常用参考。'),
  resource('b2-audio', 'book2', '第二册课文音频', '新概念二/新概念第2册MP3音频/第二册课文MP3+LRC', '每日听读', '先听取人物、时间、地点和事件，再逐句跟读；根据需要回到文本核对。'),
  resource('b2-workbook', 'book2', '第二册一课一练', '新概念二/新概念2 教材笔记讲义习题详解/新概念英语第二册一课一练（附答案）.pdf', '独立作答后核对', '每课选最相关的一组练习，复盘周回做错题；答案用于核对，不先照抄。'),
  resource('b2-speaking', 'book2', '剑桥标准流利口语 Book 2', '新概念二/剑桥标准流利口语-Book2（卓越四六级拓展）', '可选迁移练习', '按交友、兴趣、旅行、经历、沟通与计划等主题选用；每周最多替换一次主线口语任务。'),
  resource('b2-grammar', 'book2', '第二册语法伴侣', '新概念二/新概念二册 语法伴侣', '查漏与衔接', '针对未理解的语法查一个专题；已有主课讲解能解决的内容不再重复完整观看。'),
  resource('b2-live', 'book2', '第二册直播专题', '新概念二/新概念二最新最新直播课', '可选复盘', '现有 9 组视频与 PDF；按文件中的简单句、时态、并列句、被动、从句等主题查找。文件夹名称中的“最新”不作为时效证明。')
];
const canonical = text => text.replaceAll('\\', '/');
resources.push(...book3Resources);
for (const item of resources) {
  if (!inventory.files.some(file => canonical(file.relativePath) === item.relativePath || canonical(file.relativePath).startsWith(item.relativePath + '/'))) throw Error(`原目录找不到规划资源：${item.relativePath}`);
}
const tasks = (...entries) => entries.map(([minutes, text]) => ({ minutes, text }));
const day = (number, title, entries) => ({ day: `第 ${number} 天`, title, tasks: tasks(...entries) });
const firstWeek = [
  day(1, '建立听读习惯，认识第一组对话', [[5,'打开第一册学生用书与奇数课 MP3，定位 L1；写下本周固定学习时段。'],[15,'音标入门 01、02：各选片段听辨两个元音，暂停模仿，不追求看完。'],[10,'L1 音频听一遍不看文字，再对照课文听两遍。'],[10,'分角色读 L1，对照录音检查语调；记下最难的一句。'],[5,'合上课文回忆两个表达，第二天先重试。']]),
  day(2, '听清、说清自己的名字', [[5,'不看文本回忆昨天两个表达。'],[15,'音标第 21 个视频（字母常见发音）选取与自己姓名有关的片段。'],[10,'L1 选三句，听一句、暂停、跟读一句。'],[10,'用自己的姓名做 4 轮简单问答；不确定时查教材或口语 Book 1 Unit 1 讲义。'],[5,'写两句个人信息，并读回检查。']]),
  day(3, '把句型换成自己的信息', [[5,'回忆前两天的表达，答不出则先看一次再合上。'],[15,'第一册 L2 教材与句型讲解选看，关注问与答如何变化。'],[10,'做 5 次替换练习；同时回听对应偶数课音频。'],[10,'不看完整例句说 4 轮问答，再写出其中两轮。'],[5,'记录一个发音问题和一个句型问题。']]),
  day(4, '接触 L3–4，继续发音练习', [[5,'复习 L1–2 的 3 条核心表达。'],[15,'预听 L3，遇到生词查讲义，再看对应主精讲片段。'],[10,'对照录音跟读 L3，停在最难的一两句。'],[10,'按 L4 做简单替换问答；只用已经出现过的词。'],[5,'合上教材写 2–3 句，并标记明天要重试的地方。']]),
  day(5, '重音与自我介绍', [[5,'凭中文提示回忆本周表达。'],[15,'音标第 24 个视频（重音）选看片段，回到本周句子模仿。'],[10,'L1、L3 音频各听一遍；不看文本说出大意。'],[10,'参考口语 Book 1 Unit 1，做约 20 秒自我介绍，停顿也可以。'],[5,'写 3–4 句自我介绍，读回改一处。']]),
  day(6, '第一周回顾，决定下周要补什么', [[10,'抽取本周 5 条中文提示，先独立回忆再看答案。'],[10,'任选一段本周对话听写关键词，不要求逐字听写。'],[10,'再做一次介绍自己和询问对方的情境问答。'],[10,'回做错题或改写昨天的 3–4 句，记录难点。'],[5,'整理本周笔记，安排第二周的发音难点与 L1–4 再练。']])
];
const phases = [];
let cursor = 1;
function phase(id, book, label, lessons, weeks, focus, output, checkpoint, resourceIds, schedule) {
  phases.push({ id, book, label, lessons, weeks, weekStart: cursor, weekEnd: cursor + weeks - 1, focus, output, checkpoint, resourceIds, schedule }); cursor += weeks;
}
phase('start','book1','先建立听读和开口习惯','发音起步 + L1–4 预接触',2,'选练常见长短元音、字母发音和重音；先听再跟读，把发音问题带回句子。','说一段约 20–30 秒自我介绍，并用已学句子完成简单问答。','能跟着音频分句模仿、凭提示想起至少 3 条表达；未熟悉的音继续边学边补，不必等全部音标学完。',['phonetics','b1-text','b1-audio','b1-speaking'],[{week:1,lessons:'发音入门与 L1–4 预接触',kind:'起步',goal:'按下方首周六天安排开始，建立固定学习时段。'},{week:2,lessons:'L1–4 再练与发音难点',kind:'起步',goal:'复用首周任务，补自己的发音难点；第 3 周开始正式按教材推进。'}]);
const b1 = [
  ['L1–24','从认识人到描述身边物品','身份、所属、颜色、be 问答与单复数；发音跟着词和句子练。','30–45 秒介绍自己，并指物问答 6 轮；写 6 句介绍自己与随身物品，检查代词与 be 的搭配。'],
  ['L25–48','说清位置、动作与需求','房间与场景描述：There be、现在进行、祈使句、can 和实义动词问否；从例句转为身边情境。','描述房间或图片 45–60 秒，完成 8 次句型替换；写 8 句房间与家人活动，含 2 个问句。'],
  ['L49–72','把日常安排连起来','日常习惯、时间、购物与就医，再引入过去经历；对比句子表达的时间。','讲 1 分钟平日与上周末，再练购物问答；写 8–10 句，其中各 2 句描述现在习惯与过去经历。'],
  ['L73–96','讲经历，也说下一步','过去叙述、现在完成、将来计划及出行；区分已完成、过去发生和将来打算。','讲 60–90 秒旅行经历和计划，回应 6 个追问；写约 80 词受控短文，用时间词帮助表达。'],
  ['L97–120','比较、转述与事件先后','转述信息与宾语从句、比较级、过去进行和过去完成；在情境中说明先后关系。','比较两件商品并转述建议 60–90 秒；写 80–100 词小经历，使用时间连接并修改时态。'],
  ['L121–144','从单句走向连接表达','定语从句、情态推测、条件句、转述和被动表达；按情境选合适句型。','约 90 秒讲故事或解释计划并回答追问；写约 100 词短文，自然使用学过的连接结构，不为堆语法而造句。']
];
for (let block = 0; block < 6; block++) {
  const [lessons,label,focus,output] = b1[block], start=block*24+1;
  const schedule = Array.from({length:6},(_,i)=>({week:cursor+i,lessons:`L${start+i*4}–${start+i*4+3}（两对课）`,kind:'学习',goal:'每对课 3 个学习日；主讲视频按疑点选看，每天最多 15 分钟。'}));
  schedule.push({week:cursor+6,lessons:`${lessons} 回顾`,kind:'复盘',goal:'补长课、重做错题、完成本段口语与写作检查；本周不安排新课。'});
  phase(`b1-${block+1}`,'book1',label,lessons,7,focus,output,'隔天抽查本段 10 项提示，能独立答出至少 8 项；能完成本段输出并修正典型错误。未达到时先补一周，再推进。',['b1-text','b1-video','b1-handout','b1-audio','b1-drill-audio','b1-workbook'],schedule);
}
phase('bridge','book2','一册收束，准备二册','一册复盘 + 二册导学与 L1 预听',2,'对照现在、过去和将来的表达，练“先听 → 说大意 → 看文核对”；理解二册摘要题怎样限制字数与组织句子。','约 90 秒讲自己的经历；写 60–80 词生活短文，读回修正，再预听二册 L1。','能围绕熟悉主题持续表达；听熟悉一册课文能说出主要信息；若依赖逐字中文翻译，延长衔接期。',['b1-text','b1-audio','b1-workbook','b2-text','b2-audio','b2-video'],[{week:cursor,lessons:'第一册六段综合回顾',kind:'衔接',goal:'不重看全部视频；按错题选两个薄弱点，完成生活主题表达。'},{week:cursor+1,lessons:'第二册导学 + L1 预听',kind:'衔接',goal:'熟悉教材摘要与练习形式；导学与 L1 视频只按 15 分钟片段观看。'}]);
const b2 = [
  ['L1–24','先抓句子主干，再讲清事件','复习句子骨架并扩展时态、情态等用法；每课先抓事件，再读细节。','约 60 秒复述；完成所选教材摘要题。已抽查 L1、L24 的要求为不超过 55 词。'],
  ['L25–48','连接句子，讲清关系','从简单句进入并列和复合结构；有意识地用连接词表达顺序、原因与转折。','约 90 秒复述；完成合句与摘要。已抽查 L48 摘要要求为不超过 75 词。'],
  ['L49–72','看懂长句，表达更连贯','辨认非谓语与从句等结构；用主干、修饰和连接关系拆解长句。','约 2 分钟复述；按教材关键词扩写。已抽查 L72 摘要上限为 75 词，另有关键词扩写任务。'],
  ['L73–96','把阅读变成自己的表达','综合分析长句与语篇；围绕主题整合信息，练不同的连接方式和段落组织。','2–3 分钟主题表达；已抽查 L96 摘要上限为 80 词，另有约 150 词的两段作文，可分两次写。']
];
for (let block=0;block<4;block++) {
  const [lessons,label,focus,output]=b2[block],start=block*24+1,schedule=[];
  for(let half=0;half<2;half++) {
    for(let i=0;i<6;i++) schedule.push({week:cursor+half*7+i,lessons:`L${start+half*12+i*2}–${start+half*12+i*2+1}（两课）`,kind:'学习',goal:'每课 3 个学习日；看主课文与语法片段，输出不省略。'});
    schedule.push({week:cursor+half*7+6,lessons:`L${start+half*12}–${start+half*12+11} 回顾`,kind:'复盘',goal:'补较长课、闭卷复述、核对摘要事实与连接关系；不安排新课。'});
  }
  phase(`b2-${block+1}`,'book2',label,lessons,14,focus,output,'选两篇学过课文，隔天只看关键词复述主要事实；完成教材摘要/练习再核对。连续两次仍无法完成，则先减为每周一课。',['b2-text','b2-video','b2-handout','b2-audio','b2-workbook'],schedule);
}
const phaseResults = {
  start: {
    achievement:'敢开口介绍自己，能做简单问答',
    outcomes:[
      {skill:'听懂',text:'听 L1、L3 熟悉录音，辨认招呼、询问与回应。'},
      {skill:'开口',text:'借助姓名等关键词，做 20–30 秒自我介绍和 3 轮简单问答。'},
      {skill:'写出',text:'不照抄例句，写 3–4 句个人信息，并读给自己听。'}
    ],
    evidence:'用手机或电脑保存一段自我介绍录音，笔记中留下 3–4 句个人介绍。',
    passCriteria:'隔天不看完整例句，完成 3 轮问答；回听自己的介绍，能指出并重录一句不清楚的表达。'
  },
  'b1-1': {
    achievement:'介绍自己，也能问清物品是谁的',
    outcomes:[
      {skill:'听懂',text:'听本段熟悉对话，找出人物身份、物品颜色和所属人。'},
      {skill:'开口',text:'做 30–45 秒自我介绍，再围绕随身物品完成 6 轮问答。'},
      {skill:'写出',text:'写 6 句自己和物品的介绍，正确搭配人称代词与 be。'}
    ],
    evidence:'用手机或电脑保存一段自我介绍与物品问答录音，留存一张 6 句介绍卡。',
    passCriteria:'隔天凭实物完成 6 轮问答；随机抽查 10 项表达答对至少 8 项，并把介绍卡中的代词与 be 错误改正。'
  },
  'b1-2': {
    achievement:'说清房间里有什么、人在做什么',
    outcomes:[
      {skill:'听懂',text:'听本段熟悉录音，指出物品位置、人物正在做的事及简单需求。'},
      {skill:'开口',text:'看自己的房间或一张图，说 45–60 秒，描述位置、动作和需求。'},
      {skill:'写出',text:'写 8 句房间与家人活动，其中 2 句用来向对方提问。'}
    ],
    evidence:'用手机或电脑录下一段看图描述，保存对应的 8 句文字和原图。',
    passCriteria:'换一张同类图片，独立说出 8 句且与图意相符；其中 2 个问句能自己作答，再核对位置词和动词形式。'
  },
  'b1-3': {
    achievement:'聊日常安排、购物和上周末',
    outcomes:[
      {skill:'听懂',text:'听熟悉的日常或购物对话，记下时间、所需物品和已发生的事。'},
      {skill:'开口',text:'用约 1 分钟讲平日与上周末，再做一段简单购物问答。'},
      {skill:'写出',text:'写 8–10 句生活记录，至少各 2 句说日常习惯与过去经历。'}
    ],
    evidence:'用手机或电脑保存一次日常与周末介绍录音，笔记中留下 8–10 句生活记录。',
    passCriteria:'隔天凭时间提示讲自己的日常与周末；至少各说出 2 句习惯和过去经历，抽查 10 项本段表达答对至少 8 项。'
  },
  'b1-4': {
    achievement:'讲清一次经历，也说出下一步计划',
    outcomes:[
      {skill:'听懂',text:'听本段熟悉录音，区分已经做过、过去发生和将要做的事。'},
      {skill:'开口',text:'讲 60–90 秒旅行经历与计划，回答时间、地点等 6 个追问。'},
      {skill:'写出',text:'写约 80 词旅行短文，用时间词区分过去经历与未来计划。'}
    ],
    evidence:'用手机或电脑录下旅行介绍与追问回答，保存一篇约 80 词的旅行短文。',
    passCriteria:'隔天不看原稿完成介绍与 6 个追问；对照短文检查时间先后，改正把过去经历写成未来计划等时间表达错误。'
  },
  'b1-5': {
    achievement:'比较选择、转述建议、说明先后',
    outcomes:[
      {skill:'听懂',text:'听本段熟悉对话，找出比较结果、他人意见与事情的先后顺序。'},
      {skill:'开口',text:'用 60–90 秒比较两件商品，并转述一条他人的建议。'},
      {skill:'写出',text:'写 80–100 词小经历，用时间连接词交代先后，并检查时态。'}
    ],
    evidence:'用手机或电脑录下一段商品比较与建议转述，留下 80–100 词经历短文。',
    passCriteria:'凭两件商品的信息说出 2 个比较点和 1 条转述；读回短文，能标出事件先后并改正典型时态错误。'
  },
  'b1-6': {
    achievement:'把句子连成故事，解释自己的计划',
    outcomes:[
      {skill:'听懂',text:'听本段熟悉课文，说出主要事件，并找出条件、推测或转述信息。'},
      {skill:'开口',text:'用约 90 秒讲故事或解释计划，并回答 3 个与内容有关的追问。'},
      {skill:'写出',text:'写约 100 词生活短文，用学过的连接结构表达原因、条件或人物信息。'}
    ],
    evidence:'用手机或电脑保存故事或计划录音，保存一篇约 100 词短文及修改稿。',
    passCriteria:'隔天只看关键词完成约 90 秒表达和 3 个追问；短文中找出 2 处连接结构，核对其意思并修正错误。'
  },
  bridge: {
    achievement:'独立讲生活经历，开始抓故事大意',
    outcomes:[
      {skill:'听懂',text:'不看文字听两段熟悉的一册录音，各说出人物、事件与时间信息。'},
      {skill:'开口',text:'只看关键词讲约 90 秒个人经历，不逐句读中文再翻译。'},
      {skill:'写出',text:'独立写 60–80 词生活短文；打开二册 L1，找出摘要题的具体要求。'}
    ],
    evidence:'用手机或电脑录下一次个人经历，保存生活短文，并在笔记中写出二册 L1 的摘要要求。',
    passCriteria:'隔天重新听两段一册录音，各说对至少 3 条信息；完成经历表达和短文修改后，再进入二册正式课次。'
  },
  'b2-1': {
    achievement:'抓住故事重点，讲清一件生活小事',
    outcomes:[
      {skill:'听懂',text:'听本段学过的故事，记下谁、何时、何地、发生了什么及结果。'},
      {skill:'开口',text:'只看关键词，用约 60 秒按先后顺序复述一则学过的故事。'},
      {skill:'写出',text:'按所选课的摘要题回答要点，再连成短文；字数以该课题目为准。'}
    ],
    evidence:'用手机或电脑保存一段约 60 秒故事复述，留下标有课号的摘要及修改稿。',
    passCriteria:'隔天任选 2 篇已学课文，各听最多 2 遍后说对至少 4 条关键信息；选 1 篇复述并完成符合该课要求的摘要。'
  },
  'b2-2': {
    achievement:'讲清事情经过、原因和转折',
    outcomes:[
      {skill:'听懂',text:'听本段学过的故事，找出事件先后、原因和出现转折的地方。'},
      {skill:'开口',text:'用约 90 秒复述故事，利用连接词说明先后、原因或转折。'},
      {skill:'写出',text:'按所选课要求完成合句与摘要，让句子表达的关系与原文一致。'}
    ],
    evidence:'用手机或电脑保存一段约 90 秒复述，留下摘要，并圈出其中表达关系的连接词。',
    passCriteria:'隔天只看关键词复述 1 篇已学故事，说对主要事实；标出 2 处连接关系，核对摘要事实、连词与该课字数要求。'
  },
  'b2-3': {
    achievement:'理解较复杂的故事，连贯复述重点',
    outcomes:[
      {skill:'听懂',text:'听本段学过的故事，分清主要事件和补充细节，并说明人物这样做的原因。'},
      {skill:'开口',text:'只看关键词复述约 2 分钟，说明事件顺序、原因和结果。'},
      {skill:'写出',text:'按所选课题目完成摘要或关键词扩写，核对长句的主干和连接关系。'}
    ],
    evidence:'用手机或电脑录下一段约 2 分钟复述，保存一份摘要或扩写稿，并标注 2 句的主干。',
    passCriteria:'隔天复述 1 篇已学故事，覆盖至少 5 条关键事实；能拆解文中 2 个长句，书面任务符合该课要求且不改变原意。'
  },
  'b2-4': {
    achievement:'围绕熟悉主题，完成有条理的表达',
    outcomes:[
      {skill:'听懂',text:'听本段学过的课文，概括主题，并用具体事件说明自己的理解。'},
      {skill:'开口',text:'用 2–3 分钟围绕熟悉主题表达，交代背景、经过与结果并回答追问。'},
      {skill:'写出',text:'按各课题目写摘要；完成 L96 约 150 词两段作文，检查段落衔接。'}
    ],
    evidence:'用手机或电脑保存一段 2–3 分钟主题表达，留下 L96 两段作文及一次修改稿。',
    passCriteria:'间隔一周只看提纲完成表达并回答 3 个追问；作文包含 L96 题目要求的要点，核对字数、分段与衔接后完成修改。'
  }
};
for (const item of phases) Object.assign(item, phaseResults[item.id]);
const weeks = addTodayPlan(buildWeeks({phases, firstWeek, book1, book2}), phraseMap);
const third = buildBook3Plan(book3,cursor);
phases.push(...third.phases);
weeks.push(...third.weeks);
cursor += third.weeks.length;

const plan = {
  version:1, scannedAt:inventory.scannedAt.slice(0,10), sourceRoot:inventory.sourceRoot,
  summary:{totalFiles:inventory.totalFiles,...Object.fromEntries(['book1','book2','book3'].map(book=>[book+'Files',inventory.files.filter(f=>f.book===book).length])),videoNote:'第一、二册保留此前盘点，本轮新增第三册1,488个文件索引。三册60课已与教材目录和英音MP3课号核对；未对三册全部视频计时或试听。片段数量不等于课程数量。'},
  pacing:{dailyMinutes:45,daysPerWeek:6,totalWeeks:cursor-1,description:'2周起步 + 42周一册 + 2周衔接 + 56周二册 + 66周三册 = 168周参考路线、1008个学习日，按每天45分钟计756小时。三册第103–168周，一课一周，每10课后复盘一周；三册共60个教学周和6个复盘周，全程共20个复盘周。这是学习顺序，不是完成期限；未掌握时顺延，第7天休息。'},
  phases, resources, weeks,
  curriculumSources:[...book1.sourceNotes, ...book2.sourceNotes, ...phraseMap.notes,...book3.sourceNotes],
  rules:[
    '每天 45 分钟到时就停，记录下次从哪里继续。第 7 天休息，偶尔漏学不以双倍时长惩罚性补课。',
    '每天看讲解上限 15 分钟，每周最多 90 分钟；必须保留跟读、主动回忆和自己的口头/书面输出。较难视频可分多天看。',
    '第一册不能把两对课的核心片都默认看完：核心视频每对平均约 45.07 分钟，36 个教学周中有 20 周超过 90 分钟。先按疑点看，未理解的内容移到复盘周，仍超量就整体顺延。',
    '第一册 L5–8、L13–16、L49–52、L137–140 特别留意负担；二册 L1–2 全片约 120 分钟，先学主课文与语法，生词及拓展按需看。二册 L55–56 主片合计约 85 分钟，可主动拆周。',
    '每对/每课最多记录 3 个想记住的表达，写在纸卡或自己的笔记中。隔天、约 3 天和一周后再回忆；积累过多时先复习，暂停新增。',
    '阶段门槛是本计划的自查建议，不是教材官方等级认证。口语时长与原创迁移写作词数是训练建议；二、三册教材摘要和作文按各课题目要求。第三册长作文可顺延，先完成与修改再进入下一课。',
    '不要等音标课、172 个拼读视频、所有直播和 PPT 全看完才开教材。主教材 + 一套主精讲 + 一套音频 + 一本练习册足够开始。',
    '每周第 6 天整理三个东西：最能独立说出的表达、仍会错的句型、下周第一项任务。'
  ],
  notes:[
    '依据：三册目录、教材课号与实际阅读的课文/讲义内容。一、二册曾抽读教材并盘点主视频时长；第三册核对60课目录、课文汇编及选定教材页。未逐页校勘全部讲义，也未逐段试听全部音视频。',
    '第一册已读学生用书目录、教师用书教学建议、霍娜整合讲义；第二册抽读学生用书及 L1、L24、L48、L72、L96 等逐课讲义，阶段目标结合这些材料设计。',
    '这份规划引用文件路径并概括用途，不搬运教材或视频。原始下载目录保持原状；库存清单与时长审计保存在项目 planning 目录。',
    '资源路径可复制到 Windows 文件资源管理器打开。当前页面不提供这些本地视频的站内播放；FLV、AVI、WMV、RM 等文件请使用支持对应格式的本地播放器。',
    '页面中的周次表示学习顺序；课文输出和自查结果可记在自己的学习笔记中。',
    '第一、二册的1–102周保持原编号，第三册从103周接续；浏览或调整到第三册不自动标记此前任务完成。完成三册后根据实际表现补强，不据此推定雅思分数。'
  ]
};
await writeFile(path.join(root, 'src/study-plan-data.json'), JSON.stringify(plan, null, 2)+'\n');
console.log(`已生成三册规划：${phases.length} 个阶段，${weeks.length} 周、${weeks.reduce((sum,week)=>sum+week.days.length,0)} 天具体任务。`);

