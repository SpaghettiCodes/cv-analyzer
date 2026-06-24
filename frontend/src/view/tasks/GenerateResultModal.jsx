import React from "react";
import Modal from "../../components/Modal";

export function GenerateResultModal({ open, loading, error, content, filename, title, onClose }) {
  return (
    <Modal open={open}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-[36rem] p-7 flex flex-col gap-5 max-h-[85vh] relative z-10">
          <div className="flex justify-between items-start border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{title || "Task Result"}</h2>
              {filename && <p className="text-xs text-gray-400 mt-1">File: {filename}</p>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none">
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
                <div className="w-8 h-8 border-2 border-gray-100 border-t-violet-600 rounded-full animate-spin" />
                <span className="text-sm">Loading task details...</span>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 text-red-800 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            ) : (
              <pre className="text-xs text-gray-700 bg-gray-50 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[50vh]">
                {content || "No output content available."}
              </pre>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium bg-violet-700 hover:bg-violet-800 text-white rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
