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
const DIALOGUE_PROGRESS_KEY = "eiken_dialogue_progress_v1";
const MISSED_WORDS_KEY = "eiken_missed_words_v1";
const GRAMMAR_PART_PROGRESS_KEY = "eiken_grammar_part_progress_v1";
const GRAMMAR_FINAL_PROGRESS_KEY = "eiken_grammar_final_progress_v1";
const DIALOGUE_NOTES_SEEN_KEY = "eiken_dialogue_notes_seen_v1";

/* ── Dialogue Test Data ── */
// Per-topic relationship labels shown above each chat bubble (fallback to DEFAULT_SPEAKER_LABEL by emoji)
const AT_HOME_LABELS   = { "👩":"Mom", "👨":"Dad", "👧":"Girl", "👦":"Boy", "🧒":"You" };
const AT_SCHOOL_LABELS = { "👩":"Teacher", "👨":"Teacher", "👧":"Girl", "👦":"Boy", "🧒":"You" };
const FRIENDS_LABELS   = { "👦":"Boy", "👧":"Girl", "👨":"Man", "👩":"Woman", "🧒":"You" };

const DIALOGUE_TOPICS = [
  { id:"at_home",     title:"AT HOME",     emoji:"🏠", color:"#7c3aed", shadow:"#4c1d95", level:"5", speakerLabels: AT_HOME_LABELS },
  { id:"at_school",   title:"AT SCHOOL",   emoji:"🏫", color:"#0891b2", shadow:"#155e75", level:"5", speakerLabels: AT_SCHOOL_LABELS },
  { id:"with_friends",title:"WITH FRIENDS",emoji:"👫", color:"#f43f5e", shadow:"#9f1239", level:"5", speakerLabels: FRIENDS_LABELS },
  { id:"g4_at_home",   title:"AT HOME",   emoji:"🏡", color:"#2563eb", shadow:"#1e3a8a", level:"4", speakerLabels: AT_HOME_LABELS },
  { id:"g4_at_school", title:"AT SCHOOL", emoji:"🏫", color:"#f97316", shadow:"#c2410c", level:"4", speakerLabels: AT_SCHOOL_LABELS },
  { id:"g4_with_friends", title:"WITH FRIENDS", emoji:"👫", color:"#db2777", shadow:"#9d174d", level:"4", speakerLabels: FRIENDS_LABELS },
  { id:"g3_travel", title:"TRAVEL & VACATION", emoji:"✈️", color:"#0891b2", shadow:"#155e75", level:"3", speakerLabels: FRIENDS_LABELS },
  { id:"g3_directions", title:"GETTING AROUND", emoji:"🧭", color:"#65a30d", shadow:"#3f6212", level:"3", speakerLabels: FRIENDS_LABELS },
  { id:"g3_family", title:"FAMILY LIFE", emoji:"🏡", color:"#e11d48", shadow:"#881337", level:"3", speakerLabels: AT_HOME_LABELS },
];

// Fallback label when a topic has no speakerLabels entry for that emoji
const DEFAULT_SPEAKER_LABEL = { "🧒":"You", "👦":"Boy", "👧":"Girl", "👨":"Man", "👩":"Woman", "👨‍🏫":"Teacher", "👩‍🏫":"Teacher" };
function speakerLabel(topic, emoji) {
  return topic?.speakerLabels?.[emoji] || DEFAULT_SPEAKER_LABEL[emoji] || "";
}

// Practice-set progression icons, varied by grade level so sets never look identical across grades
const PRACTICE_EMOJI_BY_LEVEL = {
  "5": { practice1:"🥚", practice2:"🐣", practice3:"🐥" }, // egg -> chick -> chick
  "4": { practice1:"🌱", practice2:"🌿", practice3:"🌳" }, // sprout -> sapling -> tree
  "3": { practice1:"🥉", practice2:"🥈", practice3:"🥇" }, // bronze -> silver -> gold
};
const practiceEmoji = (level, key) => (PRACTICE_EMOJI_BY_LEVEL[level] || PRACTICE_EMOJI_BY_LEVEL["5"])[key];

const mkQ = (a, aEmoji, b, bEmoji, opts, correct, hint, transA, transB, followUp, mid, midEmoji, transMid) =>
  ({ a, aEmoji: aEmoji||"👩", b, bEmoji: bEmoji||"👦", opts, correct, hint, transA, transB, followUp, mid, midEmoji: midEmoji||"👦", transMid });

const DIALOGUE_TESTS = {
  at_home: {
    practice1: [
      mkQ("Mom, where are my shoes?","👦","( )","👩",
        ["It's Tuesday.","They're by the door.","I like shoes.","Yes, I do."],
        1,
        "「Where」はばしょをきく言葉だよ！\n「They're by the door.」→ ばしょを答えているから正解！\n「It's Tuesday.」→ これは「いつ？」への答えだよ。\n「I like shoes.」→ これは「すきなもの」を答えているよ。",
        "お母さん、ぼくのくつはどこ？","ドアのそばにあるよ。"),
      mkQ("I'm really hungry, Mom.","👦","( ) Breakfast is ready.","👩",
        ["Me too.","No, I'm not.","That's OK.","You're welcome."],
        0,
        "「Me too.」→「わたしも」というどういの言葉だよ。おなかがすいたという話に自然につながるから正解！\n「No, I'm not.」→ はんたいの意味になってしまうよ。\n「That's OK.」と「You're welcome.」→ あやまりやお礼への返事だから、ここでは合わないよ。",
        "ぼく、すごくおなかがすいたよ、お母さん。","わたしも。朝ごはんができたよ。"),
      mkQ("When is Dad coming home?","👧","( )","👩",
        ["He's in the kitchen.","He likes cooking.","At six o'clock.","It's cold today."],
        2,
        "「When」はじかんをきく言葉だよ！\n「At six o'clock.」→ じかんを答えているから正解！\n「He's in the kitchen.」→ これは「どこ？」への答えだよ。\n「He likes cooking.」→ これは「すきなこと」を答えているよ。",
        "お父さんはいつ帰ってくるの？","6時だよ。"),
      mkQ("Please clean your room, Tom.","👩","( )","👦",
        ["All right, Mom.","It's Tuesday.","I like cleaning.","She's at home."],
        0,
        "お母さんが「〜してください」と言っているよ。なんて答える？\n「All right, Mom.」→ 「わかった！」という意味だから正解！\n「I like cleaning.」→ すきかどうかは聞かれていないよ。",
        "トム、部屋をそうじしてね。","わかった、お母さん。"),
      mkQ("Mom, can I watch TV now?","👦","( )","👩",
        ["It's a good show.","Of course.","I watch TV too.","It's in the living room."],
        1,
        "「Can I~?」はゆるしをもとめる言い方だよ。お母さんはなんて言う？\n「Of course.」→ 「もちろん！」という意味だから正解！\n「It's in the living room.」→ これは「どこ？」への答えだよ。",
        "お母さん、今テレビを見てもいい？","もちろん。"),
      mkQ("Let's set the table. ( )","👩","OK, Mom.","👧",
        ["Dinner is almost ready.","I like the table.","It's Tuesday.","You can go home."],
        0,
        "「Let's set the table.（テーブルをセットしよう）」のあとに、お母さんが自然に言いそうなことは？「Dinner is almost ready.（夕食がもうすぐできるよ）」が正解！\n「You can go home.」→ 学校の先生が使う言葉だから、ここでは合わないよ。",
        "テーブルをセットしよう。夕食がもうすぐできるよ。","わかった、お母さん。"),
      mkQ("Where's Dad, Mom?","👦","( )","👩",
        ["He likes the garden.","He's in the garden.","He's tall.","He comes home at six."],
        1,
        "「Where's Dad?」→ ばしょを答えよう！\n「He's in the garden.」→ ばしょを答えているから正解！\n「He likes the garden.」→ これは「すきなばしょ」を言っているよ。\n「He comes home at six.」→ これは「いつ？」への答えだよ。",
        "お父さんはどこ、お母さん？","庭にいるよ。"),
    ],
    practice2: [
      mkQ("Mom, I can't find my umbrella.","👧","( ) I put it there this morning.","👩",
        ["It's raining outside.","Check by the front door.","You need an umbrella.","It's a nice umbrella."],
        1,
        "「I put it there」→「そこに置いたよ」という意味。「there（そこ）」はどこのこと？\n「Check by the front door.」→ ばしょを教えているから正解！「there」= 玄関のそばだね。\n「It's raining outside.」→ てんきのことを言っているよ。かさのばしょじゃないね。",
        "お母さん、かさが見つからないの。今朝そこに置いたのに。","玄関のそばを見てみて。"),
      mkQ("Are you hungry, Ben?","👩","Yes! ( )","👦",
        ["Can I have some pasta, please?","I like pasta.","Pasta is Italian food.","It's in the kitchen."],
        0,
        "Benは「Yes!」と言っているよ。おなかがすいている人は次に何を言う？\n「Can I have some pasta, please?」→ たべものをたのんでいるから正解！\n「I like pasta.」→ すきだと言っているけど、たのんでいないよ。",
        "ベン、おなかすいた？うん！","パスタをもらえる？"),
      mkQ("When is Grandma's birthday?","👦","( ) We're going to have a party!","👧",
        ["She's very kind.","It's next Sunday.","She lives far away.","I like birthday cake."],
        1,
        "「We're going to have a party!」→ パーティーをするよ！いつ？\n「It's next Sunday.」→ 日にちを答えているから正解！\n「I like birthday cake.」→ ケーキのことを言っているけど、「いつ？」に答えていないよ。",
        "おばあちゃんのたんじょう日はいつ？パーティーをするよ！","今度の日曜日だよ。"),
      mkQ("Beth, please don't run in the house.","👩","( ) I'll be careful.","👧",
        ["I can run fast.","I'm sorry, Mom.","The house is big.","I like running."],
        1,
        "お母さんにちゅういされたよ。「I'll be careful.（気をつけます）」の前に何を言う？\n「I'm sorry, Mom.」→ あやまっているから正解！あやまってから「気をつけます」と言うのが自然だね。\n「I can run fast.」→ 速く走れるかどうかは関係ないよ。",
        "ベス、家の中で走らないで。気をつけるね。","ごめんなさい、お母さん。"),
      mkQ("Dad, can we go to the park today?","👧","( ) Put on your shoes!","👨",
        ["This year.","Of course.","The park is nice.","I go to the park."],
        1,
        "「Put on your shoes!（くつをはきなさい！）」→ 公園に行くってこと！お父さんはなんと言った？\n「Of course.」→ 「もちろん！」という意味だから正解！くつをはくように言っているから、OKしたんだね。\n「The park is nice.」→ 公園のことを言っているけど、ゆるしを答えていないよ。",
        "お父さん、今日公園に行ける？くつをはいて！","もちろん。"),
      mkQ("Great job cleaning your room, Jack! ( )","👩","Thanks, Mom!","👦",
        ["You can watch TV now.","It's a nice room.","I like cleaning.","She's my mom."],
        0,
        "部屋をきれいにしたことをほめられたよ。そのあとにお母さんが言いそうなことは？「You can watch TV now.（テレビを見てもいいよ）」がごほうびとして自然だから正解！\n「It's a nice room.」→ 部屋の感想だから、続く言葉として不自然だよ。",
        "部屋をきれいにしてえらいね、ジャック！テレビを見てもいいよ。","ありがとう、お母さん！"),
      mkQ("Where's my sister, Mom?","👦","( ) She'll be home for dinner.","👩",
        ["She's at her friend's house.","She's very funny.","She likes her friends.","She comes home every day."],
        0,
        "「She'll be home for dinner.（ゆうしょくには帰ってくるよ）」→ 今はどこにいる？\n「She's at her friend's house.」→ ばしょを答えているから正解！今は友達の家にいるんだね。\n「She's very funny.」→ どんな人かを言っているけど、ばしょじゃないよ。",
        "お母さん、妹はどこ？夕食には帰ってくるよ。","友達の家にいるよ。"),
    ],
    practice3: [
      mkQ("Ken, your jacket is not in the closet.","👩","( ) I wore it yesterday.","👦",
        ["It's in my room.","I like my jacket.","It's a nice jacket.","The closet is big."],
        0,
        "「I wore it yesterday.（きのう着たよ）」→ 着たあと、ジャケットはどこに行く？\n「It's in my room.」→ ばしょを答えているから正解！きのう着たから、部屋にあるんだね。\n「The closet is big.」→ 「closet（クローゼット）」という言葉をくり返しているよ。だまされないで！",
        "ケン、ジャケットがクローゼットにないよ。きのう着たんだ。","ぼくの部屋にあるよ。"),
      mkQ("Dinner is almost ready. What do you want to drink?","👩","( )","👦",
        ["I'm not hungry.","Dinner smells good.","Water, please.","I ate already."],
        2,
        "「What do you want to DRINK?」→ のみものを答えよう！\n「Water, please.」→ のみものを答えているから正解！\n「Dinner smells good.」→ ゆうしょくのことを言っているけど、のみものじゃないよ。\n「I'm not hungry.」→ 「おなかがすいていない」は、のみものとちがうよ。",
        "もうすぐ夕食よ。何を飲みたい？","水をお願いします。"),
      mkQ("I love this cake, Dad!","👧","( ) I'm glad you like it.","👨",
        ["Me too.","No, I don't.","You're welcome.","That's OK."],
        0,
        "「Me too.」→「わたしも」というどういの言葉だよ。ケーキがすきという話に自然につながるから正解！\n「You're welcome.」→ お礼を言われたときの返事だから、ここでは合わないよ。",
        "このケーキ大好き、お父さん！","ぼくも。気に入ってくれてうれしいよ。"),
      mkQ("Please turn off the TV, Anna. It's time for bed.","👨","( )","👧",
        ["I like this show.","The TV is loud.","OK, Dad. Good night!","It's a good show."],
        2,
        "お父さんがテレビを消してねと言っているよ。もう寝る時間！なんて答える？\n「OK, Dad. Good night!」→ 「わかった！おやすみ！」は、寝る時間への自然な答えだから正解！\n「I like this show.」と「It's a good show.」→ 両方ともテレビ番組のことを言っているよ。だまされないで！",
        "アンナ、テレビを消してね。もう寝る時間だよ。","わかった、お父さん。おやすみ！"),
      mkQ("Mom, can I have some ice cream after dinner?","👦","( ) But finish your vegetables first.","👩",
        ["Ice cream is cold.","Of course.","I like ice cream.","It's in the freezer."],
        1,
        "「But finish your vegetables first.（でも、まず野菜を食べてね）」→ 条件をつけてOKしているよ。どの答えがOKの意味？\n「Of course.」→ 「もちろん！」という意味だから正解！条件をつけてOKしているんだね。\n「It's in the freezer.」→ 「freezer（冷とう庫）」はアイスクリームのばしょだよ。「どこ？」への答えになっているね。",
        "お母さん、夕食のあとアイスを食べてもいい？でも先に野菜を食べてね。","もちろん。"),
      mkQ("Please brush your teeth before bed, Tom. ( )","👩","OK, Mom.","👦",
        ["It's good for your teeth.","It's a nice toothbrush.","I like brushing.","You can go home."],
        0,
        "歯みがきをするようにと言われたよ。そのあとにお母さんが言いそうな理由は？「It's good for your teeth.（歯にいいからね）」が自然な理由だから正解！\n「You can go home.」→ 学校の先生が使う言葉だから、ここでは合わないよ。",
        "寝る前に歯をみがいてね、トム。歯にいいからね。","わかった、お母さん。"),
      mkQ("Dad, where's my brother?","👧","( ) He'll be home for lunch.","👨",
        ["He's playing outside.","He likes playing outside.","He plays outside every day.","He's a good boy."],
        0,
        "「He'll be home for lunch.（お昼には帰ってくるよ）」→ 今はまだ外にいるんだね。今どこ？\n「He's playing outside.」→ 今いるばしょとしていることを答えているから正解！\n「He likes playing outside.」→ すきなことを言っているけど、今どこにいるかじゃないよ。\n「He plays outside every day.」→ まいにちのことを言っているよ。今のことじゃないね。",
        "お父さん、お兄ちゃんはどこ？お昼には帰ってくるよ。","外で遊んでいるよ。"),
    ],
    quiz: [
      mkQ("Mom, where's my math book?","👦","( )","👩",
        ["It's Tuesday.","Math is difficult.","It's on the table.","I like math."],
        2, null,
        "お母さん、算数の教科書はどこ？","テーブルの上にあるよ。"),
      mkQ("I'm starving, Ken!","👩","( ) Let's eat rice and soup.","👦",
        ["Me too.","No, I'm not.","You're welcome.","That's OK."],
        0, null,
        "おなかぺこぺこだよ、ケン！","ぼくも。ごはんとスープを食べよう。"),
      mkQ("Let's pack your bag for the school trip. ( )","👩","OK, Mom.","👦",
        ["It's tomorrow.","It's a nice bag.","I like trips.","You can go home."],
        0, null,
        "遠足のためにかばんの準備をしよう。あしたなの。","わかった、お母さん。"),
      mkQ("Please wash your hands before dinner, Yuki.","👩","( )","👧",
        ["Dinner smells good.","I like dinner.","All right, Mom!","My hands are cold."],
        2, null,
        "ユキ、夕食の前に手を洗ってね。","わかった、お母さん！"),
      mkQ("Mom, can I have a cookie?","👧","( ) Just one, OK?","👩",
        ["Cookies are sweet.","Of course.","It's in the kitchen.","I like cookies."],
        1, null,
        "お母さん、クッキーを食べてもいい？1つだけよ。","もちろん。"),
      mkQ("Thank you for cleaning your room, Sora!","👩","( ) I'm happy to help.","👦",
        ["You're welcome.","Thank you.","I'm sorry.","Good idea."],
        0, null,
        "部屋をそうじしてくれてありがとう、ソラ！","どういたしまして。お手伝いできてうれしいよ。"),
      mkQ("Where's your sister, Kenji?","👩","( ) She said she'll be home by five.","👦",
        ["She's very kind.","She likes the library.","She went to the library.","She goes there every day."],
        2,
        "むずかしい！\n「She likes the library.」→ としょかんがすきだと言っているけど、今どこにいるかじゃないよ。\n「She went to the library.」→ 「went（行った）」→ 今としょかんにいる！「She'll be home by five.（5時までに帰る）」と合っているね。",
        "ケンジ、妹はどこ？5時までに帰ると言っていたよ。","図書館に行ったよ。"),
    ],
  },
  at_school: {
    practice1: [
      mkQ("Ms. Peterson, where's my pencil case?","👦","( )","👩",
        ["It's Tuesday.","It's on your desk.","I like pencils.","Yes, it is."],
        1,
        "「Where」はばしょをきく言葉だよ！\n「It's on your desk.」→ ばしょを答えているから正解！\n「It's Tuesday.」→ これは「いつ？」への答えだよ。\n「I like pencils.」→ すきなものを答えているよ。",
        "ピーターソン先生、ぼくの筆箱はどこですか。","つくえの上にあるよ。"),
      mkQ("I love art class, Ms. Peterson!","👧","( ) You draw very well.","👩",
        ["Thank you.","You're welcome.","I'm sorry.","Excuse me."],
        0,
        "ほめ言葉には「Thank you.（ありがとうございます）」と答えるよ。\n「You're welcome.」→ お礼を言われたときの返事だから、ここでは合わないよ。",
        "図工の授業が大好きです、ピーターソン先生！","ありがとうございます。じょうずに描けますね。"),
      mkQ("Can I go to the bathroom?","👦","( )","👩",
        ["It's down the hall.","Yes, you may.","I like the bathroom.","It's clean."],
        1,
        "「Can I~?」はゆるしをもとめる言い方だよ。先生はなんて言う？\n「Yes, you may.」→ ゆるしているから正解！\n「It's down the hall.」→ これは「どこ？」への答えだよ。\n「I like the bathroom.」→ すきかどうかは聞かれていないよ。",
        "トイレに行ってもいいですか。","はい、いいですよ。"),
      mkQ("Please open your books to page ten.","👩","( )","👦",
        ["OK, Mr. Carter.","It's page ten.","I like books.","She's my teacher."],
        0,
        "先生が「〜してください」と言っているよ。なんて答える？\n「OK, Mr. Carter.」→ 「わかりました！」という意味だから正解！\n「It's page ten.」→ ページのことをくり返しているだけだよ。\n「I like books.」→ すきかどうかは聞かれていないよ。",
        "10ページを開いてください。","わかりました、カーター先生。"),
      mkQ("Let's line up for lunch. ( )","👩","OK, Ms. Baker.","👦",
        ["Please be quiet.","You can go home.","It's a holiday.","See you tomorrow."],
        0,
        "「Let's line up for lunch.（お昼のために並ぼう）」のあとに、先生が自然に言いそうなことは？「Please be quiet.（静かにしてね）」が正解！\n「You can go home.」→ 帰るときに言う言葉だから、ここでは合わないよ。",
        "お昼のために並びましょう。静かにしてね。","わかりました、ベイカー先生。"),
      mkQ("Where's Mr. Adams?","👦","( )","👩",
        ["He likes teaching.","He's in the gym.","He's tall.","He teaches P.E."],
        1,
        "「Where's Mr. Adams?」→ ばしょを答えよう！\n「He's in the gym.」→ ばしょを答えているから正解！\n「He likes teaching.」→ すきなことを言っているよ。\n「He teaches P.E.」→ 教えている科目を言っているけど、ばしょじゃないよ。",
        "アダムズ先生はどこですか。","体育館にいますよ。"),
      mkQ("I finished my worksheet, Mr. Adams.","👦","( )","👨",
        ["Good job!","You're welcome.","I'm sorry.","Excuse me."],
        0,
        "がんばったことを伝えたら、先生はほめてくれるよ。「Good job!（よくできました！）」が自然だから正解！\n「You're welcome.」→ お礼を言われたときの言葉だよ。",
        "ワークシートが終わりました、アダムズ先生。","よくできました！"),
    ],
    practice2: [
      mkQ("I can't find my eraser.","👧","( ) Maybe it's still there.","👩",
        ["Check the art room.","It's a red eraser.","You need an eraser.","It's a nice eraser."],
        0,
        "「Check the art room.」→ ばしょを教えているから正解！図工室にあるかもしれないね。\n「It's a red eraser.」→ 消しゴムの色を言っているだけだよ。ばしょじゃないね。",
        "消しゴムが見つからないの。","図工室を見てみて。まだそこにあるかも。"),
      mkQ("Are you ready for the test, Jack?","👩","Yes! ( )","👦",
        ["I studied every night.","I like tests.","Tests are hard.","It's in my bag."],
        0,
        "ジャックは「Yes!（うん！）」と言っているよ。じゅんびができている人は次に何を言う？\n「I studied every night.」→ 「毎晩勉強したよ」だから、じゅんびができている理由になるので正解！\n「Tests are hard.」→ かんそうを言っているだけで、じゅんびの話じゃないよ。\n「It's in my bag.」→ これは「どこ？」への答えだよ。",
        "ジャック、テストの準備はできた？","うん！毎晩勉強したよ。"),
      mkQ("When is the sports day?","👦","( ) We need to practice running!","👧",
        ["She's very fast.","It's next Friday.","She likes sports.","I like running."],
        1,
        "「We need to practice running!」→ 走る練習が必要だよ！いつ？\n「It's next Friday.」→ 日にちを答えているから正解！\n「I like running.」→ すきなことを言っているけど、「いつ？」に答えていないよ。",
        "運動会はいつ？","今度の金曜日だよ。走る練習をしなきゃ！"),
      mkQ("Tom, please don't talk during class.","👩","( ) I'll be quiet.","👦",
        ["I can talk loud.","I'm sorry, Ms. Green.","The class is big.","I like talking."],
        1,
        "先生にちゅういされたよ。「I'll be quiet.（静かにします）」の前に何を言う？\n「I'm sorry, Ms. Green.」→ あやまっているから正解！\n「I can talk loud.」→ 大きな声で話せるかどうかは関係ないよ。",
        "トム、授業中に話さないで。","ごめんなさい、グリーン先生。静かにします。"),
      mkQ("Mr. Wilson, can we play outside today?","👧","( ) Bring your jackets!","👨",
        ["This year.","Of course.","Outside is nice.","I go outside."],
        1,
        "「Bring your jackets!」→ 上着を持ってきて！外に行くってこと！先生はなんと言った？\n「Of course.」→ 「もちろん！」だから正解！\n「Outside is nice.」→ 外のことを言っているけど、ゆるしを答えていないよ。",
        "ウィルソン先生、今日は外で遊んでもいいですか。","もちろん。上着を持ってきてね！"),
      mkQ("You worked hard on your project, Lucy. ( )","👩","Thank you, Ms. Foster.","👧",
        ["It looks great.","It's a nice project.","I like projects.","You can go home."],
        0,
        "がんばったプロジェクトをほめるとき、先生は次に何と言う？「It looks great.（とてもいいですね）」が自然だから正解！",
        "プロジェクトをがんばったね、ルーシー。とてもいいですね。","ありがとうございます、フォスター先生。"),
      mkQ("Where's my classmate, Ms. Clark?","👦","( ) He'll be back for lunch.","👩",
        ["He's at the nurse's office.","He's very funny.","He likes his friends.","He comes to school every day."],
        0,
        "「He'll be back for lunch.」→ 今はどこにいる？\n「He's at the nurse's office.」→ ばしょを答えているから正解！\n「He likes his friends.」→ すきなことを言っているけど、ばしょじゃないよ。",
        "クラーク先生、ぼくのクラスメートはどこですか。お昼には戻ってくるよ。","保健室にいますよ。"),
    ],
    practice3: [
      mkQ("Grace, your notebook is not in your desk.","👩","( ) I used it yesterday.","👧",
        ["It's in my bag.","I like my notebook.","It's a nice notebook.","The desk is big."],
        0,
        "「I used it yesterday.」→ 使ったあと、ノートはどこに行く？\n「It's in my bag.」→ ばしょを答えているから正解！\n「The desk is big.」→ 「desk（つくえ）」をくり返しているだけだよ。だまされないで！",
        "グレース、ノートが机に入っていないよ。きのう使ったんだ。","かばんの中にあるよ。"),
      mkQ("Lunch is almost ready. What do you want to eat?","👩","( )","👦",
        ["I'm not hungry.","Lunch smells good.","Curry rice, please.","I ate already."],
        2,
        "「What do you want to EAT?」→ たべものを答えよう！\n「Curry rice, please.」→ たべものを答えているから正解！\n「Lunch smells good.」→ 給食のことを言っているけど、たべものじゃないよ。",
        "もうすぐ給食だよ。何を食べたい？","カレーライスをお願いします。"),
      mkQ("I'm nervous about the spelling test, Ms. Parker.","👦","( ) You'll do great.","👩",
        ["Don't worry.","You're welcome.","Good idea.","See you."],
        0,
        "心配していることを伝えたら、先生は元気づけてくれるよ。「Don't worry.（心配しないで）」が自然だから正解！",
        "スペリングテストが心配です、パーカー先生。","心配しないで。きっとうまくいくよ。"),
      mkQ("Please put away your pencils, Ben. It's time for lunch.","👩","( )","👦",
        ["I like this pencil.","The pencil is sharp.","OK, Ms. Cooper. I'm hungry!","It's a good pencil."],
        2,
        "先生がえんぴつをしまってねと言っているよ。もうお昼の時間！なんて答える？\n「OK, Ms. Cooper. I'm hungry!」→ 「わかった！」は自然な答えだから正解！\n「I like this pencil.」と「The pencil is sharp.」→ 両方えんぴつのことを言っているよ。だまされないで！",
        "ベン、えんぴつをしまってね。もうお昼の時間だよ。","わかりました、クーパー先生。おなかすいた！"),
      mkQ("Ms. Brown, can I borrow a pencil? But bring your own tomorrow.","👦","( )","👩",
        ["Pencils are yellow.","Of course.","I like pencils.","It's in the pencil case."],
        1,
        "「But bring your own tomorrow.」→ 条件をつけてOKしているよ。どの答えがOKの意味？\n「Of course.」→ 「もちろん！」だから正解！\n「It's in the pencil case.」→ これは「どこ？」への答えだよ。",
        "ブラウン先生、えんぴつを借りてもいいですか。でもあしたは自分のを持ってきてね。","もちろん。"),
      mkQ("Your report is excellent, Alex. ( )","👩","Thank you, Ms. Cooper!","👦",
        ["You worked very hard.","It's a nice report.","Reports are long.","You can go home."],
        0,
        "レポートをほめられたあと、先生が続けて言いそうなことは？「You worked very hard.（よくがんばったね）」が自然だから正解！",
        "レポートがとてもいいですね、アレックス。よくがんばったね。","ありがとうございます、クーパー先生！"),
      mkQ("Ms. Foster, where's my friend Kate? She'll be back after music class.","👧","( )","👩",
        ["She's at music class.","She likes music class.","She goes to music class every week.","She's a good student."],
        0,
        "「She'll be back after music class.」→ 今はどこにいる？\n「She's at music class.」→ 今いるばしょを答えているから正解！\n「She likes music class.」→ すきなことを言っているけど、今どこにいるかじゃないよ。",
        "フォスター先生、友達のケイトはどこですか。音楽の授業のあとに戻ってくるよ。","音楽の授業に行っているよ。"),
    ],
    quiz: [
      mkQ("Ms. Peterson, where's my library book?","👦","( )","👩",
        ["It's Tuesday.","Reading is fun.","It's in your bag.","I like books."],
        2, null,
        "ピーターソン先生、図書室の本はどこですか。","かばんの中にあるよ。"),
      mkQ("I really like your painting, Amy.","👩","( )","👧",
        ["Thank you.","You're welcome.","I'm sorry.","Excuse me."],
        0, null,
        "あなたの絵、とても好きよ、エイミー。","ありがとうございます。"),
      mkQ("Let's practice singing for the concert. ( )","👩","OK, Ms. Carter.","👦",
        ["It's next week.","It's a nice song.","I like singing.","You can go home."],
        0, null,
        "音楽会のために歌の練習をしましょう。来週なの。","わかりました、カーター先生。"),
      mkQ("Please line up quietly, Sam.","👩","( )","👦",
        ["The line is long.","I like lining up.","All right, Ms. Johnson!","My legs are tired."],
        2, null,
        "サム、静かに並んでね。","わかりました、ジョンソン先生！"),
      mkQ("Ms. Wilson, can I use the computer?","👧","( ) Just for ten minutes, OK?","👩",
        ["Computers are useful.","Of course.","It's in the library.","I like computers."],
        1, null,
        "ウィルソン先生、コンピューターを使ってもいいですか。10分だけね。","もちろん。"),
      mkQ("You finished your project early, Kevin!","👩","( )","👦",
        ["Thank you.","You're welcome.","I'm sorry.","Good idea."],
        0, null,
        "早くプロジェクトを終わらせたね、ケビン！","ありがとうございます。"),
      mkQ("Where's your classmate, Mia? She said she'll be back by two.","👩","( )","👦",
        ["She's very kind.","She likes the nurse's office.","She went to the nurse's office.","She goes there every week."],
        2,
        "むずかしい！\n「She likes the nurse's office.」→ 好きだと言っているけど、今どこにいるかじゃないよ。\n「She went to the nurse's office.」→ 「went（行った）」→ 今保健室にいる！「She'll be back by two.（2時までに戻る）」と合っているね。",
        "ミア、クラスメートはどこ？2時までに戻ると言っていたよ。","保健室に行ったよ。"),
    ],
  },
  with_friends: {
    practice1: [
      mkQ("Do you have any brothers, Ken?","👧","( )","👦",
        ["He is tall.","Yes, I have one brother.","I like my family.","Brothers are nice."],
        1,
        "「Do you have any brothers?」→ 自分の家族について答えよう！\n「Yes, I have one brother.」→ しつもんに直接答えているから正解！\n「He is tall.」→ 兄弟の説明だけど、しつもんには答えていないよ。\n「I like my family.」→ 兄弟がいるかどうかを答えていないよ。",
        "ケン、兄弟はいますか。","はい、兄が一人います。"),
      mkQ("When is your birthday, Amy?","👦","( )","👧",
        ["I like cake.","It's June 10th.","Birthdays are fun.","My mom makes cake."],
        1,
        "「When」はひづけをきく言葉だよ！\n「It's June 10th.」→ ひづけを答えているから正解！\n「I like cake.」→ 「何がすき？」への答えだよ。\n「Birthdays are fun.」→ かんそうで、ひづけじゃないね。",
        "エイミー、たんじょう日はいつですか。","6月10日です。"),
      mkQ("What do you do after school, Sam?","👧","( )","👦",
        ["School is fun.","I play baseball.","After dinner.","My school is big."],
        1,
        "「What do you do?」→ かつどうを答えよう！\n「I play baseball.」→ かつどうを答えているから正解！\n「After dinner.」→ 「いつ？」への答えだよ。\n「School is fun.」→ 学校の感想で、かつどうじゃないね。",
        "サム、放課後は何をしますか。","野球をします。"),
      mkQ("Let's play soccer after school!","👦","( )","👧",
        ["Soccer is popular.","I like school.","Yes, let's!","It's after school."],
        2,
        "「Let's~!」にはさんせいするときのきまり文句で答えよう！\n「Yes, let's!」→ さそいにさんせいする決まった言い方だから正解！\n他の答えはさそいに答えていないよ。",
        "放課後にサッカーをしよう！","うん、しよう！"),
      mkQ("Can you come to my house today, Tom?","👧","( )","👦",
        ["Your house is nice.","I like your house.","Sorry, I have a piano lesson.","Yes, it is."],
        2,
        "トムは行けないよ。ていねいにどうやってことわる？\n「Sorry, I have a piano lesson.」→ 理由をそえてていねいにことわっているから正解！\n「Your house is nice.」→ さそいへの返事ではなく、ほめ言葉だよ。",
        "トム、今日わたしの家に来られる？","ごめん、ピアノのレッスンがあるんだ。"),
      mkQ("Wow, your bag is really nice!","👦","( )","👧",
        ["It's in my bag.","Thanks, Ken!","It's a bag.","I like bags."],
        1,
        "ほめられたときは何と言う？\n「Thanks, Ken!」→ ほめ言葉への自然な返事だから正解！\n「It's in my bag.」→ 「どこ？」への答えだよ。\n「I like bags.」→ ほめ言葉に答えていないよ。",
        "わあ、あなたのバッグすごくすてきだね！","ありがとう、ケン！"),
      mkQ("What color is your new bicycle, Bob?","👧","( )","👦",
        ["It's fast.","It's blue.","I like bicycles.","It's in the garage."],
        1,
        "「What color」→ 色を答えよう！\n「It's blue.」→ 色を答えているから正解！\n「It's fast.」→ はやさの説明で、色じゃないね。\n「It's in the garage.」→ 「どこ？」への答えだよ。",
        "ボブ、新しい自転車は何色ですか。","青色です。"),
    ],
    practice2: [
      mkQ("Do you have any sisters, Mark?","👧","( ) She's in high school.","👦",
        ["No, but I have one brother.","No, but I have one sister.","Yes, I have two brothers.","I like my sister."],
        1,
        "「She's in high school」の「she」は次の文でつながる人物を指すよ。だから答えは女の子について言っているものだよ！\n「No, but I have one sister.」→ 妹（姉）を紹介して、「She's in high school」で説明しているから正解！\n「No, but I have one brother.」→ 男の子を紹介しているので、次の「she」とつながらないよ。",
        "マーク、姉妹はいますか。","いいえ、でも妹が一人います。高校生です。"),
      mkQ("When's your English test, Yuki?","👦","( ) I need to study tonight!","👧",
        ["English is difficult.","It's tomorrow.","I study every day.","My teacher is nice."],
        1,
        "「I need to study tonight!」→ テストはもうすぐみたい。どの答えが合う？\n「It's tomorrow.」→ 「あしたテストがあるから今夜勉強しなきゃ」と自然につながるから正解！\n「English is difficult.」→ いつのことか答えていないよ。",
        "ユキ、英語のテストはいつですか。","あしたです。今夜勉強しなきゃ！"),
      mkQ("What do you usually do on weekends, Chris?","👧","( ) I go every Saturday morning.","👦",
        ["I like weekends.","I play tennis.","Weekends are fun.","I go home."],
        1,
        "「I go every Saturday morning」→ 毎週土曜日の朝に「行く」かつどうって何だろう？\n「I play tennis.」→ テニスを習いに行くと自然につながるから正解！\n「I go home.」→ 週末のしゅみとしてはつながらないよ。",
        "クリス、週末はいつも何をしますか。","テニスをします。毎週土曜日の朝に行きます。"),
      mkQ("Let's take some pictures in the park!","👦","( ) The flowers are so beautiful today!","👧",
        ["I have a camera.","Parks are nice.","That's a good idea.","It's a sunny day."],
        2,
        "「The flowers are so beautiful today!」→ うれしそうにさんせいしているよ。「Let's~」にさんせいする言い方は？\n「That's a good idea!」→ さんせいの気持ちを表していて、花のはなしに自然につながるから正解！\n「I have a camera.」→ さんせいの言葉ではないよ。",
        "公園で写真をとろう！","いいアイデアだね！今日の花はとてもきれいだね！"),
      mkQ("Let's go to the library after school, Riko.","👧","( ) I have to go straight home today.","👦",
        ["That's a good idea.","Yes, let's.","Sorry, I can't.","The library is nice."],
        2,
        "「I have to go straight home today」→ さんせいしている？ことわっている？\n「Sorry, I can't.」→ ことわる言い方で、「まっすぐ家に帰らなきゃ」と自然につながるから正解！\n「That's a good idea.」と「Yes, let's.」→ どちらもさんせいの言葉だから、「まっすぐ帰る」と合わないよ。",
        "リコ、放課後に図書館に行こう。","ごめん、行けないの。今日はまっすぐ家に帰らなきゃ。"),
      mkQ("Your new pencil case is really cute, Hana!","👧","( ) My mom gave it to me.","👦",
        ["Thanks, Sara!","It's my pencil case.","I like pencil cases.","It's in my bag."],
        0,
        "ほめられたら、まず「Thanks,」と言ってから理由を説明するよ。\n「Thanks, Sara!」→ ほめ言葉への自然な返事だから正解！「My mom gave it to me.」と自然につながるね。\n他の答えはほめ言葉に答えていないよ。",
        "ハナ、あなたの新しいペンケースすごくかわいいね！","ありがとう、サラ！お母さんがくれたの。"),
      mkQ("Do you have any pets, Emma?","👦","( ) His name is Koko.","👧",
        ["I like animals.","Yes, I have a cat.","Pets are cute.","I want a dog."],
        1,
        "「His name is Koko」の「his」は男の子（オス）のペットを指しているよ。\n「Yes, I have a cat.」→ ペットを紹介していて、「his」で自然につながるから正解！\n「I want a dog.」→ まだ飼っていないという意味だから、名前の話につながらないよ。",
        "エマ、ペットは飼っていますか。","はい、ねこを飼っています。名前はココです。"),
    ],
    practice3: [
      mkQ("You look like your mom, Ken. Do you have any brothers or sisters?","👧","( ) But I have two cousins who live near me.","👦",
        ["Yes, I have one sister.","No, I'm an only child.","My mom is kind.","I like my family."],
        1,
        "「But I have two cousins」の「but」は前の文と反対の内容をつなぐよ。だから最初の答えは「兄弟姉妹がいない」内容のはずだよ。\n「No, I'm an only child.」→ 「でもいとこが二人いる」と自然につながるから正解！\n「Yes, I have one sister.」→ 「but」の反対の意味にならないよ。",
        "ケン、お母さんに似てるね。兄弟姉妹はいる？","いいや、ひとりっ子だよ。でも近くに住んでいるいとこが二人いるんだ。"),
      mkQ("When is your school festival, Mika?","👦","( ) You should come and watch!","👧",
        ["It's fun every year.","It's next Friday.","My school is big.","I like festivals."],
        1,
        "「You should come and watch!」→ さそっているから、ひづけは近いはずだよ。\n「It's next Friday.」→ 近い日にちを答えていて、さそいと自然につながるから正解！\n「It's fun every year.」→ ひづけを答えていないよ。",
        "ミカ、学園祭はいつですか。","今度の金曜日だよ。ぜひ見に来てね！"),
      mkQ("What do you do on weekends, Yuta? I always see you leaving early in the morning.","👧","( ) I practice with my team every Sunday.","👦",
        ["I wake up early.","I play basketball.","Mornings are cold.","I like my team."],
        1,
        "「I practice with my team every Sunday」→ 毎週日曜日にチームでれんしゅうするスポーツって何だろう？\n「I play basketball.」→ チームスポーツを紹介していて、自然につながるから正解！\n「I wake up early.」→ 見た理由の説明で、かつどうを答えていないよ。",
        "ユウタ、週末は何をしているの？いつも朝早く出かけるのを見かけるよ。","バスケットボールをしているんだ。毎週日曜日にチームでれんしゅうしているよ。"),
      mkQ("Hey Sara, let's study together for the science test on Friday!","👦","( ) How about at the library after school on Thursday?","👧",
        ["Science is difficult.","That's a good idea!","I like the library.","Friday is busy."],
        1,
        "「How about at the library after school on Thursday?」→ 具体的なていあんをしているから、その前にさんせいしているはずだよ。\n「That's a good idea!」→ さんせいの言葉で、具体的なていあんに自然につながるから正解！\n「Science is difficult.」→ さんせいの言葉ではないよ。",
        "サラ、金曜日の理科のテストのためにいっしょに勉強しよう！","いいアイデアだね！木曜日の放課後に図書館でどう？"),
      mkQ("We're all going to the new pizza restaurant after school. Can you come, Hiro?","👧","( ) I have to go to my grandmother's house today.","👦",
        ["Pizza sounds delicious.","I love pizza.","Sorry, I can't.","That's a good idea."],
        2,
        "「I have to go to my grandmother's house today」→ レストランに行く？行かない？\n「Sorry, I can't.」→ ていねいにことわっていて、「おばあちゃんの家に行かなきゃ」と自然につながるから正解！\n「That's a good idea.」→ さんせいの意味になり、次の文と合わないよ。",
        "みんなで放課後に新しいピザ屋さんに行くの。ヒロも来られる？","ごめん、行けないの。今日はおばあちゃんの家に行かなきゃいけないんだ。"),
      mkQ("Wow, you speak English really well, Taro!","👧","( ) I practice every day with my app.","👦",
        ["English is fun.","Thanks, Lisa!","I like English.","My teacher is good."],
        1,
        "ほめられたら、まずお礼を言ってから理由を説明するよ。\n「Thanks, Lisa!」→ ほめ言葉への自然な返事で、「アプリで毎日れんしゅうしているよ」と自然につながるから正解！\n他の答えはほめ言葉に直接答えていないよ。",
        "わあ、タロウは英語がとてもじょうずだね！","ありがとう、リサ！アプリで毎日れんしゅうしているんだ。"),
      mkQ("This water bottle is really nice!","👧","( )","👦",
        ["I drink a lot of water.","Water is important.","Whose is it?","It's in my bag."],
        2,
        "女の子は「Oh! It's so cute.（かわいいね）」と、水とうについて新しく知ったことを話しているよ。どんな質問だとこの返事につながる？\n「Whose is it?（だれのですか）」→ だれのものか聞いていて、そのあとに「かわいいね、新しいの？」と自然につながるから正解！\n他の答えは会話を自然につなげていないよ。",
        "この水とう、すごくすてきだね！","だれのですか。",
        { text:"Oh! It's so cute. Is it new?", trans:"わあ！かわいいね。新しいの？" }),
    ],
    quiz: [
      mkQ("Do you have any cousins, Kevin?","👦","( )","👧",
        ["I like cousins.","Yes, I have three cousins.","Cousins are fun.","She's my cousin."],
        1, null,
        "ケビン、いとこはいますか。","はい、いとこが三人います。"),
      mkQ("When is the sports festival, Emma?","👧","( )","👦",
        ["It's fun.","It's next Tuesday.","Sports are great.","I like festivals."],
        1, null,
        "エマ、体育祭はいつですか。","今度の火曜日です。"),
      mkQ("What do you do on rainy days, Mei?","👦","( )","👧",
        ["Rainy days are boring.","I read comic books.","It's rainy.","I like rain."],
        1, null,
        "メイ、雨の日は何をしますか。","まんがを読みます。"),
      mkQ("Let's make a birthday card for Yui!","👧","( )","👦",
        ["Cards are pretty.","Yes, let's!","I like Yui.","It's her birthday."],
        1, null,
        "ユイのためにたんじょう日カードを作ろう！","うん、作ろう！"),
      mkQ("Can you play video games with me after school, Leo?","👦","( ) I have soccer practice.","👧",
        ["Video games are fun.","Sorry, I can't.","Yes, I can.","I like games."],
        1, null,
        "レオ、放課後いっしょにテレビゲームできる？","ごめん、できないの。サッカーのれんしゅうがあるんだ。"),
      mkQ("Your drawing is amazing, Mia!","👦","( )","👧",
        ["It's a drawing.","Thanks, Kai!","I like drawing.","Drawing is hard."],
        1, null,
        "あなたの絵すごいね、ミア！","ありがとう、カイ！"),
      mkQ("Do you play any instruments, Sota?","👧","( ) I've been taking lessons for three years.","👦",
        ["No, I don't.","Yes, I play the piano.","Instruments are fun.","I like music."],
        1,
        "むずかしい！\n「I've been taking lessons for three years.（3年間レッスンを受けています）」→ 楽器をひいている人の話だよ。\n「No, I don't.」→ 「ひかない」という意味だから、レッスンの話とつながらないよ。\n「Yes, I play the piano.」→ ピアノをひくと言っていて、3年間レッスンを受けていることと自然につながるから正解！\n「Instruments are fun.」と「I like music.」→ どちらも楽器をひいているかどうかを答えていないよ。",
        "ソウタ、何か楽器をひきますか。","はい、ピアノをひきます。3年間レッスンを受けています。"),
    ],
  },
  g4_at_home: {
    practice1: [
      mkQ("Do you want some more rice?","👩","( )","🧒",
        ["You're welcome.","Here you are.","Yes, please.","Nice to meet you."],
        2,
        "「もっと食べる？」とすすめられて、ほしいときは何と言う？\n「Yes, please.」→「はい、お願いします」とほしい気持ちを伝えているから正解！\n「You're welcome.」→ お礼を言われたときの返事だよ。\n「Here you are.」→ ものをわたすときに言う言葉だよ。\n「Nice to meet you.」→ はじめて会ったときのあいさつだよ。",
        "もっとごはん食べる？","はい、お願いします。"),
      mkQ("Could you close the window?","👨","( )","🧒",
        ["I'm sorry.","Sure, no problem.","Yes, I did.","No, thank you."],
        1,
        "「〜してくれる？」とお願いされたときに「いいよ」と言うには？\n「Sure, no problem.」→「もちろん、いいよ」という意味だから正解！\n「I'm sorry.」→ あやまるときの言葉だよ。\n「Yes, I did.」→ 過去にしたことを聞かれたときの答えだよ。",
        "まどをしめてくれる？","うん、いいよ。"),
      mkQ("What did you eat for lunch?","👩","( )","🧒",
        ["I eat a sandwich.","I'm eating a sandwich.","I will eat a sandwich.","I ate a sandwich."],
        3,
        "しつもんが「did」（過去形）だから、答えも過去形にしよう！\n「I ate a sandwich.」→ 過去形「ate」を使っているから正解！\n「I eat / I'm eating / I will eat」→ すべて現在や未来の形だから、過去のしつもんに合わないよ。",
        "お昼ごはんに何を食べたの？","サンドイッチを食べたよ。"),
      mkQ("Mom, where are my socks?","🧒","( )","👩",
        ["They're in your bag.","It's Monday.","Yes, they are.","I like them."],
        0,
        "「Where」はばしょをきく言葉だよ！\n「They're in your bag.」→ ばしょを答えているから正解！\n「It's Monday.」→「いつ？」への答えだよ。\n「Yes, they are.」と「I like them.」→ ばしょを答えていないよ。",
        "お母さん、ぼくの靴下はどこ？","あなたのかばんの中にあるよ。"),
      mkQ("Please clean your room.","👩","( )","🧒",
        ["All right, Mom.","You're welcome.","How much is it?","It was fun."],
        0,
        "「〜してね」とお願いされたときに「わかった」と言うには？\n「All right, Mom.」→「わかった、お母さん」という意味だから正解！\n「You're welcome.」→ お礼を言われたときの返事だよ。",
        "部屋をそうじしてね。","わかった、お母さん。"),
    ],
    practice2: [
      mkQ("Why are you tired?","👩","( )","🧒",
        ["I'm fine, thanks.","At seven o'clock.","Yes, I am.","Because I got up early."],
        3,
        "「Why」には「Because（なぜなら）」で理由を答えよう！\n「Because I got up early.」→ 理由を答えているから正解！\n「At seven o'clock.」→「いつ？」への答えだよ。",
        "どうしてつかれているの？","早起きしたからだよ。"),
      mkQ("Do you want some more soup?","👨","No, thank you. ( )","🧒",
        ["I'm really hungry.","I'm full.","Yes, please.","Give me more."],
        1,
        "「No, thank you.」に合う一言は？\n「I'm full.」→「おなかいっぱい」という意味で、ことわった理由として自然だから正解！\n「I'm really hungry.」「Yes, please.」「Give me more.」→ どれも「ほしい」という意味になってしまい、「No, thank you」と矛盾するよ。",
        "もっとスープいる？","ううん、いらない。おなかいっぱいなんだ。"),
      mkQ("What are you going to do after dinner?","👩","( )","🧒",
        ["I did my homework.","It's on the table.","I'm going to do my homework.","I'm from Japan."],
        2,
        "「これからどうする？」は未来のことだから、「going to」を使おう！\n「I'm going to do my homework.」→ 未来の形だから正解！\n「I did my homework.」→ 過去の形だよ。",
        "夕食のあと何をするの？","宿題をするつもりだよ。"),
      mkQ("Mom, I'm having trouble with my homework.","🧒","( )","👩",
        ["OK, I'll help you.","You're welcome.","It was interesting.","Good luck at school."],
        0,
        "「困っている」と言われたら、どう返事する？\n「OK, I'll help you.」→「手伝うよ」と言っているから正解！\n「You're welcome.」→ お礼を言われたときの言葉だよ。",
        "お母さん、宿題で困ってるんだ。","わかった、手伝うよ。"),
      mkQ("Whose jacket is this on the sofa?","🧒","( )","👨",
        ["It's on the sofa.","Yes, it is nice.","I bought it yesterday.","It's your brother's."],
        3,
        "「だれの？（Whose）」には持ち主を答えよう！\n「It's your brother's.」→ 持ち主を答えているから正解！\n「It's on the sofa.」→ ばしょを答えているだけで、持ち主じゃないよ。",
        "ソファーの上にあるこのジャケットはだれの？","それはお兄ちゃんのだよ。"),
    ],
    practice3: [
      mkQ("Mom, ( )","🧒","It's on the kitchen table.","👩",
        ["can I use your phone?","what time is it?","where is my lunchbox?","did you clean the room?"],
        2,
        "答えが「テーブルの上だよ」だから、ばしょをきくしつもんが入るよ。\n「where is my lunchbox?」→「どこ？」ときいているから正解！\n他のしつもんは「テーブルの上」という答えにつながらないよ。",
        "お母さん、ぼくのお弁当箱はどこ？","台所のテーブルの上にあるよ。"),
      mkQ("I made too much curry tonight.","👨","( )","🧒",
        ["How much was it?","When did you cook?","Where is the curry?","How many plates did you make?"],
        3,
        "答えが「3皿ぶん」だから、数をきくしつもんが入るよ。\n「How many plates did you make?」→ 数をきいているから正解！\n4つとも疑問文でまぎらわしいから注意しよう。",
        "今夜はカレーを作りすぎちゃったよ。","お皿何枚分作ったの？",
        { text:"About three plates!", trans:"3皿分くらいかな！" }),
      mkQ("You didn't eat your breakfast. ( )","👩","Sorry, Mom. I'm just not hungry.","🧒",
        ["Is it delicious?","Are you OK?","Do you want more?","Did you cook it?"],
        1,
        "「ごめんね、おなかがすいてないだけ」と答えているから、心配することばが入るよ。\n「Are you OK?」→「だいじょうぶ？」と心配しているから正解！",
        "朝ごはんを食べなかったね。だいじょうぶ？","ごめんね、お母さん。ただおなかがすいてないだけなの。"),
      mkQ("You came home late today. Why?","👩","( )","🧒",
        ["I'm going to play soccer.","Yes, I came home.","Because I stayed for soccer practice.","At the park."],
        2,
        "過去の理由は「Because」で答えよう！\n「Because I stayed for soccer practice.」→ 過去の理由を答えているから正解！\n「I'm going to play soccer.」→ 未来の形だよ。",
        "今日は帰りが遅かったね。どうして？","サッカーのれんしゅうに残っていたからだよ。"),
      mkQ("Can I have one of your cookies?","👧","( )","🧒",
        ["Yes, please.","Thank you very much.","I'll take one.","Of course. Here you are."],
        3,
        "自分はクッキーをあげる側だよ。\n「Of course. Here you are.」→「もちろん、どうぞ」とあげる言い方だから正解！\n「Yes, please.」と「I'll take one.」→ どちらももらう側の言い方だから、ここでは合わないよ。",
        "クッキー1つもらってもいい？","もちろん。どうぞ。"),
    ],
    quiz: [
      mkQ("Would you like some more bread?","👩","( )","🧒",
        ["Here you are.","You're welcome.","Nice to meet you.","Yes, please."],
        3, null,
        "パンをもっといかが？","はい、お願いします。"),
      mkQ("What did you do this morning?","👨","( )","🧒",
        ["I'm cleaning my room.","I cleaned my room.","I clean my room.","I will clean my room."],
        1, null,
        "今朝何をしたの？","部屋をそうじしたよ。"),
      mkQ("Why didn't you finish your milk?","👩","( )","🧒",
        ["Yes, I finished it.","I'm going to drink it.","Because it was too cold.","At breakfast."],
        2, null,
        "どうして牛乳を飲みきらなかったの？","冷たすぎたからだよ。"),
      mkQ("Dad, ( )","🧒","They're by the front door.","👨",
        ["where are my shoes?","what time is it?","can I go out?","did you go out?"],
        0,
        "むずかしい！答え「げんかんのそばだよ」＝ばしょの話。だから「where are my shoes?（どこ？）」が正解！他の3つは全部しつもん文だから、まぎらわしいので注意しよう。",
        "お父さん、ぼくの靴どこ？","げんかんのそばにあるよ。"),
      mkQ("Can you help me wash the dishes?","👩","( )","🧒",
        ["Yes, I did.","No, thank you.","It's on the table.","Sure, no problem."],
        3, null,
        "お皿洗いを手伝ってくれる？","うん、いいよ。"),
      mkQ("Do you want to watch a movie now?","👨","No, thanks. ( )","🧒",
        ["Let's watch it now.","I have to do my homework.","Yes, that sounds great.","I really want to."],
        1,
        "むずかしい！「No, thanks.」は「いいえ、けっこうです」ということわりの言葉。①③④はぜんぶ「見たい・賛成」の意味になってしまうから、「No」と矛盾するよ。「I have to do my homework.（宿題をしなきゃ）」だけがことわる理由として正解！",
        "今映画を見たい？","ううん、いい。宿題をしなきゃいけないんだ。"),
      mkQ("What are you going to do this weekend?","👩","( )","🧒",
        ["I visited Grandma.","It was fun.","I'm going to visit Grandma.","Because I like her."],
        2, null,
        "今週末は何をするの？","おばあちゃんに会いに行くつもりだよ。"),
    ],
  },
  g4_at_school: {
    practice1: [
      mkQ("I forgot my eraser. Can I borrow yours?","🧒","( )","👦",
        ["No, I'm sorry.","Sure, here you are.","It's on the desk.","Yes, I did."],
        1,
        "「借りてもいい？」に「いいよ、どうぞ」と言うには？\n「Sure, here you are.」→「もちろん、どうぞ」と貸してくれているから正解！\n「No, I'm sorry.」→ ことわる言い方だよ。\n「It's on the desk.」→ ばしょを答えているだけだよ。",
        "消しゴムを忘れちゃった。貸してくれる？","うん、いいよ。どうぞ。"),
      mkQ("What's your favorite subject?","👧","( )","🧒",
        ["It's on Monday.","Yes, I like it.","I have a pen.","I like science."],
        3,
        "「好きな教科は？」ときかれたら、教科を答えよう。\n「I like science.」→ 教科を答えているから正解！\n「It's on Monday.」→「いつ？」への答えだよ。",
        "好きな教科は何？","理科がすきだよ。"),
      mkQ("Did you study for the test?","👨","( )","🧒",
        ["Yes, I studied a lot.","Yes, I study a lot.","I'm studying now.","I will study."],
        0,
        "しつもんが「Did」（過去形）だから、答えも過去形にしよう！\n「Yes, I studied a lot.」→ 過去形「studied」だから正解！\n他の答えは現在や未来の形だよ。",
        "テストの勉強はした？","はい、たくさん勉強しました。"),
      mkQ("Hello, I'm your new English teacher.","👩","( )","🧒",
        ["Goodbye.","You're welcome.","Nice to meet you.","Me too, thanks."],
        2,
        "はじめて会う先生に何て言う？\n「Nice to meet you.」→ はじめて会ったときのあいさつだから正解！",
        "こんにちは、新しい英語の先生です。","はじめまして。"),
      mkQ("Please open your textbook to page ten.","👨","( )","🧒",
        ["How much is it?","OK, Mr. Smith.","It was fun.","You're welcome."],
        1,
        "「〜してね」に「はい」と言うには？\n「OK, Mr. Smith.」→「わかりました」という意味だから正解！",
        "教科書の10ページを開いてください。","わかりました、スミス先生。"),
    ],
    practice2: [
      mkQ("I took the math test yesterday.","👦","( )","🧒",
        ["Good luck!","I'm going to take it.","How was it?","Yes, you did."],
        2,
        "「テスト受けたよ」に「どうだった？」と聞くには？\n「How was it?」→ 様子をたずねているから正解！\n「Good luck!」→ これから受ける人に言う言葉だよ。",
        "きのう数学のテストを受けたよ。","どうだった？"),
      mkQ("Which is harder, math or science?","👧","( )","🧒",
        ["Math is harder.","Yes, it's hard.","I like math.","At school."],
        0,
        "どっちが難しいかを比べて答えよう。\n「Math is harder.」→「〜のほうが難しい」と比べているから正解！",
        "数学と理科、どっちが難しい？","数学のほうが難しいよ。"),
      mkQ("What are you going to do in class today?","👨","( )","🧒",
        ["I did a test.","It was easy.","Yes, I am.","We're going to read a story."],
        3,
        "「今日は何をする？」は未来のことだから「going to」で答えよう。\n「We're going to read a story.」→ 未来の形だから正解！",
        "今日の授業では何をしますか。","物語を読む予定です。"),
      mkQ("Why were you late this morning?","👩","( )","🧒",
        ["Yes, I was late.","Because I missed the bus.","At eight o'clock.","I'm going by bus."],
        1,
        "「Why」には「Because」で理由を答えよう。\n「Because I missed the bus.」→ 理由を答えているから正解！",
        "今朝はどうして遅刻したの？","バスに乗り遅れたからです。"),
      mkQ("I don't understand this homework.","👦","( )","🧒",
        ["It was interesting.","Good luck.","You're welcome.","I'll help you."],
        3,
        "「宿題がわからない」と言われたら、どう返事する？\n「I'll help you.」→「手伝うよ」と言っているから正解！",
        "この宿題わからないんだ。","手伝うよ。"),
    ],
    practice3: [
      mkQ("( )","🧒","It starts at nine o'clock.","👨",
        ["Where is the class?","Who is the teacher?","Is it difficult?","What time does the class start?"],
        3,
        "答え「9時に始まるよ」が手がかり。どんな質問だった？\n「What time does the class start?」→ 時間をきいているから正解！",
        "何時から授業が始まりますか。","9時に始まりますよ。"),
      mkQ("I read a great book for my report.","👧","( )","🧒",
        ["How many books?","What was it about?","When did you read?","Where is it?"],
        1,
        "答え「宇宙のこと」が手がかり。4つとも疑問文でまぎらわしいから注意！\n「What was it about?」→ 内容をきいているから正解！",
        "レポートのためにすごい本を読んだよ。","何についての本だったの？",
        { text:"It was about space.", trans:"宇宙のことだったよ。" }),
      mkQ("I studied all night and I'm so sleepy.","👦","( )","🧒",
        ["Good luck!","Congratulations!","You should get some rest.","Nice to meet you."],
        2,
        "ねむそうな友だちに、思いやりの一言をかけよう。\n「You should get some rest.」→「休んだほうがいいよ」という意味だから正解！",
        "一晩中勉強して、すごくねむいよ。","少し休んだほうがいいよ。"),
      mkQ("You didn't come to school yesterday. Why?","👩","( )","🧒",
        ["Because I was sick.","I'm going to be sick.","Yes, I came.","At the nurse's office."],
        0,
        "なぜ来なかったかを「Because」で過去の理由として答えよう。\n「Because I was sick.」→ 過去の理由だから正解！",
        "きのう学校に来なかったね。どうして？","具合が悪かったからです。"),
      mkQ("Can I use your dictionary?","👦","( )","🧒",
        ["Yes, please.","Thank you.","Sure, here you are.","Can I use it?"],
        2,
        "友だちが「使ってもいい？」ときいていて、自分は貸す側だよ。\n「Sure, here you are.」→「もちろん、どうぞ」と貸す言い方だから正解！\n「Yes, please.」と「Can I use it?」→ どちらも借りる側の言い方だから、ここでは合わないよ。",
        "辞書を使ってもいい？","もちろん、どうぞ。"),
    ],
    quiz: [
      mkQ("I forgot my pencil. Can I borrow one?","👦","( )","🧒",
        ["Of course. Here you are.","Yes, please.","No, I did.","It's a nice pencil."],
        0, null,
        "えんぴつを忘れちゃった。貸してくれる？","もちろん。どうぞ。"),
      mkQ("What did you learn today?","👩","( )","🧒",
        ["I'm learning English.","I will learn math.","I learned about Japan.","I learn every day."],
        2, null,
        "今日は何を習いましたか。","日本について習いました。"),
      mkQ("I gave a speech in class today.","👦","( )","🧒",
        ["Good luck!","How was it?","Yes, you did.","I'm going to give one."],
        1, null,
        "今日、授業でスピーチをしたよ。","どうだった？"),
      mkQ("Which subject is more fun, art or music?","👧","( )","🧒",
        ["Yes, it's fun.","I like school.","At two o'clock.","Art is more fun."],
        3, null,
        "美術と音楽、どっちが楽しい？","美術のほうが楽しいよ。"),
      mkQ("Ms. Green, ( )","🧒","It's in the library.","👩",
        ["what time is it?","where is the science club?","did you go there?","can I go home?"],
        1,
        "むずかしい！答え「図書室にあるよ」＝ばしょの話。だから「where is the science club?（どこ？）」が正解！他の3つは全部しつもん文だから、まぎらわしいので注意しよう。",
        "グリーン先生、科学クラブはどこですか。","図書室にありますよ。"),
      mkQ("Why do you like history?","👨","( )","🧒",
        ["Yes, I like it.","I'm going to study.","At school.","Because it's interesting."],
        3, null,
        "どうして歴史がすきなの？","おもしろいからです。"),
      mkQ("Do you want to join the soccer club?","👧","No, thanks. ( )","🧒",
        ["I want to join the art club.","Yes, that's great.","Let's join together.","I really want to."],
        0,
        "むずかしい！「No, thanks.」は「いいえ、けっこうです」ということわりの言葉。②③④はぜんぶ「賛成・入りたい」の意味になってしまうから、「No」と矛盾するよ。「I want to join the art club.（美術部に入りたいんだ）」だけがことわる理由として自然だから正解！",
        "サッカー部に入りたい？","ううん、いい。美術部に入りたいんだ。"),
    ],
  },
  g4_with_friends: {
    practice1: [
      mkQ("Let's play soccer after school.","👦","( )","🧒",
        ["You're welcome.","It was fun.","Yes, let's!","No, thank you very much."],
        2,
        "「Let's~!」にさんせいするときのきまり文句で答えよう！\n「Yes, let's!」→ さそいにさんせいする決まった言い方だから正解！\n「It was fun.」→ 過去の感想だよ。\n「No, thank you very much.」→ ことわる言い方だよ。",
        "放課後にサッカーしよう。","うん、しよう！"),
      mkQ("Would you like to come to my house?","👧","( )","🧒",
        ["Yes, I'd love to.","Here you are.","You're welcome.","I did."],
        0,
        "「Would you like to~?」にうれしく答えるには「Yes, I'd love to.（ぜひ行きたいです）」が正解！\n「Here you are.」→ ものをわたすときの言葉だよ。",
        "うちに来ない？","うん、ぜひ行きたい！"),
      mkQ("I went to the zoo yesterday.","👦","( )","🧒",
        ["Good luck.","Me too, thanks.","I'm going to go.","How was it?"],
        3,
        "「動物園に行ったよ」に「どうだった？」ときくには「How was it?」が正解！\n「I'm going to go.」→ 未来の形だよ。",
        "きのう動物園に行ったよ。","どうだった？"),
      mkQ("Your new bike is cool!","👧","( )","🧒",
        ["Nice to meet you.","Thanks!","How much is it?","Yes, I did."],
        1,
        "ほめられたら「Thanks!（ありがとう！）」と答えよう。\n「Nice to meet you.」→ はじめて会ったときのあいさつだよ。",
        "新しい自転車かっこいいね！","ありがとう！"),
      mkQ("Let's watch a movie this weekend.","👦","( )","🧒",
        ["You're welcome.","No, I'm sorry.","It was great.","That's a good idea!"],
        3,
        "さそいに「いいね！」と言うには「That's a good idea!」が正解！\n「It was great.」→ 過去の感想だよ。",
        "今週末、映画を見よう。","いいね！"),
    ],
    practice2: [
      mkQ("It's raining. Why don't we play games inside?","👧","( )","🧒",
        ["At my house.","Good idea.","Yes, I do.","It was fun."],
        1,
        "「Why don't we~?」にさんせいするには「Good idea.（いいね）」が正解！\n「At my house.」→ 「どこ？」への答えだよ。",
        "雨が降ってるね。中で遊ぼうよ。","いいね。"),
      mkQ("What are you going to do this weekend?","👦","( )","🧒",
        ["I played tennis.","Yes, I am.","It was fun.","I'm going to visit my cousin."],
        3,
        "「週末どうする？」は未来のことだから「going to」で答えよう。\n「I'm going to visit my cousin.」→ 未来の形だから正解！",
        "週末は何をする予定？","いとこに会いに行く予定だよ。"),
      mkQ("I like summer the best. How about you?","👧","( )","🧒",
        ["I like winter.","Yes, I do.","It's hot.","Me too summer."],
        0,
        "「How about you?（あなたは？）」ときかれたら、自分のことを答えよう。\n「I like winter.」→ 自分のすきな季節を答えているから正解！",
        "わたしは夏がいちばんすき。あなたは？","ぼくは冬がすきだよ。"),
      mkQ("You look tired today.","👦","I'm OK. ( )","🧒",
        ["Are you tired?","Nice to meet you.","I stayed up late last night.","I'm going to sleep now."],
        2,
        "「つかれてるね」に理由を返すには「I stayed up late last night.（きのう夜ふかししたんだ）」が正解！",
        "今日つかれてるみたいだね。","だいじょうぶだよ。きのう夜ふかししたんだ。"),
      mkQ("Why didn't you come to the park yesterday?","👧","( )","🧒",
        ["Yes, I came.","Because I was busy.","At the park.","I'm going to come."],
        1,
        "過去の理由は「Because」で答えよう。\n「Because I was busy.」→ 過去の理由だから正解！",
        "どうしてきのう公園に来なかったの？","いそがしかったからだよ。"),
    ],
    practice3: [
      mkQ("Let's ride our bikes to the river.","👦","( ) Let's go by bus.","🧒",
        ["I like bikes.","The river is nice.","Bikes are fast.","It's too far."],
        3,
        "「Let's go by bus.」の前だから、自転車をやめる理由が入るよ。\n「It's too far.」→「遠すぎるから」が理由として自然だから正解！\n「I like bikes.」「The river is nice.」「Bikes are fast.」→ どれも理由になっていないよ。",
        "川まで自転車で行こう。","遠すぎるよ。バスで行こう。",
        { text:"OK.", trans:"わかった。" }),
      mkQ("( )","🧒","About twenty people came!","👧",
        ["Where was the party?","When was the party?","How many people came to your party?","Was the party fun?"],
        2,
        "答え「20人ぐらい来たよ」が手がかり。数をきく質問が入るよ。\n「How many people came to your party?」→ 人数をきいているから正解！他の3つは全部しつもん文だから、まぎらわしいので注意しよう。",
        "パーティーには何人来たの？","20人ぐらい来たよ！"),
      mkQ("I lost my favorite pen.","👦","( )","🧒",
        ["Congratulations!","That's too bad.","You're welcome.","Nice to meet you."],
        1,
        "ペンをなくした友だちにかける言葉は「That's too bad.（それはざんねんだね）」が正解！\n「Congratulations!」→ おめでとうと言うときの言葉だよ。",
        "お気に入りのペンをなくしちゃった。","それはざんねんだね。"),
      mkQ("Can you come to my birthday party on Sunday?","👧","( )","🧒",
        ["Yes, I came.","Happy birthday to me.","It was great.","Sure, I'd love to."],
        3,
        "「日曜のパーティー来れる？」にうれしく答えるには「Sure, I'd love to.（もちろん、ぜひ行きたい）」が正解！",
        "日曜日のたんじょう日パーティーに来られる？","もちろん、ぜひ行きたい！"),
      mkQ("Which do you like better, baseball or basketball?","👦","( )","🧒",
        ["I like baseball better.","Yes, I like it.","Let's play now.","At the park."],
        0,
        "「どっちが好き？」ときかれたら、比べて答えよう。\n「I like baseball better.」→「〜のほうが好き」と比べているから正解！",
        "野球とバスケ、どっちが好き？","野球のほうが好きだよ。"),
    ],
    quiz: [
      mkQ("Let's go swimming tomorrow.","👦","( )","🧒",
        ["You're welcome.","It was fun.","Sure, sounds great!","No, thank you very much."],
        2, null,
        "あした泳ぎに行こう。","うん、いいね！"),
      mkQ("I watched a movie last night.","👧","( )","🧒",
        ["How was it?","Good luck.","I'm going to watch it.","Yes, you did."],
        0, null,
        "きのうの夜、映画を見たよ。","どうだった？"),
      mkQ("What are you going to do after school?","👦","( )","🧒",
        ["I did my homework.","It was fun.","Yes, I am.","I'm going to play video games."],
        3, null,
        "放課後は何をする予定？","テレビゲームをする予定だよ。"),
      mkQ("My favorite sport is tennis. How about you?","👧","( )","🧒",
        ["Yes, I do.","I like soccer.","It's fun.","Me too tennis."],
        1, null,
        "わたしのすきなスポーツはテニスだよ。あなたは？","ぼくはサッカーがすきだよ。"),
      mkQ("( )","🧒","It was really exciting!","👦",
        ["Where is the game?","Can I play?","How was the game?","Do you like games?"],
        2,
        "むずかしい！答え「すごく興奮したよ」が手がかり。感想をきく質問が入るよ。「How was the game?（試合どうだった？）」が正解！他の3つは全部しつもん文だから、まぎらわしいので注意しよう。",
        "試合どうだった？","すごく興奮したよ！"),
      mkQ("I can't come to the party. I'm sick.","👧","( )","🧒",
        ["That's too bad.","Congratulations!","You're welcome.","Nice to meet you."],
        0, null,
        "パーティーに行けないの。具合が悪いんだ。","それはざんねんだね。"),
      mkQ("Do you want to come to the beach with us?","👦","No, thanks. ( )","🧒",
        ["Yes, let's go!","That sounds fun.","I'd love to.","I have to help my mom."],
        3,
        "むずかしい！「No, thanks.」は「いいえ、けっこうです」ということわりの言葉。①②③はぜんぶ「行きたい・賛成」の意味になってしまうから、「No」と矛盾するよ。「I have to help my mom.（お母さんを手伝わなきゃ）」だけがことわる理由として自然だから正解！",
        "いっしょにビーチに行かない？","ううん、いい。お母さんを手伝わなきゃいけないんだ。"),
    ],
  },
  g3_travel: {
    practice1: [
      mkQ("Why don't we go to the beach this Sunday?","👦","( ) I really want to swim.","👧",
        ["Sounds great!","Here you are.","No, I'm not.","It's too late."],
        0,
        "さそいに「いいね！」と答える言い方は？\n「Sounds great!」→ さんせいの言い方だから正解！\n「Here you are.」→ ものをわたすときの言葉だよ。\n「No, I'm not.」→ be動詞のしつもんへの答えだよ。\n「It's too late.」→「おそすぎる」は「泳ぎたい」と合わないよ。",
        "日曜日にビーチに行かない？","いいね！本当に泳ぎたいな。"),
      mkQ("I'm going to Kyoto next week.","👦","( ) It's my first visit.","👦",
        ["Yes, I have.","No, I haven't.","You're welcome.","See you later."],
        1,
        "次の文「はじめての訪問」がヒント。行ったこと「ない」？「ある」？\n「No, I haven't.」→「はじめて」に合うから正解！\n「Yes, I have.」→「行ったことある」は「はじめて」とむじゅんするよ。\n「You're welcome.」「See you later.」→ あいさつで会話に合わないよ。",
        "来週、京都に行くんだ。","ううん、ないよ。はじめての訪問なんだ。",
        null, "Nice! Have you been there before?", "👧", "いいね！前に行ったことある？"),
      mkQ("Let's go to the zoo tomorrow.","👦","( ) I love animals.","👧",
        ["You're welcome.","No, thank you.","That sounds fun!","It's mine."],
        2,
        "さそいに「楽しそう！」と答える言い方は？\n「That sounds fun!」→ さんせいの言い方だから正解！\n「You're welcome.」→ お礼への返事だよ。\n「No, thank you.」→ ことわる言い方だけど、次で「動物大好き」と続くのは不自然だよ。\n「It's mine.」→ 話に関係ないよ。",
        "明日、動物園に行こうよ。","楽しそう！動物大好き。"),
      mkQ("Have you ever been to Tokyo Tower?","👦","( ) I went there last summer.","👧",
        ["No, never.","I'm busy now.","It's far.","Yes, I have."],
        3,
        "次の文「去年の夏に行った」がヒント。\n「Yes, I have.」→「去年行った」に合うから正解！\n「No, never.」→「一度もない」は「去年行った」とむじゅんするよ。\n「I'm busy now.」「It's far.」→ 話に合わないよ。",
        "東京タワーに行ったことある？","うん、あるよ。去年の夏に行ったんだ。"),
      mkQ("Shall we take a trip this weekend?","👦","( ) Where should we go?","👧",
        ["Good idea!","You're right, it's mine.","No, I didn't.","Here you are."],
        0,
        "さそいにさんせいして、次に「どこ行く？」と続く言い方は？\n「Good idea!」→ さんせいの言い方だから正解！\n「You're right, it's mine.」→ 持ち主の話だよ。\n「No, I didn't.」→ 過去のしつもんへの答えだよ。\n「Here you are.」→ ものをわたすときの言葉だよ。",
        "今週末、旅行しない？","いいね！どこに行こうか？"),
    ],
    practice2: [
      mkQ("Where should we go this summer?","👦","How about Hokkaido? ( )","👧",
        ["I lost my ticket.","It's too hot there.","The seafood is delicious.","I can't swim."],
        2,
        "次のAの「シーフード大好き」につながる文は？\n「The seafood is delicious.」→「シーフード大好き」に自然につながるから正解！\n「I lost my ticket.」→ 話に関係ないよ。\n「It's too hot there.」「I can't swim.」→ マイナスの内容だけどAは喜んでいるよ。",
        "今年の夏はどこに行こう？","北海道はどう？シーフードがおいしいよ。",
        { text:"Good idea! I love seafood.", trans:"いいね！魚介類大好き。" }),
      mkQ("Have you ever eaten Thai food?","👦","( ) I ate it in Bangkok last year.","👧",
        ["No, never.","I'm not hungry.","It's over there.","Yes, I have."],
        3,
        "次の文「去年バンコクで食べた」→食べたこと「ある」？\n「Yes, I have.」→「去年食べた」に合うから正解！\n「No, never.」→「一度もない」は「去年食べた」とむじゅんするよ。\n「I'm not hungry.」「It's over there.」→ 話に関係ないよ。",
        "タイ料理を食べたことある？","うん、あるよ。去年バンコクで食べたんだ。"),
      mkQ("Why don't we visit the museum on Saturday?","👦","( ) I hear the new art show is great.","👧",
        ["That sounds great!","No, you can't.","I'm sorry to hear that.","It's not mine."],
        0,
        "さそいに「いいね！」→次で「新しい展示がいいらしい」と続くよ。\n「That sounds great!」→ さんせいの言い方だから正解！\n「No, you can't.」→ きょかの話だよ。\n「I'm sorry to hear that.」→ 悪い知らせへの返事だよ。\n「It's not mine.」→ 持ち主の話だよ。",
        "土曜に美術館に行かない？","いいね！新しいアート展がすごいらしいよ。"),
      mkQ("This is a picture from Paris.","👦","( ) I visited Paris two years ago.","👦",
        ["No, I haven't.","Yes, I have.","I don't like pictures.","It will be sunny."],
        1,
        "次の文「2年前にパリを訪れた」がヒント。\n「Yes, I have.」→「2年前に訪れた」に合うから正解！\n「No, I haven't.」→「行ったことない」は「2年前に訪れた」とむじゅんするよ。\n「I don't like pictures.」→ 写真の連想わなだよ。\n「It will be sunny.」→ 天気の連想わなだよ。",
        "これはパリの写真だよ。","うん、あるよ。2年前にパリを訪れたんだ。",
        null, "Wow! Have you ever been to France?", "👧", "わあ！フランスに行ったことあるの？"),
      mkQ("Let's plan our holiday. How about camping?","👦","( )","👧",
        ["I don't have time.","Camping is boring.","Sounds perfect!","Where's my bag?"],
        2,
        "次でAが「テント持ってくね」→ Bはさんせいしているよ。\n「Sounds perfect!」→ さんせいの言い方だから正解！\n「I don't have time.」「Camping is boring.」→ ことわる／マイナスの返事だけど会話は前に進んでいるよ。\n「Where's my bag?」→ 話に関係ないよ。",
        "休みの計画をたてよう。キャンプはどう？","完璧だね！",
        { text:"Great, I'll bring the tent.", trans:"いいね、テント持ってくよ。" }),
    ],
    practice3: [
      mkQ("I'm so excited about our trip to London!","👦","Me too. I'm looking forward to ( ) the museums.","👧",
        ["visit","visiting","visited","visits"],
        1,
        "「look forward to」の to のあとは、動詞のどんな形？\n「visiting」→ to のあとは ~ing の形だから正解！\n「visit」「visited」「visits」→ 形がちがうよ。✕ to visit → ◯ to visiting",
        "ロンドン旅行、すごく楽しみ！","私も。美術館を見るのを楽しみにしてるんだ。"),
      mkQ("( )","👦","Sure! But let's take the train. It's too far to drive.","👧",
        ["Why don't we visit the old castle?","Where did you buy your ticket?","How much was the hotel?","When did you come back?"],
        0,
        "Bの「電車で行こう」「運転するには遠すぎ」→ Aは「どこかへ行こう」とさそっているよ。\n「Why don't we visit the old castle?」→ さそいの文だから正解！\n他の3つは過去やお金のしつもんで、Bの「いいよ（Sure!）」という返事に合わないよ。",
        "古いお城を見に行かない？","いいよ！でも電車で行こう。運転するには遠すぎ。",
        { text:"OK, the train is fine.", trans:"うん、電車でいいよ。" }),
      mkQ("This is a photo of Mt. Fuji.","👦","( ) I climbed it two years ago.","👦",
        ["No, I haven't.","I don't have a camera.","Yes, I have.","It will rain tomorrow."],
        2,
        "次の文「2年前に登った」がヒント。\n「Yes, I have.」→「2年前に登った」に合うから正解！\n「No, I haven't.」→「登ったことない」は「2年前に登った」とむじゅんするよ。\n「I don't have a camera.」→ 写真の連想わなだよ。\n「It will rain tomorrow.」→ 天気の連想わなだよ。",
        "これは富士山の写真だよ。","うん、あるよ。2年前に登ったんだ。",
        null, "Wow! Have you ever climbed it?", "👧", "わあ！登ったことあるの？"),
      mkQ("Are you ready for the trip to Canada?","👦","Almost! I'm really looking forward to ( ) skiing there.","👧",
        ["go","goes","to go","going"],
        3,
        "「look forward to」の後ろは ~ing。go はどう変わる？\n「going」→ 正しい ~ing の形だから正解！\n「go」「goes」→ 原形／三単現だよ。\n「to go」→「to + to」になっておかしいよ（すでに to のあとだから）。",
        "カナダ旅行の準備できた？","もう少し！スキーに行くのを本当に楽しみにしてるんだ。"),
      mkQ("Have you ever ridden a night bus?","👦","( ) I always take the train instead.","👧",
        ["Yes, many times.","No, I never have.","Yes, last night.","I have a car."],
        1,
        "次の文「いつも電車を使う」→夜行バスに乗ったこと「ある」？「ない」？\n「No, I never have.」→「いつも電車」に合うから正解！\n「Yes, many times.」「Yes, last night.」→「乗ったことある」は「いつも電車」と合わないよ。\n「I have a car.」→ 話に関係ないよ。",
        "夜行バスに乗ったことある？","ううん、一度もないよ。いつも電車を使うんだ。"),
    ],
    quiz: [
      mkQ("Why don't we go hiking on Saturday?","👦","( )","👧",
        ["You're welcome.","That's a good idea!","No, it isn't.","I'm sorry to hear that."],
        1, null,
        "土曜にハイキングに行かない？","いいね！"),
      mkQ("I'm visiting Australia this winter.","👦","( ) I went there in 2022.","👦",
        ["No, never.","I have no time.","It's very far.","Yes, I have."],
        3, null,
        "この冬オーストラリアに行くんだ。","うん、あるよ。2022年に行ったんだ。",
        null, "Great! Have you been there before?", "👧", "いいね！前に行ったことある？"),
      mkQ("Let's plan our trip. Where should we stay?","👦","How about the beach hotel? ( )","👧",
        ["It's near the sea.","It's too expensive.","I forgot my bag.","I can't swim well."],
        0, null,
        "旅行の計画をしよう。どこに泊まる？","ビーチホテルはどう？海の近くだよ。",
        { text:"Perfect! I want to see the ocean.", trans:"完璧！海が見たいな。" }),
      mkQ("Are you excited about the school trip?","👦","Yes! I'm looking forward to ( ) new friends.","👧",
        ["make","made","making","makes"],
        2, null,
        "修学旅行、楽しみ？","うん！新しい友達を作るのが楽しみ。"),
      mkQ("Have you ever visited Okinawa?","👦","( ) I want to go someday.","👧",
        ["Yes, many times.","No, I haven't.","Yes, last summer.","I live there now."],
        1, null,
        "沖縄に行ったことある？","ううん、ないよ。いつか行きたいな。"),
      mkQ("( )","👨","Sounds fun! I was thinking the same thing.","👩",
        ["How much is the tent?","Did you enjoy camping?","Where is the campsite?","Shall we go camping this weekend?"],
        3,
        "むずかしい！男の人の空所のあとに続く「Sounds fun! I was thinking the same thing.」がヒント。キャンプに関係ある選択肢でも、「さそい」の文じゃないと「same thing」とつながらないよ。\n「Shall we go camping this weekend?」→ さそいの文だから正解！\n他の3つはキャンプに関係あるけど、さそいの文じゃないよ。",
        "今週末キャンプに行かない？","楽しそう！同じこと考えてた。"),
      mkQ("Nice bag! Is it new?","👦","Yes. ( )","👧",
        ["I bought it in Italy last month.","I will buy it in Italy.","I don't like Italy.","Italy is a country."],
        0,
        "むずかしい！答え「先月イタリアで買った」が次の文「私はイタリアに行ったことないよ」につながるよ。\n「I bought it in Italy last month.」→ 過去形で「もう持っている」に合うから正解！\n「I will buy it in Italy.」→ 未来形だから「もう持ってる」と合わないよ。\n「I don't like Italy.」「Italy is a country.」→ 話に関係ないよ。",
        "いいバッグ！新しいの？","うん。先月イタリアで買ったんだ。",
        { text:"Really? I've never been to Italy.", trans:"ほんと？私はイタリアに行ったことないよ。" }),
    ],
  },
  g3_directions: {
    practice1: [
      mkQ("Excuse me. ( )","👦","Sure. Go straight and turn left. It's next to the bank.","👩",
        ["How can I get to the station?","What time is it now?","Do you like this town?","How much is it?"],
        0,
        "「Go straight and turn left. It's next to the bank.」は道案内だよ。前のしつもんは？\n「How can I get to the station?」→ 道をたずねているから正解！\n他の3つは道案内の返事と合わないよ。",
        "すみません、駅へはどう行けば？","まっすぐ行って左へ。銀行のとなりです。"),
      mkQ("Let's walk to the mall.","👦","No, it's ( ) far to walk. Let's take the bus.","👧",
        ["enough","too","very much","more than"],
        1,
        "「too ～ to …」で「～すぎて…できない」という意味になるよ。\n「too」→ 遠すぎて歩けない、が正解！\n「enough」→「十分」で意味が逆になっちゃうよ。\n「very much」「more than」→ 文法がちがうよ。",
        "モールまで歩こう。","ダメ、歩くには遠すぎ。バスにしよう。"),
      mkQ("Which bus goes to the airport?","👦","( )","👩",
        ["It's raining now.","I like buses.","The number 5 bus does.","See you later."],
        2,
        "「どのバスが空港へ行く？」というしつもんに答えよう。\n「The number 5 bus does.」→ バスの番号を答えているから正解！\n他の3つはしつもんに答えていないよ。",
        "どのバスが空港へ行く？","5番のバスだよ。"),
      mkQ("Why are you taking a taxi?","👦","I'm late, ( ) I need to hurry.","👧",
        ["but","or","because","so"],
        3,
        "「だから」の意味になる言葉は？\n「so」→「おくれてる、だから急がなきゃ」と自然につながるから正解！\n「but」「or」「because」→「だから」の意味にならないよ。",
        "なんでタクシー？","おくれてる、だから急がなきゃ。"),
      mkQ("The train leaves in five minutes. ( )","👦","OK, let's go!","👧",
        ["We should hurry.","I'm not ready.","It's my pleasure.","You're welcome."],
        0,
        "「OK, let's go!（うん、行こう！）」につながる言葉は？\n「We should hurry.」→「急ごう」と自然につながるから正解！\n「I'm not ready.」→「行こう」と矛盾するよ。\n「It's my pleasure.」「You're welcome.」→ 決まり文句で合わないよ。",
        "電車あと5分だよ。急ごう。","うん、行こう！"),
    ],
    practice2: [
      mkQ("Excuse me, how can I get to the museum?","👦","( ) It's across from the park.","👩",
        ["I don't have a map.","Walk for five minutes and turn right.","I've never been there.","The museum is closed."],
        1,
        "道をたずねられたら、道案内で答えよう。\n「Walk for five minutes and turn right.」→ 道案内になっているから正解！\n他の3つは道案内になっていないよ。",
        "美術館へはどう行けば？","5分歩いて右へ。公園の向かいです。",
        { text:"Thank you very much!", trans:"ありがとう！" }),
      mkQ("Should we ride our bikes to the concert?","👦","( ) It's too far. Let's take the train instead.","👧",
        ["Yes, let's ride.","Good idea!","No, I don't think so.","I love bikes."],
        2,
        "次の文「遠すぎ、電車にしよう」から、自転車には反対しているよ。\n「No, I don't think so.」→ 反対の返事だから正解！\n「Yes, let's ride.」「Good idea!」「I love bikes.」→ どれも自転車にさんせいしているけど、Bは「遠すぎ」と言っているよ。",
        "コンサートまで自転車で行く？","やめとこう。遠すぎ。電車にしよう。"),
      mkQ("Is the library far?","👦","No, it's close ( ) to walk. Only five minutes.","👧",
        ["too","very","more","enough"],
        3,
        "「～ enough to …」で「…するのに十分～」という意味になるよ。\n「enough」→ 歩けるくらい近い、が正解！\n「too」→「遠すぎ」で意味が逆になっちゃうよ。\n「very」「more」→ 文法がちがうよ。",
        "図書館は遠い？","ううん、歩けるくらい近いよ。たった5分。"),
      mkQ("We missed the bus!","👦","Don't worry. Another one comes soon, ( )","👩",
        ["so let's wait here.","but I hate buses.","or take a taxi now.","so I lost my ticket."],
        0,
        "「すぐ次が来る」の流れに合う言葉は？\n「so let's wait here.」→「だからここで待とう」と自然につながるから正解！\n他の3つは流れに合わないよ。",
        "バス乗り遅れた！","大丈夫、すぐ次が来るからここで待とう。",
        { text:"OK, I'll wait with you.", trans:"うん、一緒に待つ。" }),
      mkQ("Excuse me. Is this the right way to the station?","👦","( ) Go back and turn left at the corner.","👩",
        ["Yes, keep going straight.","The station is beautiful.","No, you're going the wrong way.","I don't take trains."],
        2,
        "次の文「もどって角を左へ」から、道はまちがっているとわかるよ。\n「No, you're going the wrong way.」→「いいえ」で始まり、まちがいを伝えているから正解！\n「Yes, keep going straight.」→「はい」なのに「もどって」と矛盾するよ。",
        "駅へはこの道で合ってる？","いいえ、道をまちがえてます。もどって角を左へ。"),
    ],
    practice3: [
      mkQ("Why can't we walk to the stadium?","👦","It's ( ) to walk. It takes two hours by car!","👧",
        ["close enough","too far","near enough","not far"],
        1,
        "車で2時間かかる＝遠いよ。\n「too far」→「遠すぎて歩けない」だから正解！\n「close enough」「near enough」「not far」→ どれも「近い」意味になってしまうよ。",
        "なんでスタジアムまで歩けないの？","歩くには遠すぎ。車で2時間だよ！"),
      mkQ("Why did you go to the station so early?","👦","I went there early ( ) a good seat on the train.","👧",
        ["get","getting","to get","got"],
        2,
        "「～するために」は「to + 動詞」の形だよ。\n「to get」→ 正しい形だから正解！\n「get」「getting」「got」→ 形がちがうよ。",
        "なんでそんな早く駅に？","電車でいい席をとるために早く行ったんだ。"),
      mkQ("Excuse me. I want to go to the city hall, but I'm lost.","👦","( )","👩",
        ["I love this city.","The city hall is old.","You should walk there.","It's too far to walk, so take the subway."],
        3,
        "「地下鉄に乗ります」につながる返事は？\n「It's too far to walk, so take the subway.」→ 地下鉄をすすめているから正解！\n「You should walk there.」→「歩いて」は次の「地下鉄に乗る」と矛盾するよ。",
        "市役所に行きたいけど迷った。","歩くには遠すぎるから地下鉄に乗って。",
        { text:"Great, I'll take the subway then.", trans:"じゃあ地下鉄にします。" }),
      mkQ("Our flight leaves at 9, and it's already 7:30.","👦","( ) The airport is far from here.","👧",
        ["We have a lot of time.","We should leave now.","I don't want to go.","The plane is big."],
        1,
        "「もう7時半」なのに合う返事は？\n「We should leave now.」→「もう出発しなきゃ」と自然につながるから正解！\n「We have a lot of time.」→「もう7時半」と矛盾するよ。",
        "飛行機9時発でもう7時半。","もう出発しなきゃ。空港は遠いよ。",
        { text:"You're right. Let's call a taxi now.", trans:"だね、タクシー呼ぼう。" }),
      mkQ("You look tired. Did you walk here?","👦","Yes. The buses weren't running, ( )","👧",
        ["so I had to walk.","so I took the bus.","but I drove my car.","so I stayed home."],
        0,
        "「バスが動いてない」に合う結果は？\n「so I had to walk.」→「だから歩くしかなかった」と自然につながるから正解！\n「so I took the bus.」→「バスに乗った」は「バスが動いてない」と矛盾するよ。",
        "疲れてるね。歩いて来たの？","うん。バスが動いてなくて、歩くしかなかった。"),
    ],
    quiz: [
      mkQ("Excuse me. ( )","👦","Yes, go straight for two blocks. It's on your right.","👩",
        ["Is there a post office near here?","What time do you open?","Do you have a pen?","How was your trip?"],
        0, null,
        "近くに郵便局ありますか？","はい、2ブロックまっすぐ。右側です。"),
      mkQ("Let's walk to the beach.","👦","It's ( ) hot to walk today. Let's drive.","👧",
        ["enough","too","so much","very well"],
        1, null,
        "ビーチまで歩こう。","今日は歩くには暑すぎ。車にしよう。"),
      mkQ("Why are you going to the station now?","👦","I'm going there ( ) my grandmother. She arrives at three.","👧",
        ["meet","met","to meet","meeting"],
        2, null,
        "なんで今駅に？","祖母をむかえるため。3時に着くんだ。"),
      mkQ("The show starts in ten minutes!","👦","( )","👧",
        ["We have time to relax.","I want some popcorn.","Let's go home.","We should hurry, or we'll be late."],
        3, null,
        "ショーあと10分！","急がないと遅れるよ。",
        { text:"OK, run!", trans:"うん、走ろう！" }),
      mkQ("Can your little brother reach the button?","👦","Yes, he's tall ( ) to reach it now.","👧",
        ["too","very","enough","more"],
        2,
        "むずかしい！「tall enough to ～」で「～するのに十分せが高い」という意味になるよ。\n「enough」→ 正しい形だから正解！\n「too」→「too ～ to」は「～すぎてできない」の意味になり、逆の意味になっちゃうよ。",
        "弟くんボタンに届く？","うん、今はもう届くくらい背が高いよ。"),
      mkQ("Excuse me, which way is the hospital?","👦","( )","👩",
        ["It's next to the library.","It's about ten minutes away.","Go straight and turn left.","Turn right at the traffic light."],
        3,
        "むずかしい！①②③も道案内っぽいけど、Aが最後に「turn right at the light」とくり返しているから、Bの答えは④「Turn right at the traffic light.」でないと合わないよ。",
        "病院はどっち？","信号を右に。",
        { text:"Thanks. I'll turn right at the light.", trans:"信号で右ね、ありがとう。" }),
      mkQ("Why didn't you come to school by bike yesterday?","👦","My bike was broken, ( )","👧",
        ["so I walked instead.","so I rode it to school.","but I like cycling.","so I will fix it tomorrow."],
        0, null,
        "昨日なんで自転車で来なかった？","壊れてたから、かわりに歩いた。"),
    ],
  },
  g3_family: {
    practice1: [
      mkQ("It's cold in here. ( ) the window, please?","👩","Sure, Mom.","🧒",
        ["Will you close","Are you close","Do you closed","Will you closing"],
        0,
        "「Will you ～?」のあとは動詞の原形だよ。\n「Will you close」→ 原形だから正解！\n「Are you close」「Do you closed」「Will you closing」→ 形がちがうよ。",
        "ここ寒いね。窓を閉めてくれる？","うん、ママ。"),
      mkQ("( ) some tea?","👩","Yes, please. Thank you.","🧒",
        ["Did you drink","Would you like","Are you liking","Have you had"],
        1,
        "「Would you like ～?」で「～はいかが？」とすすめる言い方だよ。\n「Would you like」→ さそいの言い方だから正解！\n他の3つは「いかが？」のさそいにならないよ。",
        "お茶はいかが？","はい、お願いします。"),
      mkQ("You look sad. ( )","👩","I lost my favorite pen.","🧒",
        ["Here you are.","You're welcome.","What's the matter?","Nice to meet you."],
        2,
        "「悲しそうだね」に合う心配の言葉は？\n「What's the matter?」→「どうしたの？」と心配しているから正解！\n他の3つは決まり文句で「悲しそう」に合わないよ。",
        "悲しそうだね。どうしたの？","お気に入りのペンをなくしたんだ。"),
      mkQ("Dinner is ready! Come to the table.","👩","OK, ( )","🧒",
        ["I'm going tomorrow.","I'm too busy.","I'll call you.","I'll be there in a minute."],
        3,
        "「夕食できたよ！」の呼びかけに合う返事は？\n「I'll be there in a minute.」→「すぐ行くね」と自然に答えているから正解！\n他の3つは呼びかけに合わないよ。",
        "夕食できたよ！","うん、すぐ行くね。"),
      mkQ("This box is heavy. Can you give me a ( )?","🧒","Sure, I'll help you.","👩",
        ["hand","leg","face","foot"],
        0,
        "「give me a hand」で「手伝って」という意味になるよ。\n「hand」→ 正しい言い方だから正解！\n「leg」「face」「foot」→ どれも意味にならないよ。",
        "この箱重い。手を貸してくれる？","いいよ、手伝う。"),
    ],
    practice2: [
      mkQ("Ken, the music is too loud. ( )","👩","Sorry, Mom. I'll make it quieter.","🧒",
        ["Will you turn it up?","Will you turn it down?","Will you buy it?","Will you sing it?"],
        1,
        "次の文「静かにするよ」に合う言い方は？\n「Will you turn it down?」→「小さくして」だから正解！\n「Will you turn it up?」→「大きく」で意味が逆になっちゃうよ。",
        "ケン、音楽が大きすぎ。小さくして。","ごめん、静かにするよ。"),
      mkQ("I can't finish all this homework tonight.","🧒","( ) I'm good at math.","👧",
        ["Shall I help you?","Did you finish it?","I hate homework.","Is it your book?"],
        0,
        "次のAの「ありがとう、やさしいね」につながる申し出は？\n「Shall I help you?」→「手伝おうか？」だから正解！\n他の3つは「ありがとう」につながらないよ。",
        "今夜これ全部終わらない。","手伝おうか？数学得意だよ。",
        { text:"Thank you! That's very kind.", trans:"ありがとう！やさしいね。" }),
      mkQ("( ) You look tired.","👩","I couldn't sleep well last night.","🧒",
        ["Congratulations!","Long time no see.","Here you are.","What's the matter?"],
        3,
        "「疲れてるね」に合う心配の言葉は？\n「What's the matter?」→「どうしたの？」だから正解！\n他の3つは「疲れてる」に合わないよ。",
        "どうしたの？疲れてるね。","昨夜よく眠れなかったんだ。"),
      mkQ("Can you play now?","👦","Not yet. I haven't finished ( ) the dishes.","🧒",
        ["wash","washed","washing","to wash"],
        2,
        "「finish」のあとは ~ing の形だよ。\n「washing」→ 正しい形だから正解！\n「wash」「washed」「to wash」→ 形がちがうよ。",
        "今遊べる？","まだ。皿洗いが終わってない。",
        { text:"OK, I'll wait.", trans:"わかった、待つよ。" }),
      mkQ("I'm going to the store. ( ) anything?","👩","Yes, could you buy some milk?","🧒",
        ["Are you needing","Do you need","Have you needed","Do you needed"],
        1,
        "「Do you ～?」の形が正しいよ。\n「Do you need」→ 正しい形だから正解！\n他の3つは文法がちがうよ。",
        "お店に行くよ。何か要る？","うん、牛乳買ってきてくれる？"),
    ],
    practice3: [
      mkQ("You look happy!","👩","Yes! I just finished ( ) my new book. It was great.","🧒",
        ["read","reading","to read","reads"],
        1,
        "「finish」のあとは ~ing の形だよ。\n「reading」→ 正しい形だから正解！\n「read」「to read」「reads」→ 形がちがうよ。",
        "うれしそう！","うん！新しい本を読み終わったところ。すごくよかった。"),
      mkQ("( )","🧒","Of course. How much water do you need?","👩",
        ["Could you get me some water?","Do you like water?","Where is the water?","Have you drunk water?"],
        0,
        "Bの「どれくらい要る？」に合うたのみ方は？\n「Could you get me some water?」→ ていねいなたのみ方だから正解！\n他の3つは「どれくらい要る？」につながらないよ。",
        "お水を持ってきてくれる？","もちろん。どれくらい？",
        { text:"Just one glass, please.", trans:"コップ1杯で。" }),
      mkQ("Hi, Mom.","🧒","Oh, Martin. ( )","👩",
        ["You got a good score.","Have a nice day.","You're home early.","It's not for you."],
        2,
        "次の文「クラブがなくて早く出た」が理由。何を言われた？\n「You're home early.」→「早いのね」と自然につながるから正解！\n他の3つは無関係だよ。",
        "ただいま。","あら、早いのね。",
        { text:"We didn't have club today, so I left school early.", trans:"今日はクラブがなかったから、早く学校を出たんだ。" }),
      mkQ("We have cake and ice cream. ( )","👩","I'd like some cake, please.","🧒",
        ["Do you made this?","Where did you buy it?","Have you eaten it?","Which would you like?"],
        3,
        "Bは「ケーキがいい」と選んでいるよ。どんなしつもんだった？\n「Which would you like?」→「どっちがいい？」だから正解！\n「Do you made this?」は文法がちがうよ。",
        "ケーキとアイスがあるよ。どっちがいい？","ケーキをお願い。"),
      mkQ("It's really hot in this room.","🧒","( )","👩",
        ["Will you close all the windows?","Will you turn on the fan?","Do you want a blanket?","Shall I make some hot tea?"],
        1,
        "「暑い」と言っているから、すずしくする申し出をさがそう。\n「Will you turn on the fan?」→「扇風機つけようか？」だから正解！\n「Do you want a blanket?」「Shall I make some hot tea?」→ 毛布や熱いお茶は「寒い時」用で逆だよ。",
        "この部屋すごく暑い。","扇風機つけようか？",
        { text:"Thanks, that feels much better.", trans:"ありがとう、だいぶ涼しくなった。" }),
    ],
    quiz: [
      mkQ("My hands are full. ( ) the door for me?","🧒","Sure, no problem.","👩",
        ["Will you open","Are you open","Did you opened","Have you open"],
        0, null,
        "手がふさがってる。ドア開けてくれる？","いいよ。"),
      mkQ("( ) You're not eating your lunch.","👩","I'm just not hungry today.","🧒",
        ["What's your name?","How much is it?","What's the matter?","When did you eat?"],
        2, null,
        "どうしたの？お昼食べてないね。","今日はおなかすいてないんだ。"),
      mkQ("You look cold. ( )","👩","Yes, please. A warm blanket would be nice.","🧒",
        ["Did you buy a blanket?","Is this your blanket?","Where's the blanket?","Would you like a blanket?"],
        3, null,
        "寒そうだね。毛布はいかが？","はい、あたたかい毛布がいいな。"),
      mkQ("Are you ready to go out?","👩","Almost. I just finished ( ) my hair.","🧒",
        ["dry","dried","to dry","drying"],
        3, null,
        "出かける準備できた？","もう少し。今、髪をかわかし終わったところ。"),
      mkQ("Emma, your friend is here!","👩","( )","🧒",
        ["I'll be down in a minute.","I went there yesterday.","She isn't my friend.","I'm not home."],
        0, null,
        "エマ、お友達が来たよ！","すぐ降りるね。"),
      mkQ("The baby is sleeping. ( )","👩","Oops, sorry. I'll be quiet.","🧒",
        ["Will you turn it up?","Will you speak louder?","Will you be quiet, please?","Will you wake her up?"],
        2,
        "むずかしい！赤ちゃんが寝ているから、静かにしてほしいという内容が入るよ。\n「Will you be quiet, please?」→「静かにして」だから、Bの「静かにする」に合うから正解！\n「Will you turn it up?」「Will you speak louder?」「Will you wake her up?」→ どれも「静かにする」と逆の意味になってしまうよ。",
        "赤ちゃんが寝てるの。静かにしてくれる？","あ、ごめん。静かにする。"),
      mkQ("You came home early today.","👩","( )","🧒",
        ["I won the game!","I didn't feel well, so I left work.","I have a lot of work.","I'll stay late tonight."],
        1, null,
        "今日は早いね。","気分が悪くて早退したんだ。",
        { text:"Oh no, I hope you feel better soon.", trans:"あら、早くよくなってね。" }),
    ],
  },
};

/* ══════════════════════════════════════════════
   GRAMMAR MODULE
══════════════════════════════════════════════ */
const GRAMMAR_TOPICS = [
  { id:"pronouns", title:"Pronouns / だいめいし", emoji:"🔤", color:"#7c3aed", shadow:"#4c1d95", level:"5" },
];

const BLANK = "(             )"; // non-breaking spaces so the wide blank doesn't collapse in HTML
const PRONOUN_PARTS = [
  {
    id:"part1", short:"1", title:"だれが", subtitle:"Subject Pronouns", emoji:"🟦",
    cards: [
      { en:"I",    kana:"わたし" },
      { en:"You",  kana:"あなた" },
      { en:"He",   kana:"かれ" },
      { en:"She",  kana:"かのじょ" },
      { en:"It",   kana:"それ" },
      { en:"We",   kana:"わたしたち" },
      { en:"They", kana:"かれら・かのじょら" },
    ],
    matchPairs: [
      { en:"He",   jp:"かれ" },
      { en:"I",    jp:"わたし" },
      { en:"They", jp:"かれら" },
      { en:"She",  jp:"かのじょ" },
      { en:"We",   jp:"わたしたち" },
    ],
    lessonRows: [
      { jp:[{t:"わたしは",c:"blue"},{t:"サッカーが"},{t:"好きです。"}], en:[{t:"I",c:"blue"},{t:"like soccer."}] },
      { jp:[{t:"あなたは",c:"blue"},{t:"えいごが"},{t:"じょうずです。"}], en:[{t:"You",c:"blue"},{t:"are good at English."}] },
      { jp:[{t:"かれは",c:"blue"},{t:"わたしの"},{t:"先生です。"}], en:[{t:"He",c:"blue"},{t:"is my teacher."}] },
      { jp:[{t:"かのじょは",c:"blue"},{t:"毎日"},{t:"走ります。"}], en:[{t:"She",c:"blue"},{t:"runs every day."}] },
      { jp:[{t:"それは",c:"blue"},{t:"わたしの"},{t:"ねこです。"}], en:[{t:"It",c:"blue"},{t:"is my cat."}] },
      { jp:[{t:"わたしたちは",c:"blue"},{t:"ともだちです。"}], en:[{t:"We",c:"blue"},{t:"are friends."}] },
      { jp:[{t:"かれらは",c:"blue"},{t:"がっこうに"},{t:"います。"}], en:[{t:"They",c:"blue"},{t:"are at school."}] },
    ],
    lessonNote: "英語では「だれが」がいちばん最初にくるよ！",
    questions: [
      { before:"", blank:BLANK, after:"is my friend. He plays tennis.", context:"talking about a boy",
        opts:["He","She","It","They"], correct:0 },
      { before:"", blank:BLANK, after:"are in my class. We study together.", context:"talking about a group",
        opts:["They","She","It","He"], correct:0 },
      { before:"", blank:BLANK, after:"is a cute dog. It lives next door.", context:"talking about an animal",
        opts:["It","He","She","They"], correct:0 },
    ],
  },
  {
    id:"part2", short:"2", title:"だれを・だれに", subtitle:"Object Pronouns", emoji:"🟦",
    cards: [
      { en:"me",   kana:"わたしを・わたしに" },
      { en:"you",  kana:"あなたを・あなたに" },
      { en:"him",  kana:"かれを・かれに" },
      { en:"her",  kana:"かのじょを・かのじょに" },
      { en:"it",   kana:"それを・それに" },
      { en:"us",   kana:"わたしたちを・わたしたちに" },
      { en:"them", kana:"かれらを・かれらに" },
    ],
    matchPairs: [
      { en:"me",   jp:"わたしを" },
      { en:"him",  jp:"かれを" },
      { en:"them", jp:"かれらを" },
      { en:"her",  jp:"かのじょを" },
      { en:"us",   jp:"わたしたちを" },
    ],
    lessonRows: [
      { jp:[{t:"わたしを",c:"blue"},{t:"てつだってください。"}],        en:[{t:"Please"},{t:"help",c:"green"},{t:"me.",c:"blue"}] },
      { jp:[{t:"かれに",c:"blue"},{t:"ほんを"},{t:"わたした。"}],            en:[{t:"I"},{t:"gave",c:"green"},{t:"him",c:"blue"},{t:"a book."}] },
      { jp:[{t:"わたしたちに",c:"blue"},{t:"プレゼントを"},{t:"くれた。"}],  en:[{t:"She"},{t:"gave",c:"green"},{t:"us",c:"blue"},{t:"a present."}] },
      { jp:[{t:"あなたを",c:"blue"},{t:"さがしていたよ。"}],                en:[{t:"I was looking for"},{t:"you.",c:"blue"}] },
      { jp:[{t:"それを",c:"blue"},{t:"見て！"}],                           en:[{t:"Look at"},{t:"it!",c:"blue"}] },
      { jp:[{t:"かれらを",c:"blue"},{t:"パーティーに"},{t:"よんだ。"}],     en:[{t:"I invited"},{t:"them",c:"blue"},{t:"to the party."}] },
    ],
    lessonNote: "「だれを・だれに」は動詞のあとにくるよ！",
    questions: [
      { before:"Please help", blank:BLANK, after:". I can't carry this box!", context:"わたしを",
        opts:["me","him","her","them"], correct:0 },
      { before:"I gave", blank:BLANK, after:"a birthday card. She was very happy!", context:"かのじょに",
        opts:["her","him","them","us"], correct:0 },
      { before:"Can you call", blank:BLANK, after:"tonight? We want to talk to you!", context:"わたしたちに",
        opts:["us","them","him","her"], correct:0 },
    ],
  },
  {
    id:"part3", short:"3", title:"〜の", subtitle:"Possessive Adjectives", emoji:"🟦",
    cards: [
      { en:"my",    kana:"わたしの" },
      { en:"your",  kana:"あなたの" },
      { en:"his",   kana:"かれの" },
      { en:"her",   kana:"かのじょの" },
      { en:"its",   kana:"それの" },
      { en:"our",   kana:"わたしたちの" },
      { en:"their", kana:"かれらの" },
    ],
    matchPairs: [
      { en:"my",    jp:"わたしの" },
      { en:"his",   jp:"かれの" },
      { en:"our",   jp:"わたしたちの" },
      { en:"her",   jp:"かのじょの" },
      { en:"their", jp:"かれらの" },
    ],
    lessonRows: [
      { jp:[{t:"わたしの",c:"blue"},{t:"かばん",c:"orange"}],       en:[{t:"My",c:"blue"},{t:"bag",c:"orange"}] },
      { jp:[{t:"あなたの",c:"blue"},{t:"ぼうし",c:"orange"}],       en:[{t:"Your",c:"blue"},{t:"hat",c:"orange"}] },
      { jp:[{t:"かれの",c:"blue"},{t:"じてんしゃ",c:"orange"}],     en:[{t:"His",c:"blue"},{t:"bicycle",c:"orange"}] },
      { jp:[{t:"かのじょの",c:"blue"},{t:"ほん",c:"orange"}],       en:[{t:"Her",c:"blue"},{t:"book",c:"orange"}] },
      { jp:[{t:"それの",c:"blue"},{t:"しっぽ",c:"orange"}],         en:[{t:"Its",c:"blue"},{t:"tail",c:"orange"}] },
      { jp:[{t:"わたしたちの",c:"blue"},{t:"きょうしつ",c:"orange"}],en:[{t:"Our",c:"blue"},{t:"classroom",c:"orange"}] },
      { jp:[{t:"かれらの",c:"blue"},{t:"いえ",c:"orange"}],         en:[{t:"Their",c:"blue"},{t:"house",c:"orange"}] },
    ],
    lessonNote: "「〜の」のあとにはかならず名詞がくるよ！",
    lessonExtra: { good:"My bag ✓", bad:"My ✗　← 名詞がないとダメ！" },
    questions: [
      { before:"This is", blank:BLANK, after:"dog. His name is Koko.", context:"talking about MY dog",
        opts:["my","his","her","our"], correct:0 },
      { before:"Let's clean", blank:BLANK, after:"classroom.", context:"talking about OUR classroom",
        opts:["our","my","their","its"], correct:0 },
      { before:"I like", blank:BLANK, after:"English class. She is a great teacher!", context:"talking about HER class",
        opts:["her","his","their","our"], correct:0 },
    ],
  },
  {
    id:"part4", short:"4", title:"〜のもの", subtitle:"Possessive Pronouns", emoji:"🟦",
    cards: [
      { en:"mine",   kana:"わたしのもの" },
      { en:"yours",  kana:"あなたのもの" },
      { en:"his",    kana:"かれのもの" },
      { en:"hers",   kana:"かのじょのもの" },
      { en:"ours",   kana:"わたしたちのもの" },
      { en:"theirs", kana:"かれらのもの" },
    ],
    matchPairs: [
      { en:"mine",   jp:"わたしのもの" },
      { en:"yours",  jp:"あなたのもの" },
      { en:"hers",   jp:"かのじょのもの" },
      { en:"ours",   jp:"わたしたちのもの" },
      { en:"theirs", jp:"かれらのもの" },
    ],
    lessonRows: [
      { jp:[{t:"これは"},{t:"わたしのもの",c:"blue"},{t:"です。"}],     en:[{t:"This bag is"},{t:"mine.",c:"blue"}] },
      { jp:[{t:"それは"},{t:"あなたのもの",c:"blue"},{t:"です。"}],     en:[{t:"That is"},{t:"yours.",c:"blue"}] },
      { jp:[{t:"あのかさは"},{t:"かのじょのもの",c:"blue"},{t:"です。"}],en:[{t:"That umbrella is"},{t:"hers.",c:"blue"}] },
      { jp:[{t:"このほんは"},{t:"かれらのもの",c:"blue"},{t:"です。"}],  en:[{t:"This book is"},{t:"theirs.",c:"blue"}] },
      { jp:[{t:"あのつくえは"},{t:"わたしたちのもの",c:"blue"},{t:"です。"}],en:[{t:"That desk is"},{t:"ours.",c:"blue"}] },
    ],
    lessonNote: "「〜のもの」のあとには名詞がこないよ！",
    lessonExtra: { good:"This is mine. ✓", bad:"This is mine bag. ✗" },
    compareRows: [
      { jp:"「my」のあとに「bag」がある！",   en:[{t:"My",c:"blue"},{t:"bag",c:"orange"},{t:"is blue."}] },
      { jp:"「mine」のあとに名詞がない！",     en:[{t:"This bag is"},{t:"mine.",c:"blue"}] },
    ],
    questions: [
      { before:"A: Whose pencil is this?\nB: It's", blank:BLANK, after:".", context:"わたしのもの",
        opts:["mine","yours","his","hers"], correct:0 },
      { before:"A: Is this Ken's umbrella?\nB: No, it's", blank:BLANK, after:".", context:"かのじょのもの（女の子の話）",
        opts:["hers","his","mine","ours"], correct:0 },
      { before:"A: Whose classroom is this?\nB: It's", blank:BLANK, after:".", context:"わたしたちのもの",
        opts:["ours","yours","theirs","mine"], correct:0 },
    ],
  },
];

const PRONOUN_OVERVIEW_ROWS = [
  { person:"わたし",   subj:"I",    obj:"me",   poss:"my",    possP:"mine" },
  { person:"あなた",   subj:"you",  obj:"you",  poss:"your",  possP:"yours" },
  { person:"かれ",     subj:"he",   obj:"him",  poss:"his",   possP:"his" },
  { person:"かのじょ", subj:"she",  obj:"her",  poss:"her",   possP:"hers" },
  { person:"それ",     subj:"it",   obj:"it",   poss:"its",   possP:"—" },
  { person:"わたしたち",subj:"we",  obj:"us",   poss:"our",   possP:"ours" },
  { person:"かれら",   subj:"they", obj:"them", poss:"their", possP:"theirs" },
];

// Hover-reference examples for the Final Test — keyed by lowercase pronoun word
const PRONOUN_EXAMPLES = {
  i:"I like soccer.", you:"You are good at English.", he:"He is my teacher.", she:"She runs every day.",
  it:"It is my cat.", we:"We are friends.", they:"They are at school.",
  me:"Please help me.", him:"I gave him a book.", her:"I gave her a present.",
  us:"Can you call us tonight?", them:"I invited them to the party.",
  my:"This is my bag.", your:"Is this your book?", his:"This is his bicycle.",
  its:"The dog wagged its tail.", our:"Let's clean our classroom.", their:"This is their house.",
  mine:"This bag is mine.", yours:"That is yours.", hers:"That umbrella is hers.",
  ours:"That desk is ours.", theirs:"This book is theirs.",
};

const PRONOUN_FINAL_TEST = [
  { before:"", blank:BLANK, after:"is my brother. He is 10 years old.", opts:["He","She","It","They"], correct:0 },
  { before:"Mom made a cake and gave", blank:BLANK, after:"to me.", opts:["it","him","her","them"], correct:0 },
  { before:"Is this", blank:BLANK, after:"book?", opts:["your","you","yours","his"], correct:0 },
  { before:"This umbrella is not mine. It's", blank:BLANK, after:".", opts:["his","him","he","its"], correct:0 },
  { before:"", blank:BLANK, after:"are my classmates. They are very kind.", opts:["They","She","It","We"], correct:0 },
  { before:"I can't find", blank:BLANK, after:"keys.", opts:["my","mine","me","I"], correct:0 },
  { before:"Please wait for", blank:BLANK, after:". We will be there soon.", opts:["us","we","our","ours"], correct:0 },
  { before:"Whose bag is this? It's", blank:BLANK, after:".", opts:["yours","your","you","yes"], correct:0 },
  { before:"Look at Yui!", blank:`${BLANK} is walking ${BLANK} dog.`, after:"", opts:["She / her","He / his","They / their","We / our"], correct:0 },
  { before:"Emma and Tom are here.", blank:`${BLANK} are ${BLANK} friends.`, after:"", opts:["They / our","He / his","She / her","It / its"], correct:0, tricky:true },
];

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
      { en:"blanket",   kanji:"毛布",         kana:"もうふ",               trans:"寒いので%%毛布%%を持ってきてください。",             hint:"Please bring a _____. It is cold.",             tiles:["Please","bring","a","blanket",".","It","is","cold","."],       answer:"Please bring a blanket . It is cold ." },
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
    id: "g3_culture", title: "Culture & Society / 文化・社会", emoji: "🎎",
    color: "#7fb069", shadow: "#4d7c0f",
    words: [
      { en:"traditional", kanji:"伝統的な",   kana:"でんとうてきな", trans:"日本には多くの%%伝統的な%%祭りがあります。",            hint:"Japan has many _____ festivals.",                tiles:["Japan","has","many","traditional","festivals","."],            answer:"Japan has many traditional festivals ." },
      { en:"festival",    kanji:"祭り",       kana:"まつり",         trans:"私たちは毎年夏に%%祭り%%を楽しみます。",               hint:"We enjoy a _____ every summer.",                 tiles:["We","enjoy","a","festival","every","summer","."],              answer:"We enjoy a festival every summer ." },
      { en:"celebrate",   kanji:"祝う",       kana:"いわう",         trans:"私たちは彼の誕生日を%%祝いました%%。",                  hint:"We _____ his birthday.",                         tiles:["We","celebrated","his","birthday","."],                        answer:"We celebrated his birthday ." },
      { en:"culture",     kanji:"文化",       kana:"ぶんか",         trans:"私はアメリカの%%文化%%に興味があります。",              hint:"I am interested in American _____.",             tiles:["I","am","interested","in","American","culture","."],           answer:"I am interested in American culture ." },
      { en:"government",  kanji:"政府",       kana:"せいふ",         trans:"%%政府%%は新しい法律を作りました。",                    hint:"The _____ made a new law.",                      tiles:["The","government","made","a","new","law","."],                 answer:"The government made a new law ." },
      { en:"professional",kanji:"プロの",     kana:"プロの",         trans:"彼女は%%プロの%%テニス選手です。",                      hint:"She is a _____ tennis player.",                  tiles:["She","is","a","professional","tennis","player","."],           answer:"She is a professional tennis player ." },
      { en:"study abroad",kanji:"留学する",   kana:"りゅうがくする", trans:"彼女はカナダに%%留学する%%つもりです。",               hint:"She plans to _____ in Canada.",                  tiles:["She","plans","to","study","abroad","in","Canada","."],         answer:"She plans to study abroad in Canada ." },
    ],
  },
  {
    id: "g3_topic_words", title: "Nature & Community / 自然・地域社会", emoji: "🌱",
    color: "#0891b2", shadow: "#155e75",
    words: [
      { en:"nature",      kanji:"自然",       kana:"しぜん",         trans:"私は%%自然%%の中を歩くのが好きです。",                  hint:"I like walking in _____.",                       tiles:["I","like","walking","in","nature","."],                        answer:"I like walking in nature ." },
      { en:"protect",     kanji:"守る",       kana:"まもる",         trans:"自然を%%守る%%ことが大切です。",                        hint:"It is important to _____ nature.",               tiles:["It","is","important","to","protect","nature","."],             answer:"It is important to protect nature ." },
      { en:"hiking",      kanji:"ハイキング", kana:"ハイキング",     trans:"先週末、家族で%%ハイキング%%に行きました。",            hint:"We went _____ with my family last weekend.",     tiles:["We","went","hiking","with","my","family","last","weekend","."],answer:"We went hiking with my family last weekend ." },
      { en:"volunteer",   kanji:"ボランティア",kana:"ボランティア",   trans:"私は毎月%%ボランティア%%活動をしています。",            hint:"I do _____ work every month.",                   tiles:["I","do","volunteer","work","every","month","."],               answer:"I do volunteer work every month ." },
      { en:"method",      kanji:"方法",       kana:"ほうほう",       trans:"この%%方法%%で問題を解いてみてください。",              hint:"Please try this _____ to solve the problem.",   tiles:["Please","try","this","method","to","solve","the","problem","."],answer:"Please try this method to solve the problem ." },
      { en:"introduce",   kanji:"紹介する",   kana:"しょうかいする", trans:"新しい友達を%%紹介します%%。",                          hint:"Let me _____ my new friend.",                    tiles:["Let","me","introduce","my","new","friend","."],                answer:"Let me introduce my new friend ." },
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
      { en:"Would you like...?", kanji:"〜はいかがですか",     kana:"〜はいかがですか",     hint:"_____ some tea? Yes, please. ___________",               tiles:["Would","you","like","some","tea","?"],                      answer:"Would you like some tea ?" },
      { en:"..., didn't you?",   kanji:"〜ですよね？（付加疑問）",kana:"〜ですよね",         hint:"You went to the party, _____  ___________",              tiles:["You","went","to","the","party","didn't","you","?"],         answer:"You went to the party didn't you ?" },
      { en:"something to drink", kanji:"飲み物",               kana:"のみもの",             hint:"Do you have _____ ? Yes, here is some juice. ___________",tiles:["Do","you","have","something","to","drink","?"],           answer:"Do you have something to drink ?" },
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
      { en:"airport",     kanji:"空港",            kana:"くうこう",         trans:"ゆうたは飛行機が大好きで、飛行機を見るためによく%%空港%%に行きます。",                           hint:"Yuta loves flying. He often goes to the _____ to watch planes.",  tiles:["Yuta","loves","flying",".","He","often","goes","to","the","airport","to","watch","planes","."],  answer:"Yuta loves flying . He often goes to the airport to watch planes ." },
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
      { en:"tired",        kanji:"疲れた",        kana:"つかれた",       trans:"ジャックは今日%%疲れた%%ので、家に帰って休んだほうがいい。",                                   hint:"Jack is _____ today. He should go home and rest.",               tiles:["Jack","is","tired","today",".","He","should","go","home","and","rest","."],                    answer:"Jack is tired today . He should go home and rest ." },
      { en:"wonderful",    kanji:"すばらしい",    kana:"すばらしい",     trans:"図書館で新しい仕事が決まりました。それは%%すばらしい%%！",                                      hint:"I got a new job at the library. That's _____!",                  tiles:["I","got","a","new","job","at","the","library",".","That's","wonderful","!"],                   answer:"I got a new job at the library . That's wonderful !" },
      { en:"useful",       kanji:"役に立つ",      kana:"やくにたつ",     trans:"このウェブサイトはスポーツ情報を探すのにとても%%役に立つ%%。",                                 hint:"This website is very _____ for finding sports information.",      tiles:["This","website","is","very","useful","for","finding","sports","information","."],              answer:"This website is very useful for finding sports information ." },
      { en:"heavy",        kanji:"重い",          kana:"おもい",         trans:"タケルのカバンにはたくさんの本が入っていて、とても%%重い%%。",                                hint:"Takeru's bag has many books. It is very _____.",                 tiles:["Takeru's","bag","has","many","books",".","It","is","very","heavy","."],                        answer:"Takeru's bag has many books . It is very heavy ." },
      { en:"difficult",    kanji:"難しい",        kana:"むずかしい",     trans:"最初、ケンは英語が話せませんでした。とても%%難しかった%%です。",                                    hint:"At first, Ken couldn't speak English. It was very _____.",       tiles:["At","first","Ken","couldn't","speak","English",".","It","was","very","difficult","."],         answer:"At first Ken couldn't speak English . It was very difficult ." },
      { en:"professional", kanji:"プロの",        kana:"プロの",         trans:"けんたろうは将来%%プロ%%の野球選手になりたい。",                                             hint:"Kentaro wants to be a _____ baseball player in the future.",      tiles:["Kentaro","wants","to","be","a","professional","baseball","player","in","the","future","."],    answer:"Kentaro wants to be a professional baseball player in the future ." },
      { en:"delicious",    kanji:"おいしい",      kana:"おいしい",       trans:"私たちはスペインに行ってシーフードを食べました。%%おいしかった%%！",                             hint:"We went to Spain and ate seafood. It was _____!",                tiles:["We","went","to","Spain","and","ate","seafood",".","It","was","delicious","!"],                 answer:"We went to Spain and ate seafood . It was delicious !" },
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
      { en:"bring",      kanji:"持ってくる",  kana:"もってくる",     trans:"雨が降るかもしれないので、傘を%%持ってくる%%のを忘れないで。",                                  hint:"Don't forget to _____ your umbrella. It might rain.",            tiles:["Don't","forget","to","bring","your","umbrella",".","It","might","rain","."],                   answer:"Don't forget to bring your umbrella . It might rain ." },
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
      { en:"last weekend",      kanji:"先週末",      kana:"せんしゅうまつ",    trans:"%%先週末%%、Mt.ベーカーでスノーボードをしました。楽しかった！",                          hint:"I went snowboarding at Mt. Baker _____. It was so exciting!",   tiles:["I","went","snowboarding","at","Mt.","Baker","last","weekend",".","It","was","so","exciting","!"],   answer:"I went snowboarding at Mt. Baker last weekend . It was so exciting !" },
      { en:"next month",        kanji:"来月",        kana:"らいげつ",          trans:"%%来月%%一緒にスキーに行きましょう。",                                                    hint:"Let's go skiing together _____.",                              tiles:["Let's","go","skiing","together","next","month","."],                                          answer:"Let's go skiing together next month ." },
      { en:"after school",      kanji:"放課後",      kana:"ほうかご",          trans:"わたしはコミックを買うために%%放課後%%によく本屋に行きます。",                              hint:"I often go to the bookstore _____ to buy comic books.",        tiles:["I","often","go","to","the","bookstore","after","school","to","buy","comic","books","."],      answer:"I often go to the bookstore after school to buy comic books ." },
      { en:"before dinner",     kanji:"夕食の前",    kana:"ゆうしょくのまえ",  trans:"アリスは宿題が終わった後、%%夕食の前%%に読書をするのが好きです。",                        hint:"Alice loves to read _____ after she finishes her homework.",   tiles:["Alice","loves","to","read","before","dinner","after","she","finishes","her","homework","."],  answer:"Alice loves to read before dinner after she finishes her homework ." },
      { en:"every day",         kanji:"毎日",        kana:"まいにち",          trans:"二人は上達するために%%毎日%%一緒にサッカーを練習しました。",                              hint:"They practiced soccer together _____ to improve.",             tiles:["They","practiced","soccer","together","every","day","to","improve","."],                      answer:"They practiced soccer together every day to improve ." },
      { en:"for the first time",kanji:"初めて",      kana:"はじめて",          trans:"祖父は去年%%初めて%%飛行機に乗りました。",                                              hint:"My grandfather took a plane _____ last year.",                 tiles:["My","grandfather","took","a","plane","for","the","first","time","last","year","."],           answer:"My grandfather took a plane for the first time last year ." },
      { en:"at first",          kanji:"最初は",      kana:"さいしょは",        trans:"%%最初は%%、ケンはチームメイトに英語で話しかけられなかった。",                            hint:"_____, Ken couldn't speak to his teammates in English.",       tiles:["At","first","Ken","couldn't","speak","to","his","teammates","in","English","."],             answer:"At first Ken couldn't speak to his teammates in English ." },
      { en:"in the end",        kanji:"最終的に",    kana:"さいしゅうてきに",  trans:"%%最終的に%%、ダニエルはコンテストに勝って両親はとても喜んだ。",                         hint:"_____, Daniel won the contest and his parents were very happy.", tiles:["In","the","end","Daniel","won","the","contest","and","his","parents","were","very","happy","."], answer:"In the end Daniel won the contest and his parents were very happy ." },
      { en:"next week",         kanji:"来週",        kana:"らいしゅう",        trans:"英語スピーチコンテストは%%来週%%で、準備しなければなりません。",                          hint:"My English speech contest is _____. I have to prepare.",      tiles:["My","English","speech","contest","is","next","week",".","I","have","to","prepare","."],      answer:"My English speech contest is next week . I have to prepare ." },
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
      { en:"Whose",              kanji:"誰の",               kana:"だれの",           hint:"_____ pet is black? Is it Tom's?",                       tiles:["Whose","pet","is","black","?"],                                               answer:"Whose pet is black ?" },
      { en:"Which",              kanji:"どちらの・どれ",     kana:"どちらの",         hint:"_____ class do they have next, history or math?",        tiles:["Which","class","do","they","have","next","?"],                                answer:"Which class do they have next ?" },
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
  {
    id: "g4_places_2", title: "Places in Town 2 / まちの場所②", emoji: "🏥",
    color: "#6366f1", shadow: "#4338ca",
    words: [
      { en:"library",       kanji:"図書館",     kana:"としょかん",     trans:"私は毎週%%図書館%%で本を借ります。",                        hint:"I borrow books from the _____ every week.",          tiles:["I","borrow","books","from","the","library","every","week","."],      answer:"I borrow books from the library every week ." },
      { en:"park",          kanji:"公園",       kana:"こうえん",       trans:"放課後、%%公園%%でサッカーをしましょう。",                   hint:"Let's play soccer at the _____ after school.",       tiles:["Let's","play","soccer","at","the","park","after","school","."],      answer:"Let's play soccer at the park after school ." },
      { en:"zoo",           kanji:"動物園",     kana:"どうぶつえん",   trans:"土曜日に家族と%%動物園%%に行きました。",                     hint:"I went to the _____ with my family on Saturday.",    tiles:["I","went","to","the","zoo","with","my","family","on","Saturday","."], answer:"I went to the zoo with my family on Saturday ." },
      { en:"hospital",      kanji:"病院",       kana:"びょういん",     trans:"母は%%病院%%で看護師として働いています。",                    hint:"My mother works at the _____ as a nurse.",           tiles:["My","mother","works","at","the","hospital","as","a","nurse","."],     answer:"My mother works at the hospital as a nurse ." },
      { en:"swimming pool", kanji:"プール",     kana:"プール",         trans:"夏は地域の%%プール%%で泳ぎます。",                           hint:"I swim at the community _____ in summer.",           tiles:["I","swim","at","the","community","swimming","pool","in","summer","."], answer:"I swim at the community swimming pool in summer ." },
      { en:"school office", kanji:"職員室",     kana:"しょくいんしつ", trans:"先生は%%職員室%%にいます。",                                hint:"The teacher is in the _____.",                       tiles:["The","teacher","is","in","the","school","office","."],               answer:"The teacher is in the school office ." },
      { en:"city",          kanji:"都市・街",   kana:"とし",           trans:"私の叔父は大きな%%都市%%に住んでいます。",                    hint:"My uncle lives in a big _____.",                     tiles:["My","uncle","lives","in","a","big","city","."],                       answer:"My uncle lives in a big city ." },
    ],
  },
  {
    id: "g4_home", title: "Home & Objects / いえ・もの", emoji: "🏠",
    color: "#f97316", shadow: "#c2410c",
    words: [
      { en:"room",    kanji:"部屋",     kana:"へや",        trans:"私の%%部屋%%にはポスターがたくさんあります。",        hint:"I have many posters in my _____.",              tiles:["I","have","many","posters","in","my","room","."],                     answer:"I have many posters in my room ." },
      { en:"kitchen", kanji:"台所",     kana:"だいどころ",   trans:"母は%%台所%%で夕食を作っています。",                hint:"My mother is making dinner in the _____.",      tiles:["My","mother","is","making","dinner","in","the","kitchen","."],        answer:"My mother is making dinner in the kitchen ." },
      { en:"window",  kanji:"窓",       kana:"まど",        trans:"%%窓%%を開けてください。外は涼しいです。",          hint:"Please open the _____. It is cool outside.",    tiles:["Please","open","the","window",".","It","is","cool","outside","."],    answer:"Please open the window . It is cool outside ." },
      { en:"garden",  kanji:"庭",       kana:"にわ",        trans:"父は毎朝%%庭%%の花に水をやります。",                hint:"My father waters the flowers in the _____ every morning.", tiles:["My","father","waters","the","flowers","in","the","garden","every","morning","."], answer:"My father waters the flowers in the garden every morning ." },
      { en:"locker",  kanji:"ロッカー", kana:"ロッカー",     trans:"私の%%ロッカー%%はとても混んでいます。",            hint:"My _____ is very crowded.",                      tiles:["My","locker","is","very","crowded","."],                              answer:"My locker is very crowded ." },
      { en:"desk",    kanji:"机",       kana:"つくえ",      trans:"宿題は%%机%%の上にあります。",                      hint:"My homework is on the _____.",                   tiles:["My","homework","is","on","the","desk","."],                           answer:"My homework is on the desk ." },
      { en:"bench",   kanji:"ベンチ",   kana:"ベンチ",      trans:"公園の%%ベンチ%%に座りましょう。",                  hint:"Let's sit on the _____ in the park.",            tiles:["Let's","sit","on","the","bench","in","the","park","."],               answer:"Let's sit on the bench in the park ." },
    ],
  },
  {
    id: "g4_food_1", title: "Food 1 / たべもの①", emoji: "🍕",
    color: "#ef4444", shadow: "#b91c1c",
    words: [
      { en:"cake",      kanji:"ケーキ",       kana:"ケーキ",       trans:"誕生日においしい%%ケーキ%%を食べました。",              hint:"I ate a delicious _____ on my birthday.",        tiles:["I","ate","a","delicious","cake","on","my","birthday","."],          answer:"I ate a delicious cake on my birthday ." },
      { en:"sandwich",  kanji:"サンドイッチ", kana:"サンドイッチ", trans:"母は私にランチ用の%%サンドイッチ%%を作ってくれました。", hint:"My mother made a _____ for my lunch.",           tiles:["My","mother","made","a","sandwich","for","my","lunch","."],         answer:"My mother made a sandwich for my lunch ." },
      { en:"pizza",     kanji:"ピザ",         kana:"ピザ",         trans:"金曜日の夜は家族で%%ピザ%%を食べます。",               hint:"We eat _____ together on Friday nights.",        tiles:["We","eat","pizza","together","on","Friday","nights","."],           answer:"We eat pizza together on Friday nights ." },
      { en:"curry",     kanji:"カレー",       kana:"カレー",       trans:"この%%カレー%%はとてもおいしいです。",                  hint:"This _____ is very delicious.",                  tiles:["This","curry","is","very","delicious","."],                         answer:"This curry is very delicious ." },
      { en:"steak",     kanji:"ステーキ",     kana:"ステーキ",     trans:"父の誕生日に%%ステーキ%%を食べに行きました。",           hint:"We went to eat _____ for my father's birthday.", tiles:["We","went","to","eat","steak","for","my","father's","birthday","."], answer:"We went to eat steak for my father's birthday ." },
      { en:"soup",      kanji:"スープ",       kana:"スープ",       trans:"寒い日に温かい%%スープ%%が飲みたいです。",              hint:"I want to drink hot _____ on a cold day.",       tiles:["I","want","to","drink","hot","soup","on","a","cold","day","."],     answer:"I want to drink hot soup on a cold day ." },
      { en:"rice ball", kanji:"おにぎり",     kana:"おにぎり",     trans:"私はお弁当に%%おにぎり%%を持っていきます。",             hint:"I bring a _____ in my lunch box.",               tiles:["I","bring","a","rice","ball","in","my","lunch","box","."],          answer:"I bring a rice ball in my lunch box ." },
    ],
  },
  {
    id: "g4_food_2", title: "Food 2 / たべもの②", emoji: "🍫",
    color: "#ef4444", shadow: "#b91c1c",
    words: [
      { en:"chocolate", kanji:"チョコレート", kana:"チョコレート", trans:"バレンタインデーに%%チョコレート%%をもらいました。",      hint:"I got _____ on Valentine's Day.",                tiles:["I","got","chocolate","on","Valentine's","Day","."],                 answer:"I got chocolate on Valentine's Day ." },
      { en:"hot dog",   kanji:"ホットドッグ", kana:"ホットドッグ", trans:"野球場で%%ホットドッグ%%を食べました。",                  hint:"I ate a _____ at the baseball stadium.",         tiles:["I","ate","a","hot","dog","at","the","baseball","stadium","."],      answer:"I ate a hot dog at the baseball stadium ." },
      { en:"pancake",   kanji:"パンケーキ",   kana:"パンケーキ",   trans:"日曜日の朝は%%パンケーキ%%を作ります。",                  hint:"I make _____ on Sunday morning.",                tiles:["I","make","pancakes","on","Sunday","morning","."],                  answer:"I make pancakes on Sunday morning ." },
      { en:"sausage",   kanji:"ソーセージ",   kana:"ソーセージ",   trans:"朝食に%%ソーセージ%%と卵を食べます。",                    hint:"I eat _____ and eggs for breakfast.",            tiles:["I","eat","sausage","and","eggs","for","breakfast","."],             answer:"I eat sausage and eggs for breakfast ." },
      { en:"stew",      kanji:"シチュー",     kana:"シチュー",     trans:"冬になると母が%%シチュー%%を作ってくれます。",             hint:"My mother makes _____ in winter.",               tiles:["My","mother","makes","stew","in","winter","."],                     answer:"My mother makes stew in winter ." },
      { en:"cookie",    kanji:"クッキー",     kana:"クッキー",     trans:"祖母が焼いた%%クッキー%%はとてもおいしいです。",           hint:"The _____ my grandmother baked is very delicious.", tiles:["The","cookie","my","grandmother","baked","is","very","delicious","."], answer:"The cookie my grandmother baked is very delicious ." },
      { en:"spaghetti", kanji:"スパゲッティ", kana:"スパゲッティ", trans:"イタリアンレストランで%%スパゲッティ%%を食べました。",    hint:"I ate _____ at the Italian restaurant.",         tiles:["I","ate","spaghetti","at","the","Italian","restaurant","."],        answer:"I ate spaghetti at the Italian restaurant ." },
    ],
  },
  {
    id: "g4_clothing", title: "Clothing / ふく", emoji: "👗",
    color: "#8b5cf6", shadow: "#6d28d9",
    words: [
      { en:"umbrella", kanji:"傘",       kana:"かさ",       trans:"雨が降っているので%%傘%%を持ってきました。",          hint:"I brought my _____ because it is raining.",          tiles:["I","brought","my","umbrella","because","it","is","raining","."],      answer:"I brought my umbrella because it is raining ." },
      { en:"gloves",   kanji:"手袋",     kana:"てぶくろ",   trans:"外は寒いので%%手袋%%をはめてください。",             hint:"Please wear _____ because it is cold outside.",      tiles:["Please","wear","gloves","because","it","is","cold","outside","."],    answer:"Please wear gloves because it is cold outside ." },
      { en:"hat",      kanji:"帽子",     kana:"ぼうし",     trans:"夏は太陽が強いので%%帽子%%をかぶります。",           hint:"I wear a _____ because the sun is strong in summer.", tiles:["I","wear","a","hat","because","the","sun","is","strong","in","summer","."], answer:"I wear a hat because the sun is strong in summer ." },
      { en:"coat",     kanji:"コート",   kana:"コート",     trans:"今日は寒いので%%コート%%を着てください。",           hint:"Please wear your _____ because it is cold today.",   tiles:["Please","wear","your","coat","because","it","is","cold","today","."],  answer:"Please wear your coat because it is cold today ." },
      { en:"sweater",  kanji:"セーター", kana:"セーター",   trans:"秋になると%%セーター%%を着ます。",                   hint:"I wear a _____ in fall.",                            tiles:["I","wear","a","sweater","in","fall","."],                              answer:"I wear a sweater in fall ." },
      { en:"socks",    kanji:"靴下",     kana:"くつした",   trans:"新しい%%靴下%%を二足買いました。",                   hint:"I bought two pairs of new _____.",                   tiles:["I","bought","two","pairs","of","new","socks","."],                    answer:"I bought two pairs of new socks ." },
      { en:"shoes",    kanji:"靴",       kana:"くつ",       trans:"新しい%%靴%%はとても履き心地がいいです。",           hint:"My new _____ are very comfortable.",                 tiles:["My","new","shoes","are","very","comfortable","."],                    answer:"My new shoes are very comfortable ." },
    ],
  },
  {
    id: "g4_items", title: "Personal Items / もちもの", emoji: "🎒",
    color: "#0ea5e9", shadow: "#0369a1",
    words: [
      { en:"bag",          kanji:"カバン",   kana:"カバン",     trans:"私の%%カバン%%はとても重いです。",                    hint:"My _____ is very heavy.",                       tiles:["My","bag","is","very","heavy","."],                                   answer:"My bag is very heavy ." },
      { en:"watch",        kanji:"時計",     kana:"とけい",     trans:"父に新しい%%時計%%をもらいました。",                  hint:"I got a new _____ from my father.",              tiles:["I","got","a","new","watch","from","my","father","."],                 answer:"I got a new watch from my father ." },
      { en:"ticket",       kanji:"チケット", kana:"チケット",   trans:"コンサートの%%チケット%%を2枚買いました。",            hint:"I bought two _____ for the concert.",           tiles:["I","bought","two","tickets","for","the","concert","."],               answer:"I bought two tickets for the concert ." },
      { en:"notebook",     kanji:"ノート",   kana:"ノート",     trans:"新しい%%ノート%%を4冊買いました。",                   hint:"I bought four new _____.",                      tiles:["I","bought","four","new","notebooks","."],                            answer:"I bought four new notebooks ." },
      { en:"eraser",       kanji:"消しゴム", kana:"けしごむ",   trans:"%%消しゴム%%を貸してもらえますか？",                   hint:"Can I borrow your _____?",                      tiles:["Can","I","borrow","your","eraser","?"],                               answer:"Can I borrow your eraser ?" },
      { en:"water bottle", kanji:"水筒",     kana:"すいとう",   trans:"学校に%%水筒%%を持ってくることを忘れないで。",          hint:"Don't forget to bring your _____ to school.",   tiles:["Don't","forget","to","bring","your","water","bottle","to","school","."], answer:"Don't forget to bring your water bottle to school ." },
      { en:"boots",        kanji:"ブーツ",   kana:"ブーツ",     trans:"雨の日には%%ブーツ%%を履きます。",                    hint:"I wear _____ on rainy days.",                   tiles:["I","wear","boots","on","rainy","days","."],                           answer:"I wear boots on rainy days ." },
    ],
  },
  {
    id: "g4_hobbies", title: "Hobbies & Entertainment / しゅみ", emoji: "🎮",
    color: "#ec4899", shadow: "#be185d",
    words: [
      { en:"magazine",   kanji:"雑誌",       kana:"ざっし",     trans:"私は美容院で%%雑誌%%を読みます。",               hint:"I read a _____ at the beauty salon.",             tiles:["I","read","a","magazine","at","the","beauty","salon","."],        answer:"I read a magazine at the beauty salon ." },
      { en:"concert",    kanji:"コンサート", kana:"コンサート", trans:"今週末、音楽%%コンサート%%に行きます。",          hint:"I am going to a music _____ this weekend.",       tiles:["I","am","going","to","a","music","concert","this","weekend","."], answer:"I am going to a music concert this weekend ." },
      { en:"movie",      kanji:"映画",       kana:"えいが",     trans:"昨夜、友達と%%映画%%を見に行きました。",          hint:"I went to see a _____ with my friend last night.", tiles:["I","went","to","see","a","movie","with","my","friend","last","night","."], answer:"I went to see a movie with my friend last night ." },
      { en:"video games",kanji:"テレビゲーム",kana:"テレビゲーム",trans:"弟は毎日%%テレビゲーム%%をします。",           hint:"My brother plays _____ every day.",               tiles:["My","brother","plays","video","games","every","day","."],         answer:"My brother plays video games every day ." },
      { en:"comic book", kanji:"マンガ",     kana:"マンガ",     trans:"私は日本語の%%マンガ%%を読むのが好きです。",      hint:"I like reading Japanese _____.",                  tiles:["I","like","reading","Japanese","comic","books","."],              answer:"I like reading Japanese comic books ." },
      { en:"present",    kanji:"プレゼント", kana:"プレゼント", trans:"誕生日に友達から%%プレゼント%%をもらいました。",  hint:"I got a _____ from my friend on my birthday.",    tiles:["I","got","a","present","from","my","friend","on","my","birthday","."], answer:"I got a present from my friend on my birthday ." },
      { en:"photo",      kanji:"写真",       kana:"しゃしん",   trans:"旅行中にたくさん%%写真%%を撮りました。",          hint:"I took many _____ during my trip.",               tiles:["I","took","many","photos","during","my","trip","."],              answer:"I took many photos during my trip ." },
    ],
  },
  {
    id: "g4_travel", title: "Travel & Transport / りょこう・のりもの", emoji: "✈️",
    color: "#06b6d4", shadow: "#0891b2",
    words: [
      { en:"plane",    kanji:"飛行機",       kana:"ひこうき",    trans:"私は初めて%%飛行機%%に乗りました。",             hint:"I rode on a _____ for the first time.",               tiles:["I","rode","on","a","plane","for","the","first","time","."],           answer:"I rode on a plane for the first time ." },
      { en:"bus",      kanji:"バス",         kana:"バス",        trans:"私は毎朝学校へ%%バス%%で行きます。",             hint:"I go to school by _____ every morning.",              tiles:["I","go","to","school","by","bus","every","morning","."],              answer:"I go to school by bus every morning ." },
      { en:"train",    kanji:"電車",         kana:"でんしゃ",    trans:"東京に行くために%%電車%%に乗りました。",         hint:"I took the _____ to go to Tokyo.",                    tiles:["I","took","the","train","to","go","to","Tokyo","."],                  answer:"I took the train to go to Tokyo ." },
      { en:"bicycle",  kanji:"自転車",       kana:"じてんしゃ",  trans:"私は毎日%%自転車%%で学校に通っています。",       hint:"I ride my _____ to school every day.",                tiles:["I","ride","my","bicycle","to","school","every","day","."],            answer:"I ride my bicycle to school every day ." },
      { en:"boat",     kanji:"ボート",       kana:"ボート",      trans:"湖で%%ボート%%に乗りました。",                   hint:"I rode a _____ on the lake.",                         tiles:["I","rode","a","boat","on","the","lake","."],                          answer:"I rode a boat on the lake ." },
      { en:"trip",     kanji:"旅行",         kana:"りょこう",    trans:"夏休みに家族と海外%%旅行%%をしました。",         hint:"I went on an overseas _____ with my family in summer.", tiles:["I","went","on","an","overseas","trip","with","my","family","in","summer","."], answer:"I went on an overseas trip with my family in summer ." },
      { en:"homestay", kanji:"ホームステイ", kana:"ホームステイ", trans:"オーストラリアで一週間%%ホームステイ%%をしました。", hint:"I did a _____ in Australia for one week.",           tiles:["I","did","a","homestay","in","Australia","for","one","week","."],     answer:"I did a homestay in Australia for one week ." },
    ],
  },
  {
    id: "g4_nature", title: "Nature / しぜん", emoji: "🌊",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"river",    kanji:"川",   kana:"かわ",     trans:"私の町の近くに大きな%%川%%があります。",           hint:"There is a big _____ near my town.",           tiles:["There","is","a","big","river","near","my","town","."],           answer:"There is a big river near my town ." },
      { en:"sea",      kanji:"海",   kana:"うみ",     trans:"夏は家族と%%海%%に行きます。",                   hint:"I go to the _____ with my family in summer.",  tiles:["I","go","to","the","sea","with","my","family","in","summer","."],  answer:"I go to the sea with my family in summer ." },
      { en:"mountain", kanji:"山",   kana:"やま",     trans:"父は週末によく%%山%%に登ります。",               hint:"My father often climbs _____ on weekends.",    tiles:["My","father","often","climbs","mountains","on","weekends","."],   answer:"My father often climbs mountains on weekends ." },
      { en:"beach",    kanji:"ビーチ",kana:"ビーチ",   trans:"今年の夏は%%ビーチ%%でサーフィンをしました。",   hint:"I went surfing at the _____ this summer.",     tiles:["I","went","surfing","at","the","beach","this","summer","."],      answer:"I went surfing at the beach this summer ." },
      { en:"lake",     kanji:"湖",   kana:"みずうみ", trans:"その%%湖%%はとても美しかったです。",             hint:"The _____ was very beautiful.",                tiles:["The","lake","was","very","beautiful","."],                        answer:"The lake was very beautiful ." },
      { en:"sky",      kanji:"空",   kana:"そら",     trans:"今日は%%空%%がとても青いです。",                 hint:"The _____ is very blue today.",                tiles:["The","sky","is","very","blue","today","."],                       answer:"The sky is very blue today ." },
      { en:"star",     kanji:"星",   kana:"ほし",     trans:"夜、たくさんの%%星%%が見えました。",             hint:"I could see many _____ at night.",             tiles:["I","could","see","many","stars","at","night","."],               answer:"I could see many stars at night ." },
    ],
  },
  {
    id: "g4_jobs", title: "Jobs & Careers / しごと", emoji: "💼",
    color: "#f59e0b", shadow: "#d97706",
    words: [
      { en:"pilot",      kanji:"パイロット", kana:"パイロット",   trans:"私の夢は%%パイロット%%になることです。",                          hint:"My dream is to become a _____.",                          tiles:["My","dream","is","to","become","a","pilot","."],                        answer:"My dream is to become a pilot ." },
      { en:"singer",     kanji:"歌手",       kana:"かしゅ",       trans:"山田さんの娘は有名な%%歌手%%です。",                              hint:"Mr. Yamada's daughter is a famous _____.",                tiles:["Mr.","Yamada's","daughter","is","a","famous","singer","."],             answer:"Mr. Yamada's daughter is a famous singer ." },
      { en:"artist",     kanji:"芸術家",     kana:"げいじゅつか", trans:"ダニエルはアートコンテストで優勝して%%芸術家%%を目指しました。",  hint:"Daniel wanted to become an _____ after winning the art contest.", tiles:["Daniel","wanted","to","become","an","artist","after","winning","the","art","contest","."], answer:"Daniel wanted to become an artist after winning the art contest ." },
      { en:"coach",      kanji:"コーチ",     kana:"コーチ",       trans:"私たちのサッカー%%コーチ%%はとても厳しいです。",                  hint:"Our soccer _____ is very strict.",                        tiles:["Our","soccer","coach","is","very","strict","."],                        answer:"Our soccer coach is very strict ." },
      { en:"doctor",     kanji:"医者",       kana:"いしゃ",       trans:"山田さんの息子は大きな病院の%%医者%%です。",                       hint:"Mr. Yamada's son is a _____ at a big hospital.",          tiles:["Mr.","Yamada's","son","is","a","doctor","at","a","big","hospital","."], answer:"Mr. Yamada's son is a doctor at a big hospital ." },
      { en:"teacher",    kanji:"先生",       kana:"せんせい",     trans:"私の英語の%%先生%%はカナダ出身です。",                            hint:"My English _____ is from Canada.",                        tiles:["My","English","teacher","is","from","Canada","."],                      answer:"My English teacher is from Canada ." },
      { en:"salesclerk", kanji:"店員",       kana:"てんいん",     trans:"%%店員%%が笑顔で「いらっしゃいませ」と言いました。",              hint:"The _____ smiled and said 'Welcome!'",                    tiles:["The","salesclerk","smiled","and","said","'Welcome!'","."],              answer:"The salesclerk smiled and said 'Welcome!' ." },
    ],
  },
  {
    id: "g4_people", title: "People / ひとびと", emoji: "👥",
    color: "#6366f1", shadow: "#4338ca",
    words: [
      { en:"classmate",   kanji:"クラスメート",  kana:"クラスメート",  trans:"私の%%クラスメート%%はとても親切です。",             hint:"My _____ is very kind.",                           tiles:["My","classmate","is","very","kind","."],                     answer:"My classmate is very kind ." },
      { en:"teammate",    kanji:"チームメート",  kana:"チームメート",  trans:"私の%%チームメート%%はとても上手なサッカー選手です。", hint:"My _____ is a very good soccer player.",           tiles:["My","teammate","is","a","very","good","soccer","player","."],  answer:"My teammate is a very good soccer player ." },
      { en:"host family", kanji:"ホストファミリー",kana:"ホストファミリー",trans:"私の%%ホストファミリー%%はとても親切でした。",      hint:"My _____ was very kind.",                          tiles:["My","host","family","was","very","kind","."],                answer:"My host family was very kind ." },
      { en:"winner",      kanji:"優勝者",       kana:"ゆうしょうしゃ",trans:"%%優勝者%%はトロフィーをもらいました。",              hint:"The _____ got a trophy.",                          tiles:["The","winner","got","a","trophy","."],                       answer:"The winner got a trophy ." },
      { en:"volunteer",   kanji:"ボランティア",  kana:"ボランティア",  trans:"私は学校の清掃活動で%%ボランティア%%をしました。",    hint:"I was a _____ for the school cleaning event.",    tiles:["I","was","a","volunteer","for","the","school","cleaning","event","."], answer:"I was a volunteer for the school cleaning event ." },
      { en:"customer",    kanji:"お客さん",     kana:"おきゃくさん",  trans:"その%%お客さん%%は笑顔で答えました。",               hint:"The _____ answered with a kind smile.",            tiles:["The","customer","answered","with","a","kind","smile","."],   answer:"The customer answered with a kind smile ." },
    ],
  },
  {
    id: "g4_sports", title: "Sports & Activities / スポーツ", emoji: "🏄",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"snowboarding", kanji:"スノーボード", kana:"スノーボード", trans:"先週末、Mt.ベーカーでスノーボードをしました。",      hint:"I went _____ at Mt. Baker last weekend.",              tiles:["I","went","snowboarding","at","Mt.","Baker","last","weekend","."], answer:"I went snowboarding at Mt. Baker last weekend ." },
      { en:"camping",      kanji:"キャンプ",     kana:"キャンプ",     trans:"夏休みに山で%%キャンプ%%をしました。",              hint:"I went _____ in the mountains during summer vacation.", tiles:["I","went","camping","in","the","mountains","during","summer","vacation","."], answer:"I went camping in the mountains during summer vacation ." },
      { en:"hiking",       kanji:"ハイキング",   kana:"ハイキング",   trans:"日曜日に家族と%%ハイキング%%に行きました。",          hint:"I went _____ with my family on Sunday.",               tiles:["I","went","hiking","with","my","family","on","Sunday","."],       answer:"I went hiking with my family on Sunday ." },
      { en:"fishing",      kanji:"釣り",         kana:"つり",         trans:"祖父は毎週末川で%%釣り%%をします。",                hint:"My grandfather goes _____ at the river every weekend.", tiles:["My","grandfather","goes","fishing","at","the","river","every","weekend","."], answer:"My grandfather goes fishing at the river every weekend ." },
      { en:"surfing",      kanji:"サーフィン",   kana:"サーフィン",   trans:"今年の夏、ビーチで%%サーフィン%%を習いました。",     hint:"I learned _____ at the beach this summer.",           tiles:["I","learned","surfing","at","the","beach","this","summer","."],   answer:"I learned surfing at the beach this summer ." },
      { en:"rugby",        kanji:"ラグビー",     kana:"ラグビー",     trans:"私の学校では%%ラグビー%%が人気です。",               hint:"_____ is popular at my school.",                       tiles:["Rugby","is","popular","at","my","school","."],                    answer:"Rugby is popular at my school ." },
      { en:"swimming",     kanji:"水泳",         kana:"すいえい",     trans:"私は毎週プールで%%水泳%%の練習をします。",           hint:"I practice _____ at the pool every week.",            tiles:["I","practice","swimming","at","the","pool","every","week","."],   answer:"I practice swimming at the pool every week ." },
    ],
  },
  {
    id: "g4_communication", title: "Communication / れんらく", emoji: "📬",
    color: "#f97316", shadow: "#c2410c",
    words: [
      { en:"letter",  kanji:"手紙",     kana:"てがみ",    trans:"ペンパルに英語で%%手紙%%を書きました。",       hint:"I wrote a _____ to my pen pal in English.",    tiles:["I","wrote","a","letter","to","my","pen","pal","in","English","."], answer:"I wrote a letter to my pen pal in English ." },
      { en:"email",   kanji:"メール",   kana:"メール",    trans:"ホストファミリーに%%メール%%を送りました。",    hint:"I sent an _____ to my host family.",            tiles:["I","sent","an","email","to","my","host","family","."],            answer:"I sent an email to my host family ." },
      { en:"report",  kanji:"レポート", kana:"レポート",  trans:"昨夜、学校の%%レポート%%を書いていました。",    hint:"I was writing a school _____ last night.",     tiles:["I","was","writing","a","school","report","last","night","."],     answer:"I was writing a school report last night ." },
      { en:"phone",   kanji:"電話",     kana:"でんわ",    trans:"母から%%電話%%がありました。",                hint:"I got a _____ call from my mother.",            tiles:["I","got","a","phone","call","from","my","mother","."],            answer:"I got a phone call from my mother ." },
      { en:"message", kanji:"メッセージ",kana:"メッセージ",trans:"友達から%%メッセージ%%が届きました。",         hint:"I got a _____ from my friend.",                 tiles:["I","got","a","message","from","my","friend","."],                 answer:"I got a message from my friend ." },
    ],
  },
  {
    id: "g4_adjectives_2", title: "Adjectives 2 / けいようし②", emoji: "✨",
    color: "#8b5cf6", shadow: "#6d28d9",
    words: [
      { en:"kind",        kanji:"親切な",     kana:"しんせつな",    trans:"私のホストファミリーはとても%%親切%%でした。",          hint:"My host family was very _____.",                  tiles:["My","host","family","was","very","kind","."],                    answer:"My host family was very kind ." },
      { en:"interesting", kanji:"面白い",     kana:"おもしろい",    trans:"その映画はとても%%面白かった%%です。",                 hint:"The movie was very _____.",                       tiles:["The","movie","was","very","interesting","."],                    answer:"The movie was very interesting ." },
      { en:"important",   kanji:"大切な",     kana:"たいせつな",    trans:"毎日練習することがとても%%大切%%です。",                hint:"It is very _____ to practice every day.",         tiles:["It","is","very","important","to","practice","every","day","."],  answer:"It is very important to practice every day ." },
      { en:"famous",      kanji:"有名な",     kana:"ゆうめいな",    trans:"あの選手はとても%%有名%%です。",                       hint:"That player is very _____.",                      tiles:["That","player","is","very","famous","."],                        answer:"That player is very famous ." },
      { en:"wet",         kanji:"濡れた",     kana:"ぬれた",        trans:"雨で傘がびしょびしょに%%濡れました%%。",               hint:"My umbrella got _____ in the rain.",              tiles:["My","umbrella","got","wet","in","the","rain","."],               answer:"My umbrella got wet in the rain ." },
      { en:"ready",       kanji:"準備ができた",kana:"じゅんびができた",trans:"私は試合の%%準備ができて%%います。",               hint:"I am _____ for the game.",                        tiles:["I","am","ready","for","the","game","."],                         answer:"I am ready for the game ." },
      { en:"sleepy",      kanji:"眠い",       kana:"ねむい",        trans:"昨夜遅くまで起きていたので%%眠い%%です。",              hint:"I am _____ because I stayed up late last night.", tiles:["I","am","sleepy","because","I","stayed","up","late","last","night","."], answer:"I am sleepy because I stayed up late last night ." },
    ],
  },
  {
    id: "g4_verbs_2", title: "Action Verbs 2 / どうし②", emoji: "🎯",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"enjoy",  kanji:"楽しむ",    kana:"たのしむ",    trans:"私はスペインで毎日%%楽しみました%%。",            hint:"I _____ every day in Spain.",                       tiles:["I","enjoyed","every","day","in","Spain","."],                   answer:"I enjoyed every day in Spain ." },
      { en:"need",   kanji:"必要とする",kana:"ひつようとする",trans:"新しいノートが%%必要です%%。",                   hint:"I _____ a new notebook.",                           tiles:["I","need","a","new","notebook","."],                            answer:"I need a new notebook ." },
      { en:"help",   kanji:"手伝う",    kana:"てつだう",    trans:"弟が宿題を%%手伝って%%くれました。",              hint:"My brother _____ me with my homework.",             tiles:["My","brother","helped","me","with","my","homework","."],        answer:"My brother helped me with my homework ." },
      { en:"climb",  kanji:"登る",      kana:"のぼる",      trans:"父は週末よく山を%%登ります%%。",                  hint:"My father often _____ mountains on weekends.",      tiles:["My","father","often","climbs","mountains","on","weekends","."],  answer:"My father often climbs mountains on weekends ." },
      { en:"carry",  kanji:"運ぶ",      kana:"はこぶ",      trans:"重い荷物を%%運んで%%ください。",                  hint:"Please _____ the heavy bags.",                      tiles:["Please","carry","the","heavy","bags","."],                      answer:"Please carry the heavy bags ." },
      { en:"show",   kanji:"見せる",    kana:"みせる",      trans:"私の写真をあなたに%%見せます%%。",                hint:"I will _____ you my photos.",                       tiles:["I","will","show","you","my","photos","."],                      answer:"I will show you my photos ." },
      { en:"travel", kanji:"旅行する",  kana:"りょこうする", trans:"家族と一緒に日本中を%%旅行したい%%です。",         hint:"I want to _____ around Japan with my family.",      tiles:["I","want","to","travel","around","Japan","with","my","family","."], answer:"I want to travel around Japan with my family ." },
    ],
  },
  {
    id: "g4_verbs_3", title: "Action Verbs 3 / どうし③", emoji: "🎯",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"send",    kanji:"送る",   kana:"おくる",    trans:"ホストファミリーにメールを%%送りました%%。",          hint:"I _____ an email to my host family.",           tiles:["I","sent","an","email","to","my","host","family","."],     answer:"I sent an email to my host family ." },
      { en:"learn",   kanji:"習う",   kana:"ならう",    trans:"今年、オーストラリアで英語を%%習いました%%。",       hint:"I _____ English in Australia this year.",       tiles:["I","learned","English","in","Australia","this","year","."], answer:"I learned English in Australia this year ." },
      { en:"return",  kanji:"戻る",   kana:"もどる",    trans:"旅行から%%戻って%%きました。",                      hint:"I _____ from my trip.",                         tiles:["I","returned","from","my","trip","."],                     answer:"I returned from my trip ." },
      { en:"grow",    kanji:"育てる", kana:"そだてる",  trans:"理科の授業でトマトを%%育てました%%。",               hint:"I _____ tomatoes in science class.",            tiles:["I","grew","tomatoes","in","science","class","."],          answer:"I grew tomatoes in science class ." },
      { en:"answer",  kanji:"答える", kana:"こたえる",  trans:"先生の質問に%%答えました%%。",                       hint:"I _____ the teacher's question.",               tiles:["I","answered","the","teacher's","question","."],           answer:"I answered the teacher's question ." },
      { en:"meet",    kanji:"会う",   kana:"あう",      trans:"明日駅で友達に%%会う%%予定です。",                  hint:"I am going to _____ my friend at the station tomorrow.", tiles:["I","am","going","to","meet","my","friend","at","the","station","tomorrow","."], answer:"I am going to meet my friend at the station tomorrow ." },
      { en:"try",     kanji:"試す",   kana:"ためす",    trans:"新しい食べ物を%%試して%%みましょう。",              hint:"Let's _____ the new food.",                     tiles:["Let's","try","the","new","food","."],                      answer:"Let's try the new food ." },
    ],
  },
  {
    id: "g4_irregular_2", title: "Irregular Past Tense 2 / 不規則過去形②", emoji: "⏪",
    isIrregularVerb: true,
    color: "#ef4444", shadow: "#b91c1c",
    words: [
      { en:"went",  present:"go",   kanji:"行く",     kana:"いった",   alts:["goed","goned","gone"],       hint:"Yesterday I _____ to the park with my friends.",       tiles:["Yesterday","I","went","to","the","park","with","my","friends","."],  answer:"Yesterday I went to the park with my friends ." },
      { en:"came",  present:"come", kanji:"来る",     kana:"きた",     alts:["comed","come","camed"],      hint:"My friend _____ to my house yesterday.",               tiles:["My","friend","came","to","my","house","yesterday","."],              answer:"My friend came to my house yesterday ." },
      { en:"got",   present:"get",  kanji:"手に入れる",kana:"えた",    alts:["getted","gat","gotten"],     hint:"I _____ a present for my birthday.",                   tiles:["I","got","a","present","for","my","birthday","."],                  answer:"I got a present for my birthday ." },
      { en:"gave",  present:"give", kanji:"あげる",   kana:"あげた",   alts:["gaved","gived","given"],     hint:"She _____ me a chocolate cookie.",                     tiles:["She","gave","me","a","chocolate","cookie","."],                     answer:"She gave me a chocolate cookie ." },
      { en:"said",  present:"say",  kanji:"言う",     kana:"いった",   alts:["sayed","saied","siad"],      hint:"He _____ hello to his new teammates.",                 tiles:["He","said","hello","to","his","new","teammates","."],               answer:"He said hello to his new teammates ." },
      { en:"ate",   present:"eat",  kanji:"食べる",   kana:"たべた",   alts:["eated","eaten","ated"],      hint:"We _____ spaghetti for dinner last night.",            tiles:["We","ate","spaghetti","for","dinner","last","night","."],           answer:"We ate spaghetti for dinner last night ." },
      { en:"saw",   present:"see",  kanji:"見る",     kana:"みた",     alts:["seed","seen","sawed"],       hint:"I _____ a great movie with my friend yesterday.",      tiles:["I","saw","a","great","movie","with","my","friend","yesterday","."], answer:"I saw a great movie with my friend yesterday ." },
    ],
  },
  {
    id: "g4_irregular_3", title: "Irregular Past Tense 3 / 不規則過去形③", emoji: "⏪",
    isIrregularVerb: true,
    color: "#ef4444", shadow: "#b91c1c",
    words: [
      { en:"found",   present:"find",  kanji:"見つける", kana:"みつけた",  alts:["finded","finned","founds"],   hint:"I _____ my lost umbrella in the classroom.",        tiles:["I","found","my","lost","umbrella","in","the","classroom","."],   answer:"I found my lost umbrella in the classroom ." },
      { en:"felt",    present:"feel",  kanji:"感じる",   kana:"かんじた",  alts:["feeled","feled","feelt"],     hint:"She _____ nervous before the speech contest.",      tiles:["She","felt","nervous","before","the","speech","contest","."],    answer:"She felt nervous before the speech contest ." },
      { en:"made",    present:"make",  kanji:"作る",     kana:"つくった",  alts:["maked","maded","maden"],      hint:"My mother _____ a delicious curry for dinner.",     tiles:["My","mother","made","a","delicious","curry","for","dinner","."],  answer:"My mother made a delicious curry for dinner ." },
      { en:"knew",    present:"know",  kanji:"知る",     kana:"しっていた", alts:["knowed","known","knewed"],   hint:"She already _____ how to swim very well.",          tiles:["She","already","knew","how","to","swim","very","well","."],      answer:"She already knew how to swim very well ." },
      { en:"thought", present:"think", kanji:"思う",     kana:"おもった",  alts:["thinked","thinkt","thougth"], hint:"I _____ the test was very difficult.",              tiles:["I","thought","the","test","was","very","difficult","."],          answer:"I thought the test was very difficult ." },
      { en:"wrote",   present:"write", kanji:"書く",     kana:"かいた",    alts:["writed","written","wrothe"],  hint:"I _____ a letter to my host family.",               tiles:["I","wrote","a","letter","to","my","host","family","."],          answer:"I wrote a letter to my host family ." },
      { en:"ran",     present:"run",   kanji:"走る",     kana:"はしった",  alts:["runned","raned","runed"],     hint:"He _____ very fast and won the race.",              tiles:["He","ran","very","fast","and","won","the","race","."],           answer:"He ran very fast and won the race ." },
    ],
  },
  {
    id: "g4_irregular_4", title: "Irregular Past Tense 4 / 不規則過去形④", emoji: "⏪",
    isIrregularVerb: true,
    color: "#ef4444", shadow: "#b91c1c",
    words: [
      { en:"swam",  present:"swim",  kanji:"泳ぐ",   kana:"およいだ",  alts:["swimmed","swum","swammed"],   hint:"She _____ in the pool for an hour.",                 tiles:["She","swam","in","the","pool","for","an","hour","."],              answer:"She swam in the pool for an hour ." },
      { en:"stood", present:"stand", kanji:"立つ",   kana:"たった",    alts:["standed","stod","stodded"],   hint:"We _____ at the boarding gate for a long time.",     tiles:["We","stood","at","the","boarding","gate","for","a","long","time","."], answer:"We stood at the boarding gate for a long time ." },
      { en:"sat",   present:"sit",   kanji:"座る",   kana:"すわった",  alts:["sitted","sated","sited"],     hint:"She _____ on the bench and read a magazine.",        tiles:["She","sat","on","the","bench","and","read","a","magazine","."],   answer:"She sat on the bench and read a magazine ." },
      { en:"rode",  present:"ride",  kanji:"乗る",   kana:"のった",    alts:["rided","ridded","reded"],     hint:"I _____ my bicycle to school this morning.",         tiles:["I","rode","my","bicycle","to","school","this","morning","."],      answer:"I rode my bicycle to school this morning ." },
      { en:"fell",  present:"fall",  kanji:"落ちる・眠る",kana:"おちた", alts:["falled","felled","falt"],   hint:"I _____ asleep on the train last night.",            tiles:["I","fell","asleep","on","the","train","last","night","."],         answer:"I fell asleep on the train last night ." },
      { en:"began", present:"begin", kanji:"始める", kana:"はじめた",  alts:["beginned","beganned","begun"], hint:"The concert _____ at seven o'clock.",               tiles:["The","concert","began","at","seven","o'clock","."],               answer:"The concert began at seven o'clock ." },
      { en:"met",   present:"meet",  kanji:"会う",   kana:"あった",    alts:["meeted","meted","mett"],      hint:"I _____ my host family at the airport.",             tiles:["I","met","my","host","family","at","the","airport","."],          answer:"I met my host family at the airport ." },
    ],
  },
  {
    id: "g4_phrasal_1", title: "Phrasal Verbs 1 / フレーズ動詞①", emoji: "🔗",
    color: "#7c3aed", shadow: "#5b21b6",
    words: [
      { en:"get off",           kanji:"降りる",           kana:"おりる",           hint:"Please _____ the bus at the next stop. ___________",        tiles:["Please","get","off","the","bus","at","the","next","stop","."],               answer:"Please get off the bus at the next stop ." },
      { en:"get on",            kanji:"乗る",             kana:"のる",             hint:"Let's _____ the train at platform 3. ___________",          tiles:["Let's","get","on","the","train","at","platform","3","."],                    answer:"Let's get on the train at platform 3 ." },
      { en:"get lost",          kanji:"迷う",             kana:"まよう",           hint:"We _____ in the big city. ___________",                      tiles:["We","got","lost","in","the","big","city","."],                               answer:"We got lost in the big city ." },
      { en:"fall asleep",       kanji:"眠りにつく",       kana:"ねむりにつく",     hint:"I _____ on the train last night. ___________",               tiles:["I","fell","asleep","on","the","train","last","night","."],                   answer:"I fell asleep on the train last night ." },
      { en:"take off",          kanji:"脱ぐ・離陸する",   kana:"ぬぐ",             hint:"Please _____ your shoes before entering. ___________",      tiles:["Please","take","off","your","shoes","before","entering","."],               answer:"Please take off your shoes before entering ." },
      { en:"wait for",          kanji:"〜を待つ",         kana:"まつ",             hint:"Please _____ me at the station. ___________",               tiles:["Please","wait","for","me","at","the","station","."],                        answer:"Please wait for me at the station ." },
      { en:"have a good time",  kanji:"楽しむ",           kana:"たのしむ",         hint:"I hope you _____ at the camp. ___________",                  tiles:["I","hope","you","have","a","good","time","at","the","camp","."],             answer:"I hope you have a good time at the camp ." },
    ],
  },
  {
    id: "g4_phrasal_2", title: "Phrasal Verbs 2 / フレーズ動詞②", emoji: "🔗",
    color: "#7c3aed", shadow: "#5b21b6",
    words: [
      { en:"take a trip",       kanji:"旅行する",         kana:"りょこうする",      hint:"We will _____ to Okinawa this summer. ___________",         tiles:["We","will","take","a","trip","to","Okinawa","this","summer","."],            answer:"We will take a trip to Okinawa this summer ." },
      { en:"play catch",        kanji:"キャッチボールをする",kana:"キャッチボールをする",hint:"Let's _____ in the park after school. ___________",      tiles:["Let's","play","catch","in","the","park","after","school","."],               answer:"Let's play catch in the park after school ." },
      { en:"talk to",           kanji:"〜に話しかける",   kana:"はなしかける",      hint:"Please _____ your teacher about the problem. ___________",  tiles:["Please","talk","to","your","teacher","about","the","problem","."],           answer:"Please talk to your teacher about the problem ." },
      { en:"look out",          kanji:"気をつける",       kana:"きをつける",         hint:"_____ ! There is a car coming. ___________",                tiles:["Look","out","!","There","is","a","car","coming","."],                        answer:"Look out ! There is a car coming ." },
      { en:"come to the phone", kanji:"電話に出る",       kana:"でんわにでる",      hint:"Is Tom there? Can he _____ ? ___________",                   tiles:["Is","Tom","there","?","Can","he","come","to","the","phone","?"],             answer:"Is Tom there ? Can he come to the phone ?" },
      { en:"good job",          kanji:"よくできました",   kana:"よくできました",    hint:"You won the contest. ___________ !",                          tiles:["Good","job","!"],                                                            answer:"Good job !" },
      { en:"thanks for helping",kanji:"手伝ってくれてありがとう",kana:"てつだってくれてありがとう",hint:"You cleaned the room. ___________",          tiles:["Thanks","for","helping","."],                                                answer:"Thanks for helping ." },
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
      { en:"What",  kanji:"何",       kana:"なに",       trans:"%%何%%というお名前ですか。",             hint:"_____ is your name?",        tiles:["What","is","your","name","?"],          answer:"What is your name ?" },
      { en:"Where", kanji:"どこ",     kana:"どこ",       trans:"図書館は%%どこ%%ですか。",               hint:"_____ is the library?",       tiles:["Where","is","the","library","?"],       answer:"Where is the library ?" },
      { en:"When",  kanji:"いつ",     kana:"いつ",       trans:"あなたのたんじょう日は%%いつ%%ですか。",   hint:"_____ is your birthday?",     tiles:["When","is","your","birthday","?"],      answer:"When is your birthday ?" },
      { en:"Who",   kanji:"だれ",     kana:"だれ",       trans:"あなたの先生は%%だれ%%ですか。",           hint:"_____ is your teacher?",      tiles:["Who","is","your","teacher","?"],        answer:"Who is your teacher ?" },
      { en:"Why",   kanji:"なぜ",     kana:"なぜ",       trans:"%%なぜ%%英語を勉強するのですか。",         hint:"_____ do you study English?", tiles:["Why","do","you","study","English","?"],answer:"Why do you study English ?" },
      { en:"How",   kanji:"どうやって",kana:"どうやって", trans:"%%どうやって%%学校に行きますか。",        hint:"_____ do you go to school?",  tiles:["How","do","you","go","to","school","?"],answer:"How do you go to school ?" },
      { en:"Which", kanji:"どれ",     kana:"どれ",       trans:"%%どれ%%があなたのかばんですか。",         hint:"_____ bag is yours?",          tiles:["Which","bag","is","yours","?"],         answer:"Which bag is yours ?" },
      { en:"Whose", kanji:"だれの",   kana:"だれの",     trans:"これは%%だれの%%本ですか。",               hint:"_____ book is this?",          tiles:["Whose","book","is","this","?"],         answer:"Whose book is this ?" },
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
      { en:"about", kanji:"〜について",     kana:"について",    trans:"%%あなたはどうですか%%、レイチェル？テニスは好きですか？",  hint:"What _____ you, Rachel? Do you like tennis?",     tiles:["What","about","you","Rachel","?","Do","you","like","tennis","?"], answer:"What about you Rachel ? Do you like tennis ?" },
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
      { en:"What color",   kanji:"何色",         kana:"なにいろ",        hint:"_____ do you like? I like blue.",          tiles:["What","color","do","you","like","?"],       answer:"What color do you like ?" },
      { en:"What time",    kanji:"何時",         kana:"なんじ",          hint:"_____ is it now? It's 3:25.",              tiles:["What","time","is","it","now","?"],          answer:"What time is it now ?" },
      { en:"What day",     kanji:"何曜日",       kana:"なんようび",      hint:"_____ is it today? It's Monday.",          tiles:["What","day","is","it","today","?"],         answer:"What day is it today ?" },
      { en:"What subject", kanji:"何の科目",     kana:"なんのかもく",    hint:"_____ do you like? I like P.E.",           tiles:["What","subject","do","you","like","?"],     answer:"What subject do you like ?" },
      { en:"What sport",   kanji:"何のスポーツ", kana:"なんのスポーツ",  hint:"_____ do you play? I play soccer.",        tiles:["What","sport","do","you","play","?"],       answer:"What sport do you play ?" },
      { en:"What season",  kanji:"何の季節",     kana:"なんのきせつ",    hint:"_____ do you like? I like summer.",        tiles:["What","season","do","you","like","?"],      answer:"What season do you like ?" },
      { en:"What food",    kanji:"何の食べ物",   kana:"なんのたべもの",  hint:"_____ do you like? I like sushi.",         tiles:["What","food","do","you","like","?"],        answer:"What food do you like ?" },
    ],
  },
  {
    id: "how_questions", title: "How ___? Questions / どんな〜？", emoji: "🟢",
    color: "#10b981", shadow: "#065f46",
    words: [
      { en:"How many",  kanji:"いくつ",              kana:"いくつ",              hint:"_____ rooms are there? Four.",                tiles:["How","many","rooms","are","there","?"],    answer:"How many rooms are there ?" },
      { en:"How much",  kanji:"いくら",              kana:"いくら",              hint:"_____ is this ruler? 150 yen.",               tiles:["How","much","is","this","ruler","?"],      answer:"How much is this ruler ?" },
      { en:"How long",  kanji:"どのくらい",          kana:"どのくらい",          hint:"_____ does it take? Thirty minutes.",         tiles:["How","long","does","it","take","?"],       answer:"How long does it take ?" },
      { en:"How about", kanji:"〜はどうですか",      kana:"〜はどうですか",      hint:"_____ sandwiches? Sure!",                     tiles:["How","about","sandwiches","?"],            answer:"How about sandwiches ?" },
      { en:"How old",   kanji:"何歳",               kana:"なんさい",            hint:"_____ is your father? He is forty.",          tiles:["How","old","is","your","father","?"],      answer:"How old is your father ?" },
      { en:"How tall",  kanji:"身長はどのくらい",    kana:"しんちょうはどのくらい",hint:"_____ are you? I am 130 cm tall.",          tiles:["How","tall","are","you","?"],              answer:"How tall are you ?" },
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
.hdr-back  { background:#fff; border:2.5px solid #02020b; border-radius:10px; width:40px; height:40px; display:flex; align-items:center; justify-content:center; font-size:19px; font-weight:900; cursor:pointer; color:#02020b; flex-shrink:0; box-shadow:0 2px 0 #02020b; transition:transform .1s; }
.hdr-back:active { transform:translateY(2px); box-shadow:none; }
.hdr-logout { background:#f97316; border:none; border-radius:10px; color:#fff; font-size:12px; font-weight:800; padding:8px 14px; cursor:pointer; font-family:'Inter',sans-serif; box-shadow:0 3px 0 #c2410c; flex-shrink:0; transition:transform .1s; }
.hdr-logout:active { transform:translateY(2px); box-shadow:none; }
.hdr-fullscreen { background:rgba(255,255,255,.25); border:none; border-radius:10px; width:38px; height:38px; display:flex; align-items:center; justify-content:center; font-size:18px; cursor:pointer; color:#fff; flex-shrink:0; margin-right:10px; transition:background .12s; }
.hdr-fullscreen:hover { background:rgba(255,255,255,.4); }
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
  const [dialogueProgress, setDialogueProgress] = useState(() => { try { return JSON.parse(localStorage.getItem(DIALOGUE_PROGRESS_KEY)) || {}; } catch { return {}; }});
  const [dialogueNotesSeen, setDialogueNotesSeen] = useState(() => { try { return JSON.parse(localStorage.getItem(DIALOGUE_NOTES_SEEN_KEY)) || {}; } catch { return {}; }});
  const [missedWords,    setMissedWords]    = useState(() => { try { return JSON.parse(localStorage.getItem(MISSED_WORDS_KEY)) || {}; } catch { return {}; }});

  const [screen,         setScreen]         = useState(currentProfile ? "dashboard" : "login");
  const [activeCategory, setActiveCategory] = useState(null);
  const [isFullscreen,   setIsFullscreen]   = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
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

  // Track which words a student has ever missed in a category, per attempt:
  // words missed this attempt are added, words gotten right first-try are cleared (mastered).
  const updateMissedWords = (catId, results) => {
    const key = `${currentProfile.id}_${catId}`;
    const missedNow = new Set(results.missed.map(m => m.word.en));
    const prevSet = new Set(missedWords[key] || []);
    results.words.forEach(w => {
      if (missedNow.has(w.en)) prevSet.add(w.en);
      else prevSet.delete(w.en);
    });
    const next = { ...missedWords, [key]: [...prevSet] };
    setMissedWords(next);
    localStorage.setItem(MISSED_WORDS_KEY, JSON.stringify(next));
  };
  const getMissedWords = catId => missedWords[`${currentProfile?.id}_${catId}`] || [];

  const markDialogueSetDone = (topicId, setKey, score, total) => {
    const key  = `${currentProfile.id}_${topicId}_${setKey}`;
    const prevBest = dialogueProgress[key]?.score ?? -1;
    const next = { ...dialogueProgress, [key]: { done:true, score: score != null ? Math.max(prevBest, score) : null, total } };
    setDialogueProgress(next);
    localStorage.setItem(DIALOGUE_PROGRESS_KEY, JSON.stringify(next));
  };
  const getDialogueSetProgress = (topicId, setKey) => dialogueProgress[`${currentProfile?.id}_${topicId}_${setKey}`] || null;

  const markNotesSeen = (topicId) => {
    const key = `${currentProfile.id}_${topicId}`;
    const next = { ...dialogueNotesSeen, [key]: true };
    setDialogueNotesSeen(next);
    localStorage.setItem(DIALOGUE_NOTES_SEEN_KEY, JSON.stringify(next));
  };
  const notesSeen = (topicId) => !!dialogueNotesSeen[`${currentProfile?.id}_${topicId}`];

  // Compute categories once based on current level — used throughout render
  const categories = getCategoriesByLevel(currentProfile?.level || "5");

  const [dialogueTopic,    setDialogueTopic]    = useState(null);
  const [dialoguePractice, setDialoguePractice] = useState(null); // "practice1"|"practice2"|"practice3"|"quiz"

  const [grammarPartProgress, setGrammarPartProgress] = useState(() => { try { return JSON.parse(localStorage.getItem(GRAMMAR_PART_PROGRESS_KEY)) || {}; } catch { return {}; }});
  const [grammarFinalProgress, setGrammarFinalProgress] = useState(() => { try { return JSON.parse(localStorage.getItem(GRAMMAR_FINAL_PROGRESS_KEY)) || {}; } catch { return {}; }});
  const [grammarTopic, setGrammarTopic] = useState(null);
  const [grammarPart,  setGrammarPart]  = useState(null);
  const [grammarFinalResults, setGrammarFinalResults] = useState(null);

  const markGrammarPartDone = (partId) => {
    const key = `${currentProfile.id}_${partId}`;
    const next = { ...grammarPartProgress, [key]: true };
    setGrammarPartProgress(next);
    localStorage.setItem(GRAMMAR_PART_PROGRESS_KEY, JSON.stringify(next));
  };
  const getGrammarPartDone = (partId) => !!grammarPartProgress[`${currentProfile?.id}_${partId}`];
  const markGrammarFinalDone = (topicId, score, total) => {
    const key = `${currentProfile.id}_${topicId}`;
    const prevBest = grammarFinalProgress[key]?.score ?? -1;
    const next = { ...grammarFinalProgress, [key]: { score: Math.max(prevBest, score), total } };
    setGrammarFinalProgress(next);
    localStorage.setItem(GRAMMAR_FINAL_PROGRESS_KEY, JSON.stringify(next));
  };
  const getGrammarFinalProgress = (topicId) => grammarFinalProgress[`${currentProfile?.id}_${topicId}`] || null;

  const goBack = () => {
    if (screen === "dialogue_notes")    { setScreen("dialogue_topic"); setDialoguePractice(null); return; }
    if (screen === "dialogue_practice") { setScreen("dialogue_topic"); setDialoguePractice(null); return; }
    if (screen === "dialogue_topic")    { setScreen("dialogue_home"); setDialogueTopic(null); return; }
    if (screen === "dialogue_home")     { setScreen("dashboard"); return; }
    if (screen === "grammar_part")           { setScreen("grammar_topic"); setGrammarPart(null); return; }
    if (screen === "grammar_overview")       { setScreen("grammar_topic"); return; }
    if (screen === "grammar_final")          { setScreen("grammar_topic"); return; }
    if (screen === "grammar_final_results")  { setScreen("grammar_topic"); setGrammarFinalResults(null); return; }
    if (screen === "grammar_topic")          { setScreen("grammar_home"); setGrammarTopic(null); return; }
    if (screen === "grammar_home")           { setScreen("dashboard"); return; }
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
    dialogue_home: "Dialogue Tests",
    dialogue_topic: dialogueTopic?.title || "Dialogue Tests",
    dialogue_notes: dialogueTopic?.title ? `${dialogueTopic.title} · Notes` : "Dialogue Tests",
    dialogue_practice: dialogueTopic?.title || "Dialogue Tests",
    grammar_home: "Grammar",
    grammar_topic: grammarTopic?.title || "Grammar",
    grammar_part: grammarPart ? `${grammarPart.short}. ${grammarPart.title}` : "Grammar",
    grammar_overview: "Overview",
    grammar_final: "Final Practice Test",
    grammar_final_results: "Results",
  }[screen] || "Eiken English Training";

  // Screens that use the two-column layout (sidebar + main)
  const twoCol = ["dashboard","vocab_list","vocab_study","vocab_game","vocab_results","vocab_review"].includes(screen);
  // Dialogue and Grammar screens use full-width single column
  const isDialogueScreen = ["dialogue_home","dialogue_topic","dialogue_notes","dialogue_practice"].includes(screen);
  const isGrammarScreen = ["grammar_home","grammar_topic","grammar_part","grammar_overview","grammar_final","grammar_final_results"].includes(screen);

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
          <button type="button" className="hdr-fullscreen" onClick={toggleFullscreen} title={isFullscreen ? "Exit full screen" : "Full screen"}>
            {isFullscreen ? "⤦" : "⛶"}
          </button>
          {screen !== "login" && currentProfile && (
            <button type="button" className="hdr-logout" onClick={logout}>
              Log out
            </button>
          )}
        </div>

        {screen === "login" && (
          <LoginScreen profiles={profiles} onLogin={login}
            onNewProfile={p => { saveProfiles([...profiles, p]); login(p); }} />
        )}

        {/* Dialogue screens — full-width scrollable */}
        {isDialogueScreen && currentProfile && (
          <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
            {screen === "dialogue_home" && (
              <DialogueHomeScreen onSelect={topic => { setDialogueTopic(topic); setScreen("dialogue_topic"); }} onBack={goBack} level={currentProfile?.level || "5"} getSetProgress={getDialogueSetProgress} />
            )}
            {screen === "dialogue_topic" && dialogueTopic && (
              <DialogueTopicScreen topic={dialogueTopic} onSelect={key => {
                setDialoguePractice(key);
                if (key === "practice1" && DIALOGUE_NOTES[dialogueTopic.id] && !notesSeen(dialogueTopic.id)) {
                  setScreen("dialogue_notes");
                } else {
                  setScreen("dialogue_practice");
                }
              }} onBack={goBack} getSetProgress={getDialogueSetProgress} />
            )}
            {screen === "dialogue_notes" && dialogueTopic && (
              <DialogueNotesScreen topic={dialogueTopic}
                onContinue={() => { markNotesSeen(dialogueTopic.id); setScreen("dialogue_practice"); }} />
            )}
            {screen === "dialogue_practice" && dialogueTopic && dialoguePractice && (
              <DialoguePracticeScreen key={dialogueTopic.id + dialoguePractice} topic={dialogueTopic} setKey={dialoguePractice} onBack={() => { setScreen("dialogue_topic"); setDialoguePractice(null); }}
                onComplete={(score, total) => markDialogueSetDone(dialogueTopic.id, dialoguePractice, score, total)} />
            )}
          </div>
        )}

        {/* Grammar screens — full-width scrollable */}
        {isGrammarScreen && currentProfile && (
          <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
            {screen === "grammar_home" && (
              <GrammarHomeScreen level={currentProfile?.level || "5"} onBack={goBack}
                onSelect={topic => { setGrammarTopic(topic); setScreen("grammar_topic"); }} />
            )}
            {screen === "grammar_topic" && grammarTopic && (
              <GrammarTopicScreen topic={grammarTopic}
                getPartDone={getGrammarPartDone}
                getFinalProgress={() => getGrammarFinalProgress(grammarTopic.id)}
                onSelectPart={part => { setGrammarPart(part); setScreen("grammar_part"); }}
                onSelectOverview={() => setScreen("grammar_overview")}
                onSelectFinal={() => setScreen("grammar_final")} />
            )}
            {screen === "grammar_part" && grammarPart && (
              <GrammarPartScreen key={grammarPart.id} part={grammarPart}
                onDone={() => { markGrammarPartDone(grammarPart.id); setScreen("grammar_topic"); setGrammarPart(null); }}
                onBack={goBack} />
            )}
            {screen === "grammar_overview" && (
              <GrammarOverviewScreen onContinue={() => setScreen("grammar_topic")} />
            )}
            {screen === "grammar_final" && grammarTopic && (
              <GrammarFinalTestScreen
                onComplete={(score, total, answers) => {
                  markGrammarFinalDone(grammarTopic.id, score, total);
                  setGrammarFinalResults({ score, total, answers });
                  setScreen("grammar_final_results");
                }}
                onBack={goBack} />
            )}
            {screen === "grammar_final_results" && grammarFinalResults && (
              <GrammarFinalResultsScreen {...grammarFinalResults}
                onBack={() => { setScreen("grammar_topic"); setGrammarFinalResults(null); }}
                onRetry={() => setScreen("grammar_final")} />
            )}
          </div>
        )}

        {/* Two-column body for all logged-in screens */}
        {twoCol && currentProfile && (
          <div className="body-wrap">
            {/* Left sidebar */}
            <div className="sidebar">
              {screen === "dashboard" && (() => {
                const vocabDone = categories.filter(c => getCatProgress(c.id) >= 70).length;
                const vocabStarted = categories.filter(c => getCatProgress(c.id) > 0);
                const dTopics = DIALOGUE_TOPICS.filter(t => t.level === (currentProfile?.level || "5"));
                const dSetsAll = dTopics.flatMap(t => {
                  const keys = ["practice1","practice2","practice3", ...(DIALOGUE_TESTS[t.id]?.quiz ? ["quiz"] : [])];
                  return keys.map(k => ({ topic:t, key:k, prog:getDialogueSetProgress(t.id, k) }));
                });
                const dDone = dSetsAll.filter(s => s.prog?.done).length;
                const gTopics = GRAMMAR_TOPICS.filter(t => t.level === (currentProfile?.level || "5"));
                const gPartsDone = gTopics.length ? PRONOUN_PARTS.filter(p => getGrammarPartDone(p.id)).length : 0;

                const cellStyle = { padding:"4px 5px", fontSize:10, textAlign:"center", borderTop:"1px solid #f1f5f9" };
                const headStyle = { padding:"5px", fontSize:9, fontWeight:800, color:"#fff", textAlign:"center", textTransform:"uppercase" };

                return (
                  <>
                    <div className="sidebar-title">Progress Report</div>

                    {/* ── Vocabulary table ── */}
                    <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:"#D36135",marginBottom:6}}>
                      📖 Vocabulary — {vocabDone}/{categories.length}
                    </div>
                    {vocabStarted.length === 0 ? (
                      <div style={{fontSize:11,color:"#a0aec0",marginBottom:16}}>No categories started yet.</div>
                    ) : (
                      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16,tableLayout:"fixed"}}>
                        <thead>
                          <tr style={{background:"#D36135"}}>
                            <th style={{...headStyle,textAlign:"left",width:"66%"}}>Category</th>
                            <th style={headStyle}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vocabStarted.map(cat => {
                            const pct = getCatProgress(cat.id);
                            const sc = scoreColor(pct);
                            return (
                              <tr key={cat.id} style={{background:sc.bg}}>
                                <td style={{...cellStyle,textAlign:"left",color:"#4a5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.title}</td>
                                <td style={{...cellStyle,color:sc.text,fontWeight:800}}>{pct}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {/* ── Dialogue table ── */}
                    <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:"#7c3aed",marginBottom:6}}>
                      💬 Dialogue — {dDone}/{dSetsAll.length}
                    </div>
                    {dTopics.length === 0 ? (
                      <div style={{fontSize:11,color:"#a0aec0",marginBottom:16}}>No topics yet for this level.</div>
                    ) : (
                      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16,tableLayout:"fixed"}}>
                        <thead>
                          <tr style={{background:"#7c3aed"}}>
                            <th style={{...headStyle,textAlign:"left",width:"40%"}}>Topic</th>
                            <th style={headStyle}>P1</th>
                            <th style={headStyle}>P2</th>
                            <th style={headStyle}>P3</th>
                            <th style={headStyle}>Q</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dTopics.map(topic => {
                            const hasQuiz = !!DIALOGUE_TESTS[topic.id]?.quiz;
                            const p1 = getDialogueSetProgress(topic.id,"practice1");
                            const p2 = getDialogueSetProgress(topic.id,"practice2");
                            const p3 = getDialogueSetProgress(topic.id,"practice3");
                            const qz = hasQuiz ? getDialogueSetProgress(topic.id,"quiz") : null;
                            const allDone = p1?.done && p2?.done && p3?.done && (!hasQuiz || qz?.done);
                            return (
                              <tr key={topic.id} style={{background:allDone?"#dcfce7":"#fff"}}>
                                <td style={{...cellStyle,textAlign:"left",color:"#4a5568",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{topic.title}</td>
                                <td style={{...cellStyle,color:p1?.done?"#15803d":"#cbd5e0"}}>{p1?.done?"✓":"—"}</td>
                                <td style={{...cellStyle,color:p2?.done?"#15803d":"#cbd5e0"}}>{p2?.done?"✓":"—"}</td>
                                <td style={{...cellStyle,color:p3?.done?"#15803d":"#cbd5e0"}}>{p3?.done?"✓":"—"}</td>
                                <td style={{...cellStyle,color:qz?.done?"#15803d":"#cbd5e0",fontWeight:qz?.done?800:400}}>
                                  {!hasQuiz ? "—" : qz?.done ? `${qz.score}/${qz.total}` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {/* ── Grammar table ── */}
                    <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:13,color:"#7c3aed",marginBottom:6}}>
                      ✏️ Grammar{gTopics.length ? ` — ${gPartsDone}/${PRONOUN_PARTS.length} parts` : ""}
                    </div>
                    {gTopics.length === 0 ? (
                      <div style={{fontSize:11,color:"#a0aec0"}}>No topics yet for this level.</div>
                    ) : (
                      <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
                        <thead>
                          <tr style={{background:"#7c3aed"}}>
                            <th style={{...headStyle,textAlign:"left",width:"34%"}}>Topic</th>
                            {PRONOUN_PARTS.map(p => <th key={p.id} style={headStyle}>{p.short}</th>)}
                            <th style={headStyle}>Final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gTopics.map(topic => {
                            const gFinal = getGrammarFinalProgress(topic.id);
                            const allDone = gPartsDone === PRONOUN_PARTS.length;
                            return (
                              <tr key={topic.id} style={{background:allDone?"#dcfce7":"#fff"}}>
                                <td style={{...cellStyle,textAlign:"left",color:"#4a5568",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{topic.title.split(" /")[0]}</td>
                                {PRONOUN_PARTS.map(p => {
                                  const done = getGrammarPartDone(p.id);
                                  return <td key={p.id} style={{...cellStyle,color:done?"#15803d":"#cbd5e0"}}>{done?"✓":"—"}</td>;
                                })}
                                <td style={{...cellStyle,color:gFinal?"#15803d":"#cbd5e0",fontWeight:gFinal?800:400}}>
                                  {gFinal ? `${gFinal.score}/${gFinal.total}` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </>
                );
              })()}
              {screen === "vocab_list" && (() => {
                const catsWithMissed = categories
                  .map(cat => ({ cat, words: cat.words.filter(w => getMissedWords(cat.id).includes(w.en)) }))
                  .filter(g => g.words.length > 0);
                const totalMissed = catsWithMissed.reduce((n,g) => n + g.words.length, 0);
                return (
                  <>
                    <div className="sidebar-title">📝 Review Missed Words</div>
                    {totalMissed === 0 ? (
                      <div style={{fontSize:12,color:"#a0aec0",lineHeight:1.6,padding:"6px 2px"}}>
                        No missed words yet! Finish a quiz and any words you get wrong will show up here so you can review them.
                      </div>
                    ) : (
                      <>
                        <div style={{fontSize:12,color:"#a0aec0",marginBottom:12}}>{totalMissed} word{totalMissed!==1?"s":""} to review — tap 🔈 to hear</div>
                        {catsWithMissed.map(({cat, words}) => (
                          <div key={cat.id} style={{marginBottom:14}}>
                            <button type="button" onClick={() => { setActiveCategory(cat); setScreen("vocab_study"); }}
                              style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"2px 0",marginBottom:4,textAlign:"left"}}>
                              <span style={{fontSize:14}}>{cat.emoji}</span>
                              <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:12,color:cat.color}}>{cat.title}</span>
                              <span style={{fontSize:11,color:"#cbd5e0",marginLeft:"auto"}}>→</span>
                            </button>
                            {words.map(w => (
                              <div key={w.en} className="wl-row" style={{paddingLeft:8}}>
                                <div style={{flex:1}}>
                                  <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:13,color:"#02020b"}}>{w.en}</div>
                                  <div style={{fontSize:11,color:"#a0aec0"}}>{w.kanji}</div>
                                </div>
                                <SpeakBtn text={w.en} size={24} />
                              </div>
                            ))}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
              {(screen === "vocab_study" || screen === "vocab_game" || screen === "vocab_results" || screen === "vocab_review") && activeCategory && (() => {
                const missedEn = getMissedWords(activeCategory.id);
                const missedList = activeCategory.words.filter(w => missedEn.includes(w.en));
                return (
                  <>
                    <div className="sidebar-title" style={{color:activeCategory.color}}>{activeCategory.title}</div>
                    <div style={{fontSize:12,color:"#a0aec0",marginBottom:10}}>❌ Words you've missed — tap 🔈 to hear</div>
                    {missedList.length === 0 ? (
                      <div style={{fontSize:12,color:"#a0aec0",lineHeight:1.6,padding:"6px 2px"}}>
                        {getCatProgress(activeCategory.id) > 0
                          ? "🎉 No missed words right now — nice work!"
                          : "Finish a quiz to see the words you need to practice here."}
                      </div>
                    ) : (
                      missedList.map((w, i) => (
                        <div key={w.en} className="wl-row">
                          <div className="wl-num" style={{color:activeCategory.color}}>{i+1}</div>
                          <div style={{flex:1}}>
                            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:13,color:"#02020b"}}>{w.en}</div>
                            {!w.isOrdinal && <div style={{fontSize:11,color:"#a0aec0"}}>{w.kanji}</div>}
                            {w.isOrdinal && <div style={{fontSize:12,color:activeCategory.color,fontWeight:700}}>{w.kanji}</div>}
                          </div>
                          <SpeakBtn text={w.en} size={26} />
                        </div>
                      ))
                    )}
                  </>
                );
              })()}
            </div>

            {/* Main content */}
            <div className="main">
              {screen === "dashboard" && (
                <DashboardScreen profile={currentProfile} onVocab={() => setScreen("vocab_list")}
                  onDialogue={() => setScreen("dialogue_home")}
                  onGrammar={() => setScreen("grammar_home")}
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
                    updateMissedWords(activeCategory.id, results);
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
function DashboardScreen({ profile, onVocab, onDialogue, onGrammar, categories, getCatProgress, onLevelChange }) {
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
        <button type="button" className="mod-card" onClick={onDialogue}>
          <div className="mod-icon" style={{background:"#f5f3ff"}}>💬</div>
          <div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:18,color:"#02020b"}}>Dialogue Tests</div>
            <div style={{fontSize:12,color:"#a0aec0",marginTop:3}}>{DIALOGUE_TOPICS.filter(t=>t.level===profile.level).length} topic · practice & quiz</div>
          </div>
          <span style={{marginLeft:"auto",fontSize:20,color:"#cbd5e0"}}>→</span>
        </button>
        <button type="button" className="mod-card" onClick={onGrammar}>
          <div className="mod-icon" style={{background:"#f0f4f8"}}>✏️</div>
          <div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:18,color:"#02020b"}}>Grammar</div>
            <div style={{fontSize:12,color:"#a0aec0",marginTop:3}}>{GRAMMAR_TOPICS.filter(t=>t.level===profile.level).length} topic · lessons & practice</div>
          </div>
          <span style={{marginLeft:"auto",fontSize:20,color:"#cbd5e0"}}>→</span>
        </button>
      </div>
    </div>
  );
}

/* Score → color tiers, used anywhere a percentage badge is shown */
function scoreColor(pct) {
  if (pct >= 85) return { bg:"#dcfce7", text:"#15803d", ring:"#22c55e" };
  if (pct >= 70) return { bg:"#ecfccb", text:"#4d7c0f", ring:"#84cc16" };
  if (pct >= 50) return { bg:"#ffedd5", text:"#c2410c", ring:"#f97316" };
  return { bg:"#fee2e2", text:"#b91c1c", ring:"#ef4444" };
}

/* Colored percentage badge — replaces a category's emoji once it has been attempted */
function ScoreCircle({ pct, size = 44 }) {
  const c = scoreColor(pct);
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:c.bg, border:`2.5px solid ${c.ring}`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Nunito',sans-serif", fontWeight:900, color:c.text,
      fontSize: size >= 40 ? 12.5 : 10.5, lineHeight:1,
    }}>
      {pct}%
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
              {pct > 0
                ? <ScoreCircle pct={pct} />
                : <span style={{fontSize:26,width:44,textAlign:"center",flexShrink:0}}>{cat.emoji}</span>}
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
  const isDialogueCat = ["dialogue_expressions","dialogue_expressions_2","g4_dialogue","g4_phrasal_1","g4_phrasal_2","g4_wh_questions","what_questions","how_questions","g3_phrasal_verbs_1","g3_phrasal_verbs_2","g3_prepositions_1","g3_prepositions_2","g3_connectors","g3_collocations","g3_grammar_patterns","g3_conversational_1","g3_conversational_2"].includes(category.id);
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
  const isDialogueCat = ["dialogue_expressions","dialogue_expressions_2","g4_dialogue","g4_phrasal_1","g4_phrasal_2","g4_wh_questions","what_questions","how_questions","g3_phrasal_verbs_1","g3_phrasal_verbs_2","g3_prepositions_1","g3_prepositions_2","g3_connectors","g3_collocations","g3_grammar_patterns","g3_conversational_1","g3_conversational_2"].includes(category.id);

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

/* ══════════════════════════════════════════════
   DIALOGUE GRAMMAR NOTES (shown once, before each topic's Practice 1)
══════════════════════════════════════════════ */

/* Highlighted keyword — color-codes the grammar signal word in an example */
function Hi({ color, children }) {
  return <span style={{ color, fontWeight: 900 }}>{children}</span>;
}

const NOTE_COLORS = { past:"#ef4444", future:"#3b82f6", reason:"#f97316", compare:"#16a34a", advice:"#db2777", invite:"#7c3aed", experience:"#0891b2", challenge:"#db2777", direction:"#65a30d", too:"#ef4444", enough:"#16a34a", purpose:"#7c3aed", request:"#2563eb" };

function NoteSection({ label, isNew, children }) {
  return (
    <div style={{
      background: isNew ? "#fffbeb" : "#f8fafc",
      border: `1.5px solid ${isNew ? "#fde68a" : "#e2e8f0"}`,
      borderRadius: 14, padding: "12px 14px", marginBottom: 10,
    }}>
      {label && (
        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:13, color: isNew ? "#b45309" : "#475569", marginBottom:6 }}>
          {label}
        </div>
      )}
      <div style={{ fontSize:13, color:"#374151", lineHeight:1.9 }}>{children}</div>
    </div>
  );
}

function NotesAtHome() {
  const c = NOTE_COLORS;
  return (
    <>
      <NoteSection label="おさらい (G5)">
        <div>もっと〜いる？ Do you want more…? → Yes, please. / No, thank you.</div>
        <div>〜してくれる？ Could you…? → Sure, no problem.</div>
        <div>どこ？ Where…? → 場所　｜　だれの？ Whose…? → 持ち主</div>
        <div>〜してね → All right, Mom.</div>
      </NoteSection>
      <NoteSection label="🆕 過去のこと (Past)" isNew>
        <div>質問が <Hi color={c.past}>did</Hi> / <Hi color={c.past}>~ed</Hi> なら、答えも過去形に。</div>
        <div>What <Hi color={c.past}>did</Hi> you eat? → I <Hi color={c.past}>ate</Hi> a sandwich.（✕ I eat　✕ I will eat）</div>
      </NoteSection>
      <NoteSection label="🆕 これからのこと (Future)" isNew>
        <div>明日・これからは <Hi color={c.future}>be going to</Hi>。</div>
        <div>What are you <Hi color={c.future}>going to</Hi> do? → I'm <Hi color={c.future}>going to</Hi> do my homework.</div>
      </NoteSection>
      <NoteSection>
        <div>💡 なぜ？ <Hi color={c.reason}>Why…?</Hi> → <Hi color={c.reason}>Because</Hi> で理由を答える。</div>
        <div>💡 さくせん: 答えが空所の後ろにあることも！ 後の文をヒントにしよう。</div>
      </NoteSection>
    </>
  );
}

function NotesAtSchool() {
  const c = NOTE_COLORS;
  return (
    <>
      <NoteSection label="おさらい">
        <div>過去は<Hi color={c.past}>過去</Hi>で答える／未来は<Hi color={c.future}>going to</Hi>／<Hi color={c.reason}>Why → Because</Hi>（At Homeで習ったよ）。</div>
      </NoteSection>
      <NoteSection label="とくべつ">
        <div>借りてもいい？ Can I borrow…? → Sure, here you are.</div>
        <div>はじめての先生に → Nice to meet you.</div>
      </NoteSection>
      <NoteSection label="🆕 どうだった？ (Follow-up)" isNew>
        <div>「〜した」に感想をきく。</div>
        <div>I took the test. → <Hi color={c.past}>How was it?</Hi></div>
      </NoteSection>
      <NoteSection label="🆕 くらべる (Comparative)" isNew>
        <div>Which is <Hi color={c.compare}>harder</Hi>, A or B? → A is <Hi color={c.compare}>harder</Hi>.（-er / more ~）</div>
      </NoteSection>
      <NoteSection label="🆕 〜したほうがいいよ (Advice)" isNew>
        <div>You <Hi color={c.advice}>should</Hi> get some rest. 思いやりのアドバイス。</div>
      </NoteSection>
    </>
  );
}

function NotesWithFriends() {
  const c = NOTE_COLORS;
  return (
    <>
      <NoteSection label="おさらい">
        <div>過去／未来 <Hi color={c.future}>going to</Hi>／<Hi color={c.past}>How was it?</Hi>／くらべる comparative。</div>
      </NoteSection>
      <NoteSection label="🆕 さそう (Invitations)" isNew>
        <div><Hi color={c.invite}>Let's…!</Hi> → Yes, let's! / That's a good idea!</div>
        <div><Hi color={c.invite}>Would you like to…?</Hi> → Yes, I'd love to.</div>
        <div><Hi color={c.invite}>Why don't we…?</Hi> → Good idea.</div>
      </NoteSection>
      <NoteSection label="🆕 あなたは？" isNew>
        <div><Hi color={c.invite}>How about you?</Hi> → 自分のことを答える。</div>
      </NoteSection>
      <NoteSection label="🆕 ざんねん" isNew>
        <div><Hi color={c.advice}>That's too bad.</Hi> → 相手のこまった出来事に思いやりを。</div>
      </NoteSection>
      <NoteSection>
        <div>おさらい: ほめられたら → Thanks!</div>
      </NoteSection>
    </>
  );
}

/* Simple 2/3-column table for note pages */
function MiniTable({ cols, rows }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols}, 1fr)`, border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden", marginBottom:4 }}>
      {rows.map((row, ri) => row.map((cell, ci) => (
        <div key={`${ri}-${ci}`} style={{
          padding:"6px 9px", fontSize:12.5, lineHeight:1.5,
          background: ri === 0 ? "#f1f5f9" : "#fff",
          fontWeight: ri === 0 ? 800 : 500,
          color: ri === 0 ? "#475569" : "#374151",
          borderTop: ri === 0 ? "none" : "1px solid #f1f5f9",
          borderRight: ci < cols - 1 ? "1px solid #f1f5f9" : "none",
        }}>
          {cell}
        </div>
      )))}
    </div>
  );
}

/* Example bubble showing a wrong (✗) vs right (✓) answer pair */
function ExampleWarning({ q, wrong, right }) {
  return (
    <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"8px 12px", marginTop:6 }}>
      <div style={{ fontSize:12, color:"#991b1b", marginBottom:4 }}>👩 {q}</div>
      <div style={{ fontSize:12, color:"#b91c1c" }}>✗ {wrong}</div>
      <div style={{ fontSize:12, color:"#15803d", fontWeight:700 }}>✓ {right}</div>
    </div>
  );
}

function NotesGrade5Page1() {
  return (
    <>
      <NoteSection label="🔍 しつもんの言葉" isNew>
        <div style={{ marginBottom:6, fontWeight:700 }}>最初の言葉を見よう！</div>
        <MiniTable cols={3} rows={[
          ["言葉","答え方","例"],
          ["What","もの・こと","I like soccer."],
          ["Where","ばしょ","At the park."],
          ["When","じかん・日にち","At six. / June 10th."],
          ["Who","人","She's Ms. Green."],
          ["Whose","だれのもの","It's mine."],
          ["How","やり方","By train."],
        ]} />
        <div style={{ marginTop:8, fontSize:12, color:"#92400e" }}>⚠️ 同じ言葉があってもだまされないで！</div>
        <ExampleWarning q="Where are my shoes?" wrong="I like shoes." right="They're by the door." />
      </NoteSection>
    </>
  );
}

function NotesGrade5Page2() {
  return (
    <>
      <NoteSection label="💬 答え方" isNew>
        <div style={{ marginBottom:6, fontWeight:700 }}>この返事をおぼえよう！</div>
        <MiniTable cols={2} rows={[
          ["このとき","答え方"],
          ["Let's ~! （〜しよう！）","Yes, let's! / That's a good idea!"],
          ["Can I ~? （〜してもいい？）","Of course."],
          ["Please ~. （〜してください）","All right! / I'm sorry."],
          ["ほめられたとき （When praised）","Thanks, ○○!"],
          ["What are you doing? （今何してる？）","I'm + ~ing."],
        ]} />
        <div style={{ marginTop:8, fontSize:12, color:"#92400e" }}>⚠️「I'm + ~ing」に気をつけよう！</div>
        <ExampleWarning q="What are you doing?" wrong="I do homework." right="I'm doing my homework." />
      </NoteSection>
      <NoteSection>
        <div>さあ、始めよう！ 🎉</div>
      </NoteSection>
    </>
  );
}
const NotesGrade5Pages = [NotesGrade5Page1, NotesGrade5Page2];

function NotesG3Travel() {
  const c = NOTE_COLORS;
  return (
    <>
      <NoteSection label="🆕 けいけん (Experience)" isNew>
        <div><Hi color={c.experience}>Have you ever been to ～?</Hi> = 「～に行ったことある？」</div>
        <div>答え方 → Yes, I have. / No, I haven't. / No, never.</div>
        <div style={{marginTop:4,fontStyle:"italic"}}>例: Have you ever been to Kyoto? 「京都に行ったことある？」</div>
      </NoteSection>
      <NoteSection label="🆕 さそう言い方 (Suggesting)" isNew>
        <div><Hi color={c.invite}>Why don't we ～?</Hi> / <Hi color={c.invite}>Shall we ～?</Hi> / <Hi color={c.invite}>How about ～ing?</Hi> = 「～しない？」</div>
        <div>さんせいの返事 → That sounds great! / Sounds good! / I was thinking the same thing.</div>
      </NoteSection>
      <NoteSection label="🆕 look forward to ～ing" isNew>
        <div><Hi color={c.challenge}>look forward to ～ing</Hi> = 「～を楽しみにする」（to のあとは動詞に <Hi color={c.challenge}>ing</Hi>！）</div>
        <ExampleWarning q="I'm looking forward to..." wrong="I'm looking forward to go." right="I'm looking forward to going." />
      </NoteSection>
      <NoteSection>
        <div>💡 コツ: 答えのヒントは、空所（　）の「次の行」にあることが多いよ！</div>
      </NoteSection>
    </>
  );
}

function NotesG3Directions() {
  const c = NOTE_COLORS;
  return (
    <>
      <NoteSection label="🆕 道をたずねる (Asking directions)" isNew>
        <div><Hi color={c.direction}>How can I get to ～?</Hi> / <Hi color={c.direction}>Which bus goes to ～?</Hi> = 「～へはどう行けばいい？」</div>
      </NoteSection>
      <NoteSection label="🆕 道を教える (Giving directions)" isNew>
        <div><Hi color={c.direction}>Go straight.</Hi> / <Hi color={c.direction}>Turn left (right).</Hi> / <Hi color={c.direction}>It's next to ～.</Hi></div>
      </NoteSection>
      <NoteSection label="🆕 too ～ to …" isNew>
        <div><Hi color={c.too}>too ～ to …</Hi> = 「～すぎて…できない」</div>
        <div style={{marginTop:4,fontStyle:"italic"}}>It's too far to walk.（歩くには遠すぎる）</div>
      </NoteSection>
      <NoteSection label="🆕 ～ enough to …" isNew>
        <div><Hi color={c.enough}>～ enough to …</Hi> = 「…するのに十分～」</div>
        <div style={{marginTop:4,fontStyle:"italic"}}>It's close enough to walk.（歩けるくらい近い）</div>
      </NoteSection>
      <NoteSection label="🆕 to + 動詞（目的）" isNew>
        <div><Hi color={c.purpose}>to + 動詞</Hi> = 「～するために」</div>
        <div style={{marginTop:4,fontStyle:"italic"}}>I went early to get a seat.（せきをとるために早く行った）</div>
      </NoteSection>
      <NoteSection>
        <div>🔁 リマインド: 理由・結果は <Hi color={c.reason}>so</Hi>（だから）や <Hi color={c.reason}>because</Hi>。</div>
        <div style={{marginTop:4}}>💡 コツ: 空所の「次の行」がヒント。乗り物を選ぶ理由をさがそう。</div>
      </NoteSection>
    </>
  );
}

function NotesG3Family() {
  const c = NOTE_COLORS;
  return (
    <>
      <NoteSection label="🆕 たのむ (Requests)" isNew>
        <div><Hi color={c.request}>Will you ～?</Hi> / <Hi color={c.request}>Can you ～?</Hi> / <Hi color={c.request}>Could you ～?</Hi> = 「～してくれる？」</div>
        <div style={{marginTop:4}}>→ 後ろは動詞の原形！</div>
      </NoteSection>
      <NoteSection label="🆕 すすめる (Suggesting / Offering)" isNew>
        <div><Hi color={c.invite}>Would you like ～?</Hi> / <Hi color={c.invite}>Shall I ～?</Hi> = 「～はいかが？／～しようか？」</div>
      </NoteSection>
      <NoteSection label="🆕 心配する (Showing concern)" isNew>
        <div><Hi color={c.reason}>What's the matter?</Hi> / <Hi color={c.reason}>What happened?</Hi> = 「どうしたの？」</div>
      </NoteSection>
      <NoteSection label="🆕 よばれた時の返事 (When called)" isNew>
        <div><Hi color={c.enough}>I'll be there in a minute.</Hi> / <Hi color={c.enough}>Just a minute.</Hi> = 「すぐ行くよ」</div>
      </NoteSection>
      <NoteSection label="🆕 finish / enjoy / stop + ～ing" isNew>
        <div><Hi color={c.challenge}>finish / enjoy / stop + ～ing</Hi> = 「～し終える／楽しむ／やめる」</div>
        <ExampleWarning q="I finished..." wrong="I finished to clean." right="I finished cleaning." />
      </NoteSection>
      <NoteSection>
        <div>💡 コツ: 空所の「次の行」がヒント。たのみ事か、心配か、さそいかを見わけよう。</div>
      </NoteSection>
    </>
  );
}

const DIALOGUE_NOTES = { at_home: NotesGrade5Pages, at_school: NotesGrade5Pages, with_friends: NotesGrade5Pages, g4_at_home: NotesAtHome, g4_at_school: NotesAtSchool, g4_with_friends: NotesWithFriends, g3_travel: NotesG3Travel, g3_directions: NotesG3Directions, g3_family: NotesG3Family };

function DialogueNotesScreen({ topic, onContinue }) {
  const notesEntry = DIALOGUE_NOTES[topic.id];
  const [pageIdx, setPageIdx] = useState(0);
  if (!notesEntry) return null;

  const pages = Array.isArray(notesEntry) ? notesEntry : [notesEntry];
  const isLastPage = pageIdx === pages.length - 1;
  const NoteBody = pages[pageIdx];

  return (
    <div className="fade" style={{ maxWidth:480, margin:"0 auto" }}>
      <div style={{ textAlign:"center", marginBottom:18, paddingTop:4 }}>
        <div style={{ fontSize:34, marginBottom:4 }}>📘</div>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:19, color:"#02020b" }}>
          まなびポイント — {topic.emoji} {topic.title}
        </div>
        <div style={{ fontSize:12, color:"#a0aec0", marginTop:2 }}>れんしゅうの前に読もう！</div>
        {pages.length > 1 && (
          <div style={{ fontSize:11, fontWeight:700, color:"#a78bfa", marginTop:6 }}>{pageIdx+1} / {pages.length}</div>
        )}
      </div>
      <NoteBody />
      <div style={{ display:"flex", gap:8, marginTop:6 }}>
        {pageIdx > 0 && (
          <button type="button" className="btn btn-gray" style={{ flex:"0 0 auto", width:"auto", padding:"15px 20px" }}
            onClick={() => setPageIdx(i => i - 1)}>
            ← Back
          </button>
        )}
        <button type="button" className="btn" style={{ flex:1, background:topic.color, boxShadow:`0 4px 0 ${topic.shadow}` }}
          onClick={() => isLastPage ? onContinue() : setPageIdx(i => i + 1)}>
          {isLastPage ? "わかった！れんしゅうを始める →" : "つぎへ →"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   DIALOGUE TEST SCREENS
══════════════════════════════════════════════ */

/* LINE-style topic list */
const SET_LABELS = { practice1:"P1", practice2:"P2", practice3:"P3", quiz:"Q" };

function DialogueHomeScreen({ onSelect, onBack, level, getSetProgress }) {
  const topics = DIALOGUE_TOPICS.filter(t => t.level === level);
  return (
    <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:24,paddingTop:8}}>
        <div style={{fontSize:40,marginBottom:6}}>💬</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,color:"#02020b"}}>Dialogue Tests</div>
        <div style={{fontSize:13,color:"#718096",marginTop:4}}>Choose a topic to practice</div>
      </div>

      {topics.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",color:"#a0aec0"}}>
          <div style={{fontSize:36,marginBottom:10}}>🚧</div>
          <div style={{fontSize:14}}>No topics yet for this level.<br/>Check back soon!</div>
        </div>
      ) : (
        <div style={{borderRadius:18,overflow:"hidden",boxShadow:"0 2px 14px rgba(0,0,0,.09)"}}>
          <div style={{background:"#7c3aed",padding:"10px 16px",fontSize:12,fontWeight:700,color:"#e9d5ff",letterSpacing:1}}>
            TOPICS
          </div>
          {topics.map((topic, i) => {
            const topicTests = DIALOGUE_TESTS[topic.id] || {};
            const setKeys = ["practice1","practice2","practice3", ...(topicTests.quiz ? ["quiz"] : [])];
            const doneSets = setKeys.filter(k => getSetProgress?.(topic.id, k)?.done);
            const allDone = doneSets.length === setKeys.length;
            return (
              <button key={topic.id} type="button" onClick={() => onSelect(topic)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:14,
                  padding:"16px 18px",background:allDone?"#f0fdf4":"#fff",border:"none",
                  borderTop: i===0 ? "none" : "1px solid #f0f0f0",
                  borderLeft: allDone ? "4px solid #22c55e" : "4px solid transparent",
                  cursor:"pointer",textAlign:"left",transition:"background .12s"}}
                onMouseEnter={e => e.currentTarget.style.background=allDone?"#dcfce7":"#f9f5ff"}
                onMouseLeave={e => e.currentTarget.style.background=allDone?"#f0fdf4":"#fff"}>
                <div style={{width:48,height:48,borderRadius:14,background:allDone?"#dcfce7":"#ede9fe",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
                  {topic.emoji}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:16,color:"#3b0764"}}>{topic.title}</div>
                    {allDone && <span style={{fontSize:14}}>✅</span>}
                  </div>
                  <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                    {setKeys.map(k => {
                      const prog = getSetProgress?.(topic.id, k);
                      const done = !!prog?.done;
                      const scoreLabel = k === "quiz" && done && prog.score != null
                        ? ` ${prog.score}/${prog.total} (${Math.round(prog.score/prog.total*100)}%)`
                        : done ? " ✓" : "";
                      return (
                        <span key={k} style={{fontSize:10,fontWeight:800,padding:"2px 7px",borderRadius:20,
                          background:done?"#dcfce7":"#f3f4f6",color:done?"#15803d":"#9ca3af"}}>
                          {SET_LABELS[k]}{scoreLabel}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <span style={{fontSize:18,color:allDone?"#4ade80":"#c4b5fd"}}>→</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Practice/Quiz selector for a topic */
function DialogueTopicScreen({ topic, onSelect, onBack, getSetProgress }) {
  const topicTests = DIALOGUE_TESTS[topic.id] || {};
  const countOf = key => topicTests[key]?.length || 7;
  const hasQuiz = !!topicTests.quiz;
  const accentBg = topic.color + "1a"; // topic color at ~10% opacity for card tint
  const sets = [
    { key:"practice1", label:"Practice 1", emoji:practiceEmoji(topic.level,"practice1"), sub:`${countOf("practice1")} questions · hints included`, color:topic.color, bg:accentBg },
    { key:"practice2", label:"Practice 2", emoji:practiceEmoji(topic.level,"practice2"), sub:`${countOf("practice2")} questions · hints included`, color:topic.color, bg:accentBg },
    { key:"practice3", label:"Practice 3", emoji:practiceEmoji(topic.level,"practice3"), sub:`${countOf("practice3")} questions · hints included`, color:topic.color, bg:accentBg },
    ...(hasQuiz ? [{ key:"quiz", label:"QUIZ", emoji:"🏆", sub:`${countOf("quiz")} questions · no hints · scored!`, color:"#d97706", bg:"#fef3c7" }] : []),
  ];
  return (
    <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
        <div style={{fontSize:36}}>{topic.emoji}</div>
        <div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:20,color:"#3b0764"}}>{topic.title}</div>
          <div style={{fontSize:13,color:"#a78bfa"}}>Choose a set to start</div>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {sets.map(s => {
          const prog = getSetProgress ? getSetProgress(topic.id, s.key) : null;
          const done = !!prog?.done;
          return (
            <button key={s.key} type="button" onClick={() => onSelect(s.key)}
              style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",
                borderRadius:16,border:`2px solid ${done ? "#86efac" : s.bg}`,background:done?"#f0fdf4":"#fff",
                cursor:"pointer",textAlign:"left",transition:"all .12s",boxShadow:"0 2px 8px rgba(0,0,0,.06)",position:"relative"}}
              onMouseEnter={e => { e.currentTarget.style.background=done?"#dcfce7":s.bg; }}
              onMouseLeave={e => { e.currentTarget.style.background=done?"#f0fdf4":"#fff"; }}>
              <div style={{width:50,height:50,borderRadius:14,background:s.bg,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
                {s.emoji}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:17,color:s.color}}>{s.label}</div>
                  {done && <span style={{fontSize:15}}>✅</span>}
                </div>
                <div style={{fontSize:12,color:"#a0aec0",marginTop:2}}>
                  {done && s.key === "quiz" && prog.score != null
                    ? `Best score: ${prog.score} / ${prog.total} 🏆`
                    : done ? "Completed" : s.sub}
                </div>
              </div>
              <span style={{fontSize:20,color:s.color}}>→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* A single chat message: relationship label on top, emoji + bubble below.
   isLeft pins the speaker to the left column consistently (same speaker always same side). */
function ChatBubble({ emoji, label, text, isLeft, italic }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:isLeft?"flex-start":"flex-end"}}>
      {label && (
        <div style={{fontSize:10,fontWeight:800,color:"#7c6a9c",margin: isLeft ? "0 0 2px 30px" : "0 30px 2px 0"}}>
          {label}
        </div>
      )}
      <div style={{display:"flex",alignItems:"flex-end",flexDirection:isLeft?"row":"row-reverse",gap:6}}>
        <div style={{fontSize:22,flexShrink:0}}>{emoji}</div>
        <div style={{
          background: isLeft ? "#fff" : "#ddd6fe",
          borderRadius: isLeft ? "14px 14px 14px 4px" : "14px 14px 4px 14px",
          padding:"7px 12px",maxWidth:"78%",boxShadow:"0 1px 4px rgba(0,0,0,.08)",
        }}>
          <div style={{fontSize:13,color:isLeft?"#1f2937":"#3b0764",lineHeight:1.4,fontStyle:italic?"italic":"normal"}}>{text}</div>
        </div>
      </div>
    </div>
  );
}

/* Chat-style practice/quiz screen */
function DialoguePracticeScreen({ topic, setKey, onBack, onComplete }) {
  const questions = DIALOGUE_TESTS[topic.id]?.[setKey] || [];
  const isQuiz = setKey === "quiz";
  const [qIdx, setQIdx] = useState(0);
  const [phase, setPhase] = useState("question"); // "question" | "correct" | "wrong" | "done"
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const chatRef = useRef(null);

  const q = questions[qIdx];

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [phase, qIdx]);

  useEffect(() => {
    if (phase === "done" && onComplete) {
      onComplete(isQuiz ? score : null, questions.length);
    }
  }, [phase]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && phase !== "question") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleSelect = (idx) => {
    if (phase !== "question") return;
    setSelected(idx);
    const isCorrect = idx === q.correct;
    if (isCorrect) {
      setScore(s => s + 1);
      setPhase("correct");
    } else {
      setPhase("wrong");
    }
    if (isQuiz) setQuizAnswers(prev => [...prev, { q, chosen: idx, correct: q.correct }]);
  };

  const handleNext = () => {
    if (qIdx + 1 >= questions.length) {
      setPhase("done");
    } else {
      setQIdx(i => i + 1);
      setPhase("question");
      setSelected(null);
    }
  };

  if (phase === "done" && isQuiz) {
    return <DialogueQuizResults score={score} total={questions.length} answers={quizAnswers} onBack={onBack} onRetry={() => { setQIdx(0); setPhase("question"); setSelected(null); setScore(0); setQuizAnswers([]); }} />;
  }
  if (phase === "done") {
    return (
      <div className="fade" style={{maxWidth:480,margin:"0 auto",textAlign:"center",paddingTop:40}}>
        <div style={{fontSize:60,marginBottom:12}}>🎉</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:24,color:"#3b0764",marginBottom:8}}>
          よくできました！
        </div>
        <div style={{fontSize:15,color:"#718096",marginBottom:28}}>Practice complete!</div>
        <button type="button" className="btn" style={{background:"#7c3aed",boxShadow:"0 4px 0 #4c1d95",marginBottom:10}} onClick={onBack}>
          Back to topic list
        </button>
      </div>
    );
  }

  const optionColors = (idx) => {
    if (phase === "question") return { bg:"#f9f5ff", border:"#ddd6fe", color:"#3b0764" };
    if (idx === q.correct) return { bg:"#d1fae5", border:"#34d399", color:"#065f46" };
    if (idx === selected && idx !== q.correct) return { bg:"#fee2e2", border:"#f87171", color:"#991b1b" };
    return { bg:"#f3f4f6", border:"#e5e7eb", color:"#9ca3af" };
  };

  return (
    <div className="fade" style={{maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <div style={{width:34,height:34,borderRadius:10,background:topic.color+"1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{topic.emoji}</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,color:"#3b0764"}}>{topic.title} · {isQuiz ? "QUIZ 🏆" : `Practice ${setKey.slice(-1)} ${practiceEmoji(topic.level, setKey)}`}</div>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",background:"#ede9fe",padding:"3px 9px",borderRadius:20}}>
          {qIdx + 1} / {questions.length}
        </div>
      </div>

      {/* Chat window */}
      <div ref={chatRef} style={{maxHeight:"38vh",overflowY:"auto",background:"#f0ebff",borderRadius:14,padding:"10px 12px",marginBottom:10,display:"flex",flexDirection:"column",gap:8}}>
        {/* Person A bubble — always on the left */}
        <ChatBubble emoji={q.aEmoji} label={speakerLabel(topic, q.aEmoji)} text={q.a} isLeft />

        {/* Mid bubble — a fixed line spoken between A and B (used for 3-line exchanges). Side follows the actual speaker. */}
        {q.mid && (
          <ChatBubble emoji={q.midEmoji} label={speakerLabel(topic, q.midEmoji)} text={q.mid} isLeft={q.midEmoji === q.aEmoji} />
        )}

        {/* Person B bubble — side follows the actual speaker (A speaking again stays on the left) */}
        <ChatBubble emoji={q.bEmoji} label={speakerLabel(topic, q.bEmoji)} text={q.b} isLeft={q.bEmoji === q.aEmoji} italic />

        {/* Correct reaction */}
        {phase === "correct" && (
          <div style={{textAlign:"center",padding:"2px 0",fontSize:26,animation:"pop .3s ease"}}>
            👍✨
          </div>
        )}
        {phase === "correct" && (
          <div style={{display:"flex",justifyContent:"center"}}>
            <div style={{background:"#d1fae5",borderRadius:12,padding:"5px 14px",fontSize:12,color:"#065f46",fontWeight:700,textAlign:"center"}}>
              すごい！正解！🎉
            </div>
          </div>
        )}
        {phase === "correct" && q.followUp && (
          <ChatBubble emoji={q.aEmoji} label={speakerLabel(topic, q.aEmoji)} text={q.followUp.text} isLeft />
        )}
        {phase === "correct" && (q.transA || q.transMid || q.transB || q.followUp?.trans) && (
          <div style={{background:"#fff",border:"1px solid #ddd6fe",borderRadius:12,padding:"7px 12px",fontSize:12,color:"#4c1d95",lineHeight:1.6}}>
            <div style={{fontSize:10,fontWeight:700,color:"#a78bfa",marginBottom:2}}>やくす 📖</div>
            {q.transA && <div>👤 {q.transA}</div>}
            {q.transMid && <div>💬 {q.transMid}</div>}
            {q.transB && <div>👤 {q.transB}</div>}
            {q.followUp?.trans && <div>👤 {q.followUp.trans}</div>}
          </div>
        )}

        {/* Wrong + hint bubble */}
        {phase === "wrong" && !isQuiz && q.hint && (
          <div style={{display:"flex",alignItems:"flex-start",gap:6}}>
            <div style={{fontSize:18,flexShrink:0}}>💡</div>
            <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:"14px 14px 14px 4px",padding:"7px 12px",maxWidth:"90%"}}>
              {q.hint.split("\n").map((line, i) => (
                <div key={i} style={{fontSize:12,color:"#92400e",lineHeight:1.5,marginBottom: i < q.hint.split("\n").length-1 ? 3 : 0}}>
                  {i === 0 ? <strong>{line}</strong> : line}
                </div>
              ))}
            </div>
          </div>
        )}
        {phase === "wrong" && isQuiz && (
          <div style={{display:"flex",justifyContent:"center"}}>
            <div style={{background:"#fee2e2",borderRadius:12,padding:"5px 14px",fontSize:12,color:"#991b1b",fontWeight:700}}>
              ざんねん！正解は「{q.opts[q.correct]}」だよ。
            </div>
          </div>
        )}
      </div>

      {/* Answer options */}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {q.opts.map((opt, idx) => {
          const c = optionColors(idx);
          return (
            <button key={idx} type="button" onClick={() => handleSelect(idx)}
              disabled={phase !== "question"}
              style={{padding:"9px 14px",borderRadius:12,border:`2px solid ${c.border}`,
                background:c.bg,color:c.color,fontFamily:"'Nunito',sans-serif",
                fontWeight:700,fontSize:13,cursor:phase==="question"?"pointer":"default",
                textAlign:"left",transition:"all .15s",
                opacity: phase !== "question" && idx !== q.correct && idx !== selected ? 0.5 : 1}}>
              {idx + 1}. {opt}
              {phase !== "question" && idx === q.correct && " ✓"}
            </button>
          );
        })}
      </div>

      {/* Next button — sticky so it's always visible, no scroll needed */}
      {phase !== "question" && (
        <div style={{position:"sticky",bottom:0,background:"#fff",paddingTop:8,marginTop:10}}>
          <button type="button" className="btn" onClick={handleNext} autoFocus
            style={{padding:"11px",background:"#7c3aed",boxShadow:"0 4px 0 #4c1d95"}}>
            {qIdx + 1 >= questions.length ? (isQuiz ? "See results 🏆" : "Finish! 🎉") : "Next → (Enter)"}
          </button>
        </div>
      )}
    </div>
  );
}

/* Quiz results screen */
function DialogueQuizResults({ score, total, answers, onBack, onRetry }) {
  const pct = Math.round((score / total) * 100);
  const msg = score === total ? { txt:"かんぺき！すごい！AT HOME マスター！", emoji:"🏆" }
    : score >= 5 ? { txt:"よくできました！もう少しでかんぺき！", emoji:"⭐⭐" }
    : score >= 3 ? { txt:"がんばったね！もう一度れんしゅうしてみよう！", emoji:"⭐" }
    : { txt:"れんしゅう1からやり直してみよう！きっとできるよ！", emoji:"📖" };
  return (
    <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
      <div style={{textAlign:"center",padding:"28px 0 20px"}}>
        <div style={{fontSize:56}}>{msg.emoji}</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:28,color:"#3b0764",margin:"10px 0 4px"}}>
          {score} / {total}
        </div>
        <div style={{fontSize:14,color:"#7c3aed",fontWeight:700,marginBottom:8}}>{pct}%</div>
        <div style={{fontSize:15,color:"#374151",background:"#ede9fe",borderRadius:12,padding:"10px 18px",display:"inline-block"}}>{msg.txt}</div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
        {answers.map(({ q, chosen, correct }, i) => (
          <div key={i} style={{borderRadius:14,border:`2px solid ${chosen===correct?"#a7f3d0":"#fca5a5"}`,background:chosen===correct?"#f0fdf4":"#fff5f5",padding:"12px 14px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:4}}>Q{i+1}</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:6}}>{q.a}</div>
            <div style={{fontSize:13,color:chosen===correct?"#065f46":"#991b1b",fontWeight:700}}>
              {chosen===correct ? "✓" : "✗"} {q.opts[chosen]}
            </div>
            {chosen !== correct && (
              <div style={{fontSize:12,color:"#059669",marginTop:4}}>正解: {q.opts[correct]}</div>
            )}
            {chosen !== correct && q.hint && (
              <div style={{marginTop:6,padding:"6px 10px",background:"#fefce8",borderRadius:8,fontSize:11,color:"#92400e"}}>
                💡 {q.hint.split("\n")[0]}
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="btn" style={{background:"#7c3aed",boxShadow:"0 4px 0 #4c1d95",marginBottom:10}} onClick={onRetry}>
        Try again 🔄
      </button>
      <button type="button" className="btn btn-gray" onClick={onBack}>
        Back to topic list
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   GRAMMAR SCREENS
══════════════════════════════════════════════ */

const GRAMMAR_CHIP_COLORS = { blue:{bg:"#dbeafe",text:"#1e40af"}, yellow:{bg:"#fef9c3",text:"#854d0e"}, green:{bg:"#dcfce7",text:"#15803d"}, orange:{bg:"#ffedd5",text:"#c2410c"} };
function GrammarChip({ color, children }) {
  const c = GRAMMAR_CHIP_COLORS[color] || { bg:"#f1f5f9", text:"#334155" };
  return <span style={{background:c.bg,color:c.text,fontWeight:800,fontSize:12,padding:"4px 9px",borderRadius:8,display:"inline-block"}}>{children}</span>;
}
function GrammarEnLine({ tokens }) {
  return (
    <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:5}}>
      {tokens.map((tok, i) => tok.c
        ? <GrammarChip key={i} color={tok.c}>{tok.t}</GrammarChip>
        : <span key={i} style={{fontSize:13,color:"#374151",fontWeight:600}}>{tok.t}</span>)}
    </div>
  );
}
/* Japanese line — every word is a chip, yellow by default so only the highlighted (blue) word stands out */
function GrammarJpLine({ tokens }) {
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
      {tokens.map((tok, i) => <GrammarChip key={i} color={tok.c || "yellow"}>{tok.t}</GrammarChip>)}
    </div>
  );
}

function GrammarHomeScreen({ level, onSelect, onBack }) {
  const topics = GRAMMAR_TOPICS.filter(t => t.level === level);
  return (
    <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:24,paddingTop:8}}>
        <div style={{fontSize:40,marginBottom:6}}>✏️</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,color:"#02020b"}}>Grammar</div>
        <div style={{fontSize:13,color:"#718096",marginTop:4}}>Choose a topic to learn</div>
      </div>
      {topics.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",color:"#a0aec0"}}>
          <div style={{fontSize:36,marginBottom:10}}>🚧</div>
          <div style={{fontSize:14}}>No topics yet for this level.<br/>Check back soon!</div>
        </div>
      ) : (
        <div style={{borderRadius:18,overflow:"hidden",boxShadow:"0 2px 14px rgba(0,0,0,.09)"}}>
          <div style={{background:"#7c3aed",padding:"10px 16px",fontSize:12,fontWeight:700,color:"#e9d5ff",letterSpacing:1}}>TOPICS</div>
          {topics.map((topic, i) => (
            <button key={topic.id} type="button" onClick={() => onSelect(topic)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"16px 18px",background:"#fff",border:"none",
                borderTop: i===0 ? "none" : "1px solid #f0f0f0", cursor:"pointer",textAlign:"left"}}
              onMouseEnter={e => e.currentTarget.style.background="#f9f5ff"}
              onMouseLeave={e => e.currentTarget.style.background="#fff"}>
              <div style={{width:48,height:48,borderRadius:14,background:"#ede9fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>{topic.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:16,color:"#3b0764"}}>{topic.title}</div>
                <div style={{fontSize:12,color:"#a78bfa",marginTop:2}}>4 parts · overview · final test</div>
              </div>
              <span style={{fontSize:18,color:"#c4b5fd"}}>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GrammarTopicScreen({ topic, onSelectPart, onSelectOverview, onSelectFinal, getPartDone, getFinalProgress }) {
  const partsDone = PRONOUN_PARTS.filter(p => getPartDone(p.id)).length;
  const finalProg = getFinalProgress();
  const rows = [
    ...PRONOUN_PARTS.map(p => ({ key:p.id, kind:"part", label:`${p.short}. ${p.title}`, sub:p.subtitle, emoji:"📘", onClick:() => onSelectPart(p), done:getPartDone(p.id) })),
    { key:"overview", kind:"overview", label:"Overview", sub:"まとめページ", emoji:"📋", onClick:onSelectOverview, done:partsDone===PRONOUN_PARTS.length },
    { key:"final", kind:"final", label:"Final Practice Test", sub:"10 questions · no hints", emoji:"🏆", onClick:onSelectFinal, done:!!finalProg },
  ];
  return (
    <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
        <div style={{fontSize:36}}>{topic.emoji}</div>
        <div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:20,color:"#3b0764"}}>{topic.title}</div>
          <div style={{fontSize:13,color:"#a78bfa"}}>{partsDone}/{PRONOUN_PARTS.length} parts done{finalProg ? ` · Final: ${finalProg.score}/${finalProg.total}` : ""}</div>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {rows.map(r => (
          <button key={r.key} type="button" onClick={r.onClick}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,
              border:`2px solid ${r.done?"#86efac":"#ede9fe"}`,background:r.done?"#f0fdf4":"#fff",
              cursor:"pointer",textAlign:"left",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
            <div style={{width:42,height:42,borderRadius:12,background:r.done?"#dcfce7":"#ede9fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{r.emoji}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:14,color:"#3b0764"}}>{r.label}</div>
                {r.done && <span style={{fontSize:13}}>✅</span>}
              </div>
              <div style={{fontSize:11,color:"#a0aec0",marginTop:2}}>{r.sub}</div>
            </div>
            <span style={{fontSize:18,color:r.done?"#4ade80":"#c4b5fd"}}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Tap-to-pair matching game */
function PairMatchGame({ pairs, onDone }) {
  const jpShuffled = useMemo(() => shuffle(pairs.map(p => p.jp)), [pairs]);
  const [selectedEn, setSelectedEn] = useState(null);
  const [matched, setMatched] = useState([]);
  const [wrongPair, setWrongPair] = useState(null);

  const pickEn = (en) => { if (!matched.includes(en)) setSelectedEn(en); };
  const pickJp = (jp) => {
    if (!selectedEn) return;
    const pair = pairs.find(p => p.en === selectedEn);
    if (pair.jp === jp) {
      setMatched(m => [...m, selectedEn]);
      setSelectedEn(null);
      if (matched.length + 1 === pairs.length) setTimeout(onDone, 500);
    } else {
      setWrongPair(jp);
      setTimeout(() => setWrongPair(null), 400);
      setSelectedEn(null);
    }
  };

  return (
    <div className="fade" style={{maxWidth:600,margin:"0 auto"}}>
      <div style={{textAlign:"center",fontSize:16,color:"#718096",marginBottom:24}}>左のえいごと右の日本語をむすぼう！</div>
      <div style={{display:"flex",gap:20}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:14}}>
          {pairs.map(p => (
            <button key={p.en} type="button" disabled={matched.includes(p.en)} onClick={() => pickEn(p.en)}
              style={{padding:"22px 16px",borderRadius:16,border:`3px solid ${matched.includes(p.en)?"#86efac":selectedEn===p.en?"#7c3aed":"#e2e8f0"}`,
                background:matched.includes(p.en)?"#f0fdf4":selectedEn===p.en?"#f5f3ff":"#fff",
                fontWeight:800,fontSize:22,color:matched.includes(p.en)?"#15803d":"#3b0764",cursor:matched.includes(p.en)?"default":"pointer"}}>
              {p.en}{matched.includes(p.en)?" ✓":""}
            </button>
          ))}
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:14}}>
          {jpShuffled.map(jp => {
            const isMatched = matched.some(en => pairs.find(p=>p.en===en).jp === jp);
            return (
              <button key={jp} type="button" disabled={isMatched} onClick={() => pickJp(jp)}
                style={{padding:"22px 16px",borderRadius:16,border:`3px solid ${isMatched?"#86efac":wrongPair===jp?"#f87171":"#e2e8f0"}`,
                  background:isMatched?"#f0fdf4":wrongPair===jp?"#fee2e2":"#fff",
                  fontWeight:700,fontSize:20,color:isMatched?"#15803d":"#374151",cursor:isMatched?"default":"pointer"}}>
                {jp}{isMatched?" ✓":""}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GrammarPartScreen({ part, onDone, onBack }) {
  const [step, setStep] = useState("intro"); // intro | match | lesson | quiz
  const [qIdx, setQIdx] = useState(0);
  const [phase, setPhase] = useState("question"); // question | correct | wrong
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);

  const q = part.questions[qIdx];

  const handleSelect = (idx) => {
    if (phase !== "question") return;
    setSelected(idx);
    if (idx === q.correct) { setScore(s=>s+1); setPhase("correct"); }
    else setPhase("wrong");
  };
  const handleNext = () => {
    if (qIdx + 1 >= part.questions.length) { onDone(); }
    else { setQIdx(i=>i+1); setPhase("question"); setSelected(null); }
  };

  if (step === "intro") {
    return (
      <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:18,color:"#3b0764"}}>{part.short}. {part.title}</div>
          <div style={{fontSize:12,color:"#a78bfa"}}>{part.subtitle}</div>
          <div style={{fontSize:12,color:"#718096",marginTop:8}}>Tap to hear! 🔊</div>
        </div>
        <div style={{background:"#fff",border:"1.5px solid #ede9fe",borderRadius:14,overflow:"hidden",marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"36px 1fr 1.3fr 40px",background:"#f5f3ff",padding:"8px 10px",gap:6}}>
            <div />
            <div style={{fontSize:11,fontWeight:800,color:"#7c6a9c",textAlign:"center"}}>ENGLISH</div>
            <div style={{fontSize:11,fontWeight:800,color:"#7c6a9c",textAlign:"center"}}>日本語</div>
            <div />
          </div>
          {part.cards.map((c, i) => (
            <div key={c.en} style={{display:"grid",gridTemplateColumns:"36px 1fr 1.3fr 40px",alignItems:"center",gap:6,
              padding:"12px 10px",borderTop: i===0?"none":"1px solid #f1f5f9"}}>
              <span style={{fontSize:14,textAlign:"center"}}>🔵</span>
              <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:16,color:"#3b0764",textAlign:"center"}}>{c.en}</div>
              <div style={{fontSize:16,color:"#374151",textAlign:"center"}}>{c.kana}</div>
              <div style={{display:"flex",justifyContent:"center"}}><SpeakBtn text={c.en} size={30} /></div>
            </div>
          ))}
        </div>
        <button type="button" className="btn" style={{background:"#7c3aed",boxShadow:"0 4px 0 #4c1d95"}} onClick={() => setStep("match")}>
          Next: Matching quiz →
        </button>
      </div>
    );
  }

  if (step === "match") {
    return (
      <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
        <PairMatchGame pairs={part.matchPairs} onDone={() => setStep("lesson")} />
      </div>
    );
  }

  if (step === "lesson") {
    return (
      <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:16,color:"#3b0764"}}>Lesson</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          {part.lessonRows.map((row, i) => (
            <div key={i} style={{background:"#fff",border:"1.5px solid #ede9fe",borderRadius:12,padding:"10px 12px"}}>
              <div style={{marginBottom:6}}>
                <GrammarJpLine tokens={row.jp} />
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1}}><GrammarEnLine tokens={row.en} /></div>
                <SpeakBtn text={row.en.map(t=>t.t).join(" ")} size={26} />
              </div>
            </div>
          ))}
        </div>
        {part.compareRows && (
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            {part.compareRows.map((row,i) => (
              <div key={i} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,padding:"10px 12px"}}>
                <div style={{fontSize:12,color:"#718096",marginBottom:6}}>{row.jp}</div>
                <GrammarEnLine tokens={row.en} />
              </div>
            ))}
          </div>
        )}
        <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:12,padding:"10px 14px",marginBottom:10,fontSize:13,color:"#92400e"}}>
          💡 {part.lessonNote}
        </div>
        {part.lessonExtra && (
          <div style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#15803d"}}>
            <div>{part.lessonExtra.good}</div>
            <div style={{color:"#b91c1c",marginTop:2}}>{part.lessonExtra.bad}</div>
          </div>
        )}
        <button type="button" className="btn" style={{background:"#7c3aed",boxShadow:"0 4px 0 #4c1d95"}} onClick={() => setStep("quiz")}>
          Next: 3 questions →
        </button>
      </div>
    );
  }

  // step === "quiz"
  const optColor = (idx) => {
    if (phase === "question") return { bg:"#f9f5ff", border:"#ddd6fe", color:"#3b0764" };
    if (idx === q.correct) return { bg:"#d1fae5", border:"#34d399", color:"#065f46" };
    if (idx === selected && idx !== q.correct) return { bg:"#fee2e2", border:"#f87171", color:"#991b1b" };
    return { bg:"#f3f4f6", border:"#e5e7eb", color:"#9ca3af" };
  };
  return (
    <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,color:"#3b0764"}}>{part.short}. Questions</div>
        <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",background:"#ede9fe",padding:"3px 9px",borderRadius:20}}>{qIdx+1} / {part.questions.length}</div>
      </div>
      <div style={{background:"#f0ebff",borderRadius:14,padding:"18px 16px",marginBottom:12}}>
        <div style={{fontSize:15,color:"#1f2937",lineHeight:1.6,fontWeight:600,whiteSpace:"pre-line"}}>
          {q.before}{q.before?" ":""}{q.blank}{q.after?" "+q.after:""}
        </div>
        {q.context && <div style={{fontSize:12,color:"#7c6a9c",marginTop:8}}>→ {q.context}</div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
        {q.opts.map((opt, idx) => {
          const c = optColor(idx);
          return (
            <button key={idx} type="button" onClick={() => handleSelect(idx)} disabled={phase!=="question"}
              style={{padding:"10px 14px",borderRadius:12,border:`2px solid ${c.border}`,background:c.bg,color:c.color,
                fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:14,textAlign:"left",cursor:phase==="question"?"pointer":"default"}}>
              {idx+1}. {opt}{phase!=="question" && idx===q.correct?" ✓":""}
            </button>
          );
        })}
      </div>
      {phase !== "question" && (
        <button type="button" className="btn" onClick={handleNext} autoFocus style={{background:"#7c3aed",boxShadow:"0 4px 0 #4c1d95"}}>
          {qIdx+1 >= part.questions.length ? "Finish part! 🎉" : "Next →"}
        </button>
      )}
    </div>
  );
}

function GrammarOverviewScreen({ onContinue }) {
  return (
    <div className="fade" style={{maxWidth:520,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:18,color:"#3b0764"}}>だいめいし まとめ</div>
      </div>
      <div style={{overflowX:"auto",marginBottom:16}}>
        <table style={{width:"100%",borderCollapse:"collapse",background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
          <thead>
            <tr style={{background:"#7c3aed"}}>
              {["人","だれが","だれを","〜の","〜のもの"].map(h => (
                <th key={h} style={{padding:"8px 10px",fontSize:12,color:"#fff",fontFamily:"'Nunito',sans-serif",fontWeight:800,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRONOUN_OVERVIEW_ROWS.map((r,i) => (
              <tr key={r.person} style={{background:i%2===0?"#faf5ff":"#fff"}}>
                <td style={{padding:"7px 10px",fontSize:12,color:"#3b0764",fontWeight:700}}>{r.person}</td>
                <td style={{padding:"7px 10px",fontSize:13,color:"#1f2937",fontWeight:700}}>{r.subj}</td>
                <td style={{padding:"7px 10px",fontSize:13,color:"#1f2937"}}>{r.obj}</td>
                <td style={{padding:"7px 10px",fontSize:13,color:"#1f2937"}}>{r.poss}</td>
                <td style={{padding:"7px 10px",fontSize:13,color:"#1f2937"}}>{r.possP}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:12,padding:"12px 14px",marginBottom:16,fontSize:13,color:"#92400e",lineHeight:1.7}}>
        <div>💡 名詞のまえ → 〜の（my, his, her...）</div>
        <div>💡 名詞のあと → 〜のもの（mine, his, hers...）</div>
      </div>
      <button type="button" className="btn" style={{background:"#7c3aed",boxShadow:"0 4px 0 #4c1d95"}} onClick={onContinue}>
        Continue →
      </button>
    </div>
  );
}

/* A pronoun word colored to stand out, with an example-sentence tooltip on hover */
/* Renders an example sentence with its target pronoun highlighted (case-insensitive whole-word match) */
function HighlightedExample({ example, word }) {
  const re = new RegExp(`\\b(${word})\\b`, "i");
  const match = example.match(re);
  if (!match) return <>{example}</>;
  const idx = match.index;
  const before = example.slice(0, idx);
  const hit = example.slice(idx, idx + match[0].length);
  const after = example.slice(idx + match[0].length);
  return (
    <>
      {before}
      <span style={{color:"#4ade80",fontWeight:800}}>{hit}</span>
      {after}
    </>
  );
}

function HoverPronoun({ word, align = "center" }) {
  const [hover, setHover] = useState(false);
  const example = PRONOUN_EXAMPLES[word.toLowerCase()];
  const posStyle = align === "left"
    ? { right:0 }                                  // tooltip's right edge sits at the word's right edge, grows leftward
    : { left:"50%", transform:"translateX(-50%)" }; // centered above the word
  const arrowStyle = align === "left"
    ? { right:10 }
    : { left:"50%", transform:"translateX(-50%)" };
  return (
    <span style={{position:"relative",display:"inline-block"}}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => setHover(h => !h)}>
      <span style={{color:"#1e40af",fontWeight:800,cursor:example?"help":"default",borderBottom:example?"2px dotted #93c5fd":"none"}}>
        {word}
      </span>
      {hover && example && (
        <div style={{position:"absolute",bottom:"120%",...posStyle,
          background:"#1e293b",color:"#fff",fontSize:11,fontWeight:600,padding:"8px 11px",borderRadius:8,
          width:170,whiteSpace:"normal",lineHeight:1.5,zIndex:20,boxShadow:"0 4px 10px rgba(0,0,0,.25)"}}>
          <HighlightedExample example={example} word={word} />
          <div style={{position:"absolute",top:"100%",...arrowStyle,
            borderWidth:"5px 5px 0 5px",borderStyle:"solid",borderColor:"#1e293b transparent transparent transparent"}} />
        </div>
      )}
    </span>
  );
}

/* Slide-in reference panel — every pronoun form, hoverable for an example sentence */
function HintsPanel({ open, onClose }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",zIndex:29}} />
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(320px, 88vw)",background:"#fff",
        zIndex:30,boxShadow:"-4px 0 20px rgba(0,0,0,.15)",overflowY:"auto",padding:"18px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,color:"#3b0764"}}>📋 だいめいし まとめ</div>
          <button type="button" onClick={onClose} style={{background:"#f3f4f6",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        <div style={{fontSize:11,color:"#a0aec0",marginBottom:10}}>ホバーで例文が見られるよ 👆</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#f5f3ff"}}>
                {["人","だれが","だれを","〜の","〜のもの"].map(h => (
                  <th key={h} style={{padding:"6px 6px",fontSize:10,color:"#7c6a9c",fontWeight:800,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRONOUN_OVERVIEW_ROWS.map((r,i) => (
                <tr key={r.person} style={{background:i%2===0?"#faf5ff":"#fff"}}>
                  <td style={{padding:"7px 6px",color:"#3b0764",fontWeight:700,whiteSpace:"nowrap"}}>{r.person}</td>
                  <td style={{padding:"7px 6px"}}><HoverPronoun word={r.subj} /></td>
                  <td style={{padding:"7px 6px"}}><HoverPronoun word={r.obj} /></td>
                  <td style={{padding:"7px 6px"}}><HoverPronoun word={r.poss} /></td>
                  <td style={{padding:"7px 6px"}}>{r.possP === "—" ? "—" : <HoverPronoun word={r.possP} align="left" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:14,background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:10,padding:"10px 12px",fontSize:11,color:"#92400e",lineHeight:1.6}}>
          <div>💡 名詞のまえ → 〜の（my, his, her...）</div>
          <div>💡 名詞のあと → 〜のもの（mine, his, hers...）</div>
        </div>
      </div>
    </>
  );
}

function GrammarFinalTestScreen({ onComplete, onBack }) {
  const [qIdx, setQIdx] = useState(0);
  const [phase, setPhase] = useState("question");
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const q = PRONOUN_FINAL_TEST[qIdx];

  const handleSelect = (idx) => {
    if (phase !== "question") return;
    setSelected(idx);
    const correct = idx === q.correct;
    if (correct) setScore(s=>s+1);
    setPhase(correct ? "correct" : "wrong");
    setAnswers(prev => [...prev, { q, chosen:idx, correct:q.correct }]);
  };
  const handleNext = () => {
    setPanelOpen(false); // hints close automatically so the next question starts fresh
    if (qIdx+1 >= PRONOUN_FINAL_TEST.length) {
      onComplete(score, PRONOUN_FINAL_TEST.length, answers);
    } else {
      setQIdx(i=>i+1); setPhase("question"); setSelected(null);
    }
  };

  const optColor = (idx) => {
    if (phase === "question") return { bg:"#f9f5ff", border:"#ddd6fe", color:"#3b0764" };
    if (idx === q.correct) return { bg:"#d1fae5", border:"#34d399", color:"#065f46" };
    if (idx === selected && idx !== q.correct) return { bg:"#fee2e2", border:"#f87171", color:"#991b1b" };
    return { bg:"#f3f4f6", border:"#e5e7eb", color:"#9ca3af" };
  };

  return (
    <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8}}>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,color:"#3b0764",flex:1}}>🏆 Final Practice Test</div>
        <button type="button" onClick={() => setPanelOpen(true)}
          style={{background:"#ede9fe",border:"none",borderRadius:20,padding:"5px 11px",fontSize:11,fontWeight:800,color:"#7c3aed",cursor:"pointer",flexShrink:0}}>
          💡 Hints
        </button>
        <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",background:"#ede9fe",padding:"3px 9px",borderRadius:20,flexShrink:0}}>{qIdx+1} / {PRONOUN_FINAL_TEST.length}</div>
      </div>
      <div style={{background:"#f0ebff",borderRadius:14,padding:"18px 16px",marginBottom:12}}>
        <div style={{fontSize:15,color:"#1f2937",lineHeight:1.6,fontWeight:600}}>
          {q.before}{q.before?" ":""}{q.blank}{q.after?" "+q.after:""}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
        {q.opts.map((opt, idx) => {
          const c = optColor(idx);
          return (
            <button key={idx} type="button" onClick={() => handleSelect(idx)} disabled={phase!=="question"}
              style={{padding:"10px 14px",borderRadius:12,border:`2px solid ${c.border}`,background:c.bg,color:c.color,
                fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:14,textAlign:"left",cursor:phase==="question"?"pointer":"default"}}>
              {idx+1}. {opt}{phase!=="question" && idx===q.correct?" ✓":""}
            </button>
          );
        })}
      </div>
      {phase !== "question" && (
        <button type="button" className="btn" onClick={handleNext} autoFocus style={{background:"#7c3aed",boxShadow:"0 4px 0 #4c1d95"}}>
          {qIdx+1 >= PRONOUN_FINAL_TEST.length ? "See results 🏆" : "Next →"}
        </button>
      )}
      <HintsPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

function GrammarFinalResultsScreen({ score, total, answers, onBack, onRetry }) {
  const msg = score === total ? { txt:"かんぺき！すごい！", emoji:"🏆" }
    : score >= total*0.7 ? { txt:"よくできました！", emoji:"⭐⭐" }
    : score >= total*0.4 ? { txt:"がんばったね！", emoji:"⭐" }
    : { txt:"もう一度れんしゅうしよう！", emoji:"📖" };
  return (
    <div className="fade" style={{maxWidth:480,margin:"0 auto"}}>
      <div style={{textAlign:"center",padding:"28px 0 20px"}}>
        <div style={{fontSize:56}}>{msg.emoji}</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:28,color:"#3b0764",margin:"10px 0 4px"}}>{score} / {total}</div>
        <div style={{fontSize:15,color:"#374151",background:"#ede9fe",borderRadius:12,padding:"10px 18px",display:"inline-block"}}>{msg.txt}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
        {answers.map(({q, chosen, correct}, i) => (
          <div key={i} style={{borderRadius:14,border:`2px solid ${chosen===correct?"#a7f3d0":"#fca5a5"}`,background:chosen===correct?"#f0fdf4":"#fff5f5",padding:"12px 14px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:4}}>Q{i+1}</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:6}}>{q.before} {q.blank} {q.after}</div>
            <div style={{fontSize:13,color:chosen===correct?"#065f46":"#991b1b",fontWeight:700}}>
              {chosen===correct ? "✓" : "✗"} {q.opts[chosen]}
            </div>
            {chosen !== correct && <div style={{fontSize:12,color:"#059669",marginTop:4}}>正解: {q.opts[correct]}</div>}
          </div>
        ))}
      </div>
      <button type="button" className="btn" style={{background:"#7c3aed",boxShadow:"0 4px 0 #4c1d95",marginBottom:10}} onClick={onRetry}>
        Try again 🔄
      </button>
      <button type="button" className="btn btn-gray" onClick={onBack}>
        Back to topic
      </button>
    </div>
  );
}
