// ==============================
// Firebase 読み込み
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ==============================
// Firebase 設定
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyBkKibOJB4ETY3mOfanATWA9BQQl12zvhQ",
  authDomain: "chat-app-a7275.firebaseapp.com",
  projectId: "chat-app-a7275",
  storageBucket: "chat-app-a7275.firebasestorage.app",
  messagingSenderId: "245091266796",
  appId: "1:245091266796:web:873d3c3b32c54d3ab7b5c9",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ==============================
// DOM 取得
// ==============================
const startBtn = document.getElementById("startRecord"); // つたえる / きく
const sendBtn  = document.getElementById("sendRecord");  // おくる
const statusText = document.getElementById("statusText");

// 固定ルーム
const ROOM_ID = "room-0001";
const messagesRef = collection(db, "rooms", ROOM_ID, "messages");

// ==============================
// 状態
// ==============================
let currentUid = null;
let latestParentMessage = null; // { id, text }
let hasUnreadParent = false;

// 既読管理（localStorage）
const LAST_READ_PARENT_KEY = `oyakomi_lastReadParent_${ROOM_ID}`;
const lastReadParentId = () => localStorage.getItem(LAST_READ_PARENT_KEY);
const setLastReadParentId = (id) =>
  localStorage.setItem(LAST_READ_PARENT_KEY, id);

// ==============================
// 匿名ログイン
// ==============================
signInAnonymously(auth).catch(() => {
  statusText.textContent = "ログインにしっぱいしました";
});

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  currentUid = user.uid;
  subscribeParentMessages();
  statusText.textContent = "ボタンをおしてね";
});

// ==============================
// Web Speech API（音声認識：子 → 親）
// ==============================
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (!recognition) {
  alert("このブラウザでは音声入力がつかえません");
} else {
  recognition.lang = "ja-JP";
  recognition.interimResults = false;
}

let latestTranscript = "";

if (recognition) {
  recognition.addEventListener("result", (event) => {
    latestTranscript = event.results[0][0].transcript;
  });

  recognition.addEventListener("end", async () => {
    sendBtn.classList.add("hidden");
    startBtn.classList.remove("hidden");
    startBtn.classList.remove("recording");

    if (!latestTranscript) {
      statusText.textContent = "なにも きこえなかったみたい";
      return;
    }

    statusText.textContent = "おくってるよ…";

    await addDoc(messagesRef, {
      type: "voiceText",
      role: "child",
      text: latestTranscript,
      uid: currentUid,
      createdAt: serverTimestamp(),
    });

    latestTranscript = "";
    statusText.textContent = "おくったよ！";
  });
}

// ==============================
// Web Speech API（読み上げ：親 → 子）
// ==============================

// ★ 追加：voice キャッシュ（Safari対策）
let cachedVoices = [];

function loadVoices() {
  cachedVoices = window.speechSynthesis?.getVoices?.() || [];
}

if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
}

function pickJapaneseVoice() {
  return (
    cachedVoices.find((v) => v.lang === "ja-JP") ||
    cachedVoices.find((v) => (v.lang || "").startsWith("ja")) ||
    null
  );
}

function speakParentText(text, onDone) {
  window.speechSynthesis.cancel();

  const uttr = new SpeechSynthesisUtterance(text);
  uttr.lang = "ja-JP";

  loadVoices();
  const voice = pickJapaneseVoice();
  if (voice) uttr.voice = voice;

  startBtn.classList.add("listening");
  statusText.textContent = "きいてね";

  uttr.onend = () => {
    startBtn.classList.remove("listening");
    statusText.textContent = "ボタンをおしてね";
    onDone?.();
  };

  window.speechSynthesis.speak(uttr);
}

// ==============================
// 親メッセージ購読
// ==============================
function subscribeParentMessages() {
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((ch) => {
      if (ch.type !== "added") return;

      const id = ch.doc.id;
      const data = ch.doc.data();

      if (data.role !== "parent" || data.type !== "text") return;
      if (lastReadParentId() === id) return;

      latestParentMessage = { id, text: data.text };
      hasUnreadParent = true;
      setButtonToListenMode();

      maybeNotify("おやからメッセージ", data.text || "");
    });
  });
}

// ==============================
// UI 切り替え
// ==============================
function setButtonToListenMode() {
  startBtn.classList.add("has-unread");
  startBtn.querySelector(".colorful").innerHTML =
    "<span>き</span><span>く</span>";
  statusText.textContent = "おやから きてるよ";
}

function setButtonToSpeakMode() {
  startBtn.classList.remove("has-unread");
  startBtn.querySelector(".colorful").innerHTML =
    "<span>つ</span><span>た</span><span>え</span><span>る</span>";
  statusText.textContent = "ボタンをおしてね";
}

// ==============================
// 既読保存
// ==============================
async function markParentRead(messageId) {
  setLastReadParentId(messageId);
  await updateDoc(
    doc(db, "rooms", ROOM_ID, "messages", messageId),
    { readByChildAt: serverTimestamp() }
  );
}

// ==============================
// 通知（簡易）
// ==============================
function maybeNotify(title, body) {
  if (!("Notification" in window)) return;
  if (document.visibilityState === "visible") return;

  if (Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") new Notification(title, { body });
    });
  }
}

// ==============================
// ボタン動作
// ==============================
startBtn.addEventListener("click", () => {
  if (hasUnreadParent && latestParentMessage) {
    const { id, text } = latestParentMessage;
    hasUnreadParent = false;

    speakParentText(text, async () => {
      await markParentRead(id);
      latestParentMessage = null;
      setButtonToSpeakMode();
    });
    return;
  }

  // 子どもが話す
  latestTranscript = "";
  recognition.start();
  startBtn.classList.add("hidden");
  sendBtn.classList.remove("hidden");
  startBtn.classList.add("recording");
  statusText.textContent = "はなしてね";
});

sendBtn.addEventListener("click", () => {
  recognition.stop();
  statusText.textContent = "おくってるよ…";
});
