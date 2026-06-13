import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll } from "framer-motion";
import { ArrowUpRight, Sparkles, Brain, Rocket, Users, Loader2 } from "lucide-react";

import { useTheme } from "../context/ThemeContext";
import { getFeaturedUsers } from "../services/userService";
import StarRating from "../components/StarRating";
import UserAvatar from "../components/UserAvatar";

const fadeUp = (delay = 0, y = 30) => ({
  initial: { opacity: 0, y, filter: "blur(4px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, amount: 0.1 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
});

export default function HomePage() {
  const { isDark } = useTheme();
  const [featuredUsers, setFeaturedUsers] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    getFeaturedUsers(3)
      .then(setFeaturedUsers)
      .catch(console.error)
      .finally(() => setLoadingFeatured(false));
  }, []);

  return (
    <div className={`min-h-screen font-sans tracking-tight selection:bg-orange-500/30 relative overflow-x-hidden transition-colors duration-300 ${isDark ? "bg-[#0b0b0b] text-white" : "bg-[#fcfcfc] text-neutral-900"
      }`}>

      {/* SCROLL PROGRESS TRACKER */}
      <motion.div
        className={`fixed top-0 left-0 right-0 h-[3px] origin-left z-50 ${isDark ? 'bg-white' : 'bg-neutral-900'}`}
        style={{ scaleX: scrollYProgress }}
      />

      {/* 1. HERO CONTRAST CARD MODULE */}
      <section className="px-3 pt-3 lg:px-4 lg:pt-4 mb-24">
        <div className="w-full bg-gradient-to-tr from-[#cd3f24] via-[#e2593b] to-[#f49333] rounded-[36px] lg:rounded-[48px] relative overflow-hidden min-h-[88vh] flex flex-col justify-between p-6 lg:p-16 pt-32 lg:pt-40 text-white shadow-xl">

          <div className="absolute inset-0 bg-black/[0.02] mix-blend-multiply pointer-events-none" />
          <div
            className="absolute right-0 bottom-0 top-0 w-full lg:w-[45%] bg-cover bg-center mix-blend-luminosity opacity-20 lg:opacity-40 pointer-events-none"
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop')` }}
          />

          <div className="relative z-10 max-w-4xl">
            <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 bg-white/12 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full mb-6">
              <Sparkles size={12} className="text-white animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Learn / Teach / Connect</span>
            </motion.div>

            <motion.h1
              {...fadeUp(0.08)}
              className={`text-5xl sm:text-7xl lg:text-[88px] font-black tracking-tighter leading-[0.92] mb-8 ${isDark
                  ? "text-white"
                  : "text-black"
                }`}
            >
              Find People
              <br />
              Who Match Your Skills
            </motion.h1>

            <motion.p {...fadeUp(0.15)} className="max-w-md text-base sm:text-lg text-white/90 font-medium leading-relaxed mb-10">
              SkillSwap helps people exchange knowledge, collaborate, and grow together through real human connections.
            </motion.p>

            <motion.div {...fadeUp(0.22)} className="flex flex-wrap gap-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link to="/swipe" className="bg-white text-black font-bold text-sm px-8 py-3.5 rounded-full flex items-center gap-2.5 shadow-md hover:bg-neutral-50 transition-colors">
                  Start Swiping
                  <ArrowUpRight size={15} strokeWidth={2.5} />
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link to="/login" className="bg-white/10 hover:bg-white/15 text-white font-semibold text-sm px-7 py-3.5 rounded-full border border-white/10 backdrop-blur-sm transition-colors">
                  Explore Platform
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* LOWER METRICS SUMMARY LINE */}
          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4 border-t border-white/20 pt-8 mt-12">
            {[
              { id: "#01", count: "12k+", title: "Active Knowledge Learners" },
              { id: "#02", count: "340+", title: "Interactive Skills Listed" },
              { id: "#03", count: "48k+", title: "Exchange Sessions" },
              { id: "#04", count: "62", title: "Global Countries" }
            ].map((stat) => (
              <div key={stat.id}>
                <span className="text-[10px] font-mono opacity-40 block mb-0.5">{stat.id}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold">{stat.count}</span>
                  <p className="text-xs opacity-80 truncate">{stat.title}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>


      {/* 3. DESIGN STATEMENT TEXT */}
      <section className="max-w-7xl mx-auto px-8 grid lg:grid-cols-12 gap-8 items-start mb-24">
        <div className="lg:col-span-5">
          <span className="text-xs font-bold text-[#e2593b] uppercase tracking-widest block mb-3">How it works</span>
          <h2 className="text-4xl lg:text-[42px] font-bold tracking-tight leading-[1.08]">
            Shaping Experiences That Make Growth Simpler
          </h2>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <p className={`text-lg leading-relaxed font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Smart matching pairs what you can teach with what someone else wants to learn, then opens a direct path to plan the exchange together.
          </p>
        </div>
      </section>

      {/* 4. DESIGN PILL CARDS GRID */}
      <section className="max-w-7xl mx-auto px-8 mb-32">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <Brain size={22} />, title: "Share Skills", desc: "List what you can teach and what you want to learn next." },
            { icon: <Users size={22} />, title: "Match People", desc: "Meet members whose goals line up with the skills you offer." },
            { icon: <Rocket size={22} />, title: "Grow Together", desc: "Trade lessons, review work, and keep learning without money changing hands." },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              {...fadeUp(i * 0.08)}
              whileHover={{ y: -6 }}
              className={`rounded-[28px] border p-8 transition-colors ${isDark
                  ? "border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03]"
                  : "border-neutral-900/[0.05] bg-neutral-900/[0.01] hover:bg-neutral-900/[0.03]"
                }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#e2593b]/10 text-[#e2593b] flex items-center justify-center mb-6">
                {item.icon}
              </div>
              <h3 className="text-xl font-bold mb-3.5">{item.title}</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. DIRECTORY PORTRAITS SECTION */}
      <section className="max-w-7xl mx-auto px-8 pb-32">
        <div className="flex flex-col items-center mb-16 text-center">
          <span className="text-xs font-bold text-[#e2593b] uppercase tracking-widest block mb-2">Active Directory</span>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Featured Members</h2>
        </div>

        {loadingFeatured ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-[#e2593b]" size={28} />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredUsers.map((member, i) => (
              <motion.div
                key={member.uid}
                {...fadeUp(i * 0.06)}
                whileHover={{ y: -5 }}
                className={`rounded-[32px] overflow-hidden border flex flex-col justify-between ${isDark
                    ? "border-white/[0.05] bg-white/[0.01]"
                    : "border-neutral-900/[0.05] bg-neutral-900/[0.01] shadow-sm"
                  }`}
              >
                <div className={`h-28 flex justify-center items-end relative ${isDark ? 'bg-gradient-to-b from-[#e2593b]/10 to-transparent' : 'bg-gradient-to-b from-[#e2593b]/5 to-transparent'}`}>
                  <Link to={`/profile/${member.uid}`} className="translate-y-11 hover:opacity-90 transition-opacity">
                    <UserAvatar
                      user={member}
                      size="xl"
                      className={`border-4 ${isDark ? 'border-[#0b0b0b]' : 'border-[#fcfcfc]'}`}
                    />
                  </Link>
                </div>

                <div className="pt-16 p-6 text-center flex flex-col items-center flex-grow">
                  <Link to={`/profile/${member.uid}`} className="hover:text-[#e2593b] transition-colors">
                    <h3 className="text-lg font-bold mb-1">{member.name}</h3>
                  </Link>

                  <div className="mb-4">
                    <StarRating rating={member.rating ?? 0} />
                  </div>

                

                  <Link
                    to={`/profile/${member.uid}`}
                    className={`w-full py-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-auto ${isDark
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-neutral-900 text-white hover:bg-neutral-800'
                      }`}
                  >
                    View Profile
                    <ArrowUpRight size={13} strokeWidth={2.5} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
