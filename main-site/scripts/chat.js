/* ══════════════════════════════════════════════════════════════
   Nexora AI Chat Widget
   ══════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const API_URL = "/api/chat";
  const STORAGE_KEY = "nexora-ai-session-id";
  const MAX_HISTORY = 80;

  function ensureWidgetMarkup() {
    if (document.getElementById("chat-fab") && document.getElementById("chat-widget")) return;

    document.body.insertAdjacentHTML(
      "beforeend",
      `<button class="chat-fab" id="chat-fab" type="button" aria-label="Nexora AI söhbətini aç" aria-controls="chat-widget" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </button>
      <section class="chat-widget" id="chat-widget" aria-label="Nexora AI köməkçisi" hidden>
        <div class="chat-widget__header">
          <div class="chat-widget__identity">
            <div class="chat-widget__avatar" aria-hidden="true">✦</div>
            <div><h3>Nexora AI</h3><p>Kurs seçimi üzrə köməkçi</p></div>
          </div>
          <button class="chat-widget__close" id="chat-close" type="button" aria-label="Söhbəti bağla">&times;</button>
        </div>
        <div class="chat-widget__messages" id="chat-messages" role="log" aria-live="polite"></div>
        <div class="chat-widget__composer">
          <form class="chat-widget__form" id="chat-form" novalidate>
            <label class="sr-only" for="chat-input">Mesajınız</label>
            <textarea class="chat-widget__input" id="chat-input" name="message" rows="1" maxlength="2000" placeholder="Kurslar haqqında sualınızı yazın..." autocomplete="off" required></textarea>
            <button class="chat-widget__send" id="chat-send" type="submit" aria-label="Mesajı göndər" disabled>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 14-7-4.4 14-2.5-5.1L5 12Z"/><path d="m12.1 13.9 3.6-3.7"/></svg>
            </button>
          </form>
        </div>
      </section>`,
    );
  }

  ensureWidgetMarkup();

  let sessionId = getOrCreateSessionId();
  let pending = false;
  let history = [];
  let requestController = null;
  let lastRequest = null;
  let initialized = false;
  let resizeFrame = 0;
  const actionButtons = new Set();

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `nexora-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getOrCreateSessionId() {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const created = createId();
      window.localStorage.setItem(STORAGE_KEY, created);
      return created;
    } catch (_) {
      return createId();
    }
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  const elements = {
    fab: $("#chat-fab"),
    widget: $("#chat-widget"),
    close: $("#chat-close"),
    messages: $("#chat-messages"),
    form: $("#chat-form"),
    input: $("#chat-input"),
    send: $("#chat-send"),
  };

  let {
    fab,
    widget,
    close: closeBtn,
    messages: messagesEl,
    form: chatForm,
    input: chatInput,
    send: chatSend,
  } = elements;

  if (!fab || !widget) return;

  fab.setAttribute("aria-label", "Nexora AI söhbətini aç");
  fab.setAttribute("aria-controls", "chat-widget");
  fab.setAttribute("aria-expanded", "false");
  closeBtn.setAttribute("aria-label", "Söhbəti bağla");
  chatInput.setAttribute("placeholder", "Kurslar haqqında sualınızı yazın...");
  chatSend.setAttribute("aria-label", "Mesajı göndər");
  const assistantSubtitle = $(".chat-widget__identity p", widget);
  if (assistantSubtitle) assistantSubtitle.textContent = "Kurs seçimi üzrə köməkçi";

  function resizeInput() {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
    });
  }

  function normalizeText(v, fb) {
    return typeof v === "string" ? v : fb || "";
  }

  /* ── Open / Close ── */
  let isOpen = false;

  function openWidget() {
    if (isOpen) {
      closeWidget();
      return;
    }
    widget.hidden = false;
    isOpen = true;
    requestAnimationFrame(() => {
      widget.classList.add("open");
      fab.classList.add("chat-fab--active");
      fab.setAttribute("aria-expanded", "true");
      chatInput.focus();
    });
    if (!initialized) {
      initialized = true;
      initConversation();
    }
  }

  function closeWidget() {
    isOpen = false;
    widget.classList.remove("open");
    fab.classList.remove("chat-fab--active");
    fab.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      widget.hidden = true;
    }, 300);
  }

  fab.addEventListener("click", openWidget);
  closeBtn.addEventListener("click", closeWidget);
  widget.addEventListener("click", (e) => {
    if (e.target === widget) closeWidget();
  });

  /* ── Messages ── */
  function addMessage(role, text, response) {
    const wrap = document.createElement("div");
    wrap.className = "chat-msg" + (role === "user" ? " chat-msg--user" : "");

    const avatar = document.createElement("div");
    avatar.className = "chat-msg__avatar";
    avatar.textContent = "✦";

    const body = document.createElement("div");

    const bubble = document.createElement("div");
    bubble.className = "chat-msg__bubble";
    bubble.textContent = normalizeText(text, "Cavab alınmadı.");
    body.appendChild(bubble);

    if (role === "assistant" && response) {
      const actions = response.actions || [];
      if (actions.length) {
        const actionsWrap = document.createElement("div");
        actionsWrap.className = "chat-msg__actions";
        actions.forEach((a) => {
          const label = normalizeText(a?.label).trim();
          const value = normalizeText(a?.value, label).trim();
          if (!label || !value) return;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "chat-action-btn";
          btn.textContent = label;
          btn.addEventListener("click", () => {
            if (!pending) sendMessage(value, label);
          });
          actionButtons.add(btn);
          actionsWrap.appendChild(btn);
        });
        body.appendChild(actionsWrap);
      }

      const courses = response.courses || [];
      if (courses.length) {
        const coursesWrap = document.createElement("div");
        coursesWrap.className = "chat-msg__courses";
        courses.forEach((c) => {
          const card = document.createElement("div");
          card.className = "chat-course";

          const top = document.createElement("div");
          top.className = "chat-course__top";
          const category = document.createElement("span");
          category.className = "chat-course__category";
          const price = document.createElement("span");
          price.className = "chat-course__price";
          top.appendChild(category);
          top.appendChild(price);

          const name = document.createElement("div");
          name.className = "chat-course__name";

          const meta = document.createElement("div");
          meta.className = "chat-course__meta";

          const tools = document.createElement("div");
          tools.className = "chat-course__tools";

          card.appendChild(top);
          card.appendChild(name);
          card.appendChild(meta);
          card.appendChild(tools);

          category.textContent = normalizeText(c?.category, "Kurs");
          name.textContent = normalizeText(c?.name, "Nexora kursu");
          price.textContent = Number.isFinite(c?.price) ? c.price + " AZN" : "";
          [
            c?.level,
            c?.instructor,
            [c?.schedule?.days, c?.schedule?.time].filter(Boolean).join(" · "),
          ]
            .filter(Boolean)
            .forEach((m) => {
              const s = document.createElement("span");
              s.textContent = m;
              meta.appendChild(s);
            });
          (Array.isArray(c?.tools) ? c.tools.slice(0, 5) : []).forEach((t) => {
            const tag = document.createElement("span");
            tag.className = "chat-course__tool";
            tag.textContent = t;
            tools.appendChild(tag);
          });
          coursesWrap.appendChild(card);
        });
        body.appendChild(coursesWrap);
      }
    }

    wrap.appendChild(avatar);
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    history.push({ role, text: normalizeText(text), response });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    scrollToBottom();
  }

  function addError(text) {
    const banner = document.createElement("div");
    banner.className = "chat-error";
    banner.innerHTML = '<span></span><button type="button">Yenidən cəhd et</button>';
    banner.querySelector("span").textContent = text;
    banner.querySelector("button").addEventListener("click", () => {
      banner.remove();
      if (lastRequest)
        sendMessage(lastRequest.value, lastRequest.display, { silent: true });
    });
    messagesEl.appendChild(banner);
    scrollToBottom();
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "chat-typing";
    el.id = "chat-active-typing";
    el.innerHTML =
      '<div class="chat-msg__avatar">✦</div><div class="chat-typing__dots"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById("chat-active-typing");
    if (el) el.remove();
  }

  function setPending(v) {
    pending = v;
    chatInput.disabled = v;
    chatSend.disabled = v || !chatInput.value.trim();
    actionButtons.forEach((b) => {
      b.disabled = v || b.dataset.used === "true";
    });
  }

  /* ── API ── */
  async function requestChat(message) {
    requestController?.abort();
    requestController = new AbortController();
    const tid = setTimeout(() => requestController.abort(), 35000);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ message, sessionId, conversationId: sessionId }),
        signal: requestController.signal,
      });
      if (!res.ok) throw new Error("Server " + res.status);
      const data = await res.json();
      if (!data || typeof data.reply !== "string")
        throw new Error("Invalid response");
      return data;
    } finally {
      clearTimeout(tid);
    }
  }

  async function sendMessage(value, display, opts) {
    const msg = normalizeText(value).trim();
    if (!msg || pending) return;
    lastRequest = { value: msg, display };
    actionButtons.forEach((b) => {
      b.dataset.used = "true";
      b.disabled = true;
    });
    if (!opts?.silent) addMessage("user", display || msg);
    setPending(true);
    showTyping();
    try {
      const data = await requestChat(msg);
      hideTyping();
      addMessage("assistant", data.reply, data);
    } catch (err) {
      hideTyping();
      const aborted = err?.name === "AbortError";
      addError(
        aborted ? "Sorğunun vaxtı bitdi. Yenidən cəhd edin." : "AI köməkçiyə qoşulmaq mümkün olmadı.",
      );
    } finally {
      setPending(false);
      chatInput.focus();
    }
  }

  async function initConversation() {
    setPending(true);
    showTyping();
    try {
      const data = await requestChat("/start");
      hideTyping();
      addMessage("assistant", data.reply, data);
    } catch (_) {
      hideTyping();
      addError("AI köməkçi hazırda cavab vermir. Bir az sonra yenidən cəhd edin.");
    } finally {
      setPending(false);
    }
  }

  function resetChat() {
    requestController?.abort();
    sessionId = createId();
    try {
      localStorage.setItem(STORAGE_KEY, sessionId);
    } catch (_) {}
    history = [];
    lastRequest = null;
    messagesEl.innerHTML = "";
    actionButtons.clear();
    chatInput.value = "";
    cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
    resizeInput();
    initialized = true;
    initConversation();
  }

  /* ── Events ── */
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = chatInput.value.trim();
    if (!v || pending) return;
    chatInput.value = "";
    resizeInput();
    chatSend.disabled = true;
    sendMessage(v);
  });

  chatInput.addEventListener("input", () => {
    if (!resizeFrame) {
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        resizeInput();
      });
    }
    chatSend.disabled = pending || !chatInput.value.trim();
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  const newChatBtn = $("#chat-new-btn");
  if (newChatBtn) newChatBtn.addEventListener("click", resetChat);
})();
