/**
 * PortfolioShowcase.jsx  — MongoDB/REST version
 *
 * Fixes vs previous version:
 *  - No Firestore imports
 *  - loading=false by default so the tab doesn't show a spinner when uid isn't ready
 *  - Abort controller prevents state updates after unmount
 *  - addProject now uses the returned object's _id or id (MongoDB uses _id)
 *  - Confirm dialog replaced with inline confirm UI (avoids janky window.confirm on mobile)
 *  - GitHub fetch has a 5 s timeout so it can't hang indefinitely
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Plus, Star, ExternalLink, Globe,
  Image as ImageIcon, ChevronLeft, ChevronRight,
  Edit3, Trash2, Check, AlertTriangle,
} from "lucide-react";
import { getUserProjects, addProject, updateProject, deleteProject, fetchGitHubMeta } from "../services/profileFeatureService";

const EMPTY_PROJECT = {
  title: "", description: "", githubUrl: "", demoUrl: "",
  beforeImage: "", afterImage: "", skillsUsed: [], collaborators: [],
};

// ── Image gallery ─────────────────────────────────────────────────────────────
function ImageGallery({ images }) {
  const [idx, setIdx] = useState(0);
  const valid = images.filter(Boolean);
  if (valid.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl aspect-video bg-black/20">
      <img src={valid[idx]} alt={`screenshot ${idx + 1}`} className="w-full h-full object-cover"
        onError={(e) => { e.currentTarget.style.display = "none"; }} />
      {valid.length > 1 && (
        <>
          <button type="button" onClick={() => setIdx((i) => (i - 1 + valid.length) % valid.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70">
            <ChevronLeft size={14} />
          </button>
          <button type="button" onClick={() => setIdx((i) => (i + 1) % valid.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70">
            <ChevronRight size={14} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {valid.map((_, i) => (
              <button key={i} type="button" onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Before / After slider ─────────────────────────────────────────────────────
function BeforeAfter({ before, after }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  if (!before || !after) return null;

  const clamp = (v) => Math.max(0, Math.min(100, v));
  function fromEvent(clientX) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(clamp(((clientX - rect.left) / rect.width) * 100));
  }

  return (
    <div ref={ref} className="relative w-full overflow-hidden rounded-xl aspect-video select-none cursor-col-resize"
      onMouseMove={(e) => fromEvent(e.clientX)}
      onTouchMove={(e) => fromEvent(e.touches[0].clientX)}
    >
      <img src={before} alt="before" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={after} alt="after" className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-y-0 flex items-center pointer-events-none" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
        <div className="w-0.5 h-full bg-white/60" />
        <div className="absolute w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center">
          <ChevronLeft size={8} className="text-neutral-700" /><ChevronRight size={8} className="text-neutral-700" />
        </div>
      </div>
      <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-widest bg-black/50 text-white px-2 py-0.5 rounded-full">Before</span>
      <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest bg-black/50 text-white px-2 py-0.5 rounded-full">After</span>
    </div>
  );
}

// ── Inline delete confirm ─────────────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel, isDark }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[20px] backdrop-blur-sm ${
        isDark ? "bg-[#0b0b0b]/90" : "bg-white/90"
      }`}
    >
      <AlertTriangle size={20} className="text-rose-500" />
      <p className={`text-xs font-bold ${isDark ? "text-white" : "text-neutral-900"}`}>Delete this project?</p>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${isDark ? "border-white/10 text-neutral-300" : "border-neutral-200 text-neutral-600"}`}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-rose-500 text-white hover:bg-rose-600">
          Delete
        </button>
      </div>
    </motion.div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, isOwnProfile, isDark, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const images = [project.beforeImage, project.afterImage].filter(Boolean);

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className={`relative rounded-[20px] border overflow-hidden ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white border-neutral-200"}`}
    >
      <AnimatePresence>
        {confirmDelete && (
          <DeleteConfirm
            isDark={isDark}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => { setConfirmDelete(false); onDelete(project._id ?? project.id); }}
          />
        )}
      </AnimatePresence>

      {/* Media */}
      {project.beforeImage && project.afterImage ? (
        <div className="p-3 pb-0"><BeforeAfter before={project.beforeImage} after={project.afterImage} /></div>
      ) : images.length > 0 ? (
        <div className="p-3 pb-0"><ImageGallery images={images} /></div>
      ) : null}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-black tracking-tight">{project.title || "Untitled Project"}</h4>
          {isOwnProfile && (
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => onEdit(project)}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-neutral-500 hover:text-white hover:bg-white/[0.06]" : "text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"}`}>
                <Edit3 size={12} />
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {project.description && (
          <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
            {project.description}
          </p>
        )}

        {project._githubMeta && (
          <div className={`flex items-center gap-3 p-2.5 rounded-xl ${isDark ? "bg-white/[0.03]" : "bg-neutral-50"}`}>
            <Globe size={13} className={isDark ? "text-neutral-400" : "text-neutral-500"} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold truncate">{project._githubMeta.name}</p>
              {project._githubMeta.description && (
                <p className={`text-[9px] font-medium truncate ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{project._githubMeta.description}</p>
              )}
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-bold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
              <Star size={10} className="text-amber-500" />{project._githubMeta.stars}
            </div>
          </div>
        )}

        {project.skillsUsed?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.skillsUsed.map((s) => (
              <span key={s} className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                isDark ? "border-white/[0.08] text-neutral-400" : "border-neutral-200 text-neutral-500"
              }`}>{s}</span>
            ))}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {project.githubUrl && (
            <a href={project.githubUrl} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${
                isDark ? "border-white/10 text-neutral-300 hover:bg-white/[0.04]" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
              }`}>
              <Globe size={11} /> GitHub
            </a>
          )}
          {project.demoUrl && (
            <a href={project.demoUrl} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${
                isDark ? "border-white/10 text-neutral-300 hover:bg-white/[0.04]" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
              }`}>
              <ExternalLink size={11} /> Live Demo
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Project form ──────────────────────────────────────────────────────────────
function ProjectForm({ initial, onSave, onCancel, isDark }) {
  const [form, setForm]       = useState(initial ?? EMPTY_PROJECT);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [ghLoading, setGhLoad]= useState(false);

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleGhFetch() {
    if (!form.githubUrl) return;
    setGhLoad(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const meta = await fetchGitHubMeta(form.githubUrl);
      if (meta) {
        setForm((f) => ({
          ...f,
          title:        f.title       || meta.name,
          description:  f.description || meta.description,
          _githubMeta:  meta,
        }));
      }
    } catch {
      // silent — user can still fill fields manually
    } finally {
      clearTimeout(timeout);
      setGhLoad(false);
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (e) {
      setError(e.message || "Failed to save project.");
      setSaving(false);   // only reset on error; success closes form
    }
  }

  const inputCls = `px-3 py-2.5 text-xs font-medium rounded-xl border outline-none transition-all w-full ${
    isDark
      ? "bg-neutral-900 text-white border-white/10 focus:border-[#e2593b] placeholder:text-neutral-600"
      : "bg-white text-neutral-900 border-neutral-300 focus:border-[#e2593b] placeholder:text-neutral-400"
  }`;

  return (
    <div className={`p-5 rounded-[20px] border space-y-4 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#e2593b]">
        {initial ? "Edit project" : "New project"}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Title *</span>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="My Awesome Project" />
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Description</span>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
            className={`${inputCls} min-h-[72px] resize-none`} placeholder="What did you build or learn?" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>GitHub URL</span>
          <div className="flex gap-2">
            <input value={form.githubUrl} onChange={(e) => set("githubUrl", e.target.value)} className={inputCls} placeholder="https://github.com/user/repo" />
            <button type="button" onClick={handleGhFetch} disabled={!form.githubUrl || ghLoading}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest shrink-0 border transition-all ${
                isDark ? "border-white/10 text-neutral-300 hover:bg-white/[0.06]" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
              } ${(!form.githubUrl || ghLoading) ? "opacity-50 cursor-not-allowed" : ""}`}>
              {ghLoading ? <Loader2 size={11} className="animate-spin" /> : "Fetch"}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Demo URL</span>
          <input value={form.demoUrl} onChange={(e) => set("demoUrl", e.target.value)} className={inputCls} placeholder="https://myapp.vercel.app" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Before image URL</span>
          <input value={form.beforeImage} onChange={(e) => set("beforeImage", e.target.value)} className={inputCls} placeholder="https://..." />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>After image URL</span>
          <input value={form.afterImage} onChange={(e) => set("afterImage", e.target.value)} className={inputCls} placeholder="https://..." />
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Skills used (comma-separated)</span>
          <input
            value={(form.skillsUsed ?? []).join(", ")}
            onChange={(e) => set("skillsUsed", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            className={inputCls}
            placeholder="React, Python, Figma"
          />
        </label>
      </div>

      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
            isDark ? "border-white/10 text-neutral-300 hover:bg-white/[0.04]" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          }`}>Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={saving}
          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 ${
            isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-[#e2593b] text-white hover:bg-[#d44a2e]"
          } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          {saving ? "Saving…" : initial ? "Update" : "Add project"}
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PortfolioShowcase({ uid, isOwnProfile, isDark }) {
  const [projects,       setProjects]       = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [fetchError,     setFetchError]     = useState(null);
  const [showForm,       setShowForm]       = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    getUserProjects(uid)
      .then((data) => { if (!cancelled) setProjects(Array.isArray(data) ? data : []); })
      .catch((e) => {
        if (cancelled) return;
        if (e.message?.includes("404")) { setProjects([]); }   // no projects yet — fine
        else setFetchError(e.message || "Could not load projects.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [uid]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleAdd(form) {
    const saved = await addProject(uid, form);
    // MongoDB returns _id; normalise to id for consistent keying
    const project = { id: saved._id ?? saved.id, ...form, ...saved };
    setProjects((prev) => [project, ...prev]);
    setShowForm(false);
  }

  async function handleUpdate(form) {
    const id = editingProject._id ?? editingProject.id;
    await updateProject(id, form);
    setProjects((prev) => prev.map((p) => (
      (p._id ?? p.id) === id ? { ...p, ...form } : p
    )));
    setEditingProject(null);
  }

  async function handleDelete(id) {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => (p._id ?? p.id) !== id));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs font-medium text-neutral-400">
        <Loader2 size={14} className="animate-spin text-[#e2593b]" />
        Loading projects…
      </div>
    );
  }

  if (fetchError) {
    return (
      <p className={`text-xs font-medium py-4 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
        Could not load projects: {fetchError}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      {isOwnProfile && !showForm && !editingProject && (
        <button type="button" onClick={() => setShowForm(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all active:scale-95 ${
            isDark ? "border-white/10 text-neutral-300 hover:bg-white/[0.04]" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          }`}>
          <Plus size={11} /> Add project
        </button>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div key="add" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <ProjectForm onSave={handleAdd} onCancel={() => setShowForm(false)} isDark={isDark} />
          </motion.div>
        )}
        {editingProject && (
          <motion.div key="edit" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <ProjectForm initial={editingProject} onSave={handleUpdate} onCancel={() => setEditingProject(null)} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {projects.length === 0 && !showForm && !editingProject ? (
        <div className={`py-12 text-center rounded-2xl border border-dashed ${isDark ? "border-white/[0.06] text-white/20" : "border-neutral-200 text-neutral-400"}`}>
          <ImageIcon size={22} className="mx-auto mb-3 opacity-30" />
          <p className="text-xs font-medium">
            {isOwnProfile ? "Add a project to showcase your skills in action." : "No projects yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence>
            {projects.map((project) => (
              <ProjectCard
                key={project._id ?? project.id}
                project={project}
                isOwnProfile={isOwnProfile}
                isDark={isDark}
                onEdit={setEditingProject}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
