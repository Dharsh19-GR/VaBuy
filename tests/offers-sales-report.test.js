const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const {
  calculateDiscount,
  getBestProductOffer,
  applyReferralDiscount,
} = require("../services/offer-pricing");
const {
  parseDateRange,
  buildSalesReport,
  createExcelReport,
  createPdfReport,
} = require("../services/sales-report");

test("product and category offer selection uses the largest valid discount", () => {
  const product = { _id: "product-1", category: "category-1", price: 100 };
  const offers = [
    { _id: "product-offer", type: "product", product: "product-1", discountType: "percentage", value: 10 },
    { _id: "category-offer", type: "category", category: "category-1", discountType: "fixed", value: 15 },
  ];
  assert.equal(calculateDiscount(100, offers[0]), 10);
  assert.equal(calculateDiscount(100, { discountType: "fixed", value: 150 }), 100);
  assert.equal(getBestProductOffer(product, offers).offer._id, "category-offer");
  assert.equal(getBestProductOffer(product, offers).discount, 15);
});

test("referral fixed and percentage discounts are capped and distributed by cart value", () => {
  const items = [
    { price: 90, quantity: 1 },
    { price: 45, quantity: 2 },
  ];
  const result = applyReferralDiscount(items, { discountType: "percentage", value: 10 });
  assert.equal(result.preReferralSubtotal, 180);
  assert.equal(result.totalDiscount, 18);
  assert.equal(items.reduce((sum, item) => sum + item.referralDiscount, 0), 18);
  const fixed = applyReferralDiscount(items, { discountType: "fixed", value: 250 });
  assert.equal(fixed.totalDiscount, 180);
  assert.equal(fixed.subtotal, 0);
});

test("sales report includes paid refunds in deductions and excludes them from sale count", () => {
  const from = new Date("2026-10-01T00:00:00");
  const to = new Date("2026-10-31T23:59:59");
  const orders = [
    {
      createdAt: new Date("2026-10-10T12:00:00"),
      status: "delivered",
      paymentStatus: "paid",
      items: [{ quantity: 2, baseUnitPrice: 100, productOfferDiscount: 10, couponDiscount: 5, referralDiscount: 10 }],
      grossSubtotal: 200,
      offerDiscount: 20,
      couponDiscount: 10,
      referralDiscount: 10,
      subtotal: 160,
      total: 168,
    },
    {
      createdAt: new Date("2026-10-11T12:00:00"),
      status: "returned",
      paymentStatus: "paid",
      items: [{ quantity: 1, baseUnitPrice: 50, productOfferDiscount: 0, couponDiscount: 0 }],
      grossSubtotal: 50,
      total: 54,
    },
    {
      createdAt: new Date("2026-10-12T12:00:00"),
      status: "cancelled",
      paymentStatus: "paid",
      items: [{ quantity: 1, baseUnitPrice: 40, productOfferDiscount: 0, couponDiscount: 0 }],
      grossSubtotal: 40,
      total: 43,
    },
    {
      createdAt: new Date("2026-10-13T12:00:00"),
      status: "delivered",
      paymentStatus: "pending",
      items: [{ quantity: 5, baseUnitPrice: 500 }],
      total: 500,
    },
  ];
  const report = buildSalesReport(orders, { from, to, groupBy: "daily" });
  assert.equal(report.summary.orders, 1);
  assert.equal(report.summary.units, 2);
  assert.equal(report.summary.gross, 290);
  assert.equal(report.summary.productCategoryDiscounts, 20);
  assert.equal(report.summary.couponDiscounts, 10);
  assert.equal(report.summary.referralDiscounts, 10);
  assert.equal(report.summary.discounts, 40);
  assert.equal(report.summary.refunds, 97);
  assert.equal(report.summary.netSales, 168);
  assert.equal(report.rows.length, 3);
});

test("sales report period parsing enforces valid custom ranges and supports presets", () => {
  const now = new Date("2026-10-14T15:30:00");
  assert.equal(parseDateRange({ period: "day" }, now).from.getHours(), 0);
  assert.equal(parseDateRange({ period: "week" }, now).from.getDate(), 8);
  assert.equal(parseDateRange({ period: "month" }, now).from.getDate(), 15);
  assert.equal(parseDateRange({ period: "year" }, now).from.getMonth(), 0);
  assert.throws(() => parseDateRange({ period: "custom", start: "2026-10-20", end: "2026-10-01" }, now));
  assert.throws(() => parseDateRange({ period: "invalid" }, now));
});

test("Excel and PDF exporters produce valid file payloads", async () => {
  const report = buildSalesReport([], {
    from: new Date("2026-10-01T00:00:00"),
    to: new Date("2026-10-02T23:59:59"),
    groupBy: "daily",
  });
  const xlsx = await createExcelReport(report);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx);
  assert.equal(workbook.getWorksheet("Sales report").getCell("A2").value, "OVERALL");
  const pdf = await createPdfReport(report);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});
