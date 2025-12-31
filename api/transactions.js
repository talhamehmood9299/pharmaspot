let app = require("express")();
let server = require("http").Server(app);
let bodyParser = require("body-parser");
let Datastore = require("@seald-io/nedb");
let Inventory = require("./inventory");
const path = require("path");
const fs = require("fs");
const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const dbPath = path.join(
  appData,
  appName,
  "server",
  "databases",
  "transactions.db",
);
const inventoryDbPath = path.join(
  appData,
  appName,
  "server",
  "databases",
  "inventory.db",
);
const categoryDbPath = path.join(
  appData,
  appName,
  "server",
  "databases",
  "categories.db",
);

app.use(bodyParser.json());

module.exports = app;

let transactionsDB = new Datastore({
  filename: dbPath,
  autoload: true,
});

transactionsDB.ensureIndex({ fieldName: "_id", unique: true });

const ensureDbDir = (dbPath) => {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDbDir(inventoryDbPath);
ensureDbDir(categoryDbPath);

const loadJsonLines = (dbFilePath) => {
  const documents = {};

  try {
    if (!fs.existsSync(dbFilePath)) {
      return [];
    }

    const lines = fs
      .readFileSync(dbFilePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    lines.forEach((line) => {
      try {
        const doc = JSON.parse(line);
        const idKey = toKey(doc._id);
        if (doc.$$deleted) {
          delete documents[idKey];
        } else {
          documents[idKey] = doc;
        }
      } catch (err) {
        console.error("Skipping invalid line in DB:", dbFilePath, err);
      }
    });
  } catch (err) {
    console.error("Error reading DB file:", dbFilePath, err);
    return [];
  }

  return Object.values(documents);
};

const toKey = (value) =>
  value !== undefined && value !== null ? value.toString() : "";

const toFloat = (value) => {
  const number = parseFloat(value);
  return Number.isNaN(number) ? 0 : number;
};

const buildInventoryMap = (docs = null) => {
  const inventoryDocs = docs || loadJsonLines(inventoryDbPath);
  const inventoryMap = {};

  (inventoryDocs || []).forEach((product) => {
    inventoryMap[toKey(product._id)] = product;
  });

  return inventoryMap;
};

const computeTransactionProfit = (transaction, inventoryMap = null) => {
  if (!transaction || !Array.isArray(transaction.items)) {
    return 0;
  }

  const map = inventoryMap || buildInventoryMap();
  let totalProfit = 0;

  transaction.items.forEach((item) => {
    const quantity = parseFloat(item.quantity) || 0;
    if (quantity <= 0) {
      return;
    }

    const saleDiscount = parseFloat(item.sale_discount || 0);
    const saleDiscount2 = parseFloat(item.sale_discount2 || 0);
    const basePrice = parseFloat(item.price || 0);
    const saleUnit =
      basePrice *
      (1 - saleDiscount / 100) *
      (1 - saleDiscount2 / 100);
    const saleAmount = saleUnit * quantity;

    let purchaseUnit = saleUnit;
    const productRecord = map[toKey(item.id)];
    if (productRecord && productRecord.price) {
      const purchaseDiscount = parseFloat(
        productRecord.purchase_discount || 0,
      );
      const productPrice = parseFloat(productRecord.price) || 0;
      const calculatedPurchase =
        productPrice * (1 - purchaseDiscount / 100);

      if (Number.isFinite(calculatedPurchase)) {
        purchaseUnit = calculatedPurchase;
      }
    }

    const purchaseAmount = purchaseUnit * quantity;
    totalProfit += saleAmount - purchaseAmount;
  });

  return parseFloat(totalProfit.toFixed(2));
};

const sendError = (res, message, err) => {
  if (err) {
    console.error(err);
  }
  res.status(500).json({
    error: "Internal Server Error",
    message,
  });
};

const buildProfitReport = (req, res) => {
  let startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
  let endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    startDate = new Date(0);
  }
  if (Number.isNaN(endDate.getTime())) {
    endDate = new Date();
  }

  const normalizedFilter = req.query.categoryId || req.query.companyId || "";
  const companyFilterKey = normalizedFilter ? normalizedFilter.toString() : "";

  const inventoryDocs = loadJsonLines(inventoryDbPath);
  const categoryDocs = loadJsonLines(categoryDbPath);
  const inventoryMap = buildInventoryMap(inventoryDocs);

  const categoryMap = {};
  (categoryDocs || []).forEach((category) => {
    categoryMap[toKey(category._id)] = category.name;
  });

  let inventoryValue = 0;
  const inventoryCompanyTotals = {};
  (inventoryDocs || []).forEach((product) => {
    const quantity = parseFloat(product.quantity) || 0;
    if (quantity <= 0) {
      return;
    }

    const productCategory = toKey(product.category);
    if (companyFilterKey && productCategory !== companyFilterKey) {
      return;
    }

    const basePrice = parseFloat(product.price || 0);
    const purchaseDiscount = parseFloat(product.purchase_discount || 0);
    const unitCost = basePrice * (1 - purchaseDiscount / 100);
    if (!Number.isFinite(unitCost)) {
      return;
    }

    inventoryValue += unitCost * quantity;
    const companyLabel =
      categoryMap[toKey(product.category)] ||
      product.company ||
      "Unknown";
    if (!inventoryCompanyTotals[companyLabel]) {
      inventoryCompanyTotals[companyLabel] = 0;
    }
    inventoryCompanyTotals[companyLabel] += unitCost * quantity;
  });

  transactionsDB.find({}, function (txErr, transactions) {
    if (txErr) {
      return sendError(res, "Unable to load transactions.", txErr);
    }

    let totalPurchase = 0;
    let totalSale = 0;
    let totalProfit = 0;
    const companyTotals = {};
    const transactionEntries = [];

    (transactions || []).forEach((transaction) => {
      const transactionDate = transaction.date ? new Date(transaction.date) : null;
      if (!transactionDate || transactionDate < startDate || transactionDate > endDate) {
        return;
      }

      const items = Array.isArray(transaction.items) ? transaction.items : [];
      let transPurchase = 0;
      let transSale = 0;
      const companyNames = new Set();
      const categorySet = new Set();
      let primaryCategoryId;

      items.forEach((item) => {
        const quantity = parseFloat(item.quantity) || 0;
        if (quantity <= 0) {
          return;
        }

        const saleDiscount = parseFloat(item.sale_discount || 0);
    const saleDiscount2 = parseFloat(item.sale_discount2 || 0);
        const basePrice = parseFloat(item.price || 0);
        const saleUnit = basePrice * (1 - saleDiscount / 100) * (1 - saleDiscount2 / 100);
        const saleAmount = saleUnit * quantity;
        transSale += saleAmount;

        const productKey = toKey(item.id);
        const productRecord = inventoryMap[productKey];
        const productCategory = productRecord
          ? toKey(productRecord.category)
          : toKey(item.category);

        if (productCategory) {
          categorySet.add(productCategory);
          if (!primaryCategoryId) {
            primaryCategoryId = productCategory;
          }
        }

        let purchaseUnit = saleUnit;
        if (productRecord && productRecord.price) {
          const purchaseDiscount = parseFloat(productRecord.purchase_discount || 0);
          const productPrice = parseFloat(productRecord.price) || 0;
          const calculatedPurchase = productPrice * (1 - purchaseDiscount / 100);
          if (Number.isFinite(calculatedPurchase)) {
            purchaseUnit = calculatedPurchase;
          }
        }

        const purchaseAmount = purchaseUnit * quantity;
        transPurchase += purchaseAmount;

        const companyName =
          categoryMap[productCategory] ||
          item.company ||
          item.category ||
          "Unknown";
        if (companyName) {
          companyNames.add(companyName);
        }
      });

      if (companyFilterKey && !categorySet.has(companyFilterKey)) {
        return;
      }

      const profitAmount = transSale - transPurchase;
      const margin =
        transSale > 0 ? ((profitAmount / transSale) * 100).toFixed(2) : "0.00";
      const companyLabel =
        companyNames.size > 0 ? Array.from(companyNames).join(", ") : "Unknown";

      totalPurchase += transPurchase;
      totalSale += transSale;
      totalProfit += profitAmount;

      if (companyLabel !== "Unknown") {
        if (!companyTotals[companyLabel]) {
          companyTotals[companyLabel] = { purchase: 0, sale: 0, profit: 0 };
        }
        companyTotals[companyLabel].purchase += transPurchase;
        companyTotals[companyLabel].sale += transSale;
        companyTotals[companyLabel].profit += profitAmount;
      }

      transactionEntries.push({
        _id: transaction._id,
        order: transaction.order,
        date: transaction.date,
        purchaseAmount: transPurchase.toFixed(2),
        saleAmount: transSale.toFixed(2),
        profit: profitAmount.toFixed(2),
        profitMargin: margin,
        categoryId: primaryCategoryId,
        companyName: companyLabel,
        companyLabel,
      });
    });

    const formattedMargin =
      totalSale > 0 ? ((totalProfit / totalSale) * 100).toFixed(2) : "0.00";
    const companyBreakdown = Object.keys(companyTotals).map((company) => ({
      company,
      purchaseAmount: companyTotals[company].purchase.toFixed(2),
      saleAmount: companyTotals[company].sale.toFixed(2),
      profit: companyTotals[company].profit.toFixed(2),
    }));

    const inventoryBreakdown = Object.keys(inventoryCompanyTotals).map((company) => ({
      company,
      purchaseAmount: inventoryCompanyTotals[company].toFixed(2),
    }));

    res.send({
      totalPurchaseAmount: inventoryValue.toFixed(2),
      totalSaleAmount: totalSale.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      profitMargin: formattedMargin,
      transactionCount: transactionEntries.length,
      transactions: transactionEntries,
      companyBreakdown,
    });
  });
};

/**
 * GET endpoint: Get the welcome message for the Transactions API.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/", function (req, res) {
  res.send("Transactions API");
});

/**
 * GET endpoint: Get details of all transactions.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/all", function (req, res) {
  transactionsDB.find({}, function (err, docs) {
    res.send(docs);
  });
});

/**
 * GET endpoint: Get on-hold transactions.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/on-hold", function (req, res) {
  transactionsDB.find(
    { $and: [{ ref_number: { $ne: "" } }, { status: 0 }] },
    function (err, docs) {
      if (docs) res.send(docs);
    },
  );
});

/**
 * GET endpoint: Get customer orders with a status of 0 and an empty reference number.
 *
 * @param {Object} req request object.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/customer-orders", function (req, res) {
  transactionsDB.find(
    { $and: [{ customer: { $ne: "0" } }, { status: 0 }, { ref_number: "" }] },
    function (err, docs) {
      if (docs) res.send(docs);
    },
  );
});

/**
 * GET endpoint: Get transactions based on date, user, and till parameters.
 *
 * @param {Object} req request object with query parameters.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/by-date", function (req, res) {
  let startDate = new Date(req.query.start);
  let endDate = new Date(req.query.end);

  if (req.query.user == 0 && req.query.till == 0) {
    transactionsDB.find(
      {
        $and: [
          { date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() } },
          { status: parseInt(req.query.status) },
        ],
      },
      function (err, docs) {
        if (docs) res.send(docs);
      },
    );
  }

  if (req.query.user != 0 && req.query.till == 0) {
    transactionsDB.find(
      {
        $and: [
          { date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() } },
          { status: parseInt(req.query.status) },
          { user_id: parseInt(req.query.user) },
        ],
      },
      function (err, docs) {
        if (docs) res.send(docs);
      },
    );
  }

  if (req.query.user == 0 && req.query.till != 0) {
    transactionsDB.find(
      {
        $and: [
          { date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() } },
          { status: parseInt(req.query.status) },
          { till: parseInt(req.query.till) },
        ],
      },
      function (err, docs) {
        if (docs) res.send(docs);
      },
    );
  }

  if (req.query.user != 0 && req.query.till != 0) {
    transactionsDB.find(
      {
        $and: [
          { date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() } },
          { status: parseInt(req.query.status) },
          { till: parseInt(req.query.till) },
          { user_id: parseInt(req.query.user) },
        ],
      },
      function (err, docs) {
        if (docs) res.send(docs);
      },
    );
  }
});

/**
 * POST endpoint: Create a new transaction.
 *
 * @param {Object} req request object with transaction data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.post("/new", function (req, res) {
  let newTransaction = req.body;
  const inventoryMap = buildInventoryMap();
  newTransaction.profit = computeTransactionProfit(newTransaction, inventoryMap);

  const totalAmount = toFloat(newTransaction.total);
  const paidAmount = toFloat(newTransaction.paid);
  const shouldDeductInventory = totalAmount > 0 && paidAmount >= totalAmount;
  newTransaction.inventory_deducted = shouldDeductInventory;

  transactionsDB.insert(newTransaction, function (err, transaction) {
    if (err) {
      console.error(err);
      res.status(500).json({
        error: "Internal Server Error",
        message: "An unexpected error occurred.",
      });
    } else {
      res.sendStatus(200);

      if (shouldDeductInventory) {
        Inventory.decrementInventory(newTransaction.items);
      }
    }
  });
});

/**
 * PUT endpoint: Update an existing transaction.
 *
 * @param {Object} req request object with transaction data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.put("/new", function (req, res) {
  let oderId = req.body._id;
  req.body.profit = computeTransactionProfit(req.body);
  const totalAmount = toFloat(req.body.total);
  const paidAmount = toFloat(req.body.paid);

  transactionsDB.findOne({ _id: oderId }, function (findErr, existingTransaction) {
    if (findErr) {
      console.error(findErr);
      return sendError(res, "Unable to load existing transaction.", findErr);
    }

    const alreadyDeducted = existingTransaction && existingTransaction.inventory_deducted;
    const shouldDeductInventory =
      !alreadyDeducted && totalAmount > 0 && paidAmount >= totalAmount;
    req.body.inventory_deducted = alreadyDeducted || shouldDeductInventory;

    transactionsDB.update(
      {
        _id: oderId,
      },
      req.body,
      {},
      function (err, numReplaced, order) {
        if (err) {
          console.error(err);
          res.status(500).json({
            error: "Internal Server Error",
            message: "An unexpected error occurred.",
          });
        } else {
          if (shouldDeductInventory) {
            Inventory.decrementInventory(req.body.items);
          }
          res.sendStatus(200);
        }
      },
    );
  });
});

/**
 * POST endpoint: Delete a transaction.
 *
 * @param {Object} req request object with transaction data in the body.
 * @param {Object} res response object.
 * @returns {void}
 */
app.post("/delete", function (req, res) {
  let transaction = req.body;
  transactionsDB.remove(
    {
      _id: transaction.orderId,
    },
    function (err, numRemoved) {
      if (err) {
        console.error(err);
        res.status(500).json({
          error: "Internal Server Error",
          message: "An unexpected error occurred.",
        });
      } else {
        res.sendStatus(200);
      }
    },
  );
});

/**
 * GET endpoint: Get details of a specific transaction by transaction ID.
 *
 * @param {Object} req request object with transaction ID as a parameter.
 * @param {Object} res response object.
 * @returns {void}
 */
app.get("/:transactionId", function (req, res) {
  transactionsDB.find({ _id: req.params.transactionId }, function (err, doc) {
    if (doc) res.send(doc[0]);
  });
});

app.get("/profit/calculate", buildProfitReport);
app.get("/transactions/profit/calculate", buildProfitReport);

