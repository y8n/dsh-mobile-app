// SPDX-License-Identifier: Apache-2.0
// Original: dsh-mobile 0.6.3, saya-ch and contributors. Original license and source retained under vendor/dsh-mobile.
// Modifications: Copyright 2026 Y8n and contributors; module/style identity, project links, distribution UI and notices.
// Derived from dsh-mobile 0.6.3 (Apache-2.0); project module identity, distribution links and notices adapted. Original retained under vendor.
window.__ModuleLoader__.load({
	id: "@dsh-mobile-app/gateway",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client-messages.ts
		const storageMessages = {
			en: {
				funnelStateInvalid: "The private Tailscale state folder cannot be accessed safely. Check its permissions or directory links; reinstalling the component is not required.",
				componentPathUnsafe: "The component folder contains an unsafe link or cannot be accessed. Check the directory and permissions, then retry."
			},
			zh: {
				funnelStateInvalid: "Tailscale 私有登录目录无法安全访问。请检查目录权限或链接，不必重新安装组件。",
				componentPathUnsafe: "组件目录包含不安全的链接或无法访问。请检查目录和权限后重试。"
			},
			it: {
				funnelStateInvalid: "La cartella privata Tailscale non è accessibile in sicurezza. Controlla permessi o collegamenti; non occorre reinstallare il componente.",
				componentPathUnsafe: "La cartella del componente contiene un collegamento non sicuro o non è accessibile. Controlla directory e permessi, poi riprova."
			}
		};
		/** Desktop-only stopped-worker recovery, independent of remote provider state. */
		const EXTENSION_RECOVERY_MESSAGES = {
			en: {
				extensionRecoveryTitle: "An extension needs a restart",
				extensionRecoveryHelp: "Only the stopped extension restarts. Unfinished actions are not retried.",
				extensionRecoveryRestart: "Restart",
				extensionRecoveryRestarting: "Restarting…",
				extensionRecoveryRestartAria: "Restart extension {name}",
				extensionRecoveryConfirm: "Restart extension “{name}”? Unfinished actions will not be retried. Previously completed changes will not be undone.",
				extensionRecoveryRefresh: "Check again",
				extensionRecoveryLoadFailed: "Could not check the extension status. Check again before restarting.",
				extensionRecoveryFailed: "The extension did not restart. Check its configuration, then retry.",
				extensionRecoveryChanged: "The extension files changed. Review the changes and reload the extension before trying again."
			},
			it: {
				extensionRecoveryTitle: "Un’estensione richiede un riavvio",
				extensionRecoveryHelp: "Si riavvia solo l’estensione arrestata. Le azioni incompiute non vengono ripetute.",
				extensionRecoveryRestart: "Riavvia",
				extensionRecoveryRestarting: "Riavvio…",
				extensionRecoveryRestartAria: "Riavvia l’estensione {name}",
				extensionRecoveryConfirm: "Riavviare l’estensione “{name}”? Le azioni incompiute non verranno ripetute. Le modifiche già completate non saranno annullate.",
				extensionRecoveryRefresh: "Controlla di nuovo",
				extensionRecoveryLoadFailed: "Impossibile verificare lo stato. Controlla di nuovo prima di riavviare.",
				extensionRecoveryFailed: "L’estensione non si è riavviata. Controlla la configurazione e riprova.",
				extensionRecoveryChanged: "I file dell’estensione sono cambiati. Verifica le modifiche e ricarica l’estensione prima di riprovare."
			},
			zh: {
				extensionRecoveryTitle: "扩展需要重启",
				extensionRecoveryHelp: "仅重启已停止的扩展，不会重新执行未完成的操作。",
				extensionRecoveryRestart: "重启扩展",
				extensionRecoveryRestarting: "正在重启…",
				extensionRecoveryRestartAria: "重启扩展 {name}",
				extensionRecoveryConfirm: "要重启扩展“{name}”吗？未完成的操作不会重新执行，已经完成的修改也不会撤销。",
				extensionRecoveryRefresh: "重新检测",
				extensionRecoveryLoadFailed: "暂时无法检查扩展状态，请重新检测后再操作。",
				extensionRecoveryFailed: "扩展没有重启成功，请检查配置后重试。",
				extensionRecoveryChanged: "扩展文件已经变化，请核对修改并重新加载扩展后再操作。"
			}
		};
		const MOBILE_CONTROL_MESSAGES = {
			en: {
				mobileAccess: "Mobile access",
				collapseMobileAccess: "Collapse Mobile access",
				downloadAndroid: "Download Android test app",
				downloadAndroidVersion: "Download Android test app · v{version}",
				downloadAndroidAria: "Download this project’s Android test app",
				downloadAndroidVersionAria: "Download this project’s Android test app v{version}",
				updatePlugin: "Update plugin",
				updatePluginAria: "Update DSH Mobile to v{version}",
				updatingPlugin: "Updating…",
				pluginUpdatedRestart: "Updated to v{version}. Restart DSH to apply it.",
				pluginUpdateFailed: "Update failed: {error}",
				updateTo: "Update to v{version}",
				updateNotice: "Restart DSH after installing. Existing apps and paired devices need no re-pairing; unsure about the desktop version? Check the README compatibility table.",
				updateNotesEmpty: "No release notes fetched — updating is still fine; full details on the GitHub Release page.",
				updateNow: "Update now",
				updateLater: "Not now",
				lan: "Local network",
				remote: "Remote",
				lanAccess: "Local network access",
				remoteAccess: "Remote access",
				browserAccess: "Browser access",
				remoteAddress: "Remote address",
				loadingStatus: "Loading status…",
				loadingRemoteStatus: "Loading remote status…",
				generateCopyKey: "Generate and copy key",
				copyPairLink: "Copy pairing link",
				managePairedDevices: "Manage paired devices",
				clearAllDevices: "Clear all devices",
				pairingQr: "Pairing QR code",
				remoteIntro: "Choose the remote channel that suits you. Switching or disabling remote access does not affect the local network.",
				httpFrameWarning: "HTTP pages may be embedded for compatibility, but their contents are unencrypted and can be altered. Use HTTPS for sensitive work.",
				chooseProvider: "Choose connection method",
				currentProvider: "Current connection",
				remoteStateOff: "Off",
				remoteStateConnecting: "Connecting",
				remoteStateAttention: "Needs attention",
				providerInfoAria: "View remote connection security and network information",
				providerGroupAria: "Remote connection method",
				providerSafeTitle: "You remain protected",
				providerSafeText: "Only paired devices can access DSH. cpolar is installed on demand and can be removed completely; Tailscale may be slow or unavailable on mainland China networks, where cpolar is recommended.",
				builtIn: "Built in",
				mainlandPreferred: "Preferred in mainland China",
				tailscaleDescription: "Wider coverage; mainland China networks may be unstable. The first connection requires login and Funnel authorization.",
				cpolarDescription: "Installs the official component on demand and is suitable for mainland China networks.",
				prepareCpolar: "Prepare cpolar",
				checkingComponent: "Checking component…",
				installOfficial: "Install official component",
				cpolarAccountNote: "Sign in to the cpolar website and copy the Authtoken. The token is stored only in the plugin private directory and is never shown on the page or in logs.",
				registerCpolar: "Register with cpolar",
				openDashboard: "Open dashboard to get token",
				tokenPlaceholder: "Paste cpolar Authtoken",
				saveConnect: "Save and connect",
				saving: "Saving…",
				componentDetails: "Component source and cleanup",
				componentDetailsText: "Downloaded from the official cpolar website and verified at a fixed version only after you choose Install. It does not add a system service, startup item, registry entry, or PATH entry.",
				pluginPrivateDirectory: "Plugin private directory",
				officialDownload: "Official download page",
				terms: "Terms of service",
				purgeCpolar: "Completely remove cpolar component and configuration",
				tailscaleHelp: "How to use Tailscale",
				tailscaleHelpText: "The runtime component is included with the plugin. The first connection opens the official Tailscale login and Funnel authorization pages; the plugin never accesses your account password.",
				funnelGuideAria: "Steps to enable Tailscale Funnel",
				funnelGuideTitle: "Remote access setup · Step 2",
				funnelGuideSummary: "Tailscale login is complete. Funnel must still be allowed for this computer; the official page also enables HTTPS.",
				funnelStep1: "Open the official Tailscale authorization page for this node.",
				funnelStep2: "Confirm Funnel; you do not need to sign in to DSH again.",
				funnelStep3: "Return to DSH; the plugin checks and connects automatically.",
				funnelGuideNote: "Requires an Owner, Admin, or Network admin account.",
				continueFunnel: "Continue Funnel authorization",
				retryNow: "Done, retry now",
				enableRemote: "Enable remote access",
				disableRemote: "Disable remote access",
				continueLogin: "Continue login",
				reconnect: "Reconnect",
				generateRemoteQr: "Generate remote pairing QR code",
				copyRemoteLink: "Copy remote pairing link",
				manageRemoteDevices: "Manage remote devices",
				resetRemoteLogin: "Sign out and clear remote login",
				resetRemoteDevices: "Disable and clear remote devices",
				lanOn: "Local network access is on.",
				lanOff: "Local network access is off.",
				enableLan: "Enable local network access",
				disableLan: "Disable local network access",
				extensionsLoaded: "Extensions: {loaded} loaded",
				extensionsFailed: "Extensions: {loaded} loaded, {failed} failed",
				keyGenerationFailed: "Could not generate a pairing key.",
				keyCopied: "Pairing key copied. Paste it into the Android app.",
				linkCopied: "Pairing link copied. Send it to the phone and paste it into the app or open it in a browser.",
				copySecret: "Copy {kind}: {value}",
				pairingKey: "pairing key",
				pairingLink: "pairing link",
				noDevices: "No paired devices.",
				noRemoteDevices: "No remote paired devices.",
				device: "Device",
				expires: "Expires {time}",
				revoke: "Revoke",
				confirmResetDevices: "Remove all paired devices? Connected devices will be disconnected immediately.",
				ready: "Ready",
				installed: "Installed",
				installWithSize: "Install official component · {size} MB",
				cpolarUnsupported: "Windows x64 and Linux x64/arm64 are currently supported.",
				cpolarNotInstalled: "Not installed. A fixed version is downloaded from the official cpolar website only after you click the button below.",
				cpolarNeedsToken: "Official component {version} is verified. Save the account token to continue.",
				cpolarReady: "Official component {version} and the local account configuration are ready. Free temporary addresses may change after DSH or cpolar restarts; if the app cannot connect, scan the current remote QR code again.",
				remoteOff: "Remote access is disabled. Local network access is unaffected.",
				remoteUnavailableCpolar: "cpolar is not installed or its local account is not configured.",
				remoteUnavailableTailscale: "This computer is missing the Funnel runtime component. Reinstall the complete plugin package.",
				remoteStartingCpolar: "Connecting to a cpolar node…",
				remoteStartingTailscale: "Starting the secure Tailscale channel…",
				remoteNeedsLogin: "Complete a one-time Tailscale login in the browser. The plugin never reads your password.",
				remoteConnectingCpolar: "Public address allocated; starting the DSH authentication gateway…",
				remoteConnectingTailscale: "Login complete; creating the public HTTPS address…",
				remoteReady: "Remote access is ready. Only paired devices can access DSH.",
				remoteError: "The remote connection was not established. Reconnect; local network access still works.",
				funnelPermission: "Login is complete. Authorize Funnel to establish the remote connection automatically.",
				funnelHttps: "Login is complete. Authorize Funnel; the official page also enables HTTPS.",
				funnelStart: "Login is complete. Finish the initial Tailscale Funnel authorization.",
				tailscaleDnsMissing: "Tailscale has not provided a remote address. Reconnect and confirm login is complete.",
				gatewayStartFailed: "The remote gateway failed to start. Reconnect; local network access is unaffected.",
				controlChannelFailed: "The remote component connection was interrupted. Reconnect.",
				cpolarMissing: "The official cpolar component is not installed. Complete the preparation steps above.",
				cpolarInvalid: "cpolar component verification failed. Remove it completely and reinstall.",
				cpolarConfigMissing: "No cpolar account token is saved. Complete the preparation steps above.",
				cpolarConfigInvalid: "The local cpolar configuration is invalid. Save the account token again.",
				cpolarPortUnavailable: "Could not allocate a local remote-gateway port. Try again.",
				cpolarLaunchFailed: "The cpolar client failed to start.",
				cpolarTimeout: "Timed out connecting to a cpolar node. Reconnect.",
				cpolarStopped: "The cpolar connection stopped.",
				cpolarExited: "The cpolar connection exited unexpectedly. Reconnect.",
				cpolarOutputInvalid: "cpolar returned an unrecognized status.",
				cpolarOriginInvalid: "The public address returned by cpolar failed validation.",
				setupOpened: "The official Tailscale page is open. Return to DSH after enabling Funnel; reconnection is automatic.",
				switchProviderConfirm: "Switching connection method first disables the current remote channel. Local network access and paired devices are unaffected. Continue?",
				switchingCpolar: "Switching to cpolar…",
				switchingTailscale: "Switching to Tailscale Funnel…",
				installConfirm: "Download and verify a fixed version from the official cpolar website (about 7.3 MB) and extract it only to the DSH Mobile private directory? No system service, PATH/registry entry, or startup item is added.",
				downloading: "Downloading and verifying…",
				installingCpolar: "Installing the official cpolar component. Keep DSH running until it completes.",
				installFailed: "Component installation failed: {error}",
				invalidToken: "Paste the complete Authtoken from the cpolar dashboard.",
				configuredConnecting: "Account configuration saved; connecting through cpolar…",
				configureFailed: "Configuration failed: {error}",
				purgeConfirm: "Completely remove the cpolar component, token configuration, and runtime logs from the DSH Mobile private directory? Local network access, DSH data, and other system programs are unaffected.",
				purging: "Stopping the channel and removing cpolar files managed by DSH Mobile…",
				purgeFailed: "Cleanup failed: {error}",
				reconnectingCpolar: "Reconnecting to a cpolar node…",
				reconnectingTailscale: "Checking Tailscale settings and reconnecting…",
				remoteQrReady: "Remote pairing QR code generated. Scan it from “Remote access” in the app.",
				resetCpolarConfirm: "Disable the cpolar remote channel and remove all remote paired devices? Your cpolar account and other tunnels are unchanged.",
				resetTailscaleConfirm: "Sign out of Tailscale on this computer and remove all remote paired devices? Local network configuration is unchanged.",
				requestFailed: "Request failed: {error}",
				wsPathsTitle: "Third-party WebSocket paths",
				wsPathsIntro: "When an installed plugin cannot connect (say a sidebar terminal or a live panel), it is usually because its connection paths have not been approved yet. Everything that needs your attention is listed below — one click on “Allow” fixes it.",
				wsPathsPlaceholder: "/sidebar/ws/terminal",
				wsPathsAdd: "Allow path",
				wsPathsRemove: "Remove",
				wsPathsEmpty: "Nothing to configure right now. If a plugin cannot connect later, one-click options appear here.",
				wsPathsInvalid: "Enter an exact path starting with / (no query string).",
				wsPathsDetected: "A plugin connection was blocked — press Allow to let it through",
				wsPathsAllow: "Allow",
				wsPathsAllowAll: "Allow all",
				wsPathsGroupMeta: "{n} paths · blocked {m} times",
				wsPathsNewBlocked: "New blocked third-party connections — open diagnostics to review",
				wsPathsAdvancedToggle: "Add paths manually (advanced)",
				wsPathsAnnounce: "{n} plugin connections waiting to be approved",
				wsPathsAdvancedHint: "Manual entries are rarely necessary: use the buttons above. Only fill this in when you know the exact path."
			},
			it: {
				mobileAccess: "Accesso mobile",
				collapseMobileAccess: "Riduci Accesso mobile",
				downloadAndroid: "Scarica l’app Android di test",
				downloadAndroidVersion: "Scarica l’app Android di test · v{version}",
				downloadAndroidAria: "Scarica l’app Android di test da GitHub Releases",
				downloadAndroidVersionAria: "Scarica l’app Android di test del progetto v{version}",
				updatePlugin: "Aggiorna plugin",
				updatePluginAria: "Aggiorna DSH Mobile alla v{version}",
				updatingPlugin: "Aggiornamento…",
				pluginUpdatedRestart: "Aggiornato alla v{version}. Riavvia DSH per applicarlo.",
				pluginUpdateFailed: "Aggiornamento non riuscito: {error}",
				updateTo: "Aggiorna alla v{version}",
				updateNotice: "Riavvia DSH dopo l’installazione. Le app esistenti e i dispositivi già associati non richiedono ri-associazione; in caso di dubbi sulla versione desktop, consulta la tabella di compatibilità nel README.",
				updateNotesEmpty: "Note di rilascio non recuperate — l’aggiornamento resta possibile; dettagli nella pagina Release su GitHub.",
				updateNow: "Aggiorna ora",
				updateLater: "Non ora",
				lan: "Rete locale",
				remote: "Remoto",
				lanAccess: "Accesso rete locale",
				remoteAccess: "Accesso remoto",
				browserAccess: "Accesso browser",
				remoteAddress: "Indirizzo remoto",
				loadingStatus: "Lettura stato…",
				loadingRemoteStatus: "Lettura stato remoto…",
				generateCopyKey: "Genera e copia chiave",
				copyPairLink: "Copia link di abbinamento",
				managePairedDevices: "Gestisci dispositivi abbinati",
				clearAllDevices: "Rimuovi tutti i dispositivi",
				pairingQr: "Codice QR di abbinamento",
				remoteIntro: "Scegli il canale remoto più adatto. Cambiare o disattivare l’accesso remoto non influisce sulla rete locale.",
				httpFrameWarning: "Le pagine HTTP possono essere incorporate per compatibilità, ma i contenuti non sono cifrati e possono essere alterati. Usa HTTPS per le attività sensibili.",
				chooseProvider: "Scegli metodo di connessione",
				currentProvider: "Connessione attuale",
				remoteStateOff: "Disattivata",
				remoteStateConnecting: "Connessione",
				remoteStateAttention: "Da controllare",
				providerInfoAria: "Informazioni su sicurezza e rete della connessione remota",
				providerGroupAria: "Metodo di connessione remota",
				providerSafeTitle: "La protezione resta attiva",
				providerSafeText: "Solo i dispositivi abbinati possono accedere a DSH. cpolar viene installato su richiesta e può essere rimosso completamente; Tailscale può essere lento o non disponibile nelle reti della Cina continentale, dove è consigliato cpolar.",
				builtIn: "Integrato",
				mainlandPreferred: "Preferito in Cina continentale",
				tailscaleDescription: "Copertura più ampia; le reti della Cina continentale possono essere instabili. Il primo collegamento richiede accesso e autorizzazione Funnel.",
				cpolarDescription: "Installa su richiesta il componente ufficiale, adatto alle reti della Cina continentale.",
				prepareCpolar: "Prepara cpolar",
				checkingComponent: "Controllo componente…",
				installOfficial: "Installa componente ufficiale",
				cpolarAccountNote: "Accedi al sito cpolar e copia l’Authtoken. Il token resta solo nella directory privata del plugin e non viene mostrato nella pagina o nei log.",
				registerCpolar: "Registrati su cpolar",
				openDashboard: "Apri la dashboard per il token",
				tokenPlaceholder: "Incolla Authtoken cpolar",
				saveConnect: "Salva e connetti",
				saving: "Salvataggio…",
				componentDetails: "Origine e rimozione del componente",
				componentDetailsText: "Viene scaricato dal sito ufficiale cpolar e verificato a una versione fissa solo dopo aver scelto Installa. Non aggiunge servizi di sistema, avvio automatico, voci di registro o PATH.",
				pluginPrivateDirectory: "Directory privata del plugin",
				officialDownload: "Pagina download ufficiale",
				terms: "Termini di servizio",
				purgeCpolar: "Rimuovi completamente componente e configurazione cpolar",
				tailscaleHelp: "Guida a Tailscale",
				tailscaleHelpText: "Il componente runtime è incluso nel plugin. Il primo collegamento apre le pagine ufficiali di accesso Tailscale e autorizzazione Funnel; il plugin non accede mai alla password.",
				funnelGuideAria: "Passaggi per abilitare Tailscale Funnel",
				funnelGuideTitle: "Configurazione accesso remoto · Passaggio 2",
				funnelGuideSummary: "L’accesso Tailscale è completato. Devi ancora consentire Funnel per questo computer; la pagina ufficiale abilita anche HTTPS.",
				funnelStep1: "Apri la pagina ufficiale di autorizzazione Tailscale per questo nodo.",
				funnelStep2: "Conferma Funnel; non serve accedere di nuovo a DSH.",
				funnelStep3: "Torna in DSH; il plugin controlla e si connette automaticamente.",
				funnelGuideNote: "Richiede un account Owner, Admin o Network admin.",
				continueFunnel: "Continua autorizzazione Funnel",
				retryNow: "Fatto, riprova ora",
				enableRemote: "Attiva accesso remoto",
				disableRemote: "Disattiva accesso remoto",
				continueLogin: "Continua accesso",
				reconnect: "Riconnetti",
				generateRemoteQr: "Genera QR di abbinamento remoto",
				copyRemoteLink: "Copia link di abbinamento remoto",
				manageRemoteDevices: "Gestisci dispositivi remoti",
				resetRemoteLogin: "Esci e rimuovi accesso remoto",
				resetRemoteDevices: "Disattiva e rimuovi dispositivi remoti",
				lanOn: "Accesso dalla rete locale attivo.",
				lanOff: "Accesso dalla rete locale disattivato.",
				enableLan: "Attiva accesso rete locale",
				disableLan: "Disattiva accesso rete locale",
				extensionsLoaded: "Estensioni: {loaded} caricate",
				extensionsFailed: "Estensioni: {loaded} caricate, {failed} non riuscite",
				keyGenerationFailed: "Impossibile generare la chiave di abbinamento.",
				keyCopied: "Chiave di abbinamento copiata. Incollala nell’app Android.",
				linkCopied: "Link di abbinamento copiato. Invialo al telefono e incollalo nell’app oppure aprilo nel browser.",
				copySecret: "Copia {kind}: {value}",
				pairingKey: "chiave di abbinamento",
				pairingLink: "link di abbinamento",
				noDevices: "Nessun dispositivo abbinato.",
				noRemoteDevices: "Nessun dispositivo remoto abbinato.",
				device: "Dispositivo",
				expires: "Scade {time}",
				revoke: "Revoca",
				confirmResetDevices: "Rimuovere tutti i dispositivi abbinati? I dispositivi connessi verranno disconnessi subito.",
				ready: "Pronto",
				installed: "Installato",
				installWithSize: "Installa componente ufficiale · {size} MB",
				cpolarUnsupported: "Attualmente sono supportati Windows x64 e Linux x64/arm64.",
				cpolarNotInstalled: "Non installato. Una versione fissa viene scaricata dal sito ufficiale cpolar solo dopo aver premuto il pulsante.",
				cpolarNeedsToken: "Componente ufficiale {version} verificato. Salva il token account per continuare.",
				cpolarReady: "Componente ufficiale {version} e configurazione account locale pronti. Gli indirizzi temporanei gratuiti possono cambiare dopo il riavvio di DSH o cpolar; se l’app non si connette, scansiona di nuovo il QR remoto corrente.",
				remoteOff: "Accesso remoto disattivato. La rete locale non è interessata.",
				remoteUnavailableCpolar: "cpolar non è installato o l’account locale non è configurato.",
				remoteUnavailableTailscale: "Su questo computer manca il componente runtime Funnel. Reinstalla il pacchetto completo del plugin.",
				remoteStartingCpolar: "Connessione a un nodo cpolar…",
				remoteStartingTailscale: "Avvio del canale sicuro Tailscale…",
				remoteNeedsLogin: "Completa una volta l’accesso Tailscale nel browser. Il plugin non legge mai la password.",
				remoteConnectingCpolar: "Indirizzo pubblico assegnato; avvio del gateway di autenticazione DSH…",
				remoteConnectingTailscale: "Accesso completato; creazione dell’indirizzo HTTPS pubblico…",
				remoteReady: "Accesso remoto pronto. Solo i dispositivi abbinati possono accedere a DSH.",
				remoteError: "Connessione remota non stabilita. Riconnettiti; la rete locale continua a funzionare.",
				funnelPermission: "Accesso completato. Autorizza Funnel per stabilire automaticamente la connessione remota.",
				funnelHttps: "Accesso completato. Autorizza Funnel; la pagina ufficiale abilita anche HTTPS.",
				funnelStart: "Accesso completato. Termina la prima autorizzazione Tailscale Funnel.",
				tailscaleDnsMissing: "Tailscale non ha fornito un indirizzo remoto. Riconnettiti e verifica di aver completato l’accesso.",
				gatewayStartFailed: "Avvio del gateway remoto non riuscito. Riconnettiti; la rete locale non è interessata.",
				controlChannelFailed: "Connessione al componente remoto interrotta. Riconnettiti.",
				cpolarMissing: "Il componente ufficiale cpolar non è installato. Completa i passaggi sopra.",
				cpolarInvalid: "Verifica del componente cpolar non riuscita. Rimuovilo completamente e reinstallalo.",
				cpolarConfigMissing: "Nessun token account cpolar salvato. Completa i passaggi sopra.",
				cpolarConfigInvalid: "Configurazione locale cpolar non valida. Salva nuovamente il token.",
				cpolarPortUnavailable: "Impossibile assegnare una porta locale al gateway remoto. Riprova.",
				cpolarLaunchFailed: "Avvio del client cpolar non riuscito.",
				cpolarTimeout: "Connessione al nodo cpolar scaduta. Riconnettiti.",
				cpolarStopped: "Connessione cpolar arrestata.",
				cpolarExited: "Connessione cpolar terminata inaspettatamente. Riconnettiti.",
				cpolarOutputInvalid: "cpolar ha restituito uno stato non riconosciuto.",
				cpolarOriginInvalid: "L’indirizzo pubblico restituito da cpolar non ha superato la verifica.",
				setupOpened: "La pagina ufficiale Tailscale è aperta. Torna in DSH dopo aver abilitato Funnel; la riconnessione è automatica.",
				switchProviderConfirm: "Il cambio di metodo disattiva prima il canale remoto corrente. Rete locale e dispositivi abbinati non sono interessati. Continuare?",
				switchingCpolar: "Passaggio a cpolar…",
				switchingTailscale: "Passaggio a Tailscale Funnel…",
				installConfirm: "Scaricare e verificare una versione fissa dal sito ufficiale cpolar (circa 7,3 MB), estraendola solo nella directory privata DSH Mobile? Non vengono aggiunti servizi, PATH/registro o avvio automatico.",
				downloading: "Download e verifica…",
				installingCpolar: "Installazione del componente ufficiale cpolar. Mantieni DSH in esecuzione fino al termine.",
				installFailed: "Installazione componente non riuscita: {error}",
				invalidToken: "Incolla l’Authtoken completo dalla dashboard cpolar.",
				configuredConnecting: "Configurazione account salvata; connessione tramite cpolar…",
				configureFailed: "Configurazione non riuscita: {error}",
				purgeConfirm: "Rimuovere completamente componente cpolar, configurazione token e log runtime dalla directory privata DSH Mobile? Rete locale, dati DSH e altri programmi non sono interessati.",
				purging: "Arresto del canale e rimozione dei file cpolar gestiti da DSH Mobile…",
				purgeFailed: "Pulizia non riuscita: {error}",
				reconnectingCpolar: "Riconnessione a un nodo cpolar…",
				reconnectingTailscale: "Controllo impostazioni Tailscale e riconnessione…",
				remoteQrReady: "QR di abbinamento remoto generato. Scansionalo da “Accesso remoto” nell’app.",
				resetCpolarConfirm: "Disattivare il canale remoto cpolar e rimuovere tutti i dispositivi remoti? Account cpolar e altri tunnel restano invariati.",
				resetTailscaleConfirm: "Uscire da Tailscale su questo computer e rimuovere tutti i dispositivi remoti? La configurazione della rete locale resta invariata.",
				requestFailed: "Richiesta non riuscita: {error}",
				wsPathsTitle: "Percorsi WebSocket di terze parti",
				wsPathsIntro: "Quando un plugin installato non riesce a connettersi (per esempio un terminale laterale o un pannello live), di solito è perché i suoi percorsi di connessione non sono ancora stati approvati. Tutto ciò che richiede attenzione è elencato qui sotto: un clic su “Consenti” risolve.",
				wsPathsPlaceholder: "/sidebar/ws/terminal",
				wsPathsAdd: "Consenti percorso",
				wsPathsRemove: "Rimuovi",
				wsPathsEmpty: "Non serve configurare nulla per ora. Se in seguito un plugin non riesce a connettersi, qui compariranno opzioni con un clic.",
				wsPathsInvalid: "Inserisci un percorso esatto che inizi con / (senza query).",
				wsPathsDetected: "Una connessione di un plugin è stata bloccata — premi Consenti per lasciarla passare",
				wsPathsAllow: "Consenti",
				wsPathsAllowAll: "Consenti tutti",
				wsPathsGroupMeta: "{n} percorsi · bloccati {m} volte",
				wsPathsNewBlocked: "Nuove connessioni di terze parti bloccate — apri la diagnostica",
				wsPathsAdvancedToggle: "Aggiungi percorsi manualmente (avanzato)",
				wsPathsAnnounce: "{n} connessioni di plugin in attesa di approvazione",
				wsPathsAdvancedHint: "Le voci manuali servono raramente: usa i pulsanti qui sopra. Compila solo se conosci il percorso esatto."
			},
			zh: {}
		};
		for (const locale of [
			"en",
			"it",
			"zh"
		]) Object.assign(MOBILE_CONTROL_MESSAGES[locale], EXTENSION_RECOVERY_MESSAGES[locale]);
		for (const locale of [
			"en",
			"it",
			"zh"
		]) Object.assign(MOBILE_CONTROL_MESSAGES[locale], storageMessages[locale]);
		Object.assign(MOBILE_CONTROL_MESSAGES.zh, {
			mobileAccess: "移动访问",
			collapseMobileAccess: "收起移动访问",
			downloadAndroid: "下载 Android 测试版",
			downloadAndroidVersion: "下载 Android 测试版 · v{version}",
			downloadAndroidAria: "下载本项目的 Android 测试版",
			downloadAndroidVersionAria: "下载本项目的 Android 测试版 v{version}",
			updatePlugin: "更新插件",
			updatePluginAria: "将 DSH Mobile 更新至 v{version}",
			updatingPlugin: "正在更新…",
			pluginUpdatedRestart: "插件已更新至 v{version}，重启 DSH 后生效。",
			pluginUpdateFailed: "更新失败：{error}",
			updateTo: "更新到 v{version}",
			updateNotice: "安装后需重启 DSH。现有 App 与已配对设备无需重新配对；电脑端版本不确定时，先对照 README 兼容表。",
			updateNotesEmpty: "未取到最新版更新说明，请查看本项目更新记录。",
			updateNow: "立即更新",
			updateLater: "暂不",
			lan: "局域网",
			remote: "远程",
			lanAccess: "局域网访问",
			remoteAccess: "远程访问",
			browserAccess: "浏览器访问",
			remoteAddress: "远程地址",
			loadingStatus: "正在读取状态…",
			loadingRemoteStatus: "正在读取远程状态…",
			generateCopyKey: "生成并复制密钥",
			copyPairLink: "复制配对链接",
			managePairedDevices: "管理配对设备",
			clearAllDevices: "清除所有设备",
			pairingQr: "配对二维码",
			remoteIntro: "选择更适合你的远程通道。切换或关闭远程访问不会影响局域网。",
			httpFrameWarning: "为兼容性允许嵌入 HTTP 页面，但内容未加密，可能被篡改；处理敏感内容请使用 HTTPS。",
			chooseProvider: "选择连接方式",
			currentProvider: "当前连接",
			remoteStateOff: "未启用",
			remoteStateConnecting: "连接中",
			remoteStateAttention: "需处理",
			providerInfoAria: "查看远程连接安全与网络说明",
			providerGroupAria: "远程连接方式",
			providerSafeTitle: "你始终可以放心",
			providerSafeText: "只有已配对设备能进入 DSH。cpolar 按需安装并可彻底清理；Tailscale 在中国大陆网络下可能连接缓慢、中断或无法使用，国内网络建议优先尝试 cpolar。",
			builtIn: "内置",
			mainlandPreferred: "国内网络优先",
			tailscaleDescription: "覆盖更广；中国大陆网络可能不稳定，首次需登录并允许 Funnel。",
			cpolarDescription: "按需安装官方组件，适合国内网络环境。",
			prepareCpolar: "准备 cpolar",
			checkingComponent: "正在检查组件…",
			installOfficial: "安装官方组件",
			cpolarAccountNote: "登录 cpolar 官网后复制 Authtoken。令牌只保存在本机插件私有目录，不会显示在页面或日志中。",
			registerCpolar: "注册 cpolar",
			openDashboard: "打开控制台获取令牌",
			tokenPlaceholder: "粘贴 cpolar Authtoken",
			saveConnect: "保存并连接",
			saving: "正在保存…",
			componentDetails: "组件来源与清理说明",
			componentDetailsText: "仅在你点击安装后从 cpolar 官网下载并校验固定版本。不会写入系统服务、开机启动、注册表或 PATH。",
			pluginPrivateDirectory: "插件私有目录",
			officialDownload: "官方下载安装页",
			terms: "服务条款",
			purgeCpolar: "彻底移除 cpolar 组件与配置",
			tailscaleHelp: "Tailscale 使用说明",
			tailscaleHelpText: "运行组件已随插件提供。首次连接会打开 Tailscale 官方登录和 Funnel 授权页；插件不会接触你的账号密码。",
			funnelGuideAria: "Tailscale Funnel 启用步骤",
			funnelGuideTitle: "远程访问设置 · 第 2 步",
			funnelGuideSummary: "Tailscale 登录已完成。还需为这台电脑允许 Funnel，官方页面会同时启用 HTTPS。",
			funnelStep1: "打开当前节点的 Tailscale 官方授权页。",
			funnelStep2: "确认启用 Funnel；无需再次登录 DSH。",
			funnelStep3: "返回 DSH，插件会自动检查并建立连接。",
			funnelGuideNote: "需要使用 Owner、Admin 或 Network admin 账号。",
			continueFunnel: "继续完成 Funnel 授权",
			retryNow: "已完成，立即重试",
			enableRemote: "启用远程访问",
			disableRemote: "关闭远程访问",
			continueLogin: "继续登录",
			reconnect: "重新连接",
			generateRemoteQr: "生成远程配对二维码",
			copyRemoteLink: "复制远程配对链接",
			manageRemoteDevices: "管理远程设备",
			resetRemoteLogin: "退出并清除远程登录",
			resetRemoteDevices: "关闭并清除远程设备",
			lanOn: "局域网访问已开启。",
			lanOff: "局域网访问已关闭。",
			enableLan: "开启局域网访问",
			disableLan: "关闭局域网访问",
			extensionsLoaded: "扩展：{loaded} 个已加载",
			extensionsFailed: "扩展：{loaded} 个已加载，{failed} 个加载失败",
			keyGenerationFailed: "无法生成配对密钥。",
			keyCopied: "配对密钥已复制，请粘贴到 Android App。",
			linkCopied: "配对链接已复制，发给手机后 App 粘贴或浏览器打开即可配对。",
			copySecret: "请复制{kind}：{value}",
			pairingKey: "配对密钥",
			pairingLink: "配对链接",
			noDevices: "暂无配对设备。",
			noRemoteDevices: "暂无远程配对设备。",
			device: "设备",
			expires: "到期 {time}",
			revoke: "撤销",
			confirmResetDevices: "确定要移除所有配对设备吗？此操作会立即终止已连接设备。",
			ready: "已就绪",
			installed: "已安装",
			installWithSize: "安装官方组件 · {size} MB",
			cpolarUnsupported: "当前支持 Windows x64 与 Linux x64/arm64。",
			cpolarNotInstalled: "尚未安装。只有点击下方按钮后，才会从 cpolar 官网下载固定版本。",
			cpolarNeedsToken: "官方组件 {version} 已校验，下一步只需保存账号令牌。",
			cpolarReady: "官方组件 {version} 与本机账号配置已就绪。免费临时地址可能在 DSH 或 cpolar 重启后变化；App 无法连接时，请重新扫描当前远程二维码。",
			remoteOff: "远程访问未启用。局域网访问不受影响。",
			remoteUnavailableCpolar: "cpolar 尚未安装或未完成本机账号配置。",
			remoteUnavailableTailscale: "当前电脑缺少 Funnel 运行组件，请重新安装完整插件包。",
			remoteStartingCpolar: "正在连接 cpolar 国内节点…",
			remoteStartingTailscale: "正在启动 Tailscale 安全通道…",
			remoteNeedsLogin: "需要在浏览器完成一次 Tailscale 登录。插件不会读取你的密码。",
			remoteConnectingCpolar: "公网地址已分配，正在启动 DSH 认证网关…",
			remoteConnectingTailscale: "登录完成，正在建立公开 HTTPS 地址…",
			remoteReady: "远程访问已就绪。只有已配对设备可以进入 DSH。",
			remoteError: "远程连接未建立。可重新连接，局域网访问仍可正常使用。",
			funnelPermission: "登录已完成。请继续授权 Funnel，完成后会自动建立远程连接。",
			funnelHttps: "登录已完成。请继续授权 Funnel，官方页面会同时启用 HTTPS。",
			funnelStart: "登录已完成。请继续完成 Tailscale Funnel 的首次授权。",
			tailscaleDnsMissing: "Tailscale 暂未提供远程地址。请重新连接并确认已完成登录。",
			gatewayStartFailed: "远程网关启动失败。请重新连接，局域网访问不受影响。",
			controlChannelFailed: "远程组件连接中断。请重新连接。",
			cpolarMissing: "cpolar 官方组件尚未安装。请先完成上方准备步骤。",
			cpolarInvalid: "cpolar 组件校验失败。请彻底移除后重新安装。",
			cpolarConfigMissing: "cpolar 尚未保存账号令牌。请先完成上方准备步骤。",
			cpolarConfigInvalid: "cpolar 本机配置无效。请重新保存账号令牌。",
			cpolarPortUnavailable: "无法分配本机远程网关端口，请重试。",
			cpolarLaunchFailed: "cpolar 客户端未能启动。",
			cpolarTimeout: "连接 cpolar 国内节点超时，请重新连接。",
			cpolarStopped: "cpolar 连接已停止。",
			cpolarExited: "cpolar 连接意外退出，请重新连接。",
			cpolarOutputInvalid: "cpolar 返回了无法识别的状态。",
			cpolarOriginInvalid: "cpolar 返回的公网地址未通过校验。",
			setupOpened: "Tailscale 官方页面已打开。完成启用后返回 DSH，这里会自动重新连接。",
			switchProviderConfirm: "切换连接方式会先关闭当前远程通道。局域网和配对设备不会受影响，是否继续？",
			switchingCpolar: "正在切换到 cpolar…",
			switchingTailscale: "正在切换到 Tailscale Funnel…",
			installConfirm: "将从 cpolar 官方网站下载并校验固定版本（约 7.3 MB），仅解压到 DSH Mobile 私有目录。不会安装系统服务、写入 PATH/注册表或设置开机启动。是否继续？",
			downloading: "正在下载并校验…",
			installingCpolar: "正在安装 cpolar 官方组件。完成前请保持 DSH 运行。",
			installFailed: "组件安装失败：{error}",
			invalidToken: "请粘贴 cpolar 控制台提供的完整 Authtoken。",
			configuredConnecting: "账号配置已保存，正在建立 cpolar 远程通道…",
			configureFailed: "配置失败：{error}",
			purgeConfirm: "彻底移除 DSH Mobile 私有目录中的 cpolar 组件、令牌配置和运行日志？不会影响局域网、DSH 数据或系统中的其他程序。",
			purging: "正在关闭通道并清理 DSH Mobile 管理的 cpolar 文件…",
			purgeFailed: "清理失败：{error}",
			reconnectingCpolar: "正在重新连接 cpolar 国内节点…",
			reconnectingTailscale: "正在确认 Tailscale 设置并重新连接…",
			remoteQrReady: "远程配对二维码已生成。请在 App 的“远程访问”中扫描。",
			resetCpolarConfirm: "关闭 cpolar 远程通道并移除所有远程配对设备？不会修改你的 cpolar 账号或其他隧道。",
			resetTailscaleConfirm: "退出电脑上的 Tailscale 登录并移除所有远程配对设备？局域网配置不会改变。",
			requestFailed: "请求失败：{error}",
			wsPathsTitle: "第三方 WebSocket 路径",
			wsPathsIntro: "插件（如侧边栏终端、实时面板）连不上时，通常是它的连接路径还没放行。下面列出需要处理的项，点「允许」即可。",
			wsPathsPlaceholder: "/sidebar/ws/terminal",
			wsPathsAdd: "允许该路径",
			wsPathsRemove: "移除",
			wsPathsEmpty: "目前无需任何设置。以后有插件连不上，会在这里出现可一键放行的选项。",
			wsPathsInvalid: "请输入以 / 开头的确切路径（不带 query）。",
			wsPathsDetected: "有插件连接被拦截——点「允许」放行",
			wsPathsAllow: "允许",
			wsPathsAllowAll: "全部允许",
			wsPathsGroupMeta: "{n} 条路径 · 共拦截 {m} 次",
			wsPathsNewBlocked: "发现被拦截的第三方连接，去诊断页查看",
			wsPathsAdvancedToggle: "手动添加路径（高级）",
			wsPathsAnnounce: "{n} 条插件连接等待放行",
			wsPathsAdvancedHint: "通常不需要手动填写：用上方按钮即可。只有当你确切知道所需路径时才填。"
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.en, {
			trustedNetworksTitle: "Additional trusted networks · Advanced",
			trustedNetworksHelp: "Keep the LAN subnet and explicitly add only networks you control, such as a routed WireGuard subnet. Device pairing and HTTPS are still required. Separate CIDRs with spaces, commas, or newlines.",
			trustedNetworksLabel: "Additional source networks",
			trustedNetworksSave: "Save networks",
			trustedNetworksUnavailable: "Available only with managed LAN setup.",
			trustedNetworksRestart: "Saved. Restart DSH to apply; existing connections are not interrupted now.",
			trustedNetworksWindows: "On Windows, the firewall must also allow these source networks; the default rule allows LocalSubnet only.",
			trustedNetworksFailed: "Could not read this setting. Retry after reopening this section.",
			trustedNetworksInvalid: "Could not save. Enter valid network CIDRs, for example 11.24.0.0/24, and check that DSH can write its private setup file.",
			cpolarDownloadFailed: "Could not download cpolar from its official site. Check this computer’s network or proxy, then retry.",
			caddyUnavailable: "The fixed Caddy component is not published for this candidate. Keep using an existing reverse proxy or another remote provider; unverified downloads will not run.",
			caddyVerified: "Managed HTTPS entry verified for this computer.",
			caddyInstalled: "Caddy component installed; the connection is not yet verified.",
			caddyConnectionFailed: "Managed HTTPS connection was not established. Check the domain, public inbound access, port mapping and DNS credentials.",
			caddyModeChangeConfirm: "Switching this origin mode closes its current connection. Continue?",
			caddyInstallConfirm: "Download and verify the fixed Caddy build into DSH Mobile’s private directory? No system service, PATH or startup item will be installed.",
			caddyInstallFailed: "Caddy was not installed. Check that the fixed artifact is available and verified; do not bypass its checksum.",
			caddyPurgeFailed: "Cleanup was not completed. Stop the managed connection and retry.",
			cpolarDownloadTimeout: "The cpolar download timed out. Check this computer’s network or proxy, then retry.",
			cpolarDownloadHttp: "The official cpolar download returned HTTP {status}. Retry later or check the official download page.",
			cpolarIntegrityFailed: "The cpolar download did not match the pinned build, so it was not installed. Retry later or update DSH Mobile; do not bypass verification.",
			cpolarExtractFailed: "The cpolar download completed, but extraction failed. Check system extraction tools and security software, then retry.",
			cpolarStorageFailed: "Could not write the cpolar component in DSH Mobile’s private directory. Check disk space, permissions, and security software, then retry."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.it, {
			trustedNetworksTitle: "Reti attendibili aggiuntive · Avanzate",
			trustedNetworksHelp: "Mantieni la sottorete LAN e aggiungi solo reti che controlli, come una sottorete WireGuard instradata. Abbinamento e HTTPS restano obbligatori. Separa i CIDR con spazi, virgole o righe nuove.",
			trustedNetworksLabel: "Reti sorgenti aggiuntive",
			trustedNetworksSave: "Salva reti",
			trustedNetworksUnavailable: "Disponibile solo con la configurazione LAN gestita.",
			trustedNetworksRestart: "Salvato. Riavvia DSH per applicare; le connessioni attuali non vengono interrotte.",
			trustedNetworksWindows: "Su Windows anche il firewall deve consentire queste reti sorgenti; la regola predefinita consente solo LocalSubnet.",
			trustedNetworksFailed: "Impossibile leggere questa impostazione. Riapri la sezione e riprova.",
			trustedNetworksInvalid: "Salvataggio non riuscito. Inserisci CIDR validi, ad esempio 11.24.0.0/24, e verifica che DSH possa scrivere il file privato di configurazione.",
			cpolarDownloadFailed: "Impossibile scaricare cpolar dal sito ufficiale. Controlla rete o proxy del computer e riprova.",
			caddyUnavailable: "Il componente Caddy fisso non è pubblicato per questa versione candidata. Usa il tuo proxy o un altro provider; i download non verificati non vengono eseguiti.",
			caddyVerified: "Ingresso HTTPS gestito verificato per questo computer.",
			caddyInstalled: "Componente Caddy installato; connessione non ancora verificata.",
			caddyConnectionFailed: "Connessione HTTPS gestita non stabilita. Controlla dominio, accesso pubblico, porte e credenziali DNS.",
			caddyModeChangeConfirm: "Cambiare modalità origin chiude la connessione attuale. Continuare?",
			caddyInstallConfirm: "Scaricare e verificare Caddy nella directory privata DSH Mobile? Nessun servizio, PATH o avvio automatico viene installato.",
			caddyInstallFailed: "Caddy non installato. Verifica disponibilità e integrità del file fisso; non ignorare il checksum.",
			caddyPurgeFailed: "Pulizia non completata. Arresta la connessione gestita e riprova.",
			cpolarDownloadTimeout: "Download di cpolar scaduto. Controlla rete o proxy del computer e riprova.",
			cpolarDownloadHttp: "Il download ufficiale di cpolar ha restituito HTTP {status}. Riprova più tardi o controlla la pagina ufficiale.",
			cpolarIntegrityFailed: "Il pacchetto cpolar non corrisponde alla versione verificata e non è stato installato. Riprova più tardi o aggiorna DSH Mobile; non aggirare la verifica.",
			cpolarExtractFailed: "Download di cpolar completato, ma estrazione non riuscita. Controlla gli strumenti di estrazione e il software di sicurezza, poi riprova.",
			cpolarStorageFailed: "Impossibile scrivere cpolar nella directory privata di DSH Mobile. Controlla spazio, permessi e software di sicurezza, poi riprova."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.zh, {
			cpolarDownloadFailed: "无法从 cpolar 官网下载组件。请检查这台电脑的网络或代理，然后重试。",
			caddyUnavailable: "本次候选尚未发布固定 Caddy 组件。请继续使用已有反向代理或其他远程方式；不会执行未经校验的下载。",
			caddyVerified: "托管 HTTPS 入口已验证为这台电脑。",
			caddyInstalled: "Caddy 组件已安装，远程连接尚未验证。",
			caddyConnectionFailed: "托管 HTTPS 连接未建立，请检查域名、公网入站、端口映射和 DNS 凭据。",
			caddyModeChangeConfirm: "切换此自有代理模式会关闭它当前的连接，是否继续？",
			caddyInstallConfirm: "从固定来源下载并校验 Caddy 到 DSH Mobile 私有目录？不会安装系统服务、写入 PATH 或设置开机启动。",
			caddyInstallFailed: "Caddy 没有安装成功，请检查固定组件是否可用并通过校验，不要跳过校验。",
			caddyPurgeFailed: "尚未完成清理，请停止受管连接后重试。",
			trustedNetworksTitle: "额外可信网段 · 高级",
			trustedNetworksHelp: "保留当前局域网网段，只追加你可控的网络，例如路由接入的 WireGuard 网段。配对与 HTTPS 校验仍然保留。每行一个 CIDR，也可用空格或逗号分隔。",
			trustedNetworksLabel: "额外允许的来源网段",
			trustedNetworksSave: "保存网段",
			trustedNetworksUnavailable: "仅托管局域网配置支持此设置。",
			trustedNetworksRestart: "已保存，重启 DSH 后生效；不会立即中断当前连接。",
			trustedNetworksWindows: "Windows 防火墙也需要放行这些来源网段；默认规则只允许 LocalSubnet。",
			trustedNetworksFailed: "暂时无法读取设置，请重新打开此区域后重试。",
			trustedNetworksInvalid: "保存失败。请填写有效的网络 CIDR，例如 11.24.0.0/24，并确认 DSH 可写入私有配置文件。",
			cpolarDownloadTimeout: "下载 cpolar 组件超时。请检查这台电脑的网络或代理，然后重试。",
			cpolarDownloadHttp: "cpolar 官网下载返回 HTTP {status}。请稍后重试，或检查官网下载页。",
			cpolarIntegrityFailed: "下载的 cpolar 组件未通过固定版本校验，因此没有安装。请稍后重试或更新 DSH Mobile，不要跳过校验。",
			cpolarExtractFailed: "cpolar 下载完成，但解包失败。请检查系统解压组件和安全软件，然后重试。",
			cpolarStorageFailed: "无法把 cpolar 写入 DSH Mobile 私有目录。请检查磁盘空间、目录权限和安全软件，然后重试。"
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.en, {
			lanSetupTitle: "Finish local network setup",
			lanSetupIntro: "Choose the network shared by this computer and your phone. DSH Mobile creates private certificates only after you confirm.",
			lanSetupNetwork: "Computer network",
			lanSetupChooseNetwork: "Choose a network",
			lanSetupRecommended: "Recommended",
			lanSetupNoNetworks: "No private Wi-Fi or Ethernet address was found. Connect this computer to the local network, then scan again.",
			lanSetupRefresh: "Scan again",
			lanSetupFirewallNote: "Windows may request administrator approval for two inbound rules limited to the local subnet.",
			lanSetupConfigure: "Configure local network",
			lanSetupConfiguring: "Creating private certificates and local network rules…",
			lanSetupRequired: "Local network setup has not been completed. Choose a network above to continue.",
			lanSetupRestart: "Setup complete for {origin}. Restart DSH once to start local network access.",
			lanSetupFailed: "Setup was not completed. Confirm the network selection and approve the Windows prompt, then try again."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.it, {
			lanSetupTitle: "Completa la configurazione della rete locale",
			lanSetupIntro: "Scegli la rete condivisa da questo computer e dal telefono. DSH Mobile crea certificati privati solo dopo la conferma.",
			lanSetupNetwork: "Rete del computer",
			lanSetupChooseNetwork: "Scegli una rete",
			lanSetupRecommended: "Consigliata",
			lanSetupNoNetworks: "Nessun indirizzo Wi-Fi o Ethernet privato trovato. Collega il computer alla rete locale e ripeti la ricerca.",
			lanSetupRefresh: "Cerca di nuovo",
			lanSetupFirewallNote: "Windows può richiedere l’approvazione amministratore per due regole in ingresso limitate alla sottorete locale.",
			lanSetupConfigure: "Configura rete locale",
			lanSetupConfiguring: "Creazione dei certificati privati e delle regole di rete locale…",
			lanSetupRequired: "La configurazione della rete locale non è completa. Scegli una rete qui sopra per continuare.",
			lanSetupRestart: "Configurazione completata per {origin}. Riavvia DSH una volta per attivare l’accesso locale.",
			lanSetupFailed: "Configurazione non completata. Controlla la rete e approva la richiesta di Windows, quindi riprova."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.zh, {
			lanSetupTitle: "完成局域网配置",
			lanSetupIntro: "选择电脑与手机共同使用的网络。确认后才会生成私有证书，不会在安装时自动开放端口。",
			lanSetupNetwork: "电脑当前网络",
			lanSetupChooseNetwork: "请选择网络",
			lanSetupRecommended: "推荐",
			lanSetupNoNetworks: "未找到可用的私有 Wi-Fi 或以太网地址。请先让电脑接入局域网，然后重新扫描。",
			lanSetupRefresh: "重新扫描",
			lanSetupFirewallNote: "Windows 可能请求管理员授权，仅创建两条限本地子网访问的入站规则。",
			lanSetupConfigure: "完成配置",
			lanSetupConfiguring: "正在生成私有证书并配置局域网规则…",
			lanSetupRequired: "尚未完成局域网配置，请选择上方网络继续。",
			lanSetupRestart: "已为 {origin} 完成配置。请重启一次 DSH，局域网访问会自动开启。",
			lanSetupFailed: "配置未完成。请确认网卡选择并允许 Windows 授权提示，然后重试。"
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.en, {
			selfHostedConnections: "Self-hosted connection",
			advanced: "Advanced",
			frpName: "Self-hosted FRP",
			frpDescription: "A restricted FRP channel for this DSH gateway only. You manage the VPS and public address.",
			prepareFrp: "Configure self-hosted FRP",
			frpStep1Title: "1 · Connection details",
			frpStep1Text: "Enter the VPS address, frps control port, shared token, and public HTTPS origin.",
			frpServerAddress: "VPS address",
			frpServerAddressPlaceholder: "frp.example.com",
			frpServerPort: "frps port",
			frpToken: "Shared token",
			frpTokenPlaceholder: "At least 16 characters",
			frpPublicOrigin: "Public HTTPS origin",
			frpPublicOriginPlaceholder: "https://dsh.example.com",
			frpStep2Title: "2 · Prepare the VPS",
			frpStep2Text: "Copy the restricted frps and Caddy template, then apply it on your VPS.",
			copyServerTemplate: "Copy server template",
			templateCopied: "Server template copied. Save frps.toml and the Caddy snippet on the VPS, then add the import line to the Caddyfile.",
			templateCopyFailed: "Could not copy the template. Check the four fields above.",
			vpsDeployText: "Use an existing OpenSSH key or agent. The VPS must be Ubuntu/Debian with systemd; existing Caddy site configuration is never overwritten.",
			vpsDeployChangesTitle: "Automatic deployment will change the following on the VPS (manual template changes nothing by itself):",
			vpsDeployChangePackages: "Install Caddy from its official APT repository, plus a Python venv and Certbot for public-IPv4 certificates.",
			vpsDeployChangeServices: "Create the dsh-mobile system user (only if missing, otherwise kept), the frps config and service, the Caddy snippet plus one import line, and a daily certificate-renewal timer.",
			vpsDeployChangeFirewall: "Open the FRP control port, 80/tcp, and 443/tcp in UFW when it is active; other firewalls are left for you to adjust.",
			vpsDeployChangeManual: "Manual deployment applies the same steps by hand from the copied template; automatic deployment runs them over SSH after you confirm the host keys.",
			vpsSshUser: "SSH user",
			vpsSshPort: "SSH port",
			vpsSshKey: "Private key path (optional)",
			vpsSshKeyPlaceholder: "Uses ssh-agent or ~/.ssh/config when empty",
			vpsDeploy: "Deploy frps + Caddy",
			vpsDeploying: "Deploying to the VPS. Keep DSH running…",
			vpsDeploySuccess: "VPS deployment completed. Start FRP connection to verify the public endpoint.",
			vpsDeployFailed: "VPS deployment failed: {error}",
			vpsDeployNotReady: "Save the FRP settings before deploying the VPS.",
			vpsHostKeyFetching: "Reading the VPS host keys…",
			vpsHostKeyFailed: "Could not read the VPS host keys: {error}",
			vpsDeployConfirmWithKeys: "Deploy DSH Mobile frps and Caddy to this VPS? Only DSH Mobile service/config files and firewall rules will be created. Existing non-empty Caddy configuration will stop the deployment.\n\nThe server presents these host keys. Confirm they match the VPS console before continuing:\n{fingerprints}",
			vpsCopyUninstall: "Copy VPS uninstall script",
			vpsUninstallScriptCopied: "Uninstall script copied. Review it before running with root on the VPS.",
			vpsUninstallScriptFailed: "Could not build the uninstall script: {error}",
			vpsUninstall: "Remove DSH Mobile from the VPS",
			vpsUninstallConfirmWithKeys: "Remove all DSH Mobile services, configs, certificates, and owned firewall rules from this VPS? Your own Caddy content and unrelated rules are kept.\n\nThe server presents these host keys. Confirm they match the VPS console before continuing:\n{fingerprints}",
			vpsUninstalling: "Removing DSH Mobile from the VPS. Keep DSH running…",
			vpsUninstallSuccess: "VPS cleanup completed. The local FRP settings are unchanged.",
			vpsUninstallFailed: "VPS cleanup failed: {error}",
			frpStep3Title: "3 · Prepare this computer",
			frpStep3Text: "Download and verify the pinned official frpc client only when requested.",
			installFrpc: "Install official frpc",
			frpInstallConfirm: "Download and verify official frpc 0.70.1 (about {size} MB), extracting only frpc to the DSH Mobile private directory? No service, PATH entry, or startup item is added.",
			installingFrp: "Installing the official frpc component. Keep DSH running until it completes.",
			frpNotInstalled: "frpc is not installed. Nothing is downloaded until you click Install.",
			frpUnsupported: "This desktop platform is not supported by the managed frpc installer.",
			frpComponentReady: "Official frpc {version} is verified.",
			frpStep4Title: "4 · Verify and connect",
			frpStep4Text: "The plugin starts only its DSH HTTP vhost and verifies the public endpoint belongs to this computer.",
			frpAppRequirement: "Custom remote domains require Android app 0.3.3 or later; local network, cpolar, and Tailscale remain compatible with older supported apps.",
			frpSaveConnect: "Save and verify connection",
			frpSavingConnecting: "Saving the private settings and verifying the complete FRP path…",
			frpConfigurationReady: "Server settings are saved. The token remains only in the plugin private directory.",
			frpConfigurationMissing: "Complete all fields, copy the VPS template, then save and connect.",
			frpInputInvalid: "Check the VPS address, port, HTTPS origin, and token.",
			frpComponentDetails: "FRP source and complete cleanup",
			frpComponentDetailsText: "The pinned client is downloaded from the official fatedier/frp release. DSH Mobile never installs a service or accepts arbitrary FRP configuration.",
			frpOfficialRelease: "Official FRP release",
			purgeFrp: "Remove FRP component and private configuration",
			purgeFrpConfirm: "Stop FRP and remove frpc, the shared token, generated configuration, staging files, and logs owned by DSH Mobile? The VPS is unchanged.",
			purgingFrp: "Stopping FRP and removing files managed by DSH Mobile…",
			switchingFrp: "Switching to self-hosted FRP…",
			reconnectingFrp: "Verifying and reconnecting self-hosted FRP…",
			resetFrpConfirm: "Disable self-hosted FRP and remove all remote paired devices? The saved VPS settings and server are unchanged.",
			remoteUnavailableFrp: "frpc is not installed or the private server settings are incomplete.",
			remoteStartingFrp: "Checking the VPS and preparing the restricted FRP channel…",
			remoteConnectingFrp: "frpc is running; verifying the public HTTPS endpoint…",
			frpMissing: "Install the official frpc component first.",
			frpInvalid: "frpc verification failed. Remove it completely and reinstall.",
			frpConfigMissing: "Save the self-hosted FRP connection details first.",
			frpConfigVerifyFailed: "frpc rejected the generated configuration. Check the server details and token.",
			frpVhostPublic: "The VPS plaintext HTTP vhost is publicly reachable. Bind it to 127.0.0.1 and let Caddy provide HTTPS.",
			frpVhostProbeFailed: "The VPS address could not be checked. Confirm DNS and retry.",
			frpLaunchFailed: "frpc failed to start.",
			frpTimeout: "The public endpoint did not become ready. Check frps, Caddy, DNS, and firewall.",
			frpProxyNameInUse: "The frps already has a proxy with this installation name in use — usually another DSH computer, or a session that has not expired yet. Disable self-hosted FRP on that machine, or remove that proxy on the frps, then retry.",
			frpRemotePortInUse: "Another proxy on the frps already owns this public entry port. Choose a different entry port and retry.",
			frpProxyStartFailed: "The frps refused frpc's proxy registration. Check its allowPorts, the ports already in use, and its log.",
			frpDiscoveryMismatch: "The public domain points to another DSH computer. Check the Caddy and frps mappings.",
			frpDiscoveryInvalid: "The public domain did not return a valid DSH Mobile discovery response.",
			frpStopped: "The FRP connection stopped.",
			frpExited: "frpc exited unexpectedly. Check the VPS configuration and reconnect."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.it, {
			selfHostedConnections: "Connessione autogestita",
			advanced: "Avanzato",
			frpName: "FRP autogestito",
			frpDescription: "Canale FRP limitato al solo gateway DSH. VPS e indirizzo pubblico restano sotto il tuo controllo.",
			prepareFrp: "Configura FRP autogestito",
			frpStep1Title: "1 · Dati di connessione",
			frpStep1Text: "Inserisci indirizzo VPS, porta di controllo frps, token condiviso e origine HTTPS pubblica.",
			frpServerAddress: "Indirizzo VPS",
			frpServerAddressPlaceholder: "frp.example.com",
			frpServerPort: "Porta frps",
			frpToken: "Token condiviso",
			frpTokenPlaceholder: "Almeno 16 caratteri",
			frpPublicOrigin: "Origine HTTPS pubblica",
			frpPublicOriginPlaceholder: "https://dsh.example.com",
			frpStep2Title: "2 · Prepara il VPS",
			frpStep2Text: "Copia il modello limitato per frps e Caddy e applicalo sul VPS.",
			copyServerTemplate: "Copia modello server",
			templateCopied: "Modello server copiato. Salva frps.toml e lo snippet Caddy sul VPS, poi aggiungi la riga import al Caddyfile.",
			templateCopyFailed: "Impossibile copiare il modello. Controlla i quattro campi sopra.",
			vpsDeployText: "Usa una chiave OpenSSH o un agent esistente. Il VPS deve essere Ubuntu/Debian con systemd; una configurazione Caddy non vuota non viene sovrascritta.",
			vpsDeployChangesTitle: "Il deploy automatico modifica quanto segue sul VPS (il modello manuale da solo non cambia nulla):",
			vpsDeployChangePackages: "Installa Caddy dal repository APT ufficiale, più un venv Python e Certbot per i certificati IPv4 pubblici.",
			vpsDeployChangeServices: "Crea l’utente di sistema dsh-mobile (solo se assente, altrimenti mantenuto), la configurazione e il servizio frps, lo snippet Caddy più una riga import, e un timer giornaliero di rinnovo certificati.",
			vpsDeployChangeFirewall: "Apre la porta di controllo FRP, 80/tcp e 443/tcp in UFW quando attivo; gli altri firewall restano a tuo carico.",
			vpsDeployChangeManual: "Il deploy manuale applica gli stessi passi a mano dal modello copiato; quello automatico li esegue via SSH dopo la conferma delle chiavi host.",
			vpsSshUser: "Utente SSH",
			vpsSshPort: "Porta SSH",
			vpsSshKey: "Percorso chiave privata (opzionale)",
			vpsSshKeyPlaceholder: "Usa ssh-agent o ~/.ssh/config se vuoto",
			vpsDeploy: "Installa frps + Caddy",
			vpsDeploying: "Deploy sul VPS in corso. Mantieni DSH attivo…",
			vpsDeploySuccess: "Deploy VPS completato. Avvia FRP per verificare l’endpoint pubblico.",
			vpsDeployFailed: "Deploy VPS fallito: {error}",
			vpsDeployNotReady: "Salva le impostazioni FRP prima del deploy VPS.",
			vpsHostKeyFetching: "Lettura delle chiavi host del VPS…",
			vpsHostKeyFailed: "Impossibile leggere le chiavi host del VPS: {error}",
			vpsDeployConfirmWithKeys: "Installare frps e Caddy DSH Mobile su questo VPS? Verranno creati solo file di servizio/configurazione e regole firewall DSH Mobile. Una configurazione Caddy esistente non vuota interromperà il deploy.\n\nIl server presenta queste chiavi host. Verifica che corrispondano alla console del VPS prima di continuare:\n{fingerprints}",
			vpsCopyUninstall: "Copia script di disinstallazione VPS",
			vpsUninstallScriptCopied: "Script di disinstallazione copiato. Controllalo prima di eseguirlo come root sul VPS.",
			vpsUninstallScriptFailed: "Impossibile creare lo script di disinstallazione: {error}",
			vpsUninstall: "Rimuovi DSH Mobile dal VPS",
			vpsUninstallConfirmWithKeys: "Rimuovere tutti i servizi, le configurazioni, i certificati e le regole firewall di DSH Mobile da questo VPS? I tuoi contenuti Caddy e le altre regole restano invariati.\n\nIl server presenta queste chiavi host. Verifica che corrispondano alla console del VPS prima di continuare:\n{fingerprints}",
			vpsUninstalling: "Rimozione di DSH Mobile dal VPS. Mantieni DSH attivo…",
			vpsUninstallSuccess: "Pulizia VPS completata. Le impostazioni FRP locali restano invariate.",
			vpsUninstallFailed: "Pulizia VPS fallita: {error}",
			frpStep3Title: "3 · Prepara questo computer",
			frpStep3Text: "Scarica e verifica il client frpc ufficiale fissato solo su richiesta.",
			installFrpc: "Installa frpc ufficiale",
			frpInstallConfirm: "Scaricare e verificare frpc ufficiale 0.70.1 (circa {size} MB), estraendo solo frpc nella directory privata DSH Mobile? Non vengono aggiunti servizi, PATH o avvio automatico.",
			installingFrp: "Installazione del componente frpc ufficiale. Mantieni DSH in esecuzione.",
			frpNotInstalled: "frpc non è installato. Non viene scaricato nulla finché non scegli Installa.",
			frpUnsupported: "Questa piattaforma desktop non è supportata dal programma di installazione gestito.",
			frpComponentReady: "frpc ufficiale {version} verificato.",
			frpStep4Title: "4 · Verifica e connetti",
			frpStep4Text: "Il plugin avvia solo il vhost HTTP DSH e verifica che l’endpoint pubblico appartenga a questo computer.",
			frpAppRequirement: "I domini remoti personalizzati richiedono l’app Android 0.3.3 o successiva; rete locale, cpolar e Tailscale restano compatibili con le app precedenti supportate.",
			frpSaveConnect: "Salva e verifica connessione",
			frpSavingConnecting: "Salvataggio privato e verifica del percorso FRP completo…",
			frpConfigurationReady: "Impostazioni server salvate. Il token resta solo nella directory privata del plugin.",
			frpConfigurationMissing: "Completa i campi, copia il modello VPS, quindi salva e connetti.",
			frpInputInvalid: "Controlla indirizzo VPS, porta, origine HTTPS e token.",
			frpComponentDetails: "Origine FRP e rimozione completa",
			frpComponentDetailsText: "Il client fissato viene scaricato dalla release ufficiale fatedier/frp. DSH Mobile non installa servizi e non accetta configurazioni FRP arbitrarie.",
			frpOfficialRelease: "Release FRP ufficiale",
			purgeFrp: "Rimuovi componente FRP e configurazione privata",
			purgeFrpConfirm: "Arrestare FRP e rimuovere frpc, token, configurazione, file temporanei e log gestiti da DSH Mobile? Il VPS non viene modificato.",
			purgingFrp: "Arresto FRP e rimozione dei file gestiti da DSH Mobile…",
			switchingFrp: "Passaggio a FRP autogestito…",
			reconnectingFrp: "Verifica e riconnessione FRP autogestito…",
			resetFrpConfirm: "Disattivare FRP autogestito e rimuovere tutti i dispositivi remoti? Impostazioni VPS e server restano invariati.",
			remoteUnavailableFrp: "frpc non è installato o le impostazioni private sono incomplete.",
			remoteStartingFrp: "Controllo VPS e preparazione del canale FRP limitato…",
			remoteConnectingFrp: "frpc è in esecuzione; verifica dell’endpoint HTTPS pubblico…",
			frpMissing: "Installa prima il componente frpc ufficiale.",
			frpInvalid: "Verifica frpc non riuscita. Rimuovilo e reinstallalo.",
			frpConfigMissing: "Salva prima i dati della connessione FRP.",
			frpConfigVerifyFailed: "frpc ha rifiutato la configurazione generata. Controlla server e token.",
			frpVhostPublic: "Il vhost HTTP in chiaro è raggiungibile pubblicamente. Limitalo a 127.0.0.1 e usa Caddy per HTTPS.",
			frpVhostProbeFailed: "Impossibile controllare il VPS. Verifica il DNS e riprova.",
			frpLaunchFailed: "Avvio di frpc non riuscito.",
			frpTimeout: "Endpoint pubblico non pronto. Controlla frps, Caddy, DNS e firewall.",
			frpProxyNameInUse: "Sul frps è già in uso un proxy con il nome di questa installazione — di solito un altro computer DSH o una sessione non ancora scaduta. Disattiva l’FRP autogestito su quella macchina, oppure rimuovi quel proxy sul frps, e riprova.",
			frpRemotePortInUse: "Un altro proxy sul frps occupa già questa porta di ingresso pubblica. Scegli un’altra porta di ingresso e riprova.",
			frpProxyStartFailed: "Il frps ha rifiutato la registrazione del proxy da parte di frpc. Controlla allowPorts, le porte già in uso e il log del server.",
			frpDiscoveryMismatch: "Il dominio pubblico punta a un altro computer DSH. Controlla Caddy e frps.",
			frpDiscoveryInvalid: "Il dominio pubblico non ha restituito una risposta DSH Mobile valida.",
			frpStopped: "Connessione FRP arrestata.",
			frpExited: "frpc è terminato inaspettatamente. Controlla il VPS e riconnettiti."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.zh, {
			selfHostedConnections: "自建连接",
			advanced: "高级",
			frpName: "自建 FRP",
			frpDescription: "只为当前 DSH 网关建立单用途 FRP 通道，VPS 和公开入口由你掌控。",
			prepareFrp: "配置自建 FRP",
			frpStep1Title: "1 · 连接信息",
			frpStep1Text: "填写中转服务器地址、frps 控制端口、共享 Token 和手机访问地址。没有域名时，可直接使用公网 IPv4。",
			frpServerAddress: "中转服务器地址",
			frpServerAddressPlaceholder: "203.0.113.10",
			frpServerPort: "frps 控制端口",
			frpToken: "共享 Token",
			frpTokenPlaceholder: "已保存时可留空；新建至少 16 个字符",
			frpPublicOrigin: "手机访问地址（HTTPS）",
			frpPublicOriginPlaceholder: "https://203.0.113.10",
			frpStep2Title: "2 · 部署中转服务器",
			frpStep2Text: "推荐通过 SSH 一键部署。需要手动操作时，也可以复制受限的 frps 与 Caddy 配置模板。",
			copyServerTemplate: "复制手动部署模板",
			templateCopied: "服务器模板已复制，请在 VPS 上保存 frps.toml 和 Caddy 片段，并在 Caddyfile 里加一行 import。",
			templateCopyFailed: "无法复制模板，请检查上方连接信息。",
			vpsDeployText: "填写 SSH 登录信息。服务器需为带 systemd 的 Ubuntu/Debian；不会覆盖已有的 Caddy 站点配置。",
			vpsDeployChangesTitle: "自动部署会在 VPS 上做这些改动（只复制手动模板不会改变任何东西）：",
			vpsDeployChangePackages: "从官方 APT 源安装 Caddy，并安装 Python venv 与 Certbot（公网 IP 证书用）。",
			vpsDeployChangeServices: "创建 dsh-mobile 系统用户（如已存在则复用，卸载时保留）、frps 配置与服务、Caddy 片段加一行 import，以及每天自动续证书的定时器。",
			vpsDeployChangeFirewall: "UFW 开启时放行 FRP 控制端口、80/tcp 和 443/tcp；其他防火墙需要你自己放行。",
			vpsDeployChangeManual: "手动部署是照着复制的模板一步步自己操作；自动部署是在你确认主机指纹后通过 SSH 执行同样的步骤。",
			vpsSshUser: "SSH 用户",
			vpsSshPort: "SSH 端口",
			vpsSshKey: "私钥文件路径（可选）",
			vpsSshKeyPlaceholder: "留空则使用 ssh-agent 或 SSH 配置",
			vpsDeploy: "一键部署 frps + Caddy",
			vpsDeploying: "正在部署中转服务器，请保持 DSH 运行…",
			vpsDeploySuccess: "中转服务器部署完成，请继续完成本机组件安装和连接验证。",
			vpsDeployFailed: "VPS 部署失败：{error}",
			vpsDeployNotReady: "请先填写完整的连接信息。",
			vpsHostKeyFetching: "正在读取中转服务器的主机指纹…",
			vpsHostKeyFailed: "读取中转服务器主机指纹失败：{error}",
			vpsDeployConfirmWithKeys: "要在这台 VPS 上部署 DSH Mobile 的 frps 和 Caddy 吗？只会创建 DSH Mobile 自己的服务、配置和防火墙规则；如果已有非空 Caddy 配置，部署会停止并保留原配置。\n\n服务器当前的主机指纹如下，请先到 VPS 控制台核对一致后再继续：\n{fingerprints}",
			vpsCopyUninstall: "复制 VPS 卸载脚本",
			vpsUninstallScriptCopied: "卸载脚本已复制，请审阅后再以 root 身份在 VPS 上执行。",
			vpsUninstallScriptFailed: "生成卸载脚本失败：{error}",
			vpsUninstall: "清理 VPS 上的 DSH Mobile",
			vpsUninstallConfirmWithKeys: "要删除这台 VPS 上的 DSH Mobile 服务、配置、证书和专属防火墙规则吗？你自己的 Caddy 内容和其他规则会保留。\n\n服务器当前的主机指纹如下，请先到 VPS 控制台核对一致后再继续：\n{fingerprints}",
			vpsUninstalling: "正在清理 VPS 上的 DSH Mobile，请保持 DSH 运行…",
			vpsUninstallSuccess: "VPS 清理完成，本机 FRP 设置保持不变。",
			vpsUninstallFailed: "VPS 清理失败：{error}",
			frpStep3Title: "3 · 安装本机组件",
			frpStep3Text: "下载并校验固定版本的官方 frpc，只安装到 DSH Mobile 私有目录。",
			installFrpc: "安装官方 frpc",
			frpInstallConfirm: "从 FRP 官方 Release 下载并校验 frpc 0.70.1（约 {size} MB），只提取 frpc 到 DSH Mobile 私有目录？不会安装服务、写入 PATH 或设置开机启动。",
			installingFrp: "正在安装官方 frpc，完成前请保持 DSH 运行。",
			frpNotInstalled: "frpc 尚未安装；点击下方按钮后才会开始下载。",
			frpUnsupported: "当前桌面平台暂不支持托管安装 frpc。",
			frpComponentReady: "官方 frpc {version} 已安装并通过校验。",
			frpStep4Title: "4 · 启用并验证",
			frpStep4Text: "保存配置、启动受限的 FRP 通道，并确认手机访问地址确实连接到这台电脑。",
			frpAppRequirement: "通过自定义域名或公网 IP 连接，需要 Android App 0.3.3 或更高版本。局域网、cpolar 和 Tailscale 不受影响。",
			frpSaveConnect: "保存配置并验证连接",
			frpSavingConnecting: "正在保存私有配置并验证完整 FRP 链路…",
			frpConfigurationReady: "连接配置已安全保存",
			frpConfigurationMissing: "请按顺序完成连接信息、服务器部署和本机组件安装。",
			frpInputInvalid: "请检查服务器地址、控制端口、手机访问地址和共享 Token。",
			frpComponentDetails: "FRP 来源与彻底清理",
			frpComponentDetailsText: "固定版本客户端来自 fatedier/frp 官方 Release。DSH Mobile 不安装系统服务，也不接受任意 FRP 配置。",
			frpOfficialRelease: "FRP 官方 Release",
			purgeFrp: "彻底移除 FRP 组件与私有配置",
			purgeFrpConfirm: "关闭 FRP 并移除 DSH Mobile 管理的 frpc、共享 Token、生成配置、临时文件和日志？不会修改 VPS。",
			purgingFrp: "正在关闭 FRP 并清理 DSH Mobile 管理的文件…",
			switchingFrp: "正在切换到自建 FRP…",
			reconnectingFrp: "正在验证并重新连接自建 FRP…",
			resetFrpConfirm: "关闭自建 FRP 并移除所有远程配对设备？已保存的 VPS 配置和服务器不会改变。",
			remoteUnavailableFrp: "frpc 尚未安装或私有服务器配置不完整。",
			remoteStartingFrp: "正在检查 VPS 并准备受限 FRP 通道…",
			remoteConnectingFrp: "frpc 已启动，正在验证公网 HTTPS 端点…",
			frpMissing: "请先安装官方 frpc。",
			frpInvalid: "frpc 校验失败，请彻底清理后重新安装。",
			frpConfigMissing: "请先保存自建 FRP 连接信息。",
			frpConfigVerifyFailed: "frpc 拒绝了生成的配置，请检查服务器信息和 Token。",
			frpVhostPublic: "VPS 明文 HTTP vhost 可被公网访问。请将其限制到 127.0.0.1，并由 Caddy 提供 HTTPS。",
			frpVhostProbeFailed: "无法检查 VPS 地址，请确认 DNS 后重试。",
			frpLaunchFailed: "frpc 未能启动。",
			frpTimeout: "公网端点未能就绪，请检查 frps、Caddy、DNS 和防火墙。",
			frpProxyNameInUse: "该 frps 上已有本机安装名对应的 FRP 代理在使用中——通常来自另一台 DSH 电脑，或尚未过期的旧连接。请在那台机器上关闭自建 FRP，或在 frps 上移除该代理后重试。",
			frpRemotePortInUse: "该公网入口端口已被 frps 上的其他代理占用，请改用其他入口端口后重试。",
			frpProxyStartFailed: "frps 拒绝了 frpc 的代理注册，请检查 frps 的 allowPorts、端口占用与服务器日志。",
			frpDiscoveryMismatch: "公开域名连接到了另一台 DSH 电脑，请检查 Caddy 与 frps 映射。",
			frpDiscoveryInvalid: "公开域名没有返回有效的 DSH Mobile 发现信息。",
			frpStopped: "FRP 连接已停止。",
			frpExited: "frpc 意外退出，请检查 VPS 配置后重新连接。"
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.en, {
			requestTimeout: "The operation timed out. Confirm that DSH is still running, then try again.",
			diagnostics: "Diagnostics",
			openDiagnostics: "Open connection diagnostics",
			back: "Back",
			backToMobile: "Back to Mobile access",
			connectionDiagnostics: "Connection diagnostics",
			diagnosticsIntro: "Check versions, gateway, network adapter, firewall, and remote channel. The report is automatically redacted and never reads conversations or credentials.",
			diagnosticsNotRun: "Not checked yet",
			diagnosticsStartHint: "Select the button below to begin.",
			diagnosticsIdleMeta: "Waiting to run · connection status only",
			diagnosticsStart: "Start check",
			diagnosticsCopy: "Copy redacted report",
			diagnosticsAdvanced: "Advanced diagnostic details",
			diagnosticsComplete: "Check complete",
			diagnosticsAttention: "Some items need attention",
			diagnosticsProblem: "Connection problems found",
			diagnosticsCompleteFallback: "The check is complete.",
			diagnosticStatusOk: "OK",
			diagnosticStatusWarning: "Attention",
			diagnosticStatusError: "Problem",
			diagnosticStatusInfo: "Info",
			diagnosticItems: "{count} items",
			diagnosticCheck: "Check",
			diagnosticAction: "Suggested action",
			diagnosticNeedsAction: "Needs action",
			diagnosticDetails: "Check details",
			diagnosticOther: "Other checks",
			diagnosticNoBlockers: "{count} checks · no blocking issues found",
			diagnosticNeedsCount: "{count} checks · {issues} need attention",
			diagnosticsChecking: "Checking…",
			diagnosticsCheckingTitle: "Checking connection",
			diagnosticsCheckingText: "This usually takes a few seconds. The remote channel performs a real reachability test.",
			diagnosticsRunningMeta: "Running · keep DSH online",
			diagnosticsIncomplete: "Check not completed",
			diagnosticsReadFailed: "Could not read diagnostics: {error}",
			diagnosticsUnavailable: "Diagnostics service unavailable · try again later",
			diagnosticsRetry: "Check again",
			diagnosticsCopied: "Redacted report copied. You can paste it directly into an issue.",
			diagnosticsCopyManual: "Clipboard access was denied. Details are expanded for manual copying.",
			diagnosticLabelVersions: "Version compatibility",
			diagnosticLabelNetwork: "Local network adapter",
			diagnosticLabelLan: "Local network gateway",
			diagnosticLabelFirewall: "Windows Firewall",
			diagnosticLabelRemote: "Remote channel",
			diagnosticLabelPhone: "Phone network",
			funnelTimeout: "The Tailscale component timed out while starting. Check the network, then reconnect."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.it, {
			requestTimeout: "Operazione scaduta. Verifica che DSH sia ancora in esecuzione e riprova.",
			diagnostics: "Diagnostica",
			openDiagnostics: "Apri diagnostica connessione",
			back: "Indietro",
			backToMobile: "Torna ad Accesso mobile",
			connectionDiagnostics: "Diagnostica connessione",
			diagnosticsIntro: "Controlla versioni, gateway, scheda di rete, firewall e canale remoto. Il report viene anonimizzato automaticamente e non legge conversazioni o credenziali.",
			diagnosticsNotRun: "Controllo non eseguito",
			diagnosticsStartHint: "Premi il pulsante sotto per iniziare.",
			diagnosticsIdleMeta: "In attesa · solo stato connessione",
			diagnosticsStart: "Avvia controllo",
			diagnosticsCopy: "Copia report anonimizzato",
			diagnosticsAdvanced: "Dettagli diagnostici avanzati",
			diagnosticsComplete: "Controllo completato",
			diagnosticsAttention: "Alcuni elementi richiedono attenzione",
			diagnosticsProblem: "Rilevati problemi di connessione",
			diagnosticsCompleteFallback: "Controllo completato.",
			diagnosticStatusOk: "OK",
			diagnosticStatusWarning: "Attenzione",
			diagnosticStatusError: "Problema",
			diagnosticStatusInfo: "Informazione",
			diagnosticItems: "{count} elementi",
			diagnosticCheck: "Controllo",
			diagnosticAction: "Suggerimento",
			diagnosticNeedsAction: "Da risolvere",
			diagnosticDetails: "Dettagli controllo",
			diagnosticOther: "Altri controlli",
			diagnosticNoBlockers: "{count} controlli · nessun problema bloccante",
			diagnosticNeedsCount: "{count} controlli · {issues} richiedono attenzione",
			diagnosticsChecking: "Controllo…",
			diagnosticsCheckingTitle: "Controllo connessione",
			diagnosticsCheckingText: "Di solito richiede pochi secondi. Il canale remoto esegue un test reale di raggiungibilità.",
			diagnosticsRunningMeta: "In esecuzione · mantieni DSH online",
			diagnosticsIncomplete: "Controllo non completato",
			diagnosticsReadFailed: "Impossibile leggere la diagnostica: {error}",
			diagnosticsUnavailable: "Servizio diagnostico non disponibile · riprova più tardi",
			diagnosticsRetry: "Ripeti controllo",
			diagnosticsCopied: "Report anonimizzato copiato. Puoi incollarlo direttamente in una issue.",
			diagnosticsCopyManual: "Il browser ha negato la copia. I dettagli sono stati aperti per la copia manuale.",
			diagnosticLabelVersions: "Compatibilità versioni",
			diagnosticLabelNetwork: "Scheda rete locale",
			diagnosticLabelLan: "Gateway rete locale",
			diagnosticLabelFirewall: "Windows Firewall",
			diagnosticLabelRemote: "Canale remoto",
			diagnosticLabelPhone: "Rete telefono",
			funnelTimeout: "Avvio del componente Tailscale scaduto. Controlla la rete e riconnettiti."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.zh, {
			requestTimeout: "操作超时，请确认 DSH 仍在运行后重试。",
			diagnostics: "诊断",
			openDiagnostics: "打开连接诊断",
			back: "返回",
			backToMobile: "返回移动访问",
			connectionDiagnostics: "连接诊断",
			diagnosticsIntro: "检查版本、网关、网卡、防火墙和远程通道。报告自动脱敏，不读取对话或凭据。",
			diagnosticsNotRun: "尚未检查",
			diagnosticsStartHint: "点击下方按钮开始。",
			diagnosticsIdleMeta: "等待运行 · 仅收集连接状态",
			diagnosticsStart: "开始检查",
			diagnosticsCopy: "复制脱敏报告",
			diagnosticsAdvanced: "高级诊断详情",
			diagnosticsComplete: "检查完成",
			diagnosticsAttention: "有项目需要留意",
			diagnosticsProblem: "发现连接问题",
			diagnosticsCompleteFallback: "检查已完成。",
			diagnosticStatusOk: "正常",
			diagnosticStatusWarning: "注意",
			diagnosticStatusError: "问题",
			diagnosticStatusInfo: "说明",
			diagnosticItems: "{count} 项",
			diagnosticCheck: "检查项",
			diagnosticAction: "建议",
			diagnosticNeedsAction: "需要处理",
			diagnosticDetails: "检查详情",
			diagnosticOther: "其他检查",
			diagnosticNoBlockers: "{count} 项检查 · 未发现阻断问题",
			diagnosticNeedsCount: "{count} 项检查 · {issues} 项需要处理",
			diagnosticsChecking: "正在检查…",
			diagnosticsCheckingTitle: "正在检查连接",
			diagnosticsCheckingText: "通常几秒内完成。远程通道会执行一次真实可达性测试。",
			diagnosticsRunningMeta: "正在运行 · 请保持 DSH 在线",
			diagnosticsIncomplete: "检查未完成",
			diagnosticsReadFailed: "无法读取诊断结果：{error}",
			diagnosticsUnavailable: "诊断服务暂不可用 · 请稍后重试",
			diagnosticsRetry: "重新检查",
			diagnosticsCopied: "脱敏报告已复制，可直接粘贴到 Issue。",
			diagnosticsCopyManual: "浏览器未允许复制，已展开详情，请手动复制。",
			diagnosticLabelVersions: "版本兼容",
			diagnosticLabelNetwork: "局域网网卡",
			diagnosticLabelLan: "局域网网关",
			diagnosticLabelFirewall: "Windows 防火墙",
			diagnosticLabelRemote: "远程通道",
			diagnosticLabelPhone: "手机网络",
			funnelTimeout: "Tailscale 组件启动超时，请检查网络后重新连接。"
		});
		const LOCALIZED_DIAGNOSTIC_COPY = {
			en: {
				versions: "Installed plugin, DSH, and minimum Android app versions are shown.",
				networkOk: "The configured local network adapter is available.",
				networkError: "The saved local network adapter is unavailable.",
				networkInfo: "A fixed local network configuration is in use.",
				networkAction: "Run dsh-mobile setup again.",
				lanOk: "The local gateway is listening and pairing is available.",
				lanInfo: "Local network access is currently off.",
				lanAction: "Enable local network access when the phone must connect directly.",
				firewallOk: "Local TCP and discovery firewall rules are enabled.",
				firewallWarning: "The complete local network firewall rules were not found.",
				firewallInfo: "The system did not allow the plugin to read firewall status.",
				firewallAction: "Run dsh-mobile setup as administrator and check the firewall rules.",
				remoteOk: "The remote public address passed the reachability check.",
				remoteWarning: "The remote channel needs attention or is still connecting.",
				remoteError: "The remote connection is not currently reachable.",
				remoteInfo: "Remote access is currently off.",
				remoteAction: "Return to Remote access, follow the provider guidance, and reconnect.",
				phone: "The computer cannot determine whether the router isolates the phone.",
				phoneAction: "Confirm the phone and computer use the same network, then disable guest-network or AP isolation.",
				reportTitle: "DSH Mobile diagnostic report",
				generated: "Generated",
				certificateOk: "The FRP entry certificate is valid.",
				certificateExpiring: "The FRP entry certificate expires soon.",
				certificateExpired: "The FRP entry certificate has expired.",
				certificateUnknown: "The FRP entry certificate could not be read.",
				certificateAction: "Reconnect the FRP channel to re-issue the certificate, or follow the attach runbook on the VPS."
			},
			it: {
				versions: "Sono indicate le versioni installate di plugin e DSH e la versione minima dell’app Android.",
				networkOk: "La scheda di rete locale configurata è disponibile.",
				networkError: "La scheda di rete locale salvata non è disponibile.",
				networkInfo: "È in uso una configurazione di rete locale fissa.",
				networkAction: "Esegui di nuovo dsh-mobile setup.",
				lanOk: "Il gateway locale è in ascolto e l’abbinamento è disponibile.",
				lanInfo: "L’accesso dalla rete locale è disattivato.",
				lanAction: "Attiva l’accesso locale quando il telefono deve collegarsi direttamente.",
				firewallOk: "Le regole firewall TCP locale e di rilevamento sono attive.",
				firewallWarning: "Le regole firewall complete per la rete locale non sono state trovate.",
				firewallInfo: "Il sistema non ha consentito al plugin di leggere lo stato del firewall.",
				firewallAction: "Esegui dsh-mobile setup come amministratore e controlla le regole firewall.",
				remoteOk: "L’indirizzo pubblico remoto ha superato il test di raggiungibilità.",
				remoteWarning: "Il canale remoto richiede attenzione o è ancora in connessione.",
				remoteError: "La connessione remota non è al momento raggiungibile.",
				remoteInfo: "L’accesso remoto è disattivato.",
				remoteAction: "Torna ad Accesso remoto, segui le indicazioni del provider e riconnettiti.",
				phone: "Il computer non può stabilire se il router isola il telefono.",
				phoneAction: "Verifica che telefono e computer usino la stessa rete, poi disattiva rete ospiti o isolamento AP.",
				reportTitle: "Report diagnostico DSH Mobile",
				generated: "Generato",
				certificateOk: "Il certificato di ingresso FRP è valido.",
				certificateExpiring: "Il certificato di ingresso FRP scade a breve.",
				certificateExpired: "Il certificato di ingresso FRP è scaduto.",
				certificateUnknown: "Impossibile leggere il certificato di ingresso FRP.",
				certificateAction: "Riconnetti il canale FRP per rigenerare il certificato, oppure segui il runbook attach sul VPS."
			},
			zh: {
				versions: "已显示插件、DSH 和 Android App 最低版本。",
				networkOk: "已配置的局域网网卡可用。",
				networkError: "已保存的局域网网卡不可用。",
				networkInfo: "当前使用固定局域网配置。",
				networkAction: "重新运行 dsh-mobile setup。",
				lanOk: "局域网网关正在监听，配对入口可用。",
				lanInfo: "局域网访问当前未开启。",
				lanAction: "需要手机直连时开启局域网访问。",
				firewallOk: "局域网 TCP 与发现防火墙规则已启用。",
				firewallWarning: "未找到完整的局域网防火墙规则。",
				firewallInfo: "系统未允许插件读取防火墙状态。",
				firewallAction: "以管理员身份运行 dsh-mobile setup 并检查防火墙规则。",
				remoteOk: "远程公网地址已通过可达性检查。",
				remoteWarning: "远程通道需要处理或仍在连接。",
				remoteError: "远程连接当前不可达。",
				remoteInfo: "远程访问当前未开启。",
				remoteAction: "返回远程访问，按提供方提示操作并重新连接。",
				phone: "电脑无法判断路由器是否隔离了手机。",
				phoneAction: "确认手机与电脑使用同一网络，并关闭访客网络或 AP 隔离。",
				reportTitle: "DSH Mobile 诊断报告",
				generated: "生成时间",
				certificateOk: "FRP 入口证书有效。",
				certificateExpiring: "FRP 入口证书即将过期。",
				certificateExpired: "FRP 入口证书已过期。",
				certificateUnknown: "无法读取 FRP 入口证书。",
				certificateAction: "重新连接 FRP 通道即可重新签发证书，或按接入清单在 VPS 侧处理。"
			}
		};
		Object.assign(MOBILE_CONTROL_MESSAGES.en, {
			selfHostedDescription: "Use your own VPS or HTTPS reverse proxy without a public tunnel service.",
			originName: "Own reverse proxy",
			caddyName: "Managed Caddy",
			caddyModePreviewNote: "HTTPS form preview differs from the current connection.",
			originDescription: "Use managed Caddy or your existing HTTPS reverse proxy with DSH Mobile’s private, authenticated backend.",
			prepareOrigin: "Connect your HTTPS reverse proxy",
			originPublicOrigin: "Public HTTPS address",
			originListenHost: "Private listen IPv4",
			originListenPort: "HTTP backend port",
			originAllowedCidrs: "Allowed proxy source CIDRs",
			originHelp: "Same computer: use 127.0.0.1. For a proxy on another LAN device, use this computer’s private IPv4 and allow only the proxy’s direct source IPv4/32. Separate CIDRs with spaces or commas.",
			originWarning: "Keep this HTTP backend private. Never expose or port-forward it to the Internet. Your proxy must terminate HTTPS and preserve the external Host, including its port, and WebSocket upgrades.",
			originSaveStart: "Save and start backend",
			originBackendSaved: "Saved HTTP backend (not running)",
			originBackendListening: "Listening HTTP backend",
			originCopyBackend: "Copy backend address",
			originBackendCopied: "HTTP backend address copied.",
			originPurge: "Clear proxy settings",
			originHttpsTitle: "HTTPS remote access",
			originHttpsMode: "HTTPS handling",
			caddyModeManaged: "Managed Caddy (plugin handles HTTPS and certificates)",
			caddyModeExternal: "I already run my own reverse proxy",
			caddySectionTitle: "Managed Caddy upstream",
			caddyInstall: "Install managed Caddy",
			caddyInstallNote: "Downloaded from the official Caddy custom build (caddy core + Tencent Cloud DNS plugin for DNS-01), verified by checksum, stored in the plugin private directory. No system service, PATH entry, or startup item is added.",
			caddyDomain: "Public domain",
			caddyDnsProvider: "DNS provider (DNS-01)",
			caddySecretId: "Tencent Cloud SecretId",
			caddySecretKey: "Tencent Cloud SecretKey",
			caddyListenPort: "Public HTTPS port",
			caddySaveConnect: "Save and start Caddy",
			caddyPurge: "Remove managed Caddy and settings",
			caddyReady: "Managed Caddy is running; certificates are issued and renewed automatically.",
			originPurgeConfirm: "Stop this private HTTP backend and delete only its reverse-proxy settings? Paired remote devices, LAN access, and other providers are kept.",
			originPurged: "The backend is stopped and its proxy settings are cleared. Paired devices are kept.",
			originSaving: "Saving settings and starting the private backend…",
			originPurging: "Stopping the backend and clearing its settings…",
			originBackendReady: "Backend listening",
			originReady: "The private HTTP backend is listening. Public HTTPS, its certificate, and WebSocket connectivity have NOT been verified. Test the public address from your phone before relying on it.",
			originUnavailable: "Configure the public HTTPS address and private backend first.",
			originStarting: "Starting the private HTTP backend…",
			switchingOrigin: "Switching to your own reverse proxy…",
			reconnectingOrigin: "Restarting the private HTTP backend…",
			resetOriginConfirm: "Stop this backend and reset remote pairing? All paired remote devices must pair again. Reverse-proxy settings and LAN devices are kept.",
			originPublicOriginInvalid: "Enter a public HTTPS origin only, such as https://phone.example.com:8815; no path, query, credentials, or private address.",
			originListenHostInvalid: "Use an explicit loopback or private IPv4 address on this computer, not 0.0.0.0 or a public address.",
			originListenPortInvalid: "Use a whole-number port from 1024 to 65535; lower ports need privileges the plugin does not have.",
			originListenPortReserved: "Port 3443 belongs to the LAN gateway and port 3080 to DSH itself, so both are always taken. Choose another port, such as 3444 or 3445.",
			originAllowedCidrsInvalid: "Allow 1–16 valid loopback/private IPv4 CIDRs with no host bits. For a LAN listener, include the actual proxy source IPv4/32; public ranges are not accepted.",
			originSettingsInvalid: "The reverse-proxy settings are invalid. Check the four fields and save again.",
			originConfigMissing: "Save the reverse-proxy settings before starting the backend.",
			originConfigInvalid: "The saved settings are invalid. Correct and save them again, or clear only these settings.",
			originPortInUse: "The backend port is already in use. Stop the conflicting listener or choose another port. Note that 3443, 3080, and a port already used by a cloudflared tunnel are never free.",
			originAddressUnavailable: "The listen address is not available on this computer. Choose its current private IPv4.",
			originStartFailed: "The private backend could not start. Check its address, port, permissions, and local logs.",
			originConfigTargetInvalid: "The saved proxy settings file is not a regular file. Remove it and save the settings again.",
			originControllerUnavailable: "The reverse-proxy provider is not available in this session. Restart DSH and try again."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.it, {
			selfHostedDescription: "Usa il tuo VPS o reverse proxy HTTPS senza un servizio di tunnel pubblico.",
			originName: "Reverse proxy proprio",
			caddyName: "Caddy gestito",
			caddyModePreviewNote: "L’anteprima del modulo HTTPS differisce dalla connessione attuale.",
			originDescription: "Usa Caddy gestito o il tuo reverse proxy HTTPS con il backend privato autenticato di DSH Mobile.",
			prepareOrigin: "Collega il tuo reverse proxy HTTPS",
			originPublicOrigin: "Indirizzo HTTPS pubblico",
			originListenHost: "IPv4 privato di ascolto",
			originListenPort: "Porta backend HTTP",
			originAllowedCidrs: "CIDR sorgente del proxy consentiti",
			originHelp: "Stesso computer: usa 127.0.0.1. Per un proxy su un altro dispositivo LAN, usa l’IPv4 privato di questo computer e consenti solo l’IPv4 sorgente diretta del proxy con /32. Separa i CIDR con spazi o virgole.",
			originWarning: "Mantieni privato il backend HTTP. Non esporlo né inoltrarne la porta su Internet. Il proxy deve terminare HTTPS e conservare l’Host esterno, inclusa la porta, e gli upgrade WebSocket.",
			originSaveStart: "Salva e avvia backend",
			originBackendSaved: "Backend HTTP salvato (non attivo)",
			originBackendListening: "Backend HTTP in ascolto",
			originCopyBackend: "Copia indirizzo backend",
			originBackendCopied: "Indirizzo backend HTTP copiato.",
			originPurge: "Cancella impostazioni proxy",
			originHttpsTitle: "Accesso remoto HTTPS",
			originHttpsMode: "Gestione HTTPS",
			caddyModeManaged: "Caddy gestito (il plugin gestisce HTTPS e certificati)",
			caddyModeExternal: "Uso già il mio reverse proxy",
			caddySectionTitle: "Upstream Caddy gestito",
			caddyInstall: "Installa Caddy gestito",
			caddyInstallNote: "Scaricato dalla build personalizzata ufficiale di Caddy (core + plugin DNS Tencent Cloud per DNS-01), verificato tramite checksum e conservato nella directory privata del plugin. Non aggiunge servizi di sistema, voci PATH o avvio automatico.",
			caddyDomain: "Dominio pubblico",
			caddyDnsProvider: "Provider DNS (DNS-01)",
			caddySecretId: "SecretId Tencent Cloud",
			caddySecretKey: "SecretKey Tencent Cloud",
			caddyListenPort: "Porta HTTPS pubblica",
			caddySaveConnect: "Salva e avvia Caddy",
			caddyPurge: "Rimuovi Caddy gestito e impostazioni",
			caddyReady: "Caddy gestito in esecuzione; i certificati vengono emessi e rinnovati automaticamente.",
			originPurgeConfirm: "Fermare questo backend HTTP privato ed eliminare solo le sue impostazioni reverse proxy? Dispositivi remoti abbinati, accesso LAN e altri provider vengono conservati.",
			originPurged: "Backend fermato e impostazioni proxy cancellate. I dispositivi abbinati sono conservati.",
			originSaving: "Salvataggio impostazioni e avvio del backend privato…",
			originPurging: "Arresto del backend e cancellazione impostazioni…",
			originBackendReady: "Backend in ascolto",
			originReady: "Il backend HTTP privato è in ascolto. HTTPS pubblico, certificato e connettività WebSocket NON sono stati verificati. Prova l’indirizzo pubblico dal telefono prima di usarlo.",
			originUnavailable: "Configura prima l’indirizzo HTTPS pubblico e il backend privato.",
			originStarting: "Avvio del backend HTTP privato…",
			switchingOrigin: "Passaggio al reverse proxy proprio…",
			reconnectingOrigin: "Riavvio del backend HTTP privato…",
			resetOriginConfirm: "Fermare il backend e reimpostare gli abbinamenti remoti? Tutti i dispositivi remoti dovranno essere abbinati di nuovo. Le impostazioni proxy e i dispositivi LAN vengono conservati.",
			originPublicOriginInvalid: "Inserisci solo un’origine HTTPS pubblica, ad esempio https://phone.example.com:8815, senza percorso, query, credenziali o indirizzo privato.",
			originListenHostInvalid: "Usa un IPv4 loopback o privato esplicito di questo computer, non 0.0.0.0 né un indirizzo pubblico.",
			originListenPortInvalid: "Usa una porta intera da 1024 a 65535; le porte più basse richiedono privilegi che il plugin non ha.",
			originListenPortReserved: "La porta 3443 appartiene al gateway LAN e la 3080 a DSH stesso, quindi sono sempre occupate. Scegli un’altra porta, ad esempio 3444 o 3445.",
			originAllowedCidrsInvalid: "Consenti 1–16 CIDR IPv4 loopback/privati validi senza bit host. Per l’ascolto LAN includi l’IPv4 sorgente reale del proxy con /32; le reti pubbliche non sono ammesse.",
			originSettingsInvalid: "Impostazioni reverse proxy non valide. Controlla i quattro campi e salva di nuovo.",
			originConfigMissing: "Salva le impostazioni reverse proxy prima di avviare il backend.",
			originConfigInvalid: "Impostazioni salvate non valide. Correggile e salvale di nuovo, oppure cancella solo queste impostazioni.",
			originPortInUse: "La porta backend è già occupata. Ferma il processo in conflitto o scegli un’altra porta. 3443, 3080 e una porta già usata da un tunnel cloudflared non sono mai libere.",
			originAddressUnavailable: "L’indirizzo di ascolto non è disponibile su questo computer. Scegli il suo IPv4 privato attuale.",
			originStartFailed: "Impossibile avviare il backend privato. Controlla indirizzo, porta, permessi e log locali.",
			originConfigTargetInvalid: "Il file delle impostazioni proxy salvato non è un file regolare. Rimuovilo e salva di nuovo le impostazioni.",
			originControllerUnavailable: "Il provider reverse proxy non è disponibile in questa sessione. Riavvia DSH e riprova."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.zh, {
			selfHostedDescription: "使用自己的 VPS 或 HTTPS 反向代理，不依赖公共隧道服务。",
			originName: "自有反向代理",
			caddyName: "托管 Caddy",
			caddyModePreviewNote: "HTTPS 表单预览与当前连接不同。",
			originDescription: "使用托管 Caddy 或已有 HTTPS 反向代理，接入 DSH Mobile 带认证的私有后端。",
			prepareOrigin: "接入自有 HTTPS 反向代理",
			originPublicOrigin: "公网 HTTPS 地址",
			originListenHost: "私有监听 IPv4",
			originListenPort: "HTTP 后端端口",
			originAllowedCidrs: "允许的代理来源 CIDR",
			originHelp: "代理与 DSH 同机时用 127.0.0.1；代理在另一台局域网设备上时，填写本机私有 IPv4，并只允许代理实际直连来源 IPv4/32。多个 CIDR 用空格或逗号分隔。",
			originWarning: "HTTP 后端必须留在私网，绝不能直接暴露公网或做公网端口映射。反向代理负责 HTTPS，并须保留外部 Host（含端口）及 WebSocket 升级。",
			originSaveStart: "保存并启动后端",
			originBackendSaved: "已保存的 HTTP 后端（未运行）",
			originBackendListening: "正在监听的 HTTP 后端",
			originCopyBackend: "复制后端地址",
			originBackendCopied: "已复制 HTTP 后端地址。",
			originPurge: "清除代理配置",
			originHttpsTitle: "HTTPS 远程接入",
			originHttpsMode: "HTTPS 接入方式",
			caddyModeManaged: "托管 Caddy（插件负责 HTTPS 与证书）",
			caddyModeExternal: "我已自行配置反向代理",
			caddySectionTitle: "托管 Caddy 上游",
			caddyInstall: "安装托管 Caddy",
			caddyInstallNote: "从 Caddy 官方定制构建下载（caddy 核心 + 腾讯云 DNS 插件，用于 DNS-01），经校验和验证后保存在插件私有目录。不添加系统服务、PATH 条目或开机启动项。",
			caddyDomain: "公网域名",
			caddyDnsProvider: "DNS 提供商（DNS-01）",
			caddySecretId: "腾讯云 SecretId",
			caddySecretKey: "腾讯云 SecretKey",
			caddyListenPort: "公网 HTTPS 端口",
			caddySaveConnect: "保存并启动 Caddy",
			caddyPurge: "移除托管 Caddy 与配置",
			caddyReady: "托管 Caddy 正在运行；证书会自动签发并续期。",
			originPurgeConfirm: "停止此私有 HTTP 后端，并且只删除它的反向代理配置？已配对的远程设备、局域网访问和其他提供方均保留。",
			originPurged: "已停止后端并清除代理配置，已配对设备仍保留。",
			originSaving: "正在保存配置并启动私有后端…",
			originPurging: "正在停止后端并清除配置…",
			originBackendReady: "后端已监听",
			originReady: "私有 HTTP 后端已监听，但尚未验证公网 HTTPS、证书及 WebSocket 连通性。请先用手机测试公网地址，不代表公网连接已成功。",
			originUnavailable: "请先配置公网 HTTPS 地址和私有后端。",
			originStarting: "正在启动私有 HTTP 后端…",
			switchingOrigin: "正在切换到自有反向代理…",
			reconnectingOrigin: "正在重启私有 HTTP 后端…",
			resetOriginConfirm: "停止此后端并重置远程配对？所有已配对的远程设备都需要重新配对；反向代理配置和局域网设备保留。",
			originPublicOriginInvalid: "只填写公网 HTTPS 源地址，例如 https://phone.example.com:8815；不能含路径、查询参数、账号密码或私有地址。",
			originListenHostInvalid: "填写本机明确的回环或私有 IPv4，不能使用 0.0.0.0 或公网地址。",
			originListenPortInvalid: "端口必须是 1024–65535 的整数；更低的端口需要插件没有的特权。",
			originListenPortReserved: "3443 属于局域网网关、3080 属于 DSH 自身，两者始终被占用。请换一个端口，例如 3444 或 3445。",
			originAllowedCidrsInvalid: "填写 1–16 个规范的回环/私有 IPv4 CIDR，不能有主机位；局域网监听时须包含代理实际来源 IPv4/32，不接受公网网段。",
			originSettingsInvalid: "反向代理配置无效，请检查四个字段后重新保存。",
			originConfigMissing: "请先保存反向代理配置，再启动后端。",
			originConfigInvalid: "已保存的配置无效，请修正并重新保存，或仅清除这项配置。",
			originPortInUse: "后端端口已被占用，请停止冲突进程或改用其他端口。3443、3080 以及已被 cloudflared 隧道占用的端口永远不会空闲。",
			originAddressUnavailable: "本机没有这个监听地址，请选择当前本机的私有 IPv4。",
			originStartFailed: "私有后端启动失败，请检查地址、端口、权限和本地日志。",
			originConfigTargetInvalid: "已保存的代理配置文件不是普通文件。请移除后重新保存设置。",
			originControllerUnavailable: "当前会话里反向代理提供方不可用。请重启 DSH 后重试。"
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.en, {
			cloudflaredBadge: "Account optional",
			cloudflaredDescription: "Installs the official cloudflared client on demand. A quick tunnel needs no account and gives a temporary public address; a named tunnel uses a Cloudflare account token and keeps one hostname that survives restarts.",
			prepareCloudflared: "Prepare cloudflared",
			cloudflaredUnsupported: "Windows x64, Linux x64/arm64, and macOS x64/arm64 are supported.",
			cloudflaredNotInstalled: "Not installed. A fixed version is downloaded from the official cloudflared release page only after you click the button below.",
			cloudflaredReady: "Official component {version} is ready.",
			cloudflaredQuickNote: "Quick tunnel: no Cloudflare account is needed, but Cloudflare positions quick tunnels for testing — the address is random, rate-limited, and carries no uptime guarantee. Do not rely on one for access that must stay reachable.",
			cloudflaredNamedNote: "Named tunnel: the hostname above stays the same across restarts and Cloudflare routes it to the local forward port. The connector token is stored only in the DSH Mobile private directory, is handed to cloudflared through its environment rather than the command line, and is never shown again once saved.",
			cloudflaredComponentNote: "Downloaded from the official cloudflared release page and verified at a fixed version only after you choose Install. The client is started with automatic updates disabled. It does not add a system service, startup item, registry entry, or PATH entry.",
			installConfirmCloudflared: "Download and verify cloudflared {size} from the official release page and store it only in the DSH Mobile private directory? No system service, PATH/registry entry, or startup item is added.",
			installingCloudflared: "Installing the official cloudflared component. Keep DSH running until it completes.",
			purgeCloudflared: "Completely remove the cloudflared component",
			purgeCloudflaredConfirm: "Completely remove the cloudflared component and its runtime logs from the DSH Mobile private directory? Local network access, DSH data, and other system programs are unaffected.",
			purgingCloudflared: "Stopping the channel and removing cloudflared files managed by DSH Mobile…",
			switchingCloudflared: "Switching to cloudflared…",
			reconnectingCloudflared: "Reconnecting cloudflared…",
			remoteUnavailableCloudflared: "cloudflared is not installed.",
			remoteStartingCloudflared: "Starting the cloudflared connector…",
			remoteConnectingCloudflared: "Starting the DSH authentication gateway…",
			resetCloudflaredConfirm: "Disable the cloudflared remote channel and remove all remote paired devices? The installed component and the local network configuration are unchanged.",
			cloudflaredMissing: "The official cloudflared component is not installed. Complete the preparation steps above.",
			cloudflaredInvalid: "cloudflared component verification failed. Remove it completely and reinstall.",
			cloudflaredPortUnavailable: "Could not allocate a local remote-gateway port. Try again.",
			cloudflaredLaunchFailed: "The cloudflared client failed to start.",
			cloudflaredTimeout: "Timed out waiting for the tunnel to become reachable. Reconnect.",
			cloudflaredStopped: "The cloudflared connection stopped.",
			cloudflaredExited: "The cloudflared connection exited unexpectedly. Reconnect.",
			cloudflaredOutputInvalid: "cloudflared returned an unrecognized status.",
			cloudflaredOriginInvalid: "The public address returned by cloudflared failed validation.",
			cloudflaredComponentUnsupported: "This build cannot run the cloudflared component.",
			cloudflaredDownloadHashMismatch: "The downloaded cloudflared failed its SHA-256 verification. Retry the install.",
			cloudflaredDownloadSizeMismatch: "The downloaded cloudflared is not the pinned size. Retry the install.",
			cloudflaredDownloadRedirectMissing: "The download page stopped redirecting to the release asset. Retry later, or install from the official page manually.",
			cloudflaredDownloadRedirectInvalid: "The download redirect did not point at a GitHub release asset, so it was refused.",
			cloudflaredDownloadRedirectRejected: "The download redirect was refused by policy. Retry later, or install from the official page manually.",
			cloudflaredExecutableHashMismatch: "The installed cloudflared no longer matches the verified build. Remove it completely and install again.",
			cloudflaredPortReservationFailed: "Could not reserve a local port for the tunnel. Try again.",
			cloudflaredTunnelTargetInvalid: "The saved tunnel configuration is not a regular file. Remove it and save the settings again.",
			cloudflaredTunnelSaving: "Saving the tunnel settings and reconnecting cloudflared…",
			cloudflaredTunnelForgetting: "Removing the saved tunnel token…",
			cloudflaredTunnelTitle: "Tunnel type",
			cloudflaredTunnelQuick: "Quick",
			cloudflaredTunnelNamed: "Named",
			cloudflaredTunnelQuickHint: "No account: cloudflared allocates a random address on every start.",
			cloudflaredTunnelNamedHint: "Uses a Cloudflare account token and keeps one address that survives restarts.",
			cloudflaredTunnelHostname: "Public hostname",
			cloudflaredTunnelHostnamePlaceholder: "dsh.example.com",
			cloudflaredTunnelPort: "Local forward port",
			cloudflaredTunnelToken: "Connector token",
			cloudflaredTunnelTokenPlaceholder: "Paste the tunnel token from the Cloudflare dashboard",
			cloudflaredTunnelTokenSaved: "A token is saved. Leave blank to keep it.",
			cloudflaredTunnelSave: "Save and connect",
			cloudflaredTunnelSaveQuick: "Switch to a quick tunnel",
			cloudflaredTunnelConfigured: "Named tunnel configured: {hostname} reaches this computer on 127.0.0.1:{port}.",
			cloudflaredTunnelMissing: "No named tunnel configured yet.",
			cloudflaredTunnelHint: "In the Cloudflare dashboard create a tunnel, then set its public hostname to http://127.0.0.1:{port}. The token is stored only in the DSH Mobile private directory and is never shown again after saving.",
			cloudflaredTunnelForget: "Remove the saved token",
			cloudflaredTunnelForgetConfirm: "Remove the saved tunnel token, stop the cloudflared channel, and go back to a quick tunnel? Nothing reconnects on its own: switch the channel back on afterwards. The tunnel still exists in your Cloudflare account, and its public hostname is unchanged.",
			cloudflaredTunnelInvalid: "The saved named-tunnel configuration is unreadable; the provider is using a quick tunnel. Save the settings again.",
			cloudflaredTunnelPortUnavailable: "The configured local forward port is unavailable. Cloudflare routes the public hostname to that exact port, so free it or choose another one.",
			cloudflaredTunnelHostnameInvalid: "Enter a public hostname under a domain on this Cloudflare account, for example dsh.example.com.",
			cloudflaredTunnelPortInvalid: "Enter a forward port between 1024 and 65535.",
			cloudflaredTunnelPortReserved: "Port 3443 is reserved for the DSH Mobile LAN gateway and is always occupied. Choose another port, such as 3444 or 3445.",
			cloudflaredTunnelTokenInvalid: "That does not look like a tunnel token. Copy the whole token from the Cloudflare dashboard.",
			cloudflaredTunnelSettingsInvalid: "The tunnel settings were rejected.",
			cloudflaredTunnelConfigMissing: "Enter the token, hostname, and port to use a named tunnel."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.it, {
			cloudflaredBadge: "Account facoltativo",
			cloudflaredDescription: "Installa su richiesta il client cloudflared ufficiale. Il tunnel rapido non richiede account e fornisce un indirizzo pubblico temporaneo; il tunnel con nome usa il token di un account Cloudflare e mantiene un hostname stabile tra i riavvii.",
			prepareCloudflared: "Prepara cloudflared",
			cloudflaredUnsupported: "Sono supportati Windows x64, Linux x64/arm64 e macOS x64/arm64.",
			cloudflaredNotInstalled: "Non installato. Una versione fissa viene scaricata dalla pagina ufficiale di cloudflared solo dopo aver premuto il pulsante.",
			cloudflaredReady: "Componente ufficiale {version} pronto.",
			cloudflaredQuickNote: "Tunnel rapido: non serve un account Cloudflare, ma Cloudflare li considera pensati per i test — l’indirizzo è casuale, soggetto a limiti di frequenza e senza garanzia di disponibilità. Non usarlo per un accesso che deve restare raggiungibile.",
			cloudflaredNamedNote: "Tunnel con nome: l’hostname qui sopra resta lo stesso tra i riavvii e Cloudflare lo instrada verso la porta di inoltro locale. Il token del connettore è salvato solo nella directory privata DSH Mobile, viene passato a cloudflared tramite l’ambiente e non tramite la riga di comando, e dopo il salvataggio non viene più mostrato.",
			cloudflaredComponentNote: "Viene scaricato dalla pagina ufficiale di cloudflared e verificato a una versione fissa solo dopo aver scelto Installa. Il client viene avviato con gli aggiornamenti automatici disattivati. Non aggiunge servizi di sistema, avvio automatico, voci di registro o PATH.",
			installConfirmCloudflared: "Scaricare e verificare cloudflared {size} dalla pagina ufficiale e salvarlo solo nella directory privata DSH Mobile? Non vengono aggiunti servizi, PATH/registro o avvio automatico.",
			installingCloudflared: "Installazione del componente cloudflared ufficiale. Mantieni DSH in esecuzione fino al termine.",
			purgeCloudflared: "Rimuovi completamente il componente cloudflared",
			purgeCloudflaredConfirm: "Rimuovere completamente il componente cloudflared e i log runtime dalla directory privata DSH Mobile? Rete locale, dati DSH e altri programmi non sono interessati.",
			purgingCloudflared: "Arresto del canale e rimozione dei file cloudflared gestiti da DSH Mobile…",
			switchingCloudflared: "Passaggio a cloudflared…",
			reconnectingCloudflared: "Riconnessione di cloudflared…",
			remoteUnavailableCloudflared: "cloudflared non è installato.",
			remoteStartingCloudflared: "Avvio del connettore cloudflared…",
			remoteConnectingCloudflared: "Avvio del gateway di autenticazione DSH…",
			resetCloudflaredConfirm: "Disattivare il canale remoto cloudflared e rimuovere tutti i dispositivi remoti? Il componente installato e la configurazione della rete locale restano invariati.",
			cloudflaredMissing: "Il componente cloudflared ufficiale non è installato. Completa i passaggi sopra.",
			cloudflaredInvalid: "Verifica del componente cloudflared non riuscita. Rimuovilo completamente e reinstallalo.",
			cloudflaredPortUnavailable: "Impossibile assegnare una porta locale al gateway remoto. Riprova.",
			cloudflaredLaunchFailed: "Il client cloudflared non è stato avviato.",
			cloudflaredTimeout: "Timeout in attesa che il tunnel diventi raggiungibile. Riconnettiti.",
			cloudflaredStopped: "La connessione cloudflared è stata arrestata.",
			cloudflaredExited: "La connessione cloudflared è terminata in modo imprevisto. Riconnettiti.",
			cloudflaredOutputInvalid: "cloudflared ha restituito uno stato non riconosciuto.",
			cloudflaredOriginInvalid: "L’indirizzo pubblico restituito da cloudflared non ha superato la verifica.",
			cloudflaredComponentUnsupported: "Questa build non può eseguire il componente cloudflared.",
			cloudflaredDownloadHashMismatch: "Il cloudflared scaricato non ha superato la verifica SHA-256. Riprova l’installazione.",
			cloudflaredDownloadSizeMismatch: "Il cloudflared scaricato non ha la dimensione prevista. Riprova l’installazione.",
			cloudflaredDownloadRedirectMissing: "La pagina di download non reindirizza più all’asset della release. Riprova più tardi o installa manualmente dalla pagina ufficiale.",
			cloudflaredDownloadRedirectInvalid: "Il reindirizzamento di download non puntava a un asset di release GitHub ed è stato rifiutato.",
			cloudflaredDownloadRedirectRejected: "Il reindirizzamento di download è stato rifiutato dalle regole. Riprova più tardi o installa manualmente dalla pagina ufficiale.",
			cloudflaredExecutableHashMismatch: "Il cloudflared installato non corrisponde più alla build verificata. Rimuovilo completamente e reinstalla.",
			cloudflaredPortReservationFailed: "Impossibile riservare una porta locale per il tunnel. Riprova.",
			cloudflaredTunnelTargetInvalid: "La configurazione salvata del tunnel non è un file regolare. Rimuovila e salva di nuovo le impostazioni.",
			cloudflaredTunnelSaving: "Salvataggio delle impostazioni e riconnessione di cloudflared…",
			cloudflaredTunnelForgetting: "Rimozione del token del tunnel salvato…",
			cloudflaredTunnelTitle: "Tipo di tunnel",
			cloudflaredTunnelQuick: "Rapido",
			cloudflaredTunnelNamed: "Con nome",
			cloudflaredTunnelQuickHint: "Senza account: cloudflared assegna un indirizzo casuale a ogni avvio.",
			cloudflaredTunnelNamedHint: "Usa il token di un account Cloudflare e mantiene un indirizzo stabile tra i riavvii.",
			cloudflaredTunnelHostname: "Hostname pubblico",
			cloudflaredTunnelHostnamePlaceholder: "dsh.example.com",
			cloudflaredTunnelPort: "Porta di inoltro locale",
			cloudflaredTunnelToken: "Token del connettore",
			cloudflaredTunnelTokenPlaceholder: "Incolla il token del tunnel dalla dashboard Cloudflare",
			cloudflaredTunnelTokenSaved: "Un token è salvato. Lascia vuoto per mantenerlo.",
			cloudflaredTunnelSave: "Salva e connetti",
			cloudflaredTunnelSaveQuick: "Passa a un tunnel rapido",
			cloudflaredTunnelConfigured: "Tunnel con nome configurato: {hostname} raggiunge questo computer su 127.0.0.1:{port}.",
			cloudflaredTunnelMissing: "Nessun tunnel con nome configurato.",
			cloudflaredTunnelHint: "Nella dashboard Cloudflare crea un tunnel e imposta il suo hostname pubblico su http://127.0.0.1:{port}. Il token è salvato solo nella directory privata DSH Mobile e non viene più mostrato dopo il salvataggio.",
			cloudflaredTunnelForget: "Rimuovi il token salvato",
			cloudflaredTunnelForgetConfirm: "Rimuovere il token salvato, arrestare il canale cloudflared e tornare a un tunnel rapido? Nulla si riconnette da solo: riattiva il canale in seguito. Il tunnel resta nel tuo account Cloudflare e il suo hostname pubblico non cambia.",
			cloudflaredTunnelInvalid: "La configurazione salvata del tunnel con nome non è leggibile; il provider usa un tunnel rapido. Salva di nuovo le impostazioni.",
			cloudflaredTunnelPortUnavailable: "La porta di inoltro locale configurata non è disponibile. Cloudflare instrada l’hostname pubblico esattamente su quella porta: liberala o scegline un’altra.",
			cloudflaredTunnelHostnameInvalid: "Inserisci un hostname pubblico sotto un dominio di questo account Cloudflare, ad esempio dsh.example.com.",
			cloudflaredTunnelPortInvalid: "Inserisci una porta di inoltro tra 1024 e 65535.",
			cloudflaredTunnelPortReserved: "La porta 3443 è riservata al gateway LAN di DSH Mobile ed è sempre occupata. Scegli un’altra porta, ad esempio 3444 o 3445.",
			cloudflaredTunnelTokenInvalid: "Non sembra un token di tunnel. Copia il token completo dalla dashboard Cloudflare.",
			cloudflaredTunnelSettingsInvalid: "Le impostazioni del tunnel sono state rifiutate.",
			cloudflaredTunnelConfigMissing: "Inserisci token, hostname e porta per usare un tunnel con nome."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.zh, {
			cloudflaredBadge: "账号可选",
			cloudflaredDescription: "按需安装官方 cloudflared 客户端。快速隧道无需账号，提供临时公网地址；命名隧道使用 Cloudflare 账号令牌，地址固定、重启不变。",
			prepareCloudflared: "准备 cloudflared",
			cloudflaredUnsupported: "支持 Windows x64、Linux x64/arm64 与 macOS x64/arm64。",
			cloudflaredNotInstalled: "尚未安装。只有点击下方按钮后，才会从 cloudflared 官方发布页下载固定版本。",
			cloudflaredReady: "官方组件 {version} 已就绪。",
			cloudflaredQuickNote: "快速隧道：无需 Cloudflare 账号，但官方定位是测试用途 —— 地址随机、有限流、无可用性保证。请勿用于必须长期可达的访问。",
			cloudflaredNamedNote: "命名隧道：上面的公网域名重启后不变，由 Cloudflare 转发到本机转发端口。连接器令牌只保存在 DSH Mobile 私有目录，经环境变量而非命令行传给 cloudflared，保存后不再显示。",
			cloudflaredComponentNote: "仅在你点击安装后从 cloudflared 官方发布页下载并校验固定版本，且启动时关闭自动更新。不会写入系统服务、开机启动、注册表或 PATH。",
			installConfirmCloudflared: "将从 cloudflared 官方发布页下载并校验固定版本（{size}），仅保存到 DSH Mobile 私有目录。不会安装系统服务、写入 PATH/注册表或设置开机启动。是否继续？",
			installingCloudflared: "正在安装 cloudflared 官方组件。完成前请保持 DSH 运行。",
			purgeCloudflared: "彻底移除 cloudflared 组件",
			purgeCloudflaredConfirm: "彻底移除 DSH Mobile 私有目录中的 cloudflared 组件和运行日志？不会影响局域网、DSH 数据或系统中的其他程序。",
			purgingCloudflared: "正在关闭通道并清理 DSH Mobile 管理的 cloudflared 文件…",
			switchingCloudflared: "正在切换到 cloudflared…",
			reconnectingCloudflared: "正在重连 cloudflared…",
			remoteUnavailableCloudflared: "cloudflared 尚未安装。",
			remoteStartingCloudflared: "正在启动 cloudflared 连接器…",
			remoteConnectingCloudflared: "正在启动 DSH 认证网关…",
			resetCloudflaredConfirm: "关闭 cloudflared 远程通道并移除所有远程配对设备？已安装组件与局域网配置保持不变。",
			cloudflaredMissing: "cloudflared 官方组件尚未安装。请先完成上方准备步骤。",
			cloudflaredInvalid: "cloudflared 组件校验失败。请彻底移除后重新安装。",
			cloudflaredPortUnavailable: "无法分配本机远程网关端口，请重试。",
			cloudflaredLaunchFailed: "cloudflared 客户端未能启动。",
			cloudflaredTimeout: "等待隧道可用超时，请重新连接。",
			cloudflaredStopped: "cloudflared 连接已停止。",
			cloudflaredExited: "cloudflared 连接意外退出，请重新连接。",
			cloudflaredOutputInvalid: "cloudflared 返回了无法识别的状态。",
			cloudflaredOriginInvalid: "cloudflared 返回的公网地址未通过校验。",
			cloudflaredComponentUnsupported: "当前构建无法运行 cloudflared 组件。",
			cloudflaredDownloadHashMismatch: "下载的 cloudflared 未通过 SHA-256 校验。请重新安装。",
			cloudflaredDownloadSizeMismatch: "下载的 cloudflared 体积与固定版本不符。请重新安装。",
			cloudflaredDownloadRedirectMissing: "下载页不再跳转到发布资源。请稍后重试，或按官方页面手动安装。",
			cloudflaredDownloadRedirectInvalid: "下载跳转的目标不是 GitHub 发布资源，已被拒绝。",
			cloudflaredDownloadRedirectRejected: "下载跳转未通过校验规则。请稍后重试，或按官方页面手动安装。",
			cloudflaredExecutableHashMismatch: "已安装的 cloudflared 与校验过的版本不一致。请彻底移除后重新安装。",
			cloudflaredPortReservationFailed: "无法为隧道预留本机端口，请重试。",
			cloudflaredTunnelTargetInvalid: "已保存的隧道配置不是普通文件。请移除后重新保存设置。",
			cloudflaredTunnelSaving: "正在保存隧道设置并重新连接 cloudflared…",
			cloudflaredTunnelForgetting: "正在移除已保存的隧道令牌…",
			cloudflaredTunnelTitle: "隧道类型",
			cloudflaredTunnelQuick: "快速隧道",
			cloudflaredTunnelNamed: "命名隧道",
			cloudflaredTunnelQuickHint: "无需账号：每次启动由 cloudflared 随机分配地址。",
			cloudflaredTunnelNamedHint: "使用 Cloudflare 账号令牌，地址固定，重启后仍然有效。",
			cloudflaredTunnelHostname: "公网域名",
			cloudflaredTunnelHostnamePlaceholder: "dsh.example.com",
			cloudflaredTunnelPort: "本机转发端口",
			cloudflaredTunnelToken: "连接器令牌",
			cloudflaredTunnelTokenPlaceholder: "粘贴 Cloudflare 控制台里的隧道令牌",
			cloudflaredTunnelTokenSaved: "已保存令牌，留空表示不更改。",
			cloudflaredTunnelSave: "保存并连接",
			cloudflaredTunnelSaveQuick: "切换到快速隧道",
			cloudflaredTunnelConfigured: "命名隧道已配置：{hostname} 将转发到本机 127.0.0.1:{port}。",
			cloudflaredTunnelMissing: "尚未配置命名隧道。",
			cloudflaredTunnelHint: "先在 Cloudflare 控制台创建隧道，并把它的公开主机名指向 http://127.0.0.1:{port}。令牌只保存在 DSH Mobile 私有目录，保存后不会再显示。",
			cloudflaredTunnelForget: "移除已保存的令牌",
			cloudflaredTunnelForgetConfirm: "移除已保存的隧道令牌、停止 cloudflared 通道并改回快速隧道？不会自动重连，之后需要手动重新打开开关。Cloudflare 账号里的隧道本身仍在，公开主机名也不会改变。",
			cloudflaredTunnelInvalid: "已保存的命名隧道配置无法读取，当前按快速隧道运行。请重新保存设置。",
			cloudflaredTunnelPortUnavailable: "配置的本机转发端口不可用。Cloudflare 把公开主机名固定转发到该端口，请释放它或换一个端口。",
			cloudflaredTunnelHostnameInvalid: "请填写本 Cloudflare 账号下某个域名的公开主机名，例如 dsh.example.com。",
			cloudflaredTunnelPortInvalid: "请填写 1024 到 65535 之间的转发端口。",
			cloudflaredTunnelPortReserved: "3443 已留给 DSH Mobile 局域网网关，且始终被占用。请换一个端口，例如 3444 或 3445。",
			cloudflaredTunnelTokenInvalid: "这不像是一个隧道令牌。请从 Cloudflare 控制台完整复制令牌。",
			cloudflaredTunnelSettingsInvalid: "隧道设置未通过校验。",
			cloudflaredTunnelConfigMissing: "使用命名隧道需要同时填写令牌、公网域名和端口。"
		});
		const DIAGNOSTIC_REASON_MESSAGES = {
			en: {
				"lan-setup-required": ["Local network setup has not been completed.", "Return to Local network and choose a network to finish setup."],
				"versions-current": ["Installed plugin, DSH, and minimum Android app versions are shown.", ""],
				"network-unavailable": ["The saved local network adapter is unavailable.", "Run dsh-mobile setup again."],
				"network-interface": ["Using network interface {interfaceName}.", ""],
				"network-fixed": ["A fixed local network configuration is in use.", ""],
				"lan-ready": ["The local gateway is listening at {endpointSuffix}; pairing is available.", ""],
				"lan-off": ["Local network access is currently off.", "Enable local network access when the phone must connect directly."],
				"firewall-ready": ["Local TCP and discovery firewall rules are enabled.", ""],
				"firewall-missing": ["The complete local network firewall rules were not found.", "Run dsh-mobile setup as administrator and check the firewall rules."],
				"firewall-unknown": ["The system did not allow the plugin to read firewall status.", "If the phone cannot find this computer, run setup as administrator."],
				"remote-off": ["Remote access through {provider} is currently off.", ""],
				"remote-origin-ready": ["The private HTTP backend is listening; public HTTPS is not verified.", "Verify your reverse proxy, public certificate, external Host including port, and WebSocket access from your phone. Keep the HTTP backend private."],
				"remote-ready": ["{provider} endpoint {endpointSuffix} is reachable in about {latencyMs} ms.", ""],
				"remote-ready-via-proxy": ["The computer reached {provider} endpoint {endpointSuffix} through its configured proxy in about {latencyMs} ms; phone reachability is not verified.", "Test the connection from the phone’s network."],
				"remote-rate-limited": ["{provider} endpoint {endpointSuffix} is reachable, but this check observed rate limiting.", "Try again later; older sessions load on demand to reduce traffic."],
				"remote-rate-limited-via-proxy": ["The computer reached {provider} endpoint {endpointSuffix} through its proxy, but the service rate-limited this check; phone reachability is not verified.", "Try again later and test from the phone’s network."],
				"remote-fake-ip": ["The Tailscale address is intercepted by the current VPN or DNS proxy, so TLS was not established.", "Switch VPN node or proxy mode; if it still fails, use cpolar."],
				"remote-unreachable": ["{provider} reports ready, but endpoint {endpointSuffix} is not reachable.", "Reconnect, then check the provider status if it still fails."],
				"remote-needs-login": ["Tailscale is waiting for login to finish.", "Return to Remote access and continue login."],
				"remote-connecting": ["The {provider} remote channel is still connecting.", "Wait briefly, then check again."],
				"remote-controller-error": ["The {provider} controller reported {controllerCode}.", "Return to Remote access and reconnect."],
				"competing-remote-channel": ["Another remote plugin is injecting its own request channel; the phone may show that plugin’s pairing screen.", "Turn off dsh-remote-web-ui remote access on the computer, refresh, and pair using the current DSH Mobile QR code. Do not mix pairing codes."],
				"phone-network-unknown": ["The computer cannot determine whether the router isolates the phone.", "Confirm the phone and computer use the same network, then disable guest-network or AP isolation."]
			},
			it: {
				"lan-setup-required": ["La configurazione della rete locale non è completa.", "Torna a Rete locale e scegli una rete per completare la configurazione."],
				"versions-current": ["Sono indicate le versioni installate di plugin e DSH e la versione minima dell’app Android.", ""],
				"network-unavailable": ["La scheda di rete locale salvata non è disponibile.", "Esegui di nuovo dsh-mobile setup."],
				"network-interface": ["È in uso l’interfaccia di rete {interfaceName}.", ""],
				"network-fixed": ["È in uso una configurazione di rete locale fissa.", ""],
				"lan-ready": ["Il gateway locale è in ascolto su {endpointSuffix}; l’abbinamento è disponibile.", ""],
				"lan-off": ["L’accesso dalla rete locale è disattivato.", "Attiva l’accesso locale quando il telefono deve collegarsi direttamente."],
				"firewall-ready": ["Le regole firewall TCP locale e di rilevamento sono attive.", ""],
				"firewall-missing": ["Le regole firewall complete per la rete locale non sono state trovate.", "Esegui dsh-mobile setup come amministratore e controlla le regole firewall."],
				"firewall-unknown": ["Il sistema non ha consentito al plugin di leggere lo stato del firewall.", "Se il telefono non trova il computer, esegui setup come amministratore."],
				"remote-off": ["L’accesso remoto tramite {provider} è disattivato.", ""],
				"remote-origin-ready": ["Il backend HTTP privato è in ascolto; HTTPS pubblico non è verificato.", "Verifica dal telefono reverse proxy, certificato pubblico, Host esterno inclusa la porta e accesso WebSocket. Mantieni privato il backend HTTP."],
				"remote-ready": ["L’endpoint {provider} {endpointSuffix} è raggiungibile in circa {latencyMs} ms.", ""],
				"remote-ready-via-proxy": ["Il computer ha raggiunto l’endpoint {provider} {endpointSuffix} tramite il proxy configurato in circa {latencyMs} ms; la raggiungibilità dal telefono non è verificata.", "Prova la connessione dalla rete del telefono."],
				"remote-rate-limited": ["L’endpoint {provider} {endpointSuffix} è raggiungibile, ma il controllo ha rilevato una limitazione temporanea.", "Riprova più tardi; le sessioni precedenti vengono caricate su richiesta per ridurre il traffico."],
				"remote-rate-limited-via-proxy": ["Il computer ha raggiunto l’endpoint {provider} {endpointSuffix} tramite proxy, ma il servizio ha limitato questo controllo; la raggiungibilità dal telefono non è verificata.", "Riprova più tardi e verifica dalla rete del telefono."],
				"remote-fake-ip": ["L’indirizzo Tailscale è intercettato dalla VPN o dal proxy DNS corrente e TLS non è stato stabilito.", "Cambia nodo VPN o modalità proxy; se il problema continua, usa cpolar."],
				"remote-unreachable": ["{provider} risulta pronto, ma l’endpoint {endpointSuffix} non è raggiungibile.", "Riconnettiti; se il problema continua, controlla lo stato del provider."],
				"remote-needs-login": ["Tailscale attende il completamento dell’accesso.", "Torna ad Accesso remoto e continua l’accesso."],
				"remote-connecting": ["Il canale remoto {provider} è ancora in connessione.", "Attendi qualche istante e ripeti il controllo."],
				"remote-controller-error": ["Il controller {provider} ha segnalato {controllerCode}.", "Torna ad Accesso remoto e riconnettiti."],
				"competing-remote-channel": ["Un altro plugin remoto sta inserendo il proprio canale di richieste; sul telefono potrebbe apparire la sua schermata di abbinamento.", "Disattiva l’accesso remoto di dsh-remote-web-ui sul computer, aggiorna la pagina e usa il codice QR corrente di DSH Mobile. Non mescolare i codici."],
				"phone-network-unknown": ["Il computer non può stabilire se il router isola il telefono.", "Verifica che telefono e computer usino la stessa rete, poi disattiva rete ospiti o isolamento AP."]
			},
			zh: {
				"lan-setup-required": ["尚未完成局域网初始化。", "返回局域网页选择网卡并完成配置。"],
				"versions-current": ["已显示插件、DSH 和 Android App 最低版本。", ""],
				"network-unavailable": ["已保存的局域网网卡当前不可用。", "重新运行 dsh-mobile setup。"],
				"network-interface": ["正在使用网卡 {interfaceName}。", ""],
				"network-fixed": ["当前使用固定局域网配置。", ""],
				"lan-ready": ["局域网网关正在监听 {endpointSuffix}，配对入口可用。", ""],
				"lan-off": ["局域网访问当前未开启。", "手机需要直连时开启局域网访问。"],
				"firewall-ready": ["局域网 TCP 与发现防火墙规则已启用。", ""],
				"firewall-missing": ["未找到完整的局域网防火墙规则。", "以管理员身份运行 dsh-mobile setup 并检查防火墙规则。"],
				"firewall-unknown": ["系统未允许插件读取防火墙状态。", "若手机找不到电脑，请以管理员身份运行 setup。"],
				"remote-off": ["{provider} 远程访问当前未启用。", ""],
				"remote-origin-ready": ["私有 HTTP 后端已监听；尚未验证公网 HTTPS。", "请用手机核对反向代理、公网证书、含端口的外部 Host 及 WebSocket 访问。HTTP 后端必须留在私网。"],
				"remote-ready": ["{provider} 端点 {endpointSuffix} 可达，往返约 {latencyMs} ms。", ""],
				"remote-ready-via-proxy": ["电脑经已配置代理访问 {provider} 端点 {endpointSuffix}，约 {latencyMs} ms；尚未验证手机网络是否可达。", "请用手机当前网络实际连接测试。"],
				"remote-rate-limited": ["{provider} 端点 {endpointSuffix} 可达，但本次检查观察到服务限流。", "稍后重试；旧会话会按需加载以减少流量。"],
				"remote-rate-limited-via-proxy": ["电脑经代理访问 {provider} 端点 {endpointSuffix} 时遇到限流；尚未验证手机网络是否可达。", "稍后重试，并用手机当前网络实际连接测试。"],
				"remote-fake-ip": ["Tailscale 地址被当前 VPN 或 DNS 代理接管，TLS 链路未建立。", "切换 VPN 节点或代理模式；仍失败时改用 cpolar。"],
				"remote-unreachable": ["{provider} 显示已就绪，但端点 {endpointSuffix} 暂不可达。", "点击重新连接；仍失败时检查提供方状态。"],
				"remote-needs-login": ["Tailscale 正在等待完成登录。", "返回远程访问并继续登录。"],
				"remote-connecting": ["{provider} 远程通道仍在连接。", "等待片刻后重新检查。"],
				"remote-controller-error": ["{provider} 控制器报告 {controllerCode}。", "返回远程访问并重新连接。"],
				"competing-remote-channel": ["检测到另一个远程插件注入自己的请求通道；手机可能显示它的配对页面。", "在电脑端关闭 dsh-remote-web-ui 的远程访问并刷新，再用 DSH Mobile 当前二维码配对；不要混用配对码。"],
				"phone-network-unknown": ["电脑无法判断路由器是否隔离了手机。", "确认手机与电脑使用同一网络，并关闭访客网络或 AP 隔离。"]
			}
		};
		Object.assign(MOBILE_CONTROL_MESSAGES.en, {
			frpMode: "Provisioning mode",
			frpModeDeploy: "Deploy frps here (managed)",
			frpModeAttach: "Use my existing frps (no SSH, no changes)",
			frpModeHint: "Attach manages frpc and, if selected, local ingress certificates. It never installs, edits, or restarts your frps.",
			frpEntryTls: "Entry certificate",
			frpEntryTlsPublic: "Public-CA certificate (Caddy, recommended)",
			frpEntryTlsSelfSigned: "Self-signed passthrough (no public certificate at all)",
			frpVhostHttpPort: "frps vhostHTTPPort",
			frpVhostHttpPortHint: "The loopback plaintext vhost port of your own frps (upstream default 7080).",
			frpPublicPort: "Public entry port",
			frpPublicPortHint: "Raw TCP proxy port used as the public HTTPS entry (default 33080, never 3080/3443/3444).",
			frpAttachPlan: "Copy attach runbook",
			frpAttachPlanCopied: "Attach runbook copied: local frpc.toml plus the VPS checklist.",
			frpAttachPlanFailed: "Could not build the attach runbook: {error}",
			frpAttachCertOk: "Ingress certificate valid for {days} more days; the plugin checks whether its leaf needs renewal.",
			frpAttachCertExpiring: "Ingress certificate expires in {days} days; the plugin will try to renew the leaf under the existing CA.",
			frpAttachCertExpired: "Ingress certificate has expired. Reconnect and check the certificate error.",
			frpAttachCertUnknown: "Ingress certificate is missing or unreadable. Check the certificate error before reconnecting.",
			frpAttachCaOk: "Ingress CA valid for {days} more days.",
			frpAttachCaExpiring: "Ingress CA expires in {days} days; replacing it will require pairing every phone again.",
			frpAttachSelfCheck: "Run self-check",
			frpAttachFrpsReachable: "frps control TCP port reachable",
			frpAttachFrpsUnreachable: "frps control TCP port unreachable",
			frpAttachEntryReachable: "public entry TCP port reachable (identity not checked)",
			frpAttachEntryUnreachable: "public entry TCP port unreachable",
			frpAttachModeRequiresVhostPort: "Attach mode needs the real vhostHTTPPort of your frps; the plugin will not guess 7080.",
			frpAttachCertUnknownError: "The self-signed ingress certificate is missing or unreadable; inspect the local certificate files before reconnecting.",
			frpEntryTlsInvalid: "This entry certificate mode cannot be provisioned with the selected mode.",
			frpSelfSignedRequiresPublicIpv4: "Self-signed TCP ingress requires a public IPv4 address. Use a public-CA HTTPS entry for a domain.",
			frpIngressCaExpired: "The local ingress CA has expired. Remove the FRP component from this panel, configure it again, and re-pair every phone.",
			frpIngressCaInvalid: "The local ingress CA is missing or damaged. Inspect the files; if rebuilding it, use this panel’s FRP cleanup and re-pair every phone.",
			frpIngressCaChanged: "The ingress CA differs from the saved fingerprint, so the channel stopped. Inspect the files; if rebuilding it, clean up FRP and re-pair every phone.",
			frpIngressRenewalFailed: "The ingress certificate could not be renewed. Check the FRP certificate files and reconnect; do not replace the CA silently.",
			frpAttachStepWriteSnippet: "Create the Caddy snippet",
			frpAttachStepAddImport: "Add the import line and reload Caddy",
			frpAttachStepIssueCert: "Issue the public-IP certificate",
			frpAttachStepCertTimer: "Confirm the renewal timer",
			frpAttachStepVerifyHttps: "Verify the public HTTPS entry",
			frpAttachStepOpenPort: "Open the public entry port",
			frpAttachStepVerifyFrps: "Confirm your frps is ready",
			frpAttachStepVerifyEntry: "Verify the tunnel end to end",
			frpAttachToken: "Copy frpc.toml with token",
			frpAttachTokenCopied: "The plaintext frpc.toml is copied. It contains the shared token and stays in the clipboard until you clear it — do not paste it anywhere public.",
			frpAttachTokenFailed: "Could not copy the frpc.toml with its token: {error}",
			frpAttachTokenReenter: "Re-enter the shared token first. The plugin never returns a saved token to this page.",
			frpStep2TitleAttach: "2 · Check your VPS",
			frpStep2TextAttach: "Check your existing frps and copy a VPS checklist; the plugin does not change the server.",
			frpStep4TextAttach: "Save the local client configuration and verify that the public endpoint reaches this computer.",
			frpAppRequirementSelfSigned: "Self-signed ingress requires an Android app that can pin a remote CA. Older apps without this feature cannot use this entry.",
			frpConfigurationMissingAttach: "Enter your existing frps details, install frpc locally, then save and verify the connection.",
			purgeFrpConfirmSelfSigned: "Stop FRP and delete its local frpc, token, configuration, certificates, private keys, identity record, staging files, and logs? Every phone paired through this self-signed entry must be paired again. Your VPS is unchanged."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.it, {
			frpMode: "Modalità di provisioning",
			frpModeDeploy: "Installa frps qui (gestito)",
			frpModeAttach: "Usa il mio frps esistente (niente SSH, nessuna modifica)",
			frpModeHint: "La modalità attach gestisce frpc e, se scelti, i certificati locali. Non installa, modifica o riavvia il tuo frps.",
			frpEntryTls: "Certificato di ingresso",
			frpEntryTlsPublic: "Certificato da CA pubblica (Caddy, consigliato)",
			frpEntryTlsSelfSigned: "Passthrough autofirmato (nessun certificato pubblico)",
			frpVhostHttpPort: "vhostHTTPPort di frps",
			frpVhostHttpPortHint: "Porta vhost in chiaro su loopback del tuo frps (predefinita 7080).",
			frpPublicPort: "Porta pubblica di ingresso",
			frpPublicPortHint: "Porta del proxy TCP grezzo usata come ingresso HTTPS pubblico (predefinita 33080, mai 3080/3443/3444).",
			frpAttachPlan: "Copia il runbook attach",
			frpAttachPlanCopied: "Runbook attach copiato: frpc.toml locale più la checklist VPS.",
			frpAttachPlanFailed: "Impossibile creare il runbook attach: {error}",
			frpAttachCertOk: "Certificato di ingresso valido per altri {days} giorni; il plugin verifica se la foglia va rinnovata.",
			frpAttachCertExpiring: "Il certificato di ingresso scade tra {days} giorni; il plugin proverà a rinnovare la foglia con la CA esistente.",
			frpAttachCertExpired: "Il certificato di ingresso è scaduto. Riconnettiti e controlla l’errore del certificato.",
			frpAttachCertUnknown: "Certificato di ingresso mancante o illeggibile. Controlla l’errore prima di riconnetterti.",
			frpAttachCaOk: "CA di ingresso valida per altri {days} giorni.",
			frpAttachCaExpiring: "La CA di ingresso scade tra {days} giorni; sostituirla richiederà una nuova associazione di ogni telefono.",
			frpAttachSelfCheck: "Esegui autoverifica",
			frpAttachFrpsReachable: "porta TCP di controllo frps raggiungibile",
			frpAttachFrpsUnreachable: "porta TCP di controllo frps non raggiungibile",
			frpAttachEntryReachable: "porta TCP pubblica raggiungibile (identità non verificata)",
			frpAttachEntryUnreachable: "porta TCP pubblica non raggiungibile",
			frpAttachModeRequiresVhostPort: "La modalità attach richiede il vhostHTTPPort reale del tuo frps; il plugin non presume 7080.",
			frpAttachCertUnknownError: "Il certificato di ingresso autofirmato manca o è illeggibile; controlla i file locali prima di riconnetterti.",
			frpEntryTlsInvalid: "Questa modalità di certificato non è compatibile con la modalità selezionata.",
			frpSelfSignedRequiresPublicIpv4: "L’ingresso TCP autofirmato richiede un IPv4 pubblico. Per un dominio usa un ingresso HTTPS con CA pubblica.",
			frpIngressCaExpired: "La CA locale è scaduta. Rimuovi FRP da questo pannello, riconfiguralo e associa di nuovo ogni telefono.",
			frpIngressCaInvalid: "La CA locale manca o è danneggiata. Controlla i file; se la ricrei, usa la pulizia FRP del pannello e associa di nuovo ogni telefono.",
			frpIngressCaChanged: "La CA non corrisponde all’impronta salvata, quindi il canale è stato fermato. Controlla i file; se la ricrei, pulisci FRP e associa di nuovo i telefoni.",
			frpIngressRenewalFailed: "Impossibile rinnovare il certificato di ingresso. Controlla i file e riconnettiti senza sostituire la CA automaticamente.",
			frpAttachStepWriteSnippet: "Crea lo snippet Caddy",
			frpAttachStepAddImport: "Aggiungi la riga import e ricarica Caddy",
			frpAttachStepIssueCert: "Emetti il certificato per l’IP pubblico",
			frpAttachStepCertTimer: "Verifica il timer di rinnovo",
			frpAttachStepVerifyHttps: "Verifica l’ingresso HTTPS pubblico",
			frpAttachStepOpenPort: "Apri la porta pubblica di ingresso",
			frpAttachStepVerifyFrps: "Verifica che il tuo frps sia pronto",
			frpAttachStepVerifyEntry: "Verifica il tunnel end-to-end",
			frpAttachToken: "Copia frpc.toml con token",
			frpAttachTokenCopied: "frpc.toml in chiaro copiato. Contiene il token condiviso e resta negli appunti finché non li svuoti: non incollarlo in luoghi pubblici.",
			frpAttachTokenFailed: "Impossibile copiare frpc.toml con il token: {error}",
			frpAttachTokenReenter: "Inserisci di nuovo il token condiviso. Il plugin non restituisce mai un token salvato a questa pagina.",
			frpStep2TitleAttach: "2 · Controlla il VPS",
			frpStep2TextAttach: "Controlla il tuo frps e copia la checklist VPS; il plugin non modifica il server.",
			frpStep4TextAttach: "Salva la configurazione locale e verifica che l’ingresso pubblico raggiunga questo computer.",
			frpAppRequirementSelfSigned: "L’ingresso autofirmato richiede un’app Android capace di fissare una CA remota. Le vecchie versioni senza questa funzione non possono usarlo.",
			frpConfigurationMissingAttach: "Inserisci i dati del tuo frps, installa frpc localmente, poi salva e verifica la connessione.",
			purgeFrpConfirmSelfSigned: "Arrestare FRP e cancellare frpc, token, configurazione, certificati, chiavi private, identità, file temporanei e log locali? Ogni telefono associato a questo ingresso autofirmato dovrà essere associato di nuovo. Il VPS non cambia."
		});
		Object.assign(MOBILE_CONTROL_MESSAGES.zh, {
			frpMode: "置备方式",
			frpModeDeploy: "由插件部署 frps（托管）",
			frpModeAttach: "接入我已有的 frps（零 SSH，不改动）",
			frpModeHint: "接入模式只管理本机 frpc 与按需生成的入口证书，不会安装、修改或重启你已有的 frps。",
			frpEntryTls: "入口证书档",
			frpEntryTlsPublic: "公开 CA 证书（Caddy，推荐）",
			frpEntryTlsSelfSigned: "自签穿透（完全不用公开证书）",
			frpVhostHttpPort: "frps 的 vhostHTTPPort",
			frpVhostHttpPortHint: "你自己 frps 的回环明文 vhost 端口（上游默认 7080）。",
			frpPublicPort: "公网入口端口",
			frpPublicPortHint: "作为公网 HTTPS 入口的 TCP 透传端口（默认 33080，不得为 3080/3443/3444）。",
			frpAttachPlan: "复制接入清单",
			frpAttachPlanCopied: "接入清单已复制：本机 frpc.toml 与 VPS 侧待办。",
			frpAttachPlanFailed: "生成接入清单失败：{error}",
			frpAttachCertOk: "入口证书还有 {days} 天有效期；插件会检查是否需要续签叶子证书。",
			frpAttachCertExpiring: "入口证书 {days} 天后到期；插件会尝试沿用现有 CA 续签叶子证书。",
			frpAttachCertExpired: "入口证书已过期，请重新连接并查看具体证书错误。",
			frpAttachCertUnknown: "入口证书缺失或不可读，请先查看具体证书错误。",
			frpAttachCaOk: "入口 CA 还有 {days} 天有效期。",
			frpAttachCaExpiring: "入口 CA {days} 天后到期；更换 CA 后所有手机需重新配对。",
			frpAttachSelfCheck: "运行自检",
			frpAttachFrpsReachable: "frps 控制 TCP 端口可达",
			frpAttachFrpsUnreachable: "frps 控制 TCP 端口不可达",
			frpAttachEntryReachable: "公网入口 TCP 端口可达（未验证身份）",
			frpAttachEntryUnreachable: "公网入口 TCP 端口不可达",
			frpAttachModeRequiresVhostPort: "接入模式必须填写你 frps 真实的 vhostHTTPPort，插件不会替你假定 7080。",
			frpAttachCertUnknownError: "自签入口证书缺失或不可读，请检查本机证书文件后再连接。",
			frpEntryTlsInvalid: "当前置备方式无法使用该入口证书档。",
			frpSelfSignedRequiresPublicIpv4: "自签 TCP 入口需要公网 IPv4 地址；域名请使用受公共 CA 信任的 HTTPS 入口。",
			frpIngressCaExpired: "本机入口 CA 已过期。请在此面板彻底清理 FRP 并重新配置，所有手机需重新配对。",
			frpIngressCaInvalid: "本机入口 CA 缺失或损坏。请检查证书文件；如需重建，在此面板清理 FRP 后重新配对。",
			frpIngressCaChanged: "入口 CA 与保存的指纹不符，通道已停止。请核查证书文件；如需重建，清理 FRP 后重新配对。",
			frpIngressRenewalFailed: "入口证书续签失败。请检查 FRP 证书文件并重新连接，不要静默更换 CA。",
			frpAttachStepWriteSnippet: "新增 Caddy 片段",
			frpAttachStepAddImport: "加入 import 行并重载 Caddy",
			frpAttachStepIssueCert: "为公网 IP 签发证书",
			frpAttachStepCertTimer: "确认续期定时器",
			frpAttachStepVerifyHttps: "验证公网 HTTPS 入口",
			frpAttachStepOpenPort: "放行公网入口端口",
			frpAttachStepVerifyFrps: "确认既有 frps 已就绪",
			frpAttachStepVerifyEntry: "端到端验证隧道",
			frpAttachToken: "复制含 Token 的 frpc.toml",
			frpAttachTokenCopied: "含 Token 的 frpc.toml（明文）已复制：它会留在系统剪贴板中，请勿粘贴到公开位置。",
			frpAttachTokenFailed: "复制含 Token 的 frpc.toml 失败：{error}",
			frpAttachTokenReenter: "请先重新输入共享 Token。插件不会把已保存的 Token 返回页面。",
			frpStep2TitleAttach: "2 · 核对既有服务器",
			frpStep2TextAttach: "核对既有 frps 配置并复制 VPS 操作清单；插件不会改动服务器。",
			frpStep4TextAttach: "保存本机 frpc 配置，并验证公开入口确实连接到这台电脑。",
			frpAppRequirementSelfSigned: "自签入口需要支持远程 CA 固定的 Android App；不具备此功能的旧版 App 无法使用。",
			frpConfigurationMissingAttach: "填写既有 frps 信息，在本机安装 frpc，然后保存并验证连接。",
			purgeFrpConfirmSelfSigned: "要停止 FRP 并删除本机 frpc、Token、配置、证书、私钥、身份记录、临时文件和日志吗？通过此自签入口配对的手机都需重新配对；VPS 不会改变。"
		});
		/** Caddy snippet owned entirely by DSH Mobile; the main Caddyfile only imports it. */
		const FRP_CADDY_SNIPPET_PATH = "/etc/caddy/dsh-mobile-dsh.caddy";
		/** First line of the owned snippet; also the legacy whole-file marker. */
		const FRP_CADDY_SNIPPET_MARKER = "# Managed by DSH Mobile - snippet, safe to delete";
		/** Exact line the main Caddyfile must contain (uncommented) for the site to load. */
		const FRP_CADDY_IMPORT_LINE = `import ${FRP_CADDY_SNIPPET_PATH}`;
		function publicIpv4Address(value) {
			const parts = value.split(".");
			return parts.length === 4 && parts.every((part) => /^(?:0|[1-9][0-9]{0,2})$/u.test(part) && Number(part) <= 255);
		}
		function publicDnsHostname(value) {
			return value.length <= 253 && value.includes(".") && !/^[0-9.]+$/u.test(value) && !value.includes(":") && value.split(".").every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label));
		}
		function parsePublicOrigin(publicOrigin) {
			let url;
			try {
				url = new URL(publicOrigin);
			} catch {
				throw new Error("frp_template_input_invalid");
			}
			if (url.protocol !== "https:" || url.port !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "" || !publicIpv4Address(url.hostname) && !publicDnsHostname(url.hostname)) throw new Error("frp_template_input_invalid");
			return url.hostname;
		}
		function resolveVhostHttpPort(options) {
			const port = options.vhostHttpPort ?? 7080;
			if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("frp_template_input_invalid");
			return port;
		}
		/**
		* A self-signed entry deliberately never reaches Caddy: the tunnel is a raw TCP
		* passthrough and the DSH gateway is the TLS endpoint. Refuse loudly instead of
		* emitting a Caddy site that would need the gateway's private CA on the VPS.
		*/
		function rejectSelfSignedCaddySite(options) {
			if (options.entryTls === "self-signed") throw new Error("frp_entry_tls_invalid");
		}
		/**
		* Build the Caddy site for one public host (without markers or import wiring).
		*
		* The second parameter accepts either a bare certificate directory (the legacy
		* signature) or a full {@link CaddySiteOptions} object, so existing callers keep
		* working unchanged.
		*/
		function createCaddySite(publicHost, options = {}) {
			const resolved = typeof options === "string" ? { certDir: options } : options;
			rejectSelfSignedCaddySite(resolved);
			const certDir = resolved.certDir ?? "/var/lib/caddy/dsh-mobile-certs";
			const vhostHttpPort = resolveVhostHttpPort(resolved);
			if (publicIpv4Address(publicHost)) return [
				"{",
				`  default_sni ${publicHost}`,
				"}",
				"",
				`http://${publicHost} {`,
				`  redir https://${publicHost}{uri} permanent`,
				"}",
				"",
				`https://${publicHost} {`,
				`  tls ${certDir}/fullchain.pem ${certDir}/privkey.pem`,
				`  reverse_proxy 127.0.0.1:${String(vhostHttpPort)}`,
				"}",
				""
			].join("\n");
			if (!publicDnsHostname(publicHost)) throw new Error("frp_template_input_invalid");
			return [
				`${publicHost} {`,
				`  reverse_proxy 127.0.0.1:${String(vhostHttpPort)}`,
				"}",
				""
			].join("\n");
		}
		/** Manual certbot steps for a public-IPv4 origin (Caddy cannot issue IP certificates itself). */
		function manualIpCertificateGuide(publicHost) {
			return [
				"# Public-IPv4 manual HTTPS: Caddy cannot issue IP certificates by itself.",
				"# On the VPS (Ubuntu/Debian, port 80 reachable from the internet), run once as root:",
				"#   apt-get install -y python3-venv",
				"#   python3 -m venv /opt/dsh-mobile/certbot-venv",
				"#   /opt/dsh-mobile/certbot-venv/bin/pip install 'certbot==5.8.0'",
				"#   systemctl stop caddy || true",
				`#   /opt/dsh-mobile/certbot-venv/bin/certbot certonly --standalone --preferred-profile shortlived --ip-address ${publicHost} --agree-tos --register-unsafely-without-email --non-interactive --keep-until-expiring`,
				"#   install -d -m 0750 -o caddy -g caddy /var/lib/caddy/dsh-mobile-certs",
				`#   install -m 0640 -o caddy -g caddy /etc/letsencrypt/live/${publicHost}/fullchain.pem /var/lib/caddy/dsh-mobile-certs/fullchain.pem`,
				`#   install -m 0640 -o caddy -g caddy /etc/letsencrypt/live/${publicHost}/privkey.pem /var/lib/caddy/dsh-mobile-certs/privkey.pem`,
				"#   systemctl start caddy",
				"# The site below already references those paths. Certificates last about 6 days: re-run certonly before expiry.",
				"#"
			].join("\n");
		}
		/**
		* Build the only supported frps config and Caddy snippet from validated user inputs.
		*
		* Default `options` reproduce the upstream artefact byte for byte; `attach` mode
		* passes the user's real vhost port, and `self-signed` is rejected because that
		* mode publishes a raw TCP proxy instead of an HTTP vhost.
		*/
		function createRestrictedFrpServerTemplate(serverPort, token, publicOrigin, options = {}) {
			if (!Number.isSafeInteger(serverPort) || serverPort < 1 || serverPort > 65535 || token.length < 16 || token.length > 512 || /[\s\u0000-\u001f\u007f]/u.test(token)) throw new Error("frp_template_input_invalid");
			rejectSelfSignedCaddySite(options);
			const vhostHttpPort = resolveVhostHttpPort(options);
			const certDir = options.certDir ?? "/var/lib/caddy/dsh-mobile-certs";
			const publicHost = parsePublicOrigin(publicOrigin);
			const lines = [
				"# frps.toml — save as /etc/dsh-mobile/frps.toml, then start the frps service.",
				`bindPort = ${String(serverPort)}`,
				"proxyBindAddr = \"127.0.0.1\"",
				`vhostHTTPPort = ${String(vhostHttpPort)}`,
				"auth.method = \"token\"",
				`auth.token = ${JSON.stringify(token)}`,
				"",
				`# Caddy — save the site below as ${FRP_CADDY_SNIPPET_PATH},`,
				"# then make sure your Caddyfile contains exactly this line at the TOP of the file",
				"# (create the file with just this line if needed; globals must precede sites):",
				`#   ${FRP_CADDY_IMPORT_LINE}`,
				"# finally run: caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy",
				"# Uninstall later removes only this snippet file and the import line; your own Caddy content is kept.",
				`${FRP_CADDY_SNIPPET_MARKER}`,
				createCaddySite(publicHost, {
					certDir,
					vhostHttpPort
				}).trimEnd(),
				""
			];
			if (publicIpv4Address(publicHost)) lines.push(manualIpCertificateGuide(publicHost), "");
			return lines.join("\n");
		}
		//#endregion
		//#region src/ip.ts
		/**
		* Browser-safe IP literal classification.
		*
		* `node:net` cannot be imported from the browser Client face, so the pure
		* predicate lives here instead. Semantics are deliberately identical to
		* `net.isIP`: strict dotted-quad IPv4 (no leading zeros, no signs, no
		* whitespace), IPv6 with at most one `::`, at most four hex digits per group,
		* an optional dotted-quad tail in the final position, and an optional
		* non-empty zone id after a single `%`.
		*
		* This module is dependency-free and side-effect-free on purpose: it is the
		* single classification source shared by every face of the plugin — the Node
		* side (`config.ts`, `cloudflared-tunnel.ts`, `origin-proxy-config.ts`,
		* `vps-deploy.ts`, `gateway.ts`, `network.ts`, `frp-config.ts`) and the browser
		* Client face that cannot reach `node:net` — so both classify a given literal
		* identically. Callers rely on the strict reading above and never post-process
		* the literal afterwards, so changing the accept/reject boundary here changes
		* it everywhere, which is the intended contract.
		*/
		/** Strict dotted-quad IPv4: POSIX `inet_pton` rules, so `01.1.1.1` is rejected. */
		function isStrictIpv4(value) {
			const parts = value.split(".");
			if (parts.length !== 4) return false;
			for (const part of parts) {
				if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(part)) return false;
				if (Number(part) > 255) return false;
			}
			return true;
		}
		/**
		* Count the 16-bit groups one side of an IPv6 address occupies.
		*
		* A dotted-quad tail counts as two groups and is accepted only where the caller
		* allows it — that is, only in the final label of the whole address.
		*
		* @returns the group count, or `-1` when any label is malformed.
		*/
		function countIpv6Groups(labels, allowDottedQuad) {
			let groups = 0;
			for (let index = 0; index < labels.length; index += 1) {
				const label = labels[index];
				if (label.includes(".")) {
					if (index !== labels.length - 1 || !allowDottedQuad || !isStrictIpv4(label)) return -1;
					groups += 2;
					continue;
				}
				if (!/^[\da-f]{1,4}$/iu.test(label)) return -1;
				groups += 1;
			}
			return groups;
		}
		/**
		* Classify an IP literal.
		*
		* @param value - candidate address; non-strings are never an IP.
		* @returns `4` for IPv4, `6` for IPv6, `0` when the value is neither.
		*/
		function isIP(value) {
			if (typeof value !== "string") return 0;
			if (isStrictIpv4(value)) return 4;
			let text = value;
			const zone = text.indexOf("%");
			if (zone !== -1) {
				const suffix = text.slice(zone + 1);
				if (suffix.length === 0 || suffix.includes("%")) return 0;
				text = text.slice(0, zone);
			}
			if (text.length === 0) return 0;
			const halves = text.split("::");
			if (halves.length > 2) return 0;
			if (halves.length === 1) return countIpv6Groups(text.split(":"), true) === 8 ? 6 : 0;
			const leftText = halves[0];
			const rightText = halves[1];
			const left = leftText === "" ? [] : leftText.split(":");
			const right = rightText === "" ? [] : rightText.split(":");
			const leftGroups = countIpv6Groups(left, false);
			const rightGroups = countIpv6Groups(right, right.length > 0);
			if (leftGroups < 0 || rightGroups < 0) return 0;
			return leftGroups + rightGroups >= 8 ? 0 : 6;
		}
		//#endregion
		//#region src/network.ts
		/**
		* IPv4 ranges that are never a public VPS endpoint (IANA special-purpose,
		* private, shared, loopback, link-local, documentation, benchmark, multicast,
		* and reserved space). Kept in sync with Android `RemoteHostPolicy`.
		*/
		const NON_ROUTABLE_IPV4_RANGES = Object.freeze([
			[0n, 8],
			[167772160n, 8],
			[1681915904n, 10],
			[2130706432n, 8],
			[2851995648n, 16],
			[2886729728n, 12],
			[3221225472n, 24],
			[3221225984n, 24],
			[3223307264n, 24],
			[3224682752n, 24],
			[3227017984n, 24],
			[3232235520n, 16],
			[3232706560n, 24],
			[3323068416n, 15],
			[3325256704n, 24],
			[3405803776n, 24],
			[3758096384n, 4],
			[4026531840n, 4]
		]);
		function parseStrictIpv4Octets(address) {
			const parts = address.split(".");
			if (parts.length !== 4) return void 0;
			const octets = [];
			for (const part of parts) {
				if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(part)) return void 0;
				const octet = Number(part);
				if (octet > 255) return void 0;
				octets.push(octet);
			}
			return octets;
		}
		/**
		* Whether a dotted-quad IPv4 literal is globally routable and therefore usable
		* as a public VPS / remote HTTPS endpoint. Rejects documentation addresses such
		* as 203.0.113.10 alongside private, shared, and reserved space.
		*/
		function isGloballyRoutableIpv4(address) {
			const octets = parseStrictIpv4Octets(address);
			if (octets === void 0) return false;
			const value = BigInt(octets[0]) << 24n | BigInt(octets[1]) << 16n | BigInt(octets[2]) << 8n | BigInt(octets[3]);
			return !NON_ROUTABLE_IPV4_RANGES.some(([network, prefix]) => {
				if (prefix === 0) return true;
				const hostBits = BigInt(32 - prefix);
				const mask = (1n << 32n) - 1n ^ (1n << hostBits) - 1n;
				return (value & mask) === network;
			});
		}
		/** Ports owned by other DSH Mobile listeners; the public entry may never reuse them. */
		const FRP_RESERVED_PORTS = Object.freeze([
			3080,
			3443,
			3444
		]);
		/** Every key `settings.json` may contain. Unknown keys stay rejected. */
		const FRP_SETTINGS_KEYS = /* @__PURE__ */ new Set([
			"version",
			"serverAddress",
			"serverPort",
			"token",
			"publicOrigin",
			"mode",
			"entryTls",
			"vhostHttpPort",
			"publicPort"
		]);
		function hostname(value) {
			if (value.length > 253 || !value.includes(".")) return false;
			return value.split(".").every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label));
		}
		/** Validate the FRP server hostname or IP address. */
		function validateFrpServerAddress(value) {
			if (typeof value !== "string" || value !== value.trim() || value.length === 0 || value.length > 253 || /[\s\u0000-\u001f\u007f/\\@?#]/u.test(value)) throw new Error("frp_server_address_invalid");
			const normalized = value.toLowerCase().replace(/\.$/u, "");
			if (isIP(normalized) === 0 && !hostname(normalized)) throw new Error("frp_server_address_invalid");
			return normalized;
		}
		/** Validate the FRP control port. */
		function validateFrpServerPort(value) {
			if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 65535) throw new Error("frp_server_port_invalid");
			return Number(value);
		}
		/** Validate a high-entropy FRP token before durable storage. */
		function validateFrpToken(value) {
			if (typeof value !== "string" || value.length < 16 || value.length > 512 || /[\s\u0000-\u001f\u007f]/u.test(value)) throw new Error("frp_token_invalid");
			return value;
		}
		/** Validate the public HTTPS origin used by Caddy and Android pairing. */
		function validateFrpPublicOrigin(value) {
			if (typeof value !== "string" || value.length > 512) throw new Error("frp_public_origin_invalid");
			let url;
			try {
				url = new URL(value);
			} catch {
				throw new Error("frp_public_origin_invalid");
			}
			const publicHost = url.hostname;
			if (url.protocol !== "https:" || url.port !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "" || isIP(publicHost) !== 4 && !hostname(publicHost)) throw new Error("frp_public_origin_invalid");
			if (isIP(publicHost) === 4 && !isGloballyRoutableIpv4(publicHost)) throw new Error("frp_public_origin_invalid");
			return url.origin;
		}
		/** Validate the provisioning mode. */
		function validateFrpMode(value) {
			if (value !== "deploy" && value !== "attach") throw new Error("frp_settings_invalid");
			return value;
		}
		/** Validate the entry TLS mode. */
		function validateFrpEntryTls(value) {
			if (value !== "public-ip-cert" && value !== "self-signed") throw new Error("frp_entry_tls_invalid");
			return value;
		}
		function validatePort(value, rejectReserved) {
			if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 65535) throw new Error("frp_settings_invalid");
			const port = Number(value);
			if (rejectReserved && FRP_RESERVED_PORTS.includes(port)) throw new Error("frp_settings_invalid");
			return port;
		}
		/** Validate the loopback vhost port of the target frps. */
		function validateFrpVhostHttpPort(value) {
			return validatePort(value, false);
		}
		/** Validate the public entry port of the self-signed TCP proxy. */
		function validateFrpPublicPort(value) {
			return validatePort(value, true);
		}
		/** Effective provisioning mode; an absent field keeps the upstream behaviour. */
		function resolveFrpMode(settings) {
			return settings.mode ?? "deploy";
		}
		/** Effective entry TLS mode; an absent field keeps the upstream behaviour. */
		function resolveFrpEntryTls(settings) {
			return settings.entryTls ?? "public-ip-cert";
		}
		/** Effective loopback vhost port; an absent field keeps the upstream behaviour. */
		function resolveFrpVhostHttpPort(settings) {
			return settings.vhostHttpPort ?? 7080;
		}
		/** Effective public entry port of the self-signed passthrough. */
		function resolveFrpPublicPort(settings) {
			return settings.publicPort ?? 33080;
		}
		/** True when the gateway terminates TLS itself behind a raw frps TCP proxy. */
		function isFrpSelfSignedIngress(settings) {
			return resolveFrpEntryTls(settings) === "self-signed";
		}
		/**
		* Parse FRP settings at the loopback request and filesystem boundaries.
		*
		* Optional keys are kept only when supplied, so a legacy `settings.json` still
		* round-trips byte for byte and every default stays the upstream behaviour.
		* Two cross-field rules are enforced here because neither can be recovered later:
		* the self-signed entry is a TCP passthrough and therefore attach-only, and
		* attach mode with a public-CA entry must state the user's real vhost port —
		* silently assuming 7080 would disable the plaintext-exposure gate.
		*/
		function parseFrpSettings(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("frp_settings_invalid");
			const record = value;
			if (Reflect.ownKeys(record).some((key) => !FRP_SETTINGS_KEYS.has(String(key)))) throw new Error("frp_settings_invalid");
			if (record.version !== void 0 && record.version !== 1) throw new Error("frp_settings_invalid");
			const mode = record.mode === void 0 ? void 0 : validateFrpMode(record.mode);
			const entryTls = record.entryTls === void 0 ? void 0 : validateFrpEntryTls(record.entryTls);
			const vhostHttpPort = record.vhostHttpPort === void 0 ? void 0 : validateFrpVhostHttpPort(record.vhostHttpPort);
			const publicPort = record.publicPort === void 0 ? void 0 : validateFrpPublicPort(record.publicPort);
			const resolvedMode = mode ?? "deploy";
			const resolvedEntryTls = entryTls ?? "public-ip-cert";
			if (resolvedEntryTls === "self-signed" && resolvedMode !== "attach") throw new Error("frp_entry_tls_invalid");
			if (resolvedMode === "attach" && resolvedEntryTls === "public-ip-cert" && vhostHttpPort === void 0) throw new Error("frp_attach_mode_requires_vhost_port");
			const publicOrigin = validateFrpPublicOrigin(record.publicOrigin);
			if (resolvedEntryTls === "self-signed" && isIP(new URL(publicOrigin).hostname) !== 4) throw new Error("frp_self_signed_requires_public_ipv4");
			return Object.freeze({
				version: 1,
				serverAddress: validateFrpServerAddress(record.serverAddress),
				serverPort: validateFrpServerPort(record.serverPort),
				token: validateFrpToken(record.token),
				publicOrigin,
				...mode === void 0 ? {} : { mode },
				...entryTls === void 0 ? {} : { entryTls },
				...vhostHttpPort === void 0 ? {} : { vhostHttpPort },
				...publicPort === void 0 ? {} : { publicPort }
			});
		}
		function tomlString(value) {
			return JSON.stringify(value);
		}
		/**
		* Legacy proxy name, kept only as the default of {@link createFrpcToml}.
		*
		* A shared frps accepts one proxy per name across *all* its clients, so a fixed
		* name let any other DSH installation — or a not yet reaped session of this one —
		* own `dsh-mobile` first. frpc then logged `start error: proxy name [dsh-mobile]
		* is already in use`, kept running without publishing the entry port, and the
		* start-up self-check ended in `frp_start_timeout` ("the public endpoint did not
		* become ready"). Product callers therefore pass an installation-derived name
		* from {@link frpProxyName}; this constant only keeps the exported API and the
		* byte-for-byte compatibility test working for legacy callers.
		*/
		const FRP_DEFAULT_PROXY_NAME = "dsh-mobile";
		/**
		* Validate a proxy name for the generated frpc configuration.
		*
		* frps accepts one proxy per name on the whole server, so the name must be a
		* single safe token: no whitespace, no quotes, no path or bracket characters.
		*/
		function validateFrpProxyName(value) {
			if (typeof value !== "string" || value.length < 1 || value.length > 128 || !/^[A-Za-z0-9._-]+$/u.test(value)) throw new Error("frp_proxy_name_invalid");
			return value;
		}
		/**
		* Build the single-purpose frpc configuration for the current loopback gateway.
		*
		* The default (public-CA) entry is an HTTP vhost behind Caddy and is emitted byte
		* for byte as before. The self-signed entry cannot use a vhost at all: frps only
		* forwards raw TCP, and the gateway terminates TLS on that connection.
		*
		* `proxyName` defaults to the legacy fixed name only for legacy callers; the
		* provider and the attach preview always pass {@link frpProxyName}.
		*/
		function createFrpcToml(settings, localPort, proxyName = FRP_DEFAULT_PROXY_NAME) {
			if (!Number.isSafeInteger(localPort) || localPort < 1 || localPort > 65535) throw new Error("frp_local_port_invalid");
			const header = [
				`serverAddr = ${tomlString(settings.serverAddress)}`,
				`serverPort = ${String(settings.serverPort)}`,
				"auth.method = \"token\"",
				`auth.token = ${tomlString(settings.token)}`,
				"transport.tls.enable = true",
				"",
				"[[proxies]]",
				`name = ${tomlString(validateFrpProxyName(proxyName))}`
			];
			if (isFrpSelfSignedIngress(settings)) return [
				...header,
				"type = \"tcp\"",
				"localIP = \"127.0.0.1\"",
				`localPort = ${String(localPort)}`,
				`remotePort = ${String(resolveFrpPublicPort(settings))}`,
				"transport.useEncryption = true",
				"transport.useCompression = true",
				""
			].join("\n");
			const hostnameValue = new URL(settings.publicOrigin).hostname;
			return [
				...header,
				"type = \"http\"",
				"localIP = \"127.0.0.1\"",
				`localPort = ${String(localPort)}`,
				`customDomains = [${tomlString(hostnameValue)}]`,
				"transport.useEncryption = true",
				"transport.useCompression = true",
				""
			].join("\n");
		}
		//#endregion
		//#region src/frp-attach.ts
		/** Default proof path used to confirm the public entry answered from this computer. */
		const FRP_ATTACH_DISCOVERY_PATH = "/mobile-access/discovery";
		/** Declaration printed above the VPS half of an attach template. */
		const FRP_ATTACH_VPS_DECLARATION = "# 本模板不安装、不改动、不重启你的 frps；只新增 Caddy 片段与证书。frps 侧需你自行确认 vhostHTTPPort=<N> 与 proxyBindAddr=\"127.0.0.1\"。";
		/** Declaration printed above the local half of an attach template. */
		const FRP_ATTACH_LOCAL_DECLARATION = "# 本机只写入 frpc.toml 并启动 frpc：不安装、不改动本机 frps，也不改动 DSH 自身配置。";
		/** Declaration for the self-signed passthrough, which keeps its CA on this computer. */
		const FRP_ATTACH_SELF_SIGNED_DECLARATION = "# 自签穿透档不使用 Caddy 或公开证书：frps 只做 TCP 透传，由本机 DSH 网关终止 TLS；服务端证书会在运行时续签，CA 到期需重新配对。";
		/**
		* One-line notice printed above the masked frpc.toml preview.
		*
		* It states both facts a reader cannot verify from the text itself: the real
		* file is written with 0600 permissions, and an unmasked copy would survive in
		* the system clipboard.
		*/
		function frpAttachTokenMaskNotice(configFile) {
			return `# 预览已打码：真正的 frpc.toml 已由插件以 0600 权限写入 ${configFile}；明文 token 不打码会随复制进入系统剪贴板，故此处只显示占位符。`;
		}
		/** One-line notice printed above an explicitly revealed frpc.toml preview. */
		const FRP_ATTACH_TOKEN_REVEAL_NOTICE = "# 明文 token 已按你的显式操作显示：复制后即进入系统剪贴板并长期留存，请勿粘贴到公开位置。";
		/** Matches the single `auth.token` assignment of a generated frpc.toml. */
		const FRPC_TOKEN_ASSIGNMENT = /^auth\.token\s*=\s*"(?:[^"\\]|\\.)*"/mu;
		/**
		* Replace the `auth.token` value of a rendered frpc.toml with a fixed placeholder.
		*
		* Only the preview and clipboard paths call this: the file written to disk keeps
		* the real token, because frpc has to read it. The mapping never fails open — a
		* token line that cannot be masked raises instead of leaking the secret.
		*/
		function redactFrpcTomlToken(frpcToml) {
			if (!/(^|\n)auth\.token/u.test(frpcToml)) return frpcToml;
			const masked = frpcToml.replace(FRPC_TOKEN_ASSIGNMENT, `auth.token = "***"`);
			if (!masked.includes(`auth.token = "***"`)) throw new Error("frp_token_mask_failed");
			return masked;
		}
		/**
		* The frpc.toml exactly as the panel displays or copies it.
		*
		* `options.revealToken` is the only way to obtain the plaintext variant; the
		* default is the masked text. `createFrpcToml` itself is untouched, so the file
		* the provider writes stays byte-for-byte identical to the upstream output.
		*/
		function createFrpAttachFrpcToml(settings, options = {}) {
			const frpcToml = createFrpcToml(settings, attachLocalPort(options), options.proxyName ?? "dsh-mobile");
			return options.revealToken === true ? frpcToml : redactFrpcTomlToken(frpcToml);
		}
		const DEFAULT_ATTACH_CONFIG_FILE = "<DSH Mobile 私有目录>/remote/frp/config/frpc.toml";
		function attachConfigFile(options) {
			const file = options.configFile;
			if (file === void 0 || file === "") return DEFAULT_ATTACH_CONFIG_FILE;
			return file;
		}
		function attachLocalPort(options) {
			const port = options.localPort ?? 3443;
			if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("frp_local_port_invalid");
			return port;
		}
		/**
		* Reject every attach request that could not be carried out safely before any
		* artefact is produced. Attach never installs frps, so it must know the user's
		* real vhost port (unless the self-signed passthrough removes the vhost entirely).
		*/
		function validateAttachSettings(settings, options = {}) {
			if (resolveFrpMode(settings) !== "attach") throw new Error("frp_settings_invalid");
			if (isFrpSelfSignedIngress(settings)) {
				if (settings.mode !== "attach") throw new Error("frp_entry_tls_invalid");
				resolveFrpPublicPort(settings);
				return;
			}
			const vhostHttpPort = options.vhostHttpPort ?? settings.vhostHttpPort;
			if (vhostHttpPort === void 0) throw new Error("frp_attach_mode_requires_vhost_port");
			if (!Number.isSafeInteger(vhostHttpPort) || vhostHttpPort < 1 || vhostHttpPort > 65535) throw new Error("frp_settings_invalid");
		}
		/** Strip the leading `# ` of a guide block so it can be pasted as runnable shell. */
		function guideCommands(guide) {
			return guide.split("\n").map((line) => line.replace(/^#\s?/u, "").trimEnd()).filter((line) => line !== "");
		}
		/**
		* Derive every VPS-side value once so the copied runbook and the panel plan can
		* never drift apart.
		*/
		function frpAttachVpsParts(settings, options = {}) {
			validateAttachSettings(settings, options);
			const publicHost = new URL(settings.publicOrigin).hostname;
			if (isFrpSelfSignedIngress(settings)) return Object.freeze({
				publicHost,
				selfSigned: true,
				publicPort: resolveFrpPublicPort(settings),
				snippet: "",
				certGuide: Object.freeze([])
			});
			const vhostHttpPort = options.vhostHttpPort ?? resolveFrpVhostHttpPort(settings);
			const certDir = options.certDir;
			const site = createCaddySite(publicHost, {
				vhostHttpPort,
				...certDir === void 0 ? {} : { certDir }
			});
			return Object.freeze({
				publicHost,
				selfSigned: false,
				vhostHttpPort,
				snippet: `${FRP_CADDY_SNIPPET_MARKER}\n${site.trimEnd()}\n`,
				certGuide: Object.freeze(isIP(publicHost) === 4 ? guideCommands(manualIpCertificateGuide(publicHost)) : [])
			});
		}
		/**
		* Build the attach artefact for an existing frps.
		*
		* The result is deliberately split in two: the VPS half contains only what the
		* user's own server needs (Caddy snippet + import + certificate guidance, or a
		* single firewall rule for the self-signed passthrough), and the local half
		* contains the generated frpc.toml plus its `frpc verify` self-check. Neither
		* half installs, rewrites, or restarts the user's frps.
		*/
		function createFrpAttachTemplateParts(settings, options = {}) {
			const parts = frpAttachVpsParts(settings, options);
			const configFile = attachConfigFile(options);
			const revealed = options.revealToken === true;
			const frpcToml = createFrpAttachFrpcToml(settings, options);
			const local = [
				"# ---- (b) 本机侧（在这台电脑上执行）----",
				FRP_ATTACH_LOCAL_DECLARATION,
				revealed ? FRP_ATTACH_TOKEN_REVEAL_NOTICE : frpAttachTokenMaskNotice(configFile),
				`# frpc.toml 全文（插件同样会以 0600 权限写入 ${configFile}）`,
				frpcToml.trimEnd(),
				"",
				"# 启动前自检：",
				`frpc verify -c "${configFile}"`,
				""
			].join("\n");
			if (parts.selfSigned) {
				const publicPort = parts.publicPort ?? resolveFrpPublicPort(settings);
				const vps = [
					"# ---- (a) VPS 侧（在你的服务器上执行，共 3 项）----",
					FRP_ATTACH_SELF_SIGNED_DECLARATION,
					"#",
					"# 1) 放行公网入口端口（就是这台电脑网关的 HTTPS 入口，TCP 透传不解密）：",
					`ufw allow ${String(publicPort)}/tcp`,
					`ufw status | grep ${String(publicPort)}`,
					"# 若使用 firewalld / 云厂商安全组，请放行同样的 TCP 端口。",
					"# 前提：现有 frps 的 TCP 代理已监听公网地址；若 proxyBindAddr=127.0.0.1，放行防火墙仍无法从公网访问。",
					"# 插件不会修改你现有的 frps；不满足此前提时请改选受信任证书入口。",
					"#",
					"# 2) 确认你既有的 frps 已就绪（无需修改它的配置）：",
					"systemctl is-active frps || true",
					`ss -lnt | grep -E ':(${String(settings.serverPort)}|${String(publicPort)})\\b' || true`,
					"#",
					"# 3) frpc 启动后，用 -k 检查连通性；此命令不验证身份，App 配对后会固定网关 CA：",
					`curl -k -sS -o /dev/null -w '%{http_code}\\n' https://${parts.publicHost}:${String(publicPort)}${FRP_ATTACH_DISCOVERY_PATH}`,
					"# 期望输出 200。",
					""
				].join("\n");
				return Object.freeze({
					mode: "attach",
					vps,
					local,
					text: `${vps}${local}`
				});
			}
			const vps = [
				"# ---- (a) VPS 侧（在你的服务器上执行）----",
				FRP_ATTACH_VPS_DECLARATION,
				"#",
				`# 1) 保存 Caddy 片段到 ${FRP_CADDY_SNIPPET_PATH}（只新增这一个文件）：`,
				`cat > ${FRP_CADDY_SNIPPET_PATH} <<'DSH_MOBILE_CADDY_SNIPPET'`,
				parts.snippet.trimEnd(),
				"DSH_MOBILE_CADDY_SNIPPET",
				"#",
				"# 2) 确认 Caddyfile 顶部含下面这一行（全局块必须在前；没有则加到文件最上方）：",
				`#   ${FRP_CADDY_IMPORT_LINE}`,
				"caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy",
				"#",
				...parts.certGuide.length === 0 ? ["# 3) 域名 HTTPS：确认 DNS 指向 VPS，开放 80/443；Caddy 会自动申请和续期证书。"] : [
					"# 3) 公网 IP 的 HTTPS 证书（Caddy 不能为 IP 自动签发，故用 certbot 签发）：",
					...parts.certGuide.map((line) => `#   ${line}`),
					"#",
					"# 4) 确认证书续期任务，并在续期后将新证书安装到 Caddy：",
					"systemctl list-timers certbot.timer --all || true"
				],
				"#",
				"# 端到端验证（公网入口为 443，与 frps 的 vhost 端口无关）：",
				`curl -sS -o /dev/null -w '%{http_code}\\n' https://${parts.publicHost}${FRP_ATTACH_DISCOVERY_PATH}`,
				"# 期望输出 200。",
				""
			].join("\n");
			return Object.freeze({
				mode: "attach",
				vps,
				local,
				text: `${vps}${local}`
			});
		}
		/** Combined attach artefact, ready for the clipboard. */
		function createFrpAttachTemplate(settings, options = {}) {
			return createFrpAttachTemplateParts(settings, options).text;
		}
		/** Wire bounds mirrored by the Android notification policy. */
		const TASK_NOTIFY_LIMITS = Object.freeze({
			title: 80,
			body: 200,
			tag: 64
		});
		const MAX_SEEN_QUESTION_KEYS = 20;
		function sanitizeTagFragment(value) {
			return value.toLowerCase().replaceAll(/[^a-z0-9-]+/gu, "-").replaceAll(/^-+|-+$/gu, "").slice(0, TASK_NOTIFY_LIMITS.tag);
		}
		/** Stable per-turn tag so concurrent sessions keep separate notifications. */
		function taskCompletionTag(sessionId, turn) {
			return `dsh-task-done-${sanitizeTagFragment(`${sessionId}-${String(turn)}`) || "task"}`.slice(0, TASK_NOTIFY_LIMITS.tag);
		}
		/** Decide whether the current snapshot deserves a system notification. */
		var TaskNotifyTracker = class {
			lastActivityAt;
			notifiedDoneAt;
			wasBusy = false;
			busySince;
			idleAnchoredAt;
			seenQuestionKeys = /* @__PURE__ */ new Set();
			quietMs;
			graceMs;
			minBusyMs;
			now;
			format;
			constructor(options) {
				this.quietMs = options.quietMs ?? 9e4;
				this.graceMs = options.graceMs ?? 1e4;
				this.minBusyMs = options.minBusyMs ?? 2e4;
				this.now = options.now ?? Date.now;
				this.format = options.format;
			}
			/** Record assistant-side activity; re-arms completion after a notification. */
			markActivity() {
				const now = this.now();
				this.lastActivityAt = now;
				if (this.notifiedDoneAt !== void 0 && this.notifiedDoneAt <= now) this.notifiedDoneAt = void 0;
			}
			/**
			* Milliseconds until a pending completion anchor fires, or undefined when
			* no anchor exists. Lets the watcher schedule one exact timer instead of
			* waiting for the next coarse poll tick.
			*/
			pendingAnchorDelayMs() {
				if (this.idleAnchoredAt === void 0) return void 0;
				return Math.max(0, this.graceMs - (this.now() - this.idleAnchoredAt));
			}
			evaluate(snapshot) {
				const now = this.now();
				if (!this.wasBusy && snapshot.composerBusy) this.busySince = now;
				if (this.wasBusy && !snapshot.composerBusy) {
					const busyFor = this.busySince === void 0 ? 0 : now - this.busySince;
					this.busySince = void 0;
					if (snapshot.pageHidden && !snapshot.pendingQuestion && busyFor >= this.minBusyMs) {
						this.idleAnchoredAt = void 0;
						this.notifiedDoneAt = now;
						return this.event("done", snapshot.sessionLabel, void 0);
					}
					this.idleAnchoredAt = snapshot.pageHidden ? now : void 0;
					if (!snapshot.pageHidden) this.notifiedDoneAt = now;
				}
				this.wasBusy = snapshot.composerBusy;
				if (snapshot.composerBusy) this.idleAnchoredAt = void 0;
				else if (this.idleAnchoredAt !== void 0 && !snapshot.pageHidden) {
					this.idleAnchoredAt = void 0;
					this.notifiedDoneAt = now;
				}
				if (!snapshot.pageHidden) {
					if (snapshot.pendingQuestion && snapshot.questionKey !== void 0) this.rememberQuestionKey(snapshot.questionKey);
					return;
				}
				if (snapshot.pendingQuestion) {
					if (snapshot.questionKey === void 0 || this.seenQuestionKeys.has(snapshot.questionKey)) return void 0;
					this.rememberQuestionKey(snapshot.questionKey);
					return this.event("question", snapshot.sessionLabel, snapshot.questionKey);
				}
				if (this.idleAnchoredAt !== void 0) {
					if (now - this.idleAnchoredAt < this.graceMs) return void 0;
					this.idleAnchoredAt = void 0;
					this.notifiedDoneAt = now;
					return this.event("done", snapshot.sessionLabel, void 0);
				}
				if (this.lastActivityAt === void 0) return void 0;
				if (now - this.lastActivityAt < this.quietMs) return void 0;
				if (now - this.lastActivityAt > 18e5) {
					this.lastActivityAt = void 0;
					return;
				}
				if (this.notifiedDoneAt !== void 0 && this.notifiedDoneAt >= this.lastActivityAt) return void 0;
				this.notifiedDoneAt = now;
				return this.event("done", snapshot.sessionLabel, void 0);
			}
			rememberQuestionKey(key) {
				this.seenQuestionKeys.add(key);
				if (this.seenQuestionKeys.size > MAX_SEEN_QUESTION_KEYS) {
					const oldest = this.seenQuestionKeys.values().next();
					if (!oldest.done) this.seenQuestionKeys.delete(oldest.value);
				}
			}
			event(kind, sessionLabel, questionKey) {
				const text = this.format(kind, sessionLabel);
				const tag = kind === "question" && questionKey !== void 0 ? `dsh-task-question-${sanitizeTagFragment(questionKey) || "pending"}` : "dsh-task-done";
				return Object.freeze({
					kind,
					title: text.title,
					body: text.body,
					tag
				});
			}
		};
		/**
		* Mirror of the composer busy signal used for media actions: the run is busy
		* while the composer is aria-busy, disabled, read-only, or non-interactive.
		*/
		function readComposerBusyState(root) {
			if (typeof root.querySelector !== "function") return false;
			const card = root.querySelector("[data-composer-card]");
			if (card === null || typeof card.getAttribute !== "function" || typeof card.querySelector !== "function") return false;
			if (card.getAttribute("aria-busy") === "true") return true;
			const field = card.querySelector("textarea,input,[contenteditable=\"true\"],[contenteditable=\"plaintext-only\"]");
			if (field === null) return false;
			return field.disabled === true || field.readOnly === true || field.getAttribute?.("aria-disabled") === "true";
		}
		/**
		* Best-effort session label for the notification body, bounded for the wire.
		* Callers accept that titles may name the active session on the lock screen.
		*/
		function readSessionLabel(title) {
			if (typeof title !== "string") return "";
			return title.normalize("NFC").replace(/[\u0000-\u001f\u007f]+/gu, " ").trim().slice(0, 80);
		}
		/** Whether the document currently shows a card that waits for user input. */
		function hasPendingInputQuestion(root) {
			if (typeof root.querySelector !== "function") return false;
			return root.querySelector("[data-question-key],[data-plan-review-key]") !== null;
		}
		/** Stable key of the waiting input card, when the DOM exposes one. */
		function pendingInputQuestionKey(root) {
			if (typeof root.querySelector !== "function") return void 0;
			const card = root.querySelector("[data-question-key],[data-plan-review-key]");
			const getAttribute = card?.getAttribute;
			if (typeof getAttribute !== "function") return void 0;
			const key = getAttribute.call(card, "data-question-key") ?? getAttribute.call(card, "data-plan-review-key");
			if (key === null || key === "") return void 0;
			return key;
		}
		/** Observe assistant-side conversation mutations; returns a disposer. */
		function observeTaskActivity(target, onActivity, observe = typeof MutationObserver === "function" ? MutationObserver : void 0) {
			if (observe === void 0) return () => void 0;
			const observer = new observe(() => {
				onActivity();
			});
			try {
				observer.observe(target, {
					childList: true,
					characterData: true,
					subtree: true
				});
			} catch {
				return () => void 0;
			}
			return () => {
				observer.disconnect();
			};
		}
		function readNativeBridge() {
			if (typeof window === "undefined") return void 0;
			const bridge = window.__DSH_MOBILE_NATIVE__;
			if (bridge === void 0 || typeof bridge.capabilities !== "function" || typeof bridge.invoke !== "function") return void 0;
			return bridge;
		}
		/** Parse a `task-notify` SSE payload; rejects anything malformed or empty. */
		function parseTaskNotifyPayload(value) {
			let record;
			if (typeof value === "string") try {
				const parsed = JSON.parse(value);
				if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return void 0;
				record = parsed;
			} catch {
				return;
			}
			else if (value !== null && typeof value === "object" && !Array.isArray(value)) record = value;
			else return void 0;
			if (typeof record.sessionId !== "string" || record.sessionId.trim() === "") return void 0;
			const turn = typeof record.turn === "number" && Number.isSafeInteger(record.turn) && record.turn >= 0 ? record.turn : 0;
			return Object.freeze({
				sessionId: record.sessionId.slice(0, 128),
				turn
			});
		}
		/** Parse the small authenticated event used when the Host revokes this device. */
		function isDeviceRevokedPayload(value) {
			let record;
			if (typeof value === "string") try {
				const parsed = JSON.parse(value);
				if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return false;
				record = parsed;
			} catch {
				return false;
			}
			else if (value !== null && typeof value === "object" && !Array.isArray(value)) record = value;
			else return false;
			return record.reason === "device_revoked";
		}
		/** Tell the Android shell to transition the active record to the revoked state. */
		function fireDeviceRevoked() {
			const bridge = readNativeBridge();
			if (bridge === void 0) return false;
			bridge.invoke("device.revoked", {}).catch(() => void 0);
			return true;
		}
		/**
		* Deliver one notification through the native bridge when available.
		* Returns false when there is no bridge (desktop browsers keep their own
		* UI) so callers can fall back; a denial flips the module sticky flag via
		* onDenied for the session-lifetime nag guard.
		*/
		function fireTaskNotifyEvent(event, onDenied) {
			const bridge = readNativeBridge();
			if (bridge === void 0) return false;
			Promise.resolve().then(() => bridge.capabilities()).then((capabilities) => {
				if (!capabilities.includes("notification.notify")) return;
				return bridge.invoke("notification.notify", {
					title: event.title,
					body: event.body,
					tag: event.tag
				});
			}).then(() => void 0, (error) => {
				const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
				if ((code === "permission_denied" || code === "denied") && onDenied !== void 0) onDenied();
			});
			return true;
		}
		/**
		* Watch the rendered conversation for finished runs and waiting questions,
		* notifying through the native bridge while the page is hidden. Returns a
		* disposer. Silent when no native bridge exists (desktop browsers keep their
		* own UI) or after the user denies the permission.
		*/
		function installTaskCompletionWatcher(options) {
			if (typeof document === "undefined" || typeof window === "undefined") return () => void 0;
			const tracker = new TaskNotifyTracker({ format: options.label });
			const completionFallback = options.completionFallback ?? true;
			let notifyBlocked = false;
			let timer = 0;
			let anchorTimer = 0;
			const fire = (event) => {
				if (notifyBlocked) return;
				if (!fireTaskNotifyEvent(event, () => {
					notifyBlocked = true;
				})) return;
			};
			const evaluateNow = () => {
				const busy = completionFallback && readComposerBusyState(document);
				const event = tracker.evaluate({
					pageHidden: document.hidden,
					pendingQuestion: hasPendingInputQuestion(document),
					questionKey: pendingInputQuestionKey(document),
					sessionLabel: readSessionLabel(document.title),
					composerBusy: busy
				});
				if (event !== void 0) fire(event);
				scheduleAnchorTimer();
			};
			const scheduleAnchorTimer = () => {
				const delay = tracker.pendingAnchorDelayMs();
				if (delay === void 0) {
					if (anchorTimer !== 0) {
						window.clearTimeout(anchorTimer);
						anchorTimer = 0;
					}
					return;
				}
				if (anchorTimer !== 0) return;
				anchorTimer = window.setTimeout(() => {
					anchorTimer = 0;
					evaluateNow();
				}, delay);
			};
			const disposeObservation = observeTaskActivity(document.documentElement, () => {
				if (completionFallback) tracker.markActivity();
				evaluateNow();
			});
			const onVisibility = () => {
				evaluateNow();
			};
			document.addEventListener("visibilitychange", onVisibility);
			if (typeof window.setInterval === "function") timer = window.setInterval(evaluateNow, 15e3);
			evaluateNow();
			return () => {
				disposeObservation();
				document.removeEventListener("visibilitychange", onVisibility);
				if (timer !== 0) window.clearInterval(timer);
				if (anchorTimer !== 0) window.clearTimeout(anchorTimer);
			};
		}
		//#endregion
		//#region src/mobile-composer-toolbar.ts
		/**
		* Compact the stock InputBar without changing its React ownership, handlers,
		* activity tree or the two groups observed by DSH's model-width controller.
		* Extra controls wrap inside their own group; menus remain overflow-visible.
		*/
		const MOBILE_COMPOSER_TOOLBAR_STYLES = `
/* These markers are attached only to the stock composer on the mobile page.
   Body portals and inline dialogs are not part of the compact toolbar. */
[data-dsh-mobile-composer-row] { min-width:0 !important; max-width:100% !important; }
[data-dsh-mobile-composer-tools]:not([hidden]),[data-dsh-mobile-composer-controls]:not([hidden]) { flex-wrap:wrap !important; min-width:0 !important; max-width:100% !important; }
[data-dsh-mobile-composer-tools] > :not(:where(dialog,[popover],[role="dialog"],[role="menu"],[role="listbox"],[data-trigger-menu])),
[data-dsh-mobile-composer-tools] > [data-slot] > :not(:where(dialog,[popover],[role="dialog"],[role="menu"],[role="listbox"],[data-trigger-menu])),
[data-dsh-mobile-composer-controls] > :not(:where(dialog,[popover],[role="dialog"],[role="menu"],[role="listbox"],[data-trigger-menu])),
[data-dsh-mobile-composer-controls] > [data-slot] > :not(:where(dialog,[popover],[role="dialog"],[role="menu"],[role="listbox"],[data-trigger-menu])) { min-width:0 !important; max-width:100% !important; }
[data-dsh-mobile-composer-tools] button:not(:where(dialog *,[popover] *,[role="dialog"] *,[role="menu"] *,[role="listbox"] *,[data-trigger-menu] *)),
[data-dsh-mobile-composer-controls] button:not(:where(dialog *,[popover] *,[role="dialog"] *,[role="menu"] *,[role="listbox"] *,[data-trigger-menu] *)) { white-space:normal !important; overflow-wrap:anywhere !important; }
@media (max-width:720px) {
  [data-dsh-mobile-composer-row] button:not([role="switch"]):not(:where(dialog *,[popover] *,[role="dialog"] *,[role="menu"] *,[role="listbox"] *,[data-trigger-menu] *)) { min-width:44px !important; min-height:44px !important; touch-action:manipulation; }
  [data-dsh-mobile-composer-trailing] > button[class*="_primary"] { min-width:44px !important; flex-shrink:0 !important; }
  [data-dsh-mobile-composer-row] { display:flex !important; flex-wrap:wrap !important; align-items:center !important; gap:4px 8px !important; min-width:0 !important; max-width:100% !important; }
  [data-dsh-mobile-composer-tools]:not([hidden]) { display:flex !important; flex:0 1 auto !important; flex-wrap:wrap !important; width:auto !important; min-width:0 !important; max-width:100% !important; gap:6px !important; }
  /* The activity seat can be wider than a single icon. Intrinsic demand, not
     a fixed 100px reserve, decides whether this intact group needs to wrap. */
  [data-dsh-mobile-composer-trailing] { display:flex !important; flex:1 0 auto !important; flex-wrap:nowrap !important; width:auto !important; min-width:0 !important; max-width:100% !important; gap:6px !important; margin-left:0 !important; justify-content:flex-end !important; }
  [data-dsh-mobile-composer-controls]:not([hidden]) { display:flex !important; flex:1 1 0 !important; flex-wrap:wrap !important; justify-content:flex-end !important; min-width:44px !important; max-width:100% !important; gap:6px !important; }
  [data-dsh-mobile-composer-model] { flex:0 1 auto !important; width:auto !important; min-width:44px !important; max-width:100% !important; }
  [data-dsh-mobile-composer-model-trigger] { box-sizing:border-box !important; width:100% !important; max-width:100% !important; min-width:0 !important; padding-left:6px !important; padding-right:4px !important; }
  [data-dsh-mobile-composer-model-label] { flex:1 1 auto !important; max-width:none !important; min-width:0 !important; overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important; }
}
`;
		//#endregion
		//#region src/native-mobile.ts
		/**
		* Viewport below which the injected chrome becomes an overlay drawer: the
		* sidebar slides in as a sheet, the right panel as a drawer, and the scrim dims
		* the page behind them. The stylesheet and the scrim's visibility both read
		* this query, so a wider viewport never grows drawer chrome whose rules cannot
		* style it.
		*/
		const NATIVE_MOBILE_OVERLAY_QUERY = "(max-width:720px)";
		/** Mobile feature and compatibility rules applied to DSH React surfaces. */
		const NATIVE_MOBILE_STYLES = `
/* The surface appends chrome to <body> on every non-loopback page load, but
   every rule that gives that chrome a box lives inside the overlay query
   below. Outside the query the scrim kept the UA button box: an empty,
   nameless button in normal flow at the document's bottom-left, whose click
   still collapsed the sidebar. Keep the neutral state explicitly invisible —
   the query restores the fixed scrim, and its more specific [hidden] rule
   keeps winning there. */
 .dsh-native-mobile-backdrop,.dsh-mobile-branch-toast,.dsh-mobile-media-toast { display:none; }
 /* The content-font preference may exceed Safari's focused-editable minimum.
    The html-level class exists on every non-desktop mobile page, so it also
    covers body-level portals (model picker search) the center column never
    contained; the center marker stays alongside it because a disposed
    surface removes the html class while styles applied from its string can
    outlive the class on a page that still carries the center column. */
 html.dsh-native-mobile-active :is(input,textarea,[contenteditable="true"],[contenteditable="plaintext-only"],[contenteditable=""]),
 [data-dsh-mobile-center] :is(input,textarea,[contenteditable="true"],[contenteditable="plaintext-only"],[contenteditable=""]) { font-size:max(16px,1em,var(--dsh-content-font-size,1em)) !important; }
 .dsh-mobile-settings_row { display:flex; align-items:center; gap:8px; padding:16px 0; border-bottom:0.5px solid var(--dsw-alias-border-l2); }
 .dsh-mobile-settings_rowText { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; padding-right:48px; }
 .dsh-mobile-settings_title { color:var(--dsw-alias-label-primary); font-size:14px; font-weight:400; line-height:22px; }
 .dsh-mobile-settings_desc { color:var(--dsw-alias-label-tertiary); font-size:12px; font-weight:400; line-height:18px; }
 .dsh-mobile-settings_selector { display:inline-flex; align-items:center; justify-content:center; min-width:max-content; min-height:48px; padding:0 14px; border:0; border-radius:24px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
 .dsh-mobile-settings_selector:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
 .dsh-mobile-settings_selector:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover)); }
 .dsh-mobile-settings_selector:focus-visible { outline:2px solid var(--dsw-alias-label-primary-bluish,#2563eb); outline-offset:2px; }
 .dsh-mobile-settings_selector:disabled { cursor:wait; opacity:.55; }
 .dsh-mobile-settings_fontControls { display:flex; align-items:center; gap:8px; flex-shrink:0; }
 .dsh-mobile-settings_fontControls button { min-width:48px; padding:0 12px; }
 .dsh-mobile-settings_fontControls output { min-width:42px; text-align:center; font-variant-numeric:tabular-nums; }
 .dsh-mobile-settings_fontDetails { min-width:0; padding:0 0 16px; border-bottom:0.5px solid var(--dsw-alias-border-l2); }
 .dsh-mobile-settings_fontDetails > summary { display:list-item; min-height:48px; padding:14px 0; box-sizing:border-box; color:var(--dsw-alias-label-primary); font-size:14px; cursor:pointer; }
 .dsh-mobile-settings_fontDetails .dsh-mobile-settings_rowText { padding-right:8px; }
 .dsh-mobile-settings_fontFamily { display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0; padding:12px 0; }
 .dsh-mobile-settings_fontFamily > span { flex:1 1 100px; }
 .dsh-mobile-settings_fontFamily input { box-sizing:border-box; flex:1 1 180px; width:100%; min-width:0; min-height:48px; padding:8px 12px; border:0.5px solid var(--dsw-alias-border-l2); border-radius:10px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; }
 .dsh-mobile-settings_fontFamily input:focus-visible,.dsh-mobile-settings_fontDetails > summary:focus-visible { outline:2px solid var(--dsw-alias-label-primary-bluish,#2563eb); outline-offset:2px; }
 /* The mobile row replaces the Host-backed font control, not the theme selector. */
 html.dsh-native-mobile-active [data-slot="settings.general.item"]:has([data-mobile-font-setting]) > :not([data-mobile-font-setting])[class*="_row"]:has([class*="_control"] > [class*="_stepper"] > [class*="_arrows"]) { display:none !important; }
@media ${NATIVE_MOBILE_OVERLAY_QUERY} {
  html.dsh-native-mobile-active,html.dsh-native-mobile-active body { width:100%; height:100%; overflow:hidden; }
  html.dsh-native-mobile-active { --dsh-mobile-motion-duration:200ms; --dsh-mobile-motion-ease:cubic-bezier(.22,1,.36,1); }
  html.dsh-native-mobile-active :is(a,button,[role="button"],[role="tab"],[tabindex]) { -webkit-tap-highlight-color:transparent; }
  html.dsh-native-mobile-active [data-dsh-mobile-sidebar] [role="treeitem"] { -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
  html.dsh-native-mobile-active[data-dsh-mobile-input="touch"] :is(a,button,[role="button"],[role="tab"],[tabindex]):focus { outline:none !important; }
  html.dsh-native-mobile-active [role="tooltip"] { display:none !important; }
  /* Touch has no persistent hover affordance: keep workspace rows neutral after a tap. */
  html.dsh-native-mobile-active [data-dsh-mobile-sidebar] { --dsw-alias-interactive-bg-hover:transparent !important; }
  html.dsh-native-mobile-active [data-dsh-mobile-sidebar] [role="treeitem"]:is(:hover,:active,:focus,[aria-selected="true"]),
  html.dsh-native-mobile-active [data-dsh-mobile-sidebar] [class*="_sessionRow"][class*="_selected"],
  html.dsh-native-mobile-active [data-dsh-mobile-sidebar] [class*="_searchResultRow"][class*="_selected"] { background:transparent !important; outline:0 !important; box-shadow:none !important; }
  /* Sidebar row menus are hover-only on desktop. Touch has no hover, so keep
     the ellipsis action visible and give it a reliable hit target. */
  html.dsh-native-mobile-active [data-dsh-mobile-sidebar] [class*="_rowActions"] { display:inline-flex !important; align-items:center !important; gap:8px !important; }
  html.dsh-native-mobile-active [data-dsh-mobile-sidebar] [class*="_sessionRow"] [class*="_time"] { display:none !important; }
  /* The always-visible pin action already conveys pinned state. Desktop only
     hides this passive marker on hover; touch rows must hide it throughout. */
  html.dsh-native-mobile-active [data-dsh-mobile-sidebar] [class*="_sessionRow"] [class*="_pinIndicator"] { display:none !important; }
  html.dsh-native-mobile-active [data-dsh-mobile-sidebar] [class*="_rowActions"] button { box-sizing:border-box !important; width:32px !important; min-width:32px !important; height:32px !important; min-height:32px !important; }
  [data-dsh-mobile-frame] { grid-template-columns:0 minmax(0,1fr) 0 !important; width:100% !important; height:100dvh !important; overflow:hidden !important; }
  [data-dsh-mobile-center] { grid-column:2 !important; width:100vw !important; min-width:0 !important; }
  [data-dsh-mobile-center] > * { min-width:0 !important; }
  [data-dsh-mobile-header] { box-sizing:border-box !important; width:calc(100% - 16px) !important; margin:0 8px !important; min-width:0; padding-top:max(4px,env(safe-area-inset-top)) !important; padding-right:8px !important; padding-left:42px !important; }
  [data-dsh-mobile-header] :is([class*="_titleRow"],[class*="_headerLeading"]) { touch-action:pan-y; }
  [data-dsh-mobile-header] [class*="_titleRow"] { box-sizing:border-box !important; display:flex !important; align-items:center !important; min-width:0; min-height:32px !important; height:32px !important; gap:6px !important; padding:0 6px !important; }
  [data-dsh-mobile-header] [class*="_titleCluster"] { min-width:0; }
  [data-dsh-mobile-header] [class*="_crumbs"] { min-width:0; overflow:hidden; }
  [data-dsh-mobile-header] [class*="_crumb"] { max-width:46vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  /* Nested header actions (including the Jobs menu) must paint outside the row. */
  [data-dsh-mobile-header] [class*="_headerActions"] { flex:none; min-width:max-content; overflow:visible; }
  [data-dsh-mobile-header] [class*="_headerUtilities"] { gap:2px !important; }
  [data-dsh-mobile-header] [class*="_sessionLogButton"] { width:40px; min-width:40px; padding:0 !important; overflow:hidden; color:transparent; font-size:0 !important; }
  [data-dsh-mobile-header] [class*="_sessionLogButton"] > * { display:none !important; }
  [data-dsh-mobile-header] [class*="_sessionLogButton"]::after { color:var(--dsw-alias-label-primary, #171a21); content:"Log"; font-size:11px; font-weight:600; }
  html[data-dsh-mobile-language="zh"] [data-dsh-mobile-header] [class*="_sessionLogButton"]::after { content:"日志"; }
  [data-dsh-mobile-header] [class*="_tabs"] { box-sizing:border-box !important; width:max-content !important; max-width:calc(100% - 58px) !important; min-height:28px !important; height:28px !important; margin-top:0 !important; padding-left:6px !important; padding-right:6px !important; overflow-x:auto; scrollbar-width:none; }
  [data-dsh-mobile-header] [class*="_tab"] { padding-bottom:5px !important; }
  [data-dsh-mobile-header] [class*="_tabs"]::-webkit-scrollbar { display:none; }
  [data-dsh-mobile-sidebar] { position:fixed !important; z-index:240 !important; inset:0 auto 0 0 !important; width:0 !important; overflow:visible !important; }
  [data-dsh-mobile-sidebar-root] { position:fixed !important; z-index:241 !important; inset:max(env(safe-area-inset-top),0px) auto 0 0 !important; height:auto !important; transition:width 180ms var(--dsh-mobile-motion-ease),box-shadow 180ms ease !important; }
  [data-dsh-mobile-sidebar][data-open="true"] [data-dsh-mobile-sidebar-root] { width:min(88vw,340px) !important; padding-top:0 !important; box-shadow:18px 0 46px rgb(15 23 42 / 18%); }
  [data-dsh-mobile-sidebar][data-open="true"] [data-dsh-mobile-sidebar-root] [class*="_logoRow"] { height:52px !important; padding:4px 0 4px 4px !important; margin-bottom:4px !important; }
  [data-dsh-mobile-sidebar][data-open="false"] [data-dsh-mobile-sidebar-root] { width:0 !important; border:0 !important; background:transparent !important; box-shadow:none !important; overflow:visible !important; }
  [data-dsh-mobile-sidebar][data-open="false"] [data-dsh-mobile-sidebar-root] > :not(:has([data-dsh-mobile-toggle])) { display:none !important; }
  [data-dsh-mobile-sidebar][data-open="false"] [data-dsh-mobile-sidebar-root] > :has([data-dsh-mobile-toggle]) { position:fixed !important; z-index:244 !important; top:env(safe-area-inset-top) !important; left:0 !important; box-sizing:border-box !important; width:50px !important; height:52px !important; padding:4px !important; border:0 !important; background:transparent !important; }
   [data-dsh-mobile-sidebar][data-open="false"] [data-dsh-mobile-sidebar-root] > :has([data-dsh-mobile-toggle]) > :not([data-dsh-mobile-toggle]) { display:none !important; }
   /* The stock settings shell is mounted under the collapsed sidebar. Let
      its fixed overlay escape the zero-width drawer while it is open. */
   [data-dsh-mobile-sidebar]:has([data-dsh-mobile-settings]) { width:100vw !important; inset:0 !important; }
   [data-dsh-mobile-sidebar]:has([data-dsh-mobile-settings]) > * { width:100vw !important; overflow:visible !important; }
   [data-dsh-mobile-toggle] { width:44px !important; height:44px !important; min-width:44px !important; min-height:44px !important; }
  [data-dsh-mobile-sidebar][data-open="false"] [data-dsh-mobile-toggle] > svg[class*="_railFish"] { transform:translateY(-4px) !important; }
  .dsh-native-mobile-backdrop { display:block; position:fixed; z-index:235; inset:env(safe-area-inset-top) 0 0; border:0; background:rgb(15 23 42 / 32%); }
  .dsh-native-mobile-backdrop:not([hidden]) { animation:dsh-mobile-fade-in var(--dsh-mobile-motion-duration) ease-out; }
  .dsh-native-mobile-backdrop[hidden] { display:none; }
  [data-dsh-mobile-details] { position:fixed !important; z-index:250 !important; inset:0 0 0 auto !important; width:min(94vw,460px) !important; max-width:none !important; transform:translateX(100%); transition:transform var(--dsh-mobile-motion-duration) var(--dsh-mobile-motion-ease); background:var(--dsw-alias-bg-layer-1, #fff); box-shadow:-18px 0 46px rgb(15 23 42 / 18%); }
  [data-dsh-mobile-details][data-open="true"] { transform:translateX(0); }
  [data-dsh-mobile-handle] { display:none !important; }
  [data-dsh-mobile-settings] { flex-direction:column !important; width:100vw !important; height:100dvh !important; max-width:none !important; border-radius:0 !important; animation:dsh-mobile-panel-in var(--dsh-mobile-motion-duration) var(--dsh-mobile-motion-ease); }
  [data-dsh-mobile-settings-nav] { flex:none !important; width:100% !important; padding:max(14px,env(safe-area-inset-top)) 12px 8px !important; gap:10px !important; border-bottom:1px solid var(--dsw-alias-border-l2,#e8ebef); }
  [data-dsh-mobile-settings-nav] [class*="_navTitle"] { padding:0 8px !important; font-size:18px !important; line-height:28px !important; }
  [data-dsh-mobile-settings-list] { flex-direction:row !important; gap:4px !important; overflow-x:auto !important; scrollbar-width:none; }
  [data-dsh-mobile-settings-list]::-webkit-scrollbar { display:none; }
  [data-dsh-mobile-settings-list] [class*="_navCell"] { flex:0 0 auto !important; min-width:max-content !important; height:44px !important; padding:10px 12px !important; }
  [data-dsh-mobile-settings-list] [aria-current="true"] { border-color:transparent !important; outline:0 !important; box-shadow:none !important; }
  [data-dsh-mobile-settings-content] { flex:1 1 auto !important; width:100% !important; min-height:0 !important; }
   [data-dsh-mobile-settings-header] { height:48px !important; min-height:48px !important; padding:10px 12px 6px !important; }
   [data-dsh-mobile-settings-header] [class*="_close"] { width:36px !important; height:36px !important; }
   [data-dsh-mobile-settings-options] { box-sizing:border-box !important; width:100% !important; padding:4px 16px max(24px,env(safe-area-inset-bottom)) !important; overflow-x:hidden !important; }
   [data-dsh-mobile-settings-options] > * { width:100% !important; min-width:0 !important; }
   [data-dsh-mobile-settings-options] [data-slot="settings.general.item"] > [class*="_row"] { flex-direction:column !important; align-items:stretch !important; gap:12px !important; }
  [data-dsh-mobile-settings-options] [data-slot="settings.general.item"] [class*="_rowText"] { width:100% !important; padding-right:0 !important; }
  [data-dsh-mobile-settings-options] [data-slot="settings.general.item"] [class*="_selector"] { box-sizing:border-box !important; align-self:flex-start !important; justify-content:space-between !important; min-width:0 !important; min-height:48px !important; max-width:100% !important; }
  [data-dsh-mobile-settings-options] :is(input,select,textarea,button) { max-width:100%; }
  [data-dsh-mobile-settings-options] :is(input,select,textarea) { box-sizing:border-box; width:100%; min-width:0; }
  /* Local steppers and native page-scale controls keep their own touch targets. */
  [data-dsh-mobile-settings-options] [data-slot="settings.general.item"] .dsh-mobile-settings_fontControls button { flex:0 0 auto !important; width:auto !important; min-width:48px !important; align-self:center !important; justify-content:center !important; }
  [data-dsh-mobile-settings-options] [data-slot="settings.general.item"] .dsh-mobile-settings_fontControls select { flex:0 0 auto !important; width:auto !important; min-width:76px !important; align-self:center !important; }
  [data-dsh-mobile-settings-options] [data-mobile-font-setting] .dsh-mobile-settings_row { flex-wrap:wrap !important; }
  [data-dsh-mobile-settings-options] [data-mobile-font-setting] .dsh-mobile-settings_rowText { flex:1 1 140px !important; width:auto !important; padding-right:8px !important; }
  [data-dsh-mobile-settings-options] [class*="_head"] { min-width:0; flex-wrap:wrap; }
  /* Provider names may shrink, but their edit/delete actions remain horizontal
     and retain a full touch target on narrow screens. */
  [data-dsh-mobile-settings-options] [class*="_rowHead"]:has(> [class*="_rowIdentity"]) { flex-wrap:nowrap !important; align-items:center !important; }
  [data-dsh-mobile-settings-options] [class*="_rowIdentity"] { flex:1 1 auto !important; min-width:0 !important; overflow:hidden !important; }
  [data-dsh-mobile-settings-options] [class*="_rowName"] { min-width:0 !important; overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important; }
  [data-dsh-mobile-settings-options] [class*="_rowActions"] { flex:0 0 auto !important; flex-wrap:nowrap !important; width:max-content !important; min-width:max-content !important; max-width:none !important; }
  [data-dsh-mobile-settings-options] [class*="_rowActions"] button { flex:none !important; width:auto !important; min-width:44px !important; max-width:none !important; min-height:44px !important; padding-inline:10px !important; white-space:nowrap !important; word-break:keep-all !important; writing-mode:horizontal-tb !important; }
  [data-dsh-mobile-settings-content][data-dsh-mobile-view-transition="true"],
  [data-dsh-mobile-view][data-dsh-mobile-view-transition="true"] { animation:dsh-mobile-view-in var(--dsh-mobile-motion-duration) var(--dsh-mobile-motion-ease); }
  /* Markdown tables use content-sized columns. Small tables fill the phone;
     wider tables keep readable cells and scroll inside their own region. */
  [data-dsh-mobile-table-scroll] { box-sizing:border-box; width:100%; max-width:100%; overflow-x:auto; overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch; }
  [data-dsh-mobile-table-scroll] table { display:table !important; width:max-content !important; min-width:100% !important; max-width:none !important; table-layout:auto !important; }
  [data-dsh-mobile-table-scroll] :is(th,td) { box-sizing:border-box; min-width:8ch; max-width:32ch; overflow-wrap:anywhere; word-break:break-word; vertical-align:top; }
  [data-dsh-mobile-center] pre { max-width:100%; overflow-x:auto; }
  [data-dsh-mobile-center] :is(img,video,canvas,svg) { max-width:100%; }
  [data-dsh-mobile-message-scroll] { box-sizing:border-box !important; width:100% !important; padding:8px 10px 20px !important; }
  [data-dsh-mobile-history-loader] { position:relative !important; min-height:1px !important; }
  [data-dsh-mobile-history-loader] button:not(:disabled) { position:absolute !important; width:1px !important; height:1px !important; margin:-1px !important; padding:0 !important; clip-path:inset(50%) !important; opacity:0 !important; overflow:hidden !important; pointer-events:none !important; }
  [data-dsh-mobile-history-loader] button:disabled { min-height:28px !important; padding:4px 12px !important; }
  /* DSH's sibling margins exclude hidden and empty Chat Node Seats. Keep that
     spacing rule so searchable hidden seats contribute no folded-turn gaps. */
  [data-dsh-mobile-message-column] { box-sizing:border-box !important; width:100% !important; max-width:none !important; margin:0 !important; padding:0 !important; gap:0 !important; --dsh-chat-flow-gap:10px; }
  [data-dsh-mobile-message-column] > * { width:100% !important; max-width:100% !important; }
  [data-dsh-mobile-message-column] [data-disclosure-row] { box-sizing:border-box !important; display:grid !important; grid-template-columns:16px minmax(0,1fr) !important; grid-auto-rows:auto !important; align-items:center !important; column-gap:6px !important; width:100% !important; height:auto !important; min-height:40px !important; padding:4px 0 !important; }
  [data-dsh-mobile-message-column] [data-disclosure-row] > [class*="_leading"] { grid-column:1 !important; grid-row:1 !important; margin-right:0 !important; }
  [data-dsh-mobile-message-column] [data-disclosure-row] > [class*="_title"] { grid-column:2 !important; grid-row:1 !important; min-width:0 !important; overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important; }
  [data-dsh-mobile-message-column] [data-disclosure-row] > :is([class*="_sep"],[class*="_separator"]) { display:none !important; }
  [data-dsh-mobile-message-column] [data-disclosure-row] > :is([class*="_summary"],[class*="_fileLink"]) { grid-column:2 !important; grid-row:2 !important; width:100% !important; min-width:0 !important; max-width:100% !important; overflow:hidden !important; line-height:19px !important; text-overflow:ellipsis !important; white-space:nowrap !important; }
  [data-dsh-mobile-message-column] [data-disclosure-row] > [class*="_summarySuffix"] { grid-column:2 !important; grid-row:3 !important; margin-left:0 !important; }
  [data-dsh-mobile-message-column] [data-context-fields] > * { display:grid !important; grid-template-columns:minmax(72px,30%) minmax(0,1fr) !important; gap:4px 10px !important; }
  [data-dsh-mobile-message-column] [class*="_ioSection"] { grid-template-columns:1fr !important; row-gap:4px !important; }
  [data-dsh-mobile-message-column] [class*="_body"] { max-width:100% !important; overflow-wrap:anywhere; }
  /* Keep folded and expanded reasoning visually separate from the reply. */
  [data-dsh-mobile-message-column] [class*="_body"] > div:has(> [data-variant="think"]) { margin-bottom:12px !important; }
  [data-dsh-mobile-center] [data-composer-card] ~ [class*="_root"]:not(:where(input,textarea,[contenteditable])),
  [data-dsh-mobile-center] [data-composer-card] ~ * [class*="_root"]:not(:where(input,textarea,[contenteditable])) { box-sizing:border-box !important; width:100% !important; max-width:100% !important; margin-bottom:-6px !important; padding:3px 4px 0 !important; font-size:11px !important; line-height:18px !important; white-space:normal !important; overflow:visible !important; text-overflow:clip !important; }
  [data-dsh-mobile-center] [data-composer-card] ~ [class*="_root"] [class*="_sep"],
  [data-dsh-mobile-center] [data-composer-card] ~ * [class*="_root"] [class*="_sep"] { margin:0 6px !important; }
  /* Composer dock stats strip (turns/steps/tokens) reads small on phones.
     :not(:where(...)) keeps editables exempt at zero specificity cost, so
     the small !important fonts cannot beat the 16px editable floor while
     the dock spacing rules keep their cascade position. */
  [data-dsh-mobile-center] [data-slot="conversation.composer.dock"] [class*="_root"]:not(:where(input,textarea,[contenteditable])) { font-size:10px !important; line-height:16px !important; }
  /* The context ring is a composer-metadata _root too, so the metadata rule
     above stretched it across the whole dock. It cannot shrink, which left the
     session statistics beside it a few pixels wide, every number clipped to an
     ellipsis. Keep the ring at its own size and let it hold the row the numbers
     are on. */
  [data-dsh-mobile-center] [data-composer-card] ~ * [class*="_root"]:has(> [class*="_trigger"][aria-haspopup="dialog"]) { width:auto !important; max-width:none !important; flex:0 0 auto !important; }
  /* Slot entries participate in this flex layout through display:contents.
     Keep core statistics and the meter together; extra entries use their own
     rows instead of taking the statistics' remaining width on phones. */
  [data-dsh-mobile-center] [class*="_dock"]:has([data-composer-stats]) { display:flex !important; flex-wrap:wrap !important; justify-content:flex-start !important; align-items:center !important; column-gap:12px !important; row-gap:2px !important; width:100% !important; max-width:100% !important; }
  /* Dock row gaps replace the single-row metadata's negative margin. */
  [data-dsh-mobile-center] [class*="_dock"]:has([data-composer-stats]) > *,
  [data-dsh-mobile-center] [class*="_dock"]:has([data-composer-stats]) [data-slot="conversation.composer.dock"] > * { margin-bottom:0 !important; }
  [data-dsh-mobile-center] [class*="_dock"]:has([data-composer-stats]) [data-slot="conversation.composer.dock"] > :not([data-composer-stats]) { flex:0 1 100% !important; min-width:0 !important; max-width:100% !important; }
  [data-dsh-mobile-center] [class*="_dock"]:has([data-composer-stats]) [data-composer-stats] { order:-2 !important; }
  [data-dsh-mobile-center] [class*="_dock"]:has([data-composer-stats]) > [class*="_root"]:has(> [class*="_trigger"][aria-haspopup="dialog"]) { order:-1 !important; }
  /* Interactive pills expose complete values in their labels and dialogs.
     Static compact or untimed pills have no disclosure, so they may wrap. */
  [data-dsh-mobile-center] [data-composer-card] ~ * [class*="_root"][data-composer-stats] { box-sizing:border-box !important; width:auto !important; max-width:none !important; flex:1 1 0 !important; flex-wrap:nowrap !important; justify-content:flex-start !important; overflow:hidden !important; row-gap:2px !important; }
  [data-dsh-mobile-center] [data-composer-stats] > * { min-width:0 !important; }
  [data-dsh-mobile-center] [data-composer-stats] [class*="_pill"] { display:block !important; min-width:0 !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; }
  [data-dsh-mobile-center] [data-composer-stats] [class*="_pill"] svg { display:inline-block !important; vertical-align:-2px !important; margin-right:6px !important; }
  [data-dsh-mobile-center] [data-composer-stats]:has(span[class*="_pill"]) { flex-wrap:wrap !important; overflow:visible !important; }
  [data-dsh-mobile-center] [data-composer-stats] span[class*="_pill"] { flex:0 1 auto !important; max-width:100% !important; white-space:normal !important; overflow:visible !important; overflow-wrap:anywhere !important; text-overflow:clip !important; }
  /* Message runtime details are inline on desktop. Give the clock/runtime
     label its own wrapping row on narrow screens so TTFT and throughput do
     not push the action buttons or clip at the viewport edge. */
  [data-dsh-mobile-center] [class*="_actions"]:has(> [class*="_timeStart"]),
  [data-dsh-mobile-center] [class*="_actions"]:has(> [class*="_timeEnd"]) { box-sizing:border-box !important; width:100% !important; flex-wrap:wrap !important; justify-content:flex-end !important; height:auto !important; min-height:28px !important; row-gap:2px !important; }
  [data-dsh-mobile-center] [class*="_timeStart"],
  [data-dsh-mobile-center] [class*="_timeEnd"] { box-sizing:border-box !important; flex:1 1 100% !important; order:2 !important; min-width:0 !important; max-width:100% !important; padding:0 !important; line-height:20px !important; text-align:center !important; white-space:normal !important; overflow-wrap:anywhere !important; }
  [data-dsh-mobile-center] [class*="_timeStart"] { box-sizing:border-box !important; flex:1 1 100% !important; order:2 !important; min-width:0 !important; max-width:100% !important; padding:0 !important; line-height:20px !important; text-align:center !important; white-space:normal !important; overflow-wrap:anywhere !important; }
  [data-dsh-mobile-center] [class*="_timeStart"] [class*="_runTimeDot"],
  [data-dsh-mobile-center] [class*="_timeEnd"] [class*="_runTimeDot"] { margin:0 6px !important; }
  /* Keep the context meter's legend rows as readable label/value pairs.
     Generic mobile flex rules can otherwise place the rows side by side and
     break Chinese labels in the middle of a word. */
  [data-dsh-mobile-center] [role="dialog"][aria-label*="上下文"],
  [data-dsh-mobile-center] [role="dialog"][aria-label*="Context"] { width:min(264px,calc(100vw - 32px)) !important; min-width:0 !important; max-width:calc(100vw - 32px) !important; }
  [data-dsh-mobile-center] [role="dialog"][aria-label*="上下文"] [class*="_rows"],
  [data-dsh-mobile-center] [role="dialog"][aria-label*="Context"] [class*="_rows"] { display:block !important; }
  [data-dsh-mobile-center] [role="dialog"][aria-label*="上下文"] [class*="_rows"] > [class*="_row"],
  [data-dsh-mobile-center] [role="dialog"][aria-label*="Context"] [class*="_rows"] > [class*="_row"] { display:flex !important; align-items:center !important; justify-content:space-between !important; width:100% !important; min-width:0 !important; white-space:nowrap !important; }
  [data-dsh-mobile-center] [role="dialog"][aria-label*="上下文"] :is(dt,dd),
  [data-dsh-mobile-center] [role="dialog"][aria-label*="Context"] :is(dt,dd) { white-space:nowrap !important; word-break:keep-all !important; }
  .dsh-mobile-branch-toast,.dsh-mobile-media-toast { display:block; position:fixed; z-index:330; top:max(12px,env(safe-area-inset-top)); left:50%; max-width:calc(100vw - 32px); box-sizing:border-box; padding:7px 14px; border:1px solid rgb(15 23 42 / 10%); border-radius:999px; background:rgb(15 23 42 / 92%); color:#fff; font-size:13px; line-height:20px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:0; pointer-events:none; transform:translate(-50%,-8px); transition:opacity 160ms ease,transform 160ms ease; }
  .dsh-mobile-branch-toast[data-visible="true"],.dsh-mobile-media-toast[data-visible="true"] { opacity:1; transform:translate(-50%,0); }
  /* Fallback only: when the native Add group has no item to clone, keep the
     camera action on the same row metrics and tokens as the native menu. */
  .dsh-mobile-media-action { box-sizing:border-box; display:flex; align-items:center; justify-content:flex-start; gap:8px; width:100%; min-width:0; min-height:40px; padding:8px 10px; border:0; border-radius:10px; background:transparent; color:var(--dsw-alias-label-primary,inherit); cursor:pointer; font:inherit; font-size:14px; line-height:22px; text-align:left; touch-action:manipulation; }
  .dsh-mobile-media-action:active { opacity:.72; }
  .dsh-mobile-media-action:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary,#4c82f7); outline-offset:1px; }
  .dsh-mobile-media-action:disabled { cursor:default; opacity:.38; }
  .dsh-mobile-media-action svg { flex:none; width:16px; height:16px; color:var(--dsw-alias-label-tertiary,currentColor); }
  .dsh-mobile-media-action span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  [data-dsh-mobile-center] [class*="_composer"] { padding-left:8px !important; padding-right:8px !important; padding-bottom:max(8px,env(safe-area-inset-bottom)) !important; }
  /* Collapse the scroll viewport only; the editor, draft and attachments stay
     owned by DSH. Toolbar focus keeps the card expanded during menu taps. */
  [data-dsh-mobile-center] [data-composer-card]:not(:focus-within) > [data-input-scroll] { max-height:72px !important; overflow-y:auto !important; }
  [data-dsh-mobile-center] [class*="_root"]:has(> [class*="_card"] textarea) { box-sizing:border-box !important; width:100% !important; padding:0 0 8px !important; }
  [data-dsh-mobile-center] [class*="_root"]:has(> [class*="_card"] textarea) > [class=""]:last-child { display:none !important; }
}
@media (max-width:720px) and (max-height:500px) {
  /* An open software keyboard leaves less room for the focused draft. */
  html.dsh-native-mobile-active [data-dsh-mobile-center] [data-composer-card] > [data-input-scroll] { max-height:72px !important; overflow-y:auto !important; }
}
@media (max-width:720px) and (max-height:400px) {
  [data-dsh-mobile-center] [data-composer-card] { gap:8px !important; }
  html.dsh-native-mobile-active [data-dsh-mobile-center] [data-composer-card] > [data-input-scroll] { max-height:48px !important; }
}
@keyframes dsh-mobile-fade-in { from { opacity:0; } }
@keyframes dsh-mobile-panel-in { from { opacity:.72; transform:translateY(6px); } }
@keyframes dsh-mobile-view-in { from { opacity:.58; transform:translateY(5px); } }
@media (max-width:420px) {
  [data-dsh-mobile-settings-options] [data-slot="settings.general.item"] [class*="_selector"] { align-self:stretch !important; width:100% !important; }
  [data-dsh-mobile-message-column] [data-context-fields] > * { grid-template-columns:1fr !important; }
}
@media (prefers-reduced-motion:reduce) {
  [data-dsh-mobile-sidebar-root],[data-dsh-mobile-details] { transition:none !important; }
  .dsh-native-mobile-backdrop:not([hidden]),[data-dsh-mobile-settings],
  [data-dsh-mobile-settings-content][data-dsh-mobile-view-transition="true"],
  [data-dsh-mobile-view][data-dsh-mobile-view-transition="true"] { animation:none !important; }
}
` + MOBILE_COMPOSER_TOOLBAR_STYLES;
		function classToken(element, suffix) {
			return Array.from(element.classList).some((value) => value.endsWith(suffix));
		}
		function firstByClassSuffix(root, suffix) {
			return Array.from(root.querySelectorAll("[class]")).find((element) => classToken(element, suffix));
		}
		/**
		* Whether this composer is the landing hero rather than the composer of an open
		* conversation. DSH marks the hero composer's root with a `_hero` class and drops
		* it once a session owns the surface, which is the only difference available
		* without the layout's session id.
		*/
		function composerIsLandingHero(composer, depth = 4) {
			let node = composer;
			for (let step = 0; step < depth && node !== null; step += 1) {
				if (classToken(node, "_hero")) return true;
				node = node.parentElement;
			}
			return false;
		}
		/** Resolve only identities published by the current conversation or selected session row. */
		function resolveComposerSessionOrigin(composer, selectedRow, selectedRowToken) {
			const conversationRoot = composer?.closest("[data-conversation-session]") ?? null;
			const conversationId = conversationRoot?.getAttribute("data-conversation-session");
			if (conversationRoot !== null && conversationId) return {
				sessionRoot: conversationRoot,
				sessionId: conversationId
			};
			const dedicatedRoot = composer?.closest("[data-dsh-mobile-session]") ?? null;
			const dedicatedId = dedicatedRoot?.getAttribute("data-dsh-mobile-session");
			if (dedicatedRoot !== null && dedicatedId) return {
				sessionRoot: dedicatedRoot,
				sessionId: dedicatedId
			};
			if (selectedRow === null) return {
				sessionRoot: null,
				sessionId: null
			};
			const identity = selectedRow.getAttribute("data-session-id") ?? selectedRow.getAttribute("aria-label") ?? selectedRow.textContent?.trim() ?? "";
			return {
				sessionRoot: selectedRow,
				sessionId: `${selectedRowToken(selectedRow)}:${identity}`
			};
		}
		/** An id-less non-hero composer still accepts App soft-keyboard line breaks, but not camera results. */
		function activeSessionForSoftEnter(composer, sessionId) {
			return sessionId !== null || composer !== null && composer.closest(".dshm-main") !== null && !composerIsLandingHero(composer);
		}
		/** Find the stock DSH application frame without mistaking a feature card for the shell. */
		function resolveNativeMobileFrame(root, dedicatedCenter) {
			if (dedicatedCenter !== void 0) return void 0;
			return Array.from(root.querySelectorAll("[class]")).find((candidate) => {
				return classToken(candidate, "_frame") && firstByClassSuffix(candidate, "_sidebarCol") !== void 0 && firstByClassSuffix(candidate, "_centerCol") !== void 0;
			});
		}
		/** Mark every mounted settings dialog so its mobile layout does not depend on the conversation shell. */
		function markNativeMobileSettings(root) {
			let marked = 0;
			for (const dialog of root.querySelectorAll("[role=\"dialog\"]")) {
				const children = Array.from(dialog.children);
				const nav = children.find((child) => classToken(child, "_nav"));
				const content = children.find((child) => classToken(child, "_content"));
				if (nav === void 0 || content === void 0) continue;
				dialog.dataset.dshMobileSettings = "true";
				nav.dataset.dshMobileSettingsNav = "true";
				content.dataset.dshMobileSettingsContent = "true";
				firstByClassSuffix(nav, "_navList")?.setAttribute("data-dsh-mobile-settings-list", "true");
				firstByClassSuffix(content, "_header")?.setAttribute("data-dsh-mobile-settings-header", "true");
				firstByClassSuffix(content, "_options")?.setAttribute("data-dsh-mobile-settings-options", "true");
				marked += 1;
			}
			return marked;
		}
		const AUTO_HISTORY_THRESHOLD_PX = 64;
		/** Travel, in CSS pixels, that separates a header strip pan from a tap on a chip. */
		const STRIP_DRAG_THRESHOLD_PX = 8;
		/** Measure flowing title controls without counting an open absolute-positioned menu. */
		function measureHeaderStripOverflow(row) {
			const left = row.getBoundingClientRect().left;
			const controls = Array.from(row.children);
			const actions = row.querySelector(":scope > [class*=\"_titleCluster\"] [class*=\"_headerActions\"]");
			if (actions !== null) controls.push(actions);
			const right = Math.max(left, ...controls.map((control) => control.getBoundingClientRect().right));
			return Math.max(0, right - left - row.clientWidth);
		}
		/** Touch-only pan state; browser pointer cancellation does not interrupt the touch stream. */
		function createHeaderStripPanController(options) {
			let offset = 0;
			let drag;
			let suppressUntil = 0;
			const clamp = (value) => Math.min(Math.max(0, options.range()), Math.max(0, value));
			const setOffset = (value) => {
				const next = clamp(value);
				if (next === offset) return;
				offset = next;
				options.render(offset);
			};
			const end = () => {
				if (drag === void 0) return;
				if (drag.claimed) suppressUntil = options.now() + 400;
				drag = void 0;
			};
			const cancel = () => {
				if (drag?.claimed) suppressUntil = options.now() + 400;
				drag = void 0;
			};
			return {
				offset: () => offset,
				start: (x, y) => {
					drag = {
						x,
						y,
						offset,
						claimed: false
					};
					suppressUntil = 0;
				},
				move: (x, y) => {
					if (drag === void 0) return false;
					const travel = x - drag.x;
					if (!drag.claimed) {
						const drift = y - drag.y;
						if (Math.abs(travel) < STRIP_DRAG_THRESHOLD_PX && Math.abs(drift) < STRIP_DRAG_THRESHOLD_PX) return false;
						if (Math.abs(drift) > Math.abs(travel)) {
							drag = void 0;
							return false;
						}
						drag.claimed = true;
					}
					setOffset(drag.offset - travel);
					return true;
				},
				end,
				cancel,
				sync: () => {
					if (options.range() === 0) {
						drag = void 0;
						suppressUntil = 0;
					}
					setOffset(offset);
				},
				reveal: (left, right, visibleLeft, visibleRight) => {
					if (left < visibleLeft) setOffset(offset - (visibleLeft - left));
					else if (right > visibleRight) setOffset(offset + right - visibleRight);
				},
				resetClickSuppression: () => {
					suppressUntil = 0;
				},
				suppressClick: (inHeader, detail) => {
					if (suppressUntil === 0 || detail === 0) return false;
					const suppress = inHeader && options.now() <= suppressUntil;
					suppressUntil = 0;
					return suppress;
				},
				dispose: () => {
					drag = void 0;
					suppressUntil = 0;
					setOffset(0);
				}
			};
		}
		function controlledFileDragEvent(type, files, initialDropEffect) {
			const event = new Event(type, {
				bubbles: true,
				cancelable: true
			});
			const dataTransfer = {
				dropEffect: initialDropEffect,
				effectAllowed: "copy",
				files: Object.freeze([...files]),
				types: Object.freeze(["Files"])
			};
			Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
			return event;
		}
		/** Ask the official document dragover listener whether the current composer accepts files. */
		function preflightComposerImageDrop(target, files) {
			if (files.length === 0) return false;
			const event = controlledFileDragEvent("dragover", files, "none");
			target.dispatchEvent(event);
			return event.dataTransfer?.dropEffect === "copy";
		}
		/** Dispatch a real drop only after a fresh official-listener preflight; the result is not an attachment ACK. */
		function dispatchComposerImageDrop(target, files) {
			if (!preflightComposerImageDrop(target, files)) return false;
			target.dispatchEvent(controlledFileDragEvent("drop", files, "copy"));
			return true;
		}
		/** Apply the resolved locale independently from the document's possibly different lang attribute. */
		function applyNativeMobileLanguageMarker(root, language) {
			const previous = root.dataset.dshMobileLanguage;
			root.dataset.dshMobileLanguage = language;
			return () => {
				if (root.dataset.dshMobileLanguage !== language) return;
				if (previous === void 0) delete root.dataset.dshMobileLanguage;
				else root.dataset.dshMobileLanguage = previous;
			};
		}
		/** Resolve the supported language used by native-mobile controls. */
		function resolveNativeMobileLanguage(documentLanguage, browserLanguages) {
			return [documentLanguage, ...browserLanguages].map((value) => value.trim().toLowerCase().split(/[-_]/u)[0]).find((value) => value === "it" || value === "en" || value === "zh") ?? "en";
		}
		/** Whether a user-driven scroll moved upward into the automatic history-loading zone. */
		function shouldAutoLoadEarlier(previousTop, currentTop) {
			return currentTop <= AUTO_HISTORY_THRESHOLD_PX && currentTop < previousTop - .5;
		}
		/**
		* Whether the overlay scrim belongs on screen. The scrim exists for the
		* slide-in drawer only — it dims the page and catches the tap that closes the
		* drawer — so it is shown while that drawer is open *and* the overlay query is
		* in force. `hidden` carries the whole decision rather than the width rules
		* alone: the attribute still hides the element when the injected stylesheet
		* never lands (a CSP without inline styles, a shell that drops the <style>
		* node), where the element would otherwise fall back to the UA button box.
		*/
		function drawerScrimVisible(sidebarCollapsed, overlayActive) {
			return !sidebarCollapsed && overlayActive;
		}
		/** Let the stock page close one visible layer before Android navigates its WebView. */
		function installStockMobileBack(view, current, actions) {
			const onBack = (event) => {
				if (!event.cancelable || event.defaultPrevented) return;
				const layers = current();
				if (layers === null) return;
				if (layers.detailsOpen) {
					event.preventDefault();
					actions.closeDetails();
				} else if (layers.drawerOpen) {
					event.preventDefault();
					actions.closeDrawer();
				} else if (layers.mainPanelOpen) {
					event.preventDefault();
					actions.closeMainPanel();
				}
			};
			view.addEventListener("dsh-mobile:native-back", onBack);
			return () => {
				view.removeEventListener("dsh-mobile:native-back", onBack);
			};
		}
		function stockLayoutBackControl(value) {
			return typeof value === "object" && value !== null ? value : void 0;
		}
		/** Whether the stock layout can return from a selected main panel. */
		function stockMainPanelOpen(value) {
			const layout = stockLayoutBackControl(value);
			if (typeof layout?.selectPanel !== "function" || typeof layout.panelInfo?.getSnapshot !== "function") return false;
			const snapshot = layout.panelInfo.getSnapshot();
			return typeof snapshot === "object" && snapshot !== null && typeof snapshot.activePanelId === "string";
		}
		/** Only a known on-screen keyboard in an active App composer may change Enter into a line break. */
		function isSoftKeyboardEnterLineBreak(event, context) {
			if (context.nativeState?.imeVisible !== true || context.nativeState.noHardwareKeyboard !== true || !context.editable || !context.activeSession || context.commandMenuOpen || context.recentlyComposing) return false;
			if (!event.isTrusted || event.key !== "Enter" || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat) return false;
			return !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.getModifierState("AltGraph");
		}
		/** Attach the App-only Enter translation while retaining DSH's original physical-key semantics. */
		function bindComposerSoftEnter(editor, context) {
			let composing = false;
			let composingUntil = 0;
			const onCompositionStart = () => {
				composing = true;
			};
			const onCompositionEnd = () => {
				composing = false;
				composingUntil = performance.now() + 10;
			};
			const onKeyDown = (event) => {
				if (!isSoftKeyboardEnterLineBreak(event, {
					...context(),
					recentlyComposing: composing || editor.hasAttribute("data-composer-composing") || performance.now() < composingUntil
				})) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				editor.dispatchEvent(new KeyboardEvent("keydown", {
					key: "Enter",
					code: "Enter",
					shiftKey: true,
					bubbles: true,
					cancelable: true,
					composed: true
				}));
			};
			editor.addEventListener("compositionstart", onCompositionStart);
			editor.addEventListener("compositionend", onCompositionEnd);
			editor.addEventListener("keydown", onKeyDown, { capture: true });
			return () => {
				editor.removeEventListener("compositionstart", onCompositionStart);
				editor.removeEventListener("compositionend", onCompositionEnd);
				editor.removeEventListener("keydown", onKeyDown, { capture: true });
			};
		}
		/**
		* Touch-primary device hint for the browser Enter translation. Duplicates the literal of
		* `TOUCH_PRIMARY_QUERY` in mobile-layout.ts, which builds a separate bundle entry that
		* this module must not import; a source test keeps the two from drifting apart.
		*/
		const BROWSER_TOUCH_PRIMARY_QUERY = "(hover: none), (pointer: coarse)";
		/** The stock composer editor a phone-browser Enter may keep as a native line break. */
		const BROWSER_COMPOSER_EDITOR_QUERY = "[data-composer-input][contenteditable=\"true\"]";
		/**
		* Whether the App adapter or its earlier origin-scoped WebMessage channel owns Enter.
		* @param view - the page's current native bridge indicators.
		* @returns true without assuming that native keyboard state is already available.
		*/
		function nativeAppOwnsComposerEnter(view) {
			const channel = view.dshMobileNative;
			return view.__DSH_MOBILE_NATIVE__ !== void 0 || typeof channel === "object" && channel !== null && "postMessage" in channel && typeof channel.postMessage === "function";
		}
		/**
		* Whether a phone-browser plain Enter keeps its native editing action instead of reaching
		* DSH's submit shortcut. Unlike the App gate there is no soft-keyboard proof, so this
		* mirrors the shipped question-card policy: the touch-primary hint plus the same event,
		* editor, and IME guards. A held key (`repeat`) keeps the native behavior every editor
		* has, and already-prevented or modified Enters stay under stock control — Cmd/Ctrl+Enter
		* keeps its stock submit path, which is how an attached hardware keyboard still sends.
		*/
		function isBrowserTouchEnterLineBreak(event, context) {
			if (context.appBridge || !context.browserTouch || !context.editable || !context.activeSession || context.commandMenuOpen || context.recentlyComposing || !context.hasDraft) return false;
			if (!event.isTrusted || event.key !== "Enter" || event.defaultPrevented || event.isComposing || event.keyCode === 229) return false;
			return !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.getModifierState("AltGraph");
		}
		/**
		* Whether the stock composer still holds a draft. Mirrors `composerHasDraft` in
		* mobile-layout.ts, which builds a separate bundle entry this module must not import;
		* keep the two shapes aligned (checked against text, embedded decorators, attachments).
		*/
		function browserComposerHasDraft(editor, card) {
			return (editor.textContent ?? "").replaceAll("​", "").trim() !== "" || editor.querySelector("[contenteditable=\"false\"],[data-lexical-decorator],img") !== null || card.querySelector("[data-slot=\"conversation.input.attachments\"] [role=\"group\"] > *") !== null;
		}
		/**
		* Composition tracking for the document-capture Enter translation. iOS Safari fires the
		* composition-confirming Enter with `isComposing === false` in the same task as
		* `compositionend`, so ownership extends ten milliseconds past the event — the same window
		* the stock composer and the App binder use.
		*/
		function createDocumentCompositionGuard(target) {
			let composing = false;
			let composingUntil = 0;
			const onCompositionStart = () => {
				composing = true;
			};
			const onCompositionEnd = () => {
				composing = false;
				composingUntil = performance.now() + 10;
			};
			target.addEventListener("compositionstart", onCompositionStart, { capture: true });
			target.addEventListener("compositionend", onCompositionEnd, { capture: true });
			return {
				recentlyComposing: () => composing || performance.now() < composingUntil,
				dispose: () => {
					target.removeEventListener("compositionstart", onCompositionStart, { capture: true });
					target.removeEventListener("compositionend", onCompositionEnd, { capture: true });
				}
			};
		}
		/** Locate the stock composer editor under a keydown target: the editor itself or a node inside it. */
		function resolveBrowserComposerEditor(target) {
			const candidate = target;
			if (candidate === null || typeof candidate.closest !== "function") return null;
			const editor = candidate.closest.call(target, BROWSER_COMPOSER_EDITOR_QUERY);
			if (editor === null) return null;
			const card = editor.closest("[data-composer-card]");
			return card === null ? null : {
				editor,
				card
			};
		}
		/**
		* Phone-browser Enter translation for the stock composer. Lexical refuses keydown Enter
		* on Apple browsers and performs the line break from the native `beforeinput` flow, so
		* unlike the App binding this hides the keydown with `stopPropagation` only — no
		* `preventDefault`, no synthetic event — letting the browser's own insertParagraph produce
		* the same draft line break desktop Shift+Enter yields, while stock submit never runs.
		* `stopPropagation` (never the immediate variant) keeps same-node document listeners such
		* as the send-keyboard typing tracker and the question-card handler running. Document
		* capture runs before React root handlers and needs no per-editor binding lifecycle.
		*/
		function bindBrowserComposerSoftEnter(view, context) {
			const guard = createDocumentCompositionGuard(view);
			const touchPrimary = typeof window === "object" && typeof window.matchMedia === "function" ? window.matchMedia(BROWSER_TOUCH_PRIMARY_QUERY) : void 0;
			const onKeyDown = (event) => {
				const target = resolveBrowserComposerEditor(event.target);
				if (target === null) return;
				if (!isBrowserTouchEnterLineBreak(event, {
					...context(target.editor, target.card),
					browserTouch: touchPrimary?.matches === true,
					hasDraft: browserComposerHasDraft(target.editor, target.card),
					recentlyComposing: guard.recentlyComposing() || target.editor.hasAttribute("data-composer-composing")
				})) return;
				event.stopPropagation();
			};
			view.addEventListener("keydown", onKeyDown, { capture: true });
			return () => {
				view.removeEventListener("keydown", onKeyDown, { capture: true });
				guard.dispose();
			};
		}
		/** Check that an asynchronous picker result still belongs to its originating session and composer. */
		function isComposerMediaOriginCurrent(origin, current) {
			return !current.disposed && origin.generation === current.generation && origin.href === current.href && origin.composer !== null && current.composerConnected && origin.composer === current.composer && origin.sessionRoot !== null && origin.sessionRoot === current.sessionRoot && origin.sessionId !== null && origin.sessionId === current.sessionId;
		}
		/**
		* The App action that leaves the page for its paired-computer list. Mirrors the literal the
		* General-settings row invokes; the gesture below reads the same name from the bridge
		* capability list, so an App that does not advertise it keeps the stock drawer behavior.
		*/
		const SWITCH_COMPUTER_NATIVE_ACTION = "mobile.switch-computer";
		/** Keeps the drawer from following the finger Android lifts at the end of a completed hold. */
		const SWITCH_COMPUTER_CLICK_SUPPRESSION_MS = 1200;
		/**
		* Hold policy for the collapsed header's drawer toggle. The App owns the paired-computer
		* list, so a hold only acts once the bridge advertises the action; every other press keeps
		* the stock toggle. DOM events stay in the installer so this policy stays testable.
		*/
		function createSwitchComputerHold(options) {
			let hold;
			let supported = false;
			let probing = false;
			let disposed = false;
			let suppressClickUntil = 0;
			let firedAt = 0;
			const probeSupport = () => {
				if (disposed || supported || probing) return;
				probing = true;
				Promise.resolve().then(options.canSwitchComputer).then((value) => {
					probing = false;
					if (!disposed && value) supported = true;
				}, () => {
					probing = false;
				});
			};
			const stopTimer = () => {
				if (hold === void 0) return;
				options.clearTimer(hold.timer);
				hold = void 0;
			};
			const fire = (current) => {
				if (hold !== current || current.fired || !supported) return;
				current.fired = true;
				firedAt = options.now();
				suppressClickUntil = firedAt + SWITCH_COMPUTER_CLICK_SUPPRESSION_MS;
				options.switchComputer();
			};
			return {
				start: (x, y) => {
					if (disposed) return;
					stopTimer();
					suppressClickUntil = 0;
					firedAt = 0;
					probeSupport();
					const current = {
						x,
						y,
						timer: 0,
						fired: false
					};
					current.timer = options.setTimer(() => fire(current), 500);
					hold = current;
				},
				move: (x, y) => {
					if (hold === void 0 || hold.fired) return;
					if (Math.abs(x - hold.x) > 14 || Math.abs(y - hold.y) > 14) stopTimer();
				},
				end: stopTimer,
				consumeClickSuppression: (detail) => {
					if (detail === 0 || suppressClickUntil === 0 || options.now() > suppressClickUntil) return false;
					suppressClickUntil = 0;
					return true;
				},
				blocksContextMenu: () => firedAt !== 0 && options.now() - firedAt <= 1200,
				dispose: () => {
					disposed = true;
					stopTimer();
					suppressClickUntil = 0;
					firedAt = 0;
				}
			};
		}
		/** Add mobile semantics without replacing feature trees. */
		function installNativeMobileSurface(backServices) {
			document.documentElement.classList.add("dsh-native-mobile-active");
			const browserLanguages = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
			const language = resolveNativeMobileLanguage(document.documentElement.lang, browserLanguages);
			const restoreLanguageMarker = applyNativeMobileLanguageMarker(document.documentElement, language);
			const label = (italian, english, chinese) => language === "it" ? italian : language === "zh" ? chinese : english;
			const mediaIcon = () => {
				const namespace = "http://www.w3.org/2000/svg";
				const icon = document.createElementNS(namespace, "svg");
				icon.setAttribute("viewBox", "0 0 16 16");
				icon.setAttribute("fill", "none");
				icon.setAttribute("aria-hidden", "true");
				const body = document.createElementNS(namespace, "path");
				body.setAttribute("d", "M5.15 3.2 6.05 2h3.9l.9 1.2h1.45c1.05 0 1.9.85 1.9 1.9v6c0 1.05-.85 1.9-1.9 1.9H3.7a1.9 1.9 0 0 1-1.9-1.9v-6c0-1.05.85-1.9 1.9-1.9h1.45Zm-1.45 1.3a.6.6 0 0 0-.6.6v6c0 .33.27.6.6.6h8.6a.6.6 0 0 0 .6-.6v-6a.6.6 0 0 0-.6-.6h-2.1l-.9-1.2H6.7l-.9 1.2H3.7Z");
				body.setAttribute("fill", "currentColor");
				const lens = document.createElementNS(namespace, "circle");
				lens.setAttribute("cx", "8");
				lens.setAttribute("cy", "8.1");
				lens.setAttribute("r", "2.15");
				lens.setAttribute("stroke", "currentColor");
				lens.setAttribute("stroke-width", "1.3");
				icon.append(body, lens);
				return icon;
			};
			const createMediaAction = (text) => {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "dsh-mobile-media-action";
				button.lang = language;
				button.dataset.dshMobileMediaAction = "camera";
				const icon = document.createElement("span");
				icon.append(mediaIcon());
				button.append(icon);
				const caption = document.createElement("span");
				caption.textContent = text;
				button.append(caption);
				return button;
			};
			const setInputMode = (mode) => {
				document.documentElement.dataset.dshMobileInput = mode;
			};
			const onPointerDown = (event) => {
				if (event.pointerType === "touch" || event.pointerType === "pen") setInputMode("touch");
			};
			const onKeyDown = (event) => {
				if (event.key === "Tab" || event.key.startsWith("Arrow")) setInputMode("keyboard");
			};
			document.addEventListener("pointerdown", onPointerDown, true);
			document.addEventListener("keydown", onKeyDown, true);
			const switchComputerHold = createSwitchComputerHold({
				now: () => window.performance.now(),
				setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
				clearTimer: (handle) => {
					window.clearTimeout(handle);
				},
				canSwitchComputer: async () => {
					const bridge = window.__DSH_MOBILE_NATIVE__;
					if (bridge === void 0) return false;
					try {
						return (await bridge.capabilities()).includes(SWITCH_COMPUTER_NATIVE_ACTION);
					} catch {
						return false;
					}
				},
				switchComputer: () => {
					const bridge = window.__DSH_MOBILE_NATIVE__;
					if (bridge === void 0) return;
					Promise.resolve().then(() => bridge.invoke(SWITCH_COMPUTER_NATIVE_ACTION, {})).catch(() => void 0);
				}
			});
			const isDrawerToggleTarget = (target) => target instanceof Element && target.closest("[data-dsh-mobile-toggle]") !== null;
			const onTogglePointerDown = (event) => {
				if (!event.isPrimary || event.button !== 0 || !isDrawerToggleTarget(event.target)) return;
				switchComputerHold.start(event.clientX, event.clientY);
			};
			const onTogglePointerMove = (event) => {
				switchComputerHold.move(event.clientX, event.clientY);
			};
			const onTogglePointerEnd = () => {
				switchComputerHold.end();
			};
			const onToggleVisibilityChange = () => {
				if (document.hidden) switchComputerHold.end();
			};
			const onToggleClickCapture = (event) => {
				if (!isDrawerToggleTarget(event.target) || !switchComputerHold.consumeClickSuppression(event.detail)) return;
				event.preventDefault();
				event.stopPropagation();
			};
			const onToggleContextMenu = (event) => {
				if (!isDrawerToggleTarget(event.target) || !switchComputerHold.blocksContextMenu()) return;
				event.preventDefault();
				event.stopPropagation();
			};
			document.addEventListener("pointerdown", onTogglePointerDown, true);
			document.addEventListener("pointermove", onTogglePointerMove, true);
			document.addEventListener("pointerup", onTogglePointerEnd, true);
			document.addEventListener("pointercancel", onTogglePointerEnd, true);
			document.addEventListener("click", onToggleClickCapture, true);
			document.addEventListener("contextmenu", onToggleContextMenu, true);
			window.addEventListener("blur", onTogglePointerEnd);
			document.addEventListener("visibilitychange", onToggleVisibilityChange);
			const overlayQuery = window.matchMedia(NATIVE_MOBILE_OVERLAY_QUERY);
			const backdrop = document.createElement("button");
			backdrop.type = "button";
			backdrop.className = "dsh-native-mobile-backdrop";
			backdrop.lang = language;
			backdrop.hidden = true;
			backdrop.setAttribute("aria-label", label("Chiudi navigazione area di lavoro", "Close workspace navigation", "关闭工作区导航"));
			document.body.append(backdrop);
			const branchToast = document.createElement("div");
			branchToast.className = "dsh-mobile-branch-toast";
			branchToast.lang = language;
			branchToast.setAttribute("role", "status");
			branchToast.setAttribute("aria-live", "polite");
			document.body.append(branchToast);
			const mediaToast = document.createElement("div");
			mediaToast.className = "dsh-mobile-media-toast";
			mediaToast.lang = language;
			mediaToast.setAttribute("role", "status");
			mediaToast.setAttribute("aria-live", "polite");
			document.body.append(mediaToast);
			const cameraButton = createMediaAction(label("Scatta foto", "Take photo", "拍照"));
			cameraButton.disabled = true;
			let branchToastTimer = 0;
			let mediaToastTimer = 0;
			const showMediaToast = (message) => {
				mediaToast.textContent = message;
				mediaToast.dataset.visible = "true";
				if (mediaToastTimer !== 0) window.clearTimeout(mediaToastTimer);
				mediaToastTimer = window.setTimeout(() => {
					mediaToast.removeAttribute("data-visible");
					mediaToastTimer = 0;
				}, 2200);
			};
			let mediaRequestGeneration = 0;
			let disposed = false;
			let boundComposer = null;
			let boundSessionRoot = null;
			let boundSessionId = null;
			const preflightFile = new File([], "dsh-mobile-preflight.png", { type: "image/png" });
			const canAcceptComposerDrop = () => preflightComposerImageDrop(document, [preflightFile]);
			const mediaPickerAbortController = new AbortController();
			const browserPickerCleanups = /* @__PURE__ */ new Set();
			let boundEnterEditor = null;
			let boundEnterCard = null;
			let disposeEnterBinding;
			const sessionTokens = /* @__PURE__ */ new WeakMap();
			let nextSessionToken = 0;
			const currentSessionOrigin = () => {
				const selectedRow = document.querySelector("[role=\"treeitem\"][aria-selected=\"true\"]");
				return resolveComposerSessionOrigin(boundComposer, selectedRow, (row) => {
					let token = sessionTokens.get(row);
					if (token === void 0) {
						token = `stock-${String(++nextSessionToken)}`;
						sessionTokens.set(row, token);
					}
					return token;
				});
			};
			const disposeBrowserComposerSoftEnter = bindBrowserComposerSoftEnter(document, (editor, composerCard) => ({
				appBridge: nativeAppOwnsComposerEnter(window),
				editable: editor.isConnected && editor.getAttribute("contenteditable") === "true" && editor.getAttribute("aria-disabled") !== "true" && editor.getAttribute("aria-haspopup") !== "menu" && composerCard.getAttribute("aria-busy") !== "true" && editor.getAttribute("inputmode") !== "none",
				activeSession: activeSessionForSoftEnter(composerCard, currentSessionOrigin().sessionId),
				commandMenuOpen: composerCard.querySelector("[data-trigger-menu],button[aria-haspopup=\"listbox\"][aria-expanded=\"true\"]") !== null
			}));
			const mediaRequestContext = () => {
				const session = currentSessionOrigin();
				return {
					generation: ++mediaRequestGeneration,
					href: window.location.href,
					composer: boundComposer,
					...session
				};
			};
			const mediaRequestIsCurrent = (context) => {
				const session = currentSessionOrigin();
				const composer = boundComposer;
				return isComposerMediaOriginCurrent(context, {
					generation: mediaRequestGeneration,
					href: window.location.href,
					composer,
					sessionRoot: session.sessionRoot,
					sessionId: session.sessionId,
					disposed,
					composerConnected: context.composer?.isConnected === true
				});
			};
			const deliverImages = (files, context) => {
				if (files.length === 0 || !mediaRequestIsCurrent(context)) return;
				dispatchComposerImageDrop(document, files);
			};
			const launchBrowserCamera = (context) => {
				const input = document.createElement("input");
				input.type = "file";
				input.accept = "image/*";
				input.capture = "environment";
				input.hidden = true;
				const signal = mediaPickerAbortController.signal;
				let cleanupTimer = 0;
				let watchdogTimer = 0;
				let cleaned = false;
				const scheduleCleanup = () => {
					if (!cleaned && cleanupTimer === 0) cleanupTimer = window.setTimeout(cleanup, 1e3);
				};
				const onVisibilityChange = () => {
					if (document.visibilityState === "visible") scheduleCleanup();
				};
				const onChange = () => {
					if (cleaned) return;
					const files = input.files === null ? [] : [...input.files];
					cleanup();
					deliverImages(files, context);
				};
				const cleanup = () => {
					if (cleaned) return;
					cleaned = true;
					if (cleanupTimer !== 0) window.clearTimeout(cleanupTimer);
					if (watchdogTimer !== 0) window.clearTimeout(watchdogTimer);
					cleanupTimer = 0;
					watchdogTimer = 0;
					input.removeEventListener("change", onChange);
					input.removeEventListener("cancel", cleanup);
					window.removeEventListener("focus", scheduleCleanup);
					document.removeEventListener("visibilitychange", onVisibilityChange);
					signal.removeEventListener("abort", cleanup);
					browserPickerCleanups.delete(cleanup);
					input.remove();
				};
				input.addEventListener("change", onChange);
				input.addEventListener("cancel", cleanup);
				window.addEventListener("focus", scheduleCleanup);
				document.addEventListener("visibilitychange", onVisibilityChange);
				signal.addEventListener("abort", cleanup, { once: true });
				watchdogTimer = window.setTimeout(cleanup, 3e5);
				browserPickerCleanups.add(cleanup);
				if (signal.aborted) {
					cleanup();
					return;
				}
				try {
					document.body.append(input);
					input.click();
				} catch {
					cleanup();
					if (mediaRequestIsCurrent(context)) showMediaToast(label("Impossibile aprire la fotocamera", "Could not open the camera", "无法打开相机"));
				}
			};
			const dismissCommandMenu = () => {
				(boundComposer?.querySelector("button[aria-haspopup=\"listbox\"][aria-expanded=\"true\"]"))?.click();
			};
			const addGroupLabel = label("Aggiungi", "Add", "添加");
			const placeCameraAction = (commandMenu) => {
				const sectionTitle = Array.from(commandMenu.querySelectorAll("[role=\"listbox\"] [role=\"presentation\"]")).find((candidate) => !candidate.hasAttribute("data-source") && candidate.textContent?.trim() === addGroupLabel);
				if (sectionTitle === void 0) {
					cameraButton.remove();
					return false;
				}
				cameraButton.className = "dsh-mobile-media-action";
				const nativeItem = (() => {
					let sibling = sectionTitle.nextElementSibling;
					while (sibling instanceof HTMLElement && sibling.getAttribute("role") !== "presentation") {
						if (sibling.matches("button[role=\"option\"]:not([aria-selected=\"true\"])")) return sibling;
						sibling = sibling.nextElementSibling;
					}
				})();
				if (nativeItem !== void 0) {
					cameraButton.className = nativeItem.className;
					const cameraIcon = cameraButton.firstElementChild;
					const cameraLabel = cameraButton.lastElementChild;
					const nativeIcon = firstByClassSuffix(nativeItem, "_itemIcon");
					const nativeLabel = firstByClassSuffix(nativeItem, "_itemName");
					if (cameraIcon instanceof HTMLElement && nativeIcon !== void 0) cameraIcon.className = nativeIcon.className;
					if (cameraLabel instanceof HTMLElement && nativeLabel !== void 0) cameraLabel.className = nativeLabel.className;
				}
				cameraButton.setAttribute("role", "option");
				cameraButton.setAttribute("aria-selected", "false");
				cameraButton.setAttribute("aria-label", label("Scatta foto", "Take photo", "拍照"));
				let lastItem = sectionTitle;
				let sibling = sectionTitle.nextElementSibling;
				while (sibling instanceof HTMLElement && sibling.getAttribute("role") !== "presentation") {
					if (sibling !== cameraButton) lastItem = sibling;
					sibling = sibling.nextElementSibling;
				}
				if (cameraButton.parentElement !== sectionTitle.parentElement || cameraButton.previousElementSibling !== lastItem) lastItem.after(cameraButton);
				return true;
			};
			const setCameraActionDisabled = (disabled, title) => {
				if (cameraButton.disabled !== disabled) cameraButton.disabled = disabled;
				if (cameraButton.title !== title) cameraButton.title = title;
			};
			const quietMediaPointer = (event) => {
				event.preventDefault();
				event.stopPropagation();
				const active = document.activeElement;
				if (active instanceof HTMLElement && (active.matches("input,textarea") || active.isContentEditable)) active.blur();
			};
			const takePhoto = () => {
				if (!canAcceptComposerDrop()) {
					setCameraActionDisabled(true, label("Allegati immagine non disponibili", "Image attachments are unavailable", "图片附件不可用"));
					dismissCommandMenu();
					return;
				}
				const context = mediaRequestContext();
				dismissCommandMenu();
				const bridge = window.__DSH_MOBILE_NATIVE__;
				if (bridge === void 0) {
					launchBrowserCamera(context);
					return;
				}
				Promise.resolve().then(() => bridge.invoke("camera.capture", {})).then((value) => {
					if (!mediaRequestIsCurrent(context)) return;
					if (value instanceof File) deliverImages([value], context);
					else showMediaToast(label("La foto scattata non è utilizzabile", "The captured photo is unavailable", "所拍照片不可用"));
				}).catch((error) => {
					if (!mediaRequestIsCurrent(context)) return;
					const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
					if (code === "cancelled") return;
					showMediaToast(code === "payload_too_large" ? label("La foto supera il limite di 8 MiB", "The photo exceeds the 8 MiB limit", "照片超过 8 MiB 限制") : label("Impossibile aggiungere la foto", "Could not attach the photo", "无法附加照片"));
				});
			};
			cameraButton.addEventListener("pointerdown", quietMediaPointer);
			cameraButton.addEventListener("click", takePhoto);
			const showBranchToast = () => {
				const header = document.querySelector("[data-dsh-mobile-header]");
				const title = header === null ? void 0 : header.querySelector("[class*=\"_crumbCurrent\"]")?.textContent?.trim();
				const prefix = label("Ramo corrente", "Current branch", "当前分支");
				branchToast.textContent = title === void 0 ? prefix : `${prefix}: ${title}`;
				branchToast.dataset.visible = "true";
				if (branchToastTimer !== 0) window.clearTimeout(branchToastTimer);
				branchToastTimer = window.setTimeout(() => {
					branchToast.removeAttribute("data-visible");
					branchToastTimer = 0;
				}, 1600);
			};
			const onBranchClick = (event) => {
				if (!(event.target instanceof Element)) return;
				const branch = event.target.closest("button[aria-label*=\"分支\"],button[aria-label*=\"Branch\"],button[aria-label*=\"branch\"],button[aria-label*=\"Ramo\"],button[aria-label*=\"ramo\"]");
				if (branch === null || branch.hasAttribute("disabled") || branch.getAttribute("aria-disabled") === "true") return;
				window.setTimeout(showBranchToast, 80);
			};
			let stripHeader;
			const stripParts = () => {
				const row = stripHeader?.querySelector("[class*=\"_titleRow\"]");
				if (row === void 0 || row === null) return void 0;
				return {
					row,
					lead: stripHeader?.querySelector("[class*=\"_headerLeading\"]") ?? void 0
				};
			};
			const stripRange = () => {
				const parts = stripParts();
				if (!overlayQuery.matches || parts === void 0) return 0;
				const overflow = measureHeaderStripOverflow(parts.row);
				return overflow > 1 ? overflow : 0;
			};
			const applyStrip = (offset) => {
				const parts = stripParts();
				if (parts === void 0) return;
				const value = offset === 0 ? "" : `translateX(${-offset}px)`;
				if (parts.row.style.transform !== value) parts.row.style.transform = value;
				if (parts.lead !== void 0 && parts.lead.style.transform !== value) parts.lead.style.transform = value;
			};
			const pan = createHeaderStripPanController({
				range: stripRange,
				render: applyStrip,
				now: () => performance.now()
			});
			const syncPanHeader = (header) => {
				if (header !== stripHeader) {
					pan.dispose();
					stripHeader = header;
				}
				pan.sync();
				applyStrip(pan.offset());
			};
			let activeTouchId;
			const onStripTouchStart = (event) => {
				if (activeTouchId !== void 0) pan.cancel();
				activeTouchId = void 0;
				pan.resetClickSuppression();
				if (event.touches.length !== 1) return;
				if (!overlayQuery.matches) return;
				if (!(event.target instanceof Element)) return;
				if (event.target.closest("[data-dsh-mobile-header]") !== stripHeader) return;
				if (event.target.closest("[data-dsh-mobile-header] [class*=\"_titleRow\"],[data-dsh-mobile-header] [class*=\"_headerLeading\"]") === null) return;
				if (stripRange() === 0) return;
				const touch = event.touches[0];
				if (touch === void 0) return;
				activeTouchId = touch.identifier;
				pan.start(touch.clientX, touch.clientY);
			};
			const onStripTouchMove = (event) => {
				if (activeTouchId === void 0) return;
				if (event.touches.length !== 1) {
					activeTouchId = void 0;
					pan.cancel();
					return;
				}
				const touch = event.touches[0];
				if (touch === void 0 || touch.identifier !== activeTouchId) return;
				if (pan.move(touch.clientX, touch.clientY)) event.preventDefault();
			};
			const onStripTouchEnd = (event) => {
				if (activeTouchId === void 0 || !Array.from(event.changedTouches).some((touch) => touch.identifier === activeTouchId)) return;
				activeTouchId = void 0;
				pan.end();
			};
			const onStripTouchCancel = (event) => {
				if (activeTouchId === void 0 || !Array.from(event.changedTouches).some((touch) => touch.identifier === activeTouchId)) return;
				activeTouchId = void 0;
				pan.cancel();
			};
			const onStripFocus = (event) => {
				if (!(event.target instanceof HTMLElement)) return;
				const header = event.target.closest("[data-dsh-mobile-header]");
				if (header === null || header !== stripHeader || stripRange() === 0 || event.target.closest("[class*=\"_titleRow\"],[class*=\"_headerLeading\"]") === null) return;
				const focused = event.target.getBoundingClientRect();
				const visible = header.getBoundingClientRect();
				pan.reveal(focused.left, focused.right, visible.left + 42, visible.right - 8);
			};
			const onStripClickCapture = (event) => {
				const inHeader = event.target instanceof Element && event.target.closest("[data-dsh-mobile-header]") !== null;
				if (!pan.suppressClick(inHeader, event.detail)) return;
				event.preventDefault();
				event.stopPropagation();
			};
			document.addEventListener("touchstart", onStripTouchStart, true);
			document.addEventListener("touchmove", onStripTouchMove, {
				capture: true,
				passive: false
			});
			document.addEventListener("touchend", onStripTouchEnd, true);
			document.addEventListener("touchcancel", onStripTouchCancel, true);
			document.addEventListener("focusin", onStripFocus, true);
			document.addEventListener("click", onStripClickCapture, true);
			document.addEventListener("click", onBranchClick, true);
			let frame;
			let sidebar;
			let sidebarRoot;
			let toggle;
			let viewArea;
			let scheduled = 0;
			let transitionFrame = 0;
			let transitionRestartFrame = 0;
			let transitionTimer = 0;
			let transitionTarget;
			let historyScroller;
			let historyPreviousTop = 0;
			const historyLoadButton = () => {
				return (historyScroller === void 0 ? void 0 : firstByClassSuffix(historyScroller, "_older"))?.querySelector("button") ?? void 0;
			};
			const onHistoryScroll = () => {
				if (historyScroller === void 0) return;
				const currentTop = Math.max(0, historyScroller.scrollTop);
				const shouldLoad = shouldAutoLoadEarlier(historyPreviousTop, currentTop);
				historyPreviousTop = currentTop;
				if (!shouldLoad) return;
				const button = historyLoadButton();
				if (button === void 0 || button.disabled || button.getAttribute("aria-disabled") === "true") return;
				button.click();
			};
			const bindHistoryScroller = (next) => {
				if (historyScroller === next) return;
				historyScroller?.removeEventListener("scroll", onHistoryScroll);
				historyScroller = next;
				historyPreviousTop = next?.scrollTop ?? 0;
				historyScroller?.addEventListener("scroll", onHistoryScroll, { passive: true });
			};
			const animateNavigation = (event) => {
				if (!(event.target instanceof Element)) return;
				const trigger = event.target.closest("button,a,[role=\"tab\"],[aria-selected]");
				if (trigger === null || trigger.hasAttribute("disabled") || trigger.getAttribute("aria-disabled") === "true") return;
				if (trigger.getAttribute("aria-selected") === "true" || trigger.getAttribute("aria-current") === "true") return;
				const settingsNavigation = trigger.closest("[data-dsh-mobile-settings-list]") !== null;
				const conversationNavigation = trigger.matches("[role=\"tab\"]");
				const sidebarNavigation = trigger.closest("[data-dsh-mobile-sidebar-root]") !== null && trigger.closest("[data-dsh-mobile-toggle]") === null;
				if (!settingsNavigation && !conversationNavigation && !sidebarNavigation) return;
				if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
				if (transitionFrame !== 0) cancelAnimationFrame(transitionFrame);
				if (transitionRestartFrame !== 0) cancelAnimationFrame(transitionRestartFrame);
				transitionFrame = requestAnimationFrame(() => {
					transitionFrame = 0;
					const target = settingsNavigation ? document.querySelector("[data-dsh-mobile-settings-content]") : viewArea;
					if (target === null || target === void 0) return;
					transitionTarget?.removeAttribute("data-dsh-mobile-view-transition");
					target.removeAttribute("data-dsh-mobile-view-transition");
					transitionRestartFrame = requestAnimationFrame(() => {
						transitionRestartFrame = 0;
						transitionTarget = target;
						target.dataset.dshMobileViewTransition = "true";
						if (transitionTimer !== 0) clearTimeout(transitionTimer);
						transitionTimer = window.setTimeout(() => {
							target.removeAttribute("data-dsh-mobile-view-transition");
							if (transitionTarget === target) transitionTarget = void 0;
							transitionTimer = 0;
						}, 240);
					});
				});
			};
			document.addEventListener("click", animateNavigation);
			const syncComposerEnterNewline = (composerCard) => {
				const editor = composerCard?.querySelector("[data-composer-input][contenteditable=\"true\"]") ?? null;
				if (editor === boundEnterEditor && composerCard === boundEnterCard) return;
				disposeEnterBinding?.();
				boundEnterEditor = editor;
				boundEnterCard = composerCard;
				disposeEnterBinding = editor === null || composerCard === null ? void 0 : bindComposerSoftEnter(editor, () => ({
					nativeState: window.__DSH_MOBILE_NATIVE__ === void 0 ? null : window.__DSH_MOBILE_KEYBOARD_STATE__,
					editable: editor.isConnected && editor.getAttribute("contenteditable") === "true" && editor.getAttribute("aria-disabled") !== "true" && editor.getAttribute("aria-haspopup") !== "menu" && composerCard.getAttribute("aria-busy") !== "true",
					activeSession: activeSessionForSoftEnter(composerCard, currentSessionOrigin().sessionId),
					commandMenuOpen: composerCard.querySelector("[data-trigger-menu],button[aria-haspopup=\"listbox\"][aria-expanded=\"true\"]") !== null
				}));
			};
			const syncMediaBinding = (composer) => {
				const previousComposer = boundComposer;
				boundComposer = composer;
				const session = currentSessionOrigin();
				if (composer === previousComposer && session.sessionRoot === boundSessionRoot && session.sessionId === boundSessionId) return;
				boundSessionRoot = session.sessionRoot;
				boundSessionId = session.sessionId;
				mediaRequestGeneration += 1;
			};
			const sync = () => {
				scheduled = 0;
				const dedicatedCenter = document.querySelector(".dshm-main") ?? void 0;
				const nextFrame = resolveNativeMobileFrame(document, dedicatedCenter);
				if (frame !== nextFrame) frame?.removeAttribute("data-dsh-mobile-frame");
				frame = nextFrame;
				if (frame !== void 0) frame.dataset.dshMobileFrame = "true";
				sidebar = frame === void 0 ? document.querySelector(".dshm-drawer") ?? void 0 : firstByClassSuffix(frame, "_sidebarCol");
				const center = frame === void 0 ? dedicatedCenter : firstByClassSuffix(frame, "_centerCol");
				const details = frame === void 0 ? void 0 : firstByClassSuffix(frame, "_detailsCol");
				const handle = frame === void 0 ? void 0 : firstByClassSuffix(frame, "_handle");
				markNativeMobileSettings(document);
				if (center === void 0) {
					syncPanHeader(void 0);
					syncComposerEnterNewline(null);
					bindHistoryScroller(void 0);
					syncMediaBinding(null);
					setCameraActionDisabled(true, label("Apri prima una sessione", "Open a session first", "请先打开会话"));
					cameraButton.remove();
					return;
				}
				if (center !== void 0) {
					center.dataset.dshMobileCenter = "true";
					const header = center.querySelector("header") ?? void 0;
					header?.setAttribute("data-dsh-mobile-header", "true");
					syncPanHeader(header);
					viewArea = firstByClassSuffix(center, "_viewArea");
					if (viewArea !== void 0) viewArea.dataset.dshMobileView = "true";
					const conversation = center.querySelector("[data-conversation-scroll]");
					bindHistoryScroller(conversation ?? void 0);
					const historyLoader = conversation === null ? void 0 : firstByClassSuffix(conversation, "_older");
					if (historyLoader !== void 0) {
						historyLoader.dataset.dshMobileHistoryLoader = "true";
						historyLoader.setAttribute("aria-live", "polite");
						const button = historyLoader.querySelector("button");
						if (button !== null) {
							button.tabIndex = -1;
							if (button.disabled) button.removeAttribute("aria-hidden");
							else button.setAttribute("aria-hidden", "true");
						}
					}
					const messageColumn = conversation === null ? void 0 : firstByClassSuffix(conversation, "_column");
					const messageScroll = messageColumn?.parentElement;
					if (messageColumn !== void 0 && messageScroll !== null && messageScroll !== void 0 && classToken(messageScroll, "_scroll")) {
						messageColumn.dataset.dshMobileMessageColumn = "true";
						messageScroll.dataset.dshMobileMessageScroll = "true";
					}
					for (const table of center.querySelectorAll("table")) {
						if (table.parentElement?.dataset.dshMobileTableScroll === "true") continue;
						const wrapper = document.createElement("div");
						wrapper.dataset.dshMobileTableScroll = "true";
						table.before(wrapper);
						wrapper.append(table);
					}
					const composerCard = center.querySelector("[data-composer-card]");
					const composerRow = composerCard?.querySelector(":scope > [data-input-scroll]")?.nextElementSibling;
					if (!(composerRow instanceof HTMLElement)) {
						syncComposerEnterNewline(null);
						syncMediaBinding(null);
						setCameraActionDisabled(true, label("Apri prima una sessione", "Open a session first", "请先打开会话"));
						cameraButton.remove();
					}
					if (composerRow instanceof HTMLElement) {
						composerRow.dataset.dshMobileComposerRow = "true";
						const groups = Array.from(composerRow.children).filter((child) => child instanceof HTMLElement);
						const composerTools = groups[0];
						const composerTrailing = groups.at(-1);
						if (composerTools !== void 0) {
							composerTools.dataset.dshMobileComposerTools = "true";
							syncMediaBinding(composerCard ?? null);
							syncComposerEnterNewline(composerCard ?? null);
							const composerInput = composerCard?.querySelector("textarea");
							const composerEditor = composerCard?.querySelector("[contenteditable=\"true\"],[contenteditable=\"plaintext-only\"]");
							const composerBusy = composerCard?.getAttribute("aria-busy") === "true" || composerInput?.disabled === true || composerInput?.readOnly === true || composerEditor?.getAttribute("aria-disabled") === "true";
							const attachmentBlocked = !canAcceptComposerDrop();
							const mediaDisabled = conversation === null || currentSessionOrigin().sessionId === null || composerBusy || attachmentBlocked;
							const mediaTitle = composerBusy ? label("Attendi il completamento della risposta", "Wait for the response to finish", "请等待回复完成") : attachmentBlocked ? label("Allegati immagine non disponibili", "Image attachments are unavailable", "图片附件不可用") : mediaDisabled ? label("Apri prima una sessione", "Open a session first", "请先打开会话") : label("Scatta una foto e allegala", "Take a photo and attach it", "拍照并附加到当前消息");
							setCameraActionDisabled(mediaDisabled, mediaTitle);
							const commandMenu = composerCard?.querySelector("[data-trigger-menu]") ?? null;
							if (commandMenu !== null) placeCameraAction(commandMenu);
							else cameraButton.remove();
						} else syncComposerEnterNewline(null);
						if (composerTrailing !== void 0 && composerTrailing !== composerTools) {
							composerTrailing.dataset.dshMobileComposerTrailing = "true";
							const modelTrigger = composerTrailing.querySelector("button[aria-label^=\"选择模型\"],button[aria-label^=\"Select model\"],button[aria-label^=\"Seleziona modello\"]");
							if (modelTrigger !== null) {
								const controls = modelTrigger.closest("[class*=\"_standardControls\"]");
								if (controls !== null) controls.dataset.dshMobileComposerControls = "true";
								modelTrigger.dataset.dshMobileComposerModelTrigger = "true";
								modelTrigger.parentElement?.setAttribute("data-dsh-mobile-composer-model", "true");
								modelTrigger.querySelector("[class*=\"_triggerLabel\"]")?.setAttribute("data-dsh-mobile-composer-model-label", "true");
							}
						}
					}
				}
				if (handle !== void 0) handle.dataset.dshMobileHandle = "true";
				if (details !== void 0) {
					details.dataset.dshMobileDetails = "true";
					const lastColumn = frame?.style.gridTemplateColumns.trim().split(/\s+/).at(-1);
					details.dataset.open = String(lastColumn !== void 0 && lastColumn !== "0px" && lastColumn !== "0");
				}
				if (sidebar === void 0) return;
				sidebar.dataset.dshMobileSidebar = "true";
				toggle = firstByClassSuffix(sidebar, "_toggle");
				let candidate = toggle?.parentElement;
				while (candidate !== void 0 && candidate !== null && candidate !== sidebar && !classToken(candidate, "_root")) candidate = candidate.parentElement;
				sidebarRoot = candidate !== sidebar && candidate !== null ? candidate : void 0;
				if (sidebarRoot === void 0) return;
				sidebarRoot.dataset.dshMobileSidebarRoot = "true";
				for (const brand of sidebarRoot.querySelectorAll("[class*=\"_fallbackBrandName\"]")) if (brand.textContent?.trim() === "DSH Local Build") brand.textContent = "DeepSeek Harness";
				if (toggle !== void 0) toggle.dataset.dshMobileToggle = "true";
				if (frame !== void 0) sidebar.dataset.open = String(!classToken(sidebarRoot, "_collapsed"));
				backdrop.hidden = frame === void 0 || !drawerScrimVisible(classToken(sidebarRoot, "_collapsed"), overlayQuery.matches);
			};
			const schedule = () => {
				if (scheduled === 0) scheduled = requestAnimationFrame(sync);
			};
			const observer = new MutationObserver(schedule);
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: [
					"class",
					"style",
					"disabled",
					"readonly",
					"aria-busy",
					"aria-selected",
					"data-dsh-mobile-session"
				]
			});
			overlayQuery.addEventListener("change", schedule);
			backdrop.addEventListener("click", () => {
				if (sidebar?.dataset.open === "true") toggle?.click();
			});
			sync();
			const stopStockBack = installStockMobileBack(window, () => {
				if (frame?.isConnected !== true) return null;
				const lastColumn = frame.style.gridTemplateColumns.trim().split(/\s+/).at(-1);
				return {
					detailsOpen: overlayQuery.matches && lastColumn !== void 0 && lastColumn !== "" && lastColumn !== "0px" && lastColumn !== "0",
					drawerOpen: overlayQuery.matches && sidebarRoot?.isConnected === true && toggle?.isConnected === true && !classToken(sidebarRoot, "_collapsed"),
					mainPanelOpen: stockMainPanelOpen(backServices.getLayout())
				};
			}, {
				closeDetails: () => {
					const layout = stockLayoutBackControl(backServices.getLayout());
					if (typeof layout?.closeRightbar !== "function") return;
					const sidebarRight = backServices.getSidebarRight();
					if (typeof sidebarRight === "object" && sidebarRight !== null) {
						const control = sidebarRight;
						if (typeof control.isExpanded === "function" && typeof control.toggleExpanded === "function" && control.isExpanded()) control.toggleExpanded();
					}
					layout.closeRightbar();
				},
				closeDrawer: () => {
					toggle?.click();
				},
				closeMainPanel: () => {
					const layout = stockLayoutBackControl(backServices.getLayout());
					if (typeof layout?.selectPanel === "function") layout.selectPanel(null);
				}
			});
			const disposeTaskWatcher = installTaskCompletionWatcher({
				completionFallback: false,
				label: (kind, sessionLabel) => kind === "done" ? {
					title: label("Attività completata", "Task finished", "任务已完成"),
					body: sessionLabel === "" ? label("Il tuo task DSH è terminato", "Your DSH task finished", "你的 DSH 任务已完成") : label(`Il tuo task DSH è terminato: ${sessionLabel}`, `Your DSH task finished: ${sessionLabel}`, `你的 DSH 任务已完成：${sessionLabel}`)
				} : {
					title: label("È richiesto un input", "Input needed", "需要你确认"),
					body: label("DSH attende una tua scelta", "DSH waits for your choice", "DSH 等待你的选择")
				}
			});
			return () => {
				disposed = true;
				stopStockBack();
				disposeTaskWatcher();
				mediaRequestGeneration += 1;
				mediaPickerAbortController.abort();
				restoreLanguageMarker();
				for (const cleanup of [...browserPickerCleanups]) cleanup();
				disposeEnterBinding?.();
				disposeBrowserComposerSoftEnter();
				observer.disconnect();
				overlayQuery.removeEventListener("change", schedule);
				document.removeEventListener("click", onBranchClick, true);
				document.removeEventListener("touchstart", onStripTouchStart, true);
				document.removeEventListener("touchmove", onStripTouchMove, true);
				document.removeEventListener("touchend", onStripTouchEnd, true);
				document.removeEventListener("touchcancel", onStripTouchCancel, true);
				document.removeEventListener("focusin", onStripFocus, true);
				document.removeEventListener("click", onStripClickCapture, true);
				pan.dispose();
				applyStrip(0);
				cameraButton.removeEventListener("pointerdown", quietMediaPointer);
				cameraButton.removeEventListener("click", takePhoto);
				if (branchToastTimer !== 0) window.clearTimeout(branchToastTimer);
				if (mediaToastTimer !== 0) window.clearTimeout(mediaToastTimer);
				branchToast.remove();
				mediaToast.remove();
				cameraButton.remove();
				if (scheduled !== 0) cancelAnimationFrame(scheduled);
				if (transitionFrame !== 0) cancelAnimationFrame(transitionFrame);
				if (transitionRestartFrame !== 0) cancelAnimationFrame(transitionRestartFrame);
				if (transitionTimer !== 0) clearTimeout(transitionTimer);
				transitionTarget?.removeAttribute("data-dsh-mobile-view-transition");
				historyScroller?.removeEventListener("scroll", onHistoryScroll);
				document.removeEventListener("pointerdown", onPointerDown, true);
				document.removeEventListener("keydown", onKeyDown, true);
				document.removeEventListener("pointerdown", onTogglePointerDown, true);
				document.removeEventListener("pointermove", onTogglePointerMove, true);
				document.removeEventListener("pointerup", onTogglePointerEnd, true);
				document.removeEventListener("pointercancel", onTogglePointerEnd, true);
				document.removeEventListener("click", onToggleClickCapture, true);
				document.removeEventListener("contextmenu", onToggleContextMenu, true);
				window.removeEventListener("blur", onTogglePointerEnd);
				document.removeEventListener("visibilitychange", onToggleVisibilityChange);
				switchComputerHold.dispose();
				document.removeEventListener("click", animateNavigation);
				backdrop.remove();
				document.documentElement.classList.remove("dsh-native-mobile-active");
				delete document.documentElement.dataset.dshMobileInput;
			};
		}
		//#endregion
		//#region src/voice-session.ts
		/** Screen wake-lock ownership and mobile composer focus during DSH dictation. */
		/** Voice phases during which the user is dictating. */
		const DICTATING_PHASES = [
			"requesting",
			"recording",
			"transcribing"
		];
		/** Whether DSH's published voice phase requires an active dictation surface. */
		function phaseIsDictating(phase) {
			return typeof phase === "string" && DICTATING_PHASES.includes(phase);
		}
		/** The wake lock API, or undefined where the browser does not offer it. */
		function wakeLockApi() {
			const api = navigator.wakeLock;
			return api === void 0 ? void 0 : api;
		}
		/**
		* Hold an available screen wake lock while DSH dictation is active and visible.
		* @param allowKeyboardDismissal Whether a mobile composer may lose text focus when capture starts.
		* @returns A disposer that releases held and subsequently returned wake locks.
		*/
		function installVoiceSession(allowKeyboardDismissal = true) {
			const api = wakeLockApi();
			if (api === void 0 && !allowKeyboardDismissal) return () => {};
			let sentinel = null;
			let pending = false;
			let disposed = false;
			let generation = 0;
			let lastRow = null;
			let lastVisible = !document.hidden;
			const currentRow = () => Array.from(document.querySelectorAll("[data-voice-activity]")).find((row) => phaseIsDictating(row.getAttribute("data-voice-activity"))) ?? null;
			const releaseLock = (lock) => {
				if (!lock.released) lock.release().catch((_error) => {});
			};
			const release = () => {
				const held = sentinel;
				sentinel = null;
				if (held !== null) releaseLock(held);
			};
			const acquireIfWanted = () => {
				if (api === void 0 || disposed || pending || sentinel !== null || document.hidden) return;
				const row = currentRow();
				if (row === null) return;
				const requestedGeneration = generation;
				pending = true;
				api.request("screen").then((lock) => {
					lock.addEventListener("release", () => {
						if (sentinel === lock) sentinel = null;
					});
					if (disposed || document.hidden || requestedGeneration !== generation || currentRow() !== row) releaseLock(lock);
					else if (!lock.released) sentinel = lock;
				}, (_error) => {}).finally(() => {
					pending = false;
					if (!disposed && requestedGeneration !== generation) acquireIfWanted();
				});
			};
			const dismissKeyboard = (row) => {
				if (!allowKeyboardDismissal) return;
				if (!(window.__DSH_MOBILE_NATIVE__ !== void 0 ? window.__DSH_MOBILE_KEYBOARD_STATE__?.noHardwareKeyboard === true : window.matchMedia("(pointer:coarse) and (hover:none)").matches)) return;
				const active = document.activeElement;
				const composer = row.closest("[data-composer-card]");
				if (active instanceof HTMLElement && composer?.contains(active) && active.closest("[data-composer-input]") !== null && (active.isContentEditable || active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) active.blur();
			};
			const apply = () => {
				const row = currentRow();
				const visible = !document.hidden;
				const changed = row !== lastRow || visible !== lastVisible;
				if (changed) {
					generation++;
					release();
					if (row !== null && row !== lastRow && visible) dismissKeyboard(row);
				}
				lastRow = row;
				lastVisible = visible;
				if (changed) acquireIfWanted();
			};
			const containsVoiceRow = (node) => node instanceof Element && (node.matches("[data-voice-activity]") || node.querySelector("[data-voice-activity]") !== null);
			const observer = new MutationObserver((records) => {
				if (records.some((record) => record.type === "attributes" || [...record.addedNodes, ...record.removedNodes].some(containsVoiceRow))) apply();
			});
			observer.observe(document.documentElement, {
				subtree: true,
				childList: true,
				attributes: true,
				attributeFilter: ["data-voice-activity"]
			});
			const onVisibility = () => {
				apply();
			};
			document.addEventListener("visibilitychange", onVisibility);
			apply();
			return () => {
				disposed = true;
				generation++;
				observer.disconnect();
				document.removeEventListener("visibilitychange", onVisibility);
				release();
			};
		}
		//#endregion
		//#region src/mobile-font.ts
		/** Device-local typography for authenticated mobile pages, without Host settings writes. */
		const MOBILE_FONT_STORAGE_KEY = "dsh-mobile.content-font-size.v1";
		const MOBILE_TYPOGRAPHY_STORAGE_KEY = "dsh-mobile.typography.v1";
		const MOBILE_FONT_ROLES = ["text", "code"];
		const roleSpecs = {
			text: {
				default: 16,
				min: 12,
				variable: "--dsh-content-font-size"
			},
			code: {
				default: 11,
				min: 10,
				variable: "--dsh-code-font-size"
			}
		};
		const genericFamilies = /* @__PURE__ */ new Set([
			"serif",
			"sans-serif",
			"monospace",
			"cursive",
			"fantasy",
			"system-ui",
			"ui-serif",
			"ui-sans-serif",
			"ui-monospace",
			"ui-rounded",
			"emoji",
			"math",
			"fangsong",
			"-apple-system",
			"blinkmacsystemfont"
		]);
		const MAX_FONT_FAMILY_LENGTH = 1024;
		/** Normalize a comma-separated local font list without loading or discovering fonts. */
		function normalizeMobileFontFamily(value) {
			let result = "";
			for (const part of value.slice(0, MAX_FONT_FAMILY_LENGTH * 2).split(",")) {
				const name = part.replace(/["'\\<>\u0000-\u001f\u007f]/gu, "").replace(/\s+/gu, " ").trim();
				if (name === "") continue;
				const generic = genericFamilies.has(name.toLowerCase());
				const separator = result === "" ? "" : ", ";
				const remaining = MAX_FONT_FAMILY_LENGTH - result.length - separator.length - (generic ? 0 : 2);
				if (remaining < 1 || generic && name.length > remaining) break;
				result += separator + (generic ? name : `"${name.slice(0, remaining)}"`);
			}
			return result;
		}
		function defaultTypography(textSize = 16) {
			return Object.freeze({
				sizes: Object.freeze({
					text: textSize,
					code: roleSpecs.code.default
				}),
				families: Object.freeze({
					text: "",
					code: ""
				})
			});
		}
		/** Durable local JSON is validated independently for each typography role. */
		function readTypography(value, legacySize) {
			const fallback = defaultTypography(legacySize);
			if (value === null) return fallback;
			let parsed;
			try {
				parsed = JSON.parse(value);
			} catch (error) {
				return fallback;
			}
			if (typeof parsed !== "object" || parsed === null || !("sizes" in parsed) || !("families" in parsed)) return fallback;
			const sizes = { ...fallback.sizes };
			const families = { ...fallback.families };
			for (const role of MOBILE_FONT_ROLES) {
				if (typeof parsed.sizes === "object" && parsed.sizes !== null && role in parsed.sizes) {
					const size = Reflect.get(parsed.sizes, role);
					if (typeof size === "number" && Number.isInteger(size) && size >= roleSpecs[role].min && size <= 32) sizes[role] = size;
				}
				if (typeof parsed.families === "object" && parsed.families !== null && role in parsed.families) {
					const family = Reflect.get(parsed.families, role);
					if (typeof family === "string") families[role] = normalizeMobileFontFamily(family);
				}
			}
			return Object.freeze({
				sizes: Object.freeze(sizes),
				families: Object.freeze(families)
			});
		}
		/** Read one local storage value; malformed or unavailable preferences use the mobile default. */
		function parseMobileFontSize(value) {
			if (value === null || !/^\d+$/.test(value)) return 16;
			const size = Number(value);
			return Number.isInteger(size) && size >= 12 && size <= 32 ? size : 16;
		}
		/** Local preference storage; unavailable browser storage still permits in-page adjustment. */
		var MobileFontPreference = class {
			storage;
			typography = defaultTypography();
			listeners = /* @__PURE__ */ new Set();
			constructor(storage) {
				this.storage = storage;
				let legacySize = 16;
				try {
					legacySize = parseMobileFontSize(storage?.getItem("dsh-mobile.content-font-size.v1") ?? null);
				} catch (error) {}
				this.typography = defaultTypography(legacySize);
				try {
					this.typography = readTypography(storage?.getItem("dsh-mobile.typography.v1") ?? null, legacySize);
				} catch (error) {}
			}
			getSnapshot = () => this.typography.sizes.text;
			getTypographySnapshot = () => this.typography;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			/** Apply a user-selected size locally; never send it to DSH's settings RPC. */
			set(size) {
				this.setRoleSize("text", size);
			}
			/** Change one mobile font role independently; all values remain address-local. */
			setRoleSize(role, size) {
				if (!Number.isInteger(size) || size < roleSpecs[role].min || size > 32) throw new RangeError(`Mobile ${role} font size must be an integer from ${roleSpecs[role].min} to 32`);
				if (this.typography.sizes[role] === size) return;
				this.persist({
					sizes: Object.freeze({
						...this.typography.sizes,
						[role]: size
					}),
					families: this.typography.families
				});
			}
			/** Select existing local fonts; an empty list uses DSH's built-in font stack. */
			setRoleFamily(role, family) {
				const normalized = normalizeMobileFontFamily(family);
				if (this.typography.families[role] === normalized) return;
				this.persist({
					sizes: this.typography.sizes,
					families: Object.freeze({
						...this.typography.families,
						[role]: normalized
					})
				});
			}
			/** Restore mobile sizes and built-in font stacks without modifying Host settings. */
			reset() {
				const next = defaultTypography();
				if (MOBILE_FONT_ROLES.every((role) => this.typography.sizes[role] === next.sizes[role] && this.typography.families[role] === "")) return;
				this.persist(next);
			}
			persist(typography) {
				this.typography = Object.freeze(typography);
				try {
					this.storage?.setItem(MOBILE_TYPOGRAPHY_STORAGE_KEY, JSON.stringify(typography));
				} catch (error) {}
				try {
					this.storage?.setItem(MOBILE_FONT_STORAGE_KEY, String(typography.sizes.text));
				} catch (error) {}
				for (const listener of this.listeners) listener();
			}
		};
		/** Keep mobile typography independent from Host theme changes, including body-level portals. */
		function installMobileFontPreference() {
			let storage = null;
			try {
				storage = window.localStorage;
			} catch (error) {}
			const preference = new MobileFontPreference(storage);
			const style = document.body.style;
			const properties = MOBILE_FONT_ROLES.flatMap((role) => [roleSpecs[role].variable, `--dsh-font-family-${role}`]);
			const previous = new Map(properties.map((property) => [property, {
				value: style.getPropertyValue(property),
				priority: style.getPropertyPriority(property)
			}]));
			const owned = /* @__PURE__ */ new Map();
			const apply = () => {
				const typography = preference.getTypographySnapshot();
				for (const role of MOBILE_FONT_ROLES) for (const [property, value] of [[roleSpecs[role].variable, `${typography.sizes[role]}px`], [`--dsh-font-family-${role}`, typography.families[role]]]) {
					const current = style.getPropertyValue(property);
					const priority = style.getPropertyPriority(property);
					const last = owned.get(property);
					if (last !== void 0 && (current !== last.value || priority !== last.priority)) previous.set(property, {
						value: current,
						priority
					});
					owned.set(property, {
						value,
						priority: ""
					});
					if (current === value && priority === "") continue;
					if (value === "") style.removeProperty(property);
					else style.setProperty(property, value);
				}
			};
			apply();
			const unsubscribe = preference.subscribe(apply);
			const observer = new MutationObserver(apply);
			observer.observe(document.body, {
				attributes: true,
				attributeFilter: ["style"]
			});
			return {
				preference,
				dispose: () => {
					observer.disconnect();
					unsubscribe();
					for (const [property, value] of previous) {
						const last = owned.get(property);
						if (last === void 0 || style.getPropertyValue(property) !== last.value || style.getPropertyPriority(property) !== last.priority) continue;
						if (value.value === "") style.removeProperty(property);
						else style.setProperty(property, value.value, value.priority);
					}
				}
			};
		}
		const messages$1 = {
			zh: {
				title: "移动端字号",
				description: "仅保存在当前访问地址的本地数据中，不影响电脑或其他设备。",
				decrease: "减小移动端字号",
				increase: "增大移动端字号",
				more: "更多字体设置",
				reset: "恢复默认",
				defaultFamily: "默认字体",
				familyHint: "填写设备已有的字体，多个名称用逗号分隔；留空使用默认字体。",
				codeSize: "代码字号",
				textFamily: "正文字体",
				codeFamily: "代码字体"
			},
			en: {
				title: "Mobile font size",
				description: "Saved locally for this address, without changing your computer or other devices.",
				decrease: "Decrease mobile font size",
				increase: "Increase mobile font size",
				more: "More font settings",
				reset: "Restore defaults",
				defaultFamily: "Default font",
				familyHint: "Use fonts already on your device, separated by commas. Leave empty for the default.",
				codeSize: "Code font size",
				textFamily: "Text font",
				codeFamily: "Code font"
			},
			it: {
				title: "Dimensione testo mobile",
				description: "Salvata localmente per questo indirizzo, senza modificare il computer o altri dispositivi.",
				decrease: "Riduci il testo mobile",
				increase: "Aumenta il testo mobile",
				more: "Altre impostazioni dei caratteri",
				reset: "Ripristina predefiniti",
				defaultFamily: "Carattere predefinito",
				familyHint: "Usa caratteri presenti sul dispositivo, separati da virgole. Lascia vuoto per il predefinito.",
				codeSize: "Dimensione codice",
				textFamily: "Carattere testo",
				codeFamily: "Carattere codice"
			}
		};
		function FontFamilyInput({ preference, role, value, label, placeholder }) {
			const [draft, setDraft] = (0, react.useState)(value);
			(0, react.useEffect)(() => {
				setDraft(value);
			}, [value]);
			return (0, react.createElement)("label", { className: "dsh-mobile-settings_fontFamily" }, (0, react.createElement)("span", { className: "dsh-mobile-settings_title" }, label), (0, react.createElement)("input", {
				type: "text",
				value: draft,
				maxLength: MAX_FONT_FAMILY_LENGTH,
				placeholder,
				autoComplete: "off",
				spellCheck: false,
				"data-mobile-font-family": role,
				onChange: (event) => {
					setDraft(event.currentTarget.value);
				},
				onBlur: () => {
					preference.setRoleFamily(role, draft);
					setDraft(preference.getTypographySnapshot().families[role]);
				}
			}));
		}
		/** General settings row matching the existing Mobile controls and DSH theme tokens. */
		function MobileFontSizeRow({ preference, locale }) {
			const typography = (0, react.useSyncExternalStore)(preference.subscribe, preference.getTypographySnapshot);
			const copy = messages$1[locale];
			const controls = (role, title) => {
				const size = typography.sizes[role];
				return (0, react.createElement)("div", {
					className: "dsh-mobile-settings_fontControls",
					"data-mobile-font-role": role
				}, (0, react.createElement)("button", {
					type: "button",
					className: "dsh-mobile-settings_selector",
					"aria-label": `${copy.decrease}: ${title}`,
					disabled: size === roleSpecs[role].min,
					onClick: () => {
						preference.setRoleSize(role, size - 1);
					}
				}, "−"), (0, react.createElement)("output", {
					"aria-live": "polite",
					"aria-label": title
				}, `${size}px`), (0, react.createElement)("button", {
					type: "button",
					className: "dsh-mobile-settings_selector",
					"aria-label": `${copy.increase}: ${title}`,
					disabled: size === 32,
					onClick: () => {
						preference.setRoleSize(role, size + 1);
					}
				}, "+"));
			};
			return (0, react.createElement)("div", {
				lang: locale,
				"data-mobile-font-setting": true
			}, (0, react.createElement)("div", { className: "dsh-mobile-settings_row" }, (0, react.createElement)("div", { className: "dsh-mobile-settings_rowText" }, (0, react.createElement)("div", { className: "dsh-mobile-settings_title" }, copy.title), (0, react.createElement)("div", { className: "dsh-mobile-settings_desc" }, copy.description)), controls("text", copy.title)), (0, react.createElement)("details", { className: "dsh-mobile-settings_fontDetails" }, (0, react.createElement)("summary", null, copy.more), (0, react.createElement)("p", { className: "dsh-mobile-settings_desc" }, copy.familyHint), (0, react.createElement)("div", { className: "dsh-mobile-settings_row" }, (0, react.createElement)("span", { className: "dsh-mobile-settings_rowText dsh-mobile-settings_title" }, copy.codeSize), controls("code", copy.codeSize)), ...MOBILE_FONT_ROLES.map((role) => (0, react.createElement)(FontFamilyInput, {
				key: role,
				preference,
				role,
				value: typography.families[role],
				label: role === "text" ? copy.textFamily : copy.codeFamily,
				placeholder: copy.defaultFamily
			})), (0, react.createElement)("button", {
				type: "button",
				className: "dsh-mobile-settings_selector",
				onClick: () => {
					preference.reset();
				}
			}, copy.reset)));
		}
		//#endregion
		//#region src/mobile-display-scale.ts
		/** Native App page scaling in DSH General settings, independent from local typography. */
		/** Validate the native reply before displaying or reusing its values in a request. */
		function parseMobileDisplayScale(value) {
			if (typeof value !== "object" || value === null || !("percent" in value) || !("minPercent" in value) || !("maxPercent" in value)) throw new TypeError("Native display scale reply is invalid");
			const { percent, minPercent, maxPercent } = value;
			if (typeof percent !== "number" || !Number.isInteger(percent) || typeof minPercent !== "number" || !Number.isInteger(minPercent) || typeof maxPercent !== "number" || !Number.isInteger(maxPercent) || minPercent < 80 || maxPercent > 125 || minPercent > 100 || maxPercent < 100 || percent < minPercent || percent > maxPercent) throw new TypeError("Native display scale reply is invalid");
			return Object.freeze({
				percent,
				minPercent,
				maxPercent
			});
		}
		/** Serial native requests; a replaced bridge or disposed row cannot publish stale results. */
		var MobileDisplayScaleController = class {
			getBridge;
			snapshot = {
				state: "hidden",
				value: null
			};
			listeners = /* @__PURE__ */ new Set();
			bridge;
			generation = 0;
			active = false;
			constructor(getBridge) {
				this.getBridge = getBridge;
			}
			getSnapshot = () => this.snapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			start() {
				this.active = true;
				this.refresh();
			}
			stop() {
				this.active = false;
				this.generation += 1;
				this.bridge = void 0;
			}
			/** Discover both capabilities before showing a control or querying its current native value. */
			refresh = () => {
				if (!this.active) return;
				const generation = ++this.generation;
				const bridge = this.getBridge();
				this.bridge = bridge;
				this.publish({
					state: "hidden",
					value: null
				});
				if (bridge === void 0) return;
				Promise.resolve().then(() => bridge.capabilities()).then(async (capabilities) => {
					if (!this.current(bridge, generation)) return;
					if (!capabilities.includes("mobile.display-scale.get") || !capabilities.includes("mobile.display-scale.set")) return;
					this.publish({
						state: "loading",
						value: null
					});
					try {
						const value = parseMobileDisplayScale(await bridge.invoke("mobile.display-scale.get", {}));
						if (this.current(bridge, generation)) this.publish({
							state: "ready",
							value
						});
					} catch (error) {
						if (this.current(bridge, generation)) this.publish({
							state: "error",
							value: null
						});
					}
				}, () => {});
			};
			/** Apply a device-local value once, preserving the last confirmed value when the native request fails. */
			setPercent(percent) {
				const value = this.snapshot.value;
				const bridge = this.bridge;
				if (!this.active || bridge === void 0 || bridge !== this.getBridge() || value === null || this.snapshot.state === "busy" || this.snapshot.state === "loading") return;
				if (!Number.isInteger(percent) || percent < value.minPercent || percent > value.maxPercent) return;
				if (percent === value.percent && this.snapshot.state !== "error") return;
				const generation = this.generation;
				this.publish({
					state: "busy",
					value
				});
				Promise.resolve().then(() => this.current(bridge, generation) ? bridge.invoke("mobile.display-scale.set", { percent }) : void 0).then((reply) => {
					if (!this.current(bridge, generation)) return;
					try {
						this.publish({
							state: "ready",
							value: parseMobileDisplayScale(reply)
						});
					} catch (error) {
						this.publish({
							state: "error",
							value
						});
					}
				}, () => {
					if (this.current(bridge, generation)) this.publish({
						state: "error",
						value
					});
				});
			}
			current(bridge, generation) {
				return this.active && generation === this.generation && this.bridge === bridge && this.getBridge() === bridge;
			}
			publish(snapshot) {
				this.snapshot = Object.freeze(snapshot);
				for (const listener of this.listeners) listener();
			}
		};
		const messages = {
			zh: {
				title: "页面缩放",
				description: "调整整个页面的显示大小，仅保存在当前 App 中，与字号设置独立。",
				reset: "恢复 100%",
				loading: "读取中…",
				busy: "正在调整…",
				error: "无法调整页面缩放，请重试。",
				retry: "重试"
			},
			en: {
				title: "Page zoom",
				description: "Resize the whole page. Saved in this App, separately from font size.",
				reset: "Reset to 100%",
				loading: "Loading…",
				busy: "Applying…",
				error: "Could not change page zoom. Try again.",
				retry: "Retry"
			},
			it: {
				title: "Zoom pagina",
				description: "Ridimensiona tutta la pagina. Salvato in questa app, separatamente dalla dimensione del testo.",
				reset: "Ripristina 100%",
				loading: "Caricamento…",
				busy: "Applicazione…",
				error: "Impossibile modificare lo zoom. Riprova.",
				retry: "Riprova"
			}
		};
		/** Native-only General settings row using the existing DSH Mobile controls and locale. */
		function MobileDisplayScaleRow({ locale }) {
			const [controller] = (0, react.useState)(() => new MobileDisplayScaleController(() => window.__DSH_MOBILE_NATIVE__));
			const snapshot = (0, react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot);
			(0, react.useEffect)(() => {
				controller.start();
				window.addEventListener("dsh-mobile-native-ready", controller.refresh);
				return () => {
					window.removeEventListener("dsh-mobile-native-ready", controller.refresh);
					controller.stop();
				};
			}, [controller]);
			if (snapshot.state === "hidden") return null;
			const copy = messages[locale];
			const value = snapshot.value;
			const busy = snapshot.state === "busy" || snapshot.state === "loading";
			const description = snapshot.state === "error" ? copy.error : snapshot.state === "loading" ? copy.loading : snapshot.state === "busy" ? copy.busy : copy.description;
			const options = value === null ? [] : [.../* @__PURE__ */ new Set([
				value.minPercent,
				value.maxPercent,
				value.percent,
				...[
					80,
					85,
					90,
					95,
					100,
					105,
					110,
					115,
					120,
					125
				].filter((percent) => percent >= value.minPercent && percent <= value.maxPercent)
			])].sort((a, b) => a - b);
			return (0, react.createElement)("div", {
				className: "dsh-mobile-settings_row",
				style: { flexWrap: "wrap" },
				lang: locale,
				"data-mobile-display-scale-setting": true,
				"aria-busy": busy
			}, (0, react.createElement)("div", {
				className: "dsh-mobile-settings_rowText",
				style: {
					flexBasis: 160,
					paddingRight: 8
				}
			}, (0, react.createElement)("div", { className: "dsh-mobile-settings_title" }, copy.title), (0, react.createElement)("div", {
				className: "dsh-mobile-settings_desc",
				"aria-live": "polite"
			}, description)), (0, react.createElement)("div", { className: "dsh-mobile-settings_fontControls" }, value === null ? null : (0, react.createElement)("select", {
				className: "dsh-mobile-settings_selector",
				"aria-label": copy.title,
				disabled: busy,
				value: value.percent,
				onChange: (event) => {
					controller.setPercent(Number(event.currentTarget.value));
				}
			}, ...options.map((percent) => (0, react.createElement)("option", {
				key: percent,
				value: percent
			}, `${percent}%`))), snapshot.state === "error" ? (0, react.createElement)("button", {
				type: "button",
				className: "dsh-mobile-settings_selector",
				onClick: controller.refresh
			}, copy.retry) : (0, react.createElement)("button", {
				type: "button",
				className: "dsh-mobile-settings_selector",
				disabled: busy || value === null || value.percent === 100,
				onClick: () => {
					controller.setPercent(100);
				}
			}, copy.reset)));
		}
		//#endregion
		//#region src/local-admin-host.ts
		/** Browser-safe desktop-admin Host checks. Do not import Node APIs here. */
		const DESKTOP_ADMIN_HEADER = "x-dsh-mobile-desktop-admin";
		const DESKTOP_ADMIN_MARKER = "dsh-app://app";
		/** Add the forwarded Desktop marker only to this plugin's mutating admin requests. */
		function localAdminRequestHeaders(init, location) {
			const headers = new Headers(init?.headers);
			if (!headers.has("content-type")) headers.set("content-type", "application/json");
			headers.delete(DESKTOP_ADMIN_HEADER);
			if (init?.method?.toUpperCase() === "POST" && location.protocol === "dsh-app:" && location.hostname === "app") headers.set(DESKTOP_ADMIN_HEADER, DESKTOP_ADMIN_MARKER);
			return headers;
		}
		function unwrapBrackets(hostname) {
			return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
		}
		function parseIpv4(hostname) {
			const parts = hostname.split(".");
			if (parts.length !== 4) return void 0;
			const octets = [];
			for (const part of parts) {
				if (!/^(?:0|[1-9]\d{0,2})$/u.test(part)) return void 0;
				const value = Number(part);
				if (value > 255) return void 0;
				octets.push(value);
			}
			return octets;
		}
		function isLoopbackIpv4(octets) {
			return octets[0] === 127;
		}
		function isPrivateIpv4(octets) {
			return octets[0] === 10 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 192 && octets[1] === 168;
		}
		function isLinkLocalIpv4(octets) {
			return octets[0] === 169 && octets[1] === 254;
		}
		/**
		* Hostnames that may appear on the DSH desktop admin surface.
		* Loopback, RFC1918, and IPv4 link-local are accepted. Public IPs,
		* CGNAT, and arbitrary DNS names stay rejected so DNS rebinding
		* cannot reach `/api/mobile-access`.
		*/
		function isLocalAdminHostname(hostname) {
			const host = unwrapBrackets(hostname).trim().toLowerCase();
			if (host === "localhost" || host === "::1") return true;
			const octets = parseIpv4(host);
			if (octets === void 0) return false;
			return isLoopbackIpv4(octets) || isPrivateIpv4(octets) || isLinkLocalIpv4(octets);
		}
		/**
		* Whether the current browser document should mount the desktop Mobile access
		* control. Dedicated Mobile HTTPS (the phone surface) stays native even when
		* the Host is a private LAN address. DSH Desktop (dsh-app://app) has neither,
		* so its protocol gated on the fixed hostname "app" counts too.
		*/
		function isDesktopAdminSurface(hostname, search = "", frontend, protocol = "") {
			const query = search.startsWith("?") ? search.slice(1) : search;
			return (protocol === "dsh-app:" ? hostname === "app" : (protocol === "" || protocol === "http:" || protocol === "https:") && isLocalAdminHostname(hostname)) && frontend !== "dedicated" && !new URLSearchParams(query).has("dsh-mobile-preview");
		}
		//#endregion
		//#region src/client-module-ui.ts
		/** Device-local module selection and the computer's defaults share a read-only catalog. */
		const CLIENT_MODULE_COPY = {
			zh: {
				title: "移动页面模块",
				computer: "为移动访问设置默认加载模块，不卸载电脑上的插件。",
				device: "只为本设备选择加载模块，不改变其他手机或电脑。",
				open: "管理",
				loading: "正在读取模块…",
				hint: "勾选表示加载。启动必需的模块不能取消；依赖冲突会在保存时说明。",
				save: "保存，下次打开生效",
				reset: "恢复默认",
				close: "关闭",
				required: "启动必需",
				dependencies: "依赖：",
				saved: "已保存，不会自动刷新当前页面。重新打开 DSH 后生效。",
				failed: "暂时无法完成。请确认移动访问已启用，或检查下面的依赖冲突。",
				conflict: "无法保存：",
				computerSource: "使用电脑默认设置",
				deviceSource: "使用本设备设置",
				resetConfirm: "恢复默认模块选择？不会重新加载当前会话。"
			},
			en: {
				title: "Mobile page modules",
				computer: "Choose default modules for mobile access without uninstalling computer plugins.",
				device: "Choose modules for this device only; other phones and computers are unchanged.",
				open: "Manage",
				loading: "Reading modules…",
				hint: "Checked means loaded. Required boot modules cannot be unchecked; saving explains dependency conflicts.",
				save: "Save for next open",
				reset: "Restore defaults",
				close: "Close",
				required: "Required for boot",
				dependencies: "Depends on: ",
				saved: "Saved. This page is not reloaded automatically. Reopen DSH to apply.",
				failed: "Could not complete this operation. Enable mobile access or check the dependency conflict below.",
				conflict: "Could not save: ",
				computerSource: "Using computer defaults",
				deviceSource: "Using this device’s settings",
				resetConfirm: "Restore default module selection? The current conversation will not reload."
			},
			it: {
				title: "Moduli della pagina mobile",
				computer: "Scegli i moduli predefiniti senza disinstallare i plugin del computer.",
				device: "Scegli i moduli solo per questo dispositivo, senza cambiare gli altri.",
				open: "Gestisci",
				loading: "Lettura dei moduli…",
				hint: "Selezionato significa caricato. I moduli obbligatori non possono essere rimossi; il salvataggio mostra i conflitti.",
				save: "Salva per la prossima apertura",
				reset: "Ripristina predefiniti",
				close: "Chiudi",
				required: "Obbligatorio",
				dependencies: "Dipende da: ",
				saved: "Salvato. La pagina non viene ricaricata automaticamente. Riapri DSH per applicare.",
				failed: "Operazione non completata. Abilita accesso mobile o controlla il conflitto sotto.",
				conflict: "Impossibile salvare: ",
				computerSource: "Predefiniti del computer",
				deviceSource: "Impostazioni del dispositivo",
				resetConfirm: "Ripristinare i moduli predefiniti? La conversazione attuale non verrà ricaricata."
			}
		};
		var ClientModuleUiConflict = class extends Error {
			detail;
			constructor(detail) {
				super("client_module_conflict");
				this.detail = detail;
			}
		};
		/** Validate catalog response fields before creating interactive controls.
		* @param value - Gateway or computer-admin JSON response.
		* @returns The fields used by the module-selection dialog.
		*/
		function parseClientModuleView(value) {
			if (typeof value !== "object" || value === null || !("entries" in value) || !Array.isArray(value.entries) || !("excludedClientModules" in value) || !Array.isArray(value.excludedClientModules) || !("source" in value) || ![
				"device",
				"computer",
				"plugin"
			].includes(String(value.source))) throw new Error("invalid_module_catalog");
			return {
				entries: value.entries.map((entry) => {
					if (typeof entry !== "object" || entry === null || !("id" in entry) || typeof entry.id !== "string" || !("required" in entry) || typeof entry.required !== "boolean" || !("dependencies" in entry) || !Array.isArray(entry.dependencies)) throw new Error("invalid_module_catalog");
					const dependencies = entry.dependencies.map((dependency) => {
						if (typeof dependency !== "string") throw new Error("invalid_module_catalog");
						return dependency;
					});
					return {
						id: entry.id,
						required: entry.required,
						dependencies
					};
				}),
				excludedClientModules: value.excludedClientModules.map((id) => {
					if (typeof id !== "string") throw new Error("invalid_module_catalog");
					return id;
				}),
				source: value.source === "device" ? "device" : value.source === "computer" ? "computer" : "plugin"
			};
		}
		const CLIENT_MODULE_STYLES = `
.dsh-module-row{display:flex;align-items:center;gap:8px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dsh-module-rowText{flex:1;min-width:0}.dsh-module-title{font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dsh-module-description{margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dsh-module-button{min-height:48px;padding:0 14px;border:0;border-radius:24px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;cursor:pointer}
.dsh-module-button:focus-visible{outline:2px solid var(--dsw-alias-label-primary-bluish,#2563eb);outline-offset:2px}
.dsh-module-dialog{box-sizing:border-box;width:min(640px,calc(100vw - 24px));max-height:calc(100dvh - 32px);padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-panel,20px);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#171a21);font:16px/1.5 var(--dsw-font-family,sans-serif);overflow:auto}
.dsh-module-dialog::backdrop{background:rgb(15 23 42 / 40%)}.dsh-module-dialog h2{font-size:20px;margin:0 0 12px}
.dsh-module-dialog p{overflow-wrap:anywhere}.dsh-module-list{display:flex;flex-direction:column;gap:4px;margin:12px 0}
.dsh-module-choice{display:flex;align-items:flex-start;gap:12px;min-height:48px;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dsh-module-choice input{width:24px;height:24px;flex:none;margin:2px 0}.dsh-module-choice span{min-width:0;overflow-wrap:anywhere}
.dsh-module-choice small{display:block;font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:18px}.dsh-module-actions{display:flex;flex-wrap:wrap;gap:8px}
.dsh-module-error{color:var(--dsw-alias-state-error-primary,#b42318)}
`;
		const openDialogs = /* @__PURE__ */ new Set();
		/** Cancel pending dialogs when the owning plugin generation is disposed. */
		function disposeClientModuleDialogs() {
			for (const dispose of [...openDialogs]) dispose();
		}
		/** Close the foreground module modal before navigating its underlying DSH settings.
		* @returns Whether an open module modal consumed the return action.
		*/
		function closeClientModuleDialog() {
			const dispose = [...openDialogs].at(-1);
			if (dispose === void 0) return false;
			dispose();
			return true;
		}
		/** Open one modal; closing cancels reads and restores focus without reloading the page.
		* @param scope - Computer defaults or the authenticated device's own override.
		* @param locale - Current DSH display language.
		* @param trigger - Control to focus again when the modal closes.
		*/
		function openClientModuleSettings(scope, locale, trigger) {
			const copy = CLIENT_MODULE_COPY[locale];
			const endpoint = scope === "computer" ? "/api/mobile-access/client-modules" : "/mobile-access/client-modules";
			const controller = new AbortController();
			const dialog = document.createElement("dialog");
			dialog.className = "dsh-module-dialog";
			dialog.setAttribute("aria-label", copy.title);
			const title = document.createElement("h2");
			title.textContent = copy.title;
			const intro = document.createElement("p");
			intro.textContent = `${copy[scope]} ${copy.hint}`;
			const status = document.createElement("p");
			status.setAttribute("role", "status");
			status.setAttribute("aria-live", "polite");
			status.tabIndex = -1;
			const list = document.createElement("div");
			list.className = "dsh-module-list";
			const actions = document.createElement("div");
			actions.className = "dsh-module-actions";
			const button = (text) => {
				const result = document.createElement("button");
				result.type = "button";
				result.className = "dsh-module-button";
				result.textContent = text;
				return result;
			};
			const save = button(copy.save);
			const reset = button(copy.reset);
			const close = button(copy.close);
			actions.append(save, reset, close);
			dialog.append(title, intro, status, list, actions);
			let disposed = false;
			let busy = false;
			let loaded = false;
			const choices = /* @__PURE__ */ new Map();
			const setBusy = (value) => {
				busy = value;
				save.disabled = value || !loaded;
				reset.disabled = value || !loaded;
				for (const input of choices.values()) if (!input.dataset.required) input.disabled = value;
			};
			const request = async (body) => {
				const init = {
					method: body === void 0 ? "GET" : "POST",
					signal: controller.signal,
					...body === void 0 ? {} : { body: JSON.stringify(body) }
				};
				init.headers = scope === "computer" ? localAdminRequestHeaders(init, location) : { "content-type": "application/json" };
				if (scope === "device" && body !== void 0) {
					const csrfCookie = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("__Host-dsh_ma_csrf=")) ?? document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("dsh_ma_csrf="));
					if (csrfCookie !== void 0) {
						const headers = new Headers(init.headers);
						headers.set("x-dsh-mobile-csrf", csrfCookie.slice(csrfCookie.indexOf("=") + 1));
						init.headers = headers;
					}
				}
				const response = await fetch(endpoint, init);
				const value = await response.json();
				if (!response.ok) {
					const detail = typeof value === "object" && value !== null && "detail" in value && typeof value.detail === "string" ? value.detail.slice(0, 512) : "";
					if (response.status === 409 && detail !== "" && typeof value === "object" && value !== null && "error" in value && value.error === "excluded_client_modules_invalid") throw new ClientModuleUiConflict(detail);
					throw new Error("client_module_request_failed");
				}
				return parseClientModuleView(value);
			};
			const render = (view) => {
				if (disposed) return;
				loaded = true;
				choices.clear();
				list.replaceChildren();
				for (const entry of view.entries) {
					const label = document.createElement("label");
					label.className = "dsh-module-choice";
					const input = document.createElement("input");
					input.type = "checkbox";
					input.checked = !view.excludedClientModules.includes(entry.id);
					input.disabled = entry.required;
					if (entry.required) input.dataset.required = "true";
					const name = document.createElement("span");
					name.textContent = entry.id;
					const hint = document.createElement("small");
					hint.textContent = entry.required ? copy.required : entry.dependencies.length === 0 ? "" : `${copy.dependencies}${entry.dependencies.join(", ")}`;
					name.append(hint);
					label.append(input, name);
					list.append(label);
					choices.set(entry.id, input);
				}
				status.classList.remove("dsh-module-error");
				status.textContent = view.source === "device" ? copy.deviceSource : copy.computerSource;
			};
			const failed = (error) => {
				if (disposed || controller.signal.aborted) return;
				status.classList.add("dsh-module-error");
				status.textContent = error instanceof ClientModuleUiConflict ? `${copy.conflict}${error.detail}` : copy.failed;
				status.focus({ preventScroll: true });
			};
			const mutate = (body) => {
				if (busy || !loaded) return;
				setBusy(true);
				request(body).then((view) => {
					render(view);
					if (!disposed) status.textContent = copy.saved;
				}, failed).finally(() => {
					if (!disposed) setBusy(false);
				});
			};
			save.addEventListener("click", () => {
				mutate({ excludedClientModules: [...choices].filter(([, input]) => !input.checked).map(([id]) => id) });
			});
			reset.addEventListener("click", () => {
				if (window.confirm(copy.resetConfirm)) mutate({ reset: true });
			});
			const onBack = (event) => {
				if (!event.cancelable || !dialog.open || event.defaultPrevented) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				dispose();
			};
			window.addEventListener("dsh-mobile:native-back", onBack, true);
			const dispose = () => {
				if (disposed) return;
				disposed = true;
				controller.abort();
				openDialogs.delete(dispose);
				window.removeEventListener("dsh-mobile:native-back", onBack, true);
				if (dialog.open) dialog.close();
				dialog.remove();
				if (trigger?.isConnected) trigger.focus({ preventScroll: true });
			};
			openDialogs.add(dispose);
			dialog.addEventListener("close", dispose, { once: true });
			close.addEventListener("click", dispose);
			document.body.append(dialog);
			dialog.showModal();
			setBusy(true);
			status.textContent = copy.loading;
			request().then(render, failed).finally(() => {
				if (!disposed) setBusy(false);
			});
		}
		/** Settings row used on mobile pages and on the computer's General settings.
		* @param props - Selection scope and current locale.
		* @returns A native-style General settings row.
		*/
		function ClientModuleSettingsRow(props) {
			const copy = CLIENT_MODULE_COPY[props.locale];
			return (0, react.createElement)("div", {
				className: "dsh-module-row",
				lang: props.locale
			}, (0, react.createElement)("div", { className: "dsh-module-rowText" }, (0, react.createElement)("div", { className: "dsh-module-title" }, copy.title), (0, react.createElement)("div", { className: "dsh-module-description" }, copy[props.scope])), (0, react.createElement)("button", {
				type: "button",
				className: "dsh-module-button",
				onClick: (event) => {
					openClientModuleSettings(props.scope, props.locale, event.currentTarget);
				}
			}, copy.open));
		}
		//#endregion
		//#region src/extension-recovery-ui.ts
		/** Validate the Host response and select only stopped workers, never in-process hosts. */
		function parseUnavailableExtensionHosts(payload) {
			if (typeof payload !== "object" || payload === null || !("hosts" in payload) || !Array.isArray(payload.hosts)) return void 0;
			const ids = /* @__PURE__ */ new Set();
			const hosts = [];
			for (const value of payload.hosts) {
				if (typeof value !== "object" || value === null) return void 0;
				const entry = value;
				if (typeof entry.id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(entry.id) || ids.has(entry.id) || typeof entry.name !== "string" || entry.name.trim() === "" || entry.mode !== "worker" && entry.mode !== "in-process" || entry.state !== "ready" && entry.state !== "unavailable" || typeof entry.generation !== "string" || !/^[a-f\d]{64}$/u.test(entry.generation)) return void 0;
				ids.add(entry.id);
				if (entry.mode === "worker" && entry.state === "unavailable") hosts.push({
					id: entry.id,
					name: entry.name,
					generation: entry.generation
				});
			}
			return hosts;
		}
		/** One section shared across desktop access views; recovery is never automatic. */
		function installExtensionRecoveryControl(options) {
			const { document, signal, request, confirm, translate: t } = options;
			const section = document.createElement("section");
			section.className = "dsh-mobile-control__extension-recovery";
			section.hidden = true;
			section.setAttribute("aria-label", t("extensionRecoveryTitle"));
			const title = document.createElement("h3");
			title.textContent = t("extensionRecoveryTitle");
			const help = document.createElement("p");
			help.textContent = t("extensionRecoveryHelp");
			const list = document.createElement("ul");
			const feedback = document.createElement("p");
			feedback.className = "dsh-mobile-control__extension-recovery-error";
			feedback.hidden = true;
			feedback.setAttribute("role", "status");
			feedback.setAttribute("aria-live", "polite");
			const retry = document.createElement("button");
			retry.type = "button";
			retry.className = "dsh-mobile-control__secondary";
			retry.textContent = t("extensionRecoveryRefresh");
			retry.hidden = true;
			section.append(title, help, list, feedback, retry);
			const rows = /* @__PURE__ */ new Map();
			let hosts = [];
			let busyId;
			let errorText = "";
			let errorSource;
			let revision = 0;
			let reading = false;
			let refreshPending = false;
			let disposed = false;
			const live = () => !disposed && !signal.aborted;
			const render = () => {
				if (!live()) return;
				section.hidden = hosts.length === 0;
				section.setAttribute("aria-busy", String(busyId !== void 0));
				for (const [id, entry] of rows) {
					if (hosts.some((host) => host.id === id)) continue;
					entry.row.remove();
					rows.delete(id);
				}
				for (const host of hosts) {
					let entry = rows.get(host.id);
					if (entry === void 0) {
						const row = document.createElement("li");
						const text = document.createElement("div");
						const name = document.createElement("strong");
						const id = document.createElement("code");
						const button = document.createElement("button");
						button.type = "button";
						button.className = "dsh-mobile-control__secondary";
						button.dataset.extensionRecoveryId = host.id;
						button.addEventListener("click", () => {
							recover(host.id);
						});
						text.append(name, id);
						row.append(text, button);
						list.append(row);
						entry = {
							row,
							name,
							id,
							button
						};
						rows.set(host.id, entry);
					}
					entry.name.textContent = host.name;
					entry.id.textContent = host.id;
					entry.button.disabled = busyId !== void 0;
					entry.button.textContent = t(busyId === host.id ? "extensionRecoveryRestarting" : "extensionRecoveryRestart");
					entry.button.setAttribute("aria-label", t("extensionRecoveryRestartAria", { name: host.name }));
				}
				feedback.hidden = errorText === "";
				feedback.textContent = errorText;
				retry.hidden = errorText === "";
				retry.disabled = reading || busyId !== void 0;
			};
			const accept = (payload, recovered = false) => {
				const parsed = parseUnavailableExtensionHosts(payload);
				if (parsed === void 0) throw new Error("extension_recovery_invalid_response");
				hosts = parsed;
				if (recovered || hosts.length === 0 || errorSource === "load") {
					errorText = "";
					errorSource = void 0;
				}
				render();
			};
			const refresh = async () => {
				if (!live()) return;
				if (reading || busyId !== void 0) {
					refreshPending = true;
					return;
				}
				reading = true;
				const current = ++revision;
				render();
				try {
					const payload = await request("/api/mobile-access/extensions/hosts");
					if (live() && current === revision) accept(payload);
				} catch (_error) {
					if (live() && current === revision && hosts.length > 0 && errorSource !== "recover") {
						errorText = t("extensionRecoveryLoadFailed");
						errorSource = "load";
					}
				} finally {
					reading = false;
					if (live()) {
						render();
						if (refreshPending && busyId === void 0) {
							refreshPending = false;
							await refresh();
						}
					}
				}
			};
			const recover = async (id) => {
				const host = hosts.find((entry) => entry.id === id);
				if (!live() || busyId !== void 0 || host === void 0 || !confirm(t("extensionRecoveryConfirm", { name: host.name }))) return;
				if (!live()) return;
				busyId = id;
				errorText = "";
				errorSource = void 0;
				const current = ++revision;
				render();
				try {
					const payload = await request("/api/mobile-access/extensions/recover", {
						method: "POST",
						body: JSON.stringify({
							id,
							confirm: true
						})
					});
					if (live() && current === revision) accept(payload, true);
				} catch (error) {
					if (live() && current === revision) {
						errorText = t(error instanceof Error && error.message === "extension_changed_during_activation" ? "extensionRecoveryChanged" : "extensionRecoveryFailed");
						errorSource = "recover";
					}
				} finally {
					busyId = void 0;
					if (live()) {
						render();
						if (refreshPending && !reading) {
							refreshPending = false;
							await refresh();
						}
					}
				}
			};
			retry.addEventListener("click", () => {
				errorText = "";
				errorSource = void 0;
				refresh();
			});
			return {
				section,
				refresh,
				dispose: () => {
					disposed = true;
					revision++;
					section.remove();
					rows.clear();
				}
			};
		}
		/** Theme-owned compact recovery rows; normal connection views keep their layout. */
		const EXTENSION_RECOVERY_STYLES = `
.dsh-mobile-control__extension-recovery{margin:0 0 14px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}
.dsh-mobile-control__extension-recovery[hidden]{display:none}
.dsh-mobile-control__extension-recovery h3{margin:0 0 6px;font-size:13px;line-height:1.5;font-weight:600}
.dsh-mobile-control__extension-recovery p{margin:0 0 8px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.dsh-mobile-control__extension-recovery ul{list-style:none;margin:0;padding:0}
.dsh-mobile-control__extension-recovery li{display:flex;align-items:center;gap:12px;padding:6px 0}
.dsh-mobile-control__extension-recovery li>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;overflow-wrap:anywhere}
.dsh-mobile-control__extension-recovery strong{font-size:12px;line-height:1.5}
.dsh-mobile-control__extension-recovery code{font-size:11px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dsh-mobile-control__extension-recovery button{flex:none;box-sizing:border-box;min-height:48px;min-width:48px;white-space:normal}
.dsh-mobile-control__extension-recovery button:disabled{cursor:wait;opacity:.55}
.dsh-mobile-control__extension-recovery button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-mobile-control__extension-recovery button:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}
.dsh-mobile-control__extension-recovery .dsh-mobile-control__extension-recovery-error{color:var(--dsw-alias-label-primary)}
`;
		//#endregion
		//#region src/native-capability.ts
		/** Cancel queued calls before native effects start; started effects are not rolled back. */
		function invokeBoundNativeCapability(bridge, currentBridge, action, input, signal) {
			const abortReason = () => signal.reason ?? new DOMException("mobile extension disposed", "AbortError");
			if (signal.aborted) return Promise.reject(abortReason());
			return new Promise((resolve, reject) => {
				let settled = false;
				const finish = (callback) => {
					if (settled) return;
					settled = true;
					signal.removeEventListener("abort", onAbort);
					callback();
				};
				const onAbort = () => {
					finish(() => {
						reject(abortReason());
					});
				};
				signal.addEventListener("abort", onAbort, { once: true });
				Promise.resolve().then(() => {
					if (settled || signal.aborted) throw abortReason();
					if (currentBridge() !== bridge) throw new DOMException("native bridge changed", "AbortError");
					return bridge.invoke(action, input);
				}).then((value) => {
					finish(() => {
						resolve(value);
					});
				}, (error) => {
					finish(() => {
						reject(error);
					});
				});
			});
		}
		//#endregion
		//#region src/client.ts
		/** Map a host-reported provider onto the UI union, defaulting to the built-in one. */
		function parseMobileRemoteProvider(value) {
			return value === "cpolar" || value === "cloudflared" || value === "frp" || value === "origin" ? value : "tailscale";
		}
		/**
		* Set a surface's visibility; opening a page or overlay brings it to the front.
		* @param container - the registered surface element.
		* @param open - whether to show it.
		*/
		function setMobileSurfaceOpen(container, open) {
			container.hidden = !open;
			if (open && container.isConnected && (container.dataset.dshMobileSurfacePlacement === "page" || container.dataset.dshMobileSurfacePlacement === "overlay")) container.parentElement?.append(container);
		}
		function visibleBackLayer(view, element) {
			if (!element.isConnected || element.hidden || element.closest("[hidden],[inert],[aria-hidden=\"true\"]") !== null) return false;
			const style = view.getComputedStyle(element);
			return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
		}
		/**
		* Consume page-level surfaces and dismissible DSH overlays before layout navigation.
		* Composer model popups use DSH's Escape handling to return from a pane before closing.
		* @param view - the page window receiving the native Back request.
		* @param page - the current DSH document.
		* @param blocked - feedback for a foreground layer without a safe close action.
		* @returns a disposer for the capture listener.
		*/
		function installMobileNativeBack(view, page, blocked) {
			const onBack = (event) => {
				if (!event.cancelable || event.defaultPrevented) return;
				const claim = () => {
					event.preventDefault();
					event.stopImmediatePropagation();
				};
				if (closeClientModuleDialog()) {
					claim();
					return;
				}
				const surface = [...page.querySelectorAll("[data-dsh-mobile-surface-placement=\"page\"], [data-dsh-mobile-surface-placement=\"overlay\"]")].filter((element) => visibleBackLayer(view, element)).at(-1);
				if (surface !== void 0) {
					setMobileSurfaceOpen(surface, false);
					claim();
					return;
				}
				const modelPopups = /* @__PURE__ */ new Map();
				for (const trigger of page.querySelectorAll("[data-dsh-mobile-composer-model-trigger][aria-expanded=\"true\"]")) {
					const popupId = trigger.getAttribute("aria-controls");
					const popup = popupId === null ? null : page.getElementById(popupId);
					if (popup !== null && visibleBackLayer(view, trigger) && visibleBackLayer(view, popup) && (popup.getAttribute("role") === "menu" || popup.getAttribute("role") === "group")) modelPopups.set(popup, trigger);
				}
				const layers = [...page.querySelectorAll("[role=\"dialog\"][aria-modal=\"true\"], [role=\"menu\"], [role=\"group\"][id]")].filter((element) => visibleBackLayer(view, element) && (element.getAttribute("role") !== "group" || modelPopups.has(element)));
				const top = layers.at(-1);
				if (top === void 0) return;
				claim();
				const modelEntry = [...modelPopups].find(([popup]) => popup.contains(top));
				if (modelEntry !== void 0) {
					const [modelPopup, trigger] = modelEntry;
					if (layers.some((layer) => !modelPopup.contains(layer))) {
						blocked();
						return;
					}
					const focused = page.activeElement;
					const target = focused !== null && modelPopup.contains(focused) ? focused : trigger;
					const escape = new KeyboardEvent("keydown", {
						key: "Escape",
						code: "Escape",
						bubbles: true,
						cancelable: true
					});
					target.dispatchEvent(escape);
					if (!escape.defaultPrevented) blocked();
					return;
				}
				if (top.getAttribute("role") === "dialog") {
					const wrapper = top.parentElement;
					const mask = wrapper?.firstElementChild;
					const maskStyle = mask === void 0 || mask === null ? void 0 : view.getComputedStyle(mask);
					if (wrapper?.getAttribute("role") === "presentation" && wrapper.children.length === 2 && wrapper.lastElementChild === top && mask?.tagName === "DIV" && mask.getAttribute("aria-hidden") === "true" && mask.isConnected && !mask.hidden && maskStyle?.display !== "none" && maskStyle?.visibility !== "hidden" && mask.getClientRects().length > 0) {
						mask.click();
						return;
					}
				} else if (top.getAttribute("data-menu-material") === "translucent" && layers.filter((layer) => layer.getAttribute("role") === "menu").length === 1) {
					page.dispatchEvent(new Event("pointerdown", { bubbles: true }));
					return;
				}
				blocked();
			};
			const capture = { capture: true };
			view.addEventListener("dsh-mobile:native-back", onBack, capture);
			return () => {
				view.removeEventListener("dsh-mobile:native-back", onBack, capture);
			};
		}
		const queuedDefinitions = [];
		let queuedLegacyMount;
		if (typeof window !== "undefined" && window.dshMobile === void 0) window.dshMobile = {
			register: (mount) => {
				queuedLegacyMount = mount;
			},
			define: (definition) => {
				queuedDefinitions.push(definition);
			}
		};
		function selectMobileControlLocale(documentLanguage = "", navigatorLanguages = []) {
			for (const value of [documentLanguage, ...navigatorLanguages]) {
				const language = value.trim().toLowerCase().split(/[-_]/u)[0];
				if (language === "it" || language === "en" || language === "zh") return language;
			}
			return "en";
		}
		function selectedMobileControlLocale() {
			return selectMobileControlLocale(document.documentElement.lang, navigator.languages?.length ? navigator.languages : [navigator.language]);
		}
		/**
		* Guidance when an open third-party layer has no safe close action.
		* @param locale - current Mobile UI language.
		* @returns localized guidance.
		*/
		function mobileBackBlockedMessage(locale) {
			return {
				en: "Close the open panel first.",
				it: "Chiudi prima il pannello aperto.",
				zh: "请先关闭当前弹层。"
			}[locale];
		}
		/** Remount one plugin-owned surface when DSH changes the document language. */
		function installDshLanguageBoundSurface(install) {
			let locale = selectedMobileControlLocale();
			let dispose = install();
			const observer = new MutationObserver(() => {
				const next = selectedMobileControlLocale();
				if (next === locale) return;
				dispose();
				locale = next;
				dispose = install();
			});
			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["lang"]
			});
			return () => {
				observer.disconnect();
				dispose();
			};
		}
		function controlTranslator(locale = selectedMobileControlLocale()) {
			const messages = MOBILE_CONTROL_MESSAGES;
			return (key, values = {}) => {
				return (messages[locale][key] ?? messages.en[key] ?? key).replace(/\{(\w+)\}/gu, (_match, name) => String(values[name] ?? `{${name}}`));
			};
		}
		function normalizeDiagnosticOverall(value) {
			return value === "ok" ? "ok" : value === "attention" ? "attention" : "error";
		}
		function normalizeDiagnosticStatus(value) {
			return value === "ok" || value === "warning" || value === "error" || value === "info" ? value : "error";
		}
		function diagnosticOverallForChecks(value, statuses) {
			const normalized = statuses.map(normalizeDiagnosticStatus);
			const payloadOverall = normalizeDiagnosticOverall(value);
			if (payloadOverall === "error" || normalized.includes("error")) return "error";
			if (payloadOverall === "attention" || normalized.includes("warning")) return "attention";
			return "ok";
		}
		function validateDiagnosticChecks(value) {
			if (!Array.isArray(value)) return {
				entries: [],
				malformed: true
			};
			const entries = [];
			let malformed = false;
			for (const candidate of value) {
				if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
					malformed = true;
					continue;
				}
				entries.push(candidate);
			}
			return {
				entries,
				malformed
			};
		}
		function diagnosticEntriesForRender(data) {
			const overallKnown = data.overall === "ok" || data.overall === "attention" || data.overall === "error";
			const validated = validateDiagnosticChecks(data.checks);
			const statusesKnown = validated.entries.every((entry) => entry.status === "ok" || entry.status === "warning" || entry.status === "error" || entry.status === "info");
			if (!overallKnown || validated.malformed || validated.entries.length === 0 || !statusesKnown) throw new TypeError("diagnostics envelope is unavailable");
			return validated.entries;
		}
		function renderDiagnosticPayloadSafely(data, render, onFailure) {
			try {
				render(data);
			} catch (error) {
				onFailure(error);
			}
		}
		function diagnosticServerCopy(entry) {
			return {
				label: typeof entry.label === "string" ? entry.label : "",
				detail: typeof entry.detail === "string" ? entry.detail : "",
				action: typeof entry.action === "string" ? entry.action : ""
			};
		}
		/**
		* Match DSH's client-side privilege hint to the authenticated mobile gateway.
		* The gateway authenticates the paired device and forwards allowed requests to
		* DSH's loopback listener, so settings RPCs receive the same Host-side checks
		* as the desktop page even though the phone's visible URL is a LAN address.
		*/
		function trustAuthenticatedGatewayConnection(connection) {
			const previous = connection.isLoopback;
			connection.isLoopback = true;
			return () => {
				connection.isLoopback = previous;
			};
		}
		function element(tag, className) {
			const node = document.createElement(tag);
			if (className !== void 0) node.className = className;
			return node;
		}
		function mobileSwitchComputerCopy(locale) {
			if (locale === "zh") return {
				title: "切换电脑",
				description: "返回已配对设备列表，选择要打开的电脑。",
				action: "切换电脑",
				busy: "正在切换…",
				retry: "重试",
				error: "切换失败，请重试。"
			};
			if (locale === "it") return {
				title: "Cambia computer",
				description: "Torna all’elenco dei computer associati e scegli quale aprire.",
				action: "Cambia computer",
				busy: "Cambio in corso…",
				retry: "Riprova",
				error: "Cambio non riuscito. Riprova."
			};
			return {
				title: "Switch computer",
				description: "Return to the paired-device list and choose a computer to open.",
				action: "Switch computer",
				busy: "Switching…",
				retry: "Retry",
				error: "Could not switch computers. Try again."
			};
		}
		/** Render the native-app-only action in DSH's General settings row style. */
		function MobileSwitchComputerRow() {
			const [nativeReady, setNativeReady] = (0, react.useState)(false);
			const [state, setState] = (0, react.useState)("idle");
			(0, react.useEffect)(() => {
				let disposed = false;
				const checkNativeAction = () => {
					const bridge = window.__DSH_MOBILE_NATIVE__;
					if (bridge === void 0) {
						setNativeReady(false);
						return;
					}
					Promise.resolve().then(() => bridge.capabilities()).then((capabilities) => {
						if (!disposed) setNativeReady(capabilities.includes("mobile.switch-computer"));
					}, () => {
						if (!disposed) setNativeReady(false);
					});
				};
				checkNativeAction();
				window.addEventListener("dsh-mobile-native-ready", checkNativeAction);
				return () => {
					disposed = true;
					window.removeEventListener("dsh-mobile-native-ready", checkNativeAction);
				};
			}, []);
			if (!nativeReady) return null;
			const locale = selectedMobileControlLocale();
			const copy = mobileSwitchComputerCopy(locale);
			const invoke = () => {
				const bridge = window.__DSH_MOBILE_NATIVE__;
				if (bridge === void 0 || state === "busy") return;
				setState("busy");
				bridge.invoke("mobile.switch-computer", {}).catch(() => {
					setState("error");
				});
			};
			return (0, react.createElement)("div", {
				className: "dsh-mobile-settings_row",
				lang: locale
			}, (0, react.createElement)("div", { className: "dsh-mobile-settings_rowText" }, (0, react.createElement)("div", { className: "dsh-mobile-settings_title" }, copy.title), (0, react.createElement)("div", {
				className: "dsh-mobile-settings_desc",
				"aria-live": "polite"
			}, state === "error" ? copy.error : copy.description)), (0, react.createElement)("button", {
				type: "button",
				className: "dsh-mobile-settings_selector",
				disabled: state === "busy",
				"aria-busy": state === "busy" ? "true" : void 0,
				onClick: invoke
			}, state === "busy" ? copy.busy : state === "error" ? copy.retry : copy.action));
		}
		function mobileTaskNotificationCopy(locale) {
			if (locale === "zh") return {
				title: "任务通知",
				description: "在 Android 系统中开启任务完成和待确认提醒。",
				action: "通知设置",
				busy: "正在打开…",
				success: "请在系统提示或设置中确认任务通知权限。",
				reopen: "重新打开",
				error: "无法打开通知设置，请重试。",
				retry: "重试"
			};
			if (locale === "it") return {
				title: "Notifiche delle attività",
				description: "Attiva gli avvisi Android per le attività completate o in attesa di conferma.",
				action: "Impostazioni notifiche",
				busy: "Apertura…",
				success: "Conferma il permesso nella richiesta o nelle impostazioni di sistema.",
				reopen: "Riapri",
				error: "Impossibile aprire le impostazioni delle notifiche. Riprova.",
				retry: "Riprova"
			};
			return {
				title: "Task notifications",
				description: "Enable Android reminders for completed tasks and pending confirmation.",
				action: "Notification settings",
				busy: "Opening…",
				success: "Confirm notification access in the system prompt or settings.",
				reopen: "Open again",
				error: "Could not open notification settings. Try again.",
				retry: "Retry"
			};
		}
		/** Render the Android-only notification permission entry in DSH General settings. */
		function MobileTaskNotificationRow() {
			const [nativeReady, setNativeReady] = (0, react.useState)(false);
			const [state, setState] = (0, react.useState)("idle");
			(0, react.useEffect)(() => {
				let disposed = false;
				const checkNativeAction = () => {
					const bridge = window.__DSH_MOBILE_NATIVE__;
					if (bridge === void 0) {
						setNativeReady(false);
						return;
					}
					Promise.resolve().then(() => bridge.capabilities()).then((capabilities) => {
						if (!disposed) setNativeReady(capabilities.includes("notification.settings"));
					}, () => {
						if (!disposed) setNativeReady(false);
					});
				};
				checkNativeAction();
				window.addEventListener("dsh-mobile-native-ready", checkNativeAction);
				return () => {
					disposed = true;
					window.removeEventListener("dsh-mobile-native-ready", checkNativeAction);
				};
			}, []);
			if (!nativeReady) return null;
			const locale = selectedMobileControlLocale();
			const copy = mobileTaskNotificationCopy(locale);
			const invoke = () => {
				const bridge = window.__DSH_MOBILE_NATIVE__;
				if (bridge === void 0 || state === "busy") return;
				setState("busy");
				bridge.invoke("notification.settings", {}).then(() => {
					setState("success");
				}, () => {
					setState("error");
				});
			};
			return (0, react.createElement)("div", {
				className: "dsh-mobile-settings_row",
				lang: locale
			}, (0, react.createElement)("div", { className: "dsh-mobile-settings_rowText" }, (0, react.createElement)("div", { className: "dsh-mobile-settings_title" }, copy.title), (0, react.createElement)("div", {
				className: "dsh-mobile-settings_desc",
				"aria-live": "polite"
			}, state === "success" ? copy.success : state === "error" ? copy.error : copy.description)), (0, react.createElement)("button", {
				type: "button",
				className: "dsh-mobile-settings_selector",
				disabled: state === "busy",
				"aria-busy": state === "busy" ? "true" : void 0,
				onClick: invoke
			}, state === "busy" ? copy.busy : state === "success" ? copy.reopen : state === "error" ? copy.retry : copy.action));
		}
		const CONTROL_REQUEST_TIMEOUT_MS = 15e3;
		const LONG_CONTROL_REQUEST_TIMEOUT_MS = 21e4;
		const GITHUB_RELEASES_URL = "https://github.com/y8n/dsh-mobile-app";
		const CONTROL_PANEL_ID = "dsh-mobile-control-panel";
		function releaseVersion(value) {
			return typeof value === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value) ? value : void 0;
		}
		/** Reduce the loopback release response to trusted text and download metadata. */
		function clientReleaseInfo(data) {
            const latestVersion = releaseVersion(data.latestVersion);
            return {
                updateAvailable: false,
                androidDownloadAvailable: false,
                ...latestVersion === void 0 ? {} : { latestVersion },
                androidDownloadUrl: GITHUB_RELEASES_URL,
                ...typeof data.releaseNotes === "string" && data.releaseNotes !== "" ? { releaseNotes: data.releaseNotes.slice(0, 4e3) } : {}
            };
        }

		async function requestJson(path, init, timeoutMs = CONTROL_REQUEST_TIMEOUT_MS) {
			const controller = new AbortController();
			const upstreamSignal = init?.signal;
			const abortFromUpstream = () => {
				controller.abort(upstreamSignal?.reason);
			};
			if (upstreamSignal?.aborted === true) abortFromUpstream();
			else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
			const timer = window.setTimeout(() => {
				controller.abort();
			}, timeoutMs);
			try {
				const response = await fetch(path, {
					...init,
					signal: controller.signal,
					headers: localAdminRequestHeaders(init, location)
				});
				const body = await response.json();
				if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP ${String(response.status)}`);
				return body;
			} catch (error) {
				if (controller.signal.aborted && upstreamSignal?.aborted !== true) throw new Error(controlTranslator()("requestTimeout"));
				throw error;
			} finally {
				clearTimeout(timer);
				upstreamSignal?.removeEventListener("abort", abortFromUpstream);
			}
		}
		function officialFunnelSetupUrl(value) {
			if (typeof value !== "string" || value.length > 2048) return "";
			let url;
			try {
				url = new URL(value);
			} catch {
				return "";
			}
			const normalized = url.toString().replace(/\/$/u, "");
			if (normalized === "https://tailscale.com/s/no-funnel" || normalized === "https://tailscale.com/s/https") return normalized;
			if (url.protocol !== "https:" || url.hostname !== "login.tailscale.com" || url.port !== "" || url.username !== "" || url.password !== "") return "";
			return url.toString();
		}
		/** Build the copy-only restricted VPS template without sending the token to the host API. */
		function createFrpServerTemplateForClipboard(serverPort, token, publicOrigin) {
			return createRestrictedFrpServerTemplate(serverPort, token, publicOrigin);
		}
		/**
		* Validate the panel form with the same parser the host uses, so a runbook can
		* never describe a topology the provider would later refuse to start.
		*/
		function attachClipboardSettings(form) {
			return parseFrpSettings({
				serverAddress: form.serverAddress,
				serverPort: form.serverPort,
				token: form.token,
				publicOrigin: form.publicOrigin,
				mode: "attach",
				entryTls: form.entryTls,
				...form.entryTls === "self-signed" || form.vhostHttpPort === void 0 ? {} : { vhostHttpPort: form.vhostHttpPort },
				...form.publicPort === void 0 ? {} : { publicPort: form.publicPort }
			});
		}
		/**
		* Build the copy-only attach runbook locally, so the shared token never leaves
		* the browser: the panel only ever copies text out. The text is masked by
		* default; `options.revealToken` is the explicit opt-in.
		*/
		function createFrpAttachTemplateForClipboard(form, options = {}) {
			return createFrpAttachTemplate(attachClipboardSettings(form), options);
		}
		/**
		* The frpc.toml exactly as the plugin writes it (0600), for the panel's explicit
		* reveal action only. Every other path keeps the token masked.
		*/
		function createFrpAttachFrpcTomlForClipboard(form, options = {}) {
			return createFrpAttachFrpcToml(attachClipboardSettings(form), options);
		}
		/**
		* Attach-mode validation for the panel. The parser is the single source of
		* truth, so the panel reports exactly the codes the host would return instead of
		* duplicating the rules (and drifting from them).
		*/
		function frpAttachFormErrorCode(form) {
			try {
				createFrpAttachTemplateForClipboard(form);
				return;
			} catch (error) {
				return error instanceof Error ? error.message : "frp_settings_invalid";
			}
		}
		const ORIGIN_ERROR_MESSAGE_KEYS = {
			origin_public_origin_invalid: "originPublicOriginInvalid",
			origin_listen_host_invalid: "originListenHostInvalid",
			origin_listen_port_invalid: "originListenPortInvalid",
			origin_listen_port_reserved: "originListenPortReserved",
			origin_allowed_cidrs_invalid: "originAllowedCidrsInvalid",
			origin_settings_invalid: "originSettingsInvalid",
			origin_config_missing: "originConfigMissing",
			origin_config_invalid: "originConfigInvalid",
			origin_config_target_invalid: "originConfigTargetInvalid",
			origin_controller_unavailable: "originControllerUnavailable",
			origin_listen_port_in_use: "originPortInUse",
			origin_listen_address_unavailable: "originAddressUnavailable",
			origin_gateway_start_failed: "originStartFailed"
		};
		/** Provider failure codes shared by status, failed requests, and diagnostics. */
		const REMOTE_ERROR_MESSAGE_KEYS = {
			funnel_permission_required: "funnelPermission",
			funnel_https_required: "funnelHttps",
			funnel_start_failed: "funnelStart",
			funnel_start_timeout: "funnelTimeout",
			funnel_state_invalid: "funnelStateInvalid",
			cpolar_path_invalid: "componentPathUnsafe",
			cloudflared_path_invalid: "componentPathUnsafe",
			cloudflared_tunnel_path_invalid: "componentPathUnsafe",
			frp_path_invalid: "componentPathUnsafe",
			frp_config_path_invalid: "componentPathUnsafe",
			frp_ingress_path_invalid: "componentPathUnsafe",
			caddy_path_invalid: "componentPathUnsafe",
			tailscale_dns_missing: "tailscaleDnsMissing",
			gateway_start_failed: "gatewayStartFailed",
			control_channel_failed: "controlChannelFailed",
			cpolar_component_missing: "cpolarMissing",
			cpolar_component_invalid: "cpolarInvalid",
			cpolar_download_failed: "cpolarDownloadFailed",
			cpolar_download_timeout: "cpolarDownloadTimeout",
			cpolar_download_size_mismatch: "cpolarIntegrityFailed",
			cpolar_download_hash_mismatch: "cpolarIntegrityFailed",
			cpolar_executable_hash_mismatch: "cpolarIntegrityFailed",
			cpolar_download_redirect_missing: "cpolarDownloadFailed",
			cpolar_download_redirect_invalid: "cpolarDownloadFailed",
			cpolar_download_redirect_rejected: "cpolarDownloadFailed",
			cpolar_installer_missing: "cpolarExtractFailed",
			cpolar_executable_missing: "cpolarExtractFailed",
			cpolar_extract_failed: "cpolarExtractFailed",
			cpolar_storage_failed: "cpolarStorageFailed",
			cpolar_config_missing: "cpolarConfigMissing",
			cpolar_config_invalid: "cpolarConfigInvalid",
			cpolar_port_unavailable: "cpolarPortUnavailable",
			cpolar_launch_failed: "cpolarLaunchFailed",
			cpolar_start_timeout: "cpolarTimeout",
			cpolar_stopped: "cpolarStopped",
			cpolar_exited: "cpolarExited",
			cpolar_invalid_output: "cpolarOutputInvalid",
			cpolar_invalid_origin: "cpolarOriginInvalid",
			cloudflared_component_missing: "cloudflaredMissing",
			cloudflared_component_invalid: "cloudflaredInvalid",
			cloudflared_port_unavailable: "cloudflaredPortUnavailable",
			cloudflared_launch_failed: "cloudflaredLaunchFailed",
			cloudflared_start_timeout: "cloudflaredTimeout",
			cloudflared_stopped: "cloudflaredStopped",
			cloudflared_exited: "cloudflaredExited",
			cloudflared_invalid_output: "cloudflaredOutputInvalid",
			cloudflared_invalid_origin: "cloudflaredOriginInvalid",
			cloudflared_tunnel_port_unavailable: "cloudflaredTunnelPortUnavailable",
			cloudflared_tunnel_hostname_invalid: "cloudflaredTunnelHostnameInvalid",
			cloudflared_tunnel_port_invalid: "cloudflaredTunnelPortInvalid",
			cloudflared_tunnel_port_reserved: "cloudflaredTunnelPortReserved",
			cloudflared_tunnel_token_invalid: "cloudflaredTunnelTokenInvalid",
			cloudflared_tunnel_settings_invalid: "cloudflaredTunnelSettingsInvalid",
			cloudflared_tunnel_config_missing: "cloudflaredTunnelConfigMissing",
			cloudflared_tunnel_config_invalid: "cloudflaredTunnelInvalid",
			cloudflared_tunnel_target_invalid: "cloudflaredTunnelTargetInvalid",
			cloudflared_component_unsupported: "cloudflaredComponentUnsupported",
			cloudflared_download_hash_mismatch: "cloudflaredDownloadHashMismatch",
			cloudflared_download_size_mismatch: "cloudflaredDownloadSizeMismatch",
			cloudflared_executable_hash_mismatch: "cloudflaredExecutableHashMismatch",
			cloudflared_download_redirect_missing: "cloudflaredDownloadRedirectMissing",
			cloudflared_download_redirect_invalid: "cloudflaredDownloadRedirectInvalid",
			cloudflared_download_redirect_rejected: "cloudflaredDownloadRedirectRejected",
			cloudflared_port_reservation_failed: "cloudflaredPortReservationFailed",
			frp_component_missing: "frpMissing",
			frp_component_invalid: "frpInvalid",
			frp_config_missing: "frpConfigMissing",
			frp_config_verify_failed: "frpConfigVerifyFailed",
			frp_vhost_publicly_reachable: "frpVhostPublic",
			frp_vhost_probe_failed: "frpVhostProbeFailed",
			frp_launch_failed: "frpLaunchFailed",
			frp_start_timeout: "frpTimeout",
			frp_proxy_name_in_use: "frpProxyNameInUse",
			frp_remote_port_in_use: "frpRemotePortInUse",
			frp_proxy_start_failed: "frpProxyStartFailed",
			frp_discovery_mismatch: "frpDiscoveryMismatch",
			frp_discovery_invalid: "frpDiscoveryInvalid",
			frp_stopped: "frpStopped",
			frp_exited: "frpExited",
			frp_attach_mode_requires_vhost_port: "frpAttachModeRequiresVhostPort",
			frp_attach_cert_unknown: "frpAttachCertUnknownError",
			frp_entry_tls_invalid: "frpEntryTlsInvalid",
			frp_self_signed_requires_public_ipv4: "frpSelfSignedRequiresPublicIpv4",
			frp_ingress_ca_expired: "frpIngressCaExpired",
			frp_ingress_ca_invalid: "frpIngressCaInvalid",
			frp_ingress_ca_changed: "frpIngressCaChanged",
			frp_ingress_renewal_failed: "frpIngressRenewalFailed",
			...ORIGIN_ERROR_MESSAGE_KEYS
		};
		const DIAGNOSTIC_CONTROLLER_ACTION_OVERRIDES = {
			component_missing: "remoteUnavailableTailscale",
			sidecar_launch_failed: "remoteUnavailableTailscale",
			sidecar_stopped: "controlChannelFailed",
			sidecar_exited: "controlChannelFailed"
		};
		/** Only codes with a specific diagnostic action use the status message key. */
		const DIAGNOSTIC_CONTROLLER_ACTION_CODES = /* @__PURE__ */ new Set([
			...Object.keys(ORIGIN_ERROR_MESSAGE_KEYS),
			"funnel_permission_required",
			"funnel_https_required",
			"funnel_start_failed",
			"funnel_start_timeout",
			"tailscale_dns_missing",
			"control_channel_failed",
			"gateway_start_failed",
			"cpolar_component_missing",
			"cpolar_component_invalid",
			"cpolar_config_missing",
			"cpolar_config_invalid",
			"funnel_state_invalid",
			"cpolar_start_timeout",
			"cpolar_stopped",
			"cpolar_exited",
			"cloudflared_component_missing",
			"cloudflared_component_invalid",
			"cloudflared_component_unsupported",
			"cloudflared_port_unavailable",
			"cloudflared_port_reservation_failed",
			"cloudflared_launch_failed",
			"cloudflared_start_timeout",
			"cloudflared_stopped",
			"cloudflared_exited",
			"cloudflared_invalid_origin",
			"cloudflared_tunnel_port_unavailable",
			"cloudflared_tunnel_config_invalid",
			"cloudflared_tunnel_target_invalid",
			"cloudflared_download_hash_mismatch",
			"cloudflared_download_size_mismatch",
			"cloudflared_executable_hash_mismatch",
			"frp_component_missing",
			"frp_component_invalid",
			"frp_config_missing",
			"frp_config_verify_failed",
			"frp_vhost_publicly_reachable",
			"frp_vhost_probe_failed",
			"frp_launch_failed",
			"frp_start_timeout",
			"frp_proxy_name_in_use",
			"frp_remote_port_in_use",
			"frp_proxy_start_failed",
			"frp_discovery_mismatch",
			"frp_discovery_invalid",
			"frp_stopped",
			"frp_exited",
			"frp_attach_mode_requires_vhost_port",
			"frp_attach_cert_unknown",
			"frp_entry_tls_invalid",
			"frp_self_signed_requires_public_ipv4",
			"frp_ingress_ca_expired",
			"frp_ingress_ca_invalid",
			"frp_ingress_ca_changed",
			"frp_ingress_renewal_failed"
		]);
		/** Resolve the next-step text for a remote-controller diagnostic. */
		function diagnosticControllerAction(code, locale, fallback) {
			if (typeof code !== "string") return fallback;
			const key = DIAGNOSTIC_CONTROLLER_ACTION_OVERRIDES[code] ?? (DIAGNOSTIC_CONTROLLER_ACTION_CODES.has(code) ? REMOTE_ERROR_MESSAGE_KEYS[code] : void 0);
			return key === void 0 ? fallback : controlTranslator(locale)(key);
		}
		function installControl() {
			/** The table above, translated, for the status repaint. */
			const translatedRemoteErrors = () => Object.fromEntries(Object.entries(REMOTE_ERROR_MESSAGE_KEYS).map(([code, key]) => [code, t(key)]));
			/**
			* Text for a failed control request.
			*
			* A rejection carries its code in `error.message`, so a known code renders its
			* translated sentence; only an unrecognized one falls back to the generic message,
			* and it shows the bare message rather than a stringified Error.
			*/
			const remoteFailureTextFor = (error, fallbackKey) => {
				const message = error instanceof Error ? error.message : String(error);
				const cpolarHttpStatus = /^cpolar_download_http_(\d{3})$/u.exec(message)?.[1];
				if (cpolarHttpStatus !== void 0) return t("cpolarDownloadHttp", { status: cpolarHttpStatus });
				const key = REMOTE_ERROR_MESSAGE_KEYS[message];
				return key === void 0 ? t(fallbackKey, { error: message }) : t(key);
			};
			const locale = selectedMobileControlLocale();
			const localeTag = locale === "it" ? "it-IT" : locale === "zh" ? "zh-CN" : "en-US";
			const t = controlTranslator(locale);
			const lifecycle = new AbortController();
			const controlRequestJson = (path, init, timeoutMs) => requestJson(path, {
				...init,
				signal: lifecycle.signal
			}, timeoutMs);
			const extensionRecovery = installExtensionRecoveryControl({
				document,
				signal: lifecycle.signal,
				request: controlRequestJson,
				confirm: (message) => window.confirm(message),
				translate: t
			});
			const root = element("div", "dsh-mobile-control");
			root.lang = locale;
			const panel = element("section", "dsh-mobile-control__panel");
			panel.id = CONTROL_PANEL_ID;
			panel.hidden = true;
			panel.lang = locale;
			panel.setAttribute("aria-label", t("mobileAccess"));
			const header = element("header", "dsh-mobile-control__header");
			const title = element("h2");
			title.textContent = t("mobileAccess");
			const headerActions = element("div", "dsh-mobile-control__header-actions");
			const updatePlugin = element("button", "dsh-mobile-control__update-plugin");
			updatePlugin.type = "button";
			updatePlugin.textContent = t("updatePlugin");
			updatePlugin.hidden = true;
			const updateCard = element("div", "dsh-mobile-control__update-card");
			updateCard.hidden = true;
			const updateCardTitle = element("div", "dsh-mobile-control__update-card-title");
			const updateCardNotes = element("pre", "dsh-mobile-control__update-notes");
			updateCardNotes.setAttribute("tabindex", "0");
			const updateCardNotice = element("p", "dsh-mobile-control__update-notice");
			updateCardNotice.textContent = t("updateNotice");
			const updateActions = element("div", "dsh-mobile-control__update-actions");
			const updateNow = element("button", "dsh-mobile-control__primary");
			updateNow.type = "button";
			updateNow.textContent = t("updateNow");
			const updateLater = element("button", "dsh-mobile-control__secondary");
			updateLater.type = "button";
			updateLater.textContent = t("updateLater");
			updateActions.append(updateLater, updateNow);
			updateCard.append(updateCardTitle, updateCardNotes, updateCardNotice, updateActions);
			const diagnosticsEntry = element("button", "dsh-mobile-control__diagnostic-entry");
			diagnosticsEntry.type = "button";
			diagnosticsEntry.textContent = t("diagnostics");
			diagnosticsEntry.setAttribute("aria-label", t("openDiagnostics"));
			diagnosticsEntry.setAttribute("aria-pressed", "false");
			const close = element("button", "dsh-mobile-control__close");
			close.type = "button";
			close.textContent = "×";
			close.setAttribute("aria-label", t("collapseMobileAccess"));
			headerActions.append(updatePlugin, diagnosticsEntry, close);
			const releaseNotice = element("p", "dsh-mobile-control__release-notice");
			releaseNotice.hidden = true;
			releaseNotice.setAttribute("role", "status");
			releaseNotice.setAttribute("aria-live", "polite");
			const appDownload = element("a", "dsh-mobile-control__app-download");
			appDownload.hidden = true;
			appDownload.href = GITHUB_RELEASES_URL;
			appDownload.target = "_blank";
			appDownload.rel = "noopener noreferrer";
			appDownload.textContent = t("downloadAndroid");
			appDownload.setAttribute("aria-label", t("downloadAndroidAria"));
			const projectInfo = element("section", "dsh-mobile-project-info");
            const language = selectedMobileControlLocale();
            const projectCopy = language === "zh" ? ["项目主页", "更新说明", "使用帮助", "问题反馈", "通过本项目获取版本，使用插件管理器安装更新。", "本次版本说明"] : language === "it" ? ["Progetto", "Aggiornamenti", "Guida", "Segnala un problema", "Scarica dal progetto e installa tramite il gestore plugin.", "Note della versione"] : ["Project", "Updates", "Help", "Feedback", "Get releases from this project and install through the plugin manager.", "Version notes"];
            const projectNav = element("nav", "dsh-mobile-project-links");
            ["https://github.com/y8n/dsh-mobile-app", "https://github.com/y8n/dsh-mobile-app/commits/main", "https://github.com/y8n/dsh-mobile-app/blob/main/docs/README.md", "https://github.com/y8n/dsh-mobile-app/issues"].forEach((url, index) => {
                const link = element("a"); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = projectCopy[index]; projectNav.append(link);
            });
            const projectInstructions = element("p"); projectInstructions.textContent = projectCopy[4];
            const projectNotes = element("details"); const projectNotesTitle = element("summary"); projectNotesTitle.textContent = projectCopy[5];
            const projectNotesBody = element("pre"); projectNotes.append(projectNotesTitle, projectNotesBody); projectNotes.hidden = true;
            projectInfo.append(projectNav, projectInstructions, projectNotes);
			const switcher = element("div", "dsh-mobile-control__switcher");
			const lanTab = element("button", "dsh-mobile-control__tab is-active");
			lanTab.type = "button";
			lanTab.textContent = t("lan");
			const remoteTab = element("button", "dsh-mobile-control__tab");
			remoteTab.type = "button";
			remoteTab.textContent = t("remote");
			lanTab.setAttribute("aria-pressed", "true");
			remoteTab.setAttribute("aria-pressed", "false");
			switcher.append(lanTab, remoteTab);
			const lanView = element("div", "dsh-mobile-control__view");
			const lanSetup = element("section", "dsh-mobile-control__lan-setup");
			lanSetup.hidden = true;
			const lanSetupTitle = element("h3", "dsh-mobile-control__section-title");
			lanSetupTitle.textContent = t("lanSetupTitle");
			const lanSetupIntro = element("p", "dsh-mobile-control__intro");
			lanSetupIntro.textContent = t("lanSetupIntro");
			const lanSetupForm = element("div", "dsh-mobile-control__lan-setup-form");
			const lanSetupLabel = element("label", "dsh-mobile-control__field");
			lanSetupLabel.textContent = t("lanSetupNetwork");
			const lanSetupSelect = element("select");
			lanSetupSelect.setAttribute("aria-label", t("lanSetupNetwork"));
			const lanSetupNote = element("p", "dsh-mobile-control__component-note");
			lanSetupNote.textContent = t("lanSetupFirewallNote");
			const lanSetupActions = element("div", "dsh-mobile-control__lan-setup-actions");
			const lanSetupRefresh = element("button", "dsh-mobile-control__secondary");
			lanSetupRefresh.type = "button";
			lanSetupRefresh.textContent = t("lanSetupRefresh");
			const lanSetupConfigure = element("button", "dsh-mobile-control__primary");
			lanSetupConfigure.type = "button";
			lanSetupConfigure.textContent = t("lanSetupConfigure");
			const lanSetupStatus = element("p", "dsh-mobile-control__status");
			lanSetupStatus.setAttribute("role", "status");
			lanSetupStatus.setAttribute("aria-live", "polite");
			const trustedNetworks = element("details", "dsh-mobile-control__details");
			const trustedNetworksSummary = element("summary");
			trustedNetworksSummary.textContent = t("trustedNetworksTitle");
			const trustedNetworksHelp = element("p", "dsh-mobile-control__component-note");
			trustedNetworksHelp.textContent = t("trustedNetworksHelp");
			const trustedNetworksLabel = element("label", "dsh-mobile-control__field");
			trustedNetworksLabel.textContent = t("trustedNetworksLabel");
			const trustedNetworksInput = element("textarea");
			trustedNetworksInput.rows = 2;
			trustedNetworksInput.placeholder = "11.24.0.0/24\n2001:db8::/32";
			trustedNetworksInput.autocomplete = "off";
			trustedNetworksInput.spellcheck = false;
			const trustedNetworksSave = element("button", "dsh-mobile-control__secondary");
			trustedNetworksSave.type = "button";
			trustedNetworksSave.textContent = t("trustedNetworksSave");
			const trustedNetworksStatus = element("p", "dsh-mobile-control__status");
			trustedNetworksStatus.setAttribute("role", "status");
			trustedNetworksStatus.setAttribute("aria-live", "polite");
			trustedNetworksLabel.append(trustedNetworksInput);
			trustedNetworks.append(trustedNetworksSummary, trustedNetworksHelp, trustedNetworksLabel, trustedNetworksSave, trustedNetworksStatus);
			let trustedNetworksLoaded = false;
			let trustedNetworksLoading = false;
			let trustedNetworksSupported = false;
			let trustedNetworksDirty = false;
			let trustedNetworksBusy = false;
			const syncTrustedNetworksControls = () => {
				const enabled = trustedNetworksLoaded && trustedNetworksSupported && !trustedNetworksLoading && !trustedNetworksBusy;
				trustedNetworksInput.disabled = !enabled;
				trustedNetworksSave.disabled = !enabled;
				trustedNetworks.setAttribute("aria-busy", String(trustedNetworksLoading || trustedNetworksBusy));
			};
			syncTrustedNetworksControls();
			const renderTrustedNetworks = (data) => {
				trustedNetworksLoaded = true;
				trustedNetworksSupported = data.supported === true;
				syncTrustedNetworksControls();
				if (!trustedNetworksDirty) trustedNetworksInput.value = Array.isArray(data.extraAllowedCidrs) ? data.extraAllowedCidrs.filter((value) => typeof value === "string").join("\n") : "";
				trustedNetworksStatus.textContent = !trustedNetworksSupported ? t("trustedNetworksUnavailable") : data.restartRequired === true ? t("trustedNetworksRestart") : "";
				trustedNetworksHelp.textContent = `${t("trustedNetworksHelp")}${data.windowsFirewall === true ? ` ${t("trustedNetworksWindows")}` : ""}`;
			};
			trustedNetworks.addEventListener("toggle", () => {
				if (!trustedNetworks.open || trustedNetworksLoaded || trustedNetworksLoading) return;
				trustedNetworksLoading = true;
				syncTrustedNetworksControls();
				trustedNetworksStatus.textContent = t("loadingStatus");
				controlRequestJson("/api/mobile-access/lan/trusted-networks").then(renderTrustedNetworks, () => {
					trustedNetworksLoaded = false;
					trustedNetworksSupported = false;
					trustedNetworksStatus.textContent = t("trustedNetworksFailed");
				}).finally(() => {
					trustedNetworksLoading = false;
					syncTrustedNetworksControls();
				});
			});
			trustedNetworksInput.addEventListener("input", () => {
				trustedNetworksDirty = true;
				trustedNetworksInput.removeAttribute("aria-invalid");
			});
			trustedNetworksSave.addEventListener("click", () => {
				if (trustedNetworksBusy || !trustedNetworksLoaded || !trustedNetworksSupported) return;
				trustedNetworksBusy = true;
				syncTrustedNetworksControls();
				const extraAllowedCidrs = trustedNetworksInput.value.trim().split(/[\s,]+/u).filter(Boolean);
				controlRequestJson("/api/mobile-access/lan/trusted-networks", {
					method: "POST",
					body: JSON.stringify({ extraAllowedCidrs })
				}).then((data) => {
					trustedNetworksDirty = false;
					renderTrustedNetworks(data);
				}, () => {
					trustedNetworksStatus.textContent = t("trustedNetworksInvalid");
					trustedNetworksInput.setAttribute("aria-invalid", "true");
				}).finally(() => {
					trustedNetworksBusy = false;
					syncTrustedNetworksControls();
				});
			});
			lanSetupLabel.append(lanSetupSelect);
			lanSetupActions.append(lanSetupRefresh, lanSetupConfigure);
			lanSetupForm.append(lanSetupLabel, lanSetupNote, lanSetupActions);
			lanSetup.append(lanSetupTitle, lanSetupIntro, lanSetupForm, lanSetupStatus);
			const access = element("div", "dsh-mobile-control__access");
			access.hidden = true;
			const accessLabel = element("span", "dsh-mobile-control__access-label");
			accessLabel.textContent = t("browserAccess");
			const accessLink = element("a", "dsh-mobile-control__access-link");
			accessLink.target = "_blank";
			accessLink.rel = "noreferrer";
			access.append(accessLabel, accessLink);
			const qrBox = element("div", "dsh-mobile-control__qr");
			qrBox.hidden = true;
			const status = element("p", "dsh-mobile-control__status");
			status.textContent = t("loadingStatus");
			const extensionStatus = element("p", "dsh-mobile-control__extensions");
			extensionStatus.hidden = true;
			const actions = element("div", "dsh-mobile-control__actions");
			const toggle = element("button", "dsh-mobile-control__secondary");
			toggle.type = "button";
			const pair = element("button", "dsh-mobile-control__primary");
			pair.type = "button";
			pair.textContent = t("generateCopyKey");
			const linkPair = element("button", "dsh-mobile-control__secondary");
			linkPair.type = "button";
			linkPair.textContent = t("copyPairLink");
			const manageRow = element("div", "dsh-mobile-control__manage-row");
			const manageDevices = element("button", "dsh-mobile-control__manage");
			manageDevices.type = "button";
			manageDevices.textContent = t("managePairedDevices");
			const resetAll = element("button", "dsh-mobile-control__manage");
			resetAll.type = "button";
			resetAll.textContent = t("clearAllDevices");
			manageRow.append(manageDevices, resetAll);
			const devicePanel = element("div", "dsh-mobile-control__devices");
			devicePanel.hidden = true;
			const remoteView = element("div", "dsh-mobile-control__view is-remote");
			remoteView.hidden = true;
			const remoteIntro = element("p", "dsh-mobile-control__intro");
			remoteIntro.textContent = t("remoteIntro");
			const httpFrameWarning = element("p", "dsh-mobile-control__http-frame-warning");
			httpFrameWarning.textContent = t("httpFrameWarning");
			httpFrameWarning.hidden = location.protocol !== "https:";
			httpFrameWarning.setAttribute("role", "note");
			const providerSection = element("section", "dsh-mobile-control__provider-section");
			const providerHeading = element("h3", "dsh-mobile-control__section-title");
			providerHeading.textContent = t("chooseProvider");
			const providerInfo = element("div", "dsh-mobile-control__provider-info");
			const providerInfoButton = element("button", "dsh-mobile-control__provider-info-button");
			providerInfoButton.type = "button";
			providerInfoButton.setAttribute("aria-label", t("providerInfoAria"));
			providerInfoButton.setAttribute("aria-expanded", "false");
			providerInfoButton.setAttribute("aria-controls", "dsh-mobile-provider-info");
			providerInfoButton.setAttribute("aria-describedby", "dsh-mobile-provider-info");
			const providerInfoGlyph = element("span", "dsh-mobile-control__provider-info-glyph");
			providerInfoGlyph.textContent = "i";
			providerInfoGlyph.setAttribute("aria-hidden", "true");
			const providerInfoPopover = element("div", "dsh-mobile-control__provider-info-popover");
			providerInfoPopover.id = "dsh-mobile-provider-info";
			providerInfoPopover.setAttribute("role", "tooltip");
			providerInfoPopover.hidden = true;
			const providerInfoTitle = element("strong");
			providerInfoTitle.textContent = t("providerSafeTitle");
			const providerInfoText = element("span");
			providerInfoText.textContent = t("providerSafeText");
			providerInfoButton.append(providerInfoGlyph);
			providerInfoPopover.append(providerInfoTitle, providerInfoText);
			providerInfo.append(providerInfoButton, providerInfoPopover);
			const providerChoices = element("div", "dsh-mobile-control__provider-choices");
			providerChoices.setAttribute("role", "radiogroup");
			providerChoices.setAttribute("aria-label", t("providerGroupAria"));
			const tailscaleChoice = element("button", "dsh-mobile-control__provider");
			tailscaleChoice.type = "button";
			tailscaleChoice.setAttribute("role", "radio");
			tailscaleChoice.setAttribute("aria-checked", "true");
			const tailscaleChoiceTop = element("span", "dsh-mobile-control__provider-top");
			const tailscaleChoiceName = element("strong");
			tailscaleChoiceName.textContent = "Tailscale Funnel";
			const tailscaleChoiceBadge = element("span", "dsh-mobile-control__provider-badge");
			tailscaleChoiceBadge.textContent = t("builtIn");
			const tailscaleChoiceDescription = element("span", "dsh-mobile-control__provider-description");
			tailscaleChoiceDescription.textContent = t("tailscaleDescription");
			tailscaleChoiceTop.append(tailscaleChoiceName, tailscaleChoiceBadge);
			tailscaleChoice.append(tailscaleChoiceTop, tailscaleChoiceDescription);
			const cpolarChoice = element("button", "dsh-mobile-control__provider");
			cpolarChoice.type = "button";
			cpolarChoice.setAttribute("role", "radio");
			cpolarChoice.setAttribute("aria-checked", "false");
			const cpolarChoiceTop = element("span", "dsh-mobile-control__provider-top");
			const cpolarChoiceName = element("strong");
			cpolarChoiceName.textContent = "cpolar";
			const cpolarChoiceBadge = element("span", "dsh-mobile-control__provider-badge is-cpolar");
			cpolarChoiceBadge.textContent = t("mainlandPreferred");
			const cpolarChoiceDescription = element("span", "dsh-mobile-control__provider-description");
			cpolarChoiceDescription.textContent = t("cpolarDescription");
			cpolarChoiceTop.append(cpolarChoiceName, cpolarChoiceBadge);
			cpolarChoice.append(cpolarChoiceTop, cpolarChoiceDescription);
			const cloudflaredChoice = element("button", "dsh-mobile-control__provider");
			cloudflaredChoice.type = "button";
			cloudflaredChoice.setAttribute("role", "radio");
			cloudflaredChoice.setAttribute("aria-checked", "false");
			const cloudflaredChoiceTop = element("span", "dsh-mobile-control__provider-top");
			const cloudflaredChoiceName = element("strong");
			cloudflaredChoiceName.textContent = "cloudflared";
			const cloudflaredChoiceBadge = element("span", "dsh-mobile-control__provider-badge");
			cloudflaredChoiceBadge.textContent = t("cloudflaredBadge");
			const cloudflaredChoiceDescription = element("span", "dsh-mobile-control__provider-description");
			cloudflaredChoiceDescription.textContent = t("cloudflaredDescription");
			cloudflaredChoiceTop.append(cloudflaredChoiceName, cloudflaredChoiceBadge);
			cloudflaredChoice.append(cloudflaredChoiceTop, cloudflaredChoiceDescription);
			providerChoices.append(cpolarChoice, cloudflaredChoice, tailscaleChoice);
			const providerCardOrder = [
				cpolarChoice,
				cloudflaredChoice,
				tailscaleChoice
			];
			providerChoices.addEventListener("keydown", (event) => {
				const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
				const jump = event.key === "Home" ? 0 : event.key === "End" ? providerCardOrder.length - 1 : void 0;
				if (step === 0 && jump === void 0) return;
				const current = providerCardOrder.indexOf(document.activeElement);
				if (current < 0) return;
				const next = jump ?? (current + step + providerCardOrder.length) % providerCardOrder.length;
				event.preventDefault();
				providerCardOrder[next]?.focus();
			});
			const cpolarSetup = element("section", "dsh-mobile-control__cpolar-setup");
			cpolarSetup.hidden = true;
			const cpolarSetupTitle = element("h3", "dsh-mobile-control__section-title");
			cpolarSetupTitle.textContent = t("prepareCpolar");
			const cpolarComponentStatus = element("p", "dsh-mobile-control__component-status");
			cpolarComponentStatus.textContent = t("checkingComponent");
			const cpolarInstall = element("button", "dsh-mobile-control__primary");
			cpolarInstall.type = "button";
			cpolarInstall.textContent = t("installOfficial");
			const cpolarAccount = element("div", "dsh-mobile-control__cpolar-account");
			cpolarAccount.hidden = true;
			const cpolarAccountText = element("p", "dsh-mobile-control__component-note");
			cpolarAccountText.textContent = t("cpolarAccountNote");
			const cpolarAccountLinks = element("div", "dsh-mobile-control__link-row");
			const cpolarSignup = element("a", "dsh-mobile-control__text-link");
			cpolarSignup.href = "https://dashboard.cpolar.com/signup";
			cpolarSignup.target = "_blank";
			cpolarSignup.rel = "noopener noreferrer";
			cpolarSignup.textContent = t("registerCpolar");
			const cpolarDashboard = element("a", "dsh-mobile-control__text-link");
			cpolarDashboard.href = "https://dashboard.cpolar.com/auth";
			cpolarDashboard.target = "_blank";
			cpolarDashboard.rel = "noopener noreferrer";
			cpolarDashboard.textContent = t("openDashboard");
			cpolarAccountLinks.append(cpolarSignup, cpolarDashboard);
			const cpolarTokenLabel = element("label", "dsh-mobile-control__token-label");
			cpolarTokenLabel.textContent = "Authtoken";
			const cpolarToken = element("input", "dsh-mobile-control__token");
			cpolarToken.type = "password";
			cpolarToken.autocomplete = "off";
			cpolarToken.spellcheck = false;
			cpolarToken.placeholder = t("tokenPlaceholder");
			cpolarTokenLabel.append(cpolarToken);
			const cpolarConfigure = element("button", "dsh-mobile-control__primary dsh-mobile-control__cpolar-connect");
			cpolarConfigure.type = "button";
			cpolarConfigure.textContent = t("saveConnect");
			cpolarAccount.append(cpolarAccountText, cpolarAccountLinks, cpolarTokenLabel, cpolarConfigure);
			const cpolarDetails = element("details", "dsh-mobile-control__details");
			const cpolarDetailsSummary = element("summary");
			cpolarDetailsSummary.textContent = t("componentDetails");
			const cpolarDetailsBody = element("div", "dsh-mobile-control__details-body");
			const cpolarDetailsText = element("p");
			cpolarDetailsText.textContent = t("componentDetailsText");
			const cpolarStorage = element("code", "dsh-mobile-control__storage");
			cpolarStorage.textContent = t("pluginPrivateDirectory");
			const cpolarOfficial = element("a", "dsh-mobile-control__text-link");
			cpolarOfficial.href = "https://www.cpolar.com/download";
			cpolarOfficial.target = "_blank";
			cpolarOfficial.rel = "noopener noreferrer";
			cpolarOfficial.textContent = t("officialDownload");
			const cpolarTerms = element("a", "dsh-mobile-control__text-link");
			cpolarTerms.href = "https://www.cpolar.com/tos";
			cpolarTerms.target = "_blank";
			cpolarTerms.rel = "noopener noreferrer";
			cpolarTerms.textContent = t("terms");
			const cpolarPurge = element("button", "dsh-mobile-control__danger");
			cpolarPurge.type = "button";
			cpolarPurge.textContent = t("purgeCpolar");
			cpolarDetailsBody.append(cpolarDetailsText, cpolarStorage, cpolarOfficial, cpolarTerms, cpolarPurge);
			cpolarDetails.append(cpolarDetailsSummary, cpolarDetailsBody);
			cpolarSetup.append(cpolarSetupTitle, cpolarComponentStatus, cpolarInstall, cpolarAccount, cpolarDetails);
			const cloudflaredSetup = element("section", "dsh-mobile-control__cpolar-setup dsh-mobile-control__cloudflared-setup");
			cloudflaredSetup.hidden = true;
			const cloudflaredSetupTitle = element("h3", "dsh-mobile-control__section-title");
			cloudflaredSetupTitle.textContent = t("prepareCloudflared");
			const cloudflaredTunnelTitle = element("h3", "dsh-mobile-control__section-title");
			cloudflaredTunnelTitle.textContent = t("cloudflaredTunnelTitle");
			const cloudflaredMode = element("div", "dsh-mobile-control__switcher");
			const cloudflaredModeQuick = element("button", "dsh-mobile-control__tab is-active");
			cloudflaredModeQuick.type = "button";
			cloudflaredModeQuick.textContent = t("cloudflaredTunnelQuick");
			const cloudflaredModeNamed = element("button", "dsh-mobile-control__tab");
			cloudflaredModeNamed.type = "button";
			cloudflaredModeNamed.textContent = t("cloudflaredTunnelNamed");
			cloudflaredMode.append(cloudflaredModeQuick, cloudflaredModeNamed);
			const cloudflaredModeHint = element("p", "dsh-mobile-control__component-status");
			cloudflaredModeHint.textContent = t("cloudflaredTunnelQuickHint");
			const cloudflaredTunnel = element("div", "dsh-mobile-control__tunnel");
			cloudflaredTunnel.hidden = true;
			const cloudflaredTunnelFields = element("div", "dsh-mobile-control__frp-fields");
			const cloudflaredHostnameLabel = element("label", "dsh-mobile-control__field");
			cloudflaredHostnameLabel.textContent = t("cloudflaredTunnelHostname");
			const cloudflaredHostname = element("input");
			cloudflaredHostname.type = "text";
			cloudflaredHostname.autocomplete = "off";
			cloudflaredHostname.spellcheck = false;
			cloudflaredHostname.placeholder = t("cloudflaredTunnelHostnamePlaceholder");
			const cloudflaredPortLabel = element("label", "dsh-mobile-control__field");
			cloudflaredPortLabel.textContent = t("cloudflaredTunnelPort");
			const cloudflaredPort = element("input");
			cloudflaredPort.type = "number";
			cloudflaredPort.inputMode = "numeric";
			cloudflaredPort.min = "1024";
			cloudflaredPort.max = "65535";
			cloudflaredPort.value = "3444";
			const cloudflaredTokenLabel = element("label", "dsh-mobile-control__field");
			cloudflaredTokenLabel.textContent = t("cloudflaredTunnelToken");
			const cloudflaredToken = element("input");
			cloudflaredToken.type = "password";
			cloudflaredToken.autocomplete = "off";
			cloudflaredToken.spellcheck = false;
			cloudflaredToken.placeholder = t("cloudflaredTunnelTokenPlaceholder");
			cloudflaredHostnameLabel.append(cloudflaredHostname);
			cloudflaredPortLabel.append(cloudflaredPort);
			cloudflaredTokenLabel.append(cloudflaredToken);
			cloudflaredTunnelFields.append(cloudflaredHostnameLabel, cloudflaredPortLabel, cloudflaredTokenLabel);
			const cloudflaredTunnelStatus = element("p", "dsh-mobile-control__component-status");
			cloudflaredTunnelStatus.textContent = t("cloudflaredTunnelMissing");
			const cloudflaredTunnelHint = element("p", "dsh-mobile-control__component-status");
			cloudflaredTunnelHint.textContent = t("cloudflaredTunnelHint", { port: "3444" });
			const cloudflaredTunnelSave = element("button", "dsh-mobile-control__primary dsh-mobile-control__frp-action");
			cloudflaredTunnelSave.type = "button";
			cloudflaredTunnelSave.textContent = t("cloudflaredTunnelSave");
			/** The button commits the shown mode, so quick mode must not promise to save settings. */
			const cloudflaredSaveLabel = () => (cloudflaredModeDraft ?? cloudflaredTunnelMode) === "named" ? t("cloudflaredTunnelSave") : t("cloudflaredTunnelSaveQuick");
			const cloudflaredTunnelForget = element("button", "dsh-mobile-control__danger dsh-mobile-control__frp-action");
			cloudflaredTunnelForget.type = "button";
			cloudflaredTunnelForget.textContent = t("cloudflaredTunnelForget");
			cloudflaredTunnelForget.hidden = true;
			cloudflaredTunnel.append(cloudflaredTunnelFields, cloudflaredTunnelStatus, cloudflaredTunnelHint);
			const cloudflaredComponentStatus = element("p", "dsh-mobile-control__component-status");
			cloudflaredComponentStatus.textContent = t("checkingComponent");
			const cloudflaredInstall = element("button", "dsh-mobile-control__primary");
			cloudflaredInstall.type = "button";
			cloudflaredInstall.textContent = t("installOfficial");
			const cloudflaredNote = element("p", "dsh-mobile-control__origin-warning");
			cloudflaredNote.textContent = t("cloudflaredQuickNote");
			const cloudflaredDetails = element("details", "dsh-mobile-control__details");
			const cloudflaredDetailsSummary = element("summary");
			cloudflaredDetailsSummary.textContent = t("componentDetails");
			const cloudflaredDetailsBody = element("div", "dsh-mobile-control__details-body");
			const cloudflaredDetailsText = element("p");
			cloudflaredDetailsText.textContent = t("cloudflaredComponentNote");
			const cloudflaredStorage = element("code", "dsh-mobile-control__storage");
			cloudflaredStorage.textContent = t("pluginPrivateDirectory");
			const cloudflaredOfficial = element("a", "dsh-mobile-control__text-link");
			cloudflaredOfficial.href = "https://github.com/cloudflare/cloudflared/releases";
			cloudflaredOfficial.target = "_blank";
			cloudflaredOfficial.rel = "noopener noreferrer";
			cloudflaredOfficial.textContent = t("officialDownload");
			const cloudflaredTerms = element("a", "dsh-mobile-control__text-link");
			cloudflaredTerms.href = "https://www.cloudflare.com/website-terms/";
			cloudflaredTerms.target = "_blank";
			cloudflaredTerms.rel = "noopener noreferrer";
			cloudflaredTerms.textContent = t("terms");
			const cloudflaredPurge = element("button", "dsh-mobile-control__danger");
			cloudflaredPurge.type = "button";
			cloudflaredPurge.textContent = t("purgeCloudflared");
			cloudflaredDetailsBody.append(cloudflaredDetailsText, cloudflaredStorage, cloudflaredOfficial, cloudflaredTerms, cloudflaredPurge);
			cloudflaredDetails.append(cloudflaredDetailsSummary, cloudflaredDetailsBody);
			cloudflaredSetup.append(cloudflaredSetupTitle, cloudflaredTunnelTitle, cloudflaredMode, cloudflaredModeHint, cloudflaredTunnel, cloudflaredTunnelSave, cloudflaredTunnelForget, cloudflaredComponentStatus, cloudflaredInstall, cloudflaredNote, cloudflaredDetails);
			const selfHosted = element("details", "dsh-mobile-control__self-hosted");
			const selfHostedSummary = element("summary", "dsh-mobile-control__self-hosted-summary");
			const selfHostedSummaryText = element("span");
			const selfHostedSummaryTitle = element("strong");
			selfHostedSummaryTitle.textContent = t("selfHostedConnections");
			const selfHostedSummaryDescription = element("span");
			selfHostedSummaryDescription.textContent = t("selfHostedDescription");
			const selfHostedBadge = element("span", "dsh-mobile-control__provider-badge is-frp");
			selfHostedBadge.textContent = t("advanced");
			selfHostedSummaryText.append(selfHostedSummaryTitle, selfHostedSummaryDescription);
			selfHostedSummary.append(selfHostedSummaryText, selfHostedBadge);
			const selfHostedBody = element("div", "dsh-mobile-control__self-hosted-body");
			const frpChoice = element("button", "dsh-mobile-control__provider is-frp");
			frpChoice.type = "button";
			frpChoice.setAttribute("aria-pressed", "false");
			const frpChoiceTop = element("span", "dsh-mobile-control__provider-top");
			const frpChoiceName = element("strong");
			frpChoiceName.textContent = t("frpName");
			const frpChoiceDescription = element("span", "dsh-mobile-control__provider-description");
			frpChoiceDescription.textContent = t("frpDescription");
			frpChoiceTop.append(frpChoiceName);
			frpChoice.append(frpChoiceTop, frpChoiceDescription);
			const originChoice = element("button", "dsh-mobile-control__provider is-origin");
			originChoice.type = "button";
			originChoice.setAttribute("aria-pressed", "false");
			const originChoiceTop = element("span", "dsh-mobile-control__provider-top");
			const originChoiceName = element("strong");
			originChoiceName.textContent = t("originName");
			const originChoiceDescription = element("span", "dsh-mobile-control__provider-description");
			originChoiceDescription.textContent = t("originDescription");
			originChoiceTop.append(originChoiceName);
			originChoice.append(originChoiceTop, originChoiceDescription);
			selfHostedBody.append(frpChoice, originChoice);
			selfHosted.append(selfHostedSummary, selfHostedBody);
			providerSection.append(providerHeading, providerInfo, providerChoices, selfHosted);
			const frpSetup = element("section", "dsh-mobile-control__frp-setup");
			frpSetup.hidden = true;
			const frpSetupTitle = element("h3", "dsh-mobile-control__section-title");
			frpSetupTitle.textContent = t("prepareFrp");
			const frpStep1 = element("section", "dsh-mobile-control__frp-step");
			const frpStep1Title = element("strong");
			frpStep1Title.textContent = t("frpStep1Title");
			const frpStep1Text = element("p");
			frpStep1Text.textContent = t("frpStep1Text");
			const frpFields = element("div", "dsh-mobile-control__frp-fields");
			const frpServerLabel = element("label", "dsh-mobile-control__field");
			frpServerLabel.textContent = t("frpServerAddress");
			const frpServer = element("input");
			frpServer.type = "text";
			frpServer.autocomplete = "off";
			frpServer.spellcheck = false;
			frpServer.placeholder = t("frpServerAddressPlaceholder");
			const frpPortLabel = element("label", "dsh-mobile-control__field");
			frpPortLabel.textContent = t("frpServerPort");
			const frpPort = element("input");
			frpPort.type = "number";
			frpPort.inputMode = "numeric";
			frpPort.min = "1";
			frpPort.max = "65535";
			frpPort.value = "7000";
			const frpTokenLabel = element("label", "dsh-mobile-control__field");
			frpTokenLabel.textContent = t("frpToken");
			const frpToken = element("input");
			frpToken.type = "password";
			frpToken.autocomplete = "off";
			frpToken.spellcheck = false;
			frpToken.placeholder = t("frpTokenPlaceholder");
			const frpOriginLabel = element("label", "dsh-mobile-control__field");
			frpOriginLabel.textContent = t("frpPublicOrigin");
			const frpOrigin = element("input");
			frpOrigin.type = "url";
			frpOrigin.autocomplete = "off";
			frpOrigin.spellcheck = false;
			frpOrigin.placeholder = t("frpPublicOriginPlaceholder");
			const frpModeLabel = element("label", "dsh-mobile-control__field");
			frpModeLabel.textContent = t("frpMode");
			const frpMode = element("select");
			for (const [value, label] of [["deploy", t("frpModeDeploy")], ["attach", t("frpModeAttach")]]) {
				const option = element("option");
				option.value = value;
				option.textContent = label;
				frpMode.append(option);
			}
			const frpModeHint = element("p", "dsh-mobile-control__frp-hint");
			frpModeHint.textContent = t("frpModeHint");
			frpModeLabel.append(frpMode, frpModeHint);
			const frpEntryTlsLabel = element("label", "dsh-mobile-control__field");
			frpEntryTlsLabel.textContent = t("frpEntryTls");
			const frpEntryTls = element("select");
			for (const [value, label] of [["public-ip-cert", t("frpEntryTlsPublic")], ["self-signed", t("frpEntryTlsSelfSigned")]]) {
				const option = element("option");
				option.value = value;
				option.textContent = label;
				frpEntryTls.append(option);
			}
			frpEntryTlsLabel.append(frpEntryTls);
			const frpVhostLabel = element("label", "dsh-mobile-control__field");
			frpVhostLabel.textContent = t("frpVhostHttpPort");
			const frpVhostPort = element("input");
			frpVhostPort.type = "number";
			frpVhostPort.inputMode = "numeric";
			frpVhostPort.min = "1";
			frpVhostPort.max = "65535";
			frpVhostPort.placeholder = "7080";
			const frpVhostHint = element("p", "dsh-mobile-control__frp-hint");
			frpVhostHint.id = "dsh-mobile-frp-vhost-hint";
			frpVhostHint.textContent = t("frpVhostHttpPortHint");
			frpVhostPort.setAttribute("aria-describedby", frpVhostHint.id);
			frpVhostLabel.append(frpVhostPort, frpVhostHint);
			const frpPublicPortLabel = element("label", "dsh-mobile-control__field");
			frpPublicPortLabel.textContent = t("frpPublicPort");
			const frpPublicPort = element("input");
			frpPublicPort.type = "number";
			frpPublicPort.inputMode = "numeric";
			frpPublicPort.min = "1";
			frpPublicPort.max = "65535";
			frpPublicPort.value = "33080";
			frpPublicPort.placeholder = "33080";
			const frpPublicPortHint = element("p", "dsh-mobile-control__frp-hint");
			frpPublicPortHint.textContent = t("frpPublicPortHint");
			frpPublicPortLabel.append(frpPublicPort, frpPublicPortHint);
			frpServerLabel.append(frpServer);
			frpPortLabel.append(frpPort);
			frpTokenLabel.append(frpToken);
			frpOriginLabel.append(frpOrigin);
			frpFields.append(frpServerLabel, frpPortLabel, frpTokenLabel, frpOriginLabel, frpModeLabel, frpEntryTlsLabel, frpVhostLabel, frpPublicPortLabel);
			frpStep1.append(frpStep1Title, frpStep1Text, frpFields);
			const frpStep2 = element("section", "dsh-mobile-control__frp-step");
			const frpStep2Title = element("strong");
			frpStep2Title.textContent = t("frpStep2Title");
			const frpStep2Text = element("p");
			frpStep2Text.textContent = t("frpStep2Text");
			const frpCopyTemplate = element("button", "dsh-mobile-control__secondary dsh-mobile-control__frp-action");
			frpCopyTemplate.type = "button";
			frpCopyTemplate.textContent = t("copyServerTemplate");
			const frpCopyAttachPlan = element("button", "dsh-mobile-control__secondary dsh-mobile-control__frp-action");
			frpCopyAttachPlan.type = "button";
			frpCopyAttachPlan.textContent = t("frpAttachPlan");
			frpCopyAttachPlan.hidden = true;
			frpCopyAttachPlan.disabled = true;
			const frpCopyAttachToken = element("button", "dsh-mobile-control__secondary dsh-mobile-control__frp-action");
			frpCopyAttachToken.type = "button";
			frpCopyAttachToken.textContent = t("frpAttachToken");
			frpCopyAttachToken.hidden = true;
			frpCopyAttachToken.disabled = true;
			const frpSelfCheckButton = element("button", "dsh-mobile-control__secondary dsh-mobile-control__frp-action");
			frpSelfCheckButton.type = "button";
			frpSelfCheckButton.textContent = t("frpAttachSelfCheck");
			frpSelfCheckButton.hidden = true;
			const frpSelfCheckStatus = element("p", "dsh-mobile-control__component-status");
			frpSelfCheckStatus.textContent = "";
			frpSelfCheckStatus.hidden = true;
			const vpsDeployText = element("p");
			vpsDeployText.textContent = t("vpsDeployText");
			const vpsChangesTitle = element("p");
			vpsChangesTitle.textContent = t("vpsDeployChangesTitle");
			const vpsChanges = element("ul", "dsh-mobile-control__frp-changes");
			for (const key of [
				"vpsDeployChangePackages",
				"vpsDeployChangeServices",
				"vpsDeployChangeFirewall",
				"vpsDeployChangeManual"
			]) {
				const item = element("li");
				item.textContent = t(key);
				vpsChanges.append(item);
			}
			const vpsDeployFields = element("div", "dsh-mobile-control__frp-fields");
			const vpsSshUserLabel = element("label", "dsh-mobile-control__field");
			vpsSshUserLabel.textContent = t("vpsSshUser");
			const vpsSshUser = element("input");
			vpsSshUser.type = "text";
			vpsSshUser.autocomplete = "username";
			vpsSshUser.value = "ubuntu";
			vpsSshUser.spellcheck = false;
			const vpsSshPortLabel = element("label", "dsh-mobile-control__field");
			vpsSshPortLabel.textContent = t("vpsSshPort");
			const vpsSshPort = element("input");
			vpsSshPort.type = "number";
			vpsSshPort.inputMode = "numeric";
			vpsSshPort.min = "1";
			vpsSshPort.max = "65535";
			vpsSshPort.value = "22";
			const vpsSshKeyLabel = element("label", "dsh-mobile-control__field");
			vpsSshKeyLabel.textContent = t("vpsSshKey");
			const vpsSshKey = element("input");
			vpsSshKey.type = "text";
			vpsSshKey.autocomplete = "off";
			vpsSshKey.spellcheck = false;
			vpsSshKey.placeholder = t("vpsSshKeyPlaceholder");
			vpsSshUserLabel.append(vpsSshUser);
			vpsSshPortLabel.append(vpsSshPort);
			vpsSshKeyLabel.append(vpsSshKey);
			vpsDeployFields.append(vpsSshUserLabel, vpsSshPortLabel, vpsSshKeyLabel);
			const vpsDeploy = element("button", "dsh-mobile-control__primary dsh-mobile-control__frp-action");
			vpsDeploy.type = "button";
			vpsDeploy.textContent = t("vpsDeploy");
			const vpsDeployStatus = element("p", "dsh-mobile-control__component-status");
			vpsDeployStatus.textContent = "";
			const vpsCopyUninstall = element("button", "dsh-mobile-control__secondary dsh-mobile-control__frp-action");
			vpsCopyUninstall.type = "button";
			vpsCopyUninstall.textContent = t("vpsCopyUninstall");
			const vpsUninstall = element("button", "dsh-mobile-control__danger dsh-mobile-control__frp-action");
			vpsUninstall.type = "button";
			vpsUninstall.textContent = t("vpsUninstall");
			frpStep2.append(frpStep2Title, frpStep2Text, frpCopyTemplate, frpCopyAttachPlan, frpCopyAttachToken, frpSelfCheckButton, frpSelfCheckStatus, vpsDeployText, vpsChangesTitle, vpsChanges, vpsDeployFields, vpsDeploy, vpsDeployStatus, vpsCopyUninstall, vpsUninstall);
			const frpStep3 = element("section", "dsh-mobile-control__frp-step");
			const frpStep3Title = element("strong");
			frpStep3Title.textContent = t("frpStep3Title");
			const frpStep3Text = element("p");
			frpStep3Text.textContent = t("frpStep3Text");
			const frpComponentStatus = element("p", "dsh-mobile-control__component-status");
			frpComponentStatus.textContent = t("checkingComponent");
			const frpInstall = element("button", "dsh-mobile-control__primary dsh-mobile-control__frp-action");
			frpInstall.type = "button";
			frpInstall.textContent = t("installFrpc");
			frpStep3.append(frpStep3Title, frpStep3Text, frpComponentStatus, frpInstall);
			const frpStep4 = element("section", "dsh-mobile-control__frp-step");
			const frpStep4Title = element("strong");
			frpStep4Title.textContent = t("frpStep4Title");
			const frpStep4Text = element("p");
			frpStep4Text.textContent = t("frpStep4Text");
			const frpAppRequirement = element("p", "dsh-mobile-control__frp-requirement");
			frpAppRequirement.textContent = t("frpAppRequirement");
			const frpConfigurationStatus = element("p", "dsh-mobile-control__component-status");
			frpConfigurationStatus.textContent = t("frpConfigurationMissing");
			const frpConfigure = element("button", "dsh-mobile-control__primary dsh-mobile-control__frp-action");
			frpConfigure.type = "button";
			frpConfigure.textContent = t("frpSaveConnect");
			frpStep4.append(frpStep4Title, frpStep4Text, frpAppRequirement, frpConfigurationStatus, frpConfigure);
			const frpDetails = element("details", "dsh-mobile-control__details");
			const frpDetailsSummary = element("summary");
			frpDetailsSummary.textContent = t("frpComponentDetails");
			const frpDetailsBody = element("div", "dsh-mobile-control__details-body");
			const frpDetailsText = element("p");
			frpDetailsText.textContent = t("frpComponentDetailsText");
			const frpStorage = element("code", "dsh-mobile-control__storage");
			frpStorage.textContent = t("pluginPrivateDirectory");
			const frpOfficial = element("a", "dsh-mobile-control__text-link");
			frpOfficial.href = "https://github.com/fatedier/frp/releases/tag/v0.70.1";
			frpOfficial.target = "_blank";
			frpOfficial.rel = "noopener noreferrer";
			frpOfficial.textContent = t("frpOfficialRelease");
			const frpPurge = element("button", "dsh-mobile-control__danger");
			frpPurge.type = "button";
			frpPurge.textContent = t("purgeFrp");
			frpDetailsBody.append(frpDetailsText, frpStorage, frpOfficial, frpPurge);
			frpDetails.append(frpDetailsSummary, frpDetailsBody);
			const frpOverview = element("section", "dsh-mobile-control__frp-overview");
			frpOverview.hidden = true;
			const frpOverviewMark = element("span", "dsh-mobile-control__frp-overview-mark");
			frpOverviewMark.textContent = "✓";
			const frpOverviewBody = element("div", "dsh-mobile-control__frp-overview-body");
			const frpOverviewTitle = element("strong");
			frpOverviewTitle.textContent = t("frpConfigurationReady");
			const frpOverviewEndpoint = element("span");
			frpOverviewEndpoint.textContent = "";
			frpOverviewBody.append(frpOverviewTitle, frpOverviewEndpoint);
			frpOverview.append(frpOverviewMark, frpOverviewBody);
			const frpConnectionGroup = element("details", "dsh-mobile-control__frp-group");
			const frpConnectionSummary = element("summary");
			frpConnectionSummary.textContent = t("frpStep1Title");
			frpConnectionGroup.append(frpConnectionSummary, frpStep1);
			const frpVpsGroup = element("details", "dsh-mobile-control__frp-group");
			const frpVpsSummary = element("summary");
			frpVpsSummary.textContent = t("frpStep2Title");
			frpVpsGroup.append(frpVpsSummary, frpStep2);
			const frpComponentGroup = element("details", "dsh-mobile-control__frp-group");
			const frpComponentSummary = element("summary");
			frpComponentSummary.textContent = t("frpStep3Title");
			frpComponentGroup.append(frpComponentSummary, frpStep3);
			const frpVerifyGroup = element("details", "dsh-mobile-control__frp-group");
			frpVerifyGroup.open = true;
			const frpVerifySummary = element("summary");
			frpVerifySummary.textContent = t("frpStep4Title");
			frpVerifyGroup.append(frpVerifySummary, frpStep4);
			frpSetup.append(frpSetupTitle, frpOverview, frpConnectionGroup, frpVpsGroup, frpComponentGroup, frpVerifyGroup, frpDetails);
			const originSetup = element("section", "dsh-mobile-control__origin-setup");
			originSetup.hidden = true;
			const originSetupTitle = element("h3", "dsh-mobile-control__section-title");
			originSetupTitle.textContent = t("originHttpsTitle");
			const originHelp = element("p", "dsh-mobile-control__component-note");
			originHelp.id = "dsh-mobile-origin-help";
			originHelp.textContent = t("originHelp");
			const originWarning = element("p", "dsh-mobile-control__origin-warning");
			originWarning.textContent = t("originWarning");
			const originFields = element("div", "dsh-mobile-control__origin-fields");
			const originPublicLabel = element("label", "dsh-mobile-control__field dsh-mobile-control__field--full");
			originPublicLabel.textContent = t("originPublicOrigin");
			const originPublic = element("input");
			originPublic.type = "url";
			originPublic.placeholder = "https://phone.example.com:8815";
			originPublic.maxLength = 512;
			const originHostLabel = element("label", "dsh-mobile-control__field");
			originHostLabel.textContent = t("originListenHost");
			const originHost = element("input");
			originHost.type = "text";
			originHost.value = "127.0.0.1";
			originHost.maxLength = 15;
			const originPortLabel = element("label", "dsh-mobile-control__field");
			originPortLabel.textContent = t("originListenPort");
			const originPort = element("input");
			originPort.type = "number";
			originPort.inputMode = "numeric";
			originPort.min = "1024";
			originPort.max = "65535";
			originPort.step = "1";
			originPort.value = "3444";
			const originCidrsLabel = element("label", "dsh-mobile-control__field dsh-mobile-control__field--full");
			originCidrsLabel.textContent = t("originAllowedCidrs");
			const originCidrs = element("input");
			originCidrs.type = "text";
			originCidrs.value = "127.0.0.0/8";
			originCidrs.maxLength = 1040;
			for (const input of [
				originPublic,
				originHost,
				originPort,
				originCidrs
			]) {
				input.required = true;
				input.autocomplete = "off";
				input.spellcheck = false;
				input.setAttribute("aria-describedby", "dsh-mobile-origin-help dsh-mobile-origin-feedback");
			}
			originPublicLabel.append(originPublic);
			originHostLabel.append(originHost);
			originPortLabel.append(originPort);
			originCidrsLabel.append(originCidrs);
			originFields.append(originPublicLabel, originHostLabel, originPortLabel, originCidrsLabel);
			const originFeedback = element("p", "dsh-mobile-control__origin-feedback");
			originFeedback.id = "dsh-mobile-origin-feedback";
			originFeedback.setAttribute("role", "status");
			originFeedback.setAttribute("aria-live", "polite");
			originFeedback.hidden = true;
			const originConfigure = element("button", "dsh-mobile-control__primary");
			originConfigure.type = "button";
			originConfigure.textContent = t("originSaveStart");
			const originPurge = element("button", "dsh-mobile-control__danger");
			originPurge.type = "button";
			originPurge.textContent = t("originPurge");
			originPurge.hidden = true;
			const originFormActions = element("div", "dsh-mobile-control__actions");
			originFormActions.append(originConfigure, originPurge);
			const originBackend = element("div", "dsh-mobile-control__origin-backend");
			originBackend.hidden = true;
			const originBackendLabel = element("span", "dsh-mobile-control__access-label");
			const originBackendAddress = element("code", "dsh-mobile-control__storage");
			const originCopyBackend = element("button", "dsh-mobile-control__secondary");
			originCopyBackend.type = "button";
			originCopyBackend.textContent = t("originCopyBackend");
			originBackend.append(originBackendLabel, originBackendAddress, originCopyBackend);
			const caddyModeRow = element("fieldset", "dsh-mobile-control__origin-modes");
			const caddyModeLegend = element("legend");
			caddyModeLegend.textContent = t("originHttpsMode");
			const caddyModeManagedLabel = element("label", "dsh-mobile-control__origin-mode");
			const caddyModeManaged = element("input");
			caddyModeManaged.type = "radio";
			caddyModeManaged.name = "caddy-mode";
			caddyModeManaged.value = "managed";
			const caddyModeExternalLabel = element("label", "dsh-mobile-control__origin-mode");
			const caddyModeExternal = element("input");
			caddyModeExternal.type = "radio";
			caddyModeExternal.name = "caddy-mode";
			caddyModeExternal.value = "external";
			const caddyManagedText = element("span");
			caddyManagedText.textContent = t("caddyModeManaged");
			const caddyExternalText = element("span");
			caddyExternalText.textContent = t("caddyModeExternal");
			caddyModeManagedLabel.append(caddyModeManaged, caddyManagedText);
			caddyModeExternalLabel.append(caddyModeExternal, caddyExternalText);
			caddyModeRow.append(caddyModeLegend, caddyModeExternalLabel, caddyModeManagedLabel);
			const caddyModePreviewNote = element("p", "dsh-mobile-control__component-note");
			caddyModePreviewNote.textContent = t("caddyModePreviewNote");
			caddyModePreviewNote.hidden = true;
			const caddyForm = element("div", "dsh-mobile-control__caddy-form");
			caddyForm.hidden = true;
			const caddyFields = element("div", "dsh-mobile-control__origin-fields");
			const caddyDomainLabel = element("label", "dsh-mobile-control__field dsh-mobile-control__field--full");
			caddyDomainLabel.textContent = t("caddyDomain");
			const caddyDomain = element("input");
			caddyDomain.type = "url";
			caddyDomain.placeholder = "https://phone.example.com:8443";
			caddyDomain.maxLength = 512;
			caddyDomain.autocomplete = "off";
			caddyDomain.spellcheck = false;
			const caddyProviderLabel = element("label", "dsh-mobile-control__field dsh-mobile-control__field--full");
			caddyProviderLabel.textContent = t("caddyDnsProvider");
			const caddyProvider = element("select");
			const caddyProviderOption = document.createElement("option");
			caddyProviderOption.value = "tencentcloud";
			caddyProviderOption.textContent = "Tencent Cloud DNSPod";
			caddyProvider.append(caddyProviderOption);
			const caddySecretIdLabel = element("label", "dsh-mobile-control__field");
			caddySecretIdLabel.textContent = t("caddySecretId");
			const caddySecretId = element("input");
			caddySecretId.type = "password";
			caddySecretId.autocomplete = "off";
			caddySecretId.spellcheck = false;
			const caddySecretKeyLabel = element("label", "dsh-mobile-control__field");
			caddySecretKeyLabel.textContent = t("caddySecretKey");
			const caddySecretKey = element("input");
			caddySecretKey.type = "password";
			caddySecretKey.autocomplete = "off";
			caddySecretKey.spellcheck = false;
			const caddyPortLabel = element("label", "dsh-mobile-control__field dsh-mobile-control__field--full");
			caddyPortLabel.textContent = t("caddyListenPort");
			const caddyPort = element("input");
			caddyPort.type = "number";
			caddyPort.inputMode = "numeric";
			caddyPort.min = "1024";
			caddyPort.max = "65535";
			caddyPort.step = "1";
			caddyPort.value = "8443";
			caddyDomainLabel.append(caddyDomain);
			caddyProviderLabel.append(caddyProvider);
			caddySecretIdLabel.append(caddySecretId);
			caddySecretKeyLabel.append(caddySecretKey);
			caddyPortLabel.append(caddyPort);
			caddyFields.append(caddyDomainLabel, caddyProviderLabel, caddySecretIdLabel, caddySecretKeyLabel, caddyPortLabel);
			const caddyInstall = element("button", "dsh-mobile-control__primary");
			caddyInstall.type = "button";
			caddyInstall.textContent = t("caddyInstall");
			const caddyInstallNote = element("p", "dsh-mobile-control__component-note");
			caddyInstallNote.textContent = t("caddyInstallNote");
			const caddyStatus = element("p", "dsh-mobile-control__component-status");
			caddyStatus.hidden = true;
			const caddySave = element("button", "dsh-mobile-control__primary");
			caddySave.type = "button";
			caddySave.textContent = t("caddySaveConnect");
			caddySave.hidden = true;
			const caddyPurgeButton = element("button", "dsh-mobile-control__danger");
			caddyPurgeButton.type = "button";
			caddyPurgeButton.textContent = t("caddyPurge");
			caddyPurgeButton.hidden = true;
			const caddyFeedback = element("p", "dsh-mobile-control__origin-feedback");
			caddyFeedback.setAttribute("role", "status");
			caddyFeedback.setAttribute("aria-live", "polite");
			caddyFeedback.hidden = true;
			const caddyActions = element("div", "dsh-mobile-control__actions dsh-mobile-control__caddy-actions");
			caddyActions.append(caddyInstall, caddySave, caddyPurgeButton);
			caddyForm.append(caddyFields, caddyInstallNote, caddyStatus, caddyActions, caddyFeedback);
			originSetup.append(originSetupTitle, caddyModeRow, caddyModePreviewNote, originHelp, originWarning, originFields, originFeedback, originFormActions, caddyForm, originBackend);
			const tailscaleInfo = element("details", "dsh-mobile-control__details");
			const tailscaleInfoSummary = element("summary");
			tailscaleInfoSummary.textContent = t("tailscaleHelp");
			const tailscaleInfoBody = element("div", "dsh-mobile-control__details-body");
			const tailscaleInfoText = element("p");
			tailscaleInfoText.textContent = t("tailscaleHelpText");
			tailscaleInfoBody.append(tailscaleInfoText);
			tailscaleInfo.append(tailscaleInfoSummary, tailscaleInfoBody);
			const providerSetupHeader = element("div", "dsh-mobile-control__stage-header");
			const providerSetupHeading = element("h3", "dsh-mobile-control__section-title");
			providerSetupHeading.textContent = t("currentProvider");
			const providerSetupName = element("span", "dsh-mobile-control__stage-value");
			providerSetupName.textContent = "Tailscale Funnel";
			const remoteStateBadge = element("span", "dsh-mobile-control__state-badge");
			remoteStateBadge.textContent = t("remoteStateOff");
			const providerSetupMeta = element("div", "dsh-mobile-control__stage-meta");
			providerSetupMeta.append(providerSetupName, remoteStateBadge);
			providerSetupHeader.append(providerSetupHeading, providerSetupMeta);
			const providerSetupBody = element("div", "dsh-mobile-control__provider-setup-body");
			providerSetupBody.append(cpolarSetup, cloudflaredSetup, frpSetup, originSetup, tailscaleInfo);
			const remoteAccess = element("div", "dsh-mobile-control__access");
			remoteAccess.hidden = true;
			const remoteAccessLabel = element("span", "dsh-mobile-control__access-label");
			remoteAccessLabel.textContent = t("remoteAddress");
			const remoteAccessLink = element("a", "dsh-mobile-control__access-link");
			remoteAccessLink.target = "_blank";
			remoteAccessLink.rel = "noreferrer";
			remoteAccess.append(remoteAccessLabel, remoteAccessLink);
			const remoteQr = element("div", "dsh-mobile-control__qr");
			remoteQr.hidden = true;
			const remoteStatus = element("p", "dsh-mobile-control__status");
			remoteStatus.textContent = t("loadingRemoteStatus");
			remoteStatus.setAttribute("aria-live", "polite");
			const remoteGuide = element("section", "dsh-mobile-control__guide");
			remoteGuide.hidden = true;
			remoteGuide.setAttribute("aria-label", t("funnelGuideAria"));
			const remoteGuideTitle = element("h3", "dsh-mobile-control__guide-title");
			remoteGuideTitle.textContent = t("funnelGuideTitle");
			const remoteGuideSummary = element("p", "dsh-mobile-control__guide-summary");
			remoteGuideSummary.textContent = t("funnelGuideSummary");
			const remoteGuideSteps = element("ol", "dsh-mobile-control__guide-steps");
			for (const text of [
				t("funnelStep1"),
				t("funnelStep2"),
				t("funnelStep3")
			]) {
				const item = element("li");
				item.textContent = text;
				remoteGuideSteps.append(item);
			}
			const remoteGuideNote = element("p", "dsh-mobile-control__guide-note");
			remoteGuideNote.textContent = t("funnelGuideNote");
			const remoteGuideActions = element("div", "dsh-mobile-control__guide-actions");
			const remoteSetup = element("button", "dsh-mobile-control__primary");
			remoteSetup.type = "button";
			remoteSetup.textContent = t("continueFunnel");
			const remoteSetupRetry = element("button", "dsh-mobile-control__secondary");
			remoteSetupRetry.type = "button";
			remoteSetupRetry.textContent = t("retryNow");
			remoteGuideActions.append(remoteSetup, remoteSetupRetry);
			remoteGuide.append(remoteGuideTitle, remoteGuideSummary, remoteGuideSteps, remoteGuideNote, remoteGuideActions);
			const remoteActions = element("div", "dsh-mobile-control__actions");
			const remoteToggle = element("button", "dsh-mobile-control__primary");
			remoteToggle.type = "button";
			remoteToggle.textContent = t("enableRemote");
			const remoteLogin = element("button", "dsh-mobile-control__primary");
			remoteLogin.type = "button";
			remoteLogin.textContent = t("continueLogin");
			remoteLogin.hidden = true;
			const remoteReconnect = element("button", "dsh-mobile-control__secondary");
			remoteReconnect.type = "button";
			remoteReconnect.textContent = t("reconnect");
			remoteReconnect.hidden = true;
			const remotePair = element("button", "dsh-mobile-control__secondary");
			remotePair.type = "button";
			remotePair.textContent = t("generateRemoteQr");
			remotePair.disabled = true;
			const remoteCopyLink = element("button", "dsh-mobile-control__secondary");
			remoteCopyLink.type = "button";
			remoteCopyLink.textContent = t("copyRemoteLink");
			remoteCopyLink.disabled = true;
			const remotePairLink = element("p", "dsh-mobile-control__status");
			remotePairLink.hidden = true;
			let activeRemotePairUrl = "";
			let activeRemotePairExpiresAt = 0;
			remoteActions.append(remoteToggle, remoteLogin, remoteReconnect, remotePair, remoteCopyLink);
			const remoteManageRow = element("div", "dsh-mobile-control__manage-row");
			const remoteDevices = element("button", "dsh-mobile-control__manage");
			remoteDevices.type = "button";
			remoteDevices.textContent = t("manageRemoteDevices");
			remoteDevices.disabled = true;
			const remoteReset = element("button", "dsh-mobile-control__manage");
			remoteReset.type = "button";
			remoteReset.textContent = t("resetRemoteLogin");
			remoteManageRow.append(remoteDevices, remoteReset);
			const remoteDevicePanel = element("div", "dsh-mobile-control__devices");
			remoteDevicePanel.hidden = true;
			const wsPathsSection = element("section", "dsh-mobile-control__ws-paths");
			const wsPathsTitle = element("h3", "dsh-mobile-control__section-title");
			wsPathsTitle.textContent = t("wsPathsTitle");
			const wsPathsIntro = element("p", "dsh-mobile-control__intro");
			wsPathsIntro.textContent = t("wsPathsIntro");
			const wsPathsDetected = element("div", "dsh-mobile-control__ws-paths-detected");
			wsPathsDetected.hidden = true;
			const wsPathsDetectedTitle = element("p", "dsh-mobile-control__ws-paths-detected-title");
			wsPathsDetectedTitle.textContent = t("wsPathsDetected");
			const wsPathsDetectedList = element("ul", "dsh-mobile-control__ws-paths-list");
			wsPathsDetected.append(wsPathsDetectedTitle, wsPathsDetectedList);
			const wsPathsList = element("ul", "dsh-mobile-control__ws-paths-list");
			const wsPathsAdvanced = element("details", "dsh-mobile-control__ws-paths-advanced");
			const wsPathsAdvancedSummary = element("summary");
			wsPathsAdvancedSummary.textContent = t("wsPathsAdvancedToggle");
			const wsPathsAdvancedHint = element("p", "dsh-mobile-control__intro");
			wsPathsAdvancedHint.textContent = t("wsPathsAdvancedHint");
			const wsPathsRow = element("div", "dsh-mobile-control__ws-paths-row");
			const wsPathsInput = element("input", "dsh-mobile-control__ws-paths-input");
			wsPathsInput.type = "text";
			wsPathsInput.placeholder = t("wsPathsPlaceholder");
			wsPathsInput.setAttribute("aria-label", t("wsPathsTitle"));
			const wsPathsAdd = element("button", "dsh-mobile-control__primary");
			wsPathsAdd.type = "button";
			wsPathsAdd.textContent = t("wsPathsAdd");
			const wsPathsStatus = element("p", "dsh-mobile-control__status");
			wsPathsStatus.hidden = true;
			wsPathsStatus.setAttribute("aria-live", "polite");
			wsPathsRow.append(wsPathsInput, wsPathsAdd);
			wsPathsAdvanced.append(wsPathsAdvancedSummary, wsPathsAdvancedHint, wsPathsRow, wsPathsStatus);
			wsPathsSection.append(wsPathsTitle, wsPathsIntro, wsPathsDetected, wsPathsList, wsPathsAdvanced);
			let wsPathsCurrent = [];
			let wsPathsBlocked = [];
			let wsPathsLoaded = false;
			const renderWsPaths = (paths) => {
				wsPathsCurrent = [...paths];
				wsPathsList.replaceChildren();
				if (paths.length === 0) {
					const empty = element("li", "dsh-mobile-control__ws-paths-empty");
					empty.textContent = t("wsPathsEmpty");
					wsPathsList.append(empty);
				}
				for (const path of paths) {
					const item = element("li", "dsh-mobile-control__ws-paths-item");
					const label = element("code");
					label.textContent = path;
					const remove = element("button", "dsh-mobile-control__ws-paths-remove");
					remove.type = "button";
					remove.textContent = t("wsPathsRemove");
					remove.setAttribute("aria-label", `${t("wsPathsRemove")}: ${path}`);
					remove.addEventListener("click", () => {
						saveWsPaths(wsPathsCurrent.filter((entry) => entry !== path));
					});
					item.append(label, remove);
					wsPathsList.append(item);
				}
			};
			const wsGroupOf = (path) => {
				const slash = path.lastIndexOf("/");
				return slash > 0 ? path.slice(0, slash) : "/";
			};
			let wsPathsSeenAttempts = 0;
			let wsDotAnnounced = 0;
			const wsDotStatus = element("p", "dsh-mobile-control__ws-sr-status");
			wsDotStatus.setAttribute("role", "status");
			wsDotStatus.setAttribute("aria-atomic", "true");
			const wsBlockedTotal = (blocked) => blocked.reduce((sum, entry) => sum + entry.attempts, 0);
			const renderWsDot = () => {
				for (const stale of document.querySelectorAll(".dsh-mobile-control__ws-dot")) stale.remove();
				if (!wsDotStatus.isConnected) root.append(wsDotStatus);
				const pendingCount = wsPathsBlocked.filter((entry) => !wsPathsCurrent.includes(entry.path)).length;
				if (pendingCount === 0 || wsBlockedTotal(wsPathsBlocked) <= wsPathsSeenAttempts) {
					if (pendingCount === 0 && wsDotAnnounced !== 0) {
						wsDotAnnounced = 0;
						wsDotStatus.textContent = "";
					}
					return;
				}
				if (wsDotAnnounced !== pendingCount) {
					wsDotAnnounced = pendingCount;
					wsDotStatus.textContent = t("wsPathsAnnounce", { n: String(pendingCount) });
				}
				for (const trigger of document.querySelectorAll(".dsh-mobile-control__trigger, .dsh-mobile-control__diagnostic-entry")) {
					const dot = element("span", "dsh-mobile-control__ws-dot");
					dot.textContent = String(pendingCount);
					dot.title = t("wsPathsNewBlocked");
					dot.setAttribute("aria-hidden", "true");
					dot.addEventListener("click", (event) => {
						event.stopPropagation();
						setOpen(true);
						selectView("diagnostics");
					});
					trigger.append(dot);
				}
			};
			const renderWsBlocked = (blocked) => {
				wsPathsDetectedList.replaceChildren();
				const pending = blocked.filter((entry) => !wsPathsCurrent.includes(entry.path));
				wsPathsDetected.hidden = pending.length === 0;
				const groups = /* @__PURE__ */ new Map();
				for (const entry of pending) {
					const group = wsGroupOf(entry.path);
					const list = groups.get(group);
					if (list) list.push(entry);
					else groups.set(group, [entry]);
				}
				for (const [group, entries] of groups) {
					const groupItem = element("li", "dsh-mobile-control__ws-paths-group");
					const groupHead = element("div", "dsh-mobile-control__ws-paths-group-head");
					const groupLabel = element("code");
					groupLabel.textContent = `${group}/*`;
					const groupCount = element("span", "dsh-mobile-control__ws-count");
					groupCount.textContent = t("wsPathsGroupMeta", {
						n: entries.length,
						m: entries.reduce((sum, entry) => sum + entry.attempts, 0)
					});
					groupHead.append(groupLabel, groupCount);
					if (entries.length > 1) {
						const allowAll = element("button", "dsh-mobile-control__primary");
						allowAll.type = "button";
						allowAll.textContent = t("wsPathsAllowAll");
						allowAll.addEventListener("click", () => {
							saveWsPaths([...wsPathsCurrent, ...entries.map((entry) => entry.path)]);
						});
						groupHead.append(allowAll);
					}
					groupItem.append(groupHead);
					for (const entry of entries) {
						const item = element("div", "dsh-mobile-control__ws-paths-item is-child");
						const label = element("code");
						label.textContent = `${entry.path} ×${String(entry.attempts)}`;
						const allow = element("button", "dsh-mobile-control__primary");
						allow.type = "button";
						allow.textContent = t("wsPathsAllow");
						allow.setAttribute("aria-label", `${t("wsPathsAllow")}: ${entry.path}`);
						allow.addEventListener("click", () => {
							saveWsPaths([...wsPathsCurrent, entry.path]);
						});
						item.append(label, allow);
						groupItem.append(item);
					}
					wsPathsDetectedList.append(groupItem);
				}
				renderWsDot();
			};
			const loadWsPaths = () => {
				controlRequestJson("/api/mobile-access/remote/websocket-paths").then((data) => {
					wsPathsLoaded = true;
					wsPathsStatus.hidden = true;
					renderWsPaths(Array.isArray(data.paths) ? data.paths.filter((entry) => typeof entry === "string") : []);
					controlRequestJson("/api/mobile-access/remote/websocket-paths/blocked").then((blocked) => {
						wsPathsBlocked = (Array.isArray(blocked.blocked) ? blocked.blocked : []).filter((entry) => typeof entry === "object" && entry !== null && typeof entry.path === "string" && typeof entry.attempts === "number");
						renderWsBlocked(wsPathsBlocked);
					}, () => {});
				}, (error) => {
					wsPathsStatus.hidden = false;
					wsPathsStatus.textContent = t("requestFailed", { error: String(error) });
				});
			};
			const saveWsPaths = (paths) => {
				wsPathsStatus.hidden = true;
				controlRequestJson("/api/mobile-access/remote/websocket-paths", {
					method: "POST",
					body: JSON.stringify({ paths })
				}).then((data) => {
					wsPathsLoaded = true;
					renderWsPaths(Array.isArray(data.paths) ? data.paths.filter((entry) => typeof entry === "string") : []);
					renderWsBlocked(wsPathsBlocked);
				}, (error) => {
					wsPathsStatus.hidden = false;
					wsPathsStatus.textContent = t("requestFailed", { error: String(error) });
				});
			};
			wsPathsAdd.addEventListener("click", () => {
				const value = wsPathsInput.value.trim();
				if (value === "") {
					wsPathsStatus.hidden = false;
					wsPathsStatus.textContent = t("wsPathsInvalid");
					return;
				}
				wsPathsInput.value = "";
				saveWsPaths([...wsPathsCurrent, value]);
			});
			const remoteWorkspace = element("section", "dsh-mobile-control__remote-workspace");
			remoteWorkspace.append(providerSetupHeader, remoteStatus, remoteAccess, remoteGuide, providerSetupBody, remoteActions, remoteQr, remotePairLink, remoteManageRow, remoteDevicePanel);
			const diagnosticsView = element("div", "dsh-mobile-control__view is-diagnostics");
			diagnosticsView.hidden = true;
			const diagnosticsIntro = element("p", "dsh-mobile-control__intro");
			diagnosticsIntro.textContent = t("diagnosticsIntro");
			const diagnosticsSummary = element("section", "dsh-mobile-control__diagnostic-summary is-idle");
			diagnosticsSummary.setAttribute("aria-live", "polite");
			const diagnosticsSummaryMain = element("div", "dsh-mobile-control__diagnostic-summary-main");
			const diagnosticsSummaryIcon = element("span", "dsh-mobile-control__diagnostic-summary-icon");
			diagnosticsSummaryIcon.setAttribute("aria-hidden", "true");
			const diagnosticsSummaryBody = element("div", "dsh-mobile-control__diagnostic-summary-body");
			const diagnosticsSummaryTitle = element("strong");
			diagnosticsSummaryTitle.textContent = t("diagnosticsNotRun");
			const diagnosticsSummaryText = element("span");
			diagnosticsSummaryText.textContent = t("diagnosticsStartHint");
			const diagnosticsSummaryMeta = element("span", "dsh-mobile-control__diagnostic-summary-meta");
			diagnosticsSummaryMeta.textContent = t("diagnosticsIdleMeta");
			diagnosticsSummaryBody.append(diagnosticsSummaryTitle, diagnosticsSummaryText);
			diagnosticsSummaryMain.append(diagnosticsSummaryIcon, diagnosticsSummaryBody);
			diagnosticsSummary.append(diagnosticsSummaryMain, diagnosticsSummaryMeta);
			const diagnosticsToolbar = element("div", "dsh-mobile-control__diagnostic-toolbar");
			const diagnosticsRun = element("button", "dsh-mobile-control__primary dsh-mobile-control__diagnostic-run");
			diagnosticsRun.type = "button";
			diagnosticsRun.textContent = t("diagnosticsStart");
			const diagnosticsCopy = element("button", "dsh-mobile-control__secondary dsh-mobile-control__diagnostic-copy");
			diagnosticsCopy.type = "button";
			diagnosticsCopy.textContent = t("diagnosticsCopy");
			diagnosticsCopy.disabled = true;
			diagnosticsCopy.hidden = true;
			diagnosticsToolbar.append(diagnosticsRun, diagnosticsCopy);
			const diagnosticsFeedback = element("p", "dsh-mobile-control__diagnostic-feedback");
			diagnosticsFeedback.hidden = true;
			diagnosticsFeedback.setAttribute("role", "status");
			diagnosticsFeedback.setAttribute("aria-live", "polite");
			const diagnosticsChecks = element("div", "dsh-mobile-control__diagnostic-checks");
			diagnosticsChecks.hidden = true;
			const diagnosticsDetails = element("details", "dsh-mobile-control__details dsh-mobile-control__diagnostic-details");
			diagnosticsDetails.hidden = true;
			const diagnosticsDetailsSummary = element("summary");
			diagnosticsDetailsSummary.textContent = t("diagnosticsAdvanced");
			const diagnosticsReport = element("pre", "dsh-mobile-control__diagnostic-report");
			diagnosticsDetails.append(diagnosticsDetailsSummary, diagnosticsReport);
			header.append(title, headerActions);
			actions.append(toggle, pair, linkPair);
			lanView.append(lanSetup, access, qrBox, status, extensionStatus, actions, manageRow, devicePanel, trustedNetworks);
			remoteView.append(remoteIntro, httpFrameWarning, providerSection, remoteWorkspace);
			diagnosticsView.append(diagnosticsIntro, diagnosticsSummary, diagnosticsToolbar, diagnosticsFeedback, diagnosticsChecks, wsPathsSection, diagnosticsDetails);
			panel.append(header, releaseNotice, updateCard, appDownload, projectInfo, extensionRecovery.section, switcher, lanView, remoteView, diagnosticsView);
			root.append(panel);
			document.body.append(root);
			let running = false;
			let origin = "";
			let lanConfigured = true;
			let lanRestartRequired = false;
			let lanSetupLoaded = false;
			let remoteRunning = false;
			let remoteReady = false;
			let remoteProvider = "tailscale";
			let remoteLoginUrl = "";
			let remoteSetupUrl = "";
			let remoteSetupPending = false;
			let remoteSetupOpenedAt = 0;
			let remoteReconnectBusy = false;
			let remoteProviderBusy = false;
			let remoteFailureText;
			let cpolarInstalled = false;
			let cpolarConfigured = false;
			let cloudflaredInstalled = false;
			let cloudflaredDownloadSize = "";
			let cloudflaredTunnelMode = "quick";
			let cloudflaredModeDraft = null;
			let cloudflaredTunnelConfigured = false;
			let configuredCloudflaredHostname = "";
			let configuredCloudflaredPort = 3444;
			let cloudflaredHostnameDirty = false;
			let cloudflaredPortDirty = false;
			let originConfigured = false;
			let originFormDirty = false;
			let originFormBusy = false;
			let caddyFormBusy = false;
			let caddyModeManagedSelected = false;
			let caddyFormDirty = false;
			let caddyModePreviewDirty = false;
			const showCaddyFeedback = (message, isError = false) => {
				caddyFeedback.textContent = message;
				caddyFeedback.classList.toggle("is-error", isError);
				caddyFeedback.hidden = false;
			};
			const setCaddyFormBusy = (busy) => {
				caddyFormBusy = busy;
				remoteProviderBusy = busy;
				remoteSnapshotEpoch += 1;
				caddyInstall.setAttribute("aria-busy", String(busy));
				caddySave.setAttribute("aria-busy", String(busy));
				renderRemote(latestRemoteState);
			};
			let remoteSnapshotEpoch = 0;
			let latestRemoteState = {};
			let frpInstalled = false;
			let frpConfigured = false;
			let frpLayoutInitialized = false;
			let frpDownloadSize = "14.0";
			let configuredFrpServer = "";
			let configuredFrpPort = 7e3;
			let configuredFrpOrigin = "";
			let configuredFrpVhostPort = 7080;
			let configuredFrpPublicPort = 33080;
			/** Proxy name the host writes into its frpc.toml; the local clipboard copy must match. */
			let configuredFrpProxyName;
			let frpConfiguredMode = "deploy";
			let frpConfiguredEntryTls = "public-ip-cert";
			let frpModeDraft = false;
			let frpEntryTlsDraft = false;
			let frpVhostDraft = false;
			let frpAttachVhostExplicit = false;
			let providerInfoPinned = false;
			let providerInfoHovered = false;
			let previousAccessView = "lan";
			let diagnosticsBusy = false;
			let copiedDiagnosticReport = "";
			let pluginUpdateAvailable = false;
			let pluginLatestVersion = "";
			let pluginReleaseNotes = "";
			let updateInFlight = false;
			const renderRelease = (data) => {
				const release = clientReleaseInfo(data);
				pluginUpdateAvailable = release.updateAvailable;
				pluginLatestVersion = release.latestVersion ?? "";
				pluginReleaseNotes = release.releaseNotes ?? "";
				updatePlugin.hidden = !pluginUpdateAvailable || !diagnosticsView.hidden || !updateCard.hidden;
				updatePlugin.textContent = t("updatePlugin");
				if (pluginLatestVersion !== "") updatePlugin.setAttribute("aria-label", t("updatePluginAria", { version: pluginLatestVersion }));
				if (release.androidVersion !== void 0) {
					appDownload.textContent = t("downloadAndroidVersion", { version: release.androidVersion });
					appDownload.setAttribute("aria-label", t("downloadAndroidVersionAria", { version: release.androidVersion }));
				}
				appDownload.hidden = !release.androidDownloadAvailable;
				appDownload.href = release.androidDownloadUrl;
                projectNotesBody.textContent = release.releaseNotes ?? ""; projectNotes.hidden = !release.releaseNotes;
			};
			const syncProviderInfo = () => {
				const open = providerInfoPinned || providerInfoHovered || providerInfo.contains(document.activeElement);
				providerInfoPopover.hidden = !open;
				providerInfoButton.setAttribute("aria-expanded", String(open));
			};
			providerInfo.addEventListener("pointerenter", () => {
				providerInfoHovered = true;
				syncProviderInfo();
			});
			providerInfo.addEventListener("pointerleave", () => {
				providerInfoHovered = false;
				syncProviderInfo();
			});
			providerInfo.addEventListener("focusin", syncProviderInfo);
			providerInfo.addEventListener("focusout", () => {
				window.setTimeout(syncProviderInfo, 0);
			});
			providerInfoButton.addEventListener("click", () => {
				providerInfoPinned = !providerInfoPinned;
				syncProviderInfo();
			});
			providerInfoButton.addEventListener("keydown", (event) => {
				if (event.key !== "Escape") return;
				providerInfoPinned = false;
				providerInfoHovered = false;
				providerInfoPopover.hidden = true;
				providerInfoButton.setAttribute("aria-expanded", "false");
			});
			const selectView = (view) => {
				if (!panel.hidden) extensionRecovery.refresh();
				if (view !== "diagnostics") previousAccessView = view;
				lanView.hidden = view !== "lan";
				remoteView.hidden = view !== "remote";
				diagnosticsView.hidden = view !== "diagnostics";
				lanTab.classList.toggle("is-active", view === "lan");
				remoteTab.classList.toggle("is-active", view === "remote");
				lanTab.setAttribute("aria-pressed", String(view === "lan"));
				remoteTab.setAttribute("aria-pressed", String(view === "remote"));
				diagnosticsEntry.setAttribute("aria-pressed", String(view === "diagnostics"));
				diagnosticsEntry.textContent = view === "diagnostics" ? t("back") : t("diagnostics");
				diagnosticsEntry.setAttribute("aria-label", view === "diagnostics" ? t("backToMobile") : t("openDiagnostics"));
				if (view === "diagnostics") {
					wsPathsSeenAttempts = wsBlockedTotal(wsPathsBlocked);
					renderWsDot();
					if (!wsPathsLoaded) loadWsPaths();
				}
				updatePlugin.hidden = view === "diagnostics" || !pluginUpdateAvailable;
				appDownload.hidden = view === "diagnostics";
				switcher.hidden = view === "diagnostics";
				title.textContent = view === "lan" ? t("lanAccess") : view === "remote" ? t("remoteAccess") : t("connectionDiagnostics");
			};
			lanTab.addEventListener("click", () => {
				selectView("lan");
			});
			remoteTab.addEventListener("click", () => {
				selectView("remote");
				loadRemote();
			});
			const setOpen = (open) => {
				panel.hidden = !open;
				if (open) extensionRecovery.refresh();
				for (const trigger of document.querySelectorAll(".dsh-mobile-control__trigger")) trigger.setAttribute("aria-expanded", String(open));
			};
			const render = (data) => {
				lanConfigured = data.configured !== false;
				lanRestartRequired = data.restartRequired === true;
				running = data.running === true;
				origin = running && typeof data.origin === "string" ? data.origin : "";
				lanSetup.hidden = lanConfigured && !lanRestartRequired;
				lanSetupForm.hidden = lanRestartRequired;
				lanSetupIntro.hidden = lanRestartRequired;
				status.hidden = !lanConfigured || lanRestartRequired;
				if (!lanConfigured && !lanSetupLoaded) loadLanSetup();
				if (lanRestartRequired) {
					const pendingOrigin = typeof data.pendingOrigin === "string" ? data.pendingOrigin : "";
					lanSetupStatus.textContent = t("lanSetupRestart", { origin: pendingOrigin });
				} else if (!lanConfigured && lanSetupStatus.textContent === "") lanSetupStatus.textContent = t("lanSetupRequired");
				access.hidden = origin === "";
				accessLink.href = origin;
				accessLink.textContent = origin;
				accessLink.title = origin;
				status.classList.toggle("is-running", running);
				status.textContent = !lanConfigured ? t("lanSetupRequired") : lanRestartRequired ? t("lanSetupRestart", { origin: typeof data.pendingOrigin === "string" ? data.pendingOrigin : "" }) : running ? t("lanOn") : t("lanOff");
				const extensionData = data.extensions;
				if (extensionData !== null && typeof extensionData === "object") {
					const loaded = typeof extensionData.loaded === "number" ? extensionData.loaded : 0;
					const failed = typeof extensionData.failed === "number" ? extensionData.failed : 0;
					extensionStatus.hidden = false;
					extensionStatus.textContent = failed === 0 ? t("extensionsLoaded", { loaded }) : t("extensionsFailed", {
						loaded,
						failed
					});
				} else extensionStatus.hidden = true;
				if (!running) qrBox.hidden = true;
				toggle.textContent = running ? t("disableLan") : t("enableLan");
				actions.hidden = !lanConfigured || lanRestartRequired;
				manageRow.hidden = !lanConfigured || lanRestartRequired;
				pair.disabled = !running;
				linkPair.disabled = !running;
				manageDevices.disabled = !running;
				resetAll.disabled = !running;
			};
			const renderLanSetup = (data) => {
				if (data.restartRequired === true || data.configured === true) {
					render(data);
					return;
				}
				const networks = Array.isArray(data.networks) ? data.networks.filter((entry) => typeof entry === "object" && entry !== null) : [];
				lanSetupSelect.replaceChildren();
				const hasRecommended = networks.some((network) => network.recommended === true);
				if (!hasRecommended && networks.length > 1) {
					const placeholder = element("option");
					placeholder.value = "";
					placeholder.textContent = t("lanSetupChooseNetwork");
					placeholder.disabled = true;
					placeholder.selected = true;
					lanSetupSelect.append(placeholder);
				}
				for (const network of networks) {
					if (typeof network.address !== "string" || typeof network.name !== "string") continue;
					const option = element("option");
					option.value = network.address;
					option.textContent = `${network.name} · ${network.address}${network.recommended === true ? ` · ${t("lanSetupRecommended")}` : ""}`;
					option.selected = network.recommended === true || !hasRecommended && networks.length === 1;
					lanSetupSelect.append(option);
				}
				const available = networks.some((network) => typeof network.address === "string" && typeof network.name === "string");
				lanSetupConfigure.disabled = lanSetupSelect.value === "";
				lanSetupStatus.textContent = available ? t("lanSetupRequired") : t("lanSetupNoNetworks");
				lanSetupNote.hidden = data.windowsFirewall !== true;
			};
			lanSetupSelect.addEventListener("change", () => {
				lanSetupConfigure.disabled = lanSetupSelect.value === "";
			});
			const loadLanSetup = () => {
				lanSetupLoaded = true;
				lanSetupRefresh.disabled = true;
				controlRequestJson("/api/mobile-access/lan/setup").then(renderLanSetup, () => {
					lanSetupStatus.textContent = t("lanSetupFailed");
				}).finally(() => {
					lanSetupRefresh.disabled = false;
				});
			};
			lanSetupRefresh.addEventListener("click", () => {
				loadLanSetup();
			});
			lanSetupConfigure.addEventListener("click", () => {
				if (lanSetupSelect.value === "") return;
				lanSetupConfigure.disabled = true;
				lanSetupRefresh.disabled = true;
				lanSetupConfigure.textContent = t("lanSetupConfiguring");
				lanSetupStatus.textContent = t("lanSetupConfiguring");
				controlRequestJson("/api/mobile-access/lan/setup", {
					method: "POST",
					body: JSON.stringify({
						confirm: true,
						address: lanSetupSelect.value,
						configureFirewall: true
					})
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then(renderLanSetup, () => {
					lanSetupStatus.textContent = t("lanSetupFailed");
				}).finally(() => {
					lanSetupConfigure.textContent = t("lanSetupConfigure");
					lanSetupRefresh.disabled = false;
					lanSetupConfigure.disabled = lanRestartRequired || lanSetupSelect.options.length === 0;
				});
			});
			const showQr = (svg, target = qrBox) => {
				target.replaceChildren();
				if (svg === "") {
					target.hidden = true;
					return;
				}
				const image = element("img");
				image.alt = t("pairingQr");
				image.width = 176;
				image.height = 176;
				image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
				target.hidden = false;
				target.append(image);
			};
			const openPairing = (target) => {
				controlRequestJson("/api/mobile-access/lan/pairing/open", {
					method: "POST",
					body: "{}"
				}).then(async (data) => {
					const value = target === "key" ? typeof data.appKey === "string" ? data.appKey : "" : typeof data.pairUrl === "string" ? data.pairUrl : "";
					showQr(typeof data.qrSvg === "string" ? data.qrSvg : "");
					if (value === "") {
						status.textContent = t("keyGenerationFailed");
						return;
					}
					try {
						await navigator.clipboard.writeText(value);
						status.textContent = target === "key" ? t("keyCopied") : t("linkCopied");
					} catch {
						status.textContent = t("copySecret", {
							kind: target === "key" ? t("pairingKey") : t("pairingLink"),
							value
						});
						status.classList.add("is-key");
					}
				}, (error) => {
					status.textContent = t("requestFailed", { error: String(error) });
				}).finally(() => {
					pair.disabled = !running;
					linkPair.disabled = !running;
				});
			};
			toggle.addEventListener("click", () => {
				toggle.disabled = true;
				controlRequestJson("/api/mobile-access/lan/control", {
					method: "POST",
					body: JSON.stringify({ running: !running })
				}).then(render, (error) => {
					status.textContent = t("requestFailed", { error: String(error) });
				}).finally(() => {
					toggle.disabled = false;
				});
			});
			const formatTime = (ms) => typeof ms === "number" ? new Date(ms).toLocaleString(localeTag) : "";
			const formatMegabytes = (bytes) => new Intl.NumberFormat(localeTag, {
				minimumFractionDigits: 1,
				maximumFractionDigits: 1
			}).format(bytes / 1024 / 1024);
			const renderDevices = (data) => {
				const devices = Array.isArray(data.devices) ? data.devices : [];
				devicePanel.replaceChildren();
				if (devices.length === 0) {
					const empty = element("p", "dsh-mobile-control__device-empty");
					empty.textContent = t("noDevices");
					devicePanel.append(empty);
					return;
				}
				for (const device of devices) {
					const row = element("div", "dsh-mobile-control__device");
					const label = element("span", "dsh-mobile-control__device-label");
					label.textContent = typeof device.label === "string" ? device.label : t("device");
					const meta = element("span", "dsh-mobile-control__device-meta");
					meta.textContent = t("expires", { time: formatTime(device.expiresAt) });
					const revoke = element("button", "dsh-mobile-control__device-revoke");
					revoke.type = "button";
					revoke.textContent = t("revoke");
					const id = typeof device.id === "string" ? device.id : "";
					revoke.addEventListener("click", () => {
						controlRequestJson("/api/mobile-access/lan/devices/revoke", {
							method: "POST",
							body: JSON.stringify({ deviceId: id })
						}).then(loadDevices, (error) => {
							status.textContent = t("requestFailed", { error: String(error) });
						});
					});
					row.append(label, meta, revoke);
					devicePanel.append(row);
				}
			};
			const loadDevices = () => {
				controlRequestJson("/api/mobile-access/lan/devices").then(renderDevices, (error) => {
					status.textContent = t("requestFailed", { error: String(error) });
				});
			};
			manageDevices.addEventListener("click", () => {
				const show = devicePanel.hidden;
				devicePanel.hidden = !show;
				if (show) loadDevices();
			});
			resetAll.addEventListener("click", () => {
				if (!window.confirm(t("confirmResetDevices"))) return;
				controlRequestJson("/api/mobile-access/lan/devices/reset", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}).then(loadDevices, (error) => {
					status.textContent = t("requestFailed", { error: String(error) });
				});
			});
			const renderRemote = (data) => {
				latestRemoteState = data;
				remoteRunning = data.running === true;
				remoteProvider = parseMobileRemoteProvider(data.provider);
				const cpolar = remoteProvider === "cpolar";
				const cloudflared = remoteProvider === "cloudflared";
				const frp = remoteProvider === "frp";
				const origin = remoteProvider === "origin";
				const managedOrigin = origin && data.originMode === "managed";
				const tailscale = remoteProvider === "tailscale";
				tailscaleChoice.classList.toggle("is-selected", tailscale);
				cpolarChoice.classList.toggle("is-selected", cpolar);
				cloudflaredChoice.classList.toggle("is-selected", cloudflared);
				frpChoice.classList.toggle("is-selected", frp);
				originChoice.classList.toggle("is-selected", origin);
				tailscaleChoice.setAttribute("aria-checked", String(tailscale));
				cpolarChoice.setAttribute("aria-checked", String(cpolar));
				cloudflaredChoice.setAttribute("aria-checked", String(cloudflared));
				tailscaleChoice.tabIndex = tailscale ? 0 : -1;
				cpolarChoice.tabIndex = cpolar ? 0 : -1;
				cloudflaredChoice.tabIndex = cloudflared ? 0 : -1;
				frpChoice.setAttribute("aria-pressed", String(frp));
				originChoice.setAttribute("aria-pressed", String(origin));
				providerSetupName.textContent = cpolar ? "cpolar" : cloudflared ? "cloudflared" : frp ? t("frpName") : origin ? t(managedOrigin ? "caddyName" : "originName") : "Tailscale Funnel";
				tailscaleChoice.disabled = remoteProviderBusy;
				cpolarChoice.disabled = remoteProviderBusy;
				cloudflaredChoice.disabled = remoteProviderBusy;
				frpChoice.disabled = remoteProviderBusy;
				originChoice.disabled = remoteProviderBusy;
				cpolarSetup.hidden = !cpolar;
				cloudflaredSetup.hidden = !cloudflared;
				frpSetup.hidden = !frp;
				originSetup.hidden = !origin;
				if (frp || origin) selfHosted.open = true;
				tailscaleInfo.hidden = !tailscale;
				remoteReset.textContent = tailscale ? t("resetRemoteLogin") : t("resetRemoteDevices");
				const providers = data.providers !== null && typeof data.providers === "object" ? data.providers : {};
				const cpolarProvider = providers.cpolar !== null && typeof providers.cpolar === "object" ? providers.cpolar : {};
				const component = cpolarProvider.component !== null && typeof cpolarProvider.component === "object" ? cpolarProvider.component : {};
				cpolarInstalled = component.installed === true;
				cpolarConfigured = component.configured === true;
				cpolarChoiceBadge.textContent = cpolarConfigured ? t("ready") : cpolarInstalled ? t("installed") : t("mainlandPreferred");
				const cpolarSupported = component.supported !== false;
				const componentVersion = typeof component.version === "string" ? component.version : "";
				const componentDownloadBytes = typeof component.downloadBytes === "number" ? component.downloadBytes : 0;
				const componentStorage = typeof component.storagePath === "string" ? component.storagePath : `DSH Mobile ${t("pluginPrivateDirectory")}`;
				cpolarStorage.textContent = componentStorage;
				cpolarStorage.title = componentStorage;
				cpolarInstall.hidden = cpolarInstalled || !cpolarSupported;
				cpolarInstall.textContent = componentDownloadBytes > 0 ? t("installWithSize", { size: formatMegabytes(componentDownloadBytes) }) : t("installOfficial");
				cpolarInstall.disabled = remoteProviderBusy;
				cpolarAccount.hidden = !cpolarInstalled || cpolarConfigured;
				cpolarConfigure.disabled = remoteProviderBusy;
				cpolarPurge.hidden = !cpolarInstalled && !cpolarConfigured;
				cpolarComponentStatus.textContent = !cpolarSupported ? t("cpolarUnsupported") : !cpolarInstalled ? t("cpolarNotInstalled") : !cpolarConfigured ? t("cpolarNeedsToken", { version: componentVersion }) : t("cpolarReady", { version: componentVersion });
				const cloudflaredProvider = providers.cloudflared !== null && typeof providers.cloudflared === "object" ? providers.cloudflared : {};
				const cloudflaredComponent = cloudflaredProvider.component !== null && typeof cloudflaredProvider.component === "object" ? cloudflaredProvider.component : {};
				cloudflaredInstalled = cloudflaredComponent.installed === true;
				const cloudflaredSupported = cloudflaredComponent.supported !== false;
				const cloudflaredComponentError = typeof cloudflaredComponent.errorCode === "string" ? cloudflaredComponent.errorCode : "";
				const cloudflaredVersion = typeof cloudflaredComponent.version === "string" ? cloudflaredComponent.version : "";
				const cloudflaredDownloadBytes = typeof cloudflaredComponent.downloadBytes === "number" ? cloudflaredComponent.downloadBytes : 0;
				if (cloudflaredDownloadBytes > 0) cloudflaredDownloadSize = formatMegabytes(cloudflaredDownloadBytes);
				const cloudflaredStoragePath = typeof cloudflaredComponent.storagePath === "string" ? cloudflaredComponent.storagePath : `DSH Mobile ${t("pluginPrivateDirectory")}`;
				cloudflaredStorage.textContent = cloudflaredStoragePath;
				cloudflaredStorage.title = cloudflaredStoragePath;
				cloudflaredChoiceBadge.textContent = cloudflaredInstalled ? t("ready") : t("cloudflaredBadge");
				cloudflaredInstall.hidden = cloudflaredInstalled || !cloudflaredSupported;
				cloudflaredInstall.textContent = cloudflaredDownloadBytes > 0 ? t("installWithSize", { size: formatMegabytes(cloudflaredDownloadBytes) }) : t("installOfficial");
				cloudflaredInstall.disabled = remoteProviderBusy;
				cloudflaredPurge.hidden = !cloudflaredInstalled;
				cloudflaredComponentStatus.textContent = !cloudflaredSupported ? t("cloudflaredUnsupported") : !cloudflaredInstalled ? cloudflaredComponentError === "cloudflared_component_invalid" ? t("cloudflaredInvalid") : t("cloudflaredNotInstalled") : t("cloudflaredReady", { version: cloudflaredVersion });
				const cloudflaredTunnelConfiguration = cloudflaredProvider.configuration !== null && typeof cloudflaredProvider.configuration === "object" ? cloudflaredProvider.configuration : {};
				cloudflaredTunnelMode = cloudflaredTunnelConfiguration.mode === "named" ? "named" : "quick";
				cloudflaredTunnelConfigured = cloudflaredTunnelConfiguration.configured === true;
				configuredCloudflaredHostname = typeof cloudflaredTunnelConfiguration.hostname === "string" ? cloudflaredTunnelConfiguration.hostname : "";
				configuredCloudflaredPort = typeof cloudflaredTunnelConfiguration.port === "number" ? cloudflaredTunnelConfiguration.port : 3444;
				const cloudflaredTunnelError = typeof cloudflaredTunnelConfiguration.errorCode === "string" ? cloudflaredTunnelConfiguration.errorCode : "";
				if (cloudflaredModeDraft !== null && cloudflaredModeDraft === cloudflaredTunnelMode) cloudflaredModeDraft = null;
				const cloudflaredShownMode = cloudflaredModeDraft ?? cloudflaredTunnelMode;
				cloudflaredModeQuick.classList.toggle("is-active", cloudflaredShownMode === "quick");
				cloudflaredModeNamed.classList.toggle("is-active", cloudflaredShownMode === "named");
				cloudflaredModeQuick.setAttribute("aria-pressed", String(cloudflaredShownMode === "quick"));
				cloudflaredModeNamed.setAttribute("aria-pressed", String(cloudflaredShownMode === "named"));
				cloudflaredModeQuick.disabled = remoteProviderBusy;
				cloudflaredModeNamed.disabled = remoteProviderBusy;
				cloudflaredModeHint.textContent = cloudflaredShownMode === "named" ? t("cloudflaredTunnelNamedHint") : t("cloudflaredTunnelQuickHint");
				cloudflaredNote.textContent = cloudflaredShownMode === "named" ? t("cloudflaredNamedNote") : t("cloudflaredQuickNote");
				cloudflaredTunnel.hidden = cloudflaredShownMode !== "named";
				cloudflaredTunnelSave.textContent = cloudflaredSaveLabel();
				if (!cloudflaredHostnameDirty) cloudflaredHostname.value = configuredCloudflaredHostname;
				if (!cloudflaredPortDirty) cloudflaredPort.value = String(configuredCloudflaredPort);
				cloudflaredToken.placeholder = cloudflaredTunnelConfigured ? t("cloudflaredTunnelTokenSaved") : t("cloudflaredTunnelTokenPlaceholder");
				const cloudflaredFieldPort = String(cloudflaredPort.value ?? "").trim();
				cloudflaredTunnelHint.textContent = t("cloudflaredTunnelHint", { port: cloudflaredFieldPort === "" ? String(configuredCloudflaredPort) : cloudflaredFieldPort });
				cloudflaredTunnelStatus.textContent = cloudflaredTunnelError !== "" ? t("cloudflaredTunnelInvalid") : cloudflaredTunnelConfigured ? t("cloudflaredTunnelConfigured", {
					hostname: configuredCloudflaredHostname,
					port: String(configuredCloudflaredPort)
				}) : t("cloudflaredTunnelMissing");
				cloudflaredTunnelSave.disabled = remoteProviderBusy || !cloudflaredInstalled;
				cloudflaredTunnelForget.hidden = !cloudflaredTunnelConfigured;
				const frpProvider = providers.frp !== null && typeof providers.frp === "object" ? providers.frp : {};
				const frpComponent = frpProvider.component !== null && typeof frpProvider.component === "object" ? frpProvider.component : {};
				const frpConfiguration = frpProvider.configuration !== null && typeof frpProvider.configuration === "object" ? frpProvider.configuration : {};
				frpInstalled = frpComponent.installed === true;
				frpConfigured = frpConfiguration.configured === true;
				const frpSupported = frpComponent.supported !== false;
				const frpVersion = typeof frpComponent.version === "string" ? frpComponent.version : "";
				const frpDownloadBytes = typeof frpComponent.downloadBytes === "number" ? frpComponent.downloadBytes : 0;
				if (frpDownloadBytes > 0) frpDownloadSize = formatMegabytes(frpDownloadBytes);
				const frpStoragePath = typeof frpComponent.storagePath === "string" ? frpComponent.storagePath : `DSH Mobile ${t("pluginPrivateDirectory")}`;
				configuredFrpServer = typeof frpConfiguration.serverAddress === "string" ? frpConfiguration.serverAddress : "";
				configuredFrpPort = typeof frpConfiguration.serverPort === "number" ? frpConfiguration.serverPort : 7e3;
				configuredFrpOrigin = typeof frpConfiguration.publicOrigin === "string" ? frpConfiguration.publicOrigin : "";
				if (frpServer.value === "" && configuredFrpServer !== "") frpServer.value = configuredFrpServer;
				if ((frpPort.value === "" || frpPort.value === "7000") && configuredFrpPort !== 7e3) frpPort.value = String(configuredFrpPort);
				if (frpOrigin.value === "" && configuredFrpOrigin !== "") frpOrigin.value = configuredFrpOrigin;
				frpStorage.textContent = frpStoragePath;
				frpStorage.title = frpStoragePath;
				const configuredFrpMode = frpConfiguration.mode === "attach" ? "attach" : "deploy";
				const configuredFrpEntryTls = frpConfiguration.entryTls === "self-signed" ? "self-signed" : "public-ip-cert";
				if (frpConfigured) {
					frpConfiguredMode = configuredFrpMode;
					frpConfiguredEntryTls = configuredFrpEntryTls;
				}
				if (frpConfigured && !frpModeDraft) frpMode.value = configuredFrpMode;
				if (frpConfigured && !frpEntryTlsDraft) frpEntryTls.value = configuredFrpEntryTls;
				if (typeof frpConfiguration.vhostHttpPort === "number") configuredFrpVhostPort = frpConfiguration.vhostHttpPort;
				if (typeof frpConfiguration.publicPort === "number") configuredFrpPublicPort = frpConfiguration.publicPort;
				configuredFrpProxyName = typeof frpConfiguration.proxyName === "string" && frpConfiguration.proxyName !== "" ? frpConfiguration.proxyName : void 0;
				if (!frpVhostDraft) {
					if (frpMode.value === "attach" && configuredFrpMode === "attach" && configuredFrpEntryTls === "public-ip-cert") {
						frpVhostPort.value = String(configuredFrpVhostPort);
						frpAttachVhostExplicit = true;
					} else frpVhostPort.value = frpMode.value === "deploy" ? String(configuredFrpVhostPort) : "";
				}
				if (frpPublicPort.value === "" || frpPublicPort.value === "33080") frpPublicPort.value = String(configuredFrpPublicPort);
				const attachSelected = frpMode.value === "attach";
				const selfSignedSelected = attachSelected && frpEntryTls.value === "self-signed";
				frpStep2Title.textContent = t(attachSelected ? "frpStep2TitleAttach" : "frpStep2Title");
				frpStep2Text.textContent = attachSelected && configuredFrpProxyName === void 0 ? t("loadingRemoteStatus") : t(attachSelected ? "frpStep2TextAttach" : "frpStep2Text");
				frpStep4Text.textContent = t(attachSelected ? "frpStep4TextAttach" : "frpStep4Text");
				frpAppRequirement.textContent = t(selfSignedSelected ? "frpAppRequirementSelfSigned" : "frpAppRequirement");
				frpCopyTemplate.hidden = attachSelected;
				frpCopyAttachPlan.hidden = !attachSelected;
				frpCopyAttachToken.hidden = !attachSelected;
				frpCopyAttachPlan.disabled = remoteProviderBusy || configuredFrpProxyName === void 0;
				frpCopyAttachToken.disabled = remoteProviderBusy || configuredFrpProxyName === void 0;
				frpSelfCheckButton.hidden = !frpConfigured;
				frpVhostPort.disabled = selfSignedSelected;
				frpVhostLabel.hidden = selfSignedSelected;
				frpVhostPort.required = attachSelected && !selfSignedSelected;
				frpVhostHint.textContent = frpVhostPort.required ? t("frpAttachModeRequiresVhostPort") : t("frpVhostHttpPortHint");
				frpEntryTls.disabled = !attachSelected;
				frpEntryTlsLabel.hidden = !attachSelected;
				frpPublicPortLabel.hidden = !selfSignedSelected;
				vpsDeployText.hidden = attachSelected;
				vpsChangesTitle.hidden = attachSelected;
				vpsChanges.hidden = attachSelected;
				vpsDeployFields.hidden = attachSelected;
				vpsDeploy.hidden = attachSelected;
				vpsDeployStatus.hidden = attachSelected;
				vpsCopyUninstall.hidden = attachSelected;
				vpsUninstall.hidden = attachSelected;
				frpInstall.hidden = frpInstalled || !frpSupported;
				frpInstall.textContent = frpDownloadBytes > 0 ? t("installWithSize", { size: formatMegabytes(frpDownloadBytes) }) : t("installFrpc");
				frpInstall.disabled = remoteProviderBusy;
				frpConfigure.disabled = remoteProviderBusy || !frpInstalled;
				vpsDeploy.disabled = remoteProviderBusy || !validVpsDeploymentForm();
				vpsCopyUninstall.disabled = vpsDeploy.disabled;
				vpsUninstall.disabled = vpsDeploy.disabled;
				frpPurge.hidden = !frpInstalled && !frpConfigured;
				frpComponentStatus.textContent = !frpSupported ? t("frpUnsupported") : frpInstalled ? t("frpComponentReady", { version: frpVersion }) : t("frpNotInstalled");
				frpConfigurationStatus.textContent = frpConfigured ? t("frpConfigurationReady") : t(attachSelected ? "frpConfigurationMissingAttach" : "frpConfigurationMissing");
				frpOverview.hidden = !frpConfigured;
				frpOverviewEndpoint.textContent = configuredFrpOrigin === "" ? configuredFrpServer : `${configuredFrpOrigin} · ${configuredFrpServer}:${String(configuredFrpPort)}`;
				frpToken.placeholder = frpConfigured ? locale === "zh" ? "已安全保存；留空保持不变" : locale === "it" ? "Salvato; lascia vuoto per mantenerlo" : "Saved securely; leave blank to keep it" : t("frpTokenPlaceholder");
				vpsDeploy.textContent = frpConfigured ? locale === "zh" ? "修复或重新部署 VPS" : locale === "it" ? "Ripara o ridistribuisci VPS" : "Repair or redeploy VPS" : t("vpsDeploy");
				frpConnectionSummary.textContent = `${frpConfigured ? "✓ " : ""}${t("frpStep1Title")}`;
				frpComponentSummary.textContent = `${frpInstalled ? "✓ " : ""}${t("frpStep3Title")}`;
				if (!frpLayoutInitialized) {
					frpConnectionGroup.open = !frpConfigured;
					frpComponentGroup.open = !frpInstalled;
					frpVpsGroup.open = !frpConfigured;
					frpLayoutInitialized = true;
				}
				const originProvider = providers.origin !== null && typeof providers.origin === "object" ? providers.origin : {};
				const originConfiguration = originProvider.configuration !== null && typeof originProvider.configuration === "object" ? originProvider.configuration : {};
				originConfigured = originConfiguration.configured === true;
				if (!originFormDirty && !originFormBusy) {
					originPublic.value = typeof originConfiguration.publicOrigin === "string" ? originConfiguration.publicOrigin : "";
					originHost.value = typeof originConfiguration.listenHost === "string" ? originConfiguration.listenHost : "127.0.0.1";
					originPort.value = typeof originConfiguration.listenPort === "number" ? String(originConfiguration.listenPort) : "3444";
					originCidrs.value = Array.isArray(originConfiguration.allowedCidrs) ? originConfiguration.allowedCidrs.filter((value) => typeof value === "string").join(", ") : "127.0.0.0/8";
				}
				originSetup.setAttribute("aria-busy", String(originFormBusy));
				originConfigure.setAttribute("aria-busy", String(originFormBusy));
				originConfigure.textContent = originFormBusy ? t("saving") : t("originSaveStart");
				for (const input of [
					originPublic,
					originHost,
					originPort,
					originCidrs
				]) input.disabled = remoteProviderBusy;
				originConfigure.disabled = remoteProviderBusy;
				originPurge.disabled = remoteProviderBusy;
				originPurge.hidden = !originConfigured && originConfiguration.errorCode !== "origin_config_invalid" && originProvider.running !== true;
				const originListening = origin && originProvider.state === "ready" && originProvider.running === true;
				const backendOrigin = originListening && typeof data.backendOrigin === "string" ? data.backendOrigin : typeof originConfiguration.backendOrigin === "string" ? originConfiguration.backendOrigin : "";
				originBackend.hidden = backendOrigin === "";
				originBackendLabel.textContent = originListening ? t("originBackendListening") : t("originBackendSaved");
				originBackendAddress.textContent = backendOrigin;
				originCopyBackend.disabled = remoteProviderBusy || backendOrigin === "";
				const caddyComponentInfo = originProvider.component;
				const caddyInstalled = caddyComponentInfo !== void 0 && caddyComponentInfo.installed === true;
				const caddySupported = caddyComponentInfo !== void 0 && caddyComponentInfo.supported === true;
				if (!caddyModePreviewDirty) caddyModeManagedSelected = data.originMode === "managed";
				const showManaged = origin && caddyModeManagedSelected;
				caddyModePreviewNote.hidden = !origin || !caddyModePreviewDirty || caddyModeManagedSelected === managedOrigin;
				const caddyConfiguration = typeof data.caddyConfiguration === "object" && data.caddyConfiguration !== null ? data.caddyConfiguration : {};
				const caddyState = typeof data.caddyState === "object" && data.caddyState !== null ? data.caddyState : {};
				caddyModeRow.hidden = !origin;
				caddyForm.hidden = !showManaged;
				originFields.hidden = showManaged;
				originFormActions.hidden = showManaged;
				originHelp.hidden = showManaged;
				originWarning.hidden = showManaged;
				if (showManaged) originBackend.hidden = true;
				caddyInstall.hidden = !showManaged || caddyInstalled;
				caddyInstallNote.hidden = !showManaged;
				caddySave.hidden = !showManaged || !caddyInstalled;
				caddyPurgeButton.hidden = !showManaged || !caddyInstalled && caddyConfiguration.configured !== true;
				caddyStatus.hidden = !showManaged;
				caddyStatus.textContent = !caddySupported && !caddyInstalled ? t("caddyUnavailable") : caddyState.enabled === true && caddyState.state === "ready" ? t("caddyVerified") : caddyState.state === "starting" || caddyState.state === "connecting" ? t("remoteStateConnecting") : caddyState.state === "error" ? t("caddyConnectionFailed") : caddyInstalled ? t("caddyInstalled") : t("caddyInstallNote");
				caddyModeManaged.checked = caddyModeManagedSelected;
				caddyModeExternal.checked = !caddyModeManagedSelected;
				caddyModeManaged.disabled = remoteProviderBusy;
				caddyModeExternal.disabled = remoteProviderBusy;
				if (!caddyFormBusy && !caddyFormDirty) {
					caddyDomain.value = typeof caddyConfiguration.publicOrigin === "string" ? caddyConfiguration.publicOrigin : "";
					caddyPort.value = typeof caddyConfiguration.listenPort === "number" ? String(caddyConfiguration.listenPort) : "8443";
				}
				caddyInstall.disabled = remoteProviderBusy || !caddySupported || caddyInstalled;
				caddySave.disabled = remoteProviderBusy || !caddySupported || !caddyInstalled;
				caddyPurgeButton.disabled = remoteProviderBusy;
				for (const input of [
					caddyDomain,
					caddyProvider,
					caddySecretId,
					caddySecretKey,
					caddyPort
				]) input.disabled = remoteProviderBusy || !caddySupported;
				const state = typeof data.state === "string" ? data.state : "error";
				const errorCode = typeof data.errorCode === "string" ? data.errorCode : "";
				const remoteOrigin = typeof data.origin === "string" ? data.origin : "";
				remoteLoginUrl = typeof data.loginUrl === "string" ? data.loginUrl : "";
				const candidateSetupUrl = tailscale ? officialFunnelSetupUrl(data.setupUrl) : "";
				remoteSetupUrl = candidateSetupUrl !== "" ? candidateSetupUrl : {
					funnel_permission_required: "https://tailscale.com/s/no-funnel",
					funnel_https_required: "https://tailscale.com/s/https",
					funnel_start_failed: "https://tailscale.com/s/no-funnel"
				}[errorCode] ?? "";
				const needsFunnelSetup = state === "error" && remoteSetupUrl !== "";
				remoteReady = remoteRunning && state === "ready" && remoteOrigin !== "";
				selfHostedBadge.textContent = origin ? managedOrigin ? t(remoteReady ? "ready" : "advanced") : originListening ? t("originBackendReady") : t("advanced") : frpConfigured && frpInstalled ? t("ready") : t("advanced");
				remoteStateBadge.classList.toggle("is-ready", remoteReady);
				remoteStateBadge.classList.toggle("is-busy", state === "starting" || state === "connecting" || state === "needs-login");
				remoteStateBadge.classList.toggle("is-attention", state === "error" || state === "unavailable");
				remoteStateBadge.textContent = remoteReady ? origin && !managedOrigin ? t("originBackendReady") : t("ready") : state === "starting" || state === "connecting" || state === "needs-login" ? t("remoteStateConnecting") : state === "error" || state === "unavailable" ? t("remoteStateAttention") : t("remoteStateOff");
				remoteAccess.hidden = !remoteReady;
				remoteAccessLink.href = remoteOrigin;
				remoteAccessLink.textContent = remoteOrigin;
				remoteAccessLink.title = remoteOrigin;
				remoteStatus.classList.toggle("is-running", remoteReady);
				const labels = {
					off: t("remoteOff"),
					unavailable: cpolar ? t("remoteUnavailableCpolar") : cloudflared ? t("remoteUnavailableCloudflared") : frp ? t("remoteUnavailableFrp") : origin ? t("originUnavailable") : t("remoteUnavailableTailscale"),
					starting: cpolar ? t("remoteStartingCpolar") : cloudflared ? t("remoteStartingCloudflared") : frp ? t("remoteStartingFrp") : origin ? t("originStarting") : t("remoteStartingTailscale"),
					"needs-login": t("remoteNeedsLogin"),
					connecting: cpolar ? t("remoteConnectingCpolar") : cloudflared ? t("remoteConnectingCloudflared") : frp ? t("remoteConnectingFrp") : t("remoteConnectingTailscale"),
					ready: origin ? t(managedOrigin ? "caddyVerified" : "originReady") : t("remoteReady"),
					error: t("remoteError")
				};
				const errorLabels = translatedRemoteErrors();
				remoteStatus.textContent = remoteSetupPending && needsFunnelSetup ? t("setupOpened") : state === "error" ? errorLabels[errorCode] ?? labels.error : labels[state] ?? labels.error;
				if (remoteFailureText !== void 0) {
					remoteStatus.textContent = remoteFailureText;
					remoteFailureText = void 0;
				}
				remoteGuide.hidden = !needsFunnelSetup;
				remoteSetup.disabled = remoteSetupUrl === "" || remoteReconnectBusy;
				remoteSetupRetry.disabled = remoteReconnectBusy;
				remoteToggle.textContent = remoteRunning ? t("disableRemote") : t("enableRemote");
				const originPrepared = data.originMode === "managed" ? caddySupported && caddyInstalled && caddyConfiguration.configured === true : originConfigured && !caddyModeManagedSelected;
				const providerPrepared = cpolar ? cpolarInstalled && cpolarConfigured : cloudflared ? cloudflaredInstalled : frp ? frpInstalled && frpConfigured : origin ? originPrepared : true;
				remoteToggle.disabled = remoteProviderBusy || !providerPrepared && !(origin && remoteRunning);
				remoteLogin.hidden = !tailscale || state !== "needs-login" || remoteLoginUrl === "";
				remoteReconnect.hidden = needsFunnelSetup || state !== "error" && state !== "unavailable" || !providerPrepared;
				remoteActions.hidden = !providerPrepared && !(origin && remoteRunning);
				remotePair.disabled = !remoteReady || remoteProviderBusy;
				remoteCopyLink.disabled = !remoteReady || remoteProviderBusy;
				remoteDevices.disabled = !remoteReady || remoteProviderBusy;
				if (origin) {
					remoteReconnect.disabled = remoteProviderBusy || remoteReconnectBusy;
					remoteReset.disabled = remoteProviderBusy;
				} else remoteReset.disabled = false;
				if (!remoteReady) {
					remoteQr.hidden = true;
					remotePairLink.hidden = true;
					activeRemotePairUrl = "";
					activeRemotePairExpiresAt = 0;
				}
				if (!needsFunnelSetup) remoteSetupPending = false;
			};
			frpMode.addEventListener("change", () => {
				frpModeDraft = true;
				if (frpMode.value === "attach") {
					if (!frpAttachVhostExplicit) {
						frpVhostPort.value = "";
						frpVhostDraft = true;
					}
				} else {
					frpEntryTls.value = "public-ip-cert";
					frpEntryTlsDraft = true;
					if (frpVhostPort.value === "") frpVhostPort.value = String(configuredFrpVhostPort);
					frpVhostDraft = true;
				}
				frpVhostPort.removeAttribute("aria-invalid");
				renderRemote(latestRemoteState);
			});
			frpEntryTls.addEventListener("change", () => {
				frpEntryTlsDraft = true;
				if (frpMode.value === "attach" && frpEntryTls.value === "public-ip-cert" && !frpAttachVhostExplicit) {
					frpVhostPort.value = "";
					frpVhostDraft = true;
				}
				frpVhostPort.removeAttribute("aria-invalid");
				renderRemote(latestRemoteState);
			});
			frpVhostPort.addEventListener("input", () => {
				frpVhostDraft = true;
				if (frpMode.value === "attach") frpAttachVhostExplicit = frpVhostPort.value.trim() !== "";
				frpVhostPort.removeAttribute("aria-invalid");
			});
			let remoteLoadInFlight = false;
			const loadRemote = () => {
				if (remoteLoadInFlight || originFormBusy || caddyFormBusy) return;
				const epoch = remoteSnapshotEpoch;
				remoteLoadInFlight = true;
				controlRequestJson("/api/mobile-access/remote/control").then((data) => {
					if (epoch === remoteSnapshotEpoch) renderRemote(data);
				}, (error) => {
					if (epoch === remoteSnapshotEpoch) remoteStatus.textContent = t("requestFailed", { error: String(error) });
				}).finally(() => {
					remoteLoadInFlight = false;
				});
			};
			const chooseRemoteProvider = (provider) => {
				if (remoteProviderBusy || provider === remoteProvider) return;
				if (remoteRunning && !window.confirm(t("switchProviderConfirm"))) return;
				remoteProviderBusy = true;
				tailscaleChoice.disabled = true;
				cpolarChoice.disabled = true;
				cloudflaredChoice.disabled = true;
				frpChoice.disabled = true;
				originChoice.disabled = true;
				remoteStatus.textContent = provider === "cpolar" ? t("switchingCpolar") : provider === "cloudflared" ? t("switchingCloudflared") : provider === "frp" ? t("switchingFrp") : provider === "origin" ? t("switchingOrigin") : t("switchingTailscale");
				controlRequestJson("/api/mobile-access/remote/provider", {
					method: "POST",
					body: JSON.stringify({ provider })
				}).then(renderRemote, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "requestFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					loadRemote();
				});
			};
			tailscaleChoice.addEventListener("click", () => {
				chooseRemoteProvider("tailscale");
			});
			cpolarChoice.addEventListener("click", () => {
				chooseRemoteProvider("cpolar");
			});
			cloudflaredChoice.addEventListener("click", () => {
				chooseRemoteProvider("cloudflared");
			});
			frpChoice.addEventListener("click", () => {
				chooseRemoteProvider("frp");
			});
			originChoice.addEventListener("click", () => {
				chooseRemoteProvider("origin");
			});
			cloudflaredInstall.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				if (!window.confirm(t("installConfirmCloudflared", { size: cloudflaredDownloadSize }))) return;
				remoteProviderBusy = true;
				cloudflaredInstall.disabled = true;
				cloudflaredInstall.textContent = t("downloading");
				remoteStatus.textContent = t("installingCloudflared");
				controlRequestJson("/api/mobile-access/remote/cloudflared/component/install", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then(renderRemote, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "installFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					loadRemote();
				});
			});
			cloudflaredPurge.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				if (!window.confirm(t("purgeCloudflaredConfirm"))) return;
				remoteProviderBusy = true;
				cloudflaredPurge.disabled = true;
				remoteStatus.textContent = t("purgingCloudflared");
				controlRequestJson("/api/mobile-access/remote/cloudflared/component/purge", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then(renderRemote, (error) => {
					remoteFailureText = t("purgeFailed", { error: String(error) });
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					cloudflaredPurge.disabled = false;
					loadRemote();
				});
			});
			const showCloudflaredMode = (mode) => {
				cloudflaredModeDraft = mode;
				cloudflaredModeQuick.classList.toggle("is-active", mode === "quick");
				cloudflaredModeNamed.classList.toggle("is-active", mode === "named");
				cloudflaredModeQuick.setAttribute("aria-pressed", String(mode === "quick"));
				cloudflaredModeNamed.setAttribute("aria-pressed", String(mode === "named"));
				cloudflaredModeHint.textContent = mode === "named" ? t("cloudflaredTunnelNamedHint") : t("cloudflaredTunnelQuickHint");
				cloudflaredNote.textContent = mode === "named" ? t("cloudflaredNamedNote") : t("cloudflaredQuickNote");
				cloudflaredTunnel.hidden = mode !== "named";
				cloudflaredTunnelSave.textContent = cloudflaredSaveLabel();
			};
			cloudflaredModeQuick.addEventListener("click", () => {
				if (!remoteProviderBusy) showCloudflaredMode("quick");
			});
			cloudflaredModeNamed.addEventListener("click", () => {
				if (!remoteProviderBusy) showCloudflaredMode("named");
			});
			cloudflaredHostname.addEventListener("input", () => {
				cloudflaredHostnameDirty = true;
			});
			cloudflaredPort.addEventListener("input", () => {
				cloudflaredPortDirty = true;
			});
			cloudflaredTunnelSave.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				const mode = cloudflaredModeDraft ?? cloudflaredTunnelMode;
				const hostname = String(cloudflaredHostname.value ?? "").trim();
				const portValue = String(cloudflaredPort.value ?? "").trim();
				const port = Number(portValue);
				const token = String(cloudflaredToken.value ?? "");
				if (mode === "named") {
					if (hostname === "") {
						remoteStatus.textContent = t("cloudflaredTunnelHostnameInvalid");
						return;
					}
					if (portValue === "" || !Number.isSafeInteger(port) || port < 1024 || port > 65535) {
						remoteStatus.textContent = t("cloudflaredTunnelPortInvalid");
						return;
					}
					if (port === 3443) {
						remoteStatus.textContent = t("cloudflaredTunnelPortReserved");
						return;
					}
					if (token === "" && !cloudflaredTunnelConfigured) {
						remoteStatus.textContent = t("cloudflaredTunnelConfigMissing");
						return;
					}
					if (token !== "" && (token.length < 32 || !/^[A-Za-z0-9_=+/-]+$/u.test(token))) {
						remoteStatus.textContent = t("cloudflaredTunnelTokenInvalid");
						return;
					}
				}
				remoteProviderBusy = true;
				cloudflaredTunnelSave.disabled = true;
				cloudflaredTunnelSave.textContent = t("saving");
				remoteStatus.textContent = mode === "named" ? t("cloudflaredTunnelSaving") : t("switchingCloudflared");
				controlRequestJson("/api/mobile-access/remote/cloudflared/tunnel", {
					method: "POST",
					body: JSON.stringify(mode === "named" ? {
						mode,
						hostname,
						port,
						token
					} : { mode: "quick" })
				}).then((data) => {
					cloudflaredToken.value = "";
					cloudflaredModeDraft = null;
					cloudflaredHostnameDirty = false;
					cloudflaredPortDirty = false;
					remoteFailureText = "";
					renderRemote(data);
				}, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "requestFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					cloudflaredTunnelSave.disabled = false;
					cloudflaredTunnelSave.textContent = cloudflaredSaveLabel();
					loadRemote();
				});
			});
			cloudflaredTunnelForget.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				if (!window.confirm(t("cloudflaredTunnelForgetConfirm"))) return;
				remoteProviderBusy = true;
				cloudflaredTunnelForget.disabled = true;
				remoteStatus.textContent = t("cloudflaredTunnelForgetting");
				controlRequestJson("/api/mobile-access/remote/cloudflared/tunnel/purge", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}).then((data) => {
					cloudflaredToken.value = "";
					cloudflaredHostname.value = "";
					cloudflaredPort.value = "3444";
					cloudflaredModeDraft = null;
					cloudflaredHostnameDirty = false;
					cloudflaredPortDirty = false;
					remoteFailureText = "";
					renderRemote(data);
				}, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "requestFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					cloudflaredTunnelForget.disabled = false;
					loadRemote();
				});
			});
			cpolarInstall.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				if (!window.confirm(t("installConfirm"))) return;
				remoteProviderBusy = true;
				cpolarInstall.disabled = true;
				cpolarInstall.textContent = t("downloading");
				remoteStatus.textContent = t("installingCpolar");
				controlRequestJson("/api/mobile-access/remote/cpolar/component/install", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then(renderRemote, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "installFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					loadRemote();
				});
			});
			cpolarConfigure.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				const authtoken = cpolarToken.value.trim();
				if (authtoken.length < 20 || /\s/u.test(authtoken)) {
					remoteStatus.textContent = t("invalidToken");
					cpolarToken.focus();
					return;
				}
				remoteProviderBusy = true;
				cpolarConfigure.disabled = true;
				cpolarConfigure.setAttribute("aria-busy", "true");
				cpolarConfigure.textContent = t("saving");
				controlRequestJson("/api/mobile-access/remote/cpolar/configure", {
					method: "POST",
					body: JSON.stringify({ authtoken })
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then(() => {
					cpolarToken.value = "";
					remoteStatus.textContent = t("configuredConnecting");
					return controlRequestJson("/api/mobile-access/remote/control", {
						method: "POST",
						body: JSON.stringify({ running: true })
					});
				}).then(renderRemote, (error) => {
					remoteFailureText = t("configureFailed", { error: String(error) });
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					cpolarConfigure.setAttribute("aria-busy", "false");
					cpolarConfigure.textContent = t("saveConnect");
					loadRemote();
				});
			});
			cpolarPurge.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				if (!window.confirm(t("purgeConfirm"))) return;
				remoteProviderBusy = true;
				cpolarPurge.disabled = true;
				remoteStatus.textContent = t("purging");
				controlRequestJson("/api/mobile-access/remote/cpolar/component/purge", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then(renderRemote, (error) => {
					remoteFailureText = t("purgeFailed", { error: String(error) });
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					cpolarPurge.disabled = false;
					loadRemote();
				});
			});
			const validFrpServer = (value) => value === value.trim() && value.length > 0 && value.length <= 253 && !/[\s\u0000-\u001f\u007f/\\@?#]/u.test(value);
			const frpForm = () => {
				const vhostHttpPort = Number(frpVhostPort.value);
				const publicPort = Number(frpPublicPort.value);
				const mode = frpMode.value === "attach" ? "attach" : "deploy";
				return {
					serverAddress: String(frpServer.value ?? "").trim(),
					serverPort: Number(frpPort.value),
					token: String(frpToken.value ?? ""),
					publicOrigin: String(frpOrigin.value ?? "").trim(),
					mode,
					entryTls: frpEntryTls.value === "self-signed" ? "self-signed" : "public-ip-cert",
					...Number.isSafeInteger(vhostHttpPort) && vhostHttpPort >= 1 ? { vhostHttpPort } : {},
					...Number.isSafeInteger(publicPort) && publicPort >= 1 ? { publicPort } : {}
				};
			};
			/**
			* Attach-mode artefacts are built locally, so the token never reaches the host
			* API and the runbook can be produced before anything is saved.
			*/
			const attachClipboardForm = (form) => ({
				serverAddress: form.serverAddress,
				serverPort: form.serverPort,
				token: form.token === "" && frpConfigured ? "0123456789abcdef" : form.token,
				publicOrigin: form.publicOrigin,
				entryTls: form.entryTls,
				...form.entryTls === "self-signed" || form.vhostHttpPort === void 0 ? {} : { vhostHttpPort: form.vhostHttpPort },
				...form.publicPort === void 0 ? {} : { publicPort: form.publicPort }
			});
			const validFrpForm = (form) => {
				if (!validFrpServer(form.serverAddress)) return false;
				try {
					createFrpServerTemplateForClipboard(form.serverPort, form.token, form.publicOrigin);
					return true;
				} catch {
					return false;
				}
			};
			frpCopyTemplate.addEventListener("click", () => {
				const form = frpForm();
				if (!validFrpForm(form)) {
					remoteStatus.textContent = t("frpInputInvalid");
					return;
				}
				navigator.clipboard.writeText(createFrpServerTemplateForClipboard(form.serverPort, form.token, form.publicOrigin)).then(() => {
					remoteStatus.textContent = t("templateCopied");
				}, () => {
					remoteStatus.textContent = t("templateCopyFailed");
				});
			});
			const frpAttachErrorText = (code) => t(REMOTE_ERROR_MESSAGE_KEYS[code] ?? "frpInputInvalid");
			const showFrpAttachError = (code) => {
				const message = frpAttachErrorText(code);
				if (code === "frp_attach_mode_requires_vhost_port") {
					frpVhostPort.setAttribute("aria-invalid", "true");
					frpVhostHint.textContent = message;
					frpVhostPort.focus();
				}
				remoteStatus.textContent = message;
			};
			const frpClipboardProxyName = () => {
				if (configuredFrpProxyName === void 0) {
					remoteStatus.textContent = t("loadingRemoteStatus");
					loadRemote();
				}
				return configuredFrpProxyName;
			};
			frpCopyAttachPlan.addEventListener("click", () => {
				const form = frpForm();
				if (!validFrpServer(form.serverAddress) || !Number.isSafeInteger(form.serverPort) || form.serverPort < 1 || form.serverPort > 65535 || form.publicOrigin === "") {
					remoteStatus.textContent = t("frpInputInvalid");
					return;
				}
				if (form.token !== "") {
					const attachForm = attachClipboardForm(form);
					const code = frpAttachFormErrorCode(attachForm);
					if (code !== void 0) {
						showFrpAttachError(code);
						return;
					}
					const proxyName = frpClipboardProxyName();
					if (proxyName === void 0) return;
					navigator.clipboard.writeText(createFrpAttachTemplateForClipboard(attachForm, { proxyName })).then(() => {
						remoteStatus.textContent = t("frpAttachPlanCopied");
					}, () => {
						remoteStatus.textContent = t("frpAttachPlanFailed", { error: t("templateCopyFailed") });
					});
					return;
				}
				if (!frpConfigured) {
					remoteStatus.textContent = t("frpInputInvalid");
					return;
				}
				remoteProviderBusy = true;
				frpCopyAttachPlan.disabled = true;
				controlRequestJson("/api/mobile-access/remote/frp/attach-plan", {
					method: "POST",
					body: JSON.stringify(form)
				}).then((data) => {
					const text = typeof data.frpAttachTemplate === "string" ? data.frpAttachTemplate : "";
					if (text === "") throw new Error("frp_settings_invalid");
					return navigator.clipboard.writeText(text).then(() => {
						remoteStatus.textContent = t("frpAttachPlanCopied");
					});
				}, (error) => {
					remoteStatus.textContent = frpAttachErrorText(String(error));
				}).catch((error) => {
					remoteStatus.textContent = t("frpAttachPlanFailed", { error: String(error) });
				}).finally(() => {
					remoteProviderBusy = false;
					frpCopyAttachPlan.disabled = configuredFrpProxyName === void 0;
				});
			});
			/** Copy a token-bearing frpc.toml only from the token the user just typed. */
			frpCopyAttachToken.addEventListener("click", () => {
				const form = frpForm();
				if (!validFrpServer(form.serverAddress) || !Number.isSafeInteger(form.serverPort) || form.serverPort < 1 || form.serverPort > 65535 || form.publicOrigin === "") {
					remoteStatus.textContent = t("frpInputInvalid");
					return;
				}
				if (form.token !== "") {
					const attachForm = attachClipboardForm(form);
					const code = frpAttachFormErrorCode(attachForm);
					if (code !== void 0) {
						showFrpAttachError(code);
						return;
					}
					const proxyName = frpClipboardProxyName();
					if (proxyName === void 0) return;
					navigator.clipboard.writeText(createFrpAttachFrpcTomlForClipboard(attachForm, {
						revealToken: true,
						proxyName
					})).then(() => {
						remoteStatus.textContent = t("frpAttachTokenCopied");
					}, () => {
						remoteStatus.textContent = t("frpAttachTokenFailed", { error: t("templateCopyFailed") });
					});
					return;
				}
				frpToken.focus();
				remoteStatus.textContent = t("frpAttachTokenReenter");
			});
			const certificateStatusText = (status) => {
				if (status === void 0) return "";
				const state = typeof status.state === "string" ? status.state : "unknown";
				const days = typeof status.daysRemaining === "number" ? String(status.daysRemaining) : "0";
				if (state === "ok") return t("frpAttachCertOk", { days });
				if (state === "expiring") return t("frpAttachCertExpiring", { days });
				if (state === "expired") return t("frpAttachCertExpired");
				return t("frpAttachCertUnknown");
			};
			const caStatusText = (status) => {
				if (status === void 0) return "";
				const state = typeof status.state === "string" ? status.state : "unknown";
				const days = typeof status.daysRemaining === "number" ? String(status.daysRemaining) : "0";
				if (state === "ok") return t("frpAttachCaOk", { days });
				if (state === "expiring") return t("frpAttachCaExpiring", { days });
				if (state === "expired") return t("frpIngressCaExpired");
				return t("frpIngressCaInvalid");
			};
			frpSelfCheckButton.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				remoteProviderBusy = true;
				frpSelfCheckButton.disabled = true;
				frpSelfCheckStatus.hidden = false;
				frpSelfCheckStatus.textContent = t("loadingStatus");
				controlRequestJson("/api/mobile-access/remote/frp/self-check").then((data) => {
					const check = data.frpSelfCheck !== null && typeof data.frpSelfCheck === "object" ? data.frpSelfCheck : {};
					const lines = [];
					const caCertificate = check.caCertificate !== null && typeof check.caCertificate === "object" ? check.caCertificate : void 0;
					const caText = caStatusText(caCertificate);
					if (caText !== "") lines.push(caText);
					const certificate = check.certificate !== null && typeof check.certificate === "object" ? check.certificate : void 0;
					const certificateText = certificateStatusText(certificate);
					if (certificateText !== "") lines.push(certificateText);
					lines.push(check.frpsReachable === true ? t("frpAttachFrpsReachable") : t("frpAttachFrpsUnreachable"));
					if (check.entryTls === "self-signed") lines.push(check.entryReachable === true ? t("frpAttachEntryReachable") : t("frpAttachEntryUnreachable"));
					frpSelfCheckStatus.textContent = lines.join(" · ");
				}, (error) => {
					frpSelfCheckStatus.textContent = t("requestFailed", { error: String(error) });
				}).finally(() => {
					remoteProviderBusy = false;
					frpSelfCheckButton.disabled = false;
				});
			});
			const validVpsSshUser = (value) => /^[a-z_][a-z0-9_.-]*[$]?$/iu.test(value) && value.length <= 64;
			const validVpsSshKey = (value) => value === "" || /^[a-zA-Z]:[\\/]/u.test(value) || value.startsWith("/");
			const vpsFormStorageKey = "dsh-mobile.frp-vps-form.v1";
			try {
				const saved = JSON.parse(localStorage.getItem(vpsFormStorageKey) ?? "{}");
				if (typeof saved.sshUser === "string" && validVpsSshUser(saved.sshUser)) vpsSshUser.value = saved.sshUser;
				if (typeof saved.sshPort === "number" && Number.isSafeInteger(saved.sshPort) && saved.sshPort >= 1 && saved.sshPort <= 65535) vpsSshPort.value = String(saved.sshPort);
				if (typeof saved.sshKeyPath === "string" && validVpsSshKey(saved.sshKeyPath)) vpsSshKey.value = saved.sshKeyPath;
			} catch {}
			const saveVpsForm = () => {
				try {
					localStorage.setItem(vpsFormStorageKey, JSON.stringify({
						sshUser: String(vpsSshUser.value ?? "").trim(),
						sshPort: Number(vpsSshPort.value),
						sshKeyPath: String(vpsSshKey.value ?? "").trim()
					}));
				} catch {}
			};
			const validVpsDeploymentForm = () => {
				const sshPort = Number(vpsSshPort.value);
				return validVpsFrpForm() && validVpsSshUser(String(vpsSshUser.value ?? "").trim()) && Number.isSafeInteger(sshPort) && sshPort >= 1 && sshPort <= 65535 && validVpsSshKey(String(vpsSshKey.value ?? "").trim());
			};
			/**
			* VPS actions accept blank connection fields when a configuration is already
			* saved; blanks keep their saved values ("已保存时可留空"). The token itself
			* is never readable here, so a blank token is merged server-side while the
			* remaining fields still pass the regular template check.
			*/
			const vpsEffectiveForm = () => {
				const form = frpForm();
				if (!frpConfigured) return form;
				return {
					serverAddress: form.serverAddress === "" ? configuredFrpServer : form.serverAddress,
					serverPort: Number.isSafeInteger(form.serverPort) && form.serverPort >= 1 ? form.serverPort : configuredFrpPort,
					token: form.token,
					publicOrigin: form.publicOrigin === "" ? configuredFrpOrigin : form.publicOrigin,
					mode: form.mode,
					entryTls: form.entryTls,
					...form.vhostHttpPort === void 0 ? {} : { vhostHttpPort: form.vhostHttpPort },
					...form.publicPort === void 0 ? {} : { publicPort: form.publicPort }
				};
			};
			const validVpsFrpForm = () => {
				const form = vpsEffectiveForm();
				const token = form.token === "" && frpConfigured ? "0123456789abcdef" : form.token;
				return validFrpForm({
					...form,
					token
				});
			};
			const refreshVpsDeployButton = () => {
				const disabled = remoteProviderBusy || !validVpsDeploymentForm();
				vpsDeploy.disabled = disabled;
				vpsCopyUninstall.disabled = disabled;
				vpsUninstall.disabled = disabled;
			};
			for (const input of [
				frpServer,
				frpPort,
				frpToken,
				frpOrigin,
				vpsSshUser,
				vpsSshPort,
				vpsSshKey
			]) input.addEventListener("input", refreshVpsDeployButton);
			for (const input of [
				vpsSshUser,
				vpsSshPort,
				vpsSshKey
			]) input.addEventListener("input", saveVpsForm);
			const vpsCertName = (origin) => {
				try {
					const host = new URL(origin).hostname;
					return /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host) ? host : void 0;
				} catch {
					return;
				}
			};
			const requestVpsHostKeys = (serverAddress, sshUser, sshPort, sshKeyPath) => {
				const keyPayload = {
					serverAddress,
					sshUser,
					sshPort
				};
				if (sshKeyPath !== "") keyPayload.sshKeyPath = sshKeyPath;
				return controlRequestJson("/api/mobile-access/remote/frp/vps/host-keys", {
					method: "POST",
					body: JSON.stringify(keyPayload)
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then((keys) => {
					const confirmed = (Array.isArray(keys.vpsHostKeys) ? keys.vpsHostKeys : []).filter((key) => typeof key.fingerprint === "string" && typeof key.keyType === "string").map((key) => ({
						display: `${String(key.keyType)} ${String(key.fingerprint)}`,
						fingerprint: String(key.fingerprint)
					}));
					if (confirmed.length === 0) throw new Error(String(t("vpsHostKeyFailed", { error: "empty" })));
					return confirmed;
				});
			};
			vpsDeploy.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				const form = vpsEffectiveForm();
				if (!validVpsFrpForm()) {
					vpsDeployStatus.textContent = t("vpsDeployNotReady");
					return;
				}
				const sshUser = vpsSshUser.value.trim();
				const sshPort = Number(vpsSshPort.value);
				const sshKeyPath = vpsSshKey.value.trim();
				saveVpsForm();
				if (!validVpsSshUser(sshUser) || !Number.isSafeInteger(sshPort) || sshPort < 1 || sshPort > 65535 || !validVpsSshKey(sshKeyPath)) {
					vpsDeployStatus.textContent = t("vpsDeployFailed", { error: t("vpsSshKey") });
					return;
				}
				remoteProviderBusy = true;
				vpsDeploy.disabled = true;
				vpsCopyUninstall.disabled = true;
				vpsUninstall.disabled = true;
				vpsDeployStatus.textContent = t("vpsHostKeyFetching");
				remoteStatus.textContent = t("vpsHostKeyFetching");
				requestVpsHostKeys(form.serverAddress, sshUser, sshPort, sshKeyPath).then((hostKeys) => {
					const display = hostKeys.map((key) => key.display).join("\n");
					if (!window.confirm(t("vpsDeployConfirmWithKeys", { fingerprints: display }))) {
						remoteProviderBusy = false;
						refreshVpsDeployButton();
						loadRemote();
						return;
					}
					vpsDeployStatus.textContent = t("vpsDeploying");
					remoteStatus.textContent = t("vpsDeploying");
					const payload = {
						confirm: true,
						...form,
						sshUser,
						sshPort,
						hostFingerprints: hostKeys.map((key) => key.fingerprint)
					};
					if (sshKeyPath !== "") payload.sshKeyPath = sshKeyPath;
					return controlRequestJson("/api/mobile-access/remote/frp/vps/deploy", {
						method: "POST",
						body: JSON.stringify(payload)
					}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then((data) => {
						const deployment = data.vpsDeployment !== null && typeof data.vpsDeployment === "object" ? data.vpsDeployment : {};
						vpsDeployStatus.textContent = deployment.deployed === true ? t("vpsDeploySuccess") : t("vpsDeployFailed", { error: t("vpsDeployFailed", { error: "unknown result" }) });
						remoteStatus.textContent = vpsDeployStatus.textContent;
						renderRemote(data);
					}, (error) => {
						vpsDeployStatus.textContent = t("vpsDeployFailed", { error: String(error) });
						remoteStatus.textContent = vpsDeployStatus.textContent;
					}).finally(() => {
						remoteProviderBusy = false;
						loadRemote();
					});
				}, (error) => {
					vpsDeployStatus.textContent = t("vpsHostKeyFailed", { error: String(error) });
					remoteStatus.textContent = vpsDeployStatus.textContent;
					remoteProviderBusy = false;
					refreshVpsDeployButton();
					loadRemote();
				});
			});
			const readVpsSshForm = () => {
				const sshUser = vpsSshUser.value.trim();
				const sshPort = Number(vpsSshPort.value);
				const sshKeyPath = vpsSshKey.value.trim();
				saveVpsForm();
				if (!validVpsSshUser(sshUser) || !Number.isSafeInteger(sshPort) || sshPort < 1 || sshPort > 65535 || !validVpsSshKey(sshKeyPath)) {
					vpsDeployStatus.textContent = t("vpsDeployFailed", { error: t("vpsSshKey") });
					return;
				}
				return {
					sshUser,
					sshPort,
					sshKeyPath
				};
			};
			vpsCopyUninstall.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				const form = vpsEffectiveForm();
				if (!validVpsFrpForm()) {
					vpsDeployStatus.textContent = t("vpsDeployNotReady");
					return;
				}
				remoteProviderBusy = true;
				refreshVpsDeployButton();
				const scriptPayload = { serverPort: form.serverPort };
				const certName = vpsCertName(form.publicOrigin);
				if (certName !== void 0) scriptPayload.certName = certName;
				controlRequestJson("/api/mobile-access/remote/frp/vps/uninstall-script", {
					method: "POST",
					body: JSON.stringify(scriptPayload)
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then((data) => {
					const script = typeof data.vpsUninstallScript === "string" ? data.vpsUninstallScript : "";
					if (script === "") throw new Error("empty script");
					return navigator.clipboard.writeText(script);
				}).then(() => {
					vpsDeployStatus.textContent = t("vpsUninstallScriptCopied");
				}, (error) => {
					vpsDeployStatus.textContent = t("vpsUninstallScriptFailed", { error: String(error) });
				}).finally(() => {
					remoteProviderBusy = false;
					loadRemote();
				});
			});
			vpsUninstall.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				const form = vpsEffectiveForm();
				if (!validVpsFrpForm()) {
					vpsDeployStatus.textContent = t("vpsDeployNotReady");
					return;
				}
				const ssh = readVpsSshForm();
				if (ssh === void 0) return;
				remoteProviderBusy = true;
				refreshVpsDeployButton();
				vpsDeployStatus.textContent = t("vpsHostKeyFetching");
				remoteStatus.textContent = t("vpsHostKeyFetching");
				requestVpsHostKeys(form.serverAddress, ssh.sshUser, ssh.sshPort, ssh.sshKeyPath).then((hostKeys) => {
					if (!window.confirm(t("vpsUninstallConfirmWithKeys", { fingerprints: hostKeys.map((key) => key.display).join("\n") }))) {
						remoteProviderBusy = false;
						refreshVpsDeployButton();
						loadRemote();
						return;
					}
					vpsDeployStatus.textContent = t("vpsUninstalling");
					remoteStatus.textContent = t("vpsUninstalling");
					const payload = {
						confirm: true,
						serverAddress: form.serverAddress,
						serverPort: form.serverPort,
						sshUser: ssh.sshUser,
						sshPort: ssh.sshPort,
						hostFingerprints: hostKeys.map((key) => key.fingerprint)
					};
					if (ssh.sshKeyPath !== "") payload.sshKeyPath = ssh.sshKeyPath;
					const certName = vpsCertName(form.publicOrigin);
					if (certName !== void 0) payload.certName = certName;
					return controlRequestJson("/api/mobile-access/remote/frp/vps/uninstall", {
						method: "POST",
						body: JSON.stringify(payload)
					}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then((data) => {
						const removal = data.vpsUninstall !== null && typeof data.vpsUninstall === "object" ? data.vpsUninstall : {};
						vpsDeployStatus.textContent = removal.removed === true ? t("vpsUninstallSuccess") : t("vpsUninstallFailed", { error: t("vpsUninstallFailed", { error: "unknown result" }) });
						remoteStatus.textContent = vpsDeployStatus.textContent;
						renderRemote(data);
					}, (error) => {
						vpsDeployStatus.textContent = t("vpsUninstallFailed", { error: String(error) });
						remoteStatus.textContent = vpsDeployStatus.textContent;
					}).finally(() => {
						remoteProviderBusy = false;
						loadRemote();
					});
				}, (error) => {
					vpsDeployStatus.textContent = t("vpsHostKeyFailed", { error: String(error) });
					remoteStatus.textContent = vpsDeployStatus.textContent;
					remoteProviderBusy = false;
					refreshVpsDeployButton();
					loadRemote();
				});
			});
			frpInstall.addEventListener("click", () => {
				if (remoteProviderBusy) return;
				if (!window.confirm(t("frpInstallConfirm", { size: frpDownloadSize }))) return;
				remoteProviderBusy = true;
				frpInstall.disabled = true;
				frpInstall.textContent = t("downloading");
				remoteStatus.textContent = t("installingFrp");
				controlRequestJson("/api/mobile-access/remote/frp/component/install", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then(renderRemote, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "installFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					loadRemote();
				});
			});
			frpConfigure.addEventListener("click", () => {
				if (remoteProviderBusy || !frpInstalled) return;
				const form = frpForm();
				const unchanged = frpConfigured && form.token === "" && form.serverAddress === configuredFrpServer && form.serverPort === configuredFrpPort && form.publicOrigin === configuredFrpOrigin && form.mode === (frpConfiguredMode === "attach" ? "attach" : "deploy") && form.entryTls === (frpConfiguredEntryTls === "self-signed" ? "self-signed" : "public-ip-cert") && (form.vhostHttpPort ?? configuredFrpVhostPort) === configuredFrpVhostPort && (form.publicPort ?? configuredFrpPublicPort) === configuredFrpPublicPort;
				if (!unchanged) {
					const code = form.mode === "attach" ? frpAttachFormErrorCode(attachClipboardForm(form)) : validFrpForm(form) ? void 0 : "frp_settings_invalid";
					if (code !== void 0) {
						if (form.mode === "attach") showFrpAttachError(code);
						else remoteStatus.textContent = t("frpInputInvalid");
						return;
					}
				}
				remoteProviderBusy = true;
				frpConfigure.disabled = true;
				frpConfigure.setAttribute("aria-busy", "true");
				frpConfigure.textContent = t("saving");
				(unchanged ? Promise.resolve({}) : controlRequestJson("/api/mobile-access/remote/frp/configure", {
					method: "POST",
					body: JSON.stringify(form)
				})).then(() => {
					frpToken.value = "";
					remoteStatus.textContent = t("frpSavingConnecting");
					return controlRequestJson("/api/mobile-access/remote/control", {
						method: "POST",
						body: JSON.stringify({ running: true })
					});
				}).then(renderRemote, (error) => {
					remoteFailureText = t("configureFailed", { error: String(error) });
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					frpConfigure.setAttribute("aria-busy", "false");
					frpConfigure.textContent = t("frpSaveConnect");
					loadRemote();
				});
			});
			frpPurge.addEventListener("click", () => {
				if (remoteProviderBusy || !window.confirm(t(frpConfiguredMode === "attach" && frpConfiguredEntryTls === "self-signed" ? "purgeFrpConfirmSelfSigned" : "purgeFrpConfirm"))) return;
				remoteProviderBusy = true;
				frpPurge.disabled = true;
				remoteStatus.textContent = t("purgingFrp");
				controlRequestJson("/api/mobile-access/remote/frp/component/purge", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then(renderRemote, (error) => {
					remoteFailureText = t("purgeFailed", { error: String(error) });
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteProviderBusy = false;
					frpPurge.disabled = false;
					loadRemote();
				});
			});
			const clearOriginValidation = () => {
				for (const input of [
					originPublic,
					originHost,
					originPort,
					originCidrs
				]) input.removeAttribute("aria-invalid");
			};
			const showOriginFeedback = (message, error = false) => {
				originFeedback.textContent = message;
				originFeedback.hidden = false;
				originFeedback.classList.toggle("is-error", error);
			};
			const showOriginError = (error) => {
				const code = error instanceof Error ? error.message : String(error);
				const key = ORIGIN_ERROR_MESSAGE_KEYS[code];
				const fields = {
					origin_public_origin_invalid: originPublic,
					origin_listen_host_invalid: originHost,
					origin_listen_address_unavailable: originHost,
					origin_listen_port_invalid: originPort,
					origin_listen_port_reserved: originPort,
					origin_listen_port_in_use: originPort,
					origin_allowed_cidrs_invalid: originCidrs
				};
				clearOriginValidation();
				fields[code]?.setAttribute("aria-invalid", "true");
				showOriginFeedback(key === void 0 ? t("configureFailed", { error: String(error) }) : t(key), true);
			};
			const setOriginFormBusy = (busy) => {
				originFormBusy = busy;
				remoteProviderBusy = busy;
				remoteSnapshotEpoch += 1;
				renderRemote(latestRemoteState);
			};
			for (const input of [
				originPublic,
				originHost,
				originPort,
				originCidrs
			]) input.addEventListener("input", () => {
				originFormDirty = true;
				clearOriginValidation();
				originFeedback.hidden = true;
			});
			const syncCaddyModeVisibility = () => {
				caddyModeManagedSelected = caddyModeManaged.checked;
				caddyModePreviewDirty = true;
				renderRemote(latestRemoteState);
			};
			caddyModeManaged.addEventListener("change", () => {
				if (remoteProviderBusy) return;
				originFeedback.hidden = true;
				syncCaddyModeVisibility();
			});
			caddyModeExternal.addEventListener("change", () => {
				if (remoteProviderBusy) return;
				if (latestRemoteState.originMode === "managed" && !window.confirm(t("caddyModeChangeConfirm"))) {
					caddyModeManaged.checked = true;
					caddyModeExternal.checked = false;
					return;
				}
				originFeedback.hidden = true;
				syncCaddyModeVisibility();
				if (latestRemoteState.originMode !== "managed") return;
				setCaddyFormBusy(true);
				controlRequestJson("/api/mobile-access/remote/origin/mode", {
					method: "POST",
					body: JSON.stringify({ mode: "external" })
				}).then((data) => {
					caddyModePreviewDirty = false;
					renderRemote(data);
				}, () => {
					caddyModePreviewDirty = false;
					renderRemote(latestRemoteState);
					showOriginFeedback(t("caddyConnectionFailed"), true);
				}).finally(() => {
					setCaddyFormBusy(false);
					loadRemote();
				});
			});
			for (const input of [
				caddyDomain,
				caddyProvider,
				caddySecretId,
				caddySecretKey,
				caddyPort
			]) input.addEventListener("input", () => {
				caddyFormDirty = true;
			});
			caddyProvider.addEventListener("change", () => {
				caddyFormDirty = true;
			});
			caddyInstall.addEventListener("click", () => {
				if (remoteProviderBusy || caddyInstall.disabled || !window.confirm(t("caddyInstallConfirm"))) return;
				setCaddyFormBusy(true);
				showCaddyFeedback(t("checkingComponent"));
				controlRequestJson("/api/mobile-access/remote/caddy/component/install", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}).then((data) => {
					renderRemote(data);
					showCaddyFeedback(t("caddyInstalled"));
				}, () => showCaddyFeedback(t("caddyInstallFailed"), true)).finally(() => {
					setCaddyFormBusy(false);
					loadRemote();
				});
			});
			caddySave.addEventListener("click", () => {
				if (remoteProviderBusy || caddySave.disabled || !caddyModeManagedSelected) return;
				clearOriginValidation();
				for (const input of [
					caddyDomain,
					caddySecretId,
					caddySecretKey,
					caddyPort
				]) if (!input.reportValidity()) return;
				const body = {
					settings: {
						version: 1,
						publicOrigin: caddyDomain.value.trim(),
						dnsProvider: caddyProvider.value,
						listenPort: Number(caddyPort.value)
					},
					secretId: caddySecretId.value.trim(),
					secretKey: caddySecretKey.value.trim(),
					connect: true
				};
				setCaddyFormBusy(true);
				showCaddyFeedback(t("saving"));
				controlRequestJson("/api/mobile-access/remote/caddy/settings", {
					method: "POST",
					body: JSON.stringify(body)
				}).then((data) => {
					caddySecretId.value = "";
					caddySecretKey.value = "";
					caddyFormDirty = false;
					caddyModePreviewDirty = false;
					renderRemote(data);
					if (data.state === "error") showCaddyFeedback(t("caddyConnectionFailed"), true);
				}, () => showCaddyFeedback(t("caddyConnectionFailed"), true)).finally(() => {
					setCaddyFormBusy(false);
					loadRemote();
				});
			});
			caddyPurgeButton.addEventListener("click", () => {
				if (remoteProviderBusy || !window.confirm(t("caddyPurgeConfirm"))) return;
				setCaddyFormBusy(true);
				controlRequestJson("/api/mobile-access/remote/caddy/component/purge", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}).then((data) => {
					caddySecretId.value = "";
					caddySecretKey.value = "";
					caddyFormDirty = false;
					caddyModePreviewDirty = false;
					renderRemote(data);
				}, () => showCaddyFeedback(t("caddyPurgeFailed"), true)).finally(() => {
					setCaddyFormBusy(false);
					loadRemote();
				});
			});
			originConfigure.addEventListener("click", () => {
				if (remoteProviderBusy || remoteProvider !== "origin") return;
				clearOriginValidation();
				for (const input of [
					originPublic,
					originHost,
					originPort,
					originCidrs
				]) if (!input.reportValidity()) return;
				const form = {
					publicOrigin: originPublic.value.trim(),
					listenHost: originHost.value.trim(),
					listenPort: Number(originPort.value),
					allowedCidrs: originCidrs.value.trim().split(/[\s,]+/u).filter(Boolean)
				};
				setOriginFormBusy(true);
				showOriginFeedback(t("originSaving"));
				controlRequestJson("/api/mobile-access/remote/origin/configure", {
					method: "POST",
					body: JSON.stringify(form)
				}).then(() => controlRequestJson("/api/mobile-access/remote/origin/mode", {
					method: "POST",
					body: JSON.stringify({ mode: "external" })
				})).then(() => controlRequestJson("/api/mobile-access/remote/control", {
					method: "POST",
					body: JSON.stringify({ running: true })
				})).then((data) => {
					originFormDirty = false;
					renderRemote(data);
					if (data.state === "error") showOriginError(new Error(typeof data.errorCode === "string" ? data.errorCode : "origin_gateway_start_failed"));
					else originFeedback.hidden = true;
				}, showOriginError).finally(() => {
					setOriginFormBusy(false);
					[
						originPublic,
						originHost,
						originPort,
						originCidrs
					].find((input) => input.getAttribute("aria-invalid") === "true")?.focus();
					loadRemote();
				});
			});
			originPurge.addEventListener("click", () => {
				if (remoteProviderBusy || !window.confirm(t("originPurgeConfirm"))) return;
				setOriginFormBusy(true);
				showOriginFeedback(t("originPurging"));
				controlRequestJson("/api/mobile-access/remote/origin/purge", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}).then((data) => {
					originFormDirty = false;
					clearOriginValidation();
					renderRemote(data);
					showOriginFeedback(t("originPurged"));
				}, showOriginError).finally(() => {
					setOriginFormBusy(false);
					loadRemote();
				});
			});
			originCopyBackend.addEventListener("click", () => {
				const address = originBackendAddress.textContent ?? "";
				if (address === "" || remoteProviderBusy) return;
				Promise.resolve().then(() => navigator.clipboard.writeText(address)).then(() => {
					showOriginFeedback(t("originBackendCopied"));
				}, (error) => {
					showOriginFeedback(t("requestFailed", { error: String(error) }), true);
				});
			});
			remoteToggle.addEventListener("click", () => {
				remoteToggle.disabled = true;
				controlRequestJson("/api/mobile-access/remote/control", {
					method: "POST",
					body: JSON.stringify({ running: !remoteRunning })
				}).then(renderRemote, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "requestFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(loadRemote);
			});
			remoteLogin.addEventListener("click", () => {
				if (remoteLoginUrl !== "") window.open(remoteLoginUrl, "_blank", "noopener,noreferrer");
			});
			const reconnectRemote = () => {
				if (remoteReconnectBusy) return;
				remoteReconnectBusy = true;
				remoteReconnect.disabled = true;
				remoteSetup.disabled = true;
				remoteSetupRetry.disabled = true;
				remoteStatus.textContent = remoteProvider === "cpolar" ? t("reconnectingCpolar") : remoteProvider === "cloudflared" ? t("reconnectingCloudflared") : remoteProvider === "frp" ? t("reconnectingFrp") : remoteProvider === "origin" ? t("reconnectingOrigin") : t("reconnectingTailscale");
				controlRequestJson("/api/mobile-access/remote/reconnect", {
					method: "POST",
					body: "{}"
				}).then(renderRemote, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "requestFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteReconnectBusy = false;
					remoteReconnect.disabled = false;
					remoteSetup.disabled = remoteSetupUrl === "";
					remoteSetupRetry.disabled = false;
				});
			};
			remoteReconnect.addEventListener("click", reconnectRemote);
			remoteSetupRetry.addEventListener("click", () => {
				remoteSetupPending = false;
				reconnectRemote();
			});
			remoteSetup.addEventListener("click", () => {
				if (remoteSetupUrl === "") return;
				remoteSetupPending = true;
				remoteSetupOpenedAt = Date.now();
				remoteStatus.textContent = t("setupOpened");
				window.open(remoteSetupUrl, "_blank", "noopener,noreferrer");
			});
			const retryAfterSetup = () => {
				if (!remoteSetupPending || document.visibilityState === "hidden" || Date.now() - remoteSetupOpenedAt < 800) return;
				remoteSetupPending = false;
				reconnectRemote();
			};
			window.addEventListener("focus", retryAfterSetup);
			document.addEventListener("visibilitychange", retryAfterSetup);
			const copyRemotePairUrl = async () => {
				try {
					await navigator.clipboard.writeText(activeRemotePairUrl);
					remoteStatus.textContent = t("linkCopied");
				} catch {
					remoteStatus.textContent = t("remoteQrReady");
				}
			};
			const openRemotePairing = () => controlRequestJson("/api/mobile-access/remote/pairing/open", {
				method: "POST",
				body: "{}"
			}).then(async (data) => {
				const pairUrl = typeof data.pairUrl === "string" ? data.pairUrl : "";
				const expiresAt = typeof data.expiresAt === "number" && Number.isFinite(data.expiresAt) ? data.expiresAt : 0;
				showQr(typeof data.qrSvg === "string" ? data.qrSvg : "", remoteQr);
				if (pairUrl === "") {
					remoteStatus.textContent = t("keyGenerationFailed");
					return;
				}
				activeRemotePairUrl = pairUrl;
				activeRemotePairExpiresAt = expiresAt;
				remotePairLink.textContent = pairUrl;
				remotePairLink.classList.add("is-key");
				remotePairLink.hidden = false;
				await copyRemotePairUrl();
			});
			remotePair.addEventListener("click", () => {
				remotePair.disabled = true;
				openRemotePairing().catch((error) => {
					remoteFailureText = remoteFailureTextFor(error, "requestFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remotePair.disabled = !remoteReady;
				});
			});
			remoteCopyLink.addEventListener("click", () => {
				remoteCopyLink.disabled = true;
				(activeRemotePairUrl !== "" && activeRemotePairExpiresAt > Date.now() ? copyRemotePairUrl() : openRemotePairing()).catch((error) => {
					remoteFailureText = remoteFailureTextFor(error, "requestFailed");
					remoteStatus.textContent = remoteFailureText;
				}).finally(() => {
					remoteCopyLink.disabled = !remoteReady;
				});
			});
			const renderRemoteDevices = (data) => {
				const devices = Array.isArray(data.devices) ? data.devices : [];
				remoteDevicePanel.replaceChildren();
				if (devices.length === 0) {
					const empty = element("p", "dsh-mobile-control__device-empty");
					empty.textContent = t("noRemoteDevices");
					remoteDevicePanel.append(empty);
					return;
				}
				for (const device of devices) {
					const row = element("div", "dsh-mobile-control__device");
					const label = element("span", "dsh-mobile-control__device-label");
					label.textContent = typeof device.label === "string" ? device.label : t("device");
					const meta = element("span", "dsh-mobile-control__device-meta");
					meta.textContent = t("expires", { time: formatTime(device.expiresAt) });
					const revoke = element("button", "dsh-mobile-control__device-revoke");
					revoke.type = "button";
					revoke.textContent = t("revoke");
					const id = typeof device.id === "string" ? device.id : "";
					revoke.addEventListener("click", () => {
						controlRequestJson("/api/mobile-access/remote/devices/revoke", {
							method: "POST",
							body: JSON.stringify({ deviceId: id })
						}).then(loadRemoteDevices, (error) => {
							remoteFailureText = remoteFailureTextFor(error, "requestFailed");
							remoteStatus.textContent = remoteFailureText;
						});
					});
					row.append(label, meta, revoke);
					remoteDevicePanel.append(row);
				}
			};
			const loadRemoteDevices = () => {
				controlRequestJson("/api/mobile-access/remote/devices").then(renderRemoteDevices, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "requestFailed");
					remoteStatus.textContent = remoteFailureText;
				});
			};
			remoteDevices.addEventListener("click", () => {
				const show = remoteDevicePanel.hidden;
				remoteDevicePanel.hidden = !show;
				if (show) loadRemoteDevices();
			});
			remoteReset.addEventListener("click", () => {
				const prompt = remoteProvider === "cpolar" ? t("resetCpolarConfirm") : remoteProvider === "cloudflared" ? t("resetCloudflaredConfirm") : remoteProvider === "frp" ? t("resetFrpConfirm") : remoteProvider === "origin" ? t("resetOriginConfirm") : t("resetTailscaleConfirm");
				if (!window.confirm(prompt)) return;
				controlRequestJson("/api/mobile-access/remote/reset", {
					method: "POST",
					body: JSON.stringify({ confirm: true })
				}).then(renderRemote, (error) => {
					remoteFailureText = remoteFailureTextFor(error, "requestFailed");
					remoteStatus.textContent = remoteFailureText;
				});
			});
			const renderDiagnostics = (data) => {
				const entries = [...diagnosticEntriesForRender(data)];
				const overall = diagnosticOverallForChecks(data.overall, entries.map((entry) => entry.status));
				diagnosticsSummary.className = `dsh-mobile-control__diagnostic-summary is-${overall}`;
				diagnosticsSummaryTitle.textContent = overall === "ok" ? t("diagnosticsComplete") : overall === "attention" ? t("diagnosticsAttention") : t("diagnosticsProblem");
				diagnosticsSummaryText.textContent = locale === "zh" && data.overall === overall && typeof data.summary === "string" ? data.summary : t("diagnosticsCompleteFallback");
				diagnosticsChecks.replaceChildren();
				const statusLabels = {
					ok: t("diagnosticStatusOk"),
					warning: t("diagnosticStatusWarning"),
					error: t("diagnosticStatusError"),
					info: t("diagnosticStatusInfo")
				};
				const diagnosticLabelKeys = {
					versions: "diagnosticLabelVersions",
					network: "diagnosticLabelNetwork",
					lan: "diagnosticLabelLan",
					firewall: "diagnosticLabelFirewall",
					remote: "diagnosticLabelRemote",
					"phone-network": "diagnosticLabelPhone"
				};
				const statusOf = (entry) => normalizeDiagnosticStatus(entry.status);
				const localizedEntryCopy = (entry) => {
					const serverCopy = diagnosticServerCopy(entry);
					const reason = typeof entry.reason === "string" ? entry.reason : "";
					const facts = entry.facts !== null && typeof entry.facts === "object" ? entry.facts : {};
					const copyReason = facts.viaProxy === true && (reason === "remote-ready" || reason === "remote-rate-limited") ? `${reason}-via-proxy` : reason;
					const templates = DIAGNOSTIC_REASON_MESSAGES[locale][copyReason];
					if (templates === void 0) return serverCopy;
					const providerNames = {
						tailscale: "Tailscale Funnel",
						cpolar: "cpolar",
						cloudflared: "cloudflared",
						frp: t("frpName"),
						origin: t("originName")
					};
					const providerId = typeof facts.provider === "string" ? facts.provider : "";
					const controllerKey = typeof facts.controllerCode === "string" ? REMOTE_ERROR_MESSAGE_KEYS[facts.controllerCode] : void 0;
					const values = {
						provider: providerNames[providerId] ?? "",
						latencyMs: typeof facts.latencyMs === "number" && Number.isFinite(facts.latencyMs) ? new Intl.NumberFormat(localeTag).format(facts.latencyMs) : "",
						interfaceName: typeof facts.interfaceName === "string" ? facts.interfaceName : "",
						endpointSuffix: typeof facts.endpointSuffix === "string" ? facts.endpointSuffix : "",
						controllerCode: controllerKey === void 0 ? "" : t(controllerKey)
					};
					const interpolate = (template) => template.replace(/\{(\w+)\}/gu, (_match, key) => values[key] ?? "");
					let detail = interpolate(templates[0]);
					let action = interpolate(templates[1]);
					if (reason === "versions-current") {
						const versions = data.versions !== null && typeof data.versions === "object" ? data.versions : {};
						if ([
							versions.plugin,
							versions.dsh,
							versions.minimumAndroidApp
						].every((value) => typeof value === "string")) detail += ` plugin ${String(versions.plugin)}, DSH ${String(versions.dsh)}, Android ${String(versions.minimumAndroidApp)}.`;
					}
					if (reason === "remote-controller-error") action = diagnosticControllerAction(facts.controllerCode, locale, action);
					return {
						detail,
						action
					};
				};
				const appendGroup = (label, groupEntries) => {
					if (groupEntries.length === 0) return;
					const group = element("section", "dsh-mobile-control__diagnostic-group");
					const groupHeader = element("header", "dsh-mobile-control__diagnostic-group-header");
					const groupTitle = element("h3");
					groupTitle.textContent = label;
					const groupCount = element("span");
					groupCount.textContent = t("diagnosticItems", { count: groupEntries.length });
					const list = element("div", "dsh-mobile-control__diagnostic-list");
					list.setAttribute("role", "list");
					groupHeader.append(groupTitle, groupCount);
					for (const entry of groupEntries) {
						const state = statusOf(entry);
						const row = element("section", `dsh-mobile-control__diagnostic-check is-${state}`);
						row.setAttribute("role", "listitem");
						const marker = element("span", "dsh-mobile-control__diagnostic-marker");
						marker.setAttribute("aria-hidden", "true");
						const rowBody = element("div", "dsh-mobile-control__diagnostic-check-body");
						const rowHeader = element("div", "dsh-mobile-control__diagnostic-check-header");
						const labelKey = typeof entry.id === "string" ? diagnosticLabelKeys[entry.id] : void 0;
						const rowTitle = element("strong");
						rowTitle.textContent = locale !== "zh" && labelKey !== void 0 ? t(labelKey) : typeof entry.label === "string" ? entry.label : t("diagnosticCheck");
						const badge = element("span", "dsh-mobile-control__diagnostic-badge");
						badge.textContent = statusLabels[state];
						const localizedCopy = localizedEntryCopy(entry);
						const detail = element("p");
						detail.textContent = localizedCopy.detail;
						rowHeader.append(rowTitle, badge);
						rowBody.append(rowHeader, detail);
						if (localizedCopy.action !== "") {
							const action = element("p", "dsh-mobile-control__diagnostic-action");
							const actionLabel = element("span");
							actionLabel.textContent = t("diagnosticAction");
							action.append(actionLabel, document.createTextNode(localizedCopy.action));
							rowBody.append(action);
						}
						row.append(marker, rowBody);
						list.append(row);
					}
					group.append(groupHeader, list);
					diagnosticsChecks.append(group);
				};
				const issues = entries.filter((entry) => statusOf(entry) === "error" || statusOf(entry) === "warning");
				const otherChecks = entries.filter((entry) => statusOf(entry) !== "error" && statusOf(entry) !== "warning");
				appendGroup(t("diagnosticNeedsAction"), issues);
				appendGroup(issues.length === 0 ? t("diagnosticDetails") : t("diagnosticOther"), otherChecks);
				diagnosticsSummaryMeta.textContent = issues.length === 0 ? t("diagnosticNoBlockers", { count: entries.length }) : t("diagnosticNeedsCount", {
					count: entries.length,
					issues: issues.length
				});
				diagnosticsChecks.hidden = entries.length === 0;
				const reportCopy = LOCALIZED_DIAGNOSTIC_COPY[locale];
				const generatedAt = typeof data.generatedAt === "number" ? new Date(data.generatedAt).toLocaleString(localeTag) : (/* @__PURE__ */ new Date()).toLocaleString(localeTag);
				const lines = entries.map((entry) => {
					const state = statusOf(entry);
					const labelKey = typeof entry.id === "string" ? diagnosticLabelKeys[entry.id] : void 0;
					const label = labelKey === void 0 && typeof entry.label === "string" ? entry.label : labelKey === void 0 ? t("diagnosticCheck") : t(labelKey);
					const localizedCopy = localizedEntryCopy(entry);
					return `[${statusLabels[state]}] ${label}: ${localizedCopy.detail}${localizedCopy.action === "" ? "" : ` ${localizedCopy.action}`}`;
				});
				copiedDiagnosticReport = [
					reportCopy.reportTitle,
					`${reportCopy.generated}: ${generatedAt}`,
					...lines
				].join("\n");
				diagnosticsReport.textContent = copiedDiagnosticReport;
				diagnosticsDetails.hidden = copiedDiagnosticReport === "";
				diagnosticsCopy.disabled = copiedDiagnosticReport === "";
				diagnosticsCopy.hidden = copiedDiagnosticReport === "";
				diagnosticsToolbar.classList.toggle("has-report", copiedDiagnosticReport !== "");
			};
			const showDiagnosticsFailure = (error) => {
				diagnosticsSummary.className = "dsh-mobile-control__diagnostic-summary is-error";
				diagnosticsSummaryTitle.textContent = t("diagnosticsIncomplete");
				diagnosticsSummaryText.textContent = t("diagnosticsReadFailed", { error: String(error) });
				diagnosticsSummaryMeta.textContent = t("diagnosticsUnavailable");
				diagnosticsChecks.replaceChildren();
				diagnosticsChecks.hidden = true;
				copiedDiagnosticReport = "";
				diagnosticsReport.textContent = "";
				diagnosticsDetails.hidden = true;
				diagnosticsCopy.disabled = true;
				diagnosticsCopy.hidden = true;
				diagnosticsToolbar.classList.remove("has-report");
			};
			const loadDiagnostics = () => {
				if (diagnosticsBusy) return;
				diagnosticsBusy = true;
				diagnosticsRun.disabled = true;
				diagnosticsRun.setAttribute("aria-busy", "true");
				diagnosticsRun.textContent = t("diagnosticsChecking");
				diagnosticsSummary.className = "dsh-mobile-control__diagnostic-summary is-running";
				diagnosticsSummaryTitle.textContent = t("diagnosticsCheckingTitle");
				diagnosticsSummaryText.textContent = t("diagnosticsCheckingText");
				diagnosticsSummaryMeta.textContent = t("diagnosticsRunningMeta");
				diagnosticsFeedback.hidden = true;
				diagnosticsChecks.classList.add("is-refreshing");
				diagnosticsChecks.setAttribute("aria-busy", "true");
				controlRequestJson("/api/mobile-access/diagnostics").then((data) => {
					renderDiagnosticPayloadSafely(data, renderDiagnostics, showDiagnosticsFailure);
				}, showDiagnosticsFailure).finally(() => {
					diagnosticsBusy = false;
					diagnosticsRun.disabled = false;
					diagnosticsRun.setAttribute("aria-busy", "false");
					diagnosticsRun.textContent = t("diagnosticsRetry");
					diagnosticsChecks.classList.remove("is-refreshing");
					diagnosticsChecks.setAttribute("aria-busy", "false");
				});
			};
			diagnosticsEntry.addEventListener("click", () => {
				if (!diagnosticsView.hidden) {
					selectView(previousAccessView);
					return;
				}
				selectView("diagnostics");
				loadDiagnostics();
			});
			diagnosticsRun.addEventListener("click", loadDiagnostics);
			diagnosticsRun.addEventListener("click", () => {
				extensionRecovery.refresh();
			});
			const closeUpdateCard = () => {
				updateCard.hidden = true;
				if (pluginUpdateAvailable && pluginLatestVersion !== "") updatePlugin.hidden = !diagnosticsView.hidden;
			};
			const runPluginUpdate = () => {
				if (!pluginUpdateAvailable || pluginLatestVersion === "" || updateInFlight) return;
				updateInFlight = true;
				updateNow.disabled = true;
				updateLater.disabled = true;
				updateCardTitle.textContent = t("updatingPlugin");
				releaseNotice.hidden = true;
				releaseNotice.classList.remove("is-error");
				controlRequestJson("/api/mobile-access/release/update", {
					method: "POST",
					body: "{}"
				}, LONG_CONTROL_REQUEST_TIMEOUT_MS).then((data) => {
					const installedVersion = releaseVersion(data.installedVersion) ?? pluginLatestVersion;
					pluginUpdateAvailable = false;
					updateCard.hidden = true;
					updatePlugin.hidden = true;
					releaseNotice.textContent = t("pluginUpdatedRestart", { version: installedVersion });
					releaseNotice.hidden = false;
				}, (error) => {
					updateCard.hidden = true;
					updatePlugin.hidden = false;
					releaseNotice.textContent = t("pluginUpdateFailed", { error: String(error) });
					releaseNotice.classList.add("is-error");
					releaseNotice.hidden = false;
				}).finally(() => {
					updateInFlight = false;
					updateNow.disabled = false;
					updateLater.disabled = false;
				});
			};
			updatePlugin.addEventListener("click", () => {
				if (!pluginUpdateAvailable || pluginLatestVersion === "" || updateInFlight) return;
				updatePlugin.hidden = true;
				updateCardTitle.textContent = t("updateTo", { version: pluginLatestVersion });
				updateCardNotes.textContent = pluginReleaseNotes === "" ? t("updateNotesEmpty") : pluginReleaseNotes;
				updateCardNotes.hidden = pluginReleaseNotes === "";
				updateCard.hidden = false;
			});
			updateNow.addEventListener("click", runPluginUpdate);
			updateLater.addEventListener("click", closeUpdateCard);
			diagnosticsCopy.addEventListener("click", () => {
				if (copiedDiagnosticReport === "") return;
				navigator.clipboard.writeText(copiedDiagnosticReport).then(() => {
					diagnosticsFeedback.textContent = t("diagnosticsCopied");
					diagnosticsFeedback.hidden = false;
				}, () => {
					diagnosticsDetails.open = true;
					diagnosticsFeedback.textContent = t("diagnosticsCopyManual");
					diagnosticsFeedback.hidden = false;
				});
			});
			pair.addEventListener("click", () => {
				pair.disabled = true;
				openPairing("key");
			});
			linkPair.addEventListener("click", () => {
				linkPair.disabled = true;
				openPairing("link");
			});
			close.addEventListener("click", () => {
				setOpen(false);
			});
			const dismiss = (event) => {
				if (panel.hidden || !(event.target instanceof Node)) return;
				if (!providerInfo.contains(event.target)) {
					providerInfoPinned = false;
					providerInfoHovered = false;
					syncProviderInfo();
				}
				if (!panel.contains(event.target) && !document.querySelector(".dsh-mobile-control__trigger")?.contains(event.target)) setOpen(false);
			};
			document.addEventListener("pointerdown", dismiss);
			controlRequestJson("/api/mobile-access/release").then(renderRelease, () => {});
			controlRequestJson("/api/mobile-access/lan/control").then(render, (error) => {
				status.textContent = t("requestFailed", { error: String(error) });
			});
			loadRemote();
			const remotePoll = window.setInterval(() => {
				if (!panel.hidden && !remoteView.hidden) loadRemote();
			}, 1500);
			const pollWsBlocked = () => {
				controlRequestJson("/api/mobile-access/remote/websocket-paths/blocked").then((blocked) => {
					wsPathsBlocked = (Array.isArray(blocked.blocked) ? blocked.blocked : []).filter((entry) => typeof entry === "object" && entry !== null && typeof entry.path === "string" && typeof entry.attempts === "number");
					renderWsDot();
					if (!diagnosticsView.hidden) renderWsBlocked(wsPathsBlocked);
				}, () => {});
			};
			const wsBlockedPoll = window.setInterval(() => {
				pollWsBlocked();
				if (!panel.hidden) extensionRecovery.refresh();
			}, 2e4);
			return {
				remove: () => {
					lifecycle.abort();
					extensionRecovery.dispose();
					window.clearInterval(remotePoll);
					window.clearInterval(wsBlockedPoll);
					window.removeEventListener("focus", retryAfterSetup);
					document.removeEventListener("visibilitychange", retryAfterSetup);
					document.removeEventListener("pointerdown", dismiss);
					root.remove();
				},
				toggle: () => {
					setOpen(panel.hidden !== false);
				},
				isOpen: () => !panel.hidden
			};
		}
		function mobileRequest(path, init = {}) {
			const target = new URL(path, location.href);
			if (target.origin !== location.origin) throw new TypeError("mobile extension requests must stay on the DSH origin");
			const headers = new Headers(init.headers);
			const method = (init.method ?? "GET").toUpperCase();
			if (method !== "GET" && method !== "HEAD") {
				const csrf = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("dsh_ma_csrf="))?.slice(12);
				if (csrf !== void 0) headers.set("x-dsh-mobile-csrf", csrf);
			}
			return fetch(target, {
				...init,
				headers,
				credentials: "same-origin",
				cache: "no-store",
				redirect: "error"
			});
		}
		/** Combine extension and caller abort lifetimes and expose deterministic listener cleanup. */
		function combineClientSignalLifetime(first, second) {
			if (first.aborted || second.aborted) {
				const aborted = new AbortController();
				aborted.abort(first.aborted ? first.reason : second.reason);
				return {
					signal: aborted.signal,
					cleanup: () => void 0
				};
			}
			const controller = new AbortController();
			const cleanup = () => {
				first.removeEventListener("abort", abortFirst);
				second.removeEventListener("abort", abortSecond);
			};
			const abortFirst = () => {
				cleanup();
				controller.abort(first.reason);
			};
			const abortSecond = () => {
				cleanup();
				controller.abort(second.reason);
			};
			first.addEventListener("abort", abortFirst, { once: true });
			second.addEventListener("abort", abortSecond, { once: true });
			return {
				signal: controller.signal,
				cleanup
			};
		}
		/** Combine extension and caller abort lifetimes on WebViews without AbortSignal.any. */
		function combineClientSignals(first, second) {
			return combineClientSignalLifetime(first, second).signal;
		}
		/** Keep a combined request lifetime until a streamed response is consumed or cancelled. */
		function bindClientResponseLifetime(response, cleanup) {
			if (response.body === null) {
				cleanup();
				return response;
			}
			const reader = response.body.getReader();
			let released = false;
			const release = () => {
				if (released) return;
				released = true;
				cleanup();
			};
			const body = new ReadableStream({
				async pull(controller) {
					try {
						const result = await reader.read();
						if (result.done) {
							release();
							controller.close();
						} else controller.enqueue(result.value);
					} catch (error) {
						release();
						controller.error(error);
					}
				},
				async cancel(reason) {
					try {
						await reader.cancel(reason);
					} finally {
						release();
					}
				}
			});
			try {
				const retained = new Response(body, {
					headers: response.headers,
					status: response.status,
					statusText: response.statusText
				});
				Object.defineProperties(retained, {
					redirected: {
						configurable: true,
						value: response.redirected
					},
					type: {
						configurable: true,
						value: response.type
					},
					url: {
						configurable: true,
						value: response.url
					}
				});
				return retained;
			} catch (error) {
				reader.cancel(error);
				release();
				throw error;
			}
		}
		/** Dispose an old UI when its replacement Host generation cannot be activated. */
		function failClosedExtensionGenerationReplacement(hasActive, activeGeneration, replacementGeneration, dispose) {
			if (!hasActive || activeGeneration === replacementGeneration) return false;
			dispose();
			return true;
		}
		/** Resolve one SDK route and prove its normalized path remains in the current extension namespace. */
		function extensionRouteUrl(id, path, baseUrl) {
			const rawPathname = path.split(/[?#]/u, 1)[0] ?? "";
			if (!/^[a-z][a-z0-9-]{0,63}$/u.test(id) || !path.startsWith("/") || path.startsWith("//") || rawPathname.includes("\\") || rawPathname.includes("\0") || /%(?:2f|5c)/iu.test(rawPathname)) throw new TypeError("extension routes must be relative");
			const origin = new URL(baseUrl).origin;
			const prefix = `/mobile-access/extensions/${id}/routes`;
			let target;
			try {
				target = new URL(`${prefix}${path}`, origin);
			} catch {
				throw new TypeError("extension routes must be relative");
			}
			let decodedPathname;
			try {
				decodedPathname = decodeURIComponent(target.pathname);
			} catch {
				throw new TypeError("extension routes must be relative");
			}
			if (target.origin !== origin || target.hash !== "" || decodedPathname.includes("\\") || decodedPathname !== prefix && !decodedPathname.startsWith(`${prefix}/`)) throw new TypeError("extension routes must be relative");
			if (decodedPathname.slice(prefix.length).split("/").some((part) => part === "." || part === "..")) throw new TypeError("extension routes must be relative");
			return target;
		}
		/** Resolve one generation-pinned static asset URL in the current extension namespace. */
		function extensionAssetUrl(id, generation, path, baseUrl) {
			if (!/^[a-z][a-z0-9-]{0,63}$/u.test(id) || generation !== void 0 && !/^[a-f\d]{64}$/u.test(generation)) throw new TypeError("extension asset path is invalid");
			const normalized = path.replaceAll("\\", "/");
			if (normalized.length === 0 || normalized.startsWith("/") || normalized.split("/").some((part) => part === "" || part === "." || part === "..")) throw new TypeError("extension asset path is invalid");
			const target = new URL(`/mobile-access/extensions/${id}/assets/${normalized.split("/").map(encodeURIComponent).join("/")}`, new URL(baseUrl).origin);
			if (generation !== void 0) target.searchParams.set("generation", generation);
			return target;
		}
		/** Add the immutable Host generation selected for one activated mobile UI. */
		function extensionGenerationHeaders(generation, headers) {
			const result = new Headers(headers);
			if (generation !== void 0) result.set("x-dsh-mobile-extension-generation", generation);
			return result;
		}
		/** Build the JSON request used by a mobile extension to invoke a Host action. */
		function extensionActionRequestInit(generation, input, signal) {
			return {
				method: "POST",
				headers: extensionGenerationHeaders(generation, { "content-type": "application/json" }),
				body: JSON.stringify(input ?? {}),
				signal
			};
		}
		function registerUniqueDisposable(entries, claimedIds, id, mount) {
			if (claimedIds.has(id)) throw new Error(`duplicate lifecycle id: ${id}`);
			claimedIds.add(id);
			let mounted;
			try {
				mounted = mount();
			} catch (error) {
				claimedIds.delete(id);
				throw error;
			}
			let disposed = false;
			const dispose = () => {
				if (disposed) return;
				disposed = true;
				mounted.dispose();
			};
			const entry = {
				...mounted,
				dispose
			};
			entries.set(id, entry);
			return () => {
				if (entries.get(id) === entry) {
					entries.delete(id);
					claimedIds.delete(id);
				}
				dispose();
			};
		}
		/** Dispose resources omitted by a successfully fetched authoritative manifest. */
		function reconcileRemovedExtensions(currentIds, seen, dispose) {
			for (const id of new Set(currentIds)) if (!seen.has(id)) dispose(id);
		}
		/** Reconcile managed resources against one validated authoritative id set. */
		function publishAuthoritativeExtensionIds(authoritativeIds, seen, managedIdSources, dispose) {
			const current = new Set(authoritativeIds);
			for (const source of managedIdSources) for (const id of source) current.add(id);
			reconcileRemovedExtensions(current, seen, dispose);
			authoritativeIds.clear();
			for (const id of seen) authoritativeIds.add(id);
		}
		function validManifestResourceUrl(value) {
			return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("://") && !value.split("/").some((part) => part === ".." || part === ".");
		}
		/** Validate the manifest before treating it as authoritative state. */
		function parseMobileExtensionManifest(payload) {
			if (typeof payload !== "object" || payload === null) return void 0;
			const candidate = payload;
			if (candidate.protocol !== 1 || !Array.isArray(candidate.extensions) || typeof candidate.legacy !== "object" || candidate.legacy === null) return void 0;
			const legacy = candidate.legacy;
			if (typeof legacy.scriptRevision !== "string" || typeof legacy.styleRevision !== "string") return void 0;
			const ids = /* @__PURE__ */ new Set();
			const extensions = [];
			for (const value of candidate.extensions) {
				if (typeof value !== "object" || value === null) return void 0;
				const entry = value;
				if (typeof entry.id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(entry.id) || ids.has(entry.id)) return void 0;
				if (entry.generation !== void 0 && (typeof entry.generation !== "string" || !/^[a-f\d]{64}$/u.test(entry.generation))) return void 0;
				if (entry.scriptUrl !== void 0 && !validManifestResourceUrl(entry.scriptUrl)) return void 0;
				if (entry.styleUrl !== void 0 && !validManifestResourceUrl(entry.styleUrl)) return void 0;
				if (entry.assetsUrl !== void 0 && !validManifestResourceUrl(entry.assetsUrl)) return void 0;
				ids.add(entry.id);
				extensions.push({
					id: entry.id,
					...entry.generation === void 0 ? {} : { generation: entry.generation },
					...entry.scriptUrl === void 0 ? {} : { scriptUrl: entry.scriptUrl },
					...entry.styleUrl === void 0 ? {} : { styleUrl: entry.styleUrl },
					...entry.assetsUrl === void 0 ? {} : { assetsUrl: entry.assetsUrl }
				});
			}
			return {
				extensions,
				legacy: {
					scriptRevision: legacy.scriptRevision,
					styleRevision: legacy.styleRevision
				}
			};
		}
		/** A missing manifest is authoritative before optional legacy resources finish refreshing. */
		async function handleMissingExtensionManifest(clearManifestResources, refreshLegacyResources, signal) {
			clearManifestResources();
			const results = await refreshLegacyResources();
			return !signal.aborted && results.every(Boolean);
		}
		function refreshAborted(signal) {
			return signal.aborted;
		}
		/** Run one coalesced refresh cycle, slowing down when the page is hidden. */
		function startLifecycleRefreshScheduler(refresh, options = {}, runtime = {
			document,
			window
		}) {
			const visibleIntervalMs = options.visibleIntervalMs ?? 45e3;
			const hiddenIntervalMs = options.hiddenIntervalMs ?? 3e5;
			const cycleTimeoutMs = options.cycleTimeoutMs ?? 3e4;
			let timer;
			let cycleTimer;
			let running = false;
			let queued = false;
			let disposed = false;
			let controller;
			const clearTimer = () => {
				if (timer === void 0) return;
				runtime.window.clearTimeout(timer);
				timer = void 0;
			};
			const clearCycleTimer = () => {
				if (cycleTimer === void 0) return;
				runtime.window.clearTimeout(cycleTimer);
				cycleTimer = void 0;
			};
			const schedule = () => {
				if (disposed) return;
				clearTimer();
				const delay = runtime.document.visibilityState === "hidden" ? hiddenIntervalMs : visibleIntervalMs;
				timer = runtime.window.setTimeout(run, delay);
			};
			const run = () => {
				if (disposed) return;
				clearTimer();
				if (running) {
					queued = true;
					return;
				}
				running = true;
				const current = new AbortController();
				controller = current;
				const refreshPromise = Promise.resolve().then(() => refresh(current.signal));
				const timeoutPromise = new Promise((resolve) => {
					cycleTimer = runtime.window.setTimeout(() => {
						cycleTimer = void 0;
						current.abort(new DOMException("mobile extension refresh timed out", "TimeoutError"));
						resolve();
					}, cycleTimeoutMs);
				});
				Promise.race([refreshPromise, timeoutPromise]).catch(() => {}).finally(() => {
					clearCycleTimer();
					if (controller === current) controller = void 0;
					running = false;
					if (disposed) return;
					if (queued) {
						queued = false;
						run();
					} else schedule();
				});
				refreshPromise.catch(() => {});
			};
			const onVisibilityChange = () => {
				if (runtime.document.visibilityState === "hidden") schedule();
				else run();
			};
			runtime.document.addEventListener("visibilitychange", onVisibilityChange);
			runtime.window.addEventListener("focus", run);
			runtime.window.addEventListener("online", run);
			run();
			const stop = () => {
				disposed = true;
				queued = false;
				controller?.abort();
				controller = void 0;
				clearCycleTimer();
				clearTimer();
				runtime.document.removeEventListener("visibilitychange", onVisibilityChange);
				runtime.window.removeEventListener("focus", run);
				runtime.window.removeEventListener("online", run);
			};
			return Object.assign(stop, { refresh: run });
		}
		/** Maintain one authenticated same-origin extension event stream with bounded reconnect backoff. */
		function startExtensionChangeStream(changed, runtime = {
			window,
			create: (url) => new EventSource(url, { withCredentials: true })
		}, onTaskEvent, onDeviceRevoked) {
			let source;
			let timer;
			let disposed = false;
			let retryMs = 1e3;
			const clearTimer = () => {
				if (timer === void 0) return;
				runtime.window.clearTimeout(timer);
				timer = void 0;
			};
			const connect = () => {
				if (disposed || source !== void 0) return;
				clearTimer();
				const next = runtime.create("/mobile-access/extensions/events");
				source = next;
				next.onopen = () => {
					retryMs = 1e3;
				};
				next.addEventListener("extensions-changed", changed);
				if (onTaskEvent !== void 0) next.addEventListener("task-notify", (message) => {
					const data = message.data;
					onTaskEvent(data);
				});
				if (onDeviceRevoked !== void 0) next.addEventListener("device-revoked", (message) => {
					const data = message.data;
					if (isDeviceRevokedPayload(data)) onDeviceRevoked();
				});
				next.onerror = () => {
					if (source !== next) return;
					next.close();
					source = void 0;
					if (disposed) return;
					const delay = retryMs;
					retryMs = Math.min(3e4, retryMs * 2);
					timer = runtime.window.setTimeout(connect, delay);
				};
			};
			const reconnectNow = () => {
				if (disposed) return;
				source?.close();
				source = void 0;
				retryMs = 1e3;
				connect();
			};
			runtime.window.addEventListener("online", reconnectNow);
			connect();
			return () => {
				disposed = true;
				clearTimer();
				source?.close();
				source = void 0;
				runtime.window.removeEventListener("online", reconnectNow);
			};
		}
		/** Keep at most one activation in flight per id and commit only its latest generation. */
		var PerIdActivationLifecycle = class {
			active = /* @__PURE__ */ new Map();
			pending = /* @__PURE__ */ new Map();
			generations = /* @__PURE__ */ new Map();
			disposed = false;
			hasActive(id) {
				return this.active.has(id);
			}
			getActive(id) {
				return this.active.get(id)?.value;
			}
			pendingCount() {
				return this.pending.size;
			}
			async activate(id, key, cycleSignal, create) {
				if (this.disposed || cycleSignal?.aborted === true) return false;
				const existing = this.pending.get(id);
				if (existing !== void 0) {
					if (existing.key === key && !existing.controller.signal.aborted) return this.waitFor(existing, cycleSignal);
					existing.cancel();
				}
				const generation = (this.generations.get(id) ?? 0) + 1;
				this.generations.set(id, generation);
				const controller = new AbortController();
				let work;
				try {
					work = create(controller, generation);
				} catch {
					controller.abort(new DOMException("mobile extension activation failed to start", "AbortError"));
					return false;
				}
				let cancelled = false;
				let pending = {};
				const cancel = () => {
					if (cancelled) return;
					cancelled = true;
					if (this.pending.get(id) === pending) this.pending.delete(id);
					if (this.generations.get(id) === generation) this.generations.set(id, generation + 1);
					controller.abort(new DOMException("mobile extension activation cancelled", "AbortError"));
					work.cancel();
				};
				const completion = Promise.resolve(work.result).then((value) => {
					const current = this.pending.get(id);
					if (!(!this.disposed && current === pending && current.generation === this.generations.get(id) && !controller.signal.aborted)) {
						try {
							work.dispose(value);
						} catch {}
						return false;
					}
					try {
						work.commit?.(value);
					} catch {
						try {
							work.dispose(value);
						} catch {}
						return false;
					}
					const previous = this.active.get(id);
					let valueDisposed = false;
					const dispose = () => {
						if (valueDisposed) return;
						valueDisposed = true;
						controller.abort(new DOMException("mobile extension deactivated", "AbortError"));
						try {
							work.dispose(value);
						} catch {}
					};
					this.active.set(id, {
						value,
						dispose
					});
					previous?.dispose();
					return true;
				}, () => {
					cancel();
					return false;
				}).finally(() => {
					if (this.pending.get(id) === pending) this.pending.delete(id);
				});
				Object.assign(pending, {
					key,
					generation,
					controller,
					cancel,
					completion
				});
				this.pending.set(id, pending);
				return this.waitFor(pending, cycleSignal);
			}
			remove(id) {
				this.generations.set(id, (this.generations.get(id) ?? 0) + 1);
				this.active.get(id)?.dispose();
				this.active.delete(id);
				this.pending.get(id)?.cancel();
			}
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				for (const current of this.active.values()) current.dispose();
				this.active.clear();
				for (const current of this.pending.values()) current.cancel();
			}
			waitFor(pending, signal) {
				if (signal === void 0) return pending.completion;
				if (signal.aborted) {
					pending.cancel();
					return Promise.resolve(false);
				}
				return new Promise((resolve) => {
					let settled = false;
					const finish = (value) => {
						if (settled) return;
						settled = true;
						signal.removeEventListener("abort", onAbort);
						resolve(value);
					};
					const onAbort = () => {
						pending.cancel();
						finish(false);
					};
					signal.addEventListener("abort", onAbort, { once: true });
					pending.completion.then(finish);
				});
			}
		};
		function installCustomAssets() {
			const legacyStyle = element("style");
			legacyStyle.dataset.plugin = "dsh-mobile-custom";
			document.head.append(legacyStyle);
			const legacyCssState = {
				etag: "",
				modified: ""
			};
			const previous = window.dshMobile;
			let legacyMount = queuedLegacyMount;
			let legacySource = "";
			let legacyRoot;
			let legacyDispose;
			const definitions = /* @__PURE__ */ new Map();
			const activations = new PerIdActivationLifecycle();
			const styleNodes = /* @__PURE__ */ new Map();
			const styleEtags = /* @__PURE__ */ new Map();
			const scriptDigests = /* @__PURE__ */ new Map();
			const activeHostGenerations = /* @__PURE__ */ new Map();
			const activationKeys = /* @__PURE__ */ new Map();
			const manifestExtensionIds = /* @__PURE__ */ new Set();
			const managedDefinitionIds = /* @__PURE__ */ new Set();
			let manifestEtag = "";
			let disposed = false;
			let expectedDefinitionId;
			const SURFACE_HOST_STYLES = {
				"sidebar-action": "position:fixed;z-index:1100;top:calc(env(safe-area-inset-top) + 8px);left:8px;display:flex;flex-direction:column;gap:6px;pointer-events:none",
				"header-action": "position:fixed;z-index:1100;top:calc(env(safe-area-inset-top) + 8px);right:8px;display:flex;flex-direction:column;gap:6px;pointer-events:none",
				"composer-dock": "position:fixed;z-index:1100;bottom:calc(env(safe-area-inset-bottom) + 8px);left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;pointer-events:none",
				"settings-section": "position:fixed;z-index:1100;inset:auto 8px calc(env(safe-area-inset-bottom) + 72px) 8px;max-height:40vh;overflow:auto;pointer-events:none"
			};
			const surfaceHost = (placement) => {
				const existing = document.querySelector(`[data-dsh-mobile-surface-host="${placement}"]`);
				if (existing !== null) return existing;
				const style = SURFACE_HOST_STYLES[placement];
				if (style === void 0) return void 0;
				const host = element("div");
				host.dataset.dshMobileSurfaceHost = placement;
				host.style.cssText = style;
				document.body.append(host);
				return host;
			};
			const shellLayer = () => {
				const existing = document.querySelector("[data-dsh-mobile-extension-layer]");
				if (existing !== null) return existing;
				const layer = element("div");
				layer.dataset.dshMobileExtensionLayer = "true";
				layer.style.cssText = "position:fixed;inset:0;z-index:1200;pointer-events:none;overflow:hidden";
				document.body.append(layer);
				return layer;
			};
			const toast = (message) => {
				const node = element("div");
				node.textContent = message;
				node.style.cssText = "position:absolute;top:16px;left:50%;transform:translateX(-50%);padding:9px 14px;border-radius:999px;background:#1f2937;color:white;font:14px system-ui;pointer-events:auto;box-shadow:0 8px 24px #0003";
				shellLayer().append(node);
				window.setTimeout(() => node.remove(), 2600);
			};
			const stopNativeBack = installMobileNativeBack(window, document, () => {
				toast(mobileBackBlockedMessage(selectedMobileControlLocale()));
			});
			const materializeNativeFile = (value) => {
				if (typeof value !== "object" || value === null || !("base64" in value) || !("name" in value)) return value;
				const candidate = value;
				if (typeof candidate.base64 !== "string" || typeof candidate.name !== "string") return value;
				try {
					const encoded = atob(candidate.base64);
					const bytes = Uint8Array.from(encoded, (character) => character.charCodeAt(0));
					return new File([bytes], candidate.name, { type: typeof candidate.type === "string" ? candidate.type : "application/octet-stream" });
				} catch {
					return value;
				}
			};
			const invokeNative = async (action, input, signal) => {
				const abortReason = () => signal.reason ?? new DOMException("mobile extension disposed", "AbortError");
				if (signal.aborted) throw abortReason();
				const bridge = window.__DSH_MOBILE_NATIVE__;
				if (bridge !== void 0) return invokeBoundNativeCapability(bridge, () => window.__DSH_MOBILE_NATIVE__, action, input, signal).then(materializeNativeFile);
				if (action === "share" && typeof navigator.share === "function") {
					await navigator.share(input ?? {});
					return { ok: true };
				}
				if (action === "clipboard.read" && navigator.clipboard !== void 0) return { text: await navigator.clipboard.readText() };
				if (action === "clipboard.write" && navigator.clipboard !== void 0) {
					await navigator.clipboard.writeText(typeof input === "object" && input !== null && "text" in input ? String(input.text) : "");
					return { ok: true };
				}
				if (action === "files.pick" || action === "camera.capture") {
					const inputElement = element("input");
					inputElement.type = "file";
					inputElement.accept = action === "camera.capture" ? "image/*" : "*/*";
					if (action === "camera.capture") inputElement.capture = "environment";
					inputElement.hidden = true;
					return new Promise((resolve, reject) => {
						let settled = false;
						let cleaned = false;
						let cleanupTimer = 0;
						let watchdogTimer = 0;
						const cleanup = () => {
							if (cleaned) return;
							cleaned = true;
							if (cleanupTimer !== 0) window.clearTimeout(cleanupTimer);
							if (watchdogTimer !== 0) window.clearTimeout(watchdogTimer);
							window.removeEventListener("focus", scheduleCancel);
							document.removeEventListener("visibilitychange", onVisibilityChange);
							signal.removeEventListener("abort", onAbort);
							inputElement.removeEventListener("change", onChange);
							inputElement.removeEventListener("cancel", onCancel);
							inputElement.remove();
						};
						const finish = (callback) => {
							if (settled) return;
							settled = true;
							cleanup();
							callback();
						};
						const onChange = () => {
							const file = inputElement.files?.[0];
							finish(() => {
								resolve(file);
							});
						};
						const onCancel = () => {
							finish(() => {
								resolve(void 0);
							});
						};
						const onAbort = () => {
							finish(() => {
								reject(abortReason());
							});
						};
						const scheduleCancel = () => {
							if (!settled && cleanupTimer === 0) cleanupTimer = window.setTimeout(onCancel, 1e3);
						};
						const onVisibilityChange = () => {
							if (document.visibilityState === "visible") scheduleCancel();
						};
						inputElement.addEventListener("change", onChange, { once: true });
						inputElement.addEventListener("cancel", onCancel, { once: true });
						window.addEventListener("focus", scheduleCancel);
						document.addEventListener("visibilitychange", onVisibilityChange);
						signal.addEventListener("abort", onAbort, { once: true });
						watchdogTimer = window.setTimeout(onCancel, 3e5);
						try {
							document.body.append(inputElement);
							inputElement.click();
						} catch (error) {
							finish(() => {
								reject(error);
							});
						}
					});
				}
				throw new Error("native capability is unavailable");
			};
			const makeApi = (id, hostGeneration, controller, surfaces, surfaceIds) => {
				const ensureCurrent = () => {
					if (controller.signal.aborted) throw controller.signal.reason;
				};
				const requestSignal = (signal) => signal === void 0 || signal === null ? {
					signal: controller.signal,
					cleanup: () => void 0
				} : combineClientSignalLifetime(controller.signal, signal);
				const mountSurface = (surface) => {
					ensureCurrent();
					if (!/^[a-z][a-z0-9-]{0,63}$/u.test(surface.id) || surface.label.length > 120) throw new Error("invalid mobile surface");
					return registerUniqueDisposable(surfaces, surfaceIds, surface.id, () => {
						const container = element("section");
						container.dataset.dshMobileSurface = surface.id;
						container.dataset.dshMobileSurfacePlacement = surface.placement;
						container.hidden = surface.placement === "page" || surface.placement === "overlay";
						container.style.cssText = surface.placement === "page" || surface.placement === "overlay" ? "position:absolute;inset:0;overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff);padding:16px;pointer-events:auto" : "pointer-events:auto";
						const host = () => surface.placement === "page" || surface.placement === "overlay" ? shellLayer() : surfaceHost(surface.placement) ?? shellLayer();
						const mounted = surface.mount(container);
						const dispose = () => {
							try {
								if (typeof mounted === "function") mounted();
							} finally {
								container.remove();
							}
						};
						return {
							dispose,
							container,
							host
						};
					});
				};
				return {
					host: {
						invoke: (action, input) => {
							ensureCurrent();
							return mobileRequest(`/mobile-access/extensions/${encodeURIComponent(id)}/actions/${encodeURIComponent(action)}`, extensionActionRequestInit(hostGeneration, input, controller.signal)).then(async (response) => {
								const value = await response.json();
								if (!response.ok) throw new Error(typeof value === "object" && value !== null && "error" in value ? String(value.error) : `HTTP ${String(response.status)}`);
								return value;
							});
						},
						fetch: (path, init) => {
							ensureCurrent();
							const target = extensionRouteUrl(id, path, location.href);
							const headers = extensionGenerationHeaders(hostGeneration, init?.headers);
							const lifetime = requestSignal(init?.signal);
							return mobileRequest(target.href, {
								...init,
								headers,
								signal: lifetime.signal
							}).then((response) => bindClientResponseLifetime(response, lifetime.cleanup), (error) => {
								lifetime.cleanup();
								throw error;
							});
						},
						assetUrl: (path) => {
							ensureCurrent();
							return extensionAssetUrl(id, hostGeneration, path, location.href).href;
						}
					},
					ui: {
						registerSurface: mountSurface,
						open: (surfaceId) => {
							ensureCurrent();
							const entry = surfaces.get(surfaceId);
							if (entry !== void 0) setMobileSurfaceOpen(entry.container, true);
						},
						close: (surfaceId) => {
							ensureCurrent();
							const entry = surfaces.get(surfaceId);
							if (entry !== void 0) setMobileSurfaceOpen(entry.container, false);
						},
						toast: (message) => {
							ensureCurrent();
							toast(message);
						}
					},
					native: {
						capabilities: async () => {
							ensureCurrent();
							const bridge = window.__DSH_MOBILE_NATIVE__;
							return bridge === void 0 ? [
								"files.pick",
								"camera.capture",
								"share",
								"clipboard.read",
								"clipboard.write"
							] : bridge.capabilities();
						},
						invoke: (action, input) => invokeNative(action, input, controller.signal)
					},
					signal: controller.signal,
					document,
					window
				};
			};
			const activateDefinition = (definition, cycleSignal, commitGeneration, hostGeneration) => {
				const previousKey = activationKeys.get(definition.id);
				const key = previousKey?.definition === definition && previousKey.generation === hostGeneration ? previousKey : {
					definition,
					...hostGeneration === void 0 ? {} : { generation: hostGeneration }
				};
				activationKeys.set(definition.id, key);
				return activations.activate(definition.id, key, cycleSignal, (controller) => {
					const surfaces = /* @__PURE__ */ new Map();
					const surfaceIds = /* @__PURE__ */ new Set();
					let pendingDisposed = false;
					const disposePending = () => {
						if (pendingDisposed) return;
						pendingDisposed = true;
						for (const surface of surfaces.values()) try {
							surface.dispose();
						} catch {}
						surfaces.clear();
						surfaceIds.clear();
					};
					return {
						result: Promise.resolve().then(() => definition.activate(makeApi(definition.id, hostGeneration, controller, surfaces, surfaceIds))).then((cleanup) => ({
							controller,
							surfaces,
							...typeof cleanup === "function" ? { cleanup } : {}
						})),
						cancel: disposePending,
						commit: (value) => {
							if (definitions.get(definition.id) !== definition || controller.signal.aborted) throw new Error("stale mobile extension activation");
							for (const surface of value.surfaces.values()) surface.host().append(surface.container);
							activeHostGenerations.set(definition.id, hostGeneration);
							commitGeneration?.();
						},
						dispose: (value) => {
							controller.abort(new DOMException("mobile extension disposed", "AbortError"));
							try {
								value.cleanup?.();
							} finally {
								disposePending();
							}
						}
					};
				});
			};
			const define = (definition) => {
				if (disposed || definition.apiVersion !== 1 || !/^[a-z][a-z0-9-]{0,63}$/u.test(definition.id) || typeof definition.activate !== "function") return;
				if (expectedDefinitionId !== void 0 && definition.id !== expectedDefinitionId) return;
				definitions.set(definition.id, definition);
				if (started && expectedDefinitionId === void 0) activateDefinition(definition);
			};
			let started = false;
			window.dshMobile = Object.freeze({
				register: (mount) => {
					legacyMount = mount;
				},
				define
			});
			for (const definition of queuedDefinitions.splice(0)) define(definition);
			let legacyJsEtag = "";
			let legacyJsModified = "";
			const refreshLegacy = async (signal) => {
				const previousMount = legacyMount;
				let pendingRoot;
				try {
					const headers = {};
					if (legacyJsEtag !== "") headers["if-none-match"] = legacyJsEtag;
					if (legacyJsModified !== "") headers["if-modified-since"] = legacyJsModified;
					const response = await fetch("/mobile-access/custom.js", {
						credentials: "same-origin",
						cache: "no-store",
						headers,
						signal
					});
					if (response.status === 304) return true;
					if (!response.ok) return false;
					const nextEtag = response.headers.get("etag") ?? "";
					const nextModified = response.headers.get("last-modified") ?? "";
					const next = await response.text();
					if (refreshAborted(signal)) return false;
					if (next === legacySource) {
						legacyJsEtag = nextEtag;
						legacyJsModified = nextModified;
						return true;
					}
					legacyMount = void 0;
					const script = element("script");
					script.textContent = `${next}\n//# sourceURL=dsh-mobile-custom.js`;
					document.head.append(script);
					script.remove();
					if (refreshAborted(signal)) {
						legacyMount = previousMount;
						return false;
					}
					const mount = legacyMount;
					if (mount === void 0) {
						legacyDispose?.();
						legacyDispose = void 0;
						legacyRoot?.remove();
						legacyRoot = void 0;
						legacySource = next;
						legacyJsEtag = nextEtag;
						legacyJsModified = nextModified;
						return true;
					}
					const nextRoot = element("div");
					pendingRoot = nextRoot;
					nextRoot.dataset.dshMobileExtension = "true";
					document.body.append(nextRoot);
					const nextDispose = mount({
						document,
						request: mobileRequest,
						root: nextRoot,
						window
					});
					if (refreshAborted(signal)) {
						if (typeof nextDispose === "function") nextDispose();
						pendingRoot.remove();
						pendingRoot = void 0;
						legacyMount = previousMount;
						return false;
					}
					legacyDispose?.();
					legacyRoot?.remove();
					legacyRoot = nextRoot;
					pendingRoot = void 0;
					legacyDispose = typeof nextDispose === "function" ? nextDispose : void 0;
					legacySource = next;
					legacyJsEtag = nextEtag;
					legacyJsModified = nextModified;
					return true;
				} catch {
					pendingRoot?.remove();
					legacyMount = previousMount;
					return false;
				}
			};
			let legacyScriptRevision = "";
			let legacyStyleRevision = "";
			const disposeManifestExtension = (id) => {
				activations.remove(id);
				styleNodes.get(id)?.remove();
				styleNodes.delete(id);
				styleEtags.delete(id);
				scriptDigests.delete(id);
				activeHostGenerations.delete(id);
				activationKeys.delete(id);
				if (managedDefinitionIds.delete(id)) definitions.delete(id);
			};
			const managedManifestIdSources = () => [
				styleNodes.keys(),
				styleEtags.keys(),
				scriptDigests.keys(),
				managedDefinitionIds
			];
			const clearManifestExtensions = () => {
				publishAuthoritativeExtensionIds(manifestExtensionIds, /* @__PURE__ */ new Set(), managedManifestIdSources(), disposeManifestExtension);
				manifestEtag = "";
			};
			const refreshExtensions = async (signal) => {
				try {
					const headers = {};
					if (manifestEtag !== "") headers["if-none-match"] = manifestEtag;
					const response = await fetch("/mobile-access/extensions/manifest", {
						credentials: "same-origin",
						cache: "no-store",
						headers,
						signal
					});
					if (response.status === 404) {
						legacyScriptRevision = "";
						legacyStyleRevision = "";
						return handleMissingExtensionManifest(clearManifestExtensions, () => Promise.all([refreshLegacy(signal), refreshCssLegacy(legacyStyle, signal, legacyCssState)]), signal);
					}
					if (response.status === 304) return true;
					if (!response.ok) return false;
					const nextManifestEtag = response.headers.get("etag") ?? "";
					const payload = parseMobileExtensionManifest(await response.json());
					if (refreshAborted(signal) || payload === void 0) return false;
					const entries = payload.extensions;
					const seen = new Set(entries.map((entry) => entry.id));
					const scriptRevision = payload.legacy.scriptRevision;
					const styleRevision = payload.legacy.styleRevision;
					let refreshComplete = true;
					if (scriptRevision === "" || scriptRevision !== legacyScriptRevision) {
						if (await refreshLegacy(signal)) legacyScriptRevision = scriptRevision;
						else refreshComplete = false;
					}
					if (styleRevision === "" || styleRevision !== legacyStyleRevision) {
						if (await refreshCssLegacy(legacyStyle, signal, legacyCssState)) legacyStyleRevision = styleRevision;
						else refreshComplete = false;
					}
					const commitStyle = (id, change, css, etag) => {
						if (change === "retain") return;
						const oldStyle = styleNodes.get(id);
						if (change === "remove") {
							oldStyle?.remove();
							styleNodes.delete(id);
							styleEtags.delete(id);
							return;
						}
						if (oldStyle?.textContent !== css) {
							const node = element("style");
							node.dataset.dshMobileExtensionStyle = id;
							node.textContent = css ?? "";
							document.head.append(node);
							styleNodes.set(id, node);
							oldStyle?.remove();
						}
						if (etag !== void 0 && etag !== "") styleEtags.set(id, etag);
					};
					for (const entry of entries) {
						const hadActiveGeneration = activations.hasActive(entry.id);
						const previousHostGeneration = activeHostGenerations.get(entry.id);
						let previousDefinition;
						let evaluatedDefinition = false;
						try {
							let styleChange = entry.styleUrl === void 0 ? "remove" : "retain";
							let pendingCss;
							let pendingStyleEtag;
							const cssUrl = typeof entry.styleUrl === "string" ? entry.styleUrl : void 0;
							if (cssUrl !== void 0) {
								const cssHeaders = {};
								const storedEtag = styleEtags.get(entry.id);
								if (storedEtag !== void 0) cssHeaders["if-none-match"] = storedEtag;
								const cssResponse = await fetch(cssUrl, {
									credentials: "same-origin",
									cache: "no-store",
									headers: cssHeaders,
									signal
								});
								if (cssResponse.status !== 304) {
									if (!cssResponse.ok) throw new Error("mobile extension style failed to load");
									pendingStyleEtag = cssResponse.headers.get("etag") ?? void 0;
									pendingCss = await cssResponse.text();
									styleChange = "replace";
									if (refreshAborted(signal)) return false;
								}
							}
							const scriptUrl = typeof entry.scriptUrl === "string" ? entry.scriptUrl : void 0;
							if (scriptUrl === void 0) {
								if (refreshAborted(signal)) return false;
								commitStyle(entry.id, styleChange, pendingCss, pendingStyleEtag);
								activations.remove(entry.id);
								activeHostGenerations.delete(entry.id);
								scriptDigests.delete(entry.id);
								if (managedDefinitionIds.delete(entry.id)) definitions.delete(entry.id);
							} else {
								const scriptHeaders = {};
								const storedDigest = scriptDigests.get(entry.id);
								if (storedDigest !== void 0) scriptHeaders["if-none-match"] = storedDigest;
								const scriptResponse = await fetch(scriptUrl, {
									credentials: "same-origin",
									cache: "no-store",
									headers: scriptHeaders,
									signal
								});
								let nextDigest;
								if (scriptResponse.status !== 304) {
									if (!scriptResponse.ok) throw new Error("mobile extension script failed to load");
									const source = await scriptResponse.text();
									if (refreshAborted(signal)) return false;
									const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
									if (refreshAborted(signal)) return false;
									const key = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
									if (scriptDigests.get(entry.id) !== key) {
										previousDefinition = definitions.get(entry.id);
										try {
											expectedDefinitionId = entry.id;
											try {
												const script = element("script");
												script.textContent = `${source}\n//# sourceURL=dsh-mobile-extension-${entry.id}.js`;
												document.head.append(script);
												script.remove();
											} finally {
												expectedDefinitionId = void 0;
											}
											const nextDefinition = definitions.get(entry.id);
											if (nextDefinition === void 0 || nextDefinition === previousDefinition) throw new Error("mobile extension did not define its manifest id");
											evaluatedDefinition = true;
											nextDigest = key;
										} catch (error) {
											if (previousDefinition === void 0) definitions.delete(entry.id);
											else definitions.set(entry.id, previousDefinition);
											throw error;
										}
									}
								}
								const definition = definitions.get(entry.id);
								const commitGeneration = () => {
									commitStyle(entry.id, styleChange, pendingCss, pendingStyleEtag);
								};
								if (definition === void 0) throw new Error("mobile extension definition is unavailable");
								if (evaluatedDefinition || !activations.hasActive(entry.id) || activeHostGenerations.get(entry.id) !== entry.generation) {
									if (!await activateDefinition(definition, signal, commitGeneration, entry.generation)) throw new Error("mobile extension activation failed");
								} else {
									if (refreshAborted(signal)) return false;
									commitGeneration();
								}
								managedDefinitionIds.add(entry.id);
								if (nextDigest !== void 0) scriptDigests.set(entry.id, nextDigest);
							}
						} catch {
							if (evaluatedDefinition) {
								if (previousDefinition === void 0) definitions.delete(entry.id);
								else definitions.set(entry.id, previousDefinition);
							}
							failClosedExtensionGenerationReplacement(hadActiveGeneration, previousHostGeneration, entry.generation, () => {
								disposeManifestExtension(entry.id);
							});
							refreshComplete = false;
						}
					}
					if (refreshAborted(signal)) return false;
					if (refreshComplete) {
						publishAuthoritativeExtensionIds(manifestExtensionIds, seen, managedManifestIdSources(), disposeManifestExtension);
						manifestEtag = nextManifestEtag;
					} else manifestEtag = "";
					return refreshComplete;
				} catch {
					return false;
				}
			};
			started = true;
			for (const definition of definitions.values()) activateDefinition(definition);
			const stopRefresh = startLifecycleRefreshScheduler(async (signal) => {
				await refreshExtensions(signal);
			});
			const stopEvents = startExtensionChangeStream(() => {
				stopRefresh.refresh();
			}, void 0, (payload) => {
				if (document.hidden !== true) return;
				const parsed = parseTaskNotifyPayload(payload);
				if (parsed === void 0) return;
				const language = resolveNativeMobileLanguage(document.documentElement.lang, navigator.languages.length > 0 ? [...navigator.languages] : [navigator.language]);
				const label = (italian, english, chinese) => language === "it" ? italian : language === "zh" ? chinese : english;
				fireTaskNotifyEvent({
					kind: "done",
					title: label("Attività completata", "Task finished", "任务已完成"),
					body: label("Il tuo task DSH è terminato", "Your DSH task finished", "你的 DSH 任务已完成"),
					tag: taskCompletionTag(parsed.sessionId, parsed.turn)
				});
			}, () => {
				fireDeviceRevoked();
			});
			return () => {
				disposed = true;
				stopNativeBack();
				stopEvents();
				stopRefresh();
				started = false;
				legacyDispose?.();
				legacyDispose = void 0;
				legacyRoot?.remove();
				legacyRoot = void 0;
				legacyStyle.remove();
				activations.dispose();
				for (const node of styleNodes.values()) node.remove();
				styleNodes.clear();
				document.querySelector("[data-dsh-mobile-extension-layer]")?.remove();
				for (const host of document.querySelectorAll("[data-dsh-mobile-surface-host]")) host.remove();
				if (previous === void 0) delete window.dshMobile;
				else window.dshMobile = previous;
			};
		}
		async function refreshCssLegacy(style, signal, state) {
			try {
				const headers = {};
				if (state.etag !== "") headers["if-none-match"] = state.etag;
				if (state.modified !== "") headers["if-modified-since"] = state.modified;
				let response = await fetch("/mobile-access/custom.css", {
					credentials: "same-origin",
					cache: "no-store",
					headers,
					signal
				});
				if (response.status === 304 && style.textContent === "") {
					state.etag = "";
					state.modified = "";
					response = await fetch("/mobile-access/custom.css", {
						credentials: "same-origin",
						cache: "no-store",
						signal
					});
				}
				if (response.status === 304) return true;
				if (response.ok) {
					const nextEtag = response.headers.get("etag") ?? "";
					const nextModified = response.headers.get("last-modified") ?? "";
					const css = await response.text();
					if (refreshAborted(signal)) return false;
					style.textContent = css;
					state.etag = nextEtag;
					state.modified = nextModified;
					return true;
				}
				return false;
			} catch {
				return false;
			}
		}
		/** Theme-aware desktop Mobile Access panel styles. */
		const CONTROL_STYLES = `
.dsh-mobile-control{position:fixed;z-index:1000;left:16px;bottom:112px;font:14px/1.45 system-ui;color:var(--dsw-alias-label-primary,#16181d)}
.dsh-mobile-control__panel{box-sizing:border-box;width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 140px);overflow-y:auto;padding:16px;border:1px solid var(--dsw-alias-border-l2,#e1e5eb);border-radius:18px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:0 18px 50px rgb(15 23 42 / 18%)}
.dsh-mobile-control__header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.dsh-mobile-control__panel h2{margin:0;font-size:17px;line-height:24px}.dsh-mobile-control__header-actions{display:flex;align-items:center;gap:2px}.dsh-mobile-control__update-plugin,.dsh-mobile-control__diagnostic-entry,.dsh-mobile-control__close{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;padding:0;border:0;border-radius:10px;background:transparent;color:inherit;cursor:pointer}.dsh-mobile-control__update-plugin,.dsh-mobile-control__diagnostic-entry{padding:0 8px;color:var(--dsw-alias-label-primary-bluish,#2563eb);font:650 12px/1 system-ui;white-space:nowrap}.dsh-mobile-control__update-plugin[hidden]{display:none}.dsh-mobile-control__update-plugin:disabled{cursor:wait;opacity:.55}.dsh-mobile-control__close{font-size:24px;line-height:1}.dsh-mobile-control__update-plugin:hover:not(:disabled),.dsh-mobile-control__diagnostic-entry:hover,.dsh-mobile-control__close:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f3f6)}
.dsh-mobile-control__release-notice{margin:-2px 0 10px;padding:8px 10px;border-radius:9px;background:var(--dsw-alias-bg-layer-1,#eff6ff);color:var(--dsw-alias-label-primary,#1d4ed8);font-size:11px;line-height:1.45}.dsh-mobile-control__release-notice.is-error{color:var(--dsw-alias-label-primary,#dc2626);border-left:3px solid var(--dsw-alias-state-error-primary,#dc2626)}.dsh-mobile-control__release-notice[hidden]{display:none}.dsh-mobile-control__update-card{margin:0 0 10px;padding:11px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#f8fafc)}.dsh-mobile-control__update-card[hidden]{display:none}.dsh-mobile-control__update-card-title{margin:0 0 7px;color:var(--dsw-alias-label-primary,#16181d);font:650 13px/1.4 system-ui}.dsh-mobile-control__update-notes{display:block;box-sizing:border-box;max-height:150px;overflow-y:auto;margin:0 0 8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,#e1e5eb);border-radius:9px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-secondary,#475569);white-space:pre-wrap;word-break:break-word;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.dsh-mobile-control__update-notes[hidden]{display:none}.dsh-mobile-control__update-notice{margin:0 0 9px;padding:7px 9px;border-radius:8px;background:var(--dsw-alias-state-warn-tertiary,#fff4d6);color:var(--dsw-alias-state-warn-label,#92400e);font-size:11px;line-height:1.5}.dsh-mobile-control__update-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px}.dsh-mobile-control__update-actions .dsh-mobile-control__primary,.dsh-mobile-control__update-actions .dsh-mobile-control__secondary{min-height:36px;padding:0 12px}.dsh-mobile-control__app-download{display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;min-height:44px;margin:0 0 10px;padding:8px 11px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:11px;background:var(--dsw-alias-bg-layer-1,#f7f8fa);color:var(--dsw-alias-label-primary,#16181d);font:600 12px/1.3 system-ui;text-decoration:none}.dsh-mobile-control__app-download[hidden]{display:none}.dsh-mobile-control__app-download::after{color:var(--dsw-alias-label-primary-bluish,#2563eb);font-size:14px;content:"↗"}.dsh-mobile-control__app-download:hover{border-color:#9fb9e8;background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-bg-layer-2,#f5f8ff));color:var(--dsw-alias-label-primary,#1d4ed8)}
.dsh-mobile-control__switcher{display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin:0 0 14px;padding:4px;border-radius:12px;background:var(--dsw-alias-bg-layer-1,#f3f5f8)}.dsh-mobile-control__switcher[hidden]{display:none}.dsh-mobile-control__tab{min-height:36px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary,#606873);font:600 13px/1 system-ui;cursor:pointer}.dsh-mobile-control__tab.is-active{background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#16181d);box-shadow:0 1px 3px rgb(15 23 42 / 10%)}.dsh-mobile-control__view[hidden]{display:none}.dsh-mobile-control__intro{margin:0 0 12px;color:var(--dsw-alias-label-secondary,#606873);font-size:12px;line-height:1.55}.dsh-mobile-control__http-frame-warning{box-sizing:border-box;margin:-4px 0 12px;padding:8px 10px;border:1px solid #d6a83f;border-radius:9px;background:var(--dsw-alias-bg-layer-1,#fff7df);color:var(--dsw-alias-label-primary,#694b00);font-size:11px;line-height:1.5;overflow-wrap:anywhere}.dsh-mobile-control__http-frame-warning[hidden]{display:none}.dsh-mobile-control__view.is-remote .dsh-mobile-control__actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dsh-mobile-control__view.is-remote .dsh-mobile-control__actions button[hidden]{display:none}
.dsh-mobile-control__provider-section{position:relative;margin:0 0 14px}.dsh-mobile-control__section-title{margin:0 0 8px;color:var(--dsw-alias-label-primary,#16181d);font:650 13px/1.4 system-ui}.dsh-mobile-control__provider-section>.dsh-mobile-control__section-title{padding-right:42px}.dsh-mobile-control__provider-choices{display:grid;grid-template-columns:1fr;gap:8px}.dsh-mobile-control__provider{display:flex;min-width:0;flex-direction:column;gap:6px;min-height:94px;padding:10px 11px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:13px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#16181d);text-align:left;cursor:pointer;touch-action:manipulation;transition:border-color 160ms ease,background-color 160ms ease,box-shadow 160ms ease}.dsh-mobile-control__provider:hover{border-color:#6f96db;background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-bg-layer-1,#f8fbff))}.dsh-mobile-control__provider.is-selected{border-color:var(--dsw-alias-label-primary-bluish,#2563eb);background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-bg-layer-1,#f5f8ff));box-shadow:0 0 0 1px var(--dsw-alias-label-primary-bluish,#2563eb) inset}.dsh-mobile-control__provider:disabled{cursor:wait;opacity:.62}.dsh-mobile-control__provider-top{display:flex;min-width:0;align-items:flex-start;justify-content:space-between;gap:5px}.dsh-mobile-control__provider-top strong{min-width:0;font-size:12px;line-height:1.3}.dsh-mobile-control__provider-badge{flex:none;padding:2px 5px;border-radius:999px;background:var(--dsw-alias-state-business-tertiary,#e8f0ff);color:var(--dsw-alias-label-primary,#1d4ed8);font:650 11px/1.25 system-ui}.dsh-mobile-control__provider-badge.is-cpolar{background:var(--dsw-alias-state-success-tertiary,#eaf8f2);color:var(--dsw-alias-label-primary,#087454)}.dsh-mobile-control__provider-description{color:var(--dsw-alias-label-secondary,#606873);font-size:12px;line-height:1.45}.dsh-mobile-control__provider-info{position:absolute;z-index:5;top:-13px;right:-8px}.dsh-mobile-control__provider-info-button{display:flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary,#475569);cursor:pointer;touch-action:manipulation}.dsh-mobile-control__provider-info-button:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f5f9);color:var(--dsw-alias-label-primary-bluish,#2563eb)}.dsh-mobile-control__provider-info-glyph{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:18px;height:18px;border:1.5px solid currentColor;border-radius:50%;font:700 12px/1 system-ui}.dsh-mobile-control__provider-info-popover{position:absolute;z-index:6;top:38px;right:4px;box-sizing:border-box;width:min(292px,calc(100vw - 72px));padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:0 10px 28px rgb(15 23 42 / 16%)}.dsh-mobile-control__provider-info-popover[hidden]{display:none}.dsh-mobile-control__provider-info-popover strong,.dsh-mobile-control__provider-info-popover span{display:block}.dsh-mobile-control__provider-info-popover strong{margin-bottom:3px;font-size:12px}.dsh-mobile-control__provider-info-popover span{color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.55}
.dsh-mobile-control__self-hosted{margin:8px 0 0;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#f8fafc)}.dsh-mobile-control__self-hosted-summary{display:flex;box-sizing:border-box;min-height:48px;align-items:center;justify-content:space-between;gap:10px;padding:8px 11px;cursor:pointer;list-style-position:inside}.dsh-mobile-control__self-hosted-summary>span:first-child{display:flex;min-width:0;flex-direction:column;gap:1px}.dsh-mobile-control__self-hosted-summary strong{font-size:11px}.dsh-mobile-control__self-hosted-summary span span{color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.35}.dsh-mobile-control__provider-badge.is-frp{background:var(--dsw-alias-bg-layer-1,#eef0f3);color:var(--dsw-alias-label-secondary,#475569)}.dsh-mobile-control__self-hosted-body{padding:0 8px 8px}.dsh-mobile-control__provider.is-frp{width:100%;min-height:64px;background:var(--dsw-alias-bg-layer-2,#fff)}
/* The cloudflared setup section deliberately reuses this card, so
   .dsh-mobile-control__cloudflared-setup is a DOM hook for targeting rather than a
   style rule of its own. */
.dsh-mobile-control__cpolar-setup{margin:0 0 12px;padding:12px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:13px;background:var(--dsw-alias-bg-layer-2,#fff)}.dsh-mobile-control__cpolar-setup[hidden],.dsh-mobile-control__cpolar-account[hidden],.dsh-mobile-control__details[hidden],.dsh-mobile-control__view.is-remote .dsh-mobile-control__actions[hidden],.dsh-mobile-control__danger[hidden]{display:none}.dsh-mobile-control__component-status,.dsh-mobile-control__component-note{margin:0 0 10px;color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.55}.dsh-mobile-control__cpolar-setup>.dsh-mobile-control__primary{width:100%;min-height:44px;padding:9px 12px;border-radius:10px;font:600 12px/1.3 system-ui;cursor:pointer}.dsh-mobile-control__cpolar-account{margin-top:10px}.dsh-mobile-control__link-row{display:flex;flex-wrap:wrap;gap:6px 12px;margin:0 0 10px}.dsh-mobile-control__text-link{color:var(--dsw-alias-label-primary-bluish,#2563eb);font-size:11px;text-decoration:none}.dsh-mobile-control__text-link:hover{text-decoration:underline}.dsh-mobile-control__token-label{display:flex;flex-direction:column;gap:5px;margin:0 0 8px;color:var(--dsw-alias-label-secondary,#606873);font-size:11px}.dsh-mobile-control__token{box-sizing:border-box;width:100%;min-height:44px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l3,#cfd5dd);border-radius:10px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2,#fff));color:var(--dsw-alias-label-primary,#16181d);font:16px/1.4 system-ui}.dsh-mobile-control__cpolar-connect{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:44px;padding:10px 14px;border-radius:12px;font:650 13px/1.2 system-ui;cursor:pointer;transition:background-color 160ms ease,border-color 160ms ease,opacity 160ms ease}.dsh-mobile-control__cpolar-connect:hover:not(:disabled){border-color:#1d4ed8;background:#1d4ed8}.dsh-mobile-control__cpolar-connect:active:not(:disabled){border-color:#1e40af;background:#1e40af}.dsh-mobile-control__cpolar-connect:disabled{cursor:wait;opacity:.55}.dsh-mobile-control__details{margin:10px 0 0;border-top:1px solid var(--dsw-alias-border-l2,#e1e5eb);padding-top:9px}.dsh-mobile-control__details>summary{min-height:36px;color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:30px;cursor:pointer}.dsh-mobile-control__details-body{display:flex;flex-wrap:wrap;align-items:center;gap:7px 12px;padding:4px 0}.dsh-mobile-control__details-body p{flex:1 0 100%;margin:0;color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.5}.dsh-mobile-control__storage{display:block;flex:1 0 100%;max-width:100%;overflow:hidden;padding:7px 8px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,#f3f5f8);color:var(--dsw-alias-label-secondary,#475569);font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;text-overflow:ellipsis;white-space:nowrap}.dsh-mobile-control__danger{flex:1 0 100%;min-height:44px;margin-top:3px;padding:7px 10px;border:1px solid var(--dsw-alias-state-error-primary,#dc2626);border-radius:9px;background:transparent;color:var(--dsw-alias-label-primary,#dc2626);font:12px/1.3 system-ui;cursor:pointer}
.dsh-mobile-control__danger:hover:not(:disabled),.dsh-mobile-control__device-revoke:hover{background:var(--dsw-alias-interactive-bg-hover-danger,rgb(220 38 38 / 8%))}
.dsh-mobile-control__frp-setup{margin:0;padding:12px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:13px;background:var(--dsw-alias-bg-layer-2,#fff)}.dsh-mobile-control__frp-setup[hidden]{display:none}.dsh-mobile-control__frp-step{padding:11px 0}.dsh-mobile-control__frp-step + .dsh-mobile-control__frp-step{border-top:1px solid var(--dsw-alias-border-l2,#e1e5eb)}.dsh-mobile-control__frp-step>strong{display:block;margin-bottom:3px;font-size:12px;line-height:1.4}.dsh-mobile-control__frp-step>p{margin:0 0 9px;color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.5}.dsh-mobile-control__frp-changes{margin:0 0 9px;padding:0;list-style:none;color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.5}.dsh-mobile-control__frp-changes li{position:relative;margin:0;padding-left:12px}.dsh-mobile-control__frp-changes li+li{margin-top:5px}.dsh-mobile-control__frp-changes li::before{content:"•";position:absolute;left:2px;color:var(--dsw-alias-label-tertiary,#98a1ad)}.dsh-mobile-control__frp-step>.dsh-mobile-control__frp-requirement{padding:8px 9px;border-radius:9px;background:var(--dsw-alias-bg-layer-1,#f3f5f8);color:var(--dsw-alias-label-primary,#384152);font-size:11px}.dsh-mobile-control__frp-fields{display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:8px}.dsh-mobile-control__frp-fields>.dsh-mobile-control__field:nth-child(5),.dsh-mobile-control__frp-fields>.dsh-mobile-control__field:nth-child(6){grid-column:1/-1}.dsh-mobile-control__frp-fields>.dsh-mobile-control__field[hidden]{display:none}.dsh-mobile-control__frp-fields select{box-sizing:border-box;width:100%;min-height:44px;padding:9px 32px 9px 10px;border:1px solid var(--dsw-alias-border-l3,#cfd5dd);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#16181d);font:14px/1.4 system-ui}.dsh-mobile-control__frp-fields select:disabled{cursor:not-allowed;opacity:.55}.dsh-mobile-control__frp-hint{margin:0;color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.5}.dsh-mobile-control__field{display:flex;min-width:0;flex-direction:column;gap:5px;color:var(--dsw-alias-label-secondary,#606873);font-size:11px}.dsh-mobile-control__field:nth-child(3),.dsh-mobile-control__field:nth-child(4){grid-column:1/-1}.dsh-mobile-control__field input{box-sizing:border-box;width:100%;min-height:44px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l3,#cfd5dd);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#16181d);font:16px/1.4 system-ui}.dsh-mobile-control__frp-action{box-sizing:border-box;width:100%;min-height:44px;padding:9px 12px;border-radius:10px;font:650 12px/1.3 system-ui;cursor:pointer}.dsh-mobile-control__frp-action:disabled{cursor:not-allowed;opacity:.5}.dsh-mobile-control__remote-workspace{margin:0;padding:12px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:15px;background:var(--dsw-alias-bg-layer-1,#f7f8fa)}.dsh-mobile-control__stage-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.dsh-mobile-control__stage-header .dsh-mobile-control__section-title{margin:0}.dsh-mobile-control__stage-meta{display:flex;min-width:0;align-items:center;justify-content:flex-end;gap:5px}.dsh-mobile-control__stage-value{max-width:115px;overflow:hidden;color:var(--dsw-alias-label-primary,#16181d);font:650 11px/1.3 system-ui;text-overflow:ellipsis;white-space:nowrap}.dsh-mobile-control__state-badge{flex:none;padding:3px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-secondary,#606873);font:650 11px/1.25 system-ui}.dsh-mobile-control__state-badge.is-ready{background:var(--dsw-alias-state-success-tertiary,#e6f7f0);color:var(--dsw-alias-label-primary,#087454)}.dsh-mobile-control__state-badge.is-busy{background:var(--dsw-alias-state-business-tertiary,#e8f0ff);color:var(--dsw-alias-label-primary,#1d4ed8)}.dsh-mobile-control__state-badge.is-attention{background:var(--dsw-alias-state-warn-tertiary,#fff4dc);color:var(--dsw-alias-label-primary,#935100)}.dsh-mobile-control__remote-workspace>.dsh-mobile-control__status{box-sizing:border-box;margin:0 0 10px;padding:9px 10px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fff);font-size:11px;line-height:1.45}.dsh-mobile-control__provider-setup-body{margin:0 0 10px}.dsh-mobile-control__provider-setup-body>.dsh-mobile-control__cpolar-setup{margin:0}.dsh-mobile-control__provider-setup-body>.dsh-mobile-control__cpolar-setup>.dsh-mobile-control__section-title,.dsh-mobile-control__provider-setup-body>.dsh-mobile-control__frp-setup>.dsh-mobile-control__section-title{display:none}.dsh-mobile-control__provider-setup-body>.dsh-mobile-control__details{margin:0;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:11px;background:var(--dsw-alias-bg-layer-2,#fff)}.dsh-mobile-control__remote-workspace>.dsh-mobile-control__actions{margin-top:2px}.dsh-mobile-control__remote-workspace>.dsh-mobile-control__qr{margin:10px 0 0}.dsh-mobile-control__remote-workspace>.dsh-mobile-control__manage-row{margin-top:10px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2,#e1e5eb)}
.dsh-mobile-control__frp-overview{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:10px;margin:0 0 10px;padding:10px;border:1px solid var(--dsw-alias-state-success-primary,#a9dfc9);border-radius:11px;background:var(--dsw-alias-state-success-tertiary,#edf9f4)}.dsh-mobile-control__frp-overview[hidden]{display:none}.dsh-mobile-control__frp-overview-mark{display:grid;width:32px;height:32px;place-items:center;border-radius:50%;background:#087454;color:#fff;font:700 15px/1 system-ui}.dsh-mobile-control__frp-overview-body{display:flex;min-width:0;flex-direction:column;gap:2px}.dsh-mobile-control__frp-overview-body strong{color:var(--dsw-alias-label-primary,#075d46);font-size:12px;line-height:1.35}.dsh-mobile-control__frp-overview-body span{overflow:hidden;color:var(--dsw-alias-label-secondary,#357061);font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;text-overflow:ellipsis;white-space:nowrap}.dsh-mobile-control__frp-group{margin:8px 0 0;overflow:hidden;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:11px;background:var(--dsw-alias-bg-layer-1,#f8fafc)}.dsh-mobile-control__frp-group>summary{box-sizing:border-box;min-height:44px;padding:12px 34px 10px 12px;color:var(--dsw-alias-label-primary,#16181d);font:650 12px/1.4 system-ui;cursor:pointer}.dsh-mobile-control__frp-group[open]>summary{border-bottom:1px solid var(--dsw-alias-border-l2,#e1e5eb);background:var(--dsw-alias-bg-layer-2,#fff)}.dsh-mobile-control__frp-group>.dsh-mobile-control__frp-step{padding:12px}.dsh-mobile-control__frp-group>.dsh-mobile-control__frp-step>strong:first-child{display:none}.dsh-mobile-control__frp-group .dsh-mobile-control__frp-step{border-top:0}.dsh-mobile-control__frp-setup>.dsh-mobile-control__frp-step{margin-bottom:8px;padding:10px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:11px;background:var(--dsw-alias-bg-layer-1,#f8fafc)}.dsh-mobile-control__tunnel{margin:0 0 10px}.dsh-mobile-control__tunnel[hidden]{display:none}
.dsh-mobile-control__lan-setup{box-sizing:border-box;margin:0 0 12px;padding:14px;border:1px solid #6f96db;border-radius:15px;background:var(--dsw-alias-bg-layer-1,#f5f8ff)}.dsh-mobile-control__lan-setup[hidden],.dsh-mobile-control__lan-setup-form[hidden]{display:none}.dsh-mobile-control__lan-setup>.dsh-mobile-control__section-title{margin-bottom:5px}.dsh-mobile-control__lan-setup>.dsh-mobile-control__intro{margin-bottom:12px}.dsh-mobile-control__lan-setup-form{display:grid;gap:9px}.dsh-mobile-control__lan-setup .dsh-mobile-control__field select{box-sizing:border-box;width:100%;min-height:44px;padding:9px 32px 9px 10px;border:1px solid var(--dsw-alias-border-l3,#cfd5dd);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#16181d);font:14px/1.4 system-ui}.dsh-mobile-control__lan-setup .dsh-mobile-control__component-note{margin:0}.dsh-mobile-control__lan-setup-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:8px}.dsh-mobile-control__lan-setup-actions button{box-sizing:border-box;min-width:0;min-height:44px;padding:9px 10px;border-radius:10px;font:650 12px/1.3 system-ui;cursor:pointer}.dsh-mobile-control__lan-setup-actions button:disabled{cursor:wait;opacity:.55}.dsh-mobile-control__lan-setup>.dsh-mobile-control__status{margin:10px 0 0;line-height:1.5}.dsh-mobile-control__lan-setup>.dsh-mobile-control__status:empty{display:none}
.dsh-mobile-control__access{display:flex;align-items:baseline;gap:6px;min-width:0;margin:0 0 12px}.dsh-mobile-control__access[hidden]{display:none}.dsh-mobile-control__access-label{flex:none;color:var(--dsw-alias-label-secondary,#606873);white-space:nowrap}.dsh-mobile-control__access-label::after{content:"："}.dsh-mobile-control__access-link{min-width:0;overflow:hidden;color:var(--dsw-alias-label-primary-bluish,#2563eb);text-decoration:none;text-overflow:ellipsis;white-space:nowrap}.dsh-mobile-control__access-link:hover{text-decoration:underline}.dsh-mobile-control__qr{display:flex;justify-content:center;margin:0 0 12px}.dsh-mobile-control__qr[hidden]{display:none}.dsh-mobile-control__qr img{border-radius:12px;background:#fff;padding:8px}
.dsh-mobile-control__status{margin:0 0 14px;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary,#606873)}.dsh-mobile-control__status::before{display:inline-block;width:8px;height:8px;margin-right:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#98a1ad);content:""}.dsh-mobile-control__status.is-running::before{background:var(--dsw-alias-state-success-primary,#16a36a)}.dsh-mobile-control__status.is-key{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;word-break:break-all}
.dsh-mobile-control__guide{margin:0 0 14px;padding:12px;border:1px solid #6f96db;border-radius:12px;background:var(--dsw-alias-bg-layer-1,#eff6ff)}.dsh-mobile-control__guide[hidden]{display:none}.dsh-mobile-control__guide-title{margin:0;color:var(--dsw-alias-label-primary,#172554);font:650 13px/1.45 system-ui}.dsh-mobile-control__guide-summary,.dsh-mobile-control__guide-note{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#475569);font-size:12px;line-height:1.5}.dsh-mobile-control__guide-steps{margin:8px 0 0;padding-left:20px;color:var(--dsw-alias-label-primary,#1e293b);font-size:12px;line-height:1.6}.dsh-mobile-control__guide-note{color:var(--dsw-alias-label-secondary,#64748b)}.dsh-mobile-control__guide-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.dsh-mobile-control__guide-actions button{min-width:0;min-height:44px;padding:8px;border-radius:10px;font:12px/1.25 system-ui;cursor:pointer}.dsh-mobile-control__guide-actions button:disabled{cursor:not-allowed;opacity:.45}
.dsh-mobile-control__extensions{margin:0 0 12px;color:var(--dsw-alias-label-secondary,#606873);font-size:12px}
.dsh-mobile-control__view.is-diagnostics{--dsh-diagnostic-ok:var(--dsw-alias-state-success-primary,#087454);--dsh-diagnostic-warning:var(--dsw-alias-state-warn-primary,#a35b00);--dsh-diagnostic-error:var(--dsw-alias-state-error-primary,#c62828);--dsh-diagnostic-info:var(--dsw-alias-label-secondary,#526071)}.dsh-mobile-control__diagnostic-summary{box-sizing:border-box;margin:0;padding:13px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:16px;background:var(--dsw-alias-bg-layer-1,#f8fafc)}.dsh-mobile-control__diagnostic-summary-main{display:grid;grid-template-columns:36px minmax(0,1fr);align-items:center;gap:11px}.dsh-mobile-control__diagnostic-summary-icon{position:relative;display:block;width:36px;height:36px;border-radius:50%;background:var(--dsw-alias-bg-layer-1,#e8edf3);color:var(--dsh-diagnostic-info)}.dsh-mobile-control__diagnostic-summary-icon::before,.dsh-mobile-control__diagnostic-summary-icon::after{position:absolute;content:""}.dsh-mobile-control__diagnostic-summary-body{display:flex;min-width:0;flex-direction:column;gap:2px}.dsh-mobile-control__diagnostic-summary-body strong{font-size:13px;line-height:1.35}.dsh-mobile-control__diagnostic-summary-body span{color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.5}.dsh-mobile-control__diagnostic-summary-meta{display:block;margin-top:11px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l2,#dbe1e8);color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.45}.dsh-mobile-control__diagnostic-summary.is-ok .dsh-mobile-control__diagnostic-summary-icon{background:var(--dsw-alias-state-success-tertiary,#e6f7f0);color:var(--dsh-diagnostic-ok)}.dsh-mobile-control__diagnostic-summary.is-ok .dsh-mobile-control__diagnostic-summary-icon::before{top:10px;left:10px;width:13px;height:7px;border-bottom:2px solid currentColor;border-left:2px solid currentColor;transform:rotate(-45deg)}.dsh-mobile-control__diagnostic-summary.is-attention .dsh-mobile-control__diagnostic-summary-icon{background:var(--dsw-alias-state-warn-tertiary,#fff4dc);color:var(--dsh-diagnostic-warning)}.dsh-mobile-control__diagnostic-summary.is-error .dsh-mobile-control__diagnostic-summary-icon{background:var(--dsw-alias-state-error-secondary,#fdecec);color:var(--dsh-diagnostic-error)}.dsh-mobile-control__diagnostic-summary.is-attention .dsh-mobile-control__diagnostic-summary-icon::before,.dsh-mobile-control__diagnostic-summary.is-error .dsh-mobile-control__diagnostic-summary-icon::before{top:8px;left:17px;width:2px;height:13px;border-radius:2px;background:currentColor}.dsh-mobile-control__diagnostic-summary.is-attention .dsh-mobile-control__diagnostic-summary-icon::after,.dsh-mobile-control__diagnostic-summary.is-error .dsh-mobile-control__diagnostic-summary-icon::after{bottom:8px;left:17px;width:2px;height:2px;border-radius:50%;background:currentColor}.dsh-mobile-control__diagnostic-summary.is-running .dsh-mobile-control__diagnostic-summary-icon{background:var(--dsw-alias-state-business-tertiary,#e8f0ff);color:var(--dsw-alias-label-primary-bluish,#2563eb)}.dsh-mobile-control__diagnostic-summary.is-running .dsh-mobile-control__diagnostic-summary-icon::before{inset:9px;border:2px solid rgb(37 99 235 / 24%);border-top-color:currentColor;border-radius:50%;animation:dsh-diagnostic-spin .8s linear infinite}
.dsh-mobile-control__diagnostic-summary.is-idle .dsh-mobile-control__diagnostic-summary-icon::before{top:8px;left:17px;width:2px;height:2px;border-radius:50%;background:currentColor}.dsh-mobile-control__diagnostic-summary.is-idle .dsh-mobile-control__diagnostic-summary-icon::after{top:13px;left:17px;width:2px;height:11px;border-radius:2px;background:currentColor}
.dsh-mobile-control__diagnostic-toolbar{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}.dsh-mobile-control__diagnostic-toolbar.has-report{grid-template-columns:1fr 1fr}.dsh-mobile-control__diagnostic-run,.dsh-mobile-control__diagnostic-copy{box-sizing:border-box;width:100%;min-height:44px;padding:9px 10px;border-radius:11px;font:650 12px/1.3 system-ui;cursor:pointer;touch-action:manipulation}.dsh-mobile-control__diagnostic-copy[hidden]{display:none}.dsh-mobile-control__diagnostic-run:disabled{cursor:wait;opacity:.58}.dsh-mobile-control__diagnostic-feedback{margin:8px 0 0;padding:8px 10px;border-radius:9px;background:var(--dsw-alias-state-business-tertiary,#eff6ff);color:var(--dsw-alias-label-primary,#1d4ed8);font-size:11px;line-height:1.45}.dsh-mobile-control__diagnostic-feedback[hidden]{display:none}
.dsh-mobile-control__diagnostic-checks{display:grid;gap:12px;margin-top:12px;animation:dsh-diagnostic-reveal 160ms ease-out both}.dsh-mobile-control__diagnostic-checks[hidden]{display:none}.dsh-mobile-control__diagnostic-group{overflow:hidden;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:13px;background:var(--dsw-alias-bg-layer-2,#fff)}.dsh-mobile-control__diagnostic-group-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 11px;border-bottom:1px solid var(--dsw-alias-border-l2,#e1e5eb);background:var(--dsw-alias-bg-layer-1,#f8fafc)}.dsh-mobile-control__diagnostic-group-header h3{margin:0;font:650 11px/1.4 system-ui}.dsh-mobile-control__diagnostic-group-header span{color:var(--dsw-alias-label-secondary,#606873);font-size:11px}.dsh-mobile-control__diagnostic-list{display:flex;flex-direction:column}.dsh-mobile-control__diagnostic-check{display:grid;grid-template-columns:26px minmax(0,1fr);gap:9px;padding:11px;background:var(--dsw-alias-bg-layer-2,#fff)}.dsh-mobile-control__diagnostic-check + .dsh-mobile-control__diagnostic-check{border-top:1px solid var(--dsw-alias-border-l2,#e1e5eb)}.dsh-mobile-control__diagnostic-marker{position:relative;width:26px;height:26px;border-radius:50%;background:var(--dsw-alias-bg-layer-1,#edf1f5);color:var(--dsh-diagnostic-info)}.dsh-mobile-control__diagnostic-marker::before,.dsh-mobile-control__diagnostic-marker::after{position:absolute;content:""}.dsh-mobile-control__diagnostic-check.is-ok .dsh-mobile-control__diagnostic-marker{background:var(--dsw-alias-state-success-tertiary,#e6f7f0);color:var(--dsh-diagnostic-ok)}.dsh-mobile-control__diagnostic-check.is-ok .dsh-mobile-control__diagnostic-marker::before{top:7px;left:7px;width:9px;height:5px;border-bottom:1.8px solid currentColor;border-left:1.8px solid currentColor;transform:rotate(-45deg)}.dsh-mobile-control__diagnostic-check.is-warning .dsh-mobile-control__diagnostic-marker{background:var(--dsw-alias-state-warn-tertiary,#fff4dc);color:var(--dsh-diagnostic-warning)}.dsh-mobile-control__diagnostic-check.is-error .dsh-mobile-control__diagnostic-marker{background:var(--dsw-alias-state-error-secondary,#fdecec);color:var(--dsh-diagnostic-error)}.dsh-mobile-control__diagnostic-check.is-warning .dsh-mobile-control__diagnostic-marker::before,.dsh-mobile-control__diagnostic-check.is-error .dsh-mobile-control__diagnostic-marker::before{top:6px;left:12px;width:2px;height:9px;border-radius:2px;background:currentColor}.dsh-mobile-control__diagnostic-check.is-warning .dsh-mobile-control__diagnostic-marker::after,.dsh-mobile-control__diagnostic-check.is-error .dsh-mobile-control__diagnostic-marker::after{bottom:6px;left:12px;width:2px;height:2px;border-radius:50%;background:currentColor}.dsh-mobile-control__diagnostic-check.is-info .dsh-mobile-control__diagnostic-marker::before{top:6px;left:12px;width:2px;height:2px;border-radius:50%;background:currentColor}.dsh-mobile-control__diagnostic-check.is-info .dsh-mobile-control__diagnostic-marker::after{top:10px;left:12px;width:2px;height:9px;border-radius:2px;background:currentColor}.dsh-mobile-control__diagnostic-check-body{min-width:0}.dsh-mobile-control__diagnostic-check-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.dsh-mobile-control__diagnostic-check-header strong{min-width:0;font-size:12px;line-height:1.4}.dsh-mobile-control__diagnostic-badge{flex:none;padding:2px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#edf1f5);color:var(--dsh-diagnostic-info);font:650 11px/1.3 system-ui}.dsh-mobile-control__diagnostic-check.is-ok .dsh-mobile-control__diagnostic-badge{background:var(--dsw-alias-state-success-tertiary,#e6f7f0);color:var(--dsh-diagnostic-ok)}.dsh-mobile-control__diagnostic-check.is-warning .dsh-mobile-control__diagnostic-badge{background:var(--dsw-alias-state-warn-tertiary,#fff4dc);color:var(--dsh-diagnostic-warning)}.dsh-mobile-control__diagnostic-check.is-error .dsh-mobile-control__diagnostic-badge{background:var(--dsw-alias-state-error-secondary,#fdecec);color:var(--dsh-diagnostic-error)}.dsh-mobile-control__diagnostic-check p{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#606873);font-size:11px;line-height:1.5;overflow-wrap:anywhere}.dsh-mobile-control__diagnostic-check .dsh-mobile-control__diagnostic-action{margin-top:7px;padding:7px 8px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,#f8fafc);color:var(--dsw-alias-label-primary,#16181d)}.dsh-mobile-control__diagnostic-action span{display:inline-block;margin-right:6px;color:var(--dsw-alias-label-primary-bluish,#2563eb);font-weight:700}.dsh-mobile-control__diagnostic-details{margin-top:12px}.dsh-mobile-control__diagnostic-details[hidden]{display:none}.dsh-mobile-control__diagnostic-details>summary{box-sizing:border-box;min-height:44px;line-height:44px}.dsh-mobile-control__diagnostic-report{box-sizing:border-box;max-height:220px;margin:4px 0 0;overflow:auto;padding:10px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#f3f5f8);color:var(--dsw-alias-label-secondary,#606873);font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.dsh-mobile-control__diagnostic-checks{transition:opacity 150ms ease}.dsh-mobile-control__diagnostic-checks.is-refreshing{opacity:.52}
@keyframes dsh-diagnostic-spin{to{transform:rotate(360deg)}}@keyframes dsh-diagnostic-reveal{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.dsh-mobile-control__actions{display:flex;flex-wrap:nowrap;gap:6px}.dsh-mobile-control__actions[hidden],.dsh-mobile-control__manage-row[hidden]{display:none}.dsh-mobile-control__actions button{flex:1 1 0;min-width:0;min-height:44px;padding:8px 4px;border-radius:10px;font:12px/1.2 system-ui;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsh-mobile-control__secondary{border:1px solid var(--dsw-alias-border-l3,#cfd5dd);background:transparent;color:inherit}.dsh-mobile-control__primary{border:1px solid #2563eb;background:#2563eb;color:#fff}.dsh-mobile-control__actions button:disabled{cursor:not-allowed;opacity:.45}
.dsh-mobile-control button:focus-visible,.dsh-mobile-control a:focus-visible,.dsh-mobile-control input:focus-visible,.dsh-mobile-control select:focus-visible,.dsh-mobile-control summary:focus-visible{outline:3px solid rgb(37 99 235 / 28%);outline-offset:2px}
/* 42px matches the DSH sidebar footer row; it is not one of the panel target tiers. */
.dsh-mobile-control__trigger{box-sizing:border-box;flex:1 1 auto;display:flex;align-items:center;gap:8px;width:100%;height:42px;margin:4px 0;padding:0 10px 0 8px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,#16181d);font-family:inherit;font-size:14px;line-height:22px;cursor:pointer;overflow:hidden}.dsh-mobile-control__trigger:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f3f6)}.dsh-mobile-control__trigger:active,.dsh-mobile-control__trigger[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-active,#e8ebf0)}.dsh-mobile-control__trigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,currentColor);outline-offset:2px}.dsh-mobile-control__trigger.is-rail{flex:0 0 auto;width:36px;height:36px;margin:8px 0 10px;padding:0;justify-content:center;gap:0;border-radius:50%}.dsh-mobile-control__trigger-icon{display:block;flex:none}.dsh-mobile-control__trigger-label{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.dsh-mobile-control__manage-row{display:flex;justify-content:space-between;gap:8px;margin-top:10px}.dsh-mobile-control__manage{flex:1 1 0;min-width:0;min-height:36px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l3,#cfd5dd);border-radius:10px;background:transparent;color:inherit;font:12px/1.3 system-ui;cursor:pointer}.dsh-mobile-control__devices{margin-top:10px;border:1px solid var(--dsw-alias-border-l2,#e1e5eb);border-radius:10px;padding:8px;max-height:220px;overflow-y:auto}.dsh-mobile-control__device-empty{color:var(--dsw-alias-label-secondary,#606873);font-size:12px;margin:0}.dsh-mobile-control__device{display:flex;align-items:center;gap:8px;padding:6px 2px}.dsh-mobile-control__device + .dsh-mobile-control__device{border-top:1px solid var(--dsw-alias-border-l2,#e1e5eb)}.dsh-mobile-control__device-label{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.dsh-mobile-control__device-meta{flex:none;color:var(--dsw-alias-label-secondary,#606873);font-size:11px;white-space:nowrap}.dsh-mobile-control__device-revoke{flex:none;min-height:36px;padding:4px 8px;border:1px solid var(--dsw-alias-state-error-primary,#dc2626);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#dc2626);font:12px/1.2 system-ui;cursor:pointer}.dsh-mobile-control__ws-paths{margin:10px 0 0;padding:12px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:13px;background:var(--dsw-alias-bg-layer-2,#fff)}.dsh-mobile-control__ws-paths-list{margin:0 0 8px;padding:0;list-style:none}.dsh-mobile-control__ws-paths-empty{color:var(--dsw-alias-label-secondary,#606873);font-size:12px}.dsh-mobile-control__ws-paths-item{display:flex;align-items:center;gap:8px;padding:6px 0}.dsh-mobile-control__ws-paths-item + .dsh-mobile-control__ws-paths-item{border-top:1px solid var(--dsw-alias-border-l2,#e1e5eb)}.dsh-mobile-control__ws-paths-item code{flex:1 1 0;min-width:0;overflow:hidden;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;text-overflow:ellipsis;white-space:nowrap}.dsh-mobile-control__ws-paths-remove{flex:none;min-height:36px;padding:4px 8px;border:1px solid var(--dsw-alias-border-l3,#cfd5dd);border-radius:8px;background:transparent;color:inherit;font:12px/1.2 system-ui;cursor:pointer}.dsh-mobile-control__trigger,.dsh-mobile-control__diagnostic-entry{position:relative}.dsh-mobile-control__ws-dot{position:absolute;top:2px;right:2px;z-index:1;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-state-error-primary,#dc2626);color:#fff;font:650 11px/16px system-ui;text-align:center;cursor:pointer}.dsh-mobile-control__ws-dot::after{content:'';position:absolute;inset:-5px}.dsh-mobile-control__ws-sr-status{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}.dsh-mobile-control__ws-paths-row{display:flex;gap:8px}.dsh-mobile-control__ws-paths-row .dsh-mobile-control__primary{width:auto;flex:none;padding:9px 14px;border-radius:10px}.dsh-mobile-control__ws-paths-group{padding:6px 0}.dsh-mobile-control__ws-paths-group + .dsh-mobile-control__ws-paths-group{border-top:1px solid var(--dsw-alias-border-l2,#e1e5eb)}.dsh-mobile-control__ws-paths-group-head{display:flex;align-items:center;gap:8px}.dsh-mobile-control__ws-count{flex:none;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-state-business-tertiary,#e8f0ff);color:var(--dsw-alias-label-primary,#1d4ed8);font:650 11px/1.6 system-ui}.dsh-mobile-control__ws-paths-item.is-child{padding-left:12px}.dsh-mobile-control__ws-paths-group-head .dsh-mobile-control__primary,.dsh-mobile-control__ws-paths-item .dsh-mobile-control__primary{width:auto;flex:none;min-height:36px;padding:6px 12px;border-radius:10px}.dsh-mobile-control__ws-paths-row input{flex:1 1 0;min-width:0;box-sizing:border-box;min-height:44px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l3,#cfd5dd);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#16181d);font:16px/1.4 system-ui}.dsh-mobile-control__ws-paths-row button{flex:none}.dsh-mobile-control__ws-paths-detected-title{margin:0 0 2px;font:600 12px/1.4 system-ui}.dsh-mobile-control__ws-paths-advanced{margin-top:8px}.dsh-mobile-control__ws-paths-advanced summary{cursor:pointer;color:var(--dsw-alias-label-secondary,#606873);font:12px/1.4 system-ui;user-select:none}.dsh-mobile-control__ws-paths-advanced summary:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,currentColor);outline-offset:2px;border-radius:4px}.dsh-mobile-control__ws-paths-advanced[open] summary{margin-bottom:6px}.dsh-mobile-control__ws-paths-advanced .dsh-mobile-control__status{margin:6px 0 0}
@media (max-width:359px){.dsh-mobile-control__provider{min-height:68px}}@media (prefers-reduced-motion:reduce){.dsh-mobile-control__provider,.dsh-mobile-control__cpolar-connect{transition:none}.dsh-mobile-control__diagnostic-summary.is-running .dsh-mobile-control__diagnostic-summary-icon::before,.dsh-mobile-control__diagnostic-checks{animation:none}}

.dsh-mobile-control__origin-setup{margin:0;padding:12px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:13px;background:var(--dsw-alias-bg-layer-2,#fff)}.dsh-mobile-control__origin-setup[hidden],.dsh-mobile-control__origin-setup [hidden]{display:none}
/* Mode choices are not text fields; preserve native radio sizing and keyboard behavior. */
.dsh-mobile-control__origin-modes{min-width:0;margin:0 0 14px;padding:0;border:0}.dsh-mobile-control__origin-modes legend{margin:0 0 8px;padding:0;color:var(--dsw-alias-label-secondary,#606873);font:600 12px/1.4 system-ui}.dsh-mobile-control__origin-mode{display:flex;box-sizing:border-box;min-height:44px;align-items:center;gap:10px;padding:10px;border:1px solid var(--dsw-alias-border-l2,#dbe1e8);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#f3f5f8);font:12px/1.5 system-ui;cursor:pointer}.dsh-mobile-control__origin-mode+.dsh-mobile-control__origin-mode{margin-top:8px}.dsh-mobile-control__origin-mode:has(input:checked){border-color:var(--dsw-alias-label-primary-bluish,#2563eb)}.dsh-mobile-control__origin-mode:focus-within{outline:2px solid var(--dsw-alias-state-business-primary,#2563eb);outline-offset:2px}.dsh-mobile-control__origin-mode:has(input:disabled){cursor:wait;opacity:.55}.dsh-mobile-control__origin-mode input[type=radio]{flex:0 0 18px;box-sizing:border-box;width:18px;height:18px;min-height:18px;margin:0;padding:0;accent-color:var(--dsw-alias-label-primary-bluish,#2563eb)}.dsh-mobile-control__origin-mode span{min-width:0;overflow-wrap:anywhere}
/* Base the columns on the card width, not the desktop viewport behind the popup. */
.dsh-mobile-control__origin-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr));gap:12px}.dsh-mobile-control__origin-fields>.dsh-mobile-control__field{min-width:0;grid-column:auto;font-size:12px}.dsh-mobile-control__origin-fields>.dsh-mobile-control__field--full{grid-column:1/-1}.dsh-mobile-control__origin-fields select{box-sizing:border-box;width:100%;min-height:44px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l3,#cfd5dd);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#16181d);font:16px/1.4 system-ui}.dsh-mobile-control__origin-fields select:disabled{cursor:not-allowed;opacity:.55}.dsh-mobile-control__caddy-form{display:grid;gap:12px}.dsh-mobile-control__caddy-form>.dsh-mobile-control__component-note,.dsh-mobile-control__caddy-form>.dsh-mobile-control__component-status,.dsh-mobile-control__caddy-form>.dsh-mobile-control__origin-feedback{margin:0;overflow-wrap:anywhere}.dsh-mobile-control__origin-setup .dsh-mobile-control__actions.dsh-mobile-control__caddy-actions{grid-template-columns:minmax(0,1fr);margin:0}.dsh-mobile-control__caddy-actions button{box-sizing:border-box;min-width:0;min-height:44px;padding:10px 12px;border-radius:10px;font:600 12px/1.4 system-ui;cursor:pointer}.dsh-mobile-control__origin-warning{margin:12px 0;padding:10px 12px;border-left:3px solid var(--dsw-alias-state-warn-primary,#a56810);border-radius:4px;background:var(--dsw-alias-bg-layer-1,#f3f5f8);color:var(--dsw-alias-label-primary,#384152);font-size:12px;line-height:1.6}.dsh-mobile-control__origin-feedback{font-size:12px;line-height:1.6;overflow-wrap:anywhere}.dsh-mobile-control__origin-feedback.is-error{color:var(--dsw-alias-state-error-primary,#bc3030)}.dsh-mobile-control__origin-fields input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary,#bc3030)}.dsh-mobile-control__origin-backend{display:flex;min-width:0;flex-direction:column;align-items:stretch;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l2,#dbe1e8)}.dsh-mobile-control__origin-backend button{align-self:flex-start;min-height:44px}.dsh-mobile-control__self-hosted-body .is-origin{margin-top:8px}
` + EXTENSION_RECOVERY_STYLES;
		/** Mount the desktop control or mobile feature enhancements. */
		function apply(ctx) {
			ctx.effect(() => {
				if (window.__DSH_MOBILE_FRONTEND__ !== "dedicated") return;
				return trustAuthenticatedGatewayConnection(ctx.get("connection"));
			}, "dsh-mobile: authenticated gateway client trust");
			ctx.effect(() => {
				const desktopAdmin = isDesktopAdminSurface(location.hostname, location.search, window.__DSH_MOBILE_FRONTEND__, location.protocol);
				const style = element("style");
				style.dataset.plugin = "@dsh-mobile-app/gateway";
				style.textContent = desktopAdmin ? CONTROL_STYLES : NATIVE_MOBILE_STYLES;
				style.textContent += CLIENT_MODULE_STYLES;
                style.textContent += ".dsh-mobile-project-info{margin:0 0 14px;font:12px/1.5 system-ui;color:var(--dsw-alias-label-secondary,#606873)}.dsh-mobile-project-links{display:flex;flex-wrap:wrap;gap:8px 14px}.dsh-mobile-project-links a{color:var(--dsw-alias-label-primary-bluish,#2563eb);text-decoration:none}.dsh-mobile-project-info p{margin:6px 0}.dsh-mobile-project-info pre{white-space:pre-wrap;max-height:180px;overflow:auto;font:11px/1.5 system-ui}";
				document.head.append(style);
				const removeVoiceSession = installVoiceSession(!desktopAdmin);
				const removeModuleSettings = ctx.slots.inject("settings.general.item", () => ctx.slots.register({
					name: "settings.general.item",
					id: "dsh-mobile-client-modules",
					order: 120
				}, () => (0, react.createElement)(ClientModuleSettingsRow, {
					scope: desktopAdmin ? "computer" : "device",
					locale: selectedMobileControlLocale()
				})));
				if (!desktopAdmin) {
					const localFont = installMobileFontPreference();
					const removeSettingsAction = ctx.slots.inject("settings.general.item", () => {
						const removeFontSize = ctx.slots.register({
							name: "settings.general.item",
							id: "font-size",
							order: 11,
							priority: -1
						}, () => (0, react.createElement)(MobileFontSizeRow, {
							preference: localFont.preference,
							locale: selectedMobileControlLocale()
						}));
						const removeDisplayScale = ctx.slots.register({
							name: "settings.general.item",
							id: "dsh-mobile-display-scale",
							order: 12
						}, () => (0, react.createElement)(MobileDisplayScaleRow, { locale: selectedMobileControlLocale() }));
						const removeSwitchComputer = ctx.slots.register({
							name: "settings.general.item",
							id: "dsh-mobile-switch-computer",
							order: 100
						}, MobileSwitchComputerRow);
						const removeTaskNotifications = ctx.slots.register({
							name: "settings.general.item",
							id: "dsh-mobile-task-notifications",
							order: 110
						}, MobileTaskNotificationRow);
						return () => {
							removeTaskNotifications();
							removeSwitchComputer();
							removeDisplayScale();
							removeFontSize();
						};
					});
					const removeCustom = installCustomAssets();
					const removeSurface = installDshLanguageBoundSurface(() => installNativeMobileSurface({
						getLayout: () => ctx.get("layout"),
						getSidebarRight: () => ctx.get("sidebarRight")
					}));
					return () => {
						disposeClientModuleDialogs();
						removeModuleSettings();
						removeSettingsAction();
						removeCustom();
						removeSurface();
						removeVoiceSession();
						localFont.dispose();
						style.remove();
					};
				}
				const removeControl = installDshLanguageBoundSurface(() => {
					const control = installControl();
					const triggerLocale = selectedMobileControlLocale();
					const t = controlTranslator(triggerLocale);
					const disposeSlot = ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
						name: "sidebar.footer.action",
						id: "dsh-mobile"
					}, ({ wide }) => (0, react.createElement)("button", {
						"aria-expanded": control.isOpen(),
						"aria-controls": CONTROL_PANEL_ID,
						"aria-label": t("mobileAccess"),
						className: `dsh-mobile-control__trigger${wide ? "" : " is-rail"}`,
						lang: triggerLocale,
						type: "button",
						title: t("mobileAccess"),
						onClick: control.toggle
					}, (0, react.createElement)("svg", {
						"aria-hidden": true,
						className: "dsh-mobile-control__trigger-icon",
						focusable: false,
						width: wide ? 16 : 18,
						height: wide ? 16 : 18,
						viewBox: "0 0 16 16",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 1.5,
						strokeLinecap: "round",
						strokeLinejoin: "round"
					}, (0, react.createElement)("rect", {
						x: 4,
						y: 1,
						width: 8,
						height: 14,
						rx: 2
					}), (0, react.createElement)("path", { d: "M7 12h2" })), wide ? (0, react.createElement)("span", { className: "dsh-mobile-control__trigger-label" }, t("mobileAccess")) : void 0)));
					return () => {
						disposeSlot();
						control.remove();
					};
				});
				return () => {
					disposeClientModuleDialogs();
					removeModuleSettings();
					removeControl();
					removeVoiceSession();
					style.remove();
				};
			}, "dsh-mobile: stock mobile adaptation and local control");
		}
		/** Client services required by the mobile adaptation. */
		const inject = ["slots"];
		//#endregion
		exports.CONTROL_STYLES = CONTROL_STYLES;
		exports.DIAGNOSTIC_REASON_MESSAGES = DIAGNOSTIC_REASON_MESSAGES;
		exports.LOCALIZED_DIAGNOSTIC_COPY = LOCALIZED_DIAGNOSTIC_COPY;
		exports.MOBILE_CONTROL_MESSAGES = MOBILE_CONTROL_MESSAGES;
		exports.PerIdActivationLifecycle = PerIdActivationLifecycle;
		exports.apply = apply;
		exports.bindClientResponseLifetime = bindClientResponseLifetime;
		exports.clientReleaseInfo = clientReleaseInfo;
		exports.combineClientSignalLifetime = combineClientSignalLifetime;
		exports.combineClientSignals = combineClientSignals;
		exports.createFrpAttachFrpcTomlForClipboard = createFrpAttachFrpcTomlForClipboard;
		exports.createFrpAttachTemplateForClipboard = createFrpAttachTemplateForClipboard;
		exports.createFrpServerTemplateForClipboard = createFrpServerTemplateForClipboard;
		exports.diagnosticControllerAction = diagnosticControllerAction;
		exports.diagnosticEntriesForRender = diagnosticEntriesForRender;
		exports.diagnosticOverallForChecks = diagnosticOverallForChecks;
		exports.diagnosticServerCopy = diagnosticServerCopy;
		exports.extensionActionRequestInit = extensionActionRequestInit;
		exports.extensionAssetUrl = extensionAssetUrl;
		exports.extensionGenerationHeaders = extensionGenerationHeaders;
		exports.extensionRouteUrl = extensionRouteUrl;
		exports.failClosedExtensionGenerationReplacement = failClosedExtensionGenerationReplacement;
		exports.frpAttachFormErrorCode = frpAttachFormErrorCode;
		exports.handleMissingExtensionManifest = handleMissingExtensionManifest;
		exports.inject = inject;
		exports.installDshLanguageBoundSurface = installDshLanguageBoundSurface;
		exports.installMobileNativeBack = installMobileNativeBack;
		exports.mobileBackBlockedMessage = mobileBackBlockedMessage;
		exports.normalizeDiagnosticOverall = normalizeDiagnosticOverall;
		exports.normalizeDiagnosticStatus = normalizeDiagnosticStatus;
		exports.parseMobileExtensionManifest = parseMobileExtensionManifest;
		exports.parseMobileRemoteProvider = parseMobileRemoteProvider;
		exports.publishAuthoritativeExtensionIds = publishAuthoritativeExtensionIds;
		exports.reconcileRemovedExtensions = reconcileRemovedExtensions;
		exports.registerUniqueDisposable = registerUniqueDisposable;
		exports.renderDiagnosticPayloadSafely = renderDiagnosticPayloadSafely;
		exports.selectMobileControlLocale = selectMobileControlLocale;
		exports.selectedMobileControlLocale = selectedMobileControlLocale;
		exports.setMobileSurfaceOpen = setMobileSurfaceOpen;
		exports.startExtensionChangeStream = startExtensionChangeStream;
		exports.startLifecycleRefreshScheduler = startLifecycleRefreshScheduler;
		exports.trustAuthenticatedGatewayConnection = trustAuthenticatedGatewayConnection;
		exports.validateDiagnosticChecks = validateDiagnosticChecks;
		exports.clientReleaseInfo = clientReleaseInfo;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map