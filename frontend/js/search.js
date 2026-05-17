import { fetchLocations, fetchBusinesses } from "./api.js";

// ── State ─────────────────────────────────────────────────────────────────────

let selectedLocation = null;  // { name, canonical_name, gps }
let selectedBusiness = null;  // { place_id, name, address, type, gps }

// ── Debounce util ─────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Dropdown helpers ──────────────────────────────────────────────────────────

function showDropdown(wrap, items, onSelect) {
  removeDropdown(wrap);
  if (!items.length) return;

  const dd = document.createElement("div");
  dd.className = "search-dropdown";

  items.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "dropdown-item";
    el.innerHTML = item.html;
    el.addEventListener("mousedown", (e) => {
      e.preventDefault(); // don't blur input
      onSelect(item.data, el);
      removeDropdown(wrap);
    });
    dd.appendChild(el);
  });

  wrap.appendChild(dd);
}

function removeDropdown(wrap) {
  wrap.querySelector(".search-dropdown")?.remove();
}

// ── Location search ───────────────────────────────────────────────────────────

function initLocationSearch() {
  const wrap  = document.getElementById("location-wrap");
  const input = document.getElementById("location-input");
  const step1 = document.getElementById("step1-num");
  const step2 = document.getElementById("step2-num");

  const doSearch = debounce(async (q) => {
    if (q.length < 2) { removeDropdown(wrap); return; }
    try {
      const results = await fetchLocations(q);
      showDropdown(
        wrap,
        results.map(loc => ({
          data: loc,
          html: `<div class="di-main">${loc.name || loc.canonical_name}</div>
                 <div class="di-sub">${loc.canonical_name || ""}</div>`,
        })),
        (loc) => {
          selectedLocation = loc;
          input.value = loc.name || loc.canonical_name;

          // Unlock business step
          document.getElementById("business-input").disabled = false;
          document.getElementById("business-input").placeholder = `Search in ${loc.name || "this area"}…`;
          step1.classList.add("done");
          step1.textContent = "✓";
          step2.textContent = "2";

          // Clear previously selected business
          selectedBusiness = null;
          document.getElementById("business-input").value = "";
          updateSubmitState();
        }
      );
    } catch (e) {
      console.error("Location search failed:", e);
    }
  }, 300);

  input.addEventListener("input", (e) => {
    selectedLocation = null;
    updateSubmitState();
    doSearch(e.target.value.trim());
  });

  input.addEventListener("blur", () => setTimeout(() => removeDropdown(wrap), 150));
}

// ── Business search ───────────────────────────────────────────────────────────

function initBusinessSearch() {
  const wrap  = document.getElementById("business-wrap");
  const input = document.getElementById("business-input");

  const doSearch = debounce(async (q) => {
    if (!selectedLocation || q.length < 2) { removeDropdown(wrap); return; }
    try {
      const { lat, lng } = selectedLocation.gps;
      const results = await fetchBusinesses(q, lat, lng);
      showDropdown(
        wrap,
        results.map(biz => ({
          data: biz,
          html: `<div class="di-main">${biz.name}</div>
                 <div class="di-sub">${biz.address || biz.type || ""}</div>`,
        })),
        (biz) => {
          selectedBusiness = biz;
          input.value = biz.name;
          updateSubmitState();
        }
      );
    } catch (e) {
      console.error("Business search failed:", e);
    }
  }, 300);

  input.addEventListener("input", (e) => {
    selectedBusiness = null;
    updateSubmitState();
    doSearch(e.target.value.trim());
  });

  input.addEventListener("blur", () => setTimeout(() => removeDropdown(wrap), 150));
}

// ── Submit ────────────────────────────────────────────────────────────────────

function updateSubmitState() {
  const btn = document.getElementById("search-btn");
  if (!btn) return;
  btn.disabled = !(selectedLocation && (selectedBusiness || document.getElementById("business-input").value.trim().length > 1));
}

function initSubmit() {
  const form = document.getElementById("search-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedLocation) return;

    // Use selected business if picked from dropdown, else use raw input text
    const businessName = selectedBusiness?.name || document.getElementById("business-input").value.trim();
    if (!businessName) return;

    // Store in sessionStorage and navigate
    sessionStorage.setItem("wb_business", JSON.stringify({
      name:      selectedBusiness?.name    || businessName,
      place_id:  selectedBusiness?.place_id || null,
      address:   selectedBusiness?.address  || null,
      type:      selectedBusiness?.type     || null,
      gps:       selectedBusiness?.gps      || null,
    }));
    sessionStorage.setItem("wb_location", JSON.stringify({
      name:           selectedLocation.name,
      canonical_name: selectedLocation.canonical_name,
      gps:            selectedLocation.gps,
    }));

    window.location.href = `business.html?query=${encodeURIComponent(businessName)}&location=${encodeURIComponent(selectedLocation.canonical_name || selectedLocation.name)}`;
  });
}

// ── Header search bar (on business page) ─────────────────────────────────────

export function initHeaderSearch() {
  const input = document.getElementById("header-search-input");
  if (!input) return;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      window.location.href = `index.html`;
    }
  });
  input.addEventListener("focus", () => {
    window.location.href = "index.html";
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initSearch() {
  initLocationSearch();
  initBusinessSearch();
  initSubmit();
}
