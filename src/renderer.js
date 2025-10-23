// renderer.js

const listEl = document.getElementById("list");
const footerEl = document.getElementById("footer");
const refreshBtn = document.getElementById("refresh");
const closeBtn = document.getElementById("close");
const settingsBtn = document.getElementById("settings");
const weekdayEl = document.getElementById("weekday");
const rootEl = document.getElementById("Tímatalva");
const santaHat = document.getElementById("santaHat");

// Notification toggle:

const NOTIF_KEY = "untis.notifications";
const notifToggle = document.getElementById("notifToggle");

if (notifToggle) {
  notifToggle.checked = localStorage.getItem(NOTIF_KEY) !== "off";
  notifToggle.onchange = () => {
    const enabled = notifToggle.checked;
    localStorage.setItem(NOTIF_KEY, enabled ? "on" : "off");
    if (window.untis && window.untis.setNotificationsEnabled) {
      window.untis.setNotificationsEnabled(enabled);
    }
  };
}

// Header line 2 (selected element label)
const titleSelectedEl = document.getElementById("titleSelected");

// Modal elements
const modal = document.getElementById("modal");
const modeClassBtn = document.getElementById("modeClass");
const modeTeacherBtn = document.getElementById("modeTeacher");
const classSelect = document.getElementById("classSelect");
const teacherSelect = document.getElementById("teacherSelect");
const filterInput = document.getElementById("filterInput");
const saveNameBtn = document.getElementById("saveName");
const cancelModalBtn = document.getElementById("cancelModal");
const modalError = document.getElementById("modalError");
const helpBtn = document.getElementById("helpBtn");

// Manual subject search elements
const toggleSubjectBtn = document.getElementById("toggleSubjectBtn");
const subjectSearchContainer = document.getElementById("subject-search-container");
const manualSubjectInput = document.getElementById("manualSubjectInput");
const manualSuggestionsContainer = document.getElementById("manual-suggestions-container");
const selectedSubjectsContainer = document.getElementById("selected-subjects-container");
const selectedSubjectsList = document.getElementById("selected-subjects-list");

const LS_KEY = "untis.elements"; // Note the 's'

let resolvedElements = []; // This is now an array
let cachedLists = null;
let allSubjects = []; // Cache for all subjects
let refreshTimer = null;
let currentReqId = 0;
let midnightTimer = null;
let endOfDayTimer = null;
let mode = "class"; // "class" | "teacher"
let isLoading = false;

// track which date we are viewing
let viewingTomorrow = false;
let viewingDateISO = null; // YYYY-MM-DD when viewing tomorrow; null when viewing today

/* ---------- utils ---------- */
function isoOf(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ---------- Weekday pill ---------- */
function setWeekdayLabel() {
  if (!weekdayEl) return;
  if (viewingTomorrow) { weekdayEl.textContent = "í morgin"; return; }
  const foDays = [
    "Sunnudagur","Mánadagur","Týsdagur",
    "Mikudagur","Hósdagur","Fríggjadagur","Leygardagur"
  ];
  weekdayEl.textContent = foDays[new Date().getDay()];
}
function scheduleMidnightRollover() {
  if (midnightTimer) { clearTimeout(midnightTimer); midnightTimer = null; }
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0); // 00:00:01
  const ms = Math.max(1000, next - now);
  midnightTimer = setTimeout(() => {
    // new day starts → stop viewing "tomorrow"
    viewingTomorrow = false;
    viewingDateISO = null;
    setWeekdayLabel();
    if (!document.hidden) load();
    scheduleMidnightRollover();
  }, ms);
}

/* ---------- Window auto-resize (de-jitter + modal-aware) ---------- */
let lastSentH = 0;
function sendContentHeight() {
  try {
    if (!window.untis || typeof window.untis.resizeTo !== "function") return;

    const base = (() => {
      const el = document.getElementById("Tímatalva");
      return el ? Math.ceil(el.getBoundingClientRect().height) : 0;
    })();

    let needed = base;
    if (modal && !modal.classList.contains("hidden")) {
      const card = modal.querySelector(".modal-card");
      if (card) {
        const r = card.getBoundingClientRect();
        needed = Math.max(needed, Math.ceil(r.height + 32));
      }
    }

    if (needed > 20 && Math.abs(needed - lastSentH) >= 2) {
      lastSentH = needed;
      window.untis.resizeTo({ height: needed, id: window.untis.winId });
    }
  } catch {}
}
const ro = new ResizeObserver(() => requestAnimationFrame(sendContentHeight));
if (rootEl) ro.observe(rootEl);
const modalCardEl = document.querySelector(".modal-card");
if (modalCardEl) ro.observe(modalCardEl);

/* ---------- Time formatting ---------- */
function fmt(t) {
  try {
    return new Date(t).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch {
    return "—"; }
}

/* ---------- Helpers: clear after last lesson ends (for today view) ---------- */
function scheduleEndOfDayClear(lastEndMs) {
  if (endOfDayTimer) { clearTimeout(endOfDayTimer); endOfDayTimer = null; }
  const delay = lastEndMs - Date.now();
  if (delay > 500) {
    endOfDayTimer = setTimeout(() => { load(); }, delay + 1000);
  }
}

/* ---------- Smart Render ---------- */
function renderSingleLesson(lesson) {
  return `
    <div class="left">
      <div class="subject">${lesson.subject || "—"}</div>
      <div class="meta">${fmt(lesson.start)} – ${fmt(lesson.end)} • ${lesson.room || "—"}${lesson.teacher ? " • " + lesson.teacher : ""}</div>
    </div>
  `;
}

function smartRender(lessons) {
  // Sort lessons by start time
  const sortedLessons = lessons.slice().sort((a, b) => new Date(a.start) - new Date(b.start));

  // Handle empty state
  if (sortedLessons.length === 0) {
    listEl.innerHTML = `<div class="empty">${viewingTomorrow ? "Oyoy - tú hevur frí í morgin 🍹" : "Stoyki, tú hevur frí nú 🐸"}</div>`;
    footerEl.textContent = new Date().toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    sendContentHeight();
    return;
  }

  // Decide if breaks should be shown
  let showCoffeeBreak = false;
  let showLunchBreak = false;
  const today = new Date();
  const coffeeEndTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 40, 0, 0).getTime();
  const lunchEndTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 45, 0, 0).getTime();

  showCoffeeBreak = sortedLessons.some(lesson => new Date(lesson.start).getTime() >= coffeeEndTime);
  showLunchBreak = sortedLessons.some(lesson => new Date(lesson.start).getTime() >= lunchEndTime);

  // Group overlapping lessons
  const groups = [];
  let currentGroup = [];
  for (const lesson of sortedLessons) {
    if (currentGroup.length === 0 || new Date(lesson.start) < new Date(currentGroup[currentGroup.length - 1].end)) {
      currentGroup.push(lesson);
    } else {
      groups.push(currentGroup);
      currentGroup = [lesson];
    }
  }
  if (currentGroup.length) groups.push(currentGroup);

  const finalElements = [];

  groups.forEach((group, index) => {
    const key = group.map(l => `${l.id}-${l.isCancelled}`).sort().join('|');
    const el = document.createElement('div');
    el.dataset.key = key;

    if (group.length === 1) {
      const lesson = group[0];
      el.className = `card ${lesson.isCancelled ? "Avlýst 🎈" : ""}`;
      el.innerHTML = renderSingleLesson(lesson);
    } else {
      el.className = 'overlap-group';
      el.innerHTML = group.map(l => `
        <div class="card${l.isCancelled ? " Avlýst 🎈" : ""}">
          ${renderSingleLesson(l)}
        </div>
      `).join('');
    }
    finalElements.push(el);

    // Check for breaks after this group
    const lastLessonEnd = new Date(group[group.length - 1].end);
    const nextGroup = groups[index + 1];
    
    if (showCoffeeBreak) {
      const coffeeStart = new Date(lastLessonEnd.getFullYear(), lastLessonEnd.getMonth(), lastLessonEnd.getDate(), 9, 20);
      const coffeeEnd = new Date(lastLessonEnd.getFullYear(), lastLessonEnd.getMonth(), lastLessonEnd.getDate(), 9, 40);
      if (lastLessonEnd <= coffeeStart && nextGroup && new Date(nextGroup[0].start) >= coffeeEnd) {
        const breakEl = document.createElement('div');
        breakEl.className = 'break-indicator coffee-break';
        breakEl.dataset.key = 'coffee-break';
        finalElements.push(breakEl);
        showCoffeeBreak = false; // Only show once
      }
    }
    
    if (showLunchBreak) {
      const lunchStart = new Date(lastLessonEnd.getFullYear(), lastLessonEnd.getMonth(), lastLessonEnd.getDate(), 12, 15);
      const lunchEnd = new Date(lastLessonEnd.getFullYear(), lastLessonEnd.getMonth(), lastLessonEnd.getDate(), 12, 45);
      if (lastLessonEnd <= lunchStart && nextGroup && new Date(nextGroup[0].start) >= lunchEnd) {
        const breakEl = document.createElement('div');
        breakEl.className = 'break-indicator lunch-break';
        breakEl.dataset.key = 'lunch-break';
        finalElements.push(breakEl);
        showLunchBreak = false; // Only show once
      }
    }
  });

  // Efficiently update the DOM using replaceChildren
  listEl.replaceChildren(...finalElements);

  footerEl.textContent = new Date().toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  sendContentHeight();
}


/* ---------- Render ---------- */
function render(lessons) {
  // Sort lessons by start time
  lessons = lessons.slice().sort((a, b) => new Date(a.start) - new Date(b.start));

  // Group overlapping lessons
  const groups = [];
  let currentGroup = [];

  for (const lesson of lessons) {
    if (
      currentGroup.length === 0 ||
      new Date(lesson.start) < new Date(currentGroup[currentGroup.length - 1].end)
    ) {
      currentGroup.push(lesson);
    } else {
      groups.push(currentGroup);
      currentGroup = [lesson];
    }
  }
  if (currentGroup.length) groups.push(currentGroup);

  // Render groups
  listEl.innerHTML = groups.length
    ? groups
        .map(group =>
          group.length === 1
            ? `<div class="card ${group[0].isCancelled ? "Avlýst 🎈" : ""}">
                <div class="left">
                  <div class="subject">${group[0].subject || "—"}</div>
                  <div class="meta">${fmt(group[0].start)} – ${fmt(group[0].end)} • ${group[0].room || "—"}${group[0].teacher ? " • " + group[0].teacher : ""}</div>
                </div>
              </div>`
            : `<div class="overlap-group">
                ${group
                  .map(
                    l => `<div class="card ${l.isCancelled ? "Avlýst 🎈" : ""}">
                      <div class="left">
                        <div class="subject">${l.subject || "—"}</div>
                        <div class="meta">${fmt(l.start)} – ${fmt(l.end)} • ${l.room || "—"}${l.teacher ? " • " + l.teacher : ""}</div>
                      </div>
                    </div>`
                  )
                  .join("")}
              </div>`
        )
        .join("")
    : `<div class="empty">${viewingTomorrow ? "Oyoy - tú hevur frí í morgin 🍹" : "Stoyki, tú hevur frí nú 🐸"}</div>`;

  footerEl.textContent = new Date().toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  sendContentHeight();
}

function updateTitleSelected() {
  const primary = resolvedElements?.[0];
  if (primary && primary.id === -1) {
      titleSelectedEl.textContent = "Egin";
  } else {
      titleSelectedEl.textContent =
        (primary && primary.label) ||
        (window.untis && window.untis.defaultName) || "";
  }
}

function clearRefreshTimer() {
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
}
function scheduleNextRefresh(lessons) {
  clearRefreshTimer();
  if (document.hidden) return;

  // If viewing tomorrow, no need for frequent refreshes.
  if (viewingTomorrow) {
    refreshTimer = setTimeout(() => { if (!document.hidden) load(); }, 30 * 60 * 1000);
    return;
  }

  const now = Date.now();
  let nextMs = 15 * 60 * 1000;
  if (Array.isArray(lessons) && lessons.length) {
    const upcoming = lessons
      .filter(l => new Date(l.start).getTime() > now)
      .sort((a,b) => +new Date(a.start) - +new Date(b.start))[0];
    if (upcoming) {
      const eta = new Date(upcoming.start).getTime() - now - 2 * 60 * 1000;
      if (eta > 10 * 1000) nextMs = Math.min(nextMs, eta);
    }
  }
  refreshTimer = setTimeout(() => { if (!document.hidden) load(); }, nextMs);
}

/* ---------- Load (today or tomorrow after 18:00) ---------- */
async function load() {
  if (isLoading) {
    console.warn("Load already in progress, skipping.");
    return;
  }
  isLoading = true;

  try {
    const api = window.untis;
    if (!api) throw new Error("Preload ikki løtt.");

    const reqId = ++currentReqId;

    setWeekdayLabel();

    if (!resolvedElements.length) {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) { try { resolvedElements = JSON.parse(saved); } catch {} }
    }
    if (!resolvedElements.length) {
      const name = (api && api.defaultName) || "M5";
      const r = await api.resolveElementByName(name);
      if (reqId !== currentReqId) return;
      resolvedElements = [r]; // Start with an array
      localStorage.setItem(LS_KEY, JSON.stringify(resolvedElements));
    }

    updateTitleSelected();

    // Fetch lessons for all resolved elements
    const allLessonsPromises = resolvedElements
        .filter(element => element.id !== -1) // Filter out the empty element
        .map(element => 
            api.getToday(element.id, element.type)
    );
    const lessonGroups = await Promise.all(allLessonsPromises);
    if (reqId !== currentReqId) return;

    const lessonMap = new Map();
    for (const lessonList of lessonGroups) {
        for (const lesson of lessonList) {
            // Use lesson ID as the key for deduplication
            if (lesson.id && !lessonMap.has(lesson.id)) {
                lessonMap.set(lesson.id, lesson);
            }
        }
    }
    const todayLessons = Array.from(lessonMap.values());

    const now = new Date();
    const hour = now.getHours();

    let view = todayLessons.slice();
    let showTomorrow = false;

    if (view.length) {
      const lastEnd = Math.max(...view.map(l => new Date(l.end).getTime()));
      if (Date.now() >= lastEnd) {
        showTomorrow = hour >= 18;
        if (!showTomorrow) {
          // Day is over, show the "free now" message.
          listEl.innerHTML = `<div class="empty">Stoyki, tú hevur frí nú 🐸</div>`;
          requestAnimationFrame(sendContentHeight);
          scheduleNextRefresh([]);
          isLoading = false; // Set isLoading to false before returning
          return;
        }
      } else {
        scheduleEndOfDayClear(lastEnd);
      }
    } else {
      showTomorrow = hour >= 18;
    }

    if (showTomorrow) {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const iso = isoOf(tomorrow);
      viewingTomorrow = true;
      viewingDateISO = iso;
      setWeekdayLabel();

      try {
        const tomorrowPromises = resolvedElements
            .filter(element => element.id !== -1) // Filter out the empty element
            .map(element => 
                api.getForDate(element.id, element.type, iso)
        );
        const tomorrowGroups = await Promise.all(tomorrowPromises);
        if (reqId !== currentReqId) return;

        const tomorrowLessonMap = new Map();
        for (const lessonList of tomorrowGroups) {
            for (const lesson of lessonList) {
                if (lesson.id && !tomorrowLessonMap.has(lesson.id)) {
                    tomorrowLessonMap.set(lesson.id, lesson);
                }
            }
        }
        const tomorrowLessons = Array.from(tomorrowLessonMap.values());

        smartRender(tomorrowLessons);
        // do not schedule toasts for tomorrow
        scheduleNextRefresh(tomorrowLessons);
      } catch (e) {
        // Also catch errors when fetching tomorrow's schedule
        console.error("fann ongar tímar í morgin", e);
        listEl.innerHTML = `<div class="empty">.... hvar fór internetið ? 🤓</div>`;
        requestAnimationFrame(sendContentHeight);
      }
      isLoading = false; // Set isLoading to false before returning
      return;
    }

    // viewing today
    viewingTomorrow = false;
    viewingDateISO = null;
    setWeekdayLabel();

    smartRender(view);
    api.scheduleToasts(todayLessons);
    scheduleNextRefresh(todayLessons);
} catch (e) {
  console.error(e);
  listEl.innerHTML = `<div class="empty">.... hvar fór internetið ? 🤓</div>`;
  requestAnimationFrame(sendContentHeight);
} finally {
    isLoading = false;
  }
}
 // } catch (e) {
 //   console.error(e);
 //   listEl.innerHTML = `<div class="empty">${viewingTomorrow ? "hov... hvar fór internetið ? 🤓" : `Villa: ${e.message || e}`}</div>`;
 //   requestAnimationFrame(sendContentHeight);
 //   scheduleNextRefresh([]);
 // }
/* ---------- Settings modal ---------- */
function setMode(next) {
  if (next === mode) return;
  mode = next;
  modeClassBtn.classList.toggle("active", mode === "class");
  modeTeacherBtn.classList.toggle("active", mode === "teacher");
  classSelect.classList.toggle("hidden", mode !== "class");
  teacherSelect.classList.toggle("hidden", mode !== "teacher");
  fillOptions();
}

function openModal() {
  cachedLists = null; // Force refresh of lists
  modal.classList.remove("hidden");
  modalError.textContent = "";

  // Disable selects to prevent race condition
  classSelect.disabled = true;
  teacherSelect.disabled = true;

  // Reset subject search UI on open
  subjectSearchContainer.classList.add("hidden");
  toggleSubjectBtn.classList.remove("active");

  renderSelectedSubjects(); // Render the list of selected subjects
  if (newSwitchRow) {
    newSwitchRow.classList.add("hidden");
  }
  ensureLists().then(() => {
    // Cache all subjects for live search
    allSubjects = cachedLists?.subjects || [];

    const primary = resolvedElements?.[0];
    mode = (primary && primary.type === 2) ? "teacher" : "class";
    modeClassBtn.classList.toggle("active", mode === "class");
    modeTeacherBtn.classList.toggle("active", mode === "teacher");
    classSelect.classList.toggle("hidden", mode !== "class");
    teacherSelect.classList.toggle("hidden", mode !== "teacher");
    fillOptions();

    // Re-enable the selects now that they are populated
    classSelect.disabled = false;
    teacherSelect.disabled = false;

    setTimeout(() => filterInput.focus(), 50);
    if (!cachedLists?.meta?.classesAvailable && !cachedLists?.meta?.teachersAvailable) {
      modalError.textContent = "Er internetið horvið ? 🤓";
    }
    requestAnimationFrame(sendContentHeight);
  });
}
function closeModal() {
  modal.classList.add("hidden");
  modalError.textContent = "";
  requestAnimationFrame(sendContentHeight);
}

async function removeSubject(index) {
  if (index > 0 && index < resolvedElements.length) {
    resolvedElements.splice(index, 1);
    localStorage.setItem(LS_KEY, JSON.stringify(resolvedElements));
    renderSelectedSubjects();
    await load();
  }
}

function renderSelectedSubjects() {
  // Clear previous list
  selectedSubjectsList.innerHTML = "";

  // Don't show for only one (primary) element
  if (resolvedElements.length <= 1) {
    selectedSubjectsContainer.style.display = "none";
    return;
  }

  // Show the container
  selectedSubjectsContainer.style.display = "";

  // Create a pill for each additional element (skip the primary one)
  resolvedElements.slice(1).forEach((element, index) => {
    const pill = document.createElement("div");
    pill.className = "subject-pill";
    
    const label = document.createElement("span");
    label.textContent = element.label;
    pill.appendChild(label);

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-pill-btn";
    removeBtn.innerHTML = "&times;";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      // The actual index in resolvedElements is index + 1
      removeSubject(index + 1);
    };

    pill.appendChild(removeBtn);
    selectedSubjectsList.appendChild(pill);
  });
  requestAnimationFrame(sendContentHeight);
}

async function ensureLists() {
  if (cachedLists) return;
  try { cachedLists = await window.untis.listElements(); }
  catch (e) {
    modalError.textContent = "Yvirlitið kundi ikki heintast.";
    cachedLists = { classes: [], teachers: [], subjects: [], meta: { classesAvailable: false, teachersAvailable: false } };
  }
}
function fillOptions() {
  const filter = (filterInput.value || "").trim().toLowerCase();
  const primaryElement = resolvedElements?.[0];
  const selectedLabel = primaryElement?.label;

  const fill = (sel, arr, selectedLabel, typeNum) => {
    sel.innerHTML = "";

    // Add the empty option for classes
    if (typeNum === 1 && !filter) {
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "-1";
        emptyOpt.textContent = "Egin flokkur";
        emptyOpt.dataset.id = "-1";
        emptyOpt.dataset.type = "1";
        // Select if primary is the empty one or if there's no primary
        if (!primaryElement || primaryElement.id === -1) {
            emptyOpt.selected = true;
        }
        sel.appendChild(emptyOpt);
    }

    for (const item of (arr || [])) {
      const label = String(item.label || "").trim();
      if (filter && !label.toLowerCase().includes(filter)) continue;
      const opt = document.createElement("option");
      opt.value = String(item.id);
      opt.textContent = label;                 // initials for teachers, names for classes
      opt.dataset.id = String(item.id);
      opt.dataset.type = String(typeNum);
      if (selectedLabel && label === selectedLabel) opt.selected = true;
      sel.appendChild(opt);
    }
    if (!sel.value && sel.options.length) sel.options[0].selected = true;
  };

  if (mode === "class") {
    fill(classSelect, cachedLists?.classes, selectedLabel, 1);
  } else {
    fill(teacherSelect, cachedLists?.teachers, selectedLabel, 2);
  }

  requestAnimationFrame(sendContentHeight);
}

/* ---------- Manual Subject Search ---------- */
function updateManualSuggestions(query) {
  manualSuggestionsContainer.innerHTML = "";
  if (!query) return;

  const lowerQuery = query.toLowerCase();
  const suggestions = allSubjects
    .filter(subject =>
      (subject.longName || subject.name).toLowerCase().includes(lowerQuery)
    )
    .slice(0, 50); // Limit suggestions

  suggestions.forEach(subject => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.textContent = subject.longName || subject.name;
    item.addEventListener("mousedown", () => {
      manualSubjectInput.value = subject.longName || subject.name;
      manualSuggestionsContainer.innerHTML = "";
      saveSubjectSelection(subject);
    });
    manualSuggestionsContainer.appendChild(item);
  });
}

async function saveSubjectSelection(subject) {
  if (subject && subject.id) {
    const newElement = {
      id: Number(subject.id),
      type: 3, // WebUntisElementType.SUBJECT
      label: subject.longName || subject.name
    };

    // Add subject to list, preventing duplicates
    if (!resolvedElements.find(el => el.id === newElement.id && el.type === newElement.type)) {
      resolvedElements.push(newElement);
      localStorage.setItem(LS_KEY, JSON.stringify(resolvedElements));
    }

    // Clear the input for the next search
    manualSubjectInput.value = "";
    manualSuggestionsContainer.innerHTML = "";
    renderSelectedSubjects(); // Re-render the list of selected subjects

    // No longer closing modal, just reloading data in the background
    updateTitleSelected();
    await load();
  }
}

/* Save selection */
async function saveSelection() {
  const activeSel = (mode === "class") ? classSelect : teacherSelect;
  const opt = activeSel.options[activeSel.selectedIndex];

  const saveNewPrimary = async (newPrimary) => {
    // Keep existing subjects (elements from index 1 onwards)
    const existingSubjects = resolvedElements.slice(1);
    resolvedElements = [newPrimary, ...existingSubjects];
    localStorage.setItem(LS_KEY, JSON.stringify(resolvedElements));
    closeModal();
    updateTitleSelected();
    await load();
  };

  if (opt && opt.dataset && opt.dataset.id) {
    const id = Number(opt.dataset.id);
    // Handle the "empty" class selection
    if (id === -1) {
        await saveNewPrimary({ id: -1, type: 1, label: "Egin flokkur" });
        return;
    }

    const newPrimary = {
      id: id,
      type: Number(opt.dataset.type || (mode === "class" ? 1 : 2)),
      label: opt.textContent || ""
    };
    await saveNewPrimary(newPrimary);
    return;
  }

  // Fallback: user typed something
  const typed = (filterInput.value || "").trim();
  if (!typed) {
    modalError.textContent = "Vel flokk ella lærara, skriva t.d. 5";
    return;
  }
  try {
    const newPrimary = await window.untis.resolveElementByName(typed);
    await saveNewPrimary(newPrimary);
  } catch (e) {
    modalError.textContent = "Fann ikki navnið.";
  }
}

/* ---------- Wire up ---------- */
refreshBtn.onclick = () => {
  load();
};
closeBtn.onclick = () => window.close();
settingsBtn.onclick = openModal;
saveNameBtn.onclick = saveSelection;
cancelModalBtn.onclick = closeModal;
filterInput.oninput = () => {
  fillOptions();
  const filterValue = filterInput.value.toLowerCase();
  if (newSwitchRow) {
    newSwitchRow.classList.toggle("hidden", filterValue !== "retro");
  }
  if (filterValue === "spæl") {
    if (window.untis && window.untis.openGame) {
      window.untis.openGame();
    }
    filterInput.value = ""; // Clear input after triggering
  }
};

modeClassBtn.onclick = () => setMode("class");
modeTeacherBtn.onclick = () => setMode("teacher");

toggleSubjectBtn.onclick = () => {
  const isHidden = subjectSearchContainer.classList.toggle("hidden");
  toggleSubjectBtn.classList.toggle("active", !isHidden);
  if (!isHidden) {
    manualSubjectInput.focus();
  }
  requestAnimationFrame(sendContentHeight);
};

if (helpBtn) helpBtn.onclick = () => { if (window.untis && window.untis.openHelp) window.untis.openHelp(); };
if (window.untis && window.untis.onTriggerRefresh) window.untis.onTriggerRefresh(() => load());
if (window.untis && window.untis.onLessonsUpdated) window.untis.onLessonsUpdated((lessons) => smartRender(lessons));

// --- Event listeners for manual subject search (wired up once) ---
manualSubjectInput.addEventListener("input", () => updateManualSuggestions(manualSubjectInput.value));
manualSubjectInput.addEventListener("blur", () => setTimeout(() => manualSuggestionsContainer.innerHTML = "", 150)); // A slightly longer delay

manualSubjectInput.addEventListener("keydown", (e) => {
  const suggestions = manualSuggestionsContainer.querySelectorAll(".suggestion-item");
  if (!suggestions.length) return;

  let activeIndex = -1;
  suggestions.forEach((item, index) => {
    if (item.classList.contains("active")) {
      activeIndex = index;
    }
  });

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (activeIndex < suggestions.length - 1) {
      if (activeIndex > -1) suggestions[activeIndex].classList.remove("active");
      const newActiveItem = suggestions[activeIndex + 1];
      newActiveItem.classList.add("active");
      newActiveItem.scrollIntoView({ block: 'nearest' });
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (activeIndex > 0) {
      suggestions[activeIndex].classList.remove("active");
      const newActiveItem = suggestions[activeIndex - 1];
      newActiveItem.classList.add("active");
      newActiveItem.scrollIntoView({ block: 'nearest' });
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeIndex > -1) {
      suggestions[activeIndex].dispatchEvent(new MouseEvent("mousedown"));
    }
  }
});

document.addEventListener("click", (e) => {
  if (!manualSuggestionsContainer.contains(e.target) && e.target !== manualSubjectInput) {
    manualSuggestionsContainer.innerHTML = "";
  }
});

// Weekday pill → open WebUntis in browser for the viewed date (today or tomorrow)
if (weekdayEl) {
  weekdayEl.onclick = () => {
    const primaryElement = resolvedElements?.[0];
    if (primaryElement?.id && primaryElement?.type) {
      window.untis.openUntisWeek({
        id: primaryElement.id,
        type: primaryElement.type,
        date: viewingTomorrow ? viewingDateISO : undefined
      });
    }
  };
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  } else {
    setWeekdayLabel();
    load();
    scheduleMidnightRollover();
  }
});

// ---------- hat auto-display ----------
function toggleSantaHat() {
  const hat = document.getElementById("santaHat");
  if (!hat) return;

  const today = new Date();
  const m = today.getMonth(); // 0 = Januar
  const d = today.getDate();

  const inSeason = (m === 11) || (m === 0 && d <= 1); // 11 er Desember, verður víst til 1 jaunar.
  hat.style.display = inSeason ? "block" : "none";
}

window.addEventListener("load", () => {
  load();
  toggleSantaHat();
});

const newSwitchRow = document.getElementById("newSwitchRow");
const newSwitch = document.getElementById("newSwitch");
const NEW_SWITCH_KEY = "untis.newSwitch";
const mainStylesheet = document.getElementById("main-stylesheet");

if (newSwitch) {
  const setStylesheet = () => {
    const isRetro = newSwitch.checked;
    mainStylesheet.href = isRetro ? "./retro.css" : "./styles.css";
    if (santaHat) {
      santaHat.src = isRetro ? "./jol-retro.png" : "./jol.png"; 
    }
  };

  newSwitch.checked = localStorage.getItem(NEW_SWITCH_KEY) === "on";
  setStylesheet();

  newSwitch.onchange = () => {
    localStorage.setItem(NEW_SWITCH_KEY, newSwitch.checked ? "on" : "off");
    setStylesheet();
    filterInput.value = '';
    fillOptions();
  };
}

// ---------- Konami Code Easter Egg ----------
const konamiCode = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a"
];
let userInput = [];

function frogShower() {
  window.untis.showFrogRain();
}

document.addEventListener("keydown", (e) => {
  userInput.push(e.key);
  userInput = userInput.slice(-konamiCode.length); // Keep only the last 10 keys

  if (JSON.stringify(userInput) === JSON.stringify(konamiCode)) {
    frogShower();
    userInput = []; // Reset for next time
  }
});
