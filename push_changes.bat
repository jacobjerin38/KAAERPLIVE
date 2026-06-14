@echo off
echo Configuring remote repository...
git init
git remote add origin https://github.com/jacobjerin38/KAAERPLIVE.git
git remote set-url origin https://github.com/jacobjerin38/KAAERPLIVE.git

REM Add backup remote
git remote add backup https://github.com/jerinjacobdream11-lang/KAAERPLIVE.git
git remote set-url backup https://github.com/jerinjacobdream11-lang/KAAERPLIVE.git
echo Adding changes...
git add .

echo Committing changes...
git commit -m "fix: stabilize ERP system for go-live (session timeout, HRMS bug, loading states, ESSP leave form)"

echo Enforcing branch 'main'...
git branch -M main

echo Pushing to 'main' on origin...
git push -u origin main

echo Pushing to 'main' on backup...
git push -u backup main

echo Done!
pause
