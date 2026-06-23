import React, { useEffect, useRef, useState } from 'react';
import { QualPriority, JobMode, JobType } from '../../constants';
import Modal from '../../components/Modal';
import { Spinner } from '../../components/LoadingSpinner';
import { Plus, RefreshCcw, Trash2, X } from 'lucide-react';

// ── Priority color helpers ────────────────────────────────────────────────────
const PRIORITY_STYLES = {
  [QualPriority.Mandatory]: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-400' },
  [QualPriority.Bonus]:     { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  [QualPriority.Normal]:    { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400' },
};
const getPri = (p) => PRIORITY_STYLES[p] || PRIORITY_STYLES[QualPriority.Normal];

// ── Read-only qualification pill ──────────────────────────────────────────────
const QualificationBean = ({ qualification }) => {
  const s = getPri(qualification.priority);
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm ${s.bg} ${s.border} ${s.text}`}>
      {qualification.minYears > 0 && <span className="font-bold">{qualification.minYears}y+</span>}
      <span>{qualification.name}</span>
    </div>
  );
};

// ── Editable qualification pill ───────────────────────────────────────────────
const ModifiableQualificationBean = ({ qualification, onClose, onDelete }) => {
  const elemRef = useRef(null);
  const [editing, setEdit] = useState(false);
  const [data, setData] = useState(qualification);
  const yearRef = useRef(null);
  const nameRef = useRef(null);

  const CYCLE = [QualPriority.Normal, QualPriority.Mandatory, QualPriority.Bonus];

  useEffect(() => {
    const handler = (e) => {
      if (elemRef.current && !elemRef.current.contains(e.target)) {
        const updated = { ...data };
        if (yearRef.current) updated.minYears = Number(yearRef.current.innerText) || 0;
        if (nameRef.current) updated.name = nameRef.current.innerText;
        onClose(updated);
        setEdit(false);
      }
    };
    if (editing) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, data]);

  const s = getPri(data.priority);

  if (!editing) {
    return (
      <div onClick={() => setEdit(true)} className="cursor-pointer">
        <QualificationBean qualification={data} />
      </div>
    );
  }

  return (
    <div ref={elemRef}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm ${s.bg} ${s.border} ${s.text}`}>
      <span ref={yearRef} contentEditable suppressContentEditableWarning
        className="font-bold min-w-[1ch] outline-none"
        onBlur={e => setData({ ...data, minYears: Number(e.currentTarget.innerText) || 0 })}>
        {data.minYears}
      </span>
      <span className="font-bold">y+</span>
      <span ref={nameRef} contentEditable suppressContentEditableWarning
        className="outline-none min-w-[2ch]"
        onBlur={e => setData({ ...data, name: e.currentTarget.innerText })}>
        {data.name}
      </span>
      {/* cycle priority */}
      <button onClick={() => setData({ ...data, priority: CYCLE[(CYCLE.indexOf(data.priority) + 1) % CYCLE.length] })}
        className="ml-1 opacity-60 hover:opacity-100 transition" title="Cycle priority">
        <RefreshCcw className='size-3.5' />
      </button>
      {/* delete */}
      <button onClick={onDelete} className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-600 transition" title="Remove">
        <X className='size-3.5' />
      </button>
    </div>
  );
};

// ── Section header with add button ────────────────────────────────────────────
const SectionHeader = ({ title, onAdd }) => (
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
    <button onClick={onAdd}
      className="w-6 h-6 rounded-full bg-violet-100 hover:bg-violet-200 text-violet-700 flex items-center justify-center transition">
        <Plus className='size-3.5' />
    </button>
  </div>
);

// ── Responsibility row ────────────────────────────────────────────────────────
const ResponsibilityItem = ({ content, onChange, onDelete }) => (
  <li className="flex items-start gap-2 group">
    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
    <textarea
      className="flex-1 text-sm text-gray-700 resize-none bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none py-1 transition"
      rows={2}
      value={content}
      onChange={onChange}
    />
    <button onClick={onDelete}
      className="mt-1.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition shrink-0">
        <X className='size-4' />
    </button>
  </li>
);

// ── API helpers ───────────────────────────────────────────────────────────────
const deleteJobDesc = (job) =>
  fetch(`${process.env.REACT_APP_BACKEND_URL}/api/deleteJobDescription?id=${job._id}`, { method: 'DELETE' });

const updateJobDesc = (job) =>
  fetch(`${process.env.REACT_APP_BACKEND_URL}/api/updateJobDescription`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  });

// ── Modal ─────────────────────────────────────────────────────────────────────
const JobDescriptionModal = ({ job, open, onClose }) => {
  const modalRef = useRef(null);
  const [jobState, setJobState] = useState(job);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateJobDesc(jobState);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteJobDesc(jobState);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => { setJobState(job); }, [job]);

  useEffect(() => {
    if (!open) return;
    const handler = async (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        if (saving || deleting) return;
        await updateJobDesc(jobState);
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, jobState, saving, deleting]);

  const updateQuals = (key, arr) =>
    setJobState(s => ({ ...s, qualifications: { ...s.qualifications, [key]: arr } }));

  const addQual = (key) =>
    updateQuals(key, [...jobState.qualifications[key], { name: 'New', priority: QualPriority.Normal, minYears: 0 }]);

  const modifyQual = (key, i) => (val) => {
    const arr = [...jobState.qualifications[key]]; arr[i] = val; updateQuals(key, arr);
  };

  const deleteQual = (key, i) => () =>
    updateQuals(key, jobState.qualifications[key].filter((_, idx) => idx !== i));

  const addResp = () => setJobState(s => ({ ...s, responsibilities: [...s.responsibilities, ''] }));
  const deleteResp = (i) => setJobState(s => ({ ...s, responsibilities: s.responsibilities.filter((_, idx) => idx !== i) }));

  return (
    <Modal open={open}>
      <div ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-[56rem] max-h-[88vh] flex flex-col overflow-hidden">

        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 px-7 pt-6 pb-4 border-b border-gray-100">
          <input
            className="flex-1 text-2xl font-bold text-gray-900 border-b-2 border-transparent focus:border-violet-400 focus:outline-none py-0.5 transition"
            placeholder="Job Title"
            value={jobState.title}
            onChange={e => setJobState(s => ({ ...s, title: e.target.value }))}
          />
          <button onClick={handleDelete} disabled={deleting || saving}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40" title="Delete job">
            {deleting
              ? <Spinner size="sm" />
              : <Trash2 className='size-5' />
            }
          </button>
        </div>

        {/* ── Meta row ── */}
        <div className="flex flex-wrap gap-2 px-7 py-3 border-b border-gray-100 bg-gray-50">
          {[
            { key: 'mode', opts: [JobMode.Onsite, JobMode.Remote, JobMode.Hybrid] },
            { key: 'type', opts: [JobType.FullTime, JobType.PartTime, JobType.Contract] },
          ].map(({ key, opts }) => (
            <select key={key}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700"
              value={jobState[key]}
              onChange={e => setJobState(s => ({ ...s, [key]: e.target.value }))}>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          {[['position', 'Position'], ['location', 'Location']].map(([k, ph]) => (
            <input key={k}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-700 placeholder-gray-400 w-36"
              placeholder={ph}
              value={jobState[k]}
              onChange={e => setJobState(s => ({ ...s, [k]: e.target.value }))} />
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-auto flex-1 px-7 py-5 flex gap-8">

          {/* Left: description + responsibilities */}
          <div className="flex flex-col gap-5 w-1/2">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Description</h3>
              <textarea
                className="text-sm text-gray-700 border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 min-h-[7rem]"
                placeholder="Job description…"
                value={jobState.description}
                onChange={e => setJobState(s => ({ ...s, description: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <SectionHeader title="Responsibilities" onAdd={addResp} />
              <ul className="flex flex-col gap-1">
                {jobState.responsibilities.map((r, i) => (
                  <ResponsibilityItem key={i} content={r}
                    onChange={e => {
                      const arr = [...jobState.responsibilities]; arr[i] = e.target.value;
                      setJobState(s => ({ ...s, responsibilities: arr }));
                    }}
                    onDelete={() => deleteResp(i)}
                  />
                ))}
                {jobState.responsibilities.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No responsibilities added</p>
                )}
              </ul>
            </div>
          </div>

          {/* Right: qualifications */}
          <div className="flex flex-col gap-5 w-1/2">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs">
              {Object.entries(PRIORITY_STYLES).map(([k, s]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                  <span className="text-gray-500 capitalize">{k}</span>
                </div>
              ))}
            </div>

            {[
              { key: 'pastExperience', label: 'Experience' },
              { key: 'technical', label: 'Technical Skills' },
              { key: 'soft', label: 'Soft Skills' },
            ].map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-2">
                <SectionHeader title={label} onAdd={() => addQual(key)} />
                <div className="flex flex-wrap gap-1.5">
                  {jobState.qualifications[key].map((q, i) => (
                    <ModifiableQualificationBean key={i} qualification={q}
                      onClose={modifyQual(key, i)}
                      onDelete={deleteQual(key, i)} />
                  ))}
                  {jobState.qualifications[key].length === 0 && (
                    <p className="text-xs text-gray-400 italic">None added</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-7 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button onClick={handleSave} disabled={saving || deleting}
            className="px-4 py-2 text-sm font-medium bg-violet-700 hover:bg-violet-800 text-white rounded-lg transition disabled:opacity-60 flex items-center gap-2">
            {saving && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {saving ? 'Saving...' : 'Save & close'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export { JobDescriptionModal };
