<?php
$request = $_SERVER['REQUEST_URI'];

switch ($request) {
    case '/':
    case '':
        require __DIR__ . '/home.php';
        break;
    case '/pages/policy':
        require __DIR__ . '/pages/policy.php';
        break;
    default:
        http_response_code(404);
        require __DIR__ . '/404.php';
        break;
}
?>
