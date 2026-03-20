// --- State Management ---
let currentFlow = null;
let currentStep = null;
let chartInstance = null;

let selectedKid = {
    name: '???',
    avatar: '❓'
};

let selectedKidAge = 13;
const FINAL_AGE = 65;
const setupState = {
    nameSet: false,
    avatarSet: false,
    ageSet: true
};

const defaultKidAvatar = {
    Fionoa: '🦊',
    Dhruv: '🐯',
    Kate: '🦉',
    Taylor: '🐺',
    Mehr: '🐼'
};

// Character Journey State (Alex)
const charState = {
    pmt: 0,
    assetClass: 'none', // 'none' (0%), 'cash' (2%) vs 'sp500' (8%)
    fee: 0.05, // 0.05% vs 1.5%
    companies: 500,
    companyOutcomePct: -100
};

const riskState = {
    mode: 'story',
    lastRoll: null,
    lastRollPercentile: null
};

// Concept Sandbox State
const conceptState = {
    pmt: 500,
    rate: 8,
    fee: 1.5,
    companies: 1, // number of companies in portfolio
    companyOutcomePct: -100, // outcome of one company at shock year
    startAge: 20
};

// Formatter
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// --- Math Helpers ---
function calcCompoundPath(p, pmt, rate, fee, startAge, endAge, crashAge = null, crashPct = 0) {
    const years = endAge - startAge;
    const r = (rate - fee) / 100;
    const data = [];
    let current = p;
    
    for(let i=0; i<=years; i++) {
        if(i === 0) {
            data.push(current);
        } else {
            // Apply crash if this is the crash year
            if (crashAge !== null && (startAge + i) === crashAge) {
                current = current * (1 - crashPct);
            } else {
                current = current * (1 + r) + (pmt * 12);
            }
            data.push(current);
        }
    }
    return data;
}

// --- UI Scoreboard Helpers ---
function updateScoreboard(visible, mainTitle='', mainValue=0, mainColor='text-green-400', showCompare=false, compareTitle='', compareValue=0, compareColor='text-red-400') {
    const sb = document.getElementById('viz-scoreboard');
    if (!sb) return;

    if (!visible) {
        sb.classList.add('hidden');
        return;
    }
    
    sb.classList.remove('hidden');

    // Main Value
    document.getElementById('sb-title').innerText = mainTitle;
    const valEl = document.getElementById('sb-value');
    valEl.innerText = usd.format(mainValue);
    const mainAutoColor = mainValue > 0 ? 'text-green-400' : (mainValue < 0 ? 'text-red-400' : 'text-gray-300');
    valEl.className = `text-4xl md:text-5xl font-extrabold font-mono transition-colors duration-500 ${mainAutoColor}`;

    // Comparison Value
    const compBox = document.getElementById('sb-compare');
    if (showCompare) {
        compBox.classList.remove('hidden', 'opacity-0');
        compBox.classList.add('opacity-100');
        document.getElementById('sb-compare-title').innerText = compareTitle;
        const compEl = document.getElementById('sb-compare-value');
        compEl.innerText = usd.format(compareValue);
        const compareAutoColor = compareValue > 0 ? 'text-green-400' : (compareValue < 0 ? 'text-red-400' : 'text-gray-300');
        compEl.className = `text-2xl md:text-3xl font-bold font-mono transition-colors duration-500 ${compareAutoColor}`;
    } else {
        compBox.classList.remove('opacity-100');
        compBox.classList.add('opacity-0', 'hidden');
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function setClassName(id, className) {
    const el = document.getElementById(id);
    if (el) el.className = className;
}

function getAssetLabel() {
    if (charState.assetClass === 'sp500') return 'S&P 500 (8%)';
    if (charState.assetClass === 'cash') return 'Bank (2%)';
    return 'No Investment (0%)';
}

function getFeeLabel() {
    return charState.fee === 1.5 ? 'Active (1.50%)' : 'Passive (0.05%)';
}

function getEventLabel() {
    const v = charState.companyOutcomePct;
    if (v === -100) return 'Bust (-100%)';
    if (v === 8) return 'Average Year (+8%)';
    if (v === 100) return 'Good (+100%)';
    if (v === 300) return 'Great (+300%)';
    if (v === 800) return 'Outlier (+800%)';
    return `${v > 0 ? '+' : ''}${v}%`;
}

function getEventLabelFromPct(v) {
    if (v === -100) return 'Bust (-100%)';
    if (v === 8) return 'Average Year (+8%)';
    if (v === 100) return 'Good (+100%)';
    if (v === 300) return 'Great (+300%)';
    if (v === 800) return 'Outlier (+800%)';
    return `${v > 0 ? '+' : ''}${Math.round(v)}%`;
}

function getStoryStepIndex(step) {
    if (!step || step[0] !== 'c') return 0;
    const n = parseInt(step.slice(1), 10);
    return Number.isNaN(n) ? 0 : n;
}

function updateJourneyLedger() {
    const ledger = document.getElementById('journey-ledger');
    if (!ledger) return;

    if (currentFlow !== 'character') {
        ledger.classList.add('hidden');
        return;
    }
    ledger.classList.remove('hidden');

    const stepIdx = getStoryStepIndex(currentStep);
    const startAge = selectedKidAge;
    setText('jl-savings', usd.format(charState.pmt) + '/mo');
    setText('jl-asset', getAssetLabel());
    setText('jl-fee', getFeeLabel());
    setText('jl-companies', `${charState.companies} companies`);
    setText('jl-event', getEventLabel());

    setClassName('jl-row-savings', stepIdx >= 1 ? 'inline-flex items-center gap-1' : 'hidden');
    setClassName('jl-row-asset', stepIdx >= 2 ? 'inline-flex items-center gap-1' : 'hidden');
    setClassName('jl-row-fee', stepIdx >= 3 ? 'inline-flex items-center gap-1' : 'hidden');
}

function refreshCharacterUI() {
    updateJourneyLedger();
    updateRiskControlsVisibility();
}

function setConceptOutcome(outcomePct, buttonEl = null) {
    conceptState.companyOutcomePct = outcomePct;
    if (buttonEl) {
        document.querySelectorAll('.btn-outcome').forEach(el => el.classList.remove('selected', 'selected-red', 'selected-green'));
        if (outcomePct >= 0) {
            buttonEl.classList.add('selected-green');
        } else {
            buttonEl.classList.add('selected-red');
        }
    }

    const impact = (conceptState.companyOutcomePct / conceptState.companies);
    const sign = impact > 0 ? '+' : '';
    const damageEl = document.getElementById('s4-damage-val');
    if (damageEl) {
        damageEl.innerText = sign + impact.toFixed(1).replace('.0', '') + '%';
        damageEl.className = impact > 0 ? 'text-3xl font-extrabold text-green-600' : (impact < 0 ? 'text-3xl font-extrabold text-red-600' : 'text-3xl font-extrabold text-gray-600');
    }

    updateConceptChart();
}

function canStartStory() {
    return setupState.nameSet && setupState.avatarSet && setupState.ageSet;
}

function updateStoryStartAvailability() {
    const startBtn = document.getElementById('start-story-btn');
    if (!startBtn) return;

    const ready = canStartStory();
    startBtn.disabled = !ready;
    startBtn.className = ready
        ? 'group relative bg-white bg-opacity-10 hover:bg-opacity-20 border border-brand-500 rounded-2xl p-8 text-left transition-all duration-300 transform hover:-translate-y-1 cursor-pointer opacity-100'
        : 'group relative bg-white bg-opacity-10 border border-brand-500 rounded-2xl p-8 text-left transition-all duration-300 opacity-40 cursor-not-allowed';
}

function getCharBaseRate() {
    if (charState.assetClass === 'sp500') return 8;
    if (charState.assetClass === 'cash') return 2;
    return 0;
}

function getCharShockPct() {
    return (charState.companyOutcomePct / 100) * (1 / charState.companies);
}

function randomNormal() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function stdNormalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) p = 1 - p;
    return p;
}

function sampleSingleCompanyReturn() {
    // Geometric Brownian style single-stock annual draw.
    // Median is close to market-like return, but tails are wide.
    const mu = Math.log(1.08);
    const sigma = 0.95;
    const z = randomNormal();
    const gross = Math.exp(mu - 0.5 * sigma * sigma + sigma * z);
    const cappedGross = Math.max(0, Math.min(9, gross));
    const returnPct = (cappedGross - 1) * 100;
    const percentile = stdNormalCDF(z) * 100;
    return { returnPct, percentile };
}

function singleCompanyReturnAtPercentile(z) {
    const mu = Math.log(1.08);
    const sigma = 0.95;
    const gross = Math.exp(mu - 0.5 * sigma * sigma + sigma * z);
    const cappedGross = Math.max(0, Math.min(9, gross));
    return (cappedGross - 1) * 100;
}

function percentileImpact(companies, z) {
    const outcome = singleCompanyReturnAtPercentile(z);
    return outcome / companies;
}

function buildPathFromImpactPct(startAge, rate, fee, pmt, impactPct) {
    const crashAge = Math.max(startAge + 1, 45);
    return calcCompoundPath(0, pmt, rate, fee, startAge, FINAL_AGE, crashAge, -(impactPct / 100));
}

function getRollMedianFinal(startAge, rate, fee, pmt) {
    const curves = getRiskCurves(startAge, rate, fee, pmt);
    const years = FINAL_AGE - startAge;
    return curves.medianPath[years];
}

function getRiskCurves(startAge, rate, fee, pmt) {
    const medianImpact = percentileImpact(charState.companies, 0);
    const p10Impact = percentileImpact(charState.companies, -1.2816);
    const p90Impact = percentileImpact(charState.companies, 1.2816);

    return {
        medianImpact,
        p10Impact,
        p90Impact,
        medianPath: buildPathFromImpactPct(startAge, rate, fee, pmt, medianImpact),
        p10Path: buildPathFromImpactPct(startAge, rate, fee, pmt, p10Impact),
        p90Path: buildPathFromImpactPct(startAge, rate, fee, pmt, p90Impact)
    };
}

function setRiskMode(mode) {
    riskState.mode = mode;

    const storyBtn = document.getElementById('risk-mode-story');
    const typicalBtn = document.getElementById('risk-mode-typical');
    if (storyBtn && typicalBtn) {
        storyBtn.classList.remove('selected', 'selected-green');
        typicalBtn.classList.remove('selected', 'selected-green');
        if (mode === 'story') storyBtn.classList.add('selected');
        else typicalBtn.classList.add('selected-green');
    }

    updateRiskControlsVisibility();
    updateCharacterChart();
}

function updateRiskControlsVisibility() {
    const controls = document.getElementById('risk-controls');
    if (!controls) return;

    const inRiskChapters = currentFlow === 'character' && (currentStep === 'c4' || currentStep === 'c5' || currentStep === 'c6');
    if (!inRiskChapters) {
        controls.classList.add('hidden');
        return;
    }

    controls.classList.remove('hidden');

    const rollBtn = document.getElementById('risk-roll-btn');
    const status = document.getElementById('risk-roll-status');
    const finalPreview = document.getElementById('risk-final-preview');
    const storyOutcomes = document.getElementById('risk-story-outcomes');
    const disabled = riskState.mode !== 'typical';

    if (storyOutcomes) {
        if (riskState.mode === 'typical') storyOutcomes.classList.add('hidden');
        else storyOutcomes.classList.remove('hidden');
    }

    [rollBtn].forEach(btn => {
        if (!btn) return;
        btn.disabled = disabled;
        if (disabled) btn.classList.add('opacity-40', 'cursor-not-allowed');
        else btn.classList.remove('opacity-40', 'cursor-not-allowed');
    });

    if (status) {
        if (disabled) {
            status.innerText = 'Story mode: use event chips.';
        } else if (riskState.lastRoll !== null && riskState.lastRollPercentile !== null) {
            status.innerText = `Last roll impact: ${(riskState.lastRoll > 0 ? '+' : '') + riskState.lastRoll.toFixed(1)}% | Percentile: ${Math.round(riskState.lastRollPercentile)}th`;
        } else {
            status.innerText = 'Roll to sample one possible outcome from the distribution.';
        }
    }

    if (finalPreview && selectedKidAge !== null) {
        const rate = getCharBaseRate();
        const fee = charState.fee;
        const pmt = charState.pmt;
        const years = FINAL_AGE - selectedKidAge;

        let finalVal = 0;
        if (riskState.mode === 'typical') {
            if (riskState.lastRoll !== null) {
                finalVal = buildPathFromImpactPct(selectedKidAge, rate, fee, pmt, riskState.lastRoll)[years];
            } else {
                finalVal = getRiskCurves(selectedKidAge, rate, fee, pmt).medianPath[years];
            }
        } else {
            finalVal = buildPathFromImpactPct(selectedKidAge, rate, fee, pmt, charState.companyOutcomePct / charState.companies)[years];
        }

        finalPreview.innerText = `Final at age ${FINAL_AGE}: ${usd.format(finalVal)}`;
    }
}

function rollRiskDraw() {
    if (riskState.mode !== 'typical') return;

    const draw = sampleSingleCompanyReturn();
    riskState.lastRoll = draw.returnPct / charState.companies;
    charState.companyOutcomePct = draw.returnPct;
    riskState.lastRollPercentile = draw.percentile;

    document.querySelectorAll('.btn-char-outcome').forEach(el => el.classList.remove('selected', 'selected-red', 'selected-green'));

    updateCharDiversificationReadout();
    updateRiskControlsVisibility();
    updateCharacterChart();
}

function updateCharDiversificationReadout() {
    const weightPct = (100 / charState.companies);
    const impactPct = charState.companyOutcomePct / charState.companies;
    const impactSign = impactPct > 0 ? '+' : '';

    const weightEl = document.getElementById('c4-weight-val');
    const impactEl = document.getElementById('c4-impact-val');
    const c5ImpactEl = document.getElementById('c5-impact-val');
    const c5Copy = document.getElementById('c5-impact-copy');
    const c5Panel = document.getElementById('c5-panel');
    const c5Title = document.getElementById('c5-title');
    const c5Subtitle = document.getElementById('c5-subtitle');
    const c4EventEl = document.getElementById('c4-active-event-val');

    if (weightEl) weightEl.innerText = weightPct.toFixed(weightPct >= 1 ? 0 : 2).replace('.00', '') + '%';

    if (impactEl) {
        impactEl.innerText = impactSign + impactPct.toFixed(Math.abs(impactPct) >= 1 ? 1 : 2).replace('.00', '').replace('.0', '') + '%';
        impactEl.className = `font-semibold ${impactPct > 0 ? 'text-green-600' : (impactPct < 0 ? 'text-red-600' : 'text-gray-600')}`;
    }

    if (c5ImpactEl) {
        c5ImpactEl.innerText = impactSign + impactPct.toFixed(Math.abs(impactPct) >= 1 ? 1 : 2).replace('.00', '').replace('.0', '') + '%';
        c5ImpactEl.className = `font-bold ${impactPct > 0 ? 'text-green-700' : (impactPct < 0 ? 'text-red-700' : 'text-gray-700')}`;
    }

    if (c5Copy) {
        c5Copy.className = impactPct > 0 ? 'text-green-900' : (impactPct < 0 ? 'text-red-900' : 'text-gray-900');
    }

    if (c4EventEl) c4EventEl.innerText = getEventLabelFromPct(charState.companyOutcomePct);

    if (c5Panel) {
        c5Panel.className = impactPct > 0
            ? 'rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900'
            : (impactPct < 0
                ? 'rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900'
                : 'rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900');
    }

    if (c5Title) {
        c5Title.innerText = impactPct > 0 ? 'Chapter 5: Upside Shock' : (impactPct < 0 ? 'Chapter 5: Downside Shock' : 'Chapter 5: Event Shock');
        c5Title.className = impactPct > 0
            ? 'text-4xl font-extrabold text-green-700 mb-4'
            : (impactPct < 0
                ? 'text-4xl font-extrabold text-red-600 mb-4'
                : 'text-4xl font-extrabold text-gray-900 mb-4');
    }

    if (c5Subtitle) {
        c5Subtitle.innerText = impactPct > 0
            ? `At age ${Math.max(selectedKidAge + 1, 45)}, one company surges. Your Chapter 4 exposure determines how much the portfolio jumps.`
            : (impactPct < 0
                ? `At age ${Math.max(selectedKidAge + 1, 45)}, one company takes a major hit. Your Chapter 4 exposure determines how hard the portfolio falls.`
                : `At age ${Math.max(selectedKidAge + 1, 45)}, one major event hits. Your Chapter 4 exposure determines the portfolio impact.`);
    }
}

function setCharCompanies(companies, buttonEl = null) {
    charState.companies = companies;

    if (buttonEl) {
        document.querySelectorAll('.btn-char-companies').forEach(el => el.classList.remove('selected', 'selected-red', 'selected-green'));
        if (companies === 1) buttonEl.classList.add('selected-red');
        else if (companies === 500) buttonEl.classList.add('selected-green');
        else buttonEl.classList.add('selected');
    }

    updateCharDiversificationReadout();
    riskState.lastRoll = null;
    riskState.lastRollPercentile = null;
    updateRiskControlsVisibility();
    updateCharacterChart();
}

function setCharOutcome(outcomePct, buttonEl = null) {
    charState.companyOutcomePct = outcomePct;

    if (buttonEl) {
        document.querySelectorAll('.btn-char-outcome').forEach(el => el.classList.remove('selected', 'selected-red', 'selected-green'));
        if (outcomePct >= 0) buttonEl.classList.add('selected-green');
        else buttonEl.classList.add('selected-red');
    }

    updateCharDiversificationReadout();
    riskState.lastRoll = null;
    riskState.lastRollPercentile = null;
    updateRiskControlsVisibility();
    updateCharacterChart();
}

// --- Initialization ---
function startFlow(flowType) {
    if (flowType === 'character' && !canStartStory()) {
        return;
    }

    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('app-container').classList.remove('hidden');
    
    currentFlow = flowType;
    
    // Hide all flows first
    document.getElementById('flow-character').style.display = 'none';
    document.getElementById('flow-concept').style.display = 'none';
    
    const handout = document.getElementById('flow-handout');
    if (handout) handout.style.display = 'none';
    
    const vizContainer = document.getElementById('sticky-viz-container');
    if (vizContainer) {
        if (flowType === 'handout') {
            vizContainer.classList.remove('lg:block');
            vizContainer.classList.add('hidden');
        } else {
            vizContainer.classList.add('lg:block');
        }
    }
    
    if(flowType === 'character') {
        document.getElementById('flow-title').innerText = `The Journey of ${selectedKid.name}`;
        const avatar = document.getElementById('flow-avatar');
        if (avatar) {
            avatar.classList.remove('hidden');
            avatar.classList.add('flex');
            avatar.innerText = selectedKid.avatar;
        }
        document.getElementById('flow-character').style.display = 'block';
        setupIntersectionObserver('flow-character');
        initChart();
        updateCharacterChart(); // Initial render
        refreshCharacterUI();
    } else if(flowType === 'concept') {
        document.getElementById('flow-title').innerText = "The Concept Sandbox";
        const avatar = document.getElementById('flow-avatar');
        if (avatar) {
            avatar.classList.add('hidden');
            avatar.classList.remove('flex');
        }
        document.getElementById('flow-concept').style.display = 'block';
        setupIntersectionObserver('flow-concept');
        initChart(); // Start with timeseries
        updateConceptChart(); // Initial render
        refreshCharacterUI();
    } else if(flowType === 'handout') {
        document.getElementById('flow-title').innerText = "Printable Study Guide";
        const avatar = document.getElementById('flow-avatar');
        if (avatar) {
            avatar.classList.add('hidden');
            avatar.classList.remove('flex');
        }
        if (handout) handout.style.display = 'block';
        refreshCharacterUI();
    }
    
    window.scrollTo(0,0);
}

function selectKidName(name, buttonEl = null) {
    selectedKid.name = name;
    setupState.nameSet = true;

    if (buttonEl) {
        document.querySelectorAll('.name-option').forEach(el => el.classList.remove('selected', 'selected-green', 'selected-red'));
        buttonEl.classList.add('selected');
    }

    document.querySelectorAll('[data-char-name]').forEach(el => {
        el.textContent = selectedKid.name;
    });

    const cardTitle = document.getElementById('journey-card-title');
    if (cardTitle) {
        cardTitle.innerText = `The Journey of ${selectedKid.name}`;
    }

    updateStoryStartAvailability();
}

function selectKidAvatar(avatar, buttonEl = null) {
    selectedKid.avatar = avatar;
    setupState.avatarSet = true;

    if (buttonEl) {
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected', 'selected-green', 'selected-red'));
        buttonEl.classList.add('selected-green');
    }

    const navAvatar = document.getElementById('flow-avatar');
    if (navAvatar) {
        navAvatar.innerText = selectedKid.avatar;
    }

    updateStoryStartAvailability();
}

function setKidAge(ageInput) {
    if (String(ageInput).trim() === '') {
        setupState.ageSet = false;
        selectedKidAge = null;
        const subtitle = document.getElementById('journey-card-subtitle');
        if (subtitle) subtitle.innerText = 'Choose a name, avatar, and age to unlock the story.';
        const startTokens = ['journey-age-start', 'story-age-start'];
        startTokens.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = '--';
        });
        updateStoryStartAvailability();
        return;
    }

    const parsed = parseInt(ageInput, 10);
    if (Number.isNaN(parsed)) {
        setupState.ageSet = false;
        updateStoryStartAvailability();
        return;
    }

    const age = Math.max(0, Math.min(60, parsed));
    selectedKidAge = age;
    setupState.ageSet = true;

    const ageInputEl = document.getElementById('kid-age-input');
    if (ageInputEl && String(ageInputEl.value) !== String(age)) {
        ageInputEl.value = age;
    }

    const startTokens = ['journey-age-start', 'story-age-start'];
    startTokens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = String(age);
    });

    const subtitle = document.getElementById('journey-card-subtitle');
    if (subtitle) {
        subtitle.innerText = `Follow one person's life from age ${age} to age ${FINAL_AGE}. Make interactive financial choices and watch the consequences compound over decades.`;
    }

    updateStoryStartAvailability();
}

// --- UI Interaction Handlers (Character) ---
function setCharInput(key, value, buttonEl = null, groupClass = null) {
    charState[key] = value;
    
    if (buttonEl && groupClass) {
        document.querySelectorAll(`.${groupClass}`).forEach(el => el.classList.remove('selected', 'selected-red', 'selected-green'));
        if ((key === 'assetClass' && (value === 'none' || value === 'cash')) || (key === 'fee' && value === 1.5)) {
            buttonEl.classList.add('selected-red');
        } else if ((key === 'assetClass' && value === 'sp500') || (key === 'fee' && value === 0.05)) {
            buttonEl.classList.add('selected-green');
        } else {
            buttonEl.classList.add('selected');
        }
    }
    
    updateCharacterChart();
    refreshCharacterUI();
}

document.addEventListener('DOMContentLoaded', () => {
    updateStoryStartAvailability();

    // Character Sliders
    const c1Savings = document.getElementById('c1-savings');
    if(c1Savings) {
        c1Savings.addEventListener('input', (e) => {
            charState.pmt = parseInt(e.target.value);
            document.getElementById('c1-savings-val').innerText = usd.format(charState.pmt);
            updateCharacterChart();
            refreshCharacterUI();
        });
    }

    // Concept Sliders
    const s1Pmt = document.getElementById('s1-pmt');
    const s1Rate = document.getElementById('s1-rate');
    const s2Age = document.getElementById('s2-age');
    const s3Fee = document.getElementById('s3-fee');
    const s4Companies = document.getElementById('s4-companies');

    if(s1Pmt) s1Pmt.addEventListener('input', (e) => { conceptState.pmt = parseInt(e.target.value); document.getElementById('s1-pmt-val').innerText = usd.format(conceptState.pmt); updateConceptChart(); });
    if(s1Rate) s1Rate.addEventListener('input', (e) => { conceptState.rate = parseInt(e.target.value); document.getElementById('s1-rate-val').innerText = conceptState.rate + '%'; updateConceptChart(); });
    if(s2Age) s2Age.addEventListener('input', (e) => { conceptState.startAge = parseInt(e.target.value); document.getElementById('s2-age-val').innerText = 'Age ' + conceptState.startAge; updateConceptChart(); });
    if(s3Fee) s3Fee.addEventListener('input', (e) => { conceptState.fee = parseFloat(e.target.value); document.getElementById('s3-fee-val').innerText = conceptState.fee.toFixed(2) + '%'; updateConceptChart(); });
    if(s4Companies) s4Companies.addEventListener('input', (e) => { 
        conceptState.companies = parseInt(e.target.value); 
        document.getElementById('s4-companies-val').innerText = conceptState.companies + (conceptState.companies === 1 ? ' Company' : ' Companies'); 
        const impact = (conceptState.companyOutcomePct / conceptState.companies);
        const sign = impact > 0 ? '+' : '';
        document.getElementById('s4-damage-val').innerText = sign + impact.toFixed(1).replace('.0', '') + '%';
        document.getElementById('s4-damage-val').className = impact > 0 ? 'text-3xl font-extrabold text-green-600' : (impact < 0 ? 'text-3xl font-extrabold text-red-600' : 'text-3xl font-extrabold text-gray-600');
        updateConceptChart(); 
    });
});


// --- Scrollytelling Logic (Intersection Observer) ---
function setupIntersectionObserver(containerId) {
    const steps = document.querySelectorAll(`#${containerId} .step`);
    
    const observerOptions = {
        root: null,
        rootMargin: '-50% 0px -50% 0px', // Trigger exactly in the middle of the screen
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                steps.forEach(s => s.classList.remove('is-active'));
                entry.target.classList.add('is-active');
                
                const stepId = entry.target.getAttribute('data-step');
                if(currentStep !== stepId) {
                    currentStep = stepId;
                    if(currentFlow === 'character') updateCharacterChart();
                    if(currentFlow === 'concept') updateConceptChart();
                    refreshCharacterUI();
                }
            }
        });
    }, observerOptions);

    steps.forEach(step => observer.observe(step));
}

// --- Chart Generation ---
function initChart() {
    if(chartInstance) {
        chartInstance.destroy();
    }

    const ctx = document.getElementById('mainChart').getContext('2d');
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const config = {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    title: { display: true, text: 'Timeline' },
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Wealth ($)' },
                    ticks: {
                        callback: function(val) {
                            if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
                            if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
                            return '$' + val;
                        }
                    }
                }
            },
            plugins: {
                legend: { position: 'bottom' },
                annotation: { annotations: {} },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += usd.format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    };
    chartInstance = new Chart(ctx, config);
}

// --- Flow 1: Character Logic ---
function updateCharacterChart() {
    if(!chartInstance) return;

    const startAge = selectedKidAge;
    const years = FINAL_AGE - startAge;
    const labels = Array.from({length: years + 1}, (_, i) => `Age ${startAge + i}`);
    const crashAge = Math.max(startAge + 1, 45);
    const crashIndex = crashAge - startAge;

    const c5EventAgeEl = document.getElementById('c5-event-age');
    const c6EventAgeEl = document.getElementById('c6-event-age');
    if (c5EventAgeEl) c5EventAgeEl.innerText = String(crashAge);
    if (c6EventAgeEl) c6EventAgeEl.innerText = String(crashAge);

    // Calculate different paths
    const rate = getCharBaseRate();
    const fee = charState.fee;
    const pmt = charState.pmt;
    
    // Baseline: Cash Contributed
    const dataContrib = calcCompoundPath(0, pmt, 0, 0, startAge, FINAL_AGE);
    // Ideal Path: S&P, no bad fees, no crash
    const dataIdeal = calcCompoundPath(0, pmt, 8, 0.05, startAge, FINAL_AGE);
    // Current Path up to the crash point
    let dataCurrent = calcCompoundPath(0, pmt, rate, fee, startAge, FINAL_AGE);

    chartInstance.data.labels = labels;

    // Reset annotations
    chartInstance.options.plugins.annotation.annotations = {};

    if(currentStep === 'c1') {
        // Just show savings growing linearly
        updateScoreboard(true, `Final Wealth at Age ${FINAL_AGE}`, dataContrib[years], '', false);
        chartInstance.data.datasets = [
            { label: 'Total Cash Saved', data: dataContrib, borderColor: '#9ca3af', backgroundColor: 'rgba(156, 163, 175, 0.1)', fill: true, tension: 0 }
        ];
    } 
    else if (currentStep === 'c2') {
        // Introduce Return Rates (Cash vs S&P)
        updateScoreboard(true, 'Wealth at Age 65', dataCurrent[years], charState.assetClass === 'sp500' ? 'text-green-400' : 'text-red-400', 
            true, 'Cash Contributed', dataContrib[years], 'text-gray-400');

        chartInstance.data.datasets = [
            { label: 'Total Cash Saved', data: dataContrib, borderColor: '#d1d5db', borderDash: [5,5], fill: false, tension: 0 },
            { label: charState.assetClass === 'sp500' ? 'S&P 500 (8%)' : (charState.assetClass === 'cash' ? 'Bank Account (2%)' : 'No Investment (0%)'), data: dataCurrent, borderColor: charState.assetClass === 'sp500' ? '#22c55e' : '#ef4444', backgroundColor: charState.assetClass === 'sp500' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
        ];
    }
    else if (currentStep === 'c3') {
        const dataActive = calcCompoundPath(0, pmt, rate, 1.5, startAge, FINAL_AGE);
        const dataPassive = calcCompoundPath(0, pmt, rate, 0.05, startAge, FINAL_AGE);

        const isActiveSelected = charState.fee === 1.5;
        const wealthLost = dataPassive[years] - dataActive[years];

        updateScoreboard(
            true,
            'Final Wealth',
            isActiveSelected ? dataActive[years] : dataPassive[years],
            isActiveSelected ? 'text-red-400' : 'text-green-400',
            isActiveSelected,
            'Lost To Wall Street',
            -wealthLost,
            'text-red-500'
        );

        chartInstance.data.datasets = [
            {
                label: `Low Fee Path (0.05%) on ${rate}% base`,
                data: dataPassive, 
                borderColor: isActiveSelected ? '#86efac' : '#22c55e', // Dim if not selected
                backgroundColor: isActiveSelected ? 'transparent' : 'rgba(34, 197, 94, 0.15)', 
                borderWidth: isActiveSelected ? 2 : 4,
                borderDash: isActiveSelected ? [5,5] : [],
                fill: !isActiveSelected, 
                tension: 0.4 
            },
            {
                label: `High Fee Path (1.50%) on ${rate}% base`,
                data: dataActive, 
                borderColor: isActiveSelected ? '#ef4444' : '#fca5a5', // Bright red if selected
                backgroundColor: isActiveSelected ? 'rgba(239, 68, 68, 0.15)' : 'transparent', 
                borderWidth: isActiveSelected ? 4 : 2,
                borderDash: isActiveSelected ? [] : [5,5],
                fill: isActiveSelected, 
                tension: 0.4 
            }
        ];
        
        // Cleaner fee annotation: arrow at final year with compact label
        const endLabel = `Age ${FINAL_AGE}`;
        chartInstance.options.plugins.annotation.annotations = isActiveSelected
            ? {
                feeArrow: {
                    type: 'line',
                    xMin: endLabel,
                    xMax: endLabel,
                    yMin: dataActive[years],
                    yMax: dataPassive[years],
                    borderColor: 'rgba(239, 68, 68, 0.75)',
                    borderWidth: 3,
                    borderDash: [3, 3],
                    label: {
                        display: true,
                        content: `Lost to fees: ${usd.format(wealthLost)}`,
                        position: 'start',
                        yAdjust: -8,
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        color: '#b91c1c',
                        borderColor: '#fecaca',
                        borderWidth: 1,
                        padding: 6,
                        font: { weight: 'bold', size: 12 }
                    }
                },
                feePointTop: {
                    type: 'point',
                    xValue: endLabel,
                    yValue: dataPassive[years],
                    backgroundColor: '#22c55e',
                    radius: 4
                },
                feePointBottom: {
                    type: 'point',
                    xValue: endLabel,
                    yValue: dataActive[years],
                    backgroundColor: '#ef4444',
                    radius: 4
                }
            }
            : {};
    }
    else if (currentStep === 'c4' || currentStep === 'c5' || currentStep === 'c6') {
        updateCharDiversificationReadout();
        updateRiskControlsVisibility();

        const charShockPct = getCharShockPct();
        const riskCurves = getRiskCurves(startAge, rate, fee, pmt);

        let dataChosen = calcCompoundPath(0, pmt, rate, fee, startAge, FINAL_AGE, crashAge, -charShockPct);
        let dataDiversified = calcCompoundPath(0, pmt, rate, fee, startAge, FINAL_AGE);
        let dataMedian = riskCurves.medianPath;
        let dataP10 = riskCurves.p10Path;
        let dataP90 = riskCurves.p90Path;
        let dataRoll = riskState.lastRoll !== null ? buildPathFromImpactPct(startAge, rate, fee, pmt, riskState.lastRoll) : null;

        if (currentStep === 'c4') {
            if (riskState.mode === 'story') {
                dataChosen = dataChosen.map((v, i) => i <= crashIndex ? v : null);
                dataDiversified = dataDiversified.map((v, i) => i <= crashIndex ? v : null);
                dataMedian = dataMedian.map((v, i) => i <= crashIndex ? v : null);
                dataP10 = dataP10.map((v, i) => i <= crashIndex ? v : null);
                dataP90 = dataP90.map((v, i) => i <= crashIndex ? v : null);
                if (dataRoll) dataRoll = dataRoll.map((v, i) => i <= crashIndex ? v : null);
            }
        } else if (currentStep === 'c5') {
            dataChosen = dataChosen.map((v, i) => i <= (crashIndex + 1) ? v : null);
            dataDiversified = dataDiversified.map((v, i) => i <= (crashIndex + 1) ? v : null);
            dataMedian = dataMedian.map((v, i) => i <= (crashIndex + 1) ? v : null);
            dataP10 = dataP10.map((v, i) => i <= (crashIndex + 1) ? v : null);
            dataP90 = dataP90.map((v, i) => i <= (crashIndex + 1) ? v : null);
            if (dataRoll) dataRoll = dataRoll.map((v, i) => i <= (crashIndex + 1) ? v : null);
        }

        const chosenColor = charState.companies === 1 ? '#ef4444' : (charState.companies <= 10 ? '#f97316' : (charState.companies < 500 ? '#0ea5e9' : '#22c55e'));

        if (riskState.mode === 'typical') {
            chartInstance.data.datasets = [
                {
                    label: 'Bad Luck (10th)',
                    data: dataP10,
                    borderColor: '#ef4444',
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Good Luck (90th)',
                    data: dataP90,
                    borderColor: '#22c55e',
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Typical (Median)',
                    data: dataMedian,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.08)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Diversified Baseline (smooth)',
                    data: dataDiversified,
                    borderColor: '#9ca3af',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ];
            if (dataRoll) {
                chartInstance.data.datasets.push({
                    label: 'This Roll',
                    data: dataRoll,
                    borderColor: '#111827',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4
                });
            }
        } else {
            chartInstance.data.datasets = [
                {
                    label: 'Diversified Baseline (smooth market path)',
                    data: dataDiversified,
                    borderColor: '#9ca3af',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                },
                {
                    label: `${selectedKid.name}'s Portfolio (${charState.companies} companies)`,
                    data: dataChosen,
                    borderColor: chosenColor,
                    backgroundColor: charState.companies === 1 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(14, 165, 233, 0.12)',
                    fill: true,
                    tension: 0.4
                }
            ];
        }

        chartInstance.options.plugins.annotation.annotations = {
            eventLine: {
                type: 'line',
                xMin: `Age ${crashAge}`,
                xMax: `Age ${crashAge}`,
                borderColor: charShockPct >= 0 ? '#16a34a' : '#ef4444',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    display: true,
                    content: charShockPct >= 0 ? `Age ${crashAge}: One-company upside event` : `Age ${crashAge}: One-company downside event`,
                    position: 'start'
                }
            }
        };

        const noShockPath = calcCompoundPath(0, pmt, rate, fee, startAge, FINAL_AGE);
        const preShock = noShockPath[crashIndex];
        const activeImpact = (riskState.mode === 'typical')
            ? (riskState.lastRoll !== null ? riskState.lastRoll / 100 : riskCurves.medianImpact / 100)
            : charShockPct;
        const postChosen = preShock * (1 + activeImpact);
        const eventDelta = postChosen - preShock;

        if (currentStep === 'c4') {
            updateScoreboard(
                true,
                `Wealth Before Event (Age ${crashAge})`,
                preShock,
                '',
                true,
                'Event Impact (Dollar)',
                eventDelta,
                ''
            );
        } else if (currentStep === 'c5') {
            updateScoreboard(
                true,
                `After Shock (Age ${crashAge})`,
                postChosen,
                '',
                true,
                'One-Year Shock',
                eventDelta,
                ''
            );
        } else {
            const fullChosen = calcCompoundPath(0, pmt, rate, fee, startAge, FINAL_AGE, crashAge, -charShockPct);
            const fullDiversified = calcCompoundPath(0, pmt, rate, fee, startAge, FINAL_AGE);
            let activeFinal = fullChosen[years];
            if (riskState.mode === 'typical') {
                if (riskState.lastRoll !== null) {
                    const fullRoll = buildPathFromImpactPct(startAge, rate, fee, pmt, riskState.lastRoll);
                    activeFinal = fullRoll[years];
                } else {
                    activeFinal = riskCurves.medianPath[years];
                }
            }
            const difference = activeFinal - fullDiversified[years];

            updateScoreboard(
                true,
                `Final Wealth at Age ${FINAL_AGE}`,
                activeFinal,
                '',
                true,
                riskState.mode === 'typical'
                    ? (riskState.lastRoll !== null ? 'Vs Typical Median' : 'Vs Diversified Baseline')
                    : (difference >= 0 ? 'Gain from Concentration' : 'Cost of Concentration'),
                riskState.mode === 'typical' && riskState.lastRoll !== null
                    ? activeFinal - getRollMedianFinal(startAge, rate, fee, pmt)
                    : difference,
                ''
            );

            if (riskState.mode === 'story') {
                chartInstance.data.datasets[0].data = fullDiversified;
                chartInstance.data.datasets[1].data = fullChosen;
            } else {
                chartInstance.data.datasets.forEach(ds => {
                    if (ds.label === 'Bad Luck (10th)') ds.data = riskCurves.p10Path;
                    if (ds.label === 'Good Luck (90th)') ds.data = riskCurves.p90Path;
                    if (ds.label === 'Typical (Median)') ds.data = riskCurves.medianPath;
                    if (ds.label === 'Diversified Baseline (smooth)') ds.data = fullDiversified;
                    if (ds.label === 'This Roll' && riskState.lastRoll !== null) ds.data = buildPathFromImpactPct(startAge, rate, fee, pmt, riskState.lastRoll);
                });
            }
        }
    }

    chartInstance.update();
    refreshCharacterUI();
}

// --- Flow 2: Concept Logic ---
function updateConceptChart() {
    if(!chartInstance) return;

    chartInstance.options.plugins.annotation.annotations = {};
    chartInstance.options.scales.y.max = undefined;

    if (currentStep === 's1' || currentStep === 's2' || currentStep === 's3') {
        const years = 65 - conceptState.startAge;
        const labels = Array.from({length: years + 1}, (_, i) => `Age ${conceptState.startAge + i}`);
        const dataBase = calcCompoundPath(0, conceptState.pmt, conceptState.rate, 0, conceptState.startAge, 65);

        chartInstance.data.labels = labels;

        if(currentStep === 's1') {
            const dataContrib = calcCompoundPath(0, conceptState.pmt, 0, 0, conceptState.startAge, 65);
            updateScoreboard(true, 'Wealth at Age 65', dataBase[years], 'text-green-400');
            chartInstance.data.datasets = [
                { label: `Gross Return (${conceptState.rate}%)`, data: dataBase, borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.1)', fill: true, tension: 0.4 },
                { label: 'Linear Savings (Cash)', data: dataContrib, borderColor: '#9ca3af', borderDash: [5,5], fill: false, tension: 0 }
            ];
        } 
        else if(currentStep === 's2') {
            // Compare starting early vs late
            // Base data is from 'startAge'. Let's show a ghost line of starting at 20.
            const labelsAll = Array.from({length: 46}, (_, i) => `Age ${20 + i}`); // 20 to 65
            const dataStart20 = calcCompoundPath(0, conceptState.pmt, conceptState.rate, 0, 20, 65);
            
            // Pad the current delayed start data with nulls so it aligns on the x-axis
            const delayYears = conceptState.startAge - 20;
            const dataDelayed = Array(delayYears).fill(null).concat(dataBase);
            
            const costOfDelay = dataBase[years] - dataStart20[45];

            updateScoreboard(true, `Wealth (Start Age ${conceptState.startAge})`, dataBase[years], 'text-brand-400', 
                conceptState.startAge > 20, "Cost of waiting", costOfDelay, 'text-red-400');

            chartInstance.data.labels = labelsAll;
            chartInstance.data.datasets = [
                { label: `Start at Age 20`, data: dataStart20, borderColor: '#d1d5db', borderDash: [5,5], fill: false, tension: 0.4 },
                { label: `Start at Age ${conceptState.startAge}`, data: dataDelayed, borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.1)', fill: true, tension: 0.4 }
            ];
        }
        else if(currentStep === 's3') {
            const dataFee = calcCompoundPath(0, conceptState.pmt, conceptState.rate, conceptState.fee, conceptState.startAge, 65);
            
            const lostToFees = dataBase[years] - dataFee[years];
            
            updateScoreboard(true, "Wealth After Fees", dataFee[years], 'text-red-400',
                true, "Lost to Wall Street", -lostToFees, 'text-red-500');

            chartInstance.data.datasets = [
                { label: `Gross Return (${conceptState.rate}%)`, data: dataBase, borderColor: '#16a34a', fill: false, borderDash: [5,5], tension: 0.4 },
                { label: `After ${conceptState.fee.toFixed(2)}% Fee`, data: dataFee, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
            ];
        }
        
        chartInstance.update();
    } 
    else if (currentStep === 's4') {
        // The Shield of Diversification (Bankruptcy Simulation)
        const years = 30; // 30 year horizon
        const crashYear = 10;
        const labels = Array.from({length: years + 1}, (_, i) => `Year ${i}`);
        
        // Fixed starting scenario for clarity
        const initialInvestment = 10000;
        const growthRate = 8;
        
        // Calculate portfolio shock from one company outcome.
        // Example: companyOutcomePct = -100 and companies=1 => total loss.
        // Example: companyOutcomePct = +400 and companies=500 => tiny boost.
        const weight = 1 / conceptState.companies;
        const shockMultiplier = 1 + (conceptState.companyOutcomePct / 100) * weight;

        // Path without bankruptcy
        let dataBase = [];
        let val = initialInvestment;
        for(let i=0; i<=years; i++) {
            if (i > 0) val = val * (1 + growthRate/100);
            dataBase.push(val);
        }

        // Path with bankruptcy at Year 10
        let dataCrash = [];
        let valCrash = initialInvestment;
        for(let i=0; i<=years; i++) {
            if (i > 0) {
                if (i === crashYear) {
                    valCrash = valCrash * shockMultiplier;
                } else {
                    valCrash = valCrash * (1 + growthRate/100);
                }
            }
            dataCrash.push(valCrash);
        }

        chartInstance.data.labels = labels;
        chartInstance.data.datasets = [
            {
                label: `No Bankruptcies`,
                data: dataBase,
                borderColor: '#d1d5db',
                borderDash: [5,5],
                fill: false,
                tension: 0.4
            },
            {
                label: `Portfolio (${conceptState.companies} Companies)`,
                data: dataCrash,
                borderColor: conceptState.companies === 1 ? '#ef4444' : '#0ea5e9',
                backgroundColor: conceptState.companies === 1 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                fill: true,
                tension: 0.4
            }
        ];

        const outcomeLabel = conceptState.companyOutcomePct >= 0 ? `Year 10: One Company Jumps ${conceptState.companyOutcomePct}%` : `Year 10: One Company Falls ${Math.abs(conceptState.companyOutcomePct)}%`;

        chartInstance.options.plugins.annotation.annotations = {
            line1: {
                type: 'line', xMin: `Year ${crashYear}`, xMax: `Year ${crashYear}`, borderColor: conceptState.companyOutcomePct >= 0 ? '#22c55e' : '#ef4444', borderWidth: 2, borderDash: [5,5],
                label: { display: true, content: outcomeLabel, position: 'start' }
            }
        };

        const difference = dataCrash[years] - dataBase[years];
        updateScoreboard(true, `Wealth (Year 30)`, dataCrash[years], '',
            true, difference >= 0 ? "Gain from Concentration" : "Cost of Concentration", difference, '');

        chartInstance.update();
    }
}
