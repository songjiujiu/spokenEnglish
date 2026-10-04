// Original phrase examples supplement the user's textbook; they are not its audio.
function lessonForDay(week, day, catalog) {
  const match=/(第一册|第二册)\s+L(\d+)/.exec(day.lessons);
  let book=match?(match[1]==='第一册'?'book1':'book2'):week.book;
  let lesson=match?Number(match[2]):1;
  if (week.kind==='复盘' && day.day>=4) {
    const range=/L(\d+)–(\d+)/.exec(week.lessons);
    if (range) {
      const from=Number(range[1]),to=Number(range[2]);
      const list=catalog[book].filter(item=>item.start>=from && item.start<=to);
      lesson=(day.day===4?list[Math.floor(list.length/2)]:list.at(-1))?.start || from;
    }
  }
  const unit=catalog[book].find(item=>item.start===lesson || book==='book1' && item.start===lesson-1);
  if (!unit) throw Error(`今日句子找不到 ${book} L${lesson}（第 ${week.week} 周第 ${day.day} 天）`);
  return {book,lesson,unit};
}

function listenForDay(week, day, catalog, mapped) {
  const audio = (book, lessons, instruction, { optional=false, drill=false, title, resourceIds }={}) => ({
    title:title || `${optional?'可选回听：':''}${book==='book1'?'第一册':'第二册'} ${lessons.map(lesson=>`L${lesson}`).join('、')} ${drill?'句型录音':'课文录音'}`,
    instruction,
    resourceIds:resourceIds || [book==='book1'?(drill?'b1-drill-audio':'b1-audio'):'b2-audio'],
    lessons:lessons.map(lesson=>({book,lesson})),
    optional
  });
  const optional = (book, lessons, reason) => audio(book,lessons,
    `${reason}今天没有新增必听课文；需要核对表达时，可回听列出的课号或难句，不增加额外的必做听力。`,{optional:true});
  const unitsIn = lessons => {
    const match=/L(\d+)–(\d+)/.exec(lessons);
    if (!match) throw Error(`听力回顾范围不明确：第 ${week.week} 周第 ${day.day} 天`);
    return catalog[week.book].filter(unit=>unit.start>=Number(match[1]) && unit.start<=Number(match[2]));
  };

  if (week.kind==='起步') {
    if (week.week===1) {
      if (day.day===1) return audio('book1',[1],
        '音标 01、02 各选片段听辨两个元音，暂停模仿；L1 先不看文字听一遍，再对照课文听两遍，最后分角色读。',
        {title:'第一册 L1 课文录音 ＋ 发音 01、02 片段',resourceIds:['b1-audio','phonetics']});
      if (day.day===2) return audio('book1',[1],
        '音标第 21 个视频仅选与自己姓名有关的片段；L1 选三句，听一句、暂停、跟读一句。',
        {title:'第一册 L1 三句跟读 ＋ 姓名相关字母发音',resourceIds:['b1-audio','phonetics']});
      if (day.day===3) return audio('book1',[2],
        '按 L2 做 5 次替换，回听对应偶数课音频，注意问题与回答如何变化。',{drill:true});
      if (day.day===4) return audio('book1',[3],
        '预听 L3，再对照录音跟读，停在最难的一两句；随后按 L4 做简单替换问答。');
      if (day.day===5) return audio('book1',[1,3],
        'L1、L3 音频各听一遍，不看文本说出大意；音标第 24 个重音视频只选相关片段，回到本周句子模仿。',
        {title:'第一册 L1、L3 课文录音 ＋ 重音片段',resourceIds:['b1-audio','phonetics']});
      return audio('book1',[1,3],
        '从 L1、L3 任选一段本周对话，听写关键词；不要求两段都听，也不要求逐字听写。',
        {title:'第一册 L1 或 L3：任选一段回顾'});
    }
    if (day.day===1) return audio('book1',[1],
      '音标 01、02 仅回看与难点有关的片段；听 L1 音频，对照文本选 3 句跟读，再录下自己的问答。',
      {title:'第一册 L1 三句跟读 ＋ 发音难点片段',resourceIds:['b1-audio','phonetics']});
    if (day.day===2) return audio('book1',[2],
      '看 L2 句型并听偶数课录音，选前 5 个示例听读，再换成身边的物品问答。',{drill:true});
    if (day.day===3) return audio('book1',[3],
      '先听 L3 一遍，再看课文核对每句话的意思；挑最难的 3 句跟读，每句至少 3 次。');
    if (day.day===4) return audio('book1',[4],
      '看 L4 示例，听偶数课录音并读懂对应问答；随后遮住答案做 5 次替换。',{drill:true});
    if (day.day===5) return audio('book1',[],
      '今天查口语 Book 1 Unit 1 的介绍示例并准备自己的录音；只有遇到姓名读音或重音难点时，才选看音标第 21 或 24 个视频相关片段，无需新听课文。',
      {optional:true,title:'可选：姓名发音或重音片段（无新课文听力）',resourceIds:['phonetics','b1-speaking']});
    return audio('book1',[1,3],
      '不看课文听 L1、L3，各说出对话在做什么；之后回听自己的介绍录音，重录最不清楚的一句。');
  }

  if (week.kind==='衔接') {
    if (week.week===45) return audio('book1',[mapped.unit.start],
      `听读第一册 L${mapped.unit.start}，围绕本课重点找 3 个例句；随后按今日任务做口头迁移和生活短文。`);
    if (day.day===2) return audio('book2',[1],
      '不看文本听 L1 两遍，记听到的词；通读后核对人物、地点和事件，再用 3 个关键词说大意。');
    if (day.day===4) return audio('book2',[1],
      '听 L1 一遍，核对前面记录的信息；再写 3–5 个关键词，用自己的简单句复述并录音。');
    if (day.day===6) return audio('book1',[5,137],
      '回听第 45 周已复查过的一册 L5、L137 两段，各说出至少 3 条信息；随后只看关键词讲自己的经历。',
      {title:'第一册 L5、L137：衔接自查的两段录音'});
    if (day.day===1) return optional('book2',[1],'今天先看二册导学前 15 分钟，并定位 L1 课文、摘要和课后练习。');
    if (day.day===3) return optional('book2',[1],'今天分析 L1 句子主干，并改写自己的经历。');
    return optional('book2',[1],'今天按 L1 摘要题完成草稿，检查要点、字数与连接方式。');
  }

  if (week.kind==='复盘') {
    const units=unitsIn(day.day<=3?day.lessons:week.lessons);
    if (!units.length) throw Error(`听力回顾课号缺失：第 ${week.week} 周第 ${day.day} 天`);
    if (day.day<=3) return audio(week.book,[units[0].start,units.at(-1).start],
      '列出的两课各听 1 遍，每篇写 3 条信息，再对照原文核对；本日只补一个最弱疑点。');
    if (day.day===4) return audio(week.book,[units[0].start,units[Math.floor(units.length/2)].start],
      '回听列出两课的相关片段，选 3 个可用于本次口语作品的句子；随后写关键词提纲、录音并重录。');
    if (day.day===5) return optional(week.book,[units.at(-1).start],'今天读回本段末课和未完成稿，补完并修改书面作品。');
    return optional(week.book,[units[0].start,units.at(-1).start],
      '今天先不看原文重说本段首课、末课的主要信息，并复查口头和书面作品。');
  }

  if (week.kind==='学习') {
    const practiceDay=(day.day-1)%3+1;
    if (mapped.book==='book1') {
      if (practiceDay===1) return audio('book1',[mapped.unit.start],
        '先听本课音频 1 遍，再通读课文；从本课选 3 句，逐句暂停跟读，每句练 3 次。');
      if (practiceDay===2) return audio('book1',[mapped.unit.start+1],
        '看本偶数课的句型示例前 3 项，听对应句型录音并口头作答；不足 3 项则做完。',{drill:true});
      return optional('book1',[mapped.unit.start],
        '今天接着做偶数课剩余示例或练习册，并完成本组口语录音与书面作业。');
    }
    if (practiceDay===1) return audio('book2',[mapped.unit.start],
      '先不看文本听本课音频，核对谁做了什么以及结果；通读后选 3 个句子逐句跟读。');
    return optional('book2',[mapped.unit.start],practiceDay===2
      ?'今天拆解例句、做语法练习，并写 3 句自己的表达。'
      :'今天只看关键词复述并录音，再完成本课摘要或书面任务。');
  }
  throw Error(`今日听力未覆盖任务类型：第 ${week.week} 周第 ${day.day} 天 ${week.kind}`);
}

export function addTodayPlan(weeks, phraseMap) {
  for (const [book,count,stride] of [['book1',72,2],['book2',96,1]]) {
    if (!Array.isArray(phraseMap[book]) || phraseMap[book].length!==count) throw Error(`${book} 今日句子目录不完整`);
    phraseMap[book].forEach((item,index)=> {
      if (item.start!==index*stride+1 || !Array.isArray(item.phrases) || item.phrases.length!==3 || item.phrases.some(phrase=>typeof phrase.en!=='string' || !phrase.en.trim() || typeof phrase.zh!=='string' || !phrase.zh.trim())) throw Error(`${book} L${item.start} 今日三句不完整`);
    });
  }
  const introduction=[
    {en:'Hello. My name is Alex.',zh:'你好，我叫 Alex。'},
    {en:'I am from China.',zh:'我来自中国。'},
    {en:'Nice to meet you.',zh:'很高兴认识你。'}
  ];
  let previous=null;
  for (const week of weeks) for (const day of week.days) {
    const mapped=lessonForDay(week,day,phraseMap);
    const {unit}=mapped;
    const isIntro=week.week<=2 && day.day>=5;
    const phrases=(isIntro?introduction:unit.phrases).map(phrase=>({...phrase}));
    day.today={
      goal:day.outcome,
      listen:listenForDay(week,day,phraseMap,mapped),
      phrases,
      done:day.done,
      review:previous?`先回忆第 ${previous.week} 周第 ${previous.day} 天的三句表达，答不出再看提示。`:'开始前先看本课场景，认识今天要使用的物品或人物。'
    };
    previous={week:week.week,day:day.day};
  }
  return weeks;
}
