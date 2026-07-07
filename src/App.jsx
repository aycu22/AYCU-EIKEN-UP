import { useState, useEffect, useMemo, useRef } from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&family=Inter:wght@400;500;600&display=swap";
document.head.appendChild(fontLink);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Furigana({ kanji, kana, size = 24 }) {
  const showFuri = kanji !== kana;
  return (
    <ruby style={{ fontSize: size, fontWeight: 900, lineHeight: 2, rubyAlign: "center" }}>
      {kanji}
      {showFuri && <rt style={{ fontSize: size * 0.38, fontWeight: 700, color: "#888" }}>{kana}</rt>}
    </ruby>
  );
}

/* ── Text-to-speech ── */
function speak(text, rate = 0.85) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  u.pitch = 1.05;
  // Prefer a natural English voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang === "en-US" && v.localService) ||
                    voices.find(v => v.lang.startsWith("en"));
  if (preferred) u.voice = preferred;
  window.speechSynthesis.speak(u);
}

function SpeakBtn({ text, size = 32, rate }) {
  const [playing, setPlaying] = useState(false);
  const handleSpeak = (e) => {
    e.stopPropagation();
    setPlaying(true);
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate || 0.85;
    u.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === "en-US" && v.localService) ||
                      voices.find(v => v.lang.startsWith("en"));
    if (preferred) u.voice = preferred;
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(u);
  };
  return (
    <button type="button" onClick={handleSpeak}
      style={{
        background: playing ? "#fff0f6" : "#f0f4f8",
        border: `2px solid ${playing ? "#ff9de2" : "#e2e8f0"}`,
        borderRadius: "50%", width: size, height: size,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0, fontSize: size * 0.44,
        transition: "all .15s", padding: 0,
      }}>
      {playing ? "🔊" : "🔈"}
    </button>
  );
}

const PROFILES_KEY = "eiken_profiles_v1";
const CURRENT_KEY  = "eiken_current_v1";
const PROGRESS_KEY = "eiken_progress_v1";

const EIKEN_LEVELS = [
  { id: "5", label: "Grade 5", emoji: "⭐",      color: "#ff6b9d", desc: "Elementary level — everyday English" },
  { id: "4", label: "Grade 4", emoji: "⭐⭐",   color: "#ff9500", desc: "Junior high entry level" },
  { id: "3", label: "Grade 3", emoji: "⭐⭐⭐", color: "#7fb069", desc: "Junior high intermediate" },
];

/* ── Ordinal data ── */
const ORDINAL_WORDS = [
  "first","second","third","fourth","fifth",
  "sixth","seventh","eighth","ninth","tenth",
  "eleventh","twelfth","thirteenth","fourteenth","fifteenth",
  "sixteenth","seventeenth","eighteenth","nineteenth","twentieth",
  "twenty-first","twenty-second","twenty-third","twenty-fourth","twenty-fifth",
  "twenty-sixth","twenty-seventh","twenty-eighth","twenty-ninth","thirtieth","thirty-first",
];
const ORDINAL_NUMS = [
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th","12th","13th","14th","15th","16th","17th","18th","19th","20th",
  "21st","22nd","23rd","24th","25th","26th","27th","28th","29th","30th","31st",
];

function makeOrdinal(i) {
  return {
    en: ORDINAL_WORDS[i],
    kanji: ORDINAL_NUMS[i],
    kana: ORDINAL_NUMS[i],
    isOrdinal: true,
    hint: `Write the word for ${ORDINAL_NUMS[i]}.`,
    tiles: [],
    answer: "",
  };
}

/* ── Month data ── */
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_KANJI = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const MONTH_KANA  = ["いちがつ","にがつ","さんがつ","しがつ","ごがつ","ろくがつ","しちがつ","はちがつ","くがつ","じゅうがつ","じゅういちがつ","じゅうにがつ"];
const MONTH_ORD_JP = ["1","2","3","4","5","6","7","8","9","10","11","12"];

function makeMonth(i) {
  const name = MONTH_NAMES[i];
  const ord  = ORDINAL_WORDS[i];
  return {
    en: name,
    kanji: MONTH_KANJI[i],
    kana: MONTH_KANA[i],
    isOrdinal: false,
    trans: `%%${MONTH_KANJI[i]}%%は一年の${MONTH_ORD_JP[i]}番目の月です。`,
    // Part B fill-in: blank is the month name
    hint: `_____ is the ${ord} month of the year.`,
    // Part C unscramble the same sentence
    tiles: [name, "is", "the", ord, "month", "of", "the", "year", "."],
    answer: `${name} is the ${ord} month of the year .`,
  };
}

/* ── Grade 3 categories ── */
const VOCAB_CATEGORIES_3 = [
  {
    id: "g3_nouns", title: "Nouns / 名詞", emoji: "📦",
    color: "#0891b2", shadow: "#155e75",
    words: [
      { en:"research",  kanji:"調査・研究",   kana:"ちょうさ・けんきゅう", trans:"彼女は環境について%%調査%%をしています。",           hint:"She is doing _____ about the environment.",     tiles:["She","is","doing","research","about","the","environment","."], answer:"She is doing research about the environment ." },
      { en:"interview", kanji:"面接",         kana:"めんせつ",             trans:"明日、私は就職の%%面接%%があります。",               hint:"I have a job _____ tomorrow.",                  tiles:["I","have","a","job","interview","tomorrow","."],               answer:"I have a job interview tomorrow ." },
      { en:"accident",  kanji:"事故",         kana:"じこ",                 trans:"昨日、学校の近くで%%事故%%がありました。",           hint:"There was an _____ near the school yesterday.",  tiles:["There","was","an","accident","near","the","school","yesterday","."], answer:"There was an accident near the school yesterday ." },
      { en:"aquarium",  kanji:"水族館",       kana:"すいぞくかん",         trans:"私たちは先週、%%水族館%%に行きました。",             hint:"We went to the _____ last week.",                tiles:["We","went","to","the","aquarium","last","week","."],           answer:"We went to the aquarium last week ." },
      { en:"blanket",   kanji:"毛布",         kana:"もうふ",               trans:"寒いので%%毛布%%を持ってきてください。",             hint:"Please bring a _____ — it is cold.",            tiles:["Please","bring","a","blanket","—","it","is","cold","."],       answer:"Please bring a blanket — it is cold ." },
      { en:"athlete",   kanji:"選手・運動選手",kana:"せんしゅ",             trans:"彼はプロの%%選手%%です。",                          hint:"He is a professional _____.",                   tiles:["He","is","a","professional","athlete","."],                    answer:"He is a professional athlete ." },
    ],
  },
  {
    id: "g3_verbs", title: "Verbs / 動詞", emoji: "🏃",
    color: "#d97706", shadow: "#92400e",
    words: [
      { en:"turn down", kanji:"下げる",       kana:"さげる",   trans:"音楽の音を%%下げて%%ください。",                           hint:"Please _____ the music.",                       tiles:["Please","turn","down","the","music","."],                      answer:"Please turn down the music ." },
      { en:"lend",      kanji:"貸す",         kana:"かす",     trans:"鉛筆を%%貸して%%もらえますか？",                          hint:"Can you _____ me your pencil?",                 tiles:["Can","you","lend","me","your","pencil","?"],                   answer:"Can you lend me your pencil ?" },
      { en:"record",    kanji:"録画する",     kana:"ろくがする",trans:"その番組を%%録画して%%おきます。",                        hint:"I will _____ the program.",                     tiles:["I","will","record","the","program","."],                       answer:"I will record the program ." },
      { en:"grow",      kanji:"育てる",       kana:"そだてる", trans:"父は庭で野菜を%%育てて%%います。",                        hint:"My father _____ vegetables in the garden.",     tiles:["My","father","grows","vegetables","in","the","garden","."],    answer:"My father grows vegetables in the garden ." },
      { en:"bake",      kanji:"焼く",         kana:"やく",     trans:"母は日曜日にクッキーを%%焼きます%%。",                    hint:"My mother _____ cookies on Sundays.",           tiles:["My","mother","bakes","cookies","on","Sundays","."],            answer:"My mother bakes cookies on Sundays ." },
      { en:"climb",     kanji:"登る",         kana:"のぼる",   trans:"私たちは昨年、富士山を%%登りました%%。",                  hint:"We _____ Mt. Fuji last year.",                  tiles:["We","climbed","Mt.","Fuji","last","year","."],                 answer:"We climbed Mt. Fuji last year ." },
      { en:"follow",    kanji:"従う",         kana:"したがう", trans:"指示に%%従って%%ください。",                              hint:"Please _____ the instructions.",                tiles:["Please","follow","the","instructions","."],                    answer:"Please follow the instructions ." },
    ],
  },
  {
    id: "g3_adjectives", title: "Adjectives & Degree Words / 形容詞", emoji: "✨",
    color: "#8b5cf6", shadow: "#6d28d9",
    words: [
      { en:"another",  kanji:"もう一つの",   kana:"もうひとつの", trans:"%%もう一枚%%紙をもらえますか？",                         hint:"Can I have _____ piece of paper?",              tiles:["Can","I","have","another","piece","of","paper","?"],           answer:"Can I have another piece of paper ?" },
      { en:"empty",    kanji:"空の",         kana:"からの",       trans:"そのペットボトルは%%空です%%。",                         hint:"The bottle is _____.",                          tiles:["The","bottle","is","empty","."],                               answer:"The bottle is empty ." },
      { en:"a little", kanji:"少し",         kana:"すこし",       trans:"%%少し%%待ってください。",                               hint:"Please wait _____ longer.",                     tiles:["Please","wait","a","little","longer","."],                     answer:"Please wait a little longer ." },
      { en:"cooler",   kanji:"より涼しい",   kana:"よりすずしい", trans:"今日は昨日より%%涼しいです%%。",                         hint:"Today is _____ than yesterday.",                tiles:["Today","is","cooler","than","yesterday","."],                  answer:"Today is cooler than yesterday ." },
      { en:"deep",     kanji:"深い",         kana:"ふかい",       trans:"この湖はとても%%深いです%%。",                           hint:"This lake is very _____.",                      tiles:["This","lake","is","very","deep","."],                          answer:"This lake is very deep ." },
      { en:"total",    kanji:"合計の",       kana:"ごうけいの",   trans:"%%合計%%で500円です。",                                  hint:"The _____ is 500 yen.",                         tiles:["The","total","is","500","yen","."],                            answer:"The total is 500 yen ." },
      { en:"enough",   kanji:"十分な",       kana:"じゅうぶんな", trans:"時間は%%十分%%あります。",                               hint:"We have _____ time.",                           tiles:["We","have","enough","time","."],                               answer:"We have enough time ." },
      { en:"perfect",  kanji:"完璧な",       kana:"かんぺきな",   trans:"あなたの答えは%%完璧です%%。",                           hint:"Your answer is _____.",                         tiles:["Your","answer","is","perfect","."],                            answer:"Your answer is perfect ." },
      { en:"absent",   kanji:"欠席して",     kana:"けっせきして", trans:"タカシは今日%%欠席して%%います。",                       hint:"Takashi is _____ today.",                       tiles:["Takashi","is","absent","today","."],                           answer:"Takashi is absent today ." },
    ],
  },
  {
    id: "g3_time_expressions", title: "Time Expressions / 時間表現", emoji: "⏰",
    color: "#06b6d4", shadow: "#0e7490",
    words: [
      { en:"right now",       kanji:"今すぐ",     kana:"いますぐ",     trans:"%%今すぐ%%来てください。",                               hint:"Please come _____.",                               tiles:["Please","come","right","now","."],                              answer:"Please come right now ." },
      { en:"for the first time",kanji:"初めて",   kana:"はじめて",     trans:"私は%%初めて%%納豆を食べました。",                        hint:"I ate natto _____ .",                               tiles:["I","ate","natto","for","the","first","time","."],               answer:"I ate natto for the first time ." },
      { en:"all the time",    kanji:"いつも",     kana:"いつも",       trans:"彼は%%いつも%%スマホを見ています。",                      hint:"He looks at his phone _____.",                      tiles:["He","looks","at","his","phone","all","the","time","."],         answer:"He looks at his phone all the time ." },
      { en:"the other day",   kanji:"先日",       kana:"せんじつ",     trans:"%%先日%%、古い友人に会いました。",                        hint:"I met an old friend _____.",                        tiles:["I","met","an","old","friend","the","other","day","."],          answer:"I met an old friend the other day ." },
      { en:"just in time",    kanji:"ちょうど間に合って",kana:"ちょうどまにあって",trans:"電車に%%ちょうど間に合いました%%。",          hint:"We caught the train _____.",                        tiles:["We","caught","the","train","just","in","time","."],             answer:"We caught the train just in time ." },
      { en:"forever",         kanji:"永遠に",     kana:"えいえんに",   trans:"この景色を%%永遠に%%覚えていたいです。",                  hint:"I want to remember this view _____.",               tiles:["I","want","to","remember","this","view","forever","."],         answer:"I want to remember this view forever ." },
      { en:"never",           kanji:"決して〜ない",kana:"けっして〜ない",trans:"私は魚を%%決して%%食べません。",                         hint:"I _____ eat fish.",                                 tiles:["I","never","eat","fish","."],                                   answer:"I never eat fish ." },
    ],
  },
  {
    id: "g3_irregular_1", title: "Irregular Past Tense 1 / 不規則過去形①", emoji: "⏪",
    color: "#ef4444", shadow: "#b91c1c", isIrregularVerb: true,
    words: [
      { en:"went",    present:"go",    kana:"行った",           alts:["goed","wnet","gone"],           hint:"Yesterday I _____ to the park.",          tiles:["Yesterday","I","went","to","the","park","."],          answer:"Yesterday I went to the park ." },
      { en:"saw",     present:"see",   kana:"見た",             alts:["sew","seen","seed"],            hint:"I _____ a rainbow this morning.",          tiles:["I","saw","a","rainbow","this","morning","."],          answer:"I saw a rainbow this morning ." },
      { en:"took",    present:"take",  kana:"撮った・持って行った",alts:["toock","taked","toke"],       hint:"She _____ a photo of the sunset.",         tiles:["She","took","a","photo","of","the","sunset","."],      answer:"She took a photo of the sunset ." },
      { en:"bought",  present:"buy",   kana:"買った",           alts:["buyed","boughtt","bort"],       hint:"I _____ a new bag last week.",             tiles:["I","bought","a","new","bag","last","week","."],        answer:"I bought a new bag last week ." },
      { en:"caught",  present:"catch", kana:"捕まえた",         alts:["catched","caugh","cought"],     hint:"He _____ a big fish in the river.",        tiles:["He","caught","a","big","fish","in","the","river","."], answer:"He caught a big fish in the river ." },
      { en:"thought", present:"think", kana:"思った",           alts:["thinked","thougth","thunk"],   hint:"I _____ the movie was great.",             tiles:["I","thought","the","movie","was","great","."],         answer:"I thought the movie was great ." },
      { en:"wrote",   present:"write", kana:"書いた",           alts:["writed","wroat","written"],    hint:"She _____ a letter to her friend.",        tiles:["She","wrote","a","letter","to","her","friend","."],    answer:"She wrote a letter to her friend ." },
    ],
  },
  {
    id: "g3_irregular_2", title: "Irregular Past Tense 2 / 不規則過去形②", emoji: "⏪",
    color: "#f97316", shadow: "#c2410c", isIrregularVerb: true,
    words: [
      { en:"spoke",  present:"speak", kana:"話した",           alts:["speaked","spoked","spoken"],   hint:"He _____ to the class about his trip.",    tiles:["He","spoke","to","the","class","about","his","trip","."], answer:"He spoke to the class about his trip ." },
      { en:"broke",  present:"break", kana:"壊した・割った",   alts:["breaked","brok","broken"],     hint:"I _____ my phone by accident.",             tiles:["I","broke","my","phone","by","accident","."],           answer:"I broke my phone by accident ." },
      { en:"found",  present:"find",  kana:"見つけた",         alts:["finded","foud","finned"],      hint:"She _____ her keys under the sofa.",        tiles:["She","found","her","keys","under","the","sofa","."],    answer:"She found her keys under the sofa ." },
      { en:"left",   present:"leave", kana:"出発した・置いてきた",alts:["leaved","lefft","leved"],   hint:"We _____ home at eight o'clock.",           tiles:["We","left","home","at","eight","o'clock","."],          answer:"We left home at eight o'clock ." },
      { en:"gave",   present:"give",  kana:"あげた",           alts:["gived","given","gaave"],       hint:"He _____ me a birthday present.",           tiles:["He","gave","me","a","birthday","present","."],          answer:"He gave me a birthday present ." },
      { en:"got",    present:"get",   kana:"手に入れた",       alts:["getted","gott","gat"],         hint:"I _____ a letter from my pen pal.",         tiles:["I","got","a","letter","from","my","pen","pal","."],     answer:"I got a letter from my pen pal ." },
      { en:"came",   present:"come",  kana:"来た",             alts:["comed","coame","cumm"],        hint:"My cousin _____ to visit last summer.",     tiles:["My","cousin","came","to","visit","last","summer","."],  answer:"My cousin came to visit last summer ." },
    ],
  },
  {
    id: "g3_irregular_3", title: "Irregular Past Tense 3 / 不規則過去形③", emoji: "⏪",
    color: "#8b5cf6", shadow: "#6d28d9", isIrregularVerb: true,
    words: [
      { en:"began",    present:"begin",   kana:"始まった",     alts:["begined","begon","begun"],     hint:"The festival _____ at six o'clock.",        tiles:["The","festival","began","at","six","o'clock","."],      answer:"The festival began at six o'clock ." },
      { en:"sent",     present:"send",    kana:"送った",       alts:["sended","sennt","sint"],       hint:"She _____ an email to her teacher.",         tiles:["She","sent","an","email","to","her","teacher","."],     answer:"She sent an email to her teacher ." },
      { en:"knew",     present:"know",    kana:"知っていた",   alts:["knowed","kneww","noo"],        hint:"I _____ the answer to the question.",        tiles:["I","knew","the","answer","to","the","question","."],    answer:"I knew the answer to the question ." },
      { en:"told",     present:"tell",    kana:"伝えた",       alts:["telled","tolld","toled"],      hint:"My mother _____ me to clean my room.",       tiles:["My","mother","told","me","to","clean","my","room","."], answer:"My mother told me to clean my room ." },
      { en:"heard",    present:"hear",    kana:"聞いた",       alts:["heared","herd","heered"],      hint:"I _____ a strange sound last night.",        tiles:["I","heard","a","strange","sound","last","night","."],   answer:"I heard a strange sound last night ." },
      { en:"felt",     present:"feel",    kana:"感じた",       alts:["feeled","feltt","feled"],      hint:"She _____ happy after the concert.",         tiles:["She","felt","happy","after","the","concert","."],       answer:"She felt happy after the concert ." },
      { en:"met",      present:"meet",    kana:"会った",       alts:["meeted","mett","meat"],        hint:"I _____ my old teacher at the station.",     tiles:["I","met","my","old","teacher","at","the","station","."],answer:"I met my old teacher at the station ." },
      { en:"received", present:"receive", kana:"受け取った",   alts:["recieved","recived","receeved"],hint:"She _____ a package from her aunt.",       tiles:["She","received","a","package","from","her","aunt","."], answer:"She received a package from her aunt ." },
    ],
  },
  {
    id: "g3_phrasal_verbs_1", title: "Phrasal Verbs 1 / 句動詞①", emoji: "🔗",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"clean up",   kanji:"片付ける",         kana:"かたづける",      hint:"Please _____ your room before dinner.",      tiles:["Please","clean","up","your","room","before","dinner","."],  answer:"Please clean up your room before dinner ." },
      { en:"look for",   kanji:"〜を探す",         kana:"〜をさがす",      hint:"I am _____ my glasses.",                     tiles:["I","am","looking","for","my","glasses","."],                answer:"I am looking for my glasses ." },
      { en:"get off",    kanji:"（乗り物を）降りる",kana:"おりる",          hint:"_____ the bus at the next stop.",            tiles:["Get","off","the","bus","at","the","next","stop","."],       answer:"Get off the bus at the next stop ." },
      { en:"get on",     kanji:"（乗り物に）乗る", kana:"のる",            hint:"_____ the train at platform two.",           tiles:["Get","on","the","train","at","platform","two","."],         answer:"Get on the train at platform two ." },
      { en:"throw away", kanji:"捨てる",           kana:"すてる",          hint:"Please _____ the old magazines.",            tiles:["Please","throw","away","the","old","magazines","."],        answer:"Please throw away the old magazines ." },
      { en:"come back",  kanji:"戻ってくる",       kana:"もどってくる",    hint:"She will _____ by six o'clock.",             tiles:["She","will","come","back","by","six","o'clock","."],        answer:"She will come back by six o'clock ." },
    ],
  },
  {
    id: "g3_phrasal_verbs_2", title: "Phrasal Verbs 2 / 句動詞②", emoji: "🔗",
    color: "#0891b2", shadow: "#155e75",
    words: [
      { en:"give back",  kanji:"返す",             kana:"かえす",          hint:"Please _____ the book by Friday.",           tiles:["Please","give","back","the","book","by","Friday","."],      answer:"Please give back the book by Friday ." },
      { en:"call back",  kanji:"電話をかけ直す",   kana:"でんわをかけなおす",hint:"Can you _____ in ten minutes?",            tiles:["Can","you","call","back","in","ten","minutes","?"],         answer:"Can you call back in ten minutes ?" },
      { en:"get back",   kanji:"戻る・取り戻す",   kana:"もどる",          hint:"When did you _____ from your trip?",         tiles:["When","did","you","get","back","from","your","trip","?"],   answer:"When did you get back from your trip ?" },
      { en:"feel like",  kanji:"〜したい気分だ",   kana:"〜したいきぶんだ", hint:"I _____ eating pizza tonight.",             tiles:["I","feel","like","eating","pizza","tonight","."],           answer:"I feel like eating pizza tonight ." },
      { en:"hear about", kanji:"〜について聞く",   kana:"〜についてきく",   hint:"Did you _____ the festival?",               tiles:["Did","you","hear","about","the","festival","?"],            answer:"Did you hear about the festival ?" },
      { en:"talk to",    kanji:"〜と話す",         kana:"〜とはなす",       hint:"I need to _____ my teacher.",               tiles:["I","need","to","talk","to","my","teacher","."],             answer:"I need to talk to my teacher ." },
    ],
  },
  {
    id: "g3_prepositions_1", title: "Preposition Phrases 1 / 前置詞句①", emoji: "📍",
    color: "#6366f1", shadow: "#4338ca",
    words: [
      { en:"next to",         kanji:"〜の隣に",     kana:"〜のとなりに",        hint:"The bank is _____ the post office.",       tiles:["The","bank","is","next","to","the","post","office","."],     answer:"The bank is next to the post office ." },
      { en:"in front of",     kanji:"〜の前に",     kana:"〜のまえに",          hint:"Let's meet _____ the station.",            tiles:["Let's","meet","in","front","of","the","station","."],        answer:"Let's meet in front of the station ." },
      { en:"beside",          kanji:"〜のそばに",   kana:"〜のそばに",          hint:"Please sit _____ me.",                     tiles:["Please","sit","beside","me","."],                            answer:"Please sit beside me ." },
      { en:"on my way home",  kanji:"家に帰る途中で",kana:"いえにかえるとちゅうで",hint:"I stopped at the shop _____.",          tiles:["I","stopped","at","the","shop","on","my","way","home","."], answer:"I stopped at the shop on my way home ." },
      { en:"for a while",     kanji:"しばらくの間", kana:"しばらくのあいだ",    hint:"Please wait _____.",                       tiles:["Please","wait","for","a","while","."],                       answer:"Please wait for a while ." },
      { en:"once a month",    kanji:"月に一度",     kana:"つきにいちど",        hint:"We clean the classroom _____.",            tiles:["We","clean","the","classroom","once","a","month","."],       answer:"We clean the classroom once a month ." },
    ],
  },
  {
    id: "g3_prepositions_2", title: "Preposition Phrases 2 / 前置詞句②", emoji: "📍",
    color: "#7c3aed", shadow: "#5b21b6",
    words: [
      { en:"since then",      kanji:"それ以来",     kana:"それいらい",          hint:"I have studied English every day _____.",  tiles:["I","have","studied","English","every","day","since","then","."], answer:"I have studied English every day since then ." },
      { en:"three weeks ago", kanji:"3週間前に",    kana:"さんしゅうかんまえに", hint:"I started this club _____.",              tiles:["I","started","this","club","three","weeks","ago","."],        answer:"I started this club three weeks ago ." },
      { en:"until late",      kanji:"遅くまで",     kana:"おそくまで",          hint:"She studied _____ last night.",            tiles:["She","studied","until","late","last","night","."],           answer:"She studied until late last night ." },
      { en:"down the street", kanji:"通りの先に",   kana:"とおりのさきに",      hint:"The park is just _____.",                  tiles:["The","park","is","just","down","the","street","."],          answer:"The park is just down the street ." },
      { en:"in the afternoon",kanji:"午後に",       kana:"ごごに",              hint:"I have soccer practice _____.",            tiles:["I","have","soccer","practice","in","the","afternoon","."],   answer:"I have soccer practice in the afternoon ." },
    ],
  },
  {
    id: "g3_feelings_1", title: "Feelings & Adjectives 1 / きもち・形容詞①", emoji: "😊",
    color: "#f59e0b", shadow: "#d97706",
    words: [
      { en:"nervous",    kanji:"緊張して",   kana:"きんちょうして",trans:"スピーチの前に%%緊張して%%います。",                   hint:"I am _____ before the speech.",                 tiles:["I","am","nervous","before","the","speech","."],               answer:"I am nervous before the speech ." },
      { en:"worried",    kanji:"心配して",   kana:"しんぱいして", trans:"彼女は試験のことが%%心配して%%います。",               hint:"She is _____ about the exam.",                  tiles:["She","is","worried","about","the","exam","."],                 answer:"She is worried about the exam ." },
      { en:"busy",       kanji:"忙しい",     kana:"いそがしい",   trans:"お母さんは今とても%%忙しいです%%。",                    hint:"My mother is very _____ now.",                  tiles:["My","mother","is","very","busy","now","."],                    answer:"My mother is very busy now ." },
      { en:"excited",    kanji:"わくわくして",kana:"わくわくして", trans:"修学旅行が%%わくわくして%%います。",                    hint:"I am _____ about the school trip.",             tiles:["I","am","excited","about","the","school","trip","."],          answer:"I am excited about the school trip ." },
      { en:"glad",       kanji:"うれしい",   kana:"うれしい",     trans:"あなたに会えて%%うれしいです%%。",                      hint:"I am _____ to see you.",                        tiles:["I","am","glad","to","see","you","."],                          answer:"I am glad to see you ." },
      { en:"sorry",      kanji:"申し訳ない", kana:"もうしわけない",trans:"遅れて%%申し訳ありません%%。",                         hint:"I am _____ for being late.",                    tiles:["I","am","sorry","for","being","late","."],                     answer:"I am sorry for being late ." },
      { en:"surprised",  kanji:"驚いて",     kana:"おどろいて",   trans:"その知らせを聞いて%%驚きました%%。",                    hint:"I was _____ to hear the news.",                 tiles:["I","was","surprised","to","hear","the","news","."],            answer:"I was surprised to hear the news ." },
    ],
  },
  {
    id: "g3_feelings_2", title: "Feelings & Adjectives 2 / きもち・形容詞②", emoji: "😋",
    color: "#f59e0b", shadow: "#d97706",
    words: [
      { en:"exciting",   kanji:"わくわくさせる",kana:"わくわくさせる",trans:"このゲームは本当に%%わくわくします%%。",             hint:"This game is really _____.",                    tiles:["This","game","is","really","exciting","."],                    answer:"This game is really exciting ." },
      { en:"delicious",  kanji:"とてもおいしい",kana:"とてもおいしい",trans:"このラーメンは%%とてもおいしいです%%。",            hint:"This ramen is _____.",                          tiles:["This","ramen","is","delicious","."],                           answer:"This ramen is delicious ." },
      { en:"fresh",      kanji:"新鮮な",     kana:"しんせんな",   trans:"この野菜は%%新鮮です%%。",                              hint:"These vegetables are _____.",                   tiles:["These","vegetables","are","fresh","."],                        answer:"These vegetables are fresh ." },
      { en:"crowded",    kanji:"混雑した",   kana:"こんざつした", trans:"駅はとても%%混雑して%%いました。",                      hint:"The station was very _____.",                   tiles:["The","station","was","very","crowded","."],                    answer:"The station was very crowded ." },
      { en:"popular",    kanji:"人気のある", kana:"にんきのある", trans:"このお店は学生に%%人気があります%%。",                  hint:"This shop is _____ with students.",              tiles:["This","shop","is","popular","with","students","."],            answer:"This shop is popular with students ." },
      { en:"helpful",    kanji:"助けになる", kana:"たすけになる", trans:"その先生はとても%%助けになります%%。",                  hint:"The teacher is very _____.",                    tiles:["The","teacher","is","very","helpful","."],                     answer:"The teacher is very helpful ." },
      { en:"peaceful",   kanji:"平和な",     kana:"へいわな",     trans:"この公園はとても%%平和です%%。",                        hint:"This park is very _____.",                      tiles:["This","park","is","very","peaceful","."],                      answer:"This park is very peaceful ." },
    ],
  },
  {
    id: "g3_culture_words", title: "Culture & Topic Words / 文化・話題", emoji: "🌍",
    color: "#7fb069", shadow: "#4d7c0f",
    words: [
      { en:"traditional", kanji:"伝統的な",   kana:"でんとうてきな", trans:"日本には多くの%%伝統的な%%祭りがあります。",            hint:"Japan has many _____ festivals.",                tiles:["Japan","has","many","traditional","festivals","."],            answer:"Japan has many traditional festivals ." },
      { en:"method",      kanji:"方法",       kana:"ほうほう",       trans:"この%%方法%%で問題を解いてみてください。",              hint:"Please try this _____ to solve the problem.",   tiles:["Please","try","this","method","to","solve","the","problem","."],answer:"Please try this method to solve the problem ." },
      { en:"protect",     kanji:"守る",       kana:"まもる",         trans:"自然を%%守る%%ことが大切です。",                        hint:"It is important to _____ nature.",               tiles:["It","is","important","to","protect","nature","."],             answer:"It is important to protect nature ." },
      { en:"government",  kanji:"政府",       kana:"せいふ",         trans:"%%政府%%は新しい法律を作りました。",                    hint:"The _____ made a new law.",                      tiles:["The","government","made","a","new","law","."],                 answer:"The government made a new law ." },
      { en:"festival",    kanji:"祭り",       kana:"まつり",         trans:"私たちは毎年夏に%%祭り%%を楽しみます。",               hint:"We enjoy a _____ every summer.",                 tiles:["We","enjoy","a","festival","every","summer","."],              answer:"We enjoy a festival every summer ." },
      { en:"celebrate",   kanji:"祝う",       kana:"いわう",         trans:"私たちは彼の誕生日を%%祝いました%%。",                  hint:"We _____ his birthday.",                         tiles:["We","celebrated","his","birthday","."],                        answer:"We celebrated his birthday ." },
      { en:"professional",kanji:"プロの",     kana:"プロの",         trans:"彼女は%%プロの%%テニス選手です。",                      hint:"She is a _____ tennis player.",                  tiles:["She","is","a","professional","tennis","player","."],           answer:"She is a professional tennis player ." },
      { en:"volunteer",   kanji:"ボランティア",kana:"ボランティア",   trans:"私は毎月%%ボランティア%%活動をしています。",            hint:"I do _____ work every month.",                   tiles:["I","do","volunteer","work","every","month","."],               answer:"I do volunteer work every month ." },
      { en:"introduce",   kanji:"紹介する",   kana:"しょうかいする", trans:"新しい友達を%%紹介します%%。",                          hint:"Let me _____ my new friend.",                    tiles:["Let","me","introduce","my","new","friend","."],                answer:"Let me introduce my new friend ." },
      { en:"study abroad",kanji:"留学する",   kana:"りゅうがくする", trans:"彼女はカナダに%%留学する%%つもりです。",               hint:"She plans to _____ in Canada.",                  tiles:["She","plans","to","study","abroad","in","Canada","."],         answer:"She plans to study abroad in Canada ." },
      { en:"culture",     kanji:"文化",       kana:"ぶんか",         trans:"私はアメリカの%%文化%%に興味があります。",              hint:"I am interested in American _____.",             tiles:["I","am","interested","in","American","culture","."],           answer:"I am interested in American culture ." },
      { en:"nature",      kanji:"自然",       kana:"しぜん",         trans:"私は%%自然%%の中を歩くのが好きです。",                  hint:"I like walking in _____.",                       tiles:["I","like","walking","in","nature","."],                        answer:"I like walking in nature ." },
      { en:"hiking",      kanji:"ハイキング", kana:"ハイキング",     trans:"先週末、家族で%%ハイキング%%に行きました。",            hint:"We went _____ with my family last weekend.",     tiles:["We","went","hiking","with","my","family","last","weekend","."],answer:"We went hiking with my family last weekend ." },
    ],
  },
  {
    id: "g3_connectors", title: "Writing Connectors / つなぎ言葉", emoji: "🔤",
    color: "#ec4899", shadow: "#9d174d",
    words: [
      { en:"First,",        kanji:"第一に",     kana:"だいいちに",   hint:"_____ I wake up and wash my face. ___________",       tiles:["First,","I","wake","up","and","wash","my","face","."],        answer:"First, I wake up and wash my face ." },
      { en:"Second,",       kanji:"第二に",     kana:"だいにに",     hint:"_____ I eat breakfast. ___________",                  tiles:["Second,","I","eat","breakfast","."],                          answer:"Second, I eat breakfast ." },
      { en:"However,",      kanji:"しかし",     kana:"しかし",       hint:"_____ I couldn't finish my homework. ___________",    tiles:["However,","I","couldn't","finish","my","homework","."],       answer:"However, I couldn't finish my homework ." },
      { en:"Also,",         kanji:"また",       kana:"また",         hint:"_____ I like swimming. ___________",                  tiles:["Also,","I","like","swimming","."],                            answer:"Also, I like swimming ." },
      { en:"Then,",         kanji:"それから",   kana:"それから",     hint:"_____ we went to the park. ___________",              tiles:["Then,","we","went","to","the","park","."],                    answer:"Then, we went to the park ." },
      { en:"Next,",         kanji:"次に",       kana:"つぎに",       hint:"_____ add the eggs and mix well. ___________",        tiles:["Next,","add","the","eggs","and","mix","well","."],            answer:"Next, add the eggs and mix well ." },
      { en:"So,",           kanji:"だから",     kana:"だから",       hint:"_____ I decided to study harder. ___________",        tiles:["So,","I","decided","to","study","harder","."],                answer:"So, I decided to study harder ." },
      { en:"Although",      kanji:"〜だけれども",kana:"〜だけれども", hint:"_____ it was raining, we had fun. ___________",       tiles:["Although","it","was","raining","we","had","fun","."],         answer:"Although it was raining we had fun ." },
    ],
  },
  {
    id: "g3_collocations", title: "Common Collocations / よくあるコロケーション", emoji: "💡",
    color: "#f97316", shadow: "#c2410c",
    words: [
      { en:"do one's best",   kanji:"全力を尽くす",     kana:"ぜんりょくをつくす",hint:"I will _____ in the competition. ___________",    tiles:["I","will","do","my","best","in","the","competition","."],  answer:"I will do my best in the competition ." },
      { en:"in a hurry",      kanji:"急いでいる",       kana:"いそいでいる",      hint:"She left school _____ . ___________",             tiles:["She","left","school","in","a","hurry","."],               answer:"She left school in a hurry ." },
      { en:"look forward to", kanji:"〜を楽しみにする", kana:"〜をたのしみにする",hint:"I _____ seeing you next week. ___________",        tiles:["I","look","forward","to","seeing","you","next","week","."],answer:"I look forward to seeing you next week ." },
      { en:"famous for",      kanji:"〜で有名な",       kana:"〜でゆうめいな",    hint:"Kyoto is _____ its old temples. ___________",     tiles:["Kyoto","is","famous","for","its","old","temples","."],    answer:"Kyoto is famous for its old temples ." },
      { en:"in fact",         kanji:"実は・実際に",     kana:"じつは・じっさいに",hint:"_____, she has visited ten countries. ___________",tiles:["In","fact","she","has","visited","ten","countries","."],  answer:"In fact she has visited ten countries ." },
    ],
  },
  {
    id: "g3_grammar_patterns", title: "Grammar Patterns / 文法パターン", emoji: "📐",
    color: "#14b8a6", shadow: "#0f766e",
    words: [
      { en:"Would you like...?", kanji:"〜はいかがですか",     kana:"〜はいかがですか",     hint:"_____ some tea? — Yes, please. ___________",             tiles:["Would","you","like","some","tea","?"],                      answer:"Would you like some tea ?" },
      { en:"..., didn't you?",   kanji:"〜ですよね？（付加疑問）",kana:"〜ですよね",         hint:"You went to the party, _____  ___________",              tiles:["You","went","to","the","party","didn't","you","?"],         answer:"You went to the party didn't you ?" },
      { en:"something to drink", kanji:"飲み物",               kana:"のみもの",             hint:"Do you have _____ ? — Yes, here is some juice. ___________",tiles:["Do","you","have","something","to","drink","?"],           answer:"Do you have something to drink ?" },
      { en:"difficult to",       kanji:"〜するのが難しい",      kana:"〜するのがむずかしい", hint:"It is _____ understand this problem. ___________",       tiles:["It","is","difficult","to","understand","this","problem","."],answer:"It is difficult to understand this problem ." },
      { en:"have checked",       kanji:"確認した（現在完了）",  kana:"かくにんした",         hint:"I _____ the schedule already. ___________",              tiles:["I","have","checked","the","schedule","already","."],        answer:"I have checked the schedule already ." },
    ],
  },
  {
    id: "g3_conversational_1", title: "Conversational Expressions 1 / 会話表現①", emoji: "💬",
    color: "#8b5cf6", shadow: "#6d28d9",
    words: [
      { en:"Certainly.",              kanji:"かしこまりました。",           kana:"かしこまりました。",           speakerA:"Can you open the window, please?",       hint:"Can you open the window, please? ___________",       tiles:["Certainly","."],                                            answer:"Certainly ." },
      { en:"That sounds great.",      kanji:"それはいいですね。",           kana:"それはいいですね。",           speakerA:"Let's go to the park this Sunday!",      hint:"Let's go to the park this Sunday! ___________",      tiles:["That","sounds","great","."],                                answer:"That sounds great ." },
      { en:"Have a safe trip.",       kanji:"気をつけて行ってらっしゃい。", kana:"きをつけていってらっしゃい。", speakerA:"I'm leaving for Tokyo tomorrow.",         hint:"I'm leaving for Tokyo tomorrow. ___________",        tiles:["Have","a","safe","trip","."],                               answer:"Have a safe trip ." },
      { en:"I'm ready.",              kanji:"準備ができています。",         kana:"じゅんびができています。",     speakerA:"Are you ready to go?",                   hint:"Are you ready to go? ___________",                   tiles:["I'm","ready","."],                                          answer:"I'm ready ." },
      { en:"What's the matter?",      kanji:"どうしたの？",                kana:"どうしたの？",                 speakerA:"I can't find my homework...",            hint:"I can't find my homework... ___________",            tiles:["What's","the","matter","?"],                                answer:"What's the matter ?" },
      { en:"You're home early.",      kanji:"帰りが早いね。",               kana:"かえりがはやいね。",           speakerA:"Hi! I'm home!",                          hint:"Hi! I'm home! ___________",                          tiles:["You're","home","early","."],                                answer:"You're home early ." },
    ],
  },
  {
    id: "g3_conversational_2", title: "Conversational Expressions 2 / 会話表現②", emoji: "💬",
    color: "#8b5cf6", shadow: "#6d28d9",
    words: [
      { en:"I'm a little worried.",   kanji:"少し心配です。",               kana:"すこししんぱいです。",         speakerA:"How do you feel about tomorrow's test?", hint:"How do you feel about tomorrow's test? ___________", tiles:["I'm","a","little","worried","."],                           answer:"I'm a little worried ." },
      { en:"I'd like to go again.",   kanji:"また行きたいです。",           kana:"またいきたいです。",           speakerA:"Did you enjoy the trip to Kyoto?",       hint:"Did you enjoy the trip to Kyoto? ___________",       tiles:["I'd","like","to","go","again","."],                         answer:"I'd like to go again ." },
      { en:"It's too far to walk.",   kanji:"歩くには遠すぎます。",         kana:"あるくにはとおすぎます。",     speakerA:"Should we walk to the museum?",          hint:"Should we walk to the museum? ___________",          tiles:["It's","too","far","to","walk","."],                         answer:"It's too far to walk ." },
      { en:"Have you been there before?",kanji:"そこに行ったことがありますか。",kana:"そこにいったことがありますか。",speakerA:"Let's try the new ramen shop!",      hint:"Let's try the new ramen shop! ___________",          tiles:["Have","you","been","there","before","?"],                   answer:"Have you been there before ?" },
      { en:"I've never done that before.",kanji:"それをやったことがありません。",kana:"それをやったことがありません。",speakerA:"Let's try rock climbing!",          hint:"Let's try rock climbing! ___________",               tiles:["I've","never","done","that","before","."],                  answer:"I've never done that before ." },
      { en:"I was writing a report.", kanji:"レポートを書いていました。",   kana:"レポートをかいていました。",   speakerA:"What were you doing last night?",        hint:"What were you doing last night? ___________",        tiles:["I","was","writing","a","report","."],                       answer:"I was writing a report ." },
    ],
  },
];

/* ── Grade 4 categories ── */
const VOCAB_CATEGORIES_4 = [
  {
    id: "g4_places", title: "Places Around Town / まちの場所", emoji: "🏙️",
    color: "#6366f1", shadow: "#4338ca",
    words: [
      { en:"airport",     kanji:"空港",            kana:"くうこう",         trans:"ゆうたは飛行機が大好きで、飛行機を見るためによく%%空港%%に行きます。",                           hint:"Yuta loves flying — he often goes to the _____ to watch planes.",  tiles:["Yuta","loves","flying","—","he","often","goes","to","the","airport","to","watch","planes","."],  answer:"Yuta loves flying — he often goes to the airport to watch planes ." },
      { en:"museum",      kanji:"博物館",           kana:"はくぶつかん",     trans:"ゆみは歴史を学ぶのが好きなので%%博物館%%を訪れました。",                                       hint:"Yumi visited a _____ because she likes learning about history.",   tiles:["Yumi","visited","a","museum","because","she","likes","learning","about","history","."],          answer:"Yumi visited a museum because she likes learning about history ." },
      { en:"castle",      kanji:"城",               kana:"しろ",             trans:"先週末、私たちは京都の美しい%%城%%を訪れました。",                                             hint:"We visited a beautiful _____ in Kyoto last weekend.",              tiles:["We","visited","a","beautiful","castle","in","Kyoto","last","weekend","."],                       answer:"We visited a beautiful castle in Kyoto last weekend ." },
      { en:"stadium",     kanji:"スタジアム",       kana:"スタジアム",       trans:"男の人はスポーツの%%スタジアム%%で話しています。",                                             hint:"The man is talking at a sports _____.",                           tiles:["The","man","is","talking","at","a","sports","stadium","."],                                      answer:"The man is talking at a sports stadium ." },
      { en:"supermarket", kanji:"スーパー",         kana:"スーパー",         trans:"父は毎週土曜日に%%スーパー%%で野菜を買います。",                                               hint:"My dad buys vegetables at the _____ every Saturday.",             tiles:["My","dad","buys","vegetables","at","the","supermarket","every","Saturday","."],                  answer:"My dad buys vegetables at the supermarket every Saturday ." },
      { en:"café",        kanji:"カフェ",           kana:"カフェ",           trans:"ティムと友達は%%カフェ%%に2時間いました。",                                                   hint:"Tim and his friend stayed at the _____ for two hours.",           tiles:["Tim","and","his","friend","stayed","at","the","café","for","two","hours","."],                   answer:"Tim and his friend stayed at the café for two hours ." },
      { en:"mall",        kanji:"ショッピングモール",kana:"ショッピングモール",trans:"%%ショッピングモール%%の別のお店に行きましょう。",                                              hint:"Let's go to another store in the _____.",                        tiles:["Let's","go","to","another","store","in","the","mall","."],                                      answer:"Let's go to another store in the mall ." },
      { en:"restaurant",  kanji:"レストラン",       kana:"レストラン",       trans:"昨夜、私たちは新しいイタリアンの%%レストラン%%で夕食を食べました。",                           hint:"We had dinner at the new Italian _____ last night.",              tiles:["We","had","dinner","at","the","new","Italian","restaurant","last","night","."],                  answer:"We had dinner at the new Italian restaurant last night ." },
      { en:"bookstore",   kanji:"本屋",             kana:"ほんや",           trans:"家の近くにたくさんの本がある新しい%%本屋%%があります。",                                       hint:"There is a new _____ near my house with many kinds of books.",    tiles:["There","is","a","new","bookstore","near","my","house","with","many","kinds","of","books","."],   answer:"There is a new bookstore near my house with many kinds of books ." },
      { en:"gym",         kanji:"体育館・ジム",     kana:"たいいくかん",     trans:"兄は週2回、運動のために%%ジム%%に行きます。",                                                 hint:"My brother goes to the _____ twice a week to exercise.",          tiles:["My","brother","goes","to","the","gym","twice","a","week","to","exercise","."],                  answer:"My brother goes to the gym twice a week to exercise ." },
    ],
  },
  {
    id: "g4_irregular_past", title: "Irregular Past Tense / 不規則過去形", emoji: "⏪",
    color: "#ef4444", shadow: "#b91c1c",
    words: [
      { en:"caught",  kanji:"かかった（病気）",   kana:"かかった",       trans:"先週、ブライアンは風邪に%%かかった%%ので2日間ベッドで過ごしました。",                         hint:"Last week, Brian _____ a cold and stayed in bed for two days.",      tiles:["Last","week","Brian","caught","a","cold","and","stayed","in","bed","for","two","days","."],      answer:"Last week Brian caught a cold and stayed in bed for two days ." },
      { en:"forgot",  kanji:"忘れた",             kana:"わすれた",       trans:"私は傘を%%忘れた%%ので、雨でずぶ濡れになりました。",                                             hint:"I _____ my umbrella and got very wet in the rain.",                  tiles:["I","forgot","my","umbrella","and","got","very","wet","in","the","rain","."],                    answer:"I forgot my umbrella and got very wet in the rain ." },
      { en:"bought",  kanji:"買った",             kana:"かった",         trans:"あきらは今朝雑誌を%%買った%%ので、楽しく読みました。",                                           hint:"Akira _____ a magazine this morning and enjoyed reading it.",        tiles:["Akira","bought","a","magazine","this","morning","and","enjoyed","reading","it","."],             answer:"Akira bought a magazine this morning and enjoyed reading it ." },
      { en:"won",     kanji:"勝った",             kana:"かった",         trans:"ダニエルはアートコンテストで%%勝った%%ので、とても喜びました。",                                 hint:"Daniel _____ the art contest and was very excited.",                 tiles:["Daniel","won","the","art","contest","and","was","very","excited","."],                          answer:"Daniel won the art contest and was very excited ." },
      { en:"told",    kanji:"伝えた・言った",     kana:"つたえた",       trans:"彼がいい知らせを両親に%%伝えた%%とき、両親はとても喜びました。",                                 hint:"When he _____ his parents the good news, they were very happy.",    tiles:["When","he","told","his","parents","the","good","news","they","were","very","happy","."],        answer:"When he told his parents the good news they were very happy ." },
      { en:"wore",    kanji:"着た",               kana:"きた",           trans:"彼女は先週末のパーティーに新しいドレスを%%着た%%。",                                           hint:"She _____ her new dress to the party last weekend.",                 tiles:["She","wore","her","new","dress","to","the","party","last","weekend","."],                       answer:"She wore her new dress to the party last weekend ." },
      { en:"left",    kanji:"出発した・帰った",   kana:"かえった",       trans:"ヘンリーは具合が悪かったので昨日早く学校を%%出た%%。",                                         hint:"Henry _____ school early yesterday because he was sick.",            tiles:["Henry","left","school","early","yesterday","because","he","was","sick","."],                    answer:"Henry left school early yesterday because he was sick ." },
      { en:"taught",  kanji:"教えた",             kana:"おしえた",       trans:"ジョンはサッカーを練習しながらケンに英語の話し方を%%教えた%%。",                               hint:"John _____ Ken how to speak English while they practiced soccer.",  tiles:["John","taught","Ken","how","to","speak","English","while","they","practiced","soccer","."],    answer:"John taught Ken how to speak English while they practiced soccer ." },
      { en:"took",    kanji:"乗った・かかった",   kana:"とった",         trans:"祖父は去年初めて飛行機に%%乗った%%。",                                                         hint:"My grandfather _____ a plane for the first time last year.",        tiles:["My","grandfather","took","a","plane","for","the","first","time","last","year","."],             answer:"My grandfather took a plane for the first time last year ." },
      { en:"drove",   kanji:"運転した",           kana:"うんてんした",   trans:"週末に、ケンのホストファミリーはビーチや山へ車を%%運転した%%。",                               hint:"On weekends, Ken's host family _____ to the beach or the mountains.", tiles:["On","weekends","Ken's","host","family","drove","to","the","beach","or","the","mountains","."],  answer:"On weekends Ken's host family drove to the beach or the mountains ." },
    ],
  },
  {
    id: "g4_feelings", title: "Feelings & Descriptions / きもち", emoji: "😊",
    color: "#f59e0b", shadow: "#d97706",
    words: [
      { en:"excited",      kanji:"わくわくした",  kana:"わくわくした",   trans:"ダニエルは絵のレッスンを始めることに%%わくわくした%%。",                                   hint:"Daniel was _____ to begin taking art lessons after he won.",       tiles:["Daniel","was","excited","to","begin","taking","art","lessons","after","he","won","."],         answer:"Daniel was excited to begin taking art lessons after he won ." },
      { en:"nervous",      kanji:"緊張した",      kana:"きんちょうした", trans:"たくさんの人がコンテストに参加したので、ダニエルは%%緊張した%%。",                             hint:"Many people took part in the contest, so Daniel was _____.",       tiles:["Many","people","took","part","in","the","contest","so","Daniel","was","nervous","."],          answer:"Many people took part in the contest so Daniel was nervous ." },
      { en:"surprised",    kanji:"驚いた",        kana:"おどろいた",     trans:"彼が両親に話したとき、両親は%%驚いた%%が、とても喜んだ。",                                   hint:"When he told his parents, they were _____ but very happy.",        tiles:["When","he","told","his","parents","they","were","surprised","but","very","happy","."],         answer:"When he told his parents they were surprised but very happy ." },
      { en:"tired",        kanji:"疲れた",        kana:"つかれた",       trans:"ジャックは今日%%疲れた%%ので、家に帰って休んだほうがいい。",                                   hint:"Jack is _____ today — he should go home and rest.",               tiles:["Jack","is","tired","today","—","he","should","go","home","and","rest","."],                    answer:"Jack is tired today — he should go home and rest ." },
      { en:"wonderful",    kanji:"すばらしい",    kana:"すばらしい",     trans:"図書館で新しい仕事が決まった — それは%%すばらしい%%！",                                      hint:"I got a new job at the library — that's _____!",                  tiles:["I","got","a","new","job","at","the","library","—","that's","wonderful","!"],                   answer:"I got a new job at the library — that's wonderful !" },
      { en:"useful",       kanji:"役に立つ",      kana:"やくにたつ",     trans:"このウェブサイトはスポーツ情報を探すのにとても%%役に立つ%%。",                                 hint:"This website is very _____ for finding sports information.",      tiles:["This","website","is","very","useful","for","finding","sports","information","."],              answer:"This website is very useful for finding sports information ." },
      { en:"heavy",        kanji:"重い",          kana:"おもい",         trans:"タケルのカバンにはたくさんの本が入っていて、とても%%重い%%。",                                hint:"Takeru's bag has many books — it is very _____.",                 tiles:["Takeru's","bag","has","many","books","—","it","is","very","heavy","."],                        answer:"Takeru's bag has many books — it is very heavy ." },
      { en:"difficult",    kanji:"難しい",        kana:"むずかしい",     trans:"最初、ケンは英語が話せなかった — とても%%難しかった%%。",                                    hint:"At first, Ken couldn't speak English — it was very _____.",       tiles:["At","first","Ken","couldn't","speak","English","—","it","was","very","difficult","."],         answer:"At first Ken couldn't speak English — it was very difficult ." },
      { en:"professional", kanji:"プロの",        kana:"プロの",         trans:"けんたろうは将来%%プロ%%の野球選手になりたい。",                                             hint:"Kentaro wants to be a _____ baseball player in the future.",      tiles:["Kentaro","wants","to","be","a","professional","baseball","player","in","the","future","."],    answer:"Kentaro wants to be a professional baseball player in the future ." },
      { en:"delicious",    kanji:"おいしい",      kana:"おいしい",       trans:"私たちはスペインに行ってシーフードを食べた — %%おいしかった%%！",                             hint:"We went to Spain and ate seafood — it was _____!",                tiles:["We","went","to","Spain","and","ate","seafood","—","it","was","delicious","!"],                 answer:"We went to Spain and ate seafood — it was delicious !" },
    ],
  },
  {
    id: "g4_action_verbs", title: "Action Verbs / どうし", emoji: "🎯",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"understand", kanji:"理解する",    kana:"りかいする",     trans:"彼女は宿題が%%理解できなかった%%ので、ポールが助けてくれた。",                             hint:"She couldn't _____ her homework, so Paul helped her.",             tiles:["She","couldn't","understand","her","homework","so","Paul","helped","her","."],                 answer:"She couldn't understand her homework so Paul helped her ." },
      { en:"practice",   kanji:"練習する",    kana:"れんしゅうする", trans:"二人は上達するために毎日一緒にサッカーを%%練習した%%。",                                       hint:"They _____ soccer together every day to improve.",                 tiles:["They","practiced","soccer","together","every","day","to","improve","."],                       answer:"They practiced soccer together every day to improve ." },
      { en:"join",       kanji:"参加する",    kana:"さんかする",     trans:"彼は来月スポーツクラブに%%参加したい%%。",                                                     hint:"He wants to _____ a sports club next month.",                     tiles:["He","wants","to","join","a","sports","club","next","month","."],                               answer:"He wants to join a sports club next month ." },
      { en:"finish",     kanji:"終わる",      kana:"おわる",         trans:"部屋の掃除をいつ%%終わらせる%%の？",                                                         hint:"When will you _____ cleaning your room?",                         tiles:["When","will","you","finish","cleaning","your","room","?"],                                     answer:"When will you finish cleaning your room ?" },
      { en:"bring",      kanji:"持ってくる",  kana:"もってくる",     trans:"雨が降るかもしれないので、傘を%%持ってくる%%のを忘れないで。",                                  hint:"Don't forget to _____ your umbrella — it might rain.",            tiles:["Don't","forget","to","bring","your","umbrella","—","it","might","rain","."],                   answer:"Don't forget to bring your umbrella — it might rain ." },
      { en:"visit",      kanji:"訪ねる",      kana:"たずねる",       trans:"先月の7月、彼女はローマへ行っていくつかの博物館を%%訪れた%%。",                               hint:"Last July, she went to Rome and _____ some museums.",             tiles:["Last","July","she","went","to","Rome","and","visited","some","museums","."],                    answer:"Last July she went to Rome and visited some museums ." },
      { en:"arrive",     kanji:"到着する",    kana:"とうちゃくする", trans:"オリビアはコンサートホールに4時半に%%到着する%%。",                                          hint:"Olivia will _____ at the concert hall at 4:30.",                  tiles:["Olivia","will","arrive","at","the","concert","hall","at","4:30","."],                          answer:"Olivia will arrive at the concert hall at 4:30 ." },
      { en:"prepare",    kanji:"準備する",    kana:"じゅんびする",   trans:"スピーチコンテストの%%準備をする%%時間が十分にない。",                                        hint:"I don't have enough time to _____ for the speech contest.",       tiles:["I","don't","have","enough","time","to","prepare","for","the","speech","contest","."],          answer:"I don't have enough time to prepare for the speech contest ." },
      { en:"decide",     kanji:"決める",      kana:"きめる",         trans:"彼女は来月音楽教室に通うことを%%決めた%%。",                                                 hint:"She _____ to join a music school next month.",                    tiles:["She","decided","to","join","a","music","school","next","month","."],                           answer:"She decided to join a music school next month ." },
      { en:"win",        kanji:"勝つ",        kana:"かつ",           trans:"ケンはうまくプレーし、チームはオーストラリアでの最後の試合に%%勝った%%。",                    hint:"Ken played well and his team _____ the last game in Australia.", tiles:["Ken","played","well","and","his","team","won","the","last","game","in","Australia","."],       answer:"Ken played well and his team won the last game in Australia ." },
    ],
  },
  {
    id: "g4_time_expressions", title: "Time Expressions / 時間表現", emoji: "🕐",
    color: "#0ea5e9", shadow: "#0369a1",
    words: [
      { en:"last weekend",      kanji:"先週末",      kana:"せんしゅうまつ",    trans:"%%先週末%%、Mt.ベーカーでスノーボードをしました — 楽しかった！",                          hint:"I went snowboarding at Mt. Baker _____ — it was exciting.",   tiles:["I","went","snowboarding","at","Mt.","Baker","last","weekend","—","it","was","exciting","."],   answer:"I went snowboarding at Mt. Baker last weekend — it was exciting ." },
      { en:"next month",        kanji:"来月",        kana:"らいげつ",          trans:"%%来月%%一緒にスキーに行きましょう。",                                                    hint:"Let's go skiing together _____.",                              tiles:["Let's","go","skiing","together","next","month","."],                                          answer:"Let's go skiing together next month ." },
      { en:"after school",      kanji:"放課後",      kana:"ほうかご",          trans:"わたしはコミックを買うために%%放課後%%によく本屋に行きます。",                              hint:"I often go to the bookstore _____ to buy comic books.",        tiles:["I","often","go","to","the","bookstore","after","school","to","buy","comic","books","."],      answer:"I often go to the bookstore after school to buy comic books ." },
      { en:"before dinner",     kanji:"夕食の前",    kana:"ゆうしょくのまえ",  trans:"アリスは宿題が終わった後、%%夕食の前%%に読書をするのが好きです。",                        hint:"Alice loves to read _____ after she finishes her homework.",   tiles:["Alice","loves","to","read","before","dinner","after","she","finishes","her","homework","."],  answer:"Alice loves to read before dinner after she finishes her homework ." },
      { en:"every day",         kanji:"毎日",        kana:"まいにち",          trans:"二人は上達するために%%毎日%%一緒にサッカーを練習しました。",                              hint:"They practiced soccer together _____ to improve.",             tiles:["They","practiced","soccer","together","every","day","to","improve","."],                      answer:"They practiced soccer together every day to improve ." },
      { en:"for the first time",kanji:"初めて",      kana:"はじめて",          trans:"祖父は去年%%初めて%%飛行機に乗りました。",                                              hint:"My grandfather took a plane _____ last year.",                 tiles:["My","grandfather","took","a","plane","for","the","first","time","last","year","."],           answer:"My grandfather took a plane for the first time last year ." },
      { en:"at first",          kanji:"最初は",      kana:"さいしょは",        trans:"%%最初は%%、ケンはチームメイトに英語で話しかけられなかった。",                            hint:"_____, Ken couldn't speak to his teammates in English.",       tiles:["At","first","Ken","couldn't","speak","to","his","teammates","in","English","."],             answer:"At first Ken couldn't speak to his teammates in English ." },
      { en:"in the end",        kanji:"最終的に",    kana:"さいしゅうてきに",  trans:"%%最終的に%%、ダニエルはコンテストに勝って両親はとても喜んだ。",                         hint:"_____, Daniel won the contest and his parents were very happy.", tiles:["In","the","end","Daniel","won","the","contest","and","his","parents","were","very","happy","."], answer:"In the end Daniel won the contest and his parents were very happy ." },
      { en:"next week",         kanji:"来週",        kana:"らいしゅう",        trans:"英語スピーチコンテストは%%来週%%で、準備しなければなりません。",                          hint:"My English speech contest is _____ — I have to prepare.",      tiles:["My","English","speech","contest","is","next","week","—","I","have","to","prepare","."],      answer:"My English speech contest is next week — I have to prepare ." },
      { en:"this weekend",      kanji:"今週末",      kana:"こんしゅうまつ",    trans:"父が%%今週末%%スキーのやり方を教えてくれます。",                                        hint:"My father will teach me how to ski _____.",                    tiles:["My","father","will","teach","me","how","to","ski","this","weekend","."],                     answer:"My father will teach me how to ski this weekend ." },
    ],
  },
  {
    id: "g4_wh_questions", title: "WH Questions (Extended) / 疑問詞", emoji: "❓",
    color: "#8b5cf6", shadow: "#6d28d9",
    words: [
      { en:"How many",           kanji:"いくつ・何人",       kana:"いくつ",           hint:"_____ apples did Jack give to Sally?",                    tiles:["How","many","apples","did","Jack","give","to","Sally","?"],                    answer:"How many apples did Jack give to Sally ?" },
      { en:"How much",           kanji:"いくら・どのくらい", kana:"いくら",           hint:"_____ are these glasses?",                               tiles:["How","much","are","these","glasses","?"],                                      answer:"How much are these glasses ?" },
      { en:"How often",          kanji:"どのくらいの頻度で", kana:"どのくらいひんどで",hint:"_____ do you go to the gym?",                            tiles:["How","often","do","you","go","to","the","gym","?"],                           answer:"How often do you go to the gym ?" },
      { en:"How long",           kanji:"どのくらいの長さ・時間",kana:"どのくらい",    hint:"_____ is your ruler, Lily?",                             tiles:["How","long","is","your","ruler","Lily","?"],                                  answer:"How long is your ruler Lily ?" },
      { en:"How old",            kanji:"何歳",               kana:"なんさい",         hint:"_____ is your baby?",                                    tiles:["How","old","is","your","baby","?"],                                           answer:"How old is your baby ?" },
      { en:"How tall",           kanji:"どのくらいの高さ",   kana:"どのくらいたかさ", hint:"_____ is that tower?",                                   tiles:["How","tall","is","that","tower","?"],                                         answer:"How tall is that tower ?" },
      { en:"How long does it take",kanji:"どのくらい時間がかかる",kana:"どのくらいかかる",hint:"_____ to walk to the station?",                       tiles:["How","long","does","it","take","to","walk","to","the","station","?"],         answer:"How long does it take to walk to the station ?" },
      { en:"What time",          kanji:"何時",               kana:"なんじ",           hint:"_____ does the next train come?",                        tiles:["What","time","does","the","next","train","come","?"],                         answer:"What time does the next train come ?" },
      { en:"What kind of",       kanji:"どんな種類の",       kana:"どんなしゅるいの", hint:"_____ ice cream do you like, Bill?",                     tiles:["What","kind","of","ice","cream","do","you","like","Bill","?"],                answer:"What kind of ice cream do you like Bill ?" },
      { en:"Whose",              kanji:"誰の",               kana:"だれの",           hint:"_____ pet is black — is it Tom's?",                      tiles:["Whose","pet","is","black","—","is","it","Tom's","?"],                         answer:"Whose pet is black — is it Tom's ?" },
      { en:"Which",              kanji:"どちらの・どれ",     kana:"どちらの",         hint:"_____ class do they have next — history or math?",       tiles:["Which","class","do","they","have","next","—","history","or","math","?"],     answer:"Which class do they have next — history or math ?" },
      { en:"How far",            kanji:"どのくらいの距離",   kana:"どのくらいきょり", hint:"_____ is it from here to the subway station?",           tiles:["How","far","is","it","from","here","to","the","subway","station","?"],       answer:"How far is it from here to the subway station ?" },
    ],
  },
  {
    id: "g4_dialogue", title: "Dialogue Expressions / かいわ", emoji: "💬",
    color: "#f43f5e", shadow: "#be123c",
    words: [
      { en:"Sure, no problem.", kanji:"もちろん、いいよ。",   kana:"もちろん、いいよ。",  hint:"Can I read your magazine after you finish? ___________",              tiles:["Sure","no","problem","."],        answer:"Sure no problem ." },
      { en:"Just a minute.",    kanji:"ちょっと待って。",     kana:"ちょっとまって。",    hint:"Can you get my book from the table? ___________",                    tiles:["Just","a","minute","."],          answer:"Just a minute ." },
      { en:"I'll do my best.",  kanji:"頑張ります。",        kana:"がんばります。",      hint:"Good luck on your math test today! ___________",                     tiles:["I'll","do","my","best","."],      answer:"I'll do my best ." },
      { en:"Welcome back,",     kanji:"おかえり、",          kana:"おかえり、",          hint:"___________ Susan. How was your camping trip?",                     tiles:["Welcome","back",","],             answer:"Welcome back ," },
      { en:"That's wonderful!", kanji:"それはすばらしい！", kana:"それはすばらしい！",  hint:"I got a new job at the library. ___________",                        tiles:["That's","wonderful","!"],         answer:"That's wonderful !" },
      { en:"Sounds good.",      kanji:"いいね。",            kana:"いいね。",            hint:"Do you want to study together today? ___________",                   tiles:["Sounds","good","."],              answer:"Sounds good ." },
      { en:"Not today,",        kanji:"今日はちょっと、",   kana:"きょうはちょっと、",  hint:"Did you bring your soccer ball? ___________ but I'll bring it tomorrow.", tiles:["Not","today",","],           answer:"Not today ," },
      { en:"Wait for me.",      kanji:"待って！",            kana:"まって！",            hint:"We should go to the science room now. ___________ I have to get my notebook.", tiles:["Wait","for","me","."], answer:"Wait for me ." },
      { en:"Have a good time.", kanji:"楽しんできてね。",   kana:"たのしんできてね。",  hint:"Bye Mom, Dan and I are going to a party. OK, ___________",           tiles:["Have","a","good","time","."],    answer:"Have a good time ." },
      { en:"Don't worry.",      kanji:"心配しないで。",     kana:"しんぱいしないで。",  hint:"Sorry I forgot your book today. ___________ That's OK!",             tiles:["Don't","worry","."],              answer:"Don't worry ." },
      { en:"I had a good time.",kanji:"楽しかったよ。",     kana:"たのしかったよ。",    hint:"Were you at Sam's birthday party? How was it? ___________",         tiles:["I","had","a","good","time","."],  answer:"I had a good time ." },
      { en:"That's great!",     kanji:"すごいね！",          kana:"すごいね！",          hint:"I got a great grade on my math test. ___________",                   tiles:["That's","great","!"],             answer:"That's great !" },
    ],
  },
];

/* ── Grade 5 categories ── */
const VOCAB_CATEGORIES_5 = [
  {
    id: "ordinals_1", title: "Ordinal Numbers 1st–10th / じゅんじょ", emoji: "🔢",
    color: "#58cc02", shadow: "#3a9200",
    words: Array.from({ length: 10 }, (_, i) => makeOrdinal(i)),
  },
  {
    id: "ordinals_2", title: "Ordinal Numbers 11th–20th / じゅんじょ", emoji: "🔢",
    color: "#1cb0f6", shadow: "#0090cc",
    words: Array.from({ length: 10 }, (_, i) => makeOrdinal(i + 10)),
  },
  {
    id: "ordinals_3", title: "Ordinal Numbers 21st–31st / じゅんじょ", emoji: "🔢",
    color: "#a855f7", shadow: "#7c3aed",
    words: Array.from({ length: 11 }, (_, i) => makeOrdinal(i + 20)),
  },
  {
    id: "months", title: "Months of the Year / 月", emoji: "📅",
    color: "#ff6b9d", shadow: "#cc4477",
    words: Array.from({ length: 12 }, (_, i) => makeMonth(i)),
  },
  {
    id: "days", title: "Days of the Week / 曜日", emoji: "📆",
    color: "#ff9500", shadow: "#cc7700",
    words: [
      { en:"Monday",    kanji:"月曜日",kana:"げつようび",trans:"%%月曜日%%は学校の週の最初の日です。",            hint:"_____ is the first day of the school week.",tiles:["Monday","is","the","first","day","of","the","school","week","."],answer:"Monday is the first day of the school week ." },
      { en:"Tuesday",   kanji:"火曜日",kana:"かようび",  trans:"私たちは%%火曜日%%に体育があります。",             hint:"We have P.E. on _____.",                   tiles:["We","have","P.E.","on","Tuesday","."],                            answer:"We have P.E. on Tuesday ." },
      { en:"Wednesday", kanji:"水曜日",kana:"すいようび",trans:"%%水曜日%%は週の真ん中です。",                    hint:"_____ is the middle of the week.",          tiles:["Wednesday","is","the","middle","of","the","week","."],           answer:"Wednesday is the middle of the week ." },
      { en:"Thursday",  kanji:"木曜日",kana:"もくようび",trans:"私は%%木曜日%%に英語の授業があります。",           hint:"I have English class on _____.",            tiles:["I","have","English","class","on","Thursday","."],                answer:"I have English class on Thursday ." },
      { en:"Friday",    kanji:"金曜日",kana:"きんようび",trans:"%%金曜日%%は私の一週間で一番好きな日です。",       hint:"_____ is my favorite day of the week.",     tiles:["Friday","is","my","favorite","day","of","the","week","."],      answer:"Friday is my favorite day of the week ." },
      { en:"Saturday",  kanji:"土曜日",kana:"どようび",  trans:"私は%%土曜日%%にサッカーをします。",              hint:"I play soccer on _____.",                  tiles:["I","play","soccer","on","Saturday","."],                         answer:"I play soccer on Saturday ." },
      { en:"Sunday",    kanji:"日曜日",kana:"にちようび",trans:"私たちは%%日曜日%%に家でのんびりします。",         hint:"We rest at home on _____.",                 tiles:["We","rest","at","home","on","Sunday","."],                       answer:"We rest at home on Sunday ." },
    ],
  },
  {
    id: "wh_questions", title: "WH Questions / 疑問詞", emoji: "❓",
    color: "#ef4444", shadow: "#b91c1c",
    words: [
      { en:"What",  kanji:"何",       kana:"なに",       hint:"_____ is your name?",        tiles:["What","is","your","name","?"],          answer:"What is your name ?" },
      { en:"Where", kanji:"どこ",     kana:"どこ",       hint:"_____ is the library?",       tiles:["Where","is","the","library","?"],       answer:"Where is the library ?" },
      { en:"When",  kanji:"いつ",     kana:"いつ",       hint:"_____ is your birthday?",     tiles:["When","is","your","birthday","?"],      answer:"When is your birthday ?" },
      { en:"Who",   kanji:"だれ",     kana:"だれ",       hint:"_____ is your teacher?",      tiles:["Who","is","your","teacher","?"],        answer:"Who is your teacher ?" },
      { en:"Why",   kanji:"なぜ",     kana:"なぜ",       hint:"_____ do you study English?", tiles:["Why","do","you","study","English","?"],answer:"Why do you study English ?" },
      { en:"How",   kanji:"どうやって",kana:"どうやって", hint:"_____ do you go to school?",  tiles:["How","do","you","go","to","school","?"],answer:"How do you go to school ?" },
      { en:"Which", kanji:"どれ",     kana:"どれ",       hint:"_____ bag is yours?",          tiles:["Which","bag","is","yours","?"],         answer:"Which bag is yours ?" },
      { en:"Whose", kanji:"だれの",   kana:"だれの",     hint:"_____ book is this?",          tiles:["Whose","book","is","this","?"],         answer:"Whose book is this ?" },
    ],
  },
  {
    id: "family_1", title: "Family 1 / かぞく①", emoji: "👨‍👩‍👧",
    color: "#f59e0b", shadow: "#d97706",
    words: [
      { en:"mother",      kanji:"お母さん",  kana:"おかあさん",  trans:"私の%%お母さん%%は毎晩夕食を作ります。",            hint:"My _____ cooks dinner every night.",     tiles:["My","mother","cooks","dinner","every","night","."],     answer:"My mother cooks dinner every night ." },
      { en:"father",      kanji:"お父さん",  kana:"おとうさん",  trans:"私の%%お父さん%%は電車で仕事に行きます。",          hint:"My _____ goes to work by train.",        tiles:["My","father","goes","to","work","by","train","."],      answer:"My father goes to work by train ." },
      { en:"brother",     kanji:"お兄さん",  kana:"おにいさん",  trans:"私の%%お兄さん%%は放課後サッカーをします。",        hint:"My _____ plays soccer after school.",    tiles:["My","brother","plays","soccer","after","school","."],   answer:"My brother plays soccer after school ." },
      { en:"sister",      kanji:"お姉さん",  kana:"おねえさん",  trans:"私の%%お姉さん%%は本を読むのが好きです。",          hint:"My _____ likes reading books.",          tiles:["My","sister","likes","reading","books","."],            answer:"My sister likes reading books ." },
      { en:"grandfather", kanji:"おじいさん",kana:"おじいさん",  trans:"私の%%おじいさん%%は田舎に住んでいます。",          hint:"My _____ lives in the countryside.",     tiles:["My","grandfather","lives","in","the","countryside","."],answer:"My grandfather lives in the countryside ." },
      { en:"grandmother", kanji:"おばあさん",kana:"おばあさん",  trans:"私の%%おばあさん%%はおいしいおにぎりを作ります。",   hint:"My _____ makes delicious rice balls.",   tiles:["My","grandmother","makes","delicious","rice","balls","."],answer:"My grandmother makes delicious rice balls ." },
      { en:"cousin",      kanji:"いとこ",   kana:"いとこ",     trans:"私の%%いとこ%%は大阪に住んでいます。",              hint:"My _____ lives in Osaka.",               tiles:["My","cousin","lives","in","Osaka","."],                answer:"My cousin lives in Osaka ." },
    ],
  },
  {
    id: "family_2", title: "Family 2 / かぞく②", emoji: "👨‍👩‍👧",
    color: "#f59e0b", shadow: "#d97706",
    words: [
      { en:"uncle",       kanji:"おじさん", kana:"おじさん",   trans:"%%おじさん%%は私にプレゼントをくれました。",        hint:"My _____ gave me a present.",            tiles:["My","uncle","gave","me","a","present","."],             answer:"My uncle gave me a present ." },
      { en:"aunt",        kanji:"おばさん", kana:"おばさん",   trans:"%%おばさん%%はケーキを焼くのが上手です。",          hint:"My _____ is good at baking cakes.",      tiles:["My","aunt","is","good","at","baking","cakes","."],      answer:"My aunt is good at baking cakes ." },
      { en:"nephew",      kanji:"おい",     kana:"おい",       trans:"私の%%おい%%は三歳です。",                        hint:"My _____ is three years old.",           tiles:["My","nephew","is","three","years","old","."],           answer:"My nephew is three years old ." },
      { en:"niece",       kanji:"めい",     kana:"めい",       trans:"私の%%めい%%はピアノが弾けます。",                 hint:"My _____ can play the piano.",           tiles:["My","niece","can","play","the","piano","."],            answer:"My niece can play the piano ." },
      { en:"son",         kanji:"むすこ",   kana:"むすこ",     trans:"山田さんの%%むすこ%%は医者です。",                 hint:"Mr. Yamada's _____ is a doctor.",        tiles:["Mr.","Yamada's","son","is","a","doctor","."],           answer:"Mr. Yamada's son is a doctor ." },
      { en:"daughter",    kanji:"むすめ",   kana:"むすめ",     trans:"山田さんの%%むすめ%%は歌手です。",                 hint:"Mr. Yamada's _____ is a singer.",        tiles:["Mr.","Yamada's","daughter","is","a","singer","."],      answer:"Mr. Yamada's daughter is a singer ." },
      { en:"parents",     kanji:"両親",     kana:"りょうしん",  trans:"私の%%両親%%は京都に住んでいます。",               hint:"My _____ live in Kyoto.",                tiles:["My","parents","live","in","Kyoto","."],                 answer:"My parents live in Kyoto ." },
    ],
  },
  {
    id: "weather", title: "Weather & Seasons / てんき・きせつ", emoji: "☀️",
    color: "#06b6d4", shadow: "#0891b2",
    words: [
      { en:"sunny",  kanji:"晴れ",  kana:"はれ",  trans:"今日は%%晴れ%%です。公園に行きましょう！",              hint:"It is _____ today. Let's go to the park!",  tiles:["It","is","sunny","today",".","Let's","go","to","the","park","!"],answer:"It is sunny today . Let's go to the park !" },
      { en:"cloudy", kanji:"くもり",kana:"くもり",trans:"今朝は%%くもり%%で寒いです。",                          hint:"It is _____ and cold this morning.",          tiles:["It","is","cloudy","and","cold","this","morning","."],              answer:"It is cloudy and cold this morning ." },
      { en:"rainy",  kanji:"雨",   kana:"あめ",  trans:"%%雨%%が降っています。傘が必要です。",                  hint:"It is _____. I need my umbrella.",           tiles:["It","is","rainy",".","I","need","my","umbrella","."],              answer:"It is rainy . I need my umbrella ." },
      { en:"snowy",  kanji:"雪",   kana:"ゆき",  trans:"1月は%%雪%%が降ります。",                            hint:"It is _____ in January.",                     tiles:["It","is","snowy","in","January","."],                              answer:"It is snowy in January ." },
      { en:"spring", kanji:"春",   kana:"はる",  trans:"桜の花は%%春%%に咲きます。",                          hint:"Cherry blossoms bloom in _____.",             tiles:["Cherry","blossoms","bloom","in","spring","."],                    answer:"Cherry blossoms bloom in spring ." },
      { en:"summer", kanji:"夏",   kana:"なつ",  trans:"%%夏%%が大好きです。",                                hint:"I love _____.",                               tiles:["I","love","summer","."],                                          answer:"I love summer ." },
      { en:"fall",   kanji:"秋",   kana:"あき",  trans:"%%秋%%には葉が赤くなります。",                        hint:"Leaves turn red in _____.",                  tiles:["Leaves","turn","red","in","fall","."],                            answer:"Leaves turn red in fall ." },
      { en:"winter", kanji:"冬",   kana:"ふゆ",  trans:"%%冬%%にはコートを着ます。",                         hint:"I wear a coat in _____.",                     tiles:["I","wear","a","coat","in","winter","."],                           answer:"I wear a coat in winter ." },
    ],
  },
  {
    id: "colors", title: "Colors / いろ", emoji: "🎨",
    color: "#ec4899", shadow: "#be185d",
    words: [
      { en:"red",    kanji:"赤",       kana:"あか",       trans:"私の筆箱に%%赤%%いペンがあります。",                    hint:"I have a _____ pen in my pencil case.",     tiles:["I","have","a","red","pen","in","my","pencil","case","."],    answer:"I have a red pen in my pencil case ." },
      { en:"blue",   kanji:"青",       kana:"あお",       trans:"今日の空は%%青%%です。",                              hint:"The sky is _____ today.",                   tiles:["The","sky","is","blue","today","."],                         answer:"The sky is blue today ." },
      { en:"green",  kanji:"緑",       kana:"みどり",     trans:"%%緑%%が好きです。",                                   hint:"I like _____.",                                   tiles:["I","like","green","."],                                                answer:"I like green ." },
      { en:"yellow", kanji:"黄色",     kana:"きいろ",     trans:"私は%%黄色%%のノートを持っています。",                   hint:"I have a _____ notebook.",                  tiles:["I","have","a","yellow","notebook","."],                      answer:"I have a yellow notebook ." },
      { en:"white",  kanji:"白",       kana:"しろ",       trans:"私の学校のシャツは%%白%%です。",                       hint:"My school shirt is _____.",                 tiles:["My","school","shirt","is","white","."],                      answer:"My school shirt is white ." },
      { en:"black",  kanji:"黒",       kana:"くろ",       trans:"私のカバンは%%黒%%です。",                           hint:"My bag is _____.",                          tiles:["My","bag","is","black","."],                                 answer:"My bag is black ." },
      { en:"brown",  kanji:"茶色",     kana:"ちゃいろ",   trans:"私の好きな色は%%茶色%%です。",                        hint:"My favorite color is _____.",               tiles:["My","favorite","color","is","brown","."],                    answer:"My favorite color is brown ." },
      { en:"pink",   kanji:"ピンク",   kana:"ピンク",     trans:"妹のTシャツは%%ピンク%%です。",                       hint:"My sister's T-shirt is _____.",             tiles:["My","sister's","T-shirt","is","pink","."],                   answer:"My sister's T-shirt is pink ." },
      { en:"orange", kanji:"オレンジ", kana:"オレンジ",   trans:"朝は%%オレンジ%%ジュースが好きです。",                  hint:"I like _____ juice in the morning.",         tiles:["I","like","orange","juice","in","the","morning","."],        answer:"I like orange juice in the morning ." },
      { en:"purple", kanji:"むらさき", kana:"むらさき",   trans:"庭の花は%%むらさき%%です。",                          hint:"The flowers in the garden are _____.",       tiles:["The","flowers","in","the","garden","are","purple","."],      answer:"The flowers in the garden are purple ." },
    ],
  },
  {
    id: "adjectives", title: "Adjectives / けいようし", emoji: "✨",
    color: "#8b5cf6", shadow: "#6d28d9",
    words: [
      { en:"hot",        kanji:"暑い・熱い", kana:"あつい",       trans:"今日はとても%%暑い%%です。冷たい水を飲みましょう！",    hint:"It is very _____ today. Let's drink cold water.",  tiles:["It","is","very","hot","today",".","Let's","drink","cold","water","."], answer:"It is very hot today . Let's drink cold water ." },
      { en:"cold",       kanji:"寒い・冷たい",kana:"さむい",      trans:"今日は%%寒い%%のでコートを着ます。",                    hint:"It is _____ today, so I wear a coat.",              tiles:["It","is","cold","today","so","I","wear","a","coat","."],            answer:"It is cold today so I wear a coat ." },
      { en:"cool",       kanji:"涼しい",    kana:"すずしい",      trans:"今日は曇っていて%%涼しい%%です。",                      hint:"It is cloudy and _____ today.",                    tiles:["It","is","cloudy","and","cool","today","."],                       answer:"It is cloudy and cool today ." },
      { en:"nice",       kanji:"すてきな",  kana:"すてきな",      trans:"あなたの新しい靴は%%すてき%%ですね！",                  hint:"Your new shoes are _____!",                        tiles:["Your","new","shoes","are","nice","!"],                             answer:"Your new shoes are nice !" },
      { en:"cute",       kanji:"かわいい",  kana:"かわいい",      trans:"私の猫はとても%%かわいい%%です。",                      hint:"My cat is very _____.",                            tiles:["My","cat","is","very","cute","."],                                 answer:"My cat is very cute ." },
      { en:"great",      kanji:"すばらしい",kana:"すばらしい",    trans:"これは私の新しいパソコンです。%%すばらしい%%！",        hint:"This is my new computer. It is _____!",            tiles:["This","is","my","new","computer",".","It","is","great","!"],      answer:"This is my new computer . It is great !" },
      { en:"delicious",  kanji:"おいしい",  kana:"おいしい",      trans:"このレストランのデザートは%%おいしい%%です。",           hint:"The desserts at this restaurant are _____.",       tiles:["The","desserts","at","this","restaurant","are","delicious","."],  answer:"The desserts at this restaurant are delicious ." },
      { en:"tall",       kanji:"高い・背が高い",kana:"せがたかい", trans:"あの塔はとても%%高い%%です。",                         hint:"That tower is very _____.",                        tiles:["That","tower","is","very","tall","."],                             answer:"That tower is very tall ." },
      { en:"short",      kanji:"短い・背が低い",kana:"みじかい",   trans:"私の定規は%%短い%%です。",                            hint:"My ruler is _____.",                               tiles:["My","ruler","is","short","."],                                     answer:"My ruler is short ." },
      { en:"busy",       kanji:"忙しい",    kana:"いそがしい",    trans:"月曜日から金曜日まで、とても%%忙しい%%です。",           hint:"I am very _____ from Monday to Friday.",           tiles:["I","am","very","busy","from","Monday","to","Friday","."],         answer:"I am very busy from Monday to Friday ." },
    ],
  },
  {
    id: "action_verbs", title: "Action Verbs / どうし", emoji: "🏃",
    color: "#f97316", shadow: "#c2410c",
    words: [
      { en:"draw",   kanji:"かく（絵を）",kana:"えをかく",   trans:"彼は自由な時間に花の絵を%%かきます%%。",                hint:"He _____ pictures of flowers in his free time.",    tiles:["He","draws","pictures","of","flowers","in","his","free","time","."], answer:"He draws pictures of flowers in his free time ." },
      { en:"wash",   kanji:"洗う",       kana:"あらう",     trans:"マイクは庭で自分の犬を%%洗って%%います。",              hint:"Mike is _____ his dog in the garden.",              tiles:["Mike","is","washing","his","dog","in","the","garden","."],          answer:"Mike is washing his dog in the garden ." },
      { en:"wear",   kanji:"着る",       kana:"きる",       trans:"今日はとても寒いのでコートを%%着て%%ください。",         hint:"Please _____ a coat. It is very cold.",      tiles:["Please","wear","a","coat",".","It","is","very","cold","."], answer:"Please wear a coat . It is very cold ." },
      { en:"catch",  kanji:"つかまえる", kana:"つかまえる", trans:"私の犬はボールを%%つかまえる%%ことができます。",           hint:"My dog can _____ a ball.",                    tiles:["My","dog","can","catch","a","ball","."],                            answer:"My dog can catch a ball ." },
      { en:"paint",  kanji:"ぬる・かく", kana:"えをかく",   trans:"この壁を%%ぬって%%ください。",                          hint:"Please _____ this wall.",                           tiles:["Please","paint","this","wall","."],                                 answer:"Please paint this wall ." },
      { en:"open",   kanji:"開ける",     kana:"あける",     trans:"教科書を%%開けて%%ください。",                          hint:"Please _____ your book.",                           tiles:["Please","open","your","book","."],                                  answer:"Please open your book ." },
      { en:"close",  kanji:"閉める",     kana:"しめる",     trans:"寒いので窓を%%閉めて%%ください。",                      hint:"Please _____ the windows. It is cold.",           tiles:["Please","close","the","windows",".","It","is","cold","."],         answer:"Please close the windows . It is cold ." },
      { en:"teach",  kanji:"教える",     kana:"おしえる",   trans:"トムのお父さんは大学で何を%%教えて%%いますか？",         hint:"What does Tom's father _____ at college?",          tiles:["What","does","Tom's","father","teach","at","college","?"],          answer:"What does Tom's father teach at college ?" },
      { en:"take",   kanji:"とる（写真）",kana:"しゃしんをとる",trans:"ジュリアはカメラでよく写真を%%とります%%。",         hint:"Julia often _____ pictures with her camera.", tiles:["Julia","often","takes","pictures","with","her","camera","."],       answer:"Julia often takes pictures with her camera ." },
      { en:"use",    kanji:"使う",       kana:"つかう",     trans:"わたしは新しい言葉を調べるために辞書を%%使います%%。",   hint:"I _____ a dictionary to find new words.",           tiles:["I","use","a","dictionary","to","find","new","words","."],           answer:"I use a dictionary to find new words ." },
    ],
  },
  {
    id: "sports_1", title: "Sports & Hobbies 1 / スポーツ①", emoji: "⚽",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"soccer",     kanji:"サッカー",   kana:"サッカー",   trans:"私は毎日午後、公園で%%サッカー%%をします。",           hint:"I play _____ at the park every afternoon.",        tiles:["I","play","soccer","at","the","park","every","afternoon","."],     answer:"I play soccer at the park every afternoon ." },
      { en:"tennis",     kanji:"テニス",     kana:"テニス",     trans:"わたしは%%テニス%%が好きです。あなたはどうですか？",   hint:"I like _____. Do you like it?",                   tiles:["I","like","tennis",".","Do","you","like","it","?"],                  answer:"I like tennis . Do you like it ?" },
      { en:"volleyball", kanji:"バレーボール",kana:"バレーボール",trans:"楽しいので%%バレーボール%%が好きです。",             hint:"I like _____ because it is fun.",                 tiles:["I","like","volleyball","because","it","is","fun","."],             answer:"I like volleyball because it is fun ." },
      { en:"basketball", kanji:"バスケットボール",kana:"バスケットボール",trans:"わたしは%%バスケットボール%%が大好きで、テレビで試合を見ます。", hint:"I love _____ and I watch games on TV.", tiles:["I","love","basketball","and","I","watch","games","on","TV","."],   answer:"I love basketball and I watch games on TV ." },
      { en:"badminton",  kanji:"バドミントン",kana:"バドミントン",trans:"公園で%%バドミントン%%をしましょう。",               hint:"Let's play _____ at the park.",                  tiles:["Let's","play","badminton","at","the","park","."],                  answer:"Let's play badminton at the park ." },
      { en:"swimming",   kanji:"水泳",       kana:"すいえい",   trans:"ジャネットは毎週日曜日、妹と一緒に%%水泳%%をします。", hint:"Janet goes _____ every Sunday with her sister.",   tiles:["Janet","goes","swimming","every","Sunday","with","her","sister","."], answer:"Janet goes swimming every Sunday with her sister ." },
      { en:"skiing",     kanji:"スキー",     kana:"スキー",     trans:"お姉さんは毎年%%スキー%%に行きますか？",              hint:"Does your sister go _____ every year?",            tiles:["Does","your","sister","go","skiing","every","year","?"],           answer:"Does your sister go skiing every year ?" },
    ],
  },
  {
    id: "sports_2", title: "Sports & Hobbies 2 / スポーツ②", emoji: "🎵",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"jogging",    kanji:"ジョギング", kana:"ジョギング", trans:"ゆきのお父さんは朝よく%%ジョギング%%をします。",       hint:"Yuki's father often goes _____ in the morning.",   tiles:["Yuki's","father","often","goes","jogging","in","the","morning","."], answer:"Yuki's father often goes jogging in the morning ." },
      { en:"music",      kanji:"音楽",       kana:"おんがく",   trans:"ヘンリーは%%音楽%%が好きです。彼は音楽家です。",         hint:"Henry likes _____. He is a musician.",            tiles:["Henry","likes","music",".","He","is","a","musician","."],          answer:"Henry likes music . He is a musician ." },
      { en:"camera",       kanji:"カメラ",       kana:"カメラ",       trans:"ジュリアは%%カメラ%%を持っています。彼女はよく写真を撮ります。",       hint:"Julia has a _____. She takes pictures.", tiles:["Julia","has","a","camera",".","She","takes","pictures","."], answer:"Julia has a camera . She takes pictures ." },
      { en:"baseball",     kanji:"野球",         kana:"やきゅう",     trans:"私の兄は%%野球%%が得意です。",                           hint:"My brother is good at _____.",             tiles:["My","brother","is","good","at","baseball","."],            answer:"My brother is good at baseball ." },
      { en:"table tennis", kanji:"卓球",         kana:"たっきゅう",   trans:"私は学校の体育館で%%卓球%%をします。",                   hint:"I play _____ in the school gym.",           tiles:["I","play","table","tennis","in","the","school","gym","."], answer:"I play table tennis in the school gym ." },
      { en:"golf",         kanji:"ゴルフ",       kana:"ゴルフ",       trans:"私のお父さんは週末に%%ゴルフ%%をします。",               hint:"My father plays _____ on weekends.",        tiles:["My","father","plays","golf","on","weekends","."],          answer:"My father plays golf on weekends ." },
      { en:"skating",      kanji:"スケート",     kana:"スケート",     trans:"冬に%%スケート%%をするのが好きです。",                   hint:"I like _____ in winter.",                  tiles:["I","like","skating","in","winter","."],                    answer:"I like skating in winter ." },
    ],
  },
  {
    id: "home_rooms", title: "Home & Rooms / いえ・へや", emoji: "🏠",
    color: "#0ea5e9", shadow: "#0369a1",
    words: [
      { en:"kitchen",     kanji:"台所",      kana:"だいどころ", trans:"母は%%台所%%で夕食を作っています。",                    hint:"My mom is cooking dinner in the _____.",           tiles:["My","mom","is","cooking","dinner","in","the","kitchen","."],       answer:"My mom is cooking dinner in the kitchen ." },
      { en:"living room", kanji:"リビング",  kana:"リビング",   trans:"キムは%%リビング%%でテレビを見ていますか？",           hint:"Is Kim watching TV in the _____?",                 tiles:["Is","Kim","watching","TV","in","the","living","room","?"],          answer:"Is Kim watching TV in the living room ?" },
      { en:"bathroom",    kanji:"お風呂",    kana:"おふろ",     trans:"猫は%%お風呂%%にいます。",                          hint:"The cat is in the _____.",                         tiles:["The","cat","is","in","the","bathroom","."],                        answer:"The cat is in the bathroom ." },
      { en:"bedroom",     kanji:"寝室",      kana:"しんしつ",   trans:"パジャマは%%寝室%%のベッドの上にあります。",           hint:"My pajamas are on my bed in the _____.",           tiles:["My","pajamas","are","on","my","bed","in","the","bedroom","."],     answer:"My pajamas are on my bed in the bedroom ." },
      { en:"garden",      kanji:"庭",        kana:"にわ",       trans:"ハラさんのお家の%%庭%%には大きな木があります。",       hint:"Mr. Hara has a big tree in his _____.",            tiles:["Mr.","Hara","has","a","big","tree","in","his","garden","."],       answer:"Mr. Hara has a big tree in his garden ." },
      { en:"floor",       kanji:"床",        kana:"ゆか",       trans:"%%床%%に座ってテレビを見ましょう。",                  hint:"Let's sit down on the _____ and watch TV.",        tiles:["Let's","sit","down","on","the","floor","and","watch","TV","."],    answer:"Let's sit down on the floor and watch TV ." },
      { en:"table",       kanji:"テーブル",  kana:"テーブル",   trans:"%%テーブル%%の上に歴史の本があります。",              hint:"There is a history book on the _____.",            tiles:["There","is","a","history","book","on","the","table","."],          answer:"There is a history book on the table ." },
      { en:"chair",       kanji:"いす",      kana:"いす",       trans:"赤いペンが%%いす%%の下にあります。",                  hint:"My red pen is under my _____.",                    tiles:["My","red","pen","is","under","my","chair","."],                    answer:"My red pen is under my chair ." },
      { en:"bed",         kanji:"ベッド",    kana:"ベッド",     trans:"パジャマは%%ベッド%%の上にあります。",                hint:"Your pajamas are on your _____.",                  tiles:["Your","pajamas","are","on","your","bed","."],                      answer:"Your pajamas are on your bed ." },
      { en:"window",      kanji:"窓",        kana:"まど",       trans:"寒いので%%窓%%を閉めてください。",                    hint:"Please close the _____. It is cold.",             tiles:["Please","close","the","window",".","It","is","cold","."],          answer:"Please close the window . It is cold ." },
    ],
  },
  {
    id: "animals", title: "Animals / どうぶつ", emoji: "🐾",
    color: "#84cc16", shadow: "#4d7c0f",
    words: [
      { en:"dog",      kanji:"犬",     kana:"いぬ",       trans:"マイクは庭で%%犬%%を洗っています。",                    hint:"Mike is washing his _____ in the garden.",         tiles:["Mike","is","washing","his","dog","in","the","garden","."],         answer:"Mike is washing his dog in the garden ." },
      { en:"cat",      kanji:"猫",     kana:"ねこ",       trans:"私には%%猫%%がいます。とてもかわいいです。",            hint:"I have a _____. She is very cute.",               tiles:["I","have","a","cat",".","She","is","very","cute","."],             answer:"I have a cat . She is very cute ." },
      { en:"rabbit",   kanji:"うさぎ", kana:"うさぎ",     trans:"妹はペットの%%うさぎ%%を飼っています。",                 hint:"My sister has a pet _____.",                       tiles:["My","sister","has","a","pet","rabbit","."],                        answer:"My sister has a pet rabbit ." },
      { en:"bird",     kanji:"鳥",     kana:"とり",       trans:"タロウの頭の上に%%鳥%%がいます。",                     hint:"A _____ is on Taro's head.",                        tiles:["A","bird","is","on","Taro's","head","."],                          answer:"A bird is on Taro's head ." },
      { en:"fish",     kanji:"魚",     kana:"さかな",     trans:"この川で%%魚%%を釣ることができます。",                  hint:"We can catch _____ in this river.",                 tiles:["We","can","catch","fish","in","this","river","."],                 answer:"We can catch fish in this river ." },
      { en:"elephant", kanji:"ぞう",   kana:"ぞう",       trans:"動物園で%%ぞう%%を見ました。",                          hint:"I see an _____ at the zoo.",                       tiles:["I","see","an","elephant","at","the","zoo","."],                     answer:"I see an elephant at the zoo ." },
      { en:"horse",    kanji:"馬",     kana:"うま",       trans:"カレンは自分の%%馬%%が好きです。",                     hint:"Karen likes her _____.",                            tiles:["Karen","likes","her","horse","."],                                 answer:"Karen likes her horse ." },
      { en:"hamster",  kanji:"ハムスター",kana:"ハムスター",trans:"カレンは%%ハムスター%%を飼っています。",                  hint:"Karen has a _____.",                              tiles:["Karen","has","a","hamster","."],                                    answer:"Karen has a hamster ." },
      { en:"sheep",    kanji:"羊",     kana:"ひつじ",     trans:"農場にはたくさんの%%羊%%がいます。",                   hint:"There are many _____ on the farm.",                 tiles:["There","are","many","sheep","on","the","farm","."],                answer:"There are many sheep on the farm ." },
      { en:"butterfly",kanji:"ちょうちょ",kana:"ちょうちょ",trans:"%%ちょうちょ%%が私たちの庭に飛んできました。",         hint:"A _____ flew into our garden.",                  tiles:["A","butterfly","flew","into","our","garden","."],                  answer:"A butterfly flew into our garden ." },
    ],
  },
  {
    id: "prepositions", title: "Prepositions / 前置詞", emoji: "📍",
    color: "#6366f1", shadow: "#4338ca",
    words: [
      { en:"in",    kanji:"〜の中に・〜に", kana:"なかに",      trans:"猫は台所の%%中に%%います。",                                hint:"The cat is _____ the kitchen.",                    tiles:["The","cat","is","in","the","kitchen","."],                         answer:"The cat is in the kitchen ." },
      { en:"on",    kanji:"〜の上に",       kana:"うえに",      trans:"りんごは箱の%%上に%%あります。",                            hint:"The apples are _____ the box.",                    tiles:["The","apples","are","on","the","box","."],                         answer:"The apples are on the box ." },
      { en:"under", kanji:"〜の下に",       kana:"したに",      trans:"赤いペンはいすの%%下に%%あります。",                        hint:"My red pen is _____ the chair.",                   tiles:["My","red","pen","is","under","the","chair","."],                   answer:"My red pen is under the chair ." },
      { en:"by",    kanji:"〜のそばに",     kana:"そばに",      trans:"ヘレンは川の%%そばに%%座っています。",                      hint:"Helen is sitting _____ the river.",                tiles:["Helen","is","sitting","by","the","river","."],                     answer:"Helen is sitting by the river ." },
      { en:"at",    kanji:"〜に（場所・時間）",kana:"に",        trans:"母は病院%%で%%働いています。",                              hint:"My mother works _____ the hospital.",              tiles:["My","mother","works","at","the","hospital","."],                   answer:"My mother works at the hospital ." },
      { en:"from",  kanji:"〜から・〜出身の",kana:"から",       trans:"英語の先生はオーストラリア%%から%%来ました。",               hint:"My English teacher is _____ Australia.",           tiles:["My","English","teacher","is","from","Australia","."],              answer:"My English teacher is from Australia ." },
      { en:"to",    kanji:"〜へ・〜に",     kana:"へ",          trans:"私は毎朝学校%%に%%歩いて行きます。",                        hint:"I walk _____ school every morning.",               tiles:["I","walk","to","school","every","morning","."],                    answer:"I walk to school every morning ." },
      { en:"with",  kanji:"〜と一緒に",     kana:"いっしょに",  trans:"わたしは兄%%と一緒に%%バスケットボールをします。",            hint:"I play basketball _____ my brother.",              tiles:["I","play","basketball","with","my","brother","."],                 answer:"I play basketball with my brother ." },
      { en:"for",   kanji:"〜のために",     kana:"ために",      trans:"わたしはひろし%%のために%%朝ごはんを作っています。",         hint:"I am cooking breakfast _____ Hiroshi.",            tiles:["I","am","cooking","breakfast","for","Hiroshi","."],                answer:"I am cooking breakfast for Hiroshi ." },
      { en:"about", kanji:"〜について",     kana:"について",    trans:"%%あなたはどうですか%%、レイチェル — テニスは好きですか？",  hint:"What _____ you, Rachel — do you like tennis?",     tiles:["What","about","you","Rachel","—","do","you","like","tennis","?"], answer:"What about you Rachel — do you like tennis ?" },
    ],
  },
  {
    id: "dialogue_expressions", title: "Dialogue Expressions 1 / かいわ①", emoji: "💬",
    color: "#f43f5e", shadow: "#be123c",
    words: [
      { en:"Nice to meet you.",  kanji:"はじめまして。",      kana:"はじめまして。",      speakerA:"Hello! I'm your new English teacher.",        hint:"Hello! I'm your new English teacher. ___________",        tiles:["Nice","to","meet","you","."],   answer:"Nice to meet you ." },
      { en:"Yes, let's.",        kanji:"そうしましょう。",    kana:"そうしましょう。",    speakerA:"Let's play badminton at the park!",           hint:"Let's play badminton at the park! ___________",           tiles:["Yes","let's","."],             answer:"Yes let's ." },
      { en:"That's right.",      kanji:"そうです。",          kana:"そうです。",          speakerA:"Do you live in London?",                      hint:"Do you live in London? ___________",                      tiles:["That's","right","."],          answer:"That's right ." },
      { en:"Good idea.",         kanji:"いい考えですね。",    kana:"いいかんがえですね。",speakerA:"Let's eat lunch at home.",                    hint:"Let's eat lunch at home. ___________",                    tiles:["Good","idea","."],             answer:"Good idea ." },
      { en:"Here you are.",      kanji:"はい、どうぞ。",      kana:"はい、どうぞ。",      speakerA:"Can I have some sugar, please?",              hint:"Can I have some sugar, please? ___________",              tiles:["Here","you","are","."],        answer:"Here you are ." },
      { en:"Of course.",         kanji:"もちろん。",          kana:"もちろん。",          speakerA:"Mom, can I write a letter to Uncle Rob?",    hint:"Mom, can I write a letter to Uncle Rob? ___________",    tiles:["Of","course","."],             answer:"Of course ." },
    ],
  },
  {
    id: "dialogue_expressions_2", title: "Dialogue Expressions 2 / かいわ②", emoji: "💬",
    color: "#f43f5e", shadow: "#be123c",
    words: [
      { en:"All right.",         kanji:"わかりました。",      kana:"わかりました。",      speakerA:"Bob, come here and help me with dinner.",    hint:"Bob, come here and help me with dinner. ___________",    tiles:["All","right","."],             answer:"All right ." },
      { en:"Excuse me.",         kanji:"すみません。",        kana:"すみません。",        speakerA:"What time does the next train come?",         hint:"___________. What time does the next train come?",        tiles:["Excuse","me","."],             answer:"Excuse me ." },
      { en:"I see.",             kanji:"なるほど。",          kana:"なるほど。",          speakerA:"I have a cold, so I can't play soccer today.",hint:"I have a cold, so I can't play soccer today. ___________",tiles:["I","see","."],                 answer:"I see ." },
      { en:"You're welcome.",    kanji:"どういたしまして。",  kana:"どういたしまして。",  speakerA:"Thank you so much!",                          hint:"Thank you so much! ___________",                          tiles:["You're","welcome","."],        answer:"You're welcome ." },
      { en:"Me, too.",           kanji:"わたしもです。",      kana:"わたしもです。",      speakerA:"I like cats. How about you?",                 hint:"I like cats. How about you? ___________",                 tiles:["Me","too","."],                answer:"Me too ." },
      { en:"No, I can't.",       kanji:"いいえ、できません。",kana:"いいえ、できません。",speakerA:"Can you come to my house today?",             hint:"Can you come to my house today? ___________",            tiles:["No","I","can't","."],          answer:"No I can't ." },
    ],
  },
  {
    id: "jobs", title: "Jobs / しごと", emoji: "🧑‍💼",
    color: "#8b5cf6", shadow: "#6d28d9",
    words: [
      { en:"teacher",        kanji:"先生",         kana:"せんせい",     trans:"私の%%先生%%はとても優しいです。",                      hint:"My _____ is very kind.",                    tiles:["My","teacher","is","very","kind","."],                     answer:"My teacher is very kind ." },
      { en:"doctor",         kanji:"お医者さん",   kana:"おいしゃさん", trans:"%%お医者さん%%は病院で働いています。",                 hint:"The _____ works at the hospital.",           tiles:["The","doctor","works","at","the","hospital","."],          answer:"The doctor works at the hospital ." },
      { en:"nurse",          kanji:"看護師",       kana:"かんごし",     trans:"%%看護師%%さんはとても親切です。",                     hint:"The _____ is very kind.",                    tiles:["The","nurse","is","very","kind","."],                      answer:"The nurse is very kind ." },
      { en:"student",        kanji:"生徒",         kana:"せいと",       trans:"私は英語を勉強している%%生徒%%です。",                 hint:"I am a _____ studying English.",             tiles:["I","am","a","student","studying","English","."],           answer:"I am a student studying English ." },
      { en:"policeman",      kanji:"警察官",       kana:"けいさつかん", trans:"%%警察官%%は私たちを守ってくれます。",                 hint:"A _____ keeps us safe.",                     tiles:["A","policeman","keeps","us","safe","."],                   answer:"A policeman keeps us safe ." },
      { en:"baseball player",kanji:"野球選手",     kana:"やきゅうせんしゅ",trans:"彼は有名な%%野球選手%%です。",                   hint:"He is a famous _____.",                      tiles:["He","is","a","famous","baseball","player","."],            answer:"He is a famous baseball player ." },
    ],
  },
  {
    id: "school_subjects", title: "School Subjects / 科目", emoji: "📚",
    color: "#ef4444", shadow: "#b91c1c",
    words: [
      { en:"English",        kanji:"英語",         kana:"えいご",       trans:"私は%%英語%%を毎日勉強します。",                       hint:"I study _____ every day.",                   tiles:["I","study","English","every","day","."],                   answer:"I study English every day ." },
      { en:"Japanese",       kanji:"国語",         kana:"こくご",       trans:"%%国語%%の授業では漢字を習います。",                   hint:"We learn kanji in _____ class.",             tiles:["We","learn","kanji","in","Japanese","class","."],          answer:"We learn kanji in Japanese class ." },
      { en:"math",           kanji:"算数",         kana:"さんすう",     trans:"%%算数%%のテストは難しかったです。",                   hint:"The _____ test was hard.",                   tiles:["The","math","test","was","hard","."],                      answer:"The math test was hard ." },
      { en:"history",        kanji:"社会",         kana:"しゃかい",     trans:"%%社会%%の授業で日本の歴史を勉強します。",             hint:"We study Japan in _____ class.",             tiles:["We","study","Japan","in","history","class","."],           answer:"We study Japan in history class ." },
      { en:"science",        kanji:"理科",         kana:"りか",         trans:"%%理科%%の授業で植物を育てます。",                     hint:"We grow plants in _____ class.",             tiles:["We","grow","plants","in","science","class","."],           answer:"We grow plants in science class ." },
      { en:"P.E.",           kanji:"体育",         kana:"たいいく",     trans:"%%体育%%の授業でサッカーをします。",                   hint:"We play soccer in _____ class.",             tiles:["We","play","soccer","in","P.E.","class","."],              answer:"We play soccer in P.E. class ." },
      { en:"music",          kanji:"音楽",         kana:"おんがく",     trans:"%%音楽%%の授業でリコーダーを吹きます。",               hint:"We play the recorder in _____ class.",       tiles:["We","play","the","recorder","in","music","class","."],     answer:"We play the recorder in music class ." },
    ],
  },
  {
    id: "buildings_1", title: "Buildings & Places 1 / たてもの①", emoji: "🏢",
    color: "#0891b2", shadow: "#155e75",
    words: [
      { en:"school",         kanji:"学校",         kana:"がっこう",     trans:"私は毎日%%学校%%に行きます。",                         hint:"I go to _____ every day.",                   tiles:["I","go","to","school","every","day","."],                  answer:"I go to school every day ." },
      { en:"post office",    kanji:"郵便局",       kana:"ゆうびんきょく",trans:"手紙を出しに%%郵便局%%に行きました。",               hint:"I went to the _____ to send a letter.",      tiles:["I","went","to","the","post","office","to","send","a","letter","."], answer:"I went to the post office to send a letter ." },
      { en:"library",        kanji:"図書館",       kana:"としょかん",   trans:"私は%%図書館%%で本を借ります。",                       hint:"I borrow books from the _____.",             tiles:["I","borrow","books","from","the","library","."],           answer:"I borrow books from the library ." },
      { en:"museum",         kanji:"博物館",       kana:"はくぶつかん", trans:"先週、%%博物館%%に行きました。",                       hint:"I went to the _____ last week.",             tiles:["I","went","to","the","museum","last","week","."],          answer:"I went to the museum last week ." },
      { en:"station",        kanji:"駅",           kana:"えき",         trans:"%%駅%%はここからどのくらいですか？",                   hint:"How far is the _____ from here?",            tiles:["How","far","is","the","station","from","here","?"],        answer:"How far is the station from here ?" },
      { en:"hospital",       kanji:"病院",         kana:"びょういん",   trans:"母は%%病院%%で働いています。",                         hint:"My mother works at the _____.",              tiles:["My","mother","works","at","the","hospital","."],           answer:"My mother works at the hospital ." },
    ],
  },
  {
    id: "buildings_2", title: "Buildings & Places 2 / たてもの②", emoji: "🏦",
    color: "#0891b2", shadow: "#155e75",
    words: [
      { en:"bank",           kanji:"銀行",         kana:"ぎんこう",     trans:"%%銀行%%はあの角を曲がったところにあります。",         hint:"The _____ is around that corner.",           tiles:["The","bank","is","around","that","corner","."],            answer:"The bank is around that corner ." },
      { en:"police station", kanji:"交番",         kana:"こうばん",     trans:"%%交番%%はどこですか？",                               hint:"Where is the _____?",                        tiles:["Where","is","the","police","station","?"],                 answer:"Where is the police station ?" },
      { en:"department store",kanji:"デパート",    kana:"デパート",     trans:"母は%%デパート%%で服を買います。",                     hint:"My mother buys clothes at the _____.",       tiles:["My","mother","buys","clothes","at","the","department","store","."], answer:"My mother buys clothes at the department store ." },
      { en:"zoo",            kanji:"動物園",       kana:"どうぶつえん", trans:"土曜日に%%動物園%%に行きましょう。",                   hint:"Let's go to the _____ on Saturday.",         tiles:["Let's","go","to","the","zoo","on","Saturday","."],         answer:"Let's go to the zoo on Saturday ." },
      { en:"park",           kanji:"公園",         kana:"こうえん",     trans:"放課後、%%公園%%で遊びましょう。",                     hint:"Let's play at the _____ after school.",      tiles:["Let's","play","at","the","park","after","school","."],     answer:"Let's play at the park after school ." },
      { en:"restaurant",     kanji:"レストラン",   kana:"レストラン",   trans:"今夜は家族で%%レストラン%%に行きます。",               hint:"We go to a _____ with my family tonight.",   tiles:["We","go","to","a","restaurant","with","my","family","tonight","."], answer:"We go to a restaurant with my family tonight ." },
    ],
  },
  {
    id: "countries", title: "Countries / 国", emoji: "🌍",
    color: "#f59e0b", shadow: "#d97706",
    words: [
      { en:"Japan",          kanji:"日本",         kana:"にほん",       trans:"私は%%日本%%に住んでいます。",                         hint:"I live in _____.",                           tiles:["I","live","in","Japan","."],                               answer:"I live in Japan ." },
      { en:"America",        kanji:"アメリカ",     kana:"アメリカ",     trans:"私の兄は%%アメリカ%%に留学しています。",               hint:"My brother is studying in _____.",           tiles:["My","brother","is","studying","in","America","."],         answer:"My brother is studying in America ." },
      { en:"China",          kanji:"中国",         kana:"ちゅうごく",   trans:"パンダは%%中国%%の動物です。",                         hint:"Pandas are animals from _____.",             tiles:["Pandas","are","animals","from","China","."],               answer:"Pandas are animals from China ." },
      { en:"Australia",      kanji:"オーストラリア",kana:"オーストラリア",trans:"%%オーストラリア%%ではコアラが見られます。",         hint:"You can see koalas in _____.",               tiles:["You","can","see","koalas","in","Australia","."],           answer:"You can see koalas in Australia ." },
      { en:"England",        kanji:"イギリス",     kana:"イギリス",     trans:"私の先生は%%イギリス%%出身です。",                     hint:"My teacher is from _____.",                  tiles:["My","teacher","is","from","England","."],                  answer:"My teacher is from England ." },
      { en:"Canada",         kanji:"カナダ",       kana:"カナダ",       trans:"%%カナダ%%は冬にとても寒くなります。",                 hint:"It gets very cold in _____ in winter.",      tiles:["It","gets","very","cold","in","Canada","in","winter","."], answer:"It gets very cold in Canada in winter ." },
    ],
  },
  {
    id: "meals", title: "Meals / 食事", emoji: "🍽️",
    color: "#d97706", shadow: "#92400e",
    words: [
      { en:"breakfast",      kanji:"朝ごはん",     kana:"あさごはん",   trans:"私は毎朝%%朝ごはん%%を食べます。",                     hint:"I eat _____ every morning.",                 tiles:["I","eat","breakfast","every","morning","."],               answer:"I eat breakfast every morning ." },
      { en:"lunch",          kanji:"昼ごはん",     kana:"ひるごはん",   trans:"学校で%%昼ごはん%%を食べます。",                       hint:"I eat _____ at school.",                     tiles:["I","eat","lunch","at","school","."],                       answer:"I eat lunch at school ." },
      { en:"dinner",         kanji:"夕ごはん",     kana:"ゆうごはん",   trans:"家族みんなで%%夕ごはん%%を食べます。",                 hint:"I eat _____ with my family.",                tiles:["I","eat","dinner","with","my","family","."],               answer:"I eat dinner with my family ." },
      { en:"supper",         kanji:"夕食",         kana:"ゆうしょく",   trans:"%%夕食%%は何時に食べますか？",                         hint:"What time do you have _____?",               tiles:["What","time","do","you","have","supper","?"],              answer:"What time do you have supper ?" },
    ],
  },
  {
    id: "time_units", title: "Time Units / 時間", emoji: "⏰",
    color: "#6366f1", shadow: "#4338ca",
    words: [
      { en:"minute",         kanji:"分",           kana:"ふん",         trans:"学校まで10%%分%%かかります。",                         hint:"It takes ten _____ to get to school.",       tiles:["It","takes","ten","minutes","to","get","to","school","."], answer:"It takes ten minutes to get to school ." },
      { en:"hour",           kanji:"時間",         kana:"じかん",       trans:"映画は2%%時間%%です。",                               hint:"The movie is two _____.",                    tiles:["The","movie","is","two","hours","."],                      answer:"The movie is two hours ." },
      { en:"day",            kanji:"日",           kana:"にち",         trans:"一週間は7%%日%%あります。",                           hint:"There are seven _____ in a week.",           tiles:["There","are","seven","days","in","a","week","."],          answer:"There are seven days in a week ." },
      { en:"week",           kanji:"週",           kana:"しゅう",       trans:"一ヶ月は4%%週%%あります。",                           hint:"There are four _____ in a month.",           tiles:["There","are","four","weeks","in","a","month","."],         answer:"There are four weeks in a month ." },
      { en:"month",          kanji:"月",           kana:"つき",         trans:"一年は12%%月%%あります。",                            hint:"There are twelve _____ in a year.",          tiles:["There","are","twelve","months","in","a","year","."],       answer:"There are twelve months in a year ." },
      { en:"year",           kanji:"年",           kana:"ねん",         trans:"私は今%%年%%10歳になります。",                         hint:"I will be ten years old this _____.",        tiles:["I","will","be","ten","years","old","this","year","."],     answer:"I will be ten years old this year ." },
    ],
  },
  {
    id: "antonyms", title: "Antonym Pairs / 反対語", emoji: "↔️",
    color: "#ec4899", shadow: "#9d174d",
    words: [
      { en:"big",            kanji:"大きい",       kana:"おおきい",     trans:"象は%%大きい%%動物です。",                             hint:"An elephant is a _____ animal.",             tiles:["An","elephant","is","a","big","animal","."],               answer:"An elephant is a big animal ." },
      { en:"little",         kanji:"小さい",       kana:"ちいさい",     trans:"私のねこは%%小さい%%です。",                           hint:"My cat is _____.",                           tiles:["My","cat","is","little","."],                              answer:"My cat is little ." },
      { en:"new",            kanji:"新しい",       kana:"あたらしい",   trans:"これは私の%%新しい%%かばんです。",                     hint:"This is my _____ bag.",                      tiles:["This","is","my","new","bag","."],                          answer:"This is my new bag ." },
      { en:"old",            kanji:"古い",         kana:"ふるい",       trans:"この建物はとても%%古い%%です。",                       hint:"This building is very _____.",               tiles:["This","building","is","very","old","."],                   answer:"This building is very old ." },
      { en:"young",          kanji:"若い",         kana:"わかい",       trans:"私の先生は%%若い%%です。",                             hint:"My teacher is _____.",                       tiles:["My","teacher","is","young","."],                           answer:"My teacher is young ." },
      { en:"large",          kanji:"大きな",       kana:"おおきな",     trans:"%%大きな%%木が庭にあります。",                         hint:"There is a _____ tree in the garden.",       tiles:["There","is","a","large","tree","in","the","garden","."],   answer:"There is a large tree in the garden ." },
      { en:"small",          kanji:"小さな",       kana:"ちいさな",     trans:"%%小さな%%犬が好きです。",                             hint:"I like _____ dogs.",                         tiles:["I","like","small","dogs","."],                             answer:"I like small dogs ." },
      { en:"happy",          kanji:"うれしい",     kana:"うれしい",     trans:"今日は誕生日なので%%うれしい%%です。",                 hint:"I am _____ because it is my birthday.",      tiles:["I","am","happy","because","it","is","my","birthday","."], answer:"I am happy because it is my birthday ." },
      { en:"sad",            kanji:"悲しい",       kana:"かなしい",     trans:"%%悲しい%%ときは音楽を聴きます。",                     hint:"I listen to music when I am _____.",         tiles:["I","listen","to","music","when","I","am","sad","."],       answer:"I listen to music when I am sad ." },
      { en:"good",           kanji:"良い",         kana:"よい",         trans:"今日は%%良い%%天気です。",                             hint:"It is a _____ day today.",                   tiles:["It","is","a","good","day","today","."],                    answer:"It is a good day today ." },
      { en:"bad",            kanji:"悪い",         kana:"わるい",       trans:"今日は%%悪い%%天気です。",                             hint:"It is a _____ day today.",                   tiles:["It","is","a","bad","day","today","."],                     answer:"It is a bad day today ." },
      { en:"fast",           kanji:"速い",         kana:"はやい",       trans:"チーターは%%速い%%動物です。",                         hint:"A cheetah is a _____ animal.",               tiles:["A","cheetah","is","a","fast","animal","."],                answer:"A cheetah is a fast animal ." },
      { en:"slow",           kanji:"遅い",         kana:"おそい",       trans:"カメは%%遅い%%動物です。",                             hint:"A turtle is a _____ animal.",                tiles:["A","turtle","is","a","slow","animal","."],                 answer:"A turtle is a slow animal ." },
    ],
  },
  {
    id: "frequency", title: "Frequency Adverbs / ひんど", emoji: "🔁",
    color: "#14b8a6", shadow: "#0f766e",
    words: [
      { en:"sometimes",      kanji:"時々",         kana:"ときどき",     trans:"私は%%時々%%図書館で勉強します。",                     hint:"I _____ study at the library.",              tiles:["I","sometimes","study","at","the","library","."],          answer:"I sometimes study at the library ." },
      { en:"often",          kanji:"よく",         kana:"よく",         trans:"私は%%よく%%公園で友達と遊びます。",                   hint:"I _____ play with friends at the park.",     tiles:["I","often","play","with","friends","at","the","park","."], answer:"I often play with friends at the park ." },
      { en:"usually",        kanji:"たいてい",     kana:"たいてい",     trans:"私は%%たいてい%%7時に起きます。",                       hint:"I _____ wake up at seven.",                  tiles:["I","usually","wake","up","at","seven","."],                answer:"I usually wake up at seven ." },
      { en:"always",         kanji:"いつも",       kana:"いつも",       trans:"私は%%いつも%%朝ごはんを食べます。",                   hint:"I _____ eat breakfast.",                     tiles:["I","always","eat","breakfast","."],                        answer:"I always eat breakfast ." },
    ],
  },
  {
    id: "what_questions", title: "What ___? Questions / 何〜？", emoji: "🔵",
    color: "#3b82f6", shadow: "#1d4ed8",
    words: [
      { en:"What color",   kanji:"何色",         kana:"なにいろ",        hint:"_____ do you like? — I like blue.",          tiles:["What","color","do","you","like","?"],       answer:"What color do you like ?" },
      { en:"What time",    kanji:"何時",         kana:"なんじ",          hint:"_____ is it now? — It's 3:25.",              tiles:["What","time","is","it","now","?"],          answer:"What time is it now ?" },
      { en:"What day",     kanji:"何曜日",       kana:"なんようび",      hint:"_____ is it today? — It's Monday.",          tiles:["What","day","is","it","today","?"],         answer:"What day is it today ?" },
      { en:"What subject", kanji:"何の科目",     kana:"なんのかもく",    hint:"_____ do you like? — I like P.E.",           tiles:["What","subject","do","you","like","?"],     answer:"What subject do you like ?" },
      { en:"What sport",   kanji:"何のスポーツ", kana:"なんのスポーツ",  hint:"_____ do you play? — I play soccer.",        tiles:["What","sport","do","you","play","?"],       answer:"What sport do you play ?" },
      { en:"What season",  kanji:"何の季節",     kana:"なんのきせつ",    hint:"_____ do you like? — I like summer.",        tiles:["What","season","do","you","like","?"],      answer:"What season do you like ?" },
      { en:"What food",    kanji:"何の食べ物",   kana:"なんのたべもの",  hint:"_____ do you like? — I like sushi.",         tiles:["What","food","do","you","like","?"],        answer:"What food do you like ?" },
    ],
  },
  {
    id: "how_questions", title: "How ___? Questions / どんな〜？", emoji: "🟢",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"How many",  kanji:"いくつ",              kana:"いくつ",              hint:"_____ rooms are there? — Four.",                tiles:["How","many","rooms","are","there","?"],    answer:"How many rooms are there ?" },
      { en:"How much",  kanji:"いくら",              kana:"いくら",              hint:"_____ is this ruler? — 150 yen.",               tiles:["How","much","is","this","ruler","?"],      answer:"How much is this ruler ?" },
      { en:"How long",  kanji:"どのくらい",          kana:"どのくらい",          hint:"_____ does it take? — Thirty minutes.",         tiles:["How","long","does","it","take","?"],       answer:"How long does it take ?" },
      { en:"How about", kanji:"〜はどうですか",      kana:"〜はどうですか",      hint:"_____ sandwiches? — Sure!",                     tiles:["How","about","sandwiches","?"],            answer:"How about sandwiches ?" },
      { en:"How old",   kanji:"何歳",               kana:"なんさい",            hint:"_____ is your father? — He is forty.",          tiles:["How","old","is","your","father","?"],      answer:"How old is your father ?" },
      { en:"How tall",  kanji:"身長はどのくらい",    kana:"しんちょうはどのくらい",hint:"_____ are you? — I am 130 cm tall.",          tiles:["How","tall","are","you","?"],              answer:"How tall are you ?" },
    ],
  },
];

/* ── Helper: get categories by Eiken level ── */
const getCategoriesByLevel = (level) =>
  level === "4" ? VOCAB_CATEGORIES_4 : level === "3" ? VOCAB_CATEGORIES_3 : VOCAB_CATEGORIES_5;

/* ── CSS ── */
const css = `
* { box-sizing:border-box; margin:0; padding:0; }
html,body { min-height:100%; }
body { font-family:'Inter',sans-serif; background:#ece4b7; }

@keyframes shake  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
@keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

/* ── Page shell ── */
.app  { min-height:100vh; width:100%; display:flex; flex-direction:column; background:#ece4b7; }
.fade { animation:fadeUp .22s ease; }

/* ── Header ── */
.hdr       { background:linear-gradient(135deg,#7fb069,#a5c98a); padding:14px 28px; display:flex; align-items:center; gap:14px; box-shadow:0 3px 14px rgba(127,176,105,.35); flex-shrink:0; width:100%; }
.hdr-back  { background:rgba(255,255,255,.25); border:none; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; font-size:17px; cursor:pointer; color:#fff; flex-shrink:0; }
.hdr-title { font-family:'Nunito',sans-serif; font-weight:900; font-size:20px; color:#fff; }
.hdr-sub   { font-size:12px; color:rgba(255,255,255,.82); font-weight:500; margin-top:1px; }

/* ── Two-column body ── */
.body-wrap {
  flex:1; display:flex; min-height:0;
}

/* Left sidebar — nav / word list */
.sidebar {
  width:300px; min-width:260px; max-width:320px;
  background:#fff; border-right:1.5px solid #e8edf3;
  overflow-y:auto; padding:20px 16px; flex-shrink:0;
}
@media (max-width:600px) {
  .sidebar { display:none; }
  .main { padding:16px 14px; }
}
.sidebar-title {
  font-family:'Nunito',sans-serif; font-weight:900; font-size:15px;
  color:#718096; letter-spacing:.4px; text-transform:uppercase;
  margin-bottom:12px;
}

/* Main content pane */
.main {
  flex:1; overflow-y:auto; padding:28px 36px;
  display:flex; flex-direction:column;
}

/* Centred narrow column for login/forms */
.main-center {
  flex:1; overflow-y:auto; padding:40px 24px;
  display:flex; flex-direction:column; align-items:center;
}
.main-center > * { width:100%; max-width:480px; }

/* ── Screen (used inside main/main-center) ── */
.scr { width:100%; }

/* ── Login / hero ── */
.hero       { text-align:center; padding:20px 0 18px; }
.hero-emoji { font-size:60px; }
.hero-h     { font-family:'Nunito',sans-serif; font-weight:900; font-size:28px; color:#02020b; margin-top:8px; }
.hero-sub   { font-size:14px; color:#718096; margin-top:4px; }

.flabel  { font-size:11px; font-weight:700; color:#718096; letter-spacing:.5px; margin-bottom:6px; text-transform:uppercase; }
.tinput  { width:100%; padding:14px 16px; border-radius:13px; border:2px solid #e2e8f0; font-family:'Inter',sans-serif; font-size:17px; color:#02020b; outline:none; background:#fff; transition:border-color .15s; }
.tinput:focus { border-color:#7fb069; }
.pselect { width:100%; padding:14px 16px; border-radius:13px; border:2px solid #e2e8f0; font-family:'Inter',sans-serif; font-size:17px; color:#02020b; background:#fff; cursor:pointer; outline:none; }

.lpill     { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:13px; border:2.5px solid #e2e8f0; background:#fff; cursor:pointer; margin-bottom:10px; transition:all .12s; }
.lpill.sel { border-color:#D36135; background:#fdf5e8; }

/* ── Buttons ── */
.btn  { width:100%; padding:15px; border-radius:13px; border:none; font-family:'Nunito',sans-serif; font-weight:900; font-size:17px; color:#fff; cursor:pointer; transition:transform .1s; letter-spacing:.3px; }
.btn:hover  { transform:translateY(-1px); }
.btn:active { transform:translateY(2px); }
.btn:disabled { opacity:.4; cursor:not-allowed; transform:none; }
.btn-pink { background:#D36135; box-shadow:0 4px 0 #a03319; }
.btn-gray { background:#718096; box-shadow:0 4px 0 #4a5568; }

/* ── Dashboard ── */
.av-row  { display:flex; align-items:center; gap:14px; background:#fff; border-radius:18px; padding:18px 20px; margin-bottom:20px; box-shadow:0 2px 10px rgba(0,0,0,.07); }
.avatar  { width:52px; height:52px; border-radius:50%; background:linear-gradient(135deg,#7fb069,#a5c98a); display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:900; color:#fff; font-family:'Nunito',sans-serif; flex-shrink:0; }
.av-name { font-family:'Nunito',sans-serif; font-weight:900; font-size:22px; color:#02020b; }
.av-lvl  { font-size:12px; color:#a0aec0; font-weight:500; margin-top:2px; }

/* Module cards on dashboard — 2 columns */
.mod-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; margin-bottom:8px; }
.mod-card { background:#fff; border-radius:18px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,.07); cursor:pointer; display:flex; align-items:center; gap:14px; border:none; width:100%; text-align:left; transition:transform .12s,box-shadow .12s; }
.mod-card:hover:not(.locked) { transform:translateY(-2px); box-shadow:0 6px 18px rgba(0,0,0,.11); }
.mod-card.locked { cursor:not-allowed; opacity:.5; }
.mod-icon { width:52px; height:52px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:26px; flex-shrink:0; }

/* Category cards — 2 columns in main pane */
.cat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
.cat-card { background:#fff; border-radius:14px; padding:14px 16px; display:flex; align-items:center; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,.06); cursor:pointer; border:none; width:100%; text-align:left; transition:transform .12s; }
.cat-card:hover { transform:translateY(-1px); }

/* ── Sidebar word list (during game) ── */
.wl-row { background:#fafaf6; border-radius:10px; padding:9px 12px; margin-bottom:6px; display:flex; align-items:center; gap:10px; border:1px solid #e8edf3; }
.wl-num { font-family:'Nunito',sans-serif; font-weight:900; font-size:14px; min-width:20px; color:#a0aec0; }

/* ── Quiz area ── */
.quiz-wrap { max-width:560px; width:100%; }

.prog-row { display:flex; gap:5px; margin-bottom:14px; }
.pip { flex:1; height:7px; border-radius:4px; background:#e2e8f0; }

.card { background:#fff; border-radius:18px; padding:20px 22px; box-shadow:0 2px 14px rgba(0,0,0,.08); margin-bottom:14px; }

.phdr   { text-align:center; margin-bottom:14px; }
.plabel { display:inline-block; background:#ece4b7; border-radius:20px; padding:4px 16px; font-size:12px; font-weight:700; color:#718096; letter-spacing:.5px; }
.ptitle { font-family:'Nunito',sans-serif; font-weight:900; font-size:22px; color:#02020b; margin-top:6px; }

.wdisplay { text-align:center; padding:8px 0 14px; }

.ord-target { text-align:center; background:#ece4b7; border-radius:14px; padding:20px 12px; margin-bottom:14px; }
.ord-num    { font-family:'Nunito',sans-serif; font-weight:900; font-size:52px; color:#02020b; }
.ord-hint   { font-size:13px; color:#718096; margin-top:5px; }

.cbtn { width:100%; padding:14px 16px; border-radius:13px; border:2.5px solid #e2e8f0; background:#fff; font-family:'Nunito',sans-serif; font-weight:700; font-size:17px; color:#02020b; cursor:pointer; margin-bottom:9px; text-align:left; display:flex; align-items:center; gap:10px; transition:all .12s; }
.cbtn:hover:not(:disabled) { border-color:#cbd5e0; background:#fafaf6; }
.cbtn.correct { border-color:#48bb78; background:#f0fff4; color:#276749; }
.cbtn.wrong   { border-color:#fc8181; background:#fff5f5; color:#c53030; }

.sinput { width:100%; padding:15px 16px; border-radius:13px; border:2.5px solid #e2e8f0; font-family:'Nunito',sans-serif; font-weight:700; font-size:22px; color:#02020b; outline:none; text-align:center; background:#fafaf6; transition:border-color .15s; }
.sinput:focus   { border-color:#7fb069; background:#fff; }
.sinput.correct { border-color:#48bb78; background:#f0fff4; }
.sinput.wrong   { border-color:#fc8181; background:#fff5f5; animation:shake .4s ease; }

.fbtn { width:100%; padding:14px; border-radius:13px; border:2.5px solid #e2e8f0; background:#fff; font-family:'Nunito',sans-serif; font-weight:800; font-size:17px; color:#02020b; cursor:pointer; margin-bottom:9px; text-align:center; transition:all .12s; }
.fbtn:hover:not(:disabled) { border-color:#cbd5e0; background:#fafaf6; }
.fbtn.correct { border-color:#48bb78; background:#f0fff4; color:#276749; }
.fbtn.wrong   { border-color:#fc8181; background:#fff5f5; color:#c53030; }

.tile-area { min-height:52px; background:#ece4b7; border-radius:13px; padding:8px; display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; border:2px dashed #c9b97e; }
.tile-area.shk { animation:shake .4s ease; }
.tile { background:#fff; border:2px solid #e2e8f0; border-radius:9px; padding:8px 14px; font-family:'Nunito',sans-serif; font-weight:800; font-size:15px; color:#02020b; cursor:pointer; transition:all .12s; user-select:none; }
.tile:hover:not(.used) { border-color:#a0aec0; transform:translateY(-1px); }
.tile.in-ans { border-color:#D36135; background:#fdf5e8; color:#a03319; }
.tile.used   { opacity:.2; pointer-events:none; }

.fb     { border-radius:13px; padding:12px 15px; margin-top:8px; display:flex; align-items:center; gap:8px; font-family:'Nunito',sans-serif; font-weight:700; font-size:15px; }
.fb.ok  { background:#f0fff4; color:#276749; }
.fb.bad { background:#fff5f5; color:#c53030; }

.hbtn { background:none; border:none; color:#a0aec0; font-size:12px; font-weight:600; cursor:pointer; padding:6px 0; display:flex; align-items:center; gap:3px; font-family:'Inter',sans-serif; }
.hbox { background:#fff8e1; border-radius:11px; padding:10px 14px; margin-top:7px; font-size:13px; color:#744210; font-style:italic; }

.sen-disp { background:#ece4b7; border-radius:13px; padding:14px 16px; margin-bottom:10px; font-family:'Nunito',sans-serif; font-weight:700; font-size:18px; color:#02020b; line-height:1.5; text-align:center; }
.blank    { color:#D36135; font-style:italic; }
.pc-note  { font-size:12px; color:#a0aec0; text-align:center; margin-bottom:10px; font-style:italic; }

.trans-disp { background:#fdf5e8; border-radius:11px; padding:10px 14px; margin-bottom:10px; font-size:14px; color:#718096; text-align:center; line-height:1.6; border:1px solid #e6aa68; }
.trans-hl   { color:#D36135; font-weight:800; }

.dia-box    { background:#f0ebff; border-radius:12px; padding:12px 14px; margin-bottom:10px; border:1px solid #c4b5fd; }
.dia-row    { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.dia-row:last-child { margin-bottom:0; }
.dia-speaker{ font-weight:900; font-size:15px; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.dia-a      { background:#8b5cf6; color:#fff; }
.dia-b      { background:#e9d5ff; color:#6d28d9; }
.dia-text   { font-size:14px; color:#374151; line-height:1.5; }
.dia-blank  { color:#9ca3af; font-style:italic; letter-spacing:2px; }

.chip     { display:inline-block; background:#e6ffed; color:#276749; border-radius:20px; padding:4px 13px; font-size:13px; font-weight:700; margin:3px; font-family:'Nunito',sans-serif; }
.chip.bad { background:#fff5f5; color:#c53030; }
.rev-item { background:#fff; border-radius:13px; padding:13px 16px; margin-bottom:9px; box-shadow:0 1px 5px rgba(0,0,0,.06); }

.rev-banner       { background:#fdf5e8; border-radius:14px; padding:16px 18px; margin-bottom:16px; text-align:center; border:2px solid #e6aa68; }
.rev-banner-title { font-family:'Nunito',sans-serif; font-weight:900; font-size:19px; color:#a03319; }
.rev-banner-sub   { font-size:13px; color:#D36135; margin-top:4px; }

.slabel   { font-size:11px; font-weight:700; color:#a0aec0; letter-spacing:.5px; text-transform:uppercase; margin-bottom:10px; }
.cap-note { font-size:11px; color:#e6aa68; font-weight:600; margin-left:6px; }
`;

/* ── App ── */
export default function App() {
  const [profiles,       setProfiles]       = useState(() => { try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || []; } catch { return []; }});
  const [currentProfile, setCurrentProfile] = useState(() => { try { return JSON.parse(localStorage.getItem(CURRENT_KEY))  || null; } catch { return null; }});
  const [progress,       setProgress]       = useState(() => { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }  catch { return {}; }});

  const [screen,         setScreen]         = useState(currentProfile ? "dashboard" : "login");
  const [activeCategory, setActiveCategory] = useState(null);
  const [gameResults,    setGameResults]    = useState(null);

  const saveProfiles       = p  => { setProfiles(p);       localStorage.setItem(PROFILES_KEY, JSON.stringify(p)); };
  const saveCurrentProfile = p  => { setCurrentProfile(p); localStorage.setItem(CURRENT_KEY,  JSON.stringify(p)); };
  const saveProgress       = pr => { setProgress(pr);      localStorage.setItem(PROGRESS_KEY, JSON.stringify(pr)); };

  const login  = p => { saveCurrentProfile(p); setScreen("dashboard"); };
  const logout = () => { saveCurrentProfile(null); setScreen("login"); };

  const changeLevel = (newLevel) => {
    const updated = { ...currentProfile, level: newLevel };
    saveCurrentProfile(updated);
    const updatedProfiles = profiles.map(p => p.id === updated.id ? updated : p);
    saveProfiles(updatedProfiles);
  };

  const markCategoryDone = (catId, pct) => {
    const key  = `${currentProfile.id}_${catId}`;
    const next = { ...progress, [key]: Math.max(progress[key] || 0, pct) };
    saveProgress(next);
  };
  const getCatProgress = catId => progress[`${currentProfile?.id}_${catId}`] || 0;

  // Compute categories once based on current level — used throughout render
  const categories = getCategoriesByLevel(currentProfile?.level || "5");

  const goBack = () => {
    const map = { vocab_study:"vocab_list", vocab_game:"vocab_list", vocab_results:"vocab_list", vocab_review:"vocab_list", vocab_list:"dashboard" };
    setScreen(map[screen] || "dashboard");
  };

  const headerTitle = {
    login: "Eiken English Training",
    dashboard: "Eiken English Training",
    vocab_list: "Vocabulary",
    vocab_study: activeCategory?.title || "Study List",
    vocab_game: activeCategory?.title || "Vocabulary",
    vocab_results: activeCategory?.title || "Results",
    vocab_review: "Review — get them all right!",
  }[screen] || "Eiken English Training";

  // Screens that use the two-column layout (sidebar + main)
  const twoCol = ["dashboard","vocab_list","vocab_study","vocab_game","vocab_results","vocab_review"].includes(screen);

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* ── Header ── */}
        <div className="hdr">
          {screen !== "login" && screen !== "dashboard"
            ? <button type="button" className="hdr-back" onClick={goBack}>←</button>
            : <span style={{fontSize:26}}>⭐</span>}
          <div style={{flex:1}}>
            <div className="hdr-title">{headerTitle}</div>
            <div className="hdr-sub">
              {currentProfile?.level === "4" ? "Grade 4 · えいけん4きゅう" : currentProfile?.level === "3" ? "Grade 3 · えいけん3きゅう" : "Grade 5 · えいけん5きゅう"}
            </div>
          </div>
          {screen === "dashboard" && currentProfile && (
            <button type="button" onClick={logout}
              style={{background:"rgba(255,255,255,.22)",border:"none",borderRadius:"10px",color:"#fff",fontSize:"12px",fontWeight:700,padding:"6px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              Log out
            </button>
          )}
        </div>

        {screen === "login" && (
          <LoginScreen profiles={profiles} onLogin={login}
            onNewProfile={p => { saveProfiles([...profiles, p]); login(p); }} />
        )}

        {/* Two-column body for all logged-in screens */}
        {twoCol && currentProfile && (
          <div className="body-wrap">
            {/* Left sidebar */}
            <div className="sidebar">
              {screen === "dashboard" && (
                <>
                  <div className="sidebar-title">Navigation</div>
                  <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,color:"#D36135",marginBottom:4}}>📖 Vocabulary</div>
                  {categories.map(cat => (
                    <div key={cat.id} style={{fontSize:13,color:"#718096",padding:"5px 0 5px 12px",borderLeft:`3px solid ${getCatProgress(cat.id)>=70?cat.color:"#e2e8f0"}`,
                      marginBottom:4,fontWeight:getCatProgress(cat.id)>=70?700:400}}>
                      {cat.title} {getCatProgress(cat.id)>=70?"✅":""}
                    </div>
                  ))}
                </>
              )}
              {screen === "vocab_list" && (
                <>
                  <div className="sidebar-title">Categories</div>
                  {categories.map(cat => {
                    const pct = getCatProgress(cat.id);
                    return (
                      <button type="button" key={cat.id}
                        onClick={() => { setActiveCategory(cat); setScreen("vocab_study"); }}
                        style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:activeCategory?.id===cat.id?"#fdf5e8":"transparent",border:"none",cursor:"pointer",
                          padding:"8px 10px",borderRadius:"10px",marginBottom:4,textAlign:"left"}}>
                        <span style={{fontSize:18}}>{cat.emoji}</span>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:13,color:cat.color}}>{cat.title}</div>
                          <div style={{fontSize:11,color:"#a0aec0"}}>{pct>0?`${pct}% best`:"not started"}</div>
                        </div>
                        <span style={{fontSize:13}}>{pct>=70?"✅":pct>0?"🔄":""}</span>
                      </button>
                    );
                  })}
                </>
              )}
              {(screen === "vocab_study" || screen === "vocab_game" || screen === "vocab_results" || screen === "vocab_review") && activeCategory && (
                <>
                  <div className="sidebar-title" style={{color:activeCategory.color}}>{activeCategory.title}</div>
                  <div style={{fontSize:12,color:"#a0aec0",marginBottom:10}}>Word list — tap 🔈 to hear</div>
                  {activeCategory.words.map((w, i) => (
                    <div key={w.en} className="wl-row">
                      <div className="wl-num" style={{color:activeCategory.color}}>{i+1}</div>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:13,color:"#02020b"}}>{w.en}</div>
                        {!w.isOrdinal && <div style={{fontSize:11,color:"#a0aec0"}}>{w.kanji}</div>}
                        {w.isOrdinal && <div style={{fontSize:12,color:activeCategory.color,fontWeight:700}}>{w.kanji}</div>}
                      </div>
                      <SpeakBtn text={w.en} size={26} />
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Main content */}
            <div className="main">
              {screen === "dashboard" && (
                <DashboardScreen profile={currentProfile} onVocab={() => setScreen("vocab_list")}
                  categories={categories} getCatProgress={getCatProgress}
                  onLevelChange={changeLevel} />
              )}
              {screen === "vocab_list" && (
                <VocabListScreen categories={categories} getCatProgress={getCatProgress}
                  onSelect={cat => { setActiveCategory(cat); setScreen("vocab_study"); }} />
              )}
              {screen === "vocab_study" && activeCategory && (
                <StudyScreen category={activeCategory} onStart={() => setScreen("vocab_game")} />
              )}
              {screen === "vocab_game" && activeCategory && (
                <VocabGameScreen key={activeCategory.id} category={activeCategory}
                  onComplete={results => {
                    markCategoryDone(activeCategory.id, results.pct);
                    setGameResults(results);
                    setScreen(results.missed.length > 0 ? "vocab_review" : "vocab_results");
                  }} />
              )}
              {screen === "vocab_review" && gameResults && activeCategory && (
                <MandatoryReview missed={gameResults.missed} category={activeCategory}
                  allCategoryWords={activeCategory.words}
                  onDone={() => setScreen("vocab_results")} />
              )}
              {screen === "vocab_results" && gameResults && activeCategory && (
                <ResultsScreen results={gameResults} category={activeCategory}
                  onHome={() => setScreen("vocab_list")}
                  onRetry={() => setScreen("vocab_study")} />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Login ── */
function LoginScreen({ profiles, onLogin, onNewProfile }) {
  const [view,            setView]            = useState(profiles.length > 0 ? "returning" : "new");
  const [name,            setName]            = useState("");
  const [selectedLevel,   setSelectedLevel]   = useState("5");
  const [selectedProfile, setSelectedProfile] = useState(profiles[0]?.id || "");

  const handleNew = () => {
    if (!name.trim()) return;
    onNewProfile({ id: Date.now().toString(), name: name.trim(), level: selectedLevel, createdAt: Date.now() });
  };

  return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px"}}>
    <div style={{width:"100%",maxWidth:460}} className="fade">
      <div className="hero">
        <div className="hero-emoji">🌟</div>
        <div className="hero-h">Welcome!</div>
        <div className="hero-sub">Let's study English together</div>
      </div>

      {profiles.length > 0 && (
        <div style={{display:"flex",gap:10,marginBottom:18}}>
          {["returning","new"].map(v => (
            <button type="button" key={v}
              style={{flex:1,padding:"12px",borderRadius:"12px",border:"2px solid",fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,cursor:"pointer",
                borderColor:view===v?"#D36135":"#e2e8f0",background:view===v?"#fdf5e8":"#fff",color:view===v?"#a03319":"#718096"}}
              onClick={() => setView(v)}>
              {v === "returning" ? "I'm back! 👋" : "New student ✨"}
            </button>
          ))}
        </div>
      )}

      {view === "returning" && profiles.length > 0 ? (
        <div className="fade">
          <div className="flabel">Who are you?</div>
          <select className="pselect" value={selectedProfile}
            onChange={e => setSelectedProfile(e.target.value)} style={{marginBottom:16}}>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name} — Grade {p.level}</option>)}
          </select>
          <button type="button" className="btn btn-pink"
            onClick={() => { const p=profiles.find(x=>x.id===selectedProfile); if(p) onLogin(p); }}>
            Let's go! 🚀
          </button>
        </div>
      ) : (
        <div className="fade">
          <div className="flabel" style={{marginBottom:6}}>Your name</div>
          <input className="tinput" type="text" placeholder="Type your name..."
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key==="Enter" && handleNew()}
            style={{marginBottom:16}} />
          <div className="flabel">Choose your level</div>
          {EIKEN_LEVELS.map(lvl => (
            <div key={lvl.id} className={`lpill ${selectedLevel===lvl.id?"sel":""}`}
              onClick={() => setSelectedLevel(lvl.id)}>
              <span style={{fontSize:22}}>{lvl.emoji}</span>
              <div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:16,color:selectedLevel===lvl.id?lvl.color:"#02020b"}}>{lvl.label}</div>
                <div style={{fontSize:12,color:"#a0aec0",marginTop:1}}>{lvl.desc}</div>
              </div>
              {selectedLevel===lvl.id && <span style={{marginLeft:"auto",color:lvl.color}}>✓</span>}
            </div>
          ))}
          <button type="button" className="btn btn-pink" onClick={handleNew} disabled={!name.trim()}>
            Start learning! 🌟
          </button>
        </div>
      )}
    </div>
    </div>
  );
}

/* ── Dashboard ── */
function DashboardScreen({ profile, onVocab, categories, getCatProgress, onLevelChange }) {
  const initials  = profile.name.slice(0,2).toUpperCase();
  const done      = categories.filter(c => getCatProgress(c.id) >= 70).length;
  const levels    = [
    { id:"5", label:"Grade 5", sub:"えいけん5きゅう", color:"#D36135" },
    { id:"4", label:"Grade 4", sub:"えいけん4きゅう", color:"#6366f1" },
    { id:"3", label:"Grade 3", sub:"えいけん3きゅう", color:"#7fb069" },
  ];

  return (
    <div className="fade">
      <div className="av-row">
        <div className="avatar">{initials}</div>
        <div style={{flex:1}}>
          <div className="av-name">Hi, {profile.name}! 👋</div>
          <div className="av-lvl">Eiken Grade {profile.level} · {done}/{categories.length} categories done</div>
        </div>
      </div>

      {/* Level switcher */}
      <div style={{marginBottom:20}}>
        <div className="slabel" style={{marginBottom:8}}>My Level</div>
        <div style={{display:"flex",gap:10}}>
          {levels.map(lvl => {
            const active = profile.level === lvl.id;
            const lvlDone = getCategoriesByLevel(lvl.id).filter(c => getCatProgress(c.id) >= 70).length;
            const lvlTotal = getCategoriesByLevel(lvl.id).length;
            return (
              <button type="button" key={lvl.id}
                onClick={() => !active && onLevelChange(lvl.id)}
                style={{flex:1,padding:"12px 14px",borderRadius:"14px",border:`2.5px solid ${active?lvl.color:"#e2e8f0"}`,
                  background:active?"#fff":active?"#fff":"#fafafa",cursor:active?"default":"pointer",
                  textAlign:"left",transition:"all .15s",boxShadow:active?`0 2px 0 ${lvl.color}44`:"none"}}>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,color:active?lvl.color:"#a0aec0"}}>
                  Eiken {lvl.label} {active && "✓"}
                </div>
                <div style={{fontSize:11,color:"#a0aec0",marginTop:2}}>{lvl.sub}</div>
                <div style={{fontSize:11,color:active?lvl.color:"#cbd5e0",marginTop:4,fontWeight:700}}>
                  {lvlDone}/{lvlTotal} cleared
                </div>
              </button>
            );
          })}
        </div>
        {profile.level === "5" && done === categories.length && (
          <div style={{marginTop:10,padding:"10px 14px",background:"#fdf5e8",borderRadius:"12px",border:"1px solid #e6aa68",fontSize:13,color:"#a03319",fontWeight:600}}>
            🎉 All Grade 5 categories cleared! Ready to move up to Grade 4?
          </div>
        )}
      </div>

      <div className="slabel">Modules</div>
      <div className="mod-grid">
        <button type="button" className="mod-card" onClick={onVocab}>
          <div className="mod-icon" style={{background:"#fdf5e8"}}>📖</div>
          <div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:18,color:"#02020b"}}>Vocabulary</div>
            <div style={{fontSize:12,color:"#a0aec0",marginTop:3}}>{categories.length} categories · match, spell & unscramble</div>
          </div>
          <span style={{marginLeft:"auto",fontSize:20,color:"#cbd5e0"}}>→</span>
        </button>
        {[{emoji:"💬",title:"Dialogue"},{emoji:"✏️",title:"Grammar"}].map(m => (
          <button key={m.title} type="button" className="mod-card locked" disabled>
            <div className="mod-icon" style={{background:"#f0f4f8"}}>{m.emoji}</div>
            <div>
              <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:18,color:"#a0aec0"}}>{m.title}</div>
              <div style={{fontSize:12,color:"#a0aec0",marginTop:3}}>Coming soon</div>
            </div>
            <span style={{marginLeft:"auto",fontSize:20}}>🔒</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Vocab List ── */
function VocabListScreen({ categories, getCatProgress, onSelect }) {
  return (
    <div className="fade">
      <div className="slabel">Choose a category</div>
      <div className="cat-grid">
        {categories.map(cat => {
          const pct = getCatProgress(cat.id);
          return (
            <button type="button" key={cat.id} className="cat-card" onClick={() => onSelect(cat)}>
              <span style={{fontSize:26}}>{cat.emoji}</span>
              <div style={{width:4,height:40,borderRadius:4,background:cat.color,flexShrink:0}} />
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,color:cat.color}}>{cat.title}</div>
                <div style={{fontSize:12,color:"#a0aec0",marginTop:2}}>{cat.words.length} words{pct>0?` · ${pct}% best`:""}</div>
              </div>
              <div style={{fontSize:18}}>{pct>=70?"✅":pct>0?"🔄":"○"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Study Screen ── */
function StudyScreen({ category, onStart }) {
  return (
    <div className="fade quiz-wrap">
      <div style={{textAlign:"center",marginBottom:18}}>
        <div style={{fontSize:40}}>{category.emoji}</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,color:category.color,marginTop:6}}>{category.title}</div>
        <div style={{fontSize:13,color:"#718096",marginTop:4}}>Study these words — tap 🔈 to hear each one — then start the quiz!</div>
      </div>

      {category.words.map((w, i) => (
        <div key={w.en} className="wl-row" style={{background:"#fff",border:"1.5px solid #e8edf3",padding:"13px 16px",marginBottom:8,borderRadius:13}}>
          <div className="wl-num" style={{color:category.color,fontSize:17,minWidth:28}}>{i+1}</div>
          {w.isOrdinal ? (
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:17,color:"#02020b"}}>{w.en}</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <SpeakBtn text={w.en} size={32} />
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:24,color:category.color}}>{w.kanji}</div>
              </div>
            </div>
          ) : (
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3}}>
                {w.present
                  ? <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:17,color:"#02020b"}}>
                      <span style={{color:"#a0aec0"}}>{w.present}</span>
                      <span style={{color:"#a0aec0",margin:"0 5px"}}>→</span>
                      <span style={{color:category.color}}>{w.en}</span>
                    </div>
                  : <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:17,color:"#02020b"}}>{w.en}</div>
                }
                <SpeakBtn text={w.en} size={30} />
              </div>
              {w.present
                ? <div style={{fontSize:13,color:"#718096"}}>{w.kana}</div>
                : <div><Furigana kanji={w.kanji} kana={w.kana} size={14} /></div>
              }
              {w.hint && (
                <div style={{fontSize:12,color:"#a0aec0",marginTop:4,fontStyle:"italic"}}>
                  {w.hint.replace("_____",`[${w.en}]`)}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <button type="button" className="btn btn-pink" style={{marginTop:18}} onClick={onStart}>
        Start the quiz! 🚀
      </button>
    </div>
  );
}

/* ── Irregular Verb 3-Step Quiz (one word at a time) ── */
function IrregularVerbGame({ word, allWords, color, shadow, onScore, onNext }) {
  const [step, setStep] = useState(1);

  // Step 1: Show Japanese kana → pick correct past tense
  const [s1Chosen, setS1Chosen] = useState(null);
  const s1Choices = useMemo(() => {
    const others = allWords.filter(w => w.en !== word.en);
    return shuffle([word, ...shuffle(others).slice(0, 3)]);
  }, [word.en]);

  // Step 2: Show present tense → pick correct past tense (correct + 3 alts)
  const [s2Chosen, setS2Chosen] = useState(null);
  const s2Choices = useMemo(() => shuffle([word.en, ...word.alts]), [word.en]);

  // Step 3: Fill in the blank (type it)
  const [s3Val, setS3Val]     = useState("");
  const [s3State, setS3State] = useState(null);
  const [s3Done, setS3Done]   = useState(false);
  const s3Ref = useRef(null);

  const handleS1 = (w) => {
    if (s1Chosen) return;
    const ok = w.en === word.en;
    setS1Chosen(w.en);
    onScore("match", ok);
    setTimeout(() => speak(word.en, 0.85), 250);
    if (ok) setTimeout(() => setStep(2), 1200);
  };

  const handleS2 = (choice) => {
    if (s2Chosen) return;
    const ok = choice === word.en;
    setS2Chosen(choice);
    onScore("spell", ok);
    if (ok) setTimeout(() => { setStep(3); setTimeout(() => s3Ref.current?.focus(), 100); }, 1200);
  };

  const handleS3 = () => {
    if (s3Done) return;
    const ok = s3Val.trim().toLowerCase() === word.en.toLowerCase();
    setS3State(ok ? "correct" : "wrong");
    setS3Done(true);
    onScore("fill", ok);
    if (ok) setTimeout(onNext, 1500);
  };

  const btnBase = { width:"100%", padding:"11px 14px", borderRadius:11, border:"2px solid #e2e8f0",
    background:"#fff", fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:16,
    cursor:"pointer", textAlign:"left", marginBottom:7, transition:"all .12s" };

  const stepColor = (chosen, option, correct) => {
    if (!chosen) return {};
    if (option === correct) return { background:"#f0fff4", borderColor:"#48bb78", color:"#276749" };
    if (option === chosen)  return { background:"#fff5f5", borderColor:"#fc8181", color:"#c53030" };
    return { opacity:.38 };
  };

  return (
    <div className="fade">
      {/* Step indicator */}
      <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:12}}>
        {[1,2,3].map(n => (
          <div key={n} style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
            fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,
            background:n<step?color:n===step?color+"22":"#e2e8f0",
            color:n<step?"#fff":n===step?color:"#a0aec0",
            border:`2px solid ${n<=step?color:"#e2e8f0"}`}}>
            {n<step?"✓":n}
          </div>
        ))}
        <div style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:"#718096",alignSelf:"center",marginLeft:4}}>
          {step===1?"日本語 → 英語":step===2?"現在形 → 過去形":"文に入れよう"}
        </div>
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="card">
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#a0aec0",marginBottom:4}}>日本語の意味はどれ？</div>
            <div style={{fontSize:28,fontWeight:900,color:"#02020b",fontFamily:"'Nunito',sans-serif"}}>{word.kana}</div>
          </div>
          {s1Choices.map(c => (
            <button key={c.en} type="button" style={{...btnBase, ...stepColor(s1Chosen, c.en, word.en)}}
              onClick={() => handleS1(c)} disabled={!!s1Chosen}>
              {c.en}
              {s1Chosen && c.en === word.en && <span style={{float:"right"}}>✅</span>}
              {s1Chosen && c.en === s1Chosen && c.en !== word.en && <span style={{float:"right"}}>❌</span>}
            </button>
          ))}
          {s1Chosen && s1Chosen !== word.en && (
            <>
              <div className="fb bad">❌ It's <b>{word.en}</b> ({word.present} → {word.en})</div>
              <button type="button" className="btn" style={{background:color,boxShadow:`0 4px 0 ${shadow}`}}
                onClick={() => setStep(2)}>Next →</button>
            </>
          )}
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="card">
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#a0aec0",marginBottom:4}}>過去形はどれ？ (past tense of)</div>
            <div style={{fontSize:30,fontWeight:900,color:color,fontFamily:"'Nunito',sans-serif"}}>{word.present}</div>
            <div style={{fontSize:13,color:"#718096",marginTop:2}}>{word.kana}</div>
          </div>
          {s2Choices.map(c => (
            <button key={c} type="button" style={{...btnBase, ...stepColor(s2Chosen, c, word.en)}}
              onClick={() => handleS2(c)} disabled={!!s2Chosen}>
              {c}
              {s2Chosen && c === word.en && <span style={{float:"right"}}>✅</span>}
              {s2Chosen && c === s2Chosen && c !== word.en && <span style={{float:"right"}}>❌</span>}
            </button>
          ))}
          {s2Chosen && s2Chosen !== word.en && (
            <>
              <div className="fb bad">❌ The correct past tense is <b>{word.en}</b></div>
              <button type="button" className="btn" style={{background:color,boxShadow:`0 4px 0 ${shadow}`}}
                onClick={() => { setStep(3); setTimeout(() => s3Ref.current?.focus(), 100); }}>Next →</button>
            </>
          )}
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="card">
          <div style={{fontSize:12,color:"#718096",textAlign:"center",marginBottom:10}}>
            {word.hint.replace("_____","___")}
          </div>
          <div style={{fontSize:11,fontWeight:700,color:"#a0aec0",marginBottom:6}}>
            Type the past tense of <span style={{color,fontWeight:900}}>{word.present}</span>:
          </div>
          <input ref={s3Ref} className={`sinput ${s3State||""}`} type="text" value={s3Val}
            onChange={e => setS3Val(e.target.value)}
            onKeyDown={e => e.key==="Enter" && !s3Done && s3Val.trim() && handleS3()}
            disabled={s3Done} placeholder={`past tense of "${word.present}"… ↵`}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
          {s3Done
            ? <div className={`fb ${s3State}`}>
                {s3State==="correct" ? `✅ Perfect! "${word.en}" — Moving on…` : `❌ It's "${word.en}" (${word.present} → ${word.en})`}
              </div>
            : <button type="button" className="btn btn-pink"
                style={{background:color,boxShadow:`0 4px 0 ${shadow}`,marginTop:9}}
                onClick={handleS3} disabled={!s3Val.trim()}>Check ✓</button>
          }
          {s3Done && s3State === "wrong" && (
            <button type="button" className="btn" style={{background:color,boxShadow:`0 4px 0 ${shadow}`}}
              onClick={onNext}>Next →</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Vocab Game ── */
function VocabGameScreen({ category, onComplete }) {
  const BATCH       = Math.min(6, category.words.length);
  const words       = useMemo(() => shuffle(category.words).slice(0, BATCH), [category.id]);
  const scramble    = useMemo(() => shuffle([...words]), [category.id]);
  const isOrdinalCat    = words[0]?.isOrdinal;
  const isIrregularCat  = !!category.isIrregularVerb;
  // Categories where typing the full phrase is impractical — treat like dialogue
  const isDialogueCat = ["dialogue_expressions","dialogue_expressions_2","g4_dialogue","g4_wh_questions","what_questions","how_questions","g3_phrasal_verbs_1","g3_phrasal_verbs_2","g3_prepositions_1","g3_prepositions_2","g3_connectors","g3_collocations","g3_grammar_patterns","g3_conversational_1","g3_conversational_2"].includes(category.id);
  // Ordinals: match + spell only. Dialogue/WH phrases: match + fill only. Irregular verbs: match + spell + fill. Others: all 3.
  const scoreParts    = isIrregularCat ? ["match","spell","fill"] : isOrdinalCat ? ["match","spell"] : isDialogueCat ? ["match","fill"] : ["match","spell","fill"];
  // Skip Part C for ordinals (no sentences) and dialogue/WH (tiles = the phrase, covered by fill)
  const skipPartC     = isOrdinalCat || isDialogueCat || isIrregularCat;

  const [part,   setPart]   = useState("A");
  const [idx,    setIdx]    = useState(0);
  const [scores, setScores] = useState({});

  const record = (wordEn, type, correct) =>
    setScores(prev => ({...prev, [wordEn]: {...(prev[wordEn]||{}), [type]: correct}}));

  const finalize = (ws, sc) => {
    let right=0, total=0;
    const missed = [];
    ws.forEach(w => {
      const s = sc[w.en]||{};
      scoreParts.forEach(k => { total++; if(s[k]) right++; });
      if (!scoreParts.every(k=>s[k])) missed.push({word:w, scores:s});
    });
    onComplete({pct:Math.round((right/total)*100), right, total, missed, words:ws});
  };

  // use ref so finalize always sees latest scores
  const scRef = useRef(scores);
  useEffect(() => { scRef.current = scores; }, [scores]);

  const goNext = () => {
    const list = part==="C" ? scramble : words;
    if (idx+1 < list.length) {
      setIdx(i=>i+1);
    } else if (part==="A") {
      if (isOrdinalCat) finalize(words, scRef.current);
      else { setPart("B"); setIdx(0); }
    } else if (part==="B") {
      if (skipPartC) finalize(words, scRef.current);
      else { setPart("C"); setIdx(0); }
    } else {
      finalize(words, scRef.current);
    }
  };

  const list = part==="C" ? scramble : words;
  const w    = list[idx];
  const c    = category.color;
  const sh   = category.shadow;

  return (
    <div className="quiz-wrap fade">
      <div className="prog-row">
        {list.map((_,i) => <div key={i} className="pip" style={{background:i<idx?c:i===idx?c+"88":"#e2e8f0"}} />)}
      </div>
      <div className="phdr">
        <div className="plabel">PART {part} · {idx+1}/{list.length}</div>
        <div className="ptitle" style={{color:c}}>
          {part==="A" ? (isIrregularCat ? "⏪ Irregular Verb Quiz" : isDialogueCat ? "🔤 Match" : "🔤 Match & Spell") : part==="B"?"🔍 Fill in the Blank":"🧩 Unscramble"}
        </div>
      </div>

      {part==="A" && isIrregularCat && <IrregularVerbGame key={`IRR-${idx}`} word={w} allWords={words} color={c} shadow={sh}
        onScore={(t,ok)=>record(w.en,t,ok)} onNext={goNext} />}
      {part==="A" && !isIrregularCat && <PartA key={`A-${idx}`} word={w} allWords={words} color={c} shadow={sh}
        isDialogue={isDialogueCat} categoryId={category.id}
        onScore={(t,ok)=>record(w.en,t,ok)} onNext={goNext} />}
      {part==="B" && <PartB key={`B-${idx}-${w.en}`} word={w} allWords={words} color={c} shadow={sh}
        isDialogue={isDialogueCat}
        onScore={ok=>record(w.en,"fill",ok)} onNext={goNext} />}
      {part==="C" && <PartC key={`C-${idx}`} word={w} color={c} shadow={sh} onNext={goNext} />}
    </div>
  );
}

/* ── Part A ── */
function PartA({ word, allWords, color, shadow, onScore, onNext, isDialogue, categoryId }) {
  const [matchDone,    setMatchDone]    = useState(false);
  const [matchedWord,  setMatchedWord]  = useState(null);
  const [spellVal,     setSpellVal]     = useState("");
  const [spellState,   setSpellState]   = useState(null);
  const [spellDone,    setSpellDone]    = useState(false);
  const [showHint,     setShowHint]     = useState(false);
  const spellRef = useRef(null);

  const needsCapital = ["months","days"].includes(categoryId);

  const choices = useMemo(() => {
    const others = allWords.filter(w => w.en !== word.en);
    return shuffle([word, ...shuffle(others).slice(0,3)]);
  }, [word.en]);

  const handleMatch = w => {
    if (matchDone) return;
    const correct = w.en === word.en;
    setMatchedWord(w.en);
    setMatchDone(true);
    onScore("match", correct);
    setTimeout(() => speak(word.en, 0.85), 300);
    if (!isDialogue) setTimeout(() => spellRef.current?.focus(), 350);
  };

  const handleSpell = () => {
    if (spellDone) return;
    const typed = spellVal.trim();
    const ok = needsCapital
      ? typed === word.en
      : typed.toLowerCase() === word.en.toLowerCase();
    setSpellState(ok ? "correct" : "wrong");
    setSpellDone(true);
    onScore("spell", ok);
    if (ok) setTimeout(onNext, 1500);
  };

  // Dialogue mode: auto-advance after match if correct
  useEffect(() => {
    if (isDialogue && matchDone && matchedWord === word.en) {
      setTimeout(onNext, 1500);
    }
  }, [matchDone]);

  const canNext = isDialogue ? (matchDone && matchedWord !== word.en) : (matchDone && spellDone && spellState !== "correct");

  return (
    <div>
      <div className="card">
        {word.isOrdinal ? (
          <div className="ord-target">
            <div className="ord-num">{word.kanji}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:6}}>
              <SpeakBtn text={word.en} size={34} />
              <div className="ord-hint">Tap 🔈 to hear the word</div>
            </div>
          </div>
        ) : (
          <div className="wdisplay">
            <Furigana kanji={word.kanji} kana={word.kana} size={isDialogue ? 18 : 26} />
            <div style={{marginTop:8}}>
              <SpeakBtn text={word.en} size={36} />
            </div>
          </div>
        )}
        <div style={{fontSize:12,fontWeight:700,color:"#a0aec0",marginBottom:9}}>
          {isDialogue ? "Choose the English expression:" : "Choose the English word:"}
        </div>
        {choices.map(c => {
          let btnClass = "cbtn";
          if (matchDone) {
            if (c.en === word.en) btnClass += " correct";           // always green the right answer
            else if (c.en === matchedWord) btnClass += " wrong";    // red only what they clicked
          }
          return (
            <button type="button" key={c.en}
              className={btnClass}
              style={matchDone && c.en !== word.en && c.en !== matchedWord ? {opacity:.38} : {}}
              onClick={() => handleMatch(c)} disabled={matchDone}>
              <span style={{fontSize: isDialogue ? 14 : 16}}>{c.en}</span>
              {matchDone && c.en===word.en && <span style={{marginLeft:"auto"}}>✅</span>}
              {matchDone && c.en===matchedWord && c.en!==word.en && <span style={{marginLeft:"auto"}}>❌</span>}
            </button>
          );
        })}
      </div>

      {/* Spelling card — skip for dialogue expressions */}
      {!isDialogue && (
        <div className="card">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
            <div style={{fontSize:11,fontWeight:700,color:"#a0aec0"}}>
              Now spell it! ✏️
              {needsCapital && <span className="cap-note">⚠️ capitals matter!</span>}
            </div>
            <SpeakBtn text={word.en} size={28} />
          </div>
          <input ref={spellRef} className={`sinput ${spellState||""}`} type="text" value={spellVal}
            onChange={e => setSpellVal(e.target.value)}
            onKeyDown={e => e.key==="Enter" && !spellDone && spellVal.trim() && handleSpell()}
            disabled={spellDone} placeholder="type the word… then press Enter ↵"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
          {!word.isOrdinal && (
            <>
              <button type="button" className="hbtn" onClick={() => setShowHint(v=>!v)}>
                {showHint?"▲":"▼"} Show hint
              </button>
              {showHint && <div className="hbox">{word.hint}</div>}
            </>
          )}
          {spellDone
            ? <div className={`fb ${spellState}`}>
                {spellState==="correct"
                  ? "✅ Perfect!"
                  : spellVal.trim().toLowerCase() === word.en.toLowerCase()
                    ? `❌ Almost! It's "${word.en}" — check the capital letter!`
                    : `❌ Not quite! It's "${word.en}"`
                }
              </div>
            : <button type="button" className="btn btn-pink"
                style={{background:color,boxShadow:`0 4px 0 ${shadow}`,marginTop:9}}
                onClick={handleSpell} disabled={!spellVal.trim()}>Check ✓</button>
          }
        </div>
      )}

      {canNext && (
        <button type="button" className="btn"
          style={{background:color,boxShadow:`0 4px 0 ${shadow}`}} onClick={onNext}>
          Next →
        </button>
      )}
    </div>
  );
}

/* ── Sentence-translation renderer — splits on %%highlighted%% markers ── */
function TransDisp({ trans }) {
  if (!trans) return null;
  const parts = trans.split("%%");
  return (
    <div className="trans-disp">
      {parts.map((p, i) =>
        i % 2 === 1
          ? <span key={i} className="trans-hl">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </div>
  );
}

/* ── Part B ── */
function PartB({ word, allWords, color, shadow, onScore, onNext, isDialogue }) {
  const [chosen, setChosen] = useState(null);
  const [done,   setDone]   = useState(false);

  const choices = useMemo(() => {
    const others = allWords.filter(w => w.en !== word.en);
    return shuffle([word, ...shuffle(others).slice(0,2)]);
  }, [word.en]);

  const parts = word.hint.split("_____");

  const pick = w => {
    if (done) return;
    const correct = w.en === word.en;
    setChosen(w.en); setDone(true); onScore(correct);
    setTimeout(() => speak(word.en, 0.85), 300);
    if (correct) setTimeout(onNext, 1500);
  };

  return (
    <div>
      <div className="card">
        {isDialogue ? (
          <div>
            {word.speakerA ? (
              <div className="dia-box">
                <div className="dia-row">
                  <span className="dia-speaker dia-a">A</span>
                  <span className="dia-text">{word.speakerA}</span>
                </div>
                <div className="dia-row">
                  <span className="dia-speaker dia-b">B</span>
                  <span className="dia-text dia-blank">_________</span>
                </div>
              </div>
            ) : (
              <>
                <div style={{fontSize:12,color:"#a0aec0",textAlign:"center",marginBottom:4}}>Situation 💬</div>
                <div className="sen-disp" style={{fontSize:14}}>{word.hint}</div>
              </>
            )}
            <div style={{fontSize:12,color:"#718096",textAlign:"center",marginBottom:12}}>
              <Furigana kanji={word.kanji} kana={word.kana} size={15} />
            </div>
          </div>
        ) : (
          <div>
            <div className="sen-disp">
              {parts[0]}<span className="blank">_____</span>{parts[1]||""}
            </div>
            {word.trans && <TransDisp trans={word.trans} />}
            <div className="pc-note">💡 You'll unscramble this sentence in Part C!</div>
          </div>
        )}
        <div style={{fontSize:12,fontWeight:700,color:"#a0aec0",marginBottom:9}}>
          {isDialogue ? "Choose the correct response:" : "Choose the missing word:"}
        </div>
        {choices.map(c => (
          <button type="button" key={c.en}
            className={`fbtn ${done ? (c.en===word.en?"correct":c.en===chosen?"wrong":"") : ""}`}
            onClick={() => pick(c)} disabled={done}
            style={{fontSize: isDialogue ? 13 : 17, textAlign:"left", padding:"12px 14px"}}>
            {c.en}
          </button>
        ))}
        {done && (
          <div className={`fb ${chosen===word.en?"ok":"bad"}`}>
            {chosen===word.en ? "✅ Correct!" : `❌ It's "${word.en}"`}
          </div>
        )}
      </div>
      {done && chosen !== word.en && (
        <button type="button" className="btn"
          style={{background:color,boxShadow:`0 4px 0 ${shadow}`}} onClick={onNext}>
          Next →
        </button>
      )}
    </div>
  );
}

/* ── Part C grammar lesson ── */
function GrammarLesson({ answer, onClose }) {
  // Split answer into tokens (remove trailing period/punctuation for analysis)
  const tokens = answer.replace(/ \.$/, "").replace(/ !$/, "").replace(/ \?$/, "").split(" ");

  // Heuristic slot labels for common simple sentence patterns
  // We colour the first 1-2 tokens blue (subject), next 1-2 green (verb/action), rest orange (details)
  const getSlots = ts => {
    // Detect patterns: "Let's ...", "There are/is ...", "Does ...", "Is ...", "Please ..."
    const first = ts[0].toLowerCase();
    if (first === "let's" || first === "please") {
      return ts.map((t,i) => i===0 ? "starter" : i===1 ? "action" : "detail");
    }
    if (first === "there") {
      return ts.map((t,i) => i<=1 ? "starter" : i===2 ? "subject" : "detail");
    }
    if (["does","is","can","do","are","was","were"].includes(first)) {
      return ts.map((t,i) => i===0 ? "action" : i===1 ? "subject" : i===2 ? "action" : "detail");
    }
    // Default SVO: first 1 or 2 = subject, next 1-2 = verb, rest = detail
    const subjectEnd = ts[1] && ["is","are","was","were","can","will","has","have","goes","likes","loves","plays","gets","works","lives","makes","gives","puts","buys","eats","sees","goes","turns","study","eat","go","like","play","watch"].includes(ts[1].toLowerCase()) ? 1 :
                       ts[2] && ["is","are","was","were","can","will","has","have","goes","likes","loves","plays","gets","works","lives","makes","gives","puts","buys","eats","sees","goes","turns","study","eat","go","like","play","watch"].includes(ts[2].toLowerCase()) ? 2 : 1;
    return ts.map((t,i) => i < subjectEnd ? "subject" : i === subjectEnd || i === subjectEnd+1 ? "action" : "detail");
  };

  const slots = getSlots(tokens);
  const slotInfo = {
    subject: { label:"だれが・なにが", color:"#3b82f6", bg:"#dbeafe" },
    action:  { label:"どうする・どんな", color:"#16a34a", bg:"#dcfce7" },
    detail:  { label:"くわしく", color:"#d97706", bg:"#fef3c7" },
    starter: { label:"はじめの言葉", color:"#7c3aed", bg:"#ede9fe" },
  };

  return (
    <div style={{background:"#fffbf0",border:"2px solid #e6aa68",borderRadius:16,padding:"14px 16px",marginTop:10}}>
      <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,color:"#02020b",marginBottom:8,textAlign:"center"}}>
        💡 文のじゅんばんのヒント
      </div>

      {/* Rule */}
      <div style={{background:"#fff",borderRadius:11,padding:"10px 12px",marginBottom:10,border:"1px solid #f0e0c0"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#4a5568",marginBottom:6,textAlign:"center"}}>英語の文はこのじゅんばんです：</div>
        <div style={{display:"flex",gap:5,justifyContent:"center",flexWrap:"wrap",marginBottom:8}}>
          {[{s:"subject",l:"① だれが・なにが"},{s:"action",l:"② どうする"},{s:"detail",l:"③ くわしく"}].map(({s,l})=>(
            <div key={s} style={{background:slotInfo[s].bg,color:slotInfo[s].color,borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:800,fontFamily:"'Nunito',sans-serif"}}>
              {l}
            </div>
          ))}
        </div>
        <div style={{fontSize:12,color:"#c53030",textAlign:"center",fontFamily:"'Nunito',sans-serif",fontWeight:700}}>
          ⚠️ 日本語とちがいます！<br/>英語は <b>「だれが」を一番さいしょ</b> に言います。
        </div>
      </div>

      {/* This sentence broken down */}
      <div style={{fontSize:11,fontWeight:700,color:"#a0aec0",marginBottom:5,textAlign:"center",fontFamily:"'Nunito',sans-serif"}}>この文をみてみよう：</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center",marginBottom:8}}>
        {tokens.map((t,i) => {
          const s = slotInfo[slots[i]];
          return (
            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{background:s.bg,color:s.color,borderRadius:7,padding:"4px 9px",fontSize:14,fontWeight:800,fontFamily:"'Nunito',sans-serif"}}>{t}</div>
              <div style={{fontSize:9,fontWeight:700,color:s.color,fontFamily:"'Nunito',sans-serif"}}>{s.label}</div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={onClose}
        style={{width:"100%",padding:"9px",borderRadius:11,border:"none",background:"#7fb069",color:"#fff",fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,cursor:"pointer"}}>
        わかった！もう一度やってみる 💪
      </button>
    </div>
  );
}

/* ── Part C ── */
function PartC({ word, color, shadow, onNext }) {
  const tiles = useMemo(() => shuffle(word.tiles), [word.en]);
  const [answer,      setAnswer]      = useState([]);
  const [used,        setUsed]        = useState(new Set());
  const [result,      setResult]      = useState(null);
  const [shake,       setShake]       = useState(false);
  const [peekCount,   setPeekCount]   = useState(0);
  const [peekVisible, setPeekVisible] = useState(false);
  const [showLesson,  setShowLesson]  = useState(false);

  // Strip %% markers from trans for clean Japanese display
  const jpText = word.trans ? word.trans.replace(/%%/g, "") : null;

  const add = (tile, i) => {
    if (used.has(i) || result==="correct") return;
    setAnswer(p=>[...p,{tile,i}]); setUsed(p=>new Set([...p,i]));
  };
  const remove = pos => {
    if (result==="correct") return;
    const item=answer[pos];
    setAnswer(p=>p.filter((_,j)=>j!==pos));
    setUsed(p=>{ const n=new Set(p); n.delete(item.i); return n; });
  };
  const check = () => {
    if (answer.map(a=>a.tile).join(" ")===word.answer) {
      setResult("correct");
      setTimeout(onNext, 1500);
    } else {
      setShake(true); setResult("wrong");
      setTimeout(()=>{ setShake(false); setResult(null); }, 500);
    }
  };

  const handlePeek = () => {
    const next = peekCount + 1;
    setPeekCount(next);
    setPeekVisible(true);
    setTimeout(() => setPeekVisible(false), 3000);
    if (next >= 3) setShowLesson(true);
  };

  useEffect(() => {
    const onKey = e => { if (e.key === "Enter" && result !== "correct" && answer.length > 0) check(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, result]);

  return (
    <div>
      <div className="card">
        {/* Japanese clue */}
        {jpText && (
          <div style={{textAlign:"center",marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:"#a0aec0",marginBottom:4}}>Japanese clue 🇯🇵</div>
            <div style={{fontSize:17,fontWeight:700,color:"#02020b",fontFamily:"'Nunito',sans-serif",lineHeight:1.6}}>{jpText}</div>
          </div>
        )}

        {/* Peek button + flash */}
        {!peekVisible ? (
          <button type="button" onClick={handlePeek}
            style={{width:"100%",marginBottom:8,padding:"6px",borderRadius:10,border:"2px dashed #e6aa68",background:"#fffbf0",fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:12,color:"#d97706",cursor:"pointer"}}>
            👀 ヒントを見る（3びょうかん）{peekCount > 0 ? ` ${peekCount}回め` : ""}
          </button>
        ) : (
          <div style={{background:"#fef9c3",border:"2px solid #fde68a",borderRadius:10,padding:"8px 12px",marginBottom:8,textAlign:"center",fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:14,color:"#92400e"}}>
            {word.answer.replace(" .",".").replace(" !","!").replace(" ?","?")} ⏱️
          </div>
        )}

        <div style={{fontSize:11,fontWeight:700,color:"#a0aec0",marginBottom:5}}>Build the sentence:</div>
        <div className={`tile-area ${shake?"shk":""}`}>
          {answer.map((a,pos)=>(
            <button type="button" key={pos} className="tile in-ans" onClick={()=>remove(pos)}>{a.tile}</button>
          ))}
          {answer.length===0 && <span style={{color:"#cbd5e0",fontSize:11,padding:"3px 4px"}}>Tap words below ↓</span>}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:9}}>
          {tiles.map((tile,i)=>(
            <button type="button" key={i} className={`tile ${used.has(i)?"used":""}`}
              onClick={()=>add(tile,i)}>{tile}</button>
          ))}
        </div>
        {result==="wrong" && <div className="fb bad">❌ Not quite — tap a word to remove it</div>}
        {result!=="correct" && (
          <div style={{display:"flex",gap:7}}>
            <button type="button"
              style={{flex:1,padding:"10px",borderRadius:"11px",border:"2px solid #e2e8f0",background:"#f7fafc",fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:12,color:"#718096",cursor:"pointer"}}
              onClick={()=>{setAnswer([]);setUsed(new Set());setResult(null);}}>Reset</button>
            <button type="button" className="btn"
              style={{flex:2,background:color,boxShadow:`0 4px 0 ${shadow}`,marginTop:0,padding:"10px"}}
              onClick={check} disabled={answer.length===0}>Check ✓</button>
          </div>
        )}
        {result==="correct" && <div className="fb ok">✅ Perfect sentence! 🎉 Moving on…</div>}
      </div>

      {showLesson && !result && (
        <GrammarLesson answer={word.answer} onClose={() => setShowLesson(false)} />
      )}
    </div>
  );
}

/* ── Mandatory Review ── */
function MandatoryReview({ missed, category, allCategoryWords, onDone }) {
  const [queue,  setQueue]  = useState(() => shuffle(missed.map(m=>m.word)));
  const [qIdx,   setQIdx]   = useState(0);
  const [chosen, setChosen] = useState(null);
  const [rdone,  setRDone]  = useState(false);
  const [allClear, setAllClear] = useState(false);

  const current   = queue[qIdx];
  const remaining = queue.length - qIdx;

  const choices = useMemo(() => {
    if (!current) return [];
    const others = allCategoryWords.filter(w => w.en !== current.en);
    return shuffle([current, ...shuffle(others).slice(0,3)]);
  }, [current?.en, allCategoryWords]);

  const pick = w => {
    if (rdone) return;
    setChosen(w.en); setRDone(true);
    setTimeout(() => speak(current.en, 0.85), 300);
  };

  const next = () => {
    const correct = chosen === current.en;
    setChosen(null); setRDone(false);

    if (correct) {
      // Remove from queue
      if (qIdx + 1 >= queue.length) {
        setAllClear(true);
      } else {
        setQIdx(i => i + 1);
      }
    } else {
      // Move current word to end so they must face it again
      setQueue(prev => {
        const next = [...prev];
        const word = next.splice(qIdx, 1)[0];
        next.push(word);
        return next;
      });
      // qIdx stays — next word slides in
    }
  };

  if (allClear) {
    return (
      <div className="quiz-wrap fade" style={{textAlign:"center",paddingTop:48}}>
        <div style={{fontSize:60}}>🎊</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:26,color:"#02020b",marginTop:12}}>All cleared!</div>
        <div style={{fontSize:15,color:"#718096",marginTop:7}}>You got every missed word right!</div>
        <button type="button" className="btn btn-pink" style={{marginTop:28,maxWidth:320,margin:"28px auto 0"}} onClick={onDone}>
          See my results →
        </button>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="quiz-wrap fade">
      <div className="rev-banner">
        <div className="rev-banner-title">📝 Review Time!</div>
        <div className="rev-banner-sub">
          {remaining} word{remaining!==1?"s":""} left — get them all right to finish
        </div>
      </div>

      <div className="card">
        {current.isOrdinal ? (
          <div className="ord-target">
            <div className="ord-num">{current.kanji}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:8}}>
              <SpeakBtn text={current.en} size={36} />
              <div className="ord-hint">Tap 🔈 to hear the word</div>
            </div>
          </div>
        ) : category.id === "dialogue_expressions" ? (
          <div>
            <div style={{fontSize:12,color:"#a0aec0",textAlign:"center",marginBottom:4}}>Situation 💬</div>
            <div className="sen-disp" style={{fontSize:13}}>
              {current.hint}
            </div>
            <div style={{textAlign:"center",marginBottom:8}}>
              <Furigana kanji={current.kanji} kana={current.kana} size={14} />
            </div>
            <div style={{textAlign:"center"}}><SpeakBtn text={current.en} size={32} /></div>
          </div>
        ) : (
          <div className="wdisplay">
            <Furigana kanji={current.kanji} kana={current.kana} size={28} />
            <div style={{marginTop:10}}><SpeakBtn text={current.en} size={38} /></div>
          </div>
        )}
        <div style={{fontSize:12,fontWeight:700,color:"#a0aec0",marginBottom:9}}>
          {category.id === "dialogue_expressions" ? "Choose the correct response:" : "Choose the English word:"}
        </div>
        {choices.map(c => (
          <button type="button" key={c.en}
            className={`cbtn ${rdone && c.en===current.en ? "correct" : ""}`}
            style={{...(rdone && c.en!==current.en ? {opacity:.42} : {}), fontSize: category.id === "dialogue_expressions" ? 13 : 16}}
            onClick={() => pick(c)} disabled={rdone}>
            <span>{c.en}</span>
            {rdone && c.en===current.en && <span style={{marginLeft:"auto"}}>✅</span>}
          </button>
        ))}
        {rdone && (
          <div className={`fb ${chosen===current.en?"ok":"bad"}`}>
            {chosen===current.en
              ? "✅ Correct!"
              : `❌ It's "${current.en}" — you'll see it again!`}
          </div>
        )}
      </div>

      {rdone && (
        <button type="button" className="btn"
          style={{background:category.color,boxShadow:`0 4px 0 ${category.shadow}`}}
          onClick={next}>
          {chosen===current.en ? "Next →" : "Continue →"}
        </button>
      )}
    </div>
  );
}

/* ── Results ── */
function ResultsScreen({ results, category, onHome, onRetry }) {
  const { pct, right, total, missed, words } = results;
  const cleared   = pct >= 70;
  const goodWords = words.filter(w => !missed.find(m => m.word.en === w.en));
  const isOrdinalCat  = words[0]?.isOrdinal;
  const isDialogueCat = ["dialogue_expressions","dialogue_expressions_2","g4_dialogue","g4_wh_questions","what_questions","how_questions","g3_phrasal_verbs_1","g3_phrasal_verbs_2","g3_prepositions_1","g3_prepositions_2","g3_connectors","g3_collocations","g3_grammar_patterns","g3_conversational_1","g3_conversational_2"].includes(category.id);

  return (
    <div className="quiz-wrap fade">
      <div style={{textAlign:"center",padding:"24px 0 18px"}}>
        <div style={{fontSize:54}}>{cleared?"🎉":"💪"}</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:54,color:category.color}}>{pct}%</div>
        <div style={{fontSize:15,color:"#718096",marginTop:4}}>
          {right}/{total} correct · {cleared?"Category cleared! ⭐":"Keep going!"}
        </div>
      </div>

      {goodWords.length > 0 && (
        <div className="card">
          <div style={{fontSize:12,fontWeight:700,color:"#48bb78",marginBottom:8}}>✅ Got right first time</div>
          {goodWords.map(w => <span key={w.en} className="chip">{w.en}</span>)}
        </div>
      )}

      {missed.length > 0 && (
        <div className="card">
          <div style={{fontSize:12,fontWeight:700,color:"#fc8181",marginBottom:8}}>❌ Needed review</div>
          {missed.map(({word:w, scores:s}) => (
            <div key={w.en} className="rev-item">
              <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:16,color:"#02020b"}}>
                {w.en}{w.isOrdinal ? ` — ${w.kanji}` : ""}
              </div>
              <div style={{fontSize:12,color:"#a0aec0",marginTop:3}}>
                Match: {s.match?"✅":"❌"}
                {!isOrdinalCat && !isDialogueCat && ` · Spell: ${s.spell?"✅":"❌"}`}
                {isOrdinalCat && ` · Spell: ${s.spell?"✅":"❌"}`}
                {(isDialogueCat || (!isOrdinalCat && !isDialogueCat)) && ` · Fill: ${s.fill?"✅":"❌"}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn"
        style={{background:category.color,boxShadow:`0 4px 0 ${category.shadow}`}}
        onClick={onRetry}>Try again ↩</button>
      <button type="button" className="btn btn-gray" style={{marginTop:10}} onClick={onHome}>
        Back to categories 📚
      </button>
    </div>
  );
}
