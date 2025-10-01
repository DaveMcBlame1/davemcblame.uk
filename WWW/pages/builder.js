const API_BASE = 'https://api.multigrounds.org:10065/api';
let currentPage = null;
let pageBlocks = [];
let currentEditingBlock = null;

// Initialize the builder
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in and load their page
    await loadUserPage();
    setupDragAndDrop();
});

async function loadUserPage() {
    try {
        const response = await fetch(`${API_BASE}/my-page`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                currentPage = data.page;
                document.getElementById('page-title').value = currentPage.title;
                document.getElementById('page-subdomain').value = currentPage.subdomain;
                document.getElementById('page-url').textContent = `multigrounds.org/${currentPage.subdomain}`;
                
                // Load existing blocks
                pageBlocks = JSON.parse(currentPage.page_data).blocks || [];
                renderBlocks();
            }
        } else {
            // No page exists, user can create one
            console.log('No existing page found');
        }
    } catch (error) {
        console.error('Error loading page:', error);
        alert('Please log in to access the page builder');
        window.location.href = '/pages/support';
    }
}

function setupDragAndDrop() {
    const blockItems = document.querySelectorAll('.block-item');
    const canvas = document.getElementById('canvas');
    
    // Make blocks draggable
    blockItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.dataset.blockType);
        });
    });
    
    // Setup drop zones
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dropZone = e.target.closest('.drop-zone');
        if (dropZone) {
            dropZone.classList.add('drag-over');
        }
    });
    
    canvas.addEventListener('dragleave', (e) => {
        const dropZone = e.target.closest('.drop-zone');
        if (dropZone) {
            dropZone.classList.remove('drag-over');
        }
    });
    
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const dropZone = e.target.closest('.drop-zone');
        if (dropZone) {
            dropZone.classList.remove('drag-over');
            const blockType = e.dataTransfer.getData('text/plain');
            const dropIndex = Array.from(canvas.children).indexOf(dropZone);
            addBlock(blockType, dropIndex);
        }
    });
}

function addBlock(type, index) {
    const newBlock = createDefaultBlock(type);
    pageBlocks.splice(index, 0, newBlock);
    renderBlocks();
}

function createDefaultBlock(type) {
    const defaults = {
        header: {
            type: 'header',
            content: {
                text: 'New Header',
                level: 1,
                align: 'left'
            }
        },
        text: {
            type: 'text',
            content: {
                text: 'Your text content goes here...',
                align: 'left'
            }
        },
        image: {
            type: 'image',
            content: {
                src: 'https://via.placeholder.com/400x200',
                alt: 'Placeholder image',
                align: 'center',
                maxWidth: '100%'
            }
        },
        button: {
            type: 'button',
            content: {
                text: 'Click Me',
                link: '#',
                style: 'primary',
                align: 'center'
            }
        },
        spacer: {
            type: 'spacer',
            content: {
                height: '50px'
            }
        }
    };
    
    return defaults[type] || defaults.text;
}

function renderBlocks() {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '';
    
    // Add initial drop zone
    canvas.appendChild(createDropZone(0));
    
    pageBlocks.forEach((block, index) => {
        const blockElement = createBlockElement(block, index);
        canvas.appendChild(blockElement);
        canvas.appendChild(createDropZone(index + 1));
    });
}

function createDropZone(index) {
    const dropZone = document.createElement('div');
    dropZone.className = 'drop-zone';
    dropZone.innerHTML = '<span class="text-muted">Drop blocks here</span>';
    return dropZone;
}

function createBlockElement(block, index) {
    const div = document.createElement('div');
    div.className = 'editable-block mb-3';
    div.dataset.blockIndex = index;
    
    let html = '';
    const content = block.content;
    
    switch (block.type) {
        case 'header':
            html = `<h${content.level} class="text-${content.align}">${content.text}</h${content.level}>`;
            break;
        case 'text':
            html = `<p class="text-${content.align}">${content.text}</p>`;
            break;
        case 'image':
            html = `<div class="text-${content.align}"><img src="${content.src}" alt="${content.alt}" class="img-fluid" style="max-width: ${content.maxWidth}"></div>`;
            break;
        case 'button':
            html = `<div class="text-${content.align}"><a href="${content.link}" class="btn btn-${content.style}">${content.text}</a></div>`;
            break;
        case 'spacer':
            html = `<div style="height: ${content.height}; background: repeating-linear-gradient(90deg, transparent, transparent 10px, #f0f0f0 10px, #f0f0f0 20px);"></div>`;
            break;
    }
    
    div.innerHTML = `
        ${html}
        <div class="block-controls">
            <button class="btn btn-sm btn-primary" onclick="editBlock(${index})">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="removeBlock(${index})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    return div;
}

function editBlock(index) {
    currentEditingBlock = index;
    const block = pageBlocks[index];
    const modal = new bootstrap.Modal(document.getElementById('blockEditorModal'));
    
    document.getElementById('block-editor-content').innerHTML = createBlockEditor(block);
    modal.show();
}

function createBlockEditor(block) {
    const content = block.content;
    
    switch (block.type) {
        case 'header':
            return `
                <div class="mb-3">
                    <label class="form-label">Header Text</label>
                    <input type="text" id="edit-text" class="form-control" value="${content.text}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Header Level</label>
                    <select id="edit-level" class="form-select">
                        <option value="1" ${content.level == 1 ? 'selected' : ''}>H1</option>
                        <option value="2" ${content.level == 2 ? 'selected' : ''}>H2</option>
                        <option value="3" ${content.level == 3 ? 'selected' : ''}>H3</option>
                        <option value="4" ${content.level == 4 ? 'selected' : ''}>H4</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Alignment</label>
                    <select id="edit-align" class="form-select">
                        <option value="left" ${content.align === 'left' ? 'selected' : ''}>Left</option>
                        <option value="center" ${content.align === 'center' ? 'selected' : ''}>Center</option>
                        <option value="right" ${content.align === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                </div>
            `;
        case 'text':
            return `
                <div class="mb-3">
                    <label class="form-label">Text Content</label>
                    <textarea id="edit-text" class="form-control" rows="4">${content.text}</textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label">Alignment</label>
                    <select id="edit-align" class="form-select">
                        <option value="left" ${content.align === 'left' ? 'selected' : ''}>Left</option>
                        <option value="center" ${content.align === 'center' ? 'selected' : ''}>Center</option>
                        <option value="right" ${content.align === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                </div>
            `;
        case 'image':
            return `
                <div class="mb-3">
                    <label class="form-label">Image URL</label>
                    <input type="url" id="edit-src" class="form-control" value="${content.src}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Alt Text</label>
                    <input type="text" id="edit-alt" class="form-control" value="${content.alt}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Max Width</label>
                    <input type="text" id="edit-maxWidth" class="form-control" value="${content.maxWidth}" placeholder="100%">
                </div>
                <div class="mb-3">
                    <label class="form-label">Alignment</label>
                    <select id="edit-align" class="form-select">
                        <option value="left" ${content.align === 'left' ? 'selected' : ''}>Left</option>
                        <option value="center" ${content.align === 'center' ? 'selected' : ''}>Center</option>
                        <option value="right" ${content.align === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                </div>
            `;
        case 'button':
            return `
                <div class="mb-3">
                    <label class="form-label">Button Text</label>
                    <input type="text" id="edit-text" class="form-control" value="${content.text}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Link URL</label>
                    <input type="url" id="edit-link" class="form-control" value="${content.link}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Button Style</label>
                    <select id="edit-style" class="form-select">
                        <option value="primary" ${content.style === 'primary' ? 'selected' : ''}>Primary</option>
                        <option value="secondary" ${content.style === 'secondary' ? 'selected' : ''}>Secondary</option>
                        <option value="success" ${content.style === 'success' ? 'selected' : ''}>Success</option>
                        <option value="danger" ${content.style === 'danger' ? 'selected' : ''}>Danger</option>
                        <option value="warning" ${content.style === 'warning' ? 'selected' : ''}>Warning</option>
                        <option value="info" ${content.style === 'info' ? 'selected' : ''}>Info</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Alignment</label>
                    <select id="edit-align" class="form-select">
                        <option value="left" ${content.align === 'left' ? 'selected' : ''}>Left</option>
                        <option value="center" ${content.align === 'center' ? 'selected' : ''}>Center</option>
                        <option value="right" ${content.align === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                </div>
            `;
        default:
            return '<p>No editor available for this block type.</p>';
    }
}

function saveBlockChanges() {
    const block = pageBlocks[currentEditingBlock];
    
    switch (block.type) {
        case 'header':
            block.content.text = document.getElementById('edit-text').value;
            block.content.level = parseInt(document.getElementById('edit-level').value);
            block.content.align = document.getElementById('edit-align').value;
            break;
        case 'text':
            block.content.text = document.getElementById('edit-text').value;
            block.content.align = document.getElementById('edit-align').value;
            break;
        case 'image':
            block.content.src = document.getElementById('edit-src').value;
            block.content.alt = document.getElementById('edit-alt').value;
            block.content.maxWidth = document.getElementById('edit-maxWidth').value;
            block.content.align = document.getElementById('edit-align').value;
            break;
        case 'button':
            block.content.text = document.getElementById('edit-text').value;
            block.content.link = document.getElementById('edit-link').value;
            block.content.style = document.getElementById('edit-style').value;
            block.content.align = document.getElementById('edit-align').value;
            break;
    }
    
    renderBlocks();
    bootstrap.Modal.getInstance(document.getElementById('blockEditorModal')).hide();
}

function removeBlock(index) {
    if (confirm('Are you sure you want to remove this block?')) {
        pageBlocks.splice(index, 1);
        renderBlocks();
    }
}

async function savePage() {
    const title = document.getElementById('page-title').value;
    const subdomain = document.getElementById('page-subdomain').value;
    
    if (!title || !subdomain) {
        alert('Please enter both a title and subdomain');
        return;
    }
    
    const pageData = {
        title: title,
        page_data: JSON.stringify({ blocks: pageBlocks })
    };
    
    try {
        let response;
        if (currentPage) {
            // Update existing page
            response = await fetch(`${API_BASE}/page/${currentPage.subdomain}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(pageData)
            });
        } else {
            // Create new page
            pageData.subdomain = subdomain;
            response = await fetch(`${API_BASE}/create-page`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(pageData)
            });
        }
        
        const data = await response.json();
        if (data.success) {
            alert('Page saved successfully!');
            if (!currentPage) {
                // Reload to show the new page
                location.reload();
            }
        } else {
            alert('Error saving page: ' + data.message);
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('Error saving page. Please try again.');
    }
}

function previewPage() {
    const subdomain = document.getElementById('page-subdomain').value;
    if (subdomain && currentPage) {
        window.open(`https://multigrounds.org/${subdomain}`, '_blank');
    } else {
        alert('Please save your page first');
    }
}

async function publishPage() {
    await savePage();
    // Additional publish logic can go here
    alert('Page published successfully!');
}