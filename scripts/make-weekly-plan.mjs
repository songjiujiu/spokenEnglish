// Expand the route into concrete sessions using the locally audited lesson maps.
const tasks = entries => entries.map(([minutes, text]) => ({ minutes, text }));
const day = (number, title, lessons, done, outcome, entries) => ({ day:number, title, lessons, done, outcome, tasks:tasks(entries) });
const range = (start, end) => start === end ? `L${start}` : `L${start}–${end}`;
const named = unit => `${range(unit.start, unit.end)}《${unit.title}》`;
const oral = unit => unit.speaking;
const written = unit => unit.writing;

function book1Days(units) {
  return units.flatMap((unit, index) => {
    const n = index * 3;
    const lesson = `第一册 ${named(unit)}`;
    return [
      day(n+1, `L${unit.start} · 听懂情境、读完课文`, lesson,
        `读完 L${unit.start} 全篇课文，选 3 句跟读，记下 3 个能用于“${unit.canDo}”的表达。`,
        `能说明《${unit.title}》中的情境，并模仿说出 3 个关键句。`, [
          [5, n ? `不看笔记回忆本周 L${units[0].start}–${units[0].end} 的 3 个表达。` : `开始前回忆上一学习日的 3 个表达；首次学习时先读 L${unit.start} 标题、观察教材插图。`],
          [15, `听 L${unit.start} 音频 1 遍，再通读《${unit.title}》；核对不懂的词，最多记录 5 个。`],
          [10, `从 L${unit.start} 选 3 句，听一句、暂停、跟读一句，每句练 3 次。`],
          [10, `结合“${unit.focus}”，替换人物或物品信息，说出 3 个自己的例句。遇到疑点只查本课讲义或对应讲解。`],
          [5, `合上课文说回 3 个表达；在笔记写下 L${unit.start} 尚不理解的一处。`]
        ]),
      day(n+2, `L${unit.start}–${unit.end} · 学句型、做替换`, lesson,
        `完成“${unit.focus}”的 5 次口头替换，以及 L${unit.end} 句型示例前 3 项（不足 3 项则做完）。`,
        `能用本课句型换成自己的信息，准备完成：${unit.canDo}`, [
          [5, `隔天不看文本，回忆 L${unit.start} 的 3 个关键表达。`],
          [15, `查 L${unit.start}–${unit.end} 对应讲义/精讲中的“${unit.focus}”，只看这一疑点，15 分钟到点停止。`],
          [10, `看 L${unit.end} 的句型示例前 3 项，听对应偶数课录音并口头作答；不足 3 项则做完。`],
          [10, `围绕“${unit.canDo}”做 5 次句型替换，写下其中 3 句，再核对本课例句。`],
          [5, `圈出最容易用错的一处，把 1 个错句改成正确句。`]
        ]),
      day(n+3, `L${unit.end} · 练习与独立表达`, lesson,
        `做 L${unit.end} 剩余示例中最多 5 项，完成本组口语任务与一份书面作业；停在 L${unit.end}。`,
        unit.canDo, [
          [5, `不看笔记说出 L${unit.start} 的 3 个表达，以及“${unit.focus}”的一个例子。`],
          [10, `接着昨天的记录做 L${unit.end} 句型示例最多 5 项；已做完则改做对应练习册前 5 小题，先做后核对。`],
          [10, `${oral(unit)} 用手机或电脑录音，卡住的地方先记下，再重说一次。`],
          [15, `${written(unit)} 对照教材句型检查，保留原稿和改正后的句子。`],
          [5, `完成自查：${unit.check} 未完成的题记入复盘清单，不以看完视频代替输出。`]
        ])
    ];
  });
}

function book2Days(units) {
  return units.flatMap((unit, index) => {
    const n=index*3, lesson=`第二册 ${named(unit)}`;
    return [
      day(n+1, `L${unit.start} · 听读整篇、抓住故事`, lesson,
        `通读《${unit.title}》全篇，记 3 条情节信息和最多 5 个生词；暂不要求背诵。`,
        `能说出《${unit.title}》的主要事件，为“${unit.canDo}”准备内容。`, [
          [5, n ? `回忆本周 L${units[0].start}《${units[0].title}》的 3 条信息。` : `回忆上一学习日的 3 个表达，再看 L${unit.start} 标题预测内容。`],
          [15, `先不看文本听 L${unit.start} 音频，再通读《${unit.title}》；核对谁做了什么以及结果。`],
          [10, `查最多 5 个妨碍理解的词，从本课选 3 个句子逐句跟读。`],
          [10, `写 3 条故事信息，只用关键词复述；遇到“${unit.focus}”造成的理解障碍，查本课讲义或主课文讲解。`],
          [5, `合上书说出大意，记下一个明天要解决的句子。`]
        ]),
      day(n+2, `L${unit.start} · 拆句、练习、迁移`, lesson,
        `分析本课 2 个相关例句，独立做教材对应语法/句型练习前 5 小题（不足则做完），改写 3 句。`,
        `能解释本课“${unit.focus}”的例子，并把表达用于自己的情境。`, [
          [5, `不看原文说回《${unit.title}》的 3 条主要信息。`],
          [15, `查 L${unit.start} 讲义/主课文语法讲解中的“${unit.focus}”；暂停写一个例子，到点停止。`],
          [10, `从本课找 2 句对应例句，标出主干或变化部分，再各说 1 个意思相近的新例句。`],
          [10, `独立完成 L${unit.start} 教材对应语法/句型练习前 5 小题（不足则做完），核对后写出错因。`],
          [5, `为“${unit.canDo}”写 3 句自己的表达，标出一处使用本课结构的地方。`]
        ]),
      day(n+3, `L${unit.start} · 复述与书面作品`, lesson,
        `完成 L${unit.start} 的复述录音和本课书面任务；长作文先完成草稿，记明续写位置，复盘周修改。`,
        unit.canDo, [
          [5, `回看 L${unit.start} 的错因，用正确句重说一次，不重新通看视频。`],
          [10, `${oral(unit)} 用手机或电脑录音，只看关键词。`],
          [10, `打开 L${unit.start} 的书面题目，圈出需回答的要点、字数和连接要求；按这些要求写提纲。`],
          [15, `${written(unit)} 较长任务先完成草稿，未写完时记下下一句要写什么。`],
          [5, `完成自查：${unit.check} 对照原文和题目修正一处事实或语法问题。`]
        ])
    ];
  });
}

function studyWeek(phase, slot, units) {
  const isFirst=phase.book==='book1';
  return {
    ...slot, phaseId:phase.id, book:phase.book,
    title:units.map(unit=>unit.title).join(' / '),
    learn:units.map(unit=>`${named(unit)}：${unit.focus}`),
    finish:`${isFirst?'第一册':'第二册'}学到 L${units.at(-1).end}：完成本周${isFirst?'两对课的课文听读、偶数课句型':'两课的故事理解、语法练习'}和两份口头/书面输出；视频只按疑点选看。`,
    canDo:units.map(unit=>`${range(unit.start,unit.end)}：${unit.canDo}`),
    deliverable:`${units.map(unit=>`《${unit.title}》`).join('、')}各留 1 段录音和 1 份书面作业；记清未完成练习和待改问题。`,
    passCriteria:units.map(unit=>`${range(unit.start,unit.end)}：${unit.check}`).join(' '),
    resourceIds:phase.resourceIds,
    days:isFirst?book1Days(units):book2Days(units)
  };
}

function reviewWeek(phase, slot, units) {
  const book=phase.book==='book1'?'第一册':'第二册';
  const chunks=Array.from({length:3},(_,i)=>units.slice(i*units.length/3,(i+1)*units.length/3));
  const samples=[units[0],units[Math.floor(units.length/2)],units.at(-1)];
  const completePhase=slot.week===phase.weekEnd;
  const rangeLabel=`${book} ${range(units[0].start,units.at(-1).end)}`;
  const oralTarget=completePhase?phase.outcomes.find(item=>item.skill==='开口').text:oral(samples[1]);
  const writingTarget=completePhase?phase.outcomes.find(item=>item.skill==='写出').text:written(samples[2]);
  const days=chunks.map((chunk,index)=> {
    const names=chunk.map(named).join('、'), first=chunk[0], last=chunk.at(-1);
    return day(index+1,`${range(first.start,last.end)} · 定向回顾`,`${book} ${range(first.start,last.end)}`,
      `回顾 ${names}；闭卷抽答 6 个表达，重做其中 5 道错题，留下仍不熟的 2 项。`,
      `能重新完成：${last.canDo}`, [
        [5, `看课号回忆 ${names} 各讲什么，暂不翻课文。`],
        [10, `听《${first.title}》和《${last.title}》各 1 遍，每篇写 3 条信息，再对照原文。`],
        [15, `从 ${range(first.start,last.end)} 的错题中选 5 题重做；围绕“${first.focus} / ${last.focus}”只补一个最弱疑点。`],
        [10, `从这几课各取句子，凑 6 个提示闭卷说回；再练一次：${last.speaking}`],
        [5, `记录答对数与两个难点，注明课号，留给第 6 天重新抽查。`]
      ]);
  });
  days.push(
    day(4,'口语作品 · 从提示到独立表达',rangeLabel,
      '保存一份本段口语录音和一次重录；只看关键词，不照着完整原稿念。',oralTarget,[
        [5,`回忆前 3 天记录的难点各一个。`],
        [10,`回听《${samples[0].title}》与《${samples[1].title}》相关片段，选出 3 个可用于本次表达的句子。`],
        [10,`为本次输出写关键词提纲：${oralTarget}`],
        [15,`用手机或电脑录音完成上述输出，回听并对照教材检查；修改后重录一次。`],
        [5,`标记自己能独立说出的 3 句和仍卡住的 1 处。`]
      ]),
    day(5,'书面作品 · 补完并修改',rangeLabel,
      '把本周选定书面任务写完整，保留修改前后版本，并列出 3 处修改原因。',writingTarget,[
        [5,`回忆“${samples[2].focus}”的一个例句。`],
        [10,`读回《${samples[2].title}》及本段未完成稿，核对本次任务：${writingTarget}`],
        [15,`完成或续写上述作品；若本周教学日留下未完成稿，优先把这份稿写到结尾。`],
        [10,`核对事实、句型、时间词与题目要求，改正至少 3 处可改进的表达；无错误则改写 3 句。`],
        [5,`记录 3 处修改原因，保存原稿与修改稿。`]
      ]),
    day(6,'周末自查 · 决定继续还是补练',rangeLabel,
      '留下 10 项抽查结果、1 次口头复查和修改稿；未通过的项目注明课号，下一学习日先补。',
      completePhase?phase.achievement:`能独立复用 ${rangeLabel} 的重点表达，并说清自己的薄弱项。`,[
        [10,`从 ${rangeLabel} 抽 10 项表达或句型闭卷作答，核对并记下正确数。`],
        [10,`不看原文重说《${samples[0].title}》与《${samples[2].title}》的主要信息。`],
        [10,`只看关键词再完成第 4 天口语任务中的核心一段。`],
        [10,`重读第 5 天修改稿，检查是否完成题目要求；重做前 3 天仍错的题。`],
        [5,`抽查达到 8/10 且本周口头、书面作品均能独立完成，再推进；否则记下课号，先用下一学习日补练。`]
      ])
  );
  return {
    ...slot,phaseId:phase.id,book:phase.book,title:`${rangeLabel} · 把本段内容练成自己的表达`,
    learn:chunks.map(chunk=>`${range(chunk[0].start,chunk.at(-1).end)}：${chunk.map(unit=>unit.title).join(' / ')}`),
    finish:`停在 ${rangeLabel}，本周不开新课；补完选定作品，处理错题并完成 10 项抽查。`,
    canDo:[oralTarget,writingTarget],
    deliverable:'一份口语录音及重录、一份书面原稿及修改稿、一张 10 项自查记录。',
    passCriteria:`抽查至少答对 8/10，能独立完成本周口头和书面任务。${completePhase?phase.passCriteria:'未通过时先补对应课号，再进入下一教学周。'}`,
    resourceIds:phase.resourceIds,days
  };
}

function introductoryWeeks(phase, firstWeek) {
  const week1=firstWeek.map((item,index)=>({
    ...item,day:index+1,
    lessons:['第一册 L1 + 发音 01、02','第一册 L1 + 字母发音','第一册 L2','第一册 L3–4','第一册 L1、L3 + 重音','第一册 L1–4 回顾'][index],
    done:[
      '听读完 L1，选 2 个表达，记下固定学习时段；发音片段只选两个元音。',
      '练完姓名相关字母读音与 L1 三句跟读，写 2 句个人信息。',
      '完成 L2 的 5 次替换，独立说 4 轮问答，并写出其中 2 轮。',
      '预听 L3、做 L4 的简单替换，留下 2–3 个自己的句子。',
      '回听 L1、L3，完成约 20 秒自我介绍和 3–4 句介绍文字。',
      '闭卷回忆 5 个本周表达，重做错题，列出第 2 周要补的两个难点。'
    ][index],
    outcome:[
      '能辨认 L1 的基本招呼，并说出两个常用表达。',
      '能拼读自己的姓名，并用学过的表达介绍自己。',
      '能把 L2 的例句替换成自己手边的物品。',
      '能用 L3–4 的表达做简单物品确认。',
      '能借助关键词做一段很短的个人介绍。',
      '能不照抄课文，复用本周的招呼与简单问答。'
    ][index]
  }));
  const week2=[
    day(1,'L1 · 隔天回忆与发音修正','第一册 L1', '不看原文说回 L1 两个表达，纠正自己录音中最不清楚的一个音。','能听出并模仿本周选定的发音区别。',[[5,'回忆第 1 周列出的两个难点。'],[15,'音标 01、02 仅回看与自己难点有关的片段，听辨并模仿。'],[10,'听 L1 音频，对照文本选 3 句跟读。'],[10,'角色互换说 L1 的问答，用手机或电脑录下并重录最不清楚的一句。'],[5,'合上书说出两个表达，记录发音改进点。']]),
    day(2,'L2 · 换物品继续问答','第一册 L2', '用身边 5 件物品做 5 次替换，再写 3 组问答。','能把 L2 句型用于不同的物品。',[[5,'回忆昨天 L1 的两个表达。'],[15,'看 L2 句型与偶数课音频，选前 5 个示例听读。'],[10,'用身边 5 件物品替换练习，每件先问后答。'],[10,'不看例句写 3 组问答，再对照教材。'],[5,'读回并修正一处单词或句型错误。']]),
    day(3,'L3 · 听清并做物品确认','第一册 L3', '听读 L3 全篇，记下 3 个物品确认表达并做角色互换。','能用 L3 的表达确认、回应物品相关信息。',[[5,'不看笔记回忆 L2 两组问答。'],[15,'先听 L3 一遍，再看课文核对每句话的意思。'],[10,'挑最难的 3 句逐句跟读，每句至少 3 次。'],[10,'分角色练 L3 对话，再换成自己的物品做问答。'],[5,'合上课文，写下 3 个确认或回应的表达。']]),
    day(4,'L4 · 口头替换与写句','第一册 L4', '做 5 次 L4 替换，写 3–4 句物品信息，修正上周留存错句。','能根据提示独立给出简单回答。',[[5,'回忆昨天 L3 的 3 个表达。'],[15,'看 L4 示例，听偶数课录音，读懂对应问答。'],[10,'遮住答案做 5 次替换，答不出再核对。'],[10,'写 3–4 句物品信息，并改正第 1 周留下的一个错句。'],[5,'读回自己的句子，记录还需要提示的一处。']]),
    day(5,'把姓名和招呼连成介绍','第一册 L1–4 + 口语 Book 1 Unit 1', '留下 20–30 秒自我介绍录音与 3–4 句个人介绍。','能借助姓名等关键词介绍自己并开始简单对话。',[[5,'抽取 L1–4 的 3 条表达回忆。'],[15,'查口语 Book 1 Unit 1 的自我介绍示例，音标第 21 或 24 个视频只按姓名读音/重音难点选看。'],[10,'写姓名等关键词提纲，不写完整中文逐句翻译。'],[10,'用手机或电脑录制 20–30 秒介绍，加入 3 轮简单问答。'],[5,'留下 3–4 句个人介绍并改正一处表达。']]),
    day(6,'起步自查 · 准备正式学习','第一册 L1–4', '隔天完成 3 轮问答，回听介绍并重录一句；把未熟发音带到第 3 周。','能离开完整例句完成招呼、介绍与简单确认。',[[10,'不看课文听 L1、L3，各说出对话在做什么。'],[10,'从 L2、L4 抽取 5 项提示口头作答。'],[10,'只看关键词再说一遍自我介绍和 3 轮问答。'],[10,'核对自己的介绍文字，改正一处错误，再重录最不清楚的一句。'],[5,'写好第 3 周开始的课号 L1–4 与自己还需补的一个音；无需等全部音标学完。']])
  ];
  return phase.schedule.map((slot,index)=>({
    ...slot,phaseId:phase.id,book:phase.book,
    title:index?'L1–4 再练 · 独立介绍与问答':'L1–4 预接触 · 发音、招呼与物品确认',
    learn:index?['L1、L3：听辨与角色问答','L2、L4：换成身边物品进行替换','姓名与重音：20–30 秒个人介绍']:['发音片段：元音、姓名相关字母、重音','L1–2：听读招呼、做句型替换','L3–4：听读与简单物品确认'],
    finish:index?'完成 L1–4 的起步复练和自我介绍，下一周从 L1–4 正式按教材学习。':'预接触到 L4；只做本周指定示例，发音按难点选练，不要求学完全部音标。',
    canDo:index?phase.outcomes.map(item=>item.text):['说出学过的招呼，用自己的物品做简单问答。','借助关键词做约 20 秒自我介绍，写 3–4 句个人信息。'],
    deliverable:'一段个人介绍录音、3–4 句介绍文字，以及带课号的发音/句型难点清单。',
    passCriteria:index?phase.passCriteria:'回忆本周 5 条表达，至少独立说回 3 条；完成约 20 秒介绍。没熟的表达列入第 2 周复练。',
    resourceIds:[...new Set([...phase.resourceIds,'b1-drill-audio','b1-handout','b1-video'])],days:index?week2:week1
  }));
}

function bridgeWeeks(phase, book1, book2) {
  const targets=[book1.units[2],book1.units[15],book1.units[27],book1.units[42],book1.units[49],book1.units[68]];
  const days45=targets.map((unit,index)=>day(index+1,`${range(unit.start,unit.end)} · ${unit.canDo}`,`第一册 ${named(unit)}`,
    `复查 ${named(unit)}，留下 3 个迁移例句；${index===5?'完成约 90 秒综合表达与一份 60–80 词生活短文。':'记下一处薄弱点，修改一条自己的表达。'}`,
    index===5?'能把自己的现在、过去和计划连起来表达。':unit.canDo,[
      [5,'回忆上一学习日的 3 个表达；本周首日先列出一册最容易卡住的两个情境。'],
      [10,`听读 ${named(unit)}，围绕“${unit.focus}”找 3 个例句。`],
      [10,`${unit.speaking} 不熟时只查对应句子与讲义。`],
      [15,index===5?'用手机或电脑完成约 90 秒个人经历录音，把本周生活短文整理成 60–80 词；暂不完整的部分记录续写位置。':`用本课表达写 3 句自己的生活经历，逐日积累成一篇 60–80 词短文；核对句型并改错。`],
      [5,index===5?'检查是否能只看关键词讲个人经历、完成生活短文；未完成时先补，再进行二册导学。':`记录 ${range(unit.start,unit.end)} 的一个难点和一句修改后的表达。`]
    ]));
  const first=book2.units[0];
  const days46=[
    day(1,'认识二册的课文与作业位置','第二册导学 + L1', '定位 L1 课文、摘要与练习，把摘要题的具体要求抄成一张任务清单。','知道二册每课的听读、复述、摘要任务在哪里。',[[5,'回忆第 45 周的一个薄弱项。'],[15,'看第二册导学前 15 分钟，记下教材结构，到点暂停。'],[10,`翻到 L1《${first.title}》，定位课文、摘要与课后练习，不提前看答案。`],[10,'在笔记列出 L1 摘要题要回答什么、字数与连接要求。'],[5,'写清正式学习 L1 时要提交的录音和书面作业。']]),
    day(2,'L1 预听 · 只抓主要事件','第二册 L1 预听', '听 L1 两遍，记录人物、地点和一件发生的事，再对照课文核对。','能尝试从故事录音中抓信息，不逐词翻译。',[[5,'看 L1 标题预测场景。'],[10,'不看文本听 L1 两遍，记听到的词。'],[15,'通读 L1 核对人物、地点和事件，只查最多 5 个妨碍理解的词。'],[10,'用 3 个关键词说故事大意，允许简单句。'],[5,'写下仍没听清的一句，留给下一次。']]),
    day(3,'一册句型过渡到二册句子','第一册句型回顾 + 第二册 L1', '从 L1 找 2 个例句标主干，改写为 3 句自己的经历。','能分清句子里谁做了什么。',[[5,'回忆昨天 L1 的三条信息。'],[15,`查 L1 讲义中“${first.focus}”的基础部分，遇到一册旧知识只回查对应笔记。`],[10,'选择 L1 两句简单例句，圈主语、动词与补充信息。'],[10,'用相同结构写 3 句自己的生活经历并读回。'],[5,'核对语序，改正其中一处问题。']]),
    day(4,'练习只看关键词复述','第二册 L1 预练', '用 3–5 个关键词留一段简短复述录音，核对至少 3 条主要信息。','能离开全文用自己的简单句说大意。',[[5,'回忆 L1 的主要人物和事件。'],[10,'听 L1 一遍，核对前面记录的信息。'],[10,'写 3–5 个关键词提纲，不抄整段。'],[15,'只看关键词，用手机或电脑录音，再对照原文改一处事实错误并重说。'],[5,'记录还必须看原文才能说的地方。']]),
    day(5,'预练摘要 · 从题目到短文','第二册 L1 摘要预练', '按 L1 摘要问题写一份草稿，并按本课题目核对字数和要点。','能把问题答案连成一个短段落。',[[5,'说回 L1 三条主要信息。'],[10,'重新读 L1 摘要题，逐项列要点。'],[15,'不用完整原文，先回答要点，再将答案连成草稿。'],[10,'对照题目检查事实、字数、连接方式，修改一处。'],[5,'保存预练稿，标清 L1，供第 47 周对比。']]),
    day(6,'衔接自查 · 从预练转入正式课次','一册回顾 + 二册 L1', '复查一册生活表达和 L1 预练稿，列明正式学习第一周为二册 L1–2。','知道如何独立走完听读、抓信息、复述和书面任务。',[[10,'听两段第 45 周复查过的一册录音，各说出至少 3 条信息。'],[10,'只看关键词讲约 90 秒自己的经历。'],[10,'读回生活短文和 L1 摘要预练稿，各改正一处表达。'],[10,'说出二册每课需要完成的任务，并选好 L1–2 教材、音频和讲义。'],[5,'仍依赖逐字翻译时记清要补的课号；能独立完成则第 47 周进入 L1–2 正式学习。']])
  ];
  return phase.schedule.map((slot,index)=>({
    ...slot,phaseId:phase.id,book:phase.book,
    title:index?'二册 L1 预练 · 熟悉听读、复述、摘要流程':'一册综合复查 · 把句型用回自己的生活',
    learn:index?[`L1《${first.title}》预听与简单句主干`,'定位并预练 L1 摘要题','一册听说写自查，准备二册 L1–2']:targets.map(unit=>`${named(unit)}：${unit.focus}`),
    finish:index?'预练到二册 L1，不提前赶 L2；下周正式学习二册 L1–2。':'复查一册所列 6 对课，不重看全套视频；整理成约 90 秒表达与 60–80 词生活短文。',
    canDo:index?['按“先听、抓信息、复述、摘要”的顺序学习一篇故事。','只看关键词讲一册熟悉经历，知道自己的薄弱点。']:['从不同课次选句型，串起自己的现在、过去与计划。','把短句整理为 60–80 词生活短文并修改。'],
    deliverable:index?'L1 关键词提纲、预练录音、摘要草稿，以及二册正式学习材料清单。':'一份个人经历录音、一篇生活短文、6 对课的复查与错因笔记。',
    passCriteria:index?phase.passCriteria:'不看完整原稿讲约 90 秒个人经历，完成 60–80 词生活短文；未完成的输出先补完再进入下一周。',
    resourceIds:index?[...phase.resourceIds,'b2-handout']:[...phase.resourceIds,'b1-handout'],days:index?days46:days45
  }));
}

export function buildWeeks({phases,firstWeek,book1,book2}) {
  for(const [catalog,book,count,stride] of [[book1,'book1',72,2],[book2,'book2',96,1]]) {
    if(catalog.book!==book || !Array.isArray(catalog.units) || catalog.units.length!==count) throw Error(`${book} 课目数不完整`);
    catalog.units.forEach((unit,index)=> {
      if(unit.start!==index*stride+1 || unit.end!==(index+1)*stride) throw Error(`${book} 课号不连续`);
      if(['title','focus','canDo','speaking','writing','check'].some(key=>typeof unit[key]!=='string' || !unit[key].trim())) throw Error(`${book} L${unit.start} 课目字段缺失`);
    });
  }
  const weeks=[];
  for(const phase of phases) {
    if(phase.id==='start') { weeks.push(...introductoryWeeks(phase,firstWeek)); continue; }
    if(phase.id==='bridge') { weeks.push(...bridgeWeeks(phase,book1,book2)); continue; }
    const catalog=phase.book==='book1'?book1.units:book2.units;
    for(const slot of phase.schedule) {
      const match=/L(\d+)–(\d+)/.exec(slot.lessons);
      if(!match) throw Error(`无法识别第 ${slot.week} 周课号：${slot.lessons}`);
      const from=Number(match[1]),to=Number(match[2]);
      const units=catalog.filter(unit=>unit.start>=from && unit.end<=to);
      if(slot.kind==='学习' && units.length!==2) throw Error(`第 ${slot.week} 周需要两组具体课目`);
      weeks.push(slot.kind==='复盘'?reviewWeek(phase,slot,units):studyWeek(phase,slot,units));
    }
  }
  return weeks;
}
