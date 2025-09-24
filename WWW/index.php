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
    case '/indev/accCreation':
        require __DIR__ . '/indev/accCreation.html';
        break;
    case '/indev/accRegister':
        require __DIR__ . '/indev/accRegister.html';
        break;
}
?>