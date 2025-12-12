// ==============================
// Firebase 読み込み
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
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
const startBtn = document.getElementById("startRecord"); // つたえる
const sendBtn = document.getElementById("sendRecord");   // おくる
const statusText = document.getElementById("statusText");

// 固定ルーム（親側と合わせる）
const ROOM_ID = "room-0001";
let messagesRef = collection(db, "rooms", ROOM_ID, "messages");

// ==============================
// 匿名ログイン
// ==============================
let currentUid = null;

signInAnonymously(auth).catch((err) => {
  console.error("匿名ログイン失敗:", err);
  statusText.textContent = "ログインにしっぱいしました";
});

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  currentUid = user.uid;
  console.log("kids auth OK:", currentUid);
});

// ==============================
// Web Speech API（音声認識）
// ==============================
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  // 対応してないブラウザ
  alert("このブラウザでは音声入力がつかえません。（Chrome 系推奨）");
  statusText.textContent = "おとがつかえない きかいみたい…";
}

// 認識インスタンス
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

// 日本語 & シンプル設定
if (recognition) {
  recognition.lang = "ja-JP";
  recognition.interimResults = false; // 確定した結果だけ
  recognition.maxAlternatives = 1;
}

let latestTranscript = ""; // 直近のテキストを保持

// ==============================
// 音声認識イベント
// ==============================
if (recognition) {
  // 結果が返ってきたとき
  recognition.addEventListener("result", (event) => {
    const text = event.results[0][0].transcript;
    console.log("speech result:", text);
    latestTranscript = text;
  });

  // 認識終了（ユーザーが黙る / 手動停止）
  recognition.addEventListener("end", async () => {
    // ボタン表示を元に戻す
    sendBtn.classList.add("hidden");
    startBtn.classList.remove("hidden");
    startBtn.classList.remove("recording");

    if (!latestTranscript) {
      statusText.textContent = "なにも きこえなかったみたい";
      return;
    }

    statusText.textContent = "おくってるよ…";

    try {
      await addDoc(messagesRef, {
        type: "voiceText",      // 子ども → 親の音声テキスト
        role: "child",
        text: latestTranscript, // ここが親画面に表示される
        uid: currentUid || null,
        createdAt: serverTimestamp(),
      });

      console.log("kids message sent:", latestTranscript);
      statusText.textContent = "おくったよ！";
      latestTranscript = "";
    } catch (e) {
      console.error("firestore error:", e);
      statusText.textContent = "おくるのに しっぱいしちゃった";
    }
  });

  recognition.addEventListener("error", (e) => {
    console.error("speech error:", e);
    statusText.textContent = "おとを ひろえなかったみたい";
    // ボタンも戻しておく
    sendBtn.classList.add("hidden");
    startBtn.classList.remove("hidden");
    startBtn.classList.remove("recording");
  });
}

// ==============================
// ボタンの動き
// ==============================

// つたえる（録音・認識スタート）
startBtn.addEventListener("click", () => {
  if (!recognition) return;
  if (!currentUid) {
    alert("まだ準備ちゅう… もういちど おしてね");
    return;
  }

  latestTranscript = "";
  recognition.start();

  startBtn.classList.add("hidden");
  sendBtn.classList.remove("hidden");
  startBtn.classList.add("recording");
  statusText.textContent = "はなしてね";
});

// おくる（手動で認識ストップ → end イベントで送信）
sendBtn.addEventListener("click", () => {
  if (!recognition) return;
  recognition.stop();
  statusText.textContent = "おくってるよ…";
});
