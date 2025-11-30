import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SubmitOrder from './pages/SubmitOrder';
import CheckOrder from './pages/CheckOrder';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import LogisticsLogin from './pages/LogisticsLogin';
import LogisticsPanel from './pages/LogisticsPanel';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/submit" element={<SubmitOrder />} />
        <Route path="/check" element={<CheckOrder />} />
        <Route path="/haofresh/login" element={<AdminLogin />} />
        <Route path="/haofresh" element={<AdminPanel />} />
        <Route path="/logistics/login" element={<LogisticsLogin />} />
        <Route path="/logistics" element={<LogisticsPanel />} />
      </Routes>
    </Router>
  );
}

export default App;
