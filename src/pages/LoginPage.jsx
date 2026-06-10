import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

import {
  User,
  Mail,
  Lock,
  MapPin,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader,
} from "lucide-react";

/* PASSWORD STRENGTH METRIC */
function getStrength(password) {
  let score = 0;
  if (password.length > 7) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function StrengthBar({ password }) {
  const strength = getStrength(password);
  const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-error", "bg-warning", "bg-warning", "bg-info", "bg-success"];

  return (
    <div className="space-y-1.5 mt-1">
      <div className="w-full bg-base-300 dark:bg-neutral rounded-full h-1 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(strength / 4) * 100}%` }}
          transition={{ duration: 0.3 }}
          className={`h-full ${colors[strength] || colors[0]}`}
        />
      </div>
      <p className="text-[11px] font-medium text-base-content/50">
        {password ? `Strength: ${labels[strength]}` : "Enter a password"}
      </p>
    </div>
  );
}

/* CUSTOM THEME-AWARE INPUT */
function Input({
  icon,
  value,
  setValue,
  placeholder,
  type = "text",
  error,
  required,
  showToggle = false,
  showPassword,
  onTogglePassword,
}) {
  return (
    <div className="form-control w-full space-y-1.5">
      <label className="label py-0 pl-0">
        <span className="text-xs font-semibold tracking-wide text-base-content/80 flex items-center gap-1.5">
          {icon}
          {placeholder}
          {required && <span className="text-error">*</span>}
        </span>
      </label>

      <div className="relative">
        <input
          type={showToggle && showPassword ? "text" : type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Enter your ${placeholder.toLowerCase()}`}
          className={`input w-full bg-base-200/50 dark:bg-[#121212] border text-sm text-base-content dark:text-white placeholder-base-content/30 transition-all duration-200 focus:outline-none rounded-lg h-11 ${
            error 
              ? "border-error focus:border-error" 
              : "border-base-300 dark:border-neutral hover:border-base-content/20 focus:border-[#C06B51]"
          }`}
        />

        {showToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content dark:hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}

        {error && !showToggle && (
          <AlertCircle size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-error" />
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[11px] text-error font-medium pl-0.5"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* CUSTOM THEME-AWARE TEXTAREA */
function Textarea({ icon, value, setValue, placeholder, error, required }) {
  return (
    <div className="form-control w-full space-y-1.5">
      <label className="label py-0 pl-0">
        <span className="text-xs font-semibold tracking-wide text-base-content/80 flex items-center gap-1.5">
          {icon}
          {placeholder}
          {required && <span className="text-error">*</span>}
        </span>
      </label>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Tell us a little bit about yourself...`}
        className={`textarea w-full bg-base-200/50 dark:bg-[#121212] border text-sm text-base-content dark:text-white placeholder-base-content/30 transition-all duration-200 focus:outline-none rounded-lg resize-none p-3 line-clamp-3 ${
          error 
            ? "border-error focus:border-error" 
            : "border-base-300 dark:border-neutral hover:border-base-content/20 focus:border-[#C06B51]"
        }`}
        rows={2}
      />

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[11px] text-error font-medium pl-0.5"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LoginPage() {
  const { user, register, login } = useAuth();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // LOGIC INPUT STATES
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");

  // HANDLING STATUS STATES
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/swipe");
    }
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!isLogin) {
      if (!name.trim()) {
        newErrors.name = "Full name is required";
      } else if (name.length < 2) {
        newErrors.name = "Name must be at least 2 characters";
      }

      if (!confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }

      if (location && location.length < 2) {
        newErrors.location = "Please enter a valid location";
      }

      if (bio && bio.length > 500) {
        newErrors.bio = "Bio must be under 500 characters";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        setSuccessMessage("Welcome back!");
        setTimeout(() => navigate("/swipe"), 500);
      } else {
        await register(email, password, {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          location: location.trim(),
          bio: bio.trim(),
          skillsOffered: [],
          skillsWanted: [],
        });

        setSuccessMessage("Account created successfully!");
        setTimeout(() => navigate("/profile"), 1000);
      }
    } catch (err) {
      console.error("Auth error:", err);
      let errorMessage = err.message || "Something went wrong. Please try again.";

      if (err.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered.";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password is too weak.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Try again later.";
      }

      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-base-content dark:text-white flex font-sans antialiased overflow-x-hidden transition-colors duration-200">
      
      {/* LEFT COLUMN - EXACT HOMEPAGE GRADIENT MESH PANEL */}
      <div 
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-16 relative overflow-hidden bg-gradient-to-tr from-[#9E4F39] via-[#C06B51] to-[#D5856B]"
      >
        {/* Soft layout overlay for image texture depth */}
        <div className="absolute inset-0 bg-black/[0.03] mix-blend-multiply pointer-events-none" />
        
        {/* Top Tagline Badge */}
        <div className="z-10 self-start">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs font-medium tracking-wider text-white uppercase">
            Learn / Teach / Connect
          </span>
        </div>

        {/* Hero Central Typography Section */}
        <div className="z-10 max-w-xl my-auto space-y-8">
          <h2 className="text-5xl xl:text-6xl font-serif tracking-tight text-white leading-[1.15]">
            Find People Who Match Your Skills
          </h2>
          <p className="text-white/85 text-base xl:text-lg max-w-md font-light leading-relaxed">
            SkillSwap helps people exchange knowledge, collaborate, and grow together through real human connections.
          </p>
        </div>

        {/* Bottom Platform Indicators */}
        <div className="z-10 flex items-center gap-6 text-xs text-white/60 tracking-wider uppercase font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> 
            Skill exchange
          </span>
          <span>/</span>
          <span>Secure account</span>
        </div>
      </div>

      {/* RIGHT COLUMN - MODERN FORM COMPONENT WITH INCREASED PADDING */}
      <div className="w-full lg:w-[55%] flex flex-col justify-center items-center px-8 py-16 sm:px-16 lg:px-24 xl:px-32 relative overflow-y-auto">
        <div className="max-w-md w-full space-y-10">
          
          {/* Header Typography */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-base-content dark:text-white">
              {isLogin ? "Sign in" : "Create your account"}
            </h1>
            <p className="text-sm text-base-content/60 dark:text-base-content/40">
              {isLogin ? "Welcome back. Continue to your skill matches." : "Join to list your skills and start matching."}
            </p>
          </div>

          {/* Feedback Status Notifications */}
          <AnimatePresence mode="wait">
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="alert alert-error bg-error/10 border-error/20 text-error text-xs py-3.5 px-4 rounded-lg flex items-start gap-2.5"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errors.general}</span>
              </motion.div>
            )}

            {successMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="alert alert-success bg-success/10 border-success/20 text-success text-xs py-3.5 px-4 rounded-lg flex items-start gap-2.5"
              >
                <CheckCircle size={16} className="shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Action Form Wrapper */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Conditional Signup Steps Group */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-5 overflow-hidden"
                >
                  <Input
                    icon={<User size={14} />}
                    value={name}
                    setValue={setName}
                    placeholder="Full Name"
                    error={errors.name}
                    required
                  />

                  <Input
                    icon={<MapPin size={14} />}
                    value={location}
                    setValue={setLocation}
                    placeholder="Location"
                  />

                  <div className="relative">
                    <Textarea
                      icon={<BookOpen size={14} />}
                      value={bio}
                      setValue={setBio}
                      placeholder="Bio"
                      error={errors.bio}
                    />
                    <span className="absolute right-2.5 bottom-2 text-[10px] text-base-content/40 tracking-tight">
                      {bio.length}/500
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Core Identification Credentials */}
            <Input
              icon={<Mail size={14} />}
              value={email}
              setValue={setEmail}
              placeholder="Email"
              type="email"
              error={errors.email}
              required
            />

            <div className="space-y-1">
              <Input
                icon={<Lock size={14} />}
                value={password}
                setValue={setPassword}
                placeholder="Password"
                type="password"
                error={errors.password}
                required
                showToggle
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
              />
              {!isLogin && password && <StrengthBar password={password} />}
            </div>

            {/* Confirmation Accordion */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Input
                    icon={<Lock size={14} />}
                    value={confirmPassword}
                    setValue={setConfirmPassword}
                    placeholder="Confirm Password"
                    type="password"
                    error={errors.confirmPassword}
                    required
                    showToggle
                    showPassword={showConfirmPassword}
                    onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Core Submit Button Trigger */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 disabled:bg-neutral/50 disabled:text-base-content/40 font-bold transition-all duration-200 rounded-lg text-sm h-11 flex items-center justify-center gap-2 mt-8 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader size={16} className="animate-spin text-neutral-content" />
                  <span>Working...</span>
                </>
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Sign Up"
              )}
            </button>
          </form>

          {/* Bottom Switch Context Actions */}
          <div className="text-center pt-2">
            <p className="text-sm text-base-content/60">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setSuccessMessage("");
                }}
                className="text-[#C06B51] font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
