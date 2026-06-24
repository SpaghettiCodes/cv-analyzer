import React, { useEffect, useRef, useState } from 'react';
import { JobDescriptionModal } from './jobDescriptionModal.jsx';
import JDUploader from '../../components/JDUploader/JDUploader.jsx';
import PageHeader from '../../components/pageHeader/Header.jsx';
import { SkeletonCards } from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, ListFilter, MapPin, Plus, Search, SquarePen } from 'lucide-react';
import { useTasks } from '../../context/TaskContext.jsx';

const emptyJob = {
  _id: '', title: '', mode: 'Remote', type: 'Full Time',
  position: '', location: '', description: '',
  qualifications: { pastExperience: [], technical: [], soft: [] },
  responsibilities: [],
};

const getAllTags = async (setter) => {
  const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/getAllTags`);
  if (res.ok) setter(await res.json());
};

const getJobDescs = async (setter) => {
  const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/getAllJobDescriptions`);
  if (res.ok) setter(await res.json());
};

// ── Mode / Type badge ────────────────────────────────────────────────────────
const Badge = ({ label, variant = 'default' }) => {
  const styles = {
    default: 'bg-gray-100 text-gray-600',
    mode: 'bg-blue-50 text-blue-700',
    type: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>
      {label}
    </span>
  );
};

// ── Job card ─────────────────────────────────────────────────────────────────
const JobDescriptionCard = ({ job, onClick, isEditing }) => {
  const skills = [...(job.qualifications?.technical ?? []), ...(job.qualifications?.soft ?? [])]
    .slice(0, 3)
    .map(q => q.name);
  const extra = (job.qualifications?.technical?.length ?? 0) + (job.qualifications?.soft?.length ?? 0) - skills.length;

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col bg-white rounded-xl border p-5 gap-3 cursor-pointer
        transition hover:shadow-md hover:-translate-y-0.5
        ${isEditing ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-100 hover:border-violet-200'}`}
    >
      {isEditing && (
        <span className="absolute top-3 right-3 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          editing
        </span>
      )}

      {/* Title */}
      <h3 className="font-semibold text-gray-900 text-base leading-snug pr-12">{job.title || 'Untitled'}</h3>

      {/* Meta */}
      <div className="flex flex-wrap gap-1.5">
        {job.mode && <Badge label={job.mode} variant="mode" />}
        {job.type && <Badge label={job.type} variant="type" />}
        {job.position && <Badge label={job.position} />}
      </div>

      {/* Location */}
      {job.location && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <MapPin className='size-3' />
          {job.location}
        </p>
      )}

      {/* Skills preview */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-gray-50">
          {skills.map((s, i) => (
            <span key={i} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{s}</span>
          ))}
          {extra > 0 && (
            <span className="text-xs text-gray-400 px-1 py-0.5">+{extra} more</span>
          )}
        </div>
      )}
    </div>
  );
};

// ── Filter dropdown ───────────────────────────────────────────────────────────
const FilterDropdown = ({ tags, anchorRef, onFilter, onClose }) => {
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) && !anchorRef.current?.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rect = anchorRef.current?.getBoundingClientRect();
  const style = rect ? { top: rect.bottom + window.scrollY + 8, right: window.innerWidth - rect.right } : {};

  return (
    <div ref={dropRef} className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 min-w-[160px] w-[160px] max-h-[60rem] overflow-y-auto" style={style}>
      <button onClick={() => { onFilter(null); onClose(); }}
        className="w-full text-left text-sm px-4 py-2 text-gray-700 hover:bg-gray-50 font-medium">
        All jobs
      </button>
      <div className="h-px bg-gray-100 my-1" />
      {tags.map((tag, i) => (
        <button key={i} onClick={() => { onFilter(tag); onClose(); }}
          className="w-full text-left text-sm px-4 py-2 text-gray-700 hover:bg-violet-50 hover:text-violet-700">
          {tag.tag_name}
        </button>
      ))}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const JobDescriptions = () => {
  const { tasks } = useTasks();
  const nav = useNavigate();
  const [allJobs, setAllJobs] = useState([]);
  const [results, setResults] = useState([]);
  const [tags, setTags] = useState([]);
  const [currentJob, setCurrentJob] = useState(emptyJob);
  const [modalOpen, setModalOpen] = useState(false);
  const [jdUploaderOpen, setJdUploaderOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const filterRef = useRef(null);
  const editButtonRef = useRef(null);

  useEffect(() => {
    const hasCompleted = tasks.some(t => t.type === 'jd_sync' && t.status === 'completed');
    if (hasCompleted) getJobDescs(setAllJobs);
  }, [tasks]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAllTags(setTags),
      getJobDescs(setAllJobs),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { setResults(allJobs); }, [allJobs]);

  useEffect(() => {
    if (currentJob._id) setModalOpen(true);
  }, [currentJob]);

  const handleSearch = (val) => {
    setSearch(val);
    setResults(val ? allJobs.filter(j => j.title?.toLowerCase().includes(val.toLowerCase())) : allJobs);
  };

  const handleFilter = (tag) => {
    setResults(tag ? allJobs.filter(j => j.tags?.includes(tag._id)) : allJobs);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <PageHeader />

      <JDUploader open={jdUploaderOpen} onClose={async () => {
        setJdUploaderOpen(false);
      }} />
      <JobDescriptionModal
        job={currentJob}
        open={modalOpen}
        onClose={async () => { await getJobDescs(setAllJobs); setModalOpen(false); }}
      />
      {filterOpen && (
        <FilterDropdown tags={tags} anchorRef={filterRef} onFilter={handleFilter} onClose={() => setFilterOpen(false)} />
      )}

      <main className="max-w-6xl mx-auto w-full px-6 py-10 flex flex-col gap-8">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Descriptions</h1>
            <p className="text-sm text-gray-500 mt-1">{results.length} position{results.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Search */}
            <div className="relative">
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400' />
              <input type="text" placeholder="Search jobs…" value={search} onChange={e => handleSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm w-52
                           focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder-gray-400 transition" />
            </div>

            {/* Filter */}
            <button ref={filterRef} onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-gray-300 text-gray-700 transition">
                <ListFilter className='size-4' />
              Filter
            </button>

            {/* Edit toggle */}
            <button ref={editButtonRef} onClick={() => setIsEditing(v => !v)}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium transition
                ${isEditing
                  ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                <SquarePen className='size-4'/>
              {isEditing ? 'Done editing' : 'Edit'}
            </button>

            {/* New */}
            <button onClick={() => setJdUploaderOpen(true)}
              className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-800 active:scale-95 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                <Plus className='size-4' />
              New Job
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <SkeletonCards count={8} />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
              <BriefcaseBusiness className='size-7 text-violet-400' />
            </div>
            <p className="text-gray-700 font-medium">{search ? 'No jobs match your search' : 'No job descriptions yet'}</p>
            <p className="text-sm text-gray-400 mt-1">{search ? 'Try a different term or clear the filter' : 'Click "New Job" to add your first listing'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.map((job, i) => (
              <JobDescriptionCard
                key={i}
                job={job}
                isEditing={isEditing}
                onClick={() => isEditing ? setCurrentJob(job) : nav(`/job/${job._id}/analysis`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default JobDescriptions;
