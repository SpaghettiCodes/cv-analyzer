import React from 'react';
import { QualPriority } from '../../../constants';

const PRI = {
  [QualPriority.Mandatory]: 'text-red-600',
  [QualPriority.Bonus]: 'text-emerald-600',
  [QualPriority.Normal]: 'text-gray-500',
};

const countMatched = (quals = {}) => {
  let n = 0;
  ['pastExperience', 'technical', 'soft'].forEach(k => {
    (quals[k] || []).forEach(q => { if (q.qualified) n++; });
  });
  return n;
};

const totalQuals = (quals = {}) =>
  ['pastExperience', 'technical', 'soft'].reduce((s, k) => s + (quals[k]?.length || 0), 0);

const CompareColumn = ({ candidate, maxQua, accent }) => {
  const matched = countMatched(candidate.qualifications);
  const pct = maxQua > 0 ? Math.round((matched / maxQua) * 100) : 0;
  const { qualifications = {}, highlights = [], summary } = candidate;

  return (
    <div className={`flex-1 min-w-0 flex flex-col gap-5 border rounded-xl p-5 ${accent}`}>
      <div>
        <h3 className="text-lg font-bold text-gray-900">{candidate.name}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{matched}/{maxQua} qualifications · {pct}% match</p>
      </div>

      {summary && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Summary</p>
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
        </div>
      )}

      {highlights.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Highlights</p>
          <ul className="flex flex-col gap-1">
            {highlights.slice(0, 4).map((h, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Qualifications</p>
        <div className="flex flex-col gap-3">
          {['pastExperience', 'technical', 'soft'].map(key => {
            const items = qualifications[key] || [];
            if (!items.length) return null;
            const label = key === 'pastExperience' ? 'Experience' : key === 'technical' ? 'Technical' : 'Soft Skills';
            return (
              <div key={key}>
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <div className="flex flex-col gap-1">
                  {items.map((q, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className={`truncate ${PRI[q.priority] || ''}`}>{q.name}</span>
                      <span className={q.qualified ? 'text-emerald-600 font-medium' : 'text-red-500'}>
                        {q.qualified ? '✓' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const DiffRow = ({ name, a, b }) => {
  const aPass = a?.qualified;
  const bPass = b?.qualified;
  if (aPass === bPass) return null;
  const winner = aPass ? 'A' : 'B';
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-700 truncate flex-1">{name}</span>
      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${winner === 'A' ? 'bg-violet-100 text-violet-700' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
        {winner} only
      </span>
    </div>
  );
};

const QualDiff = ({ a, b }) => {
  const diffs = [];
  ['pastExperience', 'technical', 'soft'].forEach(key => {
    const aItems = a?.qualifications?.[key] || [];
    const bItems = b?.qualifications?.[key] || [];
    aItems.forEach((q, i) => {
      const bq = bItems[i];
      if (bq && q.name === bq.name && q.qualified !== bq.qualified) {
        diffs.push({ name: q.name, a: q, b: bq });
      }
    });
  });

  if (!diffs.length) {
    return <p className="text-sm text-gray-400 italic">No qualification differences — similar fit profiles.</p>;
  }

  return (
    <div className="flex flex-col">
      {diffs.map((d, i) => <DiffRow key={i} {...d} />)}
    </div>
  );
};

const ResumeCompare = ({ candidateA, candidateB, maxQua }) => {
  const scoreA = countMatched(candidateA.qualifications);
  const scoreB = countMatched(candidateB.qualifications);
  const winner = scoreA > scoreB ? candidateA.name : scoreB > scoreA ? candidateB.name : null;

  return (
    <div className="flex flex-col gap-5 h-full">
      {winner && (
        <div className="shrink-0 bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100 rounded-xl px-5 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-violet-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.6z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-gray-800">{winner} leads on qualifications</p>
            <p className="text-xs text-gray-500">{scoreA} vs {scoreB} matched out of {maxQua}</p>
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0 overflow-y-auto">
        <CompareColumn candidate={candidateA} maxQua={maxQua} accent="border-violet-100 bg-violet-50/30" />
        <CompareColumn candidate={candidateB} maxQua={maxQua} accent="border-fuchsia-100 bg-fuchsia-50/30" />
      </div>

      <div className="shrink-0 border border-gray-100 rounded-xl p-4 bg-gray-50/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Key Differences</p>
        <QualDiff a={candidateA} b={candidateB} />
      </div>
    </div>
  );
};

export { countMatched, totalQuals };
export default ResumeCompare;
