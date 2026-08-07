import { useEffect, useRef } from "react";
import "./home.css";
import { animate, stagger } from "animejs";
import { FiZap, FiUsers, FiMessageSquare, FiShield } from "react-icons/fi";
import Logo from "../shared/Logo";

const FEATURES = [
  {
    icon: FiMessageSquare,
    title: "Real-time messaging",
    description: "Instant text, image, and voice messages that sync the moment they're sent.",
  },
  {
    icon: FiUsers,
    title: "Built for teams",
    description: "One place for your whole crew to talk, share, and stay on the same page.",
  },
  {
    icon: FiZap,
    title: "Fast & organized",
    description: "No clutter, no noise — just the conversations that matter, in order.",
  },
  {
    icon: FiShield,
    title: "Your workspace, secured",
    description: "Block, mute, and control who reaches you — you're always in charge.",
  },
];

const Home = ({ onEnter }) => {
  const rootRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    animate(".home-eyebrow, .home-title, .home-tagline, .home-cta", {
      opacity: [0, 1],
      translateY: [16, 0],
      delay: stagger(90),
      duration: 500,
      easing: "easeOutQuad",
    });

    animate(".home-feature-card", {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(70, { start: 350 }),
      duration: 400,
      easing: "easeOutQuad",
    });
  }, []);

  return (
    <div className="home" ref={rootRef}>
      <div className="home-grid-overlay" />

      <nav className="home-nav">
        <span className="home-mark">
          <Logo size={18} />
          <span className="home-wordmark">NEXUS</span>
        </span>
        <button type="button" className="home-nav-cta" onClick={onEnter}>
          Sign In
        </button>
      </nav>

      <main className="home-hero">
        <span className="home-eyebrow">Snipes Systems</span>
        <h1 className="home-title">
          Communication. Work. <span>Organized.</span>
        </h1>
        <p className="home-tagline">
          One fast, focused workspace for rooms, projects, tasks, scheduling, and files —
          built for teams that move quickly.
        </p>
        <button type="button" className="home-cta" onClick={onEnter}>
          Enter Nexus
        </button>
      </main>

      <section className="home-features">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div className="home-feature-card" key={title}>
            <Icon className="home-feature-icon" />
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
      </section>

      <footer className="home-footer">
        <span>Nexus &mdash; controlled chaos, organized.</span>
        <span>&copy; {new Date().getFullYear()} Snipes Systems</span>
      </footer>
    </div>
  );
};

export default Home;
