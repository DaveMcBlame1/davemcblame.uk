const API_BASE = 'https://api.multigrounds.org/api';
let currentUser = null;
let currentPage = null;
let hasUnsavedChanges = false;
let grapesInstance = null;

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
        
        // Initialize GrapesJS
        initializeGrapesJS();
        
        console.log('Builder initialization complete!');
        
    } catch (error) {
        console.error('Builder initialization failed:', error);
        showError(`Failed to initialize builder: ${error.message}`);
    }
}

function initializeGrapesJS() {
    // Update page info
    document.getElementById('current-subdomain').textContent = currentPage.subdomain;
    
    // Show builder interface
    document.getElementById('loading').style.display = 'none';
    document.getElementById('builder').style.display = 'block';
    
    // Parse existing page data to get HTML
    let initialHtml = '';
    let initialCss = '';
    
    try {
        const parsedData = JSON.parse(currentPage.page_data || '{}');
        
        // Check if it's GrapesJS format or old format
        if (parsedData.html && parsedData.type === 'grapesjs') {
            initialHtml = parsedData.html;
            initialCss = parsedData.css || '';
        } else if (parsedData.html) {
            // VvvebJs or other HTML format
            initialHtml = parsedData.html;
        } else {
            // Create a default template
            initialHtml = `
<div class="container py-5">
    <h1>${currentPage.title}</h1>
    <p>Start building your page by dragging elements from the left sidebar.</p>
</div>`;
        }
    } catch (e) {
        console.warn('Failed to parse page data, using default template:', e);
        initialHtml = `
<div class="container py-5">
    <h1>${currentPage.title}</h1>
    <p>Start building your page!</p>
</div>`;
    }
    
    // Initialize GrapesJS
    if (typeof grapesjs !== 'undefined') {
        grapesInstance = grapesjs.init({
            container: '#vvveb-builder',
            height: 'calc(100vh - 60px)',
            width: '100%',
            storageManager: false,
            panels: { defaults: [] },
            blockManager: {
                appendTo: '#vvveb-builder',
            },
            styleManager: {
                appendTo: '#vvveb-builder',
            },
            canvas: {
                styles: [
                    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
                    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
                ]
            },
            plugins: ['gjs-blocks-basic'],
            pluginsOpts: {
                'gjs-blocks-basic': {}
            }
        });
        
        // Set initial content
        grapesInstance.setComponents(initialHtml);
        grapesInstance.setStyle(initialCss);
        
        // Mark as changed when user edits
        grapesInstance.on('change:changesCount', () => {
            markAsUnsaved();
        });
        
        console.log('GrapesJS initialized successfully');
    } else {
        showError('GrapesJS failed to load. Please refresh the page.');
    }
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
        const originalHtml = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
        
        // Get HTML and CSS from GrapesJS
        let html = '';
        let css = '';
        
        if (grapesInstance) {
            html = grapesInstance.getHtml();
            css = grapesInstance.getCss();
        } else {
            throw new Error('Unable to get content from builder');
        }
        
        // Save to server
        const saveData = {
            page_data: JSON.stringify({
                html: html,
                css: css,
                type: 'grapesjs'
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
            showSaveNotification(result.warning ? 'Saved locally' : 'Published!', !!result.warning);
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