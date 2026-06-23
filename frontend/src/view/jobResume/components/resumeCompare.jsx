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
    <div className={`flex-1 min-w-0 flex flex-col gap-5 border rounded-xl p-5 ${accent} overflow-y-auto`}>
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

const ResumeCompare = ({ candidateA, candidateB, maxQua, jobId }) => {
  const scoreA = countMatched(candidateA.qualifications);
  const scoreB = countMatched(candidateB.qualifications);
  const winner = scoreA > scoreB ? candidateA.name : scoreB > scoreA ? candidateB.name : null;

  const [aiData, setAiData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!candidateA?.id || !candidateB?.id || !jobId) return;
    
    setLoading(true);
    setError(null);
    
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/resume/compare_ai?idA=${candidateA.id}&idB=${candidateB.id}&jobId=${jobId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch qualitative AI analysis');
        return res.json();
      })
      .then(data => {
        setAiData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [candidateA?.id, candidateB?.id, jobId]);

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

      <div className="flex gap-4 flex-1 min-h-3/4 overflow-y-auto">
        <CompareColumn candidate={candidateA} maxQua={maxQua} accent="border-violet-100 bg-violet-50/30" />
        <CompareColumn candidate={candidateB} maxQua={maxQua} accent="border-fuchsia-100 bg-fuchsia-50/30" />
      </div>

      <div className="shrink-0 border border-gray-100 rounded-xl p-4 bg-gray-50/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Key Differences</p>
        <QualDiff a={candidateA} b={candidateB} />
      </div>

      <div className="shrink-0 border border-violet-100 rounded-xl p-5 bg-white shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-violet-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.43c1.002-.5 1.796-1.353 2.24-2.39a4.5 4.5 0 00-6.42-6.42c-1.037.444-1.89 1.238-2.39 2.24l-4.43 8.904L15.904 15M3 3l.01-.01M7.5 7.5l.01-.01M13.5 3.5l.01-.01M4 8.5l.01-.01M19 19l.01-.01" />
          </svg>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">AI Pros & Cons Deep Dive</h3>
        </div>

        {loading && (
          <p className="text-sm text-gray-400 italic animate-pulse">
            Analyzing both resumes completely to extract behavioral strengths and technical gaps...
          </p>
        )}
        
        {error && (
          <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
            Could not calculate deep dive: {error}
          </p>
        )}

        {aiData && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              
              {/* Candidate A Insights Panel */}
              <div className="bg-violet-50/10 border border-violet-100/60 rounded-xl p-4 flex flex-col gap-3">
                <h4 className="text-sm font-bold text-violet-900">{candidateA.name}</h4>
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-1">🟢 Advantages</p>
                  <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
                    {aiData.candidateA?.pros?.map((pro, i) => <li key={i}>{pro}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-1">🔴 Vulnerabilities / Gaps</p>
                  <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
                    {aiData.candidateA?.cons?.map((con, i) => <li key={i}>{con}</li>)}
                  </ul>
                </div>
              </div>

              {/* Candidate B Insights Panel */}
              <div className="bg-fuchsia-50/10 border border-fuchsia-100/60 rounded-xl p-4 flex flex-col gap-3">
                <h4 className="text-sm font-bold text-fuchsia-900">{candidateB.name}</h4>
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Advantages</p>
                  <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
                    {aiData.candidateB?.pros?.map((pro, i) => <li key={i}>{pro}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-1">Vulnerabilities / Gaps</p>
                  <ul className="list-disc pl-4 text-xs text-gray-600 space-y-1">
                    {aiData.candidateB?.cons?.map((con, i) => <li key={i}>{con}</li>)}
                  </ul>
                </div>
              </div>

            </div>

            {/* Bottom Comprehensive Comparative Summary */}
            {aiData.comparative_summary && (
              <div className="bg-gray-50/60 border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Recruiter Summary</p>
                <p className="text-sm text-gray-700 leading-relaxed">{aiData.comparative_summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { countMatched, totalQuals };
export default ResumeCompare;
