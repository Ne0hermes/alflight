; Script AutoHotkey pour notifications Claude
; Appuyez sur Ctrl+Shift+N pour jouer un son

^+n::
SoundBeep, 750, 300  ; Beep à 750Hz pendant 300ms
MsgBox, 64, Claude, Notification envoyée!, 2
return

; Alternative : Son système
^+m::
SoundPlay, *64  ; Son d'exclamation Windows
return

; Quitter avec Ctrl+Shift+Q
^+q::ExitApp