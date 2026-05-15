/*
 * Game2 runtime chunk: 06-settings-and-modes.js
 * Reglages, modes de jeu, options de widgets.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      function normalizeWidgetType(type) {
        var raw = String(type || "").trim().toLowerCase();
        if (raw === "saeiv_simple" || raw === "saeivsimple") return "saeiv_mini";
        return raw;
      }
      function isExperimentalWidgetType(type) {
        var safeType = normalizeWidgetType(type);
        return safeType === "saeiv" || safeType === "waze";
      }
      function applyWidgetTitleWithExperimentalBadge(targetEl, labelText, type) {
        if (!targetEl) return;
        targetEl.textContent = "";
        var wrap = document.createElement("span");
        wrap.className = "widget-title-with-badge";
        var label = document.createElement("span");
        label.textContent = String(labelText || "").trim();
        wrap.appendChild(label);
        if (isExperimentalWidgetType(type)) {
          var badge = document.createElement("span");
          badge.className = "widget-title-exp-badge";
          badge.textContent = "EXPERIMENTAL";
          wrap.appendChild(badge);
        }
        targetEl.appendChild(wrap);
      }
      function normalizeShowExperimentalWidgets(value) {
        if (value === true) return true;
        if (value === false) return false;
        var raw = String(value || "").trim().toLowerCase();
        return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
      }
      function normalizeShowUnavailablePlayModes(value) {
        if (value === true) return true;
        if (value === false) return false;
        var raw = String(value || "").trim().toLowerCase();
        return !(raw === "0" || raw === "false" || raw === "no" || raw === "off");
      }
      function normalizeStopAnnouncementSoundsEnabled(value) {
        if (value === true) return true;
        if (value === false) return false;
        var raw = String(value || "").trim().toLowerCase();
        return !(raw === "0" || raw === "false" || raw === "no" || raw === "off");
      }
      function normalizePassengerValidationSoundsEnabled(value) {
        if (value === true) return true;
        if (value === false) return false;
        var raw = String(value || "").trim().toLowerCase();
        return !(raw === "0" || raw === "false" || raw === "no" || raw === "off");
      }
      function normalizeVehicleNameForCapacityLookup(value) {
        return String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[_\-]+/g, " ")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
      function getListedBusCapacityByName(vehicleName, allowLooseMatch) {
        var nameRaw = String(vehicleName || "").trim();
        if (!nameRaw) return null;
        var normalizedVehicle = normalizeVehicleNameForCapacityLookup(nameRaw);
        if (!normalizedVehicle) return null;
        var list = Array.isArray(SAEIV_BUS_CAPACITY_LIST) ? SAEIV_BUS_CAPACITY_LIST : [];
        for (var i = 0; i < list.length; i += 1) {
          var item = list[i];
          var key = normalizeVehicleNameForCapacityLookup(item && item.name);
          var cap = Math.round(Number(item && item.capacity));
          if (!key || !Number.isFinite(cap) || cap <= 0) continue;
          if (key === normalizedVehicle) return cap;
        }
        if (allowLooseMatch !== true) return null;
        for (var j = 0; j < list.length; j += 1) {
          var entry = list[j];
          var alias = normalizeVehicleNameForCapacityLookup(entry && entry.name);
          var entryCap = Math.round(Number(entry && entry.capacity));
          if (!alias || !Number.isFinite(entryCap) || entryCap <= 0) continue;
          if (normalizedVehicle.indexOf(alias) !== -1 || alias.indexOf(normalizedVehicle) !== -1) return entryCap;
        }
        return null;
      }
      function parseStrictPositiveInteger(value) {
        var raw = String(value == null ? "" : value).trim();
        if (!raw || !/^\d+$/.test(raw)) return null;
        var n = Math.floor(Number(raw));
        if (!Number.isFinite(n) || n <= 0) return null;
        return n;
      }
      function normalizeUnknownBusCapacityInputValue(rawValue, fallbackValue) {
        var fallback = Math.max(1, Math.round(Number(fallbackValue) || SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT));
        var n = parseStrictPositiveInteger(rawValue);
        if (n === null) n = fallback;
        if (n > SAEIV_BUS_UNLIMITED_THRESHOLD) {
          return { value: fallback, unlimited: true, display: "∞" };
        }
        return { value: n, unlimited: false, display: String(n) };
      }
      function getSaeivActiveCapacityState(vehicleName) {
        var busName = String(vehicleName || saeivVehicleName || "").trim();

        // 1. Si "Forcer" est décoché, on tente d'abord de trouver le véhicule dans la liste officielle
        if (saeivForceListedCapacityForAllBuses !== true) {
          var listed = getListedBusCapacityByName(busName, true);
          if (Number.isFinite(listed) && listed > 0) {
            var listedCap = Math.round(listed);
            return {
              capacity: listedCap,
              unlimited: false,
              display: String(listedCap),
              source: "listed"
            };
          }
        }

        // 2. Fallback (ou Forcé) : on utilise la valeur saisie dans la textbox
        if (saeivUnknownBusCapacityUnlimited === true) {
          return {
            capacity: Number.MAX_SAFE_INTEGER,
            unlimited: true,
            display: "∞",
            source: "fallback"
          };
        }
        var fallback = Math.max(1, Math.round(Number(saeivUnknownBusCapacityInputValue) || SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT));
        return {
          capacity: fallback,
          unlimited: false,
          display: String(fallback),
          source: "fallback"
        };
      }
      function syncBusCapacitySettingsUi() {
        if (el.overlayUnknownBusCapacitySlider) {
          if (saeivUnknownBusCapacityUnlimited === true) {
            el.overlayUnknownBusCapacitySlider.value = "1000";
            if (el.overlayUnknownBusCapacityValue) el.overlayUnknownBusCapacityValue.textContent = "∞";
          } else {
            var val = Math.max(1, Math.round(Number(saeivUnknownBusCapacityInputValue) || SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT));
            el.overlayUnknownBusCapacitySlider.value = String(val);
            if (el.overlayUnknownBusCapacityValue) el.overlayUnknownBusCapacityValue.textContent = String(val);
          }
        }
        if (el.overlayForceListedBusCapacity) {
          el.overlayForceListedBusCapacity.checked = saeivForceListedCapacityForAllBuses === true;
        }
        if (el.overlayCapacityRuleText) {
          if (saeivForceListedCapacityForAllBuses === true) {
            el.overlayCapacityRuleText.textContent = "Valeur appliquée à TOUS les véhicules.";
            el.overlayCapacityRuleText.style.color = "#fbbf24";
          } else {
            el.overlayCapacityRuleText.textContent = "Appliquée si le véhicule n'est pas dans la liste.";
            el.overlayCapacityRuleText.style.color = "#64748b";
          }
        }
        if (el.overlayBusCapacityTooltipWrap) {
          el.overlayBusCapacityTooltipWrap.style.display = (saeivForceListedCapacityForAllBuses === true) ? "none" : "inline-flex";
        }
        if (el.overlayBusCapacityExamples) {
          var list = Array.isArray(SAEIV_BUS_CAPACITY_LIST) ? SAEIV_BUS_CAPACITY_LIST : [];
          if (list.length === 0) {
            el.overlayBusCapacityExamples.textContent = "Aucun véhicule pré-enregistré.";
          } else {
            var examples = list.map(function (item) {
              return "- " + (item.name || "Inconnu");
            }).join("\n");
            el.overlayBusCapacityExamples.textContent = examples;
          }
        }
      }
      function applyUnknownBusCapacityInputValue(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        var normalized = normalizeUnknownBusCapacityInputValue(value, saeivUnknownBusCapacityInputValue);
        saeivUnknownBusCapacityInputValue = normalized.value;
        saeivUnknownBusCapacityUnlimited = normalized.unlimited === true;
        saeivLastStateKey = "";
        if (opts.syncUi !== false) syncBusCapacitySettingsUi();
        if (opts.syncState !== false) syncSaeivExternalState(true);
      }
      function applyForceListedCapacityForAllBuses(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        var next = value === true;
        if (saeivForceListedCapacityForAllBuses === next) {
          if (opts.syncUi !== false) syncBusCapacitySettingsUi();
          return;
        }
        saeivForceListedCapacityForAllBuses = next;
        saeivLastStateKey = "";
        if (opts.syncUi !== false) syncBusCapacitySettingsUi();
        if (opts.syncState !== false) syncSaeivExternalState(true);
      }
      function syncShowExperimentalWidgetsUi() {
        if (el.overlayShowExperimentalWidgets) {
          el.overlayShowExperimentalWidgets.checked = showExperimentalWidgets === true;
        }
        if (el.overlayExperimentalWidgetsLabel) {
          el.overlayExperimentalWidgetsLabel.textContent = "Widgets expérimentaux";
        }
      }
      function refreshUnavailablePlayModesVisibility() {
        var showUnavailable = showUnavailablePlayModes === true;
        document.querySelectorAll("#playModesContainer .play-mode-card.is-disabled").forEach(function (card) {
          if (!card) return;
          card.hidden = !showUnavailable;
          card.style.display = showUnavailable ? "" : "none";
          card.classList.toggle("is-hidden-by-unavailable-mode-filter", !showUnavailable);
        });
        var scrollContainer = document.getElementById("playModesContainer");
        if (scrollContainer && !showUnavailable) {
          scrollContainer.scrollLeft = Math.min(scrollContainer.scrollLeft, Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth));
        }
        try {
          window.dispatchEvent(new Event("resize"));
        } catch (err) { }
      }
      function syncShowUnavailablePlayModesUi() {
        if (el.overlayShowUnavailableModes) {
          el.overlayShowUnavailableModes.checked = showUnavailablePlayModes === true;
        }
        refreshUnavailablePlayModesVisibility();
      }
      function syncStopAnnouncementSoundsUi() {
        if (el.overlayStopAnnouncementSounds) {
          el.overlayStopAnnouncementSounds.checked = saeivStopAnnouncementSoundsEnabled === true;
        }
        if (el.overlayStopAnnouncementSoundsLabel) {
          el.overlayStopAnnouncementSoundsLabel.textContent = "Sons des Annonces des arrêts";
        }
      }
      function syncPassengerValidationSoundsUi() {
        if (el.overlayPassengerValidationSounds) {
          el.overlayPassengerValidationSounds.checked = saeivPassengerValidationSoundsEnabled === true;
        }
        if (el.overlayPassengerValidationSoundsLabel) {
          el.overlayPassengerValidationSoundsLabel.textContent = "Son validation du titre de transport des passager";
        }
      }
      function syncHideUiWhenManagerHiddenUi() {
        if (el.overlayHideUiWhenManagerHidden) {
          el.overlayHideUiWhenManagerHidden.checked = hideUiWhenManagerHidden === true;
        }
        if (el.overlayHideUiWhenManagerHiddenLabel) {
          el.overlayHideUiWhenManagerHiddenLabel.textContent = "Désactiver les widgets en jeu";
        }
      }

      function rebuildDefaultStartupModeOptions() {
        var selectEl = el.overlayDefaultStartupMode;
        var menuEl = el.overlayDefaultStartupModeMenu;
        if (!selectEl) return;

        var currentValue = normalizeDefaultStartupMode(defaultStartupMode);
        var options = [];

        function addOption(value, label) {
          var safeValue = normalizeDefaultStartupMode(value);
          var safeLabel = String(label || "").trim() || safeValue;

          if (options.some(function (item) {
            return item.value === safeValue;
          })) {
            return;
          }

          options.push({
            value: safeValue,
            label: safeLabel
          });
        }

        addOption(DEFAULT_STARTUP_MODE_MENU, "Aucun (Menu)");

        document.querySelectorAll(".play-mode-card[data-mode]").forEach(function (card) {
          if (!card || card.classList.contains("is-disabled")) return;

          var mode = normalizeGameMode(card.getAttribute("data-mode"));
          if (!mode || !isModeEnabled(mode)) return;

          var titleEl = card.querySelector(".play-mode-title");
          var label = titleEl ? String(titleEl.textContent || "").trim() : mode;
          if (!label) label = mode;

          addOption(mode, label);
        });

        selectEl.innerHTML = "";

        options.forEach(function (item) {
          var opt = document.createElement("option");
          opt.value = item.value;
          opt.textContent = item.label;
          selectEl.appendChild(opt);
        });

        selectEl.value = currentValue;

        if (!menuEl) return;

        menuEl.innerHTML = "";

        options.forEach(function (item) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "manager-widget-menu-item";
          btn.dataset.value = item.value;
          btn.style.justifyContent = "flex-start";
          btn.style.textAlign = "left";
          btn.style.paddingRight = "15px";

          var span = document.createElement("span");
          span.textContent = item.label;
          span.style.color = item.value === currentValue ? "#fbbf24" : "#f1f5f9";
          span.style.fontWeight = item.value === currentValue ? "700" : "600";
          span.style.textAlign = "left";

          btn.appendChild(span);

          btn.addEventListener("click", function (event) {
            event.stopPropagation();

            applyDefaultStartupMode(item.value, { syncUi: true });
            saveWidgetLayoutState();

            menuEl.hidden = true;

            if (el.overlayDefaultStartupModeDisplay) {
              el.overlayDefaultStartupModeDisplay.setAttribute("aria-expanded", "false");
            }
          });

          menuEl.appendChild(btn);
        });
      }
      function syncNotificationSoundsUi() {
        if (el.overlayNotificationSoundsEnabled) {
          el.overlayNotificationSoundsEnabled.checked = notificationSoundsEnabled === true;
        }
      }
      function syncDiscordPresenceEnabledUi() {
        if (el.overlayDiscordPresenceEnabled) {
          el.overlayDiscordPresenceEnabled.checked = discordPresenceEnabled === true;
        }
      }
      function normalizeNotificationSoundsEnabled(value) {
        return value === true || value === "true" || value === 1 || value === "1";
      }
      function normalizeDiscordPresenceEnabled(value) {
        if (value === true) return true;
        if (value === false) return false;
        var raw = String(value || "").trim().toLowerCase();
        return !(raw === "0" || raw === "false" || raw === "no" || raw === "off");
      }
      function applyNotificationSoundsEnabled(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        notificationSoundsEnabled = normalizeNotificationSoundsEnabled(value);
        if (opts.syncUi !== false) syncNotificationSoundsUi();
      }
      function applyDiscordPresenceEnabled(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        var next = normalizeDiscordPresenceEnabled(value);
        var changed = discordPresenceEnabled !== next;
        discordPresenceEnabled = next;
        if (opts.syncUi !== false) syncDiscordPresenceEnabledUi();
        if (!changed || opts.syncState === false) return;
        if (discordPresenceEnabled) {
          if (typeof startDiscordPresenceUpdates === "function") startDiscordPresenceUpdates();
        } else {
          if (typeof stopDiscordPresenceUpdates === "function") stopDiscordPresenceUpdates();
          discordPresenceLastSentAtMs = 0;
          discordPresenceRouteKey = "";
          discordPresenceRouteStartedAtSec = 0;
        }
      }
      function normalizePccVoiceReceptionMode(value) {
        var raw = String(value || "").trim().toLowerCase();
        if (raw === PCC_VOICE_RECEPTION_SOLO || raw === "only_solo") return PCC_VOICE_RECEPTION_SOLO;
        if (raw === PCC_VOICE_RECEPTION_CONVOY || raw === "convoi" || raw === "only_convoy") return PCC_VOICE_RECEPTION_CONVOY;
        if (raw === PCC_VOICE_RECEPTION_NEVER || raw === "jamais" || raw === "off" || raw === "false") return PCC_VOICE_RECEPTION_NEVER;
        return PCC_VOICE_RECEPTION_ALWAYS;
      }
      function getPccVoiceReceptionModeLabel(value) {
        var mode = normalizePccVoiceReceptionMode(value);
        if (mode === PCC_VOICE_RECEPTION_SOLO) return "Uniquement en solo";
        if (mode === PCC_VOICE_RECEPTION_CONVOY) return "Uniquement en convoi";
        if (mode === PCC_VOICE_RECEPTION_NEVER) return "Jamais";
        return "Toujours";
      }
      function syncPccVoiceReceptionModeUi() {
        var mode = normalizePccVoiceReceptionMode(pccVoiceReceptionMode);
        if (el.overlayPccVoiceReceptionMode) {
          el.overlayPccVoiceReceptionMode.value = mode;
        }
        if (el.overlayPccVoiceReceptionModeLabel) {
          el.overlayPccVoiceReceptionModeLabel.textContent = getPccVoiceReceptionModeLabel(mode);
        }
        if (el.overlayPccVoiceReceptionModeMenu) {
          el.overlayPccVoiceReceptionModeMenu.querySelectorAll(".manager-widget-menu-item[data-value]").forEach(function (item) {
            var isActive = normalizePccVoiceReceptionMode(item.dataset.value) === mode;
            item.classList.toggle("is-active", isActive);
            item.style.justifyContent = "flex-start";
            item.style.textAlign = "left";
            item.style.paddingRight = "15px";
            var span = item.querySelector("span");
            if (span) {
              span.style.color = isActive ? "#fbbf24" : "#f1f5f9";
              span.style.fontWeight = isActive ? "700" : "600";
              span.style.textAlign = "left";
            }
          });
        }
      }
      function applyPccVoiceReceptionMode(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        pccVoiceReceptionMode = normalizePccVoiceReceptionMode(value);
        if (opts.syncUi !== false) syncPccVoiceReceptionModeUi();
        if (opts.syncState !== false && typeof syncSaeivExternalState === "function") {
          saeivLastStateKey = "";
          syncSaeivExternalState(true);
        }
      }
      function applyShowExperimentalWidgets(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        showExperimentalWidgets = normalizeShowExperimentalWidgets(value);
        var removedExperimentalWidgets = false;
        if (!showExperimentalWidgets) {
          Object.keys(TYPES).forEach(function (typeRaw) {
            var type = normalizeWidgetType(typeRaw);
            if (!isType(type) || !isExperimentalWidgetType(type)) return;
            if (ensureWidgetTypeEnabled(type, false)) removedExperimentalWidgets = true;
          });
        }
        if (opts.syncUi !== false) syncShowExperimentalWidgetsUi();
        if (removedExperimentalWidgets && opts.apply !== false) apply();
      }
      function applyShowUnavailablePlayModes(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        showUnavailablePlayModes = normalizeShowUnavailablePlayModes(value);
        if (opts.syncUi !== false) syncShowUnavailablePlayModesUi();
        else if (opts.render !== false) refreshUnavailablePlayModesVisibility();
      }
      function applyStopAnnouncementSoundsEnabled(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        saeivStopAnnouncementSoundsEnabled = normalizeStopAnnouncementSoundsEnabled(value);
        if (!saeivStopAnnouncementSoundsEnabled) {
          cancelSaeivTerminusAnnouncement();
          stopSaeivRouteAudioPlayback();
        }
        if (opts.syncUi !== false) syncStopAnnouncementSoundsUi();
      }
      function applyPassengerValidationSoundsEnabled(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        saeivPassengerValidationSoundsEnabled = normalizePassengerValidationSoundsEnabled(value);
        if (saeivPassengerValidationSoundsEnabled !== true && typeof stopSaeivStopRequestAudioPlayback === "function") {
          stopSaeivStopRequestAudioPlayback();
        }
        saeivLastStateKey = "";
        if (opts.syncUi !== false) syncPassengerValidationSoundsUi();
        if (opts.syncState !== false) syncSaeivExternalState(true);
      }
      function applyHideUiWhenManagerHidden(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        hideUiWhenManagerHidden = value === true;
        if (opts.syncUi !== false) syncHideUiWhenManagerHiddenUi();
        if (opts.render !== false) renderManager();
      }
      function normalizeDefaultStartupMode(value) {
        var raw = String(value || "").trim().toLowerCase();

        if (!raw || raw === DEFAULT_STARTUP_MODE_MENU) {
          return DEFAULT_STARTUP_MODE_MENU;
        }

        var mode = normalizeGameMode(raw);

        if (!mode || !isModeEnabled(mode)) {
          return DEFAULT_STARTUP_MODE_MENU;
        }

        return mode;
      }

      function applyDefaultStartupMode(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        defaultStartupMode = normalizeDefaultStartupMode(value);

        if (opts.syncUi !== false) {
          syncDefaultStartupModeUi();
        }
      }

      function syncDefaultStartupModeUi() {
        var selectEl = el.overlayDefaultStartupMode;
        if (!selectEl) return;

        rebuildDefaultStartupModeOptions();

        var safeValue = normalizeDefaultStartupMode(defaultStartupMode);
        selectEl.value = safeValue;

        var selectedOption = Array.prototype.slice.call(selectEl.options).find(function (opt) {
          return opt.value === safeValue;
        });

        if (el.overlayDefaultStartupModeLabel) {
          el.overlayDefaultStartupModeLabel.textContent = selectedOption
            ? selectedOption.textContent
            : "Aucun (Menu)";
        }
      }

      function rebuildDefaultStartupModeOptions() {
        var selectEl = el.overlayDefaultStartupMode;
        var menuEl = el.overlayDefaultStartupModeMenu;
        if (!selectEl) return;

        var currentValue = normalizeDefaultStartupMode(defaultStartupMode);
        var options = [];

        function addOption(value, label) {
          var safeValue = normalizeDefaultStartupMode(value);
          var safeLabel = String(label || "").trim() || safeValue;

          if (options.some(function (item) {
            return item.value === safeValue;
          })) {
            return;
          }

          options.push({
            value: safeValue,
            label: safeLabel
          });
        }

        addOption(DEFAULT_STARTUP_MODE_MENU, "Aucun (Menu)");

        document.querySelectorAll(".play-mode-card[data-mode]").forEach(function (card) {
          if (!card || card.classList.contains("is-disabled")) return;

          var mode = normalizeGameMode(card.getAttribute("data-mode"));
          if (!mode || !isModeEnabled(mode)) return;

          var titleEl = card.querySelector(".play-mode-title");
          var label = titleEl ? String(titleEl.textContent || "").trim() : mode;
          if (!label) label = mode;

          addOption(mode, label);
        });

        selectEl.innerHTML = "";

        options.forEach(function (item) {
          var opt = document.createElement("option");
          opt.value = item.value;
          opt.textContent = item.label;
          selectEl.appendChild(opt);
        });

        selectEl.value = currentValue;

        if (!menuEl) return;

        menuEl.innerHTML = "";

        options.forEach(function (item) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "manager-widget-menu-item";
          btn.dataset.value = item.value;
          btn.style.justifyContent = "flex-start";
          btn.style.textAlign = "left";
          btn.style.paddingRight = "15px";

          var span = document.createElement("span");
          span.textContent = item.label;
          span.style.color = item.value === currentValue ? "#fbbf24" : "#f1f5f9";
          span.style.fontWeight = item.value === currentValue ? "700" : "600";
          span.style.textAlign = "left";

          btn.appendChild(span);

          btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            applyDefaultStartupMode(item.value, { syncUi: true });
            saveWidgetLayoutState();

            menuEl.hidden = true;

            if (el.overlayDefaultStartupModeDisplay) {
              el.overlayDefaultStartupModeDisplay.setAttribute("aria-expanded", "false");
            }
          });

          menuEl.appendChild(btn);
        });
      }
      function syncOverlayWidgetSelectedTypeFromSelect() {
        var selectEl = el.overlayWidgetAddSelect;
        if (!selectEl) {
          overlayWidgetSelectedType = "";
          return overlayWidgetSelectedType;
        }
        var value = normalizeWidgetType(String(selectEl.value || "").trim());
        if (!value || !isType(value)) value = "";
        overlayWidgetSelectedType = value;
        return overlayWidgetSelectedType;
      }
      function refreshOverlayWidgetExperimentalBadge(selectedType) {
        var badgeEl = el.overlayWidgetExperimentalBadge;
        var wrapEl = el.overlayWidgetAddSelectWrap;
        var selectEl = el.overlayWidgetAddSelect;
        var safeType = normalizeWidgetType(String(selectEl && selectEl.value || "").trim());
        var visible = !!safeType && isType(safeType) && isExperimentalWidgetType(safeType);
        if (badgeEl) badgeEl.hidden = !visible;
        if (wrapEl) wrapEl.classList.toggle("has-exp-badge", visible);
      }
      function closeOverlayWidgetAddMenu() {
        overlayWidgetMenuOpen = false;
        if (el.overlayWidgetAddMenu) el.overlayWidgetAddMenu.hidden = true;
        if (el.overlayWidgetAddDisplay) el.overlayWidgetAddDisplay.setAttribute("aria-expanded", "false");
      }
      function updateOverlayWidgetAddDisplay() {
        var selectEl = el.overlayWidgetAddSelect;
        var displayBtn = el.overlayWidgetAddDisplay;
        var displayLabel = el.overlayWidgetAddDisplayLabel;
        if (!selectEl || !displayBtn || !displayLabel) return;
        syncOverlayWidgetSelectedTypeFromSelect();
        var text = "Choisir";
        if (overlayWidgetSelectedType) {
          for (var i = 0; i < selectEl.options.length; i += 1) {
            var opt = selectEl.options[i];
            if (!opt) continue;
            if (normalizeWidgetType(String(opt.value || "").trim()) !== overlayWidgetSelectedType) continue;
            text = String(opt.textContent || "").replace(/\s*EXPERIMENTAL\s*$/i, "").trim() || text;
            break;
          }
        }
        displayLabel.textContent = text;
        var isDisabled = selectEl.disabled === true;
        displayBtn.classList.toggle("is-disabled", isDisabled);
        displayBtn.disabled = isDisabled;
        refreshOverlayWidgetExperimentalBadge(overlayWidgetSelectedType);
      }
      function rebuildOverlayWidgetAddMenu() {
        var menuEl = el.overlayWidgetAddMenu;
        var selectEl = el.overlayWidgetAddSelect;
        if (!menuEl || !selectEl) return;
        menuEl.innerHTML = "";
        for (var i = 0; i < selectEl.options.length; i += 1) {
          var option = selectEl.options[i];
          if (!option) continue;
          var value = String(option.value || "").trim();
          if (!value) continue;
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "manager-widget-menu-item";
          btn.setAttribute("role", "option");
          btn.dataset.value = value;
          var label = document.createElement("span");
          label.textContent = String(option.textContent || "").replace(/\s*EXPERIMENTAL\s*$/i, "").trim();
          btn.appendChild(label);
          if (isExperimentalWidgetType(value)) {
            var badge = document.createElement("span");
            badge.className = "manager-exp-badge";
            badge.textContent = "EXPERIMENTAL";
            btn.appendChild(badge);
          }
          btn.addEventListener("click", function (event) {
            event.preventDefault();
            var picked = normalizeWidgetType(String(this.dataset.value || ""));
            if (!isType(picked)) return;
            selectEl.value = picked;
            overlayWidgetSelectedType = picked;
            closeOverlayWidgetAddMenu();
            updateOverlayWidgetAddDisplay();
            var changeEvent = new Event("change", { bubbles: true });
            selectEl.dispatchEvent(changeEvent);
          });
          menuEl.appendChild(btn);
        }
      }
      function toggleOverlayWidgetAddMenu() {
        var menuEl = el.overlayWidgetAddMenu;
        var selectEl = el.overlayWidgetAddSelect;
        var displayBtn = el.overlayWidgetAddDisplay;
        if (!menuEl || !selectEl || !displayBtn || selectEl.disabled) return;
        var willOpen = !overlayWidgetMenuOpen;
        if (!willOpen) {
          closeOverlayWidgetAddMenu();
          return;
        }
        overlayWidgetMenuOpen = true;
        rebuildOverlayWidgetAddMenu();
        if (!menuEl.children || menuEl.children.length <= 0) {
          closeOverlayWidgetAddMenu();
          return;
        }
        menuEl.hidden = false;
        displayBtn.setAttribute("aria-expanded", "true");
      }
      function isModeEnabled(mode) {
        var safeMode = String(mode || "").trim().toLowerCase();
        if (safeMode === GAME_MODES.UBER_EATS) return ENABLE_UBER_EATS_MODE === true;
        return true;
      }
      function normalizeGameMode(mode) {
        var raw = String(mode || "").trim().toLowerCase();
        if (!raw) return "";
        if (raw === "free" || raw === "normal") return GAME_MODES.FREE;
        if (raw === "bus" || raw === "bus_mode") return GAME_MODES.BUS;
        return GAME_MODES.BUS;
      }
      function getModeConfig(mode) {
        var normalized = normalizeGameMode(mode);
        return MODE_CONFIGS[normalized] || MODE_CONFIGS[GAME_MODES.BUS];
      }
      function isTypeAllowedForMode(type, mode) {
        var cfg = getModeConfig(mode);
        if (!cfg) return true;
        var allowed = (cfg.gpsTypes || []).concat(cfg.hudTypes || []);
        return allowed.indexOf(type) >= 0;
      }

      function applyModeWidgetTypeLists(mode) {
        var cfg = getModeConfig(mode);
        GPS_WIDGET_TYPES = (Array.isArray(cfg.gpsTypes) ? cfg.gpsTypes : [])
          .map(normalizeWidgetType)
          .filter(function (type) { return isType(type); });
        HUD_WIDGET_TYPES = (Array.isArray(cfg.hudTypes) ? cfg.hudTypes : [])
          .map(normalizeWidgetType)
          .filter(function (type) { return isType(type); });
      }
      function refreshModeButtonsUi() {
        // Boutons standards (s'il y en a)
        (el.modeButtons || []).forEach(function (btn) {
          if (!btn || !btn.dataset) return;
          var mode = normalizeGameMode(btn.dataset.mode);
          var active = mode === currentGameMode;
          btn.classList.toggle("is-active", active);
        });

        // Cartes du menu principal (Onglet Jouer)
        var cards = document.querySelectorAll(".play-mode-card[data-mode]");
        cards.forEach(function (card) {
          var cardMode = card.getAttribute("data-mode");
          var isSelected = (cardMode === currentGameMode);
          var isActiveSession = (isGameUnlocked && isSelected);

          if (isSelected) {
            card.classList.add("is-selected");
          } else {
            card.classList.remove("is-selected");
          }

          if (isActiveSession) {
            card.classList.add("is-active-session");
          } else {
            card.classList.remove("is-active-session");
          }

          var tag = card.querySelector(".play-mode-beta-tag");
          if (tag) {
            tag.textContent = isActiveSession ? "SESSION EN COURS" : "Jouer";
            if (tag.hasAttribute("data-role") && tag.getAttribute("data-role") === "play-action") {
              tag.disabled = isActiveSession;
              tag.setAttribute("aria-disabled", isActiveSession ? "true" : "false");
            }
          }
        });
        refreshUnavailablePlayModesVisibility();
        syncDefaultStartupModeUi();
      }
      function setWidgetSelectOptions(selectEl, allowedTypes) {
        if (!selectEl) return;
        var currentValue = String(selectEl.value || "").trim();
        selectEl.innerHTML = "";
        var offOption = document.createElement("option");
        offOption.value = "";
        offOption.textContent = "Désactivé";
        selectEl.appendChild(offOption);
        (Array.isArray(allowedTypes) ? allowedTypes : []).forEach(function (rawType) {
          var type = normalizeWidgetType(rawType);
          if (!isType(type)) return;
          if (!showExperimentalWidgets && isExperimentalWidgetType(type)) return;
          var option = document.createElement("option");
          option.value = type;
          option.textContent = String(TYPES[type] && TYPES[type].label || type) +
            (isExperimentalWidgetType(type) ? " EXPERIMENTAL" : "");
          selectEl.appendChild(option);
        });
        var hasCurrent = false;
        for (var i = 0; i < selectEl.options.length; i += 1) {
          if (String(selectEl.options[i].value || "") === currentValue) {
            hasCurrent = true;
            break;
          }
        }
        selectEl.value = hasCurrent ? currentValue : "";
      }
      function refreshModeWidgetToolbarUi() {
        var cfg = getModeConfig(currentGameMode);
        setWidgetSelectOptions(el.widgetGpsSelect, cfg.gpsTypes);
        setWidgetSelectOptions(el.widgetHudSelect, cfg.hudTypes);
        if (el.widgetHudGroup) {
          el.widgetHudGroup.hidden = !Array.isArray(cfg.hudTypes) || !cfg.hudTypes.length;
        }
      }
      function enforceWidgetsAllowedForCurrentMode() {
        var allowed = Object.create(null);
        (GPS_WIDGET_TYPES || []).forEach(function (type) {
          var safe = normalizeWidgetType(type);
          if (isType(safe)) allowed[safe] = true;
        });
        (HUD_WIDGET_TYPES || []).forEach(function (type) {
          var safe = normalizeWidgetType(type);
          if (isType(safe)) allowed[safe] = true;
        });
        var changed = false;
        Object.keys(widgetsById).forEach(function (id) {
          var widget = widgetsById[id];
          var type = normalizeWidgetType(widget && widget.type);
          if (allowed[type]) return;
          removeWidget(id);
          changed = true;
        });
        return changed;
      }
      function ensureModeDefaultWidgetSelection() {
        var cfg = getModeConfig(currentGameMode);
        if (cfg.forceDefaultGps !== true) return false;
        var desired = normalizeWidgetType(cfg.defaultGpsType);
        if (!desired || !isType(desired)) return false;
        var currentGps = findActiveTypeByLaneOrder(GPS_WIDGET_TYPES);
        if (currentGps === desired) return false;
        return applyWidgetSelectionForGroup(GPS_WIDGET_TYPES, desired);
      }
      function clearRuntimeSessionForGameModeSwitch() {
        if (saeivRouteState && typeof saeivRouteState === "object" && typeof clearSaeivRouteSelection === "function") {
          clearSaeivRouteSelection();
          return true;
        }
        if (typeof clearManualWazeBridgeDestination === "function") {
          return clearManualWazeBridgeDestination();
        }
        return false;
      }
      function setGameMode(mode, options) {
        var opts = options && typeof options === "object" ? options : {};
        var shouldApply = opts.apply !== false;
        var shouldSwapLayout = opts.swapLayout !== false;
        var previousMode = normalizeGameMode(currentGameMode);
        var nextMode = normalizeGameMode(mode);
        var modeChanged = !!previousMode && !!nextMode && previousMode !== nextMode;

        // On sauvegarde l'état actuel avant de changer (si un mode était actif)
        if (shouldSwapLayout && currentGameMode) {
          saveWidgetLayoutState();
        }

        if (modeChanged && opts.clearRuntimeSession !== false) {
          clearRuntimeSessionForGameModeSwitch();
        }

        closeManagerTransientPanels();
        currentGameMode = nextMode;

        // On restaure l'état du nouveau mode
        if (shouldSwapLayout && currentGameMode) {
          restoreWidgetLayoutState();
        }

        applyModeWidgetTypeLists(currentGameMode);

        // NOUVEAU: On force le respect des types autorisés du nouveau mode ("pack")
        enforceWidgetsAllowedForCurrentMode();
        ensureModeDefaultWidgetSelection();

        refreshModeButtonsUi();
        refreshModeWidgetToolbarUi();

        if (shouldApply) {
          apply();
        } else {
          sanitize();
          refreshWidgetTypeSelectors();
        }
      }
