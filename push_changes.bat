@echo off
echo Configuring remote repository...
git init
git remote add origin https://github.com/jacobjerin38/KAAERPLIVE.git
git remote set-url origin https://github.com/jacobjerin38/KAAERPLIVE.git

echo Adding changes...
git add .

echo Committing changes...
git commit -m "refactor: Complete HRMS Admin Portal (Payroll, Exit Mgmt, HelpDesk)"

echo Enforcing branch 'main'...
git branch -M main

echo Pushing to 'main'...
git push -u origin main

echo Done!
pause
