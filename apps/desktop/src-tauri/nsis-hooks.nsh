; Browser cache lives outside the protected vault directory. Remove it only
; when the user explicitly selected application-data deletion on uninstall.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
    RMDir /r "$LOCALAPPDATA\com.passkeylocal.vault-webview"
  ${EndIf}
!macroend
