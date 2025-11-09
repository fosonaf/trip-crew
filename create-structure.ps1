# Script de creation de la structure backend TypeScript
Write-Host "Creation de la structure backend..." -ForegroundColor Green

# Creer le dossier backend s'il n'existe pas
if (-not (Test-Path "backend")) {
    New-Item -ItemType Directory -Path "backend" | Out-Null
}

Set-Location backend

# Creer les dossiers
$folders = @(
    "src",
    "src/types",
    "src/config",
    "src/database",
    "src/middleware",
    "src/controllers",
    "src/routes",
    "src/services",
    "src/sockets",
    "src/utils"
)

foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }
}

# Creer les fichiers vides
$files = @(
    "package.json",
    "tsconfig.json",
    ".env.example",
    ".env",
    ".gitignore",
    "src/types/index.ts",
    "src/types/express.d.ts",
    "src/config/database.ts",
    "src/config/jwt.ts",
    "src/database/migrate.ts",
    "src/middleware/auth.ts",
    "src/middleware/errorHandler.ts",
    "src/controllers/authController.ts",
    "src/controllers/eventController.ts",
    "src/controllers/memberController.ts",
    "src/controllers/stepController.ts",
    "src/controllers/messageController.ts",
    "src/controllers/checkinController.ts",
    "src/routes/authRoutes.ts",
    "src/routes/eventRoutes.ts",
    "src/routes/memberRoutes.ts",
    "src/routes/stepRoutes.ts",
    "src/routes/messageRoutes.ts",
    "src/routes/checkinRoutes.ts",
    "src/services/qrcodeService.ts",
    "src/services/notificationService.ts",
    "src/sockets/chatSocket.ts",
    "src/utils/validators.ts",
    "src/server.ts"
)

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        New-Item -ItemType File -Path $file -Force | Out-Null
    }
}

Write-Host "Structure backend creee avec succes!" -ForegroundColor Green
Write-Host "Fichiers crees: $($files.Count)" -ForegroundColor Cyan

Set-Location ..