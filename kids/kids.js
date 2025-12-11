const startBtn = document.getElementById("startRecord");
const sendBtn = document.getElementById("sendRecord");
const statusText = document.getElementById("statusText");

let mediaRecorder;
let audioChunks = [];

// マイク取得
async function setupRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (e) => {
    audioChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(audioChunks, { type: "audio/webm" });
    audioChunks = [];

    const audioURL = URL.createObjectURL(blob);
    const audio = new Audio(audioURL);
    audio.play(); // デバッグ用：その場で再生
  };
}

// 初期化
setupRecorder();

// つたえる（録音開始）
startBtn.addEventListener("click", () => {
  mediaRecorder.start();
  startBtn.classList.add("hidden");
  sendBtn.classList.remove("hidden");
  startBtn.classList.add("recording");

  statusText.textContent = "ろくおんちゅう…";
});

// おくる（録音停止）
sendBtn.addEventListener("click", () => {
  mediaRecorder.stop();

  sendBtn.classList.add("hidden");
  startBtn.classList.remove("hidden");
  startBtn.classList.remove("recording");

  statusText.textContent = "おくったよ！";
});
