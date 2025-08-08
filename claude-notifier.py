#!/usr/bin/env python3
"""
Script de notification sonore pour Claude
Surveille les changements dans la console et joue un son
"""

import time
import winsound  # Pour Windows
import sys

def play_notification():
    """Joue un son de notification"""
    # Son système Windows
    winsound.PlaySound("SystemExclamation", winsound.SND_ALIAS)
    
    # Alternative : Beep personnalisé
    # winsound.Beep(1000, 500)  # Fréquence 1000Hz, durée 500ms

def monitor_claude():
    """Surveille les changements"""
    print("🔔 Surveillance Claude activée...")
    print("Appuyez sur Ctrl+C pour arrêter")
    
    last_line = ""
    
    try:
        while True:
            # Ici vous pourriez surveiller un fichier log ou l'état de la console
            # Pour l'instant, c'est un exemple simple
            
            # Simuler la détection d'une fin de tâche
            current_input = input("\nAppuyez sur Entrée quand Claude a fini une tâche...")
            
            if current_input != last_line:
                play_notification()
                print("✅ Notification envoyée!")
                last_line = current_input
                
    except KeyboardInterrupt:
        print("\n👋 Arrêt du moniteur")

if __name__ == "__main__":
    monitor_claude()