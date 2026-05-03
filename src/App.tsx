import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ToastProvider'
import { GannessRecordsErrorBoundary } from './components/GannessRecordsErrorBoundary'
import { ProtectedLayout } from './components/ProtectedLayout'
import MyOceanPage from './pages/MyOceanPage'
import SharedOceanPage from './pages/SharedOceanPage'
import ProfilePage from './pages/ProfilePage'
import ShipmateProfilePage from './pages/ShipmateProfilePage'
import GannessRecordPage from './pages/GannessRecordPage'
import AdminPage from './pages/AdminPage'
import AchievementPage from './pages/AchievementPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<MyOceanPage />} />
              <Route path="/achieve" element={<AchievementPage />} />
              <Route path="/shared" element={<SharedOceanPage />} />
              <Route
                path="/records"
                element={
                  <GannessRecordsErrorBoundary>
                    <GannessRecordPage />
                  </GannessRecordsErrorBoundary>
                }
              />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/mate/:userId" element={<ShipmateProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
