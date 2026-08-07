import "./legal.css";
import Logo from "../shared/Logo";
import { FiArrowLeft } from "react-icons/fi";

const LAST_UPDATED = "August 7, 2026";

const PRIVACY_SECTIONS = [
  {
    title: "1. Information we collect",
    body: [
      "Account information: your name, email address, username, and avatar when you create a Nexus account.",
      "Workspace content: messages, files, tasks, projects, and other content you create or upload while using a workspace.",
      "Usage data: basic technical data such as device type, browser, and log data used to keep the service reliable and secure.",
    ],
  },
  {
    title: "2. How we use information",
    body: [
      "To provide, maintain, and improve Nexus, including real-time messaging, notifications, and file storage.",
      "To authenticate you and keep your account and workspaces secure.",
      "To send you service notifications, such as mentions, task assignments, and messages in rooms and conversations you're part of.",
    ],
  },
  {
    title: "3. How information is shared",
    body: [
      "Content you post in a workspace (messages, files, tasks) is visible to other members of that workspace according to its permissions and privacy settings.",
      "We use third-party infrastructure providers (such as Supabase for our database, authentication, and file storage) to operate Nexus. We do not sell your personal information.",
    ],
  },
  {
    title: "4. Push notifications",
    body: [
      "If you install Nexus as an app and enable notifications, we use your browser's push subscription to deliver notifications for new messages and mentions. You can disable this at any time from your device or browser settings.",
    ],
  },
  {
    title: "5. Data retention & deletion",
    body: [
      "We retain workspace content for as long as your account or workspace remains active. You can request deletion of your account and associated personal data at any time by contacting us.",
    ],
  },
  {
    title: "6. Your rights",
    body: [
      "Depending on where you live, you may have rights to access, correct, export, or delete your personal information. Contact us to exercise these rights.",
    ],
  },
  {
    title: "7. Contact",
    body: ["Questions about this policy can be sent to the workspace owner or to Snipes Systems directly."],
  },
];

const TERMS_SECTIONS = [
  {
    title: "1. Acceptance of terms",
    body: [
      "By creating an account or using Nexus, you agree to these Terms of Service. If you don't agree, please don't use Nexus.",
    ],
  },
  {
    title: "2. Your account",
    body: [
      "You're responsible for maintaining the security of your account and password. You're responsible for all activity that happens under your account.",
      "You must provide accurate information when creating your account and keep it up to date.",
    ],
  },
  {
    title: "3. Acceptable use",
    body: [
      "Don't use Nexus to violate the law, infringe on others' rights, distribute malware, or harass other users.",
      "Don't attempt to disrupt, overload, or gain unauthorized access to Nexus or other users' workspaces.",
    ],
  },
  {
    title: "4. Your content",
    body: [
      "You retain ownership of the content you post to Nexus. You grant us a limited license to store, display, and transmit that content solely to operate the service for you and your workspace members.",
    ],
  },
  {
    title: "5. Workspace administration",
    body: [
      "Workspace owners and admins can manage membership, permissions, and content within their workspace, including removing members or content that violates these terms or their own workspace policies.",
    ],
  },
  {
    title: "6. Termination",
    body: [
      "You may stop using Nexus and delete your account at any time. We may suspend or terminate accounts that violate these terms.",
    ],
  },
  {
    title: "7. Disclaimer & limitation of liability",
    body: [
      "Nexus is provided \"as is\" without warranties of any kind. To the fullest extent permitted by law, Snipes Systems isn't liable for indirect, incidental, or consequential damages arising from your use of Nexus.",
    ],
  },
  {
    title: "8. Changes to these terms",
    body: ["We may update these terms from time to time. Continued use of Nexus after changes means you accept the updated terms."],
  },
  {
    title: "9. Contact",
    body: ["Questions about these terms can be sent to Snipes Systems directly."],
  },
];

const LegalPage = ({ type = "privacy", onBack }) => {
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms of Service";
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <span className="legal-mark">
          <Logo size={18} />
          <span>NEXUS</span>
        </span>
        <button type="button" className="legal-back" onClick={onBack}>
          <FiArrowLeft size={14} /> Back
        </button>
      </nav>

      <main className="legal-content">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
};

export default LegalPage;
