import {lazy, Suspense} from 'react';
import {HashRouter, Navigate, Route, Routes} from 'react-router-dom';
import Layout from './Layout';

const GameApp = lazy(() => import('./GameApp'));
const HomePage = lazy(() => import('./pages/HomePage'));
const TeacherPage = lazy(() => import('./pages/TeacherPage'));
const StudentPage = lazy(() => import('./pages/StudentPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const TeacherAuthPage = lazy(() => import('./pages/TeacherAuthPage'));
const StudentAuthPage = lazy(() => import('./pages/StudentAuthPage'));
const PlayPage = lazy(() => import('./pages/PlayPage'));

const routeFallback = (
  <div className="flex min-h-[50vh] items-center justify-center p-8">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
  </div>
);

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={routeFallback}>{element}</Suspense>
);

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/game" element={withSuspense(<GameApp />)} />
        <Route path="/play" element={withSuspense(<PlayPage />)} />
        <Route element={<Layout />}>
          <Route path="/" element={withSuspense(<HomePage />)} />
          <Route path="/teacher" element={withSuspense(<TeacherPage />)} />
          <Route path="/teacher/auth" element={withSuspense(<TeacherAuthPage />)} />
          <Route path="/student" element={withSuspense(<StudentPage />)} />
          <Route path="/student/auth" element={withSuspense(<StudentAuthPage />)} />
          <Route path="/pricing" element={withSuspense(<PricingPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
