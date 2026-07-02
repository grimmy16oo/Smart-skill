// App.jsx — Root component with React Router setup
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SwipePage from "./pages/SwipePage";
import ChatPage from "./pages/ChatPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="flex min-h-screen flex-col bg-base-100 text-base-content">
            <Navbar />
            <main className="flex-1 overflow-x-hidden">
              <Routes>
                <Route path="/"        element={<HomePage />} />
                <Route path="/login"   element={<LoginPage />} />
                <Route path="/swipe"   element={<SwipePage />} />
                <Route path="/chat"    element={<ChatPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:id" element={<ProfilePage />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
