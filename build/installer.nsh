; Página final del instalador con una casilla "Crear acceso directo en el
; escritorio" (marcada por defecto) en vez de crearlo siempre en silencio.
; Sustituye por completo la página de fin por defecto de electron-builder
; (no hay otro punto de enganche para añadir una casilla más sin hacerlo),
; así que se reimplementa también el "Ejecutar la aplicación" que ya traía
; — mismo Function StartApp que assistedInstaller.nsh, sin tocarlo.
;
; createDesktopShortcut se pone a `false` en electron-builder.yml para que
; la creación automática y silenciosa no se dispare — la única vía es esta
; casilla. La función usa $DESKTOP/$INSTDIR (variables nativas de NSIS,
; siempre disponibles) y ${SHORTCUT_NAME}/${PRODUCT_FILENAME}/
; ${APP_DESCRIPTION} (constantes ya definidas por electron-builder por
; línea de comandos antes de compilar) a propósito. Ni las variables
; internas $newDesktopLink/$appExe ni la constante ${APP_EXECUTABLE_FILENAME}
; (definida más tarde, dentro de common.nsh) sirven aquí — este archivo se
; incluye antes de que existan, y NSIS avisa de "variable desconocida" al
; referenciar cualquiera de las dos (electron-builder trata los avisos
; como error fatal de build).
!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  Function createDesktopShortcutIfChecked
    CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.exe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
  FunctionEnd

  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Crear acceso directo en el escritorio"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION createDesktopShortcutIfChecked

  !insertmacro MUI_PAGE_FINISH
!macroend
