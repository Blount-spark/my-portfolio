// ============================================================
// 作品数据 —— 想上新作品 / 修改内容，只需要改这个文件
// 每条作品的字段说明见文件底部
// ============================================================

// 分类：可以随意增删，比如加一个「烘焙」「乐器」
export const CATEGORIES = [
  { id: 'all',     label: '全部',     emoji: '✨', color: '#6C5CE7' },
  { id: 'code',    label: '代码',     emoji: '💻', color: '#00B894' },
  { id: 'image',   label: '影像',     emoji: '📷', color: '#0984E3' },
  { id: 'writing', label: '写作',     emoji: '✍️', color: '#E17055' },
  { id: 'craft',   label: '手工',     emoji: '🧶', color: '#D63031' },
  { id: 'design',  label: '设计',     emoji: '🎨', color: '#FDCB6E' },
  { id: 'idea',    label: '奇思妙想', emoji: '🪄', color: '#E84393' },
]

export const WORKS = [
  {
    id: 1,
    title: 'Voice Agent',
    category: 'code',
    date: '2026-09',
    emoji: '🧾',
    gradient: ['#a8edea', '#fed6e3'],
    desc: '一个命令行工具，解析账单邮件自动生成月度开支报表，省掉每月对账的两小时。',
    tags: ['Python', 'Agent'],
    link: '#', // 如果代码开源，这里换成 GitHub 链接，详情页底部会出现「去外部平台看完整版」
    // ↓ 有 detail 字段 = 站内详情页（混合模式：详情写在自己站上）
    detail: {
      story: [
        '一直想做一个语音Agent秘书，能通过对话管理我的滴答清单和飞书，想体验一下当领导的感觉。',
        '第一天 v0.1 ：微信输入法长按Ctrl+Win说话，文本自动复制到剪切板，然后发送给codebuddy的CLI调用agent。冷启动很慢，很难用，也不是秘书的定位。',
        '第二天 v0.2 主要做了目录重构和配置解耦，主要是方便自己理解Agent的架构。',
        '第三天 v0.3 利用抢占 WorkBuddy 窗口当落点来实现微信输入法文本自动复制到剪切板。把TTS语音合成给抽象化了，方便后面接入不同的模型。但我意识到锚定特定输入法是很局限的，窗口焦点占用非常影响体验，因此这是该技术路线的最后一版。',
        '第四天 v0.4 彻底抛弃Wordbuddy+微信输入法。适配所有支持全局语音转文字、自动写入剪贴板的输入法。支持的工具调用为封装CLI的函数。能查时间，能统计token消耗了。',        
        '第六天 v0.5 ',
        '下一步想做。。。。。。。。',
      ],
      // gallery: ['/images/journal-1.png'], // 图片放到项目 public/images/ 文件夹，这里写路径；captions 数组可选，与之一一对应
    },
  },
  {
    id: 2,
    title: '城市漫步摄影集',
    category: 'image',
    date: '2026-07',
    emoji: '🌆',
    gradient: ['#89f7fe', '#66a6ff'],
    desc: '连续 30 天在城市里随机走一条路，拍下「差点错过」的角落，共 47 张。',
    tags: ['街拍', '胶片感'],
    link: '#',
  },
  {
    id: 3,
    title: '短篇小说《最后一次搬家》',
    category: 'writing',
    date: '2026-06',
    emoji: '📖',
    gradient: ['#ffecd2', '#fcb69f'],
    desc: '一个关于「家当越来越少的旅行」的寓言，发表于个人公众号，阅读量 2k+。',
    tags: ['小说', '公众号'],
    link: '#',
  },
  {
    id: 4,
    title: '毛线钩织小恐龙一家',
    category: 'craft',
    date: '2026-05',
    emoji: '🧶',
    gradient: ['#fbc2eb', '#a6c1ee'],
    desc: '从零自学钩织，第一套完整作品：五口之家，最难的是爸爸的墨镜。',
    tags: ['钩织', '自学'],
    link: '#',
    detail: {
      story: [
        '在视频平台刷到钩织教程的那个晚上，我给自己定了个看似合理的目标：给全家每人钩一只恐龙。',
        '实际执行：拆掉重钩了四次之后，终于掌握了「短针绕几圈」的手感。第一只霸王龙长得像土豆，但没人指出这一点。',
        '最难的是墨镜——那其实是一小片黑色毛线硬纸板，用别针固定，属于钩织界的「胶枪解决方案」。',
        '这套现在摆在客厅架子上，来客人都以为是买的。这就是手工的胜利。',
      ],
    },
  },
  {
    id: 5,
    title: '个人名片与 Logo 重设计',
    category: 'design',
    date: '2026-04',
    emoji: '🎯',
    gradient: ['#fdfbfb', '#ebedee'],
    desc: '给自己做的一整套视觉：把名字拆成笔画重新组合，印了 200 张烫金名片。',
    tags: ['品牌', '印刷'],
    link: '#',
  },
  {
    id: 6,
    title: '网页版「今天吃什么」转盘',
    category: 'code',
    date: '2026-03',
    emoji: '🎡',
    gradient: ['#d4fc79', '#96e6a1'],
    desc: '解决晚饭终极难题。可以自定义菜单、摇一摇抽签，朋友群里的常驻神器。',
    tags: ['前端', '小玩具'],
    link: '#',
  },
  {
    id: 7,
    title: '阳台堆肥实验记录',
    category: 'idea',
    date: '2026-02',
    emoji: '🪱',
    gradient: ['#c1dfc4', '#deecdd'],
    desc: '用垃圾桶+蚯蚓把厨余变成肥料，90 天图文记录，附失败复盘。',
    tags: ['实验', '生活'],
    link: '#',
  },
  {
    id: 8,
    title: '给爸妈做的相册排版',
    category: 'design',
    date: '2026-01',
    emoji: '📔',
    gradient: ['#fff1eb', '#ace0f9'],
    desc: '把家里十几年前的老照片扫描修复，按年份排成一本可以打印的相册。',
    tags: ['排版', '家人'],
    link: '#',
  },
  {
    id: 9,
    title: '一周极简早餐计划表',
    category: 'writing',
    date: '2025-12',
    emoji: '🍳',
    gradient: ['#f6d365', '#fda085'],
    desc: '把「吃什么、花多久、买什么」整理成一页纸，分享给同事后供不应求。',
    tags: ['生活', '模板'],
    link: '#',
  },
  {
    id: 10,
    title: '木作手机支架',
    category: 'craft',
    date: '2025-11',
    emoji: '🪵',
    gradient: ['#e6c9a8', '#f5e6c8'],
    desc: '一块废料松木、一把小手锯，周末两天。打磨了七遍，比想象中难。',
    tags: ['木工', '周末'],
    link: '#',
  },
  {
    id: 11,
    title: '旅行 vlog：一个人的短途',
    category: 'image',
    date: '2025-10',
    emoji: '🎬',
    gradient: ['#accbee', '#e7f0fd'],
    desc: '第一次独立剪辑的 6 分钟 vlog，练习镜头语言和节奏，片尾字幕做了两晚。',
    tags: ['剪辑', '旅行'],
    link: '#',
  },
  {
    id: 12,
    title: '「如果城市是个桌面」企划',
    category: 'idea',
    date: '2025-09',
    emoji: '🗺️',
    gradient: ['#fddb92', '#d1fdff'],
    desc: '一个还没做完的大胆想法：把城市地标做成可拖拽的桌面图标，欢迎合作。',
    tags: ['企划', '进行中'],
    link: '#',
  },
]

// 个人信息：改成你自己的
export const PROFILE = {
  name: 'Vivid',
  tagline: '一个想到什么就做什么的人，生命在流动的人',
  intro:
    '这里没有「垂直领域」……只要一个想法真的被我做出来了，它就会出现在这面墙上。作品不一定成熟，但都是真的动手。',
  email: 'you@example.com',
  links: [
    { label: 'GitHub', url: 'https://github.com/Blount-spark' },
    { label: '公众号', url: '#' },
    { label: '小红书', url: '#' },
    { label: '邮箱', url: 'mailto:you@example.com' },
  ],
}

// 字段说明（混合模式）：
// id       唯一编号
// title    作品名
// category 分类 id（需在 CATEGORIES 中存在，或先去上面加一个新分类）
// date     完成年月（YYYY-MM）
// emoji    卡片封面上的表情符号（也可以换成图片：加一个 img 字段）
// gradient 封面渐变色 [起, 止]
// desc     一两句简介：做了什么、花了多久、有什么有意思的细节
// tags     自由标签，1~3 个
// link     外部链接（GitHub / 文章 / 视频），暂无就写 '#'
// detail   可选！写了就有站内详情页（点卡片打开「制作手记」）：
//            story: ['段落1', '段落2', ...]      —— 过程记录，一段一个字符串
//            gallery: ['/images/a.png', ...]    —— 可选，图片放 public/images/
//            captions: ['图1说明', ...]          —— 可选，与 gallery 对应
//
// 三种搭配方式：
//   只有 link            → 卡片显示「看看去 →」，点了跳外部平台
//   只有 detail          → 卡片显示「查看详情 →」，站内看手记
//   detail + link 都有   → 站内看手记，页底再放「去外部平台看完整版 ↗」
