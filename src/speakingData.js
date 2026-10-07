// Eiken Pre-1 speaking practice sets (interview questions No. 2–4).
// Reading passages are original short summaries of recent news; `links` point to the full articles.

export const SPEAKING_USEFUL_PHRASES = [
  { label: "Opening", phrases: ["Yes, I think so.", "No, I don't think so.", "I strongly believe that…"] },
  { label: "Adding reasons", phrases: ["First…", "Second…", "In addition…", "Also…"] },
  { label: "Giving examples", phrases: ["For example…", "A survey found that…", "In Japan, …"] },
  { label: "Contrasting", phrases: ["However…", "Instead of…, I think…"] },
  { label: "Concluding", phrases: ["For these reasons…", "That's why…", "So I believe…"] },
];

export const SPEAKING_SETS = [
  {
    id: "sp_work_hours",
    qNo: 2,
    emoji: "🕒",
    topic: "Working hours in Japan",
    headline: "Japan Loosens Its Overtime Rules",
    intro: [
      "Japan has changed the way it oversees overtime work. The new rule took effect on September 1, 2026, and is meant to help the economy grow. Critics, however, see it as a return to Japan's deep-rooted workaholic culture. The change follows a growth strategy adopted in July by the government of Prime Minister Sanae Takaichi, who describes herself as a workaholic. The strategy called for revising how working hours are monitored.",
      "The background matters. Work-style reform laws passed in June 2018 aimed to cut excessive working hours, and in general they limited overtime to 45 hours a month and 360 hours a year. Around 40 percent of Japanese businesses, however, have special labor-management agreements that legally allow up to 100 hours of overtime a month. Authorities still advised these companies to stay under 45 hours, and that advice was treated almost like a law. Under the new rule, labor inspectors will stop pushing these businesses to keep to the 45-hour limit.",
    ],
    positive: [
      "Some industries wanted more flexible working styles because they are struggling with a growing labor shortage. A survey by the Japan Chamber of Commerce and Industry found that the 45-hour pressure was limiting about 20 percent of small and mid-sized companies, especially in construction, transport and hospitality, where staff are hard to find.",
    ],
    negative: [
      "Critics argue the change undoes Japan's efforts to modernize a business culture built around extremely long hours. Zenroren, a national union group, called it an unacceptable abandonment of the policy of shortening work hours. Overwork has had deadly consequences. Earlier cases were officially recognized as work accidents caused by overwork, which led the public to demand reform of Japan's long-hours culture.",
      "Not all workers want to work more, either. In one survey, 59.5% said their current working hours were fine, and 30% said they wanted to work fewer hours.",
    ],
    vocab: [
      { en: "overtime", meaning: "work done beyond normal working hours", jp: "残業" },
      { en: "regulation", meaning: "an official rule", jp: "規制" },
      { en: "deregulation", meaning: "removing or loosening official rules", jp: "規制緩和" },
      { en: "workaholic", meaning: "a person who works far too much", jp: "仕事中毒の人" },
      { en: "ingrained", meaning: "deeply fixed and hard to change", jp: "根深い" },
      { en: "relapse", meaning: "going back to a bad old condition", jp: "逆戻り" },
      { en: "labor shortage", meaning: "not enough workers available", jp: "人手不足" },
      { en: "statutory", meaning: "decided by law", jp: "法定の" },
      { en: "cap (v./n.)", meaning: "to put an upper limit on; an upper limit", jp: "上限(を設ける)" },
      { en: "karoshi / death from overwork", meaning: "death caused by working too much", jp: "過労死" },
      { en: "productivity", meaning: "how much is produced compared to time or effort", jp: "生産性" },
    ],
    keyTakeaways: [
      "Japan's 2018 reforms set a general overtime limit of 45 hours/month.",
      "From September 2026, inspectors no longer push companies with special agreements to keep to that limit.",
      "For: helps short-staffed industries, gives businesses flexibility, and may support economic growth.",
      "Against: risks a return to overwork, health problems and karoshi, and goes against what many workers want.",
      "Most workers surveyed are happy with their current hours or want fewer hours.",
    ],
    links: [
      { label: "AFP via SCMP", url: "https://www.scmp.com/news/asia/east-asia/article/3365948/japan-relaxes-overtime-rules-under-workaholic-takaichi-unacceptable-shift" },
      { label: "AFP via Courthouse News", url: "https://www.courthousenews.com/japan-to-relax-overtime-regulation-under-workaholic-pm/" },
      { label: "Jiji Press (background on 2018 reform)", url: "https://english.adnkronos.com/2026/03/25/focus-japans-work-style-reform-faces-concerns-over-backsliding/" },
    ],
    question: "Should the number of weekly working hours in Japan be decreased?",
    yes: {
      keywords: [
        "damage physical and mental health",
        "karoshi (death from overwork)",
        "2018 work-style reforms",
        "many workers are satisfied / want to work less",
        "time with family and proper rest",
        "improve productivity",
      ],
      model: "Yes, I think so. Working long hours can seriously damage people's physical and mental health. In Japan, there have been tragic cases of karoshi, or death from overwork, and these cases led to the 2018 work-style reforms. Also, surveys show that many workers are satisfied with their current hours, and some even want to work less. If people had shorter working weeks, they could spend more time with their families and rest properly, which would actually improve their productivity. So I believe working hours should be reduced.",
    },
    no: {
      keywords: [
        "serious labor shortage",
        "aging population",
        "construction, transport, hospitality",
        "small companies might not survive",
        "improve efficiency instead",
        "protect workers' health in other ways",
      ],
      model: "No, I don't think so. Japan is facing a serious labor shortage because of its aging population. Industries such as construction, transport and hospitality already don't have enough staff, and strict limits on working hours make it even harder for these businesses to operate. If working hours were decreased further, some small companies might not survive. Instead of simply cutting hours, I think companies should focus on improving efficiency and protecting workers' health in other ways.",
    },
  },
  {
    id: "sp_ai_lives",
    qNo: 3,
    emoji: "🤖",
    topic: "AI and our lives",
    headline: "Can AI Help a Shrinking Japan?",
    intro: [
      "Japan's population is getting older and smaller, and companies are turning to technology to fill the gap. Japan's population has fallen for 14 years in a row, and its working-age population is expected to drop by almost 15 million over the next 20 years. Because of labor shortages, Japanese firms are moving toward automation and AI, especially in logistics, manufacturing and healthcare.",
      "The OECD, an international organization, published a report on AI and work in Japan in April 2026. It found that AI-related job loss may be less common in Japan than in other countries because of Japan's long-term employment practices and ongoing labor shortages caused by demographic change. Many Japanese AI users, including women, younger workers and people balancing work with caregiving, expect AI to both create and destroy jobs, but most believe it will create more jobs than it removes.",
    ],
    positive: [
      "AI and robots can do work that people cannot or do not want to do. The government hopes AI can help fill vacant jobs, especially in construction and healthcare, where worker safety is a concern.",
    ],
    negative: [
      "There are still serious problems. The OECD notes that companies lack staff with basic AI knowledge, employees lack the skills to use AI in their work, and there are worries about AI's safety, trustworthiness and transparency. The future may also be less positive than today suggests. Japan's AI use is still low compared with other countries, but many workers expect it to grow over the next ten years, which could eventually lead to more job losses.",
    ],
    vocab: [
      { en: "automation", meaning: "using machines to do work without people", jp: "自動化" },
      { en: "demographic", meaning: "related to population (age, birth rate, etc.)", jp: "人口統計の" },
      { en: "working-age population", meaning: "people of the age to work (about 15–64)", jp: "生産年齢人口" },
      { en: "logistics", meaning: "moving and delivering goods", jp: "物流" },
      { en: "adoption", meaning: "starting to use something new", jp: "導入" },
      { en: "displacement", meaning: "losing one's job to something else", jp: "(雇用の)置き換え" },
      { en: "reskilling / upskilling", meaning: "learning new skills / improving skills", jp: "リスキリング" },
      { en: "transparency", meaning: "being clear and open about how something works", jp: "透明性" },
      { en: "trustworthiness", meaning: "being reliable and believable", jp: "信頼性" },
      { en: "mitigate", meaning: "to make something less harmful", jp: "軽減する" },
    ],
    keyTakeaways: [
      "Japan's shrinking workforce makes AI and robots look like a solution rather than a threat.",
      "The OECD says AI job loss is less common in Japan than elsewhere for now.",
      "For: fills labor shortages, takes over dangerous work, and may create new jobs.",
      "Against: skill gaps, safety and trust concerns, and possible job losses as AI use grows.",
      "The key issue is whether workers get the training to work alongside AI.",
    ],
    links: [
      { label: "OECD report, Artificial Intelligence and the Labour Market in Japan (April 2026)", url: "https://www.oecd.org/en/publications/artificial-intelligence-and-the-labour-market-in-japan_b825563e-en.html" },
      { label: "OECD chapter on jobs and skills", url: "https://www.oecd.org/en/publications/artificial-intelligence-and-the-labour-market-in-japan_b825563e-en/full-report/preparing-for-the-impact-of-ai-on-job-quantity-and-skills-needs_28862d25.html" },
    ],
    question: "Do you think that new technology, such as AI, will make our lives better?",
    yes: {
      keywords: [
        "shrinking population / labor shortage",
        "dangerous or difficult tasks",
        "construction and healthcare",
        "more creative and meaningful work",
        "OECD: creates more jobs than it destroys",
      ],
      model: "Yes, I do. Japan's population is shrinking, and there are not enough workers in many industries. AI and robots can take over tasks that are dangerous or difficult for people, for example in construction and healthcare. This allows human workers to focus on more creative and meaningful work. In addition, an OECD report found that many Japanese workers believe AI will create more jobs than it destroys. For these reasons, I think AI will make our lives better.",
    },
    no: {
      keywords: [
        "workers lack AI skills",
        "lose their jobs / fall behind",
        "safety and transparency concerns",
        "incorrect information",
        "trust it too much",
        "training and clear rules",
      ],
      model: "No, I don't think it will necessarily make our lives better. First, many workers don't have the skills to use AI, so they may lose their jobs or fall behind. Second, there are still serious concerns about AI's safety and transparency. For example, AI sometimes gives incorrect information, and people may trust it too much. Unless governments provide proper training and clear rules, AI could create more problems than it solves.",
    },
  },
  {
    id: "sp_smartphones",
    qNo: 4,
    emoji: "📱",
    topic: "Smartphone dependence",
    headline: "A Japanese City Asks Residents to Put Down Their Phones",
    intro: [
      "In September 2025, the city assembly of Toyoake in Aichi Prefecture passed an ordinance asking people to use smartphones and tablets for no more than two hours a day outside work or study. It passed by 12 votes to 7 and took effect on October 1. Toyoake was the first city in Japan to ask all of its residents to limit their smartphone use.",
      "The city worries that using devices late at night harms people's physical and mental health by keeping them from getting enough sleep. The ordinance asks elementary school children to stop using smartphones after 9 p.m. and junior high students and older to stop after 10 p.m. It is only guidance, has no penalties, and does not cover study, work or housework.",
    ],
    positive: [
      "Supporters point out that overusing video streaming can lead to sleep deprivation and less family interaction. The ordinance is also meant to encourage more conversation within families. The problem is real for young people: a March survey by the Children and Families Agency found that Japanese youth spend just over five hours online on weekdays.",
    ],
    negative: [
      "Many people disagreed. Online, some said a two-hour limit was impossible, others said two hours isn't even enough to read a book or watch a movie, and some argued that families should decide for themselves. The mayor responded that the limit is not mandatory and that the city sees smartphones as useful and essential in daily life.",
    ],
    vocab: [
      { en: "ordinance", meaning: "a law made by a city or town", jp: "条例" },
      { en: "municipal assembly", meaning: "a city council", jp: "市議会" },
      { en: "excessive", meaning: "too much", jp: "過度の" },
      { en: "sleep deprivation", meaning: "not getting enough sleep", jp: "睡眠不足" },
      { en: "adversely", meaning: "in a harmful way", jp: "悪影響を及ぼすように" },
      { en: "penalty", meaning: "punishment for breaking a rule", jp: "罰則" },
      { en: "mandatory", meaning: "required, compulsory", jp: "義務的な" },
      { en: "indispensable", meaning: "absolutely necessary", jp: "不可欠な" },
      { en: "guardian", meaning: "a parent or person responsible for a child", jp: "保護者" },
      { en: "refrain from", meaning: "to stop yourself from doing something", jp: "〜を控える" },
      { en: "addiction", meaning: "being unable to stop doing something", jp: "依存症" },
    ],
    keyTakeaways: [
      "Toyoake was the first city in Japan to ask all residents to limit leisure screen time to 2 hours a day.",
      "It is a guideline only, with no penalties, and work, study and chores are excluded.",
      "For: better sleep, better health and more family conversation.",
      "Against: unrealistic, smartphones are essential, and usage should be a personal or family decision.",
      "Young people in Japan spend 5+ hours online on weekdays.",
    ],
    links: [
      { label: "The Japan News / Yomiuri (via Asia News Network)", url: "https://asianews.network/japans-aichi-passes-ordinance-to-cap-daily-smartphone-use-at-2-hours" },
      { label: "Jiji Press", url: "https://english.adnkronos.com/2025/09/22/japan-city-passes-ordinance-capping-screen-time-to-2-hours/" },
      { label: "The Sun (public reactions)", url: "https://thesun.my/world-news/news-world-news-japanese-city-proposes-two-hour-daily-smartphone-guideline-ek14781544/" },
    ],
    question: "Do people today rely too much on their mobile devices such as smartphones?",
    yes: {
      keywords: [
        "sleep deprivation",
        "physical and mental health",
        "5+ hours online on weekdays",
        "family members talk less",
        "Toyoake's two-hour guideline",
        "a real social problem",
      ],
      model: "Yes, I think they do. Many people, especially young people, use their smartphones late at night, and this causes sleep deprivation, which affects both their physical and mental health. A survey found that young people in Japan spend more than five hours online on weekdays. Also, when family members are always looking at their phones, they talk to each other less. That's why the city of Toyoake even asked residents to limit their leisure smartphone use to two hours a day. I think this shows that smartphone dependence has become a real social problem.",
    },
    no: {
      keywords: [
        "indispensable tools",
        "work, studying, banking, contact with family",
        "each person or family should decide",
        "two-hour limit is unrealistic",
        "use smartphones wisely, not less",
      ],
      model: "No, I don't think so. Smartphones have become indispensable tools in our daily lives. We use them for work, studying, banking, and staying in contact with family and friends, so using them for many hours is not necessarily a problem. Also, I think each person or family should decide how much to use their devices. A rule like a two-hour limit is unrealistic, because even watching one movie can take more than two hours. The important thing is to use smartphones wisely, not to use them less.",
    },
  },
];
