import {
  FiHome,
  FiHash,
  FiMessageSquare,
  FiFolder,
  FiCheckSquare,
  FiCalendar,
  FiVideo,
  FiFile,
  FiUsers,
  FiBell,
  FiSettings,
} from "react-icons/fi";

export const NAV_GROUPS = [
  {
    label: "Home",
    items: [{ section: "home", label: "Home", icon: FiHome }],
  },
  {
    label: "Communication",
    items: [
      { section: "rooms", label: "Rooms", icon: FiHash },
      { section: "dms", label: "Direct Messages", icon: FiMessageSquare },
    ],
  },
  {
    label: "Work",
    items: [
      { section: "projects", label: "Projects", icon: FiFolder },
      { section: "tasks", label: "My Tasks", icon: FiCheckSquare },
      { section: "schedule", label: "Schedule", icon: FiCalendar },
      { section: "meetings", label: "Meetings", icon: FiVideo },
    ],
  },
  {
    label: "Resources",
    items: [
      { section: "files", label: "Files", icon: FiFile },
      { section: "team", label: "Team", icon: FiUsers },
    ],
  },
];

export const NAV_BOTTOM_ITEMS = [
  { section: "notifications", label: "Notifications", icon: FiBell },
  { section: "settings", label: "Settings", icon: FiSettings },
];

export const NAV_ITEMS = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...NAV_BOTTOM_ITEMS,
];
