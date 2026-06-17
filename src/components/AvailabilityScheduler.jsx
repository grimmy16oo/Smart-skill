// components/AvailabilityScheduler.jsx
import { useState } from "react";
import { Clock, Plus, X, Globe, Save, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AvailabilityScheduler({ availability, onUpdate, isDark, isOwnProfile, onBookSession }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localSlots, setLocalSlots] = useState(availability?.recurring || []);
  const [newSlot, setNewSlot] = useState({ dayOfWeek: 1, startTime: '14:00', endTime: '17:00' });
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingSkill, setBookingSkill] = useState("");
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const addTimeSlot = () => {
    if (!newSlot.startTime || !newSlot.endTime) {
      alert("Please set both start and end times");
      return;
    }
    if (newSlot.startTime >= newSlot.endTime) {
      alert("Start time must be before end time");
      return;
    }
    setLocalSlots([...localSlots, { ...newSlot }]);
    setNewSlot({ dayOfWeek: 1, startTime: '14:00', endTime: '17:00' });
  };
  
  const removeTimeSlot = (index) => {
    const updated = [...localSlots];
    updated.splice(index, 1);
    setLocalSlots(updated);
  };
  
  const updateTimeSlot = (index, field, value) => {
    const updated = [...localSlots];
    updated[index][field] = value;
    setLocalSlots(updated);
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedAvailability = {
        recurring: localSlots,
        timezone: availability?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        sessions: availability?.sessions || []
      };
      console.log("saving started");
      await onUpdate(updatedAvailability);
      console.log("saving finished");
      setIsEditing(false);
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleCancel = () => {
    setLocalSlots(availability?.recurring || []);
    setIsEditing(false);
  };
  
  const handleBookSession = () => {
    if (!bookingDate) {
      alert("Please select a date");
      return;
    }
    onBookSession?.(new Date(bookingDate), bookingSkill);
    setShowBookingModal(false);
    setBookingDate("");
    setBookingSkill("");
  };
  
  // For viewing other users' profiles
  if (!isOwnProfile) {
    const hasSlots = availability?.recurring && availability.recurring.length > 0;
    
    return (
      <>
        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-neutral-50 border-neutral-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-[#e2593b]" />
            <h4 className="text-xs font-bold uppercase tracking-widest">Availability</h4>
          </div>
          
          {!hasSlots ? (
            <p className="text-xs text-neutral-500">No availability set</p>
          ) : (
            <div className="space-y-2">
              {availability.recurring.map((slot, idx) => (
                <div key={idx} className="text-xs flex justify-between items-center">
                  <span className="font-medium">{days[slot.dayOfWeek]}</span>
                  <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-neutral-500 pt-1 flex items-center gap-1">
                <Globe size={10} />
                {availability.timezone || 'Timezone not set'}
              </p>
            </div>
          )}
          
          {onBookSession && hasSlots && (
            <button
              onClick={() => setShowBookingModal(true)}
              className="mt-3 w-full py-2 rounded-xl bg-[#e2593b] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#d44a2e] transition-all"
            >
              Request Session
            </button>
          )}
        </div>
        
        {/* Booking Modal */}
        <AnimatePresence>
          {showBookingModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={() => setShowBookingModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={`w-full max-w-md mx-4 p-6 rounded-2xl ${isDark ? 'bg-neutral-900 border border-white/10' : 'bg-white border border-neutral-200'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold mb-4">Request a Session</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">Select Date</label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-neutral-50 border-neutral-200'}`}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold mb-1">Session Type</label>
                    <select
                      value={bookingSkill}
                      onChange={(e) => setBookingSkill(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-neutral-50 border-neutral-200'}`}
                    >
                      <option value="">Select...</option>
                      <option value="learn">I want to learn from them</option>
                      <option value="teach">I want to teach them</option>
                    </select>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => setShowBookingModal(false)}
                      className="flex-1 py-2 rounded-lg border text-sm font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBookSession}
                      className="flex-1 py-2 rounded-lg bg-[#e2593b] text-white text-sm font-bold"
                    >
                      Send Request
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }
  
  // For own profile - editing mode
  const hasSlots = localSlots.length > 0;
  
  return (
    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-neutral-50 border-neutral-200'}`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#e2593b]" />
          <h4 className="text-xs font-bold uppercase tracking-widest">Your Availability</h4>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-[10px] text-[#e2593b] font-bold uppercase tracking-wider flex items-center gap-1"
          >
            <Edit2 size={10} /> Edit
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div className="space-y-3">
          {/* Existing slots */}
          {hasSlots && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {localSlots.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <select
                    value={slot.dayOfWeek}
                    onChange={(e) => updateTimeSlot(idx, 'dayOfWeek', parseInt(e.target.value))}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}
                  >
                    {days.map((day, i) => (
                      <option key={i} value={i}>{day.substring(0, 3)}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateTimeSlot(idx, 'startTime', e.target.value)}
                    className={`px-2 py-1.5 rounded-lg text-xs w-24 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}
                  />
                  <span className="text-[10px]">to</span>
                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateTimeSlot(idx, 'endTime', e.target.value)}
                    className={`px-2 py-1.5 rounded-lg text-xs w-24 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}
                  />
                  <button onClick={() => removeTimeSlot(idx)} className="text-rose-500 hover:text-rose-600 p-1">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Add new slot */}
          <div className="border-t pt-3 mt-2">
            <p className="text-[9px] font-bold uppercase mb-2 text-neutral-500">Add Time Slot</p>
            <div className="flex gap-2">
              <select
                value={newSlot.dayOfWeek}
                onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: parseInt(e.target.value) })}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}
              >
                {days.map((day, i) => (
                  <option key={i} value={i}>{day.substring(0, 3)}</option>
                ))}
              </select>
              <input
                type="time"
                value={newSlot.startTime}
                onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                className={`px-2 py-1.5 rounded-lg text-xs w-24 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}
              />
              <span className="text-[10px]">to</span>
              <input
                type="time"
                value={newSlot.endTime}
                onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                className={`px-2 py-1.5 rounded-lg text-xs w-24 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}
              />
              <button onClick={addTimeSlot} className="text-emerald-500 hover:text-emerald-600 p-1">
                <Plus size={14} />
              </button>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2 pt-3">
            <button
              onClick={handleCancel}
              className={`flex-1 py-2 rounded-lg text-[10px] font-bold border ${isDark ? 'border-white/10' : 'border-neutral-200'}`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 py-2 rounded-lg bg-[#e2593b] text-white text-[10px] font-bold flex items-center justify-center gap-1 ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#d44a2e]'}`}
            >
              {saving ? 'Saving...' : <><Save size={12} /> Save</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {!hasSlots ? (
            <p className="text-xs text-neutral-500">No availability set. Click Edit to add your available hours.</p>
          ) : (
            <>
              {localSlots.map((slot, idx) => (
                <div key={idx} className="text-xs flex justify-between items-center">
                  <span className="font-medium">{days[slot.dayOfWeek]}</span>
                  <span>{slot.startTime} - {slot.endTime}</span>
                </div>
              ))}
              <p className="text-[10px] text-neutral-500 pt-1 flex items-center gap-1">
                <Globe size={10} />
                {availability?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
