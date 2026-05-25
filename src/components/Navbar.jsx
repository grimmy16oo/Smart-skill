import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { Sun, Moon, Menu, X, LogOut, User } from "lucide-react";
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
      {/* FIXED NAVBAR (NO OVERLAY ISSUE NOW) */}
      <nav
        className={`fixed top-0 left-0 w-full z-50 h-20 px-6 lg:px-16 flex items-center justify-between font-sans tracking-tight transition-colors duration-300 backdrop-blur-xl ${
          isDark
            ? "bg-black/30 text-white border-b border-white/5"
            : "bg-white/70 text-neutral-900 border-b border-neutral-200/40"
        }`}
      >
        {/* BRAND */}
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

        {/* CENTER LINKS */}
        <div
          className={`hidden lg:flex items-center gap-1 border backdrop-blur-xl px-1.5 py-1.5 rounded-2xl ${
            isDark
              ? "bg-white/[0.04] border-white/[0.08]"
              : "bg-neutral-900/[0.04] border-neutral-900/[0.06]"
          }`}
        >
          {navLinks.map(({ to, label }) => {
            const active = isActive(to);

            return (
              <Link
                key={to}
                to={to}
                className={`px-5 py-2 text-sm font-medium rounded-xl transition-all ${
                  active
                    ? isDark
                      ? "bg-white text-black"
                      : "bg-black text-white"
                    : isDark
                    ? "text-white/70 hover:text-white"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-3">

          {/* THEME */}
          <motion.button
            onClick={toggleTheme}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isDark
                ? "bg-white/10 border-white/10"
                : "bg-black/5 border-black/10"
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </motion.button>

          {/* USER */}
          {isAuthenticated && user ? (
            <div className="relative">
              <motion.button
                className="w-10 h-10 rounded-full overflow-hidden border border-white/10"
                whileTap={{ scale: 0.95 }}
              >
                <UserAvatar user={profile || user} size="md" />
              </motion.button>
            </div>
          ) : (
            <Link
              to="/login"
              className={`hidden sm:block px-5 py-2 rounded-full text-sm font-semibold ${
                isDark
                  ? "bg-white text-black"
                  : "bg-black text-white"
              }`}
            >
              Sign In
            </Link>
          )}

          {/* MOBILE MENU */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`lg:hidden w-10 h-10 rounded-xl flex items-center justify-center ${
              isDark ? "bg-white/10" : "bg-black/5"
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
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />

            <motion.div
              className={`fixed right-0 top-0 h-full w-72 z-50 p-6 ${
                isDark ? "bg-black text-white" : "bg-white text-black"
              }`}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold">Menu</h2>
                <button onClick={() => setMenuOpen(false)}>
                  <X />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {navLinks.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className="text-sm py-2"
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <div className="mt-8">
                {isAuthenticated ? (
                  <button
                    onClick={logout}
                    className="text-red-500 text-sm"
                  >
                    <LogOut size={14} /> Logout
                  </button>
                ) : (
                  <Link to="/login" className="text-sm font-semibold">
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