/*
 * Game2 runtime chunk: 10-startup.js
 * Initialisation runtime et lancement.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      currentGameMode = "";
      setGameMode(currentGameMode, { apply: false });
      startGameSingletonGuard();
      syncManagerScaleUi();
      applyTelemetryOverlayAlphaPercent(telemetryOverlayAlphaPercent, { syncUi: true });
      applyNotificationScalePercent(notificationScalePercent, { syncUi: true });
      applyGlobalAudioVolumePercent(globalAudioVolumePercent, { syncUi: true });

      (function syncMainMenuHeaderTitle() {
        var titleMainEl = document.getElementById("mainMenuTitleMain");
        var titleVersionEl = document.getElementById("mainMenuTitleVersion");
        var managerTitleEl = document.getElementById("overlayManagerTitleText");
        var resolvedSystemName = "";

        if (typeof readSystemName === "function") {
          resolvedSystemName = String(readSystemName() || "").trim();
        } else if (typeof systemName !== "undefined") {
          resolvedSystemName = String(systemName || "").trim();
        }

        if (titleMainEl) {
          titleMainEl.textContent = "MENU" + (resolvedSystemName ? " " + resolvedSystemName : "");
        }
        if (titleVersionEl && typeof gameVersion !== "undefined") {
          titleVersionEl.textContent = String(gameVersion || "");
        }
        if (managerTitleEl) {
          managerTitleEl.textContent = "Widget Manager" + (resolvedSystemName ? " " + resolvedSystemName : "");
        }
      })();

      // Injection dynamique des informations dans le guide
      (function () {
        var elInfo = document.getElementById("mainMenuInfoText");
        if (elInfo && typeof systemName !== "undefined") {
          var text = "En cours de rédaction..."; //[systemName] permet de récupérer certaines informations pendant la partie en direct, comme la position du camion, la vitesse, l’orientation, l’état du véhicule ou les informations du trajet et d'afficher dans un overlay par dessus le jeu.<br><br>Le plugin peut également détecter certaines touches du clavier uniquement pour permettre les interactions avec l’interface, comme ouvrir ou fermer l’overlay, naviguer dans les menus ou valider une action.<br><br>Le plugin [systemName] est conçu exclusivement pour fonctionner avec la map Île-de-France. Il n’est pas prévu pour être utilisé avec d’autres map. Si vous souhaitez utiliser des fonctionnalités similaires sur d’autres maps, veuillez utiliser des solutions alternatives, comme DBus World ou d’autres plugins.<br><br>La modification, la redistribution, la réutilisation ou l’intégration de ce plugin dans un autre projet ne sont pas autorisées sans accord préalable.
          elInfo.innerHTML = text.replace(/\[systemName\]/g, systemName);
        }
      })();

      syncStopAnnouncementSoundsUi();
      syncPassengerValidationSoundsUi();
      syncHideUiWhenManagerHiddenUi();
      syncNotificationSoundsUi();
      syncDefaultStartupModeUi();
      syncBusCapacitySettingsUi();
      syncShowExperimentalWidgetsUi();
      restoreSaeivTimeSystemFromStorage();
      restoreWidgetLayoutState();
      syncSaeivTimeSystemUi();
      syncStopAnnouncementSoundsUi();
      syncPassengerValidationSoundsUi();
      syncHideUiWhenManagerHiddenUi();
      syncNotificationSoundsUi();
      syncBusCapacitySettingsUi();
      syncShowExperimentalWidgetsUi();
      syncSaeivExternalState(true);
      startOverlayInteractionBindings();
      syncWebsocketMode1HintVisibility();
      ensureDbusDataLoaded().catch(function () { });
      ensureNavGraphLoaded().catch(function () { });
      ensureNavStopLinksLoaded().catch(function () { });
      ensureNavBridgesLoaded().catch(function () { });
      startTelemetryConnectionWatch();
      refreshTelemetryVisibility();
      window.addEventListener("message", handleGameWindowMessage);

      var elInfo = document.getElementById("mainMenuInfoText");
      if (!elInfo) return;

      var text = "En cours de rédaction..."; // ...
      var name = (typeof readSystemName === "function")
        ? readSystemName()
        : (typeof systemName !== "undefined" ? String(systemName) : "Systeme");

      elInfo.innerHTML = text.replace(/\[systemName\]/g, name);

      if (FORCE_DEV_UI) {
        if (!windowsByType["ws_dev"]) {
          windowsByType["ws_dev"] = {
            x: 10,
            y: 450,
            width: 320,
            height: 480,
            z: bumpOverlayZ()
          };
        }
      }

      apply();
      if (typeof maybeStartConfiguredDefaultGameMode === "function") {
        maybeStartConfiguredDefaultGameMode();
      }

      // Redirection desactivee: on supprime seulement l'ancien indicateur de session.
      try {
        sessionStorage.removeItem("overlay_reload_tab_intent");
      } catch (err) { }

      showSystemLoadedNotificationWhenReady();

      // Injection de la version dans le footer de chargement
      var versionEl = document.getElementById("globalLoadingVersionPart");
      if (versionEl && typeof gameVersion !== "undefined") {
        versionEl.textContent = gameVersion;
      }
