import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import JobDescriptions from './view/jobDescriptions/jobDescriptions.jsx';
import JobResume from './view/jobResume/JobResume.jsx'
import Resume from './view/resume/Resume';
import { TasksPanel } from './view/tasks/TaskPanel.jsx';

function App() {
  return (
    <Router>
      <Routes>
        {/* <Route path='/' element={<Test1/>} />
        <Route path='/test2' element={<Test2/>} /> */}
        <Route path='/' element={<Resume />} />
        <Route path='/job' element={<JobDescriptions/>} />
        <Route path='/job/:id/analysis' element={< JobResume />} />
        <Route path='/tasks' element={<TasksPanel />} />
      </Routes>
    </Router>
  );
}

export default App;
