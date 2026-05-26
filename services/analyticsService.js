// Cyrix OMS v3.5 — AnalyticsService
// Pre-processes charts data for ApexCharts, downtime analysis, and scorecards.
(function(global) {
  'use strict';
  
  class AnalyticsService {
    computeDistrictScorecard(complaints, districts) {
      return districts.map(d => {
        const dComplaints = complaints.filter(c => c.district_id === d.id);
        const open = dComplaints.filter(c => c.status === 'Open').length;
        const closed = dComplaints.filter(c => c.status === 'Closed').length;
        const penalty = dComplaints.reduce((sum, c) => sum + (c.penalty_total || 0), 0);
        return { id: d.id, name: d.name, total: dComplaints.length, open, closed, penalty };
      });
    }
  }
  
  global.AnalyticsService = new AnalyticsService();
})(window);
