import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdvisorLayout, CandidateLayout, ProviderLayout } from '@/layouts';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import { AuthIndexRedirect, RequireAuth } from '@/app/routeGuards';

import CandidateDashboard from '@/pages/candidate/Dashboard';
import Profile from '@/pages/candidate/Profile';
import CandidateOffers from '@/pages/candidate/Offers';
import UploadCv from '@/pages/candidate/UploadCv';

import ProviderDashboard from '@/pages/provider/Dashboard';
import Offers from '@/pages/provider/Offers';
import CreateOffer from '@/pages/provider/CreateOffer';
import OfferDetails from '@/pages/provider/OfferDetails';
import Candidates from '@/pages/provider/Candidates';
import CandidateDetails from '@/pages/provider/CandidateDetails';

import AdvisorDashboard from '@/pages/advisor/Dashboard';
import Taxonomy from '@/pages/advisor/Taxonomy';
import PipelineMonitoring from '@/pages/advisor/PipelineMonitoring';
import DataExplorer from '@/pages/advisor/DataExplorer';
import Users from '@/pages/advisor/Users';
import ProviderRequests from '@/pages/advisor/ProviderRequests';
import AuditLogs from '@/pages/advisor/AuditLogs';
import Settings from '@/pages/advisor/Settings';
import DemoMatching from '@/pages/advisor/DemoMatching';
import Portal from '@/pages/Portal';
import SearchOffer from '@/pages/provider/SearchOffer';
import SearchCandidate from '@/pages/candidate/SearchCandidate';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portal />} />
        {/* <Route path="/" element={<AuthIndexRedirect />} /> */}
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/:roleId" element={<Login />} />

        <Route
          element={
            // <RequireAuth allowedRoles={['candidate']}>
            <CandidateLayout />
            // </RequireAuth>
          }
        >
          <Route path="/candidate" element={<CandidateDashboard />} />
          <Route path="/candidate/profile" element={<Profile />} />
          <Route
            path="/candidate/matches"
            element={<Navigate to="/candidate/offers" replace />}
          />
          <Route
            path="/candidate/matches/:id"
            element={<Navigate to="/candidate/offers" replace />}
          />
          <Route path="/candidate/upload-cv" element={<UploadCv />} />
          <Route path="/candidate/offers" element={<CandidateOffers />} />
          <Route
            path="/candidate/demo-offers"
            element={<Navigate to="/candidate/offers" replace />}
          />
          <Route
            path="/candidate/offers/:id"
            element={<Navigate to="/candidate/offers" replace />}
          />
          <Route
            path="/candidate/job-offers"
            element={<Navigate to="/candidate/offers" replace />}
          />
          <Route
            path="/candidate/recommendations"
            element={<Navigate to="/candidate/offers" replace />}
          />
          <Route
            path="/candidate/learning"
            element={<Navigate to="/candidate/offers" replace />}
          />
        </Route>

        <Route
          element={
            <RequireAuth allowedRoles={['provider']}>
              <ProviderLayout />
            </RequireAuth>
          }
        >
          <Route path="/provider" element={<ProviderDashboard />} />
          <Route path="/provider/offers">
            <Route index element={<Offers />} />
            <Route path="new" element={<CreateOffer />} />
            <Route path="search" element={<SearchCandidate />} />
            <Route path=":id" element={<OfferDetails />} />
          </Route>
          <Route path="/provider/candidates" element={<Candidates />} />
          <Route
            path="/provider/demo-offer"
            element={<Navigate to="/provider/offers/new" replace />}
          />
          <Route
            path="/provider/candidates/:id"
            element={<CandidateDetails />}
          />
          <Route
            path="/provider/shortlist"
            element={<Navigate to="/provider/candidates" replace />}
          />
        </Route>

        <Route
          element={
            <RequireAuth allowedRoles={['advisor']}>
              <AdvisorLayout />
            </RequireAuth>
          }
        >
          <Route path="/advisor" element={<AdvisorDashboard />} />
          <Route path="/advisor/taxonomy" element={<Taxonomy />} />
          <Route path="/advisor/pipeline" element={<PipelineMonitoring />} />
          <Route path="/advisor/tech-admin" element={<PipelineMonitoring />} />
          <Route path="/advisor/data-explorer" element={<DataExplorer />} />
          <Route path="/advisor/matching" element={<DemoMatching />} />
          <Route path="/advisor/users" element={<Users />} />
          <Route
            path="/advisor/demo-matching"
            element={<Navigate to="/advisor/matching" replace />}
          />
          <Route
            path="/advisor/provider-requests"
            element={<ProviderRequests />}
          />
          <Route path="/advisor/audit" element={<AuditLogs />} />
          <Route path="/advisor/settings" element={<Settings />} />
          <Route path="/advisor/matching-config" element={<Settings />} />
        </Route>

        <Route path="/index" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
