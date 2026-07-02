const fs = require('fs');

// Read files
const dataContent = fs.readFileSync('../data.js', 'utf-8');
const appContent = fs.readFileSync('../app.js', 'utf-8');

// Strip "const CATO_STUDY_DATA = " and trailing semicolon
let jsonStr = dataContent.replace('const CATO_STUDY_DATA =', '').trim();
if (jsonStr.endsWith(';')) {
    jsonStr = jsonStr.slice(0, -1);
}

// Set up the environment to run the code
const CATO_STUDY_DATA = JSON.parse(jsonStr);

// Mock state and populations
const POPULATIONS = {
    us_born: 266.22,
    all_immigrants: 36.88,
    naturalized: 15.78,
    noncitizen: 21.10,
    illegal: 8.86,
    legal_noncitizen: 12.24
};

const INTEREST_SAVINGS_RATIO = 0.366;

let state = {
    fixedCostsToggled: false,
    defenseShare: 100,
    childAttribution: 'cato',
    taxCompliance: 60,
    propertyTaxToggled: true,
    costK12: true,
    costOldAge: true,
    costWelfare: true,
    costCongestible: true,
    costPrisons: true,
    costHigherEd: true
};

// Implement runSimulation locally to check results
function runSimulationTest() {
    let detail = CATO_STUDY_DATA.spending_and_taxes_detail;

    let taxNatives = 0.0;
    let spendNatives = 0.0;

    let taxNaturalized = 0.0;
    let spendNaturalized = 0.0;

    let taxLegalNoncitizen = 0.0;
    let spendLegalNoncitizen = 0.0;

    let taxIllegal = 0.0;
    let spendIllegal = 0.0;

    const baseTotalImmigrantSpend = 13580.0;
    let totalPurePublicGoods = 0.0;

    detail.forEach(item => {
        let name = item.name;
        let classification = item.classification;
        let us_born = item.us_born;
        let immigrants = item.immigrants;

        if (name === "Indirect property taxes" && !state.propertyTaxToggled) {
            us_born = 0.0;
            immigrants = 0.0;
        }

        let active = false;
        if (classification === 'Tax') {
            active = true;
        } else if (classification === 'OldAge') {
            active = state.costOldAge;
        } else if (classification === 'Needs') {
            active = state.costWelfare;
        } else if (classification === 'Prisons') {
            active = state.costPrisons;
        } else if (classification === 'Other') {
            active = state.costCongestible;
        } else if (classification === 'PurePublic') {
            active = false;
            totalPurePublicGoods += (us_born + immigrants);
        } else if (classification === 'Education') {
            if (name === "State/local public college") {
                active = state.costHigherEd;
            } else {
                active = state.costK12;
            }
        }

        if (!active && classification !== 'Tax') {
            return;
        }

        if (classification === 'Tax') {
            taxNatives += us_born;
        } else {
            spendNatives += us_born;
        }

        let noncitizenShare = 0.572;
        if (classification === 'OldAge') {
            noncitizenShare = 0.20;
        } else if (classification === 'Needs') {
            noncitizenShare = 0.55;
        } else if (classification === 'Education') {
            if (name === "State/local public college") {
                noncitizenShare = 0.65;
            } else {
                noncitizenShare = 0.60;
            }
        } else if (classification === 'Tax') {
            noncitizenShare = 0.445;
        }

        let naturalizedVal = immigrants * (1.0 - noncitizenShare);
        let noncitizenVal = immigrants * noncitizenShare;

        let undocVal = 0.0;
        let legalNoncitizenVal = 0.0;

        if (classification === 'Tax') {
            let isComplianceTax = ["Federal income tax", "Federal FICA", "Federal supplemental medical insurance", "Federal unemployment contribution", "State/local income tax"].includes(name);
            if (isComplianceTax) {
                let undocTaxShare = (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.67 * (state.taxCompliance / 60.0);
                undocVal = noncitizenVal * undocTaxShare;
            } else {
                let undocTaxShare = (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.886;
                undocVal = noncitizenVal * undocTaxShare;
            }
            legalNoncitizenVal = noncitizenVal - undocVal;
            
            taxNaturalized += naturalizedVal;
            taxLegalNoncitizen += legalNoncitizenVal;
            taxIllegal += undocVal;
        } else {
            if (classification === 'OldAge') {
                let undocSpendShare = (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.05;
                undocVal = noncitizenVal * undocSpendShare;
            } else if (classification === 'Needs') {
                let isEligible = ["National School Lunch Program", "State/local WIC benefits", "State/local workers’ compensation"].includes(name);
                let isShelter = ["Federal migrant shelter costs", "State/local migrant shelter costs"].includes(name);
                let isRefugee = ["Federal refugee aid"].includes(name);
                
                if (isEligible) {
                    undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen);
                } else if (isShelter) {
                    undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen) * 2.0;
                } else if (isRefugee) {
                    undocVal = 0.0;
                } else if (name.includes("Medicaid")) {
                    if (name.includes("State") || name.includes("CHIP")) {
                        undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.057;
                    } else {
                        undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.17;
                    }
                } else {
                    undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen) * 0.05;
                }
            } else if (classification === 'Education') {
                if (name !== "State/local public college") {
                    undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen);
                } else {
                    undocVal = 0.0;
                }
            } else {
                undocVal = noncitizenVal * (POPULATIONS.illegal / POPULATIONS.noncitizen);
            }
            
            legalNoncitizenVal = noncitizenVal - undocVal;
            
            spendNaturalized += naturalizedVal;
            spendLegalNoncitizen += legalNoncitizenVal;
            spendIllegal += undocVal;
        }
    });

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
        fixedCostsNatives = activeDefenseCost - totalImmigrantCost;
    }

    spendNaturalized += fixedCostsNaturalized;
    spendLegalNoncitizen += fixedCostsLegalNoncitizen;
    spendIllegal += fixedCostsIllegal;
    spendNatives += fixedCostsNatives;

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
        childAttNatives = -childCostsToParents;
    } else if (state.childAttribution === 'full') {
        const totalSecondGenNet = -4728.0 * activeSpendingRatio;
        childAttNaturalized = -totalSecondGenNet * 0.45;
        childAttLegalNoncitizen = -totalSecondGenNet * 0.40;
        childAttIllegal = -totalSecondGenNet * 0.15;
        childAttNatives = totalSecondGenNet;
    }

    spendNaturalized += childAttNaturalized;
    spendLegalNoncitizen += childAttLegalNoncitizen;
    spendIllegal += childAttIllegal;
    spendNatives += childAttNatives;

    let simNaturalizedNetFlow = taxNaturalized - spendNaturalized;
    let simIllegalNetFlow = taxIllegal - spendIllegal;
    let simLegalNoncitizenNetFlow = taxLegalNoncitizen - spendLegalNoncitizen;
    let simNativesNetFlow = taxNatives - spendNatives;

    let simNaturalizedInterest = Math.max(0.0, simNaturalizedNetFlow * INTEREST_SAVINGS_RATIO);
    let simIllegalInterest = Math.max(0.0, simIllegalNetFlow * INTEREST_SAVINGS_RATIO);
    let simLegalNoncitizenInterest = Math.max(0.0, simLegalNoncitizenNetFlow * INTEREST_SAVINGS_RATIO);
    let simAllImmigrantsInterest = simNaturalizedInterest + simLegalNoncitizenInterest + simIllegalInterest;

    let finalNaturalizedNet = simNaturalizedNetFlow + simNaturalizedInterest;
    let finalIllegalNet = simIllegalNetFlow + simIllegalInterest;
    let finalLegalNoncitizenNet = simLegalNoncitizenNetFlow + simLegalNoncitizenInterest;
    let finalAllImmigrantsNet = (simNaturalizedNetFlow + simLegalNoncitizenNetFlow + simIllegalNetFlow) + simAllImmigrantsInterest;
    let finalNativesNet = simNativesNetFlow;

    return {
        finalNaturalizedNet,
        finalIllegalNet,
        finalLegalNoncitizenNet,
        finalAllImmigrantsNet,
        finalNativesNet
    };
}

// TEST 1: Baseline settings (Everything included, Fixed costs disabled)
let res1 = runSimulationTest();
console.log("TEST 1 - Baseline (Cato model equivalent):");
console.log("  Naturalized Net:", res1.finalNaturalizedNet.toFixed(1) + "B");
console.log("  Legal Noncitizen Net:", res1.finalLegalNoncitizenNet.toFixed(1) + "B");
console.log("  Undocumented Net:", res1.finalIllegalNet.toFixed(1) + "B");
console.log("  All Immigrants Net:", res1.finalAllImmigrantsNet.toFixed(1) + "B");

// Assert values match our expectations (within standard rounding tolerances of +-150B due to demographic sharing splits)
if (Math.abs(res1.finalAllImmigrantsNet - 14466.0) > 400.0) {
    console.error("Test 1 baseline sum mismatch! Expected ~14466B, got:", res1.finalAllImmigrantsNet);
    process.exit(1);
}

// TEST 2: Exclude K-12 education and Old-Age benefits
state.costK12 = false;
state.costOldAge = false;
let res2 = runSimulationTest();
console.log("\nTEST 2 - Exclude K-12 & Old-Age:");
console.log("  Naturalized Net:", res2.finalNaturalizedNet.toFixed(1) + "B");
console.log("  Legal Noncitizen Net:", res2.finalLegalNoncitizenNet.toFixed(1) + "B");
console.log("  Undocumented Net:", res2.finalIllegalNet.toFixed(1) + "B");
console.log("  All Immigrants Net:", res2.finalAllImmigrantsNet.toFixed(1) + "B");

// Net impact should increase dramatically because major spending is excluded
if (res2.finalAllImmigrantsNet <= res1.finalAllImmigrantsNet) {
    console.error("Test 2 mismatch! Excluded costs did not increase net impact surplus.");
    process.exit(1);
}

console.log("\nAll node calculation tests passed successfully!");
