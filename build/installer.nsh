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

; Rescate de equipos que quedaron apuntando a una carpeta donde no se puede
; escribir. multiUser.nsh (setInstallModePerUser) hace, en .onInit:
;
;   ReadRegStr $perUserInstallationFolder HKCU "..." InstallLocation
;   ${if} $perUserInstallationFolder != ""
;     StrCpy $INSTDIR $perUserInstallationFolder
;
; es decir, reutiliza SIEMPRE la ruta de la instalación anterior. Quien en su
; día eligió C:\Program Files (cuando aún había página de carpeta) se queda
; atrapado: el instalador es por-usuario y no eleva a administrador, así que
; cada intento vuelve a esa ruta y vuelve a fallar. Se ve como "error abriendo
; archivo para escribir" en los dos únicos `File` que escriben directos a
; $INSTDIR (uninstallerIcon.ico y "Uninstall Layer Library.exe") — los
; archivos de la app no dan ese diálogo porque salen de un 7z a temp.
;
; customInit se inserta justo DESPUÉS de initMultiUser (installer.nsi), que es
; donde $INSTDIR ya está resuelto, así que aquí se puede corregir: se prueba a
; escribir de verdad un archivo y, si no se puede, se cae a la ruta por
; defecto por usuario. La comprobación es por escritura real y no por nombre
; de carpeta, así que cubre también unidades de red caídas, USB retirados o
; permisos raros, no solo Program Files.
!macro customInit
  Var /GLOBAL llWriteTest

  CreateDirectory "$INSTDIR"
  ClearErrors
  FileOpen $llWriteTest "$INSTDIR\.layerlibrary-write-test" w
  ${if} ${errors}
    ClearErrors
    StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${APP_FILENAME}"

    ; Además de redirigir, hay que DESVINCULAR la instalación vieja: si se
    ; dejan las claves del registro, uninstallSection sigue apuntando allí y
    ; installSection.nsh:52 lanza uninstallOldVersion contra una copia que no
    ; se puede borrar sin admin. Ese desinstalador devuelve != 0, se reintenta
    ; 5 veces (installUtil.nsh:219) y acaba enseñando el mensaje
    ; "No se puede cerrar Layer Library" — que despista muchísimo, porque el
    ; problema no es que la app esté abierta — y después handleUninstallResult
    ; puede hacer Quit y abortar la instalación entera.
    ; Borrando las claves, uninstallOldVersion lee UninstallString vacío y
    ; vuelve de inmediato: la instalación nueva sigue limpia. Los archivos
    ; viejos quedan huérfanos en disco (se borran a mano, requieren admin).
    ; APP_GUID y UNINSTALL_APP_KEY son defines de línea de comandos, así que
    ; sí están disponibles aquí (a diferencia de los de common.nsh).
    DeleteRegKey HKCU "Software\${APP_GUID}"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
    ClearErrors
  ${else}
    FileClose $llWriteTest
    Delete "$INSTDIR\.layerlibrary-write-test"
  ${endif}
!macroend

; Las versiones 1.0.0/1.0.1 fijaban nsis.uninstallerIcon, lo que hacía que el
; instalador extrajera "uninstallerIcon.ico" a la carpeta de instalación en
; cada install. Ese archivo suelto se quedaba entre versiones y, si el shell
; lo tenía bloqueado (lo usaba como DisplayIcon) o de solo lectura, el
; siguiente instalador abortaba con "error abriendo archivo para escribir
; ...uninstallerIcon.ico". Ya no se genera (se quitaron installerIcon/
; uninstallerIcon), pero hay que barrer el que dejaron las instalaciones
; viejas. Si está bloqueado, /REBOOTOK lo marca para borrar al reiniciar.
!macro customInstall
  Delete /REBOOTOK "$INSTDIR\uninstallerIcon.ico"
  ClearErrors
!macroend
