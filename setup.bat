@echo off
setlocal enabledelayedexpansion
title CrabCreate Setup
echo.
echo  ======================================================
echo   CrabCreate - Setup Script
echo  ======================================================
echo.

set ERRORS=0

:: --- 1. CHECK NODE.JS ---
echo [1/7] Checking Node.js...
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo   [MISSING] Node.js not found
    echo   Download it at: https://nodejs.org
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('node -v') do echo   [OK] Node.js %%v
)

:: --- 2. CHECK NPM ---
echo [2/7] Checking npm...
where npm >nul 2>&1
if !errorlevel! neq 0 (
    echo   [MISSING] npm not found
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('npm -v') do echo   [OK] npm v%%v
)

:: --- 3. CHECK GIT ---
echo [3/7] Checking Git...
where git >nul 2>&1
if !errorlevel! neq 0 (
    echo   [MISSING] Git not found
    echo   Download it at: https://git-scm.com
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('git --version') do echo   [OK] %%v
)

:: --- 4. CHECK PYTHON ---
echo [4/7] Checking Python...
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo   [WARNING] Python not found - may be needed for better-sqlite3
    echo   Download it at: https://python.org
) else (
    for /f "tokens=*" %%v in ('python --version') do echo   [OK] %%v
)

:: --- 5. CREATE PROJECT FOLDERS ---
echo [5/7] Creating project structure...
if not exist "server" mkdir server
if not exist "server\routes" mkdir server\routes
if not exist "server\services" mkdir server\services
if not exist "server\db" mkdir server\db
if not exist "client" mkdir client
if not exist "client\src" mkdir client\src
if not exist "client\src\components" mkdir client\src\components
if not exist "client\src\components\layout" mkdir client\src\components\layout
if not exist "client\src\components\board" mkdir client\src\components\board
if not exist "client\src\components\modals" mkdir client\src\components\modals
if not exist "client\src\components\detail-tabs" mkdir client\src\components\detail-tabs
if not exist "client\src\components\analytics" mkdir client\src\components\analytics
if not exist "client\src\components\prompts" mkdir client\src\components\prompts
if not exist "client\src\hooks" mkdir client\src\hooks
if not exist "client\src\api" mkdir client\src\api
if not exist "client\src\constants" mkdir client\src\constants
if not exist "db-docs" mkdir db-docs
echo   [OK] Folders created

:: --- 6. INSTALL NPM PACKAGES ---
echo [6/7] Installing npm packages...
echo.

:: Use node to create package.json files (avoids cmd escaping hell)
if not exist "package.json" (
    echo   Creating root package.json...
    node -e "const fs=require('fs');fs.writeFileSync('package.json',JSON.stringify({name:'kanban-ai',private:true,scripts:{dev:'concurrently \"cd server && npm run dev\" \"cd client && npm run dev\"',build:'cd client && npm run build',start:'cd server && node index.js'}},null,2))"
    call npm install concurrently --save-dev
)

echo   Installing server dependencies...
cd server
if not exist "package.json" (
    node -e "const fs=require('fs');fs.writeFileSync('package.json',JSON.stringify({name:'kanban-ai-server',private:true,scripts:{dev:'node --watch index.js',start:'node index.js'}},null,2))"
)
call npm install express cors dotenv better-sqlite3 socket.io @anthropic-ai/sdk openai simple-git axios diff diff2html
if !errorlevel! neq 0 (
    echo   [ERROR] Server npm install failed
    set /a ERRORS+=1
) else (
    echo   [OK] Server dependencies installed
)
cd ..

echo   Installing client dependencies...
cd client
if not exist "package.json" (
    call npm create vite@latest . -- --template react
)
call npm install socket.io-client diff2html lucide-react
call npm install -D tailwindcss autoprefixer postcss @vitejs/plugin-react
if !errorlevel! neq 0 (
    echo   [ERROR] Client npm install failed
    set /a ERRORS+=1
) else (
    echo   [OK] Client dependencies installed
)
cd ..

:: --- 7. CREATE CONFIG FILES ---
echo [7/7] Creating config files...

if not exist ".env" (
    node -e "const fs=require('fs');fs.writeFileSync('.env',['PORT=3000','NODE_ENV=development','CLIENT_URL=http://localhost:5173','','DB_PATH=./server/db/kanban.db','','ANTHROPIC_API_KEY=sk-ant-','OPENAI_API_KEY=sk-','','BITBUCKET_USERNAME=','BITBUCKET_APP_PASSWORD=','BITBUCKET_WORKSPACE=','BITBUCKET_DEFAULT_REPO=','','REPOS_CLONE_PATH=C:/kanban-ai/repos','DB_DOCS_PATH=./db-docs','','STAGING_BASE_URL=','NGROK_URL='].join('\n'))"
    echo   [OK] .env created - EDIT IT with your API keys
) else (
    echo   [OK] .env already exists
)

if not exist ".gitignore" (
    node -e "const fs=require('fs');fs.writeFileSync('.gitignore',['node_modules/','.env','*.db','db-docs/','client/dist/','server/db/kanban.db','repos/'].join('\n'))"
    echo   [OK] .gitignore created
) else (
    echo   [OK] .gitignore already exists
)

:: --- DONE ---
echo.
echo  ======================================================
if !ERRORS! gtr 0 (
    echo   Setup finished with !ERRORS! errors. Fix them and re-run.
) else (
    echo   Setup complete - no errors!
)
echo.
echo   Next steps:
echo     1. Edit .env with your API keys
echo     2. Put your DB schema docs in db-docs\
echo     3. Run: npm run dev
echo  ======================================================
echo.
pause