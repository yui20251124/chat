// ===== Firebase 読み込み =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ===== 自分の firebaseConfig をここに貼る =====
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "XXXXXXX",
  appId: "XXXXXXXX"
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== DOM 要素 =====
const messagesEl = document.getElementById("messages");
const displayNameInput = document.getElementById("displayName");
const saveNameBtn = document.getElementById("saveName");

// 手書きキャンバス
const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");
const clearBtn = document.getElementById("clearCanvas");
const sendBtn = document.getElementById("sendCanvas");

// 部屋関連
const roomIdView = document.getElementById("roomIdView");
const newRoomBtn = document.getElementById("newRoom");
const copyLinkBtn = document.getElementById("copyLink");

// ===== 名前をローカル保存 =====
const savedName = localStorage.getItem("displayName");
if (savedName) displayNameInput.value = savedName;

saveNameBtn.addEventListener("click", () => {
  const name = displayNameInput.value.trim();
  if (!name) return;
  localStorage.setItem("displayName", name);
  alert(`名前を「${name}」にしました`);
});

// ===== 部屋IDの管理 =====

// ランダムな部屋IDを作る
function generateRoomId() {
  const rand = Math.random().toString(36).slice(2, 10); // 8文字くらい
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `room-${datePart}-${rand}`;
}

// URLを書き換えつつ、現在のroomIdをセット
function setRoomId(roomId) {
  currentRoomId = roomId;

  // URLのクエリパラメータ ?room=xxx を更新（履歴だけ差し替え）
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  window.history.replaceState(null, "", url.toString());

  // 表示を更新
  roomIdView.textContent = roomId;

  // Firestoreの参照を更新して購読し直す
  messagesRef = collection(db, "rooms", currentRoomId, "messages");
  subscribeMessages();
}

// 初期のroomId決定：URLに?room=があればそれを使う、なければ新規作成
const params = new URLSearchParams(location.search);
let currentRoomId = params.get("room") || generateRoomId();

let messagesRef = collection(db, "rooms", currentRoomId, "messages");
let unsubscribe = null; // onSnapshot解除用

roomIdView.textContent = currentRoomId;

// ===== 匿名ログイン =====
let currentUid = null;

signInAnonymously(auth).catch((err) => {
  console.error("匿名ログイン失敗:", err);
});

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  currentUid = user.uid;
  // ログインしたら部屋IDを正式にセット（subscribeもそこでやる）
  setRoomId(currentRoomId);
});

// ===== メッセージ購読（リアルタイム） =====
function subscribeMessages() {
  // すでに購読中なら解除
  if (unsubscribe) {
    unsubscribe();
  }

  const q = query(messagesRef, orderBy("createdAt", "asc"));

  unsubscribe = onSnapshot(q, (snapshot) => {
    messagesEl.innerHTML = "";
    snapshot.forEach((doc) => {
      renderMessage(doc.data());
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function renderMessage(data) {
  const li = document.createElement("li");
  li.classList.add("message");

  const isMe = data.uid === currentUid;
  li.classList.add(isMe ? "me" : "other");

  const meta = document.createElement("div");
  meta.classList.add("meta");
  meta.textContent = data.displayName || "ななし";
  li.appendChild(meta);

  // 手書き画像メッセージ
  if (data.type === "image" && data.image) {
    const img = document.createElement("img");
    img.src = data.image; // dataURL
    li.appendChild(img);
  }

  messagesEl.appendChild(li);
}

// ===== キャンバス描画（PC & iPhone両対応） =====
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 220;
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

let drawing = false;
let lastX = 0;
let lastY = 0;

function startDraw(x, y) {
  drawing = true;
  lastX = x;
  lastY = y;
}
function drawLine(x, y) {
  if (!drawing) return;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#333";
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  lastX = x;
  lastY = y;
}
function endDraw() {
  drawing = false;
}

// マウス
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  startDraw(e.clientX - rect.left, e.clientY - rect.top);
});
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  drawLine(e.clientX - rect.left, e.clientY - rect.top);
});
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mouseleave", endDraw);

// タッチ（スマホ）
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  startDraw(t.clientX - rect.left, t.clientY - rect.top);
});
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  drawLine(t.clientX - rect.left, t.clientY - rect.top);
});
canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  endDraw();
});

// ===== ボタン動作 =====
clearBtn.addEventListener("click", () => {
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
});

// 手書き画像を Firestore に送信
sendBtn.addEventListener("click", async () => {
  const displayName = displayNameInput.value.trim() || "ななし";
  const dataUrl = canvas.toDataURL("image/png"); // キャンバス → dataURL

  try {
    await addDoc(messagesRef, {
      type: "image",
      image: dataUrl,
      displayName,
      uid: currentUid,
      createdAt: serverTimestamp()
    });

    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } catch (err) {
    console.error("送信エラー:", err);
    alert("送信に失敗しました…");
  }
});

// ===== 新しい部屋を作る =====
newRoomBtn.addEventListener("click", () => {
  const ok = confirm("新しい文通部屋を作りますか？\n（今の部屋のメッセージはそのまま残ります）");
  if (!ok) return;

  const newId = generateRoomId();
  setRoomId(newId);
  messagesEl.innerHTML = "";
});

// ===== 招待リンクをコピー =====
copyLinkBtn.addEventListener("click", async () => {
  const url = new URL(window.location.href);
  url.searchParams.set("room", currentRoomId);
  const link = url.toString();

  try {
    await navigator.clipboard.writeText(link);
    alert("この部屋の招待リンクをコピーしました📮\nそのまま相手に貼り付けて送ってね。");
  } catch (err) {
    console.error("コピーに失敗:", err);
    alert("コピーできませんでした… 手動でURLをコピーしてください。");
  }
});
