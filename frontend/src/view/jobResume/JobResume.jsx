import React, { useEffect, useState } from "react";
import ResumeDetails from "./components/resumeDetails";
import ResumeCompare from "./components/resumeCompare";
import PageHeader from "../../components/pageHeader/Header.jsx";
import { LoadingBlock } from "../../components/LoadingSpinner";
import { useParams, useNavigate } from "react-router-dom";

const ScoreBar = ({ matched, max }) => {
  const pct = max > 0 ? Math.round((matched / max) * 100) : 0;
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-12 text-right shrink-0">{matched}/{max}</span>
    </div>
  );
};

const CandidateList = ({ tableData, maxValue, viewing, compareMode, compareIds, onRowClick, onCompareToggle }) => (
  <div className="flex flex-col gap-2">
    <div className={`grid px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 ${compareMode ? 'grid-cols-[1.5rem_1fr_6rem]' : 'grid-cols-[1fr_6rem]'}`}>
      {compareMode && <span />}
      <span>Candidate</span>
      <span className="text-right">Match</span>
    </div>

    {tableData.map((row, idx) => {
      const isSelected = !compareMode && viewing && viewing.id === row.id;
      const isCompareSelected = compareMode && compareIds.includes(row.id);
      return (
        <div key={row.id || idx} className="flex items-stretch gap-1">
          {compareMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onCompareToggle(row.id); }}
              className={`shrink-0 w-7 flex items-center justify-center rounded-lg border transition
                ${isCompareSelected
                  ? 'border-violet-400 bg-violet-100 text-violet-700'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                }`}
              title="Select for comparison"
            >
              {isCompareSelected ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <span className="w-3 h-3 rounded border border-current" />
              )}
            </button>
          )}
          <button
            onClick={onRowClick(idx)}
            disabled={compareMode}
            className={`flex-1 text-left p-3 rounded-xl border transition flex flex-col gap-2
              ${isSelected
                ? 'border-violet-200 bg-violet-50/50 shadow-sm ring-1 ring-violet-500/10'
                : isCompareSelected
                  ? 'border-violet-200 bg-violet-50/30'
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
              } ${compareMode ? 'cursor-default' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-semibold truncate ${isSelected || isCompareSelected ? 'text-violet-900' : 'text-gray-800'}`}>
                {row.name}
              </span>
            </div>

            {row.isAnalyzing ? (
              <span className="text-xs text-violet-500 animate-pulse font-medium">AI is analyzing...</span>
            ) : row.error ? (
              <span className="text-xs text-red-400">Analysis failed</span>
            ) : (
              <ScoreBar matched={row.matched} max={maxValue} />
            )}
          </button>
        </div>
      );
    })}
  </div>
);

export default function JobResume() {
  const { id } = useParams();
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [titleLoading, setTitleLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [tableData, setTableData] = useState(null);
  const [maxQua, setMaxQua] = useState(0);
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setTitleLoading(true);
      try {
        const jdRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/getJobDescription?id=${id}`);
        if (jdRes.ok) {
          const jdData = await jdRes.json();
          if (isMounted) {
            setTitle(jdData.title);
            const expCount = jdData.qualifications?.pastExperience?.length || 0;
            const techCount = jdData.qualifications?.technical?.length || 0;
            const softCount = jdData.qualifications?.soft?.length || 0;
            setMaxQua(expCount + techCount + softCount);
          }
        }
      } catch (err) { console.error(err); } 
      finally { if (isMounted) setTitleLoading(false); }

      try {
        const analysisRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/job/analysis?id=${id}`);
        if (analysisRes.ok) {
          const data = await analysisRes.json();
          if (!isMounted) return;

          // set resume placeholders
          const initialData = data.map((item) => ({
            id: item._id  || item.id,
            name: item.name,
            isAnalyzing: true,
            matched: 0,
            error: false
          }));

          setResults(initialData);
          setTableData(initialData);
          if (initialData.length > 0) setViewing(initialData[0]);
          setLoading(false);

          // for each candidate user, call api to get details
          data.forEach(async (candidate) => {
            try {
              const aiRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/job/analyze_single?jobId=${id}&resumeId=${candidate.id}`);
              if (aiRes.ok) {
                const aiData = await aiRes.json();
                if (isMounted) {
                  setResults(prev => prev.map(p => p.id === candidate.id ? { ...p, ...aiData, isAnalyzing: false } : p));
                  
                  setTableData(prev => prev.map(p => {
                    if (p.id === candidate.id) {
                      const expMatch = aiData.qualifications?.pastExperience?.filter(q => q.qualified).length || 0;
                      const techMatch = aiData.qualifications?.technical?.filter(q => q.qualified).length || 0;
                      const softMatch = aiData.qualifications?.soft?.filter(q => q.qualified).length || 0;
                      return { ...p, matched: expMatch + techMatch + softMatch, isAnalyzing: false };
                    }
                    return p;
                  }));
                  setViewing(prev => (prev && prev.id === candidate.id) ? { ...prev, ...aiData, isAnalyzing: false } : prev);
                }
              } else {
                if (isMounted) {
                  setResults(prev => prev.map(p => p.id === candidate.id ? { ...p, isAnalyzing: false, error: true } : p));
                  setTableData(prev => prev.map(p => p.id === candidate.id ? { ...p, isAnalyzing: false, error: true } : p));
                  setViewing(prev => (prev && prev.id === candidate.id) ? { ...prev, isAnalyzing: false, error: true } : prev);
                  
                }
              }
            } catch (err) {
              if (isMounted) {
                setResults(prev => prev.map(p => p.id === candidate.id ? { ...p, isAnalyzing: false, error: true } : p));
                setTableData(prev => prev.map(p => p.id === candidate.id ? { ...p, isAnalyzing: false, error: true } : p));
                setViewing(prev => (prev && prev.id === candidate.id) ? { ...prev, isAnalyzing: false, error: true } : prev);
              }
            }
          });
        }
      } catch (err) { console.error(err); if (isMounted) setLoading(false); }
    };
    
    fetchData();
    return () => { isMounted = false; };
  }, [id]);

  const toggleCompare = (candidateId) => {
    setCompareIds(prev => {
      if (prev.includes(candidateId)) return prev.filter(x => x !== candidateId);
      if (prev.length >= 2) return [prev[1], candidateId];
      return [...prev, candidateId];
    });
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setCompareIds([]);
  };

  const compareCandidates = compareIds.length === 2
    ? compareIds.map(cid => results.find(r => r.id === cid)).filter(Boolean)
    : [];

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50/50 overflow-hidden">
      <PageHeader />

      <div className="flex-1 flex flex-col px-10 pb-6 pt-4 gap-5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => nav('/job')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <div>
              {titleLoading ? (
                <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              )}
              <p className="text-sm text-gray-500 mt-0.5">Resume analysis</p>
            </div>
          </div>

          {tableData && tableData.length >= 2 && (
            <button
              onClick={() => compareMode ? exitCompareMode() : setCompareMode(true)}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition
                ${compareMode
                  ? 'bg-violet-700 border-violet-700 text-white hover:bg-violet-800'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" />
              </svg>
              {compareMode ? 'Exit compare' : 'Compare resumes'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm">
            <LoadingBlock
              message="Evaluating Resumes"
              submessage="AI cross-referencing candidate profiles against job benchmarks"
              size="lg"
            />
          </div>
        ) : !tableData || tableData.length === 0 ? (
          <div className="flex-1 bg-white border border-gray-100 rounded-2xl flex flex-col items-center justify-center gap-4 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">No Matching Candidates Found</p>
              <p className="text-xs text-gray-400 mt-1">Make sure you have resumes matching this job's profile tags.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex gap-6 overflow-hidden">
            <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
              {compareMode && (
                <p className="text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                  Pick 2 candidates ({compareIds.length}/2 selected)
                </p>
              )}
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 sticky top-0 bg-gray-50/50 py-1 backdrop-blur-sm z-10">
                {tableData.length} candidate{tableData.length !== 1 ? 's' : ''}
              </p>
              <CandidateList
                tableData={tableData}
                maxValue={maxQua}
                viewing={viewing}
                compareMode={compareMode}
                compareIds={compareIds}
                onCompareToggle={toggleCompare}
                onRowClick={(i) => () => !compareMode && setViewing(results[i])}
              />
            </div>

            <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-y-auto p-7 min-w-0">
              {compareMode && compareCandidates.length === 2 ? (
                <ResumeCompare candidateA={compareCandidates[0]} candidateB={compareCandidates[1]} maxQua={maxQua} jobId={id} />
              ) : compareMode ? (
                <div className="h-full flex items-center justify-center text-gray-400 italic text-sm text-center px-8">
                  Select two candidates from the list to compare side by side
                </div>
              ) : viewing?.isAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-4">
                   <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                   <p>Extracting insights...</p>
                </div>
              ) : viewing?.error ? (
                <div className="h-full flex items-center justify-center text-red-400 italic text-sm">
                  Failed to generate AI insights for this candidate.
                </div>
              ) : viewing ? (
                <ResumeDetails viewing={viewing} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">
                  Select a candidate to inspect metrics
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
