import { useState, useEffect, useRef } from "react";
import { SPEAKING_SETS, SPEAKING_USEFUL_PHRASES } from "./speakingData.js";

const PURPLE = "#7c3aed";
const getSpeechApi = () => (typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null) || null;

function listen(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

const cardStyle = { background:"#fff", border:"1.5px solid #ede9fe", borderRadius:14, padding:"14px 16px", marginBottom:12 };
const h2Style = { fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:15, color:"#3b0764", marginBottom:8 };

/* ── Topic list ── */
export function SpeakingHomeScreen({ onSelect, isDone }) {
  return (
    <div className="fade" style={{ maxWidth:520, margin:"0 auto", width:"100%" }}>
      <div style={{ textAlign:"center", marginBottom:20, paddingTop:8 }}>
        <div style={{ fontSize:40, marginBottom:6 }}>🎤</div>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:22, color:"#02020b" }}>Speaking</div>
        <div style={{ fontSize:13, color:"#718096", marginTop:4 }}>Read, learn the words, then answer out loud</div>
      </div>
      {SPEAKING_SETS.map(set => (
        <button type="button" key={set.id} onClick={() => onSelect(set)}
          style={{ display:"flex", alignItems:"center", gap:12, width:"100%", textAlign:"left", cursor:"pointer",
            background:"#fff", border:"1.5px solid #ede9fe", borderRadius:14, padding:"14px 16px", marginBottom:10 }}>
          <div style={{ fontSize:30, width:44, textAlign:"center" }}>{set.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:800, color:PURPLE }}>QUESTION No. {set.qNo}</div>
            <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:16, color:"#02020b" }}>{set.topic}</div>
          </div>
          <div style={{ fontSize:18 }}>{isDone(set.id) ? "✅" : "○"}</div>
        </button>
      ))}
    </div>
  );
}

/* ── Vocabulary: tap a word to show its Japanese ── */
function VocabList({ vocab }) {
  const [open, setOpen] = useState({});
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {vocab.map((v, i) => {
        const shown = !!open[i];
        return (
          <button type="button" key={i} onClick={() => setOpen(o => ({ ...o, [i]: !o[i] }))}
            style={{ display:"flex", alignItems:"center", gap:10, textAlign:"left", cursor:"pointer", width:"100%",
              background: shown ? "#f5f3ff" : "#fafafa", border:`1.5px solid ${shown ? "#c4b5fd" : "#e2e8f0"}`,
              borderRadius:10, padding:"8px 12px" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:14, color:"#1f2937" }}>{v.en}</div>
              <div style={{ fontSize:12, color:"#718096", marginTop:1 }}>{v.meaning}</div>
            </div>
            <div style={{ fontWeight:800, fontSize:15, color: shown ? PURPLE : "#a0aec0", minWidth:70, textAlign:"right" }}>
              {shown ? v.jp : "日本語 👁"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Step 1: reading page ── */
function ReadingPage({ set, onNext }) {
  const para = { fontSize:14, lineHeight:1.75, color:"#374151", margin:"0 0 10px" };
  return (
    <div>
      <div style={cardStyle}>
        <div style={{ fontSize:11, fontWeight:800, color:PURPLE }}>📰 READING · No. {set.qNo}</div>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:18, color:"#02020b", margin:"4px 0 10px" }}>{set.headline}</div>
        {set.intro.map((p, i) => <p key={i} style={para}>{p}</p>)}
      </div>

      <div style={{ ...cardStyle, background:"#f0fdf4", borderColor:"#86efac" }}>
        <div style={{ ...h2Style, color:"#15803d" }}>✅ Positive view</div>
        {set.positive.map((p, i) => <p key={i} style={para}>{p}</p>)}
      </div>

      <div style={{ ...cardStyle, background:"#fef2f2", borderColor:"#fca5a5" }}>
        <div style={{ ...h2Style, color:"#b91c1c" }}>❌ Negative view</div>
        {set.negative.map((p, i) => <p key={i} style={para}>{p}</p>)}
      </div>

      <div style={cardStyle}>
        <div style={h2Style}>📚 Vocabulary <span style={{ fontSize:11, fontWeight:600, color:"#a0aec0" }}>— tap a word to see the Japanese</span></div>
        <VocabList vocab={set.vocab} />
      </div>

      <div style={{ ...cardStyle, background:"#fffbeb", borderColor:"#fde68a" }}>
        <div style={{ ...h2Style, color:"#b45309" }}>💡 Key Takeaways</div>
        <ul style={{ margin:0, paddingLeft:20, fontSize:14, lineHeight:1.8, color:"#4b5563" }}>
          {set.keyTakeaways.map((k, i) => <li key={i}>{k}</li>)}
        </ul>
      </div>

      <div style={{ ...cardStyle, background:"#f8fafc", borderColor:"#e2e8f0" }}>
        <div style={h2Style}>🔗 Read more</div>
        {set.links.map((l, i) => (
          <div key={i} style={{ fontSize:13, marginBottom:4 }}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color:"#2563eb" }}>{l.label}</a>
          </div>
        ))}
      </div>

      <button type="button" className="btn" onClick={onNext}
        style={{ background:PURPLE, boxShadow:"0 4px 0 #4c1d95" }}>
        Next: Speaking question 🎤
      </button>
    </div>
  );
}

/* ── Voice recorder: live transcript (browser speech recognition) + real audio recording ── */
function Recorder() {
  const [state, setState] = useState("idle"); // idle | recording | done
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef(null);
  const mediaRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const activeRef = useRef(false);
  const timerRef = useRef(null);

  const cleanup = () => {
    activeRef.current = false;
    clearInterval(timerRef.current);
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
  };
  useEffect(() => cleanup, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const start = async () => {
    setError(null);
    setTranscript(""); setInterim("");
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio. Please use Chrome or Edge.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
      };
      mr.start();
      mediaRef.current = mr;

      const SpeechApi = getSpeechApi();
      if (SpeechApi) {
        const rec = new SpeechApi();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = e => {
          let finalText = "", interimText = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText += r[0].transcript + " ";
            else interimText += r[0].transcript;
          }
          if (finalText) setTranscript(t => (t + finalText).replace(/\s+/g, " "));
          setInterim(interimText);
        };
        rec.onerror = () => { /* "no-speech" etc. — onend restarts below */ };
        rec.onend = () => { if (activeRef.current) { try { rec.start(); } catch { /* already started */ } } };
        recRef.current = rec;
        rec.start();
      }

      activeRef.current = true;
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      setState("recording");
    } catch {
      setError("Couldn't use the microphone. Please allow microphone access and try again.");
    }
  };

  const stop = () => {
    activeRef.current = false;
    clearInterval(timerRef.current);
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    try { mediaRef.current?.stop(); } catch { /* already stopped */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
    setInterim("");
    setState("done");
  };

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div style={cardStyle}>
      <div style={h2Style}>🎙️ Record your answer</div>
      {!getSpeechApi() && (
        <div style={{ fontSize:12, color:"#b45309", background:"#fffbeb", borderRadius:8, padding:"6px 10px", marginBottom:8 }}>
          Live text isn't available in this browser (use Chrome or Edge). Your voice can still be recorded.
        </div>
      )}
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        {state !== "recording" ? (
          <button type="button" onClick={start}
            style={{ padding:"10px 18px", borderRadius:12, border:"none", background:"#ef4444", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:"0 3px 0 #b91c1c" }}>
            ● {state === "done" ? "Record again" : "Start recording"}
          </button>
        ) : (
          <button type="button" onClick={stop}
            style={{ padding:"10px 18px", borderRadius:12, border:"none", background:"#374151", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:"0 3px 0 #111827" }}>
            ■ Stop
          </button>
        )}
        {state === "recording" && (
          <span style={{ fontWeight:800, color:"#ef4444", fontSize:14 }}>● {mm}:{ss}</span>
        )}
      </div>

      {error && <div style={{ marginTop:8, fontSize:12, fontWeight:700, color:"#991b1b" }}>{error}</div>}

      {(transcript || interim) && (
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#a0aec0", marginBottom:3 }}>WHAT THE COMPUTER HEARD (may contain mistakes)</div>
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"8px 12px", fontSize:14, lineHeight:1.6, color:"#1f2937" }}>
            {transcript}<span style={{ color:"#a0aec0" }}>{interim}</span>
          </div>
        </div>
      )}

      {audioUrl && (
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#a0aec0", marginBottom:3 }}>LISTEN TO YOUR ANSWER</div>
          <audio controls src={audioUrl} style={{ width:"100%" }} />
          <a href={audioUrl} download={`speaking-answer-${Date.now()}.webm`}
            style={{ display:"inline-block", marginTop:6, fontSize:12, fontWeight:700, color:"#2563eb" }}>
            ⬇️ Save this recording
          </a>
        </div>
      )}
    </div>
  );
}

/* ── Step 2: the speaking question ── */
function QuestionPage({ set, onBackToReading, onDone, done }) {
  const [side, setSide] = useState(null); // "yes" | "no"
  const [showModel, setShowModel] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);
  const data = side ? set[side] : null;

  return (
    <div>
      <div style={{ ...cardStyle, background:"#f5f3ff", borderColor:"#c4b5fd", textAlign:"center" }}>
        <div style={{ fontSize:11, fontWeight:800, color:PURPLE }}>🎤 QUESTION No. {set.qNo}</div>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:19, color:"#1e1b4b", margin:"6px 0 4px", lineHeight:1.4 }}>{set.question}</div>
        <button type="button" onClick={() => listen(set.question)}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, fontWeight:700, color:PURPLE }}>🔈 Hear the question</button>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:12 }}>
        {[["yes","👍 Yes (agree)","#16a34a","#dcfce7"], ["no","👎 No (disagree)","#dc2626","#fee2e2"]].map(([key, label, c, bg]) => (
          <button type="button" key={key} onClick={() => { setSide(key); setShowModel(false); }}
            style={{ flex:1, padding:"12px 8px", borderRadius:12, cursor:"pointer", fontWeight:900, fontSize:15,
              fontFamily:"'Nunito',sans-serif", border:`2.5px solid ${side === key ? c : "#e2e8f0"}`,
              background: side === key ? bg : "#fff", color: side === key ? c : "#718096" }}>
            {label}
          </button>
        ))}
      </div>

      {!side && (
        <div style={{ textAlign:"center", fontSize:13, color:"#a0aec0", marginBottom:12 }}>
          Choose Yes or No to see ideas you can use.
        </div>
      )}

      {data && (
        <div style={cardStyle}>
          <div style={h2Style}>🔑 Key words & ideas ({side === "yes" ? "Yes" : "No"})</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {data.keywords.map((k, i) => (
              <span key={i} style={{ background: side === "yes" ? "#dcfce7" : "#fee2e2", color: side === "yes" ? "#166534" : "#991b1b",
                fontWeight:700, fontSize:13, padding:"5px 10px", borderRadius:8 }}>{k}</span>
            ))}
          </div>
          <button type="button" onClick={() => setShowModel(v => !v)}
            style={{ marginTop:10, background:"none", border:"none", cursor:"pointer", fontSize:12, fontWeight:800, color:PURPLE }}>
            {showModel ? "▲ Hide" : "▼ Show"} a model answer (try on your own first!)
          </button>
          {showModel && (
            <div style={{ marginTop:6, background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:10, padding:"10px 12px", fontSize:14, lineHeight:1.7, color:"#374151" }}>
              {data.model}
              <div><button type="button" onClick={() => listen(data.model)}
                style={{ marginTop:4, background:"none", border:"none", cursor:"pointer", fontSize:12, fontWeight:700, color:PURPLE }}>🔈 Listen</button></div>
            </div>
          )}
        </div>
      )}

      <div style={cardStyle}>
        <button type="button" onClick={() => setShowPhrases(v => !v)}
          style={{ background:"none", border:"none", cursor:"pointer", ...h2Style, marginBottom:0, padding:0 }}>
          {showPhrases ? "▲" : "▼"} 💬 Useful phrases
        </button>
        {showPhrases && (
          <div style={{ marginTop:8, fontSize:13, color:"#4b5563", lineHeight:1.8 }}>
            {SPEAKING_USEFUL_PHRASES.map(g => (
              <div key={g.label}><strong>{g.label}:</strong> {g.phrases.join("  /  ")}</div>
            ))}
          </div>
        )}
      </div>

      <Recorder />

      <div style={{ display:"flex", gap:10 }}>
        <button type="button" onClick={onBackToReading}
          style={{ flex:1, padding:"12px", borderRadius:12, border:"2px solid #e2e8f0", background:"#fff", fontWeight:800, fontSize:13, color:"#718096", cursor:"pointer" }}>
          ← Back to reading
        </button>
        <button type="button" onClick={onDone}
          style={{ flex:1, padding:"12px", borderRadius:12, border:"none", background: done ? "#16a34a" : PURPLE, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>
          {done ? "✅ Practiced" : "Mark as practiced ✓"}
        </button>
      </div>
    </div>
  );
}

/* ── One practice set: reading → question ── */
export function SpeakingSetScreen({ set, done, onMarkDone }) {
  const [step, setStep] = useState("read");
  useEffect(() => { window.scrollTo?.(0, 0); }, [step]);
  return (
    <div className="fade" style={{ maxWidth:520, margin:"0 auto", width:"100%" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:22 }}>{set.emoji}</span>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:15, color:"#3b0764", flex:1 }}>
          No. {set.qNo} · {set.topic}
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:"#a78bfa", background:"#ede9fe", padding:"3px 9px", borderRadius:20 }}>
          {step === "read" ? "1 / 2 Read" : "2 / 2 Speak"}
        </div>
      </div>
      {step === "read"
        ? <ReadingPage set={set} onNext={() => setStep("question")} />
        : <QuestionPage set={set} done={done} onBackToReading={() => setStep("read")} onDone={onMarkDone} />}
    </div>
  );
}
