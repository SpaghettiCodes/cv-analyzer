import React, { useRef, useState } from 'react';

const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation(); };

const PDFUploader = ({ onClose, setProcessing, onUpload, children }) => {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);

  const handleUpload = async () => {
    if (!files.length) return;
    if (setProcessing) setProcessing(true);
    await onUpload(files);
    if (setProcessing) setProcessing(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files;
    fileRef.current.files = dropped;
    setFiles(dropped);
  };

  const hasFile = files.length > 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      <input ref={fileRef} type="file" accept="application/pdf" id="upload-pdf" className="sr-only"
        onChange={e => setFiles(e.target.files)} />
      <label htmlFor="upload-pdf" className="cursor-pointer">
        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
            h-44 transition
            ${drag ? 'border-violet-500 bg-violet-50 scale-[1.02]' : hasFile ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/50'}`}
          onDrop={handleDrop}
          onDragOver={preventDefaults}
          onDragEnter={e => { preventDefaults(e); setDrag(true); }}
          onDragLeave={e => { preventDefaults(e); setDrag(false); }}
        >
          {hasFile ? (
            <>
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-violet-700">{files[0].name}</p>
              <p className="text-xs text-gray-400">Click to change file</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Drop PDF here or <span className="text-violet-600">browse</span></p>
                <p className="text-xs text-gray-400 mt-0.5">PDF files only</p>
              </div>
            </>
          )}
        </div>
      </label>

      {children}

      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
          Cancel
        </button>
        <button onClick={handleUpload} disabled={!hasFile}
          className="flex-1 py-2 text-sm font-medium rounded-lg bg-violet-700 hover:bg-violet-800
                     text-white transition disabled:opacity-40 disabled:cursor-not-allowed">
          Upload
        </button>
      </div>
    </div>
  );
};

export default PDFUploader;