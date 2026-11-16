@echo off
title GTA V Cloud Server - Mo Link Ra Quan Net
color 0b
echo =======================================================
echo    DANG TAO LINK ONLINE DE BAN RA QUAN NET MO DUOC
echo =======================================================
echo.
echo He thong dang tao duong dan public mien phi qua Cloudflare...
echo Sau khi hien ra link (co dang: https://xxxx.trycloudflare.com),
echo ban chi can luu link do vao dien thoai, khi ra quan net
echo go link do len trinh duyet quan net la tai duoc tat ca file!
echo.
echo Luu y: Giu cua so nay va cua so server mo khi ra quan net.
echo =======================================================
echo.
npx --yes cloudflared tunnel --url http://localhost:3000
pause

