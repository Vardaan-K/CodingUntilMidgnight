import { postReport } from "./api.js";

// ── Toast notification ────────────────────────────────────────────────────────

function showToast(msg, isError = false) {
  let el = document.getElementById("wb-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "wb-toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast${isError ? " error" : ""}`;
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => el.classList.remove("show"), 3000);
}

// ── Report form ───────────────────────────────────────────────────────────────

export function initReportForm(placeId) {
  const form = document.getElementById("report-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = form.querySelector('input[name="type"]:checked')?.value;
    const comment = form.querySelector('textarea[name="comment"]')?.value?.trim() || "";
    const btn = form.querySelector("button[type=submit]");

    if (!type) { showToast("Please select Positive or Negative.", true); return; }
    if (!placeId) { showToast("No business ID — cannot submit.", true); return; }

    btn.disabled = true;
    btn.textContent = "Submitting…";
    try {
      await postReport(placeId, type, comment);
      form.reset();
      showToast("Report submitted. Thank you.");
    } catch (err) {
      showToast("Submission failed: " + err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit Report";
    }
  });
}
