// /scripts/admin/layout/panel-view.js
// Assembles the admin panel layout from smaller section templates
// Keeps each template file under 300 lines while offering a single export
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-state.js

import { panelHeaderHTML } from "./panel-header.js";
import { panelCalendarHTML } from "./panel-calendar.js";
import { panelBookingsHTML } from "./panel-bookings.js";
import { panelAttendanceHTML } from "./panel-attendance.js";
import { panelNotificationsHTML } from "./panel-notifications.js";
import { panelDailyMessagesHTML } from "./panel-daily-messages.js";
import { panelUsersHTML } from "./panel-users.js";
import { panelBlacklistHTML } from "./panel-blacklist.js";
import { panelFooterHTML } from "./panel-footer.js";

export const panelViewHTML = [
  panelHeaderHTML,
  panelCalendarHTML,
  panelBookingsHTML,
  panelAttendanceHTML,
  panelNotificationsHTML,
  panelDailyMessagesHTML,
  panelUsersHTML,
  panelBlacklistHTML,
  panelFooterHTML
].join("
");
