const API_BASE = 'https://multigrounds.org:10065/api';  // Fixed URL

document.addEventListener('DOMContentLoaded', async () => {
    // Get subdomain from URL path
    const pathParts = window.location.pathname.split('/');
    const subdomain = pathParts[1]; // multigrounds.org/SUBDOMAIN
    
    if (subdomain && subdomain !== 'pages' && subdomain !== 'static') {
        await loadPageData(subdomain);
    }
});

async function loadPageData(subdomain) {
    try {
        const response = await fetch(`${API_BASE}/page/${subdomain}`, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.page.is_owner) {
                // Show edit button for owner
                const editButton = document.getElementById('edit-button');
                if (editButton) {
                    editButton.style.display = 'block';
                }
            }
        }
    } catch (error) {
        console.error('Error loading page data:', error);
    }
}

function enterEditMode() {
    window.location.href = '/pages/builder';
}