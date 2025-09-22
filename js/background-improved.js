/**
 * Improved Background Service Worker for GitHub File Uploader Extension
 * Supports both OAuth and Personal Access Token authentication
 */

// Configuration
const CONFIG = {
  // OAuth Config (optional - can be left empty if using PAT)
  CLIENT_ID: '', // Leave empty to use PAT instead
  CLIENT_SECRET: '', 
  
  // API Configuration
  API_BASE_URL: 'https://api.github.com',
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for large files
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000
};

// State management
let authToken = null;
let authMethod = null; // 'oauth' or 'pat'
let uploadQueue = [];
let activeUploads = new Map();

// Track current upload session so popup can restore progress if reopened
let currentUpload = {
  active: false,
  owner: null,
  repo: null,
  branch: 'main',
  total: 0,
  current: 0,
  file: '',
  results: [],
  errors: [],
  startedAt: null,
  finishedAt: null
};

/**
 * Initialize extension on install/update
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('GitHub File Uploader Extension installed/updated');
  console.log('Extension ID:', chrome.runtime.id);
  await loadStoredToken();
  
  // Create context menu safely
  try {
    chrome.contextMenus.create({
      id: 'upload-to-github',
      title: 'Upload to GitHub',
      contexts: ['page', 'selection', 'image', 'link']
    }, () => {
      // Clear error if any (menu might already exist)
      if (chrome.runtime.lastError) {
        console.log('Context menu creation:', chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    console.log('Context menu not created:', error);
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  await loadStoredToken();
});

/**
 * Load stored authentication token
 */
async function loadStoredToken() {
  try {
    const result = await chrome.storage.local.get(['github_token', 'auth_method']);
    if (result.github_token) {
      authToken = result.github_token;
      authMethod = result.auth_method || 'pat';
      console.log('Token loaded from storage (method:', authMethod, ')');
      
      // Don't validate token on load - just trust it's valid
      // We'll validate when actually making API calls
      // This prevents unnecessary API calls and token removal
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error loading token:', error);
    return false;
  }
}

/**
 * Validate current token
 */
async function validateToken() {
  if (!authToken) {
    throw new Error('No token to validate');
  }
  
  const response = await fetch(`${CONFIG.API_BASE_URL}/user`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Token validation failed');
  }
  
  return await response.json();
}

/**
 * Personal Access Token Authentication
 */
async function authenticateWithPAT(token) {
  try {
    // Validate the token
    authToken = token;
    const user = await validateToken();
    
    // Store token
    await chrome.storage.local.set({ 
      github_token: token,
      auth_method: 'pat'
    });
    
    authMethod = 'pat';
    console.log('PAT authentication successful for user:', user.login);
    return { success: true, user };
  } catch (error) {
    authToken = null;
    authMethod = null;
    throw error;
  }
}

/**
 * Simple OAuth flow using GitHub device flow (no client secret needed)
 */
async function authenticateWithDeviceFlow() {
  try {
    // Step 1: Request device code
    const deviceResponse = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: CONFIG.CLIENT_ID || 'Iv1.8a61f9b8f47f5e1d', // Default public client ID
        scope: 'repo user'
      })
    });
    
    if (!deviceResponse.ok) {
      throw new Error('Failed to get device code');
    }
    
    const deviceData = await deviceResponse.json();
    
    // Return device code info for user
    return {
      device_code: deviceData.device_code,
      user_code: deviceData.user_code,
      verification_uri: deviceData.verification_uri,
      expires_in: deviceData.expires_in,
      interval: deviceData.interval || 5
    };
  } catch (error) {
    console.error('Device flow error:', error);
    throw error;
  }
}

/**
 * Poll for device flow completion
 */
async function pollDeviceFlow(deviceCode, interval = 5) {
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: CONFIG.CLIENT_ID || 'Iv1.8a61f9b8f47f5e1d',
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        });
        
        const data = await response.json();
        
        if (data.access_token) {
          clearInterval(pollInterval);
          authToken = data.access_token;
          authMethod = 'oauth';
          chrome.storage.local.set({ 
            github_token: data.access_token,
            auth_method: 'oauth'
          });
          resolve(data.access_token);
        } else if (data.error === 'authorization_pending') {
          // Continue polling
        } else if (data.error === 'slow_down') {
          // Increase interval
          clearInterval(pollInterval);
          pollDeviceFlow(deviceCode, interval + 5).then(resolve).catch(reject);
        } else {
          clearInterval(pollInterval);
          reject(new Error(data.error || 'Authentication failed'));
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, interval * 1000);
    
    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error('Authentication timeout'));
    }, 600000);
  });
}

/**
 * Make authenticated API request with retry logic
 */
async function apiRequest(endpoint, options = {}, retries = 0) {
  // If token not in memory, try loading from storage (handles service worker restarts)
  if (!authToken) {
    await loadStoredToken();
    if (!authToken) {
      throw new Error('Not authenticated. Please login first.');
    }
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers
      }
    });
    
    if (response.status === 401) {
      // Token expired or invalid
      authToken = null;
      authMethod = null;
      await chrome.storage.local.remove(['github_token', 'auth_method']);
      throw new Error('Authentication expired. Please login again.');
    }
    
    if (response.status === 404) {
      throw new Error('Resource not found');
    }
    
    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining === '0') {
        throw new Error('GitHub API rate limit exceeded. Please try again later.');
      }
      throw new Error('Permission denied. Check your token permissions.');
    }
    
    if (!response.ok && retries < CONFIG.MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (retries + 1)));
      return apiRequest(endpoint, options, retries + 1);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
    
    return response.json();
  } catch (error) {
    if (retries < CONFIG.MAX_RETRIES && !error.message.includes('Authentication')) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (retries + 1)));
      return apiRequest(endpoint, options, retries + 1);
    }
    throw error;
  }
}

/**
 * Get user info
 */
async function getUserInfo() {
  return apiRequest('/user');
}

/**
 * Get user repositories
 */
async function getUserRepos(page = 1, perPage = 100) {
  return apiRequest(`/user/repos?page=${page}&per_page=${perPage}&sort=updated`);
}

/**
 * Get repository branches
 */
async function getRepoBranches(owner, repo) {
  return apiRequest(`/repos/${owner}/${repo}/branches`);
}

/**
 * Get repository contents
 */
async function getRepositoryContents(owner, repo, branch, path = '') {
  try {
    if (!authToken) {
      await loadStoredToken();
      if (!authToken) {
        throw new Error('Not authenticated');
      }
    }
    
    // Build the API URL
    const apiUrl = path 
      ? `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
      : `/repos/${owner}/${repo}/contents?ref=${branch}`;
    
    const contents = await apiRequest(apiUrl);
    
    // Ensure it's an array (single file returns an object)
    const contentArray = Array.isArray(contents) ? contents : [contents];
    
    // Process the contents to include only needed fields
    const processedContents = contentArray.map(item => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size || 0,
      html_url: item.html_url,
      download_url: item.download_url
    }));
    
    return { 
      success: true, 
      contents: processedContents 
    };
  } catch (error) {
    console.error('Error fetching repository contents:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Create a new repository
 */
async function createRepository(name, description, isPrivate = false) {
  return apiRequest('/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true
    })
  });
}

/**
 * Get file content from repository
 */
async function getFileContent(owner, repo, path, branch = 'main') {
  try {
    // Ensure we properly encode path segments but keep slashes
    const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
    return await apiRequest(`/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`);
  } catch (error) {
    const msg = (error && error.message ? error.message : '').toLowerCase();
    // Treat 404/"not found"/"resource not found" as non-error => file does not exist yet
    if (msg.includes('404') || msg.includes('not found') || msg.includes('resource not found')) {
      return null; // File doesn't exist
    }
    throw error;
  }
}

/**
 * Upload file to repository
 */
async function uploadFile(owner, repo, path, content, message, branch = 'main', sha = null) {
  const body = {
    message,
    content: content,
    branch
  };
  
  if (sha) {
    body.sha = sha; // Required for updating existing files
  }
  
  return apiRequest(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

/**
 * Batch upload multiple files
 */
async function batchUpload(owner, repo, files, message, branch = 'main') {
  const results = [];
  const errors = [];
  
  // Initialize session state
  currentUpload = {
    active: true,
    owner,
    repo,
    branch,
    total: files.length,
    current: 0,
    file: '',
    results: [],
    errors: [],
    startedAt: Date.now(),
    finishedAt: null
  };
  try { if (chrome.storage.session && chrome.storage.session.set) { await chrome.storage.session.set({ currentUpload }); } } catch (_) {}
  
  for (const file of files) {
    try {
      // Check if file exists
      const existingFile = await getFileContent(owner, repo, file.path, branch);
      
      // Upload file
      const result = await uploadFile(
        owner,
        repo,
        file.path,
        file.content,
        message || `Upload ${file.path}`,
        branch,
        existingFile?.sha
      );
      
      results.push({ 
        file: file.path, 
        status: 'success', 
        result 
      });
      
      // Update session state
      currentUpload.current = results.length + errors.length;
      currentUpload.file = file.path;
      currentUpload.results = results.slice();
      try { if (chrome.storage.session && chrome.storage.session.set) { await chrome.storage.session.set({ currentUpload }); } } catch (_) {}
      
      // Send progress update to popup
      chrome.runtime.sendMessage({
        type: 'uploadProgress',
        file: file.path,
        status: 'success',
        current: results.length,
        total: files.length
      }).catch(() => {}); // Ignore errors if popup is closed
      
    } catch (error) {
      errors.push({ 
        file: file.path, 
        status: 'error', 
        error: error.message 
      });
      
      // Update session state
      currentUpload.current = results.length + errors.length;
      currentUpload.file = file.path;
      currentUpload.errors = errors.slice();
      try { if (chrome.storage.session && chrome.storage.session.set) { await chrome.storage.session.set({ currentUpload }); } } catch (_) {}
      
      // Send error update to popup
      chrome.runtime.sendMessage({
        type: 'uploadProgress',
        file: file.path,
        status: 'error',
        error: error.message,
        current: results.length + errors.length,
        total: files.length
      }).catch(() => {});
    }
  }
  
  // Finalize session state
  currentUpload.active = false;
  currentUpload.finishedAt = Date.now();
  currentUpload.results = results.slice();
  currentUpload.errors = errors.slice();
  try { if (chrome.storage.session && chrome.storage.session.set) { await chrome.storage.session.set({ currentUpload }); } } catch (_) {}
  
  return { results, errors };
}

/**
 * Message handler for popup and content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.action);
  console.log('Full request:', request);
  
  const handleAsync = async () => {
    try {
      switch (request.action) {
        case 'authenticatePAT':
          const patResult = await authenticateWithPAT(request.token);
          return { success: true, ...patResult };
        
        case 'startDeviceFlow':
          const deviceInfo = await authenticateWithDeviceFlow();
          // Start polling in background
          pollDeviceFlow(deviceInfo.device_code, deviceInfo.interval)
            .then(() => {
              chrome.runtime.sendMessage({ 
                type: 'authComplete', 
                success: true 
              }).catch(() => {});
            })
            .catch(error => {
              chrome.runtime.sendMessage({ 
                type: 'authComplete', 
                success: false, 
                error: error.message 
              }).catch(() => {});
            });
          return { success: true, ...deviceInfo };
        
        case 'checkAuth':
          // Always load token from storage first to handle service worker restarts
          await loadStoredToken();
          
          if (authToken) {
            try {
              const user = await getUserInfo();
              return { success: true, authenticated: true, user, method: authMethod };
            } catch (error) {
              console.error('Token validation failed:', error);
              // Token is invalid, clear it
              authToken = null;
              authMethod = null;
              await chrome.storage.local.remove(['github_token', 'auth_method']);
              return { success: true, authenticated: false };
            }
          }
          return { success: true, authenticated: false };
        
        case 'logout':
          authToken = null;
          authMethod = null;
          await chrome.storage.local.remove(['github_token', 'auth_method']);
          return { success: true };
        
        case 'getRepos':
          const repos = await getUserRepos(request.page, request.perPage);
          return { success: true, repos };
        
        case 'getBranches':
          const branches = await getRepoBranches(request.owner, request.repo);
          return { success: true, branches };
        
        case 'createRepo':
          const newRepo = await createRepository(request.name, request.description, request.private);
          return { success: true, repo: newRepo };
        
        case 'getRepoContents':
          return await getRepositoryContents(request.owner, request.repo, request.branch, request.path);
        
        case 'uploadFile':
          const uploadResult = await uploadFile(
            request.owner,
            request.repo,
            request.path,
            request.content,
            request.message,
            request.branch,
            request.sha
          );
          return { success: true, result: uploadResult };
        
        case 'batchUpload':
          const batchResult = await batchUpload(
            request.owner,
            request.repo,
            request.files,
            request.message,
            request.branch
          );
          return { success: true, ...batchResult };
        
        case 'getUploadStatus':
          // Return a shallow copy to avoid accidental mutation by popup
          return { success: true, state: { ...currentUpload } };
        
        default:
          throw new Error(`Unknown action: ${request.action}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { success: false, error: error.message };
    }
  };
  
  handleAsync().then(sendResponse);
  return true; // Keep message channel open for async response
});

console.log('Background service worker initialized');
console.log('Extension ID:', chrome.runtime.id);

// Load stored token on service worker initialization
loadStoredToken().then(hasToken => {
  console.log('Initial token load:', hasToken ? 'Token found' : 'No token');
});
