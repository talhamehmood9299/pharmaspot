import json
from pathlib import Path

base = Path.home() / "AppData" / "Roaming" / "PharmaSpot" / "server" / "databases"
inventory_path = base / "inventory.db"

category_id = "1766645198"  # replace with Hamdard _id from your categories.db
changed = 0
lines = []

with inventory_path.open("r", encoding="utf-8") as stream:
    for line in stream:
        doc = json.loads(line)
        if str(doc.get("category")) == category_id:
            doc["purchase_discount"] = 33.7
            doc["sale_discount"] = 15
            changed += 1
        lines.append(json.dumps(doc, ensure_ascii=False))

with inventory_path.open("w", encoding="utf-8") as stream:
    stream.write("\n".join(lines) + "\n")

print(f"Updated {changed} Hamdard products.")
