const Order = require("../models/Order");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDateRange = (query = {}, now = new Date()) => {
  const period = String(query.period || "week");
  let from;
  let to = new Date(now);
  to.setHours(23, 59, 59, 999);
  if (period === "day") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    from = new Date(now.getTime() - 6 * DAY_MS);
    from.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    from = new Date(now.getTime() - 29 * DAY_MS);
    from.setHours(0, 0, 0, 0);
  } else if (period === "year") {
    from = new Date(now.getFullYear(), 0, 1);
  } else if (period === "custom") {
    from = new Date(`${query.start || ""}T00:00:00`);
    to = new Date(`${query.end || ""}T23:59:59.999`);
    if (!query.start || !query.end || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new Error("Choose a valid custom start and end date.");
    }
    const maxRangeDays = 3660;
    if (to.getTime() - from.getTime() > maxRangeDays * DAY_MS) {
      throw new Error("The custom date range cannot exceed 10 years.");
    }
  } else {
    throw new Error("Select a valid sales-report date range.");
  }
  return { from, to, period };
};

const getOrderDiscounts = (order) => {
  const products = order.items.reduce((sum, item) =>
    sum + Number(item.productOfferDiscount || 0) * item.quantity, 0);
  const coupons = order.items.reduce((sum, item) =>
    sum + Number(item.couponDiscount || (item.couponDiscountPercent && !order.couponDiscount
      ? Number(item.unitPrice || 0) * item.couponDiscountPercent / (100 - item.couponDiscountPercent)
      : 0)) * item.quantity, 0);
  const referrals = Number(order.referralDiscount || order.items.reduce((sum, item) => sum + Number(item.referralDiscount || 0), 0));
  const offer = Number(order.offerDiscount || 0) || products;
  const coupon = Number(order.couponDiscount || 0) || coupons;
  return { products: offer, coupons: coupon, referrals, total: offer + coupon + referrals };
};

const buildSalesReport = (orders, { from, to, groupBy = "daily" }) => {
  const periods = new Map();
  const summary = { orders: 0, units: 0, gross: 0, productCategoryDiscounts: 0, couponDiscounts: 0, referralDiscounts: 0, discounts: 0, refunds: 0, netSales: 0 };
  for (const order of orders) {
    const orderDate = new Date(order.createdAt);
    if (order.paymentStatus !== "paid") continue;
    const discounts = getOrderDiscounts(order);
    const gross = Number(order.grossSubtotal ?? (order.subtotal + discounts.total));
    const refund = ["cancelled", "returned"].includes(order.status) ? Number(order.total) : 0;
    const net = Number(order.total) - refund;
    if (!["cancelled", "returned"].includes(order.status)) {
      summary.orders += 1;
      summary.units += order.items.reduce((count, item) => count + Number(item.quantity || 0), 0);
    }
    summary.gross += gross;
    summary.productCategoryDiscounts += discounts.products;
    summary.couponDiscounts += discounts.coupons;
    summary.referralDiscounts += discounts.referrals;
    summary.discounts += discounts.total;
    summary.refunds += refund;
    summary.netSales += net;

    const key = getGroupKey(orderDate, groupBy);
    const row = periods.get(key) || { period: key, orders: 0, units: 0, gross: 0, productCategoryDiscounts: 0, couponDiscounts: 0, referralDiscounts: 0, discounts: 0, refunds: 0, netSales: 0 };
    if (!["cancelled", "returned"].includes(order.status)) {
      row.orders += 1;
      row.units += order.items.reduce((count, item) => count + Number(item.quantity || 0), 0);
    }
    row.gross += gross;
    row.productCategoryDiscounts += discounts.products;
    row.couponDiscounts += discounts.coupons;
    row.referralDiscounts += discounts.referrals;
    row.discounts += discounts.total;
    row.refunds += refund;
    row.netSales += net;
    periods.set(key, row);
  }
  for (const key of ["gross", "productCategoryDiscounts", "couponDiscounts", "referralDiscounts", "discounts", "refunds", "netSales"]) {
    summary[key] = Number(summary[key].toFixed(2));
  }
  const rows = [...periods.values()].map((row) => ({
    ...row,
    ...Object.fromEntries(["gross", "productCategoryDiscounts", "couponDiscounts", "referralDiscounts", "discounts", "refunds", "netSales"].map((key) => [key, Number(row[key].toFixed(2))])),
  })).sort((left, right) => left.period.localeCompare(right.period));
  return { summary, rows, from, to, groupBy };
};

const getGroupKey = (date, groupBy) => {
  if (groupBy === "yearly") return String(date.getFullYear());
  if (groupBy === "weekly") {
    const weekStart = new Date(date);
    const day = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - day);
    return `Week of ${weekStart.toISOString().slice(0, 10)}`;
  }
  return date.toISOString().slice(0, 10);
};

const querySalesReport = async (range, groupBy) => {
  const orders = await Order.find({
    createdAt: { $gte: range.from, $lte: range.to },
    paymentStatus: "paid",
  })
    .select("createdAt status paymentStatus items subtotal grossSubtotal offerDiscount couponDiscount referralDiscount total")
    .lean();
  return buildSalesReport(orders, { ...range, groupBy });
};

const createExcelReport = async (report) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VaBuy";
  const sheet = workbook.addWorksheet("Sales report");
  sheet.columns = [
    { header: "Period", key: "period", width: 22 },
    { header: "Orders", key: "orders", width: 12 },
    { header: "Units sold", key: "units", width: 14 },
    { header: "Gross (INR)", key: "gross", width: 16 },
    { header: "Product/category offers", key: "productCategoryDiscounts", width: 24 },
    { header: "Coupons", key: "couponDiscounts", width: 14 },
    { header: "Referral", key: "referralDiscounts", width: 14 },
    { header: "Total discount", key: "discounts", width: 17 },
    { header: "Refunds", key: "refunds", width: 14 },
    { header: "Net sales (INR)", key: "netSales", width: 18 },
  ];
  sheet.addRow({ period: "OVERALL", ...report.summary });
  sheet.addRows(report.rows);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  return workbook.xlsx.writeBuffer();
};

const createPdfReport = (report) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);
  doc.fontSize(18).text("VaBuy sales report", { align: "center" });
  doc.moveDown(0.5).fontSize(10).text(`${report.from.toLocaleDateString()} – ${report.to.toLocaleDateString()}`);
  doc.moveDown().fontSize(12).text(`Orders: ${report.summary.orders}  |  Units: ${report.summary.units}  |  Gross: INR ${report.summary.gross.toFixed(2)}  |  Discounts: INR ${report.summary.discounts.toFixed(2)}  |  Refunds: INR ${report.summary.refunds.toFixed(2)}  |  Net sales: INR ${report.summary.netSales.toFixed(2)}`);
  doc.moveDown();
  const columns = [
    ["Period", 65], ["Orders", 42], ["Gross", 66], ["Offer disc.", 68],
    ["Coupons", 58], ["Referral", 58], ["Discounts", 68], ["Refunds", 58], ["Net sales", 68],
  ];
  const drawRow = (values, bold = false) => {
    let x = doc.page.margins.left;
    const y = doc.y;
    if (bold) doc.font("Helvetica-Bold"); else doc.font("Helvetica");
    columns.forEach(([label, width], index) => {
      doc.text(String(values[index] ?? ""), x, y, { width, lineBreak: false, ellipsis: true });
      x += width + 10;
    });
    doc.moveDown(1.2);
    if (doc.y > doc.page.height - 45) doc.addPage();
  };
  drawRow(columns.map(([label]) => label), true);
  drawRow(["OVERALL", report.summary.orders, report.summary.gross.toFixed(2), report.summary.productCategoryDiscounts.toFixed(2), report.summary.couponDiscounts.toFixed(2), report.summary.referralDiscounts.toFixed(2), report.summary.discounts.toFixed(2), report.summary.refunds.toFixed(2), report.summary.netSales.toFixed(2)], true);
  for (const row of report.rows) {
    drawRow([row.period, row.orders, row.gross.toFixed(2), row.productCategoryDiscounts.toFixed(2), row.couponDiscounts.toFixed(2), row.referralDiscounts.toFixed(2), row.discounts.toFixed(2), row.refunds.toFixed(2), row.netSales.toFixed(2)]);
  }
  doc.end();
});

module.exports = { parseDateRange, getOrderDiscounts, buildSalesReport, querySalesReport, createExcelReport, createPdfReport };
