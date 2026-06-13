import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import LandingPage from './pages/LandingPage';
import Onboarding from './pages/Onboarding';
import Processing from './pages/Processing';
import HealthTwinReveal from './pages/HealthTwinReveal';
import DoctorCopilot from './pages/DoctorCopilot';
import { FutureSimulator } from './pages/AdditionalPages';

function Layout({ children }) {
  return (
    <div className="app-layout-nav">
      <Navigation />
      <div className="main-content-nav">
        <div className="page-content-nav">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone onboarding and landing pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/processing" element={<Processing />} />

        {/* Guided user journey layout pages */}
        <Route path="/twin" element={<Layout><HealthTwinReveal /></Layout>} />
        <Route path="/doctor-copilot" element={<Layout><DoctorCopilot /></Layout>} />
        <Route path="/simulator" element={<Layout><FutureSimulator /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}
