<?php
$request = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$request = rtrim($request, '/');

switch ($request) {
    case '':
        require __DIR__ . '/index.html';
        break;
    case '/pages/policy':
        require __DIR__ . '/pages/policy.html';
        break;
    default:
        http_response_code(404);
        require __DIR__ . '/errors/404.html';
        break;
}

session_start();
header('Content-Type: text/html; charset=utf-8');

echo "<h1>Welcome</h1>";
if(isset($_SESSION['username'])){
    echo "<p>Hello, ".$_SESSION['username']."</p>";
    echo "<a href='chat.php'>Go to chat</a>";
}else{
    echo "<a href='login.php'>Login</a> | <a href='register.php'>Register</a>";
}

?>
