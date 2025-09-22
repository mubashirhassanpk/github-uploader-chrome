/**
 * Content Script for GitHub File Uploader Extension
 * Adds upload button to GitHub repository pages
 */

(function() {
  'use strict';
  
  // Check if we're on a repository page
  function isRepoPage() {
    return window.location.pathname.split('/').length >= 3 && 
           !window.location.pathname.includes('/pull/') &&
           !window.location.pathname.includes('/issues/');
  }
  
  // Extract repository info from URL
  function getRepoInfo() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      return {
        owner: pathParts[0],
        repo: pathParts[1],
        branch: getBranchFromPage()
      };
    }
    return null;
  }
  
  // Get current branch from page
  function getBranchFromPage() {
    const branchButton = document.querySelector('[data-hotkey="w"] span.css-truncate-target');
    return branchButton ? branchButton.textContent.trim() : 'main';
  }
  
  // Create upload button
  function createUploadButton() {
    const button = document.createElement('button');
    button.className = 'btn btn-sm github-uploader-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
        <path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/>
      </svg>
      Upload Files
    `;
    button.title = 'Upload files to this repository using GitHub File Uploader';
    
    button.addEventListener('click', handleUploadClick);
    
    return button;
  }
  
  // Handle upload button click
  function handleUploadClick() {
    const repoInfo = getRepoInfo();
    
    if (repoInfo) {
      // Send message to background script to open popup with context
      chrome.runtime.sendMessage({
        action: 'openUploader',
        context: repoInfo
      });
    }
  }
  
  // Insert upload button into page
  function insertUploadButton() {
    // Find the file navigation area
    const fileNavigation = document.querySelector('.file-navigation');
    if (!fileNavigation) return;
    
    // Check if button already exists
    if (document.querySelector('.github-uploader-btn')) return;
    
    // Find the button group
    const buttonGroup = fileNavigation.querySelector('.BtnGroup');
    if (buttonGroup) {
      const uploadButton = createUploadButton();
      buttonGroup.appendChild(uploadButton);
    } else {
      // Fallback: insert before "Add file" button
      const addFileButton = fileNavigation.querySelector('[data-ga-click*="add file"]');
      if (addFileButton) {
        const uploadButton = createUploadButton();
        addFileButton.parentNode.insertBefore(uploadButton, addFileButton);
      }
    }
  }
  
  // Initialize
  function init() {
    if (isRepoPage()) {
      // Initial insert
      insertUploadButton();
      
      // Watch for navigation changes (GitHub uses AJAX navigation)
      const observer = new MutationObserver((mutations) => {
        if (isRepoPage()) {
          insertUploadButton();
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
