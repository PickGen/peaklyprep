import { lazy, Suspense } from 'react'
import { I18nProvider } from './lib/i18n'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import { IconDefs } from './components/Icons'
import { AdminShell, AppShell, GuestOnly, PublicLayout, RequireAdmin, RequireAuth, Spinner } from './components/Layouts'
import Landing from './pages/Landing'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'
import { HomePage, ProfilePage } from './pages/StudentPages'
import StatisticsPage from './pages/Statistics'
import MistakeBankPage from './pages/MistakeBank'
import LeaderboardPage from './pages/Leaderboard'
import { AttemptReviewPage, LearnPage, LessonPage, PracticePage, TestRunnerPage, WordListsPage } from './pages/LearnPractice'
import { PrivacyPage, TermsPage } from './pages/Legal'
import PlansPage from './pages/Plans'
import CheckoutPage from './pages/Checkout'

const AdminLessons = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminLessons })))
const AdminTests = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminTests })))
const AdminQuestions = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminQuestions })))
const AdminNews = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminNews })))
const AdminStudents = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminStudents })))
const AdminPayments = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminPayments })))
const AdminGroups = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminGroups })))
const AdminSettings = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminSettings })))
const AdminStats = lazy(() => import('./pages/admin/AdminStats'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <AuthProvider>
        <IconDefs />
        <BrowserRouter>
          <Suspense fallback={<Spinner full />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Landing />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route element={<GuestOnly />}>
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="forgot-password" element={<ForgotPasswordPage />} />
                </Route>
                {/* not GuestOnly: the reset link signs the user in before they set the new password */}
                <Route path="reset-password" element={<ResetPasswordPage />} />
              </Route>

              <Route element={<RequireAuth />}>
                <Route path="app/practice/:id" element={<TestRunnerPage />} />
                <Route path="app" element={<AppShell />}>
                  <Route index element={<HomePage />} />
                  <Route path="learn" element={<LearnPage />} />
                  <Route path="learn/:id" element={<LessonPage />} />
                  <Route path="words" element={<WordListsPage />} />
                  <Route path="words/:id" element={<LessonPage />} />
                  <Route path="practice" element={<PracticePage />} />
                  <Route path="attempts/:id" element={<AttemptReviewPage />} />
                  <Route path="plans" element={<PlansPage />} />
                  <Route path="checkout" element={<CheckoutPage />} />
                  <Route path="progress" element={<StatisticsPage />} />
                  <Route path="mistakes" element={<MistakeBankPage />} />
                  <Route path="leaderboard" element={<LeaderboardPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>

                <Route element={<RequireAdmin />}>
                  <Route path="admin" element={<AdminShell />}>
                    <Route index element={<AdminLessons />} />
                    <Route path="stats" element={<AdminStats />} />
                    <Route path="tests" element={<AdminTests />} />
                    <Route path="tests/:id" element={<AdminQuestions />} />
                    <Route path="news" element={<AdminNews />} />
                    <Route path="students" element={<AdminStudents />} />
                    <Route path="payments" element={<AdminPayments />} />
                    <Route path="groups" element={<AdminGroups />} />
                    <Route path="settings" element={<AdminSettings />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
