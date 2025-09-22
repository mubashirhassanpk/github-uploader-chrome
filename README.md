# GitHub File Uploader Chrome Extension 🚀

A powerful Chrome extension that enables seamless file and folder uploads to GitHub repositories with a simple drag-and-drop interface, eliminating the need for command-line tools or manual Git commands.

## ✨ Features

### Core Functionality
- **🔐 Secure GitHub OAuth Authentication** - Login securely with GitHub OAuth 2.0
- **📁 Drag & Drop Interface** - Simply drag files or folders into the extension
- **📂 Folder Upload Support** - Upload entire directory structures while preserving paths
- **🔄 Batch Upload** - Upload multiple files simultaneously with progress tracking
- **📊 Real-time Progress** - Visual progress bars with upload speed and time estimates
- **🗜️ File Compression** - Optional automatic compression for faster uploads
- **✅ File Type Validation** - Configurable validation for allowed file types
- **🔁 Retry Mechanism** - Automatic retry on network failures with exponential backoff
- **📝 Custom Commit Messages** - Add meaningful commit messages with each upload

### Advanced Features
- **🏗️ Repository Management**
  - View all your repositories
  - Create new repositories directly from the extension
  - Search and filter repositories
  - Branch selection and management

- **📈 Upload Management**
  - Chunk large files for reliable uploads (>10MB)
  - Resume interrupted transfers
  - Pause/Resume/Stop controls
  - Upload history log
  - Success/failure reporting

- **♿ Accessibility**
  - Full keyboard navigation support
  - ARIA labels for screen readers
  - High contrast mode support
  - Reduced motion support

- **🎨 User Interface**
  - Clean, modern design matching GitHub's aesthetic
  - Dark mode support (follows system preferences)
  - Responsive layout
  - Notifications for important events

## 📋 Prerequisites

- Google Chrome browser (version 88 or higher)
- GitHub account
- GitHub OAuth App credentials (for authentication)

## 🛠️ Installation

### Step 1: Set Up GitHub OAuth App

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: GitHub File Uploader
   - **Homepage URL**: https://github.com/your-username/github-uploader-extension
   - **Authorization callback URL**: https://<extension-id>.chromiumapp.org/
4. Click "Register application"
5. Note down your **Client ID** and **Client Secret**

### Step 2: Configure the Extension

1. Clone or download this repository:
```bash
git clone https://github.com/your-username/github-uploader-extension.git
cd github-uploader-extension
```

2. Open `js/background.js` and update the OAuth credentials:
```javascript
const CONFIG = {
  CLIENT_ID: 'YOUR_GITHUB_OAUTH_CLIENT_ID',
  CLIENT_SECRET: 'YOUR_GITHUB_OAUTH_CLIENT_SECRET',
  // ... other config
};
```

### Step 3: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the `github-uploader-extension` directory
5. The extension will appear in your extensions list
6. Note the Extension ID for OAuth callback URL configuration

### Step 4: Update OAuth App Callback URL

1. Go back to your GitHub OAuth App settings
2. Update the callback URL with your actual extension ID:
   ```
   https://<YOUR-EXTENSION-ID>.chromiumapp.org/
   ```
3. Save changes

## 📖 Usage Guide

### Getting Started

1. **Click the extension icon** in Chrome toolbar
2. **Login with GitHub** - Click "Login with GitHub" and authorize the app
3. **Select a repository** from the dropdown list or create a new one
4. **Choose a branch** where you want to upload files

### Uploading Files

#### Method 1: Drag and Drop
1. Drag files or folders from your computer
2. Drop them onto the drop zone in the extension
3. Review selected files
4. Add a commit message (optional)
5. Click "Upload to GitHub"

#### Method 2: File Browser
1. Click "Browse Files" button
2. Select files or folders from the file dialog
3. Review and proceed with upload

#### Method 3: From GitHub Pages
1. Navigate to any GitHub repository
2. Click the "Upload Files" button added by the extension
3. The extension popup will open with the repository pre-selected

### Upload Options

- **Compress files**: Enable to compress files before upload (excludes already compressed formats)
- **Validate file types**: Enable to restrict uploads to allowed file types only
- **Commit message**: Add a descriptive message for the commit

### Managing Uploads

- **Pause/Resume**: Pause long uploads and resume later
- **Cancel**: Stop and cancel the current upload
- **View Progress**: Monitor upload progress with speed and time estimates
- **Check Results**: View success/failure summary after completion

## 🔧 Configuration

### Allowed File Types

Edit `js/file-handler.js` to customize allowed file extensions:

```javascript
this.ALLOWED_FILE_TYPES = new Set([
  '.js', '.jsx', '.ts', '.tsx',  // JavaScript/TypeScript
  '.html', '.css', '.scss',       // Web files
  '.py', '.java', '.go',          // Programming languages
  // Add more as needed
]);
```

### File Size Limits

Adjust maximum file size in `js/file-handler.js`:

```javascript
this.MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB default
```

### Chunk Size

Modify chunk size for large file uploads:

```javascript
this.CHUNK_SIZE = 1024 * 1024; // 1MB chunks
```

## 🏗️ Architecture

### Project Structure
```
github-uploader-extension/
├── manifest.json           # Extension configuration
├── popup.html             # Main UI
├── css/
│   ├── popup.css         # Popup styles
│   └── content.css       # Content script styles
├── js/
│   ├── background.js     # Service worker for API calls
│   ├── popup.js         # Popup UI logic
│   ├── content.js       # GitHub page integration
│   ├── file-handler.js  # File processing utilities
│   └── utils.js         # Helper functions
├── icons/               # Extension icons
└── README.md           # Documentation
```

### Key Components

1. **Background Script** (`background.js`)
   - Handles OAuth authentication
   - Manages GitHub API requests
   - Processes file uploads
   - Implements retry logic

2. **Popup Script** (`popup.js`)
   - Manages UI interactions
   - Coordinates file selection
   - Handles upload flow
   - Updates progress indicators

3. **File Handler** (`file-handler.js`)
   - Processes files for upload
   - Implements chunking for large files
   - Handles compression
   - Validates file types

4. **Content Script** (`content.js`)
   - Adds upload button to GitHub pages
   - Integrates with GitHub's UI

## 🔒 Security

- **OAuth 2.0 Authentication**: Secure login without storing passwords
- **Token Storage**: Access tokens stored securely in Chrome's storage API
- **HTTPS Only**: All API communications over HTTPS
- **Content Security Policy**: Strict CSP to prevent XSS attacks
- **Input Validation**: All user inputs sanitized and validated

## 🐛 Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify OAuth credentials are correct
   - Check callback URL matches extension ID
   - Ensure GitHub OAuth app is active

2. **Upload Fails**
   - Check internet connection
   - Verify repository permissions
   - Ensure file size is within limits
   - Check if branch is protected

3. **Files Not Showing**
   - Refresh repository list
   - Check file type restrictions
   - Verify files aren't corrupted

4. **Extension Not Working**
   - Reload extension from chrome://extensions
   - Check browser console for errors
   - Ensure Chrome is updated

### Debug Mode

Enable debug logging in console:
1. Open extension popup
2. Right-click and select "Inspect"
3. Check Console tab for detailed logs

## 🚀 Performance

- **Chunked Uploads**: Large files split into 1MB chunks
- **Parallel Processing**: Multiple small files uploaded simultaneously
- **Compression**: Reduces upload size by up to 70% for text files
- **Caching**: Repository list cached for faster loading
- **Lazy Loading**: UI components loaded as needed

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- GitHub API for comprehensive repository management
- Chrome Extensions API for powerful browser integration
- Contributors and testers who helped improve the extension

## 📮 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact: support@example.com

## 🗺️ Roadmap

### Planned Features
- [ ] Git LFS support for very large files
- [ ] Multiple account support
- [ ] Sync with local Git repositories
- [ ] File preview before upload
- [ ] Upload templates and presets
- [ ] Integration with CI/CD pipelines
- [ ] Mobile companion app
- [ ] Collaborative uploads
- [ ] Upload scheduling
- [ ] Webhook notifications

## ⚡ Quick Tips

1. **Keyboard Shortcuts**
   - `Ctrl+O`: Open file browser
   - `Esc`: Close modals
   - `Enter`: Confirm actions

2. **Drag Multiple Folders**
   - Select multiple folders and drag together
   - Directory structure will be preserved

3. **Quick Repository Access**
   - Star frequently used repositories for quick access
   - Use search to filter large repository lists

4. **Optimize Large Uploads**
   - Enable compression for text files
   - Upload during off-peak hours for better speed
   - Use wired connection for stability

---

Made with ❤️ for developers who prefer GUI over CLI
