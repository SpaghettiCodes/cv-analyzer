import { useEffect, useRef, useState } from "react";
import PDFUploader from "../pdfUpload/uploadPdf";
import Modal from "../Modal";
import Spinner from "../LoadingSpinner";

const JDUploader = ({ open, onClose }) => {
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
    } catch (err) {
      alert(err.message);
      setProcessing(false);
    }
  };

  return (
    <Modal open={open}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl w-[32rem] p-7 flex flex-col gap-5 relative z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Upload Job Description</h2>
            <p className="text-sm text-gray-400 mt-1">
              Upload a file to automatically structure requirements.
            </p>
          </div>

          {!processing && (
            <PDFUploader onClose={onClose} setProcessing={setProcessing} onUpload={uploadPDF} />
          )}

          {processing && (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-10 h-10 border-[3px] border-gray-100 border-t-violet-600 rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Uploading your pdf...</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default JDUploader;