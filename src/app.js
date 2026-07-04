/**
 * WealthTrack — app logic.
 * Live metrics, dynamic categories, donut chart, save + history.
 */
(function () {
  "use strict";

  const DEFAULT_CATEGORIES = ["Mutual Funds", "Food", "Outing", "Medicine"];

  // Distinct, readable palette for the donut chart.
  const PALETTE = [
    "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7",
    "#14b8a6", "#ec4899", "#84cc16", "#f97316", "#06b6d4",
    "#eab308", "#8b5cf6", "#10b981", "#f43f5e", "#0ea5e9",
  ];

  // --- State -----------------------------------------------------------------
  // categories: ordered list of { name, amount }
  let categories = DEFAULT_CATEGORIES.map((name) => ({ name, amount: 0 }));
  let income = 0;
  let chart = null;

  // --- Element refs ----------------------------------------------------------
  const el = {
    monthPicker: document.getElementById("monthPicker"),
    monthLabel: document.getElementById("monthLabel"),
    income: document.getElementById("income"),
    metricIncome: document.getElementById("metricIncome"),
    metricExpenses: document.getElementById("metricExpenses"),
    metricBalance: document.getElementById("metricBalance"),
    balanceCard: document.getElementById("balanceCard"),
    categoryGrid: document.getElementById("categoryGrid"),
    addCategoryForm: document.getElementById("addCategoryForm"),
    newCategory: document.getElementById("newCategory"),
    addError: document.getElementById("addError"),
    chartEmpty: document.getElementById("chartEmpty"),
    saveBtn: document.getElementById("saveBtn"),
    exportBtn: document.getElementById("exportBtn"),
    toast: document.getElementById("toast"),
    historyBody: document.getElementById("historyBody"),
    historyEmpty: document.getElementById("historyEmpty"),
    historyCount: document.getElementById("historyCount"),
    syncDot: document.getElementById("syncDot"),
    syncLabel: document.getElementById("syncLabel"),
  };

  // --- Helpers ---------------------------------------------------------------
  const money = new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0, // whole rupees stay clean (Rs 5,000)
    maximumFractionDigits: 2, // paisa still shown when present (Rs 5,000.50)
  });

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthKeyToLabel(key) {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function totalExpenses() {
    return categories.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }

  function slugify(name) {
    return name.trim().toLowerCase();
  }

  // --- Rendering -------------------------------------------------------------
  function renderCategories() {
    el.categoryGrid.innerHTML = "";
    categories.forEach((cat, index) => {
      const isDefault = DEFAULT_CATEGORIES.includes(cat.name);

      const wrap = document.createElement("div");
      wrap.className =
        "fade-in group rounded-xl bg-ink-800/70 border border-white/10 p-3 focus-within:ring-2 focus-within:ring-emerald-500/50 transition";

      const row = document.createElement("div");
      row.className = "flex items-center justify-between mb-1.5";

      const label = document.createElement("label");
      label.className = "text-xs font-semibold text-slate-300 truncate pr-2";
      label.textContent = cat.name;
      label.title = cat.name;
      label.setAttribute("for", `cat-${index}`);

      row.appendChild(label);

      if (!isDefault) {
        const del = document.createElement("button");
        del.type = "button";
        del.className =
          "opacity-60 hover:opacity-100 text-slate-400 hover:text-rose-400 transition";
        del.title = "Remove category";
        del.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
        del.addEventListener("click", () => removeCategory(index));
        row.appendChild(del);
      }

      const inputWrap = document.createElement("div");
      inputWrap.className = "relative";
      const dollar = document.createElement("span");
      dollar.className =
        "absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium select-none";
      dollar.textContent = "Rs";
      const input = document.createElement("input");
      input.id = `cat-${index}`;
      input.type = "number";
      input.inputMode = "decimal";
      input.min = "0";
      input.step = "0.01";
      input.placeholder = "0.00";
      input.value = cat.amount ? cat.amount : "";
      input.className =
        "w-full rounded-lg bg-ink-900/60 border border-white/10 pl-9 pr-2 py-2 text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/60";
      input.addEventListener("input", () => {
        cat.amount = parseFloat(input.value) || 0;
        recompute();
      });

      inputWrap.appendChild(dollar);
      inputWrap.appendChild(input);
      wrap.appendChild(row);
      wrap.appendChild(inputWrap);
      el.categoryGrid.appendChild(wrap);
    });
  }

  function renderMetrics() {
    const exp = totalExpenses();
    const balance = income - exp;
    el.metricIncome.textContent = money.format(income || 0);
    el.metricExpenses.textContent = money.format(exp);
    el.metricBalance.textContent = money.format(balance);

    // Recolor balance card by sign.
    el.balanceCard.className =
      "rounded-2xl border p-5 shadow-card bg-gradient-to-br to-transparent " +
      (balance < 0
        ? "border-rose-500/30 from-rose-500/15"
        : "border-sky-500/20 from-sky-500/10");
    el.metricBalance.classList.toggle("text-rose-300", balance < 0);
    el.metricBalance.classList.toggle("text-white", balance >= 0);
  }

  function renderChart() {
    const active = categories.filter((c) => (Number(c.amount) || 0) > 0);
    el.chartEmpty.style.display = active.length ? "none" : "grid";

    const labels = active.map((c) => c.name);
    const data = active.map((c) => Number(c.amount) || 0);
    const colors = active.map((_, i) => PALETTE[i % PALETTE.length]);

    if (!chart) {
      const ctx = document.getElementById("expenseChart").getContext("2d");
      chart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors,
              borderColor: "rgba(11,16,32,0.9)",
              borderWidth: 2,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#cbd5e1",
                usePointStyle: true,
                pointStyle: "circle",
                padding: 14,
                font: { size: 12 },
              },
            },
            tooltip: {
              callbacks: {
                label: (item) => {
                  const value = item.parsed || 0;
                  const total = item.dataset.data.reduce((a, b) => a + b, 0) || 1;
                  const pct = ((value / total) * 100).toFixed(1);
                  return ` ${item.label}: ${money.format(value)} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].backgroundColor = colors;
      chart.update();
    }
  }

  function recompute() {
    renderMetrics();
    renderChart();
  }

  // --- Category actions ------------------------------------------------------
  function addCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) {
      return showAddError("Please enter a category name.");
    }
    if (trimmed.length > 40) {
      return showAddError("Keep category names under 40 characters.");
    }
    const exists = categories.some((c) => slugify(c.name) === slugify(trimmed));
    if (exists) {
      return showAddError(`"${trimmed}" already exists.`);
    }
    categories.push({ name: trimmed, amount: 0 });
    el.newCategory.value = "";
    hideAddError();
    renderCategories();
    recompute();
    // Focus the new category's input for immediate entry.
    const last = document.getElementById(`cat-${categories.length - 1}`);
    if (last) last.focus();
  }

  function removeCategory(index) {
    categories.splice(index, 1);
    renderCategories();
    recompute();
  }

  function showAddError(msg) {
    el.addError.textContent = msg;
    el.addError.classList.remove("hidden");
  }
  function hideAddError() {
    el.addError.classList.add("hidden");
  }

  // --- Persistence -----------------------------------------------------------
  function buildRecord() {
    const breakdown = {};
    categories.forEach((c) => {
      const amt = Number(c.amount) || 0;
      if (amt > 0) breakdown[c.name] = amt;
    });
    const exp = totalExpenses();
    return {
      month: el.monthPicker.value || currentMonthKey(),
      income: Number(income) || 0,
      total_expense: exp,
      balance: (Number(income) || 0) - exp,
      breakdown,
    };
  }

  async function saveMonth() {
    const record = buildRecord();
    el.saveBtn.disabled = true;
    el.saveBtn.classList.add("opacity-70");
    try {
      await Store.saveRecord(record);
      toast(`Saved ${monthKeyToLabel(record.month)} ✓`);
      await renderHistory();
    } catch (e) {
      console.error(e);
      toast("Save failed — check console / Supabase config.", true);
    } finally {
      el.saveBtn.disabled = false;
      el.saveBtn.classList.remove("opacity-70");
    }
  }

  /** Load a saved month into the editor (used on month change). */
  async function loadMonth(monthKey) {
    el.monthLabel.textContent = monthKeyToLabel(monthKey);
    let record = null;
    try {
      record = await Store.getRecord(monthKey);
    } catch (e) {
      console.warn("Could not load month:", e);
    }

    if (record) {
      income = Number(record.income) || 0;
      el.income.value = income ? income : "";
      // Rebuild categories: defaults first, then any saved extras, applying amounts.
      const breakdown = record.breakdown || {};
      const names = [...DEFAULT_CATEGORIES];
      Object.keys(breakdown).forEach((n) => {
        if (!names.some((x) => slugify(x) === slugify(n))) names.push(n);
      });
      categories = names.map((name) => {
        const key = Object.keys(breakdown).find(
          (k) => slugify(k) === slugify(name)
        );
        return { name, amount: key ? Number(breakdown[key]) || 0 : 0 };
      });
    } else {
      // Fresh month — reset to defaults, keep income blank.
      income = 0;
      el.income.value = "";
      categories = DEFAULT_CATEGORIES.map((name) => ({ name, amount: 0 }));
    }
    renderCategories();
    recompute();
  }

  // --- History table ---------------------------------------------------------
  function topCategoriesLabel(breakdown) {
    const entries = Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '<span class="text-slate-500">—</span>';
    return entries
      .slice(0, 3)
      .map(
        ([name, amt]) =>
          `<span class="inline-block rounded-md bg-white/5 border border-white/10 px-2 py-0.5 mr-1 mb-1 text-xs text-slate-300">${escapeHtml(
            name
          )} · ${money.format(amt)}</span>`
      )
      .join("");
  }

  async function renderHistory() {
    let records = [];
    try {
      records = await Store.listRecords();
    } catch (e) {
      console.warn("Could not list history:", e);
    }

    el.historyBody.innerHTML = "";
    if (!records.length) {
      el.historyEmpty.style.display = "block";
      el.historyCount.textContent = "";
      return;
    }
    el.historyEmpty.style.display = "none";
    el.historyCount.textContent = `${records.length} month${
      records.length === 1 ? "" : "s"
    } saved`;

    records.forEach((r) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-white/5 hover:bg-white/5 transition";
      const balanceClass = (r.balance || 0) < 0 ? "text-rose-400" : "text-emerald-400";
      tr.innerHTML = `
        <td class="px-5 sm:px-6 py-3 font-semibold text-white whitespace-nowrap">${monthKeyToLabel(
          r.month
        )}</td>
        <td class="px-4 py-3 text-right tabular-nums text-slate-200">${money.format(
          r.income || 0
        )}</td>
        <td class="px-4 py-3 text-right tabular-nums text-slate-200">${money.format(
          r.total_expense || 0
        )}</td>
        <td class="px-4 py-3 text-right tabular-nums font-semibold ${balanceClass}">${money.format(
        r.balance || 0
      )}</td>
        <td class="px-4 py-3 max-w-xs">${topCategoriesLabel(r.breakdown)}</td>
        <td class="px-5 sm:px-6 py-3 text-right whitespace-nowrap">
          <button data-load="${r.month}" class="text-xs font-medium text-sky-400 hover:text-sky-300 mr-3">Load</button>
          <button data-del="${r.month}" class="text-xs font-medium text-rose-400 hover:text-rose-300">Delete</button>
        </td>`;
      el.historyBody.appendChild(tr);
    });

    // Wire up row actions.
    el.historyBody.querySelectorAll("[data-load]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const m = btn.getAttribute("data-load");
        el.monthPicker.value = m;
        loadMonth(m);
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
    );
    el.historyBody.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const m = btn.getAttribute("data-del");
        if (!confirm(`Delete saved data for ${monthKeyToLabel(m)}?`)) return;
        try {
          await Store.deleteRecord(m);
          toast(`Deleted ${monthKeyToLabel(m)}`);
          await renderHistory();
        } catch (e) {
          console.error(e);
          toast("Delete failed.", true);
        }
      })
    );
  }

  // --- CSV export ------------------------------------------------------------
  async function exportCsv() {
    let records = [];
    try {
      records = await Store.listRecords();
    } catch {}
    if (!records.length) {
      toast("Nothing to export yet.", true);
      return;
    }
    // Union of all category names across records for stable columns.
    const catSet = new Set();
    records.forEach((r) =>
      Object.keys(r.breakdown || {}).forEach((k) => catSet.add(k))
    );
    const cats = [...catSet];
    const header = ["Month", "Income", "Total Expense", "Balance", ...cats];
    const rows = records.map((r) => {
      const b = r.breakdown || {};
      return [
        monthKeyToLabel(r.month),
        r.income || 0,
        r.total_expense || 0,
        r.balance || 0,
        ...cats.map((c) => b[c] || 0),
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wealthtrack-history.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Exported wealthtrack-history.csv ✓");
  }

  function csvCell(value) {
    const s = String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  // --- Toast -----------------------------------------------------------------
  let toastTimer = null;
  function toast(msg, isError = false) {
    el.toast.textContent = msg;
    el.toast.classList.toggle("text-rose-400", isError);
    el.toast.classList.toggle("text-emerald-400", !isError);
    el.toast.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.toast.style.opacity = "0"), 2600);
  }

  // --- Sync badge ------------------------------------------------------------
  function renderSyncBadge() {
    if (Store.mode === "supabase") {
      el.syncDot.className = "h-2 w-2 rounded-full bg-emerald-400";
      el.syncLabel.textContent = "Supabase · cloud sync";
    } else {
      el.syncDot.className = "h-2 w-2 rounded-full bg-amber-400";
      el.syncLabel.textContent = "Local storage";
    }
  }

  // --- Wire up ---------------------------------------------------------------
  function init() {
    renderSyncBadge();

    // Default to current month.
    const startMonth = currentMonthKey();
    el.monthPicker.value = startMonth;
    el.monthLabel.textContent = monthKeyToLabel(startMonth);

    el.income.addEventListener("input", () => {
      income = parseFloat(el.income.value) || 0;
      recompute();
    });

    el.monthPicker.addEventListener("change", () => {
      const key = el.monthPicker.value || currentMonthKey();
      loadMonth(key);
    });

    el.addCategoryForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addCategory(el.newCategory.value);
    });
    el.newCategory.addEventListener("input", hideAddError);

    el.saveBtn.addEventListener("click", saveMonth);
    el.exportBtn.addEventListener("click", exportCsv);

    renderCategories();
    recompute();

    // Gate behind sign-in when Supabase is configured; local mode starts now.
    Auth.gate(
      // onAuth: user present — load this month's data + history.
      () => loadMonth(el.monthPicker.value || startMonth).then(renderHistory),
      // onSignedOut: wipe the screen so nothing leaks between accounts.
      resetUI
    );
  }

  /** Clear all inputs, chart and history back to an empty default state. */
  function resetUI() {
    income = 0;
    el.income.value = "";
    categories = DEFAULT_CATEGORIES.map((name) => ({ name, amount: 0 }));
    renderCategories();
    recompute();
    el.historyBody.innerHTML = "";
    el.historyEmpty.style.display = "block";
    el.historyCount.textContent = "";
  }

  document.addEventListener("DOMContentLoaded", init);
})();
