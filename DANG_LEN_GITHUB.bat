@echo off
title Day Code Len GitHub - toanbogta5
color 0a
echo ========================================================
echo        DAY CODE WEBSITE LEN GITHUB (DE CHAY 24/7)
echo ========================================================
echo.
echo Buoc 1: Ban mo trinh duyet vao: https://github.com/new
echo Buoc 2: Dat ten Repository la: toanbogta5
echo Buoc 3: Bam nut "Create repository"
echo.
echo Sau do copy duong link repository do va dan vao day:
echo (Vi du: https://github.com/ten-cua-ban/toanbogta5.git)
echo.
set /p REPO_URL="Dan link GitHub vao day roi bam Enter: "

if "%REPO_URL%"=="" (
    echo Ban chua nhap link! Vui long chay lai.
    pause
    exit /b
)

echo.
echo Dang ket noi va day code len GitHub...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

echo.
echo ========================================================
echo   DA DAY CODE LEN GITHUB THANH CONG!
echo ========================================================
echo Bay gio ban chi can vao https://vercel.com dang nhap bang
echo GitHub roi bam Deploy la web se online 24/7 vinh vien!
echo ========================================================
pause

