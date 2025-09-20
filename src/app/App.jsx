import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Authentication/Login";
import Signup from "../pages/Authentication/Signup";

import Navbar from "./layout/Navbar";
import HeroBanner from "../pages/Home/HeroBanner";
import FeaturedSection from "../pages/Home/FeaturedSection";
import Footer from "./layout/Footer";
import useAuth from "../hooks/useAuth";
import UpgradeAlert from "./layout/UpgradeAlert";

import PostPage from "../pages/Post/PostPage";
import FindQuestionPage from "../pages/Questions/FindQuestionPage";

import PayPage from "../pages/Payment/PayPage";
import PlansPage from "../pages/Payment/PlansPage";
import ThemePage from "../pages/Themes/ThemePage"; 
import ArticlesPage from "../pages/Articles/ArticlesPage";
import SeedPage from "../utilities/SeedPage";
import ArticleDetailPage from "../pages/Articles/ArticleDetailPage";
import QuestionDetailPage from "../pages/Questions/QuestionDetailPage";
import EmailSignUp from "../pages/Home/EmailSignUp"
import { subscribeToNewsletter } from "../api/newsletter";

function App() {
  const { user, loading, premium } = useAuth();
  async function handleEmailSignup(email) {
    await subscribeToNewsletter(email);
  }
  if (loading) return <div>Loading...</div>;
  

 

  const PageWithChrome = ({ children }) => (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      {!premium && <EmailSignUp onSubmit={handleEmailSignup} />}
      <Footer />
    </div>
  );

  return (
    <Routes>
      <Route path="/dev/seed" element={<SeedPage />} />
      <Route path="/articles/:id" element={<ArticleDetailPage />} />
      <Route path="/question/:id" element={<QuestionDetailPage />} />
      {/* Home (protected) */}

      <Route
  path="/"
  element={(
      <PageWithChrome>
        {/* Home-only sections */}
        <UpgradeAlert />
        <HeroBanner />
        <FeaturedSection />
      </PageWithChrome>
    )
  }
/>

      {/* Post (protected) */}
      <Route
        path="/post"
        element={
          user ? (
            <PageWithChrome>
              <PostPage />
            </PageWithChrome>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      {/* Post (protected) */}
      <Route
        path="/articles"
        element={
          (
            <PageWithChrome>
              <ArticlesPage />
            </PageWithChrome>
          ) 
        }
      />

      {/* Find Question (protected) */}
      <Route
        path="/question"
        element={
          user ? (
            <PageWithChrome>
              <FindQuestionPage />
            </PageWithChrome>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Pay (protected) */}
      <Route
        path="/pay"
        element={
          (
            <PageWithChrome>
              <PayPage />
            </PageWithChrome>
          ) 
        }
      />

      {/* Plans (protected) */}
      <Route
        path="/plans"
        element={
           (
            <PageWithChrome>
              <PlansPage />
            </PageWithChrome>
          ) 
        }
      />
      {/* Theme Settings (premium only) */}
      <Route
        path="/theme"
        element={
          user ? (
            premium ? (
              <PageWithChrome>
                <ThemePage />
              </PageWithChrome>
            ) : (
              <Navigate to="/plans" replace />  // redirect to upgrade plans
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Auth */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
