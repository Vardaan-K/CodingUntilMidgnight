// ── Score helpers ─────────────────────────────────────────────────────────────

export function scoreColor(score) {
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--amber)";
  return "var(--red)";
}

export function scoreBgClass(score) {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

export function scoreGrade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function scoreLabel(score) {
  if (score >= 80) return "Looks Good";
  if (score >= 60) return "Some Concerns";
  if (score >= 40) return "Notable Issues";
  return "Concerning";
}

// ── Tag pill config ───────────────────────────────────────────────────────────

const ICONS = {
  lgbtq: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 17c0-5 4-9 9-9s9 4 9 9"/></svg>`,
  race:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>`,
  gender:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>`,
  religion:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M2 12h20"/></svg>`,
  disability:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="M19 13v-2a7 7 0 1 0-14 0v2"/><circle cx="12" cy="19" r="3"/></svg>`,
  age:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  wages: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  harassment:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
  management:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
  scheduling:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  hiring:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>`,
  health:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  food_safety:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
  environment:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 4 13c0-5 7-13 7-13s7 8 7 13a7 7 0 0 1-7 7z"/></svg>`,
  materials:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 4 13c0-5 7-13 7-13s7 8 7 13a7 7 0 0 1-7 7z"/></svg>`,
  osha:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 2-1 4-2 5l-8 5-8-5c-1-1-2-3-2-5a10 10 0 0 1 10-10z"/><path d="M12 8v4M12 16h.01"/></svg>`,
  recognition:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  improvement:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  default:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
};

const TAG_CONFIG = {
  lgbtq:       { label: "LGBTQ+",      cls: "lgbtq" },
  race:        { label: "Race",         cls: "race" },
  gender:      { label: "Gender",       cls: "race" },
  religion:    { label: "Religion",     cls: "race" },
  disability:  { label: "Disability",   cls: "accessibility" },
  age:         { label: "Age",          cls: "wages" },
  wages:       { label: "Wages",        cls: "wages" },
  harassment:  { label: "Harassment",   cls: "harassment" },
  management:  { label: "Management",   cls: "harassment" },
  scheduling:  { label: "Scheduling",   cls: "wages" },
  hiring:      { label: "Hiring",       cls: "" },
  health:      { label: "Health",       cls: "health" },
  food_safety: { label: "Food Safety",  cls: "health" },
  environment: { label: "Environment",  cls: "environment" },
  materials:   { label: "Materials",    cls: "environment" },
  osha:        { label: "OSHA",         cls: "health" },
  recognition: { label: "Recognition",  cls: "recognition" },
  improvement: { label: "Improvement",  cls: "improvement" },
};

export function renderTagPill(subtag) {
  const cfg = TAG_CONFIG[subtag] || { label: subtag || "Signal", cls: "" };
  const icon = ICONS[subtag] || ICONS.default;
  return `<span class="tag-pill ${cfg.cls}">${icon}${cfg.label}</span>`;
}

// ── Source icon by name keyword ───────────────────────────────────────────────

function sourceIcon(sourceName) {
  const n = (sourceName || "").toLowerCase();
  if (n.includes("glassdoor"))   return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95 0-5.52-4.48-10-10-10z"/></svg>`;
  if (n.includes("google"))      return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>`;
  if (n.includes("yelp"))        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>`;
  if (n.includes("tripadvisor")) return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="#FAFAF7"/></svg>`;
  if (n.includes("reddit"))      return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="#FAFAF7"/></svg>`;
  if (n.includes("indeed"))      return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="16" rx="1"/><line x1="3" y1="10" x2="21" y2="10" stroke="#FAFAF7" stroke-width="1.5"/></svg>`;
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
}

// ── Signal card ───────────────────────────────────────────────────────────────

export function renderSignalCard(signal) {
  const { text, sentiment = "neutral", subtag, source_name, source_url } = signal;
  const pillLabel = sentiment === "positive" ? "POSITIVE" : sentiment === "negative" ? "NEGATIVE" : "NEUTRAL";
  const tag = subtag ? renderTagPill(subtag) : "";
  const icon = sourceIcon(source_name);
  const sourceEl = source_url
    ? `<a class="source-line" href="${source_url}" target="_blank" rel="noopener">${icon}<span>${source_name || "Source"}</span></a>`
    : source_name
      ? `<span class="source-line">${icon}<span>${source_name}</span></span>`
      : "";

  return `
    <div class="signal-card ${sentiment}">
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class="impact-pill ${sentiment}">${pillLabel}</span>
        ${tag}
      </div>
      <p class="text-[15px] leading-snug mb-2">${escHtml(text)}</p>
      ${sourceEl}
    </div>`;
}

// ── Category column ───────────────────────────────────────────────────────────

const CATEGORY_META = {
  identity: {
    name: "Identity",
    desc: "Unfair treatment based on who someone is — race, gender, sexuality, religion, disability, age.",
  },
  operations: {
    name: "Operations",
    desc: "How the business runs day to day — wages, hiring, management practices, treatment of workers.",
  },
  safety: {
    name: "Safety",
    desc: "Physical harm or health risks — food safety, working conditions, harmful materials, product issues.",
  },
};

export function renderCategoryColumn(key, cat) {
  const meta = CATEGORY_META[key] || { name: key, desc: "" };
  const color = scoreColor(cat.score);
  const signals = (cat.signals || []);
  const cards = signals.map(renderSignalCard).join("");
  const countLabel = signals.length === 1 ? "1 signal" : `${signals.length} signals`;

  return `
    <div class="border-t-2 border-line pt-6">
      <div class="flex items-baseline justify-between mb-2">
        <h2 class="serif text-4xl">${meta.name}</h2>
        <span class="num-display text-5xl" style="color:${color}">${cat.score}</span>
      </div>
      <div class="category-score-bar mb-4">
        <div style="width:${cat.score}%;background:${color}"></div>
      </div>
      <p class="text-sm ink-3 mb-4 leading-relaxed">${meta.desc}</p>
      ${cat.summary ? `<p class="text-sm mb-6 leading-relaxed" style="color:var(--ink-2)">${escHtml(cat.summary)}</p>` : ""}
      <div class="space-y-1">${cards || '<p class="text-sm ink-4 italic">No signals found.</p>'}</div>
      ${signals.length > 0 ? `<div class="mt-3 mono text-xs ink-4">${countLabel}</div>` : ""}
    </div>`;
}

// ── Full result page ──────────────────────────────────────────────────────────

export function renderResult(data) {
  const { name, address, scores, final, sources } = data;
  const finalScore = final?.score ?? 0;
  const color = scoreColor(finalScore);
  const gradeCls = scoreBgClass(finalScore);
  const grade = scoreGrade(finalScore);
  const label = scoreLabel(finalScore);

  const totalSignals = ["identity","operations","safety"].reduce((n, k) => {
    return n + (scores[k]?.signals?.length || 0);
  }, 0);
  const totalSources = (sources || []).length;

  document.getElementById("page-title").textContent = `Whistleblower / ${name}`;

  // Business identity section
  document.getElementById("biz-type").textContent = (data.type || "Business").toUpperCase() + (address ? ` · ${address}` : "");
  document.getElementById("biz-name").textContent = name;
  document.getElementById("biz-summary").textContent = final?.summary || "";

  // Score
  document.getElementById("score-number").textContent = finalScore;
  document.getElementById("score-number").style.color = color;
  document.getElementById("grade-badge").className = `grade-badge ${gradeCls}`;
  document.getElementById("grade-letter").textContent = grade;
  document.getElementById("score-verbal").textContent = label;
  document.getElementById("score-verbal").style.color = color;
  document.getElementById("score-meta").textContent = `Based on ${totalSignals} signals from ${totalSources} sources.`;

  // Stats
  document.getElementById("stat-signals").textContent = totalSignals;
  document.getElementById("stat-sources").textContent = totalSources;

  // Category columns
  document.getElementById("col-identity").innerHTML   = renderCategoryColumn("identity",   scores.identity);
  document.getElementById("col-operations").innerHTML = renderCategoryColumn("operations", scores.operations);
  document.getElementById("col-safety").innerHTML     = renderCategoryColumn("safety",     scores.safety);
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

export function renderLoading() {
  const shimmer = (h, w = "100%") =>
    `<div class="loading-shimmer" style="height:${h}px;width:${w};margin-bottom:8px"></div>`;

  const skeletonCol = `
    <div class="border-t-2 border-line pt-6">
      ${shimmer(40, "60%")}
      ${shimmer(4)}
      ${shimmer(60)}
      ${shimmer(80)}
      ${shimmer(80)}
      ${shimmer(80)}
    </div>`;

  document.getElementById("biz-type").innerHTML = shimmer(14, "40%");
  document.getElementById("biz-name").innerHTML = shimmer(56, "70%");
  document.getElementById("biz-summary").innerHTML = shimmer(72);
  document.getElementById("score-number").textContent = "—";
  document.getElementById("score-meta").innerHTML = '<span class="loading-ring"></span> Analyzing…';

  ["col-identity","col-operations","col-safety"].forEach(id => {
    document.getElementById(id).innerHTML = skeletonCol;
  });
}

// ── Util ──────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
