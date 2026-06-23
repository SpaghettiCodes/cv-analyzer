import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/pageHeader/Header.jsx';
import DisplayPDFModal from './resumeModal.jsx';
import ResumeUploader from '../../components/ResumeUploader/ResumeUploader.jsx';
import { SkeletonRows } from '../../components/LoadingSpinner';
import { FileText, LoaderCircle, Search, Upload, Trash2 } from 'lucide-react';

// ── Search bar ──────────────────────────────────────────────────────────────
const SearchBar = ({ value, onChange }) => (
  <div className="relative flex-1 max-w-sm p-1">
    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
    <input
      type="text"
      placeholder="Search candidates…"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent
                 placeholder-gray-400 transition"
    />
  </div>
);

// ── Upload button ────────────────────────────────────────────────────────────
const UploadButton = ({ onUploaded }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-violet-700 hover:bg-violet-800 active:scale-95
                   text-white text-sm font-medium px-4 py-2 rounded-lg transition"
      >
        <Upload className='size-4' />
        Upload Resume
      </button>
      <ResumeUploader open={open} onClose={() => { setOpen(false); onUploaded(); }} />
    </>
  );
};

// ── Delete button ────────────────────────────────────────────────────────────
const DeleteButton = ({ id, onDeleted }) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this resume? This cannot be undone.')) return;
    setLoading(true);
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/deleteResume?id=${id}`, {
        method: 'DELETE',
      });
      onDeleted(id);
    } catch {
      alert('Failed to delete resume.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="opacity-0 group-hover:opacity-100 transition ml-auto p-1.5 rounded-md
                 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
      title="Delete resume"
    >
      {loading
        ? 
        <LoaderCircle className='size-4 animate-spin' />
        : <Trash2 className='size-4' />
      }
    </button>
  );
};

// ── Tag pill ─────────────────────────────────────────────────────────────────
const Tag = ({ label }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                   bg-violet-100 text-violet-700 border border-violet-200 whitespace-nowrap">
    {label}
  </span>
);

// ── Single resume row ─────────────────────────────────────────────────────────
const ResumeRow = ({ resume, tagNames, tagsLoading, onDeleted }) => {
  const [open, setOpen] = useState(false);
  const tags = (tagNames || '').split(',').map(t => t.trim()).filter(Boolean);

  return (
    <>
      <DisplayPDFModal open={open} onClose={() => setOpen(false)} id={resume._id} />
      <div
        onClick={() => setOpen(true)}
        className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-100
                   bg-white hover:border-violet-300 hover:shadow-sm cursor-pointer transition"
      >
        {/* Avatar */}
        <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500
                        flex items-center justify-center text-white text-sm font-bold select-none">
          {(resume.name || '?')[0].toUpperCase()}
        </div>

        {/* Name */}
        <div className="w-48 shrink-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{resume.name || <span className="italic text-gray-400">Unknown</span>}</p>
          {resume.github && (
            <p className="text-xs text-gray-400 truncate">@{resume.github}</p>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 flex-1 overflow-hidden">
          {tagsLoading
            ? <span className="h-5 w-24 bg-gray-100 animate-pulse rounded-full" />
            : tags.length > 0
              ? tags.map((t, i) => <Tag key={i} label={t} />)
              : <span className="text-xs text-gray-400 italic">No tags matched</span>
          }
        </div>

        {/* Delete */}
        <DeleteButton id={resume._id} onDeleted={onDeleted} />
      </div>
    </>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = ({ filtered }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
      <FileText className='size-7 text-violet-400' />
    </div>
    <p className="text-gray-700 font-medium">{filtered ? 'No results found' : 'No resumes yet'}</p>
    <p className="text-sm text-gray-400 mt-1">{filtered ? 'Try a different search term' : 'Upload a resume to get started'}</p>
  </div>
);

// ── Main table/list ───────────────────────────────────────────────────────────
const ResumeList = () => {
  const [allResume, setAllResume] = useState([]);
  const [tagNames, setTagNames] = useState({});
  const [tagsLoadingKeys, setTagsLoadingKeys] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchResumes = useCallback(() => {
    setLoading(true);
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/getAllResumes`, { method: 'GET' })
      .then(r => r.json())
      .then(data => {
        // Bug fix: ensure we always have an array
        const resumes = Array.isArray(data) ? data : [];
        setAllResume(resumes);
      })
      .catch(err => console.error('Error fetching resumes:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchResumes(); }, [fetchResumes]);

  useEffect(() => {
    allResume.forEach(resume => {
      if (!resume.tag_ids || !Array.isArray(resume.tag_ids) || resume.tag_ids.length === 0) return;
      const key = resume.tag_ids.join(',');
      if (tagNames[key] !== undefined || tagsLoadingKeys[key]) return;

      setTagsLoadingKeys(prev => ({ ...prev, [key]: true }));
      fetch(`${process.env.REACT_APP_BACKEND_URL}/api/getTags?tags=${encodeURIComponent(key)}`, { method: 'GET' })
        .then(r => r.json())
        .then(data => {
          const names = Array.isArray(data) ? data.join(', ') : '';
          setTagNames(prev => ({ ...prev, [key]: names }));
        })
        .catch(err => console.error('Error fetching tags:', err))
        .finally(() => setTagsLoadingKeys(prev => ({ ...prev, [key]: false })));
    });
  }, [allResume]);

  const handleDeleted = (id) => setAllResume(prev => prev.filter(r => r._id !== id));

  const filtered = allResume.filter(r =>
    !search || (r.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <SearchBar value={search} onChange={setSearch} />
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{allResume.length} candidate{allResume.length !== 1 ? 's' : ''}</span>
          <UploadButton onUploaded={fetchResumes} />
        </div>
      </div>

      {/* Column headers */}
      <div className="grid px-4 text-xs font-semibold uppercase tracking-wider text-gray-400"
           style={{ gridTemplateColumns: '2.25rem 12rem 1fr 2rem' }}>
        <span />
        <span>Candidate</span>
        <span>Matched Tags</span>
        <span />
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2 overflow-auto flex-1 pr-1">
        {loading
          ? <SkeletonRows count={5} />
          : filtered.length === 0
            ? <EmptyState filtered={!!search} />
            : filtered.map(resume => {
                const key = resume.tag_ids?.join(',') || '';
                return (
                  <ResumeRow
                    key={resume._id}
                    resume={resume}
                    tagNames={tagNames[key]}
                    tagsLoading={!!tagsLoadingKeys[key]}
                    onDeleted={handleDeleted}
                  />
                );
              })
        }
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const Resume = () => (
  <div className="flex flex-col min-h-screen bg-gray-50">
    <PageHeader />
    <main className="flex flex-col flex-1 max-w-5xl mx-auto w-full px-6 py-10 gap-8 overflow-hidden">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Resumes</h1>
        <p className="text-sm text-gray-500 mt-1">Review, search, and manage uploaded candidate resumes.</p>
      </div>
      <ResumeList />
    </main>
  </div>
);

export default Resume;
