import React, { useEffect, useState } from "react";
import { QualPriority } from "../../../constants";

// ── Priority styles ───────────────────────────────────────────────────────────
const PRI = {
  [QualPriority.Mandatory]: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  [QualPriority.Bonus]:     { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  [QualPriority.Normal]:    { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' },
};
const getPri = (p) => PRI[p] || PRI[QualPriority.Normal];

// ── Pass / Fail chip ──────────────────────────────────────────────────────────
const StatusChip = ({ on }) => (
  on
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
        Pass
      </span>
    : <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        Fail
      </span>
);

// ── Qualification row ─────────────────────────────────────────────────────────
const QualRow = ({ q }) => {
  const s = getPri(q.priority);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm ${s.bg} ${s.border} ${s.text} flex-1 min-w-0`}>
        {q.minYears > 0 && <span className="font-bold shrink-0">{q.minYears}y+</span>}
        <span className="truncate">{q.name}</span>
      </div>
      <StatusChip on={q.qualified} />
    </div>
  );
};

// ── Section ───────────────────────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <div className="flex flex-col gap-2">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
    {children}
  </div>
);

// ── GitHub stats ──────────────────────────────────────────────────────────────
const GithubHighlights = ({ username }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!username) { setError(true); return; }
    setData(null); setError(false);
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/github?username=${username}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setError(true));
  }, [username]);

  const entries = data ? Object.entries(data).sort(([, a], [, b]) => b - a) : [];
  const total = entries.reduce((s, [, v]) => s + v, 0);

  return (
    <Section title="GitHub">
      {error || !username ? (
        <p className="text-sm text-gray-400 italic">No GitHub username found</p>
      ) : !data ? (
        <div className="h-4 w-32 bg-gray-100 animate-pulse rounded" />
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No public repos</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.slice(0, 6).map(([lang, lines]) => {
            const pct = total > 0 ? Math.round((lines / total) * 100) : 0;
            return (
              <div key={lang} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-24 truncate">{lang}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
};

// ── Main detail panel ─────────────────────────────────────────────────────────
const ResumeDetails = ({ viewing }) => {
  if (!viewing) {
    return (
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 flex items-center justify-center text-gray-400 text-sm min-h-[20rem]">
        Select a candidate to view their details
      </div>
    );
  }

  const { name, summary, highlights = [], github, qualifications = {} } = viewing;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-7 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{name}</h2>
          {github && (
            <a href={`https://github.com/${github}`} target="_blank" rel="noreferrer"
              className="text-sm text-violet-600 hover:underline mt-0.5 inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.3 9.42 7.87 10.95.58.1.79-.25.79-.56v-2.04c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.55-.29-5.23-1.27-5.23-5.67 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.45.11-3.03 0 0 .96-.31 3.15 1.17a10.96 10.96 0 0 1 5.74 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.74.11 3.03.73.8 1.18 1.82 1.18 3.07 0 4.41-2.69 5.38-5.25 5.66.41.36.78 1.06.78 2.13v3.17c0 .31.21.67.8.56C20.7 21.42 24 17.1 24 12c0-6.35-5.15-11.5-12-11.5z"/>
              </svg>
              @{github}
            </a>
          )}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <Section title="Summary">
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
        </Section>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <Section title="Highlights">
          <ul className="flex flex-col gap-1.5">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* GitHub */}
      <GithubHighlights username={github} />

      {/* Qualifications */}
      <Section title="Qualification Match">
        <div className="flex flex-col gap-4">
          {[
            { key: 'pastExperience', label: 'Experience' },
            { key: 'technical', label: 'Technical Skills' },
            { key: 'soft', label: 'Soft Skills' },
          ].map(({ key, label }) =>
            (qualifications[key]?.length > 0) && (
              <div key={key} className="flex flex-col gap-1.5">
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                {qualifications[key].map((q, i) => <QualRow key={i} q={q} />)}
              </div>
            )
          )}
        </div>
      </Section>
    </div>
  );
};

export default ResumeDetails;
