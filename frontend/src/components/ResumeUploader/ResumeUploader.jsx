import { useEffect, useRef, useState } from "react";
import PDFUploader from "../pdfUpload/uploadPdf";
import Modal from "../Modal";
import { LoaderCircle } from "lucide-react";
import { useNavigate } from 'react-router-dom';

const ResumeUploader = ({ open, onClose }) => {
  const modalRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const uploadPDF = async (files) => {
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('File', file);
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
    }
    onClose();
    navigate('/tasks');
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
            <LoaderCircle className="size-8 animate-spin text-violet-500" />
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
