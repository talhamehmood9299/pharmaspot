import json
import os
import time
from pathlib import Path

import openpyxl


def load_db(path: Path):
    entries = []
    if path.exists():
        with path.open("r", encoding="utf-8") as stream:
            for line in stream:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return entries


def main():
    appdata = os.getenv("APPDATA")
    if not appdata:
        raise SystemExit("APPDATA environment variable missing.")

    appname = os.getenv("APPNAME") or "PharmaSpot"
    base = Path(appdata) / appname / "server" / "databases"
    if not base.exists():
        raise SystemExit(f"Database directory missing: {base}")

    categories_path = base / "categories.db"
    inventory_path = base / "inventory.db"

    category_docs = load_db(categories_path)
    category_map = {}
    max_category_id = 0
    for doc in category_docs:
        try:
            current_id = int(doc.get("_id") or 0)
        except Exception:
            current_id = 0
        max_category_id = max(max_category_id, current_id)
        name = (doc.get("name") or "").strip().lower()
        if name:
            category_map[name] = doc

    inventory_docs = load_db(inventory_path)
    existing_products = set()
    max_inventory_id = 0
    for doc in inventory_docs:
        try:
            current_id = int(doc.get("_id") or 0)
        except Exception:
            current_id = 0
        max_inventory_id = max(max_inventory_id, current_id)
        name = (doc.get("name") or "").strip().lower()
        cat_id = str(doc.get("category") or "")
        existing_products.add((name, cat_id))

    workbook = openpyxl.load_workbook("Product_List.xlsx")
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if len(rows) <= 1:
        raise SystemExit("Excel sheet appears empty.")

    new_categories = []
    new_products = []
    next_category_id = max(max_category_id + 1, int(time.time()))
    next_inventory_id = max(max_inventory_id + 1, int(time.time()))

    for row in rows[1:]:
        if not row or len(row) < 3:
            continue
        product_name = (row[1] or "").strip()
        company = (row[2] or "").strip()
        if not product_name or not company:
            continue

        company_key = company.lower()
        category = category_map.get(company_key)
        if not category:
            category = {"_id": next_category_id, "id": "", "name": company}
            next_category_id += 1
            category_map[company_key] = category
            new_categories.append(category)

        cat_id_str = str(category["_id"])
        product_key = (product_name.lower(), cat_id_str)
        if product_key in existing_products:
            continue

        new_doc = {
            "_id": next_inventory_id,
            "barcode": None,
            "expirationDate": "",
            "price": "",
            "category": cat_id_str,
            "quantity": 0,
            "name": product_name,
            "stock": 1,
            "minStock": "",
            "img": "",
            "purchase_discount": 33.7,
            "sale_discount": 15,
        }
        next_inventory_id += 1
        new_products.append(new_doc)
        existing_products.add(product_key)

    if not new_categories and not new_products:
        print("No new companies or products were imported.")
        return

    if new_categories:
        with categories_path.open("a", encoding="utf-8") as stream:
            for doc in new_categories:
                stream.write(json.dumps(doc, ensure_ascii=False) + "\n")

    if new_products:
        with inventory_path.open("a", encoding="utf-8") as stream:
            for doc in new_products:
                stream.write(json.dumps(doc, ensure_ascii=False) + "\n")

    print(f"Added {len(new_categories)} companies and {len(new_products)} products.")


if __name__ == "__main__":
    main()
