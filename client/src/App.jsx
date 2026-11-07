import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import Overview from './pages/admin/Overview.jsx';
import Approvals from './pages/admin/Approvals.jsx';
import WorkLog from './pages/admin/WorkLog.jsx';
import Employees from './pages/admin/Employees.jsx';
import EmployeeFile from './pages/admin/EmployeeFile.jsx';
import Teams from './pages/admin/Teams.jsx';
import Leave from './pages/admin/Leave.jsx';
import Salary from './pages/admin/Salary.jsx';
import Report from './pages/admin/Report.jsx';
import Devices from './pages/admin/Devices.jsx';
import Costing from './pages/admin/Costing.jsx';
import Petty from './pages/admin/Petty.jsx';
import Inventory from './pages/admin/Inventory.jsx';
import Production from './pages/admin/Production.jsx';
import Data from './pages/admin/Data.jsx';
import EmployeeApp from './pages/employee/EmployeeApp.jsx';

export default function App() {
  const { session, ready } = useAuth();

  if (!ready) return <div className="boot">Loading…</div>;
  if (!session) return <Login />;

  if (session.role === 'admin') {
    return (
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="work" element={<WorkLog />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/:id" element={<EmployeeFile />} />
          <Route path="teams" element={<Teams />} />
          <Route path="leave" element={<Leave />} />
          <Route path="salary" element={<Salary />} />
          <Route path="report" element={<Report />} />
          <Route path="devices" element={<Devices />} />
          <Route path="costing" element={<Costing />} />
          <Route path="petty" element={<Petty />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="production" element={<Production />} />
          <Route path="data" element={<Data />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  return <EmployeeApp />;
}
