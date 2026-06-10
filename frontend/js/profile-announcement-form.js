/**
 * Returns whether an announcement is published by a shelter account.
 * @param {Object} announcement - Announcement record to inspect.
 * @returns {boolean} True when the publisher is a shelter.
 */
function isShelterAnnouncement(announcement) {
  return announcement?.publisherId?.role === 'shelter';
}

/**
 * Sets last seen mode.
 * @param {string} mode - Selected last-seen mode, either `today` or `custom`.
 * @returns {void}
 */
function setLastSeenMode(mode) {
  const todayBtn = document.getElementById('lastSeenTodayBtn');
  const customBtn = document.getElementById('lastSeenCustomBtn');
  const dateInput = document.getElementById('modal-lastSeenDate');

  const isCustom = mode === 'custom';
  todayBtn.classList.toggle('is-selected', !isCustom);
  customBtn.classList.toggle('is-selected', isCustom);
  dateInput.style.display = isCustom ? 'block' : 'none';
}

/**
 * Configures announcement type choices for normal users or shelter accounts.
 * @param {string} defaultType - Type selected when the current account may choose between lost and sighting.
 * @returns {void}
 */
function configureTypeFieldForAccount(defaultType = 'LostAnimal') {
  const typeSelect = document.getElementById('modal-type');
  if (!typeSelect) return;

  const typeTabs = document.querySelector('.type-tabs');
  const isRifugio = currentUser?.role === 'shelter';
  if (isRifugio) {
    typeSelect.innerHTML = '<option value="Sighting">In rifugio</option>';
    typeSelect.value = 'Sighting';
    typeSelect.disabled = true;
    if (typeTabs) typeTabs.style.display = 'none';
    return;
  }

  typeSelect.disabled = false;
  typeSelect.innerHTML = `
    <option value="LostAnimal">Smarrito</option>
    <option value="Sighting">Avvistamento</option>
  `;
  typeSelect.value = defaultType || 'LostAnimal';
  if (typeTabs) typeTabs.style.display = '';
}

/**
 * Returns rifugio coordinates.
 * @returns {number[]|null} Current shelter coordinates as `[longitude, latitude]`, or null when unavailable.
 */
function getRifugioCoordinates() {
  const coords = currentUser?.rifugioData?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

/**
 * Reverse geocodes a point to a short address and city string.
 * @param {number} lng - Point longitude.
 * @param {number} lat - Point latitude.
 * @returns {Promise<{address: string, city: string} | null>} Best-effort address payload.
 */
async function reverseGeocodeRifugioPosition(lng, lat) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=it&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;

    const json = await res.json();
    const addr = json?.address || {};
    const address = [addr.road, addr.house_number].filter(Boolean).join(' ').trim() || json?.display_name || '';
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || addr.county || '';

    if (!address && !city) return null;
    return { address, city };
  } catch (err) {
    console.error('Errore reverse geocoding rifugio:', err);
    return null;
  }
}

/**
 * Adapts announcement modal labels and fields for the current account role.
 * @returns {void}
 */
function configureModalLabelsForAccount() {
  const isRifugio = currentUser?.role === 'shelter';
  const dateLabel = document.getElementById('modal-lastSeenDate-label');
  const positionHint = document.getElementById('modal-position-hint');
  const positionSection = document.getElementById('modal-position-section');
  const microchipRow = document.getElementById('modal-microchip-row');
  const adoptionRow = document.getElementById('modal-adoption-row');
  const adoptionSelect = document.getElementById('modal-adoptionStatus');
  const animalNameRow = document.getElementById('modal-animal-name-row');

  if (dateLabel) dateLabel.textContent = isRifugio ? 'Data' : 'Ultima data vista';
  if (positionSection) positionSection.style.display = isRifugio ? 'none' : '';
  if (microchipRow) microchipRow.style.display = isRifugio ? '' : 'none';
  if (adoptionRow) adoptionRow.style.display = isRifugio ? '' : 'none';
  if (adoptionSelect) adoptionSelect.disabled = !isRifugio;
  if (animalNameRow) animalNameRow.style.display = '';
  if (positionHint) {
    positionHint.textContent = isRifugio
      ? 'Posizione del rifugio gia impostata. Puoi modificarla selezionando un altro punto.'
      : 'Scegli un punto sulla mappa o usa la posizione attuale.';
  }

  const step3Label = document.getElementById('wiz-sl3');
  if (step3Label) step3Label.textContent = isRifugio ? 'Immagine' : 'Luogo';
}

/**
 * Adapts animal-name requirements and helper text for the selected announcement type.
 * @param {string} type - Announcement type selected in the modal.
 * @returns {void}
 */
function configureModalFieldsForType(type) {
  const isSighting = type === 'Sighting';
  const animalNameRow = document.getElementById('modal-animal-name-row');
  const animalNameLabel = document.getElementById('modal-animal-name-label');
  const animalNameInput = document.getElementById('modal-animalName');
  const animalNameHint = document.getElementById('modal-animal-name-hint');
  const typeHint = document.getElementById('modal-type-hint');

  if (animalNameRow) animalNameRow.style.display = '';
  if (animalNameLabel) {
    animalNameLabel.textContent = isSighting ? 'Nome animale (opzionale)' : 'Nome animale';
  }
  if (animalNameInput) {
    animalNameInput.required = !isSighting;
    animalNameInput.placeholder = isSighting ? 'Es. Luna, se lo sai' : 'Es. Luna';
  }
  if (animalNameHint) {
    animalNameHint.textContent = isSighting
      ? 'Se non conosci il nome puoi lasciarlo vuoto.'
      : 'Se lo conosci, inseriscilo qui.';
  }
  if (typeHint) {
    typeHint.textContent = isSighting
      ? 'Avvistamento: compila solo i dati che conosci, il nome non è obbligatorio.'
      : 'Smarrito: inserisci i dati dell animale che stai cercando.';
  }
}

/**
 * Sets announcement saving state.
 * @param {boolean} isSaving - Whether the announcement form is currently being submitted.
 * @returns {void}
 */
function setAnnouncementSavingState(isSaving) {
  isSavingAnnouncement = isSaving;
  const progress = document.getElementById('profile-modal-progress');
  const saveButton = document.getElementById('modal-save');
  const cancelButton = document.getElementById('modal-cancel');

  if (progress) {
    progress.classList.toggle('is-visible', isSaving);
    progress.setAttribute('aria-hidden', String(!isSaving));
  }

  if (saveButton) saveButton.disabled = isSaving;
  if (cancelButton) cancelButton.disabled = isSaving;
}

/**
 * Parses modal coordinate text into GeoJSON coordinate order.
 * @param {string} input - Coordinate input in decimal or DMS notation.
 * @returns {number[]|null} `[longitude, latitude]` coordinates, or null when parsing fails.
 */
function normalizeCoordsFromInput(input) {
  if (!input) return null;
  /**
   * Parses a DMS coordinate fragment while suppressing parser errors.
   * @param {string} str - DMS latitude or longitude fragment.
   * @returns {number|null} Decimal coordinate, or null when parsing fails.
   */
  const tryDms = (str) => {
    try {
      return dmsToDecimal(str);
    } catch (e) { return null; }
  };

  let a = null, b = null;
  if (/[°'"NSWE]/i.test(input)) {
    const raw = input.split(',');
    if (raw.length !== 2) return null;
    const p1 = tryDms(raw[0].trim());
    const p2 = tryDms(raw[1].trim());
    if (p1 == null || p2 == null) return null;
    a = p1; b = p2; // these are decimal degrees; order may be lat/lng or lng/lat depending on input
  } else {
    const parts = input.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (parts.length !== 2) return null;
    [a, b] = parts;
  }
  const isA_lat = a >= 35 && a <= 47;
  const isB_lat = b >= 35 && b <= 47;
  if (isA_lat && !isB_lat) return [b, a];
  if (!isA_lat && isB_lat) return [a, b];
  return [a, b];
}

/**
 * Converts a DMS or decimal coordinate string to a decimal number.
 * @param {string} str - Coordinate string, optionally including hemisphere letters.
 * @returns {number|null} Decimal coordinate, or null when the input cannot be parsed.
 */
function dmsToDecimal(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  let hemi = null;
  const m = s.match(/[NnSsEeWw]/);
  if (m) hemi = m[0].toUpperCase();
  const cleaned = s.replace(/[NnSsEeWw]/g, '').trim();
  const dmsMatch = cleaned.match(/(\d+)[°\s]+(\d+)[\'\s]+(\d+(?:\.\d+)?)[\"\s]*/);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3]);
    let dec = deg + (min/60) + (sec/3600);
    if (hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }
  const dmMatch = cleaned.match(/(\d+)[°\s]+(\d+(?:\.\d+)?)[\'\s]*/);
  if (dmMatch) {
    const deg = parseFloat(dmMatch[1]);
    const min = parseFloat(dmMatch[2]);
    let dec = deg + (min/60);
    if (hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    let dec = num;
    if (hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }
  return null;
}

/**
 * Converts a decimal coordinate to a DMS string with hemisphere suffix.
 * @param {number} dec - Decimal coordinate value.
 * @param {string} type - Coordinate axis, either `lat` or `lng`.
 * @returns {string} DMS coordinate string, or an empty string for invalid values.
 */
function decimalToDMS(dec, type) {
  if (dec === null || dec === undefined || isNaN(dec)) return '';
  const abs = Math.abs(dec);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(2);
  let hemi = '';
  if (type === 'lat') hemi = dec >= 0 ? 'N' : 'S';
  if (type === 'lng') hemi = dec >= 0 ? 'E' : 'W';
  return `${deg}°${min}'${sec}"${hemi}`;
}

/**
 * Opens the modal for create UI.
 * @returns {void}
 */
function openModalForCreate() {
  editingId = null;
  currentEditStatus = 'ACTIVE';
  currentEditIsCurrentlyThere = false;
  document.getElementById('modal-title').textContent = 'Nuovo annuncio';
  document.getElementById('modal-save').textContent = 'Pubblica';
  configureModalLabelsForAccount();
  configureTypeFieldForAccount('LostAnimal');
  document.getElementById('modal-description').value = '';
  document.getElementById('modal-animalName').value = '';
  wizApplyChipValue('modal-species', 'Cane');
  document.getElementById('modal-breed').value = '';
  wizSetColor('Nero', document.querySelector('.color-swatch[title="Nero"]') || document.querySelector('.color-swatch.active') || document.querySelector('.color-swatch'));
  wizApplyChipValue('modal-gender', 'Sconosciuto');
  document.getElementById('modal-lunghezzaPelo').value = '';
  document.getElementById('modal-distinctiveFeatures').value = '';
  document.getElementById('modal-microchipId').value = '';
  document.getElementById('modal-photo-file').value = '';
  document.getElementById('modal-photo-preview').style.display = 'none';
  const rifugioCoords = currentUser?.role === 'shelter' ? getRifugioCoordinates() : null;
  document.getElementById('modal-coords').value = rifugioCoords ? rifugioCoords.join(',') : '';
  setLastSeenMode('today');
  document.getElementById('modal-lastSeenDate').value = '';
  document.getElementById('modal-lastSeenDate').style.display = 'none';
  document.getElementById('modal-animalBehaviour').value = 'indifferente';
  document.getElementById('modal-healthCondition').value = 'in salute';
  configureModalFieldsForType(document.getElementById('modal-type')?.value || 'LostAnimal');
  const adoptionSelect = document.getElementById('modal-adoptionStatus');
  if (adoptionSelect) {
    adoptionSelect.value = 'none';
    adoptionSelect.disabled = currentUser?.role !== 'shelter';
  }
  resetAnnouncementWizard();
  showModal(true);
}

/**
 * Opens the modal for edit UI.
 * @param {Object} ann - Announcement being edited.
 * @returns {void}
 */
function openModalForEdit(ann) {
  editingId = ann._id;
  editingAnimalId = ann.animalId?._id || ann.animalId || null;
  currentEditStatus = ann.status || 'ACTIVE';
  currentEditIsCurrentlyThere = !!ann.isCurrentlyThere;
  document.getElementById('modal-title').textContent = 'Modifica annuncio';
  document.getElementById('modal-save').textContent = 'Modifica';
  configureModalLabelsForAccount();
  configureTypeFieldForAccount(ann.type || 'LostAnimal');
  document.getElementById('modal-description').value = ann.description || '';
  document.getElementById('modal-animalName').value = ann.animalId?.name || '';
  wizApplyChipValue('modal-species', ann.animalId?.species || '');
  document.getElementById('modal-breed').value = ann.animalId?.breed || '';
  document.getElementById('modal-color').value = ann.animalId?.color || '';
  wizApplyChipValue('modal-gender', ann.animalId?.gender || 'Sconosciuto');
  document.getElementById('modal-lunghezzaPelo').value = ann.animalId?.lunghezzaPelo || '';
  document.getElementById('modal-distinctiveFeatures').value = ann.animalId?.distinctiveFeatures || '';
  document.getElementById('modal-microchipId').value = ann.animalId?.microchipId || '';
  const photo = ann.animalId?.photos?.[0] || '';
  document.getElementById('modal-photo-file').value = '';
  const preview = document.getElementById('modal-photo-preview');
  if (photo) {
    preview.src = photo;
    preview.style.display = 'block';
  } else {
    preview.src = '';
    preview.style.display = 'none';
  }
  const coords = ann.location?.coordinates;
  if (coords) {
    const lng = coords[0]; const lat = coords[1];
    document.getElementById('modal-coords').value = `${decimalToDMS(lat,'lat')}, ${decimalToDMS(lng,'lng')}`;
  } else {
    document.getElementById('modal-coords').value = '';
  }
  if (ann.lastSeenDate) {
    document.getElementById('modal-lastSeenDate').value = new Date(ann.lastSeenDate).toISOString().slice(0,10);
    setLastSeenMode('custom');
  } else {
    document.getElementById('modal-lastSeenDate').value = '';
    setLastSeenMode('today');
  }
  document.getElementById('modal-animalBehaviour').value = ann.animalBehaviour || 'indifferente';
  document.getElementById('modal-healthCondition').value = ann.healthCondition || 'in salute';
  configureModalFieldsForType(ann.type || 'LostAnimal');
  const adoptionSelectEdit = document.getElementById('modal-adoptionStatus');
  if (adoptionSelectEdit) {
    adoptionSelectEdit.value = ann.animalId?.adoptable && currentUser?.role === 'shelter' ? 'adoptable' : 'none';
    adoptionSelectEdit.disabled = currentUser?.role !== 'shelter';
  }
  resetAnnouncementWizard();
  showModal(true);
}

/**
 * Shows or hides the announcement editor modal.
 * @param {boolean} visible - Whether the modal should be visible.
 * @returns {void}
 */
function showModal(visible) {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = visible ? 'flex' : 'none';
  document.body.style.overflow = visible ? 'hidden' : '';
  if (!visible) destroyMapPicker();
}

/**
 * Initializes the Leaflet map used to pick announcement coordinates.
 * @returns {void}
 */
function initMapPicker() {
  if (mapInstance) return;
  mapInstance = L.map('modal-map').setView([46.0667,11.1333], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(mapInstance);
  mapInstance.on('click', function(e){
    const { lat, lng } = e.latlng;
    setCoordsFromLatLng(lat, lng);
  });
  requestAnimationFrame(() => mapInstance.invalidateSize());
}

/**
 * Destroys the announcement coordinate picker map and clears its marker.
 * @returns {void}
 */
function destroyMapPicker() {
  if (!mapInstance) return;
  mapInstance.off();
  mapInstance.remove();
  mapInstance = null;
  mapMarker = null;
  document.getElementById('modal-map').style.display = 'none';
}

/**
 * Sets marker.
 * @param {number} lng - Selected longitude.
 * @param {number} lat - Selected latitude.
 * @returns {void}
 */
function setMarker(lng, lat){
  if (!mapInstance) initMapPicker();
  if (mapMarker) mapMarker.setLatLng([lat,lng]); else mapMarker = L.marker([lat,lng]).addTo(mapInstance);
  mapInstance.setView([lat,lng], 15);
  document.getElementById('modal-map').style.display = 'block';
  requestAnimationFrame(() => mapInstance && mapInstance.invalidateSize());
}

/**
 * Sets coords from lat lng.
 * @param {number} lat - Selected latitude.
 * @param {number} lng - Selected longitude.
 * @returns {void}
 */
function setCoordsFromLatLng(lat, lng) {
  setMarker(lng, lat);
  document.getElementById('modal-coords').value = `${decimalToDMS(lat,'lat')}, ${decimalToDMS(lng,'lng')}`;
}

/**
 * Shows the announcement coordinate picker map and refreshes its layout.
 * @returns {void}
 */
function showMapPicker() {
  const mapEl = document.getElementById('modal-map');
  mapEl.style.display = 'block';
  if (!mapInstance) {
    initMapPicker();
  } else {
    mapInstance.invalidateSize();
  }
}

let wizStep = 1;
	const maxSteps = 4;

  /**
   * Returns whether parsed announcement coordinates are usable.
   * @param {number[]|null} coords - Parsed coordinates in `[longitude, latitude]` order.
   * @returns {boolean} True when both coordinate values are finite.
   */
  function hasValidAnnouncementCoords(coords) {
    return Array.isArray(coords)
      && coords.length === 2
      && Number.isFinite(coords[0])
      && Number.isFinite(coords[1]);
  }

  /**
   * Builds the first validation error for a wizard step.
   * @param {number} step - Wizard step to validate.
   * @returns {{step:number,message:string,focusId?:string}|null} Validation error, or null when valid.
   */
  function getAnnouncementWizardStepError(step) {
    const type = document.getElementById('modal-type')?.value || '';
    const species = document.getElementById('modal-species')?.value?.trim() || '';
    const animalName = document.getElementById('modal-animalName')?.value?.trim() || '';
    const color = document.getElementById('modal-color')?.value?.trim() || '';

    if (step === 1) {
      if (!type) {
        return { step, message: 'Seleziona il tipo di annuncio.' };
      }
      if (!species) {
        return { step, message: 'Seleziona la specie dell animale.' };
      }
      if (type === 'LostAnimal' && !animalName) {
        return { step, message: 'Inserisci il nome del tuo amico a quattro zampe!', focusId: 'modal-animalName' };
      }
    }

    if (step === 2 && !color) {
      return { step, message: 'Seleziona il colore dell animale.' };
    }

    if (step === 3) {
      const customDateSelected = document.getElementById('lastSeenCustomBtn')?.classList.contains('is-selected');
      const lastSeenDate = document.getElementById('modal-lastSeenDate')?.value || '';
      if (customDateSelected && !lastSeenDate) {
        return { step, message: 'Inserisci la data oppure seleziona Oggi.', focusId: 'modal-lastSeenDate' };
      }

      const coordsInput = document.getElementById('modal-coords')?.value?.trim() || '';
      const coords = normalizeCoordsFromInput(coordsInput);
      if (!hasValidAnnouncementCoords(coords)) {
        const isShelter = currentUser?.role === 'shelter';
        return {
          step,
          message: isShelter
            ? 'La posizione del rifugio non e disponibile. Salvala nei dati profilo prima di pubblicare.'
            : 'Seleziona la posizione sulla mappa o usa la tua posizione.',
          focusId: isShelter ? undefined : 'pickOnMap'
        };
      }
    }

    return null;
  }

  /**
   * Finds the first validation error up to a wizard step.
   * @param {number} stepLimit - Last step to validate.
   * @returns {{step:number,message:string,focusId?:string}|null} First validation error, or null when valid.
   */
  function getFirstAnnouncementWizardError(stepLimit) {
    const limit = Math.min(stepLimit || maxSteps, maxSteps);
    for (let step = 1; step <= limit; step++) {
      const error = getAnnouncementWizardStepError(step);
      if (error) return error;
    }
    return null;
  }

  /**
   * Shows a wizard validation message and moves the UI to the failing step.
   * @param {{step:number,message:string,focusId?:string}|null} error - Validation error to show.
   * @returns {Promise<boolean>} False when a validation error was shown.
   */
  async function showAnnouncementWizardError(error) {
    if (!error) return true;
    if (error.step && wizStep !== error.step) {
      wizStep = error.step;
      wizUpdateUI();
    }
    await showSiteAlert(error.message);
    if (error.focusId) {
      const focusEl = document.getElementById(error.focusId);
      if (focusEl && typeof focusEl.focus === 'function' && focusEl.type !== 'hidden') {
        focusEl.focus();
      }
    }
    return false;
  }

  /**
   * Validates the current wizard step.
   * @param {number} step - Step to validate.
   * @returns {Promise<boolean>} True when the step can be left.
   */
  async function validateAnnouncementWizardStep(step) {
    return showAnnouncementWizardError(getAnnouncementWizardStepError(step));
  }

  /**
   * Validates all wizard steps up to the provided step.
   * @param {number} stepLimit - Last step to validate.
   * @returns {Promise<boolean>} True when all requested steps are valid.
   */
  async function validateAnnouncementWizardThroughStep(stepLimit) {
    return showAnnouncementWizardError(getFirstAnnouncementWizardError(stepLimit));
  }

  /**
   * Resets the announcement wizard to the first step and refreshes its UI.
   * @returns {void}
   */
  function resetAnnouncementWizard() {
    wizStep = 1;
    wizUpdateUI();
  }

	function wizUpdateUI() {
		// Aggiorna Pannelli
		for(let i=1; i<=maxSteps; i++) {
			document.getElementById('wiz-panel'+i).classList.remove('active');
			if(i === wizStep) document.getElementById('wiz-panel'+i).classList.add('active');
		}
		// Aggiorna Stepper (Pallini in alto)
		for(let i=1; i<=maxSteps; i++) {
			const circle = document.getElementById('wiz-sc'+i);
			const label = document.getElementById('wiz-sl'+i);
			const line = document.getElementById('wiz-line'+i);

			if (i < wizStep) {
				circle.className = 'step-circle done'; circle.textContent = '✓';
				label.className = 'step-label done';
			} else if (i === wizStep) {
				circle.className = 'step-circle active'; circle.textContent = i;
				label.className = 'step-label active';
			} else {
				circle.className = 'step-circle todo'; circle.textContent = i;
				label.className = 'step-label todo';
			}
			if (line) line.className = (i < wizStep) ? 'step-line done' : 'step-line';
		}

		// Aggiorna Bottoni in basso
		document.getElementById('wiz-stepCounter').textContent = `Passo ${wizStep} di ${maxSteps}`;
		document.getElementById('wiz-btnBack').style.display = (wizStep > 1) ? 'block' : 'none';
		document.getElementById('wiz-btnNext').style.display = (wizStep < maxSteps) ? 'block' : 'none';
		document.getElementById('modal-save').style.display = (wizStep === maxSteps) ? 'block' : 'none';

		// Fix mappa (Leaflet a volte non carica bene i tile se il div era nascosto)
		if (wizStep === 3 && typeof mapInstance !== 'undefined' && mapInstance) {
			setTimeout(() => mapInstance.invalidateSize(), 100);
		}

    // Aggiorna riepilogo dinamico
    try {
      const species = (document.getElementById('modal-species') || {}).value || '';
      const gender = (document.getElementById('modal-gender') || {}).value || '';
      document.getElementById('summary-base').textContent = (species && gender)
        ? `✔️ Dati base inseriti: ${species} • ${gender}`
        : '❌ Dati base inseriti (Specie e Genere)';

      const color = (document.getElementById('modal-color') || {}).value || '';
      const fur = (document.getElementById('modal-lunghezzaPelo') || {}).value || '';
      document.getElementById('summary-aspect').textContent = (color || fur) ? `✔️ Aspetto: ${color || '—'} • ${fur || '—'}` : '❌ Dettagli aspetto completati';

      const coords = (document.getElementById('modal-coords') || {}).value || '';
      const lastSeenInput = document.getElementById('modal-lastSeenDate');
      const lastSeen = (lastSeenInput || {}).value || '';
      const customDateSelected = document.getElementById('lastSeenCustomBtn')?.classList.contains('is-selected');
      const hasValidDate = customDateSelected ? Boolean(lastSeen) : true;
      const dateLabel = customDateSelected ? lastSeen : 'oggi';
      document.getElementById('summary-location').textContent = (coords && hasValidDate)
        ? `✔️ Posizione: impostata • Data: ${dateLabel}`
        : '❌ Posizione e data impostate';
    } catch (e) {}
	}

  /**
   * Advances the announcement wizard after validating the current step.
   * @returns {Promise<void>} Promise resolving after the wizard UI is updated.
   */
	async function wizNextStep() {
    if (wizStep >= maxSteps) return;
    if (!(await validateAnnouncementWizardStep(wizStep))) return;
    wizStep++;
    wizUpdateUI();
  }
  /**
   * Moves the announcement wizard to the previous step.
   * @returns {void}
   */
	function wizPrevStep() { if(wizStep > 1) { wizStep--; wizUpdateUI(); } }

	// Tasto "Tipo Annuncio" (Smarrito / Avvistamento)
  /**
   * Selects the announcement type and notifies dependent form logic.
   * @param {string} val - Announcement type value.
   * @param {HTMLElement} el - Type tab selected by the user.
   * @returns {void}
   */
	function wizSelectType(val, el) {
		document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
		el.classList.add('active');
		const select = document.getElementById('modal-type');
		select.value = val;
		select.dispatchEvent(new Event('change'));
	}

	// Tasti "Chips" generici (Cane/Gatto, Pelo, Genere)
  /**
   * Applies a wizard chip selection to a hidden input and emits its change event.
   * @param {string} hiddenId - Hidden input id controlled by the chip group.
   * @param {string} val - Value selected by the chip.
   * @param {HTMLElement} el - Chip selected by the user.
   * @returns {void}
   */
	function wizSetChip(hiddenId, val, el) {
		const group = el.closest('.chip-group');
		group.querySelectorAll('.wiz-chip').forEach(c => c.classList.remove('active'));
		el.classList.add('active');

		const hiddenInput = document.getElementById(hiddenId);
		hiddenInput.value = val;
		hiddenInput.dispatchEvent(new Event('change'));
	}

  /**
   * Synchronizes hidden chip input state from a value already stored in the form.
   * @param {string} hiddenId - Hidden input id controlled by the chip group.
   * @param {string} value - Value that should appear selected.
   * @returns {void}
   */
  function wizApplyChipValue(hiddenId, value) {
    const hiddenInput = document.getElementById(hiddenId);
    if (!hiddenInput) return;

    hiddenInput.value = value || '';
    const chips = Array.from(document.querySelectorAll('.wiz-chip[onclick]'))
      .filter((chip) => (chip.getAttribute('onclick') || '').includes(`'${hiddenId}'`));

    chips.forEach((chip) => {
      const marker = `,'${value}'`;
      const onclick = (chip.getAttribute('onclick') || '').replace(/\s+/g, '');
      chip.classList.toggle('active', Boolean(value) && onclick.includes(marker));
    });

    hiddenInput.dispatchEvent(new Event('change'));
  }

  /**
   * Selects the color swatch and syncs the hidden color input.
   * @param {string} val - Color value to apply.
   * @param {HTMLElement} el - Swatch element to mark as active.
   * @returns {void}
   */
	// Tasti "Colore"
	function wizSetColor(val, el) {
		document.querySelectorAll('.color-swatch').forEach(c => c.classList.remove('active'));
		el.classList.add('active');
		document.getElementById('modal-color').value = val;
    const hidden = document.getElementById('modal-color');
    if (hidden) hidden.dispatchEvent(new Event('change'));
	}

	// Resetta il wizard quando si apre il form annuncio.
	const originalOpen = window.openModalForCreate;
	if(originalOpen) {
		window.openModalForCreate = function() {
			wizStep = 1; wizUpdateUI();
			originalOpen();
		}
	}
	const originalEdit = window.openModalForEdit;
	if(originalEdit) {
		window.openModalForEdit = function(ann) {
			wizStep = 1; wizUpdateUI();
			originalEdit(ann);
		}
	}
