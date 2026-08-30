import {HashRouter, Navigate, Route, Routes} from 'react-router-dom';
import Layout from './Layout';
import HomePage from './pages/HomePage';
import TeacherPage from './pages/TeacherPage';
import StudentPage from './pages/StudentPage';
import PricingPage from './pages/PricingPage';
import TeacherAuthPage from './pages/TeacherAuthPage';
import StudentAuthPage from './pages/StudentAuthPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/teacher" element={<TeacherPage />} />
          <Route path="/teacher/auth" element={<TeacherAuthPage />} />
          <Route path="/student" element={<StudentPage />} />
          <Route path="/student/auth" element={<StudentAuthPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
