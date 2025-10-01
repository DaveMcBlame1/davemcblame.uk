<?php
// filepath: /Users/774340/Documents/GitHub/davemcblame.uk/WWW/index.php

$request = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$request = rtrim($request, '/');

// Handle user pages first (before other routes)
if (preg_match('/^\/([a-z0-9-]+)$/', $request, $matches)) {
    $subdomain = $matches[1];
    
    // Exclude known system paths
    $reserved_paths = ['pages', 'static', 'css', 'js', 'images', 'indev', 'errors', 'api', 'admin'];
    
    if (!in_array($subdomain, $reserved_paths)) {
        // This is a user page - fetch from Flask API and display
        $api_url = "https://multigrounds.org:10065/pages/" . urlencode($subdomain);
        
        // Use cURL to fetch the page from Flask
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $api_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For development
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        
        $page_content = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($http_code === 200 && $page_content) {
            // Page found - display it
            echo $page_content;
            exit;
        } else {
            // Page not found - show 404
            http_response_code(404);
            echo "<!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Page Not Found - Multigrounds</title>
                <link href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css' rel='stylesheet'>
            </head>
            <body class='bg-light'>
                <div class='container py-5'>
                    <div class='row justify-content-center'>
                        <div class='col-lg-6 text-center'>
                            <h1 class='display-1 text-muted'>404</h1>
                            <h2>Page Not Found</h2>
                            <p class='lead'>The page '<strong>$subdomain</strong>' doesn't exist or has been removed.</p>
                            <div class='mt-4'>
                                <a href='/' class='btn btn-primary'>Go Home</a>
                                <a href='/pages/billing' class='btn btn-outline-primary'>Create Your Own Page</a>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>";
            exit;
        }
    }
}

// Your existing route handling
switch ($request) {
    case '':
    case '/':
        require __DIR__ . '/index.html';
        break;
    
    case '/pages/support':
        require __DIR__ . '/pages/support.html';
        break;
    
    case '/pages/billing':
        require __DIR__ . '/pages/billing.html';
        break;
    
    case '/pages/builder':
        require __DIR__ . '/pages/builder.html';
        break;
    
    case '/pages/my-pages':
        // This requires authentication - serve the my-pages.html file
        // The authentication check is handled by JavaScript in the HTML file
        require __DIR__ . '/pages/my-pages.html';
        break;
    
    case '/pages/verify':
        require __DIR__ . '/pages/verify.html';
        break;
    
    case '/pages/terms':
        require __DIR__ . '/pages/terms.html';
        break;
    
    case '/pages/policy':
        require __DIR__ . '/pages/policy.html';
        break;

    case '/pages/signup':
        require __DIR__ . '/pages/signup.html';
        break;
    
    default:
        // 404 for unknown routes
        http_response_code(404);
        echo "<!DOCTYPE html>
        <html lang='en'>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Page Not Found - Multigrounds</title>
            <link href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css' rel='stylesheet'>
        </head>
        <body class='bg-light'>
            <div class='container py-5'>
                <div class='row justify-content-center'>
                    <div class='col-lg-6 text-center'>
                        <h1 class='display-1 text-muted'>404</h1>
                        <h2>Page Not Found</h2>
                        <p class='lead'>The requested page could not be found.</p>
                        <div class='mt-4'>
                            <a href='/' class='btn btn-primary'>Go Home</a>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>";
        break;
}
?>