// services/profileService.js
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  arrayUnion
} from 'firebase/firestore';

// ============ ACTIVITY TIMELINE ============
export async function getUserActivities(userId, limitCount = 20) {
  const activitiesRef = collection(db, 'activities');
  const q = query(
    activitiesRef,
    where('userId', '==', userId),
    orderBy('completedAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addActivity(activity) {
  const activitiesRef = collection(db, 'activities');
  const newActivityRef = doc(activitiesRef);
  await setDoc(newActivityRef, {
    ...activity,
    completedAt: Timestamp.now(),
    createdAt: Timestamp.now()
  });
  return { id: newActivityRef.id, ...activity };
}

// Get achievements based on completed exchanges
export async function getUserAchievements(userId) {
  const activities = await getUserActivities(userId);
  const exchangeCount = activities.filter(a => a.type === 'exchange_completed').length;
  
  const achievements = [];
  if (exchangeCount >= 1) achievements.push({ id: 'first_exchange', name: 'First Exchange', icon: '🌟', unlocked: true });
  if (exchangeCount >= 5) achievements.push({ id: 'five_exchanges', name: '5 Exchanges', icon: '🏅', unlocked: true });
  if (exchangeCount >= 10) achievements.push({ id: 'ten_exchanges', name: '10 Exchanges', icon: '🎯', unlocked: true });
  if (exchangeCount >= 25) achievements.push({ id: 'twenty_five', name: 'Community Leader', icon: '👑', unlocked: true });
  
  // Skill-specific achievements
  const taughtSkills = activities.filter(a => a.type === 'taught');
  const uniqueSkills = new Set(taughtSkills.map(a => a.skill));
  if (uniqueSkills.size >= 3) {
    achievements.push({ id: 'versatile', name: 'Versatile Teacher', icon: '🎨', unlocked: true });
  }
  
  return achievements;
}

// ============ AVAILABILITY & SCHEDULING ============
export async function getUserAvailability(userId) {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const data = userDoc.data();
  return data?.availability || { recurring: [], timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, sessions: [] };
}

export async function updateUserAvailability(userId, availability) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { availability });
}

export async function createSession(matchId, requesterId, recipientId, proposedTime, skill) {
  const sessionsRef = collection(db, 'sessions');
  const newSessionRef = doc(sessionsRef);
  await setDoc(newSessionRef, {
    matchId,
    requesterId,
    recipientId,
    proposedTime: Timestamp.fromDate(proposedTime),
    status: 'pending',
    skill,
    createdAt: Timestamp.now(),
    messages: []
  });
  return { id: newSessionRef.id };
}

export async function getUserSessions(userId) {
  const sessionsRef = collection(db, 'sessions');
  const q = query(
    sessionsRef,
    where('requesterId', '==', userId),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============ PORTFOLIO SHOWCASE ============
export async function getUserProjects(userId) {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const data = userDoc.data();
  return data?.projects || [];
}

export async function addProject(userId, project) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    projects: arrayUnion({
      id: Date.now().toString(),
      ...project,
      createdAt: Timestamp.now()
    })
  });
}

export async function removeProject(userId, projectId) {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const projects = userDoc.data()?.projects || [];
  const updatedProjects = projects.filter(p => p.id !== projectId);
  await updateDoc(userRef, { projects: updatedProjects });
}

// ============ PRESENCE SYSTEM ============
export function subscribeToUserPresence(userId, onStatusChange) {
  const presenceRef = doc(db, 'presence', userId);
  return onSnapshot(presenceRef, (doc) => {
    if (doc.exists()) {
      onStatusChange(doc.data());
    } else {
      onStatusChange({ status: 'offline', lastSeen: null, currentSkill: null });
    }
  });
}

export async function updatePresence(userId, status, currentSkill = null) {
  const presenceRef = doc(db, 'presence', userId);
  await setDoc(presenceRef, {
    status,
    currentSkill,
    lastSeen: Timestamp.now(),
    updatedAt: Timestamp.now()
  }, { merge: true });
}

// ============ PROFILE COMPLETION ============
export async function getProfileCompletion(userId, profile) {
  let completed = 0;
  const total = 6;
  
  if (profile.avatar && profile.avatar !== '') completed++;
  if (profile.bio && profile.bio.length >= 50) completed++;
  if (profile.location && profile.location !== '') completed++;
  if (profile.skillsOffered && profile.skillsOffered.length >= 3) completed++;
  if (profile.skillsWanted && profile.skillsWanted.length >= 2) completed++;
  
  const activities = await getUserActivities(userId);
  if (activities.some(a => a.type === 'exchange_completed')) completed++;
  
  return { percentage: Math.round((completed / total) * 100), completed, total };
}

// Smart skill suggestions
export function getSuggestedSkills(existingSkills) {
  const skillMap = {
    'React': ['JavaScript', 'TypeScript', 'Next.js', 'Redux', 'TailwindCSS'],
    'Python': ['Data Structures', 'Pandas', 'Flask', 'Django', 'NumPy'],
    'JavaScript': ['React', 'Node.js', 'TypeScript', 'Express', 'MongoDB'],
    'UI Design': ['Figma', 'Adobe XD', 'User Research', 'Prototyping', 'Design Systems'],
    'Node.js': ['Express', 'MongoDB', 'REST APIs', 'GraphQL', 'Authentication'],
  };
  
  const suggestions = new Set();
  existingSkills.forEach(skill => {
    if (skillMap[skill]) {
      skillMap[skill].forEach(s => suggestions.add(s));
    }
  });
  
  // Remove skills user already has
  existingSkills.forEach(s => suggestions.delete(s));
  
  return Array.from(suggestions).slice(0, 5);
}
