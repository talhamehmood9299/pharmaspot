# Wholesale Discount Features - Complete Guide

## Overview
PharmaSpot now includes comprehensive wholesale discount management features that allow you to track and manage discounts from suppliers and to customers, with automatic profit calculation.

## Features Implemented

### 1. **Purchase Discount Management**
- Track discounts received from suppliers when purchasing inventory
- Store as percentage (e.g., 15% supplier discount)
- Applied when calculating actual cost of products
- Formula: `Actual Cost = Cost Price × (1 - Purchase Discount %)`

### 2. **Sale Discount Management**  
- Set default sale discount for each product (e.g., 10% customer discount)
- Override discount on per-transaction basis during checkout
- Automatically applied when calculating totals
- Formula: `Sale Price = Listed Price × (1 - Sale Discount %)`

### 3. **Point of Sale Enhancements**
The Point of Sale screen has been updated with:
- **Discount Column** showing applied discount percentage for each item
- **Edit Discount Button** allowing per-item discount modification during checkout
- **Real-time Calculation** applying discounts to cart totals
- **Manual Override** capability to change discounts for specific transactions

### 4. **Profit Analytics**
- Calculate profit considering both purchase and sale discounts
- Generate reports by date range
- View transaction-level profit details
- Metrics provided:
  - Total Purchase Amount
  - Total Sale Amount  
  - Total Profit
  - Profit Margin (%)

## Product Management

### Adding a Product with Discounts

1. Go to **Products** section
2. Click **Add Product**
3. Fill in the form:
   - **Product Name**: Product identifier
   - **Barcode**: Product barcode
   - **Cost Price**: What you paid (after any deductions)
   - **Price**: Selling price (before discounts)
   - **Purchase Discount (%)**: Supplier discount (e.g., 15)
   - **Default Sale Discount (%)**: Customer discount (e.g., 10)
   - Other fields as usual (Category, Expiry, Stock, etc.)
4. Click **Submit**

### Editing Product Discounts

1. Go to **Products** section
2. Click **Edit** on the product
3. Modify:
   - **Cost Price**
   - **Purchase Discount**
   - **Default Sale Discount**
4. Click **Update**

## Point of Sale Operations

### Checkout with Discounts

1. **Add Products to Cart**: Select products as usual
2. **View Discounts**: Each item shows default sale discount in the Discount column
3. **Edit Per-Item Discount**:
   - Click "Edit Discount" button next to any item
   - Enter new discount percentage (0-100)
   - Click "Apply"
4. **View Totals**: Cart automatically recalculates with applied discounts
5. **Complete Transaction**: Process payment as usual

### Discount Editing Dialog

When you click "Edit Discount" on a cart item:
- Shows current discount percentage
- Input field for new discount value
- Apply button to confirm change
- Changes take effect immediately in cart calculation

## Profit Analytics

### Accessing Profit Reports

1. Go to **Settings** or Reports section
2. Find "Profit Analytics" button
3. Enter date range:
   - **Start Date**: Beginning of reporting period
   - **End Date**: End of reporting period
4. Click **Calculate Profit**

### Report Contents

The profit report shows:

**Summary Cards:**
- **Total Purchase Amount**: Sum of actual costs (with supplier discounts applied)
- **Total Sale Amount**: Sum of selling amounts (with customer discounts applied)
- **Total Profit**: Difference between sale and purchase amounts
- **Profit Margin**: Profit as percentage of sales

**Transaction Details Table:**
- Date of transaction
- Purchase amount for that transaction
- Sale amount for that transaction
- Profit earned
- Profit margin %

## Calculation Examples

### Example 1: Product with Supplier Discount

Product details:
- Cost Price: 100 PKR
- Purchase Discount: 15%
- Actual Cost = 100 × (1 - 15/100) = 85 PKR

### Example 2: Product with Customer Discount

Product details:
- Listed Price: 200 PKR
- Default Sale Discount: 10%
- Customer Sale Price = 200 × (1 - 10/100) = 180 PKR

### Example 3: Complete Transaction Profit

Product:
- Cost Price: 100, Purchase Discount: 15% = Actual Cost: 85 PKR
- Listed Price: 200, Sale Discount: 10% = Customer Price: 180 PKR
- Profit = 180 - 85 = 95 PKR
- Profit Margin = (95/180) × 100 = 52.78%

## Database Fields

### Products Collection
Added fields:
- `cost_price`: Numeric - actual cost of product
- `purchase_discount`: Numeric - supplier discount percentage
- `sale_discount`: Numeric - default customer discount percentage

### Transactions 
Profit calculations use:
- Product cost, purchase discount
- Product price, sale discount
- Quantity purchased

## API Endpoints

### New Endpoint: Profit Calculation
```
GET /api/transactions/profit/calculate?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

Returns:
```json
{
  "totalPurchaseAmount": "5000.00",
  "totalSaleAmount": "7500.00",
  "totalProfit": "2500.00",
  "profitMargin": "33.33",
  "transactionCount": 25,
  "transactions": [
    {
      "_id": "transaction_id",
      "date": "2024-01-15",
      "purchaseAmount": "200.00",
      "saleAmount": "300.00",
      "profit": "100.00",
      "profitMargin": "33.33"
    }
  ]
}
```

## Best Practices

1. **Cost Price Entry**: Always enter the actual cost after any supplier discounts
2. **Discount Consistency**: Use round percentages (e.g., 10%, 15%) for easier tracking
3. **Regular Reporting**: Run profit analytics weekly or monthly to monitor margin trends
4. **Override Sparingly**: Use per-transaction discounts only when necessary
5. **Regular Audits**: Verify discount calculations match your agreements with suppliers

## Troubleshooting

### Discounts Not Applying in Cart
- Ensure product has sale discount value entered
- Check that discount percentage is between 0-100
- Refresh the page and re-add products

### Profit Calculation Issues
- Verify date format (DD/MM/YYYY in date picker)
- Ensure transactions exist in the date range
- Check that products have cost_price filled

### Performance with Large Date Ranges
- Run reports for smaller date ranges (weekly/monthly)
- Archive old transactions if database becomes slow

## Summary of Changes

### Files Modified:
1. **api/inventory.js** - Added cost_price, purchase_discount, sale_discount fields to product schema
2. **index.html** - Added form fields and Profit Analytics modal
3. **assets/js/pos.js** - Updated cart display, calculations, and added profit functions
4. **api/transactions.js** - Added profit calculation endpoint

### New Features:
- 3 new product fields
- Updated cart display with discount column
- Edit discount functionality in cart
- Profit analytics reporting
- Date range filtering for reports
