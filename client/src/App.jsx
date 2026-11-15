import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles.css';
import { SessionProvider } from './session.jsx';
import { SiteProvider } from './site.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Library from './pages/Library.jsx';
import BookPage from './pages/Book.jsx';
import Reader from './pages/Reader.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Account from './pages/Account.jsx';
import Contact from './pages/Contact.jsx';
import Legal from './pages/Legal.jsx';
import Install from './pages/Install.jsx';
import Console from './pages/Console.jsx';
import NotFound from './pages/NotFound.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/bibliotheque" element={<Library />} />
        <Route path="/roman/:slug" element={<BookPage />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/inscription" element={<Register />} />
        <Route path="/compte" element={<Account />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/conditions" element={<Legal kind="terms" />} />
        <Route path="/confidentialite" element={<Legal kind="privacy" />} />
        <Route path="/installer" element={<Install />} />
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
            <AppRoutes />
          </SessionProvider>
        </SiteProvider>
      </Router>
    </React.StrictMode>
  );
}
