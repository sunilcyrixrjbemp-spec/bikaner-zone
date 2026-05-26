// Cyrix OMS v3.5 — Reusable Modal Component
class OMSModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  connectedCallback() {
    this.render();
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .overlay { position: fixed; inset: 0; background: rgba(11, 15, 25, 0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .content { background: #161e31; border: 1px solid #334155; padding: 24px; border-radius: 16px; width: 100%; max-width: 500px; color: #f8fafc; }
      </style>
      <div class="overlay">
        <div class="content">
          <slot></slot>
        </div>
      </div>
    `;
  }
}
customElements.define('oms-modal', OMSModal);
