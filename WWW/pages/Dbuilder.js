const API_BASE = 'https://api.multigrounds.org/api';
let currentUser = null;
let currentPage = null;
let hasUnsavedChanges = false;
let vvvebInstance = null;

// Get subdomain from URL
const urlParams = new URLSearchParams(window.location.search);
const pageSubdomain = urlParams.get('page');

// Initialize the builder
document.addEventListener('DOMContentLoaded', async () => {
    await initializeBuilder();
});

// Initialize builder
async function initializeBuilder() {
    console.log('Starting VvvebJs builder initialization...');
    console.log('Checking for Vvveb library:', typeof Vvveb !== 'undefined');
    
    try {
        // Check if user is logged in
        const loginResponse = await fetch(`${API_BASE}/check-login`, {
            credentials: 'include'
        });
        
        if (!loginResponse.ok) {
            throw new Error('Login check failed');
        }
        
        const loginData = await loginResponse.json();
        
        if (!loginData.success || !loginData.logged_in) {
            showError('Please log in to use the page builder.');
            setTimeout(() => {
                window.location.href = '/pages/support';
            }, 2000);
            return;
        }
        
        currentUser = loginData.user;
        
        // Load the specific page
        if (!pageSubdomain) {
            showError('No page specified in URL.');
            return;
        }
        
        const pageResponse = await fetch(`${API_BASE}/page/${pageSubdomain}`, {
            credentials: 'include'
        });
        
        if (!pageResponse.ok) {
            throw new Error('Failed to load page');
        }
        
        const pageData = await pageResponse.json();
        
        if (!pageData.success) {
            throw new Error(pageData.message || 'Failed to load page');
        }
        
        if (!pageData.page.is_owner) {
            showError('You do not have permission to edit this page.');
            return;
        }
        
        currentPage = pageData.page;
        
        // Initialize VvvebJs
        initializeVvvebJs();
        
        console.log('Builder initialization complete!');
        
    } catch (error) {
        console.error('Builder initialization failed:', error);
        showError(`Failed to initialize builder: ${error.message}`);
    }
}

function initializeVvvebJs() {
    console.log('Initializing VvvebJs...');
    
    // Update page info
    document.getElementById('current-subdomain').textContent = currentPage.subdomain;
    
    // Parse existing page data
    let initialHtml = '';
    
    try {
        const parsedData = JSON.parse(currentPage.page_data || '{}');
        
        if (parsedData.html) {
            initialHtml = parsedData.html;
        } else {
            // Default template
            initialHtml = `
<div class="container py-5">
    <div class="row">
        <div class="col-12 text-center">
            <h1>${currentPage.title}</h1>
            <p class="lead">Start building your page!</p>
            <a href="#" class="btn btn-primary">Get Started</a>
        </div>
    </div>
</div>`;
        }
    } catch (e) {
        console.warn('Failed to parse page data:', e);
        initialHtml = `<div class="container py-5"><h1>${currentPage.title}</h1><p>Start building!</p></div>`;
    }
    
    // Initialize VvvebJs Builder
    if (typeof Vvveb !== 'undefined') {
        try {
            Vvveb.Builder.init('vvveb-builder', function() {
                console.log('VvvebJs initialized');
                
                // Hide loading, show UI
                document.getElementById('loading').style.display = 'none';
                document.getElementById('custom-topbar').style.display = 'flex';
                
                // Load content
                Vvveb.Builder.loadHtml(initialHtml);
                
                // Setup change detection
                Vvveb.Builder.frameBody.on('input change', function() {
                    markAsUnsaved();
                });
                
                console.log('VvvebJs ready!');
            });
        } catch (error) {
            console.error('VvvebJs init error:', error);
            showError('Failed to initialize builder: ' + error.message);
        }
    } else {
        console.error('VvvebJs not loaded!');
        showError('VvvebJs library failed to load. Please refresh the page.');
    }
}

function insertComponent(type) {
    // VvvebJs handles component insertion via its own UI
    console.log('Component insertion handled by VvvebJs');
}

function showError(message) {
    document.getElementById('loading').innerHTML = `
        <div class="error-message">
            <h5><i class="fas fa-exclamation-triangle"></i> Error</h5>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="window.location.href='/pages/support'">
                Go to Support
            </button>
        </div>
    `;
}

function markAsUnsaved() {
    hasUnsavedChanges = true;
    document.getElementById('unsaved-indicator').style.display = 'inline';
    const saveBtn = document.getElementById('save-btn');
    saveBtn.style.background = '#ffc107';
    saveBtn.style.borderColor = '#ffc107';
}

function markAsSaved() {
    hasUnsavedChanges = false;
    document.getElementById('unsaved-indicator').style.display = 'none';
    const saveBtn = document.getElementById('save-btn');
    saveBtn.style.background = '';
    saveBtn.style.borderColor = '';
}

function showSaveNotification(message, isWarning = false) {
    const notification = document.getElementById('save-notification');
    const messageSpan = document.getElementById('save-message');
    
    messageSpan.textContent = message;
    
    if (isWarning) {
        notification.classList.add('warning');
    } else {
        notification.classList.remove('warning');
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, isWarning ? 5000 : 2000);
}

// Save page to server
async function savePage() {
    try {
        console.log('Saving page...', currentPage.subdomain);
        
        const saveBtn = document.getElementById('save-btn');
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
        
        // Get HTML from VvvebJs
        let html = '';
        
        if (typeof Vvveb !== 'undefined' && Vvveb.Builder.getHtml) {
            html = Vvveb.Builder.getHtml();
        } else {
            throw new Error('Unable to get content from builder');
        }
        
        if (!html || html.trim() === '') {
            throw new Error('No content to save');
        }
        
        // Save to server
        const saveData = {
            page_data: JSON.stringify({
                html: html,
                type: 'vvvebjs'
            }),
            title: currentPage.title
        };
        
        const response = await fetch(`${API_BASE}/page/${currentPage.subdomain}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(saveData)
        });
        
        const result = await response.json();
        console.log('Save result:', result);
        
        if (result.success) {
            markAsSaved();
            alert(result.warning ? 'Saved locally (SFTP sync failed)' : 'Page published successfully!');
        } else {
            console.error('Save failed:', result.message);
            alert('Failed to save: ' + result.message);
        }
    } catch (error) {
        console.error('Save failed:', error);
        alert('Failed to save page: ' + error.message);
    } finally {
        const saveBtn = document.getElementById('save-btn');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save & Publish';
        saveBtn.disabled = false;
    }
}

function previewPage() {
    window.open(`https://multigrounds.org/sites/${currentPage.subdomain}/`, '_blank');
}

function goToMyPages() {
    if (hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
            return;
        }
    }
    window.location.href = 'https://multigrounds.org/pages/my-pages';
}

async function logout() {
    if (hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to logout?')) {
            return;
        }
    }
    
    try {
        await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = 'https://multigrounds.org/';
    } catch (error) {
        window.location.href = 'https://multigrounds.org/';
    }
}

// Warn user before leaving with unsaved changes
window.addEventListener('beforeunload', function (e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});