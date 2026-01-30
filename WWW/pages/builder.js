
const API_BASE = 'https://api.multigrounds.org/api';
let currentUser = null;
let currentPage = null;
let hasUnsavedChanges = false;

// Global state for canvas builder
const state = {
    elements: [],
    selectedElement: null,
    history: [],
    historyIndex: -1,
    draggedElement: null,
    isDragging: false,
    isResizing: false,
    resizeHandle: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startLeft: 0,
    startTop: 0,
    clipboard: null,
    nextId: 1,
    canvas: null,
    snapThreshold: 10,
    pageSettings: {
        backgroundColor: '#ffffff',
        backgroundImage: '',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
    }
};

// Get subdomain from URL
const urlParams = new URLSearchParams(window.location.search);
const pageSubdomain = urlParams.get('page');

// Initialize the builder
document.addEventListener('DOMContentLoaded', async () => {
    await initializeBuilder();
});

// Initialize builder
async function initializeBuilder() {
    console.log('Starting builder initialization...');
    
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
        
        // Parse page data
        try {
            const parsedData = JSON.parse(currentPage.page_data || '{"elements": [], "pageSettings": {}}');
            state.elements = parsedData.elements || [];
            state.pageSettings = parsedData.pageSettings || state.pageSettings;
            state.nextId = Math.max(...state.elements.map(el => el.id), 0) + 1;
        } catch (e) {
            console.warn('Failed to parse page data, using defaults:', e);
            state.elements = [];
        }
        
        // Initialize UI
        initializeUI();
        
        console.log('Builder initialization complete!');
        
    } catch (error) {
        console.error('Builder initialization failed:', error);
        showError(`Failed to initialize builder: ${error.message}`);
    }
}

function initializeUI() {
    // Update page info
    document.getElementById('current-subdomain').textContent = currentPage.subdomain;
    document.getElementById('current-title').textContent = currentPage.title;
    document.getElementById('editing-page').textContent = currentPage.subdomain;
    
    // Show builder interface
    document.getElementById('loading').style.display = 'none';
    document.getElementById('builder').style.display = 'flex';
    
    // Initialize canvas
    state.canvas = document.getElementById('canvas');
    setupDragAndDrop();
    setupCanvasInteraction();
    loadPopularIcons();
    
    // Render existing elements
    state.elements.forEach(el => renderElement(el));
    applyBackgroundFromState();
    
    addToHistory();
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
    saveBtn.classList.remove('primary');
    saveBtn.style.background = '#ffc107';
    saveBtn.style.borderColor = '#ffc107';
}

function markAsSaved() {
    hasUnsavedChanges = false;
    document.getElementById('unsaved-indicator').style.display = 'none';
    const saveBtn = document.getElementById('save-btn');
    saveBtn.classList.add('primary');
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

// Popular icons to display
const popularIcons = [
    'home', 'star', 'heart', 'user', 'settings', 'search',
    'mail', 'phone', 'camera', 'music', 'video', 'image',
    'folder', 'file', 'download', 'upload', 'arrow-right', 'arrow-left',
    'check', 'close', 'menu', 'more', 'shopping-cart', 'tag'
];

function loadPopularIcons() {
    const iconGrid = document.getElementById('iconGrid');
    iconGrid.innerHTML = '';
    popularIcons.forEach(icon => {
        const div = document.createElement('div');
        div.className = 'icon-option';
        div.draggable = true;
        div.dataset.type = 'icon';
        div.dataset.iconName = icon;
        div.innerHTML = `<img src="https://api.iconify.design/mdi/${icon}.svg" alt="${icon}">`;
        div.addEventListener('dragstart', handleDragStart);
        iconGrid.appendChild(div);
    });
}

// Drag and Drop
function setupDragAndDrop() {
    const elementItems = document.querySelectorAll('.element-item');
    elementItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
    });

    state.canvas.addEventListener('dragover', handleDragOver);
    state.canvas.addEventListener('drop', handleDrop);
}

function handleDragStart(e) {
    const type = e.target.closest('[data-type]').dataset.type;
    const iconName = e.target.closest('[data-type]')?.dataset.iconName;
    e.dataTransfer.setData('elementType', type);
    if (iconName) {
        e.dataTransfer.setData('iconName', iconName);
    }
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData('elementType');
    const iconName = e.dataTransfer.getData('iconName');
    
    const rect = state.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (type === 'image') {
        openImageModal(x, y);
    } else if (type === 'icon') {
        if (iconName) {
            createElement(type, x, y, { iconName });
        } else {
            openIconModal(x, y);
        }
    } else {
        createElement(type, x, y);
    }
}

// Create Element
function createElement(type, x, y, options = {}) {
    const element = {
        id: state.nextId++,
        type: type,
        x: x,
        y: y,
        width: 200,
        height: 100,
        rotation: 0,
        zIndex: state.elements.length,
        locked: false,
        styles: {}
    };

    switch (type) {
        case 'text':
            element.content = 'Double-click to edit';
            element.styles = {
                fontFamily: 'Arial',
                fontSize: '16px',
                fontWeight: 'normal',
                color: '#000000',
                textAlign: 'left'
            };
            element.width = 200;
            element.height = 40;
            break;
        case 'image':
            element.content = options.url || '';
            element.styles = {
                objectFit: 'cover',
                borderRadius: '0px'
            };
            element.width = 300;
            element.height = 200;
            break;
        case 'rectangle':
            element.styles = {
                backgroundColor: '#007bff',
                borderRadius: '0px'
            };
            break;
        case 'circle':
            element.width = 150;
            element.height = 150;
            element.styles = {
                backgroundColor: '#28a745',
                borderRadius: '50%'
            };
            break;
        case 'line':
            element.width = 200;
            element.height = 2;
            element.styles = {
                backgroundColor: '#000000'
            };
            break;
        case 'icon':
            element.content = options.iconName || 'star';
            element.width = 64;
            element.height = 64;
            element.styles = {
                color: '#007bff'
            };
            break;
    }

    state.elements.push(element);
    renderElement(element);
    addToHistory();
    markAsUnsaved();
}

// Render Element
function renderElement(element) {
    let div = document.querySelector(`[data-element-id="${element.id}"]`);
    
    if (!div) {
        div = document.createElement('div');
        div.className = 'canvas-element';
        div.dataset.elementId = element.id;
        
        // Create content div first
        const contentDiv = document.createElement('div');
        contentDiv.className = 'element-content';
        div.appendChild(contentDiv);
        
        // Add controls and handles
        const controlsHtml = `
            <div class="element-controls">
                <button class="element-control-btn" onclick="editElement(${element.id})">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="element-control-btn" onclick="deleteElement(${element.id})">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
            <div class="resize-handle nw"></div>
            <div class="resize-handle ne"></div>
            <div class="resize-handle sw"></div>
            <div class="resize-handle se"></div>
            <div class="resize-handle n"></div>
            <div class="resize-handle s"></div>
            <div class="resize-handle w"></div>
            <div class="resize-handle e"></div>
        `;
        div.insertAdjacentHTML('beforeend', controlsHtml);
        
        state.canvas.appendChild(div);
        setupElementInteraction(div, element);
    }
    
    // Verify div still exists in DOM
    if (!div.parentNode) {
        console.warn('Element div removed from DOM, skipping render for', element.id);
        return;
    }

    // Update position and size
    div.style.left = element.x + 'px';
    div.style.top = element.y + 'px';
    div.style.width = element.width + 'px';
    div.style.height = element.height + 'px';
    div.style.transform = `rotate(${element.rotation}deg)`;
    div.style.zIndex = element.zIndex;

    if (element.locked) {
        div.classList.add('locked');
    } else {
        div.classList.remove('locked');
    }

    // Update content based on type (don't recreate the div)
    const contentDiv = div.querySelector('.element-content');
    
    if (!contentDiv) {
        console.error('Content div not found during render for element', element.id);
        return;
    }
    
    switch (element.type) {
        case 'text':
            contentDiv.className = 'text-element';
            contentDiv.contentEditable = false;
            // Always update text content
            contentDiv.textContent = element.content;
            // Apply all styles directly
            contentDiv.style.fontFamily = element.styles.fontFamily || 'Arial';
            contentDiv.style.fontSize = element.styles.fontSize || '16px';
            contentDiv.style.fontWeight = element.styles.fontWeight || 'normal';
            contentDiv.style.color = element.styles.color || '#000000';
            contentDiv.style.textAlign = element.styles.textAlign || 'left';
            contentDiv.style.padding = '8px';
            break;
        case 'image':
            contentDiv.className = 'image-element';
            contentDiv.style.width = '100%';
            contentDiv.style.height = '100%';
            contentDiv.style.overflow = 'hidden';
            
            if (element.content) {
                const objectFit = element.styles.objectFit || 'cover';
                const borderRadius = element.styles.borderRadius || '0px';
                
                if (!contentDiv.querySelector('img') || contentDiv.querySelector('img').src !== element.content) {
                    contentDiv.innerHTML = `<img src="${element.content}" alt="Image" style="width: 100%; height: 100%; object-fit: ${objectFit}; display: block;">`;
                } else {
                    // Update existing image
                    const img = contentDiv.querySelector('img');
                    if (img) {
                        img.style.objectFit = objectFit;
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.display = 'block';
                    }
                }
                
                if (borderRadius !== '0px') {
                    contentDiv.style.borderRadius = borderRadius;
                }
            } else {
                contentDiv.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f0f0f0; color: #999;">No image</div>';
            }
            break;
        case 'rectangle':
        case 'circle':
        case 'line':
            contentDiv.className = 'shape-element';
            contentDiv.innerHTML = ''; // Clear any content
            Object.assign(contentDiv.style, element.styles);
            break;
        case 'icon':
            contentDiv.className = 'shape-element';
            if (!contentDiv.querySelector('img') || !contentDiv.querySelector('img').src.includes(element.content)) {
                contentDiv.innerHTML = `<img src="https://api.iconify.design/mdi/${element.content}.svg" style="width: 100%; height: 100%;">`;
            }
            break;
    }
}

// Setup element interaction
function setupElementInteraction(div, element) {
    const contentDiv = div.querySelector('.element-content');
    
    if (!contentDiv) {
        console.error('Content div not found for element', element.id);
        return;
    }
    
    // Only add event listeners if not already added
    if (div.dataset.interactionSetup === 'true') {
        return;
    }
    div.dataset.interactionSetup = 'true';
    
    // Selection
    div.addEventListener('mousedown', (e) => {
        if (element.locked) return;
        
        // Check if clicking on resize handle
        if (e.target.classList.contains('resize-handle')) {
            startResize(e, element, e.target.classList[1]);
            return;
        }
        
        selectElement(element.id);
        
        // Start dragging
        if (!e.target.closest('.element-controls')) {
            startDrag(e, element);
        }
    });

    // Double-click to edit text
    if (element.type === 'text') {
        contentDiv.addEventListener('dblclick', () => {
            if (element.locked) return;
            contentDiv.contentEditable = true;
            contentDiv.focus();
            document.execCommand('selectAll', false, null);
        });

        contentDiv.addEventListener('blur', () => {
            contentDiv.contentEditable = false;
            element.content = contentDiv.textContent;
            addToHistory();
            markAsUnsaved();
        });

        contentDiv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                contentDiv.blur();
            }
        });
    }

    // Right-click context menu
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectElement(element.id);
        showContextMenu(e.clientX, e.clientY);
    });
}

// Drag element
function startDrag(e, element) {
    if (element.locked) return;
    
    state.isDragging = true;
    state.draggedElement = element;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.startLeft = element.x;
    state.startTop = element.y;
    
    // Add dragging class to prevent pointer events during drag
    const div = document.querySelector(`[data-element-id="${element.id}"]`);
    if (div) div.classList.add('dragging');

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    
    e.preventDefault();
}

function handleDragMove(e) {
    if (!state.isDragging || !state.draggedElement) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    let newX = state.startLeft + dx;
    let newY = state.startTop + dy;

    // Snap to grid/guides
    const snapToggle = document.getElementById('snapToggle');
    if (snapToggle && snapToggle.checked) {
        const snapped = snapToGuides(newX, newY, state.draggedElement);
        newX = snapped.x;
        newY = snapped.y;
    }

    state.draggedElement.x = Math.max(0, newX);
    state.draggedElement.y = Math.max(0, newY);

    // Only render if element still exists
    const div = document.querySelector(`[data-element-id="${state.draggedElement.id}"]`);
    if (div && div.parentNode) {
        renderElement(state.draggedElement);
    }
}

function handleDragEnd() {
    if (state.isDragging) {
        // Remove dragging class
        const div = document.querySelector(`[data-element-id="${state.draggedElement.id}"]`);
        if (div) div.classList.remove('dragging');
        
        addToHistory();
        markAsUnsaved();
    }
    
    state.isDragging = false;
    state.draggedElement = null;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
}

// Resize element
function startResize(e, element, handle) {
    e.stopPropagation();
    if (element.locked) return;

    state.isResizing = true;
    state.draggedElement = element;
    state.resizeHandle = handle;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.startWidth = element.width;
    state.startHeight = element.height;
    state.startLeft = element.x;
    state.startTop = element.y;

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
}

function handleResizeMove(e) {
    if (!state.isResizing || !state.draggedElement) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const element = state.draggedElement;
    const handle = state.resizeHandle;

    if (handle.includes('e')) {
        element.width = Math.max(20, state.startWidth + dx);
    }
    if (handle.includes('w')) {
        const newWidth = Math.max(20, state.startWidth - dx);
        element.x = state.startLeft + (state.startWidth - newWidth);
        element.width = newWidth;
    }
    if (handle.includes('s')) {
        element.height = Math.max(20, state.startHeight + dy);
    }
    if (handle.includes('n')) {
        const newHeight = Math.max(20, state.startHeight - dy);
        element.y = state.startTop + (state.startHeight - newHeight);
        element.height = newHeight;
    }

    // Only render if element still exists
    const div = document.querySelector(`[data-element-id="${element.id}"]`);
    if (div && div.parentNode) {
        renderElement(element);
    }
}

function handleResizeEnd() {
    if (state.isResizing) {
        addToHistory();
        markAsUnsaved();
    }
    
    state.isResizing = false;
    state.draggedElement = null;
    state.resizeHandle = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
}

// Selection
function selectElement(id) {
    // Deselect previous
    if (state.selectedElement) {
        const prevDiv = document.querySelector(`[data-element-id="${state.selectedElement.id}"]`);
        if (prevDiv) prevDiv.classList.remove('selected');
    }

    // Select new
    const element = state.elements.find(el => el.id === id);
    if (element) {
        state.selectedElement = element;
        const div = document.querySelector(`[data-element-id="${id}"]`);
        if (div) div.classList.add('selected');
        updateToolbar();
    }
}

function deselectAll() {
    if (state.selectedElement) {
        const div = document.querySelector(`[data-element-id="${state.selectedElement.id}"]`);
        if (div) div.classList.remove('selected');
        state.selectedElement = null;
        updateToolbar();
    }
}

// Update toolbar based on selection
function updateToolbar() {
    document.getElementById('textControls').style.display = 'none';
    document.getElementById('alignControls').style.display = 'none';
    document.getElementById('layerControls').style.display = 'none';

    if (state.selectedElement) {
        document.getElementById('layerControls').style.display = 'flex';
        
        if (state.selectedElement.type === 'text') {
            document.getElementById('textControls').style.display = 'flex';
            document.getElementById('alignControls').style.display = 'flex';
            
            // Update toolbar values
            document.getElementById('fontFamily').value = state.selectedElement.styles.fontFamily || 'Arial';
            document.getElementById('fontSize').value = parseInt(state.selectedElement.styles.fontSize) || 16;
            document.getElementById('fontWeight').value = state.selectedElement.styles.fontWeight || 'normal';
            document.getElementById('textColor').value = state.selectedElement.styles.color || '#000000';
        }
    }
}

// Update selected element from toolbar
function updateSelectedElement() {
    if (!state.selectedElement || state.selectedElement.type !== 'text') return;

    state.selectedElement.styles.fontFamily = document.getElementById('fontFamily').value;
    state.selectedElement.styles.fontSize = document.getElementById('fontSize').value + 'px';
    state.selectedElement.styles.fontWeight = document.getElementById('fontWeight').value;
    state.selectedElement.styles.color = document.getElementById('textColor').value;

    // Force complete re-render of the element
    renderElement(state.selectedElement);
    
    addToHistory();
    markAsUnsaved();
}

// Canvas interaction
function setupCanvasInteraction() {
    state.canvas.addEventListener('mousedown', (e) => {
        if (e.target === state.canvas) {
            deselectAll();
            // Close context menu
            document.getElementById('contextMenu').classList.remove('show');
        }
    });

    // Close context menu on any click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#contextMenu')) {
            document.getElementById('contextMenu').classList.remove('show');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && state.selectedElement) {
            deleteElement();
        } else if (e.key === 'Escape') {
            deselectAll();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.target.contentEditable) {
            copyElement();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.target.contentEditable) {
            pasteElement();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.target.contentEditable) {
            e.preventDefault();
            duplicateElement();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.contentEditable) {
            e.preventDefault();
            undo();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !e.target.contentEditable) {
            e.preventDefault();
            redo();
        }
    });
}

// Context Menu
function showContextMenu(x, y) {
    const menu = document.getElementById('contextMenu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('show');

    // Update lock text
    document.getElementById('lockText').textContent = 
        state.selectedElement?.locked ? 'Unlock' : 'Lock';
}

// Element actions
function editElement(id) {
    if (id) {
        selectElement(id);
    }
    
    if (!state.selectedElement) return;

    if (state.selectedElement.type === 'text') {
        const div = document.querySelector(`[data-element-id="${state.selectedElement.id}"]`);
        const contentDiv = div.querySelector('.text-element');
        contentDiv.contentEditable = true;
        contentDiv.focus();
        document.execCommand('selectAll', false, null);
    } else if (state.selectedElement.type === 'image') {
        const newUrl = prompt('Enter new image URL (HTTPS only):', state.selectedElement.content);
        if (newUrl && newUrl.startsWith('https://')) {
            state.selectedElement.content = newUrl;
            renderElement(state.selectedElement);
            addToHistory();
            markAsUnsaved();
        } else if (newUrl) {
            alert('Please enter a valid HTTPS URL');
        }
    }
}

function deleteElement(id) {
    if (id) {
        selectElement(id);
    }
    
    if (!state.selectedElement) return;

    const index = state.elements.findIndex(el => el.id === state.selectedElement.id);
    if (index > -1) {
        const div = document.querySelector(`[data-element-id="${state.selectedElement.id}"]`);
        if (div) div.remove();
        state.elements.splice(index, 1);
        state.selectedElement = null;
        updateToolbar();
        addToHistory();
        markAsUnsaved();
    }
}

function copyElement() {
    if (state.selectedElement) {
        state.clipboard = JSON.parse(JSON.stringify(state.selectedElement));
    }
}

function pasteElement() {
    if (state.clipboard) {
        const newElement = JSON.parse(JSON.stringify(state.clipboard));
        newElement.id = state.nextId++;
        newElement.x += 20;
        newElement.y += 20;
        newElement.zIndex = state.elements.length;
        state.elements.push(newElement);
        renderElement(newElement);
        selectElement(newElement.id);
        addToHistory();
        markAsUnsaved();
    }
}

function duplicateElement() {
    copyElement();
    pasteElement();
}

function bringForward() {
    if (!state.selectedElement) return;
    const maxZ = Math.max(...state.elements.map(el => el.zIndex));
    if (state.selectedElement.zIndex < maxZ) {
        state.selectedElement.zIndex++;
        renderElement(state.selectedElement);
        addToHistory();
        markAsUnsaved();
    }
}

function sendBackward() {
    if (!state.selectedElement) return;
    const minZ = Math.min(...state.elements.map(el => el.zIndex));
    if (state.selectedElement.zIndex > minZ) {
        state.selectedElement.zIndex--;
        renderElement(state.selectedElement);
        addToHistory();
        markAsUnsaved();
    }
}

function toggleLock() {
    if (!state.selectedElement) return;
    state.selectedElement.locked = !state.selectedElement.locked;
    renderElement(state.selectedElement);
    addToHistory();
    markAsUnsaved();
}

function alignElement(align) {
    if (!state.selectedElement || state.selectedElement.type !== 'text') return;
    state.selectedElement.styles.textAlign = align;
    renderElement(state.selectedElement);
    addToHistory();
    markAsUnsaved();
}

function centerHorizontally() {
    if (!state.selectedElement) return;
    const canvasWidth = state.canvas.offsetWidth;
    state.selectedElement.x = (canvasWidth - state.selectedElement.width) / 2;
    renderElement(state.selectedElement);
    addToHistory();
    markAsUnsaved();
}

function centerVertically() {
    if (!state.selectedElement) return;
    const canvasHeight = state.canvas.offsetHeight;
    state.selectedElement.y = (canvasHeight - state.selectedElement.height) / 2;
    renderElement(state.selectedElement);
    addToHistory();
    markAsUnsaved();
}

// Snap to guides
function snapToGuides(x, y, element) {
    const threshold = state.snapThreshold;
    const canvasWidth = state.canvas.offsetWidth;
    const canvasHeight = state.canvas.offsetHeight;
    
    // Center lines
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const elementCenterX = x + element.width / 2;
    const elementCenterY = y + element.height / 2;

    let snappedX = x;
    let snappedY = y;

    // Snap to center
    if (Math.abs(elementCenterX - centerX) < threshold) {
        snappedX = centerX - element.width / 2;
    }
    if (Math.abs(elementCenterY - centerY) < threshold) {
        snappedY = centerY - element.height / 2;
    }

    // Snap to edges
    if (Math.abs(x) < threshold) snappedX = 0;
    if (Math.abs(y) < threshold) snappedY = 0;
    if (Math.abs(x + element.width - canvasWidth) < threshold) {
        snappedX = canvasWidth - element.width;
    }
    if (Math.abs(y + element.height - canvasHeight) < threshold) {
        snappedY = canvasHeight - element.height;
    }

    return { x: snappedX, y: snappedY };
}

// Grid toggle
function toggleGrid() {
    const isGridEnabled = document.getElementById('gridToggle').checked;
    if (isGridEnabled) {
        state.canvas.classList.add('grid');
    } else {
        state.canvas.classList.remove('grid');
    }
}

// History (Undo/Redo)
function addToHistory() {
    const snapshot = JSON.stringify({
        elements: state.elements,
        pageSettings: state.pageSettings
    });
    
    // Remove any history after current index
    state.history = state.history.slice(0, state.historyIndex + 1);
    
    state.history.push(snapshot);
    state.historyIndex++;

    // Limit history to 50 states
    if (state.history.length > 50) {
        state.history.shift();
        state.historyIndex--;
    }
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        loadHistoryState();
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        loadHistoryState();
    }
}

function loadHistoryState() {
    const snapshot = JSON.parse(state.history[state.historyIndex]);
    state.elements = snapshot.elements;
    state.pageSettings = snapshot.pageSettings;
    
    // Clear and re-render
    state.canvas.innerHTML = '';
    state.elements.forEach(el => renderElement(el));
    deselectAll();
    applyBackgroundFromState();
}

// Background
function applyBackground() {
    const color = document.getElementById('bgColor').value;
    const imageUrl = document.getElementById('bgImageUrl').value.trim();

    state.pageSettings.backgroundColor = color;
    
    if (imageUrl) {
        if (!imageUrl.startsWith('https://')) {
            alert('Background image must be a valid HTTPS URL');
            return;
        }
        state.pageSettings.backgroundImage = imageUrl;
    } else {
        state.pageSettings.backgroundImage = '';
    }

    applyBackgroundFromState();
    addToHistory();
    markAsUnsaved();
}

function applyBackgroundFromState() {
    state.canvas.style.backgroundColor = state.pageSettings.backgroundColor;
    
    if (state.pageSettings.backgroundImage) {
        state.canvas.style.backgroundImage = `url(${state.pageSettings.backgroundImage})`;
        state.canvas.style.backgroundSize = state.pageSettings.backgroundSize;
        state.canvas.style.backgroundPosition = state.pageSettings.backgroundPosition;
    } else {
        state.canvas.style.backgroundImage = 'none';
    }
}

// Modals
let pendingImagePosition = null;
let pendingIconPosition = null;

function openImageModal(x, y) {
    pendingImagePosition = { x, y };
    document.getElementById('imageModal').classList.add('show');
    document.getElementById('imageUrl').value = '';
    document.getElementById('imageError').style.display = 'none';
    document.getElementById('imageUrl').focus();
}

function closeImageModal() {
    document.getElementById('imageModal').classList.remove('show');
    pendingImagePosition = null;
}

function addImageFromModal() {
    const url = document.getElementById('imageUrl').value.trim();
    const error = document.getElementById('imageError');

    if (!url.startsWith('https://')) {
        error.style.display = 'block';
        return;
    }

    createElement('image', pendingImagePosition.x, pendingImagePosition.y, { url });
    closeImageModal();
}

function openIconModal(x, y) {
    pendingIconPosition = { x, y };
    document.getElementById('iconModal').classList.add('show');
    document.getElementById('iconName').value = '';
    document.getElementById('iconName').focus();
}

function closeIconModal() {
    document.getElementById('iconModal').classList.remove('show');
    pendingIconPosition = null;
}

function addIconFromModal() {
    const iconName = document.getElementById('iconName').value.trim();
    if (iconName) {
        createElement('icon', pendingIconPosition.x, pendingIconPosition.y, { iconName });
        closeIconModal();
    }
}

// Save/Preview functions
async function savePage() {
    try {
        console.log('Saving page...', currentPage.subdomain);
        
        const saveBtn = document.getElementById('save-btn');
        const originalHtml = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
        
        const saveData = {
            page_data: JSON.stringify({
                elements: state.elements,
                pageSettings: state.pageSettings
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
        alert('Failed to save page. Please try again.');
    } finally {
        const saveBtn = document.getElementById('save-btn');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
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