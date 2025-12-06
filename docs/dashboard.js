// Flame Division Partner Dashboard v0
// TTS instructions + report payload generator + copy-to-clipboard.

(function () {
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

  document.addEventListener("DOMContentLoaded", () => {
    const btnTts = document.getElementById("btn-tts-dash");
    const form = document.getElementById("report-form");
    const msg = document.getElementById("report-message");
    const payloadBox = document.getElementById("report-payload");
    const btnCopy = document.getElementById("btn-copy-payload");

    const handleInput = document.getElementById("partner-handle");
    const emailInput = document.getElementById("partner-email");

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
          "Add a short description or proof link, generate the report payload, and send it to the Flame Division review channel.";
        speak(script);
      });
    }

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

        if (payloadBox) {
          payloadBox.textContent = lines.join("\n");
        }

        msg.textContent =
          "Report payload generated below. Copy it and send to your Flame Division contact or review inbox.";
        msg.classList.add("success");
      });
    }

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
  });
})();
