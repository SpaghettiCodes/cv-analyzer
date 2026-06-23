import { useEffect, useRef, useState } from "react";
import PDFUploader from "../pdfUpload/uploadPdf";
import Modal from "../Modal";

const ResumeUploader = ({ open, onClose }) => {
  const modalRef = useRef(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const uploadPDF = async (files) => {
    const formData = new FormData();
    formData.append('File', files[0]);
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed')
    else onClose();
  };

  return (
    <Modal open={open}>
      <div ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-[30rem] p-7 flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Upload Resume</h2>
          <p className="text-sm text-gray-500 mt-0.5">AI will extract candidate info and match tags</p>
        </div>

        {processing ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
            <svg className="w-8 h-8 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-sm font-medium">Analysing resume…</span>
          </div>
        ) : (
          <PDFUploader onClose={onClose} setProcessing={setProcessing} onUpload={uploadPDF} />
        )}
      </div>
    </Modal>
  );
};

export default ResumeUploader;
