// Cyrix OMS v3.2 — Core Utilities & SLA Calculations Engine
// Designed by Senior Principal Software Architect

(function(global) {
  'use strict';

  const SLAEngine = {
    calculate(complaint, equipment, settings, slabs) {
      if (!equipment) {
        return { status: 'Unknown', downtime_days: 0, penalty: 0, attendBreach: false, closeBreach: false, riskScore: 0 };
      }
      
      const raiseDate = new Date(complaint.raise_date);
      const now = new Date();
      
      let endDate = complaint.close_date ? new Date(complaint.close_date) : now;
      let diffTime = Math.max(0, endDate - raiseDate);
      let downtimeDays = parseFloat((diffTime / (1000 * 60 * 60 * 24)).toFixed(2));
      
      let attendBreach = false;
      let attendOverdueHours = 0;
      const responseSLAHours = parseInt(settings.sla_attend_hours || 24);
      const resolutionSLADays = parseInt(settings.sla_close_hours || 72) / 24;

      if (complaint.attend_date) {
        const attendDate = new Date(complaint.attend_date);
        const responseTimeHours = (attendDate - raiseDate) / (1000 * 60 * 60);
        if (responseTimeHours > responseSLAHours) {
          attendBreach = true;
          attendOverdueHours = Math.max(0, responseTimeHours - responseSLAHours);
        }
      } else {
        const responseTimeHours = (now - raiseDate) / (1000 * 60 * 60);
        if (responseTimeHours > responseSLAHours) {
          attendBreach = true;
          attendOverdueHours = responseTimeHours - responseSLAHours;
        }
      }
      
      let closeBreach = false;
      let closeOverdueDays = 0;
      if (downtimeDays > resolutionSLADays) {
        closeBreach = true;
        closeOverdueDays = downtimeDays - resolutionSLADays;
      }
      
      let penalty = 0;
      let penaltyDetail = { attendPenalty: 0, downtimePenalty: 0, total: 0 };
      
      if (complaint.warranty_flag === 'Out of Warranty') {
        const assetValue = equipment.asset_value || 0;
        const activeSlab = slabs.find(s => assetValue <= s.max_value) || slabs[slabs.length - 1];
        const ratePerPeriod = activeSlab ? activeSlab.per_period : 500;
        
        if (attendBreach) {
          penaltyDetail.attendPenalty = ratePerPeriod;
        }
        
        if (closeBreach) {
          const excessHours = Math.max(0, (diffTime / (1000 * 60 * 60)) - parseInt(settings.sla_close_hours || 72));
          const penaltyPeriodHours = parseInt(settings.penalty_period_hours || 24);
          const periods = Math.floor(excessHours / penaltyPeriodHours);
          penaltyDetail.downtimePenalty = periods * ratePerPeriod;
        }
        
        penaltyDetail.total = penaltyDetail.attendPenalty + penaltyDetail.downtimePenalty;
        penalty = penaltyDetail.total;
      }
      
      let riskScore = 0;
      if (complaint.status === 'Open') {
        const hoursOpen = (now - raiseDate) / (1000 * 60 * 60);
        riskScore = Math.min(100, Math.floor((hoursOpen / 168) * 100));
        if (complaint.warranty_flag === 'Out of Warranty') {
          riskScore = Math.min(100, riskScore + 20);
        }
      }

      return {
        downtime_days: downtimeDays,
        penalty,
        penaltyDetail,
        attendBreach,
        attendOverdueHours: parseFloat(attendOverdueHours.toFixed(1)),
        closeBreach,
        closeOverdueDays: parseFloat(closeOverdueDays.toFixed(1)),
        riskScore
      };
    }
  };

  const Formatters = {
    currency(value) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(value);
    },

    dateTime(dateString) {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  global.SLAEngine = SLAEngine;
  global.Formatters = Formatters;
})(window);
