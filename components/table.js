// Cyrix OMS v3.5 — Reusable UI Grid Component
class OMSGrid extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  set columns(cols) {
    this._cols = cols;
    this.render();
  }
  
  set data(rows) {
    this._rows = rows;
    this.render();
  }
  
  render() {
    if (!this._cols || !this._rows) return;
    this.shadowRoot.innerHTML = `
      <style>
        table { width: 100%; border-collapse: collapse; font-size: 13px; color: #94a3b8; }
        th { background: #131a2b; color: #f8fafc; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #1e293b; }
        tr:hover { background: rgba(59, 130, 246, 0.05); }
      </style>
      <table>
        <thead>
          <tr>${this._cols.map(c => `<th>${c}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${this._rows.map(r => `<tr>${Object.values(r).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
  }
}
customElements.define('oms-grid', OMSGrid);
