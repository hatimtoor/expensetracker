/**
 * Storage abstraction.
 *
 * Presents one async API to the app and picks the backend at runtime:
 *   - Supabase (cloud sync, per-user) when window.SUPABASE_CONFIG has url + anonKey
 *   - localStorage otherwise (works fully offline)
 *
 * When Supabase is active the app requires sign-in (see auth.js). Row Level
 * Security scopes every query to the logged-in user, so data is private to
 * your account. Saves are ALSO mirrored to localStorage so history survives a
 * dropped connection.
 *
 * Record shape:
 *   {
 *     month: "2026-07",          // unique per user, YYYY-MM
 *     income: 4200,
 *     total_expense: 1850,
 *     balance: 2350,
 *     breakdown: { "Food": 500, "Rent": 1200, ... },
 *     updated_at: "2026-07-04T..."  // ISO
 *   }
 */
(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const LS_KEY = "wealthtrack.records.v1";
  const LS_GOALS_KEY = "wealthtrack.goals.v1";
  const TABLE = cfg.table || "monthly_records";
  const GOALS_TABLE = cfg.goalsTable || "goals";

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
  function lsClear() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_GOALS_KEY);
  }
  function lsList() {
    return Object.values(lsReadAll()).sort((a, b) =>
      a.month < b.month ? 1 : a.month > b.month ? -1 : 0
    );
  }

  // ---- localStorage helpers (goals) -----------------------------------------
  function lsGoalsReadAll() {
    try {
      const raw = localStorage.getItem(LS_GOALS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function lsGoalsWriteAll(map) {
    localStorage.setItem(LS_GOALS_KEY, JSON.stringify(map));
  }
  function lsGoalUpsert(goal) {
    const map = lsGoalsReadAll();
    map[goal.id] = goal;
    lsGoalsWriteAll(map);
  }
  function lsGoalDelete(id) {
    const map = lsGoalsReadAll();
    delete map[id];
    lsGoalsWriteAll(map);
  }
  function lsGoalsList() {
    return Object.values(lsGoalsReadAll()).sort((a, b) =>
      (a.created_at || "") < (b.created_at || "") ? -1 : 1
    );
  }

  async function currentUserId() {
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data && data.user ? data.user.id : null;
  }

  // ---- Public API -----------------------------------------------------------
  const Store = {
    mode: sb ? "supabase" : "local",

    /** Save (upsert) a month record. Returns the stored record. */
    async saveRecord(record) {
      const clean = {
        month: record.month,
        income: Number(record.income) || 0,
        income_1: Number(record.income_1) || 0,
        income_2: Number(record.income_2) || 0,
        total_expense: Number(record.total_expense) || 0,
        balance: Number(record.balance) || 0,
        breakdown: record.breakdown || {},
        updated_at: new Date().toISOString(),
      };

      if (sb) {
        const uid = await currentUserId();
        if (uid) clean.user_id = uid; // RLS also enforces this
        const { error } = await sb
          .from(TABLE)
          .upsert(clean, { onConflict: "user_id,month" });
        if (error) throw error;
      }
      // Mirror locally so history survives offline / refresh.
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
          // Refresh local mirror to match cloud (scoped to this user by RLS).
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

    // ---- Goals --------------------------------------------------------------

    /** Save (upsert) a goal. Returns the stored goal. */
    async saveGoal(goal) {
      const clean = {
        id: goal.id,
        name: goal.name,
        target: Number(goal.target) || 0,
        category: goal.category || null, // linked expense category, or null
        saved: Number(goal.saved) || 0, // manual progress (unused when linked)
        target_date: goal.target_date || null,
        created_at: goal.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (sb) {
        const uid = await currentUserId();
        if (uid) clean.user_id = uid;
        const { error } = await sb
          .from(GOALS_TABLE)
          .upsert(clean, { onConflict: "id" });
        if (error) throw error;
      }
      lsGoalUpsert(clean);
      return clean;
    },

    /** List all goals, oldest first. */
    async listGoals() {
      if (sb) {
        const { data, error } = await sb
          .from(GOALS_TABLE)
          .select("*")
          .order("created_at", { ascending: true });
        if (!error && Array.isArray(data)) {
          const map = {};
          data.forEach((g) => (map[g.id] = g));
          lsGoalsWriteAll(map);
          return data;
        }
      }
      return lsGoalsList();
    },

    /** Delete a goal by id. */
    async deleteGoal(id) {
      if (sb) {
        const { error } = await sb.from(GOALS_TABLE).delete().eq("id", id);
        if (error) throw error;
      }
      lsGoalDelete(id);
    },

    // ---- Auth ---------------------------------------------------------------
    auth: {
      enabled: !!sb,

      async currentUser() {
        if (!sb) return null;
        const { data } = await sb.auth.getUser();
        return (data && data.user) || null;
      },

      async signIn(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        return data.user;
      },

      async signUp(email, password) {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        return data; // { user, session } — session is null if email confirm is on
      },

      async signOut() {
        if (sb) await sb.auth.signOut();
        lsClear(); // don't leave this account's cache for the next person on this browser
      },
    },
  };

  window.Store = Store;
})();
