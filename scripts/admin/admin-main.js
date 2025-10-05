// /scripts/admin/admin-main.js
// Entry point that wires together all admin feature modules and boots the panel
// Keeps module imports centralized so admin.html only needs a single script reference
// RELEVANT FILES: admin.html, scripts/admin/admin-state.js, scripts/admin/admin-bootstrap.js

import AdminPanel from './admin-state.js';
import { loadLayout } from './admin-layout.js';
import './admin-bootstrap.js';
import './admin-data-sources.js';
import './admin-calendar-grid.js';
import './admin-bookings.js';
import './admin-attendance-core.js';
import './admin-attendance-calculations.js';
import './admin-attendance-insights.js';
import './admin-attendance-dashboard.js';
import './admin-attendance-status.js';
import './admin-daily-messages.js';
import './admin-notifications.js';
import './admin-users.js';
import './admin-blacklist.js';
import './admin-class-scheduling.js';
import './admin-class-modal.js';
import './admin-class-attendance.js';
import './admin-manual-bookings.js';
import './admin-auth.js';

loadLayout();
AdminPanel.init();
