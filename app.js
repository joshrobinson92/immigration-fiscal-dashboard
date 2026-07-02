// Immigrant Fiscal Impact Dashboard JS Logic

// State management
let state = {
    fixedCostsToggled: false, // false = Cato marginal ($0), true = NASEM average
    defenseShare: 100, // 0-100%
    childAttribution: 'cato', // 'cato', 'cis', 'full'
    taxCompliance: 60, // 0-100%
    propertyTaxToggled: true, // true = include housing effect, false = exclude
    activeTab: 'tab-overview',
    categoryFilter: 'all',
    
    // Included Cost Buckets state (checkboxes)
    costK12: true,
    costOldAge: true,
    costWelfare: true,
    costCongestible: true,
    costPrisons: true,
    costHigherEd: true
};

// Global Chart instances
let charts = {};

// Population estimates (annualized equivalents in millions over 30 years)
const POPULATIONS = {
    us_born: 266.22,
    all_immigrants: 36.88,
    naturalized: 15.78,
    noncitizen: 21.10,
    illegal: 8.86,
    legal_noncitizen: 12.24
};

// Interest rate factor (to simulate interest savings adjustments)
const INTEREST_SAVINGS_RATIO = 0.366; // interest saved is ~36.6% of net fiscal surplus

// Document Elements
document.addEventListener("DOMContentLoaded", () => {
    initEventListeners();
    runSimulation();
    initOverviewChart();
    renderVariablesTable();
    renderStatusTable();
    initRawDataViewer();
});

function initEventListeners() {
    // Fixed Costs Toggle
    const fixedCostsToggle = document.getElementById("toggle-fixed-costs");
    const defenseContainer = document.getElementById("defense-share-container");
    const defenseSlider = document.getElementById("defense-share-slider");
    const defenseShareVal = document.getElementById("defense-share-val");
    const fixedCostsLabel = document.getElementById("fixed-costs-label");
    
    fixedCostsToggle.addEventListener("change", (e) => {
        state.fixedCostsToggled = e.target.checked;
        if (state.fixedCostsToggled) {
            defenseContainer.style.display = "block";
            fixedCostsLabel.innerText = "Average Cost (Pro-rata Defense/Debt)";
        } else {
            defenseContainer.style.display = "none";
            fixedCostsLabel.innerText = "Marginal Cost ($0 Defense/Debt)";
        }
        runSimulation();
    });
    
    defenseSlider.addEventListener("input", (e) => {
        state.defenseShare = parseInt(e.target.value);
        defenseShareVal.innerText = state.defenseShare + "%";
        runSimulation();
    });

    // Checkboxes for cost buckets
    const costK12Cb = document.getElementById("cost-k12");
    const costOldAgeCb = document.getElementById("cost-oldage");
    const costWelfareCb = document.getElementById("cost-welfare");
    const costCongestibleCb = document.getElementById("cost-congestible");
    const costPrisonsCb = document.getElementById("cost-prisons");
    const costHigherEdCb = document.getElementById("cost-highered");

    costK12Cb.addEventListener("change", (e) => { state.costK12 = e.target.checked; runSimulation(); });
    costOldAgeCb.addEventListener("change", (e) => { state.costOldAge = e.target.checked; runSimulation(); });
    costWelfareCb.addEventListener("change", (e) => { state.costWelfare = e.target.checked; runSimulation(); });
    costCongestibleCb.addEventListener("change", (e) => { state.costCongestible = e.target.checked; runSimulation(); });
    costPrisonsCb.addEventListener("change", (e) => { state.costPrisons = e.target.checked; runSimulation(); });
    costHigherEdCb.addEventListener("change", (e) => { state.costHigherEd = e.target.checked; runSimulation(); });

    // Child Attribution Radio buttons
    const childRadios = document.getElementsByName("child-attribution");
    childRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            state.childAttribution = e.target.value;
            runSimulation();
        });
    });

    // Tax Compliance Slider
    const complianceSlider = document.getElementById("tax-compliance-slider");
    const complianceVal = document.getElementById("tax-compliance-val");
    complianceSlider.addEventListener("input", (e) => {
        state.taxCompliance = parseInt(e.target.value);
        complianceVal.innerText = state.taxCompliance + "%";
        runSimulation();
    });

    // Property Tax Toggle
    const propertyToggle = document.getElementById("toggle-property-tax");
    const propertyLabel = document.getElementById("property-tax-label");
    propertyToggle.addEventListener("change", (e) => {
        state.propertyTaxToggled = e.target.checked;
        if (state.propertyTaxToggled) {
            propertyLabel.innerText = "Include Housing Effect";
        } else {
            propertyLabel.innerText = "Exclude Housing Effect";
        }
        runSimulation();
    });

    // Category filter for table
    const categorySelect = document.getElementById("select-category-filter");
    categorySelect.addEventListener("change", (e) => {
        state.categoryFilter = e.target.value;
        renderVariablesTable();
    });

    // Reset button
    const btnReset = document.getElementById("btn-reset-simulator");
    btnReset.addEventListener("click", () => {
        fixedCostsToggle.checked = false;
        defenseContainer.style.display = "none";
        fixedCostsLabel.innerText = "Marginal Cost ($0 Defense/Debt)";
        state.fixedCostsToggled = false;
        state.defenseShare = 100;
        defenseSlider.value = 100;
        defenseShareVal.innerText = "100%";

        costK12Cb.checked = true;
        state.costK12 = true;
        costOldAgeCb.checked = true;
        state.costOldAge = true;
        costWelfareCb.checked = true;
        state.costWelfare = true;
        costCongestibleCb.checked = true;
        state.costCongestible = true;
        costPrisonsCb.checked = true;
        state.costPrisons = true;
        costHigherEdCb.checked = true;
        state.costHigherEd = true;

        document.getElementById("radio-child-cato").checked = true;
        state.childAttribution = 'cato';

        complianceSlider.value = 60;
        complianceVal.innerText = "60%";
        state.taxCompliance = 60;

        propertyToggle.checked = true;
        propertyLabel.innerText = "Include Housing Effect";
        state.propertyTaxToggled = true;

        runSimulation();
    });
}

// Tab Switching
window.openTab = function(evt, tabId) {
    const tabcontents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontents.length; i++) {
        tabcontents[i].classList.remove("active");
    }

    const tablinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }

    document.getElementById(tabId).classList.add("active");
    evt.currentTarget.classList.add("active");
    state.activeTab = tabId;

    // Trigger chart renders for specific tabs to ensure correct animation
    if (tabId === 'tab-status') {
        initStatusCharts();
    } else if (tabId === 'tab-breakdown') {
        initBreakdownCharts();
    } else if (tabId === 'tab-overview') {
        initOverviewChart();
    }
};

// Simulation Engine
function runSimulation() {
    let detail = CATO_STUDY_DATA.spending_and_taxes_detail;

    // Running tax and spend sums for each group (in Billions)
    let taxNatives = 0.0;
    let spendNatives = 0.0;

    let taxNaturalized = 0.0;
    let spendNaturalized = 0.0;

    let taxLegalNoncitizen = 0.0;
    let spendLegalNoncitizen = 0.0;

    let taxIllegal = 0.0;
    let spendIllegal = 0.0;

    // Calculate baseline totals for ratio scaling
    const baseTotalImmigrantSpend = 13580.0; // Cumulative spending on immigrants in Cato study baseline

    // We'll also sum up pure public goods separately to handle the toggle
    let totalPurePublicGoods = 0.0;

    detail.forEach(item => {
        let name = item.name;
        let classification = item.classification;
        let us_born = item.us_born;
        let immigrants = item.immigrants;

        // Apply property tax toggle directly
        if (name === "Indirect property taxes" && !state.propertyTaxToggled) {
            us_born = 0.0;
            immigrants = 0.0;
        }

        // Determine if this spending item is active
        let active = false;
        if (classification === 'Tax') {
            active = true; // Taxes are always active
        } else if (classification === 'OldAge') {
            active = state.costOldAge;
        } else if (classification === 'Needs') {
            active = state.costWelfare;
        } else if (classification === 'Prisons') {
            active = state.costPrisons;
        } else if (classification === 'Other') {
            active = state.costCongestible;
        } else if (classification === 'PurePublic') {
            active = false; // Handled separately by NASEM pro-rata toggle
            totalPurePublicGoods += (us_born + immigrants);
        } else if (classification === 'Education') {
            if (name === "State/local public college") {
                active = state.costHigherEd;
            } else {
                // Elementary, high school, bilingual
                active = state.costK12;
            }
        }

        if (!active && classification !== 'Tax') {
            // If item is a spending item and not active, ignore it
            return;
        }

        // Apply native values
        if (classification === 'Tax') {
            taxNatives += us_born;
        } else {
            spendNatives += us_born;
        }

        // Split immigrant values into Naturalized, Legal Noncitizen, and Undocumented
        // Define Noncitizen share of the immigrant total
        let noncitizenShare = 0.572; // Default population pro-rata
        if (classification === 'OldAge') {
            noncitizenShare = 0.20; // Noncitizens are much younger
        } else if (classification === 'Needs') {
            noncitizenShare = 0.55; // Noncitizens are lower income
        } else if (classification === 'Education') {
            if (name === "State/local public college") {
                noncitizenShare = 0.65;
            } else {
                noncitizenShare = 0.60;
            }
        } else if (classification === 'Tax') {
            noncitizenShare = 0.445; // Noncitizens pay less taxes
        }

        let naturalizedVal = immigrants * (1.0 - noncitizenShare);
        let noncitizenVal = immigrants * noncitizenShare;

        // Partition noncitizens into Legal Noncitizen and Undocumented (Illegal)
        let undocVal = 0.0;
        let legalNoncitizenVal = 0.0;

        if (classification === 'Tax') {
            // Undocumented tax compliance adjustment
            let isComplianceTax = ["Federal income tax", "Federal FICA", "Federal supplemental medical insurance", "Federal unemployment contribution", "State/local income tax"].includes(name);
            if (isComplianceTax) {
                // Undocumented pay 67% of noncitizen rate, scaled by state.taxCompliance relative to baseline 60%
                let undocTaxShare = (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.67 * (state.taxCompliance / 60.0);
                undocVal = noncitizenVal * undocTaxShare;
            } else {
                // Corporate, sales, property: pay 88.6% of noncitizen rate
                let undocTaxShare = (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.886;
                undocVal = noncitizenVal * undocTaxShare;
            }
            legalNoncitizenVal = noncitizenVal - undocVal;
            
            taxNaturalized += naturalizedVal;
            taxLegalNoncitizen += legalNoncitizenVal;
            taxIllegal += undocVal;
        } else {
            // Spending items
            if (classification === 'OldAge') {
                // Undocumented are ineligible (Medicare, OASDI): 5% per-capita
                let undocSpendShare = (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.05;
                undocVal = noncitizenVal * undocSpendShare;
            } else if (classification === 'Needs') {
                // Eligible (School lunch, WIC, workers' comp): 100% per-capita
                let isEligible = ["National School Lunch Program", "State/local WIC benefits", "State/local workers’ compensation"].includes(name);
                let isShelter = ["Federal migrant shelter costs", "State/local migrant shelter costs"].includes(name);
                let isRefugee = ["Federal refugee aid"].includes(name);
                
                if (isEligible) {
                    undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen);
                } else if (isShelter) {
                    // Shelter is 200% per capita
                    undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen) * 2.0;
                } else if (isRefugee) {
                    undocVal = 0.0;
                } else if (name.includes("Medicaid")) {
                    if (name.includes("State") || name.includes("CHIP")) {
                        undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.057;
                    } else {
                        // Federal Medicaid
                        undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.17;
                    }
                } else {
                    // Ineligible: 5% per-capita
                    undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.05;
                }
            } else if (classification === 'Education') {
                // K-12: 100% per capita
                if (name !== "State/local public college") {
                    undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen);
                } else {
                    // College: $0 anyway
                    undocVal = 0.0;
                }
            } else {
                // Prisons, Other: 100% per capita
                undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen);
            }
            
            legalNoncitizenVal = noncitizenVal - undocVal;
            
            spendNaturalized += naturalizedVal;
            spendLegalNoncitizen += legalNoncitizenVal;
            spendIllegal += undocVal;
        }
    });

    // 1. FIXED COSTS / DEFENSE ADJUSTMENT
    // Pure public goods are handled pro-rata if toggle is on
    let fixedCostsNaturalized = 0.0;
    let fixedCostsLegalNoncitizen = 0.0;
    let fixedCostsIllegal = 0.0;
    let fixedCostsNatives = 0.0;

    if (state.fixedCostsToggled) {
        let activeDefenseCost = totalPurePublicGoods * (state.defenseShare / 100.0);
        let immShare = POPULATIONS.all_immigrants / (POPULATIONS.us_born + POPULATIONS.all_immigrants);
        let totalImmigrantCost = activeDefenseCost * immShare;
        
        fixedCostsNaturalized = totalImmigrantCost * (POPULATIONS.naturalized / POPULATIONS.all_immigrants);
        fixedCostsIllegal = totalImmigrantCost * (POPULATIONS.illegal / POPULATIONS.all_immigrants);
        fixedCostsLegalNoncitizen = totalImmigrantCost * (POPULATIONS.legal_noncitizen / POPULATIONS.all_immigrants);
        
        // Native pure public goods spending is total minus what is allocated to immigrants
        fixedCostsNatives = activeDefenseCost - totalImmigrantCost;
    }

    // Add pure public goods to spending if checked (toggled on)
    spendNaturalized += fixedCostsNaturalized;
    spendLegalNoncitizen += fixedCostsLegalNoncitizen;
    spendIllegal += fixedCostsIllegal;
    spendNatives += fixedCostsNatives;

    // 2. CHILD COST ATTRIBUTION ADJUSTMENT
    let totalImmigrantSpendActive = spendNaturalized + spendLegalNoncitizen + spendIllegal - (fixedCostsNaturalized + fixedCostsLegalNoncitizen + fixedCostsIllegal);
    let activeSpendingRatio = totalImmigrantSpendActive / baseTotalImmigrantSpend;

    let childAttNaturalized = 0.0;
    let childAttLegalNoncitizen = 0.0;
    let childAttIllegal = 0.0;
    let childAttNatives = 0.0;

    if (state.childAttribution === 'cis') {
        const childCostsToParents = 3500.0 * activeSpendingRatio;
        childAttNaturalized = childCostsToParents * 0.45;
        childAttLegalNoncitizen = childCostsToParents * 0.40;
        childAttIllegal = childCostsToParents * 0.15;
        
        // Native spending decreases since these child costs are moved to immigrants
        childAttNatives = -childCostsToParents;
    } else if (state.childAttribution === 'full') {
        const totalSecondGenNet = -4728.0 * activeSpendingRatio;
        childAttNaturalized = -totalSecondGenNet * 0.45;
        childAttLegalNoncitizen = -totalSecondGenNet * 0.40;
        childAttIllegal = -totalSecondGenNet * 0.15;
        
        childAttNatives = totalSecondGenNet;
    }

    // Add child attribution to spending totals
    spendNaturalized += childAttNaturalized;
    spendLegalNoncitizen += childAttLegalNoncitizen;
    spendIllegal += childAttIllegal;
    spendNatives += childAttNatives;

    // CALCULATE NET FLOWS
    let simNaturalizedNetFlow = taxNaturalized - spendNaturalized;
    let simIllegalNetFlow = taxIllegal - spendIllegal;
    let simLegalNoncitizenNetFlow = taxLegalNoncitizen - spendLegalNoncitizen;
    let simNativesNetFlow = taxNatives - spendNatives;

    // Calculate Interest Savings (36.6% of net surplus if positive)
    let simNaturalizedInterest = Math.max(0.0, simNaturalizedNetFlow * INTEREST_SAVINGS_RATIO);
    let simIllegalInterest = Math.max(0.0, simIllegalNetFlow * INTEREST_SAVINGS_RATIO);
    let simLegalNoncitizenInterest = Math.max(0.0, simLegalNoncitizenNetFlow * INTEREST_SAVINGS_RATIO);
    let simAllImmigrantsInterest = simNaturalizedInterest + simLegalNoncitizenInterest + simIllegalInterest;

    // Final Net Impacts (with interest savings)
    let finalNaturalizedNet = simNaturalizedNetFlow + simNaturalizedInterest;
    let finalIllegalNet = simIllegalNetFlow + simIllegalInterest;
    let finalLegalNoncitizenNet = simLegalNoncitizenNetFlow + simLegalNoncitizenInterest;
    let finalAllImmigrantsNet = (simNaturalizedNetFlow + simLegalNoncitizenNetFlow + simIllegalNetFlow) + simAllImmigrantsInterest;
    let finalNativesNet = simNativesNetFlow; // Natives do not save interest in the model

    // Per capita calculations
    let pcNaturalized = (finalNaturalizedNet * 1e9) / (POPULATIONS.naturalized * 1e6);
    let pcIllegal = (finalIllegalNet * 1e9) / (POPULATIONS.illegal * 1e6);
    let pcLegalNoncitizen = (finalLegalNoncitizenNet * 1e9) / (POPULATIONS.legal_noncitizen * 1e6);
    let pcAllImmigrants = (finalAllImmigrantsNet * 1e9) / (POPULATIONS.all_immigrants * 1e6);

    let nativePop = POPULATIONS.us_born;
    if (state.childAttribution === 'full') {
        nativePop = POPULATIONS.us_born - 26.42;
    }
    let pcNatives = (finalNativesNet * 1e9) / (nativePop * 1e6);

    // UPDATE DOM PANELS
    updatePanel("val-net-naturalized", "sub-net-naturalized", finalNaturalizedNet, pcNaturalized);
    updatePanel("val-net-temporary", "sub-net-temporary", finalLegalNoncitizenNet, pcLegalNoncitizen);
    updatePanel("val-net-undocumented", "sub-net-undocumented", finalIllegalNet, pcIllegal);
    updatePanel("val-net-all", "sub-net-all", finalAllImmigrantsNet, pcAllImmigrants);
    updatePanel("val-net-natives", "sub-net-natives", finalNativesNet, pcNatives);

    // Save simulation outputs for chart functions
    state.simulatedData = {
        naturalized: finalNaturalizedNet,
        legal_noncitizen: finalLegalNoncitizenNet,
        illegal: finalIllegalNet,
        all_immigrants: finalAllImmigrantsNet,
        natives: finalNativesNet,
        pc_naturalized: pcNaturalized,
        pc_legal_noncitizen: pcLegalNoncitizen,
        pc_illegal: pcIllegal,
        pc_all_immigrants: pcAllImmigrants,
        pc_natives: pcNatives,
        
        // Raw values (without interest) for charts
        raw_naturalized_tax: taxNaturalized,
        raw_illegal_tax: taxIllegal,
        raw_legal_noncitizen_tax: taxLegalNoncitizen,
        
        raw_naturalized_spend: spendNaturalized,
        raw_illegal_spend: spendIllegal,
        raw_legal_noncitizen_spend: spendLegalNoncitizen
    };

    // Update charts dynamically if visible
    if (state.activeTab === 'tab-overview') {
        updateOverviewChart();
    } else if (state.activeTab === 'tab-status') {
        updateStatusCharts();
    }
}

function updatePanel(valId, subId, valB, perCap) {
    const valEl = document.getElementById(valId);
    const subEl = document.getElementById(subId);
    
    // Format Net Billions/Trillions
    let sign = valB >= 0 ? "+" : "-";
    let absVal = Math.abs(valB);
    let valStr = "";
    if (absVal >= 1000.0) {
        valStr = sign + "$" + (absVal / 1000.0).toFixed(2) + "T";
    } else {
        valStr = sign + "$" + absVal.toFixed(1) + "B";
    }
    
    valEl.innerText = valStr;
    if (valB < 0) {
        valEl.classList.add("negative");
    } else {
        valEl.classList.remove("negative");
    }

    // Format Per Capita
    let pcSign = perCap >= 0 ? "+" : "-";
    let pcAbs = Math.abs(perCap);
    subEl.innerText = pcSign + "$" + pcAbs.toLocaleString(undefined, {maximumFractionDigits: 0}) + " per capita";
    if (perCap < 0) {
        subEl.classList.add("negative");
    } else {
        subEl.classList.remove("negative");
    }
}

// Chart Renderings
function initOverviewChart() {
    const ctx = document.getElementById('chart-overview-comparison').getContext('2d');
    if (charts.overview) {
        charts.overview.destroy();
    }

    // Get current state values
    let immTaxes = 24189.0; // Immigrant cumulative taxes
    let immSpend = 13600.0; // Immigrant cumulative spending
    
    let nativeTaxes = 148715.0; // Natives cumulative taxes
    let nativeSpend = 193069.0; // Natives cumulative spending

    charts.overview = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['All US-Born Natives', 'All Immigrants'],
            datasets: [
                {
                    label: 'Taxes Paid',
                    data: [nativeTaxes, immTaxes],
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Spending & Benefits',
                    data: [nativeSpend, immSpend],
                    backgroundColor: '#ef4444',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: {
                        color: '#9ca3af',
                        callback: function(value) { return '$' + (value / 1000).toFixed(0) + 'T'; }
                    },
                    title: { display: true, text: 'Cumulative Dollars (Trillions)', color: '#9ca3af' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f3f4f6' } }
            }
        }
    });
}

function updateOverviewChart() {
    if (!charts.overview) return;
    
    let immTaxes = state.simulatedData.raw_naturalized_tax + state.simulatedData.raw_legal_noncitizen_tax + state.simulatedData.raw_illegal_tax;
    let immSpend = state.simulatedData.raw_naturalized_spend + state.simulatedData.raw_legal_noncitizen_spend + state.simulatedData.raw_illegal_spend;
    
    // If NASEM pro-rata is enabled, total spend includes defense share
    if (state.fixedCostsToggled) {
        const totalPublicGoods = 59900.0;
        let activeDefenseCost = totalPublicGoods * (state.defenseShare / 100.0);
        let immigrantShare = POPULATIONS.all_immigrants / (POPULATIONS.us_born + POPULATIONS.all_immigrants);
        immSpend += activeDefenseCost * immigrantShare;
    }
    
    charts.overview.data.datasets[0].data[1] = immTaxes;
    charts.overview.data.datasets[1].data[1] = immSpend;
    charts.overview.update();
}

function initStatusCharts() {
    // 1. Per Capita Net Fiscal Impact Chart
    const ctxPC = document.getElementById('chart-status-percapita').getContext('2d');
    if (charts.statusPC) {
        charts.statusPC.destroy();
    }

    charts.statusPC = new Chart(ctxPC, {
        type: 'bar',
        data: {
            labels: ['Natives', 'Naturalized', 'Visa/Temporary', 'Undocumented'],
            datasets: [{
                label: 'Net Per Capita Impact',
                data: [
                    state.simulatedData.pc_natives,
                    state.simulatedData.pc_naturalized,
                    state.simulatedData.pc_legal_noncitizen,
                    state.simulatedData.pc_illegal
                ],
                backgroundColor: function(context) {
                    const val = context.raw;
                    return val >= 0 ? '#10b981' : '#ef4444';
                },
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: {
                        color: '#9ca3af',
                        callback: function(value) { return (value >= 0 ? '+' : '') + '$' + value.toLocaleString(); }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // 2. Cumulative Taxes vs Spending by Status Chart
    const ctxEdu = document.getElementById('chart-status-education').getContext('2d');
    if (charts.statusEdu) {
        charts.statusEdu.destroy();
    }

    charts.statusEdu = new Chart(ctxEdu, {
        type: 'bar',
        data: {
            labels: ['Naturalized', 'Visa/Temporary', 'Undocumented'],
            datasets: [
                {
                    label: 'Taxes Paid',
                    data: [
                        state.simulatedData.raw_naturalized_tax,
                        state.simulatedData.raw_legal_noncitizen_tax,
                        state.simulatedData.raw_illegal_tax
                    ],
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Spending / Benefits',
                    data: [
                        state.simulatedData.raw_naturalized_spend,
                        state.simulatedData.raw_legal_noncitizen_spend,
                        state.simulatedData.raw_illegal_spend
                    ],
                    backgroundColor: '#ef4444',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: {
                        color: '#9ca3af',
                        callback: function(value) { return '$' + value.toFixed(0) + 'B'; }
                    },
                    title: { display: true, text: 'Cumulative Dollars (Billions)', color: '#9ca3af' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f3f4f6' } }
            }
        }
    });
}

function updateStatusCharts() {
    if (!charts.statusPC || !charts.statusEdu) return;

    charts.statusPC.data.datasets[0].data = [
        state.simulatedData.pc_natives,
        state.simulatedData.pc_naturalized,
        state.simulatedData.pc_legal_noncitizen,
        state.simulatedData.pc_illegal
    ];
    charts.statusPC.update();

    charts.statusEdu.data.datasets[0].data = [
        state.simulatedData.raw_naturalized_tax,
        state.simulatedData.raw_legal_noncitizen_tax,
        state.simulatedData.raw_illegal_tax
    ];
    charts.statusEdu.data.datasets[1].data = [
        state.simulatedData.raw_naturalized_spend,
        state.simulatedData.raw_legal_noncitizen_spend,
        state.simulatedData.raw_illegal_spend
    ];
    charts.statusEdu.update();
    
    renderStatusTable();
}

function initBreakdownCharts() {
    // 1. Costs Breakdown Chart (Table 3 per-capita spending)
    const ctxCosts = document.getElementById('chart-costs-breakdown').getContext('2d');
    if (charts.costsBreakdown) {
        charts.costsBreakdown.destroy();
    }

    const t3 = CATO_STUDY_DATA.per_capita_expenditures;
    // Extract key categories for visual chart (skip very small ones)
    const displayCosts = t3.filter(d => ['Social Security', 'Medicare', 'Medicaid/CHIP', 'Education', 'Jail and felony police', 'Congestible public goods'].includes(d.name));
    
    charts.costsBreakdown = new Chart(ctxCosts, {
        type: 'bar',
        data: {
            labels: displayCosts.map(d => d.name),
            datasets: [
                {
                    label: 'US-Born Natives',
                    data: displayCosts.map(d => d.us_born),
                    backgroundColor: 'rgba(99, 102, 241, 0.75)',
                    borderRadius: 6
                },
                {
                    label: 'Immigrants',
                    data: displayCosts.map(d => d.immigrants),
                    backgroundColor: 'rgba(245, 158, 11, 0.75)',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: {
                        color: '#9ca3af',
                        callback: function(value) { return '$' + value.toLocaleString(); }
                    },
                    title: { display: true, text: 'Dollars Per Capita (1994-2023)', color: '#9ca3af' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f3f4f6' } }
            }
        }
    });

    // 2. Taxes Breakdown Chart (Table A4 tax categories)
    const ctxTaxes = document.getElementById('chart-taxes-breakdown').getContext('2d');
    if (charts.taxesBreakdown) {
        charts.taxesBreakdown.destroy();
    }

    const a4 = CATO_STUDY_DATA.spending_and_taxes_detail;
    const taxItems = a4.filter(d => d.classification === 'Tax');
    
    // Group into main buckets: Income Tax, Corporate Tax, FICA/Payroll, Property Tax, Sales/Excise Tax, Nontax/Other
    const groupedTaxes = {
        'Income Tax': { us: 0, imm: 0 },
        'FICA / Payroll': { us: 0, imm: 0 },
        'Sales & Excise': { us: 0, imm: 0 },
        'Property Tax': { us: 0, imm: 0 },
        'Corporate Tax': { us: 0, imm: 0 },
        'Financial & Other': { us: 0, imm: 0 }
    };

    taxItems.forEach(d => {
        if (d.name.includes('income tax')) {
            groupedTaxes['Income Tax'].us += d.us_born;
            groupedTaxes['Income Tax'].imm += d.immigrants;
        } else if (d.name.includes('FICA') || d.name.includes('unemployment')) {
            groupedTaxes['FICA / Payroll'].us += d.us_born;
            groupedTaxes['FICA / Payroll'].imm += d.immigrants;
        } else if (d.name.includes('sales') || d.name.includes('excise')) {
            groupedTaxes['Sales & Excise'].us += d.us_born;
            groupedTaxes['Sales & Excise'].imm += d.immigrants;
        } else if (d.name.includes('property') || d.name.includes('prop_indr')) {
            groupedTaxes['Property Tax'].us += d.us_born;
            groupedTaxes['Property Tax'].imm += d.immigrants;
        } else if (d.name.includes('corporate') || d.name.includes('corptx')) {
            groupedTaxes['Corporate Tax'].us += d.us_born;
            groupedTaxes['Corporate Tax'].imm += d.immigrants;
        } else {
            groupedTaxes['Financial & Other'].us += d.us_born;
            groupedTaxes['Financial & Other'].imm += d.immigrants;
        }
    });

    const taxLabels = Object.keys(groupedTaxes);

    charts.taxesBreakdown = new Chart(ctxTaxes, {
        type: 'bar',
        data: {
            labels: taxLabels,
            datasets: [
                {
                    label: 'US-Born Natives',
                    data: taxLabels.map(l => groupedTaxes[l].us),
                    backgroundColor: '#3b82f6',
                    borderRadius: 6
                },
                {
                    label: 'Immigrants',
                    data: taxLabels.map(l => groupedTaxes[l].imm),
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: {
                        color: '#9ca3af',
                        callback: function(value) { return '$' + value.toFixed(0) + 'B'; }
                    },
                    title: { display: true, text: 'Cumulative Dollars (Billions)', color: '#9ca3af' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f3f4f6' } }
            }
        }
    });
}

// Table Renderings
function renderStatusTable() {
    const tbody = document.getElementById("table-status-body");
    tbody.innerHTML = "";
    
    // Sort out items from simulation state
    const dataList = [
        { name: "Naturalized Citizens", tax: state.simulatedData.raw_naturalized_tax, spend: state.simulatedData.raw_naturalized_spend, net: state.simulatedData.naturalized, pc: state.simulatedData.pc_naturalized, gdp: 380337.0 / 10.0 }, // Approx annual GDP
        { name: "Visa / Temporary (Legal)", tax: state.simulatedData.raw_legal_noncitizen_tax, spend: state.simulatedData.raw_legal_noncitizen_spend, net: state.simulatedData.legal_noncitizen, pc: state.simulatedData.pc_legal_noncitizen, gdp: (217459.0 - 190284.0) / 10.0 },
        { name: "Undocumented (Illegal)", tax: state.simulatedData.raw_illegal_tax, spend: state.simulatedData.raw_illegal_spend, net: state.simulatedData.illegal, pc: state.simulatedData.pc_illegal, gdp: 190284.0 / 10.0 },
        { name: "All Immigrants (Combined)", tax: state.simulatedData.raw_naturalized_tax + state.simulatedData.raw_legal_noncitizen_tax + state.simulatedData.raw_illegal_tax, spend: state.simulatedData.raw_naturalized_spend + state.simulatedData.raw_legal_noncitizen_spend + state.simulatedData.raw_illegal_spend, net: state.simulatedData.all_immigrants, pc: state.simulatedData.pc_all_immigrants, gdp: 287150.0 / 10.0 },
        { name: "U.S.-Born Natives", tax: 148715.0, spend: 193069.0, net: state.simulatedData.natives, pc: state.simulatedData.pc_natives, gdp: 530890.0 / 10.0 }
    ];

    dataList.forEach(item => {
        const tr = document.createElement("tr");
        
        let netPctGDP = ((item.net / item.gdp) * 100).toFixed(1) + "%";
        if (item.name === "U.S.-Born Natives" || item.name === "Second Gen") {
            netPctGDP = ((item.net / 530890.0) * 100).toFixed(1) + "%";
        }
        
        let formattedNet = (item.net >= 0 ? "+" : "-") + "$" + Math.abs(item.net).toFixed(1) + "B";
        if (Math.abs(item.net) >= 1000.0) {
            formattedNet = (item.net >= 0 ? "+" : "-") + "$" + (Math.abs(item.net) / 1000.0).toFixed(2) + "T";
        }

        let formattedPC = (item.pc >= 0 ? "+" : "-") + "$" + Math.abs(item.pc).toLocaleString(undefined, {maximumFractionDigits:0});

        tr.innerHTML = `
            <td style="font-weight:600;">${item.name}</td>
            <td>$${item.tax.toFixed(1)}B</td>
            <td>$${item.spend.toFixed(1)}B</td>
            <td class="${item.net >= 0 ? 'positive' : 'negative'}">${formattedNet}</td>
            <td class="${item.pc >= 0 ? 'positive' : 'negative'}">${formattedPC}</td>
            <td>$${item.gdp.toFixed(1)}B</td>
            <td class="${item.net >= 0 ? 'positive' : 'negative'}">${netPctGDP}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderVariablesTable() {
    const tbody = document.getElementById("table-variables-body");
    tbody.innerHTML = "";

    const a4 = CATO_STUDY_DATA.spending_and_taxes_detail;
    let filtered = a4;
    
    if (state.categoryFilter !== 'all') {
        filtered = a4.filter(item => item.classification === state.categoryFilter);
    }

    filtered.forEach(item => {
        const tr = document.createElement("tr");
        
        const diff = item.immigrants - item.us_born;
        const total = item.us_born + item.immigrants;
        const usShare = total !== 0 ? ((item.us_born / total) * 100).toFixed(1) + "%" : "0%";
        const immShare = total !== 0 ? ((item.immigrants / total) * 100).toFixed(1) + "%" : "0%";

        let catName = item.classification;
        if (catName === 'OldAge') catName = 'Old-Age Benefit';
        if (catName === 'Needs') catName = 'Needs-based/Welfare';
        if (catName === 'PurePublic') catName = 'Pure Public Good';

        tr.innerHTML = `
            <td>${item.name}</td>
            <td><span class="badge" style="border-color:transparent; background:rgba(255,255,255,0.06); color:#9ca3af;">${catName}</span></td>
            <td>$${item.us_born.toFixed(1)}B</td>
            <td>$${item.immigrants.toFixed(1)}B</td>
            <td class="${diff >= 0 ? 'positive' : 'negative'}">${(diff >= 0 ? '+' : '-') + '$' + Math.abs(diff).toFixed(1)}B</td>
            <td>${usShare}</td>
            <td>${immShare}</td>
        `;
        tbody.appendChild(tr);
    });
}

function initRawDataViewer() {
    const rawCodeBlock = document.getElementById("raw-json-block");
    if (!rawCodeBlock) return;
    
    const rawJsonStr = JSON.stringify(CATO_STUDY_DATA, null, 2);
    rawCodeBlock.innerText = rawJsonStr;
    
    // Copy button
    const btnCopy = document.getElementById("btn-copy-raw-json");
    btnCopy.addEventListener("click", () => {
        navigator.clipboard.writeText(rawJsonStr).then(() => {
            const originalText = btnCopy.innerHTML;
            btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                btnCopy.innerHTML = originalText;
            }, 2000);
        });
    });
    
    // Download JSON button
    const btnDownloadJson = document.getElementById("btn-download-raw-json");
    btnDownloadJson.addEventListener("click", () => {
        let blob = new Blob([rawJsonStr], { type: 'application/json;charset=utf-8;' });
        let url = URL.createObjectURL(blob);
        let link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "cato_immigration_fiscal_data.json");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    
    // Download CSV button
    const btnDownloadCsv = document.getElementById("btn-download-raw-csv");
    btnDownloadCsv.addEventListener("click", () => {
        let detail = CATO_STUDY_DATA.spending_and_taxes_detail;
        let csv = "Item Name,Classification,US-Born Cumulative Total (Billions),Immigrant Cumulative Total (Billions),Difference (Billions)\n";
        detail.forEach(item => {
            let name = `"${item.name.replace(/"/g, '""')}"`;
            let diff = (item.immigrants - item.us_born).toFixed(1);
            csv += `${name},${item.classification},${item.us_born.toFixed(1)},${item.immigrants.toFixed(1)},${diff}\n`;
        });
        
        let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        let url = URL.createObjectURL(blob);
        let link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "cato_immigration_fiscal_data.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}
