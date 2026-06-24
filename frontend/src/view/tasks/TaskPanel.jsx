import { useState, useEffect } from "react";
import { formatDate } from "../../api/client";
import { cn } from "../lib/cn";
import { useTasks } from "../../context/TaskContext";
import PageHeader from "../../components/pageHeader/Header.jsx";

const STATUS_LABEL = {
  pending: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  "pending-user-input": "Action Required",
};

const TASK_TYPE_LABEL = {
  resume: "Process Resume",
  jd: "Process Job Description",
  jd_sync: "Sync Resume Tags",
};

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) {
    return null;
  }
  const seconds = Math.max(
    0,
    Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000),
  );
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function taskDescription(task) {
  if (task.type === "resume") {
    return `Resume: ${task.output_name || task.id}`;
  }
  if (task.type === "jd") {
    return `Job Description: ${task.output_name || task.id}`;
  }
  if (task.type === "jd_sync") {
    return "Syncing updated tags across candidates";
  }
  return task.output_name || task.id;
}

function JDTaskConfirmModal({ open, task, onClose, onConfirmed }) {
  const [tagsList, setTagsList] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTagsList(task.payload?.suggested_tags || []);
    }
  }, [task]);

  if (!open || !task) return null;

  const handleRemoveTag = (idx) => {
    setTagsList(tagsList.filter((_, i) => i !== idx));
  };

  const handleAddCustomTag = (e) => {
    if (e.key === "Enter" || e.type === "click") {
      const clean = customTag.trim();
      if (clean && !tagsList.includes(clean)) {
        setTagsList([...tagsList, clean]);
        setCustomTag("");
      }
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/parseJD/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: task.id,
          extracted_data: task.payload?.extracted_data || {},
          final_tags: tagsList,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to confirm tags");
      }
      onConfirmed();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[32rem] p-7 flex flex-col gap-5 relative z-10">
        {saving && (
          <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 border-[3px] border-gray-100 border-t-violet-600 rounded-full animate-spin" />
            <span className="text-sm font-medium text-gray-700">Syncing resume tags...</span>
          </div>
        )}

        <div className="flex justify-between items-start border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configure Tags</h2>
            <p className="text-xs text-gray-400 mt-1">Review criteria for "{task.output_name || 'Job Description'}"</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none">
            ×
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
            Suggested Tags
          </label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-gray-100 p-3 bg-gray-50 rounded-xl mb-3">
            {tagsList.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(idx)}
                  className="hover:text-violet-900 text-violet-400 font-bold transition text-xs"
                >
                  ×
                </button>
              </span>
            ))}
            {tagsList.length === 0 && <p className="text-xs text-gray-400 italic">No tags assigned. Add some below.</p>}
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
            <button
              onClick={handleAddCustomTag}
              className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 text-sm font-medium bg-violet-700 hover:bg-violet-800 text-white rounded-lg transition"
          >
            Confirm & Complete Setup
          </button>
        </div>
      </div>
    </div>
  );
}

export function TasksPanel() {
  const { tasks, loading, error, refreshTasks } = useTasks();

  // User input state
  const [selectedJdTask, setSelectedJdTask] = useState(null);
  const [jdConfirmModalOpen, setJdConfirmModalOpen] = useState(false);

  const activeTasks = tasks.filter(
    (task) => task.status === "pending" || task.status === "running" || task.status === "pending-user-input",
  );
  const recentTasks = tasks.filter(
    (task) => task.status === "completed" || task.status === "failed",
  );

  useEffect(() => {
    refreshTasks();
  }, []);

  const handleTaskClick = (task) => {
    if (task.status === "pending-user-input" && task.type === "jd") {
      setSelectedJdTask(task);
      setJdConfirmModalOpen(true);
    }
  };

  const renderTaskRow = (task) => {
    const duration = formatDuration(task.started_at, task.finished_at);
    const isClickable = task.status === "pending-user-input";

    return (
      <div
        key={task.id}
        className={cn(
          "rounded-xl border border-gray-100 bg-white p-4 transition",
          isClickable ? "cursor-pointer hover:border-violet-300 hover:shadow-sm" : "opacity-90"
        )}
        onClick={isClickable ? () => void handleTaskClick(task) : undefined}
        onKeyDown={
          isClickable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void handleTaskClick(task);
                }
              }
            : undefined
        }
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-gray-800">
              {task.output_name ?? `${TASK_TYPE_LABEL[task.type]} ${task.id.slice(0, 8)}…`}
            </div>
            <div className="mt-1 truncate text-xs text-gray-400">
              {TASK_TYPE_LABEL[task.type]} · {taskDescription(task)}
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold select-none",
              task.status === "pending" && "bg-gray-100 text-gray-600 border border-gray-200",
              task.status === "running" && "bg-violet-50 text-violet-700 border border-violet-100 animate-pulse",
              task.status === "completed" && "bg-emerald-50 text-emerald-700 border border-emerald-150",
              task.status === "failed" && "bg-red-50 text-red-700 border border-red-150",
              task.status === "pending-user-input" && "bg-amber-500 text-white border border-amber-500 animate-bounce"
            )}
          >
            {STATUS_LABEL[task.status]}
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
          <span>Created {formatDate(task.created_at)}</span>
          {duration && <span>Duration {duration}</span>}
        </div>
        {task.error && (
          <p className="mt-2 text-sm text-red-600 bg-red-50/50 p-2.5 rounded-lg border border-red-100 font-mono text-xs">{task.error}</p>
        )}
        {task.status === "pending-user-input" && (
          <p className="mt-2 text-sm text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-lg border border-amber-100">
            Click here to review suggested tags and complete job creation
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <PageHeader />

      <main className="max-w-4xl mx-auto w-full px-6 py-10 flex flex-col gap-8 flex-1 overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Background Tasks</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track background processing jobs for resume parsing, JD analysis, and tags synchronization.
            </p>
          </div>
          <button type="button" className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition" onClick={() => void refreshTasks()}>
            Refresh
          </button>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-sm">{error}</div>}

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto">
          <div>
            <h3 className="m-0 mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Active / Action Required ({activeTasks.length})
            </h3>
            {loading && tasks.length === 0 ? (
              <p className="text-gray-400 text-sm italic">Loading tasks…</p>
            ) : activeTasks.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No active tasks.</p>
            ) : (
              <div className="flex flex-col gap-2">{activeTasks.map(renderTaskRow)}</div>
            )}
          </div>

          <div>
            <h3 className="m-0 mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Recent ({recentTasks.length})
            </h3>
            {recentTasks.length === 0 ? (
              <p className="text-gray-400 text-sm italic">Completed and failed tasks will appear here.</p>
            ) : (
              <div className="flex flex-col gap-2">{recentTasks.map(renderTaskRow)}</div>
            )}
          </div>
        </div>
      </main>

      <JDTaskConfirmModal
        open={jdConfirmModalOpen}
        task={selectedJdTask}
        onClose={() => {
          setJdConfirmModalOpen(false);
          setSelectedJdTask(null);
        }}
        onConfirmed={async () => {
          setJdConfirmModalOpen(false);
          setSelectedJdTask(null);
          await refreshTasks();
        }}
      />
    </div>
  );
}
