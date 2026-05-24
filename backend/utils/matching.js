const SKILL_ALIASES = new Map(
  Object.entries({
    js: "javascript",
    "node.js": "node",
    "node js": "node",
    nodejs: "node",
    "react.js": "react",
    "react js": "react",
    reactjs: "react",
    "next.js": "next",
    "next js": "next",
    nextjs: "next",
    "vue.js": "vue",
    "vue js": "vue",
    vuejs: "vue",
    "ui/ux": "ui design",
    "ui ux": "ui design",
    ux: "ui design",
    ui: "ui design",
    figma: "ui design",
    "machine learning": "ml",
    "artificial intelligence": "ai",
    typescript: "ts",
    ts: "ts",
    javascript: "javascript",
  })
);

function toPlainDoc(value) {
  return typeof value?.toObject === "function" ? value.toObject() : value;
}

export function normalizeSkill(skill) {
  const cleaned = String(skill || "")
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");

  return SKILL_ALIASES.get(cleaned) || cleaned;
}

function normalizeLocation(location) {
  return String(location || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function uniqueSkills(skills = []) {
  return [...new Set(skills.map(normalizeSkill).filter(Boolean))];
}

function overlapCount(a = [], b = []) {
  const bSet = new Set(uniqueSkills(b));
  return uniqueSkills(a).filter((skill) => bSet.has(skill)).length;
}

function ratioOverlap(a = [], b = []) {
  const aSkills = uniqueSkills(a);
  if (aSkills.length === 0) return 0;
  return overlapCount(aSkills, b) / aSkills.length;
}

function allProfileSkills(user) {
  const doc = toPlainDoc(user) || {};
  return uniqueSkills([...(doc.skillsOffered || []), ...(doc.skillsWanted || [])]);
}

function getBehaviorWeight(weights, skill) {
  if (!weights) return 0;
  if (weights instanceof Map) return weights.get(skill) || 0;
  return weights[skill] || 0;
}

function averageSkillWeight(weights, skills) {
  const normalized = uniqueSkills(skills);
  if (normalized.length === 0) return 0;

  const total = normalized.reduce((sum, skill) => sum + getBehaviorWeight(weights, skill), 0);
  return total / normalized.length;
}

export function buildBehaviorProfile(actions = []) {
  const likedSkills = new Map();
  const skippedSkills = new Map();

  actions.forEach((action) => {
    const targetUser = toPlainDoc(action.targetUser);
    if (!targetUser || !action.action) return;

    const skills = allProfileSkills(targetUser);
    if (skills.length === 0) return;

    const ageDays = action.updatedAt
      ? Math.max(0, (Date.now() - new Date(action.updatedAt).getTime()) / 86400000)
      : 0;
    const recencyWeight = Math.max(0.35, 1 - ageDays / 60);
    const targetWeights = action.action === "like" ? likedSkills : skippedSkills;
    const actionWeight = action.action === "like" ? 1 : 1.15;

    skills.forEach((skill) => {
      targetWeights.set(skill, (targetWeights.get(skill) || 0) + actionWeight * recencyWeight);
    });
  });

  return { likedSkills, skippedSkills };
}

export function computeMatchPercent(currentUser, otherUser, behaviorProfile = {}) {
  const current = toPlainDoc(currentUser);
  const other = toPlainDoc(otherUser);

  if (!current || !other) return 0;

  const currentWanted = uniqueSkills(current.skillsWanted);
  const currentOffered = uniqueSkills(current.skillsOffered);
  const otherOffered = uniqueSkills(other.skillsOffered);
  const otherWanted = uniqueSkills(other.skillsWanted);

  const learningScore = ratioOverlap(currentWanted, otherOffered) * 42;
  const exchangeScore = ratioOverlap(otherWanted, currentOffered) * 34;
  const sharedOfferedScore = ratioOverlap(currentOffered, otherOffered) * 5;
  const sharedWantedScore = ratioOverlap(currentWanted, otherWanted) * 5;

  const currentLocation = normalizeLocation(current.location);
  const otherLocation = normalizeLocation(other.location);
  const locationScore =
    currentLocation && otherLocation && currentLocation === otherLocation ? 4 : 0;

  const rating = Number(other.rating) || 0;
  const ratingScore = Math.min(Math.max(rating, 0), 5) * 1.2;

  const candidateSkills = uniqueSkills([...otherOffered, ...otherWanted]);
  const likedSignal = averageSkillWeight(behaviorProfile.likedSkills, candidateSkills);
  const skippedSignal = averageSkillWeight(behaviorProfile.skippedSkills, candidateSkills);
  const behaviorScore = Math.min(likedSignal * 4, 8) - Math.min(skippedSignal * 5, 12);

  const total =
    learningScore +
    exchangeScore +
    sharedOfferedScore +
    sharedWantedScore +
    locationScore +
    ratingScore +
    behaviorScore;

  return Math.min(99, Math.max(0, Math.round(total)));
}

export function getMatchKey(userIdA, userIdB) {
  return [userIdA.toString(), userIdB.toString()].sort().join("_");
}
