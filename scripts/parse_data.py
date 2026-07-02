import re
import json
import os

def clean_val(val_str):
    # Standardize minus sign and strip formatting
    val_str = val_str.replace('−', '-').replace('–', '-').replace('$', '').replace(',', '').strip()
    if not val_str:
        return 0.0
    factor = 1.0
    if val_str.endswith('T'):
        factor = 1000.0  # Convert Trillions to Billions
        val_str = val_str[:-1]
    elif val_str.endswith('B'):
        factor = 1.0     # Already in Billions
        val_str = val_str[:-1]
    elif val_str.endswith('M'):
        factor = 0.001   # Convert Millions to Billions
        val_str = val_str[:-1]
    
    try:
        return float(val_str) * factor
    except ValueError:
        return 0.0

def parse_table_a4():
    # Read table_a4_raw.txt
    lines = []
    with open('../../table_a4_raw.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    items = []
    population = {}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Match population line
        if line.startswith("Population"):
            parts = line.split()
            population['us_born'] = int(parts[1].replace(',', ''))
            population['immigrants'] = int(parts[2].replace(',', ''))
            continue
            
        # Matches name, classification, and values
        # e.g., "Federal income tax Tax $43.0T $6.3T"
        # e.g., "Indirect property taxes Tax -$1.0T $1.0T"
        # Match using regex: (Name) (Classification) (US-born-val) (Immigrant-val)
        # Note: Name can have spaces, classification is one word (Tax, OldAge, Needs, Prisons, Education, Other, PurePublic, Total)
        # Values can be negative: e.g. -$1.0T or -$1.0T, or $0.0 or $212.3M
        # Regex pattern:
        pattern = r'^(.+?)\s+(Tax|OldAge|Needs|Prisons|Education|Other|PurePublic|Total)\s+([−\-]?\$?\d+\.?\d*[TBM]?)\s+([−\-]?\$?\d+\.?\d*[TBM]?)$'
        match = re.match(pattern, line)
        if match:
            name = match.group(1).strip()
            classification = match.group(2).strip()
            us_val = clean_val(match.group(3))
            imm_val = clean_val(match.group(4))
            
            # Skip overall totals from detailed list to avoid double counting
            if name in ["All taxes generated", "Total spending", "Total net"]:
                continue
                
            items.append({
                "name": name,
                "classification": classification,
                "us_born": us_val,
                "immigrants": imm_val
            })
            
    return items, population

def parse_table_3():
    # Per Capita Expenditures, 1994-2023
    # Reads Table 3 raw from all_tables_raw.txt
    # Table 3 matches lines 163-184:
    # e.g., "Social Security $94,077 $62,059 –$32,017"
    with open('../../all_tables_raw.txt', 'r', encoding='utf-8') as f:
        content = f.read()
        
    table_section = re.search(r'Table 3.*?Category\s+US-born\s+natives\s+Immigrants\s+Difference', content, re.DOTALL)
    if not table_section:
        # Try finding table 3 text lines directly
        table_section_match = re.search(r'Table 3.*?\n(.*?)Category US-born natives', content, re.DOTALL)
        if table_section_match:
            table_text = table_section_match.group(1)
        else:
            table_text = ""
    else:
        table_text = table_section.group(0)
        
    items = []
    lines = table_text.split('\n')
    for line in lines:
        line = line.strip()
        # Skip headers or notes
        if "Table 3" in line or "US-born" in line or "Category" in line or "Sources" in line or "Note" in line:
            continue
        # Format: Name $XX,XXX $YY,YYY [+-]$ZZ,ZZZ
        # e.g. "Social Security $94,077 $62,059 –$32,017"
        # We can extract the name (preceding the first $) and the values
        pattern = r'^([A-Za-z\s’,/()\'\-]+?)\s+([−\-]?\$?\d+,?\d*)\s+([−\-]?\$?\d+,?\d*)\s+([−\-]?\$?\d+,?\d*)'
        match = re.match(pattern, line)
        if match:
            name = match.group(1).strip()
            # Skip cumulative and totals (we want the detailed items)
            if "Total" in name or "cumulative" in name:
                continue
            us_val = float(match.group(2).replace('−', '-').replace('–', '-').replace('$', '').replace(',', '').strip())
            imm_val = float(match.group(3).replace('−', '-').replace('–', '-').replace('$', '').replace(',', '').strip())
            items.append({
                "name": name,
                "us_born": us_val,
                "immigrants": imm_val
            })
    return items

def parse_table_a5_and_a6():
    # Table A5 (Cumulative 1994-2023) and Table A6 (2022-2023 Average)
    # We will write these records manually into the JSON as they are structured hierarchical data
    # that is easier to represent directly from what we read in the PDF
    
    # Cumulative Data (Table A5) in Billions
    # Columns: Tax, Net, PerCap, GDP, Net/GDP, AddSpend
    cumulative = [
        # US-born
        {"generation": "US-born", "citizenship": "Citizen", "education": "All", "tax": 148715.0, "net": -44354.0, "per_capita": -166605.0, "gdp": 530890.0, "net_gdp_pct": -8.4},
        
        # Immigrants (All)
        {"generation": "Immigrants", "citizenship": "Both", "education": "All", "tax": 24189.0, "net": 10590.0, "per_capita": 287150.0, "gdp": 83544.0, "net_gdp_pct": 12.7},
        {"generation": "Immigrants", "citizenship": "Both", "education": "No high school", "tax": 3141.0, "net": -643.0, "per_capita": -67316.0, "gdp": 10877.0, "net_gdp_pct": -5.9},
        {"generation": "Immigrants", "citizenship": "Both", "education": "High school", "tax": 4461.0, "net": 933.0, "per_capita": 98876.0, "gdp": 14668.0, "net_gdp_pct": 6.4},
        {"generation": "Immigrants", "citizenship": "Both", "education": "Some college", "tax": 3899.0, "net": 1471.0, "per_capita": 223007.0, "gdp": 12449.0, "net_gdp_pct": 11.8},
        {"generation": "Immigrants", "citizenship": "Both", "education": "Bachelor's degree", "tax": 6378.0, "net": 3859.0, "per_capita": 527028.0, "gdp": 21727.0, "net_gdp_pct": 17.8},
        {"generation": "Immigrants", "citizenship": "Both", "education": "Advanced", "tax": 6310.0, "net": 4970.0, "per_capita": 1253586.0, "gdp": 23824.0, "net_gdp_pct": 20.9},
        {"generation": "Immigrants", "citizenship": "Both", "education": "No bachelor's degree", "tax": 11502.0, "net": 1761.0, "per_capita": 68806.0, "gdp": 37994.0, "net_gdp_pct": 4.6},
        {"generation": "Immigrants", "citizenship": "Both", "education": "More than a bachelor's degree", "tax": 12688.0, "net": 8830.0, "per_capita": 782228.0, "gdp": 45550.0, "net_gdp_pct": 19.4},
        
        # Naturalized Citizens
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "All", "tax": 13420.0, "net": 6002.0, "per_capita": 380337.0, "gdp": 45599.0, "net_gdp_pct": 13.2},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "No high school", "tax": 1009.0, "net": -625.0, "per_capita": -227825.0, "gdp": 3127.0, "net_gdp_pct": -20.0},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "High school", "tax": 2239.0, "net": 339.0, "per_capita": 86139.0, "gdp": 7027.0, "net_gdp_pct": 4.8},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "Some college", "tax": 2390.0, "net": 970.0, "per_capita": 296946.0, "gdp": 7662.0, "net_gdp_pct": 12.7},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "Bachelor's degree", "tax": 3917.0, "net": 2382.0, "per_capita": 639202.0, "gdp": 13325.0, "net_gdp_pct": 17.9},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "Advanced", "tax": 3865.0, "net": 2937.0, "per_capita": 1394622.0, "gdp": 14459.0, "net_gdp_pct": 20.3},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "No bachelor's degree", "tax": 5637.0, "net": 684.0, "per_capita": 68732.0, "gdp": 17816.0, "net_gdp_pct": 3.8},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "More than a bachelor's degree", "tax": 7782.0, "net": 5318.0, "per_capita": 911977.0, "gdp": 27783.0, "net_gdp_pct": 19.1},
        
        # Noncitizens (All - contains both legal visa and undocumented)
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "All", "tax": 10770.0, "net": 4589.0, "per_capita": 217459.0, "gdp": 37946.0, "net_gdp_pct": 12.1},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "No high school", "tax": 2132.0, "net": -18.0, "per_capita": -2643.0, "gdp": 7750.0, "net_gdp_pct": -0.2},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "High school", "tax": 2223.0, "net": 594.0, "per_capita": 107990.0, "gdp": 7641.0, "net_gdp_pct": 7.8},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "Some college", "tax": 1509.0, "net": 501.0, "per_capita": 150466.0, "gdp": 4788.0, "net_gdp_pct": 10.5},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "Bachelor's degree", "tax": 2461.0, "net": 1478.0, "per_capita": 410844.0, "gdp": 8402.0, "net_gdp_pct": 17.6},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "Advanced", "tax": 2445.0, "net": 2034.0, "per_capita": 1093841.0, "gdp": 9365.0, "net_gdp_pct": 21.7},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "No bachelor's degree", "tax": 5864.0, "net": 1077.0, "per_capita": 68853.0, "gdp": 20179.0, "net_gdp_pct": 5.3},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "More than a bachelor's degree", "tax": 4906.0, "net": 3511.0, "per_capita": 643557.0, "gdp": 17767.0, "net_gdp_pct": 19.8},
        
        # Illegal Immigrants (estimated, All)
        {"generation": "Immigrants", "citizenship": "Illegal", "education": "All", "tax": 3017.0, "net": 1687.0, "per_capita": 190284.0, "gdp": 15965.0, "net_gdp_pct": 10.6},
        
        # Legal Noncitizens (computed: Noncitizen - Illegal)
        {"generation": "Immigrants", "citizenship": "Legal Noncitizen", "education": "All", "tax": 10770.0 - 3017.0, "net": 4589.0 - 1687.0, "per_capita": 236200.0, "gdp": 37946.0 - 15965.0, "net_gdp_pct": 13.2},
        
        # Second Generation (Citizen All)
        {"generation": "Second Gen", "citizenship": "Citizen", "education": "All", "tax": 10319.0, "net": -4728.0, "per_capita": -178953.0, "gdp": 35851.0, "net_gdp_pct": -13.2},
        
        # Third Generation+ (Citizen All)
        {"generation": "Third Gen+", "citizenship": "Citizen", "education": "All", "tax": 138396.0, "net": -39626.0, "per_capita": -165245.0, "gdp": 495040.0, "net_gdp_pct": -8.0}
    ]
    
    # 2022-2023 Average (Table A6) in Billions
    recent = [
        {"generation": "US-born", "citizenship": "Citizen", "education": "All", "tax": 6716.0, "net": -2092.0, "per_capita": -7317.0, "gdp": 23510.0, "net_gdp_pct": -8.9},
        
        {"generation": "Immigrants", "citizenship": "Both", "education": "All", "tax": 1355.0, "net": 590.0, "per_capita": 12248.0, "gdp": 4737.0, "net_gdp_pct": 12.4},
        {"generation": "Immigrants", "citizenship": "Both", "education": "No high school", "tax": 133.0, "net": -38.0, "per_capita": -3927.0, "gdp": 468.0, "net_gdp_pct": -8.1},
        {"generation": "Immigrants", "citizenship": "Both", "education": "High school", "tax": 225.0, "net": 22.0, "per_capita": 1770.0, "gdp": 767.0, "net_gdp_pct": 2.9},
        {"generation": "Immigrants", "citizenship": "Both", "education": "Some college", "tax": 174.0, "net": 39.0, "per_capita": 4863.0, "gdp": 571.0, "net_gdp_pct": 6.9},
        {"generation": "Immigrants", "citizenship": "Both", "education": "Bachelor's degree", "tax": 373.0, "net": 214.0, "per_capita": 19844.0, "gdp": 1291.0, "net_gdp_pct": 16.6},
        {"generation": "Immigrants", "citizenship": "Both", "education": "Advanced", "tax": 450.0, "net": 352.0, "per_capita": 50084.0, "gdp": 1639.0, "net_gdp_pct": 21.5},
        {"generation": "Immigrants", "citizenship": "Both", "education": "No bachelor's degree", "tax": 532.0, "net": 24.0, "per_capita": 779.0, "gdp": 1806.0, "net_gdp_pct": 1.3},
        {"generation": "Immigrants", "citizenship": "Both", "education": "More than a bachelor's degree", "tax": 824.0, "net": 566.0, "per_capita": 31768.0, "gdp": 2930.0, "net_gdp_pct": 19.3},
        
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "All", "tax": 784.0, "net": 318.0, "per_capita": 13503.0, "gdp": 2687.0, "net_gdp_pct": 11.8},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "No high school", "tax": 42.0, "net": -38.0, "per_capita": -11978.0, "gdp": 134.0, "net_gdp_pct": -28.2},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "High school", "tax": 121.0, "net": 3.0, "per_capita": 482.0, "gdp": 384.0, "net_gdp_pct": 0.7},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "Some college", "tax": 115.0, "net": 26.0, "per_capita": 5862.0, "gdp": 378.0, "net_gdp_pct": 7.0},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "Bachelor's degree", "tax": 239.0, "net": 130.0, "per_capita": 21391.0, "gdp": 833.0, "net_gdp_pct": 15.6},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "Advanced", "tax": 267.0, "net": 196.0, "per_capita": 50641.0, "gdp": 959.0, "net_gdp_pct": 20.5},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "No bachelor's degree", "tax": 278.0, "net": -8.0, "per_capita": -618.0, "gdp": 895.0, "net_gdp_pct": -0.9},
        {"generation": "Immigrants", "citizenship": "Naturalized", "education": "More than a bachelor's degree", "tax": 506.0, "net": 327.0, "per_capita": 32783.0, "gdp": 1792.0, "net_gdp_pct": 18.2},
        
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "All", "tax": 572.0, "net": 272.0, "per_capita": 11045.0, "gdp": 2049.0, "net_gdp_pct": 13.3},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "No high school", "tax": 91.0, "net": -0.0, "per_capita": -36.0, "gdp": 335.0, "net_gdp_pct": -0.1},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "High school", "tax": 104.0, "net": 19.0, "per_capita": 2920.0, "gdp": 384.0, "net_gdp_pct": 5.1},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "Some college", "tax": 59.0, "net": 13.0, "per_capita": 3598.0, "gdp": 193.0, "net_gdp_pct": 6.6},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "Bachelor's degree", "tax": 135.0, "net": 84.0, "per_capita": 17847.0, "gdp": 458.0, "net_gdp_pct": 18.4},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "Advanced", "tax": 183.0, "net": 155.0, "per_capita": 49398.0, "gdp": 680.0, "net_gdp_pct": 22.9},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "No bachelor's degree", "tax": 254.0, "net": 32.0, "per_capita": 1914.0, "gdp": 911.0, "net_gdp_pct": 3.5},
        {"generation": "Immigrants", "citizenship": "Noncitizen", "education": "More than a bachelor's degree", "tax": 318.0, "net": 240.0, "per_capita": 30482.0, "gdp": 1138.0, "net_gdp_pct": 21.1},
        
        {"generation": "Immigrants", "citizenship": "Illegal", "education": "All", "tax": 161.0, "net": 104.0, "per_capita": 9892.0, "gdp": 773.0, "net_gdp_pct": 13.4},
        
        {"generation": "Immigrants", "citizenship": "Legal Noncitizen", "education": "All", "tax": 572.0 - 161.0, "net": 272.0 - 104.0, "per_capita": 11500.0, "gdp": 2049.0 - 773.0, "net_gdp_pct": 13.2},
        
        {"generation": "Second Gen", "citizenship": "Citizen", "education": "All", "tax": 574.0, "net": -127.0, "per_capita": -3845.0, "gdp": 2125.0, "net_gdp_pct": -6.0},
        {"generation": "Third Gen+", "citizenship": "Citizen", "education": "All", "tax": 6142.0, "net": -1965.0, "per_capita": -7771.0, "gdp": 21385.0, "net_gdp_pct": -9.2}
    ]
    
    return cumulative, recent

def main():
    print("Parsing table data...")
    a4_items, population = parse_table_a4()
    t3_items = parse_table_3()
    cumulative_items, recent_items = parse_table_a5_and_a6()
    
    # Save as Javascript file data.js
    data = {
        "population": population,
        "spending_and_taxes_detail": a4_items,
        "per_capita_expenditures": t3_items,
        "cumulative_by_status": cumulative_items,
        "recent_by_status": recent_items
    }
    
    os.makedirs("../", exist_ok=True)
    with open("../data.js", "w", encoding='utf-8') as f:
        f.write("const CATO_STUDY_DATA = ")
        json.dump(data, f, indent=2)
        f.write(";\n")
        
    print("Successfully wrote data.js")

if __name__ == '__main__':
    main()
