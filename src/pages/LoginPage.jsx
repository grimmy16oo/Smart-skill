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
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Loader,
} from "lucide-react";

/* PASSWORD STRENGTH */
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
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];

  return (
    <div className="space-y-2">
      <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(strength / 4) * 100}%` }}
          transition={{ duration: 0.3 }}
          className={`h-full ${colors[strength] || colors[0]}`}
        />
      </div>

      <p className="text-xs font-medium text-base-content/60">
        {password ? labels[strength] : "Enter a password"}
      </p>
    </div>
  );
}

/* INPUT WITH VALIDATION */
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
    <div className="space-y-1">
      <label className="label pb-1">
        <span className="label-text font-medium flex items-center gap-2">
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
          placeholder={placeholder}
          className={`input input-bordered w-full pr-10 transition-colors ${
            error ? "input-error" : "focus:input-primary"
          }`}
        />

        {showToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content transition"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {error && <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-error" />}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-xs text-error font-medium"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* TEXTAREA */
function Textarea({
  icon,
  value,
  setValue,
  placeholder,
  error,
  required,
}) {
  return (
    <div className="space-y-1">
      <label className="label pb-1">
        <span className="label-text font-medium flex items-center gap-2">
          {icon}
          {placeholder}
          {required && <span className="text-error">*</span>}
        </span>
      </label>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={`textarea textarea-bordered w-full transition-colors ${
          error ? "textarea-error" : "focus:textarea-primary"
        }`}
        rows={3}
      />

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-xs text-error font-medium"
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

  // FORM
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  // REDIRECT IF LOGGED IN
  useEffect(() => {
    if (user) {
      navigate("/swipe");
    }
  }, [user, navigate]);

  // VALIDATION
  const validateForm = () => {
    const newErrors = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    // Login-specific validation
    if (isLogin) {
      // Login only needs email and password
    } else {
      // Signup-specific validation
      if (!name.trim()) {
        newErrors.name = "Full name is required";
      }

      if (!confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }

      if (name && name.length < 2) {
        newErrors.name = "Name must be at least 2 characters";
      }

      if (location && location.length < 2) {
        newErrors.location = "Please enter a valid location";
      }

      if (bio && bio.length > 500) {
        newErrors.bio = "Bio must be less than 500 characters";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // LOGIN
        await login(email, password);
        setSuccessMessage("Welcome back!");
        setTimeout(() => {
          navigate("/swipe");
        }, 500);
      } else {
        await register(email, password, {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          location: location.trim(),
          bio: bio.trim(),
          skillsOffered: [],
          skillsWanted: [],
        });

        setSuccessMessage("Account created successfully! Redirecting...");
        setTimeout(() => {
          navigate("/profile");
        }, 1000);
      }
    } catch (err) {
      console.error("Auth error:", err);

      // Better error messages
      let errorMessage = err.message || "Something went wrong. Please try again.";

      if (err.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered. Please sign in instead.";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password. Please try again.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many login attempts. Please try again later.";
      }

      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-base-100 to-base-200 pt-20 pb-10 px-4"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* LEFT - BRANDING */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="hidden lg:flex flex-col justify-center"
          >
            <h1 className="text-6xl font-bold mb-4 text-primary">SkillSwap</h1>

            <p className="text-2xl font-semibold text-base-content mb-2">
              {isLogin ? "Welcome Back!" : "Join the Community"}
            </p>

            <p className="text-lg text-base-content/70 mb-8 leading-relaxed">
              {isLogin
                ? "Connect with fellow learners, share your skills, and grow together in our vibrant community."
                : "Learn new skills, meet passionate people, and make meaningful connections through knowledge exchange."}
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle size={24} className="text-success flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-base-content">Connect with Experts</h3>
                  <p className="text-sm text-base-content/70">Learn from experienced professionals</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle size={24} className="text-success flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-base-content">Share Your Knowledge</h3>
                  <p className="text-sm text-base-content/70">Teach others and build your profile</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle size={24} className="text-success flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-base-content">Safe & Secure</h3>
                  <p className="text-sm text-base-content/70">Your data is protected with industry standards</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT - FORM */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="card bg-base-100 shadow-2xl border border-base-200">
              <div className="card-body space-y-6">
                {/* TAB SWITCH */}
                <div className="flex gap-2 bg-base-200 p-1 rounded-xl">
                  <motion.button
                    type="button"
                    onClick={() => {
                      setIsLogin(true);
                      setErrors({});
                      setSuccessMessage("");
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                      isLogin
                        ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
                        : "text-base-content/70 hover:text-base-content"
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    Sign In
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => {
                      setIsLogin(false);
                      setErrors({});
                      setSuccessMessage("");
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                      !isLogin
                        ? "bg-purple-500 hover:bg-purple-600 text-white shadow-lg"
                        : "text-base-content/70 hover:text-base-content"
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    Sign Up
                  </motion.button>
                </div>

                {/* GENERAL ERROR */}
                <AnimatePresence>
                  {errors.general && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="alert alert-error gap-2"
                    >
                      <AlertCircle size={20} />
                      <span>{errors.general}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* SUCCESS MESSAGE */}
                <AnimatePresence>
                  {successMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="alert alert-success gap-2"
                    >
                      <CheckCircle size={20} />
                      <span>{successMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* FORM */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* SIGNUP ONLY FIELDS */}
                  <AnimatePresence>
                    {!isLogin && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                      >
                        <Input
                          icon={<User size={18} />}
                          value={name}
                          setValue={setName}
                          placeholder="Full Name"
                          error={errors.name}
                          required
                        />

                        <Input
                          icon={<MapPin size={18} />}
                          value={location}
                          setValue={setLocation}
                          placeholder="City, Country"
                          error={errors.location}
                        />

                        <Textarea
                          icon={<BookOpen size={18} />}
                          value={bio}
                          setValue={setBio}
                          placeholder="Tell us about yourself (max 500 chars)"
                          error={errors.bio}
                        />

                        <p className="text-xs text-base-content/50">{bio.length}/500</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* EMAIL */}
                  <Input
                    icon={<Mail size={18} />}
                    value={email}
                    setValue={setEmail}
                    placeholder="Email Address"
                    type="email"
                    error={errors.email}
                    required
                  />

                  {/* PASSWORD */}
                  <Input
                    icon={<Lock size={18} />}
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

                  {/* PASSWORD STRENGTH - SIGNUP ONLY */}
                  <AnimatePresence>
                    {!isLogin && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <StrengthBar password={password} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* CONFIRM PASSWORD - SIGNUP ONLY */}
                  <AnimatePresence>
                    {!isLogin && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Input
                          icon={<Lock size={18} />}
                          value={confirmPassword}
                          setValue={setConfirmPassword}
                          placeholder="Confirm Password"
                          type="password"
                          error={errors.confirmPassword}
                          required
                          showToggle
                          showPassword={showConfirmPassword}
                          onTogglePassword={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* SUBMIT BUTTON */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="btn btn-vibrant-primary w-full mt-6 text-base font-semibold py-3"
                    whileHover={!loading ? { scale: 1.02 } : {}}
                    whileTap={!loading ? { scale: 0.98 } : {}}
                  >
                    {loading && <Loader size={18} className="animate-spin" />}
                    {loading
                      ? "Please wait..."
                      : isLogin
                      ? "Sign In"
                      : "Create Account"}
                  </motion.button>
                </form>

                {/* TERMS - SIGNUP */}
                {!isLogin && (
                  <p className="text-xs text-center text-base-content/60">
                    By signing up, you agree to our{" "}
                    <a href="#" className="link link-primary">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="link link-primary">
                      Privacy Policy
                    </a>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
