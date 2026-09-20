import {Outlet} from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';

// Structural change from the old admin-dashboard shell: no permanent left
// sidebar anymore. A single full-width top navbar (Header) carries the
// brand, nav links and account controls for every marketing/dashboard page,
// the way a normal consumer product works. The live game console (/game,
// /play) intentionally keeps its own distinct chrome — it's a different,
// full-screen "in session" surface, not a page of this site.
export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
