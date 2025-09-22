<?php
session_start();
require_once '../config.php';

if(!isset($_SESSION['username'])) die("Login required");

if(isset($_FILES['profile_picture'])){
    $file = $_FILES['profile_picture'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if(!in_array($ext, ['png','jpg','jpeg'])) die("Invalid file type");

    $userStmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $userStmt->execute([$_SESSION['username']]);
    $user = $userStmt->fetch();

    $target = "../data/profiles/{$user['id']}.png";
    move_uploaded_file($file['tmp_name'], $target);

    $update = $pdo->prepare("UPDATE users SET profile_picture = ? WHERE id = ?");
    $update->execute(["{$user['id']}.png", $user['id']]);
    header("Location: profile.php");
}
?>
<form method="POST" enctype="multipart/form-data">
    <input type="file" name="profile_picture">
    <button>Upload</button>
</form>
