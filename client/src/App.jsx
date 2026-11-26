import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles.css';
import { SessionProvider } from './session.jsx';
import { SiteProvider } from './site.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Library from './pages/Library.jsx';
import Videos from './pages/Videos.jsx';
import BookPage from './pages/Book.jsx';
import Reader from './pages/Reader.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Account from './pages/Account.jsx';
import Contact from './pages/Contact.jsx';
import Auteurs from './pages/Auteurs.jsx';
import About from './pages/About.jsx';
import Rules from './pages/Rules.jsx';
import Ecrire from './pages/Ecrire.jsx';
import Legal from './pages/Legal.jsx';
import MentionsLegales from './pages/MentionsLegales.jsx';
import CGV from './pages/CGV.jsx';
import Claims from './pages/Claims.jsx';
import Install from './pages/Install.jsx';
import Download from './pages/Download.jsx';
import Contest from './pages/Contest.jsx';
import Console from './pages/Console.jsx';
import NotFound from './pages/NotFound.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/bibliotheque" element={<Library />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/roman/:slug" element={<BookPage />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/inscription" element={<Register />} />
        <Route path="/compte" element={<Account />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/auteurs" element={<Auteurs />} />
        <Route path="/devenir-auteur" element={<Auteurs />} />
        <Route path="/espace-auteur" element={<Auteurs />} />
        <Route path="/a-propos" element={<About />} />
        <Route path="/regles" element={<Rules />} />
        <Route path="/ecrire" element={<Ecrire />} />
        <Route path="/conditions" element={<Legal kind="terms" />} />
        <Route path="/confidentialite" element={<Legal kind="privacy" />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/cgv" element={<CGV />} />
        <Route path="/reclamations" element={<Claims />} />
        <Route path="/assistance" element={<Claims />} />
        <Route path="/installer" element={<Install />} />
        <Route path="/telecharger" element={<Download />} />
            <Route path="/jeu" element={<Contest />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/lire/:slug/:number" element={<Reader />} />
      <Route path="/console/*" element={<Console />} />
    </Routes>
  );
}

export default function App({ Router = BrowserRouter }) {
  return (
    <React.StrictMode>
      <Router>
        <SiteProvider>
          <SessionProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </SessionProvider>
        </SiteProvider>
      </Router>
    </React.StrictMode>
  );
}
