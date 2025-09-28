/**
 * Content script for full page screenshot capture
 * Handles scrolling and dimension calculation
 */

(function() {
  'use strict';

  // Message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageDimensions') {
      sendResponse(getPageDimensions());
    } else if (request.action === 'scrollToPosition') {
      scrollToPosition(request.x, request.y);
      sendResponse({ success: true });
    } else if (request.action === 'prepareForCapture') {
      preparePageForCapture();
      sendResponse({ success: true });
    } else if (request.action === 'restorePageState') {
      restorePageState();
      sendResponse({ success: true });
    }
    return true;
  });

  let originalScrollPosition = null;
  let originalOverflow = null;
  let fixedElements = [];

  function getPageDimensions() {
    const body = document.body;
    const html = document.documentElement;

    // Get the full dimensions of the page
    const fullHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );

    const fullWidth = Math.max(
      body.scrollWidth,
      body.offsetWidth,
      html.clientWidth,
      html.scrollWidth,
      html.offsetWidth
    );

    // Get viewport dimensions
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Get current scroll position
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    return {
      fullHeight,
      fullWidth,
      viewportHeight,
      viewportWidth,
      scrollX,
      scrollY,
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }

  function scrollToPosition(x, y) {
    window.scrollTo(x, y);
    // Wait a bit for the scroll to complete and any lazy-loaded content to appear
    return new Promise(resolve => {
      setTimeout(resolve, 100);
    });
  }

  function preparePageForCapture() {
    // Save current state
    originalScrollPosition = {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop
    };

    // Save body overflow style
    originalOverflow = {
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow
    };

    // Disable scrollbars temporarily to avoid them in screenshots
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Handle fixed/sticky positioned elements
    fixedElements = [];
    const elements = document.querySelectorAll('*');
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') {
        fixedElements.push({
          element: el,
          originalPosition: style.position
        });
        // Temporarily convert to absolute positioning
        el.style.position = 'absolute';
      }
    });
  }

  function restorePageState() {
    // Restore scroll position
    if (originalScrollPosition) {
      window.scrollTo(originalScrollPosition.x, originalScrollPosition.y);
    }

    // Restore overflow styles
    if (originalOverflow) {
      document.body.style.overflow = originalOverflow.body;
      document.documentElement.style.overflow = originalOverflow.html;
    }

    // Restore fixed/sticky elements
    fixedElements.forEach(item => {
      item.element.style.position = item.originalPosition;
    });
    fixedElements = [];
  }

  // Notify background script that content script is ready
  console.log('ProofVault content capture script loaded');
})();