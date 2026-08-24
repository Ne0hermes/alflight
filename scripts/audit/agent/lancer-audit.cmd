@echo off
rem Lanceur de l'agent quotidien ALFlight — appelé par la tâche planifiée Windows.
rem Le journal complet de chaque exécution est conservé à côté des rapports.
cd /d D:\Applicator\alflight
node scripts\audit\agent\audit-quotidien.mjs >> scripts\audit\agent\rapports\executions.log 2>&1
