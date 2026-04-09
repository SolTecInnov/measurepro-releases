!macro customInit
  ; Silent install defaults — pick the default install directory automatically
  StrCmp $INSTDIR "" 0 +2
    StrCpy $INSTDIR "$LOCALAPPDATA\Programs\MeasurePRO"
!macroend

!macro customUnInit
  ; Ask user if they want to remove app data (IndexedDB, settings, cache)
  MessageBox MB_YESNO "Remove MeasurePRO user data (surveys, settings, cache)?$\nChoose No to keep your data for future installs." IDYES removeData IDNO skipRemove
  removeData:
    RMDir /r "$LOCALAPPDATA\MeasurePRO"
    RMDir /r "$APPDATA\MeasurePRO"
    RMDir /r "$LOCALAPPDATA\measurepro-electron"
    RMDir /r "$APPDATA\measurepro-electron"
  skipRemove:
!macroend
