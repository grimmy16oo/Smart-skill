import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { Sun, Moon, Zap, Menu, X, LogOut, User } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UserAvatar from "./UserAvatar";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/swipe", label: "Discover" },
  { to: "/chat", label: "Messages" },
  { to: "/profile", label: "Profile" },
];

export default function Navbar() {
  const { isDark, toggleTheme } = useTheme();
  const { user, profile, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* BACKDROP NAVBAR */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="
          fixed top-0 left-0 w-full z-50
          backdrop-blur-xl
          bg-base-100/60
          border-b border-white/10
        "
      >
        <div className="navbar px-4 lg:px-8 max-w-7xl mx-auto">
          {/* BRAND */}
          <div className="navbar-start">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-glow group-hover:scale-110 transition">
                <Zap size={16} className="text-white" />
              </div>

              <span className="font-display font-bold text-gradient text-lg hidden sm:block">
                SkillSwap
              </span>
            </Link>
          </div>

          {/* DESKTOP NAV */}
          <div className="navbar-center hidden lg:flex relative">
            <div className="flex gap-1 relative">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`
                    relative px-4 py-2 rounded-xl text-sm font-medium transition
                    ${
                      isActive(to)
                        ? "text-primary"
                        : "text-base-content/70 hover:text-base-content"
                    }
                  `}
                >
                  {label}

                  {/* ACTIVE UNDERLINE */}
                  {isActive(to) && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute left-2 right-2 -bottom-1 h-[2px] bg-primary rounded-full"
                    />
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* RIGHT ACTIONS */}
          <div className="navbar-end gap-2">
            {/* THEME TOGGLE */}
            <motion.button
              type="button"
              onClick={toggleTheme}
              className="btn btn-ghost btn-circle"
              aria-label="Toggle theme"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {isDark ? (
                <Sun size={18} className="text-accent" />
              ) : (
                <Moon size={18} />
              )}
            </motion.button>

            {/* AUTH */}
            {isAuthenticated && user ? (
              <div className="dropdown dropdown-end">
                {/* AVATAR BUTTON */}
                <motion.button
                  tabIndex={0}
                  className="btn btn-ghost btn-circle hover:bg-base-200 transition"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <UserAvatar user={profile || user} size="md" className="ring-primary ring-offset-2 ring-offset-base-100" />
                </motion.button>

                {/* DROPDOWN MENU */}
                <AnimatePresence>
                  <motion.ul
                    tabIndex={0}
                    className="
                      menu menu-sm dropdown-content mt-3 p-2
                      bg-base-100/95 backdrop-blur-xl
                      border border-base-300
                      shadow-xl rounded-2xl w-56
                    "
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {/* USER INFO */}
                    <li className="menu-title px-3 py-2">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={profile || user} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {profile?.name || user.displayName || user.email?.split("@")[0] || "User"}
                          </p>
                          <p className="text-xs text-base-content/60 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </li>

                    <li>
                      <div className="divider my-1"></div>
                    </li>

                    <motion.li
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 }}
                    >
                      <Link to="/profile" className="rounded-xl hover:bg-primary/20">
                        <User size={16} />
                        Profile
                      </Link>
                    </motion.li>

                    <motion.li
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Link to="/swipe" className="rounded-xl hover:bg-primary/20">
                        Discover
                      </Link>
                    </motion.li>

                    <motion.li
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <Link to="/chat" className="rounded-xl hover:bg-primary/20">
                        Messages
                      </Link>
                    </motion.li>

                    <li>
                      <div className="divider my-1"></div>
                    </li>

                    <motion.li
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <button
                        onClick={logout}
                        className="text-error rounded-xl hover:bg-error/20"
                      >
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </motion.li>
                  </motion.ul>
                </AnimatePresence>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Link
                  to="/login"
                  className="btn btn-vibrant-primary btn-sm text-white font-semibold rounded-lg"
                >
                  Sign In
                </Link>
              </motion.div>
            )}

            {/* MOBILE MENU BUTTON */}
            <motion.button
              className="btn btn-icon-vibrant btn-circle bg-blue-500 hover:bg-blue-600 text-white lg:hidden"
              onClick={() => setMenuOpen(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Menu size={20} />
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* ─────────────────────────────────────
          MOBILE SLIDE MENU
      ───────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* BACKDROP */}
            <motion.div
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* PANEL */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween" }}
              className="
                fixed right-0 top-0 h-full w-72 z-50
                bg-base-100/90 backdrop-blur-xl
                border-l border-white/10
                p-6
              "
            >
              {/* CLOSE */}
              <motion.button
                onClick={() => setMenuOpen(false)}
                className="btn btn-icon-vibrant btn-circle bg-red-500 hover:bg-red-600 text-white mb-6"
                whileTap={{ scale: 0.9 }}
              >
                <X />
              </motion.button>

              {/* USER INFO - MOBILE */}
              {isAuthenticated && user && (
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-base-300">
                  <UserAvatar user={profile || user} size="lg" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {profile?.name || user.displayName || user.email?.split("@")[0] || "User"}
                    </p>
                    <p className="text-xs text-base-content/60 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
              )}

              {/* LINKS */}
              <div className="flex flex-col gap-2">
                {navLinks.map(({ to, label }) => (
                  <motion.div
                    key={to}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Link
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className={`
                        block px-4 py-3 rounded-xl text-sm font-medium transition
                        ${
                          isActive(to)
                            ? "bg-primary text-white shadow-lg"
                            : "text-base-content hover:bg-base-200"
                        }
                      `}
                    >
                      {label}
                    </Link>
                  </motion.div>
                ))}

                {!isAuthenticated && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Link
                      to="/login"
                      className="btn btn-vibrant-primary w-full text-white font-semibold mt-4"
                      onClick={() => setMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                  </motion.div>
                )}

                {isAuthenticated && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="btn btn-vibrant-error w-full text-white font-semibold mt-4"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
