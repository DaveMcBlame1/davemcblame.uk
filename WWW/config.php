<?php
$host = 'localhost';
$port = 10062;
$db   = 'railway';
$user = 'root';
$pass = 'sGdUDCMPlffiKHJxTDRsrlqOrywwBJHR';

$dsn = "pgsql:host=$host;port=$port;dbname=$db;user=$user;password=$pass";
try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Connected to PostgreSQL!";
} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage();
}
?>
