export function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString();
}

export async function getTask(taskId) {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
  const res = await fetch(`${backendUrl}/api/tasks/${taskId}`);
  if (!res.ok) throw new Error("Failed to get task details");
  return res.json();
}

export async function listTasks(activeOnly = false) {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
  const res = await fetch(`${backendUrl}/api/tasks`);
  if (!res.ok) throw new Error("Failed to list tasks");
  return res.json();
}

export function getTasksWebSocketUrl() {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  const url = new URL(backendUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/tasks/ws";
  return url.toString();
}
