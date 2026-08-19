import { useState } from "react";
import "./auth.css";
import { toast } from "react-toastify";
import { supabase } from "../../lib/supabase";
import { uploadFile } from "../../lib/storage";
import { useWorkspaceStore } from "../../lib/workspaceStore";
import { PENDING_JOIN_CODE_KEY, JOIN_ERROR_MESSAGES } from "../../lib/joinWorkspaceCode";
import Logo from "../shared/Logo";

const PASSWORD_REQUIREMENTS =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

const COPY = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to pick up where your team left off.",
  },
  signup: {
    title: "Create your account",
    subtitle: "Set up your workspace for communication, work, and files.",
  },
  forgot: {
    title: "Reset your password",
    subtitle: "We'll email you a link to get back in.",
  },
};

const cleanEmail = (value) => String(value || "").trim().toLowerCase().slice(0, 254);
const cleanUsername = (value) => String(value || "").trim().normalize("NFKC").slice(0, 50);

const Auth = () => {
  const [view, setView] = useState("signin"); // "signin" | "signup" | "forgot"
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [loading, setLoading] = useState(false);

  const goTo = (nextView) => {
    if (nextView === view) return;
    setView(nextView);
  };

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]).has(file.type)) {
      e.target.value = "";
      return toast.warn("Avatar must be a JPG, PNG, WebP, or GIF image.");
    }
    if (file.size > 5 * 1024 * 1024) {
      e.target.value = "";
      return toast.warn("Avatar must be smaller than 5 MB.");
    }
    setAvatar({ file, url: URL.createObjectURL(file) });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const form = Object.fromEntries(new FormData(e.target));
    const email = cleanEmail(form.email);
    const password = String(form.password || "");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn("Sign-in failed", error.code || error.status || "auth_error");
      toast.error("Unable to sign in. Check your email and password and try again.");
    } else {
      toast.success("Logged in successfully!");
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const form = Object.fromEntries(new FormData(e.target));
    const username = cleanUsername(form.username);
    const email = cleanEmail(form.email);
    const password = String(form.password || "");
    const code = String(form.workspaceCode || "").trim().toUpperCase().slice(0, 64);

    if (username.length < 2 || !email || !password) {
      setLoading(false);
      return toast.warn("Please complete all required fields.");
    }
    if (!PASSWORD_REQUIREMENTS.test(password)) {
      setLoading(false);
      return toast.warn(
        "Password must be 12–128 characters and include uppercase, lowercase, a number, and a symbol."
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) {
      console.warn("Registration failed", error.code || error.status || "auth_error");
      toast.error("Unable to create the account. Please verify your information and try again.");
      setLoading(false);
      return;
    }

    if (avatar.file && data.session) {
      try {
        const avatarUrl = await uploadFile(`profile/${data.user.id}`, avatar.file);
        await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", data.user.id);
      } catch (err) {
        console.warn("Avatar upload failed", err?.message || "upload_error");
        toast.warn("Your account was created, but the avatar could not be uploaded.");
      }
    }

    if (data.session) {
      if (code) {
        try {
          const result = await useWorkspaceStore.getState().joinWorkspace(code);
          if (!result.ok) {
            toast.warn(JOIN_ERROR_MESSAGES[result.error] || "Account created, but that workspace code didn't work.");
          } else if (result.status === "pending") {
            toast.info(`Account created! Request sent to join ${result.name}. Waiting on approval.`);
          } else {
            toast.success(`Account created! Welcome to ${result.name}.`);
          }
        } catch (err) {
          console.warn("Workspace join failed", err?.message || "join_error");
          toast.error("Account created, but the workspace could not be joined yet.");
        }
      } else {
        toast.success("Account created! Logging you in...");
      }
    } else {
      if (code) localStorage.setItem(PENDING_JOIN_CODE_KEY, code);
      toast.success("Account created! Check your email to confirm before signing in.");
      goTo("signin");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const form = Object.fromEntries(new FormData(e.target));
    const email = cleanEmail(form.email);

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) console.warn("Password reset request failed", error.code || error.status || "auth_error");

    // Deliberately use the same response whether an account exists or not.
    toast.success("If an account exists for that email, a password reset link has been sent.");
    goTo("signin");
    setLoading(false);
  };

  const { title, subtitle } = COPY[view];

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-mark">
          <Logo size={20} />
          <span className="auth-brand-wordmark">NEXUS</span>
        </div>
        <div className="auth-brand-copy">
          <h1>Communication. Work. Organized.</h1>
          <p>Rooms, projects, tasks, scheduling and files for your team — in one fast, focused workspace.</p>
        </div>
        <span className="auth-brand-foot">&copy; {new Date().getFullYear()} Snipes Systems</span>
      </aside>

      <div className="auth-form-panel">
        <div className="auth-form-stage">
          <div className="auth-mark-mobile">
            <Logo size={18} />
            <span>NEXUS</span>
          </div>

          <div className="auth-form-header">
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          {view === "signin" && (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="auth-field">
                <label htmlFor="signin-email">Email</label>
                <input id="signin-email" type="email" placeholder="you@company.com" name="email" autoComplete="email" maxLength={254} required />
              </div>
              <div className="auth-field">
                <label htmlFor="signin-password">Password</label>
                <input id="signin-password" type="password" placeholder="••••••••••••" name="password" autoComplete="current-password" maxLength={128} required />
              </div>
              <button className="auth-submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
              <div className="auth-links">
                <button type="button" className="auth-link" onClick={() => goTo("forgot")}>
                  Forgot password?
                </button>
                <button type="button" className="auth-link auth-link-primary" onClick={() => goTo("signup")}>
                  Create account
                </button>
              </div>
            </form>
          )}

          {view === "signup" && (
            <form className="auth-form" onSubmit={handleRegister}>
              <label htmlFor="file" className="auth-avatar-label">
                <img src={avatar.url || "./avatar.png"} alt="" />
                Upload an avatar (optional)
              </label>
              <input type="file" id="file" style={{ display: "none" }} onChange={handleAvatar} accept="image/jpeg,image/png,image/webp,image/gif" />
              <div className="auth-field">
                <label htmlFor="signup-username">Username</label>
                <input id="signup-username" type="text" placeholder="jane.doe" name="username" autoComplete="username" minLength={2} maxLength={50} required />
              </div>
              <div className="auth-field">
                <label htmlFor="signup-email">Email</label>
                <input id="signup-email" type="email" placeholder="you@company.com" name="email" autoComplete="email" maxLength={254} required />
              </div>
              <div className="auth-field">
                <label htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••••••"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}"
                  title="12–128 characters, with an uppercase letter, a lowercase letter, a number, and a symbol."
                />
                <span className="auth-hint">12+ characters with uppercase, lowercase, a number, and a symbol.</span>
              </div>
              <div className="auth-field">
                <label htmlFor="signup-code">Workspace code (optional)</label>
                <input id="signup-code" type="text" placeholder="Workspace invite code" name="workspaceCode" autoComplete="off" maxLength={64} />
                <span className="auth-hint">Have an invite code? Enter it to request access to that workspace.</span>
              </div>
              <button className="auth-submit" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
              <div className="auth-links">
                <button type="button" className="auth-link" onClick={() => goTo("signin")}>
                  Already have an account? <span className="auth-link-primary">Sign in</span>
                </button>
              </div>
            </form>
          )}

          {view === "forgot" && (
            <form className="auth-form" onSubmit={handleForgotPassword}>
              <div className="auth-field">
                <label htmlFor="forgot-email">Email</label>
                <input id="forgot-email" type="email" placeholder="you@company.com" name="email" autoComplete="email" maxLength={254} required />
              </div>
              <button className="auth-submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
              <div className="auth-links">
                <button type="button" className="auth-link" onClick={() => goTo("signin")}>
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {view !== "forgot" && (
            <p className="auth-legal">
              By continuing you agree to our <a href="#/terms">Terms of Service</a> and <a href="#/privacy">Privacy Policy</a>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
