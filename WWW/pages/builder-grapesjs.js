const API_BASE = 'https://api.multigrounds.org/api';
let currentUser = null;
let currentPage = null;
let hasUnsavedChanges = false;
let editor = null;

// Get subdomain from URL
const urlParams = new URLSearchParams(window.location.search);
const pageSubdomain = urlParams.get('page');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await initializeBuilder();
});

async function initializeBuilder() {
    try {
        // Check login
        const loginResponse = await fetch(`${API_BASE}/check-login`, {
            credentials: 'include'
        });
        
        const loginData = await loginResponse.json();
        
        if (!loginData.success || !loginData.logged_in) {
            alert('Please log in to use the page builder.');
            window.location.href = '/pages/support';
            return;
        }
        
        currentUser = loginData.user;
        
        // Load page
        if (!pageSubdomain) {
            alert('No page specified');
            return;
        }
        
        const pageResponse = await fetch(`${API_BASE}/page/${pageSubdomain}`, {
            credentials: 'include'
        });
        
        const pageData = await pageResponse.json();
        
        if (!pageData.success || !pageData.page.is_owner) {
            alert('You do not have permission to edit this page.');
            return;
        }
        
        currentPage = pageData.page;
        
        // Initialize GrapesJS
        initializeGrapesJS();
        
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to initialize builder: ' + error.message);
    }
}

function initializeGrapesJS() {
    // Update page info
    document.getElementById('current-subdomain').textContent = currentPage.subdomain;
    
    // Parse existing content
    let initialHtml = '';
    let initialCss = '';
    
    try {
        const parsedData = JSON.parse(currentPage.page_data || '{}');
        
        if (parsedData.html) {
            initialHtml = parsedData.html;
            initialCss = parsedData.css || '';
        } else {
            initialHtml = `
<div class="container" style="padding: 50px 20px; text-align: center;">
    <h1>${currentPage.title}</h1>
    <p>Start building your page by dragging components from the left!</p>
    <button class="btn btn-primary">Get Started</button>
</div>`;
        }
    } catch (e) {
        initialHtml = `<div style="padding: 50px; text-align: center;"><h1>${currentPage.title}</h1><p>Start building!</p></div>`;
    }
    
    // Initialize GrapesJS with all plugins
    editor = grapesjs.init({
        container: '#gjs',
        height: '100%',
        width: '100%',
        storageManager: false,
        plugins: [
            'gjs-blocks-basic',
            'gjs-preset-webpage',
            'gjs-plugin-forms',
            'gjs-component-countdown',
            'gjs-tabs',
            'gjs-tooltip',
            'gjs-custom-code',
            'gjs-touch',
            'gjs-style-bg'
        ],
        pluginsOpts: {
            'gjs-preset-webpage': {
                modalImportTitle: 'Import Template',
                modalImportLabel: '<div style="margin-bottom: 10px; font-size: 13px;">Paste here your HTML/CSS and click Import</div>',
                modalImportContent: function(editor) {
                    return editor.getHtml() + '<style>' + editor.getCss() + '</style>'
                },
            },
            'gjs-plugin-forms': {},
            'gjs-blocks-basic': {},
        },
        canvas: {
            styles: [
                'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
                'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
            ],
            scripts: [
                'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
            ]
        },
        deviceManager: {
            devices: [{
                name: 'Desktop',
                width: '',
            }, {
                name: 'Tablet',
                width: '768px',
                widthMedia: '992px',
            }, {
                name: 'Mobile',
                width: '320px',
                widthMedia: '480px',
            }]
        }
    });
    
    // Load content
    editor.setComponents(initialHtml);
    if (initialCss) {
        editor.setStyle(initialCss);
    }
    
    // Track changes
    editor.on('change', () => {
        markAsUnsaved();
    });
    
    // Hide loading, show UI
    document.getElementById('loading').style.display = 'none';
    document.getElementById('custom-topbar').style.display = 'flex';
    
    console.log('GrapesJS initialized successfully!');
}

function markAsUnsaved() {
    hasUnsavedChanges = true;
    document.getElementById('unsaved-indicator').style.display = 'inline';
}

function markAsSaved() {
    hasUnsavedChanges = false;
    document.getElementById('unsaved-indicator').style.display = 'none';
}

async function savePage() {
    try {
        const saveBtn = document.getElementById('save-btn');
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
        
        // Get HTML and CSS from GrapesJS
        const html = editor.getHtml();
        const css = editor.getCss();
        
        // Save to server
        const response = await fetch(`${API_BASE}/page/${currentPage.subdomain}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                page_data: JSON.stringify({
                    html: html,
                    css: css,
                    type: 'grapesjs'
                }),
                title: currentPage.title
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            markAsSaved();
            alert('Page published successfully!');
        } else {
            alert('Failed to save: ' + result.message);
        }
    } catch (error) {
        alert('Failed to save: ' + error.message);
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
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Leave anyway?')) {
        return;
    }
    window.location.href = 'https://multigrounds.org/pages/my-pages';
}

async function logout() {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Logout anyway?')) {
        return;
    }
    
    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = 'https://multigrounds.org/';
}

window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});