import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import { LoadingBlock } from '../../components/LoadingSpinner';
import { X } from 'lucide-react';

const ProfilePanel = ({ profile, loading, error }) => {
  if (loading) {
    return (
      <div className="w-2/5 shrink-0 border-l border-gray-100 flex flex-col items-center justify-center p-6">
        <LoadingBlock message="Analyzing profile..." submessage="Extracting strengths and job matches" size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-2/5 shrink-0 border-l border-gray-100 p-6 flex items-center justify-center">
        <p className="text-sm text-gray-400 italic text-center">Could not load profile insights</p>
      </div>
    );
  }

  if (!profile) return null;

  const { tag_names = [], strong_aspects = [], interesting_facts = [], career_summary, recommended_jobs = [], github, name } = profile;

  return (
    <div className="w-2/5 shrink-0 border-l border-gray-100 overflow-y-auto flex flex-col gap-5 p-5 bg-gray-50/50">
      <div>
        <h3 className="text-base font-bold text-gray-900">{name || 'Candidate'}</h3>
        {github && (
          <a href={`https://github.com/${github}`} target="_blank" rel="noreferrer"
            className="text-xs text-violet-600 hover:underline mt-0.5 inline-block">
            @{github}
          </a>
        )}
        {career_summary && (
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{career_summary}</p>
        )}
      </div>

      {tag_names.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tag_names.map((t, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {strong_aspects.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Strong Aspects</p>
          <ul className="flex flex-col gap-1.5">
            {strong_aspects.map((a, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {interesting_facts.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Interesting</p>
          <ul className="flex flex-col gap-1.5">
            {interesting_facts.map((f, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommended_jobs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Recommended Jobs</p>
          <div className="flex flex-col gap-2">
            {recommended_jobs.map(job => (
              <Link key={job._id} to={`/job/${job._id}/analysis`}
                className="block p-3 rounded-lg border border-gray-100 bg-white hover:border-violet-200 hover:shadow-sm transition">
                <p className="text-sm font-medium text-gray-800 truncate">{job.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[job.mode, job.location].filter(Boolean).join(' · ')}
                  {job.match_count > 0 && ` · ${job.match_count} tag match${job.match_count !== 1 ? 'es' : ''}`}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DisplayPDFModal = ({ open, onClose, id }) => {
  const modalRef = useRef(null);
  const embedRef = useRef(null);
  const blobUrlRef = useRef(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdf, setPDF] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !id) return;

    setPDF(null);
    setPdfError(false);
    setProfile(null);
    setProfileError(false);
    setPdfLoading(true);
    setProfileLoading(true);

    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/getPDF?id=${id}`)
      .then(res => {
        if (!res.ok) throw new Error('PDF not found');
        return res.blob();
      })
      .then(blob => setPDF(blob))
      .catch(() => setPdfError(true))
      .finally(() => setPdfLoading(false));

    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/resume/profile?id=${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Profile failed');
        return res.json();
      })
      .then(data => setProfile(data))
      .catch(() => setProfileError(true))
      .finally(() => setProfileLoading(false));
  }, [open, id]);

  useEffect(() => {
    if (!embedRef.current || !pdf) return;
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(pdf);
    blobUrlRef.current = url;
    embedRef.current.src = url;
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [pdf]);

  return (
    <Modal open={open}>
      <div ref={modalRef}
        className="bg-white rounded-lg shadow-2xl h-[95vh] w-[65vw] max-w-[95vw] flex overflow-hidden relative"
      >
        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          title="Close">
            <X className='size-5' />
        </button>

        <div className="flex-1 min-w-0 flex flex-col p-2">
          {pdfLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingBlock message="Loading resume..." size="md" />
            </div>
          ) : pdfError ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400 italic">PDF could not be loaded</p>
            </div>
          ) : (
            <embed ref={embedRef} width="100%" height="100%" className="rounded" />
          )}
        </div>

        <ProfilePanel profile={profile} loading={profileLoading} error={profileError} />
      </div>
    </Modal>
  );
};

export default DisplayPDFModal;
