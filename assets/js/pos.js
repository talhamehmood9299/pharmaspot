const jsPDF = require("jspdf");
const html2canvas = require("html2canvas");
const macaddress = require("macaddress");
const notiflix = require("notiflix");
const validator = require("validator");
const DOMPurify = require("dompurify");
const _ = require("lodash");
let fs = require("fs");
let path = require("path");
let moment = require("moment");
let { ipcRenderer } = require("electron");
let dotInterval = setInterval(function () {
  $(".dot").text(".");
}, 3000);
let Store = require("electron-store");
const remote = require("@electron/remote");
const app = remote.app;
let cart = [];
let index = 0;
let allUsers = [];
let allProducts = [];
let allCategories = [];
let allTransactions = [];
let sold = [];
let state = [];
let sold_items = [];
let allCustomers = [];
let pendingCartFocus = null;
let item;
let auth;
let holdOrder = 0;
let vat = 0;
let perms = null;
let deleteId = 0;
let paymentType = 0;
let receipt = "";
let totalVat = 0;
let subTotal = 0;
let method = "";
let order_index = 0;
let user_index = 0;
let product_index = 0;
let transaction_index;
const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
let host = "localhost";
let port = process.env.PORT;
let img_path = path.join(appData, appName, "uploads", "/");
let api = "http://" + host + ":" + port + "/api/";
const bcrypt = require("bcrypt");
let categories = [];
let holdOrderList = [];
let customerOrderList = [];
let ownUserEdit = null;
let totalPrice = 0;
let orderTotal = 0;
let auth_error = "Incorrect username or password";
let auth_empty = "Please enter a username and password";
let holdOrderlocation = $("#renderHoldOrders");
let customerOrderLocation = $("#renderCustomerOrders");
let storage = new Store();
let settings;
let platform;
let user = {};
let start = moment().startOf("month");
let end = moment();
let start_date = moment(start).toDate();
let end_date = moment(end).toDate();
let by_till = 0;
let by_user = 0;
let by_status = 1;
const default_item_img = path.join("assets","images","default.jpg");
const permissions = [
  "perm_products",
  "perm_categories",
  "perm_transactions",
  "perm_users",
  "perm_settings",
];
notiflix.Notify.init({
  position: "right-top",
  cssAnimationDuration: 600,
  messageMaxLength: 150,
  clickToClose: true,
  closeButton: true
});
const {
  DATE_FORMAT,
  moneyFormat,
  isExpired,
  daysToExpire,
  getStockStatus,
  checkFileExists,
  setContentSecurityPolicy,
} = require("./utils");

//set the content security policy of the app
setContentSecurityPolicy();

// Safer datepicker initialization inside document.ready
$(function () {
  try {
    if ($.fn.daterangepicker) {
      var label = moment(start).format("MMMM D, YYYY") + "  -  " + moment(end).format("MMMM D, YYYY");
      $("#reportrange span").text(label);
      $("#reportrange").daterangepicker({ startDate: start, endDate: end });
      $("#expirationDate").daterangepicker({ singleDatePicker: true, locale: { format: DATE_FORMAT } });
    }
  } catch (e) {
    console.error("daterangepicker init failed", e);
  }
});

//Allow only numbers in input field
$.fn.allowOnlyNumbers = function() {
  return this.on('keydown', function(e) {
  // Allow: backspace, delete, tab, escape, enter, ., ctrl/cmd+A, ctrl/cmd+C, ctrl/cmd+X, ctrl/cmd+V, end, home, left, right, down, up
    if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 110, 190]) !== -1 || 
      (e.keyCode >= 35 && e.keyCode <= 40) || 
      ((e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88) && (e.ctrlKey === true || e.metaKey === true))) {
      return;
  }
  // Ensure that it is a number and stop the keypress
  if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
    e.preventDefault();
  }
});
};
$('.number-input').allowOnlyNumbers();

//Serialize Object
$.fn.serializeObject = function () {
  var o = {};
  var a = this.serializeArray();
  $.each(a, function () {
    if (o[this.name]) {
      if (!o[this.name].push) {
        o[this.name] = [o[this.name]];
      }
      o[this.name].push(this.value || "");
    } else {
      o[this.name] = this.value || "";
    }
  });
  return o;
};

auth = storage.get("auth");
user = storage.get("user");

$("#main_app").hide();
if (auth == undefined) {
  $.get(api + "users/check/", function (data) {});

  authenticate();
} else {
  $("#login").hide();
  $("#main_app").show();
  platform = storage.get("settings");

  if (platform != undefined) {
    if (platform.app == "Network Point of Sale Terminal") {
      api = "http://" + platform.ip + ":" + port + "/api/";
      perms = true;
    }
  }

  $.get(api + "users/user/" + user._id, function (data) {
    user = data;
    $("#loggedin-user").text(user.fullname);
  });

  $.get(api + "settings/get", function (data) {
    settings = data.settings;
  });

  $.get(api + "users/all", function (users) {
    allUsers = [...users];
  });

  $(document).ready(function () {
    //update title based on company
    let appTitle = !!settings ? `${validator.unescape(settings.store)} - ${appName}` : appName;
    $("title").text(appTitle);

    $(".loading").hide();

    loadCategories();
    loadProducts();
    loadCustomers();

    if (settings && validator.unescape(settings.symbol)) {
      $("#price_curr, #payment_curr, #change_curr").text(validator.unescape(settings.symbol));
    }

    setTimeout(function () {
      if (settings == undefined && auth != undefined) {
        $("#settingsModal").modal("show");
      } else {
        vat = parseFloat(validator.unescape(settings.percentage));
        $("#taxInfo").text(settings.charge_tax ? vat : 0);
      }
    }, 1500);

    $("#settingsModal").on("hide.bs.modal", function () {
      setTimeout(function () {
        if (settings == undefined && auth != undefined) {
          $("#settingsModal").modal("show");
        }
      }, 1000);
    });

    if (0 == user.perm_products) {
      $(".p_one").hide();
    }
    if (0 == user.perm_categories) {
      $(".p_two").hide();
    }
    if (0 == user.perm_transactions) {
      $(".p_three").hide();
    }
    if (0 == user.perm_users) {
      $(".p_four").hide();
    }
    if (0 == user.perm_settings) {
      $(".p_five").hide();
    }

    function loadProducts() {
      $.get(api + "inventory/products", function (data) {
        data.forEach((item) => {
          item.price = parseFloat(item.price).toFixed(2);
        });

        allProducts = [...data];

        loadProductList();

        let delay = 0;
        let expiredCount = 0;
        allProducts.forEach((product) => {
          let todayDate = moment();
          let expiryDate = moment(product.expirationDate, DATE_FORMAT);

          if (!isExpired(expiryDate)) {
            const diffDays = daysToExpire(expiryDate);

            if (diffDays > 0 && diffDays <= 30) {
              var days_noun = diffDays > 1 ? "days" : "day";
              notiflix.Notify.warning(
                `${product.name} has only ${diffDays} ${days_noun} left to expiry`,
              );
            }
          } else {
            expiredCount++;
          }
        });

        //Show notification if there are any expired goods.
        if(expiredCount>0)
        {
           notiflix.Notify.failure(
          `${expiredCount} ${
            expiredCount > 0 ? "products" : "product"
          } expired. Please restock!`,
        );
        }

       
        $("#parent").text("");

        data.forEach((item) => {
          if (!categories.includes(item.category)) {
            categories.push(item.category);
          }
          let item_isExpired = isExpired(item.expirationDate);
          let item_stockStatus = getStockStatus(item.quantity,item.minStock);
          if(item.img==="")
          {
            item_img = default_item_img;
          }
          else
          {
            item_img = path.join(img_path, item.img);
            item_img = checkFileExists(item_img) ? item_img : default_item_img;
          }
          

          let item_info = `<div class="col-lg-2 box ${item.category}"
                                onclick="$(this).addToCart(${item._id}, ${
                                  item.quantity
                                }, ${item.stock})">
                            <div class="widget-panel widget-style-2 " title="${item.name}">                    
                            <div id="image"><img src="${item_img}" id="product_img" alt=""></div>                    
                                        <div class="text-muted m-t-5 text-center">
                                        <div class="name" id="product_name"><span class="${
                                          item_isExpired ? "text-danger" : ""
                                        }">${item.name}</span></div> 
                                        <span class="sku">${
                                          item.barcode || item._id
                                        }</span>
                                        <span class="${item_stockStatus<1?'text-danger':''}"><span class="stock">STOCK </span><span class="count">${
                                          item.stock == 1
                                            ? item.quantity
                                            : "N/A"
                                        }</span></span></div>
                                        <span class="text-success text-center"><b data-plugin="counterup">${
                                          validator.unescape(settings.symbol) +
                                          moneyFormat(item.price)
                                        }</b> </span>
                            </div>
                        </div>`;
          $("#parent").append(item_info);
        });
      });
    }

    function loadCategories() {
      $.get(api + "categories/all", function (data) {
        allCategories = data;
        loadCategoryList();
        $("#category,#categories,#modal_category").html(`<option value="0">Select</option>`);
        $("#profitCompanyFilter").html(`<option value="">All companies</option>`);

        allCategories.forEach((category) => {
          $("#category,#categories,#modal_category").append(
            `<option value="${category._id}">${category.name}</option>`,
          );
          $("#profitCompanyFilter").append(
            `<option value="${category._id}">${category.name}</option>`,
          );
        });
      });
    }

    function setReportDefaultDates() {
      const end = moment();
      const start = moment().subtract(30, "days");
      $("#profitStartDate").val(start.format("DD/MM/YYYY"));
      $("#profitEndDate").val(end.format("DD/MM/YYYY"));
    }

    function loadCustomers() {
      $.get(api + "customers/all", function (customers) {
        allCustomers = customers || [];

        $("#customer")
          .empty()
          .append($("<option>", { value: 0, text: "Walk in customer", selected: "selected" }));

        allCustomers.forEach((cust) => {
          $("#customer").append(
            $("<option>", {
              value: getCustomerOptionValue(cust),
              text: cust.name,
            }),
          );
        });

        // Default visible value in search box
        $("#customerSearch").val("Walk in customer");
        $("#customerDropdown").hide().empty();
      });
    }

    function ensureProductSearchStyles() {
      if ($("#productSearchStyles").length) {
        return;
      }

      const styles = `
        #productDropdown, #customerDropdown {
          padding: 0;
          width: 100%;
          min-width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          max-height: none !important;
          overflow-y: auto !important;
        }
        #productDropdown .product-search-item,
        #customerDropdown .product-search-item {
          padding: 12px 14px;
          border-bottom: 1px solid #f0f0f0;
          display: block;
          text-decoration: none;
          color: inherit;
          white-space: normal;
        }
        #productDropdown .product-search-item:last-child,
        #customerDropdown .product-search-item:last-child {
          border-bottom: none;
        }
        #productDropdown .product-search-item:hover,
        #customerDropdown .product-search-item:hover {
          background: #f7fafc;
        }
        #productDropdown .product-search-row,
        #customerDropdown .product-search-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        #productDropdown .product-search-name,
        #customerDropdown .product-search-name {
          font-weight: 600;
          font-size: 14px;
          margin: 0;
        }
        #productDropdown .product-search-price {
          font-weight: 600;
          color: #0f9d58;
          font-size: 13px;
          margin-left: 8px;
        }
        #productDropdown .product-search-meta,
        #customerDropdown .product-search-meta {
          font-size: 12px;
          color: #6c757d;
          margin-top: 2px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        #productDropdown .stock-chip {
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 11px;
        }
        #productDropdown .stock-ok {
          background: #e8f5e9;
          color: #0f9d58;
        }
        #productDropdown .stock-low {
          background: #fff4e5;
          color: #d97706;
        }
        #productDropdown .stock-out {
          background: #fdecea;
          color: #c53030;
        }
      `;

      $("<style>", { id: "productSearchStyles", text: styles }).appendTo("head");
    }

    function adjustDropdownPosition(dropdown) {
      if (!dropdown || !dropdown.length) {
        return;
      }
      const parentRect = dropdown.parent().get(0).getBoundingClientRect();
      const margin = 10;
      const spaceBelow = window.innerHeight - parentRect.bottom - margin;
      const spaceAbove = parentRect.top - margin;
      const defaultHeight = 220;
      let css = {
        position: "absolute",
        overflowY: "auto",
      };
      if (spaceBelow < defaultHeight && spaceAbove > spaceBelow) {
        css.top = "auto";
        css.bottom = "100%";
        css.maxHeight = `${Math.max(120, Math.min(spaceAbove, defaultHeight))}px`;
      } else {
        css.top = "100%";
        css.bottom = "auto";
        css.maxHeight = `${Math.max(120, Math.min(spaceBelow, defaultHeight))}px`;
      }
      dropdown.css(css);
    }

    function getCategoryNameById(categoryId) {
      const category = allCategories.find((cat) => cat._id == categoryId);
      return category ? category.name : "";
    }

    function getCustomerOptionValue(customer) {
      return JSON.stringify({ id: customer._id || customer.id, name: customer.name });
    }

    function renderProductSearchResults(products) {
      const dropdown = $("#productDropdown");
      dropdown.empty();
      ensureProductSearchStyles();

      if (products.length === 0) {
        dropdown
          .append(
            $("<div>", {
              class: "dropdown-item text-muted",
              text: "No products found",
            }),
          )
          .show();
        return;
      }

      products.slice(0, 10).forEach((product) => {
        const categoryName = getCategoryNameById(product.category);
        const stockQty = product.stock == 1 ? product.quantity : "N/A";
        const priceLabel =
          settings && settings.symbol
            ? `${validator.unescape(settings.symbol)}${moneyFormat(product.price)}`
            : moneyFormat(product.price);
        const stockChipClass =
          stockQty === "N/A"
            ? "stock-low"
            : stockQty > 0
            ? "stock-ok"
            : "stock-out";
        const stockChipText =
          stockQty === "N/A" ? "Stock N/A" : `${stockQty} in stock`;

        dropdown.append(
          $("<a>", {
            class: "product-search-item",
            href: "#",
            "data-id": product._id,
          }).append(
            $("<div>", { class: "product-search-row" }).append(
              $("<p>", { class: "product-search-name", text: product.name }),
              $("<span>", { class: "product-search-price", text: priceLabel }),
            ),
            $("<div>", { class: "product-search-meta" }).append(
              $("<span>", {
                text: categoryName || "Uncategorized",
              }),
              $("<span>", {
                class: `stock-chip ${stockChipClass}`,
                text: stockChipText,
              }),
            ),
          ),
        );
      });

      adjustDropdownPosition(dropdown);
      dropdown.show();
    }

    function handleProductSearch(term) {
      const query = term.toLowerCase();
      const matches = allProducts.filter((product) => {
        const name = (product.name || "").toLowerCase();
        const categoryName = getCategoryNameById(product.category).toLowerCase();
        const barcode = ((product.barcode || product._id || "") + "").toLowerCase();

        return (
          name.includes(query) ||
          categoryName.includes(query) ||
          barcode.includes(query)
        );
      });

      renderProductSearchResults(matches);
    }

    $("#productSearch").on(
      "input",
      _.debounce(function () {
        const term = $(this).val().trim();
        if (term === "") {
          $("#productDropdown").hide().empty();
          return;
        }
        handleProductSearch(term);
      }, 150),
    );

    $("#productSearch").on("keydown", function (e) {
      const items = $("#productDropdown .product-search-item");
      let active = $("#productDropdown .product-search-item.active");
      const term = $.trim($(this).val());

      if (e.key === "Enter" && term === "") {
        // empty search: do nothing, avoid unintended qty changes
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        $("#productDropdown").hide().empty();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        let next;
        if (!active.length) {
          next = e.key === "ArrowDown" ? items.first() : items.last();
        } else {
          next =
            e.key === "ArrowDown"
              ? active.next(".product-search-item")
              : active.prev(".product-search-item");
          if (!next.length) {
            next = e.key === "ArrowDown" ? items.first() : items.last();
          }
        }
        items.removeClass("active");
        next.addClass("active");
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        // If no items yet, force a search once before selecting
        if (!items.length && term !== "") {
          handleProductSearch(term);
          setTimeout(() => {
            const first = $("#productDropdown .product-search-item").first();
            if (first.length) {
              $(this).addProductFromSearch(first.data("id"));
            }
          }, 50);
          return;
        }

        const activeItem = $("#productDropdown .product-search-item.active").first();
        const target = activeItem.length
          ? activeItem
          : $("#productDropdown .product-search-item").first();
        if (target.length) {
          $(this).addProductFromSearch(target.data("id"));
        }
      }
    });

    $("#productDropdown").on("click", ".product-search-item", function (e) {
      e.preventDefault();
      $(this).addProductFromSearch($(this).data("id"));
    });

    function renderCustomerSearchResults(customers) {
      const dropdown = $("#customerDropdown");
      dropdown.empty();
      ensureProductSearchStyles();

      if (customers.length === 0) {
        dropdown
          .append(
            $("<div>", {
              class: "dropdown-item text-muted",
              text: "No customers found",
            }),
          )
          .show();
        return;
      }

      customers.slice(0, 10).forEach((customer) => {
        const contactInfo =
          customer.contact ||
          customer.phone ||
          customer.email ||
          customer.address ||
          "";
        const metaPieces = [];
        if (contactInfo) {
          metaPieces.push(contactInfo);
        }
        metaPieces.push(`ID: ${customer._id}`);

        dropdown.append(
          $("<a>", {
            class: "product-search-item",
            href: "#",
            "data-id": customer._id,
          }).append(
            $("<div>", { class: "product-search-row" }).append(
              $("<p>", {
                class: "product-search-name",
                text: customer.name || "Unnamed Customer",
              }),
            ),
            $("<div>", {
              class: "product-search-meta",
              text: metaPieces.join(" • "),
            }),
          ),
        );
      });

      adjustDropdownPosition(dropdown);
      dropdown.show();
    }

    function handleCustomerSearch(term) {
      const query = term.toLowerCase();
      const matches = allCustomers.filter((customer) => {
        const name = (customer.name || "").toLowerCase();
        const contact = (customer.contact || customer.phone || customer.email || "").toLowerCase();
        return name.includes(query) || contact.includes(query);
      });

      renderCustomerSearchResults(matches);
    }

    function setSelectedCustomer(customer) {
      if (customer) {
        const optionValue = getCustomerOptionValue(customer);
        // ensure option exists
        if (!$("#customer option").filter(function () { return $(this).val() == optionValue; }).length) {
          $("#customer").append(
            $("<option>", {
              value: optionValue,
              text: customer.name,
            }),
          );
        }
        $("#customer").val(optionValue);
        $("#customerSearch").val(customer.name);
      } else {
        $("#customer").val(0);
        $("#customerSearch").val("Walk in customer");
      }
      $("#customerDropdown").hide();
    }

    $("#customerSearch").on(
      "input",
      _.debounce(function () {
        const term = $(this).val().trim();
        if (term === "") {
          $("#customerDropdown").hide().empty();
          return;
        }
        handleCustomerSearch(term);
      }, 150),
    );

    $("#customerSearch").on("focus", function () {
      const term = $(this).val().trim();
      if (term === "" || term.toLowerCase() === "walk in customer") {
        renderCustomerSearchResults(allCustomers);
      } else {
        handleCustomerSearch(term);
      }
    });

    $("#customerSearch").on("keydown", function (e) {
      const items = $("#customerDropdown .product-search-item");
      let active = $("#customerDropdown .product-search-item.active");
      const term = $.trim($(this).val());

      if (e.key === "Enter" && term === "") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        $("#customerDropdown").hide().empty();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        let next;
        if (!active.length) {
          next = e.key === "ArrowDown" ? items.first() : items.last();
        } else {
          next =
            e.key === "ArrowDown"
              ? active.next(".product-search-item")
              : active.prev(".product-search-item");
          if (!next.length) {
            next = e.key === "ArrowDown" ? items.first() : items.last();
          }
        }
        items.removeClass("active");
        next.addClass("active");
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (!items.length && term !== "") {
          handleCustomerSearch(term);
          setTimeout(() => {
            const first = $("#customerDropdown .product-search-item").first();
            if (first.length) {
              const selected = allCustomers.find((c) => c._id == first.data("id"));
              setSelectedCustomer(selected);
            }
          }, 50);
          return;
        }

        const activeItem = $("#customerDropdown .product-search-item.active").first();
        const target = activeItem.length
          ? activeItem
          : $("#customerDropdown .product-search-item").first();
        if (target.length) {
          const selected = allCustomers.find((c) => c._id == target.data("id"));
          setSelectedCustomer(selected);
        }
      }
    });

    $("#customerDropdown").on("click", ".product-search-item", function (e) {
      e.preventDefault();
      const selected = allCustomers.find((c) => c._id == $(this).data("id"));
      setSelectedCustomer(selected);
    });

    $(document).on("click", function (e) {
      if (!$(e.target).closest("#productSearch, #productDropdown").length) {
        $("#productDropdown").hide();
      }
      if (!$(e.target).closest("#customerSearch, #customerDropdown").length) {
        $("#customerDropdown").hide();
      }
    });

    $("#productSearch").on("focus click", function () {
      if ($.trim($(this).val()) === "") {
        $("#productDropdown").hide().empty();
      }
    });

    // cart input keyboard handlers
    $("body").on("change", ".cart-qty-input", function () {
      const index = $(this).data("index");
      updateQuantity(index, $(this).val());
    });

    $("body").on("change", ".cart-discount-input", function () {
      const index = $(this).data("index");
      updateDiscount(index, $(this).val());
    });

    $("body").on("change", ".cart-discount2-input", function () {
      const index = $(this).data("index");
      updateDiscount2(index, $(this).val());
    });

    $("body").on("keydown", ".cart-input", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const current = $(this);
        const currentIndex = current.data("index");

        // If on qty, go to discount in same row first
        if (current.hasClass("cart-qty-input")) {
          const discountField = $(`.cart-discount-input[data-index='${currentIndex}']`);
          if (discountField.length) {
            pendingCartFocus = { target: "cart-discount-input", index: currentIndex };
            discountField.focus().select();
            return;
          }
        }

        // If on first discount, go to discount2 in same row
        if (current.hasClass("cart-discount-input")) {
          const discountField2 = $(`.cart-discount2-input[data-index='${currentIndex}']`);
          if (discountField2.length) {
            pendingCartFocus = { target: "cart-discount2-input", index: currentIndex };
            discountField2.focus().select();
            return;
          }
        }

        // If on discount2, go to discount3 in same row
        if (current.hasClass("cart-discount2-input")) {
          const discountField3 = $(`.[data-index='${currentIndex}']`);
          if (discountField3.length) {
            pendingCartFocus = { target: "", index: currentIndex };
            discountField3.focus().select();
            return;
          }
        }

        // If on discount3, go to next qty input (next row) if any
        if (current.hasClass("")) {
          const nextQty = $(`.cart-qty-input[data-index='${currentIndex + 1}']`);
          if (nextQty.length) {
            pendingCartFocus = { target: "cart-qty-input", index: currentIndex + 1 };
            nextQty.focus().select();
            return;
          } else {
            // last row: jump back to product search for next item
            const prodSearch = $("#productSearch");
            if (prodSearch.length) {
              pendingCartFocus = { target: "productSearch", index: 0 };
              prodSearch.focus().select();
              return;
            }
          }
        }

        // Fallback: move to next input in DOM order
        const inputs = $(".cart-input");
        const idx = inputs.index(this);
        if (idx >= 0 && idx < inputs.length - 1) {
          const targetInput = inputs.eq(idx + 1);
          const targetIndex = targetInput.data("index");
          const targetClass = targetInput.hasClass("cart-qty-input")
            ? "cart-qty-input"
            : targetInput.hasClass("cart-discount-input")
            ? "cart-discount-input"
            : targetInput.hasClass("cart-discount2-input")
            ? "cart-discount2-input"
            : targetInput.hasClass("")
            ? ""
            : null;
          if (targetClass) {
            pendingCartFocus = { target: targetClass, index: targetIndex };
          }
          targetInput.focus().select();
        } else {
          const prodSearch = $("#productSearch");
          if (prodSearch.length) {
            pendingCartFocus = { target: "productSearch", index: 0 };
            prodSearch.focus().select();
          } else {
            $(this).blur();
          }
        }
      }
    });

    $.fn.addToCart = function (id, count, stock) {
      $.get(api + "inventory/product/" + id, function (product) {
        if (isExpired(product.expirationDate)) {
          notiflix.Report.failure(
            "Expired",
            `${product.name} is expired! Please restock.`,
            "Ok",
          );
        } else {
          if (count > 0) {
            $(this).addProductToCart(product);
          } else {
            if (stock == 1) {
              notiflix.Report.failure(
                "Out of stock!",
                `${product.name} is out of stock! Please restock.`,
                "Ok",
              );
            }
          }
        }
      });
    };

    // Barcode search function disabled
    /*
    function barcodeSearch(e) {
      e.preventDefault();
      let searchBarCodeIcon = $(".search-barcode-btn").html();
      $(".search-barcode-btn").empty();
      $(".search-barcode-btn").append(
        $("<i>", { class: "fa fa-spinner fa-spin" }),
      );

      let req = {
        skuCode: $("#skuCode").val(),
      };

      $.ajax({
        url: api + "inventory/product/sku",
        type: "POST",
        data: JSON.stringify(req),
        contentType: "application/json; charset=utf-8",
        cache: false,
        processData: false,
        success: function (product) {
          $(".search-barcode-btn").html(searchBarCodeIcon);
          const expired = isExpired(product.expirationDate);
          if (product._id != undefined && product.quantity >= 1 && !expired) {
            $(this).addProductToCart(product);
            $("#searchBarCode").get(0).reset();
            $("#basic-addon2").empty();
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-ok" }),
            );
          } else if (expired) {
            notiflix.Report.failure(
              "Expired!",
              `${product.name} is expired`,
              "Ok",
            );
          } else if (product.quantity < 1) {
            notiflix.Report.info(
              "Out of stock!",
              "This item is currently unavailable",
              "Ok",
            );
          } else {
            notiflix.Report.warning(
              "Not Found!",
              "<b>" + $("#skuCode").val() + "</b> is not a valid barcode!",
              "Ok",
            );

            $("#searchBarCode").get(0).reset();
            $("#basic-addon2").empty();
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-ok" }),
            );
          }
        },
        error: function (err) {
          if (err.status === 422) {
            $(this).showValidationError(data);
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-remove" }),
            );
          } else if (err.status === 404) {
            $("#basic-addon2").empty();
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-remove" }),
            );
          } else {
            $(this).showServerError();
            $("#basic-addon2").empty();
            $("#basic-addon2").append(
              $("<i>", { class: "glyphicon glyphicon-warning-sign" }),
            );
          }
        },
      });
    }
    */

    // Barcode search feature disabled
    /*
    $("#searchBarCode").on("submit", function (e) {
      barcodeSearch(e);
    });

    $("body").on("click", "#jq-keyboard button", function (e) {
      let pressed = $(this)[0].className.split(" ");
      if ($("#skuCode").val() != "" && pressed[2] == "enter") {
        barcodeSearch(e);
      }
    });
    */

    $.fn.addProductToCart = function (data) {
      item = {
        id: data._id,
        product_name: data.name,
        sku: data.sku,
        price: data.price,
        purchase_discount: data.purchase_discount || 0,
        sale_discount: data.sale_discount || 0,
        sale_discount2: data.sale_discount2 || 0,
        quantity: 1,
      };

      let targetIndex;

      if ($(this).isExist(item)) {
        targetIndex = index;
        $(this).qtIncrement(index);
      } else {
        cart.push(item);
        targetIndex = cart.length - 1;
        $(this).renderTable(cart);
      }

      focusCartQuantity(targetIndex);
      return targetIndex;
    };

    $.fn.addProductFromSearch = function (productId) {
      let product = allProducts.find(p => p._id == productId);
      if (product) {
        $(this).addProductToCart(product);
        $("#productSearch").val("").focus();
        $("#productDropdown").hide();
        notiflix.Notify.success(`${product.name} added to cart`, { timeout: 1500, clickToClose: true });
      }
    };

    $.fn.isExist = function (data) {
      let toReturn = false;
      $.each(cart, function (index, value) {
        if (value.id == data.id) {
          $(this).setIndex(index);
          toReturn = true;
        }
      });
      return toReturn;
    };

    $.fn.setIndex = function (value) {
      index = value;
    };
    

    $.fn.calculateCart = function () {
      let total = 0;
      let grossTotal;
      let total_items = cart.length;
      $.each(cart, function (index, data) {
        // Apply sale discount(s) to price
        let discounted_price =
          data.price *
          (1 - (data.sale_discount || 0) / 100) *
          (1 - (data.sale_discount2 || 0) / 100);
        total += (parseFloat(data.quantity) || 0) * discounted_price;
      });
      $("#total").text(total_items);
      const discountField = $("#inputDiscount");
      const discountValue =
        discountField.length > 0 ? parseFloat(discountField.val()) || 0 : 0;
      total = total - discountValue;
      $("#price").text(validator.unescape(settings.symbol) + moneyFormat(total.toFixed(2)));

      subTotal = total;

      if (discountField.length > 0 && discountValue >= total) {
        discountField.val(0);
      }

      if (settings.charge_tax) {
        totalVat = (total * vat) / 100;
        grossTotal = total + totalVat;
      } else {
        grossTotal = total;
      }

      orderTotal = grossTotal.toFixed(2);

      $("#gross_price").text(validator.unescape(settings.symbol) + moneyFormat(orderTotal));
      $("#payablePrice").val(moneyFormat(grossTotal));
    };

    $.fn.renderTable = function (cartList) {
      $("#cartTable .card-body").empty();
      $(this).calculateCart();
      $.each(cartList, function (index, data) {
        let discounted_price =
          data.price *
          (1 - (data.sale_discount || 0) / 100) *
          (1 - (data.sale_discount2 || 0) / 100);
        
        $("#cartTable .card-body").append(
          $("<div>", { class: "row cart-row" }).append(
            $("<div>", { class: "col-md-1 text-center", text: index + 1 }),
            $("<div>", { class: "col-md-2 text-center" }).append(
              $("<div>", { class: "cart-item-name", text: data.product_name }),
              $("<small>", {
                class: "text-muted",
                text: `${validator.unescape(settings.symbol)}${moneyFormat(
                  parseFloat(data.price).toFixed(2),
                )}`,
              }),
            ),
            $("<div>", { class: "col-md-1 text-center" }).append(
              $("<input>", {
                class: "form-control cart-input cart-qty-input",
                type: "number",
                min: "1",
                value: data.quantity,
                "data-index": index,
                step: "1",
                inputmode: "numeric",
                style: "text-align: center; height: 30px;",
              }),
            ),
            $("<div>", { class: "col-md-2 text-center" }).append(
              $("<div>", { class: "input-group" }).append(
                $("<input>", {
                  class: "form-control cart-input cart-discount-input",
                  type: "number",
                  min: "0",
                  max: "100",
                  value: data.sale_discount || 0,
                  "data-index": index,
                  style: "text-align: center; height: 30px;",
                }),
                $("<span>", { class: "input-group-addon", text: "%" })
              ),
            ),
            $("<div>", { class: "col-md-2 text-center" }).append(
              $("<div>", { class: "input-group" }).append(
                $("<input>", {
                  class: "form-control cart-input cart-discount2-input",
                  type: "number",
                  min: "0",
                  max: "100",
                  value: data.sale_discount2 || 0,
                  "data-index": index,
                  style: "text-align: center; height: 30px;",
                }),
                $("<span>", { class: "input-group-addon", text: "%" })
              ),
            ),
            $("<div>", {
              class: "col-md-1 text-center",
              text:
                validator.unescape(settings.symbol) +
                moneyFormat((discounted_price * (parseFloat(data.quantity) || 0)).toFixed(2)),
            }),
            $("<div>", { class: "col-md-1 text-center" }).append(
              $("<button>", {
                class: "btn btn-danger btn-xs m-l-5",
                onclick: "$(this).deleteFromCart(" + index + ")",
              }).append($("<i>", { class: "fa fa-trash" }))
            ),
          ),
        );
      });

      // apply pending focus if set
      if (pendingCartFocus) {
        setTimeout(() => {
          if (pendingCartFocus.target === "productSearch") {
            $("#productSearch").focus().select();
          } else {
            const input = $(`.${pendingCartFocus.target}[data-index='${pendingCartFocus.index}']`);
            if (input.length) {
              input.focus().select();
            }
          }
          pendingCartFocus = null;
        }, 10);
      }
    };

    $.fn.deleteFromCart = function (index) {
      cart.splice(index, 1);
      $(this).renderTable(cart);
    };

    function focusCartQuantity(targetIndex) {
      setTimeout(() => {
        const input = $(`.cart-qty-input[data-index='${targetIndex}']`);
        if (input.length) {
          input.focus().select();
        }
      }, 30);
    }

    $.fn.qtIncrement = function (i) {
      item = cart[i];
      let product = allProducts.filter(function (selected) {
        return selected._id == parseInt(item.id);
      });

      if (product[0].stock == 1) {
        if (item.quantity < product[0].quantity) {
          item.quantity = parseInt(item.quantity) + 1;
          $(this).renderTable(cart);
        } else {
          notiflix.Report.info(
            "No more stock!",
            "You have already added all the available stock.",
            "Ok",
          );
        }
      } else {
        item.quantity = parseInt(item.quantity) + 1;
        $(this).renderTable(cart);
      }
    };

    $.fn.qtDecrement = function (i) {
      if (item.quantity > 1) {
        item = cart[i];
        item.quantity = parseInt(item.quantity) - 1;
        $(this).renderTable(cart);
      }
    };

    $.fn.qtInput = function (i) {
      item = cart[i];
      item.quantity = $(this).val();
      $(this).renderTable(cart);
    };

    function updateQuantity(index, newQty) {
      let item = cart[index];
      let qty = parseInt(newQty);
      if (isNaN(qty) || qty < 1) {
        qty = 1;
      }

      const product = allProducts.find((p) => p._id == item.id);
      if (product && product.stock == 1 && qty > product.quantity) {
        qty = product.quantity;
        notiflix.Notify.info("Capped at available stock.");
      }

      item.quantity = qty;
      $(document.body).renderTable(cart);
    }

    function updateDiscount(index, newDiscount) {
      let item = cart[index];
      let discount = parseFloat(newDiscount);
      if (isNaN(discount) || discount < 0) {
        discount = 0;
      }
      if (discount > 100) {
        discount = 100;
      }
      item.sale_discount = discount;
      $(document.body).renderTable(cart);
    }

    function updateDiscount2(index, newDiscount) {
      let item = cart[index];
      let discount = parseFloat(newDiscount);
      if (isNaN(discount) || discount < 0) {
        discount = 0;
      }
      if (discount > 100) {
        discount = 100;
      }
      item.sale_discount2 = discount;
      $(document.body).renderTable(cart);
    }

    function updateDiscount3(index, newDiscount) {
      let item = cart[index];
      let discount = parseFloat(newDiscount);
      if (isNaN(discount) || discount < 0) {
        discount = 0;
      }
      if (discount > 100) {
        discount = 100;
      }
      
      $(document.body).renderTable(cart);
    }

    // removed legacy bonus buy/free handlers (unused)

    $.fn.editDiscount = function (index) {
      item = cart[index];
      const dialogContent = `
        <div class="form-group">
          <label>Current Sale Discount: ${item.sale_discount || 0}%</label>
          <input type="number" id="newDiscount" class="form-control" min="0" max="100" value="${item.sale_discount || 0}" placeholder="Enter discount percentage">
        </div>
      `;
      
      notiflix.Confirm.show(
        'Edit Discount',
        dialogContent,
        'Apply',
        'Cancel',
        function() {
          let newDiscount = parseFloat(document.getElementById('newDiscount').value) || 0;
          if (newDiscount >= 0 && newDiscount <= 100) {
            item.sale_discount = newDiscount;
            $(document.body).renderTable(cart);
            notiflix.Notify.Success('Discount updated');
          } else {
            notiflix.Notify.Warning('Discount must be between 0 and 100');
          }
        },
        function() {
          // Cancel clicked
        }
      );
    };

    $.fn.cancelOrder = function () {
      if (cart.length > 0) {
        const diagOptions = {
          title: "Are you sure?",
          text: "You are about to remove all items from the cart.",
          icon: "warning",
          showCancelButton: true,
          okButtonText: "Yes, clear it!",
          cancelButtonText: "Cancel",
          options: {
            // okButtonBackground: "#3085d6",
            cancelButtonBackground: "#d33",
          },
        };

        notiflix.Confirm.show(
          diagOptions.title,
          diagOptions.text,
          diagOptions.okButtonText,
          diagOptions.cancelButtonText,
          () => {
            cart = [];
            $(this).renderTable(cart);
            holdOrder = 0;
            notiflix.Report.success(
              "Cleared!",
              "All items have been removed.",
              "Ok",
            );
          },
          "",
          diagOptions.options,
        );
      }
    };

    $("#payButton").on("click", function () {
      if (cart.length != 0) {
        $("#paymentModel").modal("toggle");
      } else {
        notiflix.Report.warning("Oops!", "There is nothing to pay!", "Ok");
      }
    });

    $("#hold").on("click", function () {
      if (cart.length != 0) {
        $("#dueModal").modal("toggle");
      } else {
        notiflix.Report.warning("Oops!", "There is nothing to hold!", "Ok");
      }
    });

    function printJobComplete() {
      notiflix.Report.success("Done", "print job complete", "Ok");
    }

    $.fn.submitDueOrder = function (status) {
      let items = "";
      paymentType = $('.list-group-item.active').data('payment-type');
      const currencyLabel = (value) =>
        `${validator.unescape(settings.symbol)} ${moneyFormat(
          Math.abs(Number(value) || 0).toFixed(2),
        )}`;
      let rowIndex = 0;
      cart.forEach((item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const name = DOMPurify.sanitize(item.product_name || item.name || "Item");
        const discount1 = parseFloat(item.sale_discount) || 0;
        const discount2 = parseFloat(item.sale_discount2) || 0;
        const discount3 = 0;
        const basePrice = parseFloat(item.price) || 0;
        const netUnitPrice = basePrice * (1 - discount1 / 100) * (1 - discount2 / 100) * (1 - discount3 / 100);
        const chargedQty = quantity;
        const lineTotal = netUnitPrice * chargedQty;
        const unitPriceLabel = currencyLabel(netUnitPrice);
        const lineTotalLabel = currencyLabel(lineTotal);
        const disc2Label = discount3 ? `${discount2}% + ${discount3}%` : `${discount2}%`;
        items += `<tr>
          <td style="padding: 6px 4px; text-align:center;">${++rowIndex}</td>
          <td style="padding: 6px 4px;">${name}</td>
          <td style="padding: 6px 4px; text-align:center;">${quantity}</td>
          <td style="padding: 6px 4px; text-align:right;">${unitPriceLabel}</td>
          <td style="padding: 6px 4px; text-align:center;">${discount1}%</td>
          <td style="padding: 6px 4px; text-align:center;">${disc2Label}</td>
          <td style="padding: 6px 4px; text-align:right;">${lineTotalLabel}</td>
        </tr>`;
      });

      let currentTime = new Date(moment());
      let discount = $("#inputDiscount").val();
      let customer = JSON.parse($("#customer").val());
      let date = moment(currentTime).format("YYYY-MM-DD HH:mm:ss");
      let paymentAmount = $("#payment").val().replace(",", "");
      let changeAmount = $("#change").text().replace(",", "");
      let paid =
        $("#payment").val() == "" ? "" : parseFloat(paymentAmount).toFixed(2);
      let change =
        $("#change").text() == "" ? "" : parseFloat(changeAmount).toFixed(2);
      const paidValue = paid === "" ? 0 : parseFloat(paid);
      const changeValue = change === "" ? 0 : parseFloat(change);
      let refNumber = $("#refNumber").val();
      let orderNumber = holdOrder;
      let type = "";
      let tax_row = "";
      switch (paymentType) {
        case 1:
          type = "Cash";
          break;
        case 3:
          type = "Card";
          break;
      }

      const paymentDetails =
        paid !== ""
          ? `<div style="border-top:1px solid #ececec; padding-top:10px; font-size:13px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Paid</span>
                <span>${currencyLabel(paidValue)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Change</span>
                <span>${currencyLabel(changeValue)}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>Method</span>
                <span>${type || "N/A"}</span>
              </div>
            </div>`
          : "";

      const taxRow =
        settings.charge_tax && totalVat
          ? `<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>VAT(${validator.unescape(settings.percentage)}%)</span>
              <span>${currencyLabel(parseFloat(totalVat).toFixed(2))}</span>
            </div>`
          : "";

      if (!refNumber) {
        refNumber = orderNumber;
      }
      const displayRefNumber = _.escape(refNumber == "" ? orderNumber : refNumber);
      const showOrderLine = refNumber && refNumber != orderNumber;

      $(".loading").show();

      if (holdOrder != 0) {
        orderNumber = holdOrder;
        method = "PUT";
      } else {
        orderNumber = Math.floor(Date.now() / 1000);
        method = "POST";
      }

      logo = path.join(img_path, validator.unescape(settings.img));

      const receiptItems =
        items ||
        `<tr><td colspan="7" style="padding:12px 4px; text-align:center;">No items added</td></tr>`;
      const discountValue = parseFloat(discount) || 0;
      const discountLabel =
        discountValue > 0 ? currencyLabel(discountValue) : "-";
      receipt = `<div style="font-family:'Segoe UI', Arial, sans-serif; width:min(360px,100%); max-width:360px; padding:18px; background:#fff; border-radius:8px; box-shadow:0 2px 12px rgba(0,0,0,0.08); box-sizing:border-box;">
        <div style="text-align:center; border-bottom:1px solid #ececec; padding-bottom:12px;">
          ${
            checkFileExists(logo)
              ? `<img style='max-width: 60px; margin-bottom:8px;' src='${logo}' /><br>`
              : ``
          }
          <strong style="font-size: 20px;">${validator.unescape(settings.store)}</strong><br>
          <small style="color:#666;">
            ${validator.unescape(settings.address_one)}<br>
            ${validator.unescape(settings.contact) ? `Tel: ${validator.unescape(settings.contact)}` : ""}
          </small>
        </div>
        <div style="border-bottom:1px solid #ececec; padding:10px 0; font-size:12px; color:#444;">
          ${showOrderLine ? `<div>Order No : ${orderNumber}</div>` : ""}
          <div>Ref No : ${displayRefNumber}</div>
          <div>Customer : ${customer == 0 ? "Walk in customer" : _.escape(customer.name)}</div>
          <div>Cashier : ${user.fullname}</div>
          <div>Date : ${date}</div>
        </div>
        <div style="padding-top:10px;">
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse: collapse; font-size:11px; table-layout:fixed;">
            <thead>
              <tr style="border-bottom:1px solid #ececec; color:#555;">
                <th style="text-align:center; padding:6px 4px;">#</th>
                <th style="text-align:left; padding:6px 4px;">Item</th>
                <th style="text-align:center; padding:6px 4px;">Qty</th>
                <th style="text-align:right; padding:6px 4px;">Price</th>
                <th style="text-align:center; padding:6px 4px;">Disc 1</th>
                <th style="text-align:center; padding:6px 4px;">Disc 2</th>
                <th style="text-align:right; padding:6px 4px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${receiptItems}
            </tbody>
          </table>
          </div>
        </div>
        <div style="border-top:1px solid #ececec; padding-top:12px; font-size:13px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Items</span>
            <span>${cart.length}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Subtotal</span>
            <span>${currencyLabel(subTotal)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Discount</span>
            <span>${discountLabel}</span>
          </div>
          ${taxRow}
          <div style="display:flex; justify-content:space-between; margin-top:6px; font-weight:700;">
            <span>Total</span>
            <span>${currencyLabel(orderTotal)}</span>
          </div>
          ${paymentDetails}
        </div>
        <div style="border-top:1px solid #ececec; margin-top:12px; padding-top:8px; text-align:center; font-size:11px; color:#999;">
          ${validator.unescape(settings.footer)}
        </div>
        </div>`;

      if (status == 3) {
        if (cart.length > 0) {
          printJS({ printable: receipt, type: "raw-html" });

          $(".loading").hide();
          return;
        } else {
          $(".loading").hide();
          return;
        }
      }

      let data = {
        order: orderNumber,
        ref_number: refNumber,
        discount: discount,
        customer: customer,
        status: status,
        subtotal: parseFloat(subTotal).toFixed(2),
        tax: totalVat,
        order_type: 1,
        items: cart,
        date: currentTime,
        payment_type: type,
        payment_info: $("#paymentInfo").val(),
        total: orderTotal,
        paid: paid,
        change: change,
        _id: orderNumber,
        till: platform.till,
        mac: platform.mac,
        user: user.fullname,
        user_id: user._id,
      };

      $.ajax({
        url: api + "new",
        type: method,
        data: JSON.stringify(data),
        contentType: "application/json; charset=utf-8",
        cache: false,
        processData: false,
        success: function (data) {
          cart = [];
          receipt = DOMPurify.sanitize(receipt,{ ALLOW_UNKNOWN_PROTOCOLS: true });
          $("#viewTransaction").html("");
          $("#viewTransaction").html(receipt);
          $("#orderModal").modal("show");
          loadProducts();
          loadCustomers();
          $(".loading").hide();
          $("#dueModal").modal("hide");
          $("#paymentModel").modal("hide");
          $(this).getHoldOrders();
          $(this).getCustomerOrders();
          $(this).renderTable(cart);
          holdOrder = 0;
        },

        error: function (data) {
          $(".loading").hide();
          $("#dueModal").modal("toggle");
          notiflix.Report.failure(
            "Something went wrong!",
            "Please refresh this page and try again",
            "Ok",
          );
        },
      });

      $("#refNumber").val("");
      $("#change").text("");
      $("#payment,#paymentText").val("");
    };

    $.get(api + "on-hold", function (data) {
      holdOrderList = data;
      holdOrderlocation.empty();
      // clearInterval(dotInterval);
      $(this).renderHoldOrders(holdOrderList, holdOrderlocation, 1);
    });

    $.fn.getHoldOrders = function () {
      $.get(api + "on-hold", function (data) {
        holdOrderList = data;
        clearInterval(dotInterval);
        holdOrderlocation.empty();
        $(this).renderHoldOrders(holdOrderList, holdOrderlocation, 1);
      });
    };

    $.fn.renderHoldOrders = function (data, renderLocation, orderType) {
      $.each(data, function (index, order) {
        $(this).calculatePrice(order);
        renderLocation.append(
          $("<div>", {
            class:
              orderType == 1 ? "col-md-3 order" : "col-md-3 customer-order",
          }).append(
            $("<a>").append(
              $("<div>", { class: "card-box order-box" }).append(
                $("<p>").append(
                  $("<b>", { text: "Ref :" }),
                  $("<span>", { text: order.ref_number, class: "ref_number" }),
                  $("<br>"),
                  $("<b>", { text: "Price :" }),
                  $("<span>", {
                    text: order.total,
                    class: "label label-info",
                    style: "font-size:14px;",
                  }),
                  $("<br>"),
                  $("<b>", { text: "Items :" }),
                  $("<span>", { text: order.items.length }),
                  $("<br>"),
                  $("<b>", { text: "Customer :" }),
                  $("<span>", {
                    text:
                      order.customer != 0
                        ? order.customer.name
                        : "Walk in customer",
                    class: "customer_name",
                  }),
                ),
                $("<button>", {
                  class: "btn btn-danger del",
                  onclick:
                    "$(this).deleteOrder(" + index + "," + orderType + ")",
                }).append($("<i>", { class: "fa fa-trash" })),

                $("<button>", {
                  class: "btn btn-default",
                  onclick:
                    "$(this).orderDetails(" + index + "," + orderType + ")",
                }).append($("<span>", { class: "fa fa-shopping-basket" })),
              ),
            ),
          ),
        );
      });
    };

    $.fn.calculatePrice = function (data) {
      totalPrice = 0;
      $.each(data.products, function (index, product) {
        totalPrice += product.price * product.quantity;
      });

      let vat = (totalPrice * data.vat) / 100;
      totalPrice = (totalPrice + vat - data.discount).toFixed(0);

      return totalPrice;
    };

    $.fn.orderDetails = function (index, orderType) {
      $("#refNumber").val("");

      if (orderType == 1) {
        $("#refNumber").val(holdOrderList[index].ref_number);

        $("#customer option:selected").removeAttr("selected");
        setSelectedCustomer(null);

        holdOrder = holdOrderList[index]._id;
        cart = [];
        $.each(holdOrderList[index].items, function (index, product) {
          item = {
            id: product.id,
            product_name: product.product_name,
            sku: product.sku,
            price: product.price,
            quantity: product.quantity,
            sale_discount: product.sale_discount || 0,
            sale_discount2: product.sale_discount2 || 0,
            
          };
          cart.push(item);
        });
      } else if (orderType == 2) {
        $("#refNumber").val("");

        $("#customer option:selected").removeAttr("selected");
        const selectedCustomer =
          allCustomers.find(
            (cust) =>
              cust._id == customerOrderList[index].customer._id ||
              cust.name == customerOrderList[index].customer.name,
          ) || null;
        setSelectedCustomer(selectedCustomer);

        holdOrder = customerOrderList[index]._id;
        cart = [];
        $.each(customerOrderList[index].items, function (index, product) {
          item = {
            id: product.id,
            product_name: product.product_name,
            sku: product.sku,
            price: product.price,
            quantity: product.quantity,
            sale_discount: product.sale_discount || 0,
            sale_discount2: product.sale_discount2 || 0,
            
          };
          cart.push(item);
        });
      }
      $(this).renderTable(cart);
      $("#holdOrdersModal").modal("hide");
      $("#customerModal").modal("hide");
    };

    $.fn.deleteOrder = function (index, type) {
      switch (type) {
        case 1:
          deleteId = holdOrderList[index]._id;
          break;
        case 2:
          deleteId = customerOrderList[index]._id;
      }

      let data = {
        orderId: deleteId,
      };
      let diagOptions = {
        title: "Delete order?",
        text: "This will delete the order. Are you sure you want to delete!",
        icon: "warning",
        showCancelButton: true,
        okButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        okButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.ajax({
            url: api + "delete",
            type: "POST",
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            cache: false,
            success: function (data) {
              $(this).getHoldOrders();
              $(this).getCustomerOrders();

              notiflix.Report.success(
                "Deleted!",
                "You have deleted the order!",
                "Ok",
              );
            },
            error: function (data) {
              $(".loading").hide();
            },
          });
        },
      );
    };

    $.fn.getCustomerOrders = function () {
      $.get(api + "customer-orders", function (data) {
        //clearInterval(dotInterval);
        customerOrderList = data;
        customerOrderLocation.empty();
        $(this).renderHoldOrders(customerOrderList, customerOrderLocation, 2);
      });
    };

    $("#saveCustomer").on("submit", function (e) {
      e.preventDefault();

      let custData = {
        _id: Math.floor(Date.now() / 1000),
        name: $("#userName").val(),
        phone: $("#phoneNumber").val(),
        email: $("#emailAddress").val(),
        address: $("#userAddress").val(),
      };

      $.ajax({
        url: api + "customers/customer",
        type: "POST",
        data: JSON.stringify(custData),
        contentType: "application/json; charset=utf-8",
        cache: false,
        processData: false,
        success: function (data) {
          $("#newCustomer").modal("hide");
          notiflix.Report.success(
            "Customer added!",
            "Customer added successfully!",
            "Ok",
          );
          $("#customer option:selected").removeAttr("selected");
          $("#customer").append(
            $("<option>", {
              text: custData.name,
              value: getCustomerOptionValue(custData),
              selected: "selected",
            }),
          );

          allCustomers.push(custData);
          setSelectedCustomer(custData);
          $("#customer").trigger("chosen:updated");
        },
        error: function (data) {
          $("#newCustomer").modal("hide");
          notiflix.Report.failure(
            "Error",
            "Something went wrong please try again",
            "Ok",
          );
        },
      });
    });

    // Payment modal interactions
    $("#confirmPayment").hide();
    $("#cardInfo").hide();
    $(document).on('click', '#paymentMethods .list-group-item', function(e){
      e.preventDefault();
      $('#paymentMethods .list-group-item').removeClass('active');
      $(this).addClass('active');
      const type = $(this).data('payment-type');
      if (type === 3) {
        $("#cardInfo").show();
      } else {
        $("#cardInfo").hide();
      }
    });

    $("#payment").on("input", function () {
      const val = parseFloat($(this).val()) || 0;
      // compute change as paid - orderTotal
      const change = Math.max(0, val - (parseFloat(orderTotal) || 0));
      $("#change").text(change.toFixed(2));
      if (val >= (parseFloat(orderTotal) || 0)) {
        $("#confirmPayment").show();
      } else {
        $("#confirmPayment").hide();
      }
    });
    $("#confirmPayment").on("click", function () {
      if ($("#payment").val() == "") {
        notiflix.Report.warning(
          "Nope!",
          "Please enter the amount that was paid!",
          "Ok",
        );
      } else {
        $(this).submitDueOrder(1);
      }
    });

    $("#transactions").on("click", function () {
      loadTransactions();
      loadUserList();

      $("#pos_view").hide();
      $("#productsSection").hide();
      $("#reportsSection").hide();
      $("#companiesSection").hide();
      $("#reports").show();
      $("#pointofsale").show();
      $("#transactions_view").show();
      $(this).hide();
    });

    $("#pointofsale").on("click", function () {
      $("#pos_view").show();
      $("#transactions").show();
      $("#reports").show();
      $("#transactions_view").hide();
      $("#productsSection, #reportsSection, #companiesSection").hide();
      $(this).hide();
    });

    $("#reports").on("click", function () {
      setReportDefaultDates();
      $("#reportsSection").show();
      $("#productsSection, #transactions_view, #pos_view, #companiesSection").hide();
      $("#pointofsale, #transactions").show();
      $(this).hide();
      loadCategories();
      $(this).calculateProfitAnalytics();
    });

    $("#viewRefOrders").on("click", function () {
      setTimeout(function () {
        $("#holdOrderInput").focus();
      }, 500);
    });

    $("#viewCustomerOrders").on("click", function () {
      setTimeout(function () {
        $("#holdCustomerOrderInput").focus();
      }, 500);
    });

  // hide products section by default
  $("#productsSection").hide();
  $("#reportsSection").hide();
  $("#companiesSection").hide();
  setReportDefaultDates();

    $("#newProductModal").on("click", function () {
      $("#saveProduct").get(0).reset();
      $("#current_img").text("");
      $("#product_id").val("");
      $("#barcode").val("");
      $("#productsSection").show();
      $("#transactions_view, #pos_view, #reportsSection").hide();
      $("#reports").show();
      const target = document.getElementById("productsSection");
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
      $("#productName").focus();
    });

    $("#saveProduct").submit(function (e) {
      e.preventDefault();

      $(this).attr("action", api + "inventory/product");
      $(this).attr("method", "POST");

      $(this).ajaxSubmit({
        contentType: "application/json",
        success: function (response) {
          $("#saveProduct").get(0).reset();
          $("#product_id").val("");
          $("#barcode").val("");
          $("#current_img").text("");

          loadProducts();
          notiflix.Report.success(
            "Product Saved",
            "Product saved successfully.",
            "Close",
          );
        },
        //error for product
       error: function (jqXHR,textStatus, errorThrown) {
      console.error(jqXHR.responseJSON.message);
      notiflix.Report.failure(
        jqXHR.responseJSON.error,
        jqXHR.responseJSON.message,
        "Ok",
      );
      }

      });
    });

    $("#saveCategory").submit(function (e) {
      e.preventDefault();

      if ($("#category_id").val() == "") {
        method = "POST";
      } else {
        method = "PUT";
      }

      $.ajax({
        type: method,
        url: api + "categories/category",
        data: $(this).serialize(),
        success: function (data, textStatus, jqXHR) {
          $("#saveCategory").get(0).reset();
          loadCategories();
          loadProducts();
          diagOptions = {
            title: "Company Saved",
            text: "Select an option below to continue.",
            okButtonText: "Add another",
            cancelButtonText: "Close",
          };

         notiflix.Confirm.show(
           diagOptions.title,
           diagOptions.text,
           diagOptions.okButtonText,
           diagOptions.cancelButtonText,
           ()=>{},

           () => {
            },
          );
        },
      });
    });

    $.fn.editProduct = function (index) {
      $("#category option")
        .filter(function () {
          return $(this).val() == allProducts[index].category;
        })
        .prop("selected", true);
      $("#productsSection").show();
      $("#transactions_view, #pos_view").hide();

      $("#productName").val(allProducts[index].name);
      $("#product_price").val(allProducts[index].price);
      $("#purchase_discount").val(allProducts[index].purchase_discount || "");
      $("#sale_discount").val(allProducts[index].sale_discount || "");
      $("#quantity").val(allProducts[index].quantity);
      $("#expirationDate").val(allProducts[index].expirationDate);
      $("#minStock").val(allProducts[index].minStock || 1);
      $("#product_id").val(allProducts[index]._id);
      $("#img").val(allProducts[index].img);

      if (allProducts[index].img != "") {
        $("#imagename").hide();
        $("#current_img").html(
          `<img src="${img_path + allProducts[index].img}" alt="">`,
        );
        $("#rmv_img").show();
      }

      if (allProducts[index].stock == 0) {
        $("#stock").prop("checked", true);
      }

      const target = document.getElementById("productsSection");
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
      $("#productName").focus();
    };

    $("#userModal").on("hide.bs.modal", function () {
      $(".perms").hide();
    });

    $.fn.editUser = function (index) {
      user_index = index;

      $("#Users").modal("hide");

      $(".perms").show();

      $("#user_id").val(allUsers[index]._id);
      $("#fullname").val(allUsers[index].fullname);
      $("#username").val(validator.unescape(allUsers[index].username));
      $("#password").attr("placeholder", "New Password");
    

      for (perm of permissions) {
        var el = "#" + perm;
        if (allUsers[index][perm] == 1) {
          $(el).prop("checked", true);
        } else {
          $(el).prop("checked", false);
        }
      }

      $("#userModal").modal("show");
    };

    $.fn.editCategory = function (index) {
      $("#categoryName").val(allCategories[index].name);
      $("#category_id").val(allCategories[index]._id);
      $("#companiesSection").show();
      $("#productsSection, #transactions_view, #pos_view, #reportsSection").hide();
    };

    $.fn.deleteProduct = function (id) {
      diagOptions = {
        title: "Are you sure?",
        text: "You are about to delete this product.",
        okButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.ajax({
            url: api + "inventory/product/" + id,
            type: "DELETE",
            success: function (result) {
              loadProducts();
              notiflix.Report.success("Done!", "Product deleted", "Ok");
            },
          });
        },
      );
    };

    $.fn.calculateProfitAnalytics = function () {
      const startMoment = moment($("#profitStartDate").val(), "DD/MM/YYYY", true);
      const endMoment = moment($("#profitEndDate").val(), "DD/MM/YYYY", true);

      if (!startMoment.isValid() || !endMoment.isValid()) {
        notiflix.Notify.warning("Please enter valid dates");
        return;
      }

      const startDate = startMoment.format("YYYY-MM-DD");
      const endDate = endMoment.format("YYYY-MM-DD");
      const selectedCompany = $("#profitCompanyFilter").val();
      const selectedCompanyName = $("#profitCompanyFilter option:selected").text();

      const queryParams = new URLSearchParams({
        startDate,
        endDate,
      });
      if (selectedCompany) {
        queryParams.append("categoryId", selectedCompany);
      }

      $.ajax({
        url: api + "transactions/profit/calculate?" + queryParams.toString(),
        type: "GET",
        success: function (data) {
          const symbol = validator.unescape(settings.symbol);
          const transactions = Array.isArray(data.transactions) ? data.transactions : [];

          let filteredTransactions = transactions.map((trans) => ({
            ...trans,
            companyLabel: trans.companyName || trans.categoryName || trans.company || "Unknown",
          }));

          if (selectedCompany) {
            filteredTransactions = filteredTransactions.filter((trans) => {
              const companyId = trans.categoryId || trans.companyId || trans.category || trans.company;
              const companyName = (trans.companyLabel || "").toLowerCase();
              return companyId === selectedCompany || companyName === selectedCompanyName.toLowerCase();
            });
          }

          const totals = filteredTransactions.reduce(
            (acc, trans) => {
              acc.sale += parseFloat(trans.saleAmount || 0);
              acc.profit += parseFloat(trans.profit || 0);
              return acc;
            },
            { sale: 0, profit: 0 },
          );

          const totalPurchaseAmount = parseFloat(data.totalPurchaseAmount || 0);
          const totalSaleAmount =
            filteredTransactions.length > 0 || selectedCompany ? totals.sale : parseFloat(data.totalSaleAmount || 0);
          const totalProfitAmount =
            filteredTransactions.length > 0 || selectedCompany ? totals.profit : parseFloat(data.totalProfit || 0);
          const totalProfitMargin = totalSaleAmount > 0 ? ((totalProfitAmount / totalSaleAmount) * 100).toFixed(2) : 0;

          $("#totalPurchaseAmount").text(symbol + moneyFormat(totalPurchaseAmount.toFixed(2)));
          $("#totalSaleAmount").text(symbol + moneyFormat(totalSaleAmount.toFixed(2)));
          $("#totalProfit").text(symbol + moneyFormat(totalProfitAmount.toFixed(2)));
          $("#profitMargin").text(totalProfitMargin + "%");

          const companyTotals = {};
          filteredTransactions.forEach((trans) => {
            const companyKey = trans.companyLabel || "Unknown";
            if (!companyTotals[companyKey]) {
              companyTotals[companyKey] = { sale: 0, profit: 0 };
            }
            companyTotals[companyKey].sale += parseFloat(trans.saleAmount || 0);
            companyTotals[companyKey].profit += parseFloat(trans.profit || 0);
          });

          const inventoryBreakdown = data.inventoryBreakdown || [];
          const inventoryTotals = {};
          inventoryBreakdown.forEach((entry) => {
            inventoryTotals[entry.company] = parseFloat(entry.purchaseAmount) || 0;
          });

          const companyList = new Set([
            ...Object.keys(companyTotals),
            ...Object.keys(inventoryTotals),
          ]);

          let companyRows = "";
          if (companyList.size === 0) {
            companyRows = `<tr><td colspan="4" class="text-center">No company data for the selected filters</td></tr>`;
          } else {
            companyList.forEach((name) => {
              const purchaseValue = inventoryTotals[name] || 0;
              const saleValue = companyTotals[name]?.sale || 0;
              const profitValue = companyTotals[name]?.profit || 0;
              companyRows += `<tr><td>${name}</td><td>${symbol + moneyFormat(purchaseValue.toFixed(2))}</td><td>${
                symbol + moneyFormat(saleValue.toFixed(2))
              }</td><td>${symbol + moneyFormat(profitValue.toFixed(2))}</td></tr>`;
            });
          }
          $("#profitCompanyTable tbody").html(companyRows);

          let tableHtml =
            '<table class="table table-striped" style="margin-top: 0;"><thead><tr><th>Date</th><th>Company</th><th>Purchase</th><th>Sale</th><th>Profit</th><th>Margin</th></tr></thead><tbody>';
          if (filteredTransactions.length > 0) {
            filteredTransactions.forEach(function (trans) {
              const purchaseAmount = parseFloat(trans.purchaseAmount || 0);
              const saleAmount = parseFloat(trans.saleAmount || 0);
              const profitAmount = parseFloat(trans.profit || 0);
              const margin = trans.profitMargin || (saleAmount > 0 ? ((profitAmount / saleAmount) * 100).toFixed(2) : 0);
              const dateCell = trans.date ? trans.date.substring(0, 10) : "-";
              tableHtml +=
                "<tr><td>" +
                dateCell +
                "</td><td>" +
                (trans.companyLabel || "-") +
                "</td><td>" +
                symbol +
                moneyFormat(purchaseAmount.toFixed(2)) +
                "</td><td>" +
                symbol +
                moneyFormat(saleAmount.toFixed(2)) +
                "</td><td>" +
                symbol +
                moneyFormat(profitAmount.toFixed(2)) +
                "</td><td>" +
                margin +
                "%</td></tr>";
            });
          } else {
            tableHtml += '<tr><td colspan="6" class="text-center">No transactions found for this range</td></tr>';
          }
          tableHtml += "</tbody></table>";
          $("#profitTransactionsList").html(tableHtml);

          notiflix.Notify.success("Profit calculated successfully");
        },
        error: function () {
          notiflix.Notify.warning("Error calculating profit");
        },
      });
    };

    $.fn.deleteUser = function (id) {
      diagOptions = {
        title: "Are you sure?",
        text: "You are about to delete this user.",
        cancelButtonColor: "#d33",
        okButtonText: "Yes, delete!",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.ajax({
            url: api + "users/user/" + id,
            type: "DELETE",
            success: function (result) {
              loadUserList();
              notiflix.Report.success("Done!", "User deleted", "Ok");
            },
          });
        },
      );
    };

    $.fn.deleteCategory = function (id) {
      diagOptions = {
        title: "Are you sure?",
        text: "You are about to delete this company.",
        okButtonText: "Yes, delete it!",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.ajax({
            url: api + "categories/category/" + id,
            type: "DELETE",
            success: function (result) {
              loadCategories();
              notiflix.Report.success("Done!", "Company deleted", "Ok");
            },
          });
        },
      );
    };

    $("#productModal").on("click", function () {
      loadProductList();
      $("#productsSection").show();
      $("#transactions_view, #pos_view, #reportsSection").hide();
      $("#pointofsale, #transactions, #reports").show();
    });

    $("#usersModal").on("click", function () {
      loadUserList();
    });

    $("#categoryModal").on("click", function () {
      loadCategoryList();
      $("#companiesSection").show();
      $("#productsSection, #transactions_view, #pos_view, #reportsSection").hide();
      $("#pointofsale, #transactions, #reports").show();
    });

    $(".btn-add-company").on("click", function () {
      // navigate to Companies page and reset the form
      $("#companiesSection").show();
      $("#productsSection, #transactions_view, #pos_view, #reportsSection").hide();
      $("#pointofsale, #transactions, #reports").show();
      if ($("#saveCategory").length) {
        $("#saveCategory").get(0).reset();
      }
      $("#category_id").val("");
      loadCategoryList();
      $("#categoryName").focus();
    });

    function loadUserList() {
      let counter = 0;
      let user_list = "";
      $("#user_list").empty();
      $("#userList").DataTable().destroy();

      $.get(api + "users/all", function (users) {
        allUsers = [...users];

        users.forEach((user, index) => {
          state = [];
          let class_name = "";

          if (user.status != "") {
            state = user.status.split("_");
            login_status = state[0];
            login_time = state[1];

            switch (login) {
              case "Logged In":
                class_name = "btn-default";

                break;
              case "Logged Out":
                class_name = "btn-light";
                break;
            }
          }

          counter++;
          user_list += `<tr>
            <td>${user.fullname}</td>
            <td>${user.username}</td>
            <td class="${class_name}">${
              state.length > 0 ? login_status : ""
            } <br><small> ${state.length > 0 ? login_time : ""}</small></td>
            <td>${
              user._id == 1
                ? '<span class="btn-group"><button class="btn btn-dark"><i class="fa fa-edit"></i></button><button class="btn btn-dark"><i class="fa fa-trash"></i></button></span>'
                : '<span class="btn-group"><button onClick="$(this).editUser(' +
                  index +
                  ')" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteUser(' +
                  user._id +
                  ')" class="btn btn-danger"><i class="fa fa-trash"></i></button></span>'
            }</td></tr>`;

          if (counter == users.length) {
            $("#user_list").html(user_list);

            $("#userList").DataTable({
              order: [[1, "desc"]],
              autoWidth: false,
              info: true,
              JQueryUI: true,
              ordering: true,
              paging: false,
            });
          }
        });
      });
    }

    function loadProductList() {
      let products = [...allProducts];
      let product_list = "";
      $("#product_list").empty();
      $("#productList").DataTable().destroy();

      products.forEach((product, index) => {

        let category = allCategories.filter(function (category) {
          return category._id == product.category;
        });

        product.stockAlert = "";
        const todayDate = moment();
        const expiryDate = moment(product.expirationDate, DATE_FORMAT);

        //show stock status indicator
        const stockStatus = getStockStatus(product.quantity,product.minStock);
          if(stockStatus<=0)
          {
          if (stockStatus === 0) {
            product.stockStatus = "No Stock";
            icon = "fa fa-exclamation-triangle";
          }
          if (stockStatus === -1) {
            product.stockStatus = "Low Stock";
            icon = "fa fa-caret-down";
          }

          product.stockAlert = `<p class="text-danger"><small><i class="${icon}"></i> ${product.stockStatus}</small></p>`;
        }
        //calculate days to expiry
        product.expiryAlert = "";
        if (!isExpired(expiryDate)) {
          const diffDays = daysToExpire(expiryDate);

          if (diffDays > 0 && diffDays <= 30) {
            var days_noun = diffDays > 1 ? "days" : "day";
            icon = "fa fa-clock-o";
            product.expiryStatus = `${diffDays} ${days_noun} left`;
            product.expiryAlert = `<p class="text-danger"><small><i class="${icon}"></i> ${product.expiryStatus}</small></p>`;
          }
        } else {
          icon = "fa fa-exclamation-triangle";
          product.expiryStatus = "Expired";
          product.expiryAlert = `<p class="text-danger"><small><i class="${icon}"></i> ${product.expiryStatus}</small></p>`;
        }

        if(product.img==="")
        {
          product_img=default_item_img;
        }
        else
        {
          product_img = img_path + product.img;
          product_img = checkFileExists(product_img)
          ? product_img
          : default_item_img;
        }
        
        //render product list
        product_list +=
          `<tr>
            <td><img style="max-height: 50px; max-width: 50px; border: 1px solid #ddd;" src="${product_img}" id="product_img"></td>
            <td>${product.name}
            ${product.expiryAlert}</td>
            <td>${validator.unescape(settings.symbol)}${product.price}</td>
            <td>${product.stock == 1 ? product.quantity : "N/A"}
            ${product.stockAlert}
            </td>
            <td>${product.expirationDate}</td>
            <td>${category.length > 0 ? category[0].name : ""}</td>
            <td class="nobr text-center">
              <div class="btn-group btn-group-sm product-actions" role="group" aria-label="Actions">
                <button onClick="$(this).editProduct(${index})" class="btn btn-warning btn-sm" title="Edit">
                  <i class="fa fa-edit"></i>
                </button>
                <button onClick="$(this).deleteProduct(${product._id})" class="btn btn-danger btn-sm" title="Delete">
                  <i class="fa fa-trash"></i>
                </button>
              </div>
            </td></tr>`;

      });

      $("#product_list").html(product_list);

      $("#productList").DataTable({
        order: [[1, "desc"]],
        autoWidth: false,
        info: true,
        JQueryUI: true,
        ordering: true,
        paging: false,
        dom: "Bfrtip",
        buttons: [
          {
            extend: "pdfHtml5",
            className: "btn btn-light", // Custom class name
            text: " Download PDF", // Custom text
            filename: "product_list.pdf", // Default filename
          },
        ],
      });
    }

    function loadCategoryList() {
      let category_list = "";
      let counter = 0;
      $("#category_list").empty();
      $("#categoryList").DataTable().destroy();

      allCategories.forEach((category, index) => {
        counter++;

        category_list += `<tr>
     
            <td>${category.name}</td>
            <td><span class="btn-group action-btn-group"><button onClick="$(this).editCategory(${index})" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteCategory(${category._id})" class="btn btn-danger"><i class="fa fa-trash"></i></button></span></td></tr>`;
      });

      if (counter == allCategories.length) {
        $("#category_list").html(category_list);
        $("#categoryList").DataTable({
          autoWidth: false,
          info: true,
          JQueryUI: true,
          ordering: true,
          paging: false,
        });
      }
    }


    $("#log-out").on("click", function () {
      const diagOptions = {
        title: "Are you sure?",
        text: "You are about to log out.",
        cancelButtonColor: "#3085d6",
        okButtonText: "Logout",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          $.get(api + "users/logout/" + user._id, function (data) {
            storage.delete("auth");
            storage.delete("user");
            ipcRenderer.send("app-reload", "");
          });
        },
      );
    });

    $("#settings_form").on("submit", function (e) {
      e.preventDefault();
      let formData = $(this).serializeObject();
      let mac_address;

      api = "http://" + host + ":" + port + "/api/";

      macaddress.one(function (err, mac) {
        mac_address = mac;
      });
      const appChoice = $("#app").find("option:selected").text();
    
      formData["app"] = appChoice;
      formData["mac"] = mac_address;
      formData["till"] = 1;

      // Update application field in settings form
      let $appField = $("#settings_form input[name='app']");
      let $hiddenAppField = $('<input>', {
        type: 'hidden',
        name: 'app',
        value: formData.app
    });
        $appField.length 
            ? $appField.val(formData.app) 
            : $("#settings_form").append(`<input type="hidden" name="app" value="${$hiddenAppField}" />`);


      if (formData.percentage != "" && typeof formData.percentage === 'number') {
        notiflix.Report.warning(
          "Oops!",
          "Please make sure the tax value is a number",
          "Ok",
        );
      } else {
        storage.set("settings", formData);

        $(this).attr("action", api + "settings/post");
        $(this).attr("method", "POST");

        $(this).ajaxSubmit({
          contentType: "application/json",
          success: function () {
            ipcRenderer.send("app-reload", "");
          },
          error: function (jqXHR) {
            console.error(jqXHR.responseJSON.message);
            notiflix.Report.failure(
              jqXHR.responseJSON.error,
              jqXHR.responseJSON.message,
              "Ok",
            );
      }
    });
    }
  });

    $("#net_settings_form").on("submit", function (e) {
      e.preventDefault();
      let formData = $(this).serializeObject();

      if (formData.till == 0 || formData.till == 1) {
        notiflix.Report.warning(
          "Oops!",
          "Please enter a number greater than 1.",
          "Ok",
        );
      } else {
        if (isNumeric(formData.till)) {
          formData["app"] = $("#app").find("option:selected").text();
          storage.set("settings", formData);
          ipcRenderer.send("app-reload", "");
        } else {
          notiflix.Report.warning(
            "Oops!",
            "Till number must be a number!",
            "Ok",
          );
        }
      }
    });

    $("#saveUser").on("submit", function (e) {
      e.preventDefault();
      let formData = $(this).serializeObject();

      if (formData.password != formData.pass) {
        notiflix.Report.warning("Oops!", "Passwords do not match!", "Ok");
      }

      if (
        bcrypt.compare(formData.password, user.password) ||
        bcrypt.compare(formData.password, allUsers[user_index].password)
      ) {
        $.ajax({
          url: api + "users/post",
          type: "POST",
          data: JSON.stringify(formData),
          contentType: "application/json; charset=utf-8",
          cache: false,
          processData: false,
          success: function (data) {
            if (ownUserEdit) {
              ipcRenderer.send("app-reload", "");
            } else {
              $("#userModal").modal("hide");

              loadUserList();

              $("#Users").modal("show");
              notiflix.Report.success("Great!", "User details saved!", "Ok");
            }
          },
          error: function (jqXHR,textStatus, errorThrown) {
            notiflix.Report.failure(
              jqXHR.responseJSON.error,
              jqXHR.responseJSON.message,
              "Ok",
            );
          },
        });
      }
    });

    $("#app").on("change", function () {
      if (
        $(this).find("option:selected").text() ==
        "Network Point of Sale Terminal"
      ) {
        $("#net_settings_form").show(500);
        $("#settings_form").hide(500);
        macaddress.one(function (err, mac) {
          $("#mac").val(mac);
        });
      } else {
        $("#net_settings_form").hide(500);
        $("#settings_form").show(500);
      }
    });

    $("#cashier").on("click", function () {
      ownUserEdit = true;

      $("#userModal").modal("show");

      $("#user_id").val(user._id);
      $("#fullname").val(user.fullname);
      $("#username").val(user.username);
      $("#password").attr("placeholder", "New Password");

      for (perm of permissions) {
        var el = "#" + perm;
        if (allUsers[index][perm] == 1) {
          $(el).prop("checked", true);
        } else {
          $(el).prop("checked", false);
        }
      }
    });

    $("#add-user").on("click", function () {
      if (platform.app != "Network Point of Sale Terminal") {
        $(".perms").show();
      }

      $("#saveUser").get(0).reset();
      $("#userModal").modal("show");
    });

    $("#settings").on("click", function () {
      if (platform.app == "Network Point of Sale Terminal") {
        $("#net_settings_form").show(500);
        $("#settings_form").hide(500);

        $("#ip").val(platform.ip);
        $("#till").val(platform.till);

        macaddress.one(function (err, mac) {
          $("#mac").val(mac);
        });

        $("#app option")
          .filter(function () {
            return $(this).text() == platform.app;
          })
          .prop("selected", true);
      } else {
        $("#net_settings_form").hide(500);
        $("#settings_form").show(500);

        $("#settings_id").val("1");
        $("#store").val(validator.unescape(settings.store));
        $("#address_one").val(validator.unescape(settings.address_one));
        $("#address_two").val(validator.unescape(settings.address_two));
        $("#contact").val(validator.unescape(settings.contact));
        $("#tax").val(validator.unescape(settings.tax));
        $("#symbol").val(validator.unescape(settings.symbol));
        $("#percentage").val(validator.unescape(settings.percentage));
        $("#footer").val(validator.unescape(settings.footer));
        $("#logo_img").val(validator.unescape(settings.img));
        if (settings.charge_tax) {
          $("#charge_tax").prop("checked", true);
        }
        if (validator.unescape(settings.img) != "") {
          $("#logoname").hide();
          $("#current_logo").html(
            `<img src="${img_path + validator.unescape(settings.img)}" alt="">`,
          );
          $("#rmv_logo").show();
        }

        $("#app option")
          .filter(function () {
            return $(this).text() == validator.unescape(settings.app);
          })
          .prop("selected", true);
      }
    });
 });

  $("#rmv_logo").on("click", function () {
    $("#remove_logo").val("1");
    // $("#logo_img").val('');
    $("#current_logo").hide(500);
    $(this).hide(500);
    $("#logoname").show(500);
  });

  $("#rmv_img").on("click", function () {
    $("#remove_img").val("1");
    // $("#img").val('');
    $("#current_img").hide(500);
    $(this).hide(500);
    $("#imagename").show(500);
  });
}

$.fn.print = function () {
  printJS({ printable: receipt, type: "raw-html" });
};

function loadTransactions() {
  let tills = [];
  let users = [];
  let sales = 0;
  let transact = 0;
  let unique = 0;

  sold_items = [];
  sold = [];

  let counter = 0;
  let transaction_list = "";
  let query = `by-date?start=${start_date}&end=${end_date}&user=${by_user}&status=${by_status}&till=${by_till}`;

  $.get(api + query, function (transactions) {
    if (transactions.length > 0) {
      $("#transaction_list").empty();
      $("#transactionList").DataTable().destroy();

      allTransactions = [...transactions];

      transactions.forEach((trans, index) => {
        sales += parseFloat(trans.total);
        transact++;

        trans.items.forEach((item) => {
          sold_items.push(item);
        });

        if (!tills.includes(trans.till)) {
          tills.push(trans.till);
        }

        if (!users.includes(trans.user_id)) {
          users.push(trans.user_id);
        }

        counter++;
        const viewButton =
          trans.paid == ""
            ? '<button class="btn btn-dark" title="Cannot view unpaid sale"><i class="fa fa-search-plus"></i></button>'
            : `<button onClick="$(this).viewTransaction(${index})" class="btn btn-info" title="View sale"><i class="fa fa-search-plus"></i></button>`;
        transaction_list += `<tr>
                                <td>${trans.order}</td>
                                <td class="nobr">${moment(trans.date).format(
                                  "DD-MMM-YYYY HH:mm:ss",
                                )}</td>
                                <td>${validator.unescape(settings.symbol)}${moneyFormat(trans.total)}</td>
                                <td>${
                                  trans.paid == ""
                                    ? ""
                                    : validator.unescape(settings.symbol) + moneyFormat(trans.paid)
                                }</td>
                                <td>${
                                  trans.change
                                    ? validator.unescape(settings.symbol) +
                                      moneyFormat(
                                        Math.abs(trans.change).toFixed(2),
                                      )
                                    : ""
                                }</td>
                                <td>${
                                  trans.paid == ""
                                    ? ""
                                    : trans.payment_type
                                }</td>
                                <td>${trans.till}</td>
                                <td>${trans.user}</td>
                                <td class="text-center">
                                  <div class="btn-group btn-group-sm" role="group" aria-label="Actions">
                                    ${viewButton}
                                    <button onClick="$(this).editTransaction(${index})" class="btn btn-warning" title="Load sale for editing"><i class="fa fa-edit"></i></button>
                                    <button onClick="$(this).deleteTransaction(${index})" class="btn btn-danger" title="Delete sale"><i class="fa fa-trash"></i></button>
                                  </div>
                                </td>
                              </tr>`;

        if (counter == transactions.length) {
          $("#total_sales #counter").text(
            validator.unescape(settings.symbol) + moneyFormat(parseFloat(sales).toFixed(2)),
          );
          $("#total_transactions #counter").text(transact);

          const result = {};

          for (const { product_name, price, quantity, id } of sold_items) {
            if (!result[product_name]) result[product_name] = [];
            result[product_name].push({ id, price, quantity });
          }

          for (item in result) {
            let price = 0;
            let quantity = 0;
            let id = 0;

            result[item].forEach((i) => {
              id = i.id;
              price = i.price;
              quantity = quantity + parseInt(i.quantity);
            });

            sold.push({
              id: id,
              product: item,
              qty: quantity,
              price: price,
            });
          }

          loadSoldProducts();

          if (by_user == 0 && by_till == 0) {
            userFilter(users);
            tillFilter(tills);
          }

          $("#transaction_list").html(transaction_list);
          $("#transactionList").DataTable({
            order: [[1, "desc"]],
            autoWidth: false,
            info: true,
            JQueryUI: true,
            ordering: true,
            paging: true,
            dom: "Bfrtip",
            buttons: ["csv", "excel", "pdf"],
          });
        }
      });
    } else {
      notiflix.Report.warning(
        "No data!",
        "No transactions available within the selected criteria",
        "Ok",
      );
    }
  });
}

function sortDesc(a, b) {
  if (a.qty > b.qty) {
    return -1;
  }
  if (a.qty < b.qty) {
    return 1;
  }
  return 0;
}

function loadSoldProducts() {
  sold.sort(sortDesc);

  let counter = 0;
  let sold_list = "";
  let items = 0;
  let products = 0;
  $("#product_sales").empty();

    sold.forEach((item, index) => {
      items = items + parseInt(item.qty);
      products++;

      let product = allProducts.filter(function (selected) {
        return selected._id == item.id;
      });
      const productRecord = product.length > 0 ? product[0] : null;
      const stockDisplay =
        productRecord && productRecord.stock == 1
          ? productRecord.quantity || "0"
          : "N/A";

      counter++;

      sold_list += `<tr>
            <td>${item.product}</td>
            <td>${item.qty}</td>
            <td>${stockDisplay}</td>
            <td>${
              validator.unescape(settings.symbol) +
              moneyFormat((item.qty * parseFloat(item.price)).toFixed(2))
            }</td>
            </tr>`;

    if (counter == sold.length) {
      $("#total_items #counter").text(items);
      $("#total_products #counter").text(products);
      $("#product_sales").html(sold_list);
    }
  });
}

function userFilter(users) {
  $("#users").empty();
  $("#users").append(`<option value="0">All</option>`);

  users.forEach((user) => {
    let u = allUsers.filter(function (usr) {
      return usr._id == user;
    });

    $("#users").append(`<option value="${user}">${u[0].fullname}</option>`);
  });
}

function tillFilter(tills) {
  $("#tills").empty();
  $("#tills").append(`<option value="0">All</option>`);
  tills.forEach((till) => {
    $("#tills").append(`<option value="${till}">${till}</option>`);
  });
}

$.fn.viewTransaction = function (index) {
  transaction_index = index;

  let discount = allTransactions[index].discount;
  let customer =
    allTransactions[index].customer == 0
      ? "Walk in Customer"
      : allTransactions[index].customer.username;
  let refNumber =
    allTransactions[index].ref_number != ""
      ? allTransactions[index].ref_number
      : allTransactions[index].order;
  let orderNumber = allTransactions[index].order;
  let paymentMethod = "";
  let tax_row = "";
  let items = "";
  let products = allTransactions[index].items;

  products.forEach((item) => {
    items += `<tr><td>${item.product_name}</td><td>${
      item.quantity
    } </td><td class="text-right"> ${validator.unescape(settings.symbol)} ${moneyFormat(
      Math.abs(item.price).toFixed(2),
    )} </td></tr>`;
  });

  paymentMethod = allTransactions[index].payment_type;
 

  if (allTransactions[index].paid != "") {
    payment = `<tr>
                    <td>Paid</td>
                    <td>:</td>
                    <td class="text-right">${validator.unescape(settings.symbol)} ${moneyFormat(
                      Math.abs(allTransactions[index].paid).toFixed(2),
                    )}</td>
                </tr>
                <tr>
                    <td>Change</td>
                    <td>:</td>
                    <td class="text-right">${validator.unescape(settings.symbol)} ${moneyFormat(
                      Math.abs(allTransactions[index].change).toFixed(2),
                    )}</td>
                </tr>
                <tr>
                    <td>Method</td>
                    <td>:</td>
                    <td class="text-right">${paymentMethod}</td>
                </tr>`;
  }

  if (settings.charge_tax) {
    tax_row = `<tr>
                <td>Vat(${validator.unescape(settings.percentage)})% </td>
                <td>:</td>
                <td class="text-right">${validator.unescape(settings.symbol)}${parseFloat(
                  allTransactions[index].tax,
                ).toFixed(2)}</td>
            </tr>`;
  }

    logo = path.join(img_path, validator.unescape(settings.img));
      
      receipt = `<div style="font-size: 10px">                            
        <p style="text-align: center;">
        ${
          checkFileExists(logo)
            ? `<img style='max-width: 50px' src='${logo}' /><br>`
            : ``
        }
            <span style="font-size: 22px;">${validator.unescape(settings.store)}</span> <br>
            ${validator.unescape(settings.address_one)} <br>
            ${validator.unescape(settings.address_two)} <br>
            ${
              validator.unescape(settings.contact) != "" ? "Tel: " + validator.unescape(settings.contact) + "<br>" : ""
            } 
            ${validator.unescape(settings.tax) != "" ? "Vat No: " + validator.unescape(settings.tax) + "<br>" : ""} 
    </p>
    <hr>
    <left>
        <p>
        Invoice : ${orderNumber} <br>
        Ref No : ${refNumber} <br>
        Customer : ${
          allTransactions[index].customer == 0
            ? "Walk in Customer"
            : allTransactions[index].customer.name
        } <br>
        Cashier : ${allTransactions[index].user} <br>
        Date : ${moment(allTransactions[index].date).format(
          "DD MMM YYYY HH:mm:ss",
        )}<br>
        </p>

    </left>
    <hr>
    <table width="90%">
        <thead>
        <tr>
            <th>Item</th>
            <th>Qty</th>
            <th class="text-right">Price</th>
        </tr>
        </thead>
        <tbody>
        ${items}                
        <tr><td colspan="3"><hr></td></tr>
        <tr>                        
            <td><b>Subtotal</b></td>
            <td>:</td>
            <td class="text-right"><b>${validator.unescape(settings.symbol)}${moneyFormat(
              allTransactions[index].subtotal,
            )}</b></td>
        </tr>
        <tr>
            <td>Discount</td>
            <td>:</td>
            <td class="text-right">${
              discount > 0
                ? validator.unescape(settings.symbol) +
                  moneyFormat(
                    parseFloat(allTransactions[index].discount).toFixed(2),
                  )
                : ""
            }</td>
        </tr>
        
        ${tax_row}
    
        <tr>
            <td><h5>Total</h5></td>
            <td><h5>:</h5></td>
            <td class="text-right">
                <h5>${validator.unescape(settings.symbol)}${moneyFormat(
                  allTransactions[index].total,
                )}</h5>
            </td>
        </tr>
        ${payment == 0 ? "" : payment}
        </tbody>
        </table>
        <br>
        <hr>
        <br>
        <p style="text-align: center;">
         ${validator.unescape(settings.footer)}
         </p>
        </div>`;

        //prevent DOM XSS; allow windows paths in img src
        receipt = DOMPurify.sanitize(receipt,{ ALLOW_UNKNOWN_PROTOCOLS: true });

  $("#viewTransaction").html("");
  $("#viewTransaction").html(receipt);

  $("#orderModal").modal("show");
};

    $.fn.editTransaction = function (index) {
      const transaction = allTransactions[index];
      if (!transaction) {
        return;
      }

      cart = [];
      (transaction.items || []).forEach((item) => {
        cart.push({
          ...item,
        });
      });

      holdOrder = transaction._id || transaction.order || 0;
      $("#refNumber").val(transaction.ref_number || "");
      $("#inputDiscount").val(transaction.discount || 0);
      if (transaction.customer && transaction.customer != 0) {
        setSelectedCustomer(transaction.customer);
      } else {
        setSelectedCustomer(null);
      }
      $("#payment").val("");
      $("#change").text("");
      $("#transactions_view, #productsSection, #reportsSection").hide();
      $("#pos_view").show();
      $("#pointofsale").hide();
      $("#transactions").show();
      $("#reports").show();
      $(this).renderTable(cart);
      $("#productSearch").focus();
    };

    $.fn.deleteTransaction = function (index) {
      const transaction = allTransactions[index];
      if (!transaction) {
        return;
      }

      const diagOptions = {
        title: "Delete transaction?",
        text: "Are you sure you want to delete this sale? This cannot be undone.",
        icon: "warning",
        okButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
      };

      notiflix.Confirm.show(
        diagOptions.title,
        diagOptions.text,
        diagOptions.okButtonText,
        diagOptions.cancelButtonText,
        () => {
          const data = {
            orderId: transaction._id || transaction.order,
          };
          $.ajax({
            url: api + "delete",
            type: "POST",
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            cache: false,
            success: function () {
              loadTransactions();
              notiflix.Report.success("Deleted", "Sale removed successfully.", "Ok");
            },
            error: function () {
              notiflix.Report.failure("Error", "Unable to delete the sale.", "Ok");
            },
          });
        },
      );
    };

$("#status").on("change", function () {
  by_status = $(this).find("option:selected").val();
  loadTransactions();
});

$("#tills").on("change", function () {
  by_till = $(this).find("option:selected").val();
  loadTransactions();
});

$("#users").on("change", function () {
  by_user = $(this).find("option:selected").val();
  loadTransactions();
});

$("#reportrange").on("apply.daterangepicker", function (ev, picker) {
  start = picker.startDate.format("DD MMM YYYY hh:mm A");
  end = picker.endDate.format("DD MMM YYYY hh:mm A");

  start_date = picker.startDate.toDate().toJSON();
  end_date = picker.endDate.toDate().toJSON();

  loadTransactions();
});

function authenticate() {
  $(".loading").hide();
  $("body").attr("class", "login-page");
  $("#login").show();
}

$("body").on("submit", "#account", function (e) {
  e.preventDefault();
  let formData = $(this).serializeObject();

  if (formData.username == "" || formData.password == "") {
    notiflix.Report.warning("Incomplete form!", auth_empty, "Ok");
  } else {
    $.ajax({
      url: api + "users/login",
      type: "POST",
      data: JSON.stringify(formData),
      contentType: "application/json; charset=utf-8",
      cache: false,
      processData: false,
      success: function (data) {
        if (data.auth === true) {
          storage.set("auth", { auth: true });
          storage.set("user", data);
          ipcRenderer.send("app-reload", "");
          $("#login").hide();
        } else {
          notiflix.Report.warning("Oops!", auth_error, "Ok");
        }
      },
      error: function (data) {
        console.log(data);
      },
    });
  }
});

$("#quit").on("click", function () {
  const diagOptions = {
    title: "Are you sure?",
    text: "You are about to close the application.",
    icon: "warning",
    okButtonText: "Close Application",
    cancelButtonText: "Cancel"
  };

  notiflix.Confirm.show(
    diagOptions.title,
    diagOptions.text,
    diagOptions.okButtonText,
    diagOptions.cancelButtonText,
    () => {
      ipcRenderer.send("app-quit", "");
    },
  );
});

ipcRenderer.on("click-element", (event, elementId) => {
  document.getElementById(elementId).click();
});




