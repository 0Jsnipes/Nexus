import { useState } from "react";
import "./auth.css";
import { toast } from "react-toastify";
import { supabase } from "../../lib/supabase";
import { uploadFile } from "../../lib/storage";

const PASSWORD_REQUIREMENTS =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const CUBE_ROTATION = {
  signin: 0,
  signup: -90,
  forgot: 90,
};

const Auth = () => {
  const [view, setView] = useState("signin"); // "signin" | "signup" | "forgot"
  const [zooming, setZooming] = useState(false);
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [loading, setLoading] = useState(false);

  const goTo = (nextView) => {
    if (nextView === view) return;
    setZooming(true);
    setView(nextView);
    window.setTimeout(() => setZooming(false), 900);
  };

  const handleAvatar = (e) => {
    if (e.target.files[0]) {
      setAvatar({
        file: e.target.files[0],
        url: URL.createObjectURL(e.target.files[0]),
      });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { email, password } = Object.fromEntries(new FormData(e.target));

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Logged in successfully!");
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { username, email, password } = Object.fromEntries(new FormData(e.target));

    if (!username || !email || !password) {
      setLoading(false);
      return toast.warn("Please enter inputs!");
    }
    if (!PASSWORD_REQUIREMENTS.test(password)) {
      setLoading(false);
      return toast.warn(
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol."
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (avatar.file && data.session) {
      try {
        const avatarUrl = await uploadFile(`profile/${data.user.id}`, avatar.file);
        await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", data.user.id);
      } catch (err) {
        console.error("Avatar upload failed:", err);
      }
    }

    if (data.session) {
      toast.success("Account created! Logging you in...");
    } else {
      toast.success("Account created! Check your email to confirm before signing in.");
      goTo("signin");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { email } = Object.fromEntries(new FormData(e.target));

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent!");
      goTo("signin");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className={`auth-cube-stage ${zooming ? "is-zooming" : ""}`}>
        <div
          className="auth-cube"
          style={{ transform: `rotateY(${CUBE_ROTATION[view]}deg)` }}
        >
          <div
            className={`auth-cube-face auth-cube-face-signin ${view === "signin" ? "is-active" : ""}`}
          >
            <div className="auth-cube-face-inner">
              <span className="auth-wordmark">NEXUS</span>
              <h2>Welcome back</h2>
              <form onSubmit={handleLogin}>
                <input type="email" placeholder="Email" name="email" required />
                <input type="password" placeholder="Password" name="password" required />
                <button disabled={loading}>{loading ? "Loading..." : "Sign In"}</button>
              </form>
              <div className="auth-links">
                <button type="button" className="auth-link" onClick={() => goTo("signup")}>
                  Sign Up
                </button>
                <button type="button" className="auth-link" onClick={() => goTo("forgot")}>
                  Forgot Password
                </button>
              </div>
            </div>
          </div>

          <div
            className={`auth-cube-face auth-cube-face-signup ${view === "signup" ? "is-active" : ""}`}
          >
            <div className="auth-cube-face-inner">
              <span className="auth-wordmark">NEXUS</span>
              <h2>Create your account</h2>
              <form onSubmit={handleRegister}>
                <label htmlFor="file" className="auth-avatar-label">
                  <img src={avatar.url || "./avatar.png"} alt="" />
                  Upload an image (optional)
                </label>
                <input type="file" id="file" style={{ display: "none" }} onChange={handleAvatar} />
                <input type="text" placeholder="Username" name="username" required />
                <input type="email" placeholder="Email" name="email" required />
                <input
                  type="password"
                  placeholder="Password"
                  name="password"
                  required
                  minLength={8}
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                  title="At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol."
                />
                <button disabled={loading}>{loading ? "Loading..." : "Sign Up"}</button>
              </form>
              <div className="auth-links">
                <button type="button" className="auth-link" onClick={() => goTo("signin")}>
                  Already have an account? Sign In
                </button>
              </div>
            </div>
          </div>

          <div
            className={`auth-cube-face auth-cube-face-forgot ${view === "forgot" ? "is-active" : ""}`}
          >
            <div className="auth-cube-face-inner">
              <span className="auth-wordmark">NEXUS</span>
              <h2>Reset password</h2>
              <form onSubmit={handleForgotPassword}>
                <input type="email" placeholder="Email" name="email" required />
                <button disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
              </form>
              <div className="auth-links">
                <button type="button" className="auth-link" onClick={() => goTo("signin")}>
                  Back to Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
