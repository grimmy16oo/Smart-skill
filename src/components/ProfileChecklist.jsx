// components/ProfileChecklist.jsx
import { motion } from "framer-motion";
import { CheckCircle2, Circle, TrendingUp, Sparkles } from "lucide-react";

export default function ProfileChecklist({ completion, profile, suggestedSkills, isDark }) {
  const { percentage } = completion;
  
  const items = [
    { key: 'avatar', label: 'Add profile photo', tip: 'Profiles with photos get 5x more matches' },
    { key: 'bio', label: 'Write a bio', tip: 'Tell people what you want to exchange' },
    { key: 'location', label: 'Add your location', tip: 'Find local skill exchanges' },
    { key: 'skillsOffered', label: 'Add 1+ skill you can teach', tip: 'One skill is enough to start' },
    { key: 'skillsWanted', label: 'Add 1+ skill to learn', tip: 'Show what you want to learn' }
  ];
  
  const isCompleted = (key) => {
    switch(key) {
      case 'avatar': return profile.avatar && profile.avatar !== '';
      case 'bio': return profile.bio && profile.bio.trim() !== '';
      case 'location': return profile.location && profile.location !== '';
      case 'skillsOffered': return profile.skillsOffered && profile.skillsOffered.length >= 1;
      case 'skillsWanted': return profile.skillsWanted && profile.skillsWanted.length >= 1;
      default: return false;
    }
  };
  
  return (
    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/20' : 'bg-gradient-to-br from-emerald-50 to-transparent border-emerald-200'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={12} className="text-emerald-500" />
            Profile Completion
          </h4>
          <p className="text-[10px] mt-1 text-emerald-600">{percentage}% Complete</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <TrendingUp size={16} className="text-emerald-500" />
        </div>
      </div>
      
      <div className="w-full h-1.5 bg-neutral-700/20 rounded-full mb-3 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className="h-full bg-gradient-to-r from-emerald-500 to-[#e2593b] rounded-full"
        />
      </div>
      
      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const completed = isCompleted(item.key);
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-start gap-2 text-[10px]"
            >
              {completed ? (
                <CheckCircle2 size={10} className="text-emerald-500 mt-0.5 shrink-0" />
              ) : (
                <Circle size={10} className="text-neutral-500 mt-0.5 shrink-0" />
              )}
              <span className={`${completed ? 'line-through opacity-60' : ''} flex-1`}>{item.label}</span>
              {!completed && <span className="text-[9px] text-emerald-500/70">{item.tip}</span>}
            </motion.div>
          );
        })}
      </div>
      
      {suggestedSkills.length > 0 && (
        <div className="mt-3 pt-3 border-t border-emerald-500/20">
          <p className="text-[9px] font-bold uppercase mb-2 text-emerald-600">Suggested Skills to Add</p>
          <div className="flex flex-wrap gap-1">
            {suggestedSkills.map(skill => (
              <span key={skill} className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
