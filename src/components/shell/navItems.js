import {
  FiHome,
  FiHash,
  FiMessageSquare,
  FiFolder,
  FiCalendar,
  FiVideo,
  FiFile,
  FiUsers,
  FiBell,
  FiSettings,
} from "react-icons/fi";

export const NAV_ITEMS = [
  { section: "home", label: "Home", icon: FiHome },
  { section: "rooms", label: "Rooms", icon: FiHash },
  { section: "dms", label: "Direct Messages", icon: FiMessageSquare },
  { section: "projects", label: "Projects", icon: FiFolder },
  { section: "schedule", label: "Schedule", icon: FiCalendar },
  { section: "meetings", label: "Meetings", icon: FiVideo },
  { section: "files", label: "Files", icon: FiFile },
  { section: "team", label: "Team", icon: FiUsers },
  { section: "notifications", label: "Notifications", icon: FiBell },
  { section: "settings", label: "Settings", icon: FiSettings },
];
