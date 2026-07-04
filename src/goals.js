/**
 * WealthTrack — Savings Goals.
 *
 * A goal has a name, a target amount, an optional target date, and either:
 *   - a linked expense category → progress auto-sums that category across every
 *     saved month, or
 *   - no category ("manual") → you set "saved so far" yourself.
 *
 * Each goal renders as a card with an SVG progress ring.
 *
 * Exposes: window.Goals.load(), .reset(), .refresh()
 */
(function () {
  "use strict";

  const DEFAULT_CATEGORIES = ["Mutual Funds", "Food", "Outing", "Medicine"];

  const money = new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const el = {
    form: document.getElementById("goalForm"),
    name: document.getElementById("goalName"),
    target: document.getElementById("goalTarget"),
    category: document.getElementById("goalCategory"),
    date: document.getElementById("goalDate"),
    error: document.getElementById("goalError"),
    grid: document.getElementById("goalsGrid"),
    empty: document.getElementById("goalsEmpty"),
    count: document.getElementById("goalsCount"),
  };

  function slug(s) {
    return String(s || "").trim().toLowerCase();
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "g-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  // --- Progress --------------------------------------------------------------
  /** Amount achieved for a goal, given all saved month records. */
  function progressFor(goal, records) {
    if (goal.category) {
      const target = slug(goal.category);
      return records.reduce((sum, r) => {
        const b = r.breakdown || {};
        let add = 0;
        Object.keys(b).forEach((k) => {
          if (slug(k) === target) add += Number(b[k]) || 0;
        });
        return sum + add;
      }, 0);
    }
    return Number(goal.saved) || 0;
  }

  function dateInfo(goal, done) {
    if (done) return "Achieved 🎉";
    if (!goal.target_date) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(goal.target_date + "T00:00:00");
    if (isNaN(due.getTime())) return "";
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return `Overdue by ${-days} day${days === -1 ? "" : "s"}`;
    if (days === 0) return "Due today";
    return `${days} day${days === 1 ? "" : "s"} left`;
  }

  function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // --- SVG ring --------------------------------------------------------------
  function ring(pct, done) {
    const p = Math.max(0, Math.min(100, pct));
    const stroke = done ? "#22c55e" : "#38bdf8";
    return `
      <svg viewBox="0 0 36 36" class="h-16 w-16 shrink-0 -rotate-90">
        <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3.2"></circle>
        <circle cx="18" cy="18" r="15.915" fill="none" stroke="${stroke}" stroke-width="3.2"
          stroke-linecap="round" stroke-dasharray="${p} 100"></circle>
      </svg>`;
  }

  // --- Category dropdown -----------------------------------------------------
  function fillCategoryOptions(records) {
    const set = new Set();
    DEFAULT_CATEGORIES.forEach((c) => set.add(c));
    records.forEach((r) =>
      Object.keys(r.breakdown || {}).forEach((k) => set.add(k))
    );
    const prev = el.category.value;
    el.category.innerHTML = '<option value="">Manual (I\'ll update it)</option>';
    [...set].forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = `Auto: ${c}`;
      el.category.appendChild(opt);
    });
    el.category.value = prev; // keep selection across re-renders if still valid
  }

  // --- Render ----------------------------------------------------------------
  function render(goals, records) {
    el.grid.innerHTML = "";
    if (!goals.length) {
      el.empty.style.display = "block";
      el.count.textContent = "";
      return;
    }
    el.empty.style.display = "none";
    el.count.textContent = `${goals.length} goal${goals.length === 1 ? "" : "s"}`;

    goals.forEach((goal) => {
      const target = Number(goal.target) || 0;
      const saved = progressFor(goal, records);
      const pct = target > 0 ? (saved / target) * 100 : 0;
      const done = target > 0 && saved >= target;
      const remaining = Math.max(0, target - saved);
      const meta = dateInfo(goal, done);

      const card = document.createElement("div");
      card.className =
        "fade-in glass rounded-2xl border border-white/10 p-5 shadow-card";

      const linkLabel = goal.category
        ? `Auto from <span class="text-slate-300">${escapeHtml(goal.category)}</span>`
        : `Manual`;
      const dueLabel = goal.target_date
        ? ` · due ${fmtDate(goal.target_date)}`
        : "";

      card.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="relative grid place-items-center">
            ${ring(pct, done)}
            <span class="absolute text-sm font-bold ${done ? "text-emerald-400" : "text-white"}">${Math.round(pct)}%</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-bold text-white truncate" title="${escapeHtml(goal.name)}">${escapeHtml(goal.name)}</h3>
              <button data-del="${goal.id}" title="Delete goal"
                class="shrink-0 text-slate-400 hover:text-rose-400 transition">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
            <p class="mt-0.5 text-sm text-slate-200 tabular-nums">
              <span class="font-semibold ${done ? "text-emerald-400" : "text-white"}">${money.format(saved)}</span>
              <span class="text-slate-500"> / ${money.format(target)}</span>
            </p>
            <div class="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div class="h-full rounded-full ${done ? "bg-emerald-400" : "bg-sky-400"}" style="width:${Math.max(0, Math.min(100, pct))}%"></div>
            </div>
            <p class="mt-2 text-xs text-slate-400">
              ${done ? "Complete" : money.format(remaining) + " to go"} · ${linkLabel}${dueLabel}
              ${meta ? `<span class="ml-1 ${/Overdue/.test(meta) ? "text-rose-400" : done ? "text-emerald-400" : "text-slate-300"}">· ${meta}</span>` : ""}
            </p>
            ${
              goal.category
                ? ""
                : `<div class="mt-3 flex items-center gap-2">
                     <label class="text-[11px] text-slate-400">Saved so far</label>
                     <div class="relative">
                       <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs select-none">Rs</span>
                       <input data-saved="${goal.id}" type="number" min="0" step="0.01" value="${saved || ""}"
                         class="w-32 rounded-lg bg-ink-900/60 border border-white/10 pl-7 pr-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60" />
                     </div>
                   </div>`
            }
          </div>
        </div>`;
      el.grid.appendChild(card);
    });

    // Wire delete buttons.
    el.grid.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        const goal = state.goals.find((g) => g.id === id);
        if (!confirm(`Delete goal "${goal ? goal.name : ""}"?`)) return;
        try {
          await Store.deleteGoal(id);
          await reload();
        } catch (e) {
          console.error(e);
        }
      })
    );

    // Wire manual "saved so far" inputs (persist on change).
    el.grid.querySelectorAll("[data-saved]").forEach((input) =>
      input.addEventListener("change", async () => {
        const id = input.getAttribute("data-saved");
        const goal = state.goals.find((g) => g.id === id);
        if (!goal) return;
        goal.saved = parseFloat(input.value) || 0;
        try {
          await Store.saveGoal(goal);
          await reload();
        } catch (e) {
          console.error(e);
        }
      })
    );
  }

  // --- Data flow -------------------------------------------------------------
  const state = { goals: [], records: [] };

  async function reload() {
    try {
      const [goals, records] = await Promise.all([
        Store.listGoals(),
        Store.listRecords(),
      ]);
      state.goals = goals || [];
      state.records = records || [];
    } catch (e) {
      console.warn("Could not load goals:", e);
      state.goals = state.goals || [];
      state.records = state.records || [];
    }
    fillCategoryOptions(state.records);
    render(state.goals, state.records);
  }

  function showError(msg) {
    if (!msg) {
      el.error.classList.add("hidden");
      return;
    }
    el.error.textContent = msg;
    el.error.classList.remove("hidden");
  }

  el.form &&
    el.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = el.name.value.trim();
      const target = parseFloat(el.target.value) || 0;
      if (!name) return showError("Give your goal a name.");
      if (target <= 0) return showError("Enter a target amount greater than 0.");
      showError("");

      const goal = {
        id: uuid(),
        name,
        target,
        category: el.category.value || null,
        saved: 0,
        target_date: el.date.value || null,
        created_at: new Date().toISOString(),
      };
      try {
        await Store.saveGoal(goal);
        el.form.reset();
        el.category.value = "";
        await reload();
      } catch (err) {
        console.error(err);
        showError((err && err.message) || "Could not save goal.");
      }
    });

  window.Goals = {
    load: reload,
    refresh: reload, // called after a month is saved so linked goals update
    reset() {
      state.goals = [];
      state.records = [];
      el.grid.innerHTML = "";
      el.empty.style.display = "block";
      el.count.textContent = "";
    },
  };
})();
