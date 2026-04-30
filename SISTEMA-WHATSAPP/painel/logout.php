
<?php
?><!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Logout</title>
  <meta http-equiv="refresh" content="0;url=index.html" />
</head>
<body>
  <script>
    localStorage.removeItem('jwt_token');
    window.location.href = 'index.html';
  </script>
</body>
</html>

