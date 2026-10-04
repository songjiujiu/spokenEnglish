# 初语｜今日学习

每天打开首页，按当前进度学一天。安排为每天 45 分钟、每周 6 天。

## 打开

- 本地服务：在项目目录运行 `npm run dev`，访问 http://127.0.0.1:8765 。
- 独立文件：双击 `初语_学习程序.html` 或 `两册学习路线与规划.html`。
- 静态部署：运行 `npm run build`，上传 `dist/index.html` 到站点目录。

## 怎么学

1. 查看今天的课号和当天目标。
2. 按提示听教材对应录音，再跟读。
3. 练习页面上的三句表达，替换成自己的信息。
4. 按完成标准自查，通过后点完成，再主动进入下一天。

首页可以展开 45 分钟的具体步骤。第六天完成后提示休息，再开始下一周；不会按日历自动跳课。浏览“完整周计划”不会改变今日进度，需要调整时可以主动定位到指定周、指定天。

三句表达为原创练习示例。“听句子”使用浏览器语音朗读；教材录音按资料路径自行打开。原教材仍位于 `D:\BaiduNetdiskDownload`，没有打包或上传。

## 完整路线

完整周计划保留全部 102 周、612 个学习日。每周写清课目、做到哪里、学完能做的事、作品与过关标准；每阶段展示听懂、开口、写出的成果。

2 周起步 + 第一册 42 周 + 2 周衔接 + 第二册 56 周，包含 14 个复盘周。第 7 天休息，长课或尚未掌握的内容可以顺延。

## 进度保存

今日位置与完成记录保存在当前浏览器的 `chuyu-today-v1` 数据中。不同设备、不同网址不会自动同步；清除浏览器数据会清除这份记录。旧版学习数据保留。无法保存时，当前页面仍可继续学习，并提示保存失败。

## 开发

- 页面：`src/book-plan.js`、`src/book-plan.css`。
- 进度规则：`src/today-progress.js`。
- 基础外观与入口：`src/styles.css`、`src/index.html`、`src/app.js`。
- 完整数据：`src/study-plan-data.json`；浏览器数据：`src/plan-data.js`。
- 生成入口：`scripts/make-study-plan.mjs`；周计划：`scripts/make-weekly-plan.mjs`；今日内容：`scripts/make-today-plan.mjs`。
- 逐课依据与原创表达：`planning/book1-lesson-map.json`、`planning/book2-lesson-map.json`、`planning/daily-phrase-map.json`。
- 修改规划后运行 `node scripts/make-study-plan.mjs`，再运行 `npm run build`。
- 进度规则测试：`npm test`。

构建生成两个独立 HTML 与静态部署文件 `dist/index.html`。旧版源码、说明与测试保存在 `archive/before-route-only/`。
