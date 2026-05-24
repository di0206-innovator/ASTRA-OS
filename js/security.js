// ==========================================
// Astra OS Security Utilities
// ==========================================

/**
 * Escapes potentially dangerous characters in a string to prevent XSS.
 * @param {string} str - The string to escape.
 * @returns {string} - The escaped string.
 */
window.escapeHTML = function(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') str = String(str);
  return str.replace(/[&<>'"]/g, function(tag) {
    const charsToReplace = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    };
    return Reflect.get(charsToReplace, tag) || tag;
  });
};

/**
 * Sanitizes an object key to prevent Prototype Pollution.
 * Returns null if the key targets a dangerous prototype property.
 * @param {string} key - The object key to sanitize.
 * @returns {string|null} - The safe key, or null if dangerous.
 */
window.sanitizeKey = function(key) {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    console.warn('[Security] Blocked prototype pollution attempt for key:', key);
    return null;
  }
  return key;
};

/**
 * Safely renders HTML into an element by parsing it, stripping scripts/events, 
 * and using replaceChildren() instead of innerHTML.
 * @param {HTMLElement} element - The target DOM element
 * @param {string} htmlString - The raw HTML string to render
 */
window.renderSafeHTML = function(element, htmlString) {
  if (!element) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  // Basic Sanitization
  const nodes = doc.body.querySelectorAll('*');
  for (const node of nodes) {
    if (node.tagName === 'SCRIPT') {
      node.remove();
      continue;
    }
    // Remove inline event handlers (e.g. onclick, onerror)
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.toLowerCase().startsWith('on')) {
        node.removeAttribute(attr.name);
      }
    }
  }
  
  // Append safely
  element.replaceChildren(...doc.body.childNodes);
};

/**
 * Tagged template literal function for HTML strings.
 * Automatically escapes any interpolated variables to prevent XSS.
 * This also acts as a secure sink marker for static analyzers.
 * @param {string[]} strings 
 * @param  {...any} values 
 * @returns {string} safely encoded HTML string
 */
window.html = function(strings, ...values) {
  return strings.reduce((acc, str, i) => {
    const val = Reflect.get(values, i);
    const encoded = (val !== undefined && val !== null) ? window.escapeHTML(String(val)) : '';
    return acc + str + encoded;
  }, '');
};
