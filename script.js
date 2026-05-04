requireAuth();
let allImages = [];
let selectedImages = [];

// EDIT MODE STATE
let editMode = false;
const draggableBtns = ["finalizeBtn", "startShowBtn", "fileInput"];
const btnState = new Map(); 
// btn -> { handle, placeholder, moved, fixedLeft, fixedTop }
// FILE INPUT
$("#fileInput")[0].addEventListener("change", function (e) {
  if (editMode) return;
  const files = Array.from(e.target.files);
  allImages = [];
  selectedImages = [];
  renderSelectedList();

  const $table = $("#imageTable");
  $table.empty();

  const columns = 6;

  files.forEach((file, index) => {
    const rowIndex = Math.floor(index / columns);

    let $row = $table.find("tr").eq(rowIndex);
    if ($row.length === 0) {
      $row = $("<tr>").appendTo($table);
    }

    const $cell = $("<td>").attr("draggable", "true").appendTo($row);
    const $img = $("<img>").addClass("thumb");
    $cell.append($img);

    const imageObj = { cell: $cell[0], src: "" };
    allImages.push(imageObj);

    $cell[0].addEventListener("click", function () {
      $(this).toggleClass("selected");
    });

    $cell[0].addEventListener("dragstart", function (e) {
      if (!imageObj.src) { e.preventDefault(); return; }
      e.dataTransfer.setData("type", "grid");
      e.dataTransfer.setData("src", imageObj.src);
      $(this).addClass("selected");
    });

    const reader = new FileReader();
    reader.addEventListener("load", function (event) {
      $img.attr("src", event.target.result);
      imageObj.src = event.target.result;
    });
    reader.readAsDataURL(file);
  });
});

/* ── FINALIZE ── */
$("#finalizeBtn")[0].addEventListener("click", () => {
  if (editMode) return;
  selectedImages = allImages
    .filter((obj) => $(obj.cell).hasClass("selected"))
    .map((obj) => obj.src);
  renderSelectedList();
});
/* ── SAVE SESSION ── */
$("#saveBtn")[0].addEventListener("click", async () => {
  if (editMode) return;
  const name = prompt("Enter session name:") || "My Session";

  const session = {
    delay: parseInt($("#delayInput").val(), 10) || 1000,
    selectedImages: selectedImages,
    buttons: {}
  };

  draggableBtns.forEach((id) => {
    const btn = document.getElementById(id);
    const state = btnState.get(btn) || {};
    session.buttons[id] = {
      moved:        state.moved || false,
      left:         parseFloat(btn.style.left)         || null,
      top:          parseFloat(btn.style.top)          || null,
      width:        parseFloat(btn.style.width)        || null,
      height:       parseFloat(btn.style.height)       || null,
      borderRadius: parseFloat(btn.style.borderRadius) || null,
    };
  });

  const result = await saveSessionToDB(name, session);
  if (result) alert("Session saved to database!");
});

/* ── LOAD SESSION ── */
$("#loadBtn")[0].addEventListener("click", async () => {
  if (editMode) return;
  const sessions = await loadSessionsFromDB();
  if (sessions.length === 0) { alert("No saved sessions found!"); return; }

  const names = sessions.map((s, i) => `${i + 1}. ${s.name}`).join("\n");
  const pick  = parseInt(prompt("Pick a session:\n" + names)) - 1;
  if (isNaN(pick) || pick < 0 || pick >= sessions.length) return;

  const s = sessions[pick];
  $("#delayInput").val(s.delay);
  selectedImages = JSON.parse(s.selected_images);
  renderSelectedList();

  const buttons = JSON.parse(s.buttons);
  draggableBtns.forEach((id) => {
    const btn   = document.getElementById(id);
    const saved = buttons[id];
    if (!saved || !saved.moved) return;

    btn.style.position    = "fixed";
    btn.style.left        = saved.left         + "px";
    btn.style.top         = saved.top          + "px";
    btn.style.width       = saved.width        + "px";
    if (saved.height)       btn.style.height       = saved.height       + "px";
    if (saved.borderRadius) btn.style.borderRadius = saved.borderRadius + "px";
    btn.style.margin      = "0";

    btnState.set(btn, { moved: true, fixedLeft: saved.left, fixedTop: saved.top });
  });
});
$("#logoutBtn")[0].addEventListener("click", logout);


/* ── RENDER SELECTED LIST ── */
function renderSelectedList() {
  const $container = $("#selectedList");
  $container.empty();

  selectedImages.forEach((src, index) => {
    const $div = $("<div>").addClass("selected-item").attr("draggable", "true");
    const $img = $("<img>").attr("src", src);

    const $dupBtn = $("<button>").text("+").addClass("btn-dup").attr("title", "Duplicate");
    const $delBtn = $("<button>").text("✕").addClass("btn-del").attr("title", "Remove");

    $dupBtn[0].addEventListener("click", () => {
      selectedImages.splice(index + 1, 0, src);
      renderSelectedList();
    });

    $delBtn[0].addEventListener("click", () => {
      selectedImages.splice(index, 1);
      renderSelectedList();
    });

    $div[0].addEventListener("dragstart", (e) => {
      if ($(e.target).is("button")) { e.preventDefault(); return; }
      e.dataTransfer.setData("type", "reorder");
      e.dataTransfer.setData("index", String(index));
    });

    $div[0].addEventListener("dragover", (e) => { e.preventDefault(); });

    $div[0].addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.getData("type") !== "reorder") return;
      const fromIndex = parseInt(e.dataTransfer.getData("index"), 10);
      if (isNaN(fromIndex) || fromIndex === index) return;
      const [moved] = selectedImages.splice(fromIndex, 1);
      selectedImages.splice(index, 0, moved);
      renderSelectedList();
    });

    const $controls = $("<div>").addClass("item-controls");
    $controls.append($dupBtn, $delBtn);
    $div.append($img, $controls);
    $container.append($div);
  });

  // drop zone
  const $zone = $("<div>").addClass("drop-zone").text("+");

  $zone[0].addEventListener("dragover", (e) => {
    e.preventDefault();
    $zone.addClass("drag-over");
  });
  $zone[0].addEventListener("dragleave", () => {
    $zone.removeClass("drag-over");
  });
  $zone[0].addEventListener("drop", (e) => {
    e.preventDefault();
    $zone.removeClass("drag-over");
    const type = e.dataTransfer.getData("type");
    if (type === "grid") {
      const src = e.dataTransfer.getData("src");
      if (src) { selectedImages.push(src); renderSelectedList(); }
    } else if (type === "reorder") {
      const fromIndex = parseInt(e.dataTransfer.getData("index"), 10);
      if (isNaN(fromIndex)) return;
      const [moved] = selectedImages.splice(fromIndex, 1);
      selectedImages.push(moved);
      renderSelectedList();
    }
  });

  $container.append($zone);
}

/* ── START SLIDESHOW ── */
$("#startShowBtn")[0].addEventListener("click", () => {
  if (editMode) return;
  if (selectedImages.length === 0) {
    alert("Please select and finalize some images first!");
    return;
  }
  const delay = Math.max(100, parseInt($("#delayInput").val(), 10) || 1000);
  localStorage.setItem("slides", JSON.stringify(selectedImages));
  localStorage.setItem("delay", delay);
  window.open("slideshow.html", "Slideshow", "width=900,height=700");
});

/* ── EDIT MODE ── */
function positionHandle(btn, handle) {
  const r = btn.getBoundingClientRect();
  handle.style.left = (r.right - 6) + "px";
  handle.style.top  = (r.bottom - 6) + "px";
}

function enterEditMode() {
  editMode = true;
  $("#startEditBtn").prop("disabled", true);
  $("#completedBtn").prop("disabled", false);

  draggableBtns.forEach((id) => {
    const btn = document.getElementById(id);
    const state = btnState.get(btn);

    let left, top, width, height;

    if (state && state.moved) {
      // already repositioned — use saved position
      left   = state.fixedLeft;
      top    = state.fixedTop;
      width  = btn.offsetWidth;
      height = btn.offsetHeight;
    } else {
      // in normal flow — snapshot current position
      const rect = btn.getBoundingClientRect();
      left = rect.left; top = rect.top;
      width = rect.width; height = rect.height;

      // insert placeholder to hold layout space
      const ph = document.createElement("div");
      ph.style.width      = width + "px";
      ph.style.height     = height + "px";
      ph.style.display    = "inline-block";
      ph.style.marginTop  = $(btn).css("marginTop");
      btn.parentNode.insertBefore(ph, btn);
      btnState.set(btn, { ...(state || {}), placeholder: ph, moved: false });
    }

    // pull button out of flow
    btn.style.position    = "fixed";
    btn.style.left        = left + "px";
    btn.style.top         = top + "px";
    btn.style.width       = width + "px";
    btn.style.margin      = "0";
    btn.style.zIndex      = "999";
    $(btn).addClass("edit-mode-btn");

    // resize handle
    const handle = document.createElement("div");
    handle.className = "resize-handle";
    document.body.appendChild(handle);
    positionHandle(btn, handle);

    const currentState = btnState.get(btn) || {};
    btnState.set(btn, { ...currentState, handle });

    // resize logic
    handle.addEventListener("mousedown", function (e) {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const startW = btn.offsetWidth, startH = btn.offsetHeight;

      function onMove(e) {
        btn.style.width        = Math.max(60, startW + (e.clientX - startX)) + "px";
        btn.style.height       = Math.max(24, startH + (e.clientY - startY)) + "px";
        btn.style.borderRadius = Math.min(btn.offsetHeight / 2, 40) + "px";
        positionHandle(btn, handle);
      }
      function onStop() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onStop);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onStop);
    });
  });
}

function exitEditMode() {
  editMode = false;
  $("#startEditBtn").prop("disabled", false);
  $("#completedBtn").prop("disabled", true);

  draggableBtns.forEach((id) => {
    const btn = document.getElementById(id);
    const state = btnState.get(btn) || {};

    // remove handle
    if (state.handle) { state.handle.remove(); }

    if (state.moved) {
      // keep fixed at dragged position — remove placeholder
      if (state.placeholder && state.placeholder.parentNode) {
        state.placeholder.remove();
      }
      btnState.set(btn, { moved: true, fixedLeft: parseFloat(btn.style.left), fixedTop: parseFloat(btn.style.top) });
    } else {
      // restore to normal flow
      if (state.placeholder && state.placeholder.parentNode) {
        state.placeholder.parentNode.replaceChild(btn, state.placeholder);
      }
      btn.style.position    = "";
      btn.style.left        = "";
      btn.style.top         = "";
      btn.style.width       = "";
      btn.style.margin      = "";
      btn.style.zIndex      = "";
      btnState.set(btn, { moved: false });
    }

    $(btn).removeClass("edit-mode-btn");
    btn.style.zIndex = "";
  });
}

// ATTACH DRAG + CLICK ONCE AT PAGE LOAD
draggableBtns.forEach((id) => {
  const btn = document.getElementById(id);
  btnState.set(btn, { moved: false });

  btn.addEventListener("mousedown", function (e) {
    if (!editMode) return;
    e.preventDefault();

    const ox = e.clientX - parseFloat(btn.style.left);
    const oy = e.clientY - parseFloat(btn.style.top);

    function onMove(e) {
      const state = btnState.get(btn) || {};
      btnState.set(btn, { ...state, moved: true });
      btn.style.left = (e.clientX - ox) + "px";
      btn.style.top  = (e.clientY - oy) + "px";
      const handle = (btnState.get(btn) || {}).handle;
      if (handle) positionHandle(btn, handle);
    }
    function onStop() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onStop);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onStop);
  });

  btn.addEventListener("click", function (e) {
    if (editMode) { e.preventDefault(); e.stopPropagation(); }
  });
});

$("#startEditBtn")[0].addEventListener("click", enterEditMode);
$("#completedBtn")[0].addEventListener("click", exitEditMode);

// INIT
renderSelectedList();
