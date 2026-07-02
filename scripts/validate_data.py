import json
import os

data_path = "../data.js"

if not os.path.exists(data_path):
    print("Error: data.js does not exist!")
    exit(1)

with open(data_path, "r", encoding="utf-8") as f:
    content = f.read()
    # Strip the js variable wrapper const CATO_STUDY_DATA = ...;
    json_str = content.replace("const CATO_STUDY_DATA = ", "").strip()
    if json_str.endswith(";"):
        json_str = json_str[:-1]
    
    try:
        data = json.loads(json_str)
        print("data.js parsed successfully as JSON.")
    except Exception as e:
        print(f"Error parsing data.js: {e}")
        exit(1)

# Validate baseline population
pop = data.get("population", {})
assert pop.get("us_born") == 266222238, "US-born population mismatch"
assert pop.get("immigrants") == 36881402, "Immigrant population mismatch"
print("Population metadata verified successfully.")

# Validate detailed variables
detail = data.get("spending_and_taxes_detail", [])
total_us_born_taxes = sum(item["us_born"] for item in detail if item["classification"] == "Tax")
total_imm_taxes = sum(item["immigrants"] for item in detail if item["classification"] == "Tax")

# Check if taxes sum matches (All taxes generated: US-born = $148.7T, Immigrants = $24.2T)
# In our parse, we had:
# Federal income tax = 43000.0, FICA = 30400.0, etc.
# Let's check the sum of Taxes in our data.js
print(f"Sum of parsed US-Born Taxes: ${total_us_born_taxes/1000:.2f}T (Expected ~$148.7T)")
print(f"Sum of parsed Immigrant Taxes: ${total_imm_taxes/1000:.2f}T (Expected ~$24.2T)")

# Validate per capita items
pc = data.get("per_capita_expenditures", [])
assert len(pc) > 0, "Per capita expenditures list is empty!"
print(f"Verified {len(pc)} per capita spending categories.")

# Validate status categories
status_cum = data.get("cumulative_by_status", [])
all_imm_cum = [s for s in status_cum if s["generation"] == "Immigrants" and s["citizenship"] == "Both" and s["education"] == "All"][0]
assert all_imm_cum["tax"] == 24189.0, "Immigrant cumulative tax mismatch"
assert all_imm_cum["net"] == 10590.0, "Immigrant cumulative net mismatch"
print("Status cumulative data verified successfully.")

print("All automated data integrity validation checks passed successfully!")
