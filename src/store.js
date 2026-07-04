/**
 * Storage abstraction.
 *
 * Presents one async API to the app and picks the backend at runtime:
 *   - Supabase (cloud sync) when window.SUPABASE_CONFIG has a url + anonKey
 *   - localStorage otherwise (works fully offline)
 *
 * When Supabase is active, saves are ALSO mirrored to localStorage so the app
 * still shows history if the network drops.
 *
 * Record shape:
 *   {
 *     month: "2026-07",          // unique key, YYYY-MM
 *     income: 4200,
 *     total_expense: 1850,
 *     balance: 2350,
 *     breakdown: { "Food": 500, "Rent": 1200, ... },
 *     updated_at: "2026-07-04T..."  // ISO, set by client for local mode
 *   }
 */
(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const LS_KEY = "wealthtrack.records.v1";
  const TABLE = cfg.table || "monthly_records";

  const hasSupabase =
    !!cfg.url &&
    !!cfg.anonKey &&
    typeof window.supabase !== "undefined" &&
    typeof window.supabase.createClient === "function";

  let sb = null;
  if (hasSupabase) {
    try {
      sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    } catch (e) {
      console.warn("Supabase init failed, falling back to local storage:", e);
    }
  }

  // ---- localStorage helpers -------------------------------------------------
  function lsReadAll() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function lsWriteAll(map) {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  }
  function lsUpsert(record) {
    const map = lsReadAll();
    map[record.month] = record;
    lsWriteAll(map);
  }
  function lsDelete(month) {
    const map = lsReadAll();
    delete map[month];
    lsWriteAll(map);
  }
  function lsList() {
    return Object.values(lsReadAll()).sort((a, b) =>
      a.month < b.month ? 1 : a.month > b.month ? -1 : 0
    );
  }

  // ---- Public API -----------------------------------------------------------
  const Store = {
    mode: sb ? "supabase" : "local",

    /** Save (upsert) a month record. Returns the stored record. */
    async saveRecord(record) {
      const clean = {
        month: record.month,
        income: Number(record.income) || 0,
        total_expense: Number(record.total_expense) || 0,
        balance: Number(record.balance) || 0,
        breakdown: record.breakdown || {},
        updated_at: new Date().toISOString(),
      };

      if (sb) {
        const { error } = await sb
          .from(TABLE)
          .upsert(clean, { onConflict: "month" });
        if (error) throw error;
      }
      // Always mirror locally so history survives offline / refresh.
      lsUpsert(clean);
      return clean;
    },

    /** Fetch one month's saved record, or null. */
    async getRecord(month) {
      if (sb) {
        const { data, error } = await sb
          .from(TABLE)
          .select("*")
          .eq("month", month)
          .maybeSingle();
        if (!error && data) {
          lsUpsert(data); // refresh cache
          return data;
        }
      }
      return lsReadAll()[month] || null;
    },

    /** List all saved records, newest month first. */
    async listRecords() {
      if (sb) {
        const { data, error } = await sb
          .from(TABLE)
          .select("*")
          .order("month", { ascending: false });
        if (!error && Array.isArray(data)) {
          // Refresh local mirror to match cloud.
          const map = {};
          data.forEach((r) => (map[r.month] = r));
          lsWriteAll(map);
          return data;
        }
      }
      return lsList();
    },

    /** Delete a month record. */
    async deleteRecord(month) {
      if (sb) {
        const { error } = await sb.from(TABLE).delete().eq("month", month);
        if (error) throw error;
      }
      lsDelete(month);
    },
  };

  window.Store = Store;
})();
