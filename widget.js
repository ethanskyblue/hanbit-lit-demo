/*
 * LTI Korea 홈페이지 임베드 챗봇 위젯
 * ------------------------------------
 * 사용법: 홈페이지 </body> 직전에 아래 한 줄만 추가하면 됩니다.
 *
 *   <script
 *     src="https://YOUR-DOMAIN/widget.js"
 *     data-api-url="https://YOUR-BACKEND-DOMAIN/api/chat"
 *     data-title="한국문학번역원 안내 챗봇"
 *   ></script>
 *
 * data-api-url 은 server.py 를 배포한 백엔드 주소의 /api/chat 경로입니다.
 */
(function () {
  var scriptTag = document.currentScript;
  var API_URL = scriptTag.getAttribute("data-api-url") || "/api/chat";
  var TITLE = scriptTag.getAttribute("data-title") || "AI 안내 챗봇";
  var GREETING =
    scriptTag.getAttribute("data-greeting") ||
    "안녕하세요! 한국문학번역원 홈페이지 안내 챗봇입니다. 사업안내, 지원사업, 자주 묻는 질문 등에 대해 답변해 드려요.";

  var history = [];

  var style = document.createElement("style");
  style.textContent = `
    #lti-chat-bubble {
      position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px;
      border-radius: 50%; background: #1f3c88; color: #fff; border: none;
      cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.25); z-index: 999999;
      font-size: 26px; display: flex; align-items: center; justify-content: center;
    }
    #lti-chat-window {
      position: fixed; bottom: 96px; right: 24px; width: 360px; max-width: 92vw;
      height: 520px; max-height: 75vh; background: #fff; border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25); display: none; flex-direction: column;
      overflow: hidden; z-index: 999999; font-family: "Malgun Gothic", sans-serif;
    }
    #lti-chat-header {
      background: #1f3c88; color: #fff; padding: 14px 16px; font-weight: bold;
      display: flex; justify-content: space-between; align-items: center; font-size: 15px;
    }
    #lti-chat-header button { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; }
    #lti-chat-body { flex: 1; overflow-y: auto; padding: 12px; background: #f7f8fa; }
    .lti-msg { margin-bottom: 10px; max-width: 85%; line-height: 1.4; font-size: 13.5px; white-space: pre-wrap; }
    .lti-msg.user { margin-left: auto; background: #1f3c88; color: #fff; padding: 8px 12px; border-radius: 12px 12px 2px 12px; }
    .lti-msg.bot { margin-right: auto; background: #fff; border: 1px solid #e2e4e8; padding: 8px 12px; border-radius: 12px 12px 12px 2px; }
    .lti-msg .lti-sources { margin-top: 6px; font-size: 11.5px; color: #666; }
    .lti-msg .lti-sources a { color: #1f3c88; text-decoration: underline; }
    #lti-chat-inputRow { display: flex; border-top: 1px solid #e2e4e8; }
    #lti-chat-input { flex: 1; border: none; padding: 12px; font-size: 13.5px; outline: none; }
    #lti-chat-send { border: none; background: #1f3c88; color: #fff; padding: 0 16px; cursor: pointer; font-size: 13.5px; }
    #lti-chat-send:disabled { background: #9aa5c4; cursor: default; }
  `;
  document.head.appendChild(style);

  var bubble = document.createElement("button");
  bubble.id = "lti-chat-bubble";
  bubble.setAttribute("aria-label", TITLE);
  bubble.textContent = "💬";
  document.body.appendChild(bubble);

  var win = document.createElement("div");
  win.id = "lti-chat-window";
  win.innerHTML =
    '<div id="lti-chat-header"><span>' +
    TITLE +
    '</span><button id="lti-chat-close" aria-label="닫기">×</button></div>' +
    '<div id="lti-chat-body"></div>' +
    '<div id="lti-chat-inputRow">' +
    '<input id="lti-chat-input" type="text" placeholder="궁금한 점을 입력하세요..." />' +
    '<button id="lti-chat-send">전송</button>' +
    "</div>";
  document.body.appendChild(win);

  var body = win.querySelector("#lti-chat-body");
  var input = win.querySelector("#lti-chat-input");
  var sendBtn = win.querySelector("#lti-chat-send");

  function addMessage(role, text, sources) {
    var el = document.createElement("div");
    el.className = "lti-msg " + (role === "user" ? "user" : "bot");
    el.textContent = text;
    if (sources && sources.length) {
      var srcEl = document.createElement("div");
      srcEl.className = "lti-sources";
      srcEl.innerHTML =
        "참고: " +
        sources
          .map(function (s) {
            return '<a href="' + s.url + '" target="_blank" rel="noopener">' + s.title + "</a>";
          })
          .join(", ");
      el.appendChild(srcEl);
    }
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  var greeted = false;
  function openWindow() {
    win.style.display = "flex";
    bubble.style.display = "none";
    if (!greeted) {
      addMessage("bot", GREETING);
      greeted = true;
    }
    input.focus();
  }
  function closeWindow() {
    win.style.display = "none";
    bubble.style.display = "flex";
  }

  bubble.addEventListener("click", openWindow);
  win.querySelector("#lti-chat-close").addEventListener("click", closeWindow);

  async function sendMessage() {
    var text = input.value.trim();
    if (!text) return;
    addMessage("user", text);
    input.value = "";
    sendBtn.disabled = true;

    var thinkingEl = document.createElement("div");
    thinkingEl.className = "lti-msg bot";
    thinkingEl.textContent = "답변을 준비하고 있어요...";
    body.appendChild(thinkingEl);
    body.scrollTop = body.scrollHeight;

    try {
      var res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();

      thinkingEl.remove();
      addMessage("bot", data.answer, data.sources);

      history.push({ role: "user", content: text });
      history.push({ role: "assistant", content: data.answer });
    } catch (err) {
      thinkingEl.remove();
      addMessage(
        "bot",
        "죄송합니다. 답변을 가져오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
      );
      console.error("LTI chat widget error:", err);
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendMessage();
  });
})();
