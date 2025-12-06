// Flame Division Partner Dashboard v0
// Neural background + TTS + local "vector" ledger brain + payload generator.

// ================================
// 1. NEURAL / "UNREAL" BACKGROUND
// ================================
(function () {
  const canvas = document.getElementById("bg-neural");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let width, height, points;
  let mouseX = 0.5;
  let mouseY = 0.5;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createPoints();
  }

  function createPoints() {
    const count = Math.floor((width * height) / 35000); // density
    points = [];
    for (let i = 0; i < count; i++) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX / window.innerWidth;
    mouseY = e.clientY / window.innerHeight;
  });

  function step() {
    if (!width || !height) return;

    // Soft trail instead of full clear = "unreal" motion
    ctx.fillStyle = "rgba(6, 7, 18, 0.6)";
    ctx.fillRect(0, 0, width, height);

    // ember nodes
    ctx.fillStyle = "rgba(212, 175, 55, 0.8)"; // ember gold

    const t = Date.now() * 0.001;
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.7);
    const maxDist = 140 * pulse;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      // glow points
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();

      for (let j = i + 1; j < points.length; j++) {
        const q = points[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alphaBase = 1 - dist / maxDist;

          // extra glow near "focus" (mouse)
          const fx = (p.x + q.x) * 0.5 / width - mouseX;
          const fy = (p.y + q.y) * 0.5 / height - mouseY;
          const focusDist = Math.sqrt(fx * fx + fy * fy);
          const focusBoost = 1 - Math.min(focusDist * 2, 1); // 0..1

          const alpha = alphaBase * (0.5 + focusBoost * 0.5);
          if (alpha <= 0) continue;

          ctx.strokeStyle = "rgba(212, 175, 55," + alpha * 0.6 + ")";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(step);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(step);
})();

// ================================
// 2. TTS + LOCAL LEDGER "BRAIN"
// ================================
(function () {
  // ---- TTS SETUP ----
  const tts = {
    synth: "speechSynthesis" in window ? window.speechSynthesis : null,
    supported:
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined",
    current: null,
  };

  function stopSpeech() {
    if (tts.synth && tts.synth.speaking) {
      tts.synth.cancel();
      tts.current = null;
    }
  }

  function speak(text) {
    if (!tts.supported || !text) return;
    stopSpeech();

    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    u.onend = () => (tts.current = null);
    tts.current = u;
    tts.synth.speak(u);
  }

  if (tts.synth) {
    try {
      tts.synth.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        tts.synth.getVoices();
      };
    } catch (e) {
      console.warn("TTS preload issue:", e);
    }
  }

  // ---- SIMPLE LOCAL "VECTOR" LEDGER ----
  const LEDGER_KEY = "flame_partner_ledger_v0";

  function tokenize(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  const ledger = {
    entries: [],

    load() {
      let raw = null;
      try {
        raw = localStorage.getItem(LEDGER_KEY);
      } catch (_) {
        raw = null;
      }
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed;
        }
      } catch (e) {
        console.warn("Ledger load error:", e);
      }
    },

    save() {
      try {
        localStorage.setItem(LEDGER_KEY, JSON.stringify(this.entries));
      } catch (e) {
        console.warn("Ledger save error:", e);
      }
    },

    add(entry) {
      this.entries.push(entry);
      // keep recent first
      this.entries.sort((a, b) =>
        a.timestamp < b.timestamp ? 1 : -1
      );
      this.save();
    },

    // "vector-style" matcher = token overlap score
    search(query) {
      const trimmed = (query || "").trim();
      if (!trimmed) {
        return this.entries.map((e) => ({ entry: e, score: null }));
      }

      const qTokens = tokenize(trimmed);
      if (!qTokens.length) {
        return this.entries.map((e) => ({ entry: e, score: null }));
      }

      const results = [];

      for (const e of this.entries) {
        const haystackText =
          (e.buyerName || "") +
          " " +
          (e.product || "") +
          " " +
          (e.proof || "") +
          " " +
          (e.notes || "");

        const hTokens = new Set(tokenize(haystackText));
        let hits = 0;
        for (const t of qTokens) {
          if (hTokens.has(t)) hits++;
        }
        const score = hits / qTokens.length;

        if (score > 0) {
          results.push({ entry: e, score });
        }
      }

      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.entry.timestamp < b.entry.timestamp ? 1 : -1;
      });

      return results;
    },
  };

  function renderLedgerResults(items, box) {
    if (!box) return;

    box.innerHTML = "";

    if (!items || !items.length) {
      const empty = document.createElement("p");
      empty.className = "tiny muted";
      empty.textContent =
        "No saved reports yet. Generate a report payload to start building your ledger.";
      box.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const entry = item.entry || item;
      const score = item.score;

      const card = document.createElement("article");
      card.className = "ledger-entry-card";

      const header = document.createElement("div");
      header.className = "lec-header";

      const product = document.createElement("span");
      product.className = "lec-product";
      product.textContent = entry.product || "Unnamed product";

      header.appendChild(product);

      if (typeof score === "number") {
        const s = document.createElement("span");
        s.className = "lec-score tiny";
        s.textContent = "Match: " + Math.round(score * 100) + "%";
        header.appendChild(s);
      }

      const meta = document.createElement("div");
      meta.className = "lec-meta small";

      const parts = [];
      if (entry.partnerHandle) parts.push("@" + entry.partnerHandle);
      if (entry.buyerName) parts.push(entry.buyerName);
      if (entry.purchaseDate) parts.push(entry.purchaseDate);
      if (entry.amount) parts.push(entry.amount);

      meta.textContent = parts.join(" · ");

      const notes = document.createElement("p");
      notes.className = "lec-notes tiny";

      const snippetSource = entry.notes || entry.proof || "";
      const snippet =
        snippetSource.length > 140
          ? snippetSource.slice(0, 137) + "..."
          : snippetSource;
      notes.textContent = snippet || "No extra notes on this report.";

      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(notes);

      box.appendChild(card);
    });
  }

  // ---- DOM WIRING ----
  document.addEventListener("DOMContentLoaded", () => {
    const btnTts = document.getElementById("btn-tts-dash");
    const form = document.getElementById("report-form");
    const msg = document.getElementById("report-message");
    const payloadBox = document.getElementById("report-payload");
    const btnCopy = document.getElementById("btn-copy-payload");

    const handleInput = document.getElementById("partner-handle");
    const emailInput = document.getElementById("partner-email");

    const searchInput = document.getElementById("ledger-search-input");
    const searchBtn = document.getElementById("ledger-search-btn");
    const resultsBox = document.getElementById("ledger-search-results");

    // Load local ledger on startup
    ledger.load();
    if (resultsBox) {
      renderLedgerResults(
        ledger.entries.map((e) => ({ entry: e, score: null })),
        resultsBox
      );
    }

    // Prefill handle from query or localStorage
    (function prefillHandle() {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("handle");

      let storedHandle = null;
      try {
        storedHandle = localStorage.getItem("flame_partner_handle");
      } catch (_) {
        storedHandle = null;
      }

      const chosen = fromUrl || storedHandle;
      if (chosen && handleInput && !handleInput.value) {
        handleInput.value = chosen;
      }
    })();

    // Prefill email from storage if available
    (function prefillEmail() {
      let storedEmail = null;
      try {
        storedEmail = localStorage.getItem("flame_partner_email");
      } catch (_) {
        storedEmail = null;
      }
      if (storedEmail && emailInput && !emailInput.value) {
        emailInput.value = storedEmail;
      }
    })();

    // TTS button
    if (btnTts) {
      btnTts.addEventListener("click", () => {
        if (!tts.supported) {
          alert(
            "Text-to-speech is not available in this browser. Try Chrome, Edge, or Safari."
          );
          return;
        }

        const script =
          "Welcome to the Flame Division partner dashboard. " +
          "This is a manual ledger. You log the enrollments you believe you sourced. " +
          "We verify each report against Stripe and internal records, and pay out on cleared, verified enrollments only. " +
          "Fill in your handle, the buyer, what they purchased, and when. " +
          "Add a short description or proof link, generate the report payload, and send it to the Flame Division review channel. " +
          "Your reports are also stored locally in this browser so you can search your ledger over time.";
        speak(script);
      });
    }

    // Form submit → build payload + add to ledger
    if (form) {
      form.addEventListener("submit", (evt) => {
        evt.preventDefault();
        msg.textContent = "";
        msg.className = "form-message";

        const data = {
          partnerHandle: handleInput.value.trim(),
          partnerEmail: emailInput.value.trim(),
          buyerName: form.buyerName.value.trim(),
          product: form.product.value.trim(),
          purchaseDate: form.purchaseDate.value,
          amount: form.amount.value.trim(),
          proof: form.proof.value.trim(),
          notes: form.notes.value.trim(),
          confirm: document.getElementById("confirm-true").checked,
          timestamp: new Date().toISOString(),
        };

        if (
          !data.partnerHandle ||
          !data.partnerEmail ||
          !data.buyerName ||
          !data.product ||
          !data.purchaseDate ||
          !data.proof ||
          !data.confirm
        ) {
          msg.textContent =
            "Please complete all required fields and confirm the accuracy checkbox.";
          msg.classList.add("error");
          return;
        }

        // Persist handle / email for convenience
        try {
          localStorage.setItem("flame_partner_handle", data.partnerHandle);
          localStorage.setItem("flame_partner_email", data.partnerEmail);
        } catch (_) {}

        const lines = [
          "Flame Division Partner Enrollment Report",
          "---------------------------------------",
          `Partner handle: ${data.partnerHandle}`,
          `Partner email: ${data.partnerEmail}`,
          "",
          `Buyer name / company: ${data.buyerName}`,
          `Product / tier: ${data.product}`,
          `Approx. purchase date: ${data.purchaseDate}`,
          data.amount ? `Approx. amount paid: ${data.amount}` : "",
          "",
          "Evidence / context:",
          data.proof,
          "",
          data.notes ? "Notes for review:\n" + data.notes + "\n" : "",
          `Submitted at: ${data.timestamp}`,
        ].filter(Boolean);

        const payloadText = lines.join("\n");

        if (payloadBox) {
          payloadBox.textContent = payloadText;
        }

        // Add to local ledger "brain"
        ledger.add({
          partnerHandle: data.partnerHandle,
          partnerEmail: data.partnerEmail,
          buyerName: data.buyerName,
          product: data.product,
          purchaseDate: data.purchaseDate,
          amount: data.amount,
          proof: data.proof,
          notes: data.notes,
          timestamp: data.timestamp,
          payload: payloadText,
        });

        if (resultsBox) {
          renderLedgerResults(
            ledger.entries.map((e) => ({ entry: e, score: null })),
            resultsBox
          );
        }

        msg.textContent =
          "Report payload generated below and saved to your local ledger. Copy it and send to your Flame Division contact or review inbox.";
        msg.classList.add("success");
      });
    }

    // Copy button
    if (btnCopy && payloadBox) {
      btnCopy.addEventListener("click", async () => {
        const text = payloadBox.textContent.trim();
        if (!text) {
          msg.textContent = "Generate a report payload before copying.";
          msg.className = "form-message error";
          return;
        }

        try {
          await navigator.clipboard.writeText(text);
          msg.textContent = "Report payload copied to clipboard.";
          msg.className = "form-message success";
        } catch (err) {
          console.warn("Clipboard error:", err);
          msg.textContent =
            "Unable to copy automatically. Select the payload box and copy it manually.";
          msg.className = "form-message error";
        }
      });
    }

    // Ledger Brain search bindings
    if (searchInput && searchBtn && resultsBox) {
      const runSearch = () => {
        const q = searchInput.value.trim();
        const items = ledger.search(q);
        renderLedgerResults(items, resultsBox);
      };

      searchBtn.addEventListener("click", runSearch);
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          runSearch();
        }
      });
    }
  });
})();
