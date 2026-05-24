import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Users,
  Brain,
  Rocket,
  Zap,
  Loader2,
} from "lucide-react";
import { getFeaturedUsers } from "../services/userService";
import StarRating from "../components/StarRating";

const PLATFORM_STATS = [
  { label: "Active Learners", value: "12,400+" },
  { label: "Skills Listed", value: "340+" },
  { label: "Sessions Done", value: "48,000+" },
  { label: "Countries", value: "62" },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, delay },
});

export default function HomePage() {
  const [featuredUsers, setFeaturedUsers] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    getFeaturedUsers(3)
      .then(setFeaturedUsers)
      .catch(console.error)
      .finally(() => setLoadingFeatured(false));
  }, []);

  return (
    <div className="min-h-screen bg-base-100 text-base-content overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary/20 blur-3xl rounded-full" />
      </div>

      <section className="relative py-28 px-4 bg-red-400">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            {...fadeUp()}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-xl px-5 py-2 rounded-full mb-8"
          >
            <Sparkles size={15} className="text-primary" />
            <span className="text-sm">Learn • Teach • Connect</span>
          </motion.div>

          <motion.h1
            {...fadeUp(0.1)}
            className="text-6xl lg:text-8xl font-black leading-tight mb-8"
          >
            Find People
            <br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Who Match Your Skills
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.2)}
            className="max-w-2xl mx-auto text-lg text-base-content/60 leading-relaxed mb-10"
          >
            SkillSwap helps people exchange knowledge, collaborate, and grow together
            through real human connections.
          </motion.p>

          <motion.div {...fadeUp(0.3)} className="flex justify-center">
            <Link
              to="/swipe"
              className="btn btn-vibrant-primary btn-lg rounded-2xl px-10 hover:scale-105 transition-all"
            >
              Start Swiping
              <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-5">
          {PLATFORM_STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              {...fadeUp(i * 0.1)}
              className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center"
            >
              <h3 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {stat.value}
              </h3>
              <p className="text-sm text-base-content/50 mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">How It Works</h2>
            <p className="text-base-content/50 text-lg">
              Start your learning journey in 3 simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Brain />,
                title: "Share Skills",
                desc: "Tell people what you can teach.",
              },
              {
                icon: <Users />,
                title: "Match People",
                desc: "Find users with similar goals.",
              },
              {
                icon: <Rocket />,
                title: "Grow Together",
                desc: "Learn, collaborate, and improve.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                {...fadeUp(i * 0.15)}
                className="rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl p-8 hover:-translate-y-2 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-6">
                  {item.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                <p className="text-base-content/60 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">Featured Members</h2>
            <p className="text-base-content/50">Meet talented people from the community</p>
          </motion.div>

          {loadingFeatured ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={36} />
            </div>
          ) : featuredUsers.length === 0 ? (
            <p className="text-center text-base-content/50">
              Be the first to join —{" "}
              <Link to="/login" className="link link-primary">
                sign up now
              </Link>
            </p>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {featuredUsers.map((member, i) => (
                <motion.div
                  key={member.uid}
                  {...fadeUp(i * 0.1)}
                  className="rounded-[32px] overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl"
                >
                  <div className="h-36 bg-gradient-to-br from-primary/30 to-secondary/20 flex justify-center items-end">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-24 h-24 rounded-full border-4 border-base-100 translate-y-12 object-cover"
                    />
                  </div>

                  <div className="pt-16 p-6 text-center">
                    <h3 className="text-2xl font-bold mb-2">{member.name}</h3>
                    <StarRating rating={member.rating || 4.8} />
                    <div className="badge badge-primary mt-4">
                      {member.matchPercent || 85}% Match
                    </div>
                    <Link
                      to="/swipe"
                      className="btn btn-vibrant-primary w-full rounded-2xl mt-6 font-semibold"
                    >
                      Connect
                      <Zap size={18} />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
