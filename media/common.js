// #25: shared DOM helpers for the ticket webviews. All text goes through textContent; nothing
// from the model is ever parsed as HTML.
/* global window, document */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Fixed icon shapes (extension-authored constants, never model data).
  const ICONS = {
    branch: ['M5 5v6', 'M11 7c0 2.5-6 2-6 4'],
    branchDots: [[5, 3.5], [5, 12.5], [11, 5.5]],
    eye: ['M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z'],
    warning: ['M8 2l6.5 11.5h-13z', 'M8 6.5v3', 'M8 11.5v.5'],
    home: ['M2.5 7.5L8 3l5.5 4.5', 'M4 6.5v6.5h8V6.5'],
    check: ['M3 8.5l3 3 7-7']
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    return node;
  }

  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ICONS[name] || []) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    if (name === 'branch') {
      for (const [cx, cy] of ICONS.branchDots) {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(cx));
        circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', '1.5');
        svg.appendChild(circle);
      }
    }
    return svg;
  }

  function button(label, onClick, className) {
    const node = el('button', className || '', label);
    node.type = 'button';
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    return node;
  }

  window.ticketDom = { el, icon, button };
})();
