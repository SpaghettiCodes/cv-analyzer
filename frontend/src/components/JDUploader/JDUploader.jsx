import { useEffect, useRef, useState } from "react";
import PDFUploader from "../pdfUpload/uploadPdf";
import Modal from "../Modal";

const JDUploader = ({ open, onClose }) => {
  const modalRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [extractedData, setExtractedData] = useState(null);
  const [tagsList, setTagsList] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [activeTaskId, setActiveTaskId] = useState(null);

  useEffect(() => {
    if (!open) {
      setExtractedData(null);
      setTagsList([]);
      setCustomTag("");
      setActiveTaskId(null);
      return;
    }
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!activeTaskId) return;
    
    let intervalId;
    const pollTask = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tasks/${activeTaskId}`);
        if (!res.ok) return;
        const task = await res.json();
        
        if (task.status === "pending-user-input") {
          clearInterval(intervalId);
          setExtractedData(task.payload?.extracted_data || {});
          setTagsList(task.payload?.suggested_tags || []);
          setProcessing(false);
        } else if (task.status === "failed") {
          clearInterval(intervalId);
          alert("Job description analysis failed: " + (task.error || "Unknown error"));
          setProcessing(false);
          setActiveTaskId(null);
        }
      } catch (err) {
        console.error("Error polling task:", err);
      }
    };
    
    intervalId = setInterval(pollTask, 1500);
    pollTask();
    
    return () => clearInterval(intervalId);
  }, [activeTaskId]);

  const uploadPDF = async (files) => {
    try {
      setProcessing(true);
      const formData = new FormData();
      formData.append('File', files[0]);
      
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/parseJD/analyze`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      
      setActiveTaskId(json.task_id);
    } catch (err) {
      alert(err.message);
      setProcessing(false);
    }
  };

  const handleRemoveTag = (indexToRemove) => {
    setTagsList(tagsList.filter((_, index) => index !== indexToRemove));
  };

  const handleAddCustomTag = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      const cleanTag = customTag.trim();
      if (cleanTag && !tagsList.includes(cleanTag)) {
        setTagsList([...tagsList, cleanTag]);
        setCustomTag("");
      }
    }
  };

  const handleSaveJob = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/parseJD/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: activeTaskId,
          extracted_data: extractedData,
          final_tags: tagsList
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Saving failed');
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl w-[32rem] p-7 flex flex-col gap-5 relative z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Upload Job Description</h2>
            <p className="text-sm text-gray-400 mt-1">
              {!extractedData ? "Upload a file to automatically structure requirements." : "Review and configure job matching criteria tags."}
            </p>
          </div>

          {!processing && !extractedData && (
            <PDFUploader onClose={onClose} setProcessing={setProcessing} onUpload={uploadPDF} />
          )}

          {processing && (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-10 h-10 border-[3px] border-gray-100 border-t-violet-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Analysing job description...</span>
              <span className="text-xs text-gray-400">This may take a moment</span>
            </div>
          )}

          {!processing && extractedData && (
            <div className="flex flex-col gap-4 relative">
              {saving && (
                <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 border-[3px] border-gray-100 border-t-violet-600 rounded-full animate-spin" />
                  <span className="text-sm font-medium text-gray-700">Creating job & syncing resume tags...</span>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                  Job Matching Tags
                </label>
                
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-gray-100 p-3 bg-gray-50 rounded-xl mb-3">
                  {tagsList.map((tag, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200">
                      {tag}
                      <button onClick={() => handleRemoveTag(idx)} className="hover:text-violet-900 text-violet-400 font-bold transition text-xs">
                        ×
                      </button>
                    </span>
                  ))}
                  {tagsList.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No tags assigned. Add some below.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={handleAddCustomTag}
                    placeholder="Type custom tag and press Enter" 
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400"
                  />
                  <button onClick={handleAddCustomTag} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition">
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-gray-100">
                <button onClick={() => setExtractedData(null)} className="px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition">
                  Back
                </button>
                <button onClick={handleSaveJob} disabled={saving}
                  className="px-5 py-2 text-sm font-medium bg-violet-700 hover:bg-violet-800 text-white rounded-lg transition disabled:opacity-60 flex items-center gap-2">
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {saving ? 'Creating job & syncing tags...' : 'Confirm & Create Job'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default JDUploader;