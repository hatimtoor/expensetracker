/**
 * Auth gate.
 *
 * When Supabase is configured, the whole app sits behind a sign-in screen so
 * your data is private to your account. In local-storage mode there's no auth —
 * the gate is skipped and the app starts immediately.
 *
 * Exposes: window.Auth.gate(onAuth, onSignedOut)
 *   - onAuth(user)   — called once a user is present (on load or after login)
 *   - onSignedOut()  — called when there is no user (on load or after logout)
 */
(function () {
  "use strict";

  const A = Store.auth;

  const el = {
    gate: document.getElementById("authGate"),
    form: document.getElementById("authForm"),
    email: document.getElementById("authEmail"),
    password: document.getElementById("authPassword"),
    error: document.getElementById("authError"),
    title: document.getElementById("authTitle"),
    submit: document.getElementById("authSubmit"),
    toggle: document.getElementById("authToggle"),
    signOut: document.getElementById("signOutBtn"),
    userEmail: document.getElementById("userEmail"),
  };

  let mode = "signin"; // or "signup"
  let hooks = { onAuth: () => {}, onSignedOut: () => {} };

  function showGate(show) {
    el.gate.classList.toggle("hidden", !show);
    el.gate.classList.toggle("flex", show);
  }

  function setError(msg) {
    if (!msg) {
      el.error.classList.add("hidden");
      el.error.textContent = "";
      return;
    }
    el.error.textContent = msg;
    el.error.classList.remove("hidden");
  }

  function setMode(next) {
    mode = next;
    const signin = mode === "signin";
    el.title.textContent = signin ? "Sign in" : "Create account";
    el.submit.textContent = signin ? "Sign in" : "Sign up";
    el.toggle.textContent = signin
      ? "Need an account? Sign up"
      : "Have an account? Sign in";
    setError("");
  }

  function onAuthed(user) {
    showGate(false);
    el.signOut.classList.remove("hidden");
    if (user && user.email) {
      el.userEmail.textContent = user.email;
      el.userEmail.classList.remove("hidden");
    }
    hooks.onAuth(user);
  }

  function onNoUser() {
    el.signOut.classList.add("hidden");
    el.userEmail.classList.add("hidden");
    el.userEmail.textContent = "";
    hooks.onSignedOut();
    showGate(true);
  }

  el.form &&
    el.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("");
      el.submit.disabled = true;
      el.submit.classList.add("opacity-70");
      const email = el.email.value.trim();
      const password = el.password.value;
      try {
        if (mode === "signin") {
          const user = await A.signIn(email, password);
          onAuthed(user);
        } else {
          const data = await A.signUp(email, password);
          if (data.user && data.session) {
            onAuthed(data.user); // instant (email confirmation off)
          } else {
            setMode("signin");
            setError("Account created. Check your email to confirm, then sign in.");
          }
        }
      } catch (err) {
        setError((err && err.message) || "Authentication failed.");
      } finally {
        el.submit.disabled = false;
        el.submit.classList.remove("opacity-70");
      }
    });

  el.toggle &&
    el.toggle.addEventListener("click", () =>
      setMode(mode === "signin" ? "signup" : "signin")
    );

  el.signOut &&
    el.signOut.addEventListener("click", async () => {
      try {
        await A.signOut();
      } catch (e) {
        console.warn("Sign out error:", e);
      }
      el.email.value = "";
      el.password.value = "";
      setMode("signin");
      onNoUser();
    });

  window.Auth = {
    async gate(onAuth, onSignedOut) {
      hooks = { onAuth, onSignedOut };

      // Local-storage mode: no auth, start straight away.
      if (!A.enabled) {
        showGate(false);
        el.signOut.classList.add("hidden");
        onAuth(null);
        return;
      }

      setMode("signin");
      let user = null;
      try {
        user = await A.currentUser(); // persisted session survives reloads
      } catch (e) {
        console.warn("Could not read auth session:", e);
      }
      if (user) onAuthed(user);
      else onNoUser();
    },
  };
})();
