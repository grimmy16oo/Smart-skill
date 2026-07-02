import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { Sun, Moon, Menu, X, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
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
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    setDropdownOpen(false);
    setMenuOpen(false);
    await logout();
    navigate("/");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  return (
    <>
      {/* NAVBAR */}
      <nav
        className={`w-full h-20 z-50 px-6 lg:px-8 flex items-center justify-between font-sans tracking-tight transition-colors duration-300 ${
          isDark
            ? "bg-black text-white "
            : "bg-white text-neutral-900"
        }`}
      >
        {/* LOGO */}
        <div className="flex items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="font-black text-2xl tracking-tight">
              skill
              <span
                className={`underline decoration-[3px] underline-offset-4 text-3xl ${
                  isDark ? "text-yellow-400" : "text-black"
                }`}
              >
                S
              </span>
              wap
            </span>
          </Link>
        </div>

        {/* DESKTOP NAV */}
        <div
          className={`hidden lg:flex items-center gap-1 border px-1.5 py-1.5 rounded-2xl ${
            isDark
              ? "bg-neutral-800 border-neutral-700"
              : "bg-neutral-100 border-neutral-200"
          }`}
        >
          {navLinks.map(({ to, label }) => {
            const active = isActive(to);

            return (
              <Link
                key={to}
                to={to}
                className={`px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  active
                    ? isDark
                      ? "bg-white text-black"
                      : "bg-black text-white"
                    : isDark
                    ? "text-white/70 hover:text-white hover:bg-neutral-700"
                    : "text-neutral-500 hover:text-neutral-900 hover:bg-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3">
          {/* THEME TOGGLE */}
          <motion.button
            onClick={toggleTheme}
            whileTap={{ scale: 0.95 }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
              isDark
                ? "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                : "bg-neutral-100 border-neutral-200 hover:bg-neutral-200"
            }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </motion.button>

          {/* USER / LOGIN */}
          {isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-10 h-10 rounded-full overflow-hidden border border-white/10 hover:border-white/30 transition-colors"
              >
                <UserAvatar user={profile || user} size="md" />
              </motion.button>

              {/* DESKTOP DROPDOWN */}
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute right-0 top-full mt-2 rounded-2xl border shadow-lg z-50 min-w-[200px] ${
                      isDark
                        ? "bg-neutral-900 border-neutral-800"
                        : "bg-white border-neutral-200"
                    }`}
                  >
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className={`block px-4 py-3 text-sm font-medium rounded-t-2xl hover:opacity-70 transition-opacity ${
                        isDark ? "text-white hover:bg-neutral-800" : "text-neutral-900 hover:bg-neutral-50"
                      }`}
                    >
                      My Profile
                    </Link>

                    <button
                      onClick={handleLogout}
                      className={`w-full text-left px-4 py-3 text-sm font-medium rounded-b-2xl flex items-center gap-2 text-red-500 hover:opacity-70 transition-opacity`}
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              to="/login"
              className={`hidden sm:flex items-center justify-center px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                isDark
                  ? "bg-white text-black hover:opacity-90"
                  : "bg-black text-white hover:opacity-90"
              }`}
            >
              Sign In
            </Link>
          )}

          {/* MOBILE MENU BUTTON */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`lg:hidden w-10 h-10 rounded-xl flex items-center justify-center border ${
              isDark
                ? "bg-neutral-800 border-neutral-700"
                : "bg-neutral-100 border-neutral-200"
            }`}
          >
            <Menu size={18} />
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* OVERLAY */}
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />

            {/* SIDEBAR */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 24 }}
              className={`fixed right-0 top-0 h-full w-72 z-50 p-6 shadow-2xl ${
                isDark
                  ? "bg-neutral-900 text-white border-l border-neutral-800"
                  : "bg-white text-neutral-900 border-l border-neutral-200"
              }`}
            >
              {/* TOP */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold">Menu</h2>

                <button
                  onClick={() => setMenuOpen(false)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isDark
                      ? "bg-neutral-800 hover:bg-neutral-700"
                      : "bg-neutral-100 hover:bg-neutral-200"
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* LINKS */}
              <div className="flex flex-col gap-2">
                {navLinks.map(({ to, label }) => {
                  const active = isActive(to);

                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        active
                          ? isDark
                            ? "bg-white text-black"
                            : "bg-black text-white"
                          : isDark
                          ? "hover:bg-neutral-800 text-white/80"
                          : "hover:bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>

              {/* BOTTOM */}
              <div className="mt-8 border-t pt-6 border-white/10">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-red-500 text-sm font-medium hover:opacity-80 transition-opacity"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className={`inline-flex items-center justify-center px-5 py-2 rounded-full text-sm font-semibold ${
                      isDark
                        ? "bg-white text-black"
                        : "bg-black text-white"
                    }`}
                  >
                    Login
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
