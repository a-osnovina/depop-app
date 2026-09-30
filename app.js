// Change bump wording or the default percent for each platform here.
const PLATFORMS = {
  Depop: { bumpLabel: "I bumped this listing on Depop", defaultPercent: 12 },
  Vinted: { bumpLabel: "I bumped this listing on Vinted (3 days)", defaultPercent: 12 }
};
const PLATFORM_NAMES = Object.keys(PLATFORMS);

const STATUSES = ["In progress", "Listed", "Sold"];
const STATUS_CLASS = { "In progress": "row-progress", "Listed": "row-listed", "Sold": "row-sold" };

// Add or rename photo types here.
const PHOTO_TYPES = [
  { key: "tag", label: "Tag" },
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "sleeves", label: "Sleeves" },
  { key: "care", label: "Care instructions" }
];

let items = [];
let goals = [];
let balances = {};
let editingIndex = null;
let filter = "All";
let statusFilter = "All";
let remindDays = 7;

try {
  items = JSON.parse(localStorage.getItem("items")) || [];
} catch (e) {
  items = [];
}
try {
  goals = JSON.parse(localStorage.getItem("goals")) || [];
} catch (e) {
  goals = [];
}
try {
  balances = JSON.parse(localStorage.getItem("balances")) || {};
} catch (e) {
  balances = {};
}
try {
  const savedFilter = localStorage.getItem("filter");
  if (savedFilter === "Depop" || savedFilter === "Vinted") filter = savedFilter;
  const savedStatusFilter = localStorage.getItem("statusFilter");
  if (STATUSES.indexOf(savedStatusFilter) !== -1) statusFilter = savedStatusFilter;
  const savedRemind = Number(localStorage.getItem("remindDays"));
  if (savedRemind >= 1) remindDays = savedRemind;
} catch (e) {}

// Convert older saved items to the newer format.
items.forEach(function (item) {
  if (STATUSES.indexOf(item.status) === -1) item.status = "In progress";
  if (!item.photos) item.photos = {};
  if (item.original === undefined) item.original = Number(item.price) || 0;
  if (item.current === undefined) item.current = Number(item.price) || 0;
  if (item.soldFor === undefined) item.soldFor = item.status === "Sold" ? (Number(item.price) || 0) : null;
  if (!item.priceChanged) item.priceChanged = "";
});

const form = document.getElementById("item-form");
const addItemButton = document.getElementById("add-item-button");
const submitButton = document.getElementById("submit-button");
const cancelButton = document.getElementById("cancel-edit");
const siteInput = document.getElementById("site");
const statusInput = document.getElementById("status");
const originalInput = document.getElementById("original");
const currentInput = document.getElementById("current");
const soldForInput = document.getElementById("sold-for");
const soldForRow = document.getElementById("sold-for-row");
const postedInput = document.getElementById("posted");
const soldInput = document.getElementById("sold");
const daysInput = document.getElementById("days");
const bumpInput = document.getElementById("bump");
const bumpPercentInput = document.getElementById("bump-percent");
const bumpPercentRow = document.getElementById("bump-percent-row");
const bumpNote = document.getElementById("bump-note");
const filterInput = document.getElementById("filter");
const statusFilterInput = document.getElementById("status-filter");
const remindInput = document.getElementById("remind-days");
const goalForm = document.getElementById("goal-form");
const addGoalButton = document.getElementById("add-goal-button");
const balancesBox = document.getElementById("balances");
const goalsBox = document.getElementById("goals-box");

function save() {
  try {
    localStorage.setItem("items", JSON.stringify(items));
    localStorage.setItem("goals", JSON.stringify(goals));
    localStorage.setItem("balances", JSON.stringify(balances));
    localStorage.setItem("filter", filter);
    localStorage.setItem("statusFilter", statusFilter);
    localStorage.setItem("remindDays", String(remindDays));
  } catch (e) {}
}

function money(n) {
  return (n < 0 ? "-" : "") + "$" + Math.abs(n).toFixed(2);
}

// ---- photo checklist ----
const photoBoxes = document.getElementById("photo-boxes");
PHOTO_TYPES.forEach(function (type) {
  const label = document.createElement("label");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.id = "photo-" + type.key;
  label.appendChild(box);
  label.appendChild(document.createTextNode(" " + type.label));
  photoBoxes.appendChild(label);
});

function photoCount(item) {
  let count = 0;
  PHOTO_TYPES.forEach(function (type) {
    if (item.photos && item.photos[type.key]) count++;
  });
  return count;
}

// ---- prices and profit ----
function salePrice(item) {
  return item.soldFor !== null && item.soldFor !== undefined ? item.soldFor : item.current;
}

function bumpCost(price, percent) {
  return Math.round(price * percent) / 100;
}

function feeTotal(item) {
  return item.bump ? bumpCost(salePrice(item), item.bumpPercent || 0) : 0;
}

function profitOf(item) {
  return salePrice(item) - feeTotal(item);
}

// The price used for the bump preview while you fill in the form.
function formPrice() {
  if (statusInput.value === "Sold" && soldForInput.value !== "") return Number(soldForInput.value) || 0;
  if (currentInput.value !== "") return Number(currentInput.value) || 0;
  return Number(originalInput.value) || 0;
}

function updateSoldForUI() {
  soldForRow.style.display = statusInput.value === "Sold" ? "block" : "none";
}

// ---- bump options that change with the platform ----
function updateBumpUI(resetPercent) {
  const config = PLATFORMS[siteInput.value];
  document.getElementById("bump-label").textContent = config.bumpLabel;
  if (resetPercent) bumpPercentInput.value = config.defaultPercent;
  bumpPercentRow.style.display = bumpInput.checked ? "block" : "none";
  if (bumpInput.checked) {
    const cost = bumpCost(formPrice(), Number(bumpPercentInput.value) || 0);
    bumpNote.textContent = "Bump cost: $" + cost.toFixed(2);
  } else {
    bumpNote.textContent = "";
  }
}

siteInput.addEventListener("change", function () { updateBumpUI(true); });
statusInput.addEventListener("change", function () { updateSoldForUI(); updateBumpUI(false); });
bumpInput.addEventListener("change", function () { updateBumpUI(false); });
originalInput.addEventListener("input", function () { updateBumpUI(false); });
currentInput.addEventListener("input", function () { updateBumpUI(false); });
soldForInput.addEventListener("input", function () { updateBumpUI(false); });
bumpPercentInput.addEventListener("input", function () { updateBumpUI(false); });

// ---- date helpers ----
function pad(n) {
  return String(n).padStart(2, "0");
}

function todayText() {
  const now = new Date();
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

function parseDate(text) {
  const p = text.split("-");
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function formatDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function dayDiff(fromText, toText) {
  return Math.round((parseDate(toText) - parseDate(fromText)) / 86400000);
}

function daysToSell(item) {
  if (!item.posted || !item.sold) return null;
  return dayDiff(item.posted, item.sold);
}

// Days a listed item has been at its current price (since the last price change, or since posting).
function daysAtPrice(item) {
  if (item.status !== "Listed") return null;
  const start = item.priceChanged || item.posted;
  if (!start) return null;
  return Math.max(0, dayDiff(start, todayText()));
}

function isDue(item) {
  const d = daysAtPrice(item);
  return d !== null && d >= remindDays;
}

// ---- keep the three date fields in sync ----
function soldFromDays() {
  if (postedInput.value && daysInput.value !== "") {
    soldInput.value = formatDate(parseDate(postedInput.value) + Number(daysInput.value) * 86400000);
  }
}

daysInput.addEventListener("input", soldFromDays);

soldInput.addEventListener("input", function () {
  if (soldInput.value === "") {
    daysInput.value = "";
  } else if (postedInput.value) {
    daysInput.value = dayDiff(postedInput.value, soldInput.value);
  }
});

postedInput.addEventListener("input", function () {
  if (postedInput.value && soldInput.value) {
    daysInput.value = dayDiff(postedInput.value, soldInput.value);
  } else {
    soldFromDays();
  }
});

// ---- show and hide the item form ----
function showForm() {
  form.style.display = "block";
  addItemButton.textContent = "Close form";
}

function closeForm() {
  editingIndex = null;
  form.reset();
  updateSoldForUI();
  updateBumpUI(true);
  submitButton.textContent = "Add item";
  form.style.display = "none";
  addItemButton.textContent = "+ Add item";
}

addItemButton.addEventListener("click", function () {
  if (form.style.display === "block") {
    closeForm();
  } else {
    editingIndex = null;
    showForm();
    document.getElementById("name").focus();
  }
});

cancelButton.addEventListener("click", closeForm);

function startEdit(index) {
  const item = items[index];
  editingIndex = index;
  document.getElementById("name").value = item.name;
  siteInput.value = item.site;
  statusInput.value = item.status;
  PHOTO_TYPES.forEach(function (type) {
    document.getElementById("photo-" + type.key).checked = !!(item.photos && item.photos[type.key]);
  });
  postedInput.value = item.posted || "";
  soldInput.value = item.sold || "";
  const d = daysToSell(item);
  daysInput.value = d === null ? "" : d;
  originalInput.value = item.original;
  currentInput.value = item.current;
  soldForInput.value = item.soldFor === null || item.soldFor === undefined ? "" : item.soldFor;
  bumpInput.checked = !!item.bump;
  bumpPercentInput.value = item.bumpPercent || PLATFORMS[item.site].defaultPercent;
  updateSoldForUI();
  updateBumpUI(false);
  submitButton.textContent = "Save changes";
  showForm();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- starting balances (typed by you) ----
PLATFORM_NAMES.forEach(function (name) {
  const input = document.getElementById("start-" + name);
  input.value = balances[name] ? balances[name] : "";
  input.addEventListener("input", function () {
    balances[name] = Number(input.value) || 0;
    save();
    render();
  });
});

// ---- the two dropdowns in the top box ----
// Clicking outside one closes it (so only one stays open), and Escape closes both.
// composedPath() is used because buttons inside a panel get rebuilt when the page redraws.
const dropdowns = [balancesBox, goalsBox];
document.addEventListener("click", function (event) {
  const path = event.composedPath();
  dropdowns.forEach(function (box) {
    if (box.open && path.indexOf(box) === -1) box.open = false;
  });
});
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    dropdowns.forEach(function (box) { box.open = false; });
  }
});

// ---- filters and reminder setting ----
filterInput.value = filter;
filterInput.addEventListener("change", function () {
  filter = filterInput.value;
  save();
  render();
});

statusFilterInput.value = statusFilter;
statusFilterInput.addEventListener("change", function () {
  statusFilter = statusFilterInput.value;
  save();
  render();
});

remindInput.value = remindDays;
remindInput.addEventListener("input", function () {
  const n = Number(remindInput.value);
  if (n >= 1) {
    remindDays = n;
    save();
    render();
  }
});

function lowerPrice(item) {
  const text = prompt("New price for " + item.name + " (now " + money(item.current) + "):");
  if (text === null || text.trim() === "") return;
  const value = Number(text);
  if (isNaN(value) || value < 0) {
    alert("Please enter a number, like 18 or 18.50.");
    return;
  }
  if (value === item.current) return;
  item.current = value;
  item.priceChanged = todayText();
  save();
  render();
}

// ---- goals ----
addGoalButton.addEventListener("click", function () {
  if (goalForm.style.display === "block") {
    goalForm.style.display = "none";
    goalForm.reset();
    addGoalButton.textContent = "+ Add goal";
  } else {
    goalForm.style.display = "block";
    addGoalButton.textContent = "Close form";
    document.getElementById("goal-name").focus();
  }
});

// The overall bar adds up every goal still in progress.
function renderOverall(balance, activeTotal, activeCount) {
  const mini = document.getElementById("goals-mini");
  const overall = document.getElementById("overall-box");

  if (activeCount === 0) {
    mini.style.display = "none";
    overall.style.display = "none";
    return;
  }

  const have = Math.max(0, Math.min(balance, activeTotal));
  const goalWord = activeCount === 1 ? "goal" : "goals";

  mini.style.display = "block";
  document.getElementById("mini-bar").max = activeTotal;
  document.getElementById("mini-bar").value = have;
  document.getElementById("mini-text").textContent =
    money(have) + " of " + money(activeTotal) + " (" + activeCount + " " + goalWord + ")";

  overall.style.display = "block";
  document.getElementById("overall-bar").max = activeTotal;
  document.getElementById("overall-bar").value = have;
  document.getElementById("overall-text").textContent =
    "All goals together: " + money(have) + " of " + money(activeTotal) + " (" + activeCount + " " + goalWord + ")";
}

function renderGoals(balance) {
  const activeList = document.getElementById("goal-list");
  const doneList = document.getElementById("purchased-list");
  activeList.innerHTML = "";
  doneList.innerHTML = "";
  let activeCount = 0;
  let doneCount = 0;
  let activeTotal = 0;

  goals.forEach(function (goal, index) {
    const box = document.createElement("div");
    box.className = "goal";

    const title = document.createElement("div");
    if (goal.purchased) {
      title.className = "done";
      title.textContent = goal.name + " - $" + goal.amount.toFixed(2) + " (purchased)";
    } else {
      const have = Math.max(0, Math.min(balance, goal.amount));
      title.textContent = goal.name + " - $" + have.toFixed(2) + " of $" + goal.amount.toFixed(2);
    }
    box.appendChild(title);

    if (!goal.purchased) {
      const bar = document.createElement("progress");
      bar.max = goal.amount;
      bar.value = Math.max(0, Math.min(balance, goal.amount));
      box.appendChild(bar);
    }

    const toggle = document.createElement("button");
    toggle.textContent = goal.purchased ? "Undo" : "Mark purchased";
    toggle.onclick = function () {
      if (!goal.purchased && goal.amount > balance) {
        if (!confirm("You don't have enough balance yet. Mark it purchased anyway?")) return;
      }
      goal.purchased = !goal.purchased;
      save();
      render();
    };
    box.appendChild(toggle);

    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.onclick = function () {
      if (confirm("Delete goal " + goal.name + "?")) {
        goals.splice(index, 1);
        save();
        render();
      }
    };
    box.appendChild(remove);

    if (goal.purchased) {
      doneList.appendChild(box);
      doneCount++;
    } else {
      activeList.appendChild(box);
      activeCount++;
      activeTotal += goal.amount;
    }
  });

  document.getElementById("no-goals").style.display = activeCount === 0 ? "block" : "none";
  document.getElementById("purchased-goals").style.display = doneCount === 0 ? "none" : "block";
  document.getElementById("purchased-summary").textContent = "Purchased goals (" + doneCount + ")";
  renderOverall(balance, activeTotal, activeCount);
}

function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";
  let itemTotal = 0;
  let shown = 0;
  const dueNames = [];
  const itemByPlatform = {};
  PLATFORM_NAMES.forEach(function (name) { itemByPlatform[name] = 0; });

  items.forEach(function (item, index) {
    // Totals and reminders always count every item, whatever the filters say.
    const profit = item.status === "Sold" ? profitOf(item) : null;
    if (profit !== null) {
      itemTotal += profit;
      if (itemByPlatform[item.site] !== undefined) itemByPlatform[item.site] += profit;
    }
    if (isDue(item)) dueNames.push(item.name);

    if (filter !== "All" && item.site !== filter) return;
    if (statusFilter !== "All" && item.status !== statusFilter) return;
    shown++;

    const row = document.createElement("tr");
    row.className = STATUS_CLASS[item.status] || "";

    // Photos
    const photoCell = document.createElement("td");
    const count = photoCount(item);
    if (count === PHOTO_TYPES.length) {
      photoCell.textContent = "\u2713";
      photoCell.className = "photo-ok";
      photoCell.title = "All photos taken";
    } else {
      photoCell.textContent = count + "/" + PHOTO_TYPES.length;
      photoCell.className = "photo-partial";
      photoCell.title = "Photos taken";
    }
    row.appendChild(photoCell);

    // Item, site, status
    [item.name, item.site, item.status].forEach(function (text) {
      const td = document.createElement("td");
      td.textContent = text;
      row.appendChild(td);
    });

    // Price
    const priceCell = document.createElement("td");
    const priceMain = document.createElement("div");
    if (item.status === "Sold") {
      priceMain.textContent = "Sold " + money(salePrice(item));
      priceCell.appendChild(priceMain);
      if (item.original !== salePrice(item)) {
        const note = document.createElement("div");
        note.className = "small";
        note.textContent = "listed at " + money(item.original);
        priceCell.appendChild(note);
      }
    } else {
      priceMain.textContent = item.original !== item.current
        ? money(item.original) + " \u2192 " + money(item.current)
        : money(item.current);
      priceCell.appendChild(priceMain);
      const d = daysAtPrice(item);
      if (d !== null) {
        const note = document.createElement("div");
        if (isDue(item)) {
          note.className = "due";
          note.textContent = "\u23F0 Reduce price (" + d + (d === 1 ? " day" : " days") + ")";
        } else {
          note.className = "small";
          note.textContent = d + (d === 1 ? " day" : " days") + " at this price";
        }
        priceCell.appendChild(note);
      }
    }
    row.appendChild(priceCell);

    // Profit
    const profitCell = document.createElement("td");
    profitCell.textContent = profit === null ? "-" : money(profit);
    row.appendChild(profitCell);

    // Buttons
    const actionCell = document.createElement("td");

    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.onclick = function () {
      startEdit(index);
    };
    actionCell.appendChild(editButton);

    if (item.status === "Listed") {
      const lowerButton = document.createElement("button");
      lowerButton.textContent = "Lower price";
      lowerButton.onclick = function () {
        lowerPrice(item);
      };
      actionCell.appendChild(lowerButton);
    }

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.onclick = function () {
      if (confirm("Delete " + item.name + "?")) {
        items.splice(index, 1);
        closeForm();
        save();
        render();
      }
    };
    actionCell.appendChild(deleteButton);

    row.appendChild(actionCell);
    list.appendChild(row);
  });

  const parts = [];
  if (filter !== "All") parts.push(filter);
  if (statusFilter !== "All") parts.push(statusFilter);
  document.getElementById("list-count").textContent =
    "Showing " + shown + " of " + items.length + " items" + (parts.length ? " (" + parts.join(", ") + ")" : "");

  const banner = document.getElementById("reduce-banner");
  if (dueNames.length > 0) {
    banner.style.display = "block";
    banner.textContent = "\u23F0 Time to lower the price on: " + dueNames.join(", ");
  } else {
    banner.style.display = "none";
    banner.textContent = "";
  }

  let startTotal = 0;
  PLATFORM_NAMES.forEach(function (name) {
    const start = balances[name] || 0;
    startTotal += start;
    document.getElementById("item-" + name).textContent = money(itemByPlatform[name]);
    document.getElementById("sum-" + name).textContent = money(start + itemByPlatform[name]);
  });

  const total = itemTotal + startTotal;
  document.getElementById("start-all").textContent = money(startTotal);
  document.getElementById("item-all").textContent = money(itemTotal);
  document.getElementById("sum-all").textContent = money(total);

  let spent = 0;
  goals.forEach(function (goal) {
    if (goal.purchased) spent += goal.amount;
  });
  const balance = total - spent;

  document.getElementById("total").textContent = total.toFixed(2);
  document.getElementById("balance").textContent = balance.toFixed(2);
  renderGoals(balance);
}

form.addEventListener("submit", function (event) {
  event.preventDefault();

  if (postedInput.value && soldInput.value && dayDiff(postedInput.value, soldInput.value) < 0) {
    alert("The sold date can't be earlier than the posted date.");
    return;
  }

  const photos = {};
  PHOTO_TYPES.forEach(function (type) {
    photos[type.key] = document.getElementById("photo-" + type.key).checked;
  });

  const original = Number(originalInput.value) || 0;
  const current = currentInput.value === "" ? original : Number(currentInput.value);
  const status = statusInput.value;
  const soldFor = status === "Sold" && soldForInput.value !== "" ? Number(soldForInput.value) : null;

  let priceChanged = "";
  if (editingIndex !== null) {
    const old = items[editingIndex];
    priceChanged = current !== old.current ? todayText() : old.priceChanged;
  }

  const item = {
    name: document.getElementById("name").value,
    site: siteInput.value,
    status: status,
    photos: photos,
    posted: postedInput.value,
    sold: soldInput.value,
    original: original,
    current: current,
    soldFor: soldFor,
    priceChanged: priceChanged,
    bump: bumpInput.checked,
    bumpPercent: Number(bumpPercentInput.value) || 0
  };
  if (editingIndex === null) {
    items.push(item);
  } else {
    items[editingIndex] = item;
  }
  closeForm();
  save();
  render();
});

goalForm.addEventListener("submit", function (event) {
  event.preventDefault();
  goals.push({
    name: document.getElementById("goal-name").value,
    amount: Number(document.getElementById("goal-amount").value),
    purchased: false
  });
  save();
  render();
  goalForm.reset();
  goalForm.style.display = "none";
  addGoalButton.textContent = "+ Add goal";
});

// ---- backup: export everything to one CSV file, and import it back ----
// One file holds three kinds of rows: Item, Goal and Balance (see the Type column).
// The "Bump cost", "Profit" and "Days to sell" columns are only for reading in a spreadsheet;
// the import ignores them and works them out again from the other columns.
const BACKUP_HEADER = ["Type", "Name", "Site", "Status"]
  .concat(PHOTO_TYPES.map(function (type) { return "Photo: " + type.label; }))
  .concat(["Date posted", "Date sold", "Days to sell", "Original price", "Current price",
    "Last price change", "Sold for", "Bumped", "Bump %", "Bump cost", "Profit", "Amount", "Purchased"]);

function csvCell(value) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function makeRow(values) {
  return BACKUP_HEADER.map(function (name) {
    return values[name] === undefined ? "" : values[name];
  });
}

function buildCsv() {
  const rows = [BACKUP_HEADER];

  items.forEach(function (item) {
    const d = daysToSell(item);
    const values = {
      "Type": "Item",
      "Name": item.name,
      "Site": item.site,
      "Status": item.status,
      "Date posted": item.posted || "",
      "Date sold": item.sold || "",
      "Days to sell": d === null ? "" : d,
      "Original price": item.original.toFixed(2),
      "Current price": item.current.toFixed(2),
      "Last price change": item.priceChanged || "",
      "Sold for": item.status === "Sold" ? salePrice(item).toFixed(2) : "",
      "Bumped": item.bump ? "Yes" : "No",
      "Bump %": item.bump ? (item.bumpPercent || 0) : "",
      "Bump cost": feeTotal(item).toFixed(2),
      "Profit": item.status === "Sold" ? profitOf(item).toFixed(2) : ""
    };
    PHOTO_TYPES.forEach(function (type) {
      values["Photo: " + type.label] = item.photos && item.photos[type.key] ? "Yes" : "No";
    });
    rows.push(makeRow(values));
  });

  goals.forEach(function (goal) {
    rows.push(makeRow({
      "Type": "Goal",
      "Name": goal.name,
      "Amount": goal.amount.toFixed(2),
      "Purchased": goal.purchased ? "Yes" : "No"
    }));
  });

  PLATFORM_NAMES.forEach(function (name) {
    rows.push(makeRow({
      "Type": "Balance",
      "Name": name,
      "Amount": (balances[name] || 0).toFixed(2)
    }));
  });

  return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n");
}

// Turns CSV text into a list of rows. Handles quotes, commas and line breaks inside quotes.
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// Checks the whole file first. Returns { items, goals, balances } or { error }.
// Nothing in the app is touched here.
function readBackup(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { error: "That file is empty. Nothing was changed." };

  const col = {};
  rows[0].forEach(function (name, i) { col[name.trim().toLowerCase()] = i; });
  if (col["type"] === undefined || col["name"] === undefined) {
    return { error: "This doesn't look like a backup from this app (it has no Type and Name columns). Nothing was changed." };
  }

  const problems = [];
  function problem(line, message) {
    problems.push("Row " + line + ": " + message);
  }

  function get(row, name) {
    const i = col[name.toLowerCase()];
    return i === undefined || row[i] === undefined ? "" : row[i].trim();
  }

  // Export adds a ' in front of text that starts with = + - or @ (to keep spreadsheets safe). Remove it.
  function unguard(text) {
    return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
  }

  function isYes(text) {
    return /^(yes|y|true|1)$/i.test(text);
  }

  function matchName(list, text) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].toLowerCase() === text.toLowerCase()) return list[i];
    }
    return null;
  }

  // Blank gives the fallback. A bad amount is reported and gives NaN.
  function readNumber(line, label, text, fallback) {
    if (text === "") return fallback;
    const n = Number(text.replace(/[$,\s]/g, ""));
    if (isNaN(n) || n < 0) {
      problem(line, label + " '" + text + "' is not a valid amount");
      return NaN;
    }
    return n;
  }

  // Accepts 2026-09-30 and also 9/30/2026 or 9/30/26 (what a spreadsheet may turn dates into).
  function readDate(line, label, text) {
    if (text === "") return "";
    let y, m, d, match;
    if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(text))) {
      y = Number(match[1]);
      m = Number(match[2]);
      d = Number(match[3]);
    } else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text))) {
      m = Number(match[1]);
      d = Number(match[2]);
      y = Number(match[3]);
      if (y < 100) y += 2000;
    } else {
      problem(line, label + " '" + text + "' is not a date I can read (use YYYY-MM-DD)");
      return "";
    }
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
      problem(line, label + " '" + text + "' is not a real date");
      return "";
    }
    return y + "-" + pad(m) + "-" + pad(d);
  }

  const newItems = [];
  const newGoals = [];
  const newBalances = {};

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    if (!row.some(function (c) { return c.trim() !== ""; })) continue;

    const kind = get(row, "Type").toLowerCase();
    const name = unguard(get(row, "Name"));

    if (kind === "item") {
      if (name === "") { problem(line, "this item has no name"); continue; }

      const site = matchName(PLATFORM_NAMES, get(row, "Site"));
      if (!site) { problem(line, "Site '" + get(row, "Site") + "' must be " + PLATFORM_NAMES.join(" or ")); continue; }

      const status = matchName(STATUSES, get(row, "Status"));
      if (!status) { problem(line, "Status '" + get(row, "Status") + "' must be " + STATUSES.join(", ")); continue; }

      const photos = {};
      PHOTO_TYPES.forEach(function (type) {
        photos[type.key] = isYes(get(row, "Photo: " + type.label));
      });

      const posted = readDate(line, "Date posted", get(row, "Date posted"));
      const sold = readDate(line, "Date sold", get(row, "Date sold"));
      if (posted && sold && dayDiff(posted, sold) < 0) problem(line, "the sold date is earlier than the posted date");

      const original = readNumber(line, "Original price", get(row, "Original price"), 0);
      const current = readNumber(line, "Current price", get(row, "Current price"), original);
      const soldForText = get(row, "Sold for");
      const soldFor = status === "Sold" && soldForText !== "" ? readNumber(line, "Sold for", soldForText, null) : null;
      const bump = isYes(get(row, "Bumped"));
      const bumpPercent = readNumber(line, "Bump %", get(row, "Bump %"), PLATFORMS[site].defaultPercent);

      newItems.push({
        name: name,
        site: site,
        status: status,
        photos: photos,
        posted: posted,
        sold: sold,
        original: original,
        current: current,
        soldFor: soldFor,
        priceChanged: readDate(line, "Last price change", get(row, "Last price change")),
        bump: bump,
        bumpPercent: bumpPercent
      });
    } else if (kind === "goal") {
      if (name === "") { problem(line, "this goal has no name"); continue; }
      const amount = readNumber(line, "Amount", get(row, "Amount"), 0);
      if (amount <= 0) problem(line, "the goal amount must be above 0");
      newGoals.push({ name: name, amount: amount, purchased: isYes(get(row, "Purchased")) });
    } else if (kind === "balance") {
      const platform = matchName(PLATFORM_NAMES, name);
      if (!platform) { problem(line, "the Balance name '" + name + "' must be " + PLATFORM_NAMES.join(" or ")); continue; }
      newBalances[platform] = readNumber(line, "Amount", get(row, "Amount"), 0);
    } else {
      problem(line, "Type '" + get(row, "Type") + "' must be Item, Goal or Balance");
    }
  }

  if (problems.length > 0) {
    const more = problems.length > 8 ? "\n...and " + (problems.length - 8) + " more." : "";
    return { error: "I found problems in that file, so nothing was changed:\n\n" + problems.slice(0, 8).join("\n") + more };
  }
  if (newItems.length === 0 && newGoals.length === 0 && Object.keys(newBalances).length === 0) {
    return { error: "That file has no items, goals or balances in it, so nothing was changed." };
  }
  return { items: newItems, goals: newGoals, balances: newBalances };
}

// Replaces everything in the app with the contents of a backup file.
function applyBackup(text) {
  const result = readBackup(text);
  if (result.error) {
    alert(result.error);
    return;
  }

  const message = "This will REPLACE everything in the app with the file:\n\n" +
    "File: " + result.items.length + " items, " + result.goals.length + " goals\n" +
    "App now: " + items.length + " items, " + goals.length + " goals (these will be erased)\n\n" +
    "Not sure? Tap Cancel and use Export CSV first.\n\nContinue?";
  if (!confirm(message)) return;

  items = result.items;
  goals = result.goals;
  balances = result.balances;
  PLATFORM_NAMES.forEach(function (name) {
    document.getElementById("start-" + name).value = balances[name] ? balances[name] : "";
  });
  closeForm();
  save();
  render();
  alert("Done. Imported " + items.length + " items and " + goals.length + " goals.");
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// On iPhone the Share menu is the reliable way to save a file (choose "Save to Files").
// Everywhere else this is a normal download.
function deliverFile(blob, filename) {
  const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  try {
    const file = new File([blob], filename, { type: "text/csv" });
    if (isIPhone && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(function (e) {
        if (!e || e.name !== "AbortError") downloadBlob(blob, filename);
      });
      return;
    }
  } catch (e) {}
  downloadBlob(blob, filename);
}

document.getElementById("export-button").addEventListener("click", function () {
  // The invisible mark at the start makes spreadsheets read names and emoji correctly.
  const blob = new Blob(["\uFEFF" + buildCsv()], { type: "text/csv" });
  deliverFile(blob, "resale-backup-" + todayText() + ".csv");
});

const importButton = document.getElementById("import-button");
const importFile = document.getElementById("import-file");

importButton.addEventListener("click", function () {
  importFile.click();
});

importFile.addEventListener("change", function () {
  const file = importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    importFile.value = "";
    applyBackup(String(reader.result));
  };
  reader.onerror = function () {
    importFile.value = "";
    alert("Sorry, I couldn't read that file.");
  };
  reader.readAsText(file);
});

closeForm();
render();