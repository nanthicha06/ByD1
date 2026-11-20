/* ==========================================================
   Body Scent — script.js
   One file shared by every page. Each init function runs only
   if the elements it needs exist on the current page.
   ========================================================== */

(function () {
  "use strict";

  var STORAGE_KEY = "bodyScentOrders";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var TYPE_LABEL = { spray: "น้ำหอมฉีดตัว", rollon: "โรลออน" };

  /* ---------- Helpers ---------- */

  function escapeHTML(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatPrice(n) {
    var num = Number(n);
    return isNaN(num) ? String(n) : num.toLocaleString("th-TH");
  }

  // Works for <input>, <textarea> and plain elements like <span>
  function setFieldValue(el, value) {
    if (!el) return;
    if ("value" in el) {
      el.value = value;
    } else {
      el.textContent = value;
    }
  }

  function getFieldValue(el) {
    if (!el) return "";
    return ("value" in el ? el.value : el.textContent || "").trim();
  }

  function readOrders() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Cannot read orders:", err);
      return [];
    }
  }

  /* ==========================================================
     product.html
     ========================================================== */

  function initProducts() {
    var list = document.getElementById("product-list");
    var filterBar = document.getElementById("filter-bar");
    if (!list) return;

    var products = [];
    var currentMood = "all";

    function validMood(m) {
      return MOODS.some(function (x) { return x.key === m; });
    }

    function cardHTML(p) {
      var meta = TYPE_LABEL[p.type] || p.type;
      if (p.size) meta += " · " + p.size;

      var orderUrl =
        "order.html?item=" + encodeURIComponent(p.name) +
        "&price=" + encodeURIComponent(p.price);

      return (
        '<article class="card">' +
          '<div class="card__media">' +
            '<img src="' + escapeHTML(p.image) + '" alt="' + escapeHTML(p.name) + '" loading="lazy">' +
          "</div>" +
          '<div class="card__body">' +
            '<span class="mood mood--' + escapeHTML(p.mood) + '">' + escapeHTML(p.mood.charAt(0).toUpperCase() + p.mood.slice(1)) + "</span>" +
            '<h3 class="card__title">' + escapeHTML(p.name) + "</h3>" +
            '<p class="card__meta">' + escapeHTML(meta) + "</p>" +
            '<p class="card__desc">' + escapeHTML(p.description) + "</p>" +
            '<div class="card__foot">' +
              '<span class="price">' + formatPrice(p.price) + " บาท</span>" +
              '<a class="btn btn--gold" href="' + orderUrl + '">สั่งซื้อ</a>' +
            "</div>" +
          "</div>" +
        "</article>"
      );
    }

    function render() {
      var shown = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      if (shown.length === 0) {
        list.innerHTML = '<p class="small">ไม่พบสินค้าในหมวดนี้</p>';
        return;
      }
      list.innerHTML = shown.map(cardHTML).join("");
    }

    function updateButtons() {
      if (!filterBar) return;
      filterBar.querySelectorAll("[data-mood]").forEach(function (btn) {
        var active = btn.getAttribute("data-mood") === currentMood;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function setMood(mood) {
      currentMood = validMood(mood) ? mood : "all";
      updateButtons();
      render();
    }

    function buildFilterBar() {
      if (!filterBar) return;
      // Use buttons already in the HTML if present, otherwise create them
      if (!filterBar.querySelector("[data-mood]")) {
        filterBar.innerHTML = MOODS.map(function (m) {
          return '<button type="button" class="filter" data-mood="' + m.key + '">' + m.label + "</button>";
        }).join("");
      }
      filterBar.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-mood]");
        if (btn) setMood(btn.getAttribute("data-mood"));
      });
    }

    buildFilterBar();

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        var param = (new URLSearchParams(window.location.search).get("mood") || "").toLowerCase();
        setMood(param);
      })
      .catch(function (err) {
        console.error("Cannot load products.json:", err);
        list.innerHTML =
          '<p class="small">โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาเปิดเว็บผ่านเซิร์ฟเวอร์ (เช่น Live Server) แทนการเปิดไฟล์โดยตรง</p>';
      });
  }

  /* ==========================================================
     order.html
     ========================================================== */

  function initOrder() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var itemsEl = document.getElementById("items");
    var totalEl = document.getElementById("total");

    // Prefill from URL: ?item=...&price=...  (always fill both fields)
    var params = new URLSearchParams(window.location.search);
    setFieldValue(itemsEl, params.get("item") || "");
    setFieldValue(totalEl, params.get("price") || "");

    function field(name) {
      var el = form.elements[name] || document.getElementById(name);
      return getFieldValue(el);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var payload = {
        customerName: field("customerName"),
        contact: field("contact"),
        items: getFieldValue(itemsEl),
        total: getFieldValue(totalEl),
        note: field("note"),
        timestamp: new Date().toISOString()
      };

      try {
        var orders = readOrders();
        orders.push(payload);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
      } catch (err) {
        console.error("Cannot save order:", err);
        alert("บันทึกคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      window.location.href = "thankyou.html";
    });
  }

  /* ==========================================================
     admin.html
     ========================================================== */

  function initAdmin() {
    var table = document.getElementById("ordersTable");
    if (!table) return;

    var tbody = table.querySelector("tbody") || table.appendChild(document.createElement("tbody"));
    var colCount = (table.querySelectorAll("thead th").length) || 6;

    var orders = readOrders().slice().sort(function (a, b) {
      return (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0);
    });

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="' + colCount + '">ยังไม่มีคำสั่งซื้อ</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(function (o) {
      var t = Date.parse(o.timestamp);
      var when = isNaN(t) ? "-" : new Date(t).toLocaleString("th-TH");
      return (
        "<tr>" +
          "<td>" + escapeHTML(when) + "</td>" +
          "<td>" + escapeHTML(o.customerName) + "</td>" +
          "<td>" + escapeHTML(o.contact) + "</td>" +
          "<td>" + escapeHTML(o.items) + "</td>" +
          "<td>" + escapeHTML(formatPrice(o.total)) + "</td>" +
          "<td>" + escapeHTML(o.note || "-") + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  /* ---------- Boot ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    initProducts();
    initOrder();
    initAdmin();
  });
})();
