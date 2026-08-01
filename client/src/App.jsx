import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Navbar from "./components/Navbar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CreateTest from "./pages/CreateTest.jsx";
import TestList from "./pages/TestList.jsx";
import ModifyTest from "./pages/ModifyTest.jsx";
import CandidateDetail from "./pages/CandidateDetail.jsx";
import ManageAdmins from "./pages/ManageAdmins.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import Students from "./pages/Students.jsx";

function Layout({ children }) {
  return (
    <div className="app-frame">
      <Navbar />
      <main className="app-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tests"
        element={
          <ProtectedRoute>
            <Layout>
              <TestList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tests/new"
        element={
          <ProtectedRoute>
            <Layout>
              <CreateTest />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tests/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ModifyTest />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tests/:testId/candidates/:candidateId"
        element={
          <ProtectedRoute>
            <Layout>
              <CandidateDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={<ProtectedRoute><Layout><Students /></Layout></ProtectedRoute>}
      />
      <Route
        path="/admins"
        element={
          <ProtectedRoute superAdminOnly>
            <Layout>
              <ManageAdmins />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute allowPasswordChange>
            <Layout>
              <ChangePassword />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
