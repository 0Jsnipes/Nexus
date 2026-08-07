import { createContext, useCallback, useContext, useState } from "react";

const NavContext = createContext(null);

export const NavProvider = ({ children }) => {
  const [route, setRoute] = useState({ section: "home", params: {} });

  const navigate = useCallback((section, params = {}) => {
    setRoute({ section, params });
  }, []);

  return <NavContext.Provider value={{ route, navigate }}>{children}</NavContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNav = () => useContext(NavContext);
