/*
 * Game2 runtime chunk: 00-state-and-config.js
 * Etat global, configuration, helpers WebView.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      var overlayEditMode = false;
      window.disengageOverlayEditMode = function () {
        var editModeBtn = document.getElementById("overlayToggleEditModeBtn");
        overlayEditMode = false;
        document.body.classList.remove("is-edit-mode");
        if (editModeBtn) editModeBtn.classList.remove("is-selected");
      };

      function isOverlayManagerVisibleForLayoutEdit() {
        var manager = document.getElementById("overlayManager");
        var mainMenu = document.getElementById("mainMenuModal");

        if (!manager) return false;
        if (document.body.classList.contains("is-manager-hidden")) return false;
        if (mainMenu && mainMenu.classList.contains("is-open")) return false;
        if (typeof telemetryUiMode !== "undefined" && telemetryUiMode !== 2) return false;
        if (typeof managerState !== "undefined" && managerState.visible === false) return false;

        var style = window.getComputedStyle(manager);
        if (style.display === "none") return false;
        if (style.visibility === "hidden") return false;
        if (Number(style.opacity) <= 0.01) return false;
        if (style.pointerEvents === "none") return false;

        return true;
      }

      function toggleOverlayEditMode() {
        var editModeBtn = document.getElementById("overlayToggleEditModeBtn");

        if (!isOverlayManagerVisibleForLayoutEdit()) {
          overlayEditMode = false;
          document.body.classList.remove("is-edit-mode");
          if (editModeBtn) editModeBtn.classList.remove("is-selected");
          return;
        }

        overlayEditMode = !overlayEditMode;
        if (overlayEditMode) {
          document.body.classList.add("is-edit-mode");
          if (editModeBtn) editModeBtn.classList.add("is-selected");
        } else {
          document.body.classList.remove("is-edit-mode");
          if (editModeBtn) editModeBtn.classList.remove("is-selected");
        }
      }

      var OUTPUTS = ["inline", "tab", "pip"];
      // Basculer a true pour reactiver Nouvel onglet + PIP.
      var ENABLE_TAB_AND_PIP_OUTPUTS = false;
      // Uber Eats retire pour game2.
      var ENABLE_UBER_EATS_MODE = false;
      var GAME_MODE_STORAGE_KEY = "idf_game2_mode_v1";
      var GAME_MODES = {
        BUS: "bus",
        FREE: "free"
      };
      var TYPES = {
        saeiv: { label: "SAEIV", url: new URL("widgets/saeiv.html?dev=1&host=game&source=game", location.href).href },
        saeiv_mini: { label: "HUD Ligne Simple", url: new URL("widgets/saeiv_mini.html?host=game&source=game", location.href).href },
        bus_status: { label: "Statut Embarquement", url: new URL("widgets/bus_status.html?host=game&source=game", location.href).href },
        waze: { label: "GPS Waze", url: new URL("widgets/waze.html?host=game", location.href).href },
        gps_mini: { label: "GPS Mini", url: new URL("widgets/gps_mini.html?host=game", location.href).href },
        gps_ets2_old: { label: "GPS ETS 2 Ancien", url: new URL("widgets/ets2_roadasvisor_old.html?host=game", location.href).href }
      };
      var TYPE_ASPECT_RATIO = {
        // largeur / hauteur
        saeiv: 679 / 383,
        saeiv_mini: 1050 / 383,
        bus_status: 1 / 1,
        waze: 9 / 19.5,
        gps_mini: 1.2 / 1,
        gps_ets2_old: 1.25 / 1,
        ws_dev: 1 / 1
      };
      var MODE_CONFIGS = {};
      MODE_CONFIGS[GAME_MODES.BUS] = {
        gpsTypes: ["gps_mini", ""],
        hudTypes: ["saeiv", "saeiv_mini", "bus_status"],
        defaultGpsType: "",
        forceDefaultGps: false
      };
      MODE_CONFIGS[GAME_MODES.FREE] = {
        gpsTypes: ["waze", "gps_mini", ""],
        hudTypes: [],
        defaultGpsType: "",
        forceDefaultGps: false
      };
      var GPS_WIDGET_TYPES = ["waze"];
      var HUD_WIDGET_TYPES = ["saeiv", "saeiv_mini"];
      var currentGameMode = GAME_MODES.BUS;

      var VK_MAP = {
        0x01: "Clic Gauche", 0x02: "Clic Droit", 0x03: "Annul", 0x04: "Clic Milieu", 0x05: "X1", 0x06: "X2",
        0x08: "Retour", 0x09: "Tab", 0x0C: "Effacer", 0x0D: "Entrée", 0x10: "Shift", 0x11: "Ctrl", 0x12: "Alt",
        0x13: "Pause", 0x14: "Verr Maj", 0x1B: "Echap", 0x20: "Espace", 0x21: "Page Préc.", 0x22: "Page Suiv.",
        0x23: "Fin", 0x24: "Origine", 0x25: "Gauche", 0x26: "Haut", 0x27: "Droite", 0x28: "Bas",
        0x29: "Select", 0x2A: "Imprimer", 0x2B: "Executer", 0x2C: "Impécr", 0x2D: "Inser", 0x2E: "Suppr", 0x2F: "Aide",
        0x30: "0", 0x31: "1", 0x32: "2", 0x33: "3", 0x34: "4", 0x35: "5", 0x36: "6", 0x37: "7", 0x38: "8", 0x39: "9",
        0x41: "A", 0x42: "B", 0x43: "C", 0x44: "D", 0x45: "E", 0x46: "F", 0x47: "G", 0x48: "H", 0x49: "I", 0x4A: "J",
        0x4B: "K", 0x4C: "L", 0x4D: "M", 0x4E: "N", 0x4F: "O", 0x50: "P", 0x51: "Q", 0x52: "R", 0x53: "S", 0x54: "T",
        0x55: "U", 0x56: "V", 0x57: "W", 0x58: "X", 0x59: "Y", 0x5A: "Z",
        0x5B: "Win Gauche", 0x5C: "Win Droit", 0x5D: "Apps", 0x5F: "Veille",
        0x60: "Num 0", 0x61: "Num 1", 0x62: "Num 2", 0x63: "Num 3", 0x64: "Num 4", 0x65: "Num 5",
        0x66: "Num 6", 0x67: "Num 7", 0x68: "Num 8", 0x69: "Num 9",
        0x6A: "Num *", 0x6B: "Num +", 0x6C: "Separateur", 0x6D: "Num -", 0x6E: "Num .", 0x6F: "Num /",
        0x70: "F1", 0x71: "F2", 0x72: "F3", 0x73: "F4", 0x74: "F5", 0x75: "F6", 0x76: "F7", 0x77: "F8", 0x78: "F9",
        0x79: "F10", 0x7A: "F11", 0x7B: "F12", 0x7C: "F13", 0x7D: "F14", 0x7E: "F15", 0x7F: "F16",
        0x90: "Verr Num", 0x91: "Arrêt Défil",
        0xA0: "Shift Gauche", 0xA1: "Shift Droit", 0xA2: "Ctrl Gauche", 0xA3: "Ctrl Droit", 0xA4: "Alt Gauche", 0xA5: "Alt Droit",
        0xA6: "Web Préc.", 0xA7: "Web Suiv.", 0xA8: "Web Rafraîchir", 0xA9: "Web Arrêter", 0xAA: "Web Chercher", 0xAB: "Web Favoris", 0xAC: "Web Home",
        0xAD: "Muet", 0xAE: "Volume -", 0xAF: "Volume +",
        0xB0: "Media Suiv.", 0xB1: "Media Préc.", 0xB2: "Media Arrêter", 0xB3: "Media Play/Pause", 0xB4: "Mail", 0xB5: "Media Select", 0xB6: "App 1", 0xB7: "App 2",
        0xBA: ";", 0xBB: "=", 0xBC: ",", 0xBD: "-", 0xBE: ".", 0xBF: "/", 0xC0: "`",
        0xDB: "[", 0xDC: "\\", 0xDD: "]", 0xDE: "'",
      };

      var el = {
        modeButtons: Array.prototype.slice.call(document.querySelectorAll(".mode-btn[data-mode]")),
        widgetToolbar: document.getElementById("widgetToolbar"),
        widgetGpsGroup: document.getElementById("widgetGpsGroup"),
        widgetHudGroup: document.getElementById("widgetHudGroup"),
        widgetGpsSelect: document.getElementById("widgetGpsSelect"),
        widgetHudSelect: document.getElementById("widgetHudSelect"),
        outputLists: document.getElementById("outputLists"),
        outputColTab: document.getElementById("outputColTab"),
        outputColPip: document.getElementById("outputColPip"),
        outputPipUnavailableBadge: document.getElementById("outputPipUnavailableBadge"),
        listInline: document.getElementById("listInline"),
        listTab: document.getElementById("listTab"),
        listPip: document.getElementById("listPip"),
        stage: document.getElementById("widgetStage"),
        telemetryDot: document.getElementById("telemetryDot"),
        telemetryDotStatus: document.getElementById("telemetryDotStatus"),
        telemetryErrorOverlay: document.getElementById("telemetryErrorOverlay"),
        telemetryErrorText: document.getElementById("telemetryErrorText"),
        telemetryErrorHelp: document.getElementById("telemetryErrorHelp"),
        overlayRoot: document.getElementById("overlayRoot"),
        overlayWorkspace: document.getElementById("overlayWorkspace"),
        overlayManager: document.getElementById("overlayManager"),
        overlayManagerTitlebar: document.getElementById("overlayManagerTitlebar"),
        overlayWidgetAddSelectWrap: document.getElementById("overlayWidgetAddSelectWrap"),
        overlayWidgetAddSelect: document.getElementById("overlayWidgetAddSelect"),
        overlayWidgetAddDisplay: document.getElementById("overlayWidgetAddDisplay"),
        overlayWidgetAddDisplayLabel: document.getElementById("overlayWidgetAddDisplayLabel"),
        overlayWidgetExperimentalBadge: document.getElementById("overlayWidgetExperimentalBadge"),
        overlayWidgetAddMenu: document.getElementById("overlayWidgetAddMenu"),
        overlayWidgetAddBtn: document.getElementById("overlayWidgetAddBtn"),
        overlayManagerScale: document.getElementById("overlayManagerScale"),
        overlayManagerScaleValue: document.getElementById("overlayManagerScaleValue"),
        overlayBackdropOpacity: document.getElementById("overlayBackdropOpacity"),
        overlayBackdropOpacityValue: document.getElementById("overlayBackdropOpacityValue"),
        overlayNotificationScale: document.getElementById("overlayNotificationScale"),
        overlayNotificationScaleValue: document.getElementById("overlayNotificationScaleValue"),
        overlayGlobalAudioVolume: document.getElementById("overlayGlobalAudioVolume"),
        overlayGlobalAudioVolumeValue: document.getElementById("overlayGlobalAudioVolumeValue"),
        overlayTimeSystem: document.getElementById("overlayTimeSystem"),
        overlayTimeSystemDisplay: document.getElementById("overlayTimeSystemDisplay"),
        overlayTimeSystemLabel: document.getElementById("overlayTimeSystemLabel"),
        overlayTimeSystemClock: document.getElementById("overlayTimeSystemClock"),
        overlayTimeSystemMenu: document.getElementById("overlayTimeSystemMenu"),
        overlayTimeSystemWrapper: document.getElementById("overlayTimeSystemWrapper"),
        overlayShowExperimentalWidgets: document.getElementById("overlayShowExperimentalWidgets"),
        overlayExperimentalWidgetsLabel: document.getElementById("overlayExperimentalWidgetsLabel"),
        overlayStopAnnouncementSounds: document.getElementById("overlayStopAnnouncementSounds"),
        overlayStopAnnouncementSoundsLabel: document.getElementById("overlayStopAnnouncementSoundsLabel"),
        overlayPassengerValidationSounds: document.getElementById("overlayPassengerValidationSounds"),
        overlayPassengerValidationSoundsLabel: document.getElementById("overlayPassengerValidationSoundsLabel"),
        overlayNotificationSoundsEnabled: document.getElementById("overlayNotificationSoundsEnabled"),
        overlayHideUiWhenManagerHidden: document.getElementById("overlayHideUiWhenManagerHidden"),
        overlayHideUiWhenManagerHiddenLabel: document.getElementById("overlayHideUiWhenManagerHiddenLabel"),
        overlayDestinationShortcutBtn: document.getElementById("overlayDestinationShortcutBtn"),
        overlayPlayerListShortcutBtn: document.getElementById("overlayPlayerListShortcutBtn"),
        overlayUnknownBusCapacitySlider: document.getElementById("overlayUnknownBusCapacitySlider"),
        overlayUnknownBusCapacityValue: document.getElementById("overlayUnknownBusCapacityValue"),
        overlayCapacityRuleText: document.getElementById("overlayCapacityRuleText"),
        overlayBusCapacityExamples: document.getElementById("overlayBusCapacityExamples"),
        overlayBusCapacityTooltipWrap: document.getElementById("overlayBusCapacityTooltipWrap"),
        overlayForceListedBusCapacity: document.getElementById("overlayForceListedBusCapacity"),
        overlayNotificationPreview: document.getElementById("overlayNotificationPreview"),
        overlayNotificationPreviewTitle: document.getElementById("overlayNotificationPreviewTitle"),
        overlayNotificationPreviewDescription: document.getElementById("overlayNotificationPreviewDescription"),
        playerListHoldPopup: document.getElementById("playerListHoldPopup"),
        playerListHoldMeta: document.getElementById("playerListHoldMeta"),
        playerListHoldBody: document.getElementById("playerListHoldBody"),
        overlayReloadPageBtn: document.getElementById("overlayReloadPageBtn"),
        overlayResetLayoutBtn: document.getElementById("overlayResetLayoutBtn"),
        overlayDefaultStartupMode: document.getElementById("overlayDefaultStartupMode"),
        overlayDefaultStartupModeDisplay: document.getElementById("overlayDefaultStartupModeDisplay"),
        overlayDefaultStartupModeLabel: document.getElementById("overlayDefaultStartupModeLabel"),
        overlayDefaultStartupModeMenu: document.getElementById("overlayDefaultStartupModeMenu"),
        remoteServerWsConnectBtn: document.getElementById("remoteServerWsConnectBtn"),
        remoteServerWsDisconnectBtn: document.getElementById("remoteServerWsDisconnectBtn"),
        remoteServerWsBadge: document.getElementById("remoteServerWsBadge"),
        remoteServerWsState: document.getElementById("remoteServerWsState"),
        remoteServerWsPlayers: document.getElementById("remoteServerWsPlayers"),
        remoteServerWsLastEvent: document.getElementById("remoteServerWsLastEvent"),
        remoteServerWsLastMessageAt: document.getElementById("remoteServerWsLastMessageAt"),
        remoteServerWsLastMessage: document.getElementById("remoteServerWsLastMessage"),
        remoteServerWsLog: document.getElementById("remoteServerWsLog"),
      };

      var nextId = 1;
      var widgetsById = Object.create(null);
      var lanes = { inline: [], tab: [], pip: [] };
      var tabRefs = Object.create(null);
      var pipWindow = null;
      var pipActiveIds = [];
      var applying = false;
      var widgetSelectorApplyTimer = 0;
      var dragState = null;
      var pointerDragState = null;
      var POINTER_DRAG_START_PX = 6;
      var syncingWidgetTypeSelectors = false;
      var stageRenderKey = "";
      var lastStableWazeColWidth = 0;
      // Espace entre fenetres PIP (0 = collees)
      var PIP_PANE_GAP_PX = 15;
      var WIDGET_LAYOUT_STORAGE_KEY = "idf_game2_widget_layout_v2";
      var OVERLAY_MANAGER_STORAGE_KEY = "idf_game2_overlay_manager_v2";
      var HIDE_UI_OPTION_INIT_KEY = "idf_game2_hide_ui_option_init_v1";
      var RELOAD_NOTICE_INTENT_KEY = "idf_game2_reload_notice_v1";
      var startupMenuPreferredTab = "";
      var BUS_STATUS_BACKGROUND_IFRAME_ID = "idfBusStatusBackgroundRuntime";
      var BUS_STATUS_PASSENGER_STATE_MAX_AGE_MS = 5000;
      var busStatusPassengerCount = null;
      var busStatusPassengerServiceActive = null;
      var busStatusPassengerServiceReady = null;
      var busStatusPassengerBoardingTotal = null;
      var busStatusPassengerBoardingDone = null;
      var busStatusPassengerAlightingTotal = null;
      var busStatusPassengerAlightingDone = null;
      var busStatusPassengerUpdatedAt = 0;
      var windowsByType = Object.create(null);
      var windowNodeByType = Object.create(null);
      var nextOverlayZ = 20;
      var OVERLAY_UI_SCALE = 0.5;
      var OVERLAY_WIDGET_SIZE_SCALE = 0.75;
      function scaleUiSize(value) {
        var n = Number(value);
        if (!Number.isFinite(n)) return 1;
        return Math.max(1, Math.round(n * OVERLAY_UI_SCALE));
      }
      function scaleWidgetSize(value) {
        var n = Number(value);
        if (!Number.isFinite(n)) return 1;
        return Math.max(1, Math.round(n * OVERLAY_WIDGET_SIZE_SCALE));
      }
      var OVERLAY_WIDGET_TITLEBAR_HEIGHT = scaleUiSize(32);
      var OVERLAY_MANAGER_MIN_WIDTH = scaleUiSize(120);
      var OVERLAY_MANAGER_MIN_HEIGHT = scaleUiSize(110);
      var OVERLAY_MANAGER_BASE_WIDTH = scaleUiSize(320);
      var OVERLAY_MANAGER_BASE_HEIGHT = scaleUiSize(330);
      var OVERLAY_MANAGER_SCALE_MIN = 100;
      var OVERLAY_MANAGER_SCALE_MAX = 250;
      var OVERLAY_MANAGER_SCALE_DEFAULT = 175;
      var TELEMETRY_OVERLAY_ALPHA_MIN = 0;
      var TELEMETRY_OVERLAY_ALPHA_MAX = 100;
      var TELEMETRY_OVERLAY_ALPHA_DEFAULT = 65;
      var NOTIFICATION_SCALE_MIN = 50;
      var NOTIFICATION_SCALE_MAX = 100;
      var NOTIFICATION_SCALE_DEFAULT = 75;
      var GLOBAL_AUDIO_VOLUME_MIN = 0;
      var GLOBAL_AUDIO_VOLUME_MAX = 100;
      var GLOBAL_AUDIO_VOLUME_DEFAULT = 50;
      var SAEIV_TIME_SYSTEM_STORAGE_KEY = "idf_game2_saeiv_time_system_v1";
      var SAEIV_TIME_SYSTEM_GAME = "game";
      var SAEIV_TIME_SYSTEM_IRL = "irl";
      var SAEIV_TIME_SYSTEM_DEFAULT = SAEIV_TIME_SYSTEM_GAME;
      function hasDevUiQueryFlag() {
        var search = "";
        try { search = String((window.location && window.location.search) || ""); } catch (err) { search = ""; }
        if (!search) return false;
        try {
          var raw = search.charAt(0) === "?" ? search.slice(1) : search;
          var params = new URLSearchParams(raw);
          if (params.has("dev")) return true;
        } catch (err2) { }
        return /(?:^|[?&])dev(?:[=&]|$)/i.test(search);
      }

      /** Même ordre que l’overlay WebView2 : window.top puis self puis parents ; try/catch sur .chrome évite SecurityError si cross-origin. */
      function collectWebviewRootsGame2() {
        var out = [];
        var seen = [];
        function pushWin(win) {
          if (!win || seen.indexOf(win) >= 0) return;
          seen.push(win);
          out.push(win);
        }
        try {
          pushWin(window.top);
        } catch (_eTop) { }
        pushWin(window);
        var p = window;
        for (var i = 0; i < 8; i++) {
          try {
            if (p === p.top) break;
            p = p.parent;
            pushWin(p);
          } catch (_eCross) {
            break;
          }
        }
        return out;
      }
      function requestOpenUrl(href) {
        if (!href || typeof href !== 'string') {
          return false;
        }
        function tryPostTo(wv) {
          if (!wv || typeof wv.postMessage !== 'function') return false;
          try {
            wv.postMessage({ type: 'openExternalUrl', url: href });
            return true;
          } catch (e1) {
            try {
              wv.postMessage(JSON.stringify({ type: 'openExternalUrl', url: href }));
              return true;
            } catch (e2) {
              console.error('requestOpenUrl postMessage:', e1, e2);
            }
          }
          return false;
        }
        var roots = collectWebviewRootsGame2();
        var k;
        for (k = 0; k < roots.length; k++) {
          try {
            var wvLocal = roots[k].chrome && roots[k].chrome.webview;
            if (tryPostTo(wvLocal)) return true;
          } catch (_eRw) { }
        }
        try {
          window.open(href, '_blank', 'noopener,noreferrer');
        } catch (e2) { }
        return true;
      }
      function isAbsoluteHttpUrlGame2(u) {
        return typeof u === 'string' && /^https?:\/\//i.test(u.trim());
      }
      function isLoopbackHttpUrlGame2(u) {
        return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(String(u || ''));
      }
      /**
       * Popups WebView2 : window.open est souvent tué. Pour http(s) hors localhost on délègue au host.
       * Fenêtres widget (souvent même origine) gardent window.open.
       */
      function openGame2Tab(url, windowName) {
        if (!url || typeof url !== 'string') {
          return null;
        }
        if (isAbsoluteHttpUrlGame2(url) && !isLoopbackHttpUrlGame2(url)) {
          requestOpenUrl(url);
          return null;
        }
        try {
          return window.open(url, windowName);
        } catch (e) {
          return null;
        }
      }
      var FORCE_DEV_UI = hasDevUiQueryFlag();

      if (FORCE_DEV_UI) {
        TYPES.ws_dev = { label: "WebSocket DEV", url: new URL("widgets/ws_dev.html", location.href).href };
      }
      var telemetryUiMode = 1;
      var isFirstVisitEver = !localStorage.getItem("idf_game2_visited_v7");
      if (isFirstVisitEver) {
        localStorage.setItem("idf_game2_visited_v7", "true");
      }
      var firstVisitMode1HintEnabled = isFirstVisitEver === true;
      var isGameUnlocked = false;
      var DEFAULT_STARTUP_MODE_MENU = "menu";
      var defaultStartupMode = DEFAULT_STARTUP_MODE_MENU;
      var managerScalePercent = OVERLAY_MANAGER_SCALE_DEFAULT;
      var telemetryOverlayAlphaPercent = TELEMETRY_OVERLAY_ALPHA_DEFAULT;
      var notificationScalePercent = NOTIFICATION_SCALE_DEFAULT;
      var globalAudioVolumePercent = GLOBAL_AUDIO_VOLUME_DEFAULT;
      var showExperimentalWidgets = false;
      var saeivStopAnnouncementSoundsEnabled = true;
      var saeivPassengerValidationSoundsEnabled = true;
      var PASSENGER_VALIDATION_SOUNDS_SETTING_VERSION = 2;
      var notificationSoundsEnabled = true;
      var hideUiWhenManagerHidden = false;
      var SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT = 100;
      var SAEIV_BUS_UNLIMITED_THRESHOLD = 300;
      var SAEIV_BUS_CAPACITY_LIST = [
        { name: "Solaris Urbino", capacity: 105 },
        { name: "Bolloré Bluebus", capacity: 100 },
        { name: "Iveco Evadys", capacity: 55 },
        { name: "Karosa B", capacity: 100 },
        { name: "Karosa C", capacity: 90 }
      ];
      var saeivUnknownBusCapacityInputValue = SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT;
      var saeivUnknownBusCapacityUnlimited = false;
      var saeivForceListedCapacityForAllBuses = false;
      var saeivVehicleName = "";
      var convoyStatusPollTimer = 0;
      var convoyStatusRequestId = 0;
      var convoyStatusAgeTicker = 0;
      var convoyStatusAgeBaseSeconds = null;
      var convoyStatusAgeBaseAtMs = 0;
      var convoyStatusViewState = "loading";
      var convoyStatusHasSuccessfulFetch = false;
      var convoyStatusLatest = { online: false, players: 0, ageSeconds: null };
      var telemetryConvoyActive = null;
      var telemetryConvoyPlayerList = [];
      var CONVOY_STATUS_REFRESH_MS = 5000;
      var overlayWidgetMenuOpen = false;
      var overlayWidgetSelectedType = "";
      var saeivTimeSystem = SAEIV_TIME_SYSTEM_DEFAULT;
      var saeivGameClockNowMs = Number.NaN;
      var saeivGameClockLastWallNowMs = 0;
      var saeivGameClockLastSourceTsMs = Number.NaN;
      var notificationPreviewTimer = 0;
      var websocketMode1HintTimer = 0;
      var notificationPreviewKind = "";
      var managerState = {
        x: scaleUiSize(18),
        y: scaleUiSize(18),
        width: Math.round(OVERLAY_MANAGER_BASE_WIDTH * (OVERLAY_MANAGER_SCALE_DEFAULT / 100)),
        height: Math.round(OVERLAY_MANAGER_BASE_HEIGHT * (OVERLAY_MANAGER_SCALE_DEFAULT / 100)),
        z: 1200,
        visible: false
      };
      
      var systemName = "IDFRP";
      var gameVersion = "Beta 0.1a";

      var activeOverlayDrag = null;
      var TELEMETRY_WS_URL = "ws://localhost:3001";
      var DISCORD_PRESENCE_SEND_INTERVAL_MS = 15000;
      var discordPresenceTimer = 0;
      var discordPresenceLastSentAtMs = 0;
      var discordPresenceSessionStartedAtSec = Math.floor(Date.now() / 1000);
      var discordPresenceRouteKey = "";
      var discordPresenceRouteStartedAtSec = 0;
      var REMOTE_SERVER_WS_DEFAULT_URL = "wss://panel.idf-map.fr/idfmap/ws/native/";
      var remotePanelTelemetryInFlight = false;
      var remotePanelTelemetryQueuedPayload = null;
      var remotePanelTelemetryFlushTimer = 0;
      var remotePanelTelemetryLastSentAtMs = 0;
      var remotePanelLocalPlayerIdentity = null;
      var OVERLAY_NOTIFICATION_MIN_DURATION_MS = 2400;
      var REMOTE_SERVER_WS_RECONNECT_INTERVAL_MS = 2000;
      var REMOTE_PANEL_TELEMETRY_SEND_INTERVAL_MS = 1000;
      var REMOTE_SERVER_WS_PING_INTERVAL_MS = 1000;
      var REMOTE_SERVER_WS_ONLINE_WINDOW_MS = 30000;
      var REMOTE_SERVER_WS_REQUEST_TIMEOUT_MS = 4500;
      var REMOTE_SERVER_WS_LOG_LIMIT = 40;
      var remoteServerWs = null;
      var remoteServerWsReconnectTimer = 0;
      var remoteServerWsPingTimer = 0;
      var remoteServerWsLastPongAtMs = 0;
      var remoteServerWsLastEventText = "";
      var remoteServerWsLastMessageText = "";
      var remoteServerWsLastMessageAtMs = 0;
      var remoteServerWsPlayersCount = null;
      var remoteServerWsPlayerList = [];
      var remoteServerWsLogEntries = [];
      var remoteServerWsManualClose = false;
      var remoteServerWsRequestInFlight = false;
      var remoteServerWsRequestController = null;
      var pccVoiceActiveAudio = null;
      var pccVoiceSeenMessageIds = [];
      var pccVoiceSeenMessageSet = new Set();
      var pccVoiceChunkBuffers = new Map();
      var PCC_VOICE_ACTION = "pcc_voice";
      var PCC_VOICE_SEEN_LIMIT = 80;
      var PCC_VOICE_CHUNK_TTL_MS = 30000;
      var PCC_VOICE_MAX_CHUNKS = 160;
      var PCC_VOICE_MAX_DATA_URL_CHARS = 6000000;
      var PCC_VOICE_PRE_SOUND_URL = "./sounds/bus/pcc.mp3";
      var PCC_VOICE_VOLUME_MULTIPLIER = 3;
      var TELEMETRY_PACKET_TIMEOUT_MS = 2500;
      var TELEMETRY_WATCHDOG_INTERVAL_MS = 300;
      var TELEMETRY_MIN_VALID_PACKETS_FOR_ONLINE = 3;
      var WAZE_HEADING_KEEPALIVE_INTERVAL_MS = 1000;
      var WAZE_FORCE_ROUTE_REFRESH_INTERVAL_MS = 1 * 1000;
      var SAEIV_FORCE_STATE_REFRESH_INTERVAL_MS = 1 * 1000;
      var SAEIV_FORCE_STATE_REFRESH_INTERVAL_IRL_MS = 250;
      var WIDGET_BRIDGE_SCOPE = "idf_game_widget_bridge_v1";
      var WIDGET_BRIDGE_CHANNEL_WAZE = "waze";
      var WIDGET_BRIDGE_CHANNEL_SAEIV = "saeiv";
      var WAZE_BRIDGE_WS_MIN_SEND_INTERVAL_MS = 120;
      var SAEIV_SOURCE_ID = "game";
      var SAEIV_STATE_SYNC_MIN_INTERVAL_MS = 220;
      var DBUS_GAME_FALLBACK_VERSION = "0.1.6a";
      var SAEIV_STOP_REACH_DISTANCE = 10;
      var SAEIV_STOP_DWELL_REACH_DISTANCE = 22;
      var SAEIV_STOP_ANNOUNCE_DISTANCE = 75;
      var SAEIV_TERMINUS_ANNOUNCE_DELAY_MS = 500;
      var SAEIV_SERVICE_ACCEPT_AUDIO_URL = "./sounds/bus/start_line.mp3";
      var SAEIV_SERVICE_ACCEPT_DESTINATION_DELAY_MS = 1000;
      var SAEIV_SERVICE_ACCEPT_AUDIO_START_OFFSET_SEC = 0.5;
      var SAEIV_SERVICE_ACCEPT_AUDIO_VOLUME_DIVISOR = 3;
      var SAEIV_STOP_ADVANCE_COOLDOWN_MS = 1000;
      var SAEIV_STOP_MISSED_ADVANCE_DISTANCE_MULTIPLIER = 2;
      var SAEIV_STOP_DWELL_MAX_SPEED_KMH = 1;
      var SAEIV_STOP_DWELL_REQUIRED_MS = 5000;
      var SAEIV_PASSENGERS_ENABLED = true;
      var SAEIV_ROUTE_START_DELAY_MS = 60000;
      var SAEIV_STOP_REQUEST_MIN_DISTANCE_M = 50;
      var SAEIV_STOP_REQUEST_AUDIO_MIN_DISTANCE_M = 100;
      var SAEIV_STOP_REQUEST_ROLL_INTERVAL_MS = 650;
      var SAEIV_STOP_REQUEST_BASE_CHANCE = 0.70;
      var SAEIV_PASSENGER_BOARD_STEP_INTERVAL_MS = 400;
      var SAEIV_PASSENGER_BOARD_STEP_MIN = 1;
      var SAEIV_PASSENGER_BOARD_STEP_MAX = 1;
      var SAEIV_PASSENGER_ALIGHT_STEP_INTERVAL_MS = 400;
      var SAEIV_PASSENGER_ALIGHT_STEP_MIN = 1;
      var SAEIV_PASSENGER_ALIGHT_STEP_MAX = 1;
      var SAEIV_PASSENGER_PEAK_RANGE_DIVISOR = 5;
      var SAEIV_PASSENGER_SMALL_VALUE_THRESHOLD = 5;
      var SAEIV_PASSENGER_PEAK_AM_START_MIN = (6 * 60);
      var SAEIV_PASSENGER_PEAK_AM_END_MIN = (10 * 60);
      var SAEIV_PASSENGER_PEAK_PM_START_MIN = (16 * 60) + 30;
      var SAEIV_PASSENGER_PEAK_PM_END_MIN = (19 * 60) + 30;
      var TELEMETRY_SPEED_NOISE_DISTANCE_M = 0.22;
      var TELEMETRY_SPEED_RESET_DT_SEC = 2.2;
      var telemetryConnected = true;
      var telemetryLastErrorReason = "";
      var telemetryWs = null;
      var telemetryLastPacketAt = 0;
      var telemetryValidBurstCount = 0;
      var telemetryReconnectDelayMs = 500;
      var telemetryReconnectTimer = 0;
      var telemetryWatchdogTimer = 0;
      var wazeHeadingKeepaliveTimer = 0;
      var wazeForcedRouteRefreshTimer = 0;
      var saeivForcedStateRefreshTimer = 0;
      var telemetryOfflineLock = false;
      var REQUIRED_GAME_CONTEXT_MAP = "idf.mbd";
      var gameContextMapName = "";
      var gameContextMapBlocked = false;
      var gameContextReloadPending = false;
      var lastBridgeArrowPoint = null;
      var lastBridgeHeadingDeg = 0;
      var activeBridgeDestinationPoint = null;
      var activeBridgeRoutePoints = null;
      var activeBridgeRouteStartPoint = null;
      var activeBridgeRouteEndPoint = null;
      var activeBridgeRouteComputedAt = 0;
      var activeBridgeRouteForceNavMode = false;
      var activeBridgeDestinationForceNav = false;
      var activeBridgeComposedRoutePoints = null;
      var activeBridgeComposedRouteStartPoint = null;
      var activeBridgeComposedRouteTargetIndex = -1;
      var activeBridgeComposedRouteKey = "";
      var activeBridgeComposedRouteComputedAt = 0;
      var activeBridgeComposedOffRouteFullRecomputeKey = "";
      var activeBridgeComposedOffRouteFullRecomputeAt = 0;
      var activeBridgeComposedForceFullSuffixOnce = false;
      var lastWazeRouteRecomputeAt = 0;
      var activeRouteEtaCache = {
        routeKey: "",
        targetIndex: -1,
        lastPoint: null,
        lastComputedAt: 0,
        remainingMinutes: null,
        plannedMinutes: null
      };
      var navGraph = null;
      var navGraphLoadPromise = null;
      var navPathCache = new Map();
      var saeivNavNodesByStopKey = new Map();
      var navBridgeRules = [];
      var navBridgeLoadPromise = null;
      var navBridgeLoaded = false;
      var navBridgeLoadedVersion = "";
      var navStopLinksByUid = new Map();
      var navStopLinksLoadPromise = null;
      var navStopLinksLoaded = false;
      var navStopLinksLoadedVersion = "";
      var GAME_SINGLETON_CHANNEL = "idf_game2_singleton_v1";
      var GAME_SINGLETON_STORAGE_KEY = "idf_game2_singleton_claim_v1";
      var gameSingletonOpenedAt = Date.now();
      var gameSingletonId = "game2_" + String(gameSingletonOpenedAt) + "_" + Math.random().toString(36).slice(2, 8);
      var gameSingletonChannel = null;
      var gameSingletonClosing = false;
      var widgetBridgeClientId = "game_bridge_" + Math.random().toString(36).slice(2, 10);
      var widgetBridgeOutbox = [];
      var lastWazeBridgePacket = null;
      var lastWazeBridgeWsSendAt = 0;
      var dbusStopsById = new Map();
      var dbusLines = [];
      var dbusDataVersion = "";
      var dbusLoadPromise = null;
      var telemetryLastSignal = null;
      var telemetrySpeedSample = null;
      var telemetryInstantSpeedKmh = Number.POSITIVE_INFINITY;
      var telemetryEstimatedSpeedKmh = Number.POSITIVE_INFINITY;
      var saeivRouteState = null;
      var saeivLastStateKey = "";
      var saeivLastExternalSyncAt = 0;
      var saeivLastAction = "";
      var saeivLastStopAdvanceAt = 0;
      var saeivAnnouncedStopUids = new Set();
      var saeivStopAnnounceEndedAtByUid = new Map();
      var saeivTargetArrivalUid = "";
      var saeivTargetArrivalArmed = false;
      var saeivTargetDwellUid = "";
      var saeivTargetDwellStartAt = 0;
      var saeivStoppedAtStopIndex = -1;
      var saeivStoppedAtStopUid = "";
      var saeivRouteStartPoint = null;
      var saeivRouteSelectedAtMs = 0;
      var saeivRouteStartedAtMs = 0;
      var saeivTerminusAnnouncedRouteKey = "";
      var saeivTransdevTerminusApproachAnnouncedRouteKey = "";
      var saeivTerminusAnnounceTimer = 0;
      var saeivTerminusReachedAtMs = 0;
      var saeivRouteCompletedAtMs = 0;
      var saeivRouteSuffixCache = new Map();
      var saeivNominalSegmentDistanceCache = new Map();
      var saeivReachedStopsCount = 0;
      var saeivLateStopsCount = 0;
      var saeivServedStopsCount = 0;
      var saeivMaxPassengersEverInBus = 0;
      var saeivStopServedLog = {}; // {stopIndex: true} map of confirmed-served stops
      var saeivStatsRecordedReachedIndex = -1;
      var saeivStatsRecordedServedIndex = -1;
      var saeivCurrentStopWasServed = false;
      var saeivPassengerDefaults = {
        passengersMin: 0,
        passengersMax: 0,
        coefOn: 0
      };
      var saeivPassengerState = null;
      var DBUS_FIS_ROOT = "./sounds/bus/voix_bus";
      var DBUS_FIS_GLOBAL_ROOT = DBUS_FIS_ROOT + "/global";
      var DBUS_FIS_DOSSIERS_ROOT = DBUS_FIS_ROOT + "/dossiers";
      var SAEIV_DEFAULT_GLOBAL_AUDIO_FOLDER = "RATP";
      var SAEIV_STOP_REQUEST_SOUND_ROOT = "./sounds/bus";
      var SAEIV_TRANSDEV_AUTO_VOICE_FOLDER_NAME = "Voix de Synthèse (Transdev)";
      var SAEIV_NEXT_STOP_PREFIX_CLIP_NAME = "Prochain_Arret";
      var LINE_STYLE_LEGACY_TYPES_INDEX = 3;
      var LINE_STYLE_VALIDATION_SOUND_INDEX = 4;
      var LINE_STYLE_STOP_REQUEST_SOUND_INDEX = 5;
      var LINE_STYLE_GLOBAL_AUDIO_FOLDER_INDEX = 6;
      var LINE_STYLE_AUTO_VOICE_FOLDER_INDEX = 7;
      var LINE_STYLE_PASSENGER_COUNT_VARIATION_INDEX = 8;
      var dbusFisIndex = null;
      var dbusFisIndexPromise = null;
      var saeivLineAudioConfigDefault = {
        styleKey: "",
        legacyTypes: "",
        validationSoundsAllowed: true,
        stopRequestSoundName: "",
        globalAudioFolderName: "",
        autoVoiceFolderName: "",
        passengerCountVariationMin: 0,
        passengerCountVariationMax: 0
      };
      var saeivGlobalAudioState = {
        key: "",
        folderName: "",
        folderPath: "",
        labels: [],
        urls: [],
        count: 0,
        volumeMultiplier: 1,
        preparePromise: null
      };
      var saeivStopRequestAudioState = {
        routeKey: "",
        targetUid: "",
        targetIndex: -1,
        segmentKey: "",
        triggerDistanceM: Number.NaN,
        played: false,
        clipName: "",
        clipUrl: "",
        audio: null
      };
      var saeivStopRequestAudioPlayedSegments = new Set();
      var saeivSoundFileAvailabilityCache = new Map();
      var saeivRouteAudio = {
        routeKey: "",
        styleName: "",
        folderPath: "",
        available: false,
        filesByToken: new Map(),
        departureClipName: "",
        terminusClipName: "",
        terminusAudio: null,
        queue: [],
        audio: null,
        playing: false,
        preparePromise: null,
        playbackToken: 0,
        currentClipName: "",
        currentClipEndedHooks: []
      };
      var saeivServiceAcceptAudio = null;
      var saeivServiceAcceptAudioToken = 0;
      var saeivServiceAcceptAudioReleaseAtMs = 0;
      var saeivServiceAcceptAudioReleaseTimer = 0;
      var saeivServiceAcceptAudioReleasePromise = null;
      var saeivServiceAcceptAudioReleaseResolve = null;
      var NAV_GRAPH_MAX_SNAP_DISTANCE = 450 * 8;
      var SAEIV_NAV_STOP_SNAP_DISTANCE = 450;
      var SAEIV_NAV_STOP_CANDIDATES = 6;
      var NAV_FORCE_NEARBY_CANDIDATES_MAX = 180;
      var NAV_ROUTE_RECOMPUTE_MIN_MS = 320;
      var NAV_ROUTE_RECOMPUTE_MIN_MOVE = 8;
      var NAV_ROUTE_LOCAL_RECOMPUTE_RADIUS_M = 500;
      var NAV_ROUTE_OFF_ROUTE_DISTANCE_M = 70;
      var NAV_ROUTE_OFF_ROUTE_RECOMPUTE_COOLDOWN_MS = 1200;
      var NAV_ROUTE_FAR_RECOMPUTE_MIN_MOVE = 2.5;
      var NAV_ROUTE_FAR_RECOMPUTE_MIN_MS = 90;
      var ETA_RECOMPUTE_MIN_MS = 280;
      var ETA_RECOMPUTE_MIN_MOVE = 6;
      var WAZE_ROUTE_RECOMPUTE_INTERVAL_MS = 240;

