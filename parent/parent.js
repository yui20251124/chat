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
const messageListEl = document.getElementById("messageList");
const replyInputEl = document.getElementById("replyText");
const sendBtnEl = document.getElementById("sendBtn");
const roomIdTextEl = document.getElementById("roomIdText");

// ひとまず固定ルーム（子ども側も同じIDを使う想定）
const ROOM_ID = "room-0001";
roomIdTextEl.textContent = ROOM_ID;

let messagesRef = null;
let unsubscribe = null;
let currentUid = null;

// ==============================
// 匿名ログイン
// ==============================
signInAnonymously(auth).catch((err) => {
  console.error("匿名ログイン失敗:", err);
  alert("ログインに失敗しました（コンソールを確認してね）");
});

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  currentUid = user.uid;
  console.log("auth OK uid:", currentUid);

  // Firestore の参照セット
  messagesRef = collection(db, "rooms", ROOM_ID, "messages");
  subscribeMessages();
});

// ==============================
// Firestore リアルタイム購読
// ==============================
function subscribeMessages() {
  if (!messagesRef) return;
  if (unsubscribe) unsubscribe();

  const q = query(messagesRef, orderBy("createdAt", "asc"));

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      messageListEl.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        renderMessage(data);
      });

      // 一番下までスクロール
      messageListEl.scrollTop = messageListEl.scrollHeight;
    },
    (err) => {
      console.error("onSnapshot エラー:", err);
    }
  );
}

// ==============================
// メッセージ描画（LINE風）
// こども: role === "child", type: "audio"
// おや  : role === "parent", type: "text"
// ==============================
function renderMessage(data) {
  const li = document.createElement("li");
  li.classList.add("message");

  const isParent = data.role === "parent";

  if (isParent) {
    li.classList.add("from-parent");
  } else {
    li.classList.add("from-child");
  }

  // ---- 上部メタ（だれから / 時刻） ----
  const meta = document.createElement("div");
  meta.classList.add("msg-meta");

  const fromSpan = document.createElement("span");
  fromSpan.classList.add("msg-from");
  fromSpan.textContent = isParent ? "あなた → こども" : "こども → あなた";

  const timeSpan = document.createElement("span");
  timeSpan.classList.add("msg-time");
  if (data.createdAt?.toDate) {
    const d = data.createdAt.toDate();
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    timeSpan.textContent = `${h}:${m}`;
  } else {
    timeSpan.textContent = "";
  }

  meta.appendChild(fromSpan);
  meta.appendChild(timeSpan);

  // ---- 本文エリア ----
  const body = document.createElement("div");
  body.classList.add("msg-body");

  const tag = document.createElement("div");
  tag.classList.add("msg-tag");

  // テキスト部分（あれば）
  const textP = document.createElement("p");
  textP.classList.add("msg-text");

  // ==== 親 → 子（テキスト → 読み上げ） ====
  if (isParent) {
    tag.classList.add("tag-tts");
    tag.textContent = "よみあげ";

    textP.textContent = data.text || "";
    body.appendChild(tag);
    body.appendChild(textP);

    // 将来：TTS用の設定ボタンなどをここに追加もできる
  }
  // ==== 子 → 親（音声 or 文字） ====
  else {
    // 音声メッセージ
    if (data.type === "audio" && data.audioDataUrl) {
      tag.classList.add("tag-voice");
      tag.textContent = "ボイメ";

      body.appendChild(tag);

      // 音声プレーヤー
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = data.audioDataUrl;
      audio.classList.add("msg-audio");
      body.appendChild(audio);

      // もし文字起こしがあれば表示（まだなければスキップ）
      if (data.text) {
        const transcript = document.createElement("p");
        transcript.classList.add("msg-text", "msg-transcript");
        transcript.textContent = data.text;
        body.appendChild(transcript);
      }
    } else {
      // 文字だけ来た場合（将来の拡張用）
      tag.classList.add("tag-voice");
      tag.textContent = "こども";

      textP.textContent = data.text || "";
      body.appendChild(tag);
      body.appendChild(textP);
    }
  }

  li.appendChild(meta);
  li.appendChild(body);
  messageListEl.appendChild(li);
}

// ==============================
// 送信処理（親 → 子 : テキスト）
// ==============================
sendBtnEl.addEventListener("click", async () => {
  console.log("send clicked");

  const text = replyInputEl.value.trim();
  console.log("text:", text);

  if (!text) {
    console.log("no text");
    return;
  }
  if (!messagesRef) {
    alert("まだログイン処理が終わっていません");
    return;
  }

  try {
    console.log("writing to firestore...");

    await addDoc(messagesRef, {
  type: "text",
  role: "parent",
  text: text,          // ← ここに読み上げたい日本語
  createdAt: serverTimestamp(),
});

    console.log("firestore write done");
    replyInputEl.value = "";
  } catch (e) {
    console.error("firestore error", e);
    alert("送信に失敗しました（コンソールを見てね）");
  }
});
